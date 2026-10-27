import { describe, expect, it } from 'vitest';
import { createAccountCallback } from './auth-callback';

describe('account recovery callback proof', () => {
  it('never treats a URL flag or an ordinary existing session as recovery permission', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1');
    expect(state.getSnapshot()).toBe('checking');
    state.receive('INITIAL_SESSION', true);
    state.receive('SIGNED_IN', true);
    state.finishCheck();
    expect(state.getSnapshot()).toBe('invalid');
  });
  it('accepts only the provider recovery event with a session and clears on account change', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1&code=synthetic');
    state.receive('PASSWORD_RECOVERY', false);
    expect(state.getSnapshot()).not.toBe('ready');
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    expect(state.getSnapshot()).toBe('ready');
    state.finishCheck();
    expect(state.getSnapshot()).toBe('ready');
    state.receive('SIGNED_IN', true, 'synthetic-owner');
    expect(state.getSnapshot()).toBe('ready');
    state.receive('SIGNED_IN', true, 'synthetic-other');
    expect(state.getSnapshot()).toBe('invalid');
  });
  it('does not echo untrusted provider errors or accept a failed callback', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1#error=access_denied&error_description=private-value');
    expect(state.getSnapshot()).toBe('invalid');
    expect(state.error).toBe('This account link is invalid or has expired. Request a new link below.');
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    expect(state.getSnapshot()).toBe('invalid');
    expect(JSON.stringify(state)).not.toContain('private-value');
  });
  it('notifies subscribers and never places recovery state in browser storage', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1');
    let notifications = 0;
    const unsubscribe = state.subscribe(() => notifications++);
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    unsubscribe();
    state.receive('SIGNED_OUT', false);
    expect(notifications).toBe(1);
    expect(state.getSnapshot()).toBe('invalid');
  });
  it('consumes the callback when leaving recovery so a remount restores ordinary account flow', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1&code=synthetic');
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    expect(state.matchesUser('synthetic-other')).toBe(false);
    expect(state.matchesUser('synthetic-owner')).toBe(true);
    state.clear();
    expect(state.requested).toBe(false);
    expect(state.openAccount).toBe(false);
    expect(state.getSnapshot()).toBe('idle');
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    expect(state.getSnapshot()).toBe('idle');
  });
  it('retains confirmed password and API cleanup phases across screen remounts', () => {
    const state = createAccountCallback('https://example.invalid/?recovery=1');
    state.receive('PASSWORD_RECOVERY', true, 'synthetic-owner');
    state.markPasswordSaved('synthetic-owner');
    expect(state.getSnapshot()).toBe('saved');
    state.markApiRevoked();
    state.receive('SIGNED_IN', true, 'synthetic-other');
    expect(state.getSnapshot()).toBe('saved');
    expect(state.matchesUser('synthetic-other')).toBe(false);
    expect(state.apiRevoked).toBe(true);
  });
});
