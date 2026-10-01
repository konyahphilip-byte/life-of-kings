import { describe, expect, it } from 'vitest';
import { answerEcoVibesQuery } from './assistant';

describe('EcoVibes sidekick catalogue search', () => {
  it('finds a relevant opportunity for a grant query', () => {
    const result = answerEcoVibesQuery('Find grants');
    expect(result.items.some(item => item.destination === 'Opportunities')).toBe(true);
  });
  it('does not invent a scholarship listing', () => {
    const result = answerEcoVibesQuery('What scholarships can I apply for?');
    expect(result.text).toMatch(/don’t see a scholarship listing/i);
    expect(result.items.some(item => /scholarship/i.test(item.title))).toBe(false);
  });
  it('returns links for product discovery', () => {
    const result = answerEcoVibesQuery('show me a tote bag');
    expect(result.items[0]?.destination).toBe('Marketplace');
  });
  it('routes a natural plumbing question to a sample local Handi', () => {
    const result = answerEcoVibesQuery('I need someone to fix a leaking kitchen pipe tomorrow morning');
    expect(result.text).toMatch(/plumbing request/i);
    expect(result.items.some(item => item.destination === 'Quick&Handi')).toBe(true);
  });
  it('explains catalogue gaps instead of making up results', () => {
    const result = answerEcoVibesQuery('find laptops');
    expect(result.text).toMatch(/no laptop listings/i);
  });
});
