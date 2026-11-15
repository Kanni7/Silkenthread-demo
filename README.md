# SilkenThread redesign concept (private)

A private, editable replica of the https://silkenthread.in storefront, built to prototype a UI/UX
redesign proposal for the store owner. **Not the official SilkenThread store, not a working shop.**
See [SOURCES.md](SOURCES.md) for attribution.

## Status

The whole storefront is built as a static Astro site (about 5,400 pages), with the redesign applied
everywhere. Data was refreshed from the live store on 2026-11-16.

| Page type | Route | Count |
|---|---|---|
| Homepage | `/` | 1 |
| Collections (filters, sort, pagination) | `/collections/{handle}`, `/collections/all`, `/collections` | 156 + 2 |
| Products | `/products/{handle}` | 5,163 |
| Pages (about, contact, hubs, forms …) | `/pages/{handle}` | 20 |
| Policies | `/policies/{handle}` | 5 |
| Blog + articles | `/blogs/silken-stories`, `/blogs/news`, `/blogs/silken-stories/{article}` | 2 + 48 |
| Search, cart, account notice | `/search`, `/cart`, `/account/login` | 3 |

## Run

Requires Node 20+. Playwright uses the locally installed Google Chrome (`channel: 'chrome'`).

```sh
npm install
npm run dev       # local dev server (http://127.0.0.1:4321)
npm run build     # static site -> dist/ (~40 s)
npm run preview   # serve dist/

# Data (polite crawler: robots.txt, 1 request at a time, stops on 429 / connection resets)
npm run data -- --refresh=2026-11-16T00:00:00Z   # re-fetch catalogue JSON older than that date (resumable)
npm run data:offline                             # rebuild src/data/ from .cache/ only
npm run content   # every /pages/* and /blogs/* page -> pages.json, blogs.json (+ blog theme CSS)
npm run styles    # cached theme CSS -> src/styles/original/, tokens.css, global.css (offline)
npm run recon / npm run capture                  # sitemap inventory, reference screenshots

# Checks
node scripts/compare.mjs [page] [width]   # screenshot vs reference/screenshots -> .cache/compare/
node scripts/dev/smoke.mjs                # browser test: filters, paging, sort, search, cart, mobile drawer
```

If the store rate-limits a crawl (HTTP 429 or connection reset), wait 10–15 minutes and re-run the same
command with a slower pace, e.g. `GAP_MS=5000 npm run data -- --refresh=<same date>`. Cached responses
are never fetched twice.

## How it works

- **Images** are not stored in the repo. Every image loads from Shopify's CDN (`cdn.shopify.com`,
  resized with `?width=`), including the ones the live theme serves from `silkenthread.in/cdn/shop/`
  (same files, see `cdnSrc` in `src/lib/data.js`).
- **Collections**: the first 24 products (default sort) are rendered at build time. Filters, sort and
  pagination run in the browser (`src/scripts/collection.js`) from `/data/catalog.json`, a compact
  catalogue built at build time (`src/lib/catalog-codec.js`, ~1.1 MB, gzips to ~0.2 MB). State lives in
  the URL with the live parameter names (`?filter.p.m.custom.materials=Linen&sort_by=price-ascending&page=2`).
  The filter/sort/paging logic (`src/lib/catalog.js`) and the markup (`src/lib/card.js`,
  `src/lib/facets-html.js`) are shared by the build and the browser so both render the same HTML.
- **Search** (`/search?q=`) uses the same grid and filters over the whole catalogue plus tags
  (`/data/search.json`); products whose title contains every word come first.
- **Cart** is a front-end mock (`src/scripts/cart-store.js`, localStorage). Checkout shows a notice and
  each item links to the product on silkenthread.in. Contact, comment and newsletter forms send nothing.
- **Sold-out** products show "Manual Check", as on the live store.
- **Product specs** ("Fabric: …", "Origin: …") only show values read from the product's own text; derived
  guesses (`"mocked": true`) are never shown as facts on product pages. "More about the saree" appears for
  Kanjeevaram products (the only genre text captured).
