/**
 * 「循味迁徙」Route Playback Dock
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class RoutePanel {
  constructor(containerEl, projector, { onSelectStop, onClose } = {}) {
    this.el = containerEl;
    this.proj = projector;
    this.onSelectStop = onSelectStop || (() => {});
    this.onClose = onClose || (() => {});
    this._timer = null;
    this._playing = false;
    this._route = null;
    this._stopIdx = 0;
  }

  open(route, stopIdx = 0) {
    this.stopPlay();
    this._route = route;
    this._stopIdx = Math.max(0, Math.min(route.stops.length - 1, stopIdx));
    this.render();
    this.el.classList.remove('is-hidden');
  }

  setStop(idx) {
    if (!this._route) return;
    this._stopIdx = Math.max(0, Math.min(this._route.stops.length - 1, idx));
    this.render();
  }

  togglePlay() {
    if (this._playing) {
      this.stopPlay();
      return;
    }
    if (!this._route || !this._route.stops.length) return;
    this._playing = true;
    // Immediately advance (or restart from stop 0 if at the end) so clicking gives instant feedback
    const nextIdx = this._stopIdx + 1 >= this._route.stops.length ? 0 : this._stopIdx + 1;
    this.onSelectStop(nextIdx);
    this._timer = setInterval(() => {
      if (!this._route) return this.stopPlay();
      if (this._stopIdx + 1 >= this._route.stops.length) {
        this.stopPlay();
        return;
      }
      this.onSelectStop(this._stopIdx + 1);
    }, 2400);
  }

  stopPlay() {
    this._playing = false;
    clearInterval(this._timer);
    this._timer = null;
    if (this._route && !this.el.classList.contains('is-hidden')) this.render();
  }

  close() {
    this.stopPlay();
    this._route = null;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
  }

  render() {
    const r = this._route;
    if (!r) return;
    const stop = r.stops[this._stopIdx];
    let totalKm = 0;
    for (let i = 0; i < r.stops.length - 1; i++) {
      totalKm += this.proj.greatCircleKm(r.stops[i].coord, r.stops[i + 1].coord);
    }

    const pills = r.stops
      .map((s, i) => {
        const yr = s.year < 0 ? `前${-s.year}` : `${s.year}`;
        const active = i === this._stopIdx ? 'is-current' : '';
        return `<button type="button" class="route-pill ${active}" data-rstop="${i}">
          <span class="rp-num" style="${i === this._stopIdx ? `background:${esc(r.color)}` : ''}">${i + 1}</span>
          <span>${esc(s.place.split('（')[0])} (${yr})</span>
        </button>`;
      })
      .join('');

    this.el.innerHTML = `
      <div class="rp-head">
        <div class="rp-title-wrap">
          <div class="rp-meta-row">
            <span class="mini-tag" style="background:${esc(r.color)};color:#fff">${esc(r.category)}</span>
            <span class="rp-dist">全程约 ${Math.round(totalKm).toLocaleString()} km · ${r.span}</span>
          </div>
          <div class="rp-title">${esc(r.title)}</div>
        </div>
        <div class="rp-actions">
          <button type="button" class="rp-btn" id="act-rp-prev" title="上一站">‹</button>
          <button type="button" class="rp-btn is-accent" id="act-rp-play">${this._playing ? '⏸ 暂停' : '▶ 巡礼'}</button>
          <button type="button" class="rp-btn" id="act-rp-next" title="下一站">›</button>
          <button type="button" class="icon-close" id="act-rp-close" aria-label="退出路线">✕</button>
        </div>
      </div>
      <div class="rp-pills">${pills}</div>
      <div class="rp-detail">
        <div class="rp-stop-title">${stop.year < 0 ? `前${-stop.year}` : stop.year}年 · ${esc(stop.place)} — ${esc(stop.title)}</div>
        <p class="rp-stop-desc">${esc(stop.detail)}</p>
        ${stop.quote ? `<div class="rp-stop-quote">${esc(stop.quote)}</div>` : ''}
      </div>
    `;

    this.el.querySelector('#act-rp-close').addEventListener('click', () => {
      this.close();
      this.onClose();
    });
    this.el.querySelector('#act-rp-prev').addEventListener('click', () => {
      const prev = (this._stopIdx - 1 + r.stops.length) % r.stops.length;
      this.onSelectStop(prev);
    });
    this.el.querySelector('#act-rp-next').addEventListener('click', () => {
      const next = (this._stopIdx + 1) % r.stops.length;
      this.onSelectStop(next);
    });
    this.el.querySelector('#act-rp-play').addEventListener('click', () => this.togglePlay());
    this.el.querySelectorAll('[data-rstop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onSelectStop(Number(btn.getAttribute('data-rstop')));
      });
    });
  }
}
