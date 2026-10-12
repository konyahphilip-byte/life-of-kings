import { useEffect, useState } from 'react';
import { ArrowDownLeft, FileCheck2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import './money-trust.css';

type Activity = { id: string; orderId: string; amountMinor: string; refundedMinor: string; currency: string; status: string; createdAt: string; provenance: string; evidenceStatus: string; includedInTotals: boolean };
type Overview = {
  generatedAt: string; activity: Activity[]; excludedRecords: number; truncated: boolean;
  totals: { currency: string; capturedMinor: string; refundedMinor: string; netRecordedMinor: string }[];
  completedServiceJobs: number; recordedPaidSalesOrders: number; limitations: string[];
};
export function formatMinor(value: string, currency: string) {
  if (!/^\d+$/.test(value) || !/^[A-Z]{3}$/.test(currency)) return 'Amount unavailable';
  const digits = new Intl.NumberFormat('en-GH', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(digits);
  const amount = BigInt(value);
  const fraction = digits ? `.${String(amount % scale).padStart(digits, '0')}` : '';
  return `${currency} ${new Intl.NumberFormat('en-GH').format(amount / scale)}${fraction}`;
}

export default function MoneyTrust({ userId, onSignIn, onSupport, onAskAI }: {
  userId: string | null; onSignIn: () => void; onSupport: () => void; onAskAI: () => void;
}) {
  const [section, setSection] = useState<'Overview' | 'Activity' | 'Trust Passport'>('Overview');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ owner: string | null; data: Overview | null; error: string; loading: boolean }>({ owner: null, data: null, error: '', loading: false });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ owner: userId, data: null, error: '', loading: Boolean(userId) });
    if (userId) void apiRequest<Overview>('/money/overview', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ owner: userId, data, error: '', loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ owner: userId, data: null, error: error instanceof Error ? error.message : 'Could not load your records.', loading: false });
    });
    return () => controller.abort();
  }, [userId, revision]);
  const data = result.owner === userId ? result.data : null;
  const loading = userId && (result.owner !== userId || result.loading);
  const error = result.owner === userId ? result.error : '';
  return <section className="money-trust" aria-labelledby="money-title">
    <header className="money-hero"><div><h1 id="money-title">Money &amp; Trust</h1><p>Your activity. Clear records. Your control.</p><span className="money-scope"><ShieldCheck size={16}/> Private to your Eco ID</span></div><div className="money-emblem" aria-hidden="true"><ShieldCheck size={54}/><span>EcoVibes</span></div></header>
    <div className="money-notice"><b>Test records only</b><p>This is a record of platform activity. EcoVibes does not hold a cash balance here. Transfers, live payments and partner sharing are unavailable.</p></div>
    {!userId ? <div className="money-panel"><h2>Your records belong to you</h2><p>Sign in to view payment attempts and completed work connected to your Eco ID.</p><button className="button button-primary" onClick={onSignIn}>Sign in with Eco ID</button></div> : <>
      <div className="money-toolbar"><nav aria-label="Money & Trust sections">{(['Overview', 'Activity', 'Trust Passport'] as const).map(name => <button key={name} aria-current={section === name ? 'page' : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav><button className="money-refresh" aria-label="Refresh financial records" disabled={Boolean(loading)} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16}/></button></div>
      {loading && <p role="status" className="money-panel">Loading your records…</p>}
      {error && <div className="money-panel" role="alert"><h2>Records could not be loaded</h2><p>{error}</p><button className="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
      {data && <>
        {data.excludedRecords > 0 && <p className="money-notice" role="status">{data.excludedRecords} record(s) need reconciliation and were excluded from totals.</p>}
        {section === 'Overview' && <>
          <div className="money-section-heading"><h2>Recorded test purchases</h2><span>Latest {data.activity.length} attempts</span></div>
          {!data.totals.length ? <div className="money-panel"><h3>No confirmed test-payment totals</h3><p>Pending, failed and inconsistent records are not counted as completed payments.</p></div> : data.totals.map(total => <div className="money-totals" key={total.currency}><article><ArrowDownLeft size={20}/><span>Recorded payments</span><strong>{formatMinor(total.capturedMinor, total.currency)}</strong></article><article><span>Recorded refunds</span><strong>{formatMinor(total.refundedMinor, total.currency)}</strong></article><article><span>Payments less refunds</span><strong>{formatMinor(total.netRecordedMinor, total.currency)}</strong><small>Test activity total · not a balance</small></article></div>)}
          <div className="money-work"><article className="money-panel"><h3>{data.completedServiceJobs} completed service jobs</h3><p>Customer-confirmed work. No payment or payout is recorded for these jobs.</p></article><article className="money-panel"><h3>{data.recordedPaidSalesOrders} paid sales orders</h3><p>Test orders containing your products. This count does not establish settled seller earnings.</p></article></div>
        </>}
        {section === 'Activity' && <div className="money-panel"><h2>Payment records</h2><p>Only purchases on your Eco ID appear here.</p>{!data.activity.length ? <p>No payment attempts are recorded for this account.</p> : <div className="money-table-wrap"><table><thead><tr><th scope="col">Record</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead><tbody>{data.activity.map(item => <tr key={item.id}><td><b>Order {item.orderId.slice(0, 8)}</b><small>{new Date(item.createdAt).toLocaleDateString('en-GH')}</small></td><td>{formatMinor(item.amountMinor, item.currency)}{item.refundedMinor !== '0' && <small>Refunded: {formatMinor(item.refundedMinor, item.currency)}</small>}</td><td>{item.status}</td><td><span>{item.evidenceStatus === 'needs_reconciliation' ? 'Needs reconciliation' : 'Sandbox record'}</span><small>{item.provenance}</small></td></tr>)}</tbody></table></div>}</div>}
        {section === 'Trust Passport' && <div className="money-passport money-panel"><FileCheck2 size={30}/><h2>Your evidence, with its source</h2><p>Evidence preview. No certified report or lending score has been issued.</p><ul><li>Payment activity is sourced from EcoVibes test-payment records.</li><li>Completed jobs show work history, not verified income.</li><li>External remittance, grant, bank and certification records are not connected.</li><li>No lender, partner or family member receives access from this page.</li></ul><button className="button" onClick={onSupport}>Report a record problem</button></div>}
        <details className="money-panel money-disclosure"><summary>What these records can tell you</summary><ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>{data.truncated && <p>More records exist. This view is limited to the latest 100 attempts and is not a full account statement.</p>}<p>Retrieved {new Date(data.generatedAt).toLocaleString('en-GH')}</p></details>
      </>}
    </>}
    <aside className="money-panel money-assistant"><Sparkles size={23}/><div><h2>Chale, help me understand</h2><p>Get help using this section. Chale cannot access these private financial records or move money.</p></div><button className="button" onClick={onAskAI}>Open Chale guide</button></aside>
    <div className="money-panel"><h2>What needs a partner</h2><p>International remittance, mobile-money transfers, loans, grant evidence exchange and business settlement remain unavailable until each service has verified provider access and approvals.</p></div>
  </section>;
}
