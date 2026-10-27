import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BackendWorkspace from './BackendWorkspace';
import { createAccountCallback } from '../../lib/auth-callback';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), resend: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() }));
const recovery = vi.hoisted(() => ({ updatePassword: vi.fn(), signOut: vi.fn() }));
const callback = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createAccountCallback> }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth }, get accountCallback() { return callback.current; }, makeRecoveryOperation: (session: {access_token:string;user:{id:string}}) => {
  const ownerId=session.user.id,authorization=`Bearer ${session.access_token}`;let signedOut=false;
  return {ownerId,operationId:'00000000-0000-4000-8000-000000000001',authorization:()=>authorization,dispose:()=>{},get signedOut(){return signedOut;},updatePassword:async(password:string)=>{const result=await recovery.updatePassword(password);if(result?.error)throw result.error;},signOut:async()=>{if(signedOut)return;const result=await recovery.signOut(ownerId);if(result?.error)throw result.error;signedOut=true;}};
}  }));
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
    vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, '', '/');
    callback.current = createAccountCallback(window.location.href);
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signUp.mockResolvedValue(failure('over_email_send_rate_limit', 'email rate limit exceeded'));
    auth.resetPasswordForEmail.mockResolvedValue(failure('over_email_send_rate_limit', 'email rate limit exceeded'));
    auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'synthetic-session-token' } }, error: null });
    auth.resend.mockResolvedValue({ error: null });
    recovery.updatePassword.mockResolvedValue({ error: null });
    recovery.signOut.mockResolvedValue({ error: null });
    auth.refreshSession.mockResolvedValue({data:{session:null},error:null});
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), window.location.origin).pathname;
      const body = path.endsWith('/auth/me') ? { user: null, csrfToken: null }
        : path.endsWith('/auth/supabase/logout') ? { ok: true }
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
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    const form = formFor('Email me a password reset link'); fill(form, 'Email', 'synthetic@example.invalid');
    fireEvent.submit(form);
    expect(await screen.findByText(emailNotice)).toBeTruthy();
    expect(screen.queryByText('If that account exists, a password reset link is on its way.')).toBeNull();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledOnce(); expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('retains password sign-in for an existing confirmed account without sending a signup email', async () => {
    render(<BackendWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    const form = formFor('Sign in'); fill(form, 'Email', 'synthetic@example.invalid'); fill(form, 'Password', 'Synthetic-password-123');
    fireEvent.submit(form);
    expect(await screen.findByRole('heading', { name: 'Synthetic Member' })).toBeTruthy();
    expect(screen.getByText("This search reads public listings and open jobs. Chale's live replies depend on the configured model and its allowance; the App guide remains available.")).toBeTruthy();
    expect(screen.queryByText(/No generative AI model is connected/)).toBeNull();
    expect(auth.signInWithPassword).toHaveBeenCalledOnce(); expect(auth.signUp).not.toHaveBeenCalled(); expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Link Supabase/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect email sign-in' })).toBeNull();
  });

  it('allows a deliberate confirmation resend without promising delivery or revealing account existence', async () => {
    render(<BackendWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    const form = formFor('Resend confirmation email'); fill(form, 'Email', 'synthetic@example.invalid');
    fireEvent.submit(form);
    expect(await screen.findByText('If this address needs confirmation, an email request has been accepted. Check your inbox and spam folder. Delivery is not yet confirmed.')).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'synthetic@example.invalid', options: { emailRedirectTo: window.location.origin } });
    expect(screen.getByRole('button', { name: 'Resend confirmation email' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps a resend failure honest and retains the address', async () => {
    auth.resend.mockResolvedValue(failure('over_email_send_rate_limit', 'email rate limit exceeded'));
    render(<BackendWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    const form = formFor('Resend confirmation email'); fill(form, 'Email', 'synthetic@example.invalid'); fireEvent.submit(form);
    expect(await screen.findByText(emailNotice)).toBeTruthy();
    expect(within(form).getByLabelText('Email').getAttribute('type')).toBe('email');
    expect((within(form).getByLabelText('Email') as HTMLInputElement).value).toBe('synthetic@example.invalid');
  });

  it('does not expose a password form from a URL flag or bridge an unrelated existing session', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-unrelated' } } });
    render(<BackendWorkspace />);
    expect(await screen.findByRole('heading', { name: 'Request a new recovery link' })).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith('/auth/supabase/session'))).toBe(false);
    expect(recovery.updatePassword).not.toHaveBeenCalled();
  });

  it('uses provider recovery proof, checks password confirmation and waits for save acknowledgement', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-recovery', user: { id: 'synthetic-recovery-owner' } } } });
    render(<BackendWorkspace />);
    const form = formFor('Save password and sign out');
    fill(form, 'New password', 'Synthetic-new-password-123'); fill(form, 'Confirm new password', 'Different-password-123'); fireEvent.submit(form);
    expect(await screen.findByText('The passwords do not match.')).toBeTruthy(); expect(recovery.updatePassword).not.toHaveBeenCalled();
    fill(form, 'Confirm new password', 'Synthetic-new-password-123');
    let resolveSave!: (value: unknown) => void;
    recovery.updatePassword.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(recovery.updatePassword).toHaveBeenCalledOnce());
    expect(screen.queryByText('Password updated. Sign in with your new password.')).toBeNull();
    await act(async () => { resolveSave({ error: null }); });
    expect(await screen.findByText('Password updated. Sign in with your new password.')).toBeTruthy();
    expect(recovery.signOut).toHaveBeenCalledOnce();
  });

  it('invalidates the password form immediately after an account change', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    render(<BackendWorkspace />);
    expect(screen.getByLabelText('New password')).toBeTruthy();
    act(() => callback.current.receive('SIGNED_OUT', false));
    expect(screen.queryByLabelText('New password')).toBeNull(); expect(recovery.updatePassword).not.toHaveBeenCalled();
  });

  it('does not claim a password save when the provider rejects it', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-recovery', user: { id: 'synthetic-recovery-owner' } } } });
    recovery.updatePassword.mockResolvedValue({ error: new Error('Synthetic update failure') });
    render(<BackendWorkspace />);
    const form = formFor('Save password and sign out'); fill(form, 'New password', 'Synthetic-new-password-123'); fill(form, 'Confirm new password', 'Synthetic-new-password-123'); fireEvent.submit(form);
    expect(await screen.findByText('Synthetic update failure')).toBeTruthy();
    expect(screen.queryByText('Password updated. Sign in with your new password.')).toBeNull();
    expect(recovery.signOut).not.toHaveBeenCalled();
  });

  it('distinguishes a confirmed password update from an unconfirmed session sign-out', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-recovery', user: { id: 'synthetic-recovery-owner' } } } });
    recovery.signOut.mockResolvedValue({ error: new Error('Synthetic signout failure') });
    render(<BackendWorkspace />);
    const form = formFor('Save password and sign out'); fill(form, 'New password', 'Synthetic-new-password-123'); fill(form, 'Confirm new password', 'Synthetic-new-password-123'); fireEvent.submit(form);
    expect(await screen.findByText('Your password was updated, but sign-out could not be confirmed. Choose Finish signing out to retry.')).toBeTruthy();
    expect(screen.queryByText('Password updated. Sign in with your new password.')).toBeNull();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('restores a linked API session without offering another account link', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ user: identity, csrfToken: 'synthetic-csrf', emailSignInLinked: true }), { status: 200 }));
    render(<BackendWorkspace />);
    expect(await screen.findByRole('heading', { name: 'Synthetic Member' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect email sign-in' })).toBeNull();
  });

  it('returns to ordinary sign-in after cancelling recovery and remounting', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    const view = render(<BackendWorkspace />);
    await screen.findByRole('heading', { name: 'Request a new recovery link' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    view.unmount(); render(<BackendWorkspace />);
    expect(await screen.findByRole('button', { name: 'Create EcoVibes account' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Request a new recovery link' })).toBeNull();
  });

  it('retries only cleanup after an interrupted API sign-out', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-recovery', user: { id: 'synthetic-recovery-owner' } } } });
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).endsWith('/auth/supabase/logout') && ++attempts===1) throw new TypeError('Synthetic interrupted network');
      return Response.json({ ok: true });
    });
    const view = render(<BackendWorkspace />);
    const form = formFor('Save password and sign out'); fill(form, 'New password', 'Synthetic-new-password-123'); fill(form, 'Confirm new password', 'Synthetic-new-password-123'); fireEvent.submit(form);
    expect(await screen.findByText('Your password was updated, but EcoVibes sign-out could not be confirmed. Choose Finish signing out to retry; do not reset the password again.')).toBeTruthy();
    expect(recovery.updatePassword).toHaveBeenCalledOnce(); expect(recovery.signOut).not.toHaveBeenCalled();
    view.unmount(); render(<BackendWorkspace />);
    expect(screen.queryByLabelText('New password')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish signing out' }));
    expect(await screen.findByText('Password updated. Sign in with your new password.')).toBeTruthy();
    expect(recovery.updatePassword).toHaveBeenCalledOnce(); expect(attempts).toBe(2);
    const cleanupBodies=vi.mocked(fetch).mock.calls.filter(([input])=>String(input).endsWith('/auth/supabase/logout')).map(([,options])=>JSON.parse(String(options?.body)));
    expect(cleanupBodies).toEqual([{operationId:'00000000-0000-4000-8000-000000000001'},{operationId:'00000000-0000-4000-8000-000000000001'}]);
    expect(callback.current.requested).toBe(false);
    cleanup(); render(<BackendWorkspace />);
    expect(screen.queryByRole('heading', { name: 'Choose a new password' })).toBeNull();
  });

  it('continues token-bound cleanup for the original account after another account signs in', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-recovery', user: { id: 'synthetic-recovery-owner' } } } });
    recovery.signOut.mockResolvedValue({ error: new Error('Synthetic provider failure') });
    render(<BackendWorkspace />);
    const form=formFor('Save password and sign out');fill(form,'New password','Synthetic-new-password-123');fill(form,'Confirm new password','Synthetic-new-password-123');fireEvent.submit(form);
    await screen.findByText('Your password was updated, but sign-out could not be confirmed. Choose Finish signing out to retry.');
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'synthetic-other' }, access_token: 'synthetic-other-session' } } });
    act(()=>callback.current.receive('SIGNED_IN',true,'synthetic-other'));
    fireEvent.click(screen.getByRole('button',{name:'Finish signing out'}));
    await waitFor(()=>expect(recovery.signOut).toHaveBeenCalledTimes(2));
    expect(recovery.signOut.mock.calls.every(([owner])=>owner==='synthetic-recovery-owner')).toBe(true);expect(auth.signOut).not.toHaveBeenCalled();expect(recovery.updatePassword).toHaveBeenCalledOnce();
  });

  it('refuses to save a password when the provider session belongs to another account', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current = createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY', true, 'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'synthetic-other' }, access_token: 'synthetic-other-session' } } });
    render(<BackendWorkspace />);
    const form=formFor('Save password and sign out');fill(form,'New password','Synthetic-new-password-123');fill(form,'Confirm new password','Synthetic-new-password-123');fireEvent.submit(form);
    expect(await screen.findByText('Your recovery session has expired or changed accounts. Request a new link.')).toBeTruthy();
    expect(recovery.updatePassword).not.toHaveBeenCalled();expect(recovery.signOut).not.toHaveBeenCalled();
  });

  it('retains an acknowledged password save when accounts change while the provider request is pending', async () => {
    window.history.replaceState({}, '', '/?recovery=1'); callback.current=createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY',true,'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({data:{session:{user:{id:'synthetic-recovery-owner'},access_token:'synthetic-recovery'}}});
    let finishSave!: (value:unknown)=>void;
    recovery.updatePassword.mockImplementation(()=>new Promise(resolve=>{finishSave=resolve;}));
    render(<BackendWorkspace />);
    const form=formFor('Save password and sign out');fill(form,'New password','Synthetic-new-password-123');fill(form,'Confirm new password','Synthetic-new-password-123');fireEvent.submit(form);
    await waitFor(()=>expect(recovery.updatePassword).toHaveBeenCalledOnce());
    auth.getSession.mockResolvedValue({data:{session:{user:{id:'synthetic-other'},access_token:'synthetic-other-session'}}});
    act(()=>callback.current.receive('SIGNED_IN',true,'synthetic-other'));
    await act(async()=>{finishSave({error:null});});
    expect(await screen.findByText('Password updated. Sign in with your new password.')).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(screen.queryByText(/your password has not been changed/)).toBeNull();
    expect(recovery.signOut).toHaveBeenCalledWith('synthetic-recovery-owner');expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('leaves recovery when an old cleanup handler completes after the screen remounts', async()=>{
    window.history.replaceState({},'','/?recovery=1');callback.current=createAccountCallback(window.location.href);
    callback.current.receive('PASSWORD_RECOVERY',true,'synthetic-recovery-owner');
    auth.getSession.mockResolvedValue({data:{session:{user:{id:'synthetic-recovery-owner'},access_token:'synthetic-recovery'}}});
    let finishCleanup!:(value:Response)=>void;
    const prior=vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input,init)=>String(input).endsWith('/auth/supabase/logout')?new Promise(resolve=>{finishCleanup=resolve;}):prior(input,init));
    const view=render(<BackendWorkspace />);
    const form=formFor('Save password and sign out');fill(form,'New password','Synthetic-new-password-123');fill(form,'Confirm new password','Synthetic-new-password-123');fireEvent.submit(form);
    await waitFor(()=>expect(finishCleanup).toBeTypeOf('function'));
    view.unmount();render(<BackendWorkspace />);
    await act(async()=>{finishCleanup(Response.json({ok:true}));});
    expect(await screen.findByRole('button',{name:'Create EcoVibes account'})).toBeTruthy();
    expect(screen.queryByText('Verifying the link…')).toBeNull();
  });
});
