// Product card markup (Craft card-product.liquid), shared by the build and the browser so that
// server-rendered grids and client-filtered grids are identical. Input is a summary() record.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const formatMoney = (n) => 'Rs. ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WIDTHS = [165, 360, 533, 720, 940, 1066];
export function imgSrc(i, w) {
  if (i.l) return i.l;
  const u = new URL(i.u);
  u.searchParams.set('width', String(w));
  return u.toString();
}
export function imgSrcset(i) {
  if (i.l) return `${i.l} ${Math.min(1000, i.w || 1000)}w`;
  return WIDTHS.filter((w) => !i.w || w <= i.w).map((w) => `${imgSrc(i, w)} ${w}w`).join(', ');
}

export function priceHtml(s, { extraClass = '', badges = false } = {}) {
  const badgeHtml = badges ? '<span class="badge price__badge-sale color-accent-2"> Sale </span><span class="badge price__badge-sold-out color-inverse"> Sold out </span>' : '';
  const onSale = s.c && s.c > s.p;
  const cls = ['price', extraClass, onSale ? 'price--on-sale' : '', !s.a ? 'price--sold-out' : ''].filter(Boolean).join(' ');
  return `<div class=" ${cls} "><div class="price__container"><div class="price__regular"><span class="visually-hidden visually-hidden--inline">Regular price</span><span class="price-item price-item--regular"> ${formatMoney(s.p)} </span></div><div class="price__sale"><span class="visually-hidden visually-hidden--inline">Regular price</span><span><s class="price-item price-item--regular">${onSale ? ` ${formatMoney(s.c)} ` : ''}</s></span><span class="visually-hidden visually-hidden--inline">Sale price</span><span class="price-item price-item--sale price-item--last"> ${formatMoney(s.p)} </span></div><small class="unit-price caption hidden"><span class="visually-hidden">Unit price</span><span class="price-item price-item--last"><span></span><span aria-hidden="true">/</span><span class="visually-hidden">&nbsp;per&nbsp;</span><span></span></span></small></div>${badgeHtml}</div>`;
}

function badge(s, id) {
  if (!s.a) return `<span id="${id}" class="badge badge--bottom-left color-inverse">Sold out</span>`;
  if (s.c && s.c > s.p) return `<span id="${id}" class="badge badge--bottom-left color-accent-2">Sale</span>`;
  return '';
}

export function cardHtml(s, { sectionId, sizes, cardClass = 'card card--card card--media color-accent-1 gradient', ratioStyle = '--ratio-percent: 125.0%;', lazy = true, itemClass = 'grid__item', itemAttrs = '' } = {}) {
  const id = `${sectionId}-${s.id}`;
  const img = (i, extra = '') => `<img srcset="${imgSrcset(i)}" src="${imgSrc(i, 533)}" sizes="${esc(sizes)}" alt="${esc(i.alt)}" class="motion-reduce" ${lazy || extra ? 'loading="lazy" ' : ''}width="${i.w}" height="${i.h}">`;
  const media = s.i ? `<div class="card__media"><div class="media media--transparent media--hover-effect">${img(s.i)}${s.i2 ? img(s.i2, 'second') : ''}</div></div>` : '';
  const title = esc(s.t);
  return `<li class="${itemClass}"${itemAttrs}><div class="card-wrapper product-card-wrapper underline-links-hover"><div class=" ${cardClass} " style="${ratioStyle}"><div class="card__inner ratio" style="${ratioStyle}">${media}<div class="card__content"><div class="card__information"><h3 class="card__heading"><a href="/products/${s.h}" id="StandardCardNoMediaLink-${id}" class="full-unstyled-link" aria-labelledby="StandardCardNoMediaLink-${id} NoMediaStandardBadge-${id}"> ${title} </a></h3></div><div class="card__badge bottom left">${badge(s, `NoMediaStandardBadge-${id}`)}</div></div></div><div class="card__content"><div class="card__information"><h3 class="card__heading h5" id="title-${id}"><a href="/products/${s.h}" id="CardLink-${id}" class="full-unstyled-link" aria-labelledby="CardLink-${id} Badge-${id}"> ${title} </a></h3><div class="card-information"><span class="caption-large light"></span>${priceHtml(s)}</div></div><div class="card__badge bottom left">${badge(s, `Badge-${id}`)}</div></div></div></div></li>`;
}
