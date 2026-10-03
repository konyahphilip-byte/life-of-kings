const KEY = 'ecovibes:v1';
const accountKey = (identityId?:string|null) => identityId ? `${KEY}:account:${identityId}` : KEY;
function preserveLegacyState(identityId?:string|null) {
  if (!identityId) return;
  try {
    const legacy=localStorage.getItem(KEY);
    const backup=`${KEY}:unassigned-backup`;
    if (legacy && !localStorage.getItem(backup)) localStorage.setItem(backup,legacy);
    if (legacy) localStorage.removeItem(KEY);
  } catch { /* Account data remains isolated in its own key when storage is available. */ }
}
export type SavedState = { saver: 'standard'|'saver'|'extreme'; liked: string[]; saved: string[]; cart: Record<string, number>; followed: string[]; posts: import('../data/seed').FeedPost[]; savedOpps: string[]; draft: string; theme: 'light'|'dark' };
const defaults: SavedState = {saver:'saver',liked:[],saved:[],cart:{},followed:['amastudio'],posts:[],savedOpps:[],draft:'',theme:'light'};
export function loadState(identityId?:string|null):SavedState { preserveLegacyState(identityId); try { return {...defaults,...JSON.parse(localStorage.getItem(accountKey(identityId))||'{}')}; } catch { return defaults; } }
export function saveState(state:SavedState,identityId?:string|null) { preserveLegacyState(identityId); try { localStorage.setItem(accountKey(identityId),JSON.stringify(state)); } catch { /* Storage can be disabled or full; the app remains usable in memory. */ } }
