import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, ChevronRight, Sparkles, X } from 'lucide-react';
import type { AssistantDestination, AssistantItem } from './assistant';
import { apiUrl } from '../../lib/api';

type ChatEntry = { id: number; role: 'assistant' | 'user'; text: string; items?: AssistantItem[] };
type LiveSearchItem = {
  id: string;
  kind: 'product' | 'job';
  title: string;
  detail: string;
  category: string;
  destination: 'Marketplace' | 'Quick&Handi';
  actor_eco_id: string;
  price?: string;
  area?: string;
};
type AIStatus = { configured: boolean; provider: string | null; model: string | null; unavailable?: boolean };
type ChatMessage = { role: 'assistant' | 'user'; content: string };

const welcome: ChatEntry = {
  id: 0,
  role: 'assistant',
  text: 'Hi, I’m Chale AI. Ask me a question, or tell me what you are looking for across EcoVibes.',
};

function toAssistantItems(items: LiveSearchItem[]): AssistantItem[] {
  return items.map((item) => ({
    id: item.id,
    eyebrow: `${item.kind === 'job' ? 'QUICK&HANDI JOB' : 'MARKETPLACE PRODUCT'} · ${item.category}`,
    title: item.title,
    detail: [item.detail, item.area, item.actor_eco_id ? `@${item.actor_eco_id}` : '', item.price].filter(Boolean).join(' · '),
    destination: item.destination,
    score: 1,
  }));
}

async function searchLiveListings(query: string): Promise<LiveSearchItem[]> {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((term) => !['the', 'and', 'for', 'with', 'from', 'near', 'show', 'find', 'need', 'want', 'what', 'where', 'please', 'under', 'around', 'some', 'can', 'you'].includes(term))
    .slice(0, 4);
  const results = new Map<string, LiveSearchItem>();
  for (const term of terms) {
    try {
      const response = await fetch(`${apiUrl('/search')}?q=${encodeURIComponent(term)}`, { credentials: 'include' });
      if (!response.ok) continue;
      const payload = await response.json() as { items?: LiveSearchItem[] };
      for (const item of payload.items || []) results.set(item.id, item);
    } catch {
      break;
    }
  }
  return [...results.values()].slice(0, 8);
}

