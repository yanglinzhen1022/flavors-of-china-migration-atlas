/**
 * Crisp inline heritage SVG icons for culinary categories & UI badges.
 */
export function categoryIconSvg(category = '') {
  const s = String(category);
  if (/茶|饮|酒|奶|醋/.test(s)) {
    return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 6h8v4.5A3.5 3.5 0 0 1 7.5 14h-1A3.5 3.5 0 0 1 3 10.5V6z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 7h1.5a1.5 1.5 0 0 1 0 3H11M5.5 2.5c0 1 .8 1.4.8 2.2M8 2c0 1 .8 1.4.8 2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }
  if (/面|粉|饼|点|主食|稻|米|麦/.test(s)) {
    return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 8.5h11a5.5 5.5 0 0 1-11 0z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6.5V3M7 6.5V2.5M9.5 6.5V3M5 13.8h6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }
  if (/辣|椒|香|酱|发酵|盐|醋/.test(s)) {
    return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M10.5 3.5c2 .5 3 2.5 2 5.2-1 2.8-3.8 4.8-7.5 4.8 1.5-1.5 2.2-3.5 2.5-5.5.3-2 1.2-4.8 3-4.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 3.5c-.2-1-.8-1.6-1.8-1.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }
  if (/海|鱼|蟹|湖|水产|鲜/.test(s)) {
    return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2 8c2.2-3.2 6.2-3.5 9.2-.8L14 5.2v5.6l-2.8-2C8.2 11.5 4.2 11.2 2 8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5.2" cy="7.6" r="0.8" fill="currentColor"/></svg>`;
  }
  if (/果|蔬|菌|山珍|竹/.test(s)) {
    return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 13.5c3.5 0 5-2.6 5-5.2 0-2.8-2.2-4.5-5-4.5S3 5.5 3 8.3c0 2.6 1.5 5.2 5 5.2z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 3.8c0-1.2.8-2 2-2.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }
  return `<svg class="cat-svg" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 7h10v2.5a5 5 0 0 1-10 0V7z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 7h12M6 4.5h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
}
