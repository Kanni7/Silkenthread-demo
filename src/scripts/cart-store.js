// Front-end-only cart for the concept site (no orders are placed): items live in this browser's
// localStorage. The header cart icon shows the item count.
const KEY = 'st-cart';
export function readCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
export function writeCart(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  updateBubble(items);
}
export function addToCart(handle, variantId, qty = 1) {
  const items = readCart();
  const hit = items.find((i) => i.v === variantId);
  if (hit) hit.q += qty;
  else items.push({ h: handle, v: variantId, q: qty });
  writeCart(items);
  return items;
}
export function updateBubble(items = readCart()) {
  const count = items.reduce((n, i) => n + i.q, 0);
  const icon = document.getElementById('cart-icon-bubble');
  if (!icon) return;
  let bubble = icon.querySelector('.cart-count-bubble');
  if (!count) { bubble?.remove(); return; }
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'cart-count-bubble';
    icon.append(bubble);
  }
  bubble.innerHTML = `<span aria-hidden="true">${count < 100 ? count : ''}</span><span class="visually-hidden">${count} item${count === 1 ? '' : 's'}</span>`;
}
updateBubble();
