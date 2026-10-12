export type RefundRequest = {
  id: string; order_id: string; amount_minor: number | string; currency: string;
  reason: string; status: string; review_note?: string | null;
  requester_eco_id: string; payment_status: string;
};

type Props = {
  item: RefundRequest; busy: boolean;
  onReview: (status: 'approved' | 'rejected', form: HTMLFormElement) => void;
  onRecheck: () => void;
};

export default function RefundReviewCard({ item, busy, onReview, onRecheck }: Props) {
  const amount = Number(item.amount_minor);
  const digits = /^[A-Z]{3}$/.test(item.currency)
    ? new Intl.NumberFormat('en', { style: 'currency', currency: item.currency }).resolvedOptions().maximumFractionDigits ?? 2 : 2;
  const amountLabel = Number.isSafeInteger(amount) && amount > 0 && /^[A-Z]{3}$/.test(item.currency)
    ? `${item.currency} ${(amount / 10 ** digits).toFixed(digits)}` : 'Amount needs review';
  return <article className="backend-record">
    <div className="backend-record-top">
      <div><small>ORDER {item.order_id.slice(0, 8)} · @{item.requester_eco_id}</small><h3>{amountLabel} · Test refund</h3></div>
      <span className={`backend-state ${item.status}`}>{item.status === 'approved' ? 'Awaiting reconciliation' : item.status.replaceAll('_', ' ')}</span>
    </div>
    <p>{item.reason}</p>
    {item.review_note && <p>{item.review_note}</p>}
    {item.status === 'requested' ? <form className="backend-form" onSubmit={event => { event.preventDefault(); onReview('approved', event.currentTarget); }}>
      <label>Staff note<textarea name="note" minLength={10} maxLength={800} required rows={2}/></label>
      <p>Approval submits one test refund to Paystack. Completion requires provider confirmation.</p>
      <div className="backend-action-row">
        <button className="backend-primary" disabled={busy}>Approve test refund</button>
        <button type="button" className="backend-quiet" disabled={busy} onClick={event => {
          const form = event.currentTarget.form;
          if (form?.reportValidity()) onReview('rejected', form);
        }}>Reject</button>
      </div>
    </form> : ['provider_pending', 'rejected'].includes(item.status) ? <>
      <p>{item.status === 'rejected' ? 'Paystack reported a failed test refund. Review its latest status before further action.' : 'Waiting for Paystack test confirmation.'} Rechecking reads the existing refund; it does not submit another.</p>
      <button className="backend-secondary" disabled={busy} onClick={onRecheck}>Recheck with Paystack</button>
    </> : item.status === 'approved' ? <p>Review the transaction in the Paystack test dashboard. A missing refund reference must be reconciled before further action. Do not submit another refund.</p> : null}
  </article>;
}
