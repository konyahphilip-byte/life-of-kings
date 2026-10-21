import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConnectInbox from './ConnectInbox';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('EcoVibes Connect availability', () => {
  it('explains the unavailable inbox and offers the existing job workspace', () => {
    const onOpenJobs = vi.fn();
    render(<ConnectInbox onOpenJobs={onOpenJobs}/>);
    expect(screen.getByText('Direct messages are not connected')).toBeTruthy();
    expect(screen.queryByText('Esi Owusu')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open job conversations' }));
    expect(onOpenJobs).toHaveBeenCalledOnce();
  });

  it('keeps sample conversations explicit and read-only without making network requests', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<ConnectInbox onOpenJobs={vi.fn()}/>);
    const toggle = screen.getByRole('button', { name: 'View sample conversations' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('region', { name: 'Read-only messaging sample' })).toBeTruthy();
    expect(screen.getByText('Read-only sample.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Sample message (sending unavailable)' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send sample message (unavailable)' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No message has been sent or received.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hide sample conversations' }));
    expect(screen.queryByRole('region', { name: 'Read-only messaging sample' })).toBeNull();
  });

  it('labels selected examples as fictional instead of claiming presence or delivery', () => {
    render(<ConnectInbox onOpenJobs={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'View sample conversations' }));
    fireEvent.click(screen.getByRole('button', { name: /Ama Serwaa/ }));
    expect(screen.getByRole('region', { name: 'Sample conversation with Ama Serwaa' })).toBeTruthy();
    expect(screen.getByText('Fictional conversation')).toBeTruthy();
    expect(screen.queryByText('Active recently')).toBeNull();
    expect(screen.queryByText('Message sent')).toBeNull();
  });
});
