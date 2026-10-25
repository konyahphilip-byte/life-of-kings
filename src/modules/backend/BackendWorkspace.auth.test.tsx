import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BackendWorkspace from './BackendWorkspace';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }));
const identity = { id: 'synthetic-member', eco_id: 'synthetic.member', display_name: 'Synthetic Member', roles: ['customer'], created_at: '2026-10-01T00:00:00Z' };
const failure = (code: string, message: string) => ({ data: { session: null }, error: Object.assign(new Error(message), { code, status: 429 }) });
const emailNotice = 'EcoVibes cannot send account emails right now. Please wait before requesting another email. If you already confirmed your account, choose Sign in.';

function formFor(button: string) {
  const form = screen.getByRole('button', { name: button }).closest('form');
  if (!form) throw Error('Missing form');
  return form;
}
function fill(form: HTMLElement, name: string | RegExp, value: string) {
  fireEvent.change(within(form).getByLabelText(name), { target: { value } });
}

describe('account email availability guidance', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signUp.mockResolvedValue(failure('over_email_send_rate_limit', 'email rate limit exceeded'));
    auth.resetPasswordForEmail.mockResolvedValue(failure('over_email_send_rate_limit', 'email rate limit exceeded'));
    auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'synthetic-session-token' } }, error: null });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), window.location.origin).pathname;
      const body = path.endsWith('/auth/me') ? { user: null, csrfToken: null }
        : path.endsWith('/auth/supabase/session') ? { user: identity, csrfToken: 'synthetic-csrf', created: false, linked: false, assuranceLevel: 'aal1' } : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('explains a blocked confirmation without claiming an email was sent or starting a session', async () => {
    render(<BackendWorkspace />);
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledOnce());
    const form = formFor('Create EcoVibes account');
    fill(form, 'Display name', 'Synthetic Member'); fill(form, /EcoVibes ID/, 'synthetic.member');
    fill(form, 'Email', 'synthetic@example.invalid'); fill(form, 'Password', 'Synthetic-password-123');
    fireEvent.submit(form);
    expect(await screen.findByText(emailNotice)).toBeTruthy();
    expect(screen.queryByText('email rate limit exceeded')).toBeNull();
    expect(screen.queryByText('Check your email to confirm the account, then sign in here.')).toBeNull();
    expect(auth.signUp).toHaveBeenCalledOnce(); expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith('/auth/supabase/session'))).toBe(false);
  });

  it('explains blocked recovery without reporting successful email delivery', async () => {
    render(<BackendWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have a Supabase account? Sign in' }));
    const form = formFor('Email me a password reset link'); fill(form, 'Email', 'synthetic@example.invalid');
    fireEvent.submit(form);
    expect(await screen.findByText(emailNotice)).toBeTruthy();
    expect(screen.queryByText('If that account exists, a password reset link is on its way.')).toBeNull();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledOnce(); expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('retains password sign-in for an existing confirmed account without sending a signup email', async () => {
    render(<BackendWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have a Supabase account? Sign in' }));
    const form = formFor('Sign in with Supabase'); fill(form, 'Email', 'synthetic@example.invalid'); fill(form, 'Password', 'Synthetic-password-123');
    fireEvent.submit(form);
    expect(await screen.findByRole('heading', { name: 'Synthetic Member' })).toBeTruthy();
    expect(screen.getByText("This search reads public listings and open jobs. Chale's live replies depend on the configured model and its allowance; the App guide remains available.")).toBeTruthy();
    expect(screen.queryByText(/No generative AI model is connected/)).toBeNull();
    expect(auth.signInWithPassword).toHaveBeenCalledOnce(); expect(auth.signUp).not.toHaveBeenCalled(); expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
