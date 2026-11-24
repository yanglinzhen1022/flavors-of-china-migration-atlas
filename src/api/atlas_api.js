/**
 * Public Browser API (window.shiweiAPI) & WebMCP (navigator.modelContext) registration
 */
export function registerAtlasApi(app) {
  const api = {
    locate({ city, route, stop, year, flavor } = {}) {
      if (flavor !== undefined) app.setFlavorFilter(flavor);
      if (route) {
        app.openRoute(route, typeof stop === 'number' ? stop : 0);
        return this.inspect({ route, stop });
      }
      if (typeof year === 'number') {
        app.timeline.setYear(year);
      }
      if (city) {
        const c = app.findCity(city);
        if (c) app.selectCity(c);
        return this.inspect({ city: c ? c.id : city, year: app.timeline.year });
      }
      return this.inspect({ year: app.timeline.year });
    },

    inspect({ city, route, stop, year } = {}) {
      const targetYear = typeof year === 'number' ? year : app.timeline.year;
      const era = app.timeline.getEraForYear(targetYear);
      const cityObj = city ? app.findCity(city) : null;
      const routeObj = route ? app.findRoute(route) : null;
      return {
        year: targetYear,
        era: { id: era.id, name: era.name, span: era.span, summary: era.summary },
        city: cityObj || null,
        route: routeObj
          ? {
              id: routeObj.id,
              title: routeObj.title,
              span: routeObj.span,
              stop: typeof stop === 'number' ? routeObj.stops[stop] : routeObj.stops[0],
            }
          : null,
        url: location.href,
      };
    },

    search(query, limit = 10) {
      return app.search(query, limit).map((item) => ({
        kind: item.kind,
        id: item.id,
        title: item.title,
        sub: item.sub,
      }));
    },

    listCities() {
      return app.cities.map((c) => ({
        id: c.id,
        name: c.name,
        province: c.province,
        cuisineFamily: c.cuisineFamily,
        dishes: c.dishes,
      }));
    },
  };

  window.shiweiAPI = api;

  if (typeof navigator !== 'undefined' && navigator.modelContext && typeof navigator.modelContext.registerTool === 'function') {
    try {
      navigator.modelContext.registerTool({
        name: 'shiwei_locate_city',
        description: 'Locate a Chinese culinary city on the Shiwei Atlas, view its specialties, GI products, and taste history.',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City id, Chinese name, or pinyin (e.g. "chengdu", "成都", "潮州")' },
            year: { type: 'integer', description: 'Optional historical year (-221 to 2026)' },
          },
          required: ['city'],
        },
        execute: async (args) => api.locate(args),
      });
      navigator.modelContext.registerTool({
        name: 'shiwei_open_route',
        description: 'Open a food/crop/gourmet migration route on the Shiwei Atlas (e.g. chili, zhangqian, sushi, tea_horse, canal, sweet_potato).',
        inputSchema: {
          type: 'object',
          properties: {
            route: { type: 'string' },
            stop: { type: 'integer' },
          },
          required: ['route'],
        },
        execute: async (args) => api.locate(args),
      });
    } catch {
      // WebMCP optional
    }
  }
}
