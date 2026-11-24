#!/usr/bin/env node
/**
 * Integrity & Schema Validator for Shiwei Atlas (食味中国)
 * Zero external dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCities } from './build_bundle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run() {
  const t0 = performance.now();
  const cities = loadCities();
  const erasData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'eras.json'), 'utf8'));
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
  const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geo', 'china_provinces.json'), 'utf8'));
  const geoFeatures = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geo', 'geo_features.json'), 'utf8'));

  assert(cities.length >= 30, `Expected >= 30 cities, got ${cities.length}`);
  assert(provinces.length === 34, `Expected 34 provinces, got ${provinces.length}`);
  assert(erasData.eras.length === 6, `Expected 6 eras, got ${erasData.eras.length}`);
  assert(routes.length >= 5, `Expected >= 5 routes, got ${routes.length}`);

  const cityMap = new Map();
  for (const c of cities) {
    assert(c.id && typeof c.id === 'string', 'City missing id');
    assert(!cityMap.has(c.id), `Duplicate city id: ${c.id}`);
    cityMap.set(c.id, c);

    for (const k of ['name', 'province', 'region', 'cuisineFamily', 'tagline', 'geoReason']) {
      assert(typeof c[k] === 'string' && c[k].trim().length > 0, `${c.id} missing ${k}`);
    }
    assert(Array.isArray(c.coord) && c.coord.length === 2, `${c.id} invalid coord`);
    const [lng, lat] = c.coord;
    assert(lng >= 73 && lng <= 135 && lat >= 18 && lat <= 54, `${c.id} coord out of China bounds: ${c.coord}`);
    assert(Array.isArray(c.flavorTags) && c.flavorTags.length >= 2, `${c.id} flavorTags too short`);
    assert(c.flavorScores && typeof c.flavorScores === 'object', `${c.id} missing flavorScores`);
    for (const axis of ['鲜', '辣', '酸', '甜', '醇']) {
      const v = c.flavorScores[axis];
      assert(Number.isInteger(v) && v >= 0 && v <= 5, `${c.id} invalid flavorScores.${axis}=${v}`);
    }
    assert(Array.isArray(c.specialties) && c.specialties.length >= 2, `${c.id} needs >= 2 specialties`);
    assert(Array.isArray(c.timeline) && c.timeline.length >= 2, `${c.id} needs >= 2 timeline entries`);
    assert(Array.isArray(c.dishes) && c.dishes.length >= 3, `${c.id} needs >= 3 dishes`);
  }

  const eraIds = new Set(erasData.eras.map((e) => e.id));
  for (const eid of eraIds) {
    assert(Array.isArray(erasData.zones[eid]) && erasData.zones[eid].length > 0, `Missing flavor zones for era ${eid}`);
    for (const z of erasData.zones[eid]) {
      assert(Array.isArray(z.polygon) && z.polygon.length >= 3, `Zone ${z.id} polygon invalid`);
      assert(Array.isArray(z.anchor) && z.anchor.length === 2, `Zone ${z.id} anchor invalid`);
    }
  }

  for (const m of erasData.milestones) {
    assert(eraIds.has(m.eraId), `Milestone "${m.title}" references unknown eraId ${m.eraId}`);
    if (m.city) assert(cityMap.has(m.city), `Milestone "${m.title}" references unknown city ${m.city}`);
  }

  for (const r of routes) {
    assert(r.id && r.title && Array.isArray(r.stops) && r.stops.length >= 4, `Route ${r.id} invalid`);
    for (const s of r.stops) {
      assert(cityMap.has(s.cityId), `Route ${r.id} stop "${s.place}" references unknown cityId ${s.cityId}`);
      assert(Array.isArray(s.coord) && s.coord.length === 2, `Route ${r.id} stop "${s.place}" invalid coord`);
    }
  }

  assert(Array.isArray(geoFeatures.rivers) && geoFeatures.rivers.length >= 3, 'Missing rivers');
  assert(Array.isArray(geoFeatures.corridors) && geoFeatures.corridors.length >= 3, 'Missing corridors');

  const bundlePath = path.join(ROOT, 'data', 'cities_bundle.json');
  assert(fs.existsSync(bundlePath), 'Missing data/cities_bundle.json (run npm run build)');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  assert.equal(bundle.count, cities.length, 'cities_bundle.json is stale; run npm run build');

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Shiwei Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${cities.length} cities, ${cities.reduce((a, c) => a + c.specialties.length, 0)} specialties, ${cities.reduce((a, c) => a + c.timeline.length, 0)} historical entries`);
  console.log(`  - ${erasData.eras.length} culinary eras, ${erasData.milestones.length} milestones`);
  console.log(`  - ${routes.length} migration routes (${routes.reduce((a, r) => a + r.stops.length, 0)} stops)`);
  console.log(`  - ${provinces.length} provinces & ${geoFeatures.rivers.length + geoFeatures.corridors.length + geoFeatures.divides.length} geographic layers`);
}

run();
