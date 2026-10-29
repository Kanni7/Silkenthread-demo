// Contrast of key text/background pairs (computed styles) + focus-ring screenshot + console errors.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx astro preview --port 4324', { shell: true, stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => /127\.0\.0\.1|localhost/.test(d) && r()));
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://127.0.0.1:4324/', { waitUntil: 'networkidle' });
const rows = await p.evaluate(() => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const [r, g, b, a = 1] = parse(getComputedStyle(e).backgroundColor); if (a > 0) return [r, g, b]; } return [255, 255, 255]; };
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const check = (label, sel) => {
    const el = document.querySelector(sel); if (!el) return { label, missing: true };
    const s = getComputedStyle(el); const bg = bgOf(el); const [r, g, bl, a = 1] = parse(s.color);
    const fg = [r, g, bl].map((v, i) => v * a + bg[i] * (1 - a));
    const L1 = lum(fg), L2 = lum(bg);
    return { label, fg: s.color, bg: `rgb(${bg.join(',')})`, ratio: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2), size: s.fontSize };
  };
  return [
    check('Product card name', '.product-card-wrapper .card__heading.h5 a'),
    check('Product card price', '.product-card-wrapper .price-item--regular'),
    check('Collection card title', '.collection-card-wrapper .card > .card__content .card__heading a'),
    check('Hero CTA', '.banner__buttons .button'),
    check('View all button', '.collection-list-view-all .button'),
    check('Section heading', '.multicolumn .title'),
    check('Footer text', '.footer-block__details-content'),
    check('Pre-footer text', '.shopify-section-group-footer-group .color-background-1 div'),
    check('Announcement text', '.announcement-bar__message'),
    check('Header nav link (unchanged)', '.header__menu-item span'),
  ];
});
console.table(rows.map((r) => ({ element: r.label, ratio: r.ratio, fontSize: r.size, fg: r.fg, bg: r.bg })));
// Keyboard focus on the first product card link
await p.evaluate(() => document.querySelector('.product-card-wrapper .card__heading.h5 a').focus({ focusVisible: true }));
await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
const box = await p.evaluate(() => { const r = document.activeElement.closest('.card-wrapper').getBoundingClientRect(); return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24, active: document.activeElement.textContent.trim() }; });
await p.evaluate(() => document.activeElement.scrollIntoView({ block: 'center' }));
const box2 = await p.evaluate(() => { const r = document.activeElement.closest('.card-wrapper').getBoundingClientRect(); return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: r.width + 24, height: r.height + 24 }; });
await p.screenshot({ path: '.cache/compare/focus.png', clip: box2 });
console.log('focused:', box.active, '| console errors:', errors.length ? errors : 'none');
await b.close(); server.kill(); process.exit(0);
