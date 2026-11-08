// Public roadmap records maintained with source control. These are not released builds.
export const GAME_CATALOG = Object.freeze([
  { id: 'rumble-rush', title: 'Rumble Rush: Fusion Edition', category: 'Racing', status: 'development', summary: 'Our first flagship. An original arcade racer, beginning with Accra Skyway.', milestone: 'M1: driving foundation', target: 'Godot · browser and Android targets', controls: 'Keyboard, controller and touch targets' },
  { id: 'oware', title: 'Mancala Circle · Oware', category: 'Strategy', status: 'planned', summary: 'Local two-player strategy inspired by Oware. Rules and cultural review come first.', milestone: 'Local practice', target: 'Lightweight browser target', controls: 'Touch and keyboard targets' },
  { id: 'draughts', title: 'Draughts', category: 'Strategy', status: 'planned', summary: 'Thoughtful moves, short matches and clear rules.', milestone: 'Legal moves and local matches', target: 'Lightweight browser target', controls: 'Touch and keyboard targets' },
  { id: 'word-sprint', title: 'Word Sprint', category: 'Puzzle', status: 'planned', summary: 'Quick word rounds with language packs reviewed by people who speak them.', milestone: 'Reviewed English word set', target: 'Lightweight browser target', controls: 'Touch and keyboard targets' },
  { id: 'daily-quiz', title: 'Daily Quiz', category: 'Learning', status: 'planned', summary: 'Discover something new with sourced questions and a way to report corrections.', milestone: 'Question sourcing and review', target: 'Lightweight browser target', controls: 'Touch and keyboard targets' },
  { id: 'eco-sort', title: 'Eco Sort', category: 'Learning', status: 'planned', summary: 'Learn local recycling categories. Answers will explain which locality they apply to.', milestone: 'Locality and material review', target: 'Lightweight browser target', controls: 'Touch and keyboard targets' },
  { id: 'goal-line', title: 'Goal Line', category: 'Arcade', status: 'planned', summary: 'The original football arcade concept remains on the roadmap.', milestone: 'Gameplay concept', target: 'Browser target', controls: 'Controls to be validated' },
].map(game => Object.freeze({ ...game, playable: false, releaseVersion: null, downloadBytes: null,
  notice: 'Not available to play in EcoVibes yet. Device performance and download size are not verified.' })));

export function queryGames(params = new URLSearchParams()) {
  const keys = [...params.keys()];
  if (keys.some(key => !['q', 'category'].includes(key)) || new Set(keys).size !== keys.length) {
    throw new Error('Use only one search and category filter.');
  }
  const q = (params.get('q') || '').trim();
  const category = params.get('category') || 'All';
  const categories = ['All', ...new Set(GAME_CATALOG.map(game => game.category))];
  if (q.length > 80 || !categories.includes(category)) throw new Error('Choose a listed category and a search of up to 80 characters.');
  return { version: 1, source: 'ecovibes-roadmap', categories,
    games: GAME_CATALOG.filter(game => (category === 'All' || game.category === category)
      && `${game.title} ${game.summary}`.toLowerCase().includes(q.toLowerCase())) };
}

/** Preparation for a future launcher, never an upload approval or entitlement grant.
 * Policy must come from trusted server records, never the submitted manifest.
 * Version 1 only supports anonymous practice: no identity, money or score scopes.
 */
export function validateGameManifest(value, policy) {
  const fail = () => { throw new Error('This game build is not approved for launch.'); };
  const keys = ['schemaVersion', 'gameId', 'buildId', 'runtime', 'entryUrl', 'sha256', 'downloadBytes', 'capabilities'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || Object.keys(value).some(key => !keys.includes(key))) return fail();
  const { gameId, buildId, runtime, entryUrl, sha256, downloadBytes, capabilities } = value;
  if (value.schemaVersion !== 1 || typeof gameId !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(gameId)
    || typeof buildId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(buildId) || runtime !== 'godot-web-single-thread'
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isSafeInteger(downloadBytes) || downloadBytes <= 0 || downloadBytes > 100_000_000
    || !Array.isArray(capabilities) || capabilities.length !== 1 || capabilities[0] !== 'practice') return fail();
  let url;
  try { url = new URL(entryUrl); } catch { return fail(); }
  if (typeof entryUrl !== 'string' || url.href !== entryUrl || url.protocol !== 'https:' || url.port
    || url.username || url.password || url.search || url.hash
    || url.pathname !== `/${gameId}/${buildId}/index.html`
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(url.hostname)
    || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)
    || /^[\d.]+$/.test(url.hostname)) return fail();
  if (!policy || !Array.isArray(policy.allowedOrigins) || !policy.allowedOrigins.includes(url.origin)
    || !Array.isArray(policy.appOrigins) || !policy.appOrigins.length || policy.appOrigins.includes(url.origin)
    || !Array.isArray(policy.approvedReleases)) return fail();
  const stamp = policy.now ?? Date.now();
  if (!Number.isFinite(stamp) || !policy.approvedReleases.some(release => release.status === 'approved'
    && release.gameId === gameId && release.buildId === buildId && release.runtime === runtime
    && release.entryUrl === entryUrl && release.sha256 === sha256 && release.downloadBytes === downloadBytes
    && Number.isFinite(Date.parse(release.expiresAt)) && Date.parse(release.expiresAt) > stamp)) return fail();
  return Object.freeze({ ...value, capabilities: Object.freeze(['practice']) });
}
