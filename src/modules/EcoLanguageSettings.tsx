import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Clock3, Globe2, Languages, Mic, Search, Volume2 } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { t } from '../lib/i18n';
import {
  defaultEcoLanguagePreferences,
  ecoLanguageCountries,
  ecoLanguages,
  languageCapabilityLabel,
  type EcoLanguagePreferences,
  type LanguageCapabilityKey,
} from '../lib/language-catalog';
import './eco-language.css';

const cacheKey = (userId: string | null) => `ecovibes:language-profile:v1:${userId || 'guest'}`;
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const capabilityRows: { key: LanguageCapabilityKey; labelKey: Parameters<typeof t>[0]; icon: typeof Languages }[] = [
  { key: 'interface', labelKey: 'language.interface', icon: Languages },
  { key: 'search', labelKey: 'language.search', icon: Search },
  { key: 'translation', labelKey: 'language.translation', icon: Globe2 },
  { key: 'speechToText', labelKey: 'language.speechToText', icon: Mic },
  { key: 'textToSpeech', labelKey: 'language.textToSpeech', icon: Volume2 },
  { key: 'codeSwitching', labelKey: 'language.codeSwitching', icon: Clock3 },
];

function readCache(userId: string | null): EcoLanguagePreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(userId)) || '{}') as Partial<EcoLanguagePreferences>;
    return {
      ...defaultEcoLanguagePreferences,
      ...parsed,
      contentLanguages: Array.isArray(parsed.contentLanguages) && parsed.contentLanguages.length
        ? parsed.contentLanguages.filter((tag) => ecoLanguages.some((language) => language.tag === tag)).slice(0, 6)
        : defaultEcoLanguagePreferences.contentLanguages,
    };
  } catch {
    return defaultEcoLanguagePreferences;
  }
}

type SyncState = 'loading' | 'saving' | 'saved' | 'device' | 'offline' | 'waiting';

