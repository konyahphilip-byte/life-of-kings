// @vitest-environment node
import { expect, test } from 'vitest';
import { summarizeMoneyRecords } from './money.mjs';
const payment = (changes = {}) => ({ id: 'one', order_id: 'order-one', provider: 'paystack', amount_minor: 15000,
  refunded_minor: 0, currency: 'GHS', state: 'paid', created_at: '2026-10-09T10:00:00Z', capture_count: 1,
  order_payment_status: 'paid', ...changes });

test('calculates refunds with exact minor-unit arithmetic and keeps currencies separate', () => {
  const r = summarizeMoneyRecords([payment({ refunded_minor: 4000 }), payment({ id: 'two', currency: 'NGN', amount_minor: 99 })]);
  expect(r.totals).toEqual([{ currency: 'GHS', capturedMinor: '15000', refundedMinor: '4000', netRecordedMinor: '11000' }, { currency: 'NGN', capturedMinor: '99', refundedMinor: '0', netRecordedMinor: '99' }]);
  expect(r.activity[0].evidenceStatus).toBe('sandbox_record');
});
test('pending and failed attempts never become captured payments', () => {
  const r = summarizeMoneyRecords([payment({ state: 'pending' }), payment({ id: 'two', state: 'failed' })]);
  expect(r.totals).toEqual([]);
  expect(r.activity.every(row => !row.includedInTotals)).toBe(true);
});
test.each([
  { capture_count: 2 }, { refunded_minor: 15001 }, { state: 'refunded', refunded_minor: 0 },
  { order_payment_status: 'refunded', refunded_minor: 0 }, { order_payment_status: 'unpaid' }, { provider: 'unknown' },
])('excludes contradictory or unsupported source records: %j', changes => {
  const r = summarizeMoneyRecords([payment(changes)]);
  expect(r.totals).toEqual([]); expect(r.excludedRecords).toBe(1);
  expect(r.activity[0].evidenceStatus).toBe('needs_reconciliation');
});
test('fully refunded records net to zero', () => {
  expect(summarizeMoneyRecords([payment({ state: 'refunded', order_payment_status: 'refunded', refunded_minor: 15000 })]).totals[0].netRecordedMinor).toBe('0');
});
test('deduplicates source identities and reports exclusion', () => {
  const r = summarizeMoneyRecords([payment(), payment()]);
  expect(r.activity).toHaveLength(1); expect(r.excludedRecords).toBe(1);
  expect(r.totals[0].capturedMinor).toBe('15000');
});
test('does not coerce malformed money and never sums invalid currencies', () => {
  const r = summarizeMoneyRecords([payment({ amount_minor: 1.7 }), payment({ id: 'two', currency: 'GHS<script>' }), payment({ id: 'three', refunded_minor: -1 })]);
  expect(r.totals).toEqual([]); expect(r.activity).toEqual([]); expect(r.excludedRecords).toBe(3);
});
test('sums exactly beyond Number.MAX_SAFE_INTEGER and reports window truncation', () => {
  const rows = Array.from({ length: 101 }, (_, i) => payment({ id: String(i), amount_minor: '9007199254740991' }));
  const r = summarizeMoneyRecords(rows);
  expect(r.truncated).toBe(true); expect(r.activity).toHaveLength(100);
  expect(r.totals[0].capturedMinor).toBe('900719925474099100');
});
test('rejects already-rounded numeric amounts instead of presenting them as exact', () => {
  const r = summarizeMoneyRecords([
    payment({ amount_minor: Number.MAX_SAFE_INTEGER + 1 }),
    payment({ id: 'two', refunded_minor: Number.MAX_SAFE_INTEGER + 1 }),
  ]);
  expect(r.activity).toEqual([]); expect(r.totals).toEqual([]); expect(r.excludedRecords).toBe(2);
});
test('does not attribute an unsupported provider record to Paystack', () => {
  expect(summarizeMoneyRecords([payment({ provider: 'unknown' })]).activity[0].provenance).toBe('Unsupported payment source');
});
