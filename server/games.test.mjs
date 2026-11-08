import { describe, expect, it } from 'vitest';
import { GAME_CATALOG, queryGames, validateGameManifest } from './games.mjs';

describe('Games roadmap catalog', () => {
  it('never presents an unshipped game as playable or priced', () => {
    expect(queryGames().games).toHaveLength(7);
    expect(GAME_CATALOG.every(game => !game.playable && game.releaseVersion === null && game.downloadBytes === null)).toBe(true);
  });
  it('filters title/category and returns a real empty result', () => {
    expect(queryGames(new URLSearchParams('q=accra&category=Racing')).games[0].id).toBe('rumble-rush');
    expect(queryGames(new URLSearchParams('q=oware')).games[0].id).toBe('oware');
    expect(queryGames(new URLSearchParams('q=missing')).games).toEqual([]);
  });
  it.each(['userId=other', 'q=a&q=b', 'category=Casino', `q=${'x'.repeat(81)}`])('rejects unsupported filters %s', query => {
    expect(() => queryGames(new URLSearchParams(query))).toThrow();
  });
});

const manifest = { schemaVersion: 1, gameId: 'rumble-rush', buildId: 'm1-001', runtime: 'godot-web-single-thread',
  entryUrl: 'https://games.example.org/rumble-rush/m1-001/index.html', sha256: 'a'.repeat(64), downloadBytes: 50_000_000, capabilities: ['practice'] };
const approval = { ...manifest, status: 'approved', expiresAt: '2027-01-01T00:00:00Z' };
const policy = { allowedOrigins: ['https://games.example.org'], appOrigins: ['https://app.example.com'],
  approvedReleases: [approval], now: Date.parse('2026-10-12T00:00:00Z') };
describe('Practice manifest gate', () => {
  it('accepts only a matching independently approved build and freezes the returned scopes', () => {
    const result = validateGameManifest(manifest, policy);
    expect(result).toEqual(manifest); expect(Object.isFrozen(result.capabilities)).toBe(true);
  });
  it.each([
    { schemaVersion: 2 }, { gameId: ['rumble-rush'] }, { buildId: '../escape' }, { runtime: 'apk' },
    { downloadBytes: -1 }, { downloadBytes: 100_000_001 }, { downloadBytes: 1.2 }, { sha256: 'fake' },
    { capabilities: ['practice', 'payments'] }, { capabilities: ['identity'] }, { capabilities: ['score.write'] },
    { entryUrl: 'javascript:alert(1)' }, { entryUrl: 'https://games.example.org.evil.com/rumble-rush/m1-001/index.html' },
    { entryUrl: 'https://user:pass@games.example.org/rumble-rush/m1-001/index.html' },
    { entryUrl: `${manifest.entryUrl}?token=private` }, { entryUrl: `${manifest.entryUrl}#private` },
    { entryUrl: 'https://games.example.org/rumble-rush/m1-001/../m1-001/index.html' },
    { entryUrl: 'https://games.example.org/rumble-rush/m1-001/%69ndex.html' },
    { entryUrl: 'http://games.example.org/rumble-rush/m1-001/index.html' },
    { entryUrl: 'https://127.0.0.1/rumble-rush/m1-001/index.html' }, { approved: true },
  ])('denies tampered or unsupported manifest %j', patch => {
    expect(() => validateGameManifest({ ...manifest, ...patch }, policy)).toThrow();
  });
  it.each([{ allowedOrigins: [] }, { appOrigins: [] }, { appOrigins: ['https://games.example.org'] },
    { approvedReleases: [] }, { now: NaN }, { now: Date.parse(approval.expiresAt) },
    { approvedReleases: [{ ...approval, status: 'revoked' }] },
    { approvedReleases: [{ ...approval, sha256: 'b'.repeat(64) }] },
    { approvedReleases: [{ ...approval, downloadBytes: 1 }] }])('fails closed for policy %j', patch => {
    expect(() => validateGameManifest(manifest, { ...policy, ...patch })).toThrow();
  });
  it('cannot approve itself or accept malformed input', () => {
    for (const value of [null, [], {}, 'manifest']) expect(() => validateGameManifest(value, policy)).toThrow();
    expect(() => validateGameManifest(manifest, undefined)).toThrow();
  });
});
