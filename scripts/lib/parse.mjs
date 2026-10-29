// Shared HTML-parsing helpers for Craft/Dawn theme markup (cheerio).
import * as cheerio from 'cheerio';

export const load = (html) => cheerio.load(html);
export { cleanClass };
export const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Canonical image key for a Shopify file: "files/NAME.jpg" (same for cdn.shopify.com and /cdn/shop URLs).
// Nested folders are kept, e.g. "files/preview_images/NAME.jpg" (video thumbnails).
export function imageKey(url) {
  if (!url) return null;
  const u = new URL(url.startsWith('//') ? 'https:' + url : url, 'https://silkenthread.in');
  const m = u.pathname.match(/\/(?:cdn\/shop|s\/files\/\d+\/\d+\/\d+\/\d+)\/(files|products|collections|articles)\/(.+)$/);
  return m ? `${m[1]}/${decodeURIComponent(m[2])}` : null;
}

// Strip width/height/crop params so the URL can be re-sized later.
export function baseImageUrl(url) {
  if (!url) return null;
  const u = new URL(url.startsWith('//') ? 'https:' + url : url, 'https://silkenthread.in');
  for (const p of ['width', 'height', 'crop']) u.searchParams.delete(p);
  return u.toString();
}

export function image($, el) {
  const img = el && (el.is('img') ? el : el.find('img').first());
  if (!img || !img.length) return null;
  const src = img.attr('src') || img.attr('data-src') || (img.attr('srcset') || '').split(',').pop().trim().split(' ')[0];
  if (!src || !/\/cdn\/shop\/|cdn\.shopify\.com\/s\/files/.test(src)) return null;
  return { src: baseImageUrl(src), key: imageKey(src), alt: img.attr('alt') ?? '', width: +img.attr('width') || null, height: +img.attr('height') || null, style: img.attr('style') || null };
}

// Structural elements whose classes/inline styles vary per section instance (Craft section settings).
const ROLES = {
  slideshow: { component: 'slideshow-component', controls: '.slideshow__controls', slider: '.slideshow' },
  'collection-list': { wrapper: '.collection-list-wrapper', titleWrapper: '.title-wrapper-with-link, .title-wrapper', title: '.title, .collection-list-title', slider: 'slider-component', list: 'ul.collection-list', item: 'li.collection-list__item', cardWrapper: '.card-wrapper', card: '.card', cardInner: '.card__inner', cardMedia: '.card__inner .media', heading: '.card > .card__content .card__heading', sliderButtons: '.slider-buttons', viewAll: '.center' },
  'featured-collection': { collection: '.collection', titleWrapper: '.collection__title', title: '.collection__title .title', slider: 'slider-component', list: 'ul.product-grid', item: 'li.grid__item', card: '.product-card-wrapper .card', cardInner: '.product-card-wrapper .card__inner', sliderButtons: '.slider-buttons', viewAll: '.center' },
  multicolumn: { root: '.multicolumn', container: '.multicolumn > div', titleWrapper: '.title-wrapper-with-link', title: 'h2.title', slider: 'slider-component', list: 'ul.multicolumn-list', item: 'li.multicolumn-list__item', card: '.multicolumn-card', imageWrapper: '.multicolumn-card__image-wrapper', media: '.multicolumn-card__image-wrapper .media', info: '.multicolumn-card__info', sliderButtons: '.slider-buttons', viewAll: '.center' },
  'main-page': { container: '.page-width', title: 'h1', rte: '.rte' },
  'contact-form': { container: '.contact', title: 'h2', form: 'form' },
};
const cleanClass = (c) => (c || '').split(/\s+/).filter((x) => x && x !== 'scroll-trigger--offscreen').join(' ');
const role = ($, s, sel) => { const e = s.find(sel).first(); return e.length ? { class: cleanClass(e.attr('class')), style: e.attr('style') || null, tag: e[0].name } : null; };

const link = ($, a) => (a && a.length ? { label: txt(a.text()), href: a.attr('href') } : null);

