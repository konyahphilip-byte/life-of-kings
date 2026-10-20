// Private preview of the existing app with real CPU inference and an isolated
// SQLite database. No .env, AWS credentials, paid providers or production data.
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, 'work/chale-runtime');
const model = resolve(runtime, 'Qwen3-0.6B-Q8_0.gguf');
const executable = resolve(runtime, 'llama-b11669/llama-server');
await Promise.all([access(model), access(executable), access(resolve(root, 'dist/index.html'))]);
const hash = createHash('sha256');
for await (const chunk of createReadStream(model)) hash.update(chunk);
if (hash.digest('hex') !== '9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031') throw new Error('Unexpected local model digest.');
await mkdir(runtime, { recursive: true });
const key = randomBytes(32).toString('hex');
const children = [];
const common = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp' };
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); process.exit(code); }, 3000).unref();
}
function start(command, args, env, logPath) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = createWriteStream(logPath, { flags: 'w', mode: 0o600 });
  child.stdout.pipe(log); child.stderr.pipe(log);
  child.on('error', () => { console.error('A private preview process could not start.'); stop(1); });
  child.on('exit', (code) => { if (!stopping) { console.error(`Private preview process exited (${code}).`); stop(1); } });
  children.push(child);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
try {
  start(executable, ['--model', model, '--alias', 'chale-free-core', '--host', '127.0.0.1', '--port', '11435',
    '--ctx-size', '4096', '--parallel', '1', '--threads', '2', '--threads-batch', '2', '--gpu-layers', '0',
    '--no-ui', '--no-ui-mcp-proxy', '--cors-origins', 'http://127.0.0.1:11435', '--no-cors-credentials', '--reasoning', 'off'],
  { ...common, LLAMA_API_KEY: key }, resolve(runtime, 'model.log'));
  const deadline = Date.now() + 45000;
  let ready = false;
  while (!stopping && Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:11435/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(1000) });
      if (r.ok && (await r.json()).data?.some((item) => item.id === 'chale-free-core')) { ready = true; break; }
    } catch { /* Loading. The random key prevents adopting an unrelated server. */ }
    await delay(500);
  }
  if (!ready) throw new Error('Local inference did not become ready.');
  start(process.execPath, ['server/index.mjs'], {
    ...common, NODE_ENV: 'development', PORT: '8790', API_PORT: '8790', ECOVIBES_SERVE_WEB: 'true',
    ECOVIBES_DB_PATH: resolve(runtime, 'private-preview.sqlite'), APP_ORIGINS: 'http://127.0.0.1:8790',
    CHALE_PROVIDER: 'compatible', CHALE_BASE_URL: 'http://127.0.0.1:11435/v1', CHALE_INFERENCE_KEY: key,
    AI_MODEL: 'chale-free-core', CHALE_ALLOW_PAID: 'false', CHALE_REMOTE_APPROVED: 'false',
    CHALE_GUEST_DAILY_REQUESTS: '5', CHALE_DAILY_REQUESTS: '20', CHALE_GLOBAL_DAILY_REQUESTS: '200',
  }, resolve(runtime, 'api.log'));
  console.log('Private EcoVibes preview starting at http://127.0.0.1:8790 — local model, isolated test database, no paid API.');
} catch (error) { console.error(error.message); stop(1); }
