// Phase 1: full-page screenshots (375/768/1440) + rendered HTML + menu states.
// Every browser request is routed through the polite queue (1 req/s, cached, robots-checked).
// Analytics/pixels are aborted so our captures never pollute the owner's analytics.
// Usage: node scripts/capture.mjs [slugFilter] [width]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { ORIGIN, UA, loadRobots, politeFetch, allowed, StopCrawl } from './lib/polite.mjs';

const WIDTHS = { 375: 812, 768: 1024, 1440: 900 };
const BLOCK = /googletagmanager|google-analytics|googleadservices|doubleclick|analytics\.ahrefs|facebook|fbcdn|pinterest|pinimg|clarity\.ms|hotjar|monorail|\/cdn\/wpm\/|perf-kit|\/checkouts\/|shop-js|hcaptcha|recaptcha|tiktok|snap|bing\.com|trekkie|\/api\/collect|\/web-pixels/i;
const [, , onlySlug, onlyWidth] = process.argv;
const SHOTS = 'reference/screenshots', HTML = 'reference/html';
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(HTML, { recursive: true });

await loadRobots();

// Pick the first product from the curated Kanjivarams collection as "one product page".
const coll = (await politeFetch(ORIGIN + '/collections/the-curated-kanjivarams')).body.toString('utf8');
const productPath = (coll.match(/href="(\/collections\/the-curated-kanjivarams\/products\/[^"?#]+|\/products\/[^"?#]+)"/) || [])[1];
const productHandle = productPath.split('/products/')[1];

const PAGES = [
  ['home', '/'],
  ['collection-the-curated-kanjivarams', '/collections/the-curated-kanjivarams'],
  ['collection-sale', '/collections/sale'],
  [`product-${productHandle}`, `/products/${productHandle}`],
  ['page-about-silken-thread', '/pages/about-silken-thread'],
  ['page-contact', '/pages/contact'],
  ['page-whats-new', '/pages/whats-new'],
  ['page-size-chart', '/pages/size-chart'],
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let inflight = 0, blocked = new Set();

async function newPage(width) {
  const ctx = await browser.newContext({
    viewport: { width: +width, height: WIDTHS[width] }, userAgent: UA, serviceWorkers: 'block',
    reducedMotion: 'reduce', locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  });
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (!/^https?:/.test(url)) return route.continue();
    if (req.method() !== 'GET' || BLOCK.test(url) || !allowed(url)) { blocked.add(url.replace(/\?.*/, '')); return route.abort('blockedbyclient'); }
    inflight++;
    try {
      const res = await politeFetch(url);
      const headers = { ...res.headers };
      for (const h of ['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'content-security-policy']) delete headers[h];
      await route.fulfill({ status: res.status, headers, body: res.body });
    } catch (e) {
      if (e instanceof StopCrawl) { console.error(e.message); process.exit(2); }
      await route.abort('failed').catch(() => {});
    } finally { inflight--; }
  });
  return ctx.newPage();
}

async function settle(page, quietMs = 2500, maxMs = 240000) {
  const start = Date.now(); let quietSince = Date.now();
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(250);
    if (inflight > 0) quietSince = Date.now();
    else if (Date.now() - quietSince > quietMs) return;
  }
  console.warn('  settle timeout');
}

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => innerHeight * 0.8);
  for (let y = 0; y < h; y += step) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(150); await settle(page, 600); }
  await page.evaluate(() => scrollTo(0, 0));
  await settle(page);
}

for (const [slug, path] of PAGES) {
  if (onlySlug && !slug.includes(onlySlug)) continue;
  for (const width of Object.keys(WIDTHS)) {
    if (onlyWidth && width !== onlyWidth) continue;
    console.log(`> ${slug} @ ${width}`);
    const page = await newPage(width);
    await page.goto(ORIGIN + path, { waitUntil: 'load', timeout: 300000 });
    await settle(page);
    await scrollThrough(page);
    await page.screenshot({ path: `${SHOTS}/${slug}-${width}.png`, fullPage: true });
    if (width === '1440') fs.writeFileSync(`${HTML}/${slug}.html`, await page.content());
    if (width === '375') fs.writeFileSync(`${HTML}/${slug}-mobile.html`, await page.content());

    // Menu states on the home page only (header is shared by all templates).
    if (slug === 'home' && width === '1440') {
      const tops = page.locator('.header__inline-menu details > summary');
      const n = await tops.count();
      for (let i = 0; i < n; i++) {
        const label = ((await tops.nth(i).innerText()).trim() || `menu-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await tops.nth(i).click();
        await settle(page, 1500);
        await page.screenshot({ path: `${SHOTS}/menu-desktop-${i + 1}-${label}-1440.png` });
        await tops.nth(i).click();
        await page.waitForTimeout(300);
      }
    }
    if (slug === 'home' && width === '375') {
      await page.locator('header-drawer summary, .header__icon--menu').first().click();
      await settle(page, 1500);
      await page.screenshot({ path: `${SHOTS}/menu-mobile-drawer-375.png` });
      const sub = page.locator('#menu-drawer .menu-drawer__menu details > summary').first();
      if (await sub.count()) {
        await sub.click(); await settle(page, 1500);
        await page.screenshot({ path: `${SHOTS}/menu-mobile-drawer-submenu-375.png` });
      }
    }
    await page.context().close();
  }
}
await browser.close();
fs.writeFileSync('reference/capture-log.json', JSON.stringify({ capturedAt: new Date().toISOString(), productHandle, pages: PAGES, widths: WIDTHS, reducedMotion: true, blockedRequests: [...blocked].sort() }, null, 2));
console.log('done; blocked', blocked.size, 'requests');
