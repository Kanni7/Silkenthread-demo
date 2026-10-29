// Stack the same region of reference (top) and replica (bottom) at 1:1 for close inspection.
// node scripts/dev/crop.mjs <page> <width> <y0> <y1> [x0] [x1]  -> .cache/compare/crop.jpg
import fs from 'node:fs';
import { chromium } from 'playwright';
const [, , name, w, y0, y1, x0 = 0, x1 = w] = process.argv;
const b64 = (f) => fs.readFileSync(f).toString('base64');
const box = (f) => `<div style="width:${x1 - x0}px;height:${y1 - y0}px;overflow:hidden;border-bottom:4px solid #f0f"><img style="margin:-${y0}px 0 0 -${x0}px" src="data:image/png;base64,${b64(f)}"></div>`;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: x1 - x0, height: (y1 - y0) * 2 + 8 } });
await p.setContent(`<body style="margin:0">${box(`reference/screenshots/${name}-${w}.png`)}${box(`.cache/replica/${name}-${w}.png`)}`);
await p.waitForTimeout(300);
await p.screenshot({ path: '.cache/compare/crop.jpg', type: 'jpeg', quality: 80 });
await b.close();
