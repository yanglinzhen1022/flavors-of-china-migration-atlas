#!/usr/bin/env node
/**
 * Automated Unit & Integration Test Suite for Shiwei Atlas (食味中国)
 * Zero external dependencies.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MercatorProjector } from '../src/core/projection.js';
import { buildSearchIndex, searchAtlas } from '../src/core/search.js';
import { parseUrlState } from '../src/core/url_state.js';
import { loadCities } from './build_bundle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function testProjection() {
  const proj = new MercatorProjector(1000, 720);
  const [bx, by] = proj.toScreen(116.40, 39.90); // Beijing
  const [cx, cy] = proj.toScreen(104.06, 30.67); // Chengdu
  assert(bx > cx, 'Beijing should be east of Chengdu');
  assert(by < cy, 'Beijing should be north (smaller y) of Chengdu');

  const roundTrip = proj.toGeo(bx, by);
  assert(Math.abs(roundTrip[0] - 116.40) < 0.01, 'Longitude round-trip accurate');
  assert(Math.abs(roundTrip[1] - 39.90) < 0.01, 'Latitude round-trip accurate');

  const distKm = proj.greatCircleKm([116.40, 39.90], [121.47, 31.23]); // Beijing -> Shanghai ~1068km
  assert(distKm > 1000 && distKm < 1150, `Expected Beijing-Shanghai ~1068km, got ${distKm}`);
}

function testSearchAndDeepLinks() {
  const cities = loadCities();
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
  const erasData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'eras.json'), 'utf8'));
  const idx = buildSearchIndex({ cities, routes, erasData });

  const hits1 = searchAtlas(idx, '螺蛳粉');
  assert(hits1.length > 0 && hits1[0].id === 'liuzhou', 'Searching 螺蛳粉 should return 柳州 first');

  const hits2 = searchAtlas(idx, '臭鳜鱼');
  assert(hits2.length > 0 && hits2[0].id === 'huangshan', 'Searching 臭鳜鱼 should return 黄山·徽州');

  const hits3 = searchAtlas(idx, '甘谷辣椒');
  assert(hits3.length > 0 && hits3[0].id === 'tianshui', 'Searching 甘谷辣椒 should return 天水');

  const st = parseUrlState('?city=chengdu&compare=shunde&visited=chengdu,xian&season=autumn&trip=chengdu,leshan,chongqing&flavor=辣&embed=1');
  assert.equal(st.city, 'chengdu');
  assert.equal(st.compare, 'shunde');
  assert.deepEqual(st.visited, ['chengdu', 'xian']);
  assert.equal(st.season, 'autumn');
  assert.deepEqual(st.trip, ['chengdu', 'leshan', 'chongqing']);
  assert.equal(st.flavor, '辣');
  assert.equal(st.embed, true);
}

function testMcpServer() {
  const input = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'inspect_city_flavor', arguments: { city: '黄山' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'inspect_food_route', arguments: { route: 'noodles' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'search_culinary_atlas', arguments: { query: '大红袍' } } }),
  ].join('\n') + '\n';

  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'mcp_server.js')], {
    input,
    encoding: 'utf8',
  });
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 5);
  assert.equal(lines[1].result.tools.length, 3);
  assert(lines[2].result.content[0].text.includes('徽州臭鳜鱼'));
  assert(lines[3].result.content[0].text.includes('汤饼'));
  assert(lines[4].result.content[0].text.includes('wuyishan'));
}

function testSeoTopics() {
  const cities = loadCities();
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
  assert(fs.existsSync(path.join(ROOT, 'topics', 'index.html')), 'Missing topics/index.html');
  for (const c of cities) {
    assert(fs.existsSync(path.join(ROOT, 'topics', `city-${c.id}.html`)), `Missing topic page for ${c.id}`);
  }
  for (const r of routes) {
    assert(fs.existsSync(path.join(ROOT, 'topics', `route-${r.id}.html`)), `Missing topic page for route ${r.id}`);
  }
}

const t0 = performance.now();
testProjection();
testSearchAndDeepLinks();
testMcpServer();
testSeoTopics();
console.log(`✓ All unit & integration tests passed in ${(performance.now() - t0).toFixed(1)} ms`);
