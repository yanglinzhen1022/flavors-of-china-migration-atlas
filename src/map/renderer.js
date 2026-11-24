/**
 * High-craft SVG Map Renderer for Shiwei Atlas (食味中国).
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export class MapRenderer {
  constructor(svg, projector, { onCityClick, onHoverTip } = {}) {
    this.svg = svg;
    this.proj = projector;
    this.onCityClick = onCityClick || (() => {});
    this.onHoverTip = onHoverTip || (() => {});

    this.grpGraticule = svg.querySelector('#grp-graticule');
    this.grpProvinces = svg.querySelector('#grp-provinces');
    this.grpMountains = svg.querySelector('#grp-mountains');
    this.grpGhost = svg.querySelector('#grp-ghost');
    this.grpZones = svg.querySelector('#grp-zones');
    this.grpRivers = svg.querySelector('#grp-rivers');
    this.grpCorridors = svg.querySelector('#grp-corridors');
    this.grpProvNames = svg.querySelector('#grp-prov-names');
    this.grpZoneLabels = svg.querySelector('#grp-zone-labels');
    this.grpCities = svg.querySelector('#grp-cities');
    this.grpRoute = svg.querySelector('#grp-route');
    this.grpQuiz = svg.querySelector('#grp-quiz');

    this._cityNodes = [];
    this._routeStopNodes = [];
    this._zoneLabelNodes = [];
    this._mountainLabelNodes = [];
    this._provLabelNodes = [];
    this._currentZoom = 1;
    this._quizHideLabels = false;
    this._routeCityIds = new Set();
  }

  renderStaticBase(provinces, geoFeatures, citiesByProvince) {
    // 1. Graticule
    this.grpGraticule.innerHTML = '';
    for (let lng = 75; lng <= 135; lng += 10) {
      const p1 = this.proj.toScreen(lng, 18);
      const p2 = this.proj.toScreen(lng, 54);
      el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'graticule-line' }, this.grpGraticule);
    }
    for (let lat = 20; lat <= 50; lat += 10) {
      const p1 = this.proj.toScreen(72, lat);
      const p2 = this.proj.toScreen(137, lat);
      el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'graticule-line' }, this.grpGraticule);
    }

    // 2. Provinces
    this.grpProvinces.innerHTML = '';
    this.grpProvNames.innerHTML = '';
    this._provLabelNodes = [];

    for (const p of provinces) {
      let d = '';
      for (const ring of p.rings) {
        d += this.proj.ringToPath(ring) + ' ';
      }
      const pathNode = el('path', { d: d.trim(), class: 'province-poly', 'data-prov': p.short }, this.grpProvinces);
      const localCities = citiesByProvince.get(p.short) || [];
      pathNode.addEventListener('pointerenter', (e) => {
        const sub = localCities.length ? `收录风味城：${localCities.map((c) => c.name).join('、')}` : '省级行政参照';
        this.onHoverTip({ title: p.name, sub, x: e.clientX, y: e.clientY });
      });
      pathNode.addEventListener('pointermove', (e) => {
        this.onHoverTip({ moveOnly: true, x: e.clientX, y: e.clientY });
      });
      pathNode.addEventListener('pointerleave', () => this.onHoverTip(null));

      if (p.center) {
        const [cx, cy] = this.proj.toScreen(p.center[0], p.center[1]);
        const lbl = el('text', { x: cx, y: cy, class: 'prov-label' }, this.grpProvNames);
        lbl.textContent = p.short;
        this._provLabelNodes.push({ lbl, x: cx, y: cy, text: p.short });
      }
    }

    // 3. Rivers & Divides
    this.grpRivers.innerHTML = '';
    for (const r of geoFeatures.rivers) {
      const pNode = el('path', { d: this.proj.lineToPath(r.coords), class: 'river-line' }, this.grpRivers);
      pNode.addEventListener('pointerenter', (e) => this.onHoverTip({ title: r.name, sub: r.desc, x: e.clientX, y: e.clientY }));
      pNode.addEventListener('pointerleave', () => this.onHoverTip(null));
    }

    // 4. Corridors + Qinling-Huaihe Divide
    this.grpCorridors.innerHTML = '';
    for (const d of geoFeatures.divides || []) {
      const node = el('path', { d: this.proj.lineToPath(d.coords), class: 'divide-line' }, this.grpCorridors);
      node.addEventListener('pointerenter', (e) => this.onHoverTip({ title: d.name, sub: d.desc, x: e.clientX, y: e.clientY }));
      node.addEventListener('pointerleave', () => this.onHoverTip(null));
    }
    for (const c of geoFeatures.corridors || []) {
      const cls = `corridor-line corridor-${c.id}`;
      const node = el('path', { d: this.proj.lineToPath(c.coords), class: cls }, this.grpCorridors);
      node.addEventListener('pointerenter', (e) => this.onHoverTip({ title: c.name, sub: c.desc, x: e.clientX, y: e.clientY }));
      node.addEventListener('pointerleave', () => this.onHoverTip(null));
      if (c.branch) {
        const bNode = el('path', { d: this.proj.lineToPath(c.branch), class: cls }, this.grpCorridors);
        bNode.addEventListener('pointerenter', (e) => this.onHoverTip({ title: c.name, sub: c.desc, x: e.clientX, y: e.clientY }));
        bNode.addEventListener('pointerleave', () => this.onHoverTip(null));
      }
    }

    // 5. Mountain Ridges (traditional peak chevrons)
    if (this.grpMountains) {
      this.grpMountains.innerHTML = '';
      this._mountainLabelNodes = [];
      for (const m of geoFeatures.mountains || []) {
        const mGrp = el('g', { class: 'mountain-ridge-grp' }, this.grpMountains);
        const pts = m.coords.map(([lng, lat]) => this.proj.toScreen(lng, lat));
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[i + 1];
          const segLen = Math.hypot(x2 - x1, y2 - y1);
          const steps = Math.max(2, Math.floor(segLen / 16));
          for (let s = 0; s < steps; s++) {
            const t = (s + 0.5) / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            el('path', { d: `M${(px - 4).toFixed(1)},${(py + 2).toFixed(1)} L${px.toFixed(1)},${(py - 3).toFixed(1)} L${(px + 4).toFixed(1)},${(py + 2).toFixed(1)}`, class: 'mountain-chevron' }, mGrp);
          }
        }
        const mid = pts[Math.floor(pts.length / 2)];
        const text = m.name.replace('山脉', '');
        const mLbl = el('text', { x: mid[0], y: mid[1] + 10, class: 'mountain-label' }, mGrp);
        mLbl.textContent = text;
        this._mountainLabelNodes.push({ lbl: mLbl, x: mid[0], y: mid[1] + 10, text });
        mGrp.addEventListener('pointerenter', (e) => this.onHoverTip({ title: m.name, sub: m.desc, x: e.clientX, y: e.clientY }));
        mGrp.addEventListener('pointerleave', () => this.onHoverTip(null));
      }
    }
  }

  renderFlavorZones(zones, prevZones = null) {
    this.grpZones.innerHTML = '';
    this.grpZoneLabels.innerHTML = '';
    this.grpGhost.innerHTML = '';
    this._zoneLabelNodes = [];

    // Ghost diff from previous era
    if (Array.isArray(prevZones) && prevZones.length) {
      const currentIds = new Set(zones.map((z) => z.id));
      for (const pz of prevZones) {
        if (currentIds.has(pz.id)) continue;
        const d = this.proj.ringToPath(pz.polygon);
        el(
          'path',
          {
            d,
            class: 'ghost-zone-outline',
            stroke: pz.color || '#b83b2b',
          },
          this.grpGhost
        );
      }
    }

    for (const z of zones) {
      const d = this.proj.ringToPath(z.polygon);
      const poly = el(
        'path',
        {
          d,
          class: 'flavor-zone-poly',
          fill: z.color,
          'fill-opacity': z.opacity || 0.24,
          stroke: z.color,
        },
        this.grpZones
      );
      poly.addEventListener('pointerenter', (e) => {
        this.onHoverTip({ title: z.title, sub: `风味特征：${z.flavor}`, x: e.clientX, y: e.clientY });
      });
      poly.addEventListener('pointermove', (e) => {
        this.onHoverTip({ moveOnly: true, x: e.clientX, y: e.clientY });
      });
      poly.addEventListener('pointerleave', () => this.onHoverTip(null));

      const [ax, ay] = this.proj.toScreen(z.anchor[0], z.anchor[1]);
      const g = el('g', { class: 'zone-label-grp', transform: `translate(${ax.toFixed(1)}, ${ay.toFixed(1)})` }, this.grpZoneLabels);
      const titleText = z.title.replace(/（.*?）/g, '');
      const t1 = el('text', { y: -2, class: 'zone-title-txt' }, g);
      t1.textContent = titleText;
      const t2 = el('text', { y: 11, class: 'zone-sub-txt' }, g);
      t2.textContent = z.flavor;
      this._zoneLabelNodes.push({ g, ax, ay, titleText, subText: z.flavor });
    }
    this.updateScale(this._currentZoom);
    this.layoutLabels();
  }

  renderCities(cities, { activeCityId = null, flavorFilter = null, visitedIds = [], seasonalMap = null } = {}) {
    this.grpCities.innerHTML = '';
    this._cityNodes = [];
    const visitedSet = new Set(visitedIds);
    const hasSeason = Boolean(seasonalMap && seasonalMap.size > 0);
    this.svg.classList.toggle('has-season-filter', hasSeason);

    // Tier 1 major hubs stay visible at zoom=1; others fade in at higher zoom or when highlighted
    const MAJOR_HUBS = new Set([
      'beijing', 'xian', 'chengdu', 'chongqing', 'guangzhou', 'shanghai', 'hangzhou',
      'nanjing', 'wuhan', 'changsha', 'kunming', 'lasa', 'kashi', 'harbin', 'fuzhou',
      'haikou', 'lanzhou', 'taibei', 'kaifeng', 'yangzhou', 'huhehaote', 'wulumuqi',
      'yinchuan', 'shenyang', 'qingdao', 'huangshan', 'hongkong', 'xiamen',
    ]);

    for (const c of cities) {
      const [x, y] = this.proj.toScreen(c.coord[0], c.coord[1]);
      const isSelected = c.id === activeCityId;
      const isVisited = visitedSet.has(c.id);
      const seasonPick = hasSeason ? seasonalMap.get(c.id) || null : null;
      const matchesFilter = hasSeason
        ? Boolean(seasonPick)
        : !flavorFilter || this._cityMatchesFilter(c, flavorFilter);
      const isMajor = MAJOR_HUBS.has(c.id);

      const g = el(
        'g',
        {
          class: `city-marker ${isSelected ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''} ${seasonPick ? 'is-seasonal' : ''} ${matchesFilter ? 'is-matched' : 'is-dimmed'}`,
          transform: `translate(${x.toFixed(1)}, ${y.toFixed(1)})`,
          'data-city': c.id,
        },
        this.grpCities
      );

      // Hit target
      el('circle', { r: 11, class: 'city-hit' }, g);
      if (isSelected) {
        el('circle', { r: 9.5, class: 'city-pulse-ring' }, g);
      }
      if (seasonPick) {
        el('circle', { r: isSelected ? 8.2 : 6.8, stroke: seasonPick.color, class: 'city-season-ring' }, g);
      } else if (isVisited) {
        el('circle', { r: isSelected ? 7.2 : 6.0, class: 'city-visited-ring' }, g);
      }
      el('circle', { r: isSelected ? 5.2 : seasonPick ? 4.4 : isMajor ? 4.0 : 3.2, fill: seasonPick ? seasonPick.color : c.color || '#b83b2b', class: 'city-dot' }, g);

      const lbl = el('text', { x: 7, y: 3.5, class: 'city-label' }, g);
      lbl.textContent = c.name;

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCityClick(c);
      });
      g.addEventListener('pointerenter', (e) => {
        if (this._quizHideLabels) return;
        const sub = seasonPick
          ? `当季必尝：${seasonPick.item}`
          : `${c.specialties[0]?.name || ''} · ${c.dishes.slice(0, 3).join(' / ')}`;
        this.onHoverTip({
          title: `${c.name} · ${c.cuisineFamily}`,
          sub,
          x: e.clientX,
          y: e.clientY,
        });
      });
      g.addEventListener('pointerleave', () => this.onHoverTip(null));

      this._cityNodes.push({ g, lbl, c, x, y, isMajor, isSelected, matchesFilter, isSeasonal: Boolean(seasonPick) });
    }

    this.updateScale(this._currentZoom);
    this.layoutLabels();
  }

  _cityMatchesFilter(city, filter) {
    const f = filter.toLowerCase();
    if (f === 'gi') return city.specialties.some((s) => s.gi);
    if (f === '辣') return city.flavorScores['辣'] >= 4;
    if (f === '鲜') return city.flavorScores['鲜'] >= 5;
    if (f === '酸') return city.flavorScores['酸'] >= 4;
    if (f === '甜') return city.flavorScores['甜'] >= 4;
    const blob = `${city.cuisineFamily} ${city.flavorTags.join(' ')} ${city.specialties.map((s) => s.name).join(' ')}`.toLowerCase();
    return blob.includes(f);
  }

  renderRoute(route, activeStopIdx = -1, onStopClick = () => {}) {
    this.grpRoute.innerHTML = '';
    this._routeCityIds = new Set();
    this._routeStopNodes = [];
    this.svg.classList.toggle('has-active-route', Boolean(route && route.stops && route.stops.length));
    if (!route || !route.stops || route.stops.length < 2) {
      this.layoutLabels();
      return;
    }

    const stops = route.stops;
    for (const s of stops) {
      if (s.cityId) this._routeCityIds.add(s.cityId);
    }
    const pts = stops.map((s) => this.proj.toScreen(s.coord[0], s.coord[1]));

    // Draw curved quadratic arcs between consecutive stops with growth animation
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy) || 1;
      const lift = Math.min(48, dist * 0.18);
      const cx = mx - (dy / dist) * lift;
      const cy = my + (dx / dist) * lift;
      const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      const isCurrentSeg = activeStopIdx > 0 && i === activeStopIdx - 1;
      const isPassedSeg = activeStopIdx > 0 && i < activeStopIdx - 1;
      const shouldGrow = isCurrentSeg || Boolean(route.animateAll);

      // Subtle dashed base track
      el(
        'path',
        {
          d,
          class: `route-arc ${isPassedSeg ? 'is-passed-seg' : ''}`,
          stroke: route.color || '#b83b2b',
        },
        this.grpRoute
      );

      if (shouldGrow) {
        const animPath = el(
          'path',
          {
            d,
            pathLength: 100,
            class: 'route-arc is-active-seg route-arc-grow',
            stroke: route.color || '#b83b2b',
          },
          this.grpRoute
        );
        if (route.animateAll) {
          animPath.style.animationDelay = `${i * 180}ms`;
        }
        // Moving glowing bead along the active segment
        if (isCurrentSeg) {
          const bead = el('circle', { r: 4.5, fill: route.color || '#b83b2b', stroke: '#fff', 'stroke-width': 1.5, class: 'route-traveler' }, this.grpRoute);
          const motion = el('animateMotion', { dur: '0.85s', repeatCount: '1', fill: 'freeze', path: d }, bead);
          if (typeof motion.beginElement === 'function') {
            setTimeout(() => {
              try { motion.beginElement(); } catch {}
            }, 0);
          }
        }
      }
    }

    // Draw numbered stop pins
    stops.forEach((s, idx) => {
      const [x, y] = pts[idx];
      const isActive = idx === activeStopIdx;
      const g = el(
        'g',
        {
          class: `route-stop-pin ${isActive ? 'is-active' : ''}`,
          transform: `translate(${x.toFixed(1)}, ${y.toFixed(1)})`,
        },
        this.grpRoute
      );
      if (isActive) {
        el('circle', { r: 13, class: 'route-pulse', stroke: route.color || '#b83b2b' }, g);
      }
      el('circle', { r: isActive ? 8.5 : 7, fill: isActive ? route.color || '#b83b2b' : '#fbf8f1', stroke: route.color || '#b83b2b', 'stroke-width': 2 }, g);
      const num = el('text', { y: 3.2, class: `route-stop-num ${isActive ? 'is-active' : ''}` }, g);
      num.textContent = String(idx + 1);

      const yrStr = s.year !== undefined && s.year !== null ? (s.year < 0 ? `前${-s.year}` : `${s.year}`) : '';
      const labelText = yrStr ? `${s.place.split('（')[0]} (${yrStr})` : s.place.split('（')[0];
      const lbl = el('text', { x: 11, y: 3.5, class: 'route-stop-label' }, g);
      lbl.textContent = labelText;
      this._routeStopNodes.push({ lbl, x, y, text: labelText, isActive });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        onStopClick(idx);
      });
    });

    this.updateScale(this._currentZoom);
    this.layoutLabels();
  }

  renderQuizOverlay({ guessCoord = null, targetCoord = null, targetName = '' } = {}) {
    this.grpQuiz.innerHTML = '';
    if (targetCoord) {
      const [tx, ty] = this.proj.toScreen(targetCoord[0], targetCoord[1]);
      // Concentric score rings (approx visual)
      for (const r of [18, 42, 72]) {
        el('circle', { cx: tx, cy: ty, r, class: 'quiz-ring' }, this.grpQuiz);
      }
      if (guessCoord) {
        const [gx, gy] = this.proj.toScreen(guessCoord[0], guessCoord[1]);
        el('line', { x1: gx, y1: gy, x2: tx, y2: ty, class: 'quiz-connect-line' }, this.grpQuiz);
      }
      const tg = el('g', { transform: `translate(${tx.toFixed(1)}, ${ty.toFixed(1)})` }, this.grpQuiz);
      el('circle', { r: 6.5, fill: '#2d6e60', stroke: '#fff', 'stroke-width': 2 }, tg);
      const tLbl = el('text', { x: 9, y: 4, class: 'quiz-target-lbl' }, tg);
      tLbl.textContent = targetName;
    }
    if (guessCoord) {
      const [gx, gy] = this.proj.toScreen(guessCoord[0], guessCoord[1]);
      const gg = el('g', { transform: `translate(${gx.toFixed(1)}, ${gy.toFixed(1)})` }, this.grpQuiz);
      el('circle', { r: 6.5, fill: '#b83b2b', stroke: '#fff', 'stroke-width': 2 }, gg);
      el('circle', { r: 11, fill: 'none', stroke: '#b83b2b', 'stroke-width': 1.5, 'stroke-dasharray': '2,2' }, gg);
    }
  }

  setQuizMode(enabled) {
    this._quizHideLabels = enabled;
    this.svg.classList.toggle('is-quiz-mode', enabled);
    this.layoutLabels();
  }

  setLayerVisibility(layers) {
    this.grpZones.classList.toggle('is-hidden', !layers.zones);
    this.grpZoneLabels.classList.toggle('is-hidden', !layers.zones);
    this.grpGhost.classList.toggle('is-hidden', !layers.ghost);
    this.grpCorridors.classList.toggle('is-hidden', !layers.corridors);
    this.grpProvinces.classList.toggle('is-hidden', !layers.provinces);
    this.grpProvNames.classList.toggle('is-hidden', !layers.provNames);
    this.grpRivers.classList.toggle('is-hidden', !layers.rivers);
    if (this.grpMountains) this.grpMountains.classList.toggle('is-hidden', !layers.mountains);
  }

  updateScale(zoom) {
    this._currentZoom = zoom;
    const inv = 1 / Math.pow(zoom, 0.72);
    this.svg.style.setProperty('--inv-scale', inv.toFixed(4));
  }

  _measureTextWidth(text, fontSize) {
    let w = 0;
    for (const ch of String(text || '')) {
      w += ch.charCodeAt(0) > 255 ? fontSize * 1.02 : fontSize * 0.58;
    }
    return w;
  }

  _boxesOverlap(a, b) {
    return !(a[2] <= b[0] || a[0] >= b[2] || a[3] <= b[1] || a[1] >= b[3]);
  }

  _placePointLabel(lbl, x, y, text, fontSize, dotRadius, placedBoxes, inv, forceShow = false) {
    const w = this._measureTextWidth(text, fontSize) + 4 * inv;
    const h = fontSize * 1.18;
    const gap = dotRadius + 3 * inv;

    // 8 candidate anchor offsets around point (x, y)
    const candidates = [
      { dx: gap, dy: 3.5 * inv, anchor: 'start', bx: [x + gap - 2 * inv, y - h * 0.65, x + gap + w, y + h * 0.45] },
      { dx: -gap, dy: 3.5 * inv, anchor: 'end', bx: [x - gap - w, y - h * 0.65, x - gap + 2 * inv, y + h * 0.45] },
      { dx: 0, dy: -(gap + 2 * inv), anchor: 'middle', bx: [x - w / 2, y - gap - h - 2 * inv, x + w / 2, y - gap] },
      { dx: 0, dy: gap + h * 0.85, anchor: 'middle', bx: [x - w / 2, y + gap, x + w / 2, y + gap + h + 1 * inv] },
      { dx: gap * 0.8, dy: -(gap * 0.75), anchor: 'start', bx: [x + gap * 0.7, y - gap * 0.75 - h, x + gap * 0.7 + w, y - gap * 0.6] },
      { dx: gap * 0.8, dy: gap * 0.85 + h * 0.6, anchor: 'start', bx: [x + gap * 0.7, y + gap * 0.5, x + gap * 0.7 + w, y + gap * 0.5 + h] },
      { dx: -gap * 0.8, dy: -(gap * 0.75), anchor: 'end', bx: [x - gap * 0.7 - w, y - gap * 0.75 - h, x - gap * 0.7, y - gap * 0.6] },
      { dx: -gap * 0.8, dy: gap * 0.85 + h * 0.6, anchor: 'end', bx: [x - gap * 0.7 - w, y + gap * 0.5, x - gap * 0.7, y + gap * 0.5 + h] },
    ];

    for (const c of candidates) {
      if (!placedBoxes.some((b) => this._boxesOverlap(c.bx, b))) {
        lbl.setAttribute('x', c.dx.toFixed(1));
        lbl.setAttribute('y', c.dy.toFixed(1));
        lbl.setAttribute('text-anchor', c.anchor);
        lbl.classList.remove('is-hidden');
        placedBoxes.push(c.bx);
        return true;
      }
    }

    if (forceShow) {
      const c = candidates[0];
      lbl.setAttribute('x', c.dx.toFixed(1));
      lbl.setAttribute('y', c.dy.toFixed(1));
      lbl.setAttribute('text-anchor', c.anchor);
      lbl.classList.remove('is-hidden');
      placedBoxes.push(c.bx);
      return true;
    }
    lbl.classList.add('is-hidden');
    return false;
  }

  layoutLabels() {
    if (this._quizHideLabels) return;
    const zoom = this._currentZoom;
    const inv = 1 / Math.pow(zoom, 0.72);
    const placedBoxes = [];

    // Reserve small bounding boxes for all visible pin/city dots first so labels never cover dots
    for (const rNode of this._routeStopNodes) {
      const r = (rNode.isActive ? 9 : 7.5) * inv;
      placedBoxes.push([rNode.x - r, rNode.y - r, rNode.x + r, rNode.y + r]);
    }
    for (const item of this._cityNodes) {
      if (!item.matchesFilter || this._routeCityIds.has(item.c.id)) continue;
      const r = (item.isSelected ? 6 : 4.2) * inv;
      placedBoxes.push([item.x - r, item.y - r, item.x + r, item.y + r]);
    }

    // Priority 1: Active Route Stop labels (active stop first)
    const orderedStops = [...this._routeStopNodes].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
    for (const st of orderedStops) {
      this._placePointLabel(st.lbl, st.x, st.y, st.text, 10 * inv, 8.5 * inv, placedBoxes, inv, st.isActive);
    }

    // Priority 2: City labels (multi-anchor placement prevents coastal/delta clusters from overlapping)
    const hasFilter = this.svg.classList.contains('has-flavor-filter') || this.svg.classList.contains('has-season-filter');
    const orderedCities = [...this._cityNodes].sort((a, b) => {
      const pa = (a.isSelected ? 10 : 0) + (a.isSeasonal ? 6 : 0) + (a.isMajor ? 4 : 0) + (a.matchesFilter ? 2 : 0);
      const pb = (b.isSelected ? 10 : 0) + (b.isSeasonal ? 6 : 0) + (b.isMajor ? 4 : 0) + (b.matchesFilter ? 2 : 0);
      return pb - pa;
    });

    for (const item of orderedCities) {
      if (this._routeCityIds.has(item.c.id) || !item.matchesFilter) {
        item.lbl.classList.add('is-hidden');
        continue;
      }
      if (!item.isSelected && !item.isMajor && zoom < 1.45 && !hasFilter) {
        item.lbl.classList.add('is-hidden');
        continue;
      }
      this._placePointLabel(
        item.lbl,
        item.x,
        item.y,
        item.c.name,
        10.5 * inv,
        (item.isSelected ? 6.5 : 4.5) * inv,
        placedBoxes,
        inv,
        item.isSelected
      );
    }

    // Priority 3: Flavor Zone labels (nudge cleanly around cities & routes; hide if crowded)
    const hasRoute = this.svg.classList.contains('has-active-route');
    for (const zn of this._zoneLabelNodes) {
      if (hasRoute) {
        // Keep the route map crisp and readable without regional title clashes
        zn.g.classList.add('is-hidden');
        continue;
      }
      const w = Math.max(
        this._measureTextWidth(zn.titleText, 10.5 * inv),
        this._measureTextWidth(zn.subText, 8.5 * inv)
      ) + 8 * inv;
      const h = 24 * inv;
      const nudges = [
        [0, 0], [0, -24 * inv], [0, 24 * inv],
        [-28 * inv, 0], [28 * inv, 0],
        [0, -42 * inv], [0, 42 * inv],
        [-36 * inv, -24 * inv], [36 * inv, 24 * inv],
      ];
      let placed = false;
      for (const [dx, dy] of nudges) {
        const cx = zn.ax + dx;
        const cy = zn.ay + dy;
        const bx = [cx - w / 2, cy - 11 * inv, cx + w / 2, cy + h - 9 * inv];
        if (!placedBoxes.some((b) => this._boxesOverlap(bx, b))) {
          zn.g.setAttribute('transform', `translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`);
          zn.g.classList.remove('is-hidden');
          placedBoxes.push(bx);
          placed = true;
          break;
        }
      }
      if (!placed) zn.g.classList.add('is-hidden');
    }

    // Priority 4: Mountain ridge & Province labels (only show when space is clear)
    for (const mt of this._mountainLabelNodes) {
      const w = this._measureTextWidth(mt.text, 8.5 * inv) + 4 * inv;
      const h = 10 * inv;
      const bx = [mt.x - w / 2, mt.y - h * 0.8, mt.x + w / 2, mt.y + h * 0.2];
      if (!placedBoxes.some((b) => this._boxesOverlap(bx, b))) {
        mt.lbl.classList.remove('is-hidden');
        placedBoxes.push(bx);
      } else {
        mt.lbl.classList.add('is-hidden');
      }
    }

    for (const pv of this._provLabelNodes) {
      const w = this._measureTextWidth(pv.text, 9.5 * inv) + 4 * inv;
      const h = 11 * inv;
      const bx = [pv.x - w / 2, pv.y - h * 0.8, pv.x + w / 2, pv.y + h * 0.2];
      if (!placedBoxes.some((b) => this._boxesOverlap(bx, b))) {
        pv.lbl.classList.remove('is-hidden');
        placedBoxes.push(bx);
      } else {
        pv.lbl.classList.add('is-hidden');
      }
    }
  }
}
