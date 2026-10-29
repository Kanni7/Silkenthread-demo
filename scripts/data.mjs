// Phase 2: public Shopify JSON + saved HTML -> normalised src/data/*.json
// Network calls go through the polite cached queue; re-runs are free.
import fs from 'node:fs';
import { ORIGIN, loadRobots, politeFetch, NotCached } from './lib/polite.mjs';
import { load, txt, image, baseImageUrl, imageKey, templateSections, parseSection } from './lib/parse.mjs';

const OUT = 'src/data';
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => { fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 1)); console.log(`wrote ${OUT}/${name}`); };
const getJSON = async (path) => JSON.parse((await politeFetch(ORIGIN + path)).body.toString('utf8'));
const html = (f) => load(fs.readFileSync(`reference/html/${f}.html`, 'utf8'));
const capture = JSON.parse(fs.readFileSync('reference/capture-log.json', 'utf8'));

await loadRobots();

// ---------- raw fetch ----------
const rawProducts = [];
for (let page = 1; ; page++) {
  const { products } = await getJSON(`/products.json?limit=250&page=${page}`);
  rawProducts.push(...products);
  if (products.length < 250) break;
}
const { collections: rawCollections } = await getJSON('/collections.json?limit=250&page=1');
const membership = {}, incomplete = new Set();
for (const c of rawCollections) {
  membership[c.handle] = [];
  for (let page = 1; ; page++) {
    let products;
    try { ({ products } = await getJSON(`/collections/${c.handle}/products.json?limit=250&page=${page}`)); }
    catch (e) { if (e instanceof NotCached) { incomplete.add(c.handle); break; } throw e; }
    membership[c.handle].push(...products.map((p) => p.handle));
    if (products.length < 250) break;
  }
}
const POLICIES = ['terms-of-service', 'refund-policy', 'shipping-policy', 'privacy-policy', 'contact-information'];
const policyHtml = {};
for (const h of POLICIES) {
  try { policyHtml[h] = (await politeFetch(`${ORIGIN}/policies/${h}`)).body.toString('utf8'); }
  catch (e) { if (!(e instanceof NotCached)) throw e; policyHtml[h] = null; }
}

// ---------- facet vocabulary (from captured collection pages) ----------
const facetDefs = new Map();
for (const f of ['collection-the-curated-kanjivarams', 'collection-sale']) {
  const $ = html(f);
  $('#FacetFiltersForm details').each((i, d) => {
    const label = txt($(d).find('summary').first().clone().children('svg').remove().end().text()).replace(/\s*\(\d+\)$/, '');
    const inputs = $(d).find('input[name^="filter."]');
    if (!inputs.length) return;
    const param = inputs.first().attr('name');
    const def = facetDefs.get(param) || { param, label, type: /price/.test(param) ? 'price' : 'list', values: [] };
    inputs.each((j, x) => {
      const value = $(x).attr('value');
      const vlabel = txt($(`label[for="${$(x).attr('id')}"]`).first().text()).replace(/\s*\(\d+\)\s*$/, '');
      if (value && !def.values.some((v) => v.value === value)) def.values.push({ value, label: vlabel || value });
    });
    facetDefs.set(param, def);
  });
}

