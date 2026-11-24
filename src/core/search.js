/**
 * Unified Search Engine across Cities, Specialties, Dishes, Routes & Milestones.
 */
export function buildSearchIndex({ cities, routes, erasData }) {
  const items = [];

  for (const c of cities) {
    const specNames = c.specialties.map((s) => s.name).join(' ');
    const dishNames = c.dishes.join(' ');
    const tagStr = c.flavorTags.join(' ');
    const timelineStr = c.timeline.map((t) => `${t.title} ${t.detail}`).join(' ');
    items.push({
      kind: 'city',
      id: c.id,
      title: c.name,
      sub: `${c.province} · ${c.cuisineFamily} · ${c.dishes.slice(0, 2).join(' / ')}`,
      badge: '风味名城',
      searchBlob: `${c.name} ${c.ancientName || ''} ${c.pinyin} ${c.province} ${c.region} ${c.cuisineFamily} ${tagStr} ${specNames} ${dishNames} ${timelineStr}`.toLowerCase(),
      ref: c,
    });
  }

  for (const r of routes) {
    const stopsBlob = r.stops.map((s) => `${s.place} ${s.title}`).join(' ');
    items.push({
      kind: 'route',
      id: r.id,
      title: r.title,
      sub: `${r.category} · ${r.span} · ${r.stops.length} 站`,
      badge: '迁徙路线',
      searchBlob: `${r.title} ${r.subtitle} ${r.category} ${r.summary} ${stopsBlob}`.toLowerCase(),
      ref: r,
    });
  }

  for (const m of erasData.milestones) {
    const yr = m.year < 0 ? `前${-m.year}年` : `${m.year}年`;
    items.push({
      kind: 'milestone',
      id: `${m.year}_${m.city || ''}`,
      title: `${yr} · ${m.title}`,
      sub: '饮食历史节点',
      badge: '史事',
      searchBlob: `${yr} ${m.title}`.toLowerCase(),
      ref: m,
    });
  }

  return items;
}

export function searchAtlas(index, rawQuery, limit = 14) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];

  for (const item of index) {
    if (!tokens.every((t) => item.searchBlob.includes(t))) continue;
    let score = 0;
    const titleLower = item.title.toLowerCase();
    if (titleLower === q) score += 100;
    else if (titleLower.startsWith(q)) score += 60;
    else if (titleLower.includes(q)) score += 35;

    if (item.kind === 'city') {
      const c = item.ref;
      if (c.pinyin.toLowerCase().split(' ').includes(q)) score += 80;
      if (c.dishes.some((d) => d.toLowerCase().includes(q))) score += 40;
      if (c.specialties.some((s) => s.name.toLowerCase().includes(q))) score += 45;
    } else if (item.kind === 'route') {
      score += 20;
    }

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
