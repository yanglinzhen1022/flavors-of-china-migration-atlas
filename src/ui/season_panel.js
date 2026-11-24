/**
 * 「四季时令风物」Seasonal Specialties Floating Panel
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SeasonPanel {
  constructor(containerEl, { onSelectCity, onSwitchSeason, onClose } = {}) {
    this.el = containerEl;
    this.onSelectCity = onSelectCity || (() => {});
    this.onSwitchSeason = onSwitchSeason || (() => {});
    this.onClose = onClose || (() => {});
  }

  open(season, allSeasons, cityMap) {
    if (!season) {
      this.close();
      return;
    }

    const tabsHtml = allSeasons
      .map(
        (s) => `<button type="button" class="season-tab-btn ${s.id === season.id ? 'is-active' : ''}" data-season-tab="${esc(s.id)}" style="${s.id === season.id ? `background:${esc(s.color)};border-color:${esc(s.color)};color:#fff` : ''}">${esc(s.short)}季</button>`
      )
      .join('');

    const picksHtml = season.picks
      .map((p) => {
        const city = cityMap.get(p.cityId);
        if (!city) return '';
        return `<button type="button" class="season-pick-item" data-season-city="${esc(p.cityId)}">
          <div class="sp-head">
            <strong style="color:${esc(season.color)}">${esc(city.name)}</strong>
            <span class="sp-item-name">${esc(p.item)}</span>
          </div>
          <div class="sp-desc">${esc(p.desc)}</div>
        </button>`;
      })
      .join('');

    this.el.innerHTML = `
      <div class="season-head">
        <div>
          <div class="season-kicker" style="color:${esc(season.color)}">不时不食 · ${esc(season.solarTerms)}</div>
          <div class="season-title">${esc(season.name)}</div>
        </div>
        <div class="season-head-right">
          <div class="season-tabs">${tabsHtml}</div>
          <button type="button" class="icon-close" id="act-season-close" aria-label="退出时令视图">✕</button>
        </div>
      </div>
      <p class="season-tagline">${esc(season.tagline)}</p>
      <div class="season-picks-list">${picksHtml}</div>
    `;

    this.el.classList.remove('is-hidden');

    this.el.querySelector('#act-season-close').addEventListener('click', () => {
      this.close();
      this.onClose();
    });
    this.el.querySelectorAll('[data-season-tab]').forEach((btn) => {
      btn.addEventListener('click', () => this.onSwitchSeason(btn.getAttribute('data-season-tab')));
    });
    this.el.querySelectorAll('[data-season-city]').forEach((btn) => {
      btn.addEventListener('click', () => this.onSelectCity(btn.getAttribute('data-season-city')));
    });
  }

  close() {
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
  }
}
