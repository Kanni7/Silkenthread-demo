// Client side of CollectionProducts.astro: filters, sort and pagination from /data/catalog.json.
// State lives in the URL (?filter.p.product_type=Saree&sort_by=price-ascending&page=2) like the live store,
// so links are shareable and the back button works.
import { decode } from '../lib/catalog-codec.js';
import { run, searchList, stateFromParams, paramsFromState, PRICE_GTE, PRICE_LTE } from '../lib/catalog.js';
import { cardHtml } from '../lib/card.js';
import { facetIcons } from '../lib/icons.js';
import { desktopFacetsHtml, mobileFacetsHtml, activeFacetsHtml, paginationHtml, productsLabel } from '../lib/facets-html.js';

let catalogPromise = null;
export function loadCatalog() {
  catalogPromise ||= fetch('/data/catalog.json').then((r) => r.json()).then(decode);
  return catalogPromise;
}
let searchTextPromise = null;
export function loadSearchText() {
  searchTextPromise ||= fetch('/data/search.json').then((r) => r.json());
  return searchTextPromise;
}

class CollectionProducts extends HTMLElement {
  connectedCallback() {
    this.config = JSON.parse(this.dataset.config);
    const grid = this.querySelector('#product-grid');
    this.cardOptions = grid && { sectionId: this.config.sid, sizes: grid.querySelector('img')?.getAttribute('sizes') || '', cardClass: grid.querySelector('.card')?.className.trim() || '', ratioStyle: grid.querySelector('.card')?.getAttribute('style') || '', itemClass: grid.querySelector('li')?.className || 'grid__item' };
    if (!this.querySelector('[data-collection]')) return;

    this.addEventListener('change', (e) => this.onChange(e));
    this.addEventListener('click', (e) => this.onClick(e));
    this.addEventListener('submit', (e) => e.preventDefault());
    window.addEventListener('popstate', () => this.render(stateFromParams(new URLSearchParams(location.search), this.config.defaultSort), { push: false }));
    this.setupMobileDrawer();

    const params = new URLSearchParams(location.search);
    if ([...params.keys()].some((k) => k !== 'q') || this.config.mode === 'search') this.render(stateFromParams(params, this.config.defaultSort), { push: false });
  }

  async list() {
    if (this._list) return this._list;
    const all = await loadCatalog();
    if (this.config.mode === 'search') {
      const text = await loadSearchText();
      all.forEach((s, i) => (s.g ||= text[i]));
      this._all = all;
      return all; // filtered by the query in render()
    }
    this._list = this.config.ids.map((i) => all[i]).filter(Boolean);
    return this._list;
  }

  currentState() {
    return stateFromParams(new URLSearchParams(location.search), this.config.defaultSort);
  }

  // Reads the form that changed (desktop or mobile) into a new state.
  stateFromForm(form, base) {
    const fd = new FormData(form);
    const p = new URLSearchParams();
    if (base.q) p.set('q', base.q);
    for (const [k, v] of fd) if (v !== '' && k !== 'sort_by') p.append(k, v);
    const s = stateFromParams(p, this.config.defaultSort);
    s.sort = base.sort;
    return s;
  }

  onChange(e) {
    const t = e.target;
    const base = this.currentState();
    if (t.name === 'sort_by') {
      this.render({ ...base, sort: t.value, page: 1 });
      return;
    }
    const form = t.closest('[data-facets-form]');
    if (!form) return;
    const mobile = form.id === 'FacetFiltersFormMobile';
    const next = this.stateFromForm(form, base);
    // Mobile: apply live too (counts update), the drawer stays open until "Apply".
    this.render(next, { keepDrawer: mobile });
  }

  onClick(e) {
    const a = e.target.closest('a[data-page], a[data-facet-remove]');
    if (a) {
      e.preventDefault();
      const url = new URL(a.href, location.href);
      this.render(stateFromParams(url.searchParams, this.config.defaultSort), { scroll: a.matches('[data-page]') });
      return;
    }
    if (e.target.closest('[data-facets-apply]')) {
      this.closeDrawer();
      return;
    }
  }

