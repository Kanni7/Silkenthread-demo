// Phase 3: theme stylesheets -> src/styles/original/, design tokens -> src/styles/tokens.css
// Runs from .cache/ only (no network): node scripts/styles.mjs --offline
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ORIGIN, cached } from './lib/polite.mjs';
import { load } from './lib/parse.mjs';

const ORIG = 'src/styles/original';
fs.mkdirSync(ORIG, { recursive: true });
const abs = (u) => new URL(u.startsWith('//') ? 'https:' + u : u, ORIGIN).toString();

// ---------- 1. linked stylesheets + inline head styles ----------
const sheets = new Map(); // url -> first page seen
// Visit pages home -> collection -> product -> the rest, so first-seen order mirrors how a visitor loads CSS.
const rank = (f) => (f === 'home.html' ? 0 : f.startsWith('collection-the') ? 1 : f.startsWith('product-') ? 2 : 3);
const htmlFiles = fs.readdirSync('reference/html').filter((f) => !f.endsWith('-mobile.html')).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
for (const f of htmlFiles) {
  const $ = load(fs.readFileSync(`reference/html/${f}`, 'utf8'));
  $('link[href*=".css"]').each((i, l) => { const rel = l.attribs.rel || '', as = l.attribs.as || ''; if (/stylesheet/.test(rel) || as === 'style') { const u = abs(l.attribs.href); if (!sheets.has(u)) sheets.set(u, f); } });
}
const copied = [], missing = [];
for (const [url, page] of sheets) {
  const hit = cached(url);
  if (!hit || hit.status !== 200) { missing.push(url); continue; }
  const u = new URL(url);
  const name = (u.hostname.includes('cdn.shopify.com') ? 'app-' + u.pathname.split('/').slice(-3, -2)[0].replace(/-\d+$/, '') + '-' : '') + path.basename(u.pathname);
  fs.writeFileSync(`${ORIG}/${name}`, `/* Source: ${url}\n   First seen on: ${page}. Verbatim copy, (c) Shopify / app vendor. Reference only. */\n` + hit.body.toString('utf8'));
  copied.push({ file: name, url, app: u.hostname.includes('cdn.shopify.com') });
}
const $home = load(fs.readFileSync('reference/html/home.html', 'utf8'));
const inline = $home('head style').map((i, s) => `/* --- inline <style> #${i + 1}${s.attribs.id ? ` id="${s.attribs.id}"` : ''} --- */\n${$home(s).html().trim()}`).get().join('\n\n');
fs.writeFileSync(`${ORIG}/theme-inline.css`, `/* Inline <head> styles from https://silkenthread.in/ (theme.liquid): fonts, colour schemes, :root settings. Verbatim. */\n${inline}\n`);

// ---------- 2. parse :root settings + colour schemes from the inline styles ----------
const schemeBlocks = [...inline.matchAll(/([^{}]*?(?:\.color-[\w-]+|:root)[^{}]*)\{([^{}]*--color-background:[^{}]*)\}/g)]
  .map((m) => ({ selector: m[1].replace(/\s+/g, ' ').trim(), vars: [...m[2].matchAll(/(--[\w-]+):\s*([^;]*);/g)].map((v) => [v[1], v[2].trim()]) }));
