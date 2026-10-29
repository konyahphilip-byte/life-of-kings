import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const types = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
}));
const webCsp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'";

/** Serve only a built web directory, alongside the API on the same origin. */
export async function createWebHandler(directory) {
  const root = await realpath(directory);
  const inside = (path) => {
    const child = relative(root, path);
    return child !== '..' && !child.startsWith('../') && !isAbsolute(child);
  };
  async function file(path) {
    try {
      const canonical = await realpath(resolve(root, path));
      if (!inside(canonical) || !(await stat(canonical)).isFile()) return null;
      return canonical;
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null;
      throw error;
    }
  }
  if (!await file('index.html')) throw new Error('Web build missing: run npm run build before enabling ECOVIBES_SERVE_WEB.');

  return async (req, res) => {
    const raw = String(req.url || '/').split('?')[0];
    // API paths never receive the SPA fallback, including malformed API calls.
    if (raw === '/api' || raw.startsWith('/api/')) return false;
    const finish = (status, message) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(req.method === 'HEAD' ? undefined : message);
      return true;
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return finish(405, 'Method not allowed.');
    }
    let pathname;
    try { pathname = decodeURIComponent(raw); } catch { return finish(400, 'Invalid path.'); }
    if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\0]/.test(pathname) || pathname.split('/').some(segment => segment.startsWith('.'))) {
      return finish(404, 'Not found.');
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return finish(404, 'Not found.');
    let target = await file(pathname.slice(1) || 'index.html');
    // Missing assets must be real 404s, not HTML disguised as JavaScript.
    if (!target && !extname(pathname) && !pathname.startsWith('/assets/') && /\btext\/html\b/.test(req.headers.accept || '')) {
      target = await file('index.html');
    }
    const type = target && types.get(extname(target));
    if (!target || !type) return finish(404, 'Not found.');
    const content = await readFile(target);
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', content.byteLength);
    res.setHeader('Content-Security-Policy', webCsp);
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(self), microphone=(self), display-capture=(), payment=(self)');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : content);
    return true;
  };
}
