const minor = value => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe financial amount');
  const text = String(value ?? '');
  if (!/^\d{1,18}$/.test(text)) throw new Error('Invalid financial amount');
  return BigInt(text);
};

/** A conservative view of existing sandbox records, not a balance or income proof. */
export function summarizeMoneyRecords(rows) {
  const totals = new Map(), seen = new Set();
  let excludedRecords = 0;
  const activity = rows.slice(0, 100).flatMap(row => {
    if (seen.has(row.id)) { excludedRecords++; return []; }
    seen.add(row.id);
    let amount, refunded;
    try { amount = minor(row.amount_minor); refunded = minor(row.refunded_minor || 0); }
    catch { excludedRecords++; return []; }
    if (!/^[A-Z]{3}$/.test(row.currency || '')) { excludedRecords++; return []; }
    const captured = ['paid', 'refunded'].includes(row.state);
    const consistent = ['pending', 'created', 'failed', 'paid', 'refunded'].includes(row.state)
      && row.provider === 'paystack'
      && (!captured || (Number(row.capture_count) === 1
        && ['paid', 'partially_refunded', 'refunded'].includes(row.order_payment_status)
        && refunded <= amount && (row.state !== 'refunded' || refunded === amount)
        && (row.order_payment_status !== 'refunded' || refunded === amount)));
    if (!consistent) excludedRecords++;
    if (captured && consistent) {
      const total = totals.get(row.currency) || { currency: row.currency, capturedMinor: 0n, refundedMinor: 0n };
      total.capturedMinor += amount;
      total.refundedMinor += refunded;
      totals.set(row.currency, total);
    }
    return [{ id: row.id, orderId: row.order_id, amountMinor: String(amount), refundedMinor: String(refunded),
      currency: row.currency, status: row.state, createdAt: row.created_at,
      provenance: row.provider === 'paystack' ? 'Recorded Paystack test transaction' : 'Unsupported payment source', environment: 'test',
      evidenceStatus: consistent ? 'sandbox_record' : 'needs_reconciliation',
      includedInTotals: captured && consistent }];
  });
  return {
    activity, excludedRecords, truncated: rows.length > 100,
    totals: [...totals.values()].map(total => ({ currency: total.currency,
      capturedMinor: String(total.capturedMinor), refundedMinor: String(total.refundedMinor),
      netRecordedMinor: String(total.capturedMinor - total.refundedMinor) })),
  };
}

export function createMoneyService({ all, q, run, assert, rateLimit, id, now }) {
  return {
    async overview(ctx) {
      assert(ctx.user?.status === 'active', 401, 'sign_in_required', 'Sign in to view your own Money & Trust records.');
      await rateLimit(`money:read:${ctx.user.id}`, 30, 60_000);
      // Never use a supplied user/organization ID or a staff role to widen this view.
      // Correlated refund totals and capture counts are read in the same statement.
      const rows = await all(`SELECT p.id,p.order_id,p.provider,p.amount_minor,p.currency,p.state,p.created_at,
        o.payment_status AS order_payment_status,
        (SELECT COUNT(*) FROM payments c WHERE c.order_id=p.order_id AND c.state IN ('paid','refunded')) AS capture_count,
        (SELECT COALESCE(SUM(r.amount_minor),0) FROM refunds r WHERE r.order_id=p.order_id AND r.status='refunded') AS refunded_minor
        FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.buyer_id=?
        ORDER BY p.created_at DESC,p.id DESC LIMIT 101`, ctx.user.id);
      const jobs = await q("SELECT COUNT(*) AS count FROM jobs WHERE assigned_provider_id=? AND status='completed'", ctx.user.id);
      const sales = await q("SELECT COUNT(DISTINCT oi.order_id) AS count FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.seller_id=? AND o.payment_status='paid'", ctx.user.id);
      await run('INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)',
        id(), ctx.user.id, 'MONEY_ACTIVITY_VIEWED', 'account', ctx.user.id, 'Account holder requested own recorded activity; no external disclosure.', now());
      return {
        ...summarizeMoneyRecords(rows), generatedAt: now(), scope: 'personal', environment: 'test',
        completedServiceJobs: Number(jobs?.count || 0), recordedPaidSalesOrders: Number(sales?.count || 0),
        capabilities: { livePayments: false, remittances: false, custodialBalance: false, partnerSharing: false, financialAiAccess: false },
        limitations: [
          'Latest 100 payment attempts for purchases on this Eco ID; totals apply only to this displayed window.',
          'All payment records are test-mode records. Totals are not money held, settled earnings or lending evidence.',
          'Completed service jobs and paid sales-order counts do not prove a provider or seller received a payout.',
          'Records needing reconciliation are excluded from totals. No external provider statement has been reconciled by this view.',
          'Private records are not sent to Chale AI, lenders, partners or family members.',
        ],
      };
    },
  };
}
