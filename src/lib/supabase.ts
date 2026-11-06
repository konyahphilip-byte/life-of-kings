import { createClient, type Session } from '@supabase/supabase-js';
import { createAccountCallback } from './auth-callback';
import { createRecoveryOperation } from './recovery-operation';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const accountCallback = createAccountCallback(window.location.href);
export function makeRecoveryOperation(session:Session){
  if(!url||!publishableKey)throw new Error('Account recovery is unavailable.');
  return createRecoveryOperation({url,publishableKey,session});
}

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
      },
    })
  : null;

// Subscribe before React mounts: PKCE initialization can finish before the
// recovery screen opens. Never await Auth calls inside this callback.
supabase?.auth.onAuthStateChange((event, session) => {
  accountCallback.receive(event, Boolean(session), session?.user.id);
});
