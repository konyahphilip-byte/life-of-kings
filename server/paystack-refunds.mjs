import { createHash } from 'node:crypto';

export function providerRefundId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const text = String(value ?? '');
  return /^[1-9]\d{0,19}$/.test(text) ? text : null;
}

export function paymentMinor(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const text = String(value ?? '');
  return /^\d{1,18}$/.test(text) ? BigInt(text) : null;
}
const minor = paymentMinor;

// Provider resource IDs are not event IDs: pending and processed can share one.
// No customer details from the raw payload are retained in the event key.
export function paystackEventKey(event, rawBody) {
  return `v2:${event}:${createHash('sha256').update(rawBody).digest('hex')}`;
}

export function createPaystackRefundService({ q, all, run, fault, assert, now, notify, event, restoreRefundOrder, postgresMode }) {
  async function request(path, body) {
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    assert(secret.startsWith('sk_test_'), 503, 'test_provider_unavailable', 'Paystack test mode is not configured.');
    try {
      const response = await fetch(`https://api.paystack.co${path}`, {
        method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok || result?.status !== true || !result.data) throw new Error('Provider request failed');
      return result.data;
    } catch {
      fault(502, 'refund_provider_unavailable', 'The test refund could not be confirmed with Paystack. No new refund should be submitted until it is reviewed.');
    }
  }

  async function initiate(refund, payment, note) {
    const amount = minor(refund.amount_minor);
    assert(amount > 0n && amount <= BigInt(Number.MAX_SAFE_INTEGER), 409, 'invalid_refund_amount', 'This refund amount requires reconciliation.');
    const data = await request('/refund', {
      transaction: payment.provider_reference, amount: Number(refund.amount_minor), currency: payment.currency,
      customer_note: refund.reason, merchant_note: note,
    });
    const reference = providerRefundId(data.id);
    assert(reference && data.domain === 'test' && data.currency === payment.currency
      && minor(data.amount) === minor(refund.amount_minor)
      && data.transaction?.reference === payment.provider_reference,
    502, 'refund_confirmation_pending', 'The provider response needs staff reconciliation. Do not submit this refund again.');
    // Store the canonical API refund ID, never the optional processor reference.
    return reference;
  }

  // Call within a database transaction. Signed callbacks are wake-up signals;
  // authoritative reads below identify each exact refund independently.
  async function reconcile(paymentReference) {
    const payment = await q("SELECT * FROM payments WHERE provider='paystack' AND provider_reference=?", paymentReference);
    if (!payment) return { outcome: 'payment_not_found', changed: 0 };
    const order = await q(`SELECT * FROM orders WHERE id=?${postgresMode ? ' FOR UPDATE' : ''}`, payment.order_id);
    const captures = await q("SELECT COUNT(*) AS count FROM payments WHERE order_id=? AND state IN ('paid','refunded')", payment.order_id);
    if (!order || !['paid', 'partially_refunded', 'refunded'].includes(order.payment_status)
      || !['paid', 'refunded'].includes(payment.state) || Number(captures.count) !== 1)
      return { outcome: 'reconciliation_required', changed: 0 };

    const candidates = await all("SELECT * FROM refunds WHERE order_id=? AND (status IN ('approved','provider_pending') OR (status='rejected' AND provider_reference IS NOT NULL)) ORDER BY created_at,id LIMIT 11", order.id);
    if (!candidates.length) return { outcome: 'no_pending_refunds', changed: 0 };
    if (candidates.some(row => row.status === 'approved' && !row.provider_reference))
      fault(503, 'refund_confirmation_pending', 'A refund submission has not been reconciled yet. Retry this notification later.');
    if (candidates.length > 10 || candidates.some(row => !providerRefundId(row.provider_reference)))
      return { outcome: 'reconciliation_required', changed: 0 };

    const verified = await request(`/transaction/verify/${encodeURIComponent(paymentReference)}`);
    const transactionId = providerRefundId(verified.id);
    if (!transactionId || !minor(payment.amount_minor) || verified.reference !== paymentReference || verified.domain !== 'test'
      || verified.currency !== payment.currency || order.currency !== payment.currency
      || minor(verified.amount) !== minor(payment.amount_minor))
      return { outcome: 'reconciliation_required', changed: 0 };

    // Bounded concurrent reads avoid a callback waiting for ten serial timeouts.
    const sources = await Promise.all(candidates.map(row => request(`/refund/${providerRefundId(row.provider_reference)}`)));
    let changed = 0, mismatched = false;
    for (let i = 0; i < candidates.length; i++) {
      const refund = candidates[i], source = sources[i];
      const amount = minor(refund.amount_minor), paid = minor(payment.amount_minor);
      const matchingIds = await q('SELECT COUNT(*) AS count FROM refunds WHERE provider_reference=?', refund.provider_reference);
      const sourceTransactionId = providerRefundId(typeof source.transaction === 'object' ? source.transaction?.id : source.transaction);
      if (!amount || !paid || Number(matchingIds.count) !== 1 || providerRefundId(source.id) !== refund.provider_reference
        || sourceTransactionId !== transactionId || source.domain !== 'test' || source.currency !== payment.currency
        || minor(source.amount) !== amount || amount > paid
        || (source.transaction?.reference && source.transaction.reference !== paymentReference)
        || !['pending', 'processing', 'needs-attention', 'failed', 'processed'].includes(source.status)) {
        mismatched = true; continue;
      }
      if (source.status === 'processed') {
        const completed = await all("SELECT amount_minor FROM refunds WHERE order_id=? AND status='refunded'", order.id);
        const amounts = completed.map(row => minor(row.amount_minor));
        if (amounts.some(value => value === null)) { mismatched = true; continue; }
        const total = amounts.reduce((sum, value) => sum + value, 0n) + amount;
        if (total > paid) { mismatched = true; continue; }
        await run("UPDATE refunds SET status='refunded',reviewed_at=? WHERE id=?", now(), refund.id);
        const paymentStatus = total === paid ? 'refunded' : 'partially_refunded';
        await run('UPDATE orders SET payment_status=?,updated_at=? WHERE id=?', paymentStatus, now(), order.id);
        if (total === paid) await run("UPDATE payments SET state='refunded' WHERE id=?", payment.id);
        await event(refund.requester_id, 'refund', refund.id, 'REFUND_PROVIDER_CONFIRMED', { provider: 'paystack', environment: 'test', providerRefundId: refund.provider_reference });
        await notify(refund.requester_id, 'refund', 'Test refund processed', `Paystack reports the test refund for order ${order.id.slice(0, 8)} as processed.`, 'order', order.id);
        changed++;
      } else if (source.status === 'failed' && refund.status !== 'rejected') {
        await run("UPDATE refunds SET status='rejected',review_note=? WHERE id=?", 'Paystack confirmed this test refund failed. Staff review is required.', refund.id);
        await event(refund.requester_id, 'refund', refund.id, 'REFUND_PROVIDER_FAILED', { providerRefundId: refund.provider_reference });
        await notify(refund.requester_id, 'refund', 'Test refund needs review', `The provider reports a failed test refund for order ${order.id.slice(0, 8)}.`, 'order', order.id);
        changed++;
      } else if (source.status === 'needs-attention') {
        const note = 'Paystack needs additional information. This refund remains pending; do not submit another refund.';
        if (refund.review_note !== note) {
          await run("UPDATE refunds SET status='provider_pending',review_note=? WHERE id=?", note, refund.id);
          await event(refund.requester_id, 'refund', refund.id, 'REFUND_PROVIDER_NEEDS_ATTENTION', {});
          changed++;
        }
      }
    }
    const remaining = await q("SELECT COUNT(*) AS count FROM refunds WHERE order_id=? AND status IN ('requested','approved','provider_pending')", order.id);
    if (changed && Number(remaining.count) === 0) await restoreRefundOrder(candidates[0]);
    return { outcome: mismatched ? 'reconciliation_required' : changed ? 'refunds_reconciled' : 'awaiting_provider', changed };
  }
  return { initiate, reconcile };
}
