import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bookmark, BriefcaseBusiness, Check, Compass, Gamepad2, LoaderCircle, RefreshCw, ShoppingBag, Sparkles, ThumbsDown } from 'lucide-react';
import { apiUrl } from '../lib/api';
import './recommendations.css';

type Recommendation = {
  id: string;
  itemType: 'product' | 'job';
  title: string;
  detail: string;
  category: string;
  price: string;
  area: string;
  destination: 'Marketplace' | 'Quick&Handi';
  reason: string;
  saved: boolean;
};
type LearnedTopic = { topic: string; strength: number; learnedFrom: string };
type RecommendationData = {
  items: Recommendation[];
  interests: string[];
  availableInterests: string[];
  learnedTopics: LearnedTopic[];
  avoidedTopics: Array<{ topic: string; strength: number }>;
  learningActivityCount: number;
  enabled: boolean;
  personalized: boolean;
};
type FeedbackAction = 'opened' | 'saved' | 'dismissed';

async function responseData<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.message || 'Recommendations are unavailable right now.');
  return value as T;
}

async function recommendationData(response: Response): Promise<RecommendationData> {
  const value = await responseData<Partial<RecommendationData>>(response);
  if (!Array.isArray(value.items) || !Array.isArray(value.interests) || !Array.isArray(value.availableInterests) || !Array.isArray(value.learnedTopics) || !Array.isArray(value.avoidedTopics) || typeof value.learningActivityCount !== 'number' || typeof value.enabled !== 'boolean' || typeof value.personalized !== 'boolean') {
    throw new Error('Recommendations returned an invalid response. Please retry.');
  }
  return value as RecommendationData;
}

