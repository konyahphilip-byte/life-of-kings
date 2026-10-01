const KEY = 'ecovibes:v1';
export type SavedState = { saver: 'standard'|'saver'|'extreme'; liked: string[]; saved: string[]; cart: Record<string, number>; followed: string[]; posts: import('../data/seed').FeedPost[]; savedOpps: string[]; draft: string; theme: 'light'|'dark' };
const defaults: SavedState = {saver:'saver',liked:[],saved:[],cart:{},followed:['amastudio'],posts:[],savedOpps:[],draft:'',theme:'light'};
export function loadState():SavedState { try { return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}; } catch { return defaults; } }
export function saveState(state:SavedState) { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch { /* Storage can be disabled or full; the app remains usable in memory. */ } }