  async render(state, { push = true, scroll = false, keepDrawer = false } = {}) {
    const container = this.querySelector('[data-collection]');
    container.classList.add('loading');
    let list = await this.list();
    if (this.config.mode === 'search') list = searchList(list, state.q);
    const r = run(list, state, this.config.defaultSort);
    state.page = r.page;
    const max = list.reduce((m, s) => Math.max(m, s.p), 0);
    const ctx = { sid: this.config.sid, icons: facetIcons, counts: r.counts, state, max, base: this.config.base, defaultSort: this.config.defaultSort };

    this.querySelector('[data-grid]').innerHTML = r.items.map((s) => cardHtml(s, this.cardOptions)).join('');
    this.querySelector('[data-empty]').hidden = r.total > 0;
    this.querySelector('[data-pagination]').innerHTML = paginationHtml(ctx, r.page, r.pages);
    this.querySelectorAll('[data-product-count]').forEach((el) => (el.textContent = productsLabel(r.total)));
    this.querySelectorAll('select[name=sort_by]').forEach((el) => (el.value = state.sort));

    // Re-render facets, keeping which groups are open.
    const openIds = new Set([...this.querySelectorAll('[data-facets] details[open]')].map((d) => d.id));
    const desktop = this.querySelector('[data-facets="desktop"]');
    const mobile = this.querySelector('[data-facets="mobile"]');
    const focusId = document.activeElement?.id;
    if (desktop) desktop.innerHTML = desktopFacetsHtml(ctx);
    if (mobile) mobile.innerHTML = mobileFacetsHtml(ctx);
    this.querySelectorAll('[data-facets] details').forEach((d) => {
      if (openIds.has(d.id)) { d.open = true; if (d.matches('.mobile-facets__details')) d.classList.add('menu-opening'); }
      else if (d.matches('.mobile-facets__details')) d.open = false;
    });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    this.querySelector('[data-active-facets="vertical"]').innerHTML = activeFacetsHtml(ctx, { vertical: true });
    this.querySelector('[data-active-facets="mobile"]').innerHTML = activeFacetsHtml(ctx);
    if (!keepDrawer) this.closeDrawer();

    if (push) {
      const p = paramsFromState(state, this.config.defaultSort).toString();
      history.pushState(null, '', location.pathname + (p ? `?${p}` : ''));
    }
    container.classList.remove('loading');
    if (scroll) this.querySelector('#ProductGridContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Craft menu-drawer behaviour for the mobile filter drawer: open/close with a slide, sub-panels per facet.
  setupMobileDrawer() {
    const drawer = this.querySelector('[data-mobile-facets]');
    if (!drawer) return;
    this.drawer = drawer;
    drawer.querySelector(':scope > summary').addEventListener('click', (e) => {
      e.preventDefault();
      drawer.open ? this.closeDrawer() : this.openDrawer();
    });
    drawer.addEventListener('click', (e) => {
      const sum = e.target.closest('.mobile-facets__details > summary');
      if (sum) {
        e.preventDefault();
        const d = sum.parentElement;
        d.open = true;
        sum.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => d.classList.add('menu-opening'));
        return;
      }
      const back = e.target.closest('[data-facets-back]');
      if (back) {
        const d = back.closest('details');
        d.classList.remove('menu-opening');
        d.querySelector('summary').setAttribute('aria-expanded', 'false');
        setTimeout(() => (d.open = false), 400);
      }
    });
    drawer.addEventListener('keyup', (e) => e.key === 'Escape' && this.closeDrawer());
  }
  openDrawer() {
    this.drawer.open = true;
    requestAnimationFrame(() => this.drawer.classList.add('menu-opening'));
    document.body.classList.add('overflow-hidden-mobile');
  }
  closeDrawer() {
    if (!this.drawer?.open) return;
    this.drawer.classList.remove('menu-opening');
    document.body.classList.remove('overflow-hidden-mobile');
    setTimeout(() => {
      this.drawer.open = false;
      this.drawer.querySelectorAll('.mobile-facets__details').forEach((d) => { d.open = false; d.classList.remove('menu-opening'); });
    }, 300);
  }
}
customElements.get('collection-products') || customElements.define('collection-products', CollectionProducts);
