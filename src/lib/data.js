// Data access + formatting helpers shared by all pages (build time).
import products from '../data/products.json';
import collections from '../data/collections.json';
import site from '../data/site.json';
import filters from '../data/filters.json';
import menu from '../data/menu.json';
import templates from '../data/templates.json';
import icons from '../data/icons.json';

export { products, collections, site, filters, menu, templates, icons };
export const productMap = new Map(products.map((p) => [p.handle, p]));
// Row number of each product in /data/catalog.json (same order as products.json).
export const productIndex = new Map(products.map((p, i) => [p.handle, i]));
export const collectionMap = new Map(collections.map((c) => [c.handle, c]));

export const FONT_URL = 'https://fonts.googleapis.com/css2?family=Asul:wght@400;700&family=Libre+Caslon+Text:wght@400&display=swap';
export const CONCEPT_AUTHOR = 'Kanishk';

export const money = (n) => site.moneyFormat.replace('{{amount}}', Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Images are served straight from the Shopify CDN (the live store's own image hosting), resized
// on the fly with ?width=.
export function imageUrl(image, width = 1000) {
  if (!image?.src) return null;
  const u = new URL(image.src);
  u.searchParams.set('width', String(width));
  return u.toString();
}

export function imageSrcset(image, widths = [165, 360, 533, 720, 940, 1066, 1500]) {
  if (!image?.src) return undefined;
  const usable = widths.filter((w) => !image.width || w <= image.width);
  return (usable.length ? usable : [image.width]).map((w) => `${imageUrl(image, w)} ${w}w`).join(', ');
}

// Compact product record for client-side filtering, sorting and search (served as /data/catalog.json).
export function summary(p) {
  const a = p.attributes;
  const img = (i) => (i ? { u: i.src, w: i.width, h: i.height, alt: i.alt || '' } : null);
  return {
    id: p.id, h: p.handle, t: p.title, p: p.price, c: p.compareAtPrice, a: p.available, d: p.createdAt,
    i: img(p.images[0]), i2: img(p.images[1]),
    f: {
      productType: p.productType, materials: a.materials.value, colourfamily: a.colourfamily.value, weaving_genre: a.weaving_genre.value,
      craft: a.craft.value, silk_mark: a.silk_mark.value ? '1' : '0', blouse: a.blouse.value, origin: a.origin.value,
      shipping_speed: a.shipping_speed.value, zari_type: a.zari_type.value,
    },
  };
}

// Link targets that point at the live domain are rewritten to local paths so the replica stays self-contained.
export const localHref = (href) => (href || '').replace(/^https?:\/\/(www\.)?silkenthread\.in/, '') || '/';

// Rich text from the live store: links to the live domain become local links (images stay on the CDN).
export const localizeHtml = (html) => (html || '').replace(/href="(?:https?:)?\/\/(?:www\.)?silkenthread\.in(\/[^"]*)?"/g, (m, path) => `href="${path || '/'}"`);
