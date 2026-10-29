// Screenshot the replica's open desktop dropdown + mobile drawer next to the reference captures.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx astro preview --port 4323', { shell: true, stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => /127\.0\.0\.1|localhost/.test(d) && r()));
const b = await chromium.launch({ channel: 'chrome' });
const shot = async (w, h, act, out) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await p.goto('http://127.0.0.1:4323/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('slideshow-component').forEach((s) => s.pause?.(true)));
  await act(p); await p.waitForTimeout(600);
  await p.screenshot({ path: out }); await p.close();
};
await shot(1440, 900, (p) => p.click('.header__inline-menu details > summary'), '.cache/replica/menu-desktop-1440.png');
await shot(375, 812, (p) => p.click('header-drawer summary'), '.cache/replica/menu-mobile-drawer-375.png');
await shot(375, 812, async (p) => { await p.click('header-drawer summary'); await p.waitForTimeout(400); await p.click('#menu-drawer details > summary'); }, '.cache/replica/menu-mobile-submenu-375.png');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const v = await b.newPage({ viewport: { width: 1600, height: 400 } });
await v.setContent(`<body style="margin:0;background:#f0f;display:grid;gap:8px;grid-template-columns:repeat(2,1fr)">
<img style="width:100%" src="data:image/png;base64,${b64('reference/screenshots/menu-desktop-1-iconic-weaves-1440.png')}"><img style="width:100%" src="data:image/png;base64,${b64('.cache/replica/menu-desktop-1440.png')}">
<div style="display:flex;gap:8px"><img style="width:24%" src="data:image/png;base64,${b64('reference/screenshots/menu-mobile-drawer-375.png')}"><img style="width:24%" src="data:image/png;base64,${b64('reference/screenshots/menu-mobile-drawer-submenu-375.png')}"></div>
<div style="display:flex;gap:8px"><img style="width:24%" src="data:image/png;base64,${b64('.cache/replica/menu-mobile-drawer-375.png')}"><img style="width:24%" src="data:image/png;base64,${b64('.cache/replica/menu-mobile-submenu-375.png')}"></div>`);
await v.waitForTimeout(300);
await v.screenshot({ path: '.cache/compare/menus.jpg', type: 'jpeg', quality: 70, fullPage: true });
await b.close(); server.kill(); process.exit(0);
