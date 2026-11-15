// Filtering, sorting, facet counts and pagination for collection + search pages.
// Shared by the build (first page, server-rendered) and the browser (src/scripts/collection.js), so both
// produce identical results. Works on summary() records (src/lib/data.js).

// Facets in the live sidebar order (filters.json). key = field in summary().f; the URL param is the live one.
export const FACETS = [
  { param: 'filter.p.product_type', label: 'Product type', key: 'productType' },
  { param: 'price', label: 'Price', type: 'price' },
  { param: 'filter.p.m.custom.materials', label: 'Materials', key: 'materials' },
  { param: 'filter.v.m.custom.colourfamily', label: 'Colour family', key: 'colourfamily' },
  { param: 'filter.p.m.custom.weaving_genre', label: 'Category', key: 'weaving_genre' },
  { param: 'filter.p.m.custom.handloom', label: 'Craft', key: 'craft' },
  { param: 'filter.p.m.custom.silk_mark', label: 'Silk mark', key: 'silk_mark', labels: { 1: 'Yes', 0: 'No' } },
  { param: 'filter.p.m.custom.blouse', label: 'blouse', key: 'blouse' },
  { param: 'filter.p.m.custom.origin', label: 'Origin', key: 'origin' },
  { param: 'filter.v.m.custom.shipping_speed', label: 'Shipping state', key: 'shipping_speed' },
  { param: 'filter.p.m.custom.zari_type', label: 'Zari type', key: 'zari_type' },
];
export const PRICE_GTE = 'filter.v.price.gte';
export const PRICE_LTE = 'filter.v.price.lte';
export const PER_PAGE = 24;

const vals = (s, key) => {
  const v = s.f[key];
  return v == null ? [] : Array.isArray(v) ? v : [v];
};
export const valueLabel = (facet, v) => facet.labels?.[v] ?? v;

// state: { sort, page, filters: { [param]: Set }, gte, lte, q }
export function stateFromParams(params, defaultSort = 'manual') {
  const filters = {};
  for (const f of FACETS) if (f.key) {
    const all = params.getAll(f.param);
    if (all.length) filters[f.param] = new Set(all);
  }
  const num = (k) => (params.get(k) !== null && params.get(k) !== '' && !isNaN(+params.get(k)) ? +params.get(k) : null);
  return { sort: params.get('sort_by') || defaultSort, page: Math.max(1, parseInt(params.get('page'), 10) || 1), filters, gte: num(PRICE_GTE), lte: num(PRICE_LTE), q: params.get('q') || '' };
}

export function paramsFromState(state, defaultSort = 'manual') {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const f of FACETS) for (const v of state.filters[f.param] || []) p.append(f.param, v);
  if (state.gte !== null) p.set(PRICE_GTE, state.gte);
  if (state.lte !== null) p.set(PRICE_LTE, state.lte);
  if (state.sort && state.sort !== defaultSort) p.set('sort_by', state.sort);
  if (state.page > 1) p.set('page', state.page);
  return p;
}

const matches = (s, state, skipParam) => {
  for (const f of FACETS) {
    if (!f.key || f.param === skipParam) continue;
    const want = state.filters[f.param];
    if (want?.size && !vals(s, f.key).some((v) => want.has(String(v)))) return false;
  }
  if (skipParam !== 'price') {
    if (state.gte !== null && s.p < state.gte) return false;
    if (state.lte !== null && s.p > state.lte) return false;
  }
  return true;
};

export const filterList = (list, state) => list.filter((s) => matches(s, state));

// Like Shopify: counts for a facet ignore that facet's own selection (so you can add more values).
export function facetCounts(list, state) {
  const out = {};
  for (const f of FACETS) {
    if (!f.key) continue;
    const counts = new Map();
    for (const s of list) if (matches(s, state, f.param)) for (const v of vals(s, f.key)) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
    // keep selected values visible even at 0
    for (const v of state.filters[f.param] || []) if (!counts.has(v)) counts.set(v, 0);
    out[f.param] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, label: valueLabel(f, value), count }));
  }
  return out;
}

export const maxPrice = (list) => list.reduce((m, s) => Math.max(m, s.p), 0);

const byTitle = (a, b) => a.t.localeCompare(b.t);
export function sortList(list, sort) {
  const l = list.slice(); // input order = the collection's own order (manual / best-selling)
  switch (sort) {
    case 'title-ascending': return l.sort(byTitle);
    case 'title-descending': return l.sort((a, b) => byTitle(b, a));
    case 'price-ascending': return l.sort((a, b) => a.p - b.p);
    case 'price-descending': return l.sort((a, b) => b.p - a.p);
    case 'created-ascending': return l.sort((a, b) => a.d.localeCompare(b.d));
    case 'created-descending': return l.sort((a, b) => b.d.localeCompare(a.d));
    default: return l;
  }
}

// Simple storefront-style search: every word must appear in title, tags, type or attributes.
// Most relevant first: products whose title contains all the words, then the rest (catalogue order).
export function searchList(list, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const inTitle = [], other = [];
  for (const s of list) {
    const hay = s.s || (s.s = [s.t, s.g, ...Object.values(s.f).flat()].join(' ').toLowerCase());
    if (!words.every((w) => hay.includes(w))) continue;
    const t = s.t.toLowerCase();
    (words.every((w) => t.includes(w)) ? inTitle : other).push(s);
  }
  return inTitle.concat(other);
}

// list is in the collection's own (default) order, so the default sort keeps it as is.
export function run(list, state, defaultSort = 'manual') {
  const f = filterList(list, state);
  const filtered = state.sort === defaultSort ? f : sortList(f, state.sort);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(state.page, pages);
  return { total: filtered.length, pages, page, items: filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), counts: facetCounts(list, state) };
}

// Pagination like Craft's pagination.liquid: 1 … 4 5 [6] 7 8 … 20
export function pageLinks(page, pages) {
  if (pages <= 1) return [];
  const out = [];
  const add = (n) => out.push({ n, current: n === page });
  const lo = Math.max(1, page - 2), hi = Math.min(pages, page + 2);
  if (lo > 1) { add(1); if (lo > 2) out.push({ gap: true }); }
  for (let n = lo; n <= hi; n++) add(n);
  if (hi < pages) { if (hi < pages - 1) out.push({ gap: true }); add(pages); }
  return out;
}
