import { describe, expect, it } from 'vitest';
import { accountEmailError } from './auth-errors';

describe('account email error guidance', () => {
  it('maps email quota by exact provider code and omits raw provider details', () => {
    const raw = Object.assign(new Error('Synthetic private provider detail'), { code: 'over_email_send_rate_limit', status: 429 });
    const result = accountEmailError(raw);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('cannot send account emails right now');
    expect((result as Error).message).not.toContain('Synthetic private provider detail');
    expect((result as Error).message).not.toMatch(/\d+ (seconds|minutes|hours)/);
  });
  it('maps restricted delivery without claiming the address or account is invalid', () => {
    const result = accountEmailError({ code: 'email_address_not_authorized', message: 'Synthetic recipient-specific detail' });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Account email delivery is not available yet. Please contact EcoVibes support. Existing confirmed accounts can still sign in.');
  });
  it.each([null, undefined, 'email rate limit exceeded', 429, [], { code: ['over_email_send_rate_limit'] }, { code: 'over_request_rate_limit', status: 429 }])('preserves unrelated or malformed errors (%j)', error => {
    expect(accountEmailError(error)).toBe(error);
  });
  it('does not reinterpret credential errors or message text as an email quota', () => {
    const error = Object.assign(new Error('email rate limit exceeded'), { code: 'invalid_credentials' });
    expect(accountEmailError(error)).toBe(error);
  });
});
