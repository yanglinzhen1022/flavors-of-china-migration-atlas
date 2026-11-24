import { MercatorProjector } from './core/projection.js';
import { buildSearchIndex, searchAtlas } from './core/search.js';
import { parseUrlState, syncUrlState } from './core/url_state.js';
import { CameraController } from './map/camera.js';
import { MapRenderer } from './map/renderer.js';
import { CityCard } from './ui/city_card.js';
import { RoutePanel } from './ui/route_panel.js';
import { SeasonPanel } from './ui/season_panel.js';
import { TripPlanner } from './ui/trip_planner.js';
import { FlavorQuiz } from './ui/quiz.js';
import { PassportPanel } from './ui/passport.js';
import { TimelineController } from './ui/timeline.js';
import { registerAtlasApi } from './api/atlas_api.js';

const VISITED_STORAGE_KEY = 'shiwei_visited_cities_v1';

class ShiweiAtlasApp {
  constructor() {
    this.cities = [];
    this.routes = [];
    this.seasons = [];
    this.erasData = null;
    this.provinces = [];
    this.geoFeatures = null;
    this.searchIndex = [];

    this.activeEraId = null;
    this.prevZones = null;
    this.activeCityId = null;
    this.compareCityId = null;
    this.activeRoute = null;
    this.activeRouteStop = -1;
    this.activeSeasonId = null;
    this.activeTripIds = null;
    this.flavorFilter = null;
    this.embed = false;
    this.visitedIds = this._loadVisited();

    this.layers = {
      zones: true,
      ghost: true,
      corridors: true,
      provinces: true,
      provNames: false,
      rivers: true,
      mountains: true,
    };
  }

