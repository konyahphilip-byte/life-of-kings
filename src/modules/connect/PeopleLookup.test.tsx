import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PeopleLookup from './PeopleLookup';

const person = { id: 'peer', eco_id: 'philip_konyah', display_name: 'Philip', followed: false, followsYou: false };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('verified public ID lookup', () => {
  it('requires sign-in and never queries profiles for a guest', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<PeopleLookup userId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/Sign in to find an EcoVibes ID/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('selects only a returned profile and preserves its exact public ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ person }))));
    const select = vi.fn(); render(<PeopleLookup userId="caller" onSelect={select} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@Philip_konyah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find person' }));
    await screen.findByText('@philip_konyah');
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Select Philip' }));
    expect(select).toHaveBeenCalledWith(person);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('/api/v1/people/lookup?ecoId=%40Philip_konyah');
    expect(options?.credentials).toBe('include');
  });
  it('clears a previous result when the query changes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ person }))));
    render(<PeopleLookup userId="caller" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'philip_konyah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find person' })); await screen.findByText('@philip_konyah');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'akonyah' } });
    expect(screen.queryByRole('button', { name: 'Select Philip' })).toBeNull();
  });
  it('ignores a late response after an account change', async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
    const view = render(<PeopleLookup userId="caller" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'philip_konyah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find person' }));
    view.rerender(<PeopleLookup userId={null} onSelect={vi.fn()} />);
    await act(async () => resolve(new Response(JSON.stringify({ person }))));
    expect(screen.queryByText('@philip_konyah')).toBeNull();
  });
  it('shows unavailable and missing results without allowing an invented recipient', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ person: null }))));
    render(<PeopleLookup userId="caller" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not.present' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find person' }));
    await screen.findByText(/No other active account matches/);
    expect(screen.queryByRole('button', { name: /^Select/ })).toBeNull();
  });
});
