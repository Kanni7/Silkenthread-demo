// Blog helpers (build time).

// Card excerpt: the live listing's excerpt when captured, otherwise the first 30 words of the article
// (Shopify's `truncatewords: 30`, which the live cards use).
export function excerptOf(a) {
  if (a.excerpt) return a.excerpt;
  const text = (a.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
  const words = text.split(' ');
  return words.length > 30 ? `${words.slice(0, 30).join(' ')}...` : text;
}