  _loadVisited() {
    try {
      const raw = localStorage.getItem(VISITED_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _saveVisited() {
    try {
      localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(this.visitedIds));
    } catch {
      // ignore storage errors
    }
    this._updatePassportBadge();
  }

  _updatePassportBadge() {
    const el = document.getElementById('lbl-passport-count');
    if (el) el.textContent = `${this.visitedIds.length}/${this.cities.length}`;
  }

  async init() {
    const [citiesBundle, routes, seasons, erasData, provinces, geoFeatures] = await Promise.all([
      fetch('./data/cities_bundle.json').then((r) => r.json()),
      fetch('./data/routes.json').then((r) => r.json()),
      fetch('./data/seasons.json').then((r) => r.json()),
      fetch('./data/eras.json').then((r) => r.json()),
      fetch('./data/geo/china_provinces.json').then((r) => r.json()),
      fetch('./data/geo/geo_features.json').then((r) => r.json()),
    ]);

    this.cities = citiesBundle.cities;
    this.cityMap = new Map(this.cities.map((c) => [c.id, c]));
    this.routes = routes;
    this.seasons = seasons;
    this.erasData = erasData;
    this.provinces = provinces;
    this.geoFeatures = geoFeatures;
    this.searchIndex = buildSearchIndex({ cities: this.cities, routes: this.routes, erasData: this.erasData });

    const citiesByProv = new Map();
    for (const c of this.cities) {
      if (!citiesByProv.has(c.province)) citiesByProv.set(c.province, []);
      citiesByProv.get(c.province).push(c);
    }

    const svg = document.getElementById('atlas-svg');
    this.projector = new MercatorProjector(1000, 720);
    this.renderer = new MapRenderer(svg, this.projector, {
      onCityClick: (city) => this.selectCity(city),
      onHoverTip: (tip) => this._updateHoverTip(tip),
    });

    this.camera = new CameraController(svg, {
      width: 1000,
      height: 720,
      onUpdate: (cam) => {
        this.renderer.updateScale(cam.zoom);
        this._updateScaleBar(cam.zoom);
      },
      onSettle: () => {
        this.renderer.layoutLabels();
      },
    });

    this.renderer.renderStaticBase(this.provinces, this.geoFeatures, citiesByProv);
    this.renderer.setLayerVisibility(this.layers);

    this.cityCard = new CityCard(document.getElementById('city-card'), {
      onClose: () => {
        this.activeCityId = null;
        this.compareCityId = null;
        this._redrawCities();
        this._syncUrl();
      },
      onJumpYear: (yr) => {
        this.timeline.setYear(yr);
      },
      onToggleVisit: (cid) => {
        if (this.visitedIds.includes(cid)) {
          this.visitedIds = this.visitedIds.filter((id) => id !== cid);
        } else {
          this.visitedIds = [...this.visitedIds, cid];
        }
        this._saveVisited();
        this._redrawCities();
        const cur = this.findCity(this.activeCityId);
        if (cur) this._openCityCard(cur);
      },
      onCompare: (cmpId) => {
        this.compareCityId = cmpId || null;
        const cur = this.findCity(this.activeCityId);
        if (cur) this._openCityCard(cur);
        this._syncUrl();
      },
    });

    this.passport = new PassportPanel(document.getElementById('passport-modal'), {
      onSelectCity: (cid) => {
        const c = this.findCity(cid);
        if (c) this.selectCity(c);
      },
      onClearAll: () => {
        this.visitedIds = [];
        this._saveVisited();
        this._redrawCities();
      },
    });

    this.routePanel = new RoutePanel(document.getElementById('route-card'), this.projector, {
      onSelectStop: (idx) => this.selectRouteStop(idx),
      onClose: () => {
        this.activeRoute = null;
        this.activeRouteStop = -1;
        this.renderer.renderRoute(null);
        this._syncUrl();
      },
    });

    this.seasonPanel = new SeasonPanel(document.getElementById('season-card'), {
      onSelectCity: (cid) => {
        const c = this.findCity(cid);
        if (c) this.selectCity(c);
      },
      onSwitchSeason: (sid) => this.openSeason(sid),
      onClose: () => {
        this.activeSeasonId = null;
        document.getElementById('act-open-season')?.classList.remove('is-active-tool');
        this._redrawCities();
        this._syncUrl();
      },
    });

    this.tripPlanner = new TripPlanner(document.getElementById('trip-card'), this.projector, {
      onChange: (tripCities) => {
        this.activeTripIds = tripCities.map((c) => c.id);
        if (tripCities.length >= 2) {
          const fakeRoute = {
            id: '__trip__',
            color: '#b83b2b',
            animateAll: true,
            stops: tripCities.map((c) => ({
              place: c.name,
              cityId: c.id,
              coord: c.coord,
            })),
          };
          this.renderer.renderRoute(fakeRoute, -1, (idx) => {
            const c = tripCities[idx];
            if (c) this.selectCity(c);
          });
          const pts = tripCities.map((c) => this.projector.toScreen(c.coord[0], c.coord[1]));
          this.camera.focusBounds(pts, 110, 0.65, 0.5);
        } else {
          this.renderer.renderRoute(null);
        }
        this._syncUrl();
      },
      onSelectCity: (cid) => {
        const c = this.findCity(cid);
        if (c) this.selectCity(c);
      },
      onClose: () => {
        this.activeTripIds = null;
        document.getElementById('act-open-trip')?.classList.remove('is-active-tool');
        this.renderer.renderRoute(null);
        this._syncUrl();
      },
    });

    this.quiz = new FlavorQuiz(document.getElementById('quiz-card'), this.projector, this.renderer, {
      onFinish: (action) => {
        if (action === 'replay') this.startQuiz();
      },
      onClose: () => {
        this._redrawCities();
        this._syncUrl();
      },
    });

    this.timeline = new TimelineController(this.erasData, {
      onYearChange: (year, era) => this._handleYearChange(year, era),
    });

    // Map click for quiz mode
    svg.addEventListener('click', (e) => {
      if (this.camera.wasDragged()) return;
      if (this.quiz.active) {
        const [sx, sy] = this.camera.clientToSvg(e.clientX, e.clientY);
        const geo = this.projector.toGeo(sx, sy);
        this.quiz.handleMapClick(geo);
      }
    });

    this._bindChromeUi();
    this._restoreFromUrl();
    registerAtlasApi(this);
  }

  _handleYearChange(year, era) {
    if (era.id !== this.activeEraId) {
      if (this.activeEraId && this.erasData.zones[this.activeEraId]) {
        this.prevZones = this.erasData.zones[this.activeEraId];
      }
      this.activeEraId = era.id;
      const zones = this.erasData.zones[era.id] || [];
      this.renderer.renderFlavorZones(zones, this.prevZones);
      this._renderChroniclePane(era);
    } else {
      this._highlightActiveMilestone(year);
    }
    this._syncUrl();
  }

  _renderChroniclePane(era) {
    document.getElementById('era-title').textContent = era.name;
    document.getElementById('era-span').textContent = era.span;
    document.getElementById('era-summary').textContent = era.summary;

    const eraQuickEl = document.getElementById('era-quick-tabs');
    if (eraQuickEl) {
      eraQuickEl.innerHTML = this.erasData.eras
        .map(
          (e) => `<button type="button" class="era-tab-pill ${e.id === era.id ? 'is-active' : ''}" data-era-id="${e.id}">${e.name}</button>`
        )
        .join('');
      eraQuickEl.querySelectorAll('[data-era-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetEra = this.erasData.eras.find((x) => x.id === btn.getAttribute('data-era-id'));
          if (targetEra) {
            const mid = Math.round((targetEra.fromYear + Math.min(targetEra.toYear, 2026)) / 2);
            this.timeline.setYear(mid);
          }
        });
      });
    }

