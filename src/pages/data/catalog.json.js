// /data/catalog.json: every product as a compact summary, for client-side filtering, sorting and search.
import { products, summary } from '../../lib/data.js';
import { encode } from '../../lib/catalog-codec.js';

export function GET() {
  return new Response(JSON.stringify(encode(products.map(summary))), { headers: { 'content-type': 'application/json' } });
}
