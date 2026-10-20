// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chaleConfig, chaleStatus, requestChaleModel } from './chale-provider.mjs';
import { generateChaleAIReply } from './chale-ai.mjs';

const env = {
  CHALE_PROVIDER: 'cloudflare-free', CHALE_ALLOW_PAID: 'false',
  CHALE_REMOTE_APPROVED: 'true', CHALE_CLOUDFLARE_FREE_PLAN_CONFIRMED: 'true',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CHALE_INFERENCE_KEY: 'synthetic-fixture',
};
const completion = () => ({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Open Quick&Handi to find work.' } }], usage: { prompt_tokens: 20, completion_tokens: 9 } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Chale Cloudflare free launch', () => {
  it.each(['CHALE_REMOTE_APPROVED', 'CHALE_CLOUDFLARE_FREE_PLAN_CONFIRMED', 'CHALE_INFERENCE_KEY'])('requires explicit setup: %s', (key) => {
    expect(chaleConfig({ ...env, [key]: '' }).configured).toBe(false);
  });

  it('rejects a paid-mode flag even when legacy paid credentials exist', () => {
    expect(chaleConfig({ ...env, CHALE_ALLOW_PAID: 'true', AI_PROVIDER_KEY: 'unused' }).configured).toBe(false);
  });

  it.each(['', 'a'.repeat(31), 'https://other.example', '../account', 'a'.repeat(32) + '?key=x'])('rejects an invalid account identifier: %s', (account) => {
    expect(() => chaleConfig({ ...env, CLOUDFLARE_ACCOUNT_ID: account })).toThrow('Cloudflare');
  });

  it('pins the free-tier model and Cloudflare endpoint despite unrelated endpoint/model settings', () => {
    const config = chaleConfig({ ...env, AI_MODEL: 'paid-model', CHALE_BASE_URL: 'https://other.example/v1' });
    expect(config).toMatchObject({ configured: true, provider: 'cloudflare-free', mode: 'grounded', billingPolicy: 'free-tier-only', model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', endpoint: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions` });
  });

  it('translates one bounded grounded request without provider-specific reasoning fields', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(completion()))); vi.stubGlobal('fetch', fetch);
    const reply = await requestChaleModel({ instructions: 'Only help with Ecovibes.', input: [{ role: 'user', content: 'Where can I find work?' }], model: 'spoofed-model' }, undefined, chaleConfig(env));
    expect(fetch).toHaveBeenCalledOnce();
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`);
    expect(request.redirect).toBe('error'); expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body)).toEqual({ model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', messages: [{ role: 'system', content: 'Only help with Ecovibes.' }, { role: 'user', content: 'Where can I find work?' }], stream: false, max_tokens: 256, temperature: 0.2, options: { rejectIfBusy: true } });
    expect(reply.usage).toMatchObject({ inputTokens: 20, outputTokens: 9, requests: 1 });
  });

  it('stops on the provider allowance error without retry or fallback and hides its details', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ errors: [{ code: 99999, message: 'private-provider-detail' }] }), { status: 429 })); vi.stubGlobal('fetch', fetch);
    let caught;
    try { await requestChaleModel({ input: [] }, undefined, chaleConfig(env)); } catch (error) { caught = error; }
    expect(caught).toMatchObject({ message: 'Chale inference request failed.', status: 429, providerCode: 'rate_limit_exceeded' });
    expect(String(caught)).not.toContain('private-provider-detail'); expect(fetch).toHaveBeenCalledOnce();
  });

  it('keeps account identifiers and credentials out of public status', () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const status = chaleStatus();
    expect(status).toMatchObject({ configured: true, provider: 'cloudflare-free', paidFallback: false, billingPolicy: 'free-tier-only' });
    expect(JSON.stringify(status)).not.toContain(env.CHALE_INFERENCE_KEY); expect(JSON.stringify(status)).not.toContain(env.CLOUDFLARE_ACCOUNT_ID);
  });

  it('uses the existing grounded app workflow and excludes private catalogue fields', async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const fetch = vi.fn(async () => new Response(JSON.stringify(completion()))); vi.stubGlobal('fetch', fetch);
    const search = vi.fn(async () => [{ kind: 'job', id: 'public-job', title: 'Repair a chair', email: 'private-sentinel', user_id: 'private-sentinel' }]);
    const reply = await generateChaleAIReply([{ role: 'user', content: 'Find jobs on Quick&Handi' }], search, { currentPage: 'Quick&Handi' });
    expect(reply.source).toBe('model'); expect(reply.items[0].id).toBe('public-job'); expect(reply.guides.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][1].body).not.toContain('private-sentinel');
  });
});
