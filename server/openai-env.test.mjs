// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOpenAIEnvironment } from './openai-env.mjs';

test('secure external file supplies only the OpenAI key', () => {
  const root = mkdtempSync(join(tmpdir(), 'chale-env-test-'));
  try {
    writeFileSync(join(root, 'key.env'), "DATABASE_URL=must-not-load\nexport OPENAI_API_KEY='synthetic-test-value'\nNODE_OPTIONS=must-not-load\n");
    const environment = { OPENAI_ENV_FILE: 'key.env' };
    loadOpenAIEnvironment(root, environment);
    assert.equal(environment.OPENAI_API_KEY, 'synthetic-test-value');
    assert.equal(environment.DATABASE_URL, undefined);
    assert.equal(environment.NODE_OPTIONS, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('existing app credential is preserved; errors do not expose file values', () => {
  const environment = { AI_PROVIDER_KEY: 'existing-test-value', OPENAI_ENV_FILE: '/missing' };
  loadOpenAIEnvironment('.', environment);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.throws(() => loadOpenAIEnvironment('.', { OPENAI_ENV_FILE: '/missing' }), /could not be read/);
});