const rootVars = [...inline.matchAll(/:root\s*\{([^{}]*--font-body-family[^{}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(--[\w-]+):\s*([^;]*);/g)].map((v) => [v[1], v[2].trim()]));
const schemeRule = (inline.match(/body,\s*\.color-background-1[^{]*\{[^}]*\}/) || [''])[0];

// ---------- 3. computed styles via Playwright (saved DOM, JS off, CSS from cache) ----------
const PAGES = { home: '/', collection: '/collections/the-curated-kanjivarams', product: `/products/${JSON.parse(fs.readFileSync('reference/capture-log.json', 'utf8')).productHandle}` };
const FILES = { home: 'home', collection: 'collection-the-curated-kanjivarams', product: `product-${JSON.parse(fs.readFileSync('reference/capture-log.json', 'utf8')).productHandle}` };
const browser = await chromium.launch({ channel: 'chrome' });
const computed = {};
for (const width of [375, 768, 1440]) {
  computed[width] = {};
  for (const [key, p] of Object.entries(PAGES)) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, reducedMotion: 'reduce' });
    await ctx.route('**/*', (route) => {
      const url = route.request().url();
      if (url === ORIGIN + p) return route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(`reference/html/${FILES[key]}.html`) });
      const hit = /^https?:/.test(url) && cached(url);
      if (!hit) return route.abort();
      const headers = { ...hit.headers }; for (const h of ['content-encoding', 'content-length', 'transfer-encoding', 'content-security-policy']) delete headers[h];
      return route.fulfill({ status: hit.status, headers, body: hit.body });
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + p, { waitUntil: 'load' });
    computed[width][key] = await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const pick = (sel) => {
        const el = document.querySelector(sel); if (!el) return null;
        const s = cs(el);
        return { fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, color: s.color, background: s.backgroundColor, padding: s.padding, margin: s.margin, radius: s.borderRadius, border: s.border, shadow: s.boxShadow, height: Math.round(el.getBoundingClientRect().height), width: Math.round(el.getBoundingClientRect().width) };
      };
      // Type scale: probe Craft's heading classes in an isolated container
      const probe = document.createElement('div'); probe.className = 'page-width'; document.body.appendChild(probe);
      const type = {};
      for (const c of ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'caption', 'caption-large', 'body']) {
        const el = document.createElement(c.startsWith('h') ? 'p' : 'span'); el.className = c === 'body' ? '' : c; el.textContent = 'Aa'; probe.appendChild(el);
        const s = cs(el); type[c] = { fontFamily: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontWeight: s.fontWeight };
      }
      probe.remove();
      const freq = (prop, filter = () => true) => { const m = {}; for (const el of document.querySelectorAll('body *')) { const v = cs(el)[prop]; if (v && filter(v)) m[v] = (m[v] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25); };
      const sectionPadding = [...document.querySelectorAll('[class*="section-"][class*="-padding"]')].map((el) => { const s = cs(el); return [el.className.match(/section-[\w-]+-padding/)?.[0]?.replace(/template--\d+__/, ''), s.paddingTop, s.paddingBottom]; });
      const grid = document.querySelector('.grid'); const gs = grid && cs(grid);
      return {
        root: Object.fromEntries([...Array.from(document.styleSheets).flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } })]
          .filter((r) => r.selectorText && /:root/.test(r.selectorText)).flatMap((r) => [...r.style]).filter((n) => n.startsWith('--')).map((n) => [n, cs(document.documentElement).getPropertyValue(n).trim()])),
        type,
        elements: {
          body: pick('body'), announcement: pick('.announcement-bar'), announcementText: pick('.announcement-bar__message'), header: pick('.header'), headerWrapper: pick('.header-wrapper'),
          menuItem: pick('.header__menu-item'), logo: pick('.header__heading-logo'), sectionTitle: pick('.title'), button: pick('.button:not(.button--secondary)'), buttonSecondary: pick('.button--secondary'),
          card: pick('.card'), cardHeading: pick('.card__heading'), price: pick('.price'), priceItem: pick('.price-item'), badge: pick('.badge'), input: pick('.field__input'), footer: pick('.footer'),
          footerHeading: pick('.footer-block__heading'), productTitle: pick('.product__title h1, .product__title'), facetSummary: pick('.facets__summary'), pagination: pick('.pagination__item'),
          bannerHeading: pick('.banner__heading'), slideshowControls: pick('.slider-buttons'), rte: pick('.rte p'),
        },
        colors: freq('color'), backgrounds: freq('backgroundColor', (v) => v !== 'rgba(0, 0, 0, 0)'), borders: freq('borderTopColor'),
        radii: freq('borderTopLeftRadius', (v) => v !== '0px'), shadows: freq('boxShadow', (v) => v !== 'none'),
        fontSizes: freq('fontSize'), families: freq('fontFamily'), sectionPadding,
        grid: gs ? { columnGap: gs.columnGap, rowGap: gs.rowGap } : null,
      };
    });
    await ctx.close();
  }
}
await browser.close();

// ---------- 4. breakpoints from the original CSS ----------
const bp = {};
for (const f of fs.readdirSync(ORIG)) for (const m of fs.readFileSync(`${ORIG}/${f}`, 'utf8').matchAll(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g)) bp[`${m[1]} ${m[2]}px`] = (bp[`${m[1]} ${m[2]}px`] || 0) + 1;
const breakpoints = Object.entries(bp).sort((a, b) => b[1] - a[1]);

fs.writeFileSync('reference/styles-report.json', JSON.stringify({ copied, missing, schemeBlocks, rootVars, breakpoints, computed }, null, 1));

// ---------- 5. tokens.css ----------
const PALETTE = { '0,173,181': 'teal', '18,18,18': 'ink', '7,8,8': 'black', '255,255,255': 'white', '239,236,236': 'mist', '44,51,47': 'charcoal', '191,191,191': 'grey-contrast', '0,51,54': 'teal-deep', '127,143,143': 'slate' };
const hex = (t) => '#' + t.split(',').map((n) => (+n).toString(16).padStart(2, '0')).join('');
const triples = [...new Set(schemeBlocks.flatMap((b) => b.vars.map(([, v]) => v)).filter((v) => /^\d+,\d+,\d+$/.test(v)))];
triples.forEach((t, i) => { PALETTE[t] ||= `extra-${i}`; });
const colourRef = (v) => (PALETTE[v] ? `var(--st-${PALETTE[v]})` : v);
const desk = computed[1440].home, mob = computed[375].home, tab = computed[768].home;
const fontVar = Object.fromEntries(rootVars);
const group = (re) => rootVars.filter(([n]) => re.test(n)).map(([n, v]) => `  ${n}: ${v};`).join('\n');
const typeRows = (w) => Object.entries(computed[w].home.type).map(([k, t]) => `  --st-type-${k}: ${t.fontSize}; /* line-height ${t.lineHeight}, ${t.fontFamily.split(',')[0]} */`).join('\n');
const used = new Set();
const groups = [
  ['Shadows', /shadow/], ['Radii', /radius/], ['Borders & opacity', /border|opacity/],
  ['Spacing & layout', /spacing|padding|margin|page-width|gap|columns|grid|width$/],
];
const groupBlocks = groups.map(([label, re]) => { const rows = rootVars.filter(([n]) => re.test(n) && !used.has(n) && !/^--font|^--color/.test(n)); rows.forEach(([n]) => used.add(n)); return `  /* ${label} */\n${rows.map(([n, v]) => `  ${n}: ${v};`).join('\n')}`; }).join('\n\n');
const rest = rootVars.filter(([n]) => !used.has(n) && !/^--font/.test(n)).map(([n, v]) => `  ${n}: ${v};`).join('\n');

