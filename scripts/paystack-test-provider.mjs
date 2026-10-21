// Test-only provider; never load this module in an application deployment.
import { readFileSync, appendFileSync } from 'node:fs';
import { Server } from 'node:http';
if (process.env.NODE_ENV !== 'test' || process.env.PAYSTACK_SECRET_KEY !== 'sk_test_synthetic_refund_workflow' || !process.env.PAYSTACK_TEST_FIXTURE)
  throw new Error('Paystack fixture requires the isolated payment test environment.');
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  this.once('listening', () => process.send?.({ event: 'payment-test-ready', port: this.address()?.port }));
  return listen.apply(this, args);
};
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  if (url.origin !== 'https://api.paystack.co' || options.headers?.Authorization !== 'Bearer sk_test_synthetic_refund_workflow')
    throw new Error('Unexpected external request in isolated Paystack test.');
  const method = options.method || 'GET';
  const fixtures = JSON.parse(readFileSync(process.env.PAYSTACK_TEST_FIXTURE, 'utf8'));
  const key = `${method} ${url.pathname}`;
  appendFileSync(process.env.PAYSTACK_TEST_CAPTURE, JSON.stringify({ method, path: url.pathname }) + '\n', { mode: 0o600 });
  const fixture = fixtures[key];
  if (fixture?.delayMs) await new Promise(resolve => setTimeout(resolve, fixture.delayMs));
  if (!fixture || fixture.throw) throw new Error('Synthetic provider connection failure');
  return Response.json(fixture.body, { status: fixture.status || 200 });
};
