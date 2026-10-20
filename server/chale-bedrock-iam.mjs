import { Readable } from 'node:stream';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const MAX_RESPONSE_BYTES = 262144;
function cancelled(signal) {
  return new DOMException('Chale inference request cancelled.', signal?.reason?.name === 'TimeoutError' ? 'TimeoutError' : 'AbortError');
}

// Bound bytes before the SDK JSON deserializer. This is non-streaming Converse.
export class BoundedBedrockHttpHandler {
  constructor(handler = new NodeHttpHandler()) {
    this.handler = handler;
    this.metadata = handler.metadata || { handlerProtocol: 'http/1.1' };
  }
  async handle(request, options = {}) {
    const signal = options.abortSignal;
    if (signal?.aborted) throw cancelled(signal);
    const result = await this.handler.handle(request, options);
    const response = result.response;
    const body = response?.body;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function' || typeof body.destroy !== 'function') {
      body?.destroy?.();
      throw new Error('Invalid Chale provider response.');
    }
    const length = Object.entries(response.headers || {}).find(([name]) => name.toLowerCase() === 'content-length')?.[1];
    if (Number(length) > MAX_RESPONSE_BYTES) {
      body.destroy();
      throw new Error('Chale provider response too large.');
    }
    const abort = () => body.destroy(cancelled(signal));
    signal?.addEventListener('abort', abort, { once: true });
    const chunks = [];
    let size = 0;
    try {
      if (signal?.aborted) throw cancelled(signal);
      for await (const chunk of body) {
        if (signal?.aborted) throw cancelled(signal);
        const bytes = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
        if (!Number.isInteger(bytes) || bytes < 0 || size + bytes > MAX_RESPONSE_BYTES) throw new Error('Chale provider response too large.');
        size += bytes;
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (signal?.aborted) throw cancelled(signal);
      return { ...result, response: { ...response, body: Readable.from([Buffer.concat(chunks, size)]) } };
    } catch (error) {
      body.destroy();
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
  updateHttpClientConfig(...args) { return this.handler.updateHttpClientConfig?.(...args); }
  httpHandlerConfigs() { return this.handler.httpHandlerConfigs?.() || {}; }
  destroy() { this.handler.destroy?.(); }
}

// Also bound credential resolution; a late result sees an aborted HTTP signal.
function sendUntilCancelled(client, command, signal) {
  if (signal?.aborted) return Promise.reject(cancelled(signal));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(cancelled(signal)); };
    signal?.addEventListener('abort', abort, { once: true });
    client.send(command, { abortSignal: signal }).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}

export async function requestBedrockIAM(body, config, signal) {
  if (signal?.aborted) throw cancelled(signal);
  let client;
  try {
    client = new BedrockRuntimeClient({
      region: config.region,
      endpoint: `https://bedrock-runtime.${config.region}.amazonaws.com`,
      ignoreConfiguredEndpointUrls: true,
      // Never fall through to a legacy bearer token from the host environment.
      authSchemePreference: ['sigv4'],
      maxAttempts: 1,
      requestHandler: new BoundedBedrockHttpHandler(),
    });
    return await sendUntilCancelled(client, new ConverseCommand({ ...body, modelId: config.model }), signal);
  } catch (error) {
    if (signal?.aborted) throw cancelled(signal);
    const safe = new Error('Chale inference request failed.');
    const status = error?.$metadata?.httpStatusCode;
    if (Number.isInteger(status) && status >= 400 && status <= 599) safe.status = status;
    if (error?.name === 'ThrottlingException') safe.providerCode = 'rate_limit_exceeded';
    throw safe;
  } finally {
    client?.destroy();
  }
}
