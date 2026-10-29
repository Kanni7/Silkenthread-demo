// Header behaviour: mobile drawer, dropdown menus, search modal, localization disclosure.

const onKey = (key, fn) => document.addEventListener('keyup', (e) => e.key === key && fn(e));

// Drawers use Craft's CSS: details[open].menu-opening > .menu-drawer slides in.
function openDetails(details) {
  details.setAttribute('open', '');
  requestAnimationFrame(() => details.classList.add('menu-opening'));
  details.querySelector('summary')?.setAttribute('aria-expanded', 'true');
}
function closeDetails(details) {
  details.classList.remove('menu-opening');
  details.querySelector('summary')?.setAttribute('aria-expanded', 'false');
  setTimeout(() => details.removeAttribute('open'), 200);
}

class HeaderDrawer extends HTMLElement {
  connectedCallback() {
    this.main = this.querySelector('details');
    this.main.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      if (this.main.classList.contains('menu-opening')) return this.close();
      const header = document.querySelector('.section-header');
      document.documentElement.style.setProperty('--header-bottom-position', `${Math.round(header.getBoundingClientRect().bottom)}px`);
      header.classList.add('menu-open');
      document.body.classList.add('overflow-hidden-tablet');
      openDetails(this.main);
    });
    // Same-page links (e.g. "Shop by occasion" anchor) close the drawer so the target is visible.
    this.querySelector('#menu-drawer').addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (a && a.hash && a.pathname === location.pathname) this.close(false);
    });
    // Slide-in submenus are the top-level details only; nested details (category groups) are plain accordions.
    this.querySelectorAll('#menu-drawer .menu-drawer__menu > li > details').forEach((sub) => {
      sub.querySelector('summary').addEventListener('click', (e) => {
        e.preventDefault();
        openDetails(sub);
        this.main.classList.add('submenu-open');
      });
      sub.querySelector('.menu-drawer__close-button')?.addEventListener('click', () => {
        closeDetails(sub);
        this.main.classList.remove('submenu-open');
        sub.querySelector('summary').focus();
      });
    });
    onKey('Escape', () => this.main.hasAttribute('open') && this.close());
  }
  close(restoreFocus = true) {
    this.querySelectorAll('#menu-drawer details[open]').forEach(closeDetails);
    this.main.classList.remove('submenu-open');
    closeDetails(this.main);
    document.querySelector('.section-header')?.classList.remove('menu-open');
    document.body.classList.remove('overflow-hidden-tablet');
    if (restoreFocus) this.main.querySelector('summary').focus();
  }
}

class HeaderMenu extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector('details');
    this.summary = this.details.querySelector('summary');
    this.details.addEventListener('toggle', () => {
      this.summary.setAttribute('aria-expanded', String(this.details.open));
      if (this.details.open) document.querySelectorAll('header-menu details[open]').forEach((d) => d !== this.details && d.removeAttribute('open'));
    });
    document.addEventListener('click', (e) => !this.contains(e.target) && this.details.removeAttribute('open'));
    // Close when keyboard focus leaves the menu, or after choosing a link (incl. same-page anchors).
    this.addEventListener('focusout', (e) => { if (this.details.open && e.relatedTarget && !this.contains(e.relatedTarget)) this.details.removeAttribute('open'); });
    this.details.addEventListener('click', (e) => e.target.closest('a[href]') && this.details.removeAttribute('open'));
    onKey('Escape', () => { if (this.details.open) { this.details.removeAttribute('open'); this.summary.focus(); } });
  }
}

class DetailsModal extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector('details');
    this.summary = this.details.querySelector('summary');
    this.summary.addEventListener('click', (e) => { e.preventDefault(); this.details.open ? this.close() : this.open(); });
    this.querySelector('.modal-overlay')?.addEventListener('click', () => this.close());
    this.querySelector('.modal__close-button')?.addEventListener('click', () => this.close());
    onKey('Escape', () => this.details.open && this.close());
  }
  open() {
    this.details.setAttribute('open', '');
    document.body.classList.add('overflow-hidden');
    this.querySelector('input[type="search"]')?.focus();
  }
  close() {
    this.details.removeAttribute('open');
    document.body.classList.remove('overflow-hidden');
    this.summary.focus();
  }
}

class LocalizationForm extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    const list = this.querySelector('.disclosure__list-wrapper');
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
    });
    this.querySelectorAll('a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); list.hidden = true; button.setAttribute('aria-expanded', 'false'); }));
  }
}

for (const [name, cls] of [['header-drawer', HeaderDrawer], ['header-menu', HeaderMenu], ['details-modal', DetailsModal], ['localization-form', LocalizationForm]]) {
  if (!customElements.get(name)) customElements.define(name, cls);
}
