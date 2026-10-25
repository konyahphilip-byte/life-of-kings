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

  it.each(['Show products in Accra', 'Any repair jobs near Tema?', 'Show listings for chairs', 'Find JOBS in Osu', 'Find jobs I can apply for', 'Show products available in Marketplace', 'What products can I buy in Accra?', 'Where can I buy a chair in Osu?', 'Can I buy a chair in Osu?', 'How do I post jobs?'])('searches public catalog for natural plural wording: %s', async (query) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const fetch = vi.fn(async () => new Response(JSON.stringify(completion()))); vi.stubGlobal('fetch', fetch);
    const search = vi.fn(async () => [{ kind: 'job', id: 'public-match', title: 'Chair repair', user_id: 'private-catalog-sentinel' }]);
    const reply = await generateChaleAIReply([{ role: 'user', content: query }], search, { currentPage: 'Quick&Handi' });
    expect(search).toHaveBeenCalledExactlyOnceWith(query);
    expect(reply.items.map(item => item.id)).toEqual(['public-match']);
    expect(reply.source).toBe('model'); expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].body).not.toContain('private-catalog-sentinel');
  });

  it.each(['empty', 'unavailable'])('reports %s catalog honestly even when an app guide matches, without inference', async (state) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const search = vi.fn(async () => {
      if (state === 'unavailable') throw Error('private-database-sentinel');
      return [];
    });
    const reply = await generateChaleAIReply([{ role: 'user', content: 'Find jobs on Quick&Handi' }], search, { currentPage: 'Quick&Handi' });
    expect(search).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
    expect(reply).toMatchObject({ source: 'app_guide', items: [], usage: { requests: 0, inputTokens: 0, outputTokens: 0 } });
    expect(reply.guides.some(guide => guide.id === 'quickhandi')).toBe(true);
    for (const step of reply.guides[0].steps) expect(reply.text).toContain(step);
    expect(reply.text).toContain(state === 'empty' ? 'no matching public product or open job' : 'could not check the public catalog');
    expect(JSON.stringify(reply)).not.toContain('private-database-sentinel');
  });

  it.each(['How do I post jobs on Quick&Handi?', 'Show me how to sell products in Marketplace', 'Can I sell products in Marketplace?', 'Can I post a job on Quick&Handi?', 'How do I post jobs?', 'Help me post a job', 'I want to sell products', 'Can I list products?', 'Can I buy products in Marketplace?'])('provides exact verified steps when catalog is empty: %s', async (query) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const search = vi.fn(async () => []);
    const reply = await generateChaleAIReply([{ role: 'user', content: query }], search, { currentPage: 'Quick&Handi' });
    expect(search).toHaveBeenCalledExactlyOnceWith(query); expect(fetch).not.toHaveBeenCalled();
    expect(reply.source).toBe('app_guide'); expect(reply.guides.length).toBeGreaterThan(0);
    expect(reply.text).toContain('no matching public product or open job');
    expect(reply.text).toContain(reply.guides[0].title);
    for (const [index, step] of reply.guides[0].steps.entries()) expect(reply.text).toContain(`${index + 1}. ${step}`);
    expect(reply.usage.requests).toBe(0);
  });
});
