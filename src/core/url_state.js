/**
 * Zero-coordinate Deep-Link URL State parser & serializer.
 * Supports: ?year=, ?era=, ?city=, ?route=, ?stop=, ?flavor=, ?quiz=flavor, ?embed=1
 */
export function parseUrlState(searchStr = typeof location !== 'undefined' ? location.search : '') {
  const params = new URLSearchParams(searchStr);
  const yearRaw = params.get('year');
  const year = yearRaw !== null && yearRaw !== '' && !Number.isNaN(Number(yearRaw)) ? Number(yearRaw) : null;
  const stopRaw = params.get('stop');
  const stop = stopRaw !== null && stopRaw !== '' && !Number.isNaN(Number(stopRaw)) ? Number(stopRaw) : null;
  return {
    year,
    era: params.get('era') || null,
    city: params.get('city') || null,
    compare: params.get('compare') || null,
    visited: params.get('visited') ? params.get('visited').split(',').filter(Boolean) : null,
    route: params.get('route') || null,
    stop,
    flavor: params.get('flavor') || null,
    quiz: params.get('quiz') || null,
    embed: params.get('embed') === '1',
    q: params.get('q') || null,
  };
}

export function syncUrlState(state) {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const params = new URLSearchParams();
  if (state.embed) params.set('embed', '1');
  if (state.route) {
    params.set('route', state.route);
    if (typeof state.stop === 'number' && state.stop >= 0) params.set('stop', String(state.stop));
  } else {
    if (typeof state.year === 'number') params.set('year', String(state.year));
    if (state.city) {
      params.set('city', state.city);
      if (state.compare) params.set('compare', state.compare);
    }
  }
  if (state.flavor) params.set('flavor', state.flavor);
  if (state.quiz) params.set('quiz', state.quiz);

  const qs = params.toString();
  const next = qs ? `${location.pathname}?${qs}` : location.pathname;
  if (next !== `${location.pathname}${location.search}`) {
    history.replaceState(null, '', next);
  }
}