export default function EcoLanguageSettings({ userId, csrfToken }: { userId: string | null; csrfToken: string }) {
  const [preferences, setPreferences] = useState<EcoLanguagePreferences>(() => readCache(userId));
  const [syncState, setSyncState] = useState<SyncState>(userId ? 'loading' : 'device');
  const [notice, setNotice] = useState('');
  const selectedLanguage = ecoLanguages.find((language) => language.tag === preferences.preferredLanguage) || ecoLanguages[0];

  useEffect(() => {
    let active = true;
    setPreferences(readCache(userId));
    setNotice('');
    if (!userId) {
      setSyncState('device');
      return () => { active = false; };
    }
    setSyncState('loading');
    void fetch(apiUrl('/language/preferences'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('profile_unavailable');
        return await response.json() as { preferences?: EcoLanguagePreferences };
      })
      .then((result) => {
        if (!active || !result.preferences) return;
        const next = { ...defaultEcoLanguagePreferences, ...result.preferences };
        setPreferences(next);
        try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)); } catch { /* Account preferences remain available from the API. */ }
        setSyncState('saved');
      })
      .catch(() => { if (active) setSyncState('offline'); });
    return () => { active = false; };
  }, [userId, csrfToken]);

  async function update(next: EcoLanguagePreferences) {
    setPreferences(next);
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)); } catch { /* The setting remains available in memory. */ }
    if (!userId) {
      setSyncState('device');
      return;
    }
    if (!csrfToken) {
      setSyncState('waiting');
      return;
    }
    setSyncState('saving');
    try {
      const response = await fetch(apiUrl('/language/preferences'), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ preferences: next }),
      });
      if (!response.ok) throw new Error('profile_save_failed');
      const result = await response.json() as { preferences?: EcoLanguagePreferences };
      if (result.preferences) setPreferences({ ...defaultEcoLanguagePreferences, ...result.preferences });
      setSyncState('saved');
      setNotice(t('language.saved'));
      window.setTimeout(() => setNotice(''), 2400);
    } catch {
      setSyncState('offline');
    }
  }

  function choosePreferred(event: ChangeEvent<HTMLSelectElement>) {
    void update({ ...preferences, preferredLanguage: event.target.value });
  }

  function chooseContent(languageTag: string) {
    const selected = preferences.contentLanguages.includes(languageTag);
    if (selected && preferences.contentLanguages.length === 1) {
      setNotice(t('language.contentLimit'));
      return;
    }
    if (!selected && preferences.contentLanguages.length >= 6) {
      setNotice(t('language.contentLimit'));
      return;
    }
    const contentLanguages = selected
      ? preferences.contentLanguages.filter((tag) => tag !== languageTag)
      : [...preferences.contentLanguages, languageTag];
    void update({ ...preferences, contentLanguages });
  }

  function chooseRegion(event: ChangeEvent<HTMLSelectElement>) {
    void update({ ...preferences, regionCode: event.target.value });
  }

  function chooseVoiceLanguage(kind: 'voiceInputLanguage' | 'voiceOutputLanguage', event: ChangeEvent<HTMLSelectElement>) {
    void update({ ...preferences, [kind]: event.target.value });
  }

  const syncCopy = syncState === 'saved'
    ? t('language.accountSync')
    : syncState === 'device'
      ? t('language.deviceSave')
    : syncState === 'loading' || syncState === 'saving'
        ? t('language.syncing')
        : syncState === 'waiting'
          ? t('language.waiting')
          : t('language.offline');

  return <section className="eco-language-settings" aria-labelledby="eco-language-title">
    <div className="eco-language-head">
      <div className="eco-language-mark"><Languages size={19}/></div>
      <div><h2 id="eco-language-title">{t('language.title')}</h2><p>{t('language.description')}</p></div>
    </div>

    <label className="eco-language-field"><span><b>{t('language.preferred')}</b><small>{t('language.preferredHelp')}</small></span>
      <select value={preferences.preferredLanguage} onChange={choosePreferred} disabled={syncState === 'loading' || syncState === 'saving'}>
        {ecoLanguages.map((language) => <option key={language.tag} value={language.tag}>{language.name} · {language.nativeName}</option>)}
      </select>
    </label>

    <div className="eco-language-field eco-language-region"><span><b>{t('language.region')}</b><small>{t('language.regionHelp')}</small></span>
      <select value={preferences.regionCode} onChange={chooseRegion} disabled={syncState === 'loading' || syncState === 'saving'}>
        {[...ecoLanguageCountries].sort((a, b) => countryNames.of(a)!.localeCompare(countryNames.of(b)!)).map((code) => <option key={code} value={code}>{countryNames.of(code)} · {code}</option>)}
      </select>
    </div>

    <div className="eco-language-content"><div><b>{t('language.content')}</b><small>{t('language.contentHelp')}</small></div>
      <div className="eco-language-choice-grid">{ecoLanguages.map((language) => {
        const checked = preferences.contentLanguages.includes(language.tag);
        return <label key={language.tag} className={`eco-language-choice ${checked ? 'selected' : ''}`}>
          <input type="checkbox" checked={checked} disabled={syncState === 'loading' || syncState === 'saving'} onChange={() => chooseContent(language.tag)} />
          <span className="eco-language-choice-check">{checked && <Check size={12}/>}</span>
          <span><b>{language.name}</b><small>{language.nativeName}</small></span>
        </label>;
      })}</div>
    </div>

    <details className="eco-language-voice">
      <summary><span><b>{t('language.voice')}</b><small>{t('language.voiceHelp')}</small></span><Clock3 size={16}/></summary>
      <div className="eco-language-voice-fields">
        <label>{t('language.speechToText')}<select value={preferences.voiceInputLanguage} disabled={syncState === 'loading' || syncState === 'saving'} onChange={(event) => chooseVoiceLanguage('voiceInputLanguage', event)}>{ecoLanguages.map((language) => <option key={language.tag} value={language.tag}>{language.name}</option>)}</select></label>
        <label>{t('language.textToSpeech')}<select value={preferences.voiceOutputLanguage} disabled={syncState === 'loading' || syncState === 'saving'} onChange={(event) => chooseVoiceLanguage('voiceOutputLanguage', event)}>{ecoLanguages.map((language) => <option key={language.tag} value={language.tag}>{language.name}</option>)}</select></label>
      </div>
      <p className="eco-language-privacy"><Mic size={13}/>{t('language.noMic')}</p>
    </details>

    <div className="eco-language-readiness"><div><h3>{t('language.directory')}</h3><p>{t('language.directoryHelp')}</p></div>
      <div className="eco-language-capabilities">{capabilityRows.map(({ key, labelKey, icon: Icon }) => {
        const capabilityLanguage = key === 'speechToText'
          ? ecoLanguages.find((language) => language.tag === preferences.voiceInputLanguage) || selectedLanguage
          : key === 'textToSpeech'
            ? ecoLanguages.find((language) => language.tag === preferences.voiceOutputLanguage) || selectedLanguage
            : selectedLanguage;
        const status = capabilityLanguage.capabilities[key];
        return <div className="eco-language-capability" key={key}><span><Icon size={14}/>{t(labelKey)}</span><b className={`capability-${status.toLowerCase()}`}>{languageCapabilityLabel(status)}</b></div>;
      })}</div>
    </div>

    <div className="eco-language-footer"><span className={`eco-language-sync sync-${syncState}`}><i/>{syncCopy}</span>{notice&&<span className="eco-language-notice" role="status">{notice}</span>}<small>{t('language.savedHere')}</small></div>
  </section>;
}