- **Related products** ("You may also like") are the next available products in the product's smallest
  collection (the live store uses Shopify's recommendations API, which robots.txt disallows).

## Folder structure

```
src/pages/               routes (index, collections/, products/, pages/, policies/, blogs/, search, cart, data/*.json)
src/components/          Craft sections as Astro components (header, footer, product, collection, …)
src/lib/                 data access, catalogue logic, shared card/facet markup, navigation resolver
src/scripts/             browser scripts (header, slider, collection filters, product, cart, forms)
src/styles/              tokens.css, original/ (verbatim theme CSS), concept.css, redesign*.css
src/data/                products, collections, filters, menu, home, pages, blogs, navigation, templates …
scripts/                 recon, capture, data, content, styles, templates, compare; lib/ (polite fetcher, parsers)
scripts/dev/             smoke test, outline/crop/menu helpers
reference/               inventory.json, screenshots/, html/ (rendered DOM of the captured pages)
.cache/                  HTTP cache + build/compare output (git-ignored)
```

## Capture notes and limitations

- Captures run with `prefers-reduced-motion: reduce` so Craft's scroll-reveal animations don't leave
  sections blank in full-page shots. The hero slideshow still autoplays, so the visible slide can
  differ between shots.
- Analytics, pixels, Shop Pay/checkout preloads, captcha and all non-GET requests were blocked during
  capture. Visible third-party widgets (social bar, WhatsApp chat, wishlist) were allowed so the
  screenshots match what customers see.
- The product page's "related products" block is empty in the reference: `/recommendations/products` is
  disallowed by robots.txt, so it was not fetched.
- The header uses Craft's dropdown menus (not a multi-column mega-menu); each top-level dropdown is
  captured open at 1440 px.

## Data notes and limitations

- **Filter attributes are partly mocked.** The live filters use product metafields that the public
  JSON doesn't expose. Each product's `attributes.*` is either derived (`"source": "text"`, `"tags"`,
  `"variant-option/tags"`, `"product-page-html"`) or `"mocked": true`. Coverage across 5,163 products:
  genre 86% derived, material 96%, colour family 97%, Silk Mark 58%, origin 52%, craft 41%,
  dimensions 17%, zari type almost none; blouse and shipping speed are all mocked. The collection
  filters use these values (mocked ones included), so filter results are approximate.
  Only the captured product (`pur2092026kiara`) has real values from its page.
- Collection product counts use the JSON membership list (`productHandles`), which matches the live
  page ("178 products"); `productsCount` from `collections.json` is higher (it counts hidden products).
- Default sort is known only for the two captured collections (`created-descending`); the JSON order
  matches their first page exactly, so other collections use the JSON order.
- Some collection/homepage images are photos uploaded to Shopify as PNG (2–3 MB each at 1500 px), as on the live site.
- Between 2026-10-29 and 2026-11-16 the store removed ~2,300 products, added ~1,700 and deleted 3 collections.
## Style notes

- **Fonts:** body Asul (400/700), headings Libre Caslon Text (400): the same families the live theme
  uses. The replica loads them from Google Fonts instead of Shopify's font CDN; glyphs should match,
  minor hinting differences are possible (checked in Phase 5).
- **Faithful bugs kept:** several live colour-scheme settings are empty (`--color-button-text: ,,;`,
  `--color-link: ,,;`) and `--media-padding: px;` is invalid. They are kept as-is and commented in
  `tokens.css` so the baseline renders like the live site.
- Breakpoints: 750 px (tablet) and 990 px (desktop), as in Dawn/Craft.
- The crawl was interrupted twice by connection resets (no 429/CAPTCHA) and resumed on request.

## Redesign

All work is on `main` (the faithful, pre-redesign homepage is commit `655bb89`). `src/styles/redesign.css`,
loaded last, re-skins every page only through Craft's CSS variables (no markup, data or image changes):

- Palette tokens: turquoise `#00AEB5` (brand), terracotta `#C76B4A` (non-text accents) with a deeper
  step `#A8553A` for filled CTAs/badges (white text 5.2:1), warm ivory `#F5E8D8`, cocoa `#3D2925` (text).
  Semantic roles (`--st-text`, `--st-surface-warm`, `--st-cta`, `--st-accent`) are the knobs to edit.
- Product and collection cards: turquoise frames and panels removed; ivory information panel, cocoa
  text, terracotta hover underline, soft shadow on hover/focus.
- Weaves/Prints/Embroideries band and the footer on warm ivory; hero CTAs terracotta; "View all" cocoa.
- Navigation (`src/data/navigation.json`, resolved against the live menu in `src/lib/nav.js`): header
  reduced to **Bestsellers** (`/collections/all?sort_by=best-selling`), **New Arrivals** (`/pages/whats-new`)
  and a **Categories** mega menu (Iconic Weaves, Prints & Dyes, Embroideries & Trimmings, Search by Fabric,
  each linking to its live hub page) with Shop by occasion / Sale shortcuts. Mobile drawer uses accordions.
  About us / Contact moved to the drawer and the footer's Quick links.
- Search: field-style trigger on desktop, clearer placeholder, quick links to weave/fabric/craft/colour
  collections in the search panel. Queries go to the replica's own `/search` page.
- Homepage: new "Shop by category" section after the hero (`src/components/CategoryTiles.astro`).
- `src/styles/redesign-nav.css` holds the navigation/search/tiles styles.
- Price bands (`src/components/PriceBands.astro`): the four laurel price images are now ivory cards with
  block-print corners and flourishes, live text labels from the price collections' titles, and a
  turquoise hover/focus state. Configured by `priceBands` in `navigation.json`.
- Product carousel drift (`productMarquee` in `navigation.json`, logic in `src/scripts/slider.js`): the
  homepage carousel moves slowly right-to-left in a seamless loop (inert, aria-hidden copies of the cards).
  Pause/play button; pauses on hover, card focus, touch/drag/wheel (resumes after 4 s), off-screen and in
  hidden tabs; does not auto-start with prefers-reduced-motion.
