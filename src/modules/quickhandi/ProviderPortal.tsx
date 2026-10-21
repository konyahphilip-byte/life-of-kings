import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, MapPin, X } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { serviceCategories, type HandiProfile, type ProviderType, type ServiceCategory } from './model';
import { formatGhs } from './domain';
import './provider-portal.css';

type Profile = {
  id: string; ecoId: string; name: string; providerType: ProviderType; category: ServiceCategory;
  service: string; area: string; description: string; priceMinor: number; pricing: 'quote'|'from'|'fixed';
  countryCode: string; verificationState: 'unverified'|'pending'|'approved'|'rejected'; revision: number;
};
type Review = { status: 'pending'|'approved'|'rejected'; feedback: string|null; submittedAt: string; reviewedAt: string|null };
type OwnerProfile = { profile: Profile|null; review?: Review|null };
function reviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function providerAsHandi(profile: Profile): HandiProfile {
  return { id: profile.id, ecoId: `@${profile.ecoId}`, name: profile.name, providerType: profile.providerType,
    category: profile.category, services: [profile.service], area: profile.area, serviceRadiusKm: 0,
    bio: profile.description, estimateMinor: profile.priceMinor, pricing: profile.pricing,
    availability: 'Agree availability when quoting', responseTime: 'Not measured', reviewCount: 0, completedJobs: 0,
    verification: profile.verificationState === 'approved' ? 'verified' : 'unverified', sample: false };
}

