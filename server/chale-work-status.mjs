const workflows = new Set(['quickhandi', 'waste']);
const states = new Set(['open', 'assigned', 'in_progress', 'awaiting_customer', 'completed', 'cancelled', 'disputed']);

// A private screen projection, deliberately separate from Chale's model tools.
export function createChaleWorkStatus({ all, transaction, rateLimit, assert, now }) {
  return async (ctx, query) => {
    assert(ctx.user?.status === 'active', 401, 'sign_in_required', 'Sign in to check your work.');
    assert(!query.size, 400, 'invalid_work_query', 'Work status uses your signed-in account only.');
    return transaction(async () => {
      await rateLimit(`chale-work:${ctx.user.id}`, 30, 60_000);
      const rows = await all(`SELECT CASE WHEN category='Waste & Recycling' THEN 'waste' ELSE 'quickhandi' END workflow,
        status, COUNT(*) count FROM jobs WHERE customer_id=? OR assigned_provider_id=?
        GROUP BY workflow,status ORDER BY workflow,status LIMIT 15`, ctx.user.id, ctx.user.id);
      const seen = new Set();
      assert(rows.length <= 14, 503, 'work_status_unavailable', 'Could not check your work.');
      const groups = rows.map(row => {
        const count = Number(row.count), key = `${row.workflow}:${row.status}`;
        assert(workflows.has(row.workflow) && states.has(row.status) && !seen.has(key)
          && Number.isSafeInteger(count) && count > 0 && count <= 1_000_000,
        503, 'work_status_unavailable', 'Could not check your work.');
        seen.add(key);
        return { workflow: row.workflow, status: row.status, count };
      });
      return { accountId: ctx.user.id, source: 'job_status_counts', asOf: now(), groups };
    });
  };
}
