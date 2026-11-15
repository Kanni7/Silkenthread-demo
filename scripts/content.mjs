// Full-site content: every /pages/* and /blogs/* URL from the sitemap inventory (polite, cached).
// -> src/data/pages.json (adds the pages that the demo didn't have; keeps existing entries)
// -> src/data/blogs.json (blog indexes + articles)
// Usage: node scripts/content.mjs [--offline] [--refresh]
import fs from 'node:fs';
import { ORIGIN, loadRobots, politeFetch, NotCached } from './lib/polite.mjs';
import { load, txt, image, templateSections } from './lib/parse.mjs';

const inv = JSON.parse(fs.readFileSync('reference/inventory.json', 'utf8'));
const pages = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
const write = (name, data) => { fs.writeFileSync(`src/data/${name}`, JSON.stringify(data, null, 1)); console.log(`wrote src/data/${name}`); };
const path = (u) => new URL(u).pathname;

await loadRobots();
const get = async (url) => {
  try {
    const r = await politeFetch(url);
    return r.status === 200 ? load(r.body.toString('utf8')) : null;
  } catch (e) {
    if (e instanceof NotCached) return null;
    throw e;
  }
};
const meta = ($) => ({ metaTitle: txt($('title').text()), metaDescription: $('meta[name=description]').attr('content') || null });

// ---------- pages ----------
for (const url of inv.pages) {
  const handle = path(url).split('/pages/')[1];
  if (pages[handle] && !pages[handle].missing) continue; // already captured (rendered DOM)
  const $ = await get(url);
  if (!$) { pages[handle] = { handle, url: `/pages/${handle}`, title: null, sections: [], missing: true }; continue; }
  pages[handle] = { handle, url: `/pages/${handle}`, title: txt($('h1').first().text()) || txt($('title').text()), ...meta($), sections: templateSections($) };
}
write('pages.json', pages);

// ---------- blogs ----------
const articleOf = ($, url) => {
  const a = $('article.article-template, article').first();
  const time = a.find('time').first();
  const hero = $('.article-template__hero-container img, .article-template__hero-medium img, .article-template img').first();
  return {
    url: path(url),
    handle: path(url).split('/').pop(),
    title: txt(a.find('h1').first().text()) || txt($('title').text()),
    date: time.attr('datetime') || null,
    dateLabel: txt(time.text()) || null,
    author: txt(a.find('.article-template__title + span, [itemprop=author], .caption-with-letter-spacing').first().text()).replace(/^by\s+/i, '') || null,
    image: hero.length ? image($, hero) : null,
    html: a.find('.article-template__content, .rte').first().html()?.trim() || null,
    ...meta($),
  };
};
const blogs = {};
for (const url of inv.blogs) {
  const parts = path(url).split('/').filter(Boolean); // ['blogs', blog, article?]
  const blog = parts[1];
  blogs[blog] ||= { handle: blog, url: `/blogs/${blog}`, title: null, articles: [] };
  const $ = await get(url);
  if (!$) continue;
  if (parts.length === 2) {
    blogs[blog].title = txt($('h1').first().text()) || txt($('title').text());
    Object.assign(blogs[blog], meta($));
    // Index order (newest first) + excerpts, from the listing cards
    blogs[blog].listing = $('.blog-articles .article-card, .blog-articles__article').map((i, el) => {
      const c = $(el);
      return { href: c.find('a[href*="/blogs/"]').first().attr('href'), excerpt: txt(c.find('.article-card__excerpt').text()) || null };
    }).get();
  } else {
    blogs[blog].articles.push(articleOf($, url));
  }
}
for (const b of Object.values(blogs)) {
  const order = (b.listing || []).map((l) => l.href);
  const excerpt = Object.fromEntries((b.listing || []).map((l) => [l.href, l.excerpt]));
  b.articles.forEach((a) => (a.excerpt = excerpt[a.url] || null));
  b.articles.sort((x, y) => (y.date || '').localeCompare(x.date || '') || order.indexOf(x.url) - order.indexOf(y.url));
}
write('blogs.json', blogs);
console.log(Object.values(pages).filter((p) => p.missing).map((p) => `missing page ${p.handle}`).join('\n') || 'all pages ok');
console.log(Object.values(blogs).map((b) => `${b.handle}: ${b.articles.length} articles`).join('\n'));
