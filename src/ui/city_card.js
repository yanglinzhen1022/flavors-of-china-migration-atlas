/**
 * 「点城寻味 · 一城一味档案」City Flavor Genealogy Card
 * Features: 5-axis SVG flavor radar, Dual-city PK comparison, Passport stamp toggle, PNG poster export
 */
import { categoryIconSvg } from './icons.js';
import { exportCityPoster } from './poster.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFlavorRadarSvg(scores, color = '#b83b2b', compareScores = null, compareColor = '#2f6b64') {
  const axes = ['鲜', '辣', '酸', '甜', '醇'];
  const cx = 62;
  const cy = 60;
  const R = 38;
  const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;

  const rings = [1, 2, 3, 4, 5]
    .map((lvl) => {
      const r = (R * lvl) / 5;
      const pts = axes.map((_, i) => {
        const a = angleAt(i);
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      });
      return `<polygon points="${pts.join(' ')}" class="radar-grid-ring" />`;
    })
    .join('');

  const spokes = axes
    .map((_, i) => {
      const a = angleAt(i);
      const x2 = cx + R * Math.cos(a);
      const y2 = cy + R * Math.sin(a);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="radar-spoke" />`;
    })
    .join('');

  const polyFor = (sc) =>
    axes
      .map((ax, i) => {
        const val = Math.max(0.4, sc[ax] ?? 1);
        const r = (R * val) / 5;
        const a = angleAt(i);
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      })
      .join(' ');

  const labels = axes
    .map((ax, i) => {
      const a = angleAt(i);
      const lr = R + 12;
      const lx = cx + lr * Math.cos(a);
      const ly = cy + lr * Math.sin(a) + 3.5;
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="radar-axis-lbl">${ax}</text>`;
    })
    .join('');

  const comparePoly = compareScores
    ? `<polygon points="${polyFor(compareScores)}" fill="${esc(compareColor)}" fill-opacity="0.20" stroke="${esc(compareColor)}" stroke-width="1.8" stroke-dasharray="3 2" />`
    : '';

  return `<svg class="flavor-radar-svg" viewBox="0 0 124 120" width="114" height="110" aria-label="五味风味雷达">
    ${rings}${spokes}
    <polygon points="${polyFor(scores)}" fill="${esc(color)}" fill-opacity="0.28" stroke="${esc(color)}" stroke-width="1.8" />
    ${comparePoly}
    ${labels}
  </svg>`;
}

export class CityCard {
  constructor(containerEl, { onClose, onJumpYear, onToggleVisit, onCompare } = {}) {
    this.el = containerEl;
    this.onClose = onClose || (() => {});
    this.onJumpYear = onJumpYear || (() => {});
    this.onToggleVisit = onToggleVisit || (() => {});
    this.onCompare = onCompare || (() => {});
  }

