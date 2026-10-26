import { describe, expect, it } from 'vitest';
import {
  recommendationInterestWeights,
  rankRecommendations,
  rankDiscoveryRecommendations,
  summarizeRecommendationProfile,
} from './recommendations.mjs';

describe('shared EcoVibes recommendation profile', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');

  it('uses eligible signals from one pillar to rank relevant items in another', () => {
    const signals = [{
      item_type: 'creator',
      item_id: 'creator-1',
      action: 'followed',
      topic: 'fashion',
      weight: 2,
      active: true,
      created_at: new Date(now).toISOString(),
    }];
    const results = rankRecommendations([
      { id: 'job-1', itemType: 'job', title: 'Fashion stylist', category: 'Creative work', created_at: new Date(now).toISOString() },
      { id: 'product-1', itemType: 'product', title: 'Kitchen blender', category: 'Home', created_at: new Date(now).toISOString() },
    ], [], signals, 2, now);

    expect(results[0].id).toBe('job-1');
    expect(results[0].reason).toBe('Because you follow creators in fashion');
  });

  it('respects saved interests and decays older behavior signals', () => {
    const recent = { topic: 'music', weight: 2, active: true, created_at: new Date(now).toISOString() };
    const old = { topic: 'music', weight: 2, active: true, created_at: new Date(now - 90 * 86_400_000).toISOString() };
    const recentWeights = recommendationInterestWeights([], [recent], now);
    const oldWeights = recommendationInterestWeights([], [old], now);

    expect(recentWeights.get('music')).toBeGreaterThan(oldWeights.get('music'));
    expect(recommendationInterestWeights(['Music'], [], now).get('music')).toBe(5);
  });

  it('returns topic-only profile summaries and leaves dismissed topics out', () => {
    const profile = summarizeRecommendationProfile([
      { topic: 'Accra fashion', action: 'saved', weight: 2.5, active: true, created_at: new Date(now).toISOString() },
      { topic: 'spam', action: 'dismissed', weight: -3.5, active: true, created_at: new Date(now).toISOString() },
    ], now);

    expect(profile).toEqual([{ topic: 'accra fashion', strength: 2.5, learnedFrom: 'saved items' }]);
    expect(JSON.stringify(profile)).not.toContain('user_id');
  });
});

