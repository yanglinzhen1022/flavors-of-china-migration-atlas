#!/usr/bin/env node
/**
 * Zero-Dependency Model Context Protocol (MCP) Server for Shiwei Atlas (食味中国)
 * Speaks JSON-RPC 2.0 over stdio.
 * Tools:
 *   1. inspect_city_flavor
 *   2. inspect_food_route
 *   3. search_culinary_atlas
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadCities } from './build_bundle.js';
import { buildSearchIndex, searchAtlas } from '../src/core/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const cities = loadCities();
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
const erasData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'eras.json'), 'utf8'));
const searchIndex = buildSearchIndex({ cities, routes, erasData });

const TOOLS = [
  {
    name: 'inspect_city_flavor',
    description: 'Query a Chinese city’s culinary family, 5-axis flavor scores, local specialties/GI products, and historical food timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City id, Chinese name, ancient name, or pinyin (e.g. "chengdu", "成都", "潮州")' },
      },
      required: ['city'],
    },
  },
  {
    name: 'inspect_food_route',
    description: 'Query a historical food, crop, or gourmet migration route across China (e.g. chili, zhangqian, sushi, tea_horse, canal, sweet_potato).',
    inputSchema: {
      type: 'object',
      properties: {
        route: { type: 'string', description: 'Route id or Chinese title keyword' },
      },
      required: ['route'],
    },
  },
  {
    name: 'search_culinary_atlas',
    description: 'Search cities, local specialties, dishes, flavor tags, migration routes, and culinary history milestones.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword such as "辣椒", "螺蛳粉", "苏轼", "清鲜"' },
        limit: { type: 'integer', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
];

function callTool(name, args = {}) {
  if (name === 'inspect_city_flavor') {
    const raw = String(args.city || '').trim();
    const q = raw.toLowerCase();
    const city = cities.find(
      (c) =>
        c.id.toLowerCase() === q ||
        c.name === raw ||
        c.name.split('·').some((part) => part.trim() === raw) ||
        (c.ancientName && c.ancientName.includes(raw)) ||
        c.pinyin.toLowerCase().split(' ').includes(q)
    );
    if (!city) return { error: `City not found: ${args.city}` };
    return { ...city, deepLink: `?city=${city.id}` };
  }

  if (name === 'inspect_food_route') {
    const q = String(args.route || '').trim().toLowerCase();
    const route = routes.find((r) => r.id.toLowerCase() === q || r.title.includes(args.route));
    if (!route) return { error: `Route not found: ${args.route}`, availableRoutes: routes.map((r) => r.id) };
    return { ...route, deepLink: `?route=${route.id}` };
  }

  if (name === 'search_culinary_atlas') {
    const hits = searchAtlas(searchIndex, args.query || '', args.limit || 10);
    return hits.map((h) => ({
      kind: h.kind,
      id: h.id,
      title: h.title,
      sub: h.sub,
      deepLink: h.kind === 'city' ? `?city=${h.id}` : h.kind === 'route' ? `?route=${h.id}` : `?year=${h.ref.year}`,
    }));
  }

  throw new Error(`Unknown tool: ${name}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
process.stdout.on('error', (err) => {
  if (err && err.code === 'EPIPE') process.exit(0);
});
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  const respond = (result) => {
    if (req.id !== undefined) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
    }
  };
  const fail = (code, message) => {
    if (req.id !== undefined) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code, message } }) + '\n');
    }
  };

  try {
    if (req.method === 'initialize') {
      respond({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'shiwei-atlas-mcp', version: '1.0.0' },
      });
    } else if (req.method === 'tools/list') {
      respond({ tools: TOOLS });
    } else if (req.method === 'tools/call') {
      const data = callTool(req.params?.name, req.params?.arguments);
      respond({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
    } else if (req.method === 'notifications/initialized') {
      // no-op
    } else {
      fail(-32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    fail(-32000, err.message);
  }
});
