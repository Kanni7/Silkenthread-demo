// Product page: variant pills (price, availability, gallery image), add to cart / buy it now into the
// front-end cart (src/scripts/cart-store.js), share/copy link.
import { addToCart } from './cart-store.js';
import { priceHtml, SOLD_OUT } from '../lib/card.js';

class ProductInfo extends HTMLElement {
  connectedCallback() {
    this.variants = JSON.parse(this.dataset.variants);
    this.form = this.querySelector('form[data-type="add-to-cart-form"]');
    this.button = this.querySelector('.product-form__submit');
    this.addEventListener('change', (e) => e.target.matches('variant-selects input') && this.onVariantChange());
    this.form?.addEventListener('submit', (e) => { e.preventDefault(); this.add(false); });
    this.querySelector('[data-buy-now]')?.addEventListener('click', () => this.add(true));
    this.querySelector('[data-share]')?.addEventListener('click', () => this.share());
    this.preselect();
  }
  current() {
    const id = +this.form.querySelector('[name=id]').value;
    return this.variants.find((v) => v.id === id);
  }
  // ?variant=<id> in the URL selects that variant, like the live store.
  preselect() {
    const want = new URLSearchParams(location.search).get('variant');
    const v = want && this.variants.find((x) => String(x.id) === want);
    if (!v) return;
    this.querySelectorAll('variant-selects fieldset').forEach((f, i) => {
      const input = [...f.querySelectorAll('input')].find((x) => x.value === v.options[i]);
      if (input) input.checked = true;
    });
    this.onVariantChange();
  }
  onVariantChange() {
    const chosen = [...this.querySelectorAll('variant-selects fieldset')].map((f) => f.querySelector('input:checked')?.value);
    const v = this.variants.find((x) => x.options.every((o, i) => o === chosen[i]));
    const label = this.button.querySelector('span');
    if (!v) { this.button.disabled = true; label.textContent = 'Unavailable'; return; }
    this.form.querySelector('[name=id]').value = v.id;
    this.button.disabled = !v.available;
    label.textContent = v.available ? 'Add to cart' : SOLD_OUT;
    this.querySelector('.shopify-payment-button').hidden = !v.available;
    this.querySelector('[data-price]').innerHTML = priceHtml({ p: v.price, c: v.compareAtPrice, a: v.available }, { extraClass: 'price--large price--show-badge', badges: true });
    const slide = v.imageKey && document.querySelector(`[data-media-key="${CSS.escape(v.imageKey)}"]`);
    if (slide) slide.parentElement.prepend(slide);
    const url = new URL(location.href);
    url.searchParams.set('variant', v.id);
    history.replaceState(null, '', url);
  }
  add(goToCart) {
    const v = this.current();
    if (!v?.available) return;
    addToCart(this.dataset.handle, v.id);
    if (goToCart) { location.href = '/cart'; return; }
    const label = this.button.querySelector('span');
    label.textContent = 'Added to cart ✓';
    setTimeout(() => (label.textContent = 'Add to cart'), 1800);
  }
  async share() {
    const el = this.querySelector('share-button');
    const url = el.dataset.url;
    const msg = el.querySelector('.share-button__message');
    if (navigator.share) {
      try { await navigator.share({ url, title: document.title }); return; } catch { /* cancelled: fall back to copying */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      msg.textContent = 'Link copied to clipboard!';
    } catch {
      msg.textContent = url;
    }
    msg.classList.remove('hidden');
  }
}
customElements.get('product-info') || customElements.define('product-info', ProductInfo);
