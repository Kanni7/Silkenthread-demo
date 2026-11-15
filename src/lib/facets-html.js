// Facet sidebar / mobile drawer / active filters / pagination markup (Craft main-collection-product-grid +
// facets.liquid). Shared by the build and src/scripts/collection.js so both render identical HTML.
import { FACETS, PRICE_GTE, PRICE_LTE, pageLinks, paramsFromState } from './catalog.js';
import { formatMoney } from './card.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BOX = '<svg width="1.6rem" height="1.6rem" viewBox="0 0 16 16" aria-hidden="true" focusable="false"> <rect width="16" height="16" stroke="currentColor" fill="none" stroke-width="1"></rect> </svg>';
const CHECK = '<svg aria-hidden="true" class="icon icon-checkmark" width="1.1rem" height="0.7rem" viewBox="0 0 11 7" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.5 3.5L2.83333 4.75L4.16667 6L9.5 1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path> </svg>';
export const productsLabel = (n) => `${n} product${n === 1 ? '' : 's'}`;
const plain = (n) => Number(n).toFixed(2);

// ctx: { sid, icons, counts, state, max, base (collection path), extraParams }
export function desktopFacetsHtml(ctx) {
  const { sid, icons, counts, state, max } = ctx;
  return FACETS.map((f, i) => {
    const n = i + 1;
    if (f.type === 'price') {
      return `<details id="Details-${n}-${sid}" class=" facets__disclosure-vertical js-filter" data-index="${n}"${state.gte !== null || state.lte !== null ? ' open' : ''}> <summary class="facets__summary caption-large focus-offset" role="button" aria-expanded="false" aria-controls="Facet-${n}-${sid}"> <div> <span>Price</span> ${icons.caret} </div> </summary> <div id="Facet-${n}-${sid}" class="facets__display-vertical"> <div class="facets__header-vertical"><span class="facets__selected">The highest price is ${formatMoney(max)}</span></div> <price-range class="facets__price"> <span class="field-currency">₹</span> <div class="field"> <input class="field__input" name="${PRICE_GTE}" id="Filter-Price-GTE" type="number" placeholder="0" min="0" max="${plain(max)}"${state.gte !== null ? ` value="${state.gte}"` : ''}> <label class="field__label" for="Filter-Price-GTE">From</label> </div><div class="field"> <input class="field__input" name="${PRICE_LTE}" id="Filter-Price-LTE" type="number" min="0" placeholder="${plain(max)}" max="${plain(max)}"${state.lte !== null ? ` value="${state.lte}"` : ''}> <label class="field__label" for="Filter-Price-LTE">To</label> </div> </price-range> </div> </details>`;
    }
    const values = counts[f.param] || [];
    if (!values.length) return '';
    const sel = state.filters[f.param] || new Set();
    const items = values.map((v, j) => {
      const id = `Filter-${f.param}-${j + 1}`;
      const checked = sel.has(v.value);
      const disabled = !checked && v.count === 0;
      return `<li class="list-menu__item facets__item"> <label for="${esc(id)}" class="facets__label facet-checkbox${disabled ? ' facet-checkbox--disabled' : ''}${checked ? ' active' : ''}"> <input type="checkbox" name="${f.param}" value="${esc(v.value)}" id="${esc(id)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${BOX} ${CHECK} <span class="facet-checkbox__text" aria-hidden="true">${esc(v.label)} (${v.count})</span> <span class="visually-hidden">${esc(v.label)} (${productsLabel(v.count)})</span> </label> </li>`;
    }).join('');
    const open = n === 1 || sel.size > 0;
    return `<details id="Details-${n}-${sid}" class=" facets__disclosure-vertical js-filter" data-index="${n}"${open ? ' open' : ''}> <summary class="facets__summary caption-large focus-offset" aria-label="${esc(f.label)} (${sel.size} selected)" role="button" aria-expanded="${open}" aria-controls="Facet-${n}-${sid}"> <div> <span class="facets__summary-label">${esc(f.label)} <span class="facets__selected${sel.size ? '' : ' hidden'}"> (${sel.size})</span></span>${icons.caret} </div> </summary> <div id="Facet-${n}-${sid}" class="parent-display facets__display-vertical"><fieldset class="facets-wrap parent-wrap facets-wrap-vertical"> <legend class="visually-hidden">${esc(f.label)}</legend> <ul class="facets-layout-list facets__list--vertical list-unstyled" role="list">${items}</ul></fieldset></div> </details>`;
  }).join('');
}

