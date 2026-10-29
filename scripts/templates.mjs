// Phase 4: template-level structure from the saved HTML (offline).
// -> src/data/templates.json (section ids, wrapper classes, <style> blocks, spec icons)
// -> src/data/icons.json (inline SVG icons by name)
import fs from 'node:fs';
import { load, txt, image, cleanClass } from './lib/parse.mjs';

const capture = JSON.parse(fs.readFileSync('reference/capture-log.json', 'utf8'));
const html = (f) => load(fs.readFileSync(`reference/html/${f}.html`, 'utf8'));
const $h = html('home'), $c = html('collection-the-curated-kanjivarams'), $p = html(`product-${capture.productHandle}`);

const section = ($, suffix) => {
  const s = $(`[id^="shopify-section-"][id$="${suffix}"]`).first();
  if (!s.length) return null;
  return { id: s.attr('id').replace(/^shopify-section-/, ''), tag: s[0].name, class: cleanClass(s.attr('class')), style: s.find('style').map((i, e) => $(e).html().trim()).get().join('\n') || null };
};
const cls = ($, sel) => cleanClass($(sel).first().attr('class')) || null;
const sty = ($, sel) => $(sel).first().attr('style') || null;
const svgOrImg = ($, el) => {
  const svg = el.find('svg').first();
  if (svg.length) return { svg: $.html(svg).replace(/\s+/g, ' ') };
  const im = image($, el.find('img').first());
  return im ? { img: im } : null;
};

// ---------- icons ----------
const icons = {};
for (const f of fs.readdirSync('reference/html')) {
  const $ = load(fs.readFileSync(`reference/html/${f}`, 'utf8'));
  $('svg[class*="icon-"]').each((i, s) => {
    const name = (($(s).attr('class') || '').match(/icon-[\w-]+/g) || []).filter((x) => x !== 'icon-wrap' && x !== 'icon-accordion').pop();
    if (name && !icons[name.replace(/^icon-/, '')]) icons[name.replace(/^icon-/, '')] = $.html(s).replace(/\s+/g, ' ').replace(/ class="[^"]*"/, '');
  });
}
fs.writeFileSync('src/data/icons.json', JSON.stringify(icons, null, 1));

// ---------- section groups (shared header/footer) ----------
const groups = {
  announcement: { ...section($h, '__announcement-bar'), utilityBar: cls($h, '.utility-bar'), speed: +$h('.announcement-bar [data-speed]').attr('data-speed') || 4, autoplay: $h('.announcement-bar [data-autoplay]').attr('data-autoplay') === 'true' },
  header: {
    ...section($h, '__header'), wrapper: cls($h, '.header-wrapper'), header: cls($h, 'header.header'), drawer: cls($h, '#menu-drawer'),
    drawerSubmenu: cls($h, '.menu-drawer__submenu'), dropdown: cls($h, '.header__submenu'), searchModal: cls($h, '.search-modal'),
    logoWidth: +$h('.header__heading-logo').attr('width') || null, logoHeight: +$h('.header__heading-logo').attr('height') || null,
    // Hidden <symbol> sprite referenced by <use href="#icon-search"> (search icon).
    sprite: $h.html($h('[id$="__header"] > svg.hidden').first()).replace(/\s+/g, ' ') || null,
    social: $h('#menu-drawer .list-social a').map((i, a) => ({ href: $h(a).attr('href'), label: txt($h(a).find('.visually-hidden').text()), icon: (($h(a).find('svg').attr('class') || '').match(/icon-([\w-]+)/) || [])[1] })).get(),
  },
  preFooter: { ...section($h, '__custom_liquid_tk7NdT'), inner: cls($h, '[id$="__custom_liquid_tk7NdT"] > div'), padding: cls($h, '[id$="__custom_liquid_tk7NdT"] [class*="-padding"]') },
  footer: { ...section($h, '__footer'), footer: cls($h, 'footer.footer'), blocksWrapper: cls($h, '.footer__blocks-wrapper'), block: cls($h, '.footer-block'), menuBlock: cls($h, '.footer-block--menu'), newsletter: cls($h, '.footer-block--newsletter'), bottom: cls($h, '.footer__content-bottom') },
};

// ---------- collection template ----------
const collection = {
  banner: { ...section($c, '__main-collection-banner'), hero: cls($c, '.collection-hero'), heroInner: cls($c, '.collection-hero__inner') },
  grid: {
    ...section($c, '__main-collection-product-grid'), padding: cls($c, '[id$="__main-collection-product-grid"] > div'),
    productGrid: cls($c, '#product-grid'), item: cls($c, '#product-grid > li'),
    card: cls($c, '#product-grid .product-card-wrapper .card'), cardStyle: sty($c, '#product-grid .product-card-wrapper .card'),
    cardInnerStyle: sty($c, '#product-grid .card__inner'), imageSizes: $c('#product-grid .card__media img').first().attr('sizes'),
  },
};

// ---------- product template ----------
const ATTR = { Fabric: 'materials', Dimensions: 'dimensions', 'Zari Specifications': 'zari_type', Origin: 'origin', Genre: 'weaving_genre', 'Craft Summary': 'craft' };
const specs = $p('.product__info-container ul.icon-with-text--horizontal li').map((i, li) => {
  const L = $p(li), text = txt(L.text()), a = L.find('a').first();
  const m = text.match(/^([^:]+):\s*(.*)$/);
  return { label: m ? m[1] : text, attribute: m ? ATTR[m[1]] || null : null, href: a.attr('href') || null, icon: svgOrImg($p, L), listClass: cleanClass(L.parent().attr('class')) };
}).get();
const product = {
  main: { ...section($p, '__main'), sectionInner: cls($p, '[id^="MainProduct-"]'), product: cls($p, '.product'), mediaWrapper: cls($p, '.product__media-wrapper'), mediaList: cls($p, '.product__media-list'), mediaItem: cls($p, '.product__media-item'), mediaContainer: cls($p, '.product-media-container'), mediaContainerStyle: sty($p, '.product-media-container'), infoWrapper: cls($p, '.product__info-wrapper'), imageSizes: $p('.product__media img').first().attr('sizes') },
  related: section($p, '__related-products'),
  whatsappIcon: svgOrImg($p, $p('.product__info-container ul.icon-with-text--vertical li').first()),
  specs,
  accordionIcons: $p('.product__accordion summary').map((i, s) => ({ heading: txt($p(s).find('h2').text()), svg: $p.html($p(s).find('svg').first()).replace(/\s+/g, ' ') })).get(),
  moreAboutByGenre: { Kanjeevaram: $p('.product__accordion').first().find('.accordion__content').html()?.trim() || null },
};

// ---------- page templates ----------
const pageMain = (f) => { const $ = html(f); return { ...section($, '__main'), container: cls($, '[id$="__main"] .page-width') }; };
const page = { main: pageMain('page-about-silken-thread') };

fs.writeFileSync('src/data/templates.json', JSON.stringify({ groups, collection, product, page }, null, 1));
console.log('icons', Object.keys(icons).length, Object.keys(icons).join(' '));
console.log('specs', specs.map((s) => `${s.label}->${s.attribute || s.href}(${s.icon ? Object.keys(s.icon)[0] : '-'})`).join(', '));
console.log('groups', Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v?.id])));
