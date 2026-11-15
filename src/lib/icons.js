// Inline SVG icons from the live theme (src/data/icons.json), as HTML strings (build + browser).
import icons from '../data/icons.json';

export const iconSvg = (name, extra = '') => (icons[name] || '').replace('<svg', `<svg class="${[extra, 'icon', `icon-${name}`].filter(Boolean).join(' ')}"`);
export const facetIcons = { caret: iconSvg('caret'), arrow: iconSvg('arrow'), close: iconSvg('close'), filter: iconSvg('filter') };
