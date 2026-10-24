// Preserve unrelated Auth errors. Email failures must not imply that a message
// was delivered, an account exists, or the provider's quota has already reset.
export function accountEmailError(error: unknown): unknown {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return error;
  const code = (error as { code?: unknown }).code;
  if (code === 'over_email_send_rate_limit') {
    return new Error('EcoVibes cannot send account emails right now. Please wait before requesting another email. If you already confirmed your account, choose Sign in.');
  }
  if (code === 'email_address_not_authorized') {
    return new Error('Account email delivery is not available yet. Please contact EcoVibes support. Existing confirmed accounts can still sign in.');
  }
  return error;
}
