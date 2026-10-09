// Test-only Responses fixture. Never load in an Ecovibes runtime.
import { appendFileSync } from 'node:fs';
import { Server } from 'node:http';
if (process.env.NODE_ENV !== 'test' || process.env.AI_PROVIDER_KEY !== 'synthetic-chale-http-fixture' || !process.env.CHALE_SMOKE_CAPTURE) {
  throw new Error('The Chale provider fixture requires the isolated workflow test environment.');
}
// Optional sandbox transport: unchanged real HTTP handler over a temporary
// Unix domain socket when TCP listener permissions are unavailable.
// IPC confirms this child owns the listener before the parent sends requests.
const originalListen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  this.once('listening', () => {
    const address = this.address();
    process.send?.({ event: 'chale-smoke-ready', port: typeof address === 'object' ? address?.port : null });
  });
  if (!process.env.CHALE_SMOKE_SOCKET) return originalListen.apply(this, args);
  const ready = args.find((arg) => typeof arg === 'function');
  return originalListen.call(this, process.env.CHALE_SMOKE_SOCKET, ready);
};
const originalFetch = globalThis.fetch;
const calls = [];
const fixture = (name, args, suffix) => ({
  type: 'function_call', name, arguments: JSON.stringify(args),
  call_id: `fixture-${suffix}`, id: `fc_fixture_${suffix}`, status: 'completed',
});
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url !== 'https://api.openai.com/v1/responses') {
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Unexpected external network request in isolated smoke test.');
    return originalFetch(input, options);
  }
  const body = JSON.parse(options.body);
  if (options.headers.Authorization !== 'Bearer synthetic-chale-http-fixture') throw new Error('Unexpected provider credential in fixture.');
  const marker = body.input.filter((item) => item.role === 'user').at(-1)?.content || '';
  const toolResults = body.input.filter((item) => item.type === 'function_call_output');
  const contextMatch = body.instructions.match(/Safe current app context: (\{[^{}\n]*\})/);
  const context = contextMatch ? JSON.parse(contextMatch[1]) : null;
  const outputs = toolResults.map((item) => ({ callId: item.call_id, result: JSON.parse(item.output) }));
  const capture = {
    marker, context, store: body.store, toolChoice: body.tool_choice,
    declaredTools: body.tools.map((tool) => tool.name), results: outputs,
    instructionContainsIdentity: /smoke\.member|smoke\.seller|Smoke Member|Smoke Seller/.test(body.instructions),
  };
  calls.push(capture);
  appendFileSync(process.env.CHALE_SMOKE_CAPTURE, `${JSON.stringify(capture)}\n`, { mode: 0o600 });
  if (['QUOTA_FIXTURE', 'CREDIT_FIXTURE'].includes(marker)) return Response.json({ error: { code: marker === 'CREDIT_FIXTURE' ? 'credit_balance_exhausted' : 'usage_limit_exceeded', type: 'insufficient_quota', message: 'RAW_PROVIDER_PRIVATE_MARKER_DO_NOT_EXPOSE' } }, { status: 429 });
  let output;
  if (!toolResults.length) {
    output = marker === 'UNRELATED_TOOL_FIXTURE' ? [
      fixture('web_search', { query: 'Unrelated synthetic web request' }, 'forbidden-web'),
      fixture('execSQL', { query: 'DELETE FROM products' }, 'forbidden-sql'),
    ] : marker === 'FULL_WORKFLOW_FIXTURE' ? [
      { type: 'reasoning', id: 'rs_fixture_1', summary: [] },
      fixture('get_my_context', {}, 'context'),
      fixture('search_app_guide', { query: 'marketplace buy product' }, 'guide'),
      fixture('search_ecovibes_catalog', { query: 'Solar' }, 'catalog'),
      fixture('diagnose_ecovibes_issue', { symptom: 'I cannot start a live call in EcoVibes' }, 'diagnosis'),
    ] : [fixture('get_my_context', {}, 'context')];
  } else if (marker === 'FULL_WORKFLOW_FIXTURE' && toolResults.length === 4) {
    output = [
      fixture('draft_support_request', { title: 'Checkout help', detail: 'Synthetic test: checkout is unclear. Please explain the next step.' }, 'support'),
      fixture('propose_improvement', { title: 'Clearer checkout', problem: 'Assumption: people may miss the checkout button.', benefit: 'Could make shopping easier.', experiment: 'Try clearer text with five volunteers and measure successful checkout starts.', risk: 'Small sample; review before wider rollout.' }, 'improvement'),
    ];
  } else {
    const text = marker === 'FULL_WORKFLOW_FIXTURE'
      ? 'Follow the verified Marketplace guide. Two local drafts are ready for review; neither has been submitted.'
      : marker === 'UNRELATED_TOOL_FIXTURE'
        ? 'Only EcoVibes tools are available.'
        : 'Your safe app context has been checked.';
    output = [{ type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }] }];
  }
  return Response.json({ id: `resp_fixture_${calls.length}`, output });
};