export default function Recommendations({
  userId,
  csrfToken,
  onNavigate,
  onSignIn,
}: {
  userId: string | null;
  csrfToken: string;
  onNavigate: (destination: 'Marketplace' | 'Quick&Handi') => void;
  onSignIn: () => void;
}) {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await recommendationData(await fetch(apiUrl('/recommendations'), { credentials: 'include' }));
      setData(next);
      setSelected(next.interests);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recommendations are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveInterests = async () => {
    if (!csrfToken || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await recommendationData(await fetch(apiUrl('/recommendations/interests'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ topics: selected }),
      }));
      setData(next);
      setSelected(next.interests);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your interests could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const setPersonalization = async () => {
    if (!data || !csrfToken || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await recommendationData(await fetch(apiUrl('/recommendations/settings'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ enabled: !data.enabled }),
      }));
      setData(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your recommendation setting could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const resetLearning = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    if (!csrfToken || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await recommendationData(await fetch(apiUrl('/recommendations/profile'), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      }));
      setData(next);
      setResetArmed(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your learned profile could not be cleared.');
    } finally {
      setSaving(false);
    }
  };

  const signal = async (item: Recommendation, action: FeedbackAction, active = true) => {
    const request = () => fetch(apiUrl('/recommendations/signals'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ itemType: item.itemType, itemId: item.id, action, active }),
    });
    if (action === 'opened') {
      onNavigate(item.destination);
      if (csrfToken) void request().catch(() => {});
      return;
    }
    if (!csrfToken || busyItem) return;
    setBusyItem(`${item.itemType}:${item.id}`);
    setError('');
    try {
      await responseData(await request());
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your feedback could not be saved.');
    } finally {
      setBusyItem(null);
    }
  };

  return <section className="recommendation-panel" aria-labelledby="recommendation-title">
    <header className="recommendation-head">
      <div>
        <span className="eyebrow"><Sparkles size={13}/> YOUR ECOVIBES LEARNING FEED</span>
        <h2 id="recommendation-title">A little more you.</h2>
        <p>One interest profile learns from Stories you can view, Reels, creator follows, products, jobs and confirmed purchases, then helps rank relevant items across EcoVibes.</p>
      </div>
      {userId && <button className="recommendation-tune" onClick={() => { setSelected(data?.interests || []); setEditing((value) => !value); }} aria-expanded={editing}>
        <Compass size={14}/>{editing ? 'Close interests' : 'Tune interests'}
      </button>}
    </header>

    {!userId ? <div className="recommendation-signin"><span><Sparkles size={17}/></span><div><b>Build your personal EcoVibes</b><small>Sign in to save interests and get recommendations that learn from your choices.</small></div><button onClick={onSignIn}>Sign in <ArrowRight size={14}/></button></div> : <>
      {editing && data && <div className="recommendation-interest-editor">
        <div><b>Choose a few starting points</b><small>Your activity can refine these over time. You can change them whenever you like.</small></div>
        <div className="recommendation-interest-list">{data.availableInterests.map((interest) => {
          const active = selected.includes(interest);
          return <button key={interest} type="button" className={active ? 'selected' : ''} aria-pressed={active} onClick={() => setSelected((current) => active ? current.filter((item) => item !== interest) : current.length < 12 ? [...current, interest] : current)}>
            {active && <Check size={12}/>} {interest}
          </button>;
        })}</div>
        <footer><small>{selected.length}/12 selected</small><button disabled={!csrfToken || saving} onClick={() => void saveInterests()}>{saving ? 'Saving…' : 'Save interests'}</button></footer>
      </div>}

      {data?.enabled && data.learnedTopics.length ? <div className="recommendation-learning-status" aria-live="polite">
        <span><RefreshCw size={12}/> Learning from {data.learningActivityCount} signal{data.learningActivityCount === 1 ? '' : 's'}</span>
        <div>{data.learnedTopics.slice(0, 3).map((topic) => <span key={topic.topic} title={`Learned from your ${topic.learnedFrom}`}>{topic.topic}</span>)}{data.avoidedTopics.slice(0, 2).map((topic) => <span className="avoided" key={`less-${topic.topic}`} title="EcoVibes will show less of this topic">Less: {topic.topic}</span>)}</div>
      </div> : !loading && data && <p className="recommendation-cold-start">{data.enabled ? 'Choose interests or explore a few listings to teach your feed what matters to you.' : 'Personalization is paused. EcoVibes is showing recent listings without using your interest profile.'}</p>}

      {editing && data && <div className="recommendation-profile-controls">
        <button disabled={saving || !csrfToken} onClick={() => void setPersonalization()}>{data.enabled ? 'Pause personalization' : 'Resume personalization'}</button>
        {data.learningActivityCount > 0 && (resetArmed ? <span><small>This clears learned signals; your chosen interests stay saved.</small><button disabled={saving || !csrfToken} onClick={() => void resetLearning()}>{saving ? 'Clearing…' : 'Confirm reset'}</button><button disabled={saving} onClick={() => setResetArmed(false)}>Keep profile</button></span> : <button disabled={saving || !csrfToken} onClick={() => void resetLearning()}>Reset learned activity</button>)}
      </div>}

      {error && <p className="recommendation-error" role="status">{error} <button onClick={() => void refresh()}>Retry</button></p>}
      {loading ? <div className="recommendation-loading"><LoaderCircle size={16}/> Learning your starting recommendations…</div> : data?.items.length ? <div className="recommendation-grid">
        {data.items.map((item) => {
          const Icon = item.itemType === 'product' ? ShoppingBag : BriefcaseBusiness;
          const itemKey = `${item.itemType}:${item.id}`;
          const busy = busyItem === itemKey;
          return <article className="recommendation-card" key={itemKey}>
            <div className={`recommendation-kind ${item.itemType}`}><Icon size={14}/><span>{item.itemType === 'product' ? 'Marketplace' : 'Quick&Handi'} · {item.category}</span></div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="recommendation-meta">{item.price && <span>{item.price}</span>}{item.area && <span>{item.area}</span>}</div>
            <small className="recommendation-reason"><Sparkles size={11}/>{item.reason}</small>
            <footer>
              <button className="recommendation-open" disabled={busy} onClick={() => void signal(item, 'opened')}>Explore <ArrowRight size={13}/></button>
              <button aria-label={`${item.saved ? 'Unsave' : 'Save'} ${item.title}`} title={item.saved ? 'Remove saved signal' : 'Save to tune recommendations'} disabled={busy || !csrfToken || !data.enabled} onClick={() => void signal(item, 'saved', !item.saved)} className={item.saved ? 'saved' : ''}>{item.saved ? <Check size={14}/> : <Bookmark size={14}/>}</button>
              <button aria-label={`Show me less like ${item.title}`} title="Show me less like this" disabled={busy || !csrfToken || !data.enabled} onClick={() => void signal(item, 'dismissed')}><ThumbsDown size={14}/></button>
            </footer>
          </article>;
        })}
      </div> : !error && <div className="recommendation-empty"><Gamepad2 size={17}/><span><b>No live picks yet</b><small>As real products and open jobs arrive, your feed will learn from what you choose.</small></span></div>}
    </>}
  </section>;
}
