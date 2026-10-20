// @vitest-environment node
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaleConfig, requestChaleModel } from './chale-provider.mjs';
import { BoundedBedrockHttpHandler } from './chale-bedrock-iam.mjs';

const transport = vi.hoisted(() => ({ handle: vi.fn(), destroy: vi.fn() }));
vi.mock('@smithy/node-http-handler', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, NodeHttpHandler: class extends actual.NodeHttpHandler {
    handle(...args) { return transport.handle(...args); }
    destroy() { super.destroy(); return transport.destroy(); }
  } };
});
const limit = 262144;
const answer = { stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'Use EcoVibes ID.' }] } }, usage: { inputTokens: 10, outputTokens: 5 } };
const payload = { instructions: 'App only', input: [{ role: 'user', content: 'Help with my account' }] };
const config = () => chaleConfig({ CHALE_PROVIDER: 'bedrock', AI_MODEL: 'qwen.fixture-v1:0', AWS_REGION: 'eu-west-1', CHALE_ALLOW_PAID: 'true', CHALE_REMOTE_APPROVED: 'true', CHALE_TIMEOUT_MS: '1000' });
function reply(value = answer, statusCode = 200) {
  return { response: { statusCode, headers: { 'content-type': 'application/json' }, body: Readable.from([JSON.stringify(value)]) } };
}
beforeEach(() => {
  transport.handle.mockReset(); transport.destroy.mockReset();
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'SYNTHETICACCESSKEY');
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'synthetic-secret-for-local-signing-only');
  vi.stubEnv('AWS_SESSION_TOKEN', 'synthetic-temporary-session');
  vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK', 'unused-private-bearer-sentinel');
  vi.stubEnv('AWS_AUTH_SCHEME_PREFERENCE', 'httpBearerAuth');
  vi.stubEnv('AWS_ENDPOINT_URL', 'https://unexpected-endpoint.invalid');
  vi.stubEnv('AWS_ENDPOINT_URL_BEDROCK_RUNTIME', 'https://unexpected-service-endpoint.invalid');
  vi.stubEnv('AWS_PROFILE', '');
  vi.stubEnv('AWS_EC2_METADATA_DISABLED', 'true');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('Bedrock IAM request boundary', () => {
  it('uses real SigV4 despite bearer and endpoint environments with one bounded read-only request', async () => {
    transport.handle.mockResolvedValue(reply());
    const result = await requestChaleModel(payload, undefined, config());
    expect(transport.handle).toHaveBeenCalledOnce();
    const [request, options] = transport.handle.mock.calls[0];
    expect(request.hostname).toBe('bedrock-runtime.eu-west-1.amazonaws.com');
    expect(request.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(request.headers['x-amz-security-token']).toBe('synthetic-temporary-session');
    expect(JSON.stringify(request)).not.toContain('unused-private-bearer-sentinel');
    expect(JSON.parse(Buffer.from(request.body).toString('utf8'))).toEqual({ system: [{ text: 'App only' }], messages: [{ role: 'user', content: [{ text: 'Help with my account' }] }], inferenceConfig: { maxTokens: 256, temperature: 0.2 } });
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, requests: 1 });
    expect(transport.destroy).toHaveBeenCalledOnce();
  });
  it('accepts the exact raw-body limit and rejects excess bytes before deserialization without retry', async () => {
    const json = JSON.stringify(answer);
    transport.handle.mockResolvedValue({ response: { statusCode: 200, headers: {}, body: Readable.from([json, ' '.repeat(limit - Buffer.byteLength(json))]) } });
    await expect(requestChaleModel(payload, undefined, config())).resolves.toMatchObject({ usage: { requests: 1 } });
    transport.handle.mockClear();
    const body = Readable.from([json, ' '.repeat(limit - Buffer.byteLength(json)), 'x']);
    transport.handle.mockResolvedValue({ response: { statusCode: 200, headers: {}, body } });
    await expect(requestChaleModel(payload, undefined, config())).rejects.toThrow('Chale inference request failed.');
    expect(transport.handle).toHaveBeenCalledOnce(); expect(body.destroyed).toBe(true);
  });
  it('cancels oversized declared and stalled bodies', async () => {
    const oversized = new Readable({ read() {} });
    const delegate = { handle: vi.fn(async () => ({ response: { statusCode: 200, headers: { 'content-length': String(limit + 1) }, body: oversized } })) };
    await expect(new BoundedBedrockHttpHandler(delegate).handle({}, {})).rejects.toThrow('response too large');
    expect(oversized.destroyed).toBe(true);
    const stalled = new Readable({ read() {} });
    transport.handle.mockResolvedValue({ response: { statusCode: 200, headers: {}, body: stalled } });
    const controller = new AbortController();
    const pending = requestChaleModel(payload, controller.signal, config());
    await vi.waitFor(() => expect(transport.handle).toHaveBeenCalledOnce());
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejection;
    expect(stalled.destroyed).toBe(true);
  });
  it('applies the whole-response deadline while collecting the body', async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const stalled = new Readable({ read() {} });
    transport.handle.mockResolvedValue({ response: { statusCode: 200, headers: {}, body: stalled } });
    const pending = requestChaleModel(payload, undefined, config());
    await vi.waitFor(() => expect(transport.handle).toHaveBeenCalledOnce());
    const rejection = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    deadline.abort(new DOMException('Synthetic deadline', 'TimeoutError')); await rejection;
    expect(AbortSignal.timeout).toHaveBeenCalledWith(1000); expect(stalled.destroyed).toBe(true);
  });
  it.each([429, 503])('sanitizes errors and never retries HTTP %s', async (status) => {
    transport.handle.mockResolvedValue(reply({ __type: status === 429 ? 'ThrottlingException' : 'ServiceUnavailableException', message: 'private-provider-body-sentinel' }, status));
    let failure;
    try { await requestChaleModel(payload, undefined, config()); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ name: 'Error', message: 'Chale inference request failed.', status });
    expect(failure.cause).toBeUndefined(); expect(failure.$metadata).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain('private-provider-body-sentinel'); expect(transport.handle).toHaveBeenCalledOnce();
  });
  it.each([
    { ...answer, stopReason: 'max_tokens' }, { ...answer, stopReason: 'tool_use' },
    { ...answer, output: { message: { content: [{ toolUse: { toolUseId: 'fixture', name: 'pay', input: {} } }] } } },
    { ...answer, output: { message: { content: [{ text: '<think>private reasoning' }] } } },
  ])('refuses partial, action or reasoning output', async (value) => {
    transport.handle.mockResolvedValue(reply(value));
    await expect(requestChaleModel(payload, undefined, config())).rejects.toThrow(); expect(transport.handle).toHaveBeenCalledOnce();
  });
  it('never signs or requests after cancellation', async () => {
    await expect(requestChaleModel(payload, AbortSignal.abort(), config())).rejects.toThrow(); expect(transport.handle).not.toHaveBeenCalled();
  });
});