export function mobileFacetsHtml(ctx) {
  const { sid, icons, counts, state, max, base } = ctx;
  const footer = (label = 'Clear') => `<div class="mobile-facets__footer gradient"> <facet-remove class="mobile-facets__clear-wrapper"> <a href="${esc(base)}" class="mobile-facets__clear underlined-link" role="button">${label}</a> </facet-remove> <button type="button" class="button button--primary" data-facets-apply> Apply </button> </div>`;
  return FACETS.map((f, i) => {
    const n = i + 1;
    const summary = `<summary class="mobile-facets__summary focus-inset" role="button" aria-expanded="false" aria-controls="FacetMobile-${n}-${sid}"> <div> <span>${esc(f.label)}</span> <span class="mobile-facets__arrow">${icons.arrow} </span> </div> </summary>`;
    const back = `<button class="mobile-facets__close-button link link--text focus-inset" aria-expanded="true" type="button" data-facets-back> ${icons.arrow} <span>${esc(f.label)}</span></button>`;
    if (f.type === 'price') {
      return `<details id="Details-Mobile-${n}-${sid}" class="mobile-facets__details js-filter" data-index="mobile-${n}"> ${summary} <div id="FacetMobile-${n}-${sid}" class="mobile-facets__submenu gradient"> ${back}<p class="mobile-facets__info"> The highest price is ${formatMoney(max)} </p> <price-range class="facets__price"> <span class="field-currency">₹</span> <div class="field"> <input class="field__input" name="${PRICE_GTE}" id="Mobile-Filter-Price-GTE" type="number" placeholder="0" min="0" inputmode="decimal" max="${plain(max)}"${state.gte !== null ? ` value="${state.gte}"` : ''}> <label class="field__label" for="Mobile-Filter-Price-GTE">From</label> </div> <span class="field-currency">₹</span> <div class="field"> <input class="field__input" name="${PRICE_LTE}" id="Mobile-Filter-Price-LTE" type="number" min="0" inputmode="decimal" placeholder="${plain(max)}" max="${plain(max)}"${state.lte !== null ? ` value="${state.lte}"` : ''}> <label class="field__label" for="Mobile-Filter-Price-LTE">To</label> </div> </price-range> ${footer()} </div> </details>`;
    }
    const values = counts[f.param] || [];
    if (!values.length) return '';
    const sel = state.filters[f.param] || new Set();
    const items = values.map((v, j) => {
      const id = `Filter-${f.param}-mobile-${j + 1}`;
      const checked = sel.has(v.value);
      const disabled = !checked && v.count === 0;
      return `<li class="mobile-facets__item list-menu__item"> <label for="${esc(id)}" class="facets__label mobile-facets__label${disabled ? ' mobile-facets__label--disabled' : ''}${checked ? ' active' : ''}"> <input class="mobile-facets__checkbox" type="checkbox" name="${f.param}" value="${esc(v.value)}" id="${esc(id)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}> <span class="mobile-facets__highlight"></span> ${BOX} ${CHECK} <span class="facet-checkbox__text" aria-hidden="true">${esc(v.label)} (${v.count})</span> <span class="visually-hidden">${esc(v.label)} (${productsLabel(v.count)})</span> </label> </li>`;
    }).join('');
    return `<details id="Details-Mobile-${n}-${sid}" class="mobile-facets__details js-filter" data-index="mobile-${n}"> ${summary} <div id="FacetMobile-${n}-${sid}" class="mobile-facets__submenu gradient"> ${back} <ul class="facets-layout-list mobile-facets__list list-unstyled" role="list">${items}</ul> ${footer()} </div> </details>`;
  }).join('');
}

