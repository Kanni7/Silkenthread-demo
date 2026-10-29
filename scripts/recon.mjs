// Phase 1: robots.txt + sitemaps -> reference/inventory.json
import fs from 'node:fs';
import { ORIGIN, loadRobots, politeFetch } from './lib/polite.mjs';

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

await loadRobots();
const index = (await politeFetch(ORIGIN + '/sitemap.xml')).body.toString('utf8');
const children = locs(index);
const inv = { generatedAt: new Date().toISOString(), origin: ORIGIN, sitemaps: children, products: [], collections: [], pages: [], blogs: [], other: [] };

for (const sm of children) {
  const xml = (await politeFetch(sm)).body.toString('utf8');
  // Product sitemaps also list image:loc entries; only keep the page <url><loc>.
  const urls = [...xml.matchAll(/<url>\s*<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const u of urls) {
    const p = new URL(u).pathname;
    const bucket = p.startsWith('/products/') ? 'products' : p.startsWith('/collections/') ? 'collections'
      : p.startsWith('/pages/') ? 'pages' : p.startsWith('/blogs/') ? 'blogs' : 'other';
    inv[bucket].push(u);
  }
}
for (const k of ['products', 'collections', 'pages', 'blogs', 'other']) inv[k] = [...new Set(inv[k])].sort();
fs.mkdirSync('reference', { recursive: true });
fs.writeFileSync('reference/inventory.json', JSON.stringify(inv, null, 2));
console.log(Object.fromEntries(['products', 'collections', 'pages', 'blogs', 'other'].map((k) => [k, inv[k].length])));
