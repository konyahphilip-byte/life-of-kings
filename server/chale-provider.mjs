import { requestBedrockIAM } from './chale-bedrock-iam.mjs';

// All configuration is operator-owned. Chat requests cannot select a provider,
// endpoint, model, key, token limit or billing policy. There is no paid fallback.
const safeCodes = new Set(['usage_limit_exceeded', 'insufficient_quota', 'credit_balance_exhausted', 'rate_limit_exceeded']);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
let inFlight = 0;

function bounded(value, fallback, min, max) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('Invalid Chale limit configuration.');
  return n;
}

export function chaleConfig(env = process.env) {
  const provider = env.CHALE_PROVIDER || 'disabled';
  const config = {
    provider, configured: false, mode: 'grounded', hosting: null, model: null,
    dailyRequests: bounded(env.CHALE_DAILY_REQUESTS, 20, 1, 200),
    guestDailyRequests: bounded(env.CHALE_GUEST_DAILY_REQUESTS, 5, 1, 50),
    globalDailyRequests: bounded(env.CHALE_GLOBAL_DAILY_REQUESTS, 200, 1, 10000),
    concurrency: bounded(env.CHALE_CONCURRENCY, 1, 1, 4),
    maxOutputTokens: bounded(env.CHALE_MAX_OUTPUT_TOKENS, provider === 'openai' ? 700 : 256, 64, 700),
    timeoutMs: bounded(env.CHALE_TIMEOUT_MS, 60000, 1000, 75000),
  };
  if (provider === 'disabled') return config;
  if (!['ollama', 'compatible', 'openai', 'bedrock'].includes(provider)) throw new Error('Unsupported Chale provider.');
  config.model = env.AI_MODEL?.trim();
  if (!config.model || config.model.length > 160 || /[\u0000-\u001f]/.test(config.model)) return config;
  if (provider === 'openai') {
    // A key alone must never turn on a billable model.
    if (env.CHALE_ALLOW_PAID !== 'true') return config;
    config.key = env.AI_PROVIDER_KEY?.trim() || env.OPENAI_API_KEY?.trim();
    if (!config.key) return config;
    config.endpoint = 'https://api.openai.com/v1/responses';
    config.mode = 'tools';
    config.hosting = 'remote';
  } else if (provider === 'bedrock') {
    if (env.CHALE_ALLOW_PAID !== 'true' || env.CHALE_REMOTE_APPROVED !== 'true') return config;
    // Standard commercial AWS regions only; no arbitrary URL or prompt-router ARN.
    if (!/^(us|eu|ap|sa|ca|me|af|il|mx)-(central|east|west|south|north|southeast|northeast)-\d$/.test(env.AWS_REGION || '')
      || !/^[a-zA-Z0-9._:-]{1,160}$/.test(config.model)) throw new Error('Invalid Bedrock configuration.');
    config.region = env.AWS_REGION;
    config.bedrockAuth = env.CHALE_BEDROCK_AUTH || 'iam';
    if (!['iam', 'bearer'].includes(config.bedrockAuth)) throw new Error('Invalid Bedrock authentication configuration.');
    if (config.bedrockAuth === 'bearer') {
      config.key = env.AWS_BEARER_TOKEN_BEDROCK?.trim();
      if (!config.key) return config;
      config.endpoint = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(config.model)}/converse`;
    }
    config.hosting = 'remote';
  } else {
    if (!env.CHALE_BASE_URL) return config;
    let url;
    try { url = new URL(env.CHALE_BASE_URL); } catch { throw new Error('Invalid Chale endpoint.'); }
    const local = localHosts.has(url.hostname);
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)
      || (!local && url.protocol !== 'https:')) throw new Error('Invalid Chale endpoint.');
    config.key = env.CHALE_INFERENCE_KEY?.trim();
    // Explicit remote approval is separate from selecting a protocol adapter.
    if (!local && (env.CHALE_REMOTE_APPROVED !== 'true' || !config.key)) return config;
    config.endpoint = `${url.href.replace(/\/$/, '')}/${provider === 'ollama' ? 'api/chat' : 'chat/completions'}`;
    config.hosting = local ? 'local' : 'remote';
  }
  config.configured = true;
  return config;
}

export function chaleStatus() {
  try {
    const c = chaleConfig();
    return {
      configured: c.configured, provider: c.configured ? c.provider : null,
      model: c.configured ? c.model : null, hosting: c.configured ? c.hosting : null,
      mode: c.mode, dailyRequests: c.dailyRequests, guestDailyRequests: c.guestDailyRequests,
      paidFallback: false,
    };
  } catch {
    return { configured: false, provider: null, model: null, hosting: null, paidFallback: false };
  }
}

export function acquireChaleSlot(config = chaleConfig()) {
  if (inFlight >= config.concurrency) {
    const error = new Error('Chale is busy.');
    error.providerCode = 'chale_busy';
    throw error;
  }
  inFlight += 1;
  let released = false;
  return () => { if (!released) { inFlight -= 1; released = true; } };
}

async function boundedJson(response) {
  if (!response.body) throw new Error('Empty Chale provider response.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) throw new Error('Chale provider response too large.');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function count(value) { return Number.isInteger(value) && value >= 0 && value <= 1000000 ? value : null; }

export async function requestChaleModel(payload, signal, config = chaleConfig()) {
  signal?.throwIfAborted();
  if (!config.configured) throw new Error('Chale inference is not configured.');
  const started = performance.now();
  let body;
  if (config.provider === 'openai') {
    body = { ...payload, model: config.model, store: false, max_output_tokens: config.maxOutputTokens };
  } else if (config.provider === 'bedrock') {
    body = { system: [{ text: payload.instructions }],
      messages: payload.input.map(({ role, content }) => ({ role, content: [{ text: content }] })),
      inferenceConfig: { maxTokens: config.maxOutputTokens, temperature: 0.2 } };
  } else {
    const messages = [{ role: 'system', content: payload.instructions }, ...payload.input];
    body = config.provider === 'ollama'
      ? { model: config.model, messages, stream: false, think: false, keep_alive: '5m', options: { num_predict: config.maxOutputTokens, num_ctx: 4096, temperature: 0.2 } }
      : { model: config.model, messages, stream: false, max_tokens: config.maxOutputTokens, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } };
  }
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let value;
  if (config.provider === 'bedrock' && config.bedrockAuth === 'iam') {
    value = await requestBedrockIAM(body, config, requestSignal);
  } else {
    const response = await fetch(config.endpoint, {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}) },
      body: JSON.stringify(body), signal: requestSignal,
    });
    requestSignal.throwIfAborted();
    if (!response.ok) {
      const error = new Error('Chale inference request failed.');
      error.status = response.status;
      try { const result = await boundedJson(response); if (safeCodes.has(result?.error?.code)) error.providerCode = result.error.code; } catch { /* Never return provider bodies or secrets. */ }
      throw error;
    }
    value = await boundedJson(response);
  }
  requestSignal.throwIfAborted();
  let output, inputTokens, outputTokens;
  if (config.provider === 'openai') {
    if (value?.status !== 'completed' || !Array.isArray(value.output)) throw new Error('Chale AI did not complete its response.');
    output = value.output;
    inputTokens = count(value.usage?.input_tokens);
    outputTokens = count(value.usage?.output_tokens);
  } else if (config.provider === 'bedrock') {
    if (value?.stopReason !== 'end_turn' || !Array.isArray(value.output?.message?.content)
      || value.output.message.content.some((item) => item.toolUse)) throw new Error('Chale AI did not complete its response.');
    const text = value.output.message.content.filter((item) => typeof item.text === 'string').map((item) => item.text).join('\n').trim();
    if (!text || text.length > 6000 || /<\/?think>/i.test(text)) throw new Error('Chale AI returned an invalid answer.');
    output = [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }];
    inputTokens = count(value.usage?.inputTokens); outputTokens = count(value.usage?.outputTokens);
  } else {
    const message = config.provider === 'ollama' ? value.message : value.choices?.[0]?.message;
    const finished = config.provider === 'ollama' ? value.done === true && value.done_reason === 'stop' : value.choices?.[0]?.finish_reason === 'stop';
    if (!finished || typeof message?.content !== 'string' || message.tool_calls?.length) throw new Error('Chale AI did not complete its response.');
    // Reasoning is never used as a substitute for an answer or exposed to users.
    const text = message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!text || text.length > 6000 || /<\/?think>/i.test(text)) throw new Error('Chale AI returned an invalid answer.');
    output = [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }];
    inputTokens = count(config.provider === 'ollama' ? value.prompt_eval_count : value.usage?.prompt_tokens);
    outputTokens = count(config.provider === 'ollama' ? value.eval_count : value.usage?.completion_tokens);
  }
  return { output, usage: { inputTokens, outputTokens, latencyMs: Math.round(performance.now() - started), requests: 1 } };
}