const css = `/* =========================================================================
   Design tokens - extracted from silkenthread.in (Shopify Craft 12.0.0)
   Generated by scripts/styles.mjs from the theme's inline settings and from
   computed styles of the saved pages at 375 / 768 / 1440 px. Edit tokens here:
   the Craft variables below (used unchanged by src/styles/original/*.css)
   reference the --st-* palette and fonts, so one edit changes every page.
   ========================================================================= */

/* Fonts: Asul + Libre Caslon Text, both free on Google Fonts (the live theme serves the same families from
   Shopify's font CDN). Loaded with a <link> in src/layouts/Base.astro (FONT_URL). */

:root {
  /* ---- Palette (r,g,b triples: Craft uses rgb(var(--x)) / rgba(var(--x), a)) ---- */
${Object.entries(PALETTE).filter(([t]) => triples.includes(t)).map(([t, n]) => `  --st-${n}: ${t}; /* ${hex(t)} */`).join('\n')}

  /* ---- Font families ---- */
  --st-font-body: ${fontVar['--font-body-family']};
  --st-font-heading: ${fontVar['--font-heading-family']};

  /* ---- Type scale, computed (mobile default; tablet/desktop overrides below). Reference only:
          Craft computes these itself from --font-body-scale / --font-heading-scale. ---- */
${typeRows(375)}

  /* ---- Breakpoints (CSS variables can't be used inside @media; listed for reference) ----
     Most used in the theme CSS: ${breakpoints.slice(0, 6).map(([k, n]) => `${k} (${n}x)`).join(', ')} */
  --st-bp-tablet: 750px;
  --st-bp-desktop: 990px;

  /* ---- Craft :root settings (from theme.liquid) ---- */
  --font-body-family: var(--st-font-body);
  --font-heading-family: var(--st-font-heading);
${rootVars.filter(([n]) => /^--font/.test(n) && !/family/.test(n)).map(([n, v]) => `  ${n}: ${v};`).join('\n')}

${groupBlocks}

  /* Other settings */
${rest}
}

@media screen and (min-width: 750px) {
  :root {
${typeRows(768).replace(/^/gm, '  ')}
  }
}
@media screen and (min-width: 990px) {
  :root {
${typeRows(1440).replace(/^/gm, '  ')}
  }
}

/* ---- Colour schemes (Craft section settings). Values marked "empty" are blank in the live theme
        settings (renders as invalid colour) - reproduced faithfully for the baseline. ---- */
${schemeBlocks.map((b) => `${b.selector} {\n${b.vars.map(([n, v]) => `  ${n}: ${/^\d+,\d+,\d+$/.test(v) ? colourRef(v) : v};${/^,,$/.test(v) ? ' /* empty in live theme */' : ''}`).join('\n')}\n}`).join('\n\n')}

${schemeRule}
`;
fs.writeFileSync('src/styles/tokens.css', css);

// ---------- 6. global.css: theme CSS in the order the live pages load it (apps/checkout stripped) ----------
const SKIP = /^app-|accelerated-checkout|theme-inline/;
const imports = ['./tokens.css', './theme-base.css', ...copied.filter((c) => !SKIP.test(c.file)).map((c) => `./original/${c.file}`), './concept.css', ...(fs.existsSync('src/styles/redesign.css') ? ['./redesign.css'] : [])];
fs.writeFileSync('src/styles/global.css', '/* Generated by scripts/styles.mjs. Order matters: tokens + base rules, then theme CSS in live load order. */\n' + imports.map((f) => `@import '${f}';`).join('\n') + '\n');

console.log({ copied: copied.length, apps: copied.filter((c) => c.app).length, missing, schemes: schemeBlocks.length, rootVars: rootVars.length, breakpoints: breakpoints.slice(0, 8) });
console.log('type 1440', JSON.stringify(desk.type));
console.log('type 375', JSON.stringify(mob.type));
console.log('elements 1440', JSON.stringify(desk.elements).slice(0, 2500));
