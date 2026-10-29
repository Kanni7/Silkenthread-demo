// Compact markup outline of saved pages, for building faithful components.
// node scripts/dev/outline.mjs <html file> "<selector>" [maxDepth]
import fs from 'node:fs';
import { load } from '../lib/parse.mjs';
const [, , file, sel, maxDepth = '12'] = process.argv;
const $ = load(fs.readFileSync(file, 'utf8'));
const KEEP = /^(id|class|href|role|aria-[\w-]+|type|name|for|open|data-(autoplay|speed|breakpoint|slide-position|media-id|id)|tabindex|loading|is|method|action|value|placeholder)$/;
const sig = (el) => el.name + '.' + (el.attribs.class || '');
function attrs(el) {
  return Object.entries(el.attribs).filter(([k]) => KEEP.test(k)).map(([k, v]) => k === 'class' ? '.' + v.trim().split(/\s+/).join('.') : k === 'id' ? '#' + v : `[${k}${v ? '=' + (v.length > 50 ? v.slice(0, 50) + '…' : v) : ''}]`).join('');
}
function walk(el, d) {
  if (d > +maxDepth) return;
  const kids = $(el).contents().toArray();
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.type === 'text') { const t = k.data.replace(/\s+/g, ' ').trim(); if (t) console.log('  '.repeat(d) + '"' + t.slice(0, 60) + '"'); continue; }
    if (k.type !== 'tag' || ['script', 'style', 'noscript', 'link'].includes(k.name)) continue;
    let n = 1; while (kids[i + n] && (kids[i + n].type !== 'tag' ? kids[i + n].type === 'text' && !kids[i + n].data.trim() : sig(kids[i + n]) === sig(k))) { if (kids[i + n].type === 'tag') n++; else { kids.splice(i + n, 1); } }
    console.log('  '.repeat(d) + k.name + attrs(k) + (n > 1 ? `  (x${n})` : ''));
    if (k.name !== 'svg') walk(k, d + 1);
    i += n - 1;
  }
}
$(sel).each((i, el) => { console.log(el.name + attrs(el)); walk(el, 1); });
