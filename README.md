# SilkenThread redesign concept (private)

A private, editable replica of the https://silkenthread.in storefront, built to prototype a UI/UX
redesign proposal for the store owner. **Not the official SilkenThread store, not a working shop.**
See [SOURCES.md](SOURCES.md) for attribution.

## Status

| Phase | State |
|---|---|
| 1. Recon (inventory, screenshots, rendered HTML) | done |
| 2. Data | – |
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
