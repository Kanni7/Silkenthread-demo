// Redesign navigation checks: link validity, keyboard behaviour, screenshots of each state.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const out = '.cache/compare/nav';
fs.mkdirSync(out, { recursive: true });

// 1. Every internal link in the built homepage must be a real live route.
const html = fs.readFileSync('dist/index.html', 'utf8');
const collections = new Set(JSON.parse(fs.readFileSync('src/data/collections.json')).map((c) => c.handle));
const pages = new Set(JSON.parse(fs.readFileSync('reference/inventory.json')).pages.map((u) => new URL(u).pathname));
const products = new Set(JSON.parse(fs.readFileSync('src/data/products.json')).map((p) => p.handle));
const policies = new Set(['terms-of-service', 'refund-policy', 'shipping-policy', 'privacy-policy', 'contact-information']);
const hrefs = [...new Set([...html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)].map((m) => m[1] + (m[2] || '')))].filter((h) => !h.startsWith('/_astro'));
const bad = hrefs.filter((h) => {
  const p = h.split(/[?#]/)[0];
  if (['/', '/cart', '/account/login', '/search', '/collections'].includes(p)) return false; // Shopify built-ins
  if (p.startsWith('/products/')) return !products.has(p.split('/')[2]);
  if (p.startsWith('/collections/')) return !collections.has(p.split('/')[2]);
  if (p.startsWith('/pages/')) return !pages.has(p);
  if (p.startsWith('/policies/')) return !policies.has(p.split('/')[2]);
  return true;
});
const anchors = hrefs.filter((h) => h.includes('#')).map((h) => [h, html.includes(`id="${h.split('#')[1]}"`)]);
console.log(`internal links: ${hrefs.length}, invalid: ${bad.length ? bad.join(', ') : 'none'}; anchors:`, anchors);

const server = spawn('npx astro preview --port 4326', { shell: true, stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => /127\.0\.0\.1|localhost/.test(d) && r()));
const b = await chromium.launch({ channel: 'chrome' });
const page = async (w, h) => { const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); await p.goto('http://127.0.0.1:4326/', { waitUntil: 'networkidle' }); await p.evaluate(() => document.querySelectorAll('slideshow-component').forEach((s) => s.pause?.(true))); return p; };
try {
  // 2. Desktop: nav labels, mega menu by keyboard
  let p = await page(1440, 900);
  console.log('desktop nav:', await p.$$eval('.header__inline-menu > ul > li', (lis) => lis.map((li) => li.querySelector('summary span, a span')?.textContent.trim())));
  await p.screenshot({ path: `${out}/desktop-header.png`, clip: { x: 0, y: 0, width: 1440, height: 260 } });
  await p.focus('#HeaderMenu-categories');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const opened = await p.$eval('#Details-HeaderMenu-3', (d) => d.open);
  const expanded = await p.getAttribute('#HeaderMenu-categories', 'aria-expanded');
  await p.screenshot({ path: `${out}/desktop-mega.png` });
  await p.keyboard.press('Tab');
  const firstFocus = await p.evaluate(() => document.activeElement.textContent.trim());
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const afterEsc = await p.evaluate(() => [document.querySelector('#Details-HeaderMenu-3').open, document.activeElement.id]);
  // focus leaving the menu closes it
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.focus('.header__icon--account');
  await p.waitForTimeout(100);
  const afterFocusOut = await p.$eval('#Details-HeaderMenu-3', (d) => d.open);
  // mouse: click open, click outside closes
  await p.click('#HeaderMenu-categories'); const clickOpen = await p.$eval('#Details-HeaderMenu-3', (d) => d.open);
  await p.mouse.click(1435, 880); const outsideClosed = !(await p.$eval('#Details-HeaderMenu-3', (d) => d.open));
  console.log({ enterOpens: opened, ariaExpanded: expanded, firstTabTarget: firstFocus, escapeClosesAndRefocuses: afterEsc, closesOnFocusOut: !afterFocusOut, clickOpens: clickOpen, outsideClickCloses: outsideClosed });
  // shortcut anchor from the mega menu
  await p.click('#HeaderMenu-categories'); await p.click('.st-mega__shortcuts .st-shortcut--occasion'); await p.waitForTimeout(400);
  console.log('occasion shortcut -> scrollY', await p.evaluate(() => Math.round(scrollY)), 'panel open:', await p.$eval('#Details-HeaderMenu-3', (d) => d.open));
  // search pill + suggestions
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('.st-search-pill'); await p.waitForTimeout(300);
  console.log('search focus on input:', await p.evaluate(() => document.activeElement.id));
  await p.screenshot({ path: `${out}/desktop-search.png`, clip: { x: 0, y: 0, width: 1440, height: 420 } });
  await p.keyboard.press('Escape');
  // homepage tiles
  const tiles = await p.$$eval('.st-cat-tile', (as) => as.map((a) => `${a.querySelector('.st-cat-tile__label').textContent.trim()} -> ${a.getAttribute('href')}`));
  console.log('tiles:', tiles);
  await p.evaluate(() => document.querySelector('.st-categories').scrollIntoView());
  await p.screenshot({ path: `${out}/desktop-tiles.png` });
  await p.close();

  // 3. Tablet + mobile: drawer > Categories > accordion, tiles
  for (const [w, h] of [[768, 1024], [375, 812]]) {
    p = await page(w, h);
    await p.click('header-drawer summary'); await p.waitForTimeout(350);
    await p.screenshot({ path: `${out}/drawer-${w}.png` });
    await p.click('#HeaderDrawer-categories'); await p.waitForTimeout(350);
    await p.click('.st-drawer-group__summary >> nth=0'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/drawer-categories-${w}.png` });
    await p.click('.st-drawer-shortcuts .st-shortcut--occasion'); await p.waitForTimeout(500);
    console.log(`${w}: drawer closed after occasion shortcut:`, !(await p.$eval('#Details-menu-drawer-container', (d) => d.open)), 'scrollY', await p.evaluate(() => Math.round(scrollY)));
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('header__icons details-modal summary, .header__icons .header__icon--search'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/search-${w}.png` });
    await p.keyboard.press('Escape');
    await p.evaluate(() => document.querySelector('.st-categories').scrollIntoView());
    await p.screenshot({ path: `${out}/tiles-${w}.png` });
    await p.close();
  }
} finally { await b.close(); server.kill(); }
process.exit(0);
