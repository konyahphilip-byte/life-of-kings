import type { RecoveryOperation } from './recovery-operation';
type RecoveryState = 'idle' | 'checking' | 'ready' | 'saving' | 'saved' | 'invalid';

export function isAccountCallback(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.get('recovery') === '1' || url.searchParams.has('code') || fragment.get('type') === 'recovery'
    || ['error', 'error_code'].some(key => url.searchParams.has(key) || fragment.has(key));
}

// This is a UI safety gate, never an authorization decision. Supabase still
// verifies the link and every password update. Keep callback proof in memory.
export function createAccountCallback(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const failed = ['error', 'error_code'].some(key => url.searchParams.has(key) || fragment.has(key));
  let requested = url.searchParams.get('recovery') === '1' || fragment.get('type') === 'recovery';
  let consumed = false;
  let recoveryUser: string | null = null;
  let apiRevoked = false;
  let operation: RecoveryOperation | null = null;
  let state: RecoveryState = failed ? 'invalid' : requested ? 'checking' : 'idle';
  const listeners = new Set<() => void>();
  const set = (value: RecoveryState) => { if (state !== value) { state = value; listeners.forEach(listener => listener()); } };
  return {
    get requested() { return requested; },
    get openAccount() { return !consumed && isAccountCallback(href); },
    get error() { return !consumed && failed ? 'This account link is invalid or has expired. Request a new link below.' : ''; },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    finishCheck: () => { if (state === 'checking') set('invalid'); },
    clear: () => { operation?.dispose();operation=null;requested = false; consumed = true; recoveryUser = null; apiRevoked = false; set('idle'); },
    beginPasswordSave: (value:RecoveryOperation) => { if(state!=='ready'||value.ownerId!==recoveryUser)throw new Error('Request a new recovery link before saving.');operation?.dispose();operation=value;set('saving'); },
    markSaveFailed: () => { operation?.dispose();operation=null;set('invalid'); },
    get operation() { return operation; },
    matchesUser: (userId: string | undefined) => (state === 'ready' || state === 'saved') && Boolean(userId) && userId === recoveryUser,
    // Record a confirmed mutation for its captured owner even if another tab
    // changed accounts while the provider request was in flight.
    markPasswordSaved: (ownerId: string) => { recoveryUser = ownerId; requested = true; consumed = false; set('saved'); },
    markApiRevoked: () => { if (state === 'saved') apiRevoked = true; },
    get apiRevoked() { return apiRevoked; },
    receive: (event: string, hasSession: boolean, userId?: string) => {
      if (failed || !requested || state === 'saved' || state === 'saving') return;
      if (event === 'PASSWORD_RECOVERY' && hasSession && userId) { recoveryUser = userId; set('ready'); }
      else if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && state === 'ready' && (!hasSession || userId !== recoveryUser))) { recoveryUser = null; set('invalid'); }
    },
  };
}
