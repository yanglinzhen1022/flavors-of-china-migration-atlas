/**
 * 「我的食味护照」Personal Culinary Passport & Footprint Modal
 */
import { exportPassportPoster } from './poster.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPersonalRadarSvg(avgScores) {
  const axes = ['鲜', '辣', '酸', '甜', '醇'];
  const cx = 64;
  const cy = 62;
  const R = 40;
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
      return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" class="radar-spoke" />`;
    })
    .join('');

  const dataPts = axes.map((ax, i) => {
    const val = Math.max(0.4, avgScores[ax] ?? 0);
    const r = (R * val) / 5;
    const a = angleAt(i);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });

  const labels = axes
    .map((ax, i) => {
      const a = angleAt(i);
      const lr = R + 12;
      return `<text x="${(cx + lr * Math.cos(a)).toFixed(1)}" y="${(cy + lr * Math.sin(a) + 3.5).toFixed(1)}" class="radar-axis-lbl">${ax}</text>`;
    })
    .join('');

  return `<svg class="flavor-radar-svg" viewBox="0 0 128 124" width="124" height="120" aria-label="个人五味偏好雷达">
    ${rings}${spokes}
    <polygon points="${dataPts.join(' ')}" fill="#b83b2b" fill-opacity="0.28" stroke="#b83b2b" stroke-width="2" />
    ${labels}
  </svg>`;
}

export class PassportPanel {
  constructor(containerEl, { onSelectCity, onClearAll } = {}) {
    this.el = containerEl;
    this.onSelectCity = onSelectCity || (() => {});
    this.onClearAll = onClearAll || (() => {});
  }

  open(cities, visitedIds) {
    const visitedSet = new Set(visitedIds);
    const litCities = cities.filter((c) => visitedSet.has(c.id));

    const regions = ['华北', '东北', '华东', '华中', '西南', '华南', '西北'];
    const regionStats = regions.map((reg) => {
      const allInReg = cities.filter((c) => c.region === reg);
      const litInReg = allInReg.filter((c) => visitedSet.has(c.id));
      return { reg, total: allInReg.length, lit: litInReg.length };
    });

    const avgScores = { 鲜: 0, 辣: 0, 酸: 0, 甜: 0, 醇: 0 };
    if (litCities.length > 0) {
      for (const c of litCities) {
        for (const ax of Object.keys(avgScores)) {
          avgScores[ax] += c.flavorScores[ax] ?? 0;
        }
      }
      for (const ax of Object.keys(avgScores)) {
        avgScores[ax] = +(avgScores[ax] / litCities.length).toFixed(1);
      }
    }

    let tasteTitle = '初入食林';
    if (litCities.length >= 25) tasteTitle = '九州大饕 · 山河尝遍';
    else if (litCities.length >= 12) tasteTitle = '风物行家 · 四海寻味';
    else if (litCities.length >= 5) tasteTitle = '食味旅人 · 初窥门径';
    else if (litCities.length >= 1) {
      const topAxis = Object.entries(avgScores).sort((a, b) => b[1] - a[1])[0]?.[0];
      const mapTitle = { 鲜: '逐鲜雅士', 辣: '无辣不欢客', 酸: '嗜酸寻味人', 甜: '江南清甜客', 醇: '碳水醇香迷' };
      tasteTitle = mapTitle[topAxis] || '食味旅人';
    }

    const regBarsHtml = regionStats
      .map(
        (r) => `<div class="pp-reg-row">
          <span class="pp-reg-name">${esc(r.reg)}</span>
          <div class="pp-reg-track"><div class="pp-reg-fill" style="width:${r.total ? Math.round((r.lit / r.total) * 100) : 0}%"></div></div>
          <span class="pp-reg-num">${r.lit}/${r.total}</span>
        </div>`
      )
      .join('');

    const stampsHtml = litCities.length
      ? litCities
          .map(
            (c) => `<button type="button" class="pp-stamp" data-pp-city="${esc(c.id)}" style="border-color:${esc(c.color)}">
              <strong>${esc(c.name)}</strong>
              <small>${esc(c.province)}</small>
            </button>`
          )
          .join('')
      : '<p class="pp-empty">尚未点亮任何城市。点击地图上的城市卡片右上角「点亮足迹」，即可收集你的中华美食印章！</p>';

    this.el.innerHTML = `
      <div class="pp-backdrop"></div>
      <div class="pp-dialog" role="dialog" aria-label="我的食味护照">
        <div class="pp-head">
          <div>
            <div class="city-kicker">个人美食足迹 · 食味护照</div>
            <h2 class="pp-title">${esc(tasteTitle)} <small>已点亮 ${litCities.length} / ${cities.length} 城</small></h2>
          </div>
          <button type="button" class="icon-close" id="act-pp-close" aria-label="关闭">✕</button>
        </div>
        <div class="pp-body">
          <div class="pp-summary-grid">
            <div class="pp-radar-box">
              ${renderPersonalRadarSvg(avgScores)}
              <div class="pp-radar-cap">${litCities.length ? '你的综合风味偏好' : '点亮城市后生成风味画像'}</div>
            </div>
            <div class="pp-regions-box">${regBarsHtml}</div>
          </div>

          <div class="pp-sec-head">
            <span>已收集的城市印章</span>
            <div class="pp-sec-actions">
              ${litCities.length ? '<button type="button" class="icon-btn" id="act-pp-poster">导出护照长图</button><button type="button" class="icon-btn" id="act-pp-share">复制足迹链接</button><button type="button" class="icon-btn" id="act-pp-clear">清空</button>' : ''}
            </div>
          </div>
          <div class="pp-stamps-grid">${stampsHtml}</div>
        </div>
      </div>
    `;

    this.el.classList.remove('is-hidden');

    this.el.querySelector('#act-pp-close').addEventListener('click', () => this.close());
    this.el.querySelector('.pp-backdrop').addEventListener('click', () => this.close());

    this.el.querySelectorAll('[data-pp-city]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-pp-city');
        this.close();
        this.onSelectCity(cid);
      });
    });

    this.el.querySelector('#act-pp-clear')?.addEventListener('click', () => {
      this.onClearAll();
      this.open(cities, []);
    });

    this.el.querySelector('#act-pp-poster')?.addEventListener('click', () => {
      exportPassportPoster(cities, visitedIds, avgScores, tasteTitle, regionStats);
    });

    const shareBtn = this.el.querySelector('#act-pp-share');
    shareBtn?.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.search = `?visited=${encodeURIComponent(litCities.map((c) => c.id).join(','))}`;
      try {
        await navigator.clipboard.writeText(url.toString());
        shareBtn.textContent = '已复制 ✓';
        setTimeout(() => (shareBtn.textContent = '复制足迹链接'), 1600);
      } catch {
        shareBtn.textContent = '?visited=' + litCities.map((c) => c.id).join(',');
      }
    });
  }

  close() {
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
  }
}
