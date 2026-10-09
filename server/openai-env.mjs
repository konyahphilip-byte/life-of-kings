import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

// Reuse a secure key file without copying its secret into another location.
// Only the OpenAI key is read; unrelated file values cannot configure the app.
export function loadOpenAIEnvironment(root, environment = process.env) {
  if (environment.AI_PROVIDER_KEY?.trim() || environment.OPENAI_API_KEY?.trim()) return;
  const target = environment.OPENAI_ENV_FILE?.trim();
  if (!target) return;
  let source;
  try { source = readFileSync(isAbsolute(target) ? target : resolve(root, target), 'utf8'); }
  catch { throw new Error('The configured OpenAI environment file could not be read.'); }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[1];
    if (value.length >= 2 && value[0] === value.at(-1) && ['"', "'"].includes(value[0])) value = value.slice(1, -1);
    if (value.trim()) environment.OPENAI_API_KEY = value.trim();
  }
  if (!environment.OPENAI_API_KEY) throw new Error('The configured OpenAI environment file contains no OpenAI key.');
}