  open(city, { allCities = [], visited = false, compareCity = null } = {}) {
    if (!city) {
      this.close();
      return;
    }

    const specsHtml = city.specialties
      .map(
        (s) => `<div class="city-spec-item">
          <div class="city-spec-head">
            <span class="spec-ico">${categoryIconSvg(s.category)}</span>
            <strong>${esc(s.name)}</strong>
            <span class="mini-tag">${esc(s.category)}</span>
            ${s.gi ? '<span class="mini-tag gi-tag">地理标志</span>' : ''}
          </div>
          <div class="city-spec-era">${esc(s.era)}</div>
          <p class="city-spec-desc">${esc(s.desc)}</p>
        </div>`
      )
      .join('');

    const tlHtml = city.timeline
      .map((t) => {
        const yrText = t.year < 0 ? `前${-t.year}年` : `${t.year}年`;
        return `<li class="city-tl-item">
          <button type="button" class="city-tl-yr-btn" data-jump-year="${t.year}" title="点击跳转地图时间轴至 ${yrText}">
            ${yrText} · ${esc(t.eraLabel)} ↗
          </button>
          <div class="city-tl-title">${esc(t.title)}</div>
          <p class="city-tl-detail">${esc(t.detail)}</p>
          <div class="city-tl-src">出处：${esc(t.source)}</div>
        </li>`;
      })
      .join('');

    const dishesHtml = city.dishes.map((d) => `<span class="dish-pill">${esc(d)}</span>`).join('');

    const compareOptions = allCities
      .filter((c) => c.id !== city.id)
      .map((c) => `<option value="${esc(c.id)}" ${compareCity?.id === c.id ? 'selected' : ''}>${esc(c.name)}（${esc(c.province)} · ${esc(c.cuisineFamily.split('·')[0].trim())}）</option>`)
      .join('');

    const compareBoxHtml = compareCity
      ? `<div class="city-compare-box">
          <div class="cmp-legend">
            <span><i style="background:${esc(city.color)}"></i>${esc(city.name)}</span>
            <span><i style="background:#2f6b64;border:1px dashed #2f6b64"></i>${esc(compareCity.name)}</span>
            <button type="button" class="cmp-clear-btn" id="act-clear-compare">结束对比</button>
          </div>
          <div class="cmp-rows">
            <div class="cmp-row"><span>菜系</span><strong>${esc(city.cuisineFamily)}</strong><em>vs</em><strong>${esc(compareCity.cuisineFamily)}</strong></div>
            <div class="cmp-row"><span>招牌</span><strong>${esc(city.dishes[0])}</strong><em>vs</em><strong>${esc(compareCity.dishes[0])}</strong></div>
            <div class="cmp-row"><span>风味差</span><strong>辣${city.flavorScores['辣']} / 鲜${city.flavorScores['鲜']} / 甜${city.flavorScores['甜']}</strong><em>vs</em><strong>辣${compareCity.flavorScores['辣']} / 鲜${compareCity.flavorScores['鲜']} / 甜${compareCity.flavorScores['甜']}</strong></div>
          </div>
        </div>`
      : '';

    this.el.innerHTML = `
      <div class="city-card-header">
        <div>
          <div class="city-kicker">点城寻味 · ${esc(city.region)} · ${esc(city.province)}</div>
          <h2 class="city-title">${esc(city.name)} ${city.ancientName ? `<span class="city-ancient">古称：${esc(city.ancientName)}</span>` : ''}</h2>
          <div class="city-cuisine">${esc(city.cuisineFamily)}</div>
        </div>
        <div class="city-header-btns">
          <button type="button" class="icon-btn visit-btn ${visited ? 'is-visited' : ''}" id="act-visit-city" title="点亮此城美食印章">${visited ? '✓ 已点亮' : '☆ 点亮'}</button>
          <button type="button" class="icon-btn" id="act-export-city" title="导出城市风味卡片 PNG">长图</button>
          <button type="button" class="icon-btn" id="act-share-city" title="复制直达链接分享好友">分享</button>
          <button type="button" class="icon-close" id="act-close-city" aria-label="关闭">✕</button>
        </div>
      </div>
      <div class="city-body">
        <div class="city-hero-row">
          <div class="city-hero-text">
            <p class="city-tagline">${esc(city.tagline)}</p>
            <div class="city-tags-row">${city.flavorTags.map((t) => `<span class="flavor-chip">${esc(t)}</span>`).join('')}</div>
          </div>
          <div class="city-radar-wrap">${renderFlavorRadarSvg(city.flavorScores, city.color, compareCity?.flavorScores || null, '#2f6b64')}</div>
        </div>

        <div class="city-compare-bar">
          <label for="sel-compare-city">双城味觉 PK：</label>
          <select id="sel-compare-city">
            <option value="">选择另一座城对比五味雷达…</option>
            ${compareOptions}
          </select>
        </div>
        ${compareBoxHtml}

        <div class="city-section">
          <div class="city-sec-title">风土与地理密码</div>
          <p class="city-geo-reason">${esc(city.geoReason)}</p>
          ${city.quote ? `<blockquote class="city-quote">${esc(city.quote)}</blockquote>` : ''}
        </div>

        <div class="city-section">
          <div class="city-sec-title">地方风物与地理标志</div>
          <div class="city-spec-list">${specsHtml}</div>
        </div>

        <div class="city-section">
          <div class="city-sec-title">代表名菜与小吃</div>
          <div class="city-dishes-wrap">${dishesHtml}</div>
        </div>

        <div class="city-section">
          <div class="city-sec-title">味觉千年演进 <span class="sec-hint">点击年份可穿越当时风味版图</span></div>
          <ol class="city-tl-list">${tlHtml}</ol>
        </div>

        <div class="city-foot">
          <a href="./topics/city-${esc(city.id)}.html" target="_blank" rel="noopener">阅读「${esc(city.name)}风物志」静态图文专题 ↗</a>
        </div>
      </div>
    `;

    this.el.classList.remove('is-hidden');

    this.el.querySelector('#act-close-city').addEventListener('click', () => {
      this.close();
      this.onClose();
    });

    this.el.querySelector('#act-visit-city').addEventListener('click', () => {
      this.onToggleVisit(city.id);
    });

    this.el.querySelector('#sel-compare-city').addEventListener('change', (e) => {
      this.onCompare(e.target.value || null);
    });
    this.el.querySelector('#act-clear-compare')?.addEventListener('click', () => {
      this.onCompare(null);
    });

    this.el.querySelector('#act-export-city').addEventListener('click', () => {
      exportCityPoster(city, compareCity);
    });

    const shareBtn = this.el.querySelector('#act-share-city');
    shareBtn.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.search = compareCity
        ? `?city=${encodeURIComponent(city.id)}&compare=${encodeURIComponent(compareCity.id)}`
        : `?city=${encodeURIComponent(city.id)}`;
      try {
        await navigator.clipboard.writeText(url.toString());
        shareBtn.textContent = '已复制 ✓';
        setTimeout(() => (shareBtn.textContent = '分享'), 1600);
      } catch {
        shareBtn.textContent = '?city=' + city.id;
      }
    });

    this.el.querySelectorAll('[data-jump-year]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const yr = Number(btn.getAttribute('data-jump-year'));
        this.onJumpYear(yr);
      });
    });
  }

  close() {
    this.el.classList.add('is-hidden');
  }
}
