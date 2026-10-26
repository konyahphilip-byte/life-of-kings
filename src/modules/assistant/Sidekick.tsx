import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Bookmark, Check, ChevronRight, Copy, LoaderCircle, Sparkles, ThumbsDown, X } from 'lucide-react';
import type { AssistantDestination } from './assistant';
import WorkStatusCard from './WorkStatusCard';
import { apiUrl } from '../../lib/api';
import { chaleGreeting } from '../../../shared/chale-greeting.mjs';
import { readPublicUpdates, type PublicUpdate } from '../../../shared/chale-updates.mjs';
import { appGuides, appGuideVersion, isAssistantDestination, localAppGuides, pagePrompts, verifiedGuides, type GuideEntry } from './guide';
import './sidekick.css';

type DataMode = 'standard' | 'saver' | 'extreme';
type LiveSearchItem = {
  id: string; kind: 'product' | 'job'; title: string; detail: string; category: string;
  destination: 'Marketplace' | 'Quick&Handi'; actor_eco_id?: string; price?: string; area?: string;
};
type ReviewDraft = {
  id: string; kind: 'support' | 'improvement'; title: string;
  detail?: string; problem?: string; benefit?: string; experiment?: string; risk?: string;
};
type DiagnosticCheck = { label: string; status: 'ready' | 'needs_setup' | 'unknown'; detail: string };
type Diagnostic = {
  id: string; title: string; summary: string; checks: DiagnosticCheck[];
  guides: GuideEntry[]; destination: AssistantDestination;
};
type ChatEntry = {
  id: number; role: 'assistant' | 'user'; text: string; pending?: boolean;
  source?: 'model' | 'app_guide' | 'greeting' | 'public_updates'; updates?: PublicUpdate[]; newsRequested?: boolean; items?: LiveSearchItem[]; guides?: GuideEntry[]; drafts?: ReviewDraft[]; diagnostics?: Diagnostic[];
};
type AIStatus = { configured: boolean; unavailable?: boolean; hosting?: 'local' | 'remote'; allowance?: number };
type LearningState = { enabled: boolean };
type Props = {
  onNavigate: (page: AssistantDestination) => void;
  page: AssistantDestination; userId: string | null; csrfToken: string; dataMode: DataMode; online: boolean;
};

const welcome: ChatEntry = {
  id: 0, role: 'assistant',
  text: 'Hi, I’m Chale AI, your EcoVibes assistant. I can help you find your way around EcoVibes, solve an app problem, or grow an idea for our community. We’ll take the next step together.',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value: unknown, max = 800): string => typeof value === 'string' ? value.slice(0, max) : '';
const diagnosticStatuses = new Set(['ready', 'needs_setup', 'unknown']);
const diagnosticStatusLabels = { ready: 'Requirement met', needs_setup: 'Needs setup', unknown: 'Not checked' };
const guidesById = new Map(appGuides.map((guide) => [guide.id, guide]));

function diagnosticText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > max) return null;
  // Diagnostic copy is server-derived configuration text, never model HTML,
  // links, contact information, record IDs or credential-looking values.
  if (/[<>\u0000-\u001f\u007f]/.test(value)
    || /(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|javascript:|data:)/i.test(value)
    || /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value)
    || /\b(?:sk-(?:proj-)?[a-z0-9_-]{8,}|eyJ[a-z0-9_-]{20,}|[0-9a-f]{8}-[0-9a-f-]{27,})\b/i.test(value)
    || /(?:\d[\s().+-]*){9,}/.test(value)) return null;
  return value.trim();
}

