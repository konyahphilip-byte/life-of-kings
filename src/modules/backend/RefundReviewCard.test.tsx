import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import RefundReviewCard, { type RefundRequest } from './RefundReviewCard';
afterEach(cleanup);
const item: RefundRequest = { id: 'refund-1', order_id: 'order-1', amount_minor: 10000, currency: 'GHS', reason: 'Test customer refund', requester_eco_id: 'customer', payment_status: 'paid', status: 'requested' };
test('requested refunds expose approval and clearly identify test funds', () => {
  const review = vi.fn();
  render(<RefundReviewCard item={item} busy={false} onReview={review} onRecheck={vi.fn()}/>);
  expect(screen.getByText('GHS 100.00 · Test refund')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Staff note'), { target: { value: 'Staff checked this test case.' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Approve test refund' }).closest('form')!);
  expect(review).toHaveBeenCalledWith('approved', expect.any(HTMLFormElement));
});
test('pending refunds have a read-only recheck instead of a repeat submission', () => {
  const recheck = vi.fn();
  render(<RefundReviewCard item={{ ...item, status: 'provider_pending', review_note: 'Needs additional provider information.' }} busy={false} onReview={vi.fn()} onRecheck={recheck}/>);
  expect(screen.queryByRole('button', { name: 'Approve test refund' })).toBeNull();
  expect(screen.getByText('Needs additional provider information.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Recheck with Paystack' }));
  expect(recheck).toHaveBeenCalledOnce();
});
test('uncertain submissions cannot be approved or resubmitted', () => {
  render(<RefundReviewCard item={{ ...item, status: 'approved' }} busy={false} onReview={vi.fn()} onRecheck={vi.fn()}/>);
  expect(screen.getByText('Awaiting reconciliation')).toBeTruthy();
  expect(screen.getByText(/Do not submit another refund/)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
test('recheck is disabled while a request is in flight', () => {
  render(<RefundReviewCard item={{ ...item, status: 'provider_pending' }} busy onReview={vi.fn()} onRecheck={vi.fn()}/>);
  expect((screen.getByRole('button', { name: 'Recheck with Paystack' }) as HTMLButtonElement).disabled).toBe(true);
});
test('provider failure remains reviewable without allowing a new refund submission', () => {
  render(<RefundReviewCard item={{ ...item, status: 'rejected' }} busy={false} onReview={vi.fn()} onRecheck={vi.fn()}/>);
  expect(screen.getByRole('button', { name: 'Recheck with Paystack' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve test refund' })).toBeNull();
});
