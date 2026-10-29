// Phase 2: download only the images used on the replicated (captured) pages, at width=1000.
// Writes public/images/** and src/data/images.json (imageKey -> local path). Everything else uses the CDN.
import fs from 'node:fs';
import path from 'node:path';
import { ORIGIN, loadRobots, politeFetch } from './lib/polite.mjs';
import { load, imageKey } from './lib/parse.mjs';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
const found = new Map(); // key -> version

for (const f of fs.readdirSync('reference/html')) {
  const $ = load(fs.readFileSync(`reference/html/${f}`, 'utf8'));
  const urls = [];
  $('img').each((i, el) => {
    for (const attr of ['src', 'data-src']) if (el.attribs[attr]) urls.push(el.attribs[attr]);
    for (const attr of ['srcset', 'data-srcset']) if (el.attribs[attr]) urls.push(...el.attribs[attr].split(',').map((s) => s.trim().split(' ')[0]));
  });
  $('[style*="url("]').each((i, el) => urls.push(...[...el.attribs.style.matchAll(/url\(['"]?([^'")]+)/g)].map((m) => m[1])));
  for (const u of urls) {
    if (!/\/cdn\/shop\/(files|products|collections|articles)\/|cdn\.shopify\.com\/s\/files\//.test(u)) continue;
    const key = imageKey(u);
    if (key) found.set(key, new URL(u.startsWith('//') ? 'https:' + u : u, ORIGIN).searchParams.get('v') || found.get(key) || '');
  }
}

// Demo pages render product cards from products.json, whose photos can differ from the capture:
// also fetch card + hover images for the homepage carousel products.
const products = new Map(JSON.parse(fs.readFileSync('src/data/products.json', 'utf8')).map((p) => [p.handle, p]));
const home = JSON.parse(fs.readFileSync('src/data/home.json', 'utf8'));
for (const s of home.sections.filter((s) => s.productHandles)) {
  for (const h of s.productHandles) for (const img of products.get(h)?.images.slice(0, 2) || []) {
    if (img.key && !found.has(img.key)) found.set(img.key, new URL(img.src).searchParams.get('v') || '');
  }
}

await loadRobots();
const manifest = {};
let bytes = 0;
for (const [key, v] of [...found].sort()) {
  const url = `${ORIGIN}/cdn/shop/${key.split('/').map(encodeURIComponent).join('/')}?${v ? `v=${v}&` : ''}width=1000`;
  const res = await politeFetch(url);
  if (res.status !== 200) { console.warn(`skip ${res.status} ${key}`); continue; }
  const ext = EXT[(res.headers['content-type'] || '').split(';')[0]] || path.extname(key);
  const local = `images/${key.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._/-]/g, '_')}${ext}`;
  fs.mkdirSync(path.dirname(`public/${local}`), { recursive: true });
  fs.writeFileSync(`public/${local}`, res.body);
  manifest[key] = `/${local}`;
  bytes += res.body.length;
}
fs.writeFileSync('src/data/images.json', JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(manifest).length} images, ${(bytes / 1048576).toFixed(1)} MB`);
