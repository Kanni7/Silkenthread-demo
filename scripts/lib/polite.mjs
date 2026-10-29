// Polite, cached, robots-aware fetcher. One request at a time, >= 1 s apart.
// Every response body + metadata is cached in .cache/ so nothing is fetched twice.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ORIGIN = 'https://silkenthread.in';
export const BOT_TOKEN = 'SilkenThreadRedesignConcept/0.1 (private UI/UX redesign proposal; read-only; 1 req/s)';
export const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ${BOT_TOKEN}`;
const CACHE_DIR = path.resolve('.cache/http');
fs.mkdirSync(CACHE_DIR, { recursive: true });

export class StopCrawl extends Error {}

let minGapMs = 1000;
let lastAt = 0;
let chain = Promise.resolve();
let rules = null; // robots rules for our group
let stopped = null; // once blocked, refuse all further network requests

const key = (url) => crypto.createHash('sha1').update(url).digest('hex');
const metaPath = (url) => path.join(CACHE_DIR, key(url) + '.json');
const bodyPath = (url) => path.join(CACHE_DIR, key(url) + '.bin');

export function cached(url) {
  if (!fs.existsSync(metaPath(url))) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath(url), 'utf8'));
  return { ...meta, body: fs.readFileSync(bodyPath(url)) };
}

export function store(url, status, headers, body) {
  fs.writeFileSync(bodyPath(url), body);
  fs.writeFileSync(metaPath(url), JSON.stringify({ url, status, headers, fetchedAt: new Date().toISOString() }));
}

// --- robots.txt (Google-style: longest match wins, Allow beats Disallow on tie, * and $ wildcards)
export function parseRobots(txt, agent = '*') {
  const groups = [];
  let cur = null, lastWasUA = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m, field = k.toLowerCase();
    if (field === 'user-agent') {
      if (!lastWasUA) groups.push((cur = { agents: [], rules: [], delay: 0 }));
      cur.agents.push(v.toLowerCase());
      lastWasUA = true;
      continue;
    }
    lastWasUA = false;
    if (!cur) continue;
    if (field === 'allow' || field === 'disallow') { if (v) cur.rules.push({ allow: field === 'allow', path: v }); }
    else if (field === 'crawl-delay') cur.delay = parseFloat(v) || 0;
  }
  const g = groups.find((g) => g.agents.includes(agent.toLowerCase())) || groups.find((g) => g.agents.includes('*'));
  return g || { rules: [], delay: 0 };
}

function ruleRegex(p) {
  const anchored = p.endsWith('$');
  const body = (anchored ? p.slice(0, -1) : p).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export function allowed(url) {
  if (!rules) throw new Error('robots.txt not loaded');
  const u = new URL(url);
  if (u.origin !== ORIGIN) return true; // robots applies per host; only our origin is crawled directly
  const target = u.pathname + u.search;
  let best = null;
  for (const r of rules.rules) {
    if (ruleRegex(r.path).test(target) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return !best || best.allow;
}

export async function loadRobots() {
  const res = await politeFetch(ORIGIN + '/robots.txt', { skipRobots: true });
  rules = parseRobots(res.body.toString('utf8'), 'SilkenThreadRedesignConcept');
  if (rules.delay) minGapMs = Math.max(minGapMs, rules.delay * 1000);
  return { rules, minGapMs };
}

// Shopify embeds an hCaptcha *form* bootstrap on every page, so only look at the title / final URL.
const looksBlocked = (status, text, finalUrl = '') => {
  if (status === 429 || status === 403 || status === 503) return true;
  if (/\/(challenge|captcha)/i.test(new URL(finalUrl || 'http://x/').pathname)) return true;
  const title = (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1];
  return /captcha|verify you|connection needs to be verified|just a moment|access denied|are you a robot/i.test(title);
};

// Serialised + throttled fetch. Returns {status, headers, body(Buffer), fromCache}.
export function politeFetch(url, { skipRobots = false, headers = {} } = {}) {
  const hit = cached(url);
  if (hit) return Promise.resolve({ ...hit, fromCache: true });
  if (!skipRobots && !allowed(url)) return Promise.reject(new Error(`robots.txt disallows ${url}`));
  const run = async () => {
    if (stopped) throw stopped;
    const again = cached(url);
    if (again) return { ...again, fromCache: true };
    const wait = lastAt + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, redirect: 'follow' });
    const body = Buffer.from(await res.arrayBuffer());
    const hdrs = Object.fromEntries(res.headers.entries());
    const isText = /text|json|xml|javascript/.test(hdrs['content-type'] || '');
    if (looksBlocked(res.status, isText ? body.toString('utf8') : '', res.url)) {
      throw (stopped = new StopCrawl(`Possible block/rate-limit at ${url} (HTTP ${res.status}). Stopping as instructed.`));
    }
    if (res.status < 500) store(url, res.status, hdrs, body); // cache 404s too so we never re-ask
    console.log(`[fetch ${res.status}] ${url}`);
    return { status: res.status, headers: hdrs, body, fromCache: false };
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

export const gapMs = () => minGapMs;
