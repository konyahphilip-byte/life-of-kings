import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(resolve(root,'work/m01-native'),{recursive:true});
const dir = await mkdtemp(resolve(root, 'work/m01-native/http-'));
const dbPath = resolve(dir, 'test.sqlite');
let origin, exited = false, log = '', failure = null;
const checks = [];
const child = spawn(process.execPath, ['--import', './scripts/chale-test-provider.mjs', 'server/index.mjs'], {
  cwd: root,
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp', NODE_ENV: 'test',
    PORT: '0', ECOVIBES_DB_PATH: dbPath, ECOVIBES_MEDIA_LOCAL_ROOT: resolve(dir, 'media'),
    OPENAI_ENV_FILE: '', SUPABASE_URL: '', DATABASE_URL: '', AI_PROVIDER_KEY: 'synthetic-chale-http-fixture',
    ECOVIBES_M01_ENABLED: 'true', ECOVIBES_PUBLIC_TRENDS_DISABLED: 'true',
    CHALE_SMOKE_CAPTURE: resolve(dir, 'unused.jsonl') },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});
child.stdout.on('data', b => log += b);
child.stderr.on('data', b => log += b);
child.on('message', m => { if (m?.event === 'chale-smoke-ready') origin = 'http://127.0.0.1:' + m.port; });
child.on('exit', () => { exited = true; });
let database;
function check(value, label) { assert(value, label); checks.push(label); }
async function request(actor, method, path, body, expected = 200, csrf = true) {
  const r = await fetch(origin + '/api/v1' + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(5000),
    headers: { ...(actor ? { cookie: actor.cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      ...(actor && csrf ? { 'X-CSRF-Token': actor.csrfToken } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = r.headers.get('content-type')?.startsWith('application/json') ? await r.json() : await r.arrayBuffer();
  assert.equal(r.status, expected, method + ' ' + path + ': ' + JSON.stringify(data));
  return { data, cookie: r.headers.get('set-cookie')?.split(';')[0], headers: r.headers };
}
async function register(ecoId) {
  const r = await request(null, 'POST', '/auth/register', { ecoId, displayName: ecoId, password: 'Local-proof-only-Not-a-production-password!42' });
  return { ...r.data, cookie: r.cookie };
}
const native = (shop, actor, method, suffix = '', body, status = 200) => request(actor, method, '/studio/shops/' + shop.id + suffix, body, status);
const draftInput = () => ({ title: 'Native proof — original cotton tee', description: 'Created from scratch for an isolated workflow test.',
  categoryId: 'fashion', priceMinor: 22000, availability: 'in_stock', stock: 3,
  variants: [{ id: 'medium', label: 'Medium', priceMinor: 22000, stock: 3 }], gallery: [], collection: 'Everyday edit' });
try {
  const deadline = Date.now() + 15000;
  while (!origin && !exited && Date.now() < deadline) await delay(40);
  assert(origin, 'Owned isolated API did not start: ' + log);
  const seller = await register('m01.seller'), buyer = await register('m01.buyer'), outsider = await register('m01.other'), reviewer = await register('m01.reviewer');
  database = new DatabaseSync(dbPath);
  for (const actor of [seller, outsider]) await request(actor, 'POST', '/identity/roles', { role: 'seller' });
  database.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'trust_staff',?)").run(reviewer.user.id, new Date().toISOString());
  // Refresh the current server-side role projection through the real sign-in route.
  const reviewLogin = await request(null, 'POST', '/auth/login', { ecoId: 'm01.reviewer', password: 'Local-proof-only-Not-a-production-password!42' });
  Object.assign(reviewer, reviewLogin.data, { cookie: reviewLogin.cookie });
  async function approve(kind,target,revision=1){
   const queue=(await request(reviewer,'GET','/studio/reviews')).data;
   const value=queue[kind].find(x=>x.id===target);assert(value,'Actual pending review snapshot');
   return request(reviewer,'POST','/studio/reviews/'+kind+'/'+target,{requestId:randomUUID(),revision,contentHash:value.reviewContentHash,decision:'approved',reason:'Reviewed actual isolated listing and eligibility.',selfReviewConfirmed:false});
  }
  const create = { requestId: randomUUID(), name: 'Life of Kings · isolated proof', slug: 'life-of-kings' };
  const shop = (await request(seller, 'POST', '/studio/shops', create)).data.shop;
  check(shop.ownerEcoId === 'm01.seller', 'shop belongs to authenticated existing EcoVibes identity');
  check((await request(seller, 'POST', '/studio/shops', create)).data.shop.id === shop.id, 'shop creation retry keeps immutable ID');
  await request(null, 'GET', '/studio/shops', undefined, 401);
  await native(shop, buyer, 'GET', '', undefined, 404);
  await native(shop, outsider, 'GET', '', undefined, 404);
  await request(seller, 'POST', '/studio/shops', { ...create, requestId: randomUUID() }, 409);
  await native(shop, seller, 'POST', '/products', { requestId: randomUUID(), ...draftInput() }, 200);
  let product = (await native(shop, seller, 'GET', '/products')).data.products[0];
  check(product.id && product.title === draftInput().title && product.publication === 'draft', 'native product is a persistent draft without Shopify reference');
  check((await request(null, 'GET', '/public/catalogue')).data.products.length === 0, 'draft absent from Discover');
  await request(null, 'GET', '/public/products/' + product.id, undefined, 404);
  await request(buyer, 'GET', '/studio/products/' + product.id, undefined, 404);
  await request(seller, 'PATCH', '/studio/products/' + product.id, { revision: product.revision, ...draftInput(), priceMinor: -1 }, 400);
  await request(seller, 'PATCH', '/studio/products/' + product.id, { revision: product.revision, ...draftInput(), variants: [{ id: 'x', label: 'X', priceMinor: 22000, stock: -1 }] }, 400);
  await request(seller, 'POST', '/studio/shops/' + shop.id + '/products', {requestId:randomUUID(),...draftInput(),gallery:[{assetId:randomUUID(),alt:'Unowned photo'}]}, 400);
  const invalid = await request(seller, 'POST', '/studio/products/' + product.id + '/validate', { revision: product.revision });
  check(invalid.data.valid === false && invalid.data.issues.some(x => x.field === 'gallery'), 'publication validation gives actionable missing-photo errors');
  // Real decoder, malformed body, rights and MIME tests; fixture generated by the same licensed library, never remote fetched.
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#0d533d' } }).png().toBuffer();
  await native(shop, seller, 'POST', '/photos', { mimeType: 'image/png', data: png.toString('base64'), rightsConfirmed: false }, 400);
  await native(shop, seller, 'POST', '/photos', { mimeType: 'image/png', data: Buffer.from('not an image').toString('base64'), rightsConfirmed: true }, 400);
  await native(shop, buyer, 'POST', '/photos', { mimeType: 'image/png', data: png.toString('base64'), rightsConfirmed: true }, 404);
  const photo = (await native(shop, seller, 'POST', '/photos', { mimeType: 'image/png', data: png.toString('base64'), rightsConfirmed: true })).data.photo;
  check(photo.id && photo.mimeType === 'image/webp', 'authorized upload decoded and reencoded without source metadata');
  await request(null, 'GET', '/public/photos/' + photo.id, undefined, 404);
  await request(null, 'GET', '/social/assets/' + photo.id, undefined, 401);
  await request(buyer, 'GET', '/social/assets/' + photo.id, undefined, 404);
  await native(shop, seller, 'GET', '/photos/' + photo.id);
  await native(shop, outsider, 'GET', '/photos/' + photo.id, undefined, 404);
  product = (await request(seller, 'PATCH', '/studio/products/' + product.id, { revision: product.revision, ...draftInput(), gallery: [{ assetId: photo.id, alt: 'Green test image' }] })).data.product;
  await request(seller, 'PATCH', '/studio/products/' + product.id, { revision: product.revision - 1, ...draftInput() }, 409);
  check((await request(seller, 'POST', '/studio/products/' + product.id + '/validate', { revision: product.revision })).data.valid, 'complete native draft validates against server rules');
  await request(seller,'PATCH','/marketplace/products/'+product.id,{priceMinor:999},409);
  check((await request(seller,'GET','/studio/products/'+product.id)).data.product.priceMinor===22000,'legacy edits cannot alter a native review snapshot');
  const contentReview=(await request(reviewer,'GET','/studio/reviews')).data;
  check(contentReview.products.some(p=>p.id===product.id&&p.title===product.title&&p.gallery.length===1),'reviewer sees the actual draft and photo before approval');
  await request(reviewer,'GET','/studio/reviews/photos/'+photo.id);
  await request(buyer,'GET','/studio/reviews',undefined,403);
  await request(seller, 'POST', '/studio/reviews/products/' + product.id, { revision: product.revision, decision: 'approved' }, 403);
  await approve('shops',shop.id);
  await approve('products',product.id,product.revision);
  await request(seller, 'POST', '/studio/products/' + product.id + '/publish', { revision: product.revision, confirmPublication: true, confirmSupply: false }, 400);
  await request(seller, 'POST', '/studio/products/' + product.id + '/publish', { revision: product.revision, confirmPublication: true, confirmSupply: true }, 200, false).then(() => assert.fail('CSRF accepted'), e => assert.match(e.message, /403/));
  await request(seller, 'POST', '/studio/products/' + product.id + '/publish', { revision: product.revision, confirmPublication: true, confirmSupply: true });
  const publicShop = (await request(null, 'GET', '/public/shops/life-of-kings')).data;
  const discover = (await request(null, 'GET', '/public/catalogue')).data;
  const direct = (await request(null, 'GET', '/public/products/' + product.id)).data.product;
  check(publicShop.products[0].id === product.id && discover.products[0].id === product.id && direct.id === product.id, 'shop, Discover and direct product resolve same authoritative ID');
  check(database.prepare('SELECT count(*) n FROM products').get().n === 1, 'one product row, no duplicate storefront catalogue');
  check((await request(null, 'GET', '/public/profiles/m01.seller/shops')).data.shops[0].id === shop.id, 'public EcoVibes profile resolves its shop');
  check((await request(null, 'GET', '/public/photos/' + photo.id)).headers.get('cache-control') === 'private, no-store', 'public photo visibility checked at request time with no stale cache');
  check((await request(buyer, 'GET', '/search?q=Native')).data.items.some(p=>p.id===product.id), 'existing universal search resolves the same eligible native listing');
  const pendingReview = (await request(reviewer, 'GET', '/studio/reviews')).data;
  check(Array.isArray(pendingReview.products), 'authorized reviewer can inspect actual content before approval');
  const before = { stock: database.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,
    orders: database.prepare('SELECT count(*) n FROM orders').get().n };
  const enquiryBody = { listingId: product.id, clientId: randomUUID(), body: 'Is this available in Medium?' };
  const enquiry = (await request(buyer, 'POST', '/connect/enquiries', enquiryBody)).data.enquiry;
  check((await request(buyer, 'POST', '/connect/enquiries', enquiryBody)).data.enquiry.id === enquiry.id, 'buyer enquiry retry does not duplicate conversation');
  await request(outsider, 'GET', '/connect/enquiries/' + enquiry.id, undefined, 404);
  await request(seller, 'POST', '/connect/enquiries/' + enquiry.id + '/messages', { clientId: randomUUID(), body: 'Yes. Please ask any questions before arranging your purchase.' });
  const thread = (await request(buyer, 'GET', '/connect/enquiries/' + enquiry.id)).data;
  check(thread.messages.length === 2 && thread.messages[1].senderId === seller.user.id, 'persistent authorized Connect seller response reaches buyer');
  check(thread.enquiry.productTitle===product.title&&thread.enquiry.shopName===shop.name&&thread.messages[1].senderEcoId==='m01.seller','authorized Connect thread identifies the actual product, shop and sender');
  check((await request(seller, 'GET', '/connect/enquiries')).data.enquiries[0].id === enquiry.id, 'seller Buyer Enquiries workspace uses same Connect thread');
  database.prepare("INSERT INTO m01_shop_members(shop_id,user_id,role,status) VALUES(?,?,'designer','active')").run(shop.id,outsider.user.id);
  await request(outsider,'GET','/connect/enquiries/'+enquiry.id,undefined,404);
  database.prepare('DELETE FROM m01_shop_members WHERE shop_id=? AND user_id=?').run(shop.id,outsider.user.id);
  const firstTheme = (await native(shop, seller, 'GET', '/theme')).data;
  const scope = { id: shop.id, products: [{ id: product.id }] };
  const { defaultTheme } = await import('../shared/storefront/design.mjs');
  const config = { ...defaultTheme(scope), headline: 'A considered edit. Made yours.' };
  let theme = (await native(shop, seller, 'POST', '/theme', { expectedVersion: firstTheme.version, config })).data;
  await native(shop, outsider, 'POST', '/theme', { expectedVersion: theme.version, config }, 404);
  await native(shop, seller, 'POST', '/theme', { expectedVersion: theme.version, config: { ...config, css: 'script' } }, 400);
  await native(shop, seller, 'POST', '/theme/apply', { version: theme.version, confirm: true });
  theme = (await native(shop, seller, 'POST', '/theme', { expectedVersion: theme.version, config: { ...config, templateId: 'everyday-market', layout: 'catalogue' } })).data;
  await native(shop, seller, 'POST', '/theme/apply', { version: theme.version, confirm: true });
  theme = (await native(shop, seller, 'POST', '/theme/restore', { expectedVersion: theme.version, restoreVersion: 1 })).data;
  await native(shop, seller, 'POST', '/theme/apply', { version: theme.version, confirm: true });
  const restored = (await request(null, 'GET', '/public/shops/life-of-kings')).data;
  check(restored.shop.id === shop.id && restored.theme.templateId === 'the-living-edit' && restored.products[0].id === product.id, 'template switch and restore preserve stable shop URL, ID and product');
  check((await request(buyer, 'GET', '/connect/enquiries/' + enquiry.id)).data.messages.length === 2, 'appearance changes preserve customer conversation');
  await native(shop, seller, 'PATCH', '/slug', { slug: 'life-of-kings-edit' });
  check((await request(null, 'GET', '/public/shops/life-of-kings')).data.canonicalPath === '/shops/life-of-kings-edit', 'old shop alias resolves permanent identity after slug change');
  product = (await request(seller, 'PATCH', '/studio/products/' + product.id, { revision: product.revision, ...draftInput(), priceMinor: 23000, variants: [{id:'medium',label:'Medium',priceMinor:23000,stock:3}], gallery: [{ assetId: photo.id, alt: 'Test image' }] })).data.product;
  check((await request(null, 'GET', '/public/catalogue')).data.products.length === 0, 'editing invalidates moderation and atomically withdraws public record');
  await request(null, 'GET', '/public/photos/' + photo.id, undefined, 404);
  check((await request(seller, 'GET', '/studio/products/' + product.id)).data.product.priceMinor === 23000, 'updated price is persisted in existing product authority');
  await approve('products',product.id,product.revision);
  await request(seller, 'POST', '/studio/products/' + product.id + '/publish', { revision: product.revision, confirmPublication: true, confirmSupply: true });
  await request(seller, 'POST', '/studio/products/' + product.id + '/unpublish', { revision: product.revision });
  check((await request(null, 'GET', '/public/catalogue')).data.products.length === 0, 'unpublish removes shop and Discover visibility synchronously');
  await request(buyer, 'POST', '/marketplace/orders', { items: [{ productId: product.id, quantity: 1 }] }, 503);
  check(database.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock === before.stock && database.prepare('SELECT count(*) n FROM orders').get().n === before.orders, 'all native seller/enquiry/theme operations preserve stock and create no order/payment');
  check(database.prepare('SELECT count(*) n FROM connect_direct_messages').get().n === 0, 'no fabricated friendship or bypass of private friend messaging');
  // The retained database is private test evidence, never a production seed.
  await request(seller, 'POST', '/auth/logout', {});
  await request(seller, 'GET', '/studio/shops', undefined, 401);
  checks.push('expired/revoked authenticated session cannot reopen Studio');
} catch (error) { failure = { name: error.name, message: error.message, stack: error.stack }; }
finally {
  database?.close();
  child.kill('SIGTERM');
  for (let i = 0; i < 100 && !exited; i++) await delay(20);
  if (!exited) child.kill('SIGKILL');
  await writeFile(resolve(dir, 'server.log'), log);
  const report = { passed: !failure, checks, failure, evidenceDirectory: dir,
    scope: 'Real isolated API/auth/SQLite. Synthetic independent accounts; no hosted, native-phone, payment or AI acceptance.' };
  await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));
  if(process.env.NATIVE_HTTP_REPORT)await writeFile(process.env.NATIVE_HTTP_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report, null, 2));
  if (failure) process.exitCode = 1;
}
