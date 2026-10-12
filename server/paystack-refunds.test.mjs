// @vitest-environment node
import { expect, test } from 'vitest';
import { providerRefundId, paymentMinor, paystackEventKey } from './paystack-refunds.mjs';
test.each([null, undefined, '', '001', 0, -1, 1.5, 'abc', '1/../../refund', Number.MAX_SAFE_INTEGER + 1])('rejects noncanonical or unsafe provider ID %j', value => {
  expect(providerRefundId(value)).toBeNull();
});
test('preserves canonical large IDs without rounding', () => {
  expect(providerRefundId('12345678901234567890')).toBe('12345678901234567890');
  expect(providerRefundId(456)).toBe('456');
});
test('money parsing uses integer minor units without unsafe coercion', () => {
  expect(paymentMinor('123456789012345678')).toBe(123456789012345678n);
  expect(paymentMinor('0')).toBe(0n);
  for (const invalid of [null, '', '-1', '1.2', '1e4', 1.2, Number.MAX_SAFE_INTEGER + 1]) expect(paymentMinor(invalid)).toBeNull();
});
test('event identity separates lifecycle types without retaining private payload', () => {
  const body = Buffer.from('{"id":5,"customer":"private-customer@example.invalid"}');
  expect(paystackEventKey('refund.pending', body)).not.toBe(paystackEventKey('refund.processed', body));
  expect(paystackEventKey('charge.success', body)).not.toBe(paystackEventKey('refund.processed', body));
  expect(paystackEventKey('refund.pending', body)).toBe(paystackEventKey('refund.pending', body));
  expect(paystackEventKey('refund.pending', body)).not.toContain('private-customer');
});