    const tagsEl = document.getElementById('era-changes');
    tagsEl.innerHTML = era.keyChanges.map((k) => `<span class="era-key-chip">${k}</span>`).join('');

    // Render migration routes quick-launch list
    document.getElementById('lbl-routes-heading').textContent = `${this.routes.length}大风物迁徙路线`;
    const routesList = document.getElementById('quick-routes-list');
    routesList.innerHTML = '';
    for (const r of this.routes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quick-route-btn ${this.activeRoute?.id === r.id ? 'is-active' : ''}`;
      btn.innerHTML = `<span class="qr-dot" style="background:${r.color}"></span>
        <span class="qr-text"><strong>${r.title.split('：')[0]}</strong><small>${r.span} · ${r.stops.length}站</small></span>`;
      btn.addEventListener('click', () => this.openRoute(r.id, 0));
      routesList.appendChild(btn);
    }

    // Render milestones for current era (or all with current era highlighted)
    const listEl = document.getElementById('milestone-list');
    listEl.innerHTML = '';
    for (const m of this.erasData.milestones) {
      const li = document.createElement('li');
      const inEra = m.eraId === era.id;
      li.className = `ms-item ${inEra ? 'is-in-era' : 'is-other-era'}`;
      const yrStr = m.year < 0 ? `前${-m.year}` : `${m.year}`;
      li.innerHTML = `<span class="ev-yr">${yrStr} 年</span><span class="ev-txt">${m.title}</span>`;
      li.addEventListener('click', () => {
        this.timeline.setYear(m.year);
        if (m.route) this.openRoute(m.route, 0);
        else if (m.city) {
          const c = this.findCity(m.city);
          if (c) this.selectCity(c);
        }
      });
      listEl.appendChild(li);
    }
    this._highlightActiveMilestone(this.timeline.year);
  }

  _highlightActiveMilestone(year) {
    const items = document.querySelectorAll('#milestone-list .ms-item');
    this.erasData.milestones.forEach((m, idx) => {
      if (!items[idx]) return;
      items[idx].classList.toggle('is-current', Math.abs(m.year - year) <= 2);
    });
  }

  _openCityCard(city) {
    const compareCity = this.compareCityId ? this.findCity(this.compareCityId) : null;
    this.cityCard.open(city, {
      allCities: this.cities,
      visited: this.visitedIds.includes(city.id),
      compareCity,
    });
  }

  selectCity(city) {
    if (!city || this.quiz.active) return;
    if (this.activeCityId !== city.id) {
      this.compareCityId = null;
    }
    this.activeCityId = city.id;
    this._redrawCities();
    const [sx, sy] = this.projector.toScreen(city.coord[0], city.coord[1]);
    this.camera.focusPoint(sx, sy, 2.35, 0.36, 0.48);
    this._openCityCard(city);
    this._syncUrl();
  }

  openRoute(routeId, stopIdx = 0) {
    document.getElementById('workspace-body')?.classList.remove('mobile-drawer-open');
    if (this.quiz.active) this.quiz.close();
    if (this.tripPlanner.active) {
      this.tripPlanner.close();
      this.activeTripIds = null;
      document.getElementById('act-open-trip')?.classList.remove('is-active-tool');
    }
    if (this.activeSeasonId) {
      this.seasonPanel.close();
      this.activeSeasonId = null;
      document.getElementById('act-open-season')?.classList.remove('is-active-tool');
    }
    const r = this.findRoute(routeId);
    if (!r) return;
    this.activeRoute = r;
    this.cityCard.close();
    this.activeCityId = null;
    this._redrawCities();

    const pts = r.stops.map((s) => this.projector.toScreen(s.coord[0], s.coord[1]));
    this.camera.focusBounds(pts, 110, 0.65, 0.50);
    this.routePanel.open(r, stopIdx);
    this.selectRouteStop(stopIdx, false);
    this._renderChroniclePane(this.timeline.getEraForYear(this.timeline.year));
  }

  openSeason(seasonId = null) {
    if (this.quiz.active) this.quiz.close();
    if (this.activeRoute) {
      this.routePanel.close();
      this.activeRoute = null;
      this.renderer.renderRoute(null);
    }
    if (this.tripPlanner.active) {
      this.tripPlanner.close();
      this.activeTripIds = null;
      this.renderer.renderRoute(null);
      document.getElementById('act-open-trip')?.classList.remove('is-active-tool');
    }

    // Default to current calendar season if none provided
    let targetId = seasonId;
    if (!targetId) {
      const m = new Date().getMonth() + 1;
      targetId = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
    }
    const season = this.seasons.find((s) => s.id === targetId) || this.seasons[0];
    this.activeSeasonId = season.id;
    document.getElementById('act-open-season')?.classList.add('is-active-tool');
    this.seasonPanel.open(season, this.seasons, this.cityMap);
    this._redrawCities();
    this.camera.reset(true);
    this._syncUrl();
  }

  openTripPlanner(initialIds = null) {
    if (this.quiz.active) this.quiz.close();
    if (this.activeRoute) {
      this.routePanel.close();
      this.activeRoute = null;
    }
    if (this.activeSeasonId) {
      this.seasonPanel.close();
      this.activeSeasonId = null;
      document.getElementById('act-open-season')?.classList.remove('is-active-tool');
    }
    this.cityCard.close();
    this.activeCityId = null;
    document.getElementById('act-open-trip')?.classList.add('is-active-tool');
    this.tripPlanner.open(this.cities, initialIds);
    this._redrawCities();
  }

  openRandomCity() {
    if (!this.cities.length) return;
    if (this.quiz.active) this.quiz.close();
    const unvisited = this.cities.filter((c) => c.id !== this.activeCityId && !this.visitedIds.includes(c.id));
    const pool = unvisited.length ? unvisited : this.cities.filter((c) => c.id !== this.activeCityId);
    const pick = pool[Math.floor(Math.random() * pool.length)] || this.cities[0];
    this.selectCity(pick);
  }

  selectRouteStop(idx, pan = true) {
    if (!this.activeRoute) return;
    const clamped = Math.max(0, Math.min(this.activeRoute.stops.length - 1, idx));
    this.activeRouteStop = clamped;
    const stop = this.activeRoute.stops[clamped];

    this.timeline.setYear(stop.year);
    this.routePanel.setStop(clamped);
    this.renderer.renderRoute(this.activeRoute, clamped, (i) => this.selectRouteStop(i));

    if (pan) {
      const [sx, sy] = this.projector.toScreen(stop.coord[0], stop.coord[1]);
      this.camera.focusPoint(sx, sy, 2.35, 0.64, 0.48);
    }
    this._syncUrl();
  }

  setFlavorFilter(flavor) {
    this.flavorFilter = this.flavorFilter === flavor ? null : flavor;
    const svg = document.getElementById('atlas-svg');
    svg.classList.toggle('has-flavor-filter', Boolean(this.flavorFilter));
    document.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-flavor') === this.flavorFilter);
    });
    this._redrawCities();
    this._syncUrl();
  }

  startQuiz() {
    this.cityCard.close();
    this.routePanel.close();
    this.activeRoute = null;
    this.activeCityId = null;
    this.renderer.renderRoute(null);
    this.camera.reset(true);
    this.quiz.start(this.cities);
    this._syncUrl();
  }

  _redrawCities() {
    let seasonalMap = null;
    if (this.activeSeasonId) {
      const season = this.seasons.find((s) => s.id === this.activeSeasonId);
      if (season) {
        seasonalMap = new Map(season.picks.map((p) => [p.cityId, { item: p.item, color: season.color }]));
      }
    }
    this.renderer.renderCities(this.cities, {
      activeCityId: this.activeCityId,
      flavorFilter: this.flavorFilter,
      visitedIds: this.visitedIds,
      seasonalMap,
    });
  }

  findCity(q) {
    const raw = String(q || '').trim();
    const s = raw.toLowerCase();
    return this.cities.find(
      (c) =>
        c.id.toLowerCase() === s ||
        c.name === raw ||
        c.name.split('·').some((part) => part.trim() === raw) ||
        (c.ancientName && c.ancientName.includes(raw)) ||
        c.pinyin.toLowerCase().split(' ').includes(s)
    );
  }

  findRoute(q) {
    const s = String(q || '').trim().toLowerCase();
    return this.routes.find((r) => r.id.toLowerCase() === s || r.title.includes(q));
  }

  search(query, limit = 12) {
    return searchAtlas(this.searchIndex, query, limit);
  }

  _updateHoverTip(tip) {
    const el = document.getElementById('hover-tip');
    if (!tip) {
      el.classList.add('is-hidden');
      return;
    }
    if (!tip.moveOnly) {
      el.innerHTML = `<strong>${tip.title}</strong>${tip.sub ? `<div>${tip.sub}</div>` : ''}`;
      el.classList.remove('is-hidden');
    }
    el.style.left = `${Math.min(window.innerWidth - 260, tip.x + 14)}px`;
    el.style.top = `${Math.min(window.innerHeight - 80, tip.y + 14)}px`;
  }

  _updateScaleBar(zoom) {
    const baseKm = Math.round(500 / zoom);
    const nice = baseKm >= 400 ? 500 : baseKm >= 200 ? 250 : baseKm >= 100 ? 100 : 50;
    document.getElementById('scale-label-text').textContent = `${nice} km`;
  }

  _bindChromeUi() {
    // Search box
    const inp = document.getElementById('inp-map-search');
    const resList = document.getElementById('map-search-results');

    const renderResults = (items) => {
      if (!items.length) {
        resList.classList.add('is-hidden');
        resList.innerHTML = '';
        return;
      }
      resList.innerHTML = items
        .map(
          (it, i) => `<li role="option" data-sidx="${i}">
            <span class="sr-badge">${it.badge}</span>
            <span class="sr-main"><strong>${it.title}</strong><small>${it.sub}</small></span>
          </li>`
        )
        .join('');
      resList.classList.remove('is-hidden');

      resList.querySelectorAll('li').forEach((li) => {
        li.addEventListener('click', () => {
          const item = items[Number(li.getAttribute('data-sidx'))];
          resList.classList.add('is-hidden');
          inp.value = '';
          if (item.kind === 'city') this.selectCity(item.ref);
          else if (item.kind === 'route') this.openRoute(item.ref.id, 0);
          else if (item.kind === 'milestone') {
            this.timeline.setYear(item.ref.year);
            if (item.ref.city) this.selectCity(this.findCity(item.ref.city));
          }
        });
      });
    };

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      if (!q) return renderResults([]);
      renderResults(this.search(q, 12));
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#map-search-box')) resList.classList.add('is-hidden');
      if (!e.target.closest('#layers-popover') && !e.target.closest('#act-layers-menu')) {
        document.getElementById('layers-popover').classList.add('is-hidden');
      }
    });

    // Layers menu
    const layersBtn = document.getElementById('act-layers-menu');
    const layersPop = document.getElementById('layers-popover');
    layersBtn.addEventListener('click', () => {
      layersPop.classList.toggle('is-hidden');
    });

    const layerMap = {
      'chk-zones': 'zones',
      'chk-ghost': 'ghost',
      'chk-corridors': 'corridors',
      'chk-rivers': 'rivers',
      'chk-mountains': 'mountains',
      'chk-provinces': 'provinces',
      'chk-prov-names': 'provNames',
    };
    for (const [id, key] of Object.entries(layerMap)) {
      const chk = document.getElementById(id);
      chk.checked = this.layers[key];
      chk.addEventListener('change', () => {
        this.layers[key] = chk.checked;
        this.renderer.setLayerVisibility(this.layers);
      });
    }

    // Flavor filter chips
    document.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setFlavorFilter(btn.getAttribute('data-flavor'));
      });
    });

    // Quiz button
    document.getElementById('act-start-quiz').addEventListener('click', () => this.startQuiz());

    // Season button
    document.getElementById('act-open-season')?.addEventListener('click', () => {
      if (this.activeSeasonId) {
        this.seasonPanel.close();
        this.activeSeasonId = null;
        document.getElementById('act-open-season')?.classList.remove('is-active-tool');
        this._redrawCities();
        this._syncUrl();
      } else {
        this.openSeason();
      }
    });

    // Trip planner button
    document.getElementById('act-open-trip')?.addEventListener('click', () => {
      if (this.tripPlanner.active) {
        this.tripPlanner.close();
        this.activeTripIds = null;
        document.getElementById('act-open-trip')?.classList.remove('is-active-tool');
        this.renderer.renderRoute(null);
        this._syncUrl();
      } else {
        this.openTripPlanner();
      }
    });

    // Random city button
    document.getElementById('act-random-city')?.addEventListener('click', () => this.openRandomCity());

    // Passport button
    document.getElementById('act-open-passport').addEventListener('click', () => {
      this.passport.open(this.cities, this.visitedIds);
    });

    // Reset camera
    document.getElementById('act-reset-camera').addEventListener('click', () => this.camera.reset(true));

    // Toggle chronicle pane (desktop collapse / mobile drawer)
    const toggleBtn = document.getElementById('act-toggle-pane');
    toggleBtn.addEventListener('click', () => {
      document.getElementById('workspace-body').classList.toggle('pane-collapsed');
      setTimeout(() => this.camera.invalidateRect(), 260);
    });

    const mobileDrawerBtn = document.getElementById('act-mobile-drawer');
    const closeMobileDrawerBtn = document.getElementById('act-close-mobile-drawer');
    const wsBody = document.getElementById('workspace-body');
    mobileDrawerBtn?.addEventListener('click', () => {
      wsBody.classList.toggle('mobile-drawer-open');
    });
    closeMobileDrawerBtn?.addEventListener('click', () => {
      wsBody.classList.remove('mobile-drawer-open');
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          e.target.blur();
          resList.classList.add('is-hidden');
        }
        return;
      }
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        inp.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.activeRoute) this.selectRouteStop(this.activeRouteStop - 1);
        else this.timeline.stepMilestone(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.activeRoute) this.selectRouteStop(this.activeRouteStop + 1);
        else this.timeline.stepMilestone(1);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (this.activeRoute) this.routePanel.togglePlay();
        else this.timeline.togglePlay();
      } else if (e.key === 'Escape') {
        this.passport.close();
        this.cityCard.close();
        this.activeCityId = null;
        this.compareCityId = null;
        if (this.activeSeasonId) {
          this.seasonPanel.close();
          this.activeSeasonId = null;
          document.getElementById('act-open-season')?.classList.remove('is-active-tool');
        }
        if (this.tripPlanner.active) {
          this.tripPlanner.close();
          this.activeTripIds = null;
          this.renderer.renderRoute(null);
          document.getElementById('act-open-trip')?.classList.remove('is-active-tool');
        }
        this._redrawCities();
        if (this.quiz.active) this.quiz.close();
        this._syncUrl();
      }
    });
  }

  _restoreFromUrl() {
    const st = parseUrlState();
    this.embed = st.embed;
    if (this.embed) document.body.classList.add('is-embed');

    let initialYear = 2026;
    if (st.era) {
      const foundEra = this.erasData.eras.find((e) => e.id === st.era);
      if (foundEra) initialYear = Math.round((foundEra.fromYear + Math.min(foundEra.toYear, 2026)) / 2);
    }
    if (st.year !== null) initialYear = st.year;

    this.timeline.setYear(initialYear, true);
    if (st.visited && st.visited.length) {
      const validIds = new Set(this.cities.map((c) => c.id));
      const merged = new Set([...this.visitedIds, ...st.visited.filter((id) => validIds.has(id))]);
      this.visitedIds = Array.from(merged);
      this._saveVisited();
    } else {
      this._updatePassportBadge();
    }
    this._redrawCities();

    if (st.flavor) this.setFlavorFilter(st.flavor);

    if (st.quiz === 'flavor') {
      this.startQuiz();
    } else if (st.trip && st.trip.length >= 2) {
      const resolved = st.trip.map((tok) => this.findCity(tok)?.id).filter(Boolean);
      if (resolved.length >= 2) this.openTripPlanner(resolved);
    } else if (st.route) {
      this.openRoute(st.route, st.stop ?? 0);
    } else {
      if (st.season) this.openSeason(st.season);
      if (st.city) {
        const c = this.findCity(st.city);
        if (c) {
          this.selectCity(c);
          if (st.compare) {
            const cmp = this.findCity(st.compare);
            if (cmp && cmp.id !== c.id) {
              this.compareCityId = cmp.id;
              this._openCityCard(c);
            }
          }
        }
      }
    }
  }

  _syncUrl() {
    syncUrlState({
      embed: this.embed,
      year: this.timeline?.year,
      city: this.activeCityId,
      compare: this.compareCityId,
      season: this.activeSeasonId,
      trip: this.activeTripIds,
      route: this.activeRoute?.id || null,
      stop: this.activeRoute ? this.activeRouteStop : null,
      flavor: this.flavorFilter,
      quiz: this.quiz?.active ? 'flavor' : null,
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new ShiweiAtlasApp();
  app.init().catch((err) => {
    console.error('Failed to boot Shiwei Atlas:', err);
  });
});
