/**
 * 「吃货行程规划」Custom Multi-City Culinary Trip Planner (?trip=a,b,c)
 */
import { exportTripPoster } from './poster.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRESET_TRIPS = [
  { id: 'chuanyu', label: '川渝麻辣暴走', ids: ['chengdu', 'leshan', 'zigong', 'chongqing'] },
  { id: 'jiangnan', label: '江南运河早茶线', ids: ['yangzhou', 'nanjing', 'suzhou', 'hangzhou'] },
  { id: 'lingnan', label: '广佛潮汕寻鲜线', ids: ['guangzhou', 'shunde', 'hongkong', 'chaozhou', 'shantou'] },
  { id: 'northwest', label: '丝路碳水牛羊线', ids: ['xian', 'tianshui', 'lanzhou', 'yinchuan'] },
];

export class TripPlanner {
  constructor(containerEl, projector, { onChange, onSelectCity, onClose } = {}) {
    this.el = containerEl;
    this.proj = projector;
    this.onChange = onChange || (() => {});
    this.onSelectCity = onSelectCity || (() => {});
    this.onClose = onClose || (() => {});
    this.cityIds = [];
    this.active = false;
  }

  open(allCities, initialIds = null) {
    this.allCities = allCities;
    this.cityMap = new Map(allCities.map((c) => [c.id, c]));
    this.active = true;
    if (Array.isArray(initialIds) && initialIds.length >= 2) {
      this.cityIds = initialIds.filter((id) => this.cityMap.has(id)).slice(0, 6);
    } else if (this.cityIds.length < 2) {
      this.cityIds = [...PRESET_TRIPS[0].ids];
    }
    this.render();
    this.el.classList.remove('is-hidden');
    this._emitChange();
  }

  close() {
    this.active = false;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
  }

  _getTripCities() {
    return this.cityIds.map((id) => this.cityMap.get(id)).filter(Boolean);
  }

  _totalKm(cities) {
    let km = 0;
    for (let i = 0; i < cities.length - 1; i++) {
      km += this.proj.greatCircleKm(cities[i].coord, cities[i + 1].coord);
    }
    return Math.round(km);
  }

  _emitChange() {
    const cities = this._getTripCities();
    this.onChange(cities, this._totalKm(cities));
  }

  render() {
    const tripCities = this._getTripCities();
    const totalKm = this._totalKm(tripCities);

    const presetsHtml = PRESET_TRIPS.map(
      (p) => `<button type="button" class="trip-preset-btn" data-preset="${esc(p.id)}">${esc(p.label)}</button>`
    ).join('');

    const stopsHtml = tripCities
      .map(
        (c, i) => `<div class="trip-stop-row">
          <span class="trip-stop-idx">${i + 1}</span>
          <button type="button" class="trip-stop-main" data-trip-focus="${esc(c.id)}">
            <strong>${esc(c.name)}</strong>
            <small>${esc(c.dishes.slice(0, 2).join(' · '))}</small>
          </button>
          <div class="trip-stop-ops">
            ${i > 0 ? `<button type="button" class="trip-op-btn" data-move-up="${i}" title="上移">↑</button>` : ''}
            ${i < tripCities.length - 1 ? `<button type="button" class="trip-op-btn" data-move-dn="${i}" title="下移">↓</button>` : ''}
            <button type="button" class="trip-op-btn" data-remove="${i}" title="移除">✕</button>
          </div>
        </div>`
      )
      .join('');

    const addOpts = this.allCities
      .filter((c) => !this.cityIds.includes(c.id))
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}（${esc(c.province)} · ${esc(c.dishes[0])}）</option>`)
      .join('');

    this.el.innerHTML = `
      <div class="rp-head">
        <div class="rp-title-wrap">
          <div class="rp-meta-row">
            <span class="mini-tag" style="background:#b83b2b;color:#fff">吃货行程</span>
            <span class="rp-dist">${tripCities.length} 站 · 全程约 ${totalKm.toLocaleString()} km</span>
          </div>
          <div class="rp-title">自定义周末寻味路线</div>
        </div>
        <div class="rp-actions">
          <button type="button" class="rp-btn" id="act-trip-poster" ${tripCities.length < 2 ? 'disabled' : ''}>导出攻略图</button>
          <button type="button" class="rp-btn is-accent" id="act-trip-share" ${tripCities.length < 2 ? 'disabled' : ''}>复制深链</button>
          <button type="button" class="icon-close" id="act-trip-close" aria-label="退出行程规划">✕</button>
        </div>
      </div>

      <div class="trip-presets">${presetsHtml}</div>

      <div class="trip-stops-list">${stopsHtml || '<div class="pp-empty">请至少添加 2 座城市生成路线</div>'}</div>

      ${
        this.cityIds.length < 6
          ? `<div class="trip-add-bar">
              <select id="sel-trip-add">
                <option value="">添加下一座美食城（最多 6 城）…</option>
                ${addOpts}
              </select>
              <button type="button" class="rp-btn is-accent" id="act-trip-add">+ 添加</button>
            </div>`
          : '<div class="trip-limit-note">已达 6 城上限，可移除或调整顺序</div>'
      }
    `;

    this.el.querySelector('#act-trip-close').addEventListener('click', () => {
      this.close();
      this.onClose();
    });

    this.el.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = PRESET_TRIPS.find((p) => p.id === btn.getAttribute('data-preset'));
        if (preset) {
          this.cityIds = [...preset.ids];
          this.render();
          this._emitChange();
        }
      });
    });

    this.el.querySelectorAll('[data-trip-focus]').forEach((btn) => {
      btn.addEventListener('click', () => this.onSelectCity(btn.getAttribute('data-trip-focus')));
    });

    this.el.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove'));
        this.cityIds.splice(idx, 1);
        this.render();
        this._emitChange();
      });
    });
    this.el.querySelectorAll('[data-move-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-move-up'));
        [this.cityIds[i - 1], this.cityIds[i]] = [this.cityIds[i], this.cityIds[i - 1]];
        this.render();
        this._emitChange();
      });
    });
    this.el.querySelectorAll('[data-move-dn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-move-dn'));
        [this.cityIds[i + 1], this.cityIds[i]] = [this.cityIds[i], this.cityIds[i + 1]];
        this.render();
        this._emitChange();
      });
    });

    const addBtn = this.el.querySelector('#act-trip-add');
    const addSel = this.el.querySelector('#sel-trip-add');
    addBtn?.addEventListener('click', () => {
      const val = addSel.value;
      if (val && !this.cityIds.includes(val) && this.cityIds.length < 6) {
        this.cityIds.push(val);
        this.render();
        this._emitChange();
      }
    });

    this.el.querySelector('#act-trip-poster')?.addEventListener('click', () => {
      exportTripPoster(tripCities, totalKm);
    });

    const shareBtn = this.el.querySelector('#act-trip-share');
    shareBtn?.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.search = `?trip=${encodeURIComponent(this.cityIds.join(','))}`;
      try {
        await navigator.clipboard.writeText(url.toString());
        shareBtn.textContent = '已复制 ✓';
        setTimeout(() => (shareBtn.textContent = '复制深链'), 1600);
      } catch {
        shareBtn.textContent = '?trip=' + this.cityIds.join(',');
      }
    });
  }
}
