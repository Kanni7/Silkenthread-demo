// Resolves src/data/navigation.json against the live menu (menu.json), collections and homepage
// sections, so the redesigned navigation reuses real names and destinations.
import nav from '../data/navigation.json';
import home from '../data/home.json';
import { menu, collectionMap, localHref } from './data.js';

const menuItem = (label) => {
  const item = menu.main.find((i) => i.label === label);
  if (!item) throw new Error(`navigation.json: "${label}" is not in menu.json`);
  return item;
};
// Live menus contain duplicates (e.g. "Modal" twice under Search by Fabric): keep the first of each href.
const uniqueLinks = (links) => links.filter((l, i, all) => all.findIndex((o) => o.href === l.href) === i).map((l) => ({ label: l.label, href: localHref(l.href) }));

const homeSection = (title) => home.sections.find((s) => s.title === title);
const shortcut = (key) => {
  const s = nav.shortcuts[key];
  if (s.homeSection) {
    const section = homeSection(s.homeSection);
    return section ? { key, label: s.label, href: `/#SectionHeading-${section.id}` } : null;
  }
  return { key, label: s.label, href: s.href };
};

export const group = (g) => ({ label: g.menu, href: g.href, links: uniqueLinks(menuItem(g.menu).children || []) });

export const primary = nav.primary.map((item) =>
  item.groups ? { label: item.label, groups: item.groups.map(group), shortcuts: (item.shortcuts || []).map(shortcut).filter(Boolean) } : { label: item.label, href: item.href },
);

export const secondary = nav.secondary.map((label) => ({ label, href: localHref(menuItem(label).href) }));

const colourName = (title) => title.replace(/\s+collections?$/i, '');
export const searchConfig = {
  placeholder: nav.search.placeholder,
  pillLabel: nav.search.pillLabel,
  suggestions: nav.search.suggestions.map((s) => {
    let links;
    if (s.homeSection) {
      links = (homeSection(s.homeSection)?.items || []).map((i) => {
        const handle = i.link?.href?.split('/collections/')[1];
        const c = handle && collectionMap.get(handle);
        return c ? { label: colourName(c.title), href: `/collections/${handle}` } : null;
      }).filter(Boolean);
    } else {
      links = uniqueLinks(s.menu.flatMap((m) => (menuItem(m).children || []).slice(0, Math.ceil(s.limit / s.menu.length))));
    }
    return { label: s.label, links: links.slice(0, s.limit) };
  }),
};

export const homeTiles = {
  ...nav.homeTiles,
  shortcuts: nav.homeTiles.shortcuts.map(shortcut).filter(Boolean),
  tiles: nav.homeTiles.tiles.map((t) => {
    const g = primary.flatMap((p) => p.groups || []).find((x) => x.label === t.menu);
    return { ...g, imageFromProduct: t.imageFromProduct };
  }),
};
