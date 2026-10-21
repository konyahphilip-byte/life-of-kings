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

  it('identifies unavailable direct messaging without a fabricated unread count or active composer', async () => {
    render(<App />);
    await screen.findByText('@ama.serwaa');
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:navigate', { detail: 'Messages' })));

    expect(await screen.findByText('Direct messages are not connected')).toBeTruthy();
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
