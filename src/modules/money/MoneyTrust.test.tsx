import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MoneyTrust, { formatMinor } from './MoneyTrust';
const props = { userId: 'owner', onSignIn: vi.fn(), onSupport: vi.fn(), onAskAI: vi.fn() };
const empty = { generatedAt: '2026-10-09T10:00:00Z', activity: [], excludedRecords: 0, truncated: false, totals: [], completedServiceJobs: 0, recordedPaidSalesOrders: 0, limitations: ['Test records only.'] };
const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
test('requires sign-in and does not fetch private data for guests', () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  render(<MoneyTrust {...props} userId={null}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Eco ID' }));
  expect(props.onSignIn).toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});
test('shows source limitations without invented funds', async () => {
  vi.stubGlobal('fetch', vi.fn(() => reply(empty)));
  render(<MoneyTrust {...props}/>);
  expect(await screen.findByText('No confirmed test-payment totals')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trust Passport' }));
  expect(screen.getByText(/No certified report or lending score/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Send money' })).toBeNull();
});
test('reports a failed request and can retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => reply({ error: { message: 'Session expired.' } }, 401)).mockImplementation(() => reply(empty)));
  render(<MoneyTrust {...props}/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Session expired');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No confirmed test-payment totals')).toBeTruthy();
});
test('ignores delayed responses from the previous account', async () => {
  let finish: (value: Response) => void = () => {};
  const old = new Promise<Response>(resolve => { finish = resolve; });
  const fetcher = vi.fn().mockReturnValueOnce(old).mockImplementation(() => reply(empty));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<MoneyTrust {...props}/>);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  view.rerender(<MoneyTrust {...props} userId="other"/>);
  await screen.findByText('No confirmed test-payment totals');
  finish(new Response(JSON.stringify({ ...empty, completedServiceJobs: 987 })));
  await waitFor(() => expect(screen.getByText('0 completed service jobs')).toBeTruthy());
  expect(screen.queryByText('987 completed service jobs')).toBeNull();
});
test('formats large exact values without floating-point rounding', () => {
  expect(formatMinor('900719925474099101', 'GHS')).toBe('GHS 9,007,199,254,740,991.01');
});
test('uses each currency’s minor-unit scale without performing currency conversion', () => {
  expect(formatMinor('1500', 'JPY')).toBe('JPY 1,500');
  expect(formatMinor('1500', 'TND')).toBe('TND 1.500');
  expect(formatMinor('1500', 'GHS')).toBe('GHS 15.00');
  expect(formatMinor('15.5', 'GHS')).toBe('Amount unavailable');
});