describe('useful Home discovery', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const stamp = new Date(now).toISOString();
  const familiar = Array.from({ length: 6 }, (_, index) => ({ id: `music-${index}`, itemType: 'product', title: `Music choice ${index}`, category: `Category ${index}`, created_at: stamp }));
  const fresh = { id: 'fresh-food', itemType: 'job', title: 'Local cooking', category: 'Food', created_at: stamp };
  const signal = (item, action, topic, weight) => ({ item_type: item.itemType, item_id: item.id, action, topic, weight, active: true, created_at: stamp });

  it('keeps the first four relevant and adds one fresh discovery at position five', () => {
    const result = rankDiscoveryRecommendations([...familiar, fresh], ['Music'], [], 6, now);
    expect(result.slice(0, 4).every(item => item.id.startsWith('music-'))).toBe(true);
    expect(result[4]).toMatchObject({ id: fresh.id, reason: 'Discover something different in Food' });
    expect(result.filter(item => item.id === fresh.id)).toHaveLength(1);
    expect(result).toHaveLength(6);
  });

  it('uses the existing shared profile without needing an AI model', () => {
    const result = rankDiscoveryRecommendations([...familiar, fresh], [], [signal(familiar[0], 'followed', 'music', 2)], 6, now);
    expect(result[0].reason).toBe('Because you follow creators in music');
    expect(result[4].id).toBe(fresh.id);
  });

  it.each(['opened', 'saved', 'purchased', 'dismissed'])('does not introduce an already %s item as a fresh discovery', action => {
    const result = rankDiscoveryRecommendations([...familiar, fresh], ['Music'], [signal(fresh, action, 'food', action === 'dismissed' ? -3.5 : 0.7)], 6, now);
    expect(result.some(item => item.reason.startsWith('Discover something different'))).toBe(false);
    if (action === 'dismissed') expect(result.some(item => item.id === fresh.id)).toBe(false);
  });

  it('never explores a dismissed topic through a different listing', () => {
    const result = rankDiscoveryRecommendations([...familiar, fresh], ['Music'], [signal({ id: 'other-food', itemType: 'job' }, 'dismissed', 'food', -3.5)], 6, now);
    expect(result.some(item => item.reason.startsWith('Discover something different'))).toBe(false);
  });

  it('does not explore stale, future-dated or undated records', () => {
    for (const created_at of [new Date(now - 31 * 86400000).toISOString(), new Date(now + 86400000).toISOString(), 'invalid']) {
      const result = rankDiscoveryRecommendations([...familiar, { ...fresh, created_at }], ['Music'], [], 6, now);
      expect(result.some(item => item.reason.startsWith('Discover something different'))).toBe(false);
    }
  });

  it('chooses the freshest eligible discovery with stable tie breaks', () => {
    const older = { ...fresh, id: 'older-food', created_at: new Date(now - 86400000).toISOString() };
    const newest = { ...fresh, id: 'z-fresh-food' };
    const a = rankDiscoveryRecommendations([...familiar, older, newest, fresh], ['Music'], [], 6, now);
    const b = rankDiscoveryRecommendations([...familiar, fresh, newest, older], ['Music'], [], 6, now);
    expect(a[4].id).toBe(fresh.id);
    expect(b[4].id).toBe(fresh.id);
  });

  it('leaves cold-start/paused and small feeds on the existing ranking', () => {
    const pool = [...familiar, fresh];
    expect(rankDiscoveryRecommendations(pool, [], [], 6, now)).toEqual(rankRecommendations(pool, [], [], 6, now));
    expect(rankDiscoveryRecommendations(pool, ['Music'], [], 3, now)).toEqual(rankRecommendations(pool, ['Music'], [], 3, now));
    expect(rankDiscoveryRecommendations(pool.slice(0, 3), ['Music'], [], 6, now)).toEqual(rankRecommendations(pool.slice(0, 3), ['Music'], [], 6, now));
  });

  it('preserves diversity, unique identities and inputs', () => {
    const pool = [...familiar, fresh, { ...fresh, id: 'food-2' }, { ...fresh, id: 'food-3' }];
    const before = JSON.stringify(pool);
    const result = rankDiscoveryRecommendations(pool, ['Music'], [], 12, now);
    expect(result.filter(item => item.category === 'Food').length).toBeLessThanOrEqual(2);
    expect(new Set(result.map(item => `${item.itemType}:${item.id}`)).size).toBe(result.length);
    expect(JSON.stringify(pool)).toBe(before);
  });

  it('bounds invalid limits and keeps explicit catalog ranking unchanged', () => {
    const pool = [...familiar, fresh];
    for (const limit of [0, -1, NaN, Infinity]) expect(rankDiscoveryRecommendations(pool, ['Music'], [], limit, now)).toEqual([]);
    expect(rankDiscoveryRecommendations(pool, ['Music'], [], 5.9, now)).toHaveLength(5);
    expect(rankRecommendations(pool, ['Music'], [], 6, now).every(item => item.id.startsWith('music-'))).toBe(true);
  });

  it('finds an eligible discovery even when lower relevance category peers prune it', () => {
    const leaders = familiar.slice(0, 4).map(item => ({ ...item, title: `${item.title} Guitar` }));
    const foodMatches = [0, 1].map(index => ({ ...fresh, id: `food-music-${index}`, title: 'Music', category: 'Food' }));
    const result = rankDiscoveryRecommendations([...leaders, ...foodMatches, fresh], ['Music', 'Guitar'], [], 6, now);
    expect(result.slice(0, 4).every(item => item.title.includes('Guitar'))).toBe(true);
    expect(result[4].id).toBe(fresh.id);
    expect(result.filter(item => item.category === 'Food')).toHaveLength(2);
  });

  it('does not explore a category already occupying two leading slots', () => {
    const leaders = familiar.slice(0, 4).map((item, index) => ({ ...item, category: index < 2 ? 'Food' : item.category }));
    const result = rankDiscoveryRecommendations([...leaders, fresh], ['Music'], [], 5, now);
    expect(result.filter(item => item.category === 'Food')).toHaveLength(2);
    expect(result.some(item => item.id === fresh.id)).toBe(false);
  });

  it('does not call an unsaved item a fresh discovery', () => {
    const unsaved = { ...signal(fresh, 'saved', 'food', 2.5), active: false };
    const result = rankDiscoveryRecommendations([...familiar, fresh], ['Music'], [unsaved], 6, now);
    expect(result.some(item => item.reason.startsWith('Discover something different'))).toBe(false);
  });
});
