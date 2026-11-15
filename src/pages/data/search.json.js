// /data/search.json: extra search text per product (tags, product type), indexed like catalog.json rows.
// Loaded only by the search page and the header's predictive search.
import { products } from '../../lib/data.js';

export function GET() {
  const text = products.map((p) => [p.productType, ...p.tags].join(' ').replace(/\s+/g, ' ').trim());
  return new Response(JSON.stringify(text), { headers: { 'content-type': 'application/json' } });
}
