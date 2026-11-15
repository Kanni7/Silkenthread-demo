// Browser smoke test of the interactive pages against the built site (astro preview).
// Usage: npm run build && node scripts/dev/smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn('npx astro preview --port 4323', { shell: true, stdio: 'pipe' });
await new Promise((resolve) => server.stdout.on('data', (d) => /localhost|127\.0\.0\.1/.test(d) && resolve()));
const BASE = 'http://127.0.0.1:4323';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/cdn\.shopify|silkenthread\.in|Failed to load resource/.test(m.text()) && errors.push(m.text()));

  // Collection: filter, count, URL, pagination, sort
  await page.goto(`${BASE}/collections/the-curated-kanjivarams`);
  const total = await page.textContent('#ProductCountDesktop');
  await page.locator('#FacetFiltersForm details').nth(3).locator('summary').click(); // Colour family
  const colour = page.locator('#FacetFiltersForm input[name="filter.v.m.custom.colourfamily"]').first();
  const colourValue = await colour.getAttribute('value');
  await colour.check({ force: true });
  await page.waitForFunction((t) => document.querySelector('#ProductCountDesktop').textContent !== t, total);
  const filtered = await page.textContent('#ProductCountDesktop');
  check('collection filter narrows results', parseInt(filtered) < parseInt(total), `${total.trim()} -> ${filtered.trim()} (${colourValue})`);
  check('filter is in the URL', page.url().includes('filter.v.m.custom.colourfamily='));
  check('active filter pill shown', (await page.locator('.active-facets-desktop .active-facets__button').count()) === 1);
  await page.locator('.active-facets-desktop .active-facets__button-remove').click();
  await page.waitForFunction((t) => document.querySelector('#ProductCountDesktop').textContent === t, total);
  check('remove all restores results', true);
  await page.locator('.pagination a[data-page="2"]').first().click();
  await page.waitForURL(/page=2/);
  const firstOnPage2 = await page.locator('#product-grid li').first().textContent();
  check('pagination to page 2', page.url().includes('page=2') && (await page.locator('#product-grid li').count()) > 0);
  await page.selectOption('#SortBy', 'price-ascending');
  await page.waitForURL(/sort_by=price-ascending/);
  const prices = await page.locator('#product-grid .card__content .price__regular .price-item--regular').allTextContents();
  const nums = prices.map((p) => +p.replace('Rs.', '').replace(/[^\d.]/g, ''));
  check('sort by price ascending', nums.every((n, i) => i === 0 || n >= nums[i - 1]) && !page.url().includes('page=2'), nums.slice(0, 4).join(', '));
  await page.goBack();
  await page.waitForURL(/page=2/);
  check('back button restores state', (await page.locator('#product-grid li').first().textContent()) === firstOnPage2);

  // Deep link with filters
  await page.goto(`${BASE}/collections/all?filter.p.m.custom.materials=Linen&sort_by=price-descending`);
  await page.waitForFunction(() => !document.querySelector('[data-collection]').classList.contains('loading') && document.querySelector('#ProductCountDesktop').textContent.trim() !== '5767 products');
  check('deep link applies filter + sort', (await page.textContent('#ProductCountDesktop')).trim() !== '5767 products', (await page.textContent('#ProductCountDesktop')).trim());

  // Search
  await page.goto(`${BASE}/search?q=ikat`);
  await page.waitForFunction(() => document.querySelectorAll('#product-grid li').length > 0);
  const titles = await page.locator('#product-grid .card__heading.h5').allTextContents();
  check('search finds products', titles.length > 0 && /ikat/i.test(titles[0]), `${(await page.textContent('#ProductCountDesktop')).trim()}, first: ${titles[0]?.trim()}`);

  // Product: add to cart -> bubble -> cart page
  await page.goto(`${BASE}/collections/the-curated-kanjivarams`);
  await page.evaluate(() => localStorage.clear());
  const firstAvailable = await page.evaluate(async () => {
    const r = await fetch('/data/catalog.json').then((x) => x.json());
    return r.rows.find((row) => row[5] === 1)[1];
  });
  await page.goto(`${BASE}/products/${firstAvailable}`);
  await page.click('.product-form__submit');
  await page.waitForSelector('#cart-icon-bubble .cart-count-bubble');
  check('add to cart updates header bubble', (await page.textContent('#cart-icon-bubble .cart-count-bubble span')).trim() === '1');
  await page.goto(`${BASE}/cart`);
  await page.waitForSelector('.cart-item');
  check('cart lists the item', (await page.locator('.cart-item').count()) === 1);
  await page.click('[data-qty="1"]');
  check('cart quantity +1', (await page.inputValue('.quantity__input')) === '2');
  await page.click('[data-cart-checkout]');
  check('checkout shows concept notice', await page.isVisible('[data-cart-notice]'));

  // Mobile filter drawer
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto(`${BASE}/collections/the-curated-kanjivarams`);
  await m.click('.mobile-facets__open-wrapper');
  await m.waitForSelector('.mobile-facets__disclosure.menu-opening');
  await m.locator('.mobile-facets__details summary').first().click();
  await m.waitForSelector('.mobile-facets__details.menu-opening');
  await m.locator('.mobile-facets__details.menu-opening .mobile-facets__label').first().click();
  await m.waitForURL(/filter\./);
  await m.locator('.mobile-facets__details.menu-opening [data-facets-apply]').click();
  await m.waitForFunction(() => !document.querySelector('.mobile-facets__disclosure').open);
  check('mobile filter drawer applies a filter', m.url().includes('filter.'));

  check('no JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
  setTimeout(() => process.exit(), 500);
}