// Generic section parser: returns {id, type, title, classes, style, settings, items, html?}
export function parseSection($, sec) {
  const s = $(sec);
  const id = sec.attribs.id.replace(/^shopify-section-/, '');
  const style = s.find('style').map((i, el) => $(el).html()).get().join('\n').trim();
  const wrapper = s.children().not('style,script,link').first();
  const out = {
    tag: sec.name,
    id, title: txt(s.find('.title-wrapper .title, h2.title, .title-wrapper-with-link .title, .collection-list-title').first().text()) || null,
    classes: (wrapper.attr('class') || '').split(/\s+/).filter(Boolean),
    style: style || null,
  };
  const descr = s.find('.collection-list-wrapper .rte, .multicolumn .rte.title-wrapper-with-link, .collection__description').first();
  if (descr.length) out.description = descr.html().trim();
  const viewAll = s.find('.center a.button, .collection__view-all a, a.link.underlined-link.large-up-hide').first();
  if (viewAll.length) out.viewAll = link($, viewAll);

  if (s.find('slideshow-component').length) {
    const sc = s.find('[data-autoplay]').first(); // settings live on the inner .slideshow element
    out.type = 'slideshow';
    out.settings = { autoplay: sc.attr('data-autoplay') === 'true', speed: +sc.attr('data-speed') || null };
    out.items = s.find('.slideshow__slide').map((i, el) => {
      const sl = $(el);
      return {
        heading: txt(sl.find('.banner__heading').text()) || null,
        text: txt(sl.find('.banner__text').text()) || null,
        buttons: sl.find('.banner__buttons a').map((j, a) => ({ ...link($, $(a)), classes: $(a).attr('class') })).get(),
        image: image($, sl.find('.slideshow__media, .banner__media').first()),
        boxClasses: (sl.find('.banner__box').attr('class') || '').split(/\s+/).filter(Boolean),
        headingClass: cleanClass(sl.find('.banner__heading').attr('class')),
        textWrapperClass: cleanClass(sl.find('.slideshow__text-wrapper').attr('class')),
        mediaClass: cleanClass(sl.find('.slideshow__media').attr('class')),
      };
    }).get();
  } else if (s.find('.product-grid, .card-wrapper.product-card-wrapper, .card--product, [id^=CardLink-]').length && !s.find('.collection-list__item').length) {
    out.type = 'featured-collection';
    const slider = s.find('slider-component').first();
    out.settings = { carousel: !!slider.length };
    const handles = [];
    s.find('a[href*="/products/"]').each((i, a) => {
      const h = ($(a).attr('href') || '').split('/products/')[1]?.split(/[?#]/)[0];
      if (h && !handles.includes(h)) handles.push(h);
    });
    out.productHandles = handles;
    const coll = s.find('a[href*="/collections/"]').first().attr('href');
    if (coll) out.collection = coll.split('/collections/')[1].split(/[?#/]/)[0];
  } else if (s.find('.collection-list__item').length) {
    out.type = 'collection-list';
    out.items = s.find('.collection-list__item').map((i, el) => {
      const li = $(el), a = li.find('a[href]').first();
      return { title: txt(li.find('.card__heading').first().text()) || txt(a.text()), href: a.attr('href'), image: image($, li) };
    }).get();
  } else if (s.find('.multicolumn').length) {
    out.type = 'multicolumn';
    out.items = s.find('.multicolumn-list__item').map((i, el) => {
      const li = $(el), a = li.find('a[href]').first();
      return {
        title: txt(li.find('h3').first().text()) || null,
        text: li.find('.rte').first().html()?.trim() || null,
        link: a.length ? { label: txt(li.find('a.link').text()) || null, href: a.attr('href') } : null,
        image: image($, li),
      };
    }).get();
  } else if (s.find('.main-page-title, .page-title').length || /__main$/.test(id)) {
    out.type = 'main-page';
    out.title = txt(s.find('h1').first().text()) || null;
    out.html = s.find('.rte').first().html()?.trim() || null;
  } else if (s.find('form.contact, .contact').length) {
    out.type = 'contact-form';
    out.title = txt(s.find('h2').first().text()) || null;
    out.fields = s.find('form input:not([type=hidden]), form textarea').map((i, f) => ({
      name: $(f).attr('name'), type: $(f).attr('type') || 'textarea', label: txt(s.find(`label[for="${$(f).attr('id')}"]`).text()), required: $(f).attr('aria-required') === 'true' || $(f).attr('required') !== undefined,
    })).get();
    out.submitLabel = txt(s.find('form button[type=submit], form .button').last().text());
  } else {
    out.type = 'custom';
    const clean = s.clone(); clean.find('script,style').remove();
    out.html = clean.html().trim();
    out.images = s.find('img').map((i, el) => image($, $(el))).get().filter(Boolean);
    out.links = s.find('a[href]').map((i, a) => link($, $(a))).get();
  }
  const roles = ROLES[out.type];
  if (roles) out.layout = Object.fromEntries(Object.entries(roles).map(([k, sel]) => [k, role($, s, sel)]).filter(([, v]) => v));
  return out;
}

export function templateSections($) {
  return $('[id^=shopify-section-template--]').map((i, sec) => parseSection($, sec)).get();
}