// Removable pills for the active filters ("Saree ×") + "Remove all".
export function activeFacetsHtml(ctx, { vertical = false } = {}) {
  const { icons, state, base, defaultSort } = ctx;
  const without = (mutate) => {
    const s = { ...state, page: 1, filters: Object.fromEntries(Object.entries(state.filters).map(([k, v]) => [k, new Set(v)])) };
    mutate(s);
    const p = paramsFromState(s, defaultSort).toString();
    return base + (p ? `?${p}` : '');
  };
  const pills = [];
  for (const f of FACETS) {
    for (const v of state.filters[f.param] || []) {
      const label = f.labels?.[v] ?? v;
      pills.push(`<facet-remove><a href="${esc(without((s) => s.filters[f.param].delete(v)))}" class="active-facets__button active-facets__button--light" data-facet-remove> <span class="active-facets__button-inner button button--tertiary"> ${esc(f.key === 'blouse' ? label : `${f.label}: ${label}`)} ${icons.close} <span class="visually-hidden">Remove filter</span> </span> </a></facet-remove>`);
    }
  }
  if (state.gte !== null || state.lte !== null) {
    const label = `${formatMoney(state.gte ?? 0)} - ${state.lte !== null ? formatMoney(state.lte) : ''}`.trim();
    pills.push(`<facet-remove><a href="${esc(without((s) => { s.gte = null; s.lte = null; }))}" class="active-facets__button active-facets__button--light" data-facet-remove> <span class="active-facets__button-inner button button--tertiary"> ${esc(label)} ${icons.close} <span class="visually-hidden">Remove filter</span> </span> </a></facet-remove>`);
  }
  const keepQ = state.q ? `?q=${encodeURIComponent(state.q)}` : '';
  const removeAll = `<facet-remove class="active-facets__button-wrapper"> <a href="${esc(base + keepQ)}" class="active-facets__button-remove underlined-link" role="button" data-facet-remove> <span>Remove all</span> </a> </facet-remove>`;
  if (vertical) return `<div class="active-facets-vertical-filter"><h2 class="facets__heading facets__heading--vertical caption-large text-body" id="verticalTitle" tabindex="-1"> Filter: </h2>${pills.length ? removeAll : ''}</div>${pills.join('')}`;
  return pills.join('') + (pills.length ? removeAll : '');
}

export function paginationHtml(ctx, page, pages) {
  const { icons, state, base, defaultSort } = ctx;
  const links = pageLinks(page, pages);
  if (!links.length) return '';
  const href = (n) => { const p = paramsFromState({ ...state, page: n }, defaultSort).toString(); return base + (p ? `?${p}` : ''); };
  const arrow = (n, dir) => `<li><a href="${esc(href(n))}" class="pagination__item pagination__item--${dir === 'prev' ? 'next' : 'prev'} pagination__item-arrow link motion-reduce" aria-label="${dir === 'prev' ? 'Previous page' : 'Next page'}" data-page="${n}">${icons.caret}</a></li>`;
  return `<nav class="pagination" role="navigation" aria-label="Pagination"><ul class="pagination__list list-unstyled" role="list">${page > 1 ? arrow(page - 1, 'prev') : ''}${links.map((l) => l.gap ? '<li><span class="pagination__item">…</span></li>' : l.current ? `<li><a role="link" aria-disabled="true" class="pagination__item pagination__item--current light" aria-current="page" aria-label="Page ${l.n}">${l.n}</a></li>` : `<li><a href="${esc(href(l.n))}" class="pagination__item link" aria-label="Page ${l.n}" data-page="${l.n}">${l.n}</a></li>`).join('')}${page < pages ? arrow(page + 1, 'next') : ''}</ul></nav>`;
}

export const sortSelectHtml = (id, cls, options, selected) => `<select name="sort_by" class="${cls}" id="${id}">${options.map((o) => `<option value="${o.value}"${o.value === selected ? ' selected="selected"' : ''}> ${esc(o.label)} </option>`).join('')}</select>`;
