import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./HomeDepth', () => ({ default: () => null }));
vi.mock('./Communications', () => ({ default: () => null }));
vi.mock('./assistant/Sidekick', () => ({ default: () => null }));
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
});