// ---------- attribute derivation ----------
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (handle, salt, arr) => arr[hash(handle + salt) % arr.length];
const GENRES = [
  ['Kanjeevaram', /kanj[ie]e?varam|kanchi/], ['Banarasi', /ban[ae]ras/], ['Paithani', /paithan/], ['Gadwal', /gadwal/],
  ['Ilkal', /ilkal/], ['Chanderi', /chanderi/], ['Jamdani', /jamdani/], ['Maheshwari', /maheshwar/], ['Mangalagiri', /mangal(a)?giri/],
  ['Narayanpet', /narayan ?pet/], ['Patola', /patola/], ['Pochampally Ikat', /pochampal/], ['Venkatagiri', /venkatagiri/], ['Uppada', /uppada/],
  ['Kasuti', /kasuti/], ['Kantha', /kantha/], ['Bandhej', /bandhej|bandhani/], ['Leheriya', /leh[ae]riya/], ['Ajrakh', /ajrakh/],
  ['Kalamkari', /kalamkari/], ['Batik', /batik/], ['Madhubani', /madhubani/], ['Shibori', /shibori/], ['Baluchari', /baluchari|swarnach/],
  ['Sambalpuri', /sambalpur/], ['Manipuri', /manipur|monipur/], ['Kota Doria', /kota/], ['Gota Patti', /gota/], ['Chikankari', /chikan/],
  ['Phulkari', /phulkari/], ['Telia Rumal', /telia/], ['Dhaniakhali', /dhaniakhali/], ['Bhagalpuri', /bhagalpur/], ['Tussar', /tuss?ar|tassor|kosa/],
];
const ORIGIN_BY_GENRE = { Kanjeevaram: 'Kanchipuram', Banarasi: 'Varanasi', Paithani: 'Paithan', Gadwal: 'Gadwal', Ilkal: 'Ilkal', Chanderi: 'Chanderi', Maheshwari: 'Maheshwar', Mangalagiri: 'Mangalagiri', Narayanpet: 'Narayanpet', Patola: 'Patan', 'Pochampally Ikat': 'Pochampally', Venkatagiri: 'Venkatagiri', Uppada: 'Uppada', Kasuti: 'Dharwad', Sambalpuri: 'Sambalpur', Manipuri: 'Manipur', 'Kota Doria': 'Kota', Bhagalpuri: 'Bhagalpur', Dhaniakhali: 'Dhaniakhali' };
const COLOURS = [
  ['Red', /\bred\b|maroon|crimson|sindoor|sindhoor|laal|ruby/], ['Pink', /pink|rani|magenta|fuchsia|blush|peach|rose|onion|lotus/],
  ['Orange', /orange|saffron|tangerine|rust|apricot|mango/], ['Yellow', /yellow|haldi|mustard|lemon|sunflower|basanti/],
  ['Green', /green|hara|mehndi|parrot|olive|bottle|teal|mint|sea ?green|rama/], ['Blue', /blue|navy|neela|aasmani|peacock|sky|ink|turquoise/],
  ['Purple', /purple|violet|lavender|wine|plum|cadbury|jamun|mauve|lilac/], ['Brown', /brown|coffee|beige|chocolate|tan\b|copper|mud/],
  ['Black', /black|raven|kaala/], ['White', /white|off ?white|cream|ivory|pearl/], ['Gold', /gold(en)?\b|sona/], ['Silver', /silver|grey|gray/],
];
const MATERIALS = [
  ['Silk Cotton', /silk ?cotton|cotton ?silk|pattu x cotton|silk-cotton/], ['Tussar Silk', /tuss?ar|tassor/], ['Pure Silk', /pure silk|pattu|mulberry|kosa/],
  ['Linen', /linen/], ['Georgette', /georgette/], ['Chiffon', /chiffon/], ['Organza', /organza/], ['Modal', /modal/], ['Viscose', /viscose/],
  ['Cotton', /cotton/], ['Silk', /silk/],
];
const firstMatch = (list, s) => (list.find(([, re]) => re.test(s)) || [])[0] || null;

