// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagnoseEcovibesIssue } from './chale-diagnostics.mjs';
import { APP_GUIDE_VERSION, CHALE_GUIDE } from './chale-guide.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('deterministic EcoVibes diagnostics', () => {
  it('distinguishes configuration evidence from a verified call operation', () => {
    const result = diagnoseEcovibesIssue('My call will not start', 'Calls & Live', { liveKitConfigured: true, signedIn: true });
    expect(result).toMatchObject({ category: 'provider', outcome: 'guidance_only', guideVersion: APP_GUIDE_VERSION, destination: 'Calls & Live' });
    expect(result.checks[0]).toMatchObject({ label: 'LiveKit configuration', status: 'ready' });
    expect(result.checks[0].detail).toMatch(/configuration evidence only/);
    expect(result.checks.some((check) => check.status === 'unknown' && /No room was created/.test(check.detail))).toBe(true);
  });

  it('treats missing, nonboolean and inherited capability flags as unknown', () => {
    const result = diagnoseEcovibesIssue('Call problem', 'Home', Object.assign(Object.create({ liveKitConfigured: true }), { signedIn: 'true', learningEnabled: 1 }));
    expect(result.checks.find((check) => check.label === 'LiveKit configuration')?.status).toBe('unknown');
    expect(result.checks.find((check) => check.label === 'Sign-in session')?.status).toBe('unknown');
    const disabled = diagnoseEcovibesIssue('Call problem', 'Home', { liveKitConfigured: false, signedIn: false });
    expect(disabled.checks.slice(0, 2).every((check) => check.status === 'needs_setup')).toBe(true);
  });

  it('keeps paused learning a valid choice and ignores learning flags without an authenticated session', () => {
    const paused = diagnoseEcovibesIssue('Recommendation learning', 'Home', { signedIn: true, learningEnabled: false });
    expect(paused.checks.find((check) => check.label === 'Personalization choice')).toMatchObject({ status: 'ready', detail: expect.stringContaining('Keep it paused') });
    const guest = diagnoseEcovibesIssue('Recommendation learning', 'Home', { signedIn: false, learningEnabled: true });
    expect(guest.checks.find((check) => check.label === 'Personalization choice')?.status).toBe('unknown');
    expect(JSON.stringify(guest)).not.toContain('personalization enabled');
  });

  it('does not infer staff approval, listing or role access from sign-in or unknown flags', () => {
    const result = diagnoseEcovibesIssue('My provider profile is not approved', 'Quick&Handi', { signedIn: true, approved: true, roles: ['staff'], providerId: 'private-provider-sentinel' });
    expect(result.title).toMatch(/service-provider onboarding/);
    expect(result.checks.filter((check) => check.label !== 'Sign-in session').every((check) => check.status === 'unknown')).toBe(true);
    expect(result.guideIds).toContain('provider-onboarding');
    expect(JSON.stringify(result)).not.toContain('private-provider-sentinel');
    expect(diagnoseEcovibesIssue('I cannot send collection offers', 'Waste', { signedIn: true }).title).toMatch(/service-provider onboarding/);
  });

  it('keeps Wallet availability separate from configured test checkout and never confirms money', () => {
    const result = diagnoseEcovibesIssue('Payment problem', 'Wallet', { paymentsTestConfigured: true, signedIn: true, balance: 50000, paymentConfirmed: true });
    expect(result.guideIds).toEqual(['wallet', 'marketplace']);
    expect(result.checks.find((check) => check.label === 'Paystack test configuration')?.detail).toMatch(/live operation has not been verified/);
    expect(result.checks.find((check) => check.label === 'Payment and funds')?.status).toBe('unknown');
    expect(JSON.stringify(result)).not.toContain('50000');
  });

  it('routes disputes to support without inspecting or changing private records', () => {
    const result = diagnoseEcovibesIssue('Refund for my Marketplace order', 'Marketplace', { signedIn: true, paymentId: 'private-payment-sentinel', disputeResolved: true });
    expect(result).toMatchObject({ category: 'dispute', destination: 'EcoVibes ID', outcome: 'guidance_only' });
    expect(result.guideIds).toEqual(['support', 'marketplace']);
    expect(result.checks.find((check) => check.label === 'Resolution status')).toMatchObject({ status: 'unknown', detail: expect.stringContaining('No report, refund or resolution has been submitted') });
    expect(JSON.stringify(result)).not.toContain('private-payment-sentinel');
  });

  it('performs no network test and does not turn a timeout into a confirmed outage', () => {
    const fetch = vi.fn(() => { throw new Error('Diagnostic must not access the network'); });
    vi.stubGlobal('fetch', fetch);
    const result = diagnoseEcovibesIssue('Waste page connection timed out', 'Waste', { liveKitConfigured: true });
    expect(result.category).toBe('network');
    expect(result.guideIds[0]).toBe('waste');
    expect(result.checks.find((check) => check.label === 'API and provider health')?.status).toBe('unknown');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bounds the symptom, never echoes it and keeps unknown issues uncertain', () => {
    const symptom = `${'x'.repeat(120)} refund private-input-sentinel`;
    const result = diagnoseEcovibesIssue(symptom, 'javascript:alert(1)', { aiConfigured: true, secret: 'private-key-sentinel' });
    expect(result).toMatchObject({ category: 'unknown', destination: 'Home' });
    expect(result.checks.some((check) => check.label === 'Cause of the issue' && check.status === 'unknown')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('sentinel');
    expect(diagnoseEcovibesIssue({ toString: () => { throw new Error('Do not coerce arbitrary objects'); } }, null, null).category).toBe('unknown');
  });

  it('returns only canonical guide identifiers and a matching allowlisted destination for every route', () => {
    const known = new Map(CHALE_GUIDE.entries.map((guide) => [guide.id, guide]));
    for (const [symptom, page] of [['Sign in failed', 'Home'], ['Reel upload problem', 'Reels'], ['Shopify import problem', 'Marketplace'], ['Chale answer problem', 'Home'], ['Open Waste', 'Home'], ['My service review', 'Waste'], ['Unknown symptom', 'Gaming']]) {
      const result = diagnoseEcovibesIssue(symptom, page, {});
      expect(result.guideIds.length).toBeGreaterThan(0);
      expect(result.guideIds.length).toBeLessThanOrEqual(3);
      expect(result.guideIds.every((id) => known.has(id))).toBe(true);
      expect(result.destination).toBe(known.get(result.guideIds[0]).destination);
      expect(result.checks.length).toBeLessThanOrEqual(4);
      expect(result.checks.every((check) => ['ready', 'needs_setup', 'unknown'].includes(check.status))).toBe(true);
    }
  });

  it('is deterministic and does not mutate supplied state', () => {
    const capabilities = Object.freeze({ aiConfigured: false, signedIn: false, learningEnabled: false });
    const first = diagnoseEcovibesIssue('Chale does not answer', 'Home', capabilities);
    expect(diagnoseEcovibesIssue('Chale does not answer', 'Home', capabilities)).toEqual(first);
    expect(capabilities).toEqual({ aiConfigured: false, signedIn: false, learningEnabled: false });
  });
});
