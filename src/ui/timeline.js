/**
 * Bottom Scrubber Timeline Controller
 */
export class TimelineController {
  constructor(erasData, { onYearChange } = {}) {
    this.eras = erasData.eras;
    this.milestones = [...erasData.milestones].sort((a, b) => a.year - b.year);
    this.minYear = this.eras[0].fromYear;
    this.maxYear = this.eras[this.eras.length - 1].toYear;
    this.year = 2026;
    this.onYearChange = onYearChange || (() => {});

    this.bandsEl = document.getElementById('era-bands');
    this.ticksEl = document.getElementById('scrubber-ticks');
    this.handleEl = document.getElementById('scrubber-handle');
    this.bubbleEl = document.getElementById('bubble-text');
    this.trackEl = document.getElementById('scrubber-track');
    this.yearInp = document.getElementById('inp-year');
    this.playBtn = document.getElementById('act-autoplay');
    this.speedBtn = document.getElementById('act-play-speed');

    this._playing = false;
    this._speed = 1;
    this._playTimer = null;

    this._renderTrack();
    this._bindEvents();
  }

  getEraForYear(y) {
    for (let i = 0; i < this.eras.length; i++) {
      const e = this.eras[i];
      if (y >= e.fromYear && (y < e.toYear || i === this.eras.length - 1)) return e;
    }
    return this.eras[this.eras.length - 1];
  }

  _pct(y) {
    return ((y - this.minYear) / (this.maxYear - this.minYear)) * 100;
  }

  _renderTrack() {
    this.bandsEl.innerHTML = '';
    for (const e of this.eras) {
      const left = this._pct(e.fromYear);
      const width = this._pct(e.toYear) - left;
      const div = document.createElement('div');
      div.className = 'era-band';
      div.style.left = `${left}%`;
      div.style.width = `${width}%`;
      div.style.background = e.color;
      div.title = `${e.name}（${e.span}）`;
      div.innerHTML = `<span>${e.name}</span>`;
      div.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const mid = Math.round((e.fromYear + Math.min(e.toYear, 2026)) / 2);
        this.setYear(mid);
      });
      this.bandsEl.appendChild(div);
    }

    this.ticksEl.innerHTML = '';
    for (const m of this.milestones) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'milestone-tick';
      dot.style.left = `${this._pct(m.year)}%`;
      const yrLabel = m.year < 0 ? `前${-m.year}年` : `${m.year}年`;
      dot.title = `${yrLabel} · ${m.title}`;
      dot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.setYear(m.year);
      });
      this.ticksEl.appendChild(dot);
    }
  }

  setYear(y, notify = true) {
    const clamped = Math.max(this.minYear, Math.min(this.maxYear, Math.round(y)));
    this.year = clamped;
    const pct = this._pct(clamped);
    this.handleEl.style.left = `${pct}%`;
    this.yearInp.value = String(clamped);

    const era = this.getEraForYear(clamped);
    const nearest = this.milestones.find((m) => Math.abs(m.year - clamped) <= 3);
    const yrStr = clamped < 0 ? `公元前${-clamped}年` : `公元${clamped}年`;
    this.bubbleEl.textContent = nearest
      ? `${yrStr} · ${era.name} · ${nearest.title}`
      : `${yrStr} · ${era.name}`;

    if (notify) this.onYearChange(clamped, era);
  }

  stepMilestone(delta) {
    if (delta > 0) {
      const next = this.milestones.find((m) => m.year > this.year);
      this.setYear(next ? next.year : this.milestones[0].year);
    } else {
      const prevs = this.milestones.filter((m) => m.year < this.year);
      this.setYear(prevs.length ? prevs[prevs.length - 1].year : this.milestones[this.milestones.length - 1].year);
    }
  }

  togglePlay() {
    if (this._playing) {
      this.stopPlay();
      return;
    }
    this._playing = true;
    this.playBtn.classList.add('is-playing');
    this.playBtn.textContent = '⏸';

    // Immediately step to the next milestone (or restart from the beginning if at the last year)
    const firstNext = this.milestones.find((m) => m.year > this.year);
    if (firstNext) {
      this.setYear(firstNext.year);
    } else if (this.milestones.length) {
      this.setYear(this.milestones[0].year);
    }

    const delay = this._speed === 2 ? 1100 : 2000;
    this._playTimer = setInterval(() => {
      const next = this.milestones.find((m) => m.year > this.year);
      if (!next) {
        this.stopPlay();
        return;
      }
      this.setYear(next.year);
    }, delay);
  }

  stopPlay() {
    this._playing = false;
    clearInterval(this._playTimer);
    this._playTimer = null;
    this.playBtn.classList.remove('is-playing');
    this.playBtn.textContent = '▶';
  }

  _bindEvents() {
    let scrubbing = false;
    const yearFromClientX = (clientX) => {
      const rect = this.trackEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(this.minYear + ratio * (this.maxYear - this.minYear));
    };

    this.trackEl.addEventListener('pointerdown', (e) => {
      scrubbing = true;
      this.stopPlay();
      this.setYear(yearFromClientX(e.clientX));
    });
    window.addEventListener('pointermove', (e) => {
      if (!scrubbing) return;
      this.setYear(yearFromClientX(e.clientX));
    });
    window.addEventListener('pointerup', () => {
      scrubbing = false;
    });

    this.yearInp.addEventListener('change', () => {
      const val = Number(this.yearInp.value);
      if (!Number.isNaN(val)) this.setYear(val);
    });

    document.getElementById('act-step-prev').addEventListener('click', () => this.stepMilestone(-1));
    document.getElementById('act-step-next').addEventListener('click', () => this.stepMilestone(1));
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.speedBtn.addEventListener('click', () => {
      this._speed = this._speed === 1 ? 2 : 1;
      this.speedBtn.textContent = `${this._speed}×`;
      if (this._playing) {
        this.stopPlay();
        this.togglePlay();
      }
    });
  }
}
