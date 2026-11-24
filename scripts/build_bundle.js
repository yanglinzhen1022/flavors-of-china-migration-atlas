#!/usr/bin/env node
/**
 * Build script for Shiwei Atlas (食味中国 · 中华风物与饮食迁徙图谱)
 * Zero external dependencies.
 * 1. Bundles data/cities/*.json -> data/cities_bundle.json
 * 2. Generates static SEO topic pages in topics/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CITIES_DIR = path.join(ROOT, 'data', 'cities');
const BUNDLE_PATH = path.join(ROOT, 'data', 'cities_bundle.json');
const ROUTES_PATH = path.join(ROOT, 'data', 'routes.json');
const TOPICS_DIR = path.join(ROOT, 'topics');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function loadCities() {
  const files = fs
    .readdirSync(CITIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(CITIES_DIR, file), 'utf8');
    return JSON.parse(raw);
  });
}

function renderTopicLayout({ title, desc, canonicalPath, bodyHtml }) {
  const baseUrl = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');
  const canonicalTag = baseUrl ? `\n  <link rel="canonical" href="${esc(`${baseUrl}/${canonicalPath}`)}" />` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · 食味中国</title>
  <meta name="description" content="${esc(desc)}" />${canonicalTag}
  <style>
    body { margin: 0; font-family: "Noto Serif SC", "Songti SC", Georgia, serif; background: #f4efe4; color: #222428; line-height: 1.75; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d9ceb8; padding-bottom: 12px; margin-bottom: 24px; font-size: 14px; }
    a { color: #b83b2b; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .cta { display: inline-block; background: #b83b2b; color: #fffaf2; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .cta:hover { background: #962c1e; text-decoration: none; }
    .tag { display: inline-block; background: #e8dfcd; color: #4d402c; padding: 2px 10px; border-radius: 99px; font-size: 12px; margin-right: 6px; }
    .card { background: #fbf8f1; border: 1px solid #ddd2bc; border-radius: 10px; padding: 16px 20px; margin: 14px 0; }
    h1 { font-size: 28px; margin: 8px 0 6px; }
    h2 { font-size: 19px; margin: 26px 0 10px; border-left: 3px solid #b83b2b; padding-left: 10px; }
    .quote { border-left: 3px solid #c78d3b; padding: 8px 14px; background: #f2ead8; margin: 16px 0; color: #54422a; font-style: italic; }
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="top-nav">
      <a href="../">← 返回「食味中国」交互舆图</a>
      <a href="./index.html">全部风物专题目录</a>
    </nav>
    ${bodyHtml}
  </div>
</body>
</html>
`;
}

function buildTopics(cities, routes) {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });

  // City topic pages
  for (const c of cities) {
    const specsHtml = c.specialties
      .map(
        (s) => `<div class="card">
        <strong>${esc(s.name)}</strong> <span class="tag">${esc(s.category)}</span> <span class="tag">${esc(s.era)}</span>${s.gi ? '<span class="tag">地理标志</span>' : ''}
        <p style="margin:6px 0 0">${esc(s.desc)}</p>
      </div>`
      )
      .join('\n');
    const tlHtml = c.timeline
      .map(
        (t) => `<div class="card">
        <strong>${t.year < 0 ? `前${-t.year}` : t.year}年 · ${esc(t.eraLabel)}</strong> — ${esc(t.title)}
        <p style="margin:6px 0 4px">${esc(t.detail)}</p>
        <small style="color:#6d6455">史料参考：${esc(t.source)}</small>
      </div>`
      )
      .join('\n');

    const html = renderTopicLayout({
      title: `${c.name}（${c.province}）风物志与千年饮食沿革`,
      desc: `${c.name}${c.cuisineFamily}风味密码、特色地理标志物产（${c.specialties.map((s) => s.name).join('、')}）与历史美食演变。`,
      canonicalPath: `topics/city-${c.id}.html`,
      bodyHtml: `
        <div><span class="tag">${esc(c.region)} · ${esc(c.province)}</span><span class="tag">${esc(c.cuisineFamily)}</span>${c.flavorTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <h1>${esc(c.name)}风物志 ${c.ancientName ? `<small style="font-size:16px;color:#786c58">（古称：${esc(c.ancientName)}）</small>` : ''}</h1>
        <p style="font-size:16px;color:#4a3f2f">${esc(c.tagline)}</p>
        <p><a class="cta" href="../?city=${esc(c.id)}">在交互地图中点亮「${esc(c.name)}」↗</a></p>
        <h2>风味地理密码</h2>
        <p>${esc(c.geoReason)}</p>
        ${c.quote ? `<div class="quote">${esc(c.quote)}</div>` : ''}
        <h2>地方风物与地理标志特产</h2>
        ${specsHtml}
        <h2>味觉千年演进</h2>
        ${tlHtml}
        <h2>代表菜肴与风味小吃</h2>
        <p>${c.dishes.map((d) => `<span class="tag">${esc(d)}</span>`).join('')}</p>
      `,
    });
    fs.writeFileSync(path.join(TOPICS_DIR, `city-${c.id}.html`), html, 'utf8');
  }

  // Route topic pages
  for (const r of routes) {
    const stopsHtml = r.stops
      .map(
        (s, i) => `<div class="card">
        <strong>第 ${i + 1} 站 · ${s.year < 0 ? `前${-s.year}` : s.year}年 · ${esc(s.place)}</strong> — ${esc(s.title)}
        <p style="margin:6px 0 4px">${esc(s.detail)}</p>
        ${s.quote ? `<div class="quote" style="margin:8px 0 0">${esc(s.quote)}</div>` : ''}
      </div>`
      )
      .join('\n');
    const html = renderTopicLayout({
      title: r.title,
      desc: r.summary,
      canonicalPath: `topics/route-${r.id}.html`,
      bodyHtml: `
        <div><span class="tag">${esc(r.category)}</span><span class="tag">${esc(r.span)}</span></div>
        <h1>${esc(r.title)}</h1>
        <p style="font-size:16px;color:#4a3f2f">${esc(r.subtitle)}</p>
        <p>${esc(r.summary)}</p>
        <p><a class="cta" href="../?route=${esc(r.id)}">在地图上回放这条迁徙路线 ↗</a></p>
        <h2>迁徙与风味节点</h2>
        ${stopsHtml}
      `,
    });
    fs.writeFileSync(path.join(TOPICS_DIR, `route-${r.id}.html`), html, 'utf8');
  }

  // Index topic page
  const indexHtml = renderTopicLayout({
    title: '中华风物与饮食迁徙专题目录',
    desc: `收录 ${cities.length} 座风味名城的地方特产、味觉千年史，以及 ${routes.length} 条物种与食客迁徙路线。`,
    canonicalPath: 'topics/index.html',
    bodyHtml: `
      <h1>食味中国 · 风物专题图志目录</h1>
      <p>共收录 <strong>${cities.length}</strong> 座代表性风味城市与 <strong>${routes.length}</strong> 条饮食迁徙路线。</p>
      <h2>一、饮食与物种迁徙路线（${routes.length} 条）</h2>
      <ul>${routes.map((r) => `<li><a href="./route-${esc(r.id)}.html"><strong>${esc(r.title)}</strong>（${esc(r.span)}）</a> — ${esc(r.subtitle)}</li>`).join('\n')}</ul>
      <h2>二、一城一味 · 地方风物志（${cities.length} 城）</h2>
      <ul>${cities.map((c) => `<li><a href="./city-${esc(c.id)}.html"><strong>${esc(c.name)}</strong>（${esc(c.province)} · ${esc(c.cuisineFamily)}）</a> — ${esc(c.dishes.slice(0, 3).join('、'))}</li>`).join('\n')}</ul>
    `,
  });
  fs.writeFileSync(path.join(TOPICS_DIR, 'index.html'), indexHtml, 'utf8');
}

export function buildAll() {
  const cities = loadCities();
  const routes = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
  const bundle = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: cities.length,
    cities,
  };
  fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  buildTopics(cities, routes);
  return { citiesCount: cities.length, routesCount: routes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = buildAll();
  console.log(`✓ Built cities_bundle.json (${res.citiesCount} cities) and ${res.citiesCount + res.routesCount + 1} SEO topic pages.`);
}