function deriveAttributes(p, text, colourValues) {
  const a = {};
  const t = text.toLowerCase(), title = p.title.toLowerCase();
  const genre = firstMatch(GENRES, title) || firstMatch(GENRES, t);
  a.weaving_genre = genre ? { value: genre, source: 'text' } : { value: pick(p.handle, 'g', ['Handloom Saree', 'Printed Saree']), mocked: true };
  const mat = firstMatch(MATERIALS, title) || firstMatch(MATERIALS, t);
  a.materials = mat ? { value: mat, source: 'text' } : { value: pick(p.handle, 'm', ['Pure Silk', 'Cotton']), mocked: true };
  const fams = [...new Set(colourValues.map((c) => firstMatch(COLOURS, c.toLowerCase())).filter(Boolean))];
  a.colourfamily = fams.length ? { value: fams, source: 'variant-option/tags' } : { value: [pick(p.handle, 'c', COLOURS.map((c) => c[0]))], mocked: true };
  if (/handloom|hand ?woven|handwoven/.test(t)) a.craft = { value: 'Handloom', source: 'text' };
  else if (/power ?loom/.test(t)) a.craft = { value: 'Powerloom', source: 'text' };
  else a.craft = { value: pick(p.handle, 'cr', ['Handloom', 'Handloom', 'Handloom', 'Powerloom']), mocked: true };
  if (/silk ?mark/.test(t)) a.silk_mark = { value: true, source: 'text' };
  else if (/cotton|linen|georgette|chiffon|modal|viscose/.test(a.materials.value.toLowerCase()) && !a.materials.mocked) a.silk_mark = { value: false, source: 'rule: non-silk material' };
  else a.silk_mark = { value: hash(p.handle + 's') % 3 === 0, mocked: true };
  const zari = /tested zari/.test(t) ? 'Tested Zari' : /\b1 ?g(m|ram)?\.? zari/.test(t) ? '1g zari' : /\b2 ?g(m|ram)?\.? zari/.test(t) ? '2g Zari' : /gold thread/.test(t) ? 'Gold thread' : null;
  a.zari_type = zari ? { value: zari, source: 'text' } : { value: pick(p.handle, 'z', ['Tested Zari', '1g zari', '2g Zari', 'Gold thread']), mocked: true };
  const org = genre && ORIGIN_BY_GENRE[genre];
  a.origin = org && t.includes(org.toLowerCase()) ? { value: org, source: 'text' } : org ? { value: org, mocked: true, note: 'inferred from genre' } : { value: pick(p.handle, 'o', ['Kanchipuram', 'Varanasi', 'Ilkal']), mocked: true };
  const len = t.match(/(\d(?:\.\d+)?)\s*(?:m|mtr|mtrs|meters?|metres?)\b/);
  a.dimensions = len ? { value: `${len[1]} m`, source: 'text' } : { value: '6.3 m', mocked: true };
  const bp = /with (?:bp|blouse)|blouse piece/.test(t);
  a.blouse = { value: bp ? 'Saree with a separate blouse piece' : 'Saree with a running blouse, i.e. blouse is attached to the saree, in contrasting colour/style as the saree Body', mocked: true, ...(bp ? { note: 'blouse piece mentioned in text' } : {}) };
  a.shipping_speed = { value: 'Shipping within 4-10 days', mocked: true };
  return a;
}

// Real attribute values for the captured product (spec block on its page)
function attrsFromProductHtml($) {
  const specs = {};
  $('.product__info-container').find('*').each((i, el) => {
    const m = txt($(el).clone().children().remove().end().text()).match(/^(Fabric|Dimensions|Zari Specifications|Origin|Genre|Craft Summary):\s*(.+)$/);
    if (m) specs[m[1]] = m[2];
  });
  const map = { Fabric: 'materials', Dimensions: 'dimensions', 'Zari Specifications': 'zari_type', Origin: 'origin', Genre: 'weaving_genre', 'Craft Summary': 'craft' };
  return Object.fromEntries(Object.entries(specs).map(([k, v]) => [map[k], { value: v, source: 'product-page-html' }]));
}

// ---------- products ----------
const collectionsOf = {};
for (const [h, list] of Object.entries(membership)) for (const ph of list) (collectionsOf[ph] ||= []).push(h);
const cleanTag = (t) => t.replace(/\s+/g, ' ').trim();
const stripHtml = (h) => txt((h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));

const products = rawProducts.map((p) => {
  const text = [p.title, stripHtml(p.body_html), p.tags.join(' '), p.product_type].join(' ');
  const colourOpt = p.options.find((o) => /colou?r/i.test(o.name));
  const colourValues = [...(colourOpt?.values || []), ...p.tags];
  const prices = p.variants.map((v) => +v.price), compares = p.variants.map((v) => +v.compare_at_price || 0);
  return {
    id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, productType: p.product_type,
    createdAt: p.created_at, publishedAt: p.published_at, updatedAt: p.updated_at,
    tags: p.tags.map(cleanTag), bodyHtml: p.body_html, description: stripHtml(p.body_html),
    price: Math.min(...prices), compareAtPrice: Math.max(...compares) || null,
    available: p.variants.some((v) => v.available),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants.map((v) => ({ id: v.id, title: v.title, options: [v.option1, v.option2, v.option3].filter(Boolean), sku: v.sku, price: +v.price, compareAtPrice: +v.compare_at_price || null, available: v.available, imageKey: imageKey(v.featured_image?.src) })),
    images: p.images.map((i) => ({ src: baseImageUrl(i.src), key: imageKey(i.src), alt: (i.alt ?? '').replace(/\s+/g, ' ').trim() || null, width: i.width, height: i.height })),
    collections: collectionsOf[p.handle] || [],
    attributes: deriveAttributes(p, text, colourValues),
  };
});
const captured = products.find((p) => p.handle === capture.productHandle);
if (captured) Object.assign(captured.attributes, attrsFromProductHtml(html(`product-${capture.productHandle}`)));
write('products.json', products);

