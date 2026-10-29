import { defineConfig } from 'astro/config';

// Static, private concept build. URLs mirror the live store (no trailing slash: /collections/sale).
export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never' },
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
});
