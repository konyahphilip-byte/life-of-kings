import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api';
import type { AssistantDestination } from './assistant';

const stateLabels = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_customer: 'Awaiting customer',
  completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed',
};
type Group = { workflow: 'quickhandi' | 'waste'; status: keyof typeof stateLabels; count: number };
type Summary = { asOf: string; groups: Group[] };
type Props = { userId: string; online: boolean; onNavigate: (page: AssistantDestination) => void };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function checkedSummary(value: unknown, userId: string): Summary {
  if (!record(value) || value.accountId !== userId || value.source !== 'job_status_counts'
    || typeof value.asOf !== 'string' || !Number.isFinite(Date.parse(value.asOf))
    || !Array.isArray(value.groups) || value.groups.length > 14) throw Error('Invalid summary');
  const seen = new Set<string>();
  const groups = value.groups.map((group: unknown): Group => {
    if (!record(group) || typeof group.workflow !== 'string' || !['quickhandi', 'waste'].includes(group.workflow)
      || typeof group.status !== 'string' || !Object.hasOwn(stateLabels, group.status)
      || typeof group.count !== 'number' || !Number.isSafeInteger(group.count) || group.count < 1 || group.count > 1_000_000) throw Error('Invalid group');
    const key = `${group.workflow}:${group.status}`;
    if (seen.has(key)) throw Error('Duplicate group');
    seen.add(key);
    return { workflow: group.workflow as Group['workflow'], status: group.status as Group['status'], count: group.count };
  });
  return { asOf: value.asOf, groups };
}

export default function WorkStatusCard({ userId, online, onNavigate }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => {
    const cancel = () => {
      if (pending.current) { clearTimeout(pending.current.timer); pending.current.controller.abort(); pending.current = null; }
    };
    if (!online) { cancel(); setSummary(null); setBusy(false); setFailed(false); }
    return cancel;
  }, [online, userId]);

  async function refresh() {
    if (!online || pending.current) return;
    setSummary(null); setFailed(false); setBusy(true);
    const controller = new AbortController();
    const request = { controller, timer: setTimeout(() => {
      if (pending.current !== request) return;
      pending.current = null; controller.abort(); setBusy(false); setFailed(true);
    }, 10_000) };
    pending.current = request;
    try {
      const response = await fetch(apiUrl('/ai/work-status'), { credentials: 'include', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('Work unavailable');
      const result = checkedSummary(await response.json(), userId);
      if (pending.current === request) setSummary(result);
    } catch {
      if (pending.current === request) setFailed(true);
    } finally {
      if (pending.current === request) { clearTimeout(request.timer); pending.current = null; setBusy(false); }
    }
  }

  const visible = online ? summary : null;
  return <section className="chale-work-status" aria-label="My work status">
    <b>Your work in EcoVibes</b>
    <p>Counts stay in your signed-in screen. They are not sent to the AI model.</p>
    <button type="button" disabled={!online || busy} onClick={() => void refresh()}>{busy ? 'Checking my work…' : visible ? 'Refresh my work status' : 'Check my work status'}</button>
    {!online && <p>Connect to check your work status.</p>}
    {online && failed && <p role="status">Could not check your work. Try again when connected.</p>}
    {visible && <div>
      {!visible.groups.length && <p>No customer or assigned-provider jobs found for this account.</p>}
      <ul>{visible.groups.map(group => <li key={`${group.workflow}:${group.status}`} aria-label={`${group.workflow === 'waste' ? 'Waste' : 'Quick & Handi'} ${group.status} jobs`}>
        {group.workflow === 'waste' ? 'Waste' : 'Quick & Handi'} · {stateLabels[group.status]}: <b>{group.count}</b>
      </li>)}</ul>
      <small>Checked {new Date(visible.asOf).toLocaleString()}. Job status only; this does not verify collection, GPS, weight or payment.</small>
      <div className="chale-work-links"><button type="button" onClick={() => onNavigate('Waste')}>Open Waste</button><button type="button" onClick={() => onNavigate('Quick&Handi')}>Open Quick & Handi</button></div>
    </div>}
  </section>;
}
