import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./HomeDepth', () => ({ default: () => null }));
vi.mock('./Communications', () => ({ default: () => null }));
vi.mock('./assistant/Sidekick', () => ({ default: () => null }));
vi.mock('./backend/BackendWorkspace', () => ({ default: () => <div>Account workspace test surface</div> }));
vi.mock('./SocialHub', () => ({
  PeopleToFollow: () => null,
  ReelsPage: () => null,
  StoriesStrip: () => null,
}));

const identity = {
  id: 'user-1',
  eco_id: 'ama.serwaa',
  display_name: 'Ama Serwaa',
  roles: ['customer'],
};

describe('EcoVibes ID app-shell integration', () => {
  let signedIn = true;

  beforeEach(() => {
    signedIn = true;
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), window.location.origin).pathname;
      if (path.endsWith('/auth/me')) {
        return new Response(JSON.stringify({ user: signedIn ? identity : null, csrfToken: signedIn ? 'csrf-token' : null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if(path.endsWith('/connect/messages'))return Response.json({ownerId:identity.id,friends:[],truncated:false});
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the authenticated EcoVibes ID in the greeting, sidebar and profile', async () => {
    render(<App />);

    expect(await screen.findByText('Ama Serwaa')).toBeTruthy();
    expect(screen.getByText('@ama.serwaa')).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Profile' })));

    expect(await screen.findByRole('heading', { name: 'Ama Serwaa' })).toBeTruthy();
    expect(screen.getByText('@ama.serwaa · EcoVibes ID connected')).toBeTruthy();
    expect(screen.queryByText('Philip Konyah')).toBeNull();
  });

  it('refreshes the shared identity after sign-out', async () => {
    render(<App />);
    await screen.findByText('@ama.serwaa');

    signedIn = false;
    act(() => window.dispatchEvent(new Event('ecovibes:identity_changed')));

    await waitFor(() => expect(screen.getByText('Create your EcoVibes ID')).toBeTruthy());
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Profile' })));
    expect(await screen.findByRole('heading', { name: 'Guest preview' })).toBeTruthy();
  });

  it('ignores an older account response arriving after a newer sign-out', async () => {
    let resolveOld!: (value: Response) => void;
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me') && ++reads === 1) return new Promise<Response>(resolve => { resolveOld = resolve; });
      return new Response(JSON.stringify({ user: null, csrfToken: null }));
    }));
    render(<App />);
    await act(async () => { window.dispatchEvent(new Event('ecovibes:identity_changed')); });
    expect(screen.getByText('Create your EcoVibes ID')).toBeTruthy();
    // Deliberately ignore AbortSignal to exercise a response already in flight.
    await act(async () => { resolveOld(new Response(JSON.stringify({ user: identity, csrfToken: 'old-csrf' }))); });
    expect(screen.queryByText('@ama.serwaa')).toBeNull();
    expect(screen.getByText('Create your EcoVibes ID')).toBeTruthy();
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toEqual([]);
  });

  it('clears the previous identity while an account-change confirmation is pending', async () => {
    render(<App />);
    await screen.findByText('@ama.serwaa');
    let resolveCurrent!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveCurrent = resolve; })));
    act(() => window.dispatchEvent(new Event('ecovibes:identity_changed')));
    expect(screen.queryByText('@ama.serwaa')).toBeNull();
    expect(screen.getByText('Create your EcoVibes ID')).toBeTruthy();
    await act(async () => { resolveCurrent(new Response(JSON.stringify({ user: null, csrfToken: null }))); });
    expect(screen.queryByText('@ama.serwaa')).toBeNull();
  });

  it('ignores a prior page response after a newer page confirms sign-out', async () => {
    let resolveOld!: (value: Response) => void;
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me') && ++reads === 1) return new Promise<Response>(resolve => { resolveOld = resolve; });
      return new Response(JSON.stringify({ user: null, csrfToken: null }));
    }));
    render(<App />);
    await act(async () => { window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Profile' })); });
    expect(screen.getByRole('heading', { name: 'Guest preview' })).toBeTruthy();
    await act(async () => { resolveOld(new Response(JSON.stringify({ user: identity, csrfToken: 'old-csrf' }))); });
    expect(screen.getByRole('heading', { name: 'Guest preview' })).toBeTruthy();
    expect(screen.queryByText('@ama.serwaa · EcoVibes ID connected')).toBeNull();
  });

  it('retains the newest identity when visibility refresh responses arrive out of order', async () => {
    let resolveOld!: (value: Response) => void;
    let reads = 0;
    const newest = { ...identity, id: 'user-2', eco_id: 'kojo.test', display_name: 'Kojo Test' };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        if (++reads === 1) return new Promise<Response>(resolve => { resolveOld = resolve; });
        return new Response(JSON.stringify({ user: newest, csrfToken: 'new-csrf' }));
      }
      return new Response(JSON.stringify({}));
    }));
    render(<App />);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(screen.getByText('@kojo.test')).toBeTruthy();
    const oldSignal = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith('/auth/me'))?.[1]?.signal;
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { resolveOld(new Response(JSON.stringify({ user: identity, csrfToken: 'old-csrf' }))); });
    expect(screen.getByText('@kojo.test')).toBeTruthy();
    expect(screen.queryByText('@ama.serwaa')).toBeNull();
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(new Headers(writes[0][1]?.headers).get('X-CSRF-Token')).toBe('new-csrf');
  });

  it('aborts an unmounted identity request and never publishes its late presence', async () => {
    let resolveOld!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveOld = resolve; })));
    const view = render(<App />);
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolveOld(new Response(JSON.stringify({ user: identity, csrfToken: 'old-csrf' }))); });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toEqual([]);
  });

  it('opens the signed-in friend inbox without fabricated counts or an unauthorized composer', async () => {
    render(<App />);
    await screen.findByText('@ama.serwaa');
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Messages' })));

    expect(await screen.findByText('Accept a friend request in Calls & Live to start a private conversation.')).toBeTruthy();
    expect(document.querySelector('.nav-count')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Write a message' })).toBeNull();
    expect(screen.queryByText('Esi Owusu')).toBeNull();
  });

  it('opens the existing authorized job-conversation workspace from Messages', async () => {
    render(<App />);
    await screen.findByText('@ama.serwaa');
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Messages' })));
    fireEvent.click(await screen.findByRole('button', { name: 'Open job conversations' }));

    expect(await screen.findByText('Account workspace test surface')).toBeTruthy();
    expect(sessionStorage.getItem('ecovibes:workspace-area')).toBe('jobs');
  });
});
