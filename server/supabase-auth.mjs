import { createContextClient, verifyAuth } from '@supabase/server/core';

/** Verify a Supabase access token and fetch its authoritative user record. */
export async function authenticateSupabaseRequest(incomingRequest) {
  const projectUrl = process.env.SUPABASE_URL;
  if (!projectUrl) {
    return { user: null, error: { status: 503, code: 'supabase_not_configured', message: 'Supabase Auth is not configured.' } };
  }

  const headers = new Headers();
  const authorization = incomingRequest.headers.authorization;
  if (typeof authorization === 'string') headers.set('Authorization', authorization);

  const request = new Request(new URL(incomingRequest.url || '/', projectUrl), { headers });
  const issuer = `${projectUrl.replace(/\/+$/, '')}/auth/v1`;
  const { data: auth, error } = await verifyAuth(request, { auth: 'user', issuer });
  if (error) return { user: null, error };

  try {
    const supabase = createContextClient({ auth: { token: auth.token, keyName: auth.keyName } });
    const { data, error: userError } = await supabase.auth.getUser(auth.token);
    if (userError) return { user: null, error: userError };
    return { user: data.user, error: null };
  } catch (clientError) {
    return {
      user: null,
      error: {
        status: 503,
        code: 'supabase_client_unavailable',
        message: clientError instanceof Error ? clientError.message : 'Supabase client unavailable.',
      },
    };
  }
}
