import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createChaleWorkStatus } from './chale-work-status.mjs';

const assert = (ok, status, code, message) => { if (!ok) throw Object.assign(Error(message), { status, code }); };
const ctx = { user: { id: 'self', status: 'active' } };
const stamp = '2026-10-23T12:00:00.000Z';
let db;
afterEach(() => db?.close());
function fixture(overrides = {}) {
  db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE jobs(customer_id TEXT, assigned_provider_id TEXT, category TEXT, status TEXT)');
  const deps = { all: async (sql, ...params) => db.prepare(sql).all(...params), transaction: async work => work(),
    rateLimit: vi.fn(), assert, now: () => stamp, ...overrides };
  return { read: createChaleWorkStatus(deps), deps, insert: (...row) => db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(...row) };
}
describe('Chale private work projection', () => {
  it('counts only owned or assigned rows, once even when both roles match', async () => {
    const { read, insert, deps } = fixture();
    insert('self', 'self', 'Plumbing', 'assigned'); insert('other', 'self', 'Waste & Recycling', 'in_progress');
    insert('other', 'third', 'Waste & Recycling', 'open'); insert('self', null, 'Waste & Recycling', 'open');
    const result = await read(ctx, new URLSearchParams());
    expect(result).toEqual({ accountId: 'self', source: 'job_status_counts', asOf: stamp, groups: [
      { workflow: 'quickhandi', status: 'assigned', count: 1 }, { workflow: 'waste', status: 'in_progress', count: 1 },
      { workflow: 'waste', status: 'open', count: 1 },
    ] });
    expect(deps.rateLimit).toHaveBeenCalledExactlyOnceWith('chale-work:self', 30, 60_000);
  });
  it('keeps staff access restricted to their own work', async () => {
    const { read, insert } = fixture(); insert('other', 'third', 'Plumbing', 'open');
    expect((await read({ ...ctx, staff: { staff_role: 'admin' } }, new URLSearchParams())).groups).toEqual([]);
  });
  it.each([null, { id: 'self', status: 'suspended' }])('denies inactive/missing identity before querying', async user => {
    const all = vi.fn(); const { read } = fixture({ all });
    await expect(read({ user }, new URLSearchParams())).rejects.toMatchObject({ status: 401 }); expect(all).not.toHaveBeenCalled();
  });
  it('rejects every selector before database work', async () => {
    const all = vi.fn(); const { read } = fixture({ all });
    await expect(read(ctx, new URLSearchParams('userId=other'))).rejects.toMatchObject({ status: 400 }); expect(all).not.toHaveBeenCalled();
  });
  it('normalizes the PostgreSQL count string without returning extra row fields', async () => {
    const { read } = fixture({ all: async () => [{ workflow: 'waste', status: 'open', count: '2', secret: 'exclude' }] });
    expect((await read(ctx, new URLSearchParams())).groups).toEqual([{ workflow: 'waste', status: 'open', count: 2 }]);
  });
  it.each([
    [{ workflow: 'waste', status: 'recycled', count: 1 }],
    [{ workflow: 'waste', status: 'open', count: -1 }],
    [{ workflow: 'waste', status: 'open', count: 1_000_001 }],
    [{ workflow: 'waste', status: 'open', count: 1 }, { workflow: 'waste', status: 'open', count: 2 }],
    Array.from({ length: 15 }, () => ({ workflow: 'waste', status: 'open', count: 1 })),
  ].map(rows => ({ rows })))('fails closed for malformed storage projection %#', async ({ rows }) => {
    const { read } = fixture({ all: async () => rows });
    await expect(read(ctx, new URLSearchParams())).rejects.toMatchObject({ status: 503 });
  });
});