function verifiedDiagnostics(value: unknown): Diagnostic[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 12).flatMap<Diagnostic>((candidate: unknown) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(candidate.id)
      || seen.has(candidate.id) || !isAssistantDestination(candidate.destination)
      || !Array.isArray(candidate.guideIds) || candidate.guideIds.length < 1 || candidate.guideIds.length > 4
      || !Array.isArray(candidate.checks) || candidate.checks.length < 1 || candidate.checks.length > 6) return [];
    const title = diagnosticText(candidate.title, 100);
    const summary = diagnosticText(candidate.summary, 500);
    const guides = candidate.guideIds.map((id: unknown) => typeof id === 'string' ? guidesById.get(id) : undefined);
    if (!title || !summary || guides.some((guide) => !guide) || !guides.some((guide) => guide?.destination === candidate.destination)) return [];
    const checks: DiagnosticCheck[] = [];
    for (const check of candidate.checks) {
      if (!isRecord(check) || typeof check.status !== 'string' || !diagnosticStatuses.has(check.status)) return [];
      const label = diagnosticText(check.label, 80);
      const detail = diagnosticText(check.detail, 300);
      if (!label || !detail) return [];
      checks.push({ label, detail, status: check.status as DiagnosticCheck['status'] });
    }
    seen.add(candidate.id);
    return [{ id: candidate.id, title, summary, checks, guides: [...new Set(guides)] as GuideEntry[], destination: candidate.destination }];
  }).slice(0, 3);
}

function replyEvidence(entry: ChatEntry): string[] {
  const evidence: string[] = [];
  if (entry.guides?.length) evidence.push(`${entry.guides.length} verified app guide ${entry.guides.length === 1 ? 'entry' : 'entries'}`);
  if (entry.items?.length) evidence.push(`${entry.items.length} public catalog ${entry.items.length === 1 ? 'listing' : 'listings'}`);
  if (entry.diagnostics?.length) evidence.push(`${entry.diagnostics.length} guide and configuration ${entry.diagnostics.length === 1 ? 'check' : 'checks'}`);
  return evidence;
}

function liveItems(value: unknown): LiveSearchItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap<LiveSearchItem>((item: unknown) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || typeof item.title !== 'string'
      || !['product', 'job'].includes(String(item.kind))) return [];
    const kind = item.kind as LiveSearchItem['kind'];
    const destination: LiveSearchItem['destination'] = kind === 'product' ? 'Marketplace' : 'Quick&Handi';
    if (item.destination !== destination || seen.has(`${kind}:${item.id}`)) return [];
    seen.add(`${kind}:${item.id}`);
    return [{
      id: item.id.slice(0, 100), kind, destination, title: safeString(item.title, 200),
      detail: safeString(item.detail), category: safeString(item.category, 100),
      actor_eco_id: safeString(item.actor_eco_id, 80), price: safeString(item.price, 80), area: safeString(item.area, 120),
    }];
  }).slice(0, 8);
}

function reviewDrafts(value: unknown): ReviewDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((draft: unknown, index) => {
    if (!isRecord(draft) || !['support', 'improvement'].includes(String(draft.kind)) || typeof draft.title !== 'string') return [];
    return [{
      id: safeString(draft.id, 80) || `draft-${index}`, kind: draft.kind as ReviewDraft['kind'], title: safeString(draft.title, 200),
      detail: safeString(draft.detail, 2000), problem: safeString(draft.problem, 2000), benefit: safeString(draft.benefit, 1000),
      experiment: safeString(draft.experiment, 1000), risk: safeString(draft.risk, 1000),
    }];
  }).slice(0, 2);
}

function localDraft(query: string, page: AssistantDestination): ReviewDraft[] {
  if (/\b(report|support|complaint)\b/i.test(query)) return [{
    id: 'local-support', kind: 'support', title: `Support draft: ${page}`,
    detail: query, experiment: 'Add what happened, what you expected, and steps to reproduce it. Remove personal or payment information before sharing.',
  }];
  if (/\b(improve|improvement|innovate|innovation|idea)\b/i.test(query)) return [{
    id: 'local-improvement', kind: 'improvement', title: `Idea draft: ${page}`, problem: query,
    benefit: 'Describe who this could help and how.', experiment: 'Choose one small, affordable trial and a result you can measure.',
    risk: 'Consider cost, privacy, access, and anyone who might be left out.',
  }];
  return [];
}

function draftText(draft: ReviewDraft): string {
  return [draft.title, draft.detail && `Details: ${draft.detail}`, draft.problem && `Problem: ${draft.problem}`,
    draft.benefit && `Benefit: ${draft.benefit}`, draft.experiment && `Next step: ${draft.experiment}`,
    draft.risk && `Considerations: ${draft.risk}`].filter(Boolean).join('\n\n');
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error('Chale returned an invalid response.');
  return payload;
}