// ---------- collections ----------
const firstPageFromHtml = (f) => {
  const $ = html(f); const hs = [];
  $('#product-grid a[href*="/products/"]').each((i, a) => { const h = $(a).attr('href').split('/products/')[1].split(/[?#]/)[0]; if (!hs.includes(h)) hs.push(h); });
  return { handles: hs, sort: $('select[name=sort_by] option[selected]').first().attr('value') || null, perPage: hs.length };
};
const capturedColl = { 'the-curated-kanjivarams': firstPageFromHtml('collection-the-curated-kanjivarams'), sale: firstPageFromHtml('collection-sale') };
const collections = rawCollections.map((c) => {
  const ref = capturedColl[c.handle];
  return {
    id: c.id, handle: c.handle, title: c.title, descriptionHtml: c.description || '', publishedAt: c.published_at, updatedAt: c.updated_at,
    image: c.image ? { src: baseImageUrl(c.image.src), key: imageKey(c.image.src), alt: c.image.alt ?? '', width: c.image.width, height: c.image.height } : null,
    productsCount: c.products_count, productHandles: membership[c.handle],
    defaultSort: ref?.sort || 'manual',
    ...(incomplete.has(c.handle) ? { membershipIncomplete: true } : {}),
    ...(ref ? { referenceFirstPage: ref.handles, firstPageMatchesJson: ref.handles.join() === membership[c.handle].slice(0, ref.handles.length).join() } : {}),
  };
});
// Shopify's built-in /collections/all (linked from the announcement bar)
collections.push({ id: 0, handle: 'all', title: 'Products', descriptionHtml: '', image: null, productsCount: products.length, productHandles: products.map((p) => p.handle), defaultSort: 'manual', builtIn: true });
write('collections.json', collections);

// ---------- filters ----------
const ATTR_BY_PARAM = { 'filter.p.m.custom.materials': 'materials', 'filter.v.m.custom.colourfamily': 'colourfamily', 'filter.p.m.custom.weaving_genre': 'weaving_genre', 'filter.p.m.custom.handloom': 'craft', 'filter.p.m.custom.silk_mark': 'silk_mark', 'filter.p.m.custom.blouse': 'blouse', 'filter.p.m.custom.origin': 'origin', 'filter.v.m.custom.shipping_speed': 'shipping_speed', 'filter.p.m.custom.zari_type': 'zari_type', 'filter.p.product_type': 'productType', 'filter.v.price.gte': 'price' };
write('filters.json', [...facetDefs.values()].map((d) => ({ ...d, attribute: ATTR_BY_PARAM[d.param] || null, ...(d.param.includes('taxonomy') || d.param.includes('shopify.fabric') ? { note: 'Shopify taxonomy facet; values are opaque GIDs, merged into Materials in the replica' } : {}) })));

// ---------- menu / header / footer ----------
const $h = html('home');
const menuTree = (ul) => $h(ul).children('li').map((i, li) => {
  const L = $h(li);
  const summary = L.children('details, header-menu').find('summary').first();
  const a = L.find('a').first();
  const label = txt((summary.length ? summary : a).text());
  const sub = L.find('ul').first();
  const href = summary.length ? (summary.closest('details').find('a').first().attr('href') && null) : a.attr('href');
  return { label, href: href || null, ...(sub.length ? { children: menuTree(sub) } : {}) };
}).get();
const desktopMenu = menuTree($h('.header__inline-menu > ul.list-menu').first());
const footerBlocks = $h('.footer-block').map((i, b) => {
  const B = $h(b);
  return { heading: txt(B.find('.footer-block__heading').text()) || null, links: B.find('a[href]').map((j, a) => ({ label: txt($h(a).text()), href: $h(a).attr('href') })).get(), html: B.find('.rte, .footer-block__details-content').first().html()?.trim() || null };
}).get();
const preFooter = $h('[id$="__custom_liquid_tk7NdT"]');
write('menu.json', {
  announcements: $h('.announcement-bar__message').map((i, m) => ({ text: txt($h(m).text()), href: $h(m).closest('a').attr('href') || null })).get(),
  logo: { ...image($h, $h('.header__heading-logo').first()), text: txt($h('.header__heading').text()) || 'Silkenthread.in' },
  localization: txt($h('.header__localization .localization-form__select span, .header__localization summary span').first().text()) || 'INR ₹ | India',
  main: desktopMenu,
  footer: {
    preFooterHtml: preFooter.find('style,script').remove().end().html()?.trim() || null,
    blocks: footerBlocks,
    newsletter: { heading: txt($h('.footer-block--newsletter h2, .newsletter-form').first().closest('.footer-block--newsletter').find('h2').text()) || txt($h('footer h2').last().text()), placeholder: $h('footer input[type=email]').attr('placeholder') || 'Email' },
    policies: $h('.policies a').map((i, a) => ({ label: txt($h(a).text()), href: $h(a).attr('href') })).get(),
    copyright: txt($h('.copyright__content').first().text()),
  },
});

// ---------- home ----------
write('home.json', { title: txt($h('title').text()), sections: templateSections($h) });

// ---------- pages ----------
const pages = {};
for (const [handle, file] of [['about-silken-thread', 'page-about-silken-thread'], ['contact', 'page-contact'], ['whats-new', 'page-whats-new'], ['size-chart', 'page-size-chart']]) {
  const $ = html(file);
  pages[handle] = { handle, url: `/pages/${handle}`, title: txt($('h1').first().text()) || txt($('title').text()), metaTitle: txt($('title').text()), metaDescription: $('meta[name=description]').attr('content') || null, sections: templateSections($) };
}
// Policy *pages* linked from the product template ("Friendly Return Policy", "Shipping Policy")
for (const handle of ['refund-policy', 'shipping-policy']) {
  let raw = null;
  try { raw = (await politeFetch(`${ORIGIN}/pages/${handle}`)).body.toString('utf8'); }
  catch (e) { if (!(e instanceof NotCached)) throw e; }
  if (!raw) { pages[handle] = { handle, url: `/pages/${handle}`, title: null, sections: [], missing: true }; continue; }
  const $ = load(raw);
  pages[handle] = { handle, url: `/pages/${handle}`, title: txt($('h1').first().text()), metaTitle: txt($('title').text()), metaDescription: $('meta[name=description]').attr('content') || null, sections: templateSections($) };
}
for (const h of POLICIES) {
  if (!policyHtml[h]) { pages[`policy-${h}`] = { handle: h, url: `/policies/${h}`, policy: true, title: h.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), html: null, missing: true }; continue; }
  const $ = load(policyHtml[h]);
  pages[`policy-${h}`] = { handle: h, url: `/policies/${h}`, policy: true, title: txt($('.shopify-policy__title h1, h1').first().text()), metaTitle: txt($('title').text()), html: $('.shopify-policy__body .rte, .shopify-policy__body').first().html()?.trim() || null };
}
write('pages.json', pages);

// ---------- product template extras + site settings ----------
const $p = html(`product-${capture.productHandle}`);
const wa = $p('a[href*="wa.me"], a[href*="whatsapp"]').first();
write('product-template.json', {
  source: `/products/${capture.productHandle}`,
  shippingNote: txt($p('.product__tax').text()),
  whatsapp: { label: txt(wa.text()), href: wa.attr('href') || null },
  policyLinks: $p('.product__info-container a[href*="/pages/"], .product__info-container a[href*="/policies/"]').map((i, a) => ({ label: txt($p(a).text()), href: $p(a).attr('href') })).get(),
  collapsibles: $p('.product__accordion').map((i, d) => ({ heading: txt($p(d).find('summary').text()), html: $p(d).find('.accordion__content').html()?.trim() || null })).get(),
  buttons: { addToCart: txt($p('.product-form__submit').first().text()), buyNow: 'Buy it now' },
});
write('site.json', {
  name: 'Silkenthread.in', origin: ORIGIN, theme: 'Craft 12.0.0', currency: 'INR', moneyFormat: 'Rs. {{amount}}',
  productsPerPage: capturedColl['the-curated-kanjivarams'].perPage, sortOptions: html('collection-the-curated-kanjivarams')('select[name=sort_by]').first().find('option').map((i, o) => ({ value: o.attribs.value, label: txt(load(o)('*').text()) })).get(),
  generatedAt: new Date().toISOString(),
});
console.log({ products: products.length, collections: collections.length, filters: facetDefs.size });
