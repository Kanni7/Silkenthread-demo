// Fidelity check: screenshot the built replica (astro preview) and put it next to the reference capture.
// Usage: npm run build && node scripts/compare.mjs [page] [width]
// Output: .cache/replica/{page}-{w}.png and .cache/compare/{page}-{w}.jpg (reference | replica)
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const PAGES = { home: '/' };
const WIDTHS = { 375: 812, 768: 1024, 1440: 900 };
const [, , onlyPage, onlyWidth] = process.argv;
const results = [];
fs.mkdirSync('.cache/replica', { recursive: true });
fs.mkdirSync('.cache/compare', { recursive: true });

const server = spawn('npx astro preview --port 4322', { shell: true, stdio: 'pipe' });
await new Promise((resolve) => server.stdout.on('data', (d) => /localhost|127\.0\.0\.1/.test(d) && resolve()));

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, path] of Object.entries(PAGES)) {
    if (onlyPage && name !== onlyPage) continue;
    for (const [w, h] of Object.entries(WIDTHS)) {
      if (onlyWidth && w !== onlyWidth) continue;
      const page = await browser.newPage({ viewport: { width: +w, height: h }, reducedMotion: 'reduce' });
      await page.goto(`http://127.0.0.1:4322${path}`, { waitUntil: 'networkidle' });
      // Same capture conditions as reference: scroll through for lazy images, slideshow parked on slide 1.
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += h * 0.8) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(100); }
      await page.evaluate(() => { document.querySelectorAll('slideshow-component').forEach((s) => { s.pause?.(true); const sl = s.querySelector('.slider'); if (sl) sl.scrollLeft = 0; }); scrollTo(0, 0); });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const out = `.cache/replica/${name}-${w}.png`;
      await page.screenshot({ path: out, fullPage: true });
      await page.close();

      // Side-by-side, scaled down for review.
      const ref = `reference/screenshots/${name}-${w}.png`;
      const b64 = (f) => fs.readFileSync(f).toString('base64');
      const scale = w === '1440' ? 0.4 : 0.6;
      const view = await browser.newPage({ viewport: { width: Math.round(w * scale * 2 + 30), height: 200 } });
      await view.setContent(`<body style="margin:0;display:flex;gap:30px;align-items:flex-start;background:#f0f"><img style="width:${w * scale}px" src="data:image/png;base64,${b64(ref)}"><img style="width:${w * scale}px" src="data:image/png;base64,${b64(out)}">`);
      await view.waitForTimeout(300);
      await view.screenshot({ path: `.cache/compare/${name}-${w}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
      await view.close();
      // Pixel diff over the common height (pages can differ in length).
      const A = PNG.sync.read(fs.readFileSync(ref)), B = PNG.sync.read(fs.readFileSync(out));
      const width = Math.min(A.width, B.width), height = Math.min(A.height, B.height);
      const crop = (img) => { const o = new PNG({ width, height }); PNG.bitblt(img, o, 0, 0, width, height, 0, 0); return o; };
      const diff = new PNG({ width, height });
      const n = pixelmatch(crop(A).data, crop(B).data, diff.data, width, height, { threshold: 0.15 });
      fs.writeFileSync(`.cache/compare/${name}-${w}-diff.png`, PNG.sync.write(diff));
      results.push({ page: name, width: +w, refHeight: A.height, replicaHeight: B.height, diffPercent: +((100 * n) / (width * height)).toFixed(2) });
      console.log(`${name} @ ${w}: height ${A.height} vs ${B.height}, ${results.at(-1).diffPercent}% pixels differ -> .cache/compare/${name}-${w}.jpg`);
    }
  }
} finally {
  await browser.close();
  server.kill();
  fs.writeFileSync('.cache/compare/results.json', JSON.stringify(results, null, 1));
}
process.exit(0);