async function searchLiveListings(query: string, dataMode: DataMode, signal: AbortSignal): Promise<LiveSearchItem[]> {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((term) => !['the', 'and', 'for', 'with', 'from', 'near', 'show', 'find', 'need', 'want', 'what', 'where', 'please', 'under', 'around', 'some', 'can', 'you', 'how', 'help', 'open', 'use'].includes(term))
    .slice(0, dataMode === 'standard' ? 2 : 1);
  const items = new Map<string, LiveSearchItem>();
  for (const term of terms) {
    if (signal.aborted) break;
    try {
      const response = await fetch(`${apiUrl('/search')}?q=${encodeURIComponent(term)}`, { credentials: 'include', signal });
      if (!response.ok) continue;
      const payload = await jsonResponse(response);
      for (const item of liveItems(payload.items)) items.set(`${item.kind}:${item.id}`, item);
    } catch { break; }
  }
  return [...items.values()].slice(0, dataMode === 'extreme' ? 3 : 6);
}

export default function Sidekick({ onNavigate, page, userId, csrfToken, dataMode, online }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([welcome]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [learning, setLearning] = useState<LearningState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [signals, setSignals] = useState<Record<string, { saved?: boolean; dismissed?: boolean }>>({});
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const nextId = useRef(1);
  const busyRef = useRef(false);
  const chatRequest = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const feedbackRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    generation.current += 1;
    chatRequest.current?.controller.abort();
    if (chatRequest.current) clearTimeout(chatRequest.current.timer);
    feedbackRequest.current?.abort();
    chatRequest.current = null; feedbackRequest.current = null; busyRef.current = false;
    setBusy(false); setFeedbackBusy(null); setEntries([welcome]); setDraft(''); setSignals({}); setNotice(''); setLearning(null);
    return () => {
      generation.current += 1;
      chatRequest.current?.controller.abort();
      if (chatRequest.current) clearTimeout(chatRequest.current.timer);
      feedbackRequest.current?.abort();
    };
  }, [userId]);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('ecovibes:assistant_open', openAssistant);
    return () => window.removeEventListener('ecovibes:assistant_open', openAssistant);
  }, []);

  useEffect(() => {
    if (!open || !online) { setAiStatus(null); return; }
    inputRef.current?.focus();
    const controller = new AbortController();
    const timer = setTimeout(() => { setAiStatus((current) => current || { configured: false, unavailable: true }); controller.abort(); }, 10_000);
    setAiStatus(null);
    void fetch(apiUrl('/ai/status'), { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('AI unavailable');
        return jsonResponse(response);
      })
      .then((payload) => { if (!controller.signal.aborted) setAiStatus({ configured: payload.configured === true, unavailable: false, hosting: payload.hosting === 'local' ? 'local' : payload.hosting === 'remote' ? 'remote' : undefined, allowance: Number.isInteger(userId ? payload.dailyRequests : payload.guestDailyRequests) ? Number(userId ? payload.dailyRequests : payload.guestDailyRequests) : undefined }); })
      .catch(() => { if (!controller.signal.aborted) setAiStatus({ configured: false, unavailable: true }); })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, online, userId]);

  useEffect(() => {
    if (!open || !online || !userId) { setLearning(null); return; }
    const accountGeneration = generation.current;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requestSequence = 0;
    const refresh = (event?: Event) => {
      controller?.abort();
      clearTimeout(timer);
      if (event) {
        feedbackRequest.current?.abort();
        feedbackRequest.current = null;
        setFeedbackBusy(null);
      }
      const request = new AbortController();
      controller = request;
      const sequence = ++requestSequence;
      setLearning(null);
      if (event instanceof CustomEvent && isRecord(event.detail) && event.detail.reset === true) setSignals({});
      timer = setTimeout(() => request.abort(), 10_000);
      void fetch(apiUrl('/recommendations'), { credentials: 'include', signal: request.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Learning unavailable');
          return jsonResponse(response);
        })
        .then((payload) => {
          if (request.signal.aborted || sequence !== requestSequence || accountGeneration !== generation.current || typeof payload.enabled !== 'boolean') return;
          setLearning({ enabled: payload.enabled });
          if (!payload.enabled) setSignals({});
        })
        .catch(() => {})
        .finally(() => { if (sequence === requestSequence) clearTimeout(timer); });
    };
    refresh();
    window.addEventListener('ecovibes:recommendations_changed', refresh);
    return () => {
      requestSequence += 1;
      controller?.abort();
      clearTimeout(timer);
      window.removeEventListener('ecovibes:recommendations_changed', refresh);
    };
  }, [open, online, userId]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); launchRef.current?.focus(); }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [entries, open]);

  const ask = async (value: string) => {
    const query = value.trim().slice(0, 1200);
    if (!query || busyRef.current) return;
    const requestGeneration = generation.current;
    const entryId = nextId.current++;
    const replyId = nextId.current++;
    setDraft(''); setNotice('');
    const greeting = chaleGreeting(query);
    if (greeting) {
      setEntries(current => [...current, { id: entryId, role: 'user', text: query }, { id: replyId, role: 'assistant', source: 'greeting', text: greeting }]);
      return;
    }
    const guides = localAppGuides(query, page);
    if (!online) {
      setEntries((current) => [...current, { id: entryId, role: 'user', text: query }, {
        id: replyId, role: 'assistant', source: 'app_guide',
        text: 'You’re offline. I can still help you find your way using the EcoVibes app guide. Live answers and listings need a connection.',
        guides, drafts: localDraft(query, page),
      }]);
      return;
    }
    busyRef.current = true; setBusy(true);
    setEntries((current) => [...current, { id: entryId, role: 'user', text: query }, { id: replyId, role: 'assistant', pending: true, text: 'Finding a way forward…' }]);
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: query }];
    let totalCharacters = query.length;
    const recent = entries.filter((entry) => entry.id > 0 && !entry.pending && (entry.role === 'user' || entry.source === 'model')).slice(-7);
    for (const entry of recent.reverse()) {
      const content = entry.text.slice(0, 1200);
      if (totalCharacters + content.length > 6000) break;
      history.unshift({ role: entry.role, content });
      totalCharacters += content.length;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 90_000);
    chatRequest.current = { controller, timer };
    let reply: ChatEntry = { id: replyId, role: 'assistant', source: 'app_guide', text: '', guides, drafts: localDraft(query, page) };
    let needsCatalog = false;
    try {
      const response = await fetch(apiUrl('/ai/chat'), {
        method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
        body: JSON.stringify({ messages: history, context: { currentPage: page, dataMode } }),
      });
      const payload = await jsonResponse(response);
      if (requestGeneration !== generation.current) return;
      if (controller.signal.aborted) throw new Error('Request stopped');
      if (response.ok && typeof payload.text === 'string' && payload.text.trim()) {
        reply = { ...reply, text: payload.text.slice(0, 12_000), source: payload.source === 'public_updates' ? 'public_updates' : payload.source === 'greeting' ? 'greeting' : payload.source === 'app_guide' ? 'app_guide' : 'model',
          updates: payload.source === 'public_updates' ? readPublicUpdates(payload) : [],
          newsRequested: payload.source === 'public_updates' && ['available','partial','empty','unavailable'].includes(String(payload.newsStatus)),
          items: liveItems(payload.items), guides: verifiedGuides(payload.guides), drafts: reviewDrafts(payload.drafts), diagnostics: verifiedDiagnostics(payload.diagnostics) };
        if (reply.source === 'app_guide' && !reply.guides?.length) reply.guides = guides;
      } else {
        const code = isRecord(payload.error) ? payload.error.code : null;
        setAiStatus({ configured: code !== 'ai_not_configured', unavailable: code !== 'ai_not_configured' });
        reply.text = code === 'ai_daily_limit'
          ? 'Today’s free Chale allowance has been used. It resets at 00:00 UTC. You can keep using these app steps.'
          : code === 'ai_busy' ? 'Chale is helping someone else. Please try again shortly. These app steps are available now.'
          : 'Live Chale AI is unavailable right now. Here are verified app steps you can use while we find the next way forward.';
        needsCatalog = /\b(find|search|product|buy|job|service|listing|shop)\b/i.test(query);
      }
    } catch {
      if (requestGeneration !== generation.current) return;
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
        reply = { id: replyId, role: 'assistant', source: 'app_guide', text: 'Stopped. Your question has not been retried.' };
      } else {
        setAiStatus({ configured: false, unavailable: true });
        reply.text = controller.signal.reason === 'timeout'
          ? 'The live answer took too long. The app guide can still help with your next step.'
          : 'I couldn’t reach the live service. These verified app steps are available to help you continue.';
      }
    } finally {
      clearTimeout(timer);
    }
    try {
      if (needsCatalog && !controller.signal.aborted && requestGeneration === generation.current) {
        const searchTimer = setTimeout(() => controller.abort('timeout'), 8_000);
        try { reply.items = await searchLiveListings(query, dataMode, controller.signal); }
        finally { clearTimeout(searchTimer); }
      }
      if (requestGeneration === generation.current) setEntries((current) => current.map((entry) => entry.id === replyId ? reply : entry));
    } finally {
      if (requestGeneration === generation.current) { busyRef.current = false; setBusy(false); chatRequest.current = null; }
    }
  };

  const signal = async (item: LiveSearchItem, action: 'saved' | 'dismissed') => {
    if (!online || !userId || !csrfToken || learning?.enabled !== true || !uuidPattern.test(item.id) || feedbackBusy) return;
    const key = `${item.kind}:${item.id}`;
    const requestGeneration = generation.current;
    const active = action === 'saved' ? !signals[key]?.saved : true;
    const controller = new AbortController();
    feedbackRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), 10_000);
    setFeedbackBusy(key); setNotice('');
    try {
      const response = await fetch(apiUrl('/recommendations/signals'), {
        method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ itemType: item.kind, itemId: item.id, action, active }),
      });
      const payload = await jsonResponse(response);
      if (!response.ok) throw new Error(isRecord(payload.error) ? safeString(payload.error.message) || 'Feedback could not be saved.' : 'Feedback could not be saved.');
      if (controller.signal.aborted || requestGeneration !== generation.current) return;
      if (payload.paused === true) {
        setLearning({ enabled: false });
        setNotice('Learning is paused. No feedback was saved.');
        return;
      }
      setSignals((current) => ({ ...current, [key]: { ...current[key], [action]: active } }));
      setNotice(action === 'dismissed' ? 'EcoVibes will show you less like this.' : active ? 'Saved to your learning profile.' : 'Removed that saved signal.');
      window.dispatchEvent(new Event('ecovibes:recommendations_changed'));
    } catch (reason) {
      if (!controller.signal.aborted && requestGeneration === generation.current) setNotice(reason instanceof Error ? reason.message : 'Feedback could not be saved.');
    } finally {
      clearTimeout(timer);
      if (requestGeneration === generation.current && feedbackRequest.current === controller) { setFeedbackBusy(null); feedbackRequest.current = null; }
    }
  };

  const navigate = (destination: unknown) => {
    if (!isAssistantDestination(destination)) return;
    onNavigate(destination); setOpen(false);
  };
  const copyDraft = async (review: ReviewDraft) => {
    const requestGeneration = generation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable. Select the draft text to copy it.');
      await navigator.clipboard.writeText(draftText(review));
      if (requestGeneration === generation.current) setNotice('Draft copied. Review it before you share it.');
    } catch (reason) {
      if (requestGeneration === generation.current) setNotice(reason instanceof Error ? reason.message : 'Select the draft text to copy it.');
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(draft); };
  const connection = !online ? 'Offline app guide' : aiStatus === null ? 'Checking configuration…' : aiStatus.unavailable ? 'App guide available' : aiStatus.configured ? 'Model configured' : 'App guide available';

  return <>
    <button ref={launchRef} className="sidekick-launch" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="ecovibes-sidekick">
      <span className="sidekick-orb" aria-hidden="true"><Sparkles size={19}/></span><span>Ask Chale AI</span><i>AI</i>
    </button>
    {open && <section className="sidekick-panel chale-panel" id="ecovibes-sidekick" role="dialog" aria-label="Chale AI">
      <header className="sidekick-head">
        <span className="sidekick-avatar"><Sparkles size={19}/></span>
        <span><b>Chale AI</b><small><i className={online && aiStatus?.configured && !aiStatus.unavailable ? 'connected' : ''}/>{connection}</small></span>
        <button aria-label="Close Chale AI" onClick={() => { setOpen(false); launchRef.current?.focus(); }}><X size={17}/></button>
      </header>
      <div className="sidekick-context"><span className="context-orbit"><span/><i/><b/></span><span><b>A way forward, together.</b><small>You’re in {page}. {dataMode === 'extreme' ? 'Text first, with fewer listings.' : 'Your choices stay yours.'}</small></span></div>
      <div ref={threadRef} className="sidekick-thread" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation with Chale AI">
        {userId && (page === 'Waste' || page === 'Quick&Handi') && <WorkStatusCard key={userId} userId={userId} online={online} onNavigate={navigate}/>}
        {entries.map((entry) => <div className={`assistant-message ${entry.role}`} key={entry.id}>
          {entry.role === 'assistant' && entry.id > 0 && !entry.pending && entry.source !== 'greeting' && <span className="chale-source">{entry.source === 'public_updates' ? 'Updates and sources' : entry.source === 'app_guide' ? 'App guide' : 'Chale AI'}</span>}
          <p>{entry.pending && <LoaderCircle size={13} className="chale-thinking" aria-hidden="true"/>}{entry.text}</p>
          {entry.source === 'public_updates' && <div className="chale-guides">
            {(['app','ghana','world'] as const).map(kind=>entry.updates?.some(item=>item.kind===kind) && <article key={kind} aria-label={kind==='app'?'EcoVibes updates':kind==='ghana'?'Ghana news':'World news'}>
              <header><b>{kind==='app'?'EcoVibes updates':kind==='ghana'?'Ghana news':'World news'}</b></header>
              {entry.updates.filter(item=>item.kind===kind).map(item=><p key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{item.title}</a><br/><small>{item.source} · {kind==='app'?'Released':'Indexed'} {new Date(item.date).toLocaleString()}</small></p>)}
            </article>)}
            {entry.newsRequested && <p><small>News index: <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">GDELT Project</a>. Open the publisher for full reporting.</small></p>}
          </div>}
          {!!replyEvidence(entry).length && <p className="chale-evidence" aria-label="Reply evidence">Evidence returned: {replyEvidence(entry).join(' · ')}.</p>}
          {!!entry.diagnostics?.length && <div className="chale-diagnostics">{entry.diagnostics.map((diagnostic) => {
            const steps = [...new Set(diagnostic.guides.filter((guide) => guide.destination === diagnostic.destination).flatMap((guide) => guide.steps))].slice(0, 4);
            return <article key={diagnostic.id} aria-label={diagnostic.title}>
              <span className="chale-diagnostic-label">ECOVIBES REQUIREMENTS</span>
              <h3>{diagnostic.title}</h3><p>{diagnostic.summary}</p>
              <p className="chale-diagnostic-scope">Guide and configuration checks only. Live operation has not been tested.</p>
              <ul className="chale-checks">{diagnostic.checks.map((check, index) => <li key={`${check.label}-${index}`}>
                <div><b>{check.label}</b><span className={`chale-check-status ${check.status}`}>{diagnosticStatusLabels[check.status]}</span></div>
                <p>{check.detail}</p>
              </li>)}</ul>
              {!!steps.length && <div className="chale-diagnostic-steps"><b>Next steps from the app guide</b><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol></div>}
              <small className="chale-diagnostic-source">Guide: {diagnostic.guides.map((guide) => guide.title).join(' · ')} · {appGuideVersion}</small>
              <button type="button" onClick={() => navigate(diagnostic.destination)}>Open {diagnostic.destination}<ChevronRight size={14}/></button>
            </article>;
          })}</div>}
          {!!entry.guides?.length && <div className="chale-guides">{entry.guides.map((guide) => <article key={guide.id}>
            <header><b>{guide.title}</b>{guide.availability !== 'implemented' && <small>{guide.availability === 'preview' ? 'Preview' : 'Requires a connected provider'}</small>}</header>
            <p>{guide.summary}</p><ol>{guide.steps.slice(0, 4).map((step) => <li key={step}>{step}</li>)}</ol>
            <button type="button" onClick={() => navigate(guide.destination)}>Open {guide.destination}<ChevronRight size={14}/></button>
          </article>)}</div>}
          {!!entry.items?.length && <div className="assistant-results chale-results">{entry.items.map((item) => {
            const key = `${item.kind}:${item.id}`;
            const signalState = signals[key];
            const canLearn = online && Boolean(userId && csrfToken) && learning?.enabled === true && uuidPattern.test(item.id);
            return <article key={key}>
              <button type="button" onClick={() => navigate(item.destination)}>
                <span><small>{item.kind === 'job' ? 'QUICK&HANDI JOB' : 'MARKETPLACE PRODUCT'} · {item.category}</small><b>{item.title}</b><i>{[item.detail, item.area, item.actor_eco_id && `@${item.actor_eco_id}`, item.price].filter(Boolean).join(' · ')}</i></span><ChevronRight size={16}/>
              </button>
              {canLearn && <div className="chale-listing-actions">
                <button type="button" disabled={Boolean(feedbackBusy)} aria-pressed={Boolean(signalState?.saved)} onClick={() => void signal(item, 'saved')} aria-label={`${signalState?.saved ? 'Unsave' : 'Save'} ${item.title}`}>{signalState?.saved ? <Check size={14}/> : <Bookmark size={14}/>} {signalState?.saved ? 'Saved' : 'Save'}</button>
                <button type="button" disabled={Boolean(feedbackBusy) || signalState?.dismissed} onClick={() => void signal(item, 'dismissed')} aria-label={`Show less like ${item.title}`}><ThumbsDown size={14}/>{signalState?.dismissed ? 'Preference saved' : 'Show less'}</button>
              </div>}
            </article>;
          })}</div>}
          {!!entry.drafts?.length && <div className="chale-drafts">{entry.drafts.map((review) => <article key={review.id}>
            <small>FOR YOUR REVIEW · {review.kind === 'support' ? 'SUPPORT' : 'IDEA'}</small><h3>{review.title}</h3><p className="chale-draft-copy">{draftText(review).split('\n\n').slice(1).join('\n\n')}</p>
            <footer><span>Draft only. Nothing has been submitted.</span><button type="button" onClick={() => void copyDraft(review)}><Copy size={13}/>Copy draft</button></footer>
          </article>)}</div>}
        </div>)}
        {entries.length === 1 && <div className="sidekick-prompts"><span>START WHERE YOU ARE</span>{pagePrompts(page).map((prompt) => <button type="button" disabled={busy} key={prompt} onClick={() => void ask(prompt)}>{prompt}<ChevronRight size={13}/></button>)}</div>}
      </div>
      <div className="chale-learning"><span>{!userId ? 'Sign in to manage your learning profile.' : learning?.enabled ? 'Learning is on. Save or show less to tune it.' : learning ? 'Learning is paused.' : 'Your learning choices are available on Home.'}</span><button type="button" onClick={() => navigate('Home')}>Tune learning on Home<ChevronRight size={12}/></button></div>
      {notice && <p className="chale-notice" role="status">{notice}</p>}
      <form className="sidekick-input" onSubmit={submit}>
        <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about EcoVibes or an app problem" aria-label="Ask Chale AI" maxLength={1200}/>
        {busy ? <button type="button" className="chale-stop" aria-label="Stop answer" onClick={() => chatRequest.current?.controller.abort('stopped')}><X size={17}/></button> : <button disabled={!draft.trim()} aria-label="Send question"><ArrowUp size={17}/></button>}
      </form>
      <p className="sidekick-disclosure">{!online ? 'The app guide works on this device. No messages are sent while offline.' : `Live replies use recent messages, safe app context and public listings with ${aiStatus?.hosting === 'local' ? 'the model on the EcoVibes server' : 'the configured model service'}. Keep passwords and payment codes private. Review drafts before sharing.${aiStatus?.allowance ? ` Free allowance: ${aiStatus.allowance} requests per day, resetting at 00:00 UTC. Failed or busy attempts count.` : ''}`}<span className="chale-guide-version" title={appGuideVersion}> Verified EcoVibes app guide</span></p>
    </section>}
  </>;
}
