# SilkenThread redesign concept (private)

A private, editable replica of the https://silkenthread.in storefront, built to prototype a UI/UX
redesign proposal for the store owner. **Not the official SilkenThread store, not a working shop.**
See [SOURCES.md](SOURCES.md) for attribution.

## Status

| Phase | State |
|---|---|
| 1. Recon (inventory, screenshots, rendered HTML) | done |
| 2. Data (JSON endpoints, normalised data, images) | done |
| 3. Styles | – |
| 4. Components and pages (Astro) | – |
| 5. Fidelity check → tag `v0-baseline` | – |
| 6. Redesign (`redesign` branch) | – |

## Run

Requires Node 20+. Playwright uses the locally installed Google Chrome (`channel: 'chrome'`), so no
browser download is needed.

```sh
npm install
npm run recon     # robots.txt + sitemaps -> reference/inventory.json
npm run capture   # screenshots + rendered HTML -> reference/  (optional: npm run capture -- home 1440)
npm run data      # public Shopify JSON + saved HTML -> src/data/*.json
npm run data:offline  # same, but only from .cache/ (never touches the network)
npm run images    # images used on the captured pages, width=1000 -> public/images/
```

`npm run dev` / `npm run build` arrive with the Astro site in Phase 4.

## Folder structure

```
scripts/lib/polite.mjs   polite fetcher: robots.txt, 1 req/s serial queue, UA, .cache/ disk cache, stops on blocks
scripts/recon.mjs        sitemap crawl -> reference/inventory.json
scripts/capture.mjs      Playwright captures (every browser request goes through the polite queue)
reference/inventory.json every product, collection, page and blog URL from the sitemaps
reference/screenshots/   {page}-{375|768|1440}.png, menu-desktop-*.png, menu-mobile-drawer*.png
reference/html/          rendered DOM per page ({page}.html at 1440, {page}-mobile.html at 375)
reference/capture-log.json   product picked, widths, list of blocked third-party requests
scripts/data.mjs         builds src/data/ ; scripts/lib/parse.mjs = Craft/Dawn section parsers
scripts/images.mjs       downloads images referenced by reference/html/ -> public/images/
src/data/products.json   5,767 products: variants, images, collections, derived/mocked filter attributes
src/data/collections.json  158 collections + built-in "all", ordered product handles, default sort
src/data/filters.json    facet definitions (labels, params, values) taken from the live filter sidebar
src/data/menu.json       announcements, logo, main menu tree, footer blocks/newsletter/policies
src/data/home.json       homepage sections in order (type, items, colour scheme classes, padding CSS)
src/data/pages.json      about, contact, what's new, size chart, refund/shipping pages, 5 /policies/
src/data/product-template.json  shared product-page bits (WhatsApp link, policy links, accordions)
src/data/site.json       money format, products per page (24), sort options
src/data/images.json     imageKey -> local /images/... path (anything not listed uses the Shopify CDN)
public/images/           135 images used on the replicated pages (~97 MB)
docs/                    audit.md (UI/UX audit), later CHANGES.md and compare/
.cache/                  HTTP cache (git-ignored)
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
  `"variant-option/tags"`, `"product-page-html"`) or `"mocked": true`. Coverage across 5,767 products:
  genre 86% derived, material 96%, colour family 97%, Silk Mark 58%, origin 53%, craft 36%,
  dimensions 20%, zari type 5 products only; blouse and shipping speed are all mocked.
  Only the captured product (`pur2092026kiara`) has real values from its page.
- Collection product counts use the JSON membership list (`productHandles`), which matches the live
  page ("178 products"); `productsCount` from `collections.json` is higher (it counts hidden products).
- Default sort is known only for the two captured collections (`created-descending`); the JSON order
  matches their first page exactly, so other collections use the JSON order.
- 51 of the downloaded images are photos uploaded to Shopify as PNG (2–3 MB each at 1000 px).
- The crawl was interrupted twice by connection resets (no 429/CAPTCHA) and resumed on request.