async function request<T>(path: string, csrf = '', init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { ...init, signal, credentials: 'include', headers: {
    'Content-Type': 'application/json', ...(init.method ? { 'X-CSRF-Token': csrf } : {}),
  } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Unable to load services. Please try again.');
  return data as T;
}

export default function ProviderPortal({ identityId, open, onClose, onOpen, onProfile, onJobs }: {
  identityId?: string|null; open: boolean; onClose: () => void; onOpen: () => void;
  onProfile: (profile: HandiProfile|undefined) => void; onJobs: () => void;
}) {
  const [profile, setProfile] = useState<Profile|null>(null);
  const [review, setReview] = useState<Review|null>(null);
  const [directory, setDirectory] = useState<Profile[]>([]);
  const [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [csrf, setCsrf] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController|null>(null);
  const dialog = useRef<HTMLDivElement|null>(null);
  const closeCallback = useRef(onClose); closeCallback.current = onClose;
  const profileCallback = useRef(onProfile); profileCallback.current = onProfile;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement|null;
    const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, [open]);
  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    setLoading(true); setBusy(false); setDirty(false); setProfile(null); setReview(null); setDirectory([]); setSignedIn(false); setCsrf(''); setError(''); setNotice('');
    profileCallback.current(undefined);
    setDirectoryUnavailable(false); setDirectoryLoading(true);
    // Public discovery must not gate account-owned onboarding or review feedback.
    void request<{providers: Profile[]}>('/providers', '', {}, abort.signal).then(listed => {
      if (current === generation.current) setDirectory(listed.providers);
    }).catch(() => {
      if (!abort.signal.aborted && current === generation.current) setDirectoryUnavailable(true);
    }).finally(() => { if (current === generation.current) setDirectoryLoading(false); });
    void (async () => {
      try {
        const me = await request<{user: {id: string}|null; csrfToken: string|null}>('/auth/me', '', {}, abort.signal);
        if (current !== generation.current) return;
        if (me.user && (!identityId || me.user.id === identityId)) {
          const result = await request<OwnerProfile>('/providers/me', '', {}, abort.signal);
          if (current !== generation.current) return;
          setSignedIn(true); setCsrf(me.csrfToken || ''); setProfile(result.profile); setReview(result.review || null);
          profileCallback.current(result.profile ? providerAsHandi(result.profile) : undefined);
        }
      } catch (failure) {
        if (!abort.signal.aborted && current === generation.current) setError(failure instanceof Error ? failure.message : 'Unable to load services.');
      } finally { if (current === generation.current) setLoading(false); }
    })();
    return () => { ++generation.current; abort.abort(); };
  }, [identityId, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const current = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<OwnerProfile & {profile: Profile}>('/providers/me', csrf, { method: 'PUT', body: JSON.stringify({
        name: data.get('name'), providerType: data.get('providerType'), category: data.get('category'), service: data.get('service'),
        area: data.get('area'), description: data.get('description'), priceMinor: Math.round(Number(data.get('price')) * 100),
        pricing: data.get('pricing'), countryCode: 'GH',
      }) }, controller.current?.signal);
      if (current !== generation.current) return;
      setProfile(result.profile); setReview(result.review || null); setDirty(false); profileCallback.current(providerAsHandi(result.profile));
      setDirectory(items => result.profile.verificationState === 'approved'
        ? items.map(item => item.id === result.profile.id ? result.profile : item)
        : items.filter(item => item.id !== result.profile.id));
      setNotice(result.profile.verificationState === 'approved' ? 'Service saved. Your approved listing is still available.'
        : result.profile.verificationState === 'pending' ? 'Service saved. Staff review is still pending.'
        : 'Service saved to your EcoVibes account. Submit it below for staff review.');
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Unable to save your service.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty) { setError('Save your service changes before submitting for review.'); return; }
    const note = new FormData(event.currentTarget).get('evidenceNote');
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const result = await request<OwnerProfile & {profile: Profile}>('/providers/me/submit', csrf, { method: 'POST', body: JSON.stringify({evidenceNote: note}) }, controller.current?.signal);
      if (current !== generation.current) return;
      setProfile(result.profile); setReview(result.review || null); profileCallback.current(providerAsHandi(result.profile));
      setNotice('Submitted for staff review. Your listing becomes public after approval.');
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Unable to submit.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  // A delayed discovery snapshot must not override the owner's newer saved state.
  const currentDirectory = directory.flatMap(item => item.id === profile?.id
    ? profile.verificationState === 'approved' ? [profile] : []
    : [item]);
  const visible = currentDirectory.filter(item => `${item.name} ${item.category} ${item.service} ${item.area}`.toLowerCase().includes(filter.toLowerCase()));
  const feedback = <>{error && <div className="provider-feedback" role="alert">{error} <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Retry</button></div>}{notice && <p role="status" className="provider-feedback">{notice}</p>}</>;
  return <section className="provider-portal" aria-label="EcoVibes service providers">
    <div className="provider-intro"><div><h2>Put your skills to work</h2><p>{profile ? `${profile.name} · ${profile.verificationState === 'approved' ? 'Approved for the directory' : profile.verificationState === 'pending' ? 'Staff review pending' : 'Review required before listing'}` : 'Create your service profile, submit it for review, and use the same Eco ID to respond to jobs.'}</p></div><button className="qh-primary-action" onClick={onOpen}>{profile ? 'Manage my service' : 'Add my service'} <ArrowRight size={16}/></button></div>
    {!open && feedback}
    {directoryUnavailable && <p role="status">The public service directory is unavailable. You can still manage your own service.</p>}
    <div className="provider-directory-head"><h2>Approved service providers</h2><input aria-label="Search approved services" placeholder="Service, name or area" value={filter} onChange={event => setFilter(event.target.value)}/></div>
    {directoryLoading ? <p role="status">Loading services…</p> : directoryUnavailable ? null : !visible.length ? <p className="provider-empty">{currentDirectory.length ? 'No services match your search.' : 'No approved services are listed yet. Applications are open.'}</p> : <div className="provider-directory">{visible.map(item => <article key={item.id}>
      <span className="provider-approved"><BadgeCheck size={16}/> Profile reviewed</span><h3>{item.name}</h3><p>{item.service}</p><p><MapPin size={14}/> {item.area} · {item.category}</p><p>{item.description}</p><strong>{formatGhs(item.priceMinor)} <small>{item.pricing === 'quote' ? 'indicative estimate' : item.pricing === 'from' ? 'starting price' : 'listed price'}</small></strong>
      <button className="qh-outline-action" onClick={onJobs}>Post a job for providers</button><small>Providers can send offers on your job. This does not book this provider directly.</small>
    </article>)}</div>}
    {open && <div className="qh-modal-backdrop"><div ref={dialog} className="qh-modal provider-modal" role="dialog" aria-modal="true" aria-labelledby="provider-title" onKeyDown={event => {
      if(event.key === 'Escape') closeCallback.current();
      if(event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(item => !item.closest('fieldset:disabled'));
      const first = controls[0], last = controls.at(-1);
      if(event.shiftKey && document.activeElement === first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}
    }}><div className="qh-modal-head"><div><h2 id="provider-title">{profile ? 'Manage your service' : 'Add your service'}</h2><p>Saved to your Eco ID · Ghana launch</p></div><button type="button" onClick={onClose} aria-label="Close service profile"><X size={20}/></button></div>
      {feedback}
      {loading ? <p role="status">Loading your account…</p> : !signedIn ? <><p>Sign in with your EcoVibes ID to save a service and track your review.</p><button className="qh-primary-action" onClick={() => {onClose(); window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'EcoVibes ID'}));}}>Sign in or create account</button></> : <>
        {profile && <p className="provider-review-state">Review status: <strong>{profile.verificationState}</strong> <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Refresh saved profile</button></p>}
        {review && profile?.verificationState === review.status && <section className="provider-feedback provider-review-feedback" aria-label="Your service review">
          <h3>{review.status === 'rejected' ? 'Changes requested' : review.status === 'approved' ? 'Service approved' : 'Review pending'}</h3>
          <small>Submitted {reviewDate(review.submittedAt)}{review.reviewedAt && ` · Reviewed ${reviewDate(review.reviewedAt)}`}</small>
          {review.feedback && <p>{review.feedback}</p>}
          {review.status === 'rejected' && <p>Update your service if needed, save it, and submit it for another review.</p>}
          {review.status === 'pending' && <p>Your profile is with the review team. Use Refresh saved profile to check for a decision.</p>}
        </section>}
        <form onSubmit={save} onChange={() => { setDirty(true); setNotice(''); }} key={`${identityId}:${profile?.revision || 0}`}><fieldset disabled={busy}>
          <label>Name customers will see<input name="name" required minLength={2} maxLength={90} defaultValue={profile?.name}/></label>
          <div className="qh-form-row"><label>Provider type<select name="providerType" defaultValue={profile?.providerType || 'individual'}>{['individual','business','company','team'].map(type => <option key={type}>{type}</option>)}</select></label><label>Category<select name="category" defaultValue={profile?.category || 'Cleaning'}>{[...serviceCategories,'Waste & Recycling'].map(item => <option key={item}>{item}</option>)}</select></label></div>
          <label>Main service<input name="service" required minLength={3} maxLength={100} defaultValue={profile?.service} placeholder="For example, home cleaning"/></label>
          <label>Town or service area<input name="area" required minLength={2} maxLength={120} defaultValue={profile?.area} placeholder="For example, Tema"/></label>
          <label>Describe your service<textarea name="description" required minLength={20} maxLength={1000} rows={3} defaultValue={profile?.description} placeholder="Explain what you offer and what is included. This description is public after approval."/></label>
          <div className="qh-form-row"><label>Indicative price · GHS<input name="price" type="number" required min="0.01" step="0.01" defaultValue={profile ? profile.priceMinor / 100 : ''}/></label><label>Pricing<select name="pricing" defaultValue={profile?.pricing || 'quote'}><option value="quote">Quote after discussion</option><option value="from">Starting from</option><option value="fixed">Fixed listed price</option></select></label></div>
          <p className="qh-form-disclaimer">Your service details will be public after staff approval. Use an area, not your private home address. Changes to an approved profile require a new review.</p>
          {dirty && <p role="status">You have unsaved changes. Save your service before submitting for review.</p>}
          <button className="qh-primary-action" type="submit">{busy ? 'Saving…' : 'Save service'}</button>
        </fieldset></form>
        {profile && !['pending','approved'].includes(profile.verificationState) && <form className="provider-review-form" onSubmit={submit}><fieldset disabled={busy}><h3>Submit for review</h3><label>Information for the review team<textarea name="evidenceNote" required minLength={10} maxLength={500} rows={3} placeholder="Describe your experience or business and how staff can verify it. Do not enter passwords or payment details."/></label><p>This note is visible to authorized review staff. Submit after saving your latest details.</p><button className="qh-primary-action" type="submit" disabled={dirty}>Submit for staff review</button></fieldset></form>}
        {profile?.verificationState === 'approved' && <button className="qh-outline-action" onClick={() => {onClose(); onJobs();}}>Browse customer jobs</button>}
      </>}
    </div></div>}
  </section>;
}