export default function Sidekick({ onNavigate }: { onNavigate: (page: AssistantDestination) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([welcome]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('ecovibes:assistant_open', openAssistant);
    return () => window.removeEventListener('ecovibes:assistant_open', openAssistant);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const controller = new AbortController();
    void fetch(apiUrl('/ai/status'), { credentials: 'include', signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<AIStatus> : Promise.reject(new Error('AI status unavailable')))
      .then((status) => setAiStatus({ ...status, unavailable: false }))
      .catch(() => { if (!controller.signal.aborted) setAiStatus({ configured: false, provider: null, model: null, unavailable: true }); });
    return () => controller.abort();
  }, [open]);

  const ask = async (value: string) => {
    const query = value.trim();
    if (!query || busy) return;
    setDraft('');
    setBusy(true);
    const userId = Date.now();
    setEntries((current) => [
      ...current,
      { id: userId, role: 'user', text: query },
      { id: userId + 1, role: 'assistant', text: 'Chale AI is thinking…' },
    ]);

    const history: ChatMessage[] = [
      ...entries.slice(-7).map(({ role, text }) => ({ role, content: text })),
      { role: 'user', content: query },
    ];
    let answer = '';
    let items: AssistantItem[] = [];
    let fallbackMessage = 'I couldn’t reach Chale AI just now. I searched the live public catalogue instead.';
    try {
      const response = await fetch(apiUrl('/ai/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const payload = await response.json() as { text?: string; items?: LiveSearchItem[]; error?: { code?: string } };
      if (response.ok && payload.text) {
        answer = payload.text;
        items = toAssistantItems(payload.items || []);
      } else if (payload.error?.code === 'ai_not_configured') {
        fallbackMessage = 'Chale AI’s language model is not configured yet, so I can’t generate an intelligent answer. I searched the live public catalogue instead.';
        setAiStatus((status) => status ? { ...status, configured: false, unavailable: false } : status);
      } else if (payload.error?.code === 'ai_unavailable') {
        setAiStatus((status) => status ? { ...status, unavailable: true } : status);
      }
    } catch {
      fallbackMessage = 'I couldn’t connect to the EcoVibes API. Please try again when it is available.';
      setAiStatus({ configured: false, provider: null, model: null, unavailable: true });
    }

    if (!answer && !fallbackMessage.startsWith('I couldn’t connect')) {
      const liveItems = await searchLiveListings(query);
      items = toAssistantItems(liveItems);
      answer = liveItems.length
        ? `${fallbackMessage} These are the matching public listings I found.`
        : `${fallbackMessage} I didn’t find matching public listings. Try a shorter search with a product, service or location.`;
    } else if (!answer) {
      answer = fallbackMessage;
    }

    setEntries((current) => current.map((entry) => entry.id === userId + 1 ? { ...entry, text: answer, items } : entry));
    setBusy(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };

  return <>
    <button className="sidekick-launch" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="ecovibes-sidekick">
      <span className="sidekick-orb" aria-hidden="true"><Sparkles size={19}/></span><span>Ask Chale AI</span><i>AI</i>
    </button>
    {open && <section className="sidekick-panel" id="ecovibes-sidekick" role="dialog" aria-label="Chale AI">
      <header className="sidekick-head">
        <span className="sidekick-avatar"><Sparkles size={19}/></span>
        <span><b>Chale AI</b><small><i className={aiStatus?.configured && !aiStatus.unavailable ? 'connected' : ''}/>{aiStatus === null ? ' Checking AI connection…' : aiStatus.unavailable ? ' AI service unavailable' : aiStatus.configured ? ' AI model configured' : ' AI model not configured'}</small></span>
        <button aria-label="Close Chale AI" onClick={() => setOpen(false)}><X size={17}/></button>
      </header>
      <div className="sidekick-context"><span className="context-orbit"><span/><i/><b/></span><span><b>One identity. More ways forward.</b><small>Ask questions or search EcoVibes in everyday language.</small></span></div>
      <div className="sidekick-thread" aria-live="polite">
        {entries.map((entry) => <div className={`assistant-message ${entry.role}`} key={entry.id}>
          <p>{entry.text}</p>
          {entry.items?.length ? <div className="assistant-results">{entry.items.map((item) => <button key={item.id} onClick={() => { onNavigate(item.destination); setOpen(false); }}>
            <span><small>{item.eyebrow}</small><b>{item.title}</b><i>{item.detail}</i></span><ChevronRight size={16}/>
          </button>)}</div> : null}
        </div>)}
        {entries.length === 1 && <div className="sidekick-prompts"><span>TRY ASKING</span>{['Find grants', 'Show creators', 'Explore gaming', 'Open communities'].map((prompt) => <button disabled={busy} key={prompt} onClick={() => void ask(prompt)}>{prompt}<ChevronRight size={13}/></button>)}</div>}
      </div>
      <form className="sidekick-input" onSubmit={submit}>
        <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What are you looking for?" aria-label="Ask Chale AI" maxLength={1200}/>
        <button disabled={!draft.trim() || busy} aria-label="Send question"><ArrowUp size={17}/></button>
      </form>
      <p className="sidekick-disclosure">{aiStatus?.unavailable ? 'Chale AI could not reach its API or model. Try again shortly.' : aiStatus?.configured ? 'Your messages and matching public listings are sent to OpenAI. When personalization is on, your EcoVibes interests can influence which listings match. Don’t share passwords or payment codes.' : 'The live AI model is not configured. Catalogue search is available when the API is running.'}</p>
    </section>}
  </>;
}
