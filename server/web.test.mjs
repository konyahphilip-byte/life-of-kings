// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWebHandler } from './web.mjs';

let temp, serve;
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), 'ecovibes-web-'));
  const build = join(temp, 'dist');
  await mkdir(join(build, 'assets'), { recursive: true });
  await writeFile(join(build, 'index.html'), '<html>EcoVibes</html>');
  await writeFile(join(build, 'assets', 'app.js'), 'console.log("built asset")');
  await writeFile(join(build, 'sw.js'), '// worker');
  await writeFile(join(build, 'privacy.html'), '<html>Privacy</html>');
  await writeFile(join(build, 'secret.map'), 'source map');
  await writeFile(join(build, '.env'), 'synthetic secret');
  await writeFile(join(temp, 'outside.js'), 'private file');
  await symlink(join(temp, 'outside.js'), join(build, 'assets', 'escape.js'));
  serve = await createWebHandler(build);
});
afterAll(async () => { if (temp) await rm(temp, { recursive: true, force: true }); });

async function request(url, method = 'GET', accept = 'text/html') {
  const res = { headers: {}, statusCode: 0, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body?.toString(); },
  };
  const handled = await serve({ url, method, headers: { accept } }, res);
  return { ...res, handled };
}

test('serves the app and preserves browser security headers', async () => {
  const r = await request('/');
  expect(r.statusCode).toBe(200);
  expect(r.body).toContain('EcoVibes');
  expect(r.headers['content-type']).toContain('text/html');
  expect(r.headers['content-security-policy']).toContain("script-src 'self'");
  expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(r.headers['cache-control']).toBe('no-cache');
});
test('serves SPA routes and actual policy pages', async () => {
  expect((await request('/account/security?mode=recovery')).body).toContain('EcoVibes');
  expect((await request('/privacy.html')).body).toContain('Privacy');
});
test('HEAD returns metadata without a response body', async () => {
  const r = await request('/', 'HEAD');
  expect(r.statusCode).toBe(200);
  expect(r.headers['content-length']).toBeGreaterThan(0);
  expect(r.body).toBeUndefined();
});
test('assets have the right media type; worker cannot become stale permanently', async () => {
  const r = await request('/assets/app.js');
  expect(r.headers['content-type']).toContain('text/javascript');
  expect(r.headers['cache-control']).toBe('public, max-age=3600');
  expect((await request('/sw.js')).headers['cache-control']).toBe('no-cache');
});
test.each(['/api', '/api/v1/auth/me', '/api/v1/providers', '/api/v1/unknown'])('leaves %s entirely to API authorization', async (path) => {
  expect((await request(path, 'POST')).handled).toBe(false);
});
test.each(['/assets/missing.js', '/assets/missing', '/missing.css', '/secret.map', '/.env', '/%2eenv', '/../outside.js', '/%2e%2e/outside.js', '/assets/escape.js', '/a%5cb.js', '/%00', '//outside.js', '/%61pi/v1/auth/me'])('refuses unsafe or missing path %s', async (path) => {
  const r = await request(path);
  expect(r.statusCode).toBe(404);
  expect(r.body).toBe('Not found.');
});
test('rejects malformed escapes', async () => {
  expect((await request('/%xx')).statusCode).toBe(400);
});
test('does not return SPA HTML for non-document requests', async () => {
  expect((await request('/unknown', 'GET', 'application/json')).statusCode).toBe(404);
});
test('rejects writes to document paths', async () => {
  const r = await request('/account', 'POST');
  expect(r.statusCode).toBe(405);
  expect(r.headers.allow).toBe('GET, HEAD');
});
test('fails early when the deployment has no web build', async () => {
  await expect(createWebHandler(temp)).rejects.toThrow('Web build missing');
});
