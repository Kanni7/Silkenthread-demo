// Compact wire format for the product catalogue served at /data/catalog.json (~5,800 products).
// Facet values are stored once in a dictionary and referenced by index; image URLs drop the shared CDN prefix.
// encode() runs at build time on summary() records, decode() in the browser returns summary-shaped records.

export const CDN = 'https://cdn.shopify.com/s/files/1/0657/5613/5668/';
const KEYS = ['productType', 'materials', 'colourfamily', 'weaving_genre', 'craft', 'silk_mark', 'blouse', 'origin', 'shipping_speed', 'zari_type'];

const img = (i) => (i ? [i.u.startsWith(CDN) ? i.u.slice(CDN.length) : i.u, i.w, i.h] : 0);
const unimg = (x, alt) => (x ? { u: /^https?:/.test(x[0]) ? x[0] : CDN + x[0], w: x[1], h: x[2], alt } : null);

export function encode(summaries) {
  const dict = Object.fromEntries(KEYS.map((k) => [k, []]));
  const ix = (k, v) => {
    let i = dict[k].indexOf(v);
    if (i < 0) i = dict[k].push(v) - 1;
    return i;
  };
  const rows = summaries.map((s) => [
    s.id, s.h, s.t, s.p, s.c || 0, s.a ? 1 : 0, s.d.slice(0, 10), img(s.i), img(s.i2),
    KEYS.map((k) => (Array.isArray(s.f[k]) ? s.f[k].map((v) => ix(k, v)) : ix(k, s.f[k]))),
  ]);
  return { v: 1, dict, rows };
}

export function decode(data) {
  return data.rows.map(([id, h, t, p, c, a, d, i, i2, f]) => ({
    id, h, t, p, c: c || null, a: !!a, d, i: unimg(i, t), i2: unimg(i2, t),
    f: Object.fromEntries(KEYS.map((k, n) => [k, Array.isArray(f[n]) ? f[n].map((x) => data.dict[k][x]) : data.dict[k][f[n]]])),
  }));
}
