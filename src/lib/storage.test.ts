import { afterEach, describe, expect, it } from 'vitest';
import { loadState, saveState } from './storage';

afterEach(() => localStorage.clear());

describe('local preference storage', () => {
  it('starts with data saver enabled and an empty bag', () => {
    const state = loadState();
    expect(state.saver).toBe('saver');
    expect(state.cart).toEqual({});
  });
  it('round trips settings and drafts', () => {
    const state = loadState();
    state.saver = 'extreme';
    state.draft = 'A locally saved draft';
    saveState(state);
    expect(loadState()).toMatchObject({ saver: 'extreme', draft: 'A locally saved draft' });
  });
  it('recovers from malformed saved data', () => {
    localStorage.setItem('ecovibes:v1', '{bad');
    expect(loadState().saver).toBe('saver');
  });
});
