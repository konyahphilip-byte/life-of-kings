import { describe, expect, it } from 'vitest';
import {
  recommendationInterestWeights,
  rankRecommendations,
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
