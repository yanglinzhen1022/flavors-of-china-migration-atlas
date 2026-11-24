/**
 * Zero-dependency HTML5 Canvas Social Share Card Exporter (PNG).
 * Generates museum-parchment cards for Cities, Dual-City PK, and Personal Passport.
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const chars = Array.from(String(text || ''));
  let line = '';
  let drawn = 0;
  let curY = y;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      drawn += 1;
      if (drawn >= maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, curY);
        return curY + lineHeight;
      }
      ctx.fillText(line, x, curY);
      line = chars[i];
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

function drawRadar(ctx, cx, cy, R, scores, color, compareScores = null) {
  const axes = ['鲜', '辣', '酸', '甜', '醇'];
  const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;

  // Rings
  ctx.strokeStyle = '#d7cbb4';
  ctx.lineWidth = 1;
  for (let lvl = 1; lvl <= 5; lvl++) {
    const r = (R * lvl) / 5;
    ctx.beginPath();
    axes.forEach((_, i) => {
      const a = angleAt(i);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // Spokes & Labels
  ctx.font = '600 15px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#5c4e3b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  axes.forEach((ax, i) => {
    const a = angleAt(i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    ctx.strokeStyle = '#d7cbb4';
    ctx.stroke();
    ctx.fillText(ax, cx + (R + 20) * Math.cos(a), cy + (R + 20) * Math.sin(a));
  });

  const drawPoly = (sc, strokeColor, fillRgba, dashed = false) => {
    ctx.save();
    ctx.beginPath();
    axes.forEach((ax, i) => {
      const val = Math.max(0.4, sc[ax] ?? 1);
      const r = (R * val) / 5;
      const a = angleAt(i);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = fillRgba;
    ctx.fill();
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  };

  drawPoly(scores, color || '#b83b2b', 'rgba(184, 59, 43, 0.24)');
  if (compareScores) {
    drawPoly(compareScores, '#2f6b64', 'rgba(47, 107, 100, 0.18)', true);
  }
}

function createParchmentCanvas(w = 840, h = 1120) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Background paper
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, w, h);

  // Inner card border
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(28, 28, w - 56, h - 56);
  ctx.strokeStyle = '#d4c6ab';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.strokeStyle = '#e5dbc7';
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  // Seal badge
  ctx.fillStyle = '#b83b2b';
  ctx.fillRect(62, 62, 114, 38);
  ctx.fillStyle = '#fff9f2';
  ctx.font = '700 20px "Noto Serif SC", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('食味中国', 119, 81);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#756852';
  ctx.font = '500 15px "Noto Sans SC", sans-serif';
  ctx.fillText('中华风物与饮食迁徙图谱', w - 62, 81);

  return { canvas, ctx };
}

function downloadCanvas(canvas, filename) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportCityPoster(city, compareCity = null) {
  const { canvas, ctx } = createParchmentCanvas(840, 1120);
  const W = 840;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#b83b2b';
  ctx.font = '600 17px "Noto Sans SC", sans-serif';
  ctx.fillText(compareCity ? `双城味觉 PK · ${city.name} vs ${compareCity.name}` : `一城一味 · ${city.region} · ${city.province}`, 62, 126);

  ctx.fillStyle = '#1f2226';
  ctx.font = '700 44px "Noto Serif SC", "Songti SC", serif';
  ctx.fillText(compareCity ? `${city.name} × ${compareCity.name}` : city.name, 62, 158);

  ctx.fillStyle = '#2f6b64';
  ctx.font = '600 20px "Noto Sans SC", sans-serif';
  ctx.fillText(compareCity ? `${city.cuisineFamily}  vs  ${compareCity.cuisineFamily}` : city.cuisineFamily, 62, 218);

  // Tagline
  ctx.fillStyle = '#40372b';
  ctx.font = '500 20px "Noto Sans SC", sans-serif';
  wrapText(ctx, city.tagline, 62, 265, 450, 30, 4);

  // Radar
  drawRadar(ctx, 665, 295, 92, city.flavorScores, city.color, compareCity?.flavorScores || null);

  // Divider
  ctx.strokeStyle = '#dfd3bd';
  ctx.beginPath();
  ctx.moveTo(62, 425);
  ctx.lineTo(W - 62, 425);
  ctx.stroke();

  let curY = 448;
  ctx.fillStyle = '#222428';
  ctx.font = '700 20px "Noto Serif SC", serif';
  ctx.fillText('风土与地理密码', 62, curY);
  curY += 32;
  ctx.fillStyle = '#4a4033';
  ctx.font = '400 18px "Noto Sans SC", sans-serif';
  curY = wrapText(ctx, city.geoReason, 62, curY, W - 124, 28, 3);

  curY += 16;
  ctx.fillStyle = '#222428';
  ctx.font = '700 20px "Noto Serif SC", serif';
  ctx.fillText('地方风物与地理标志', 62, curY);
  curY += 34;

  for (const sp of city.specialties.slice(0, 3)) {
    ctx.fillStyle = '#f2eadb';
    ctx.fillRect(62, curY, W - 124, 88);
    ctx.strokeStyle = '#dfd3bd';
    ctx.strokeRect(62, curY, W - 124, 88);

    ctx.fillStyle = '#1f2226';
    ctx.font = '700 18px "Noto Sans SC", sans-serif';
    ctx.fillText(`${sp.name}${sp.gi ? '  [地理标志]' : ''}`, 78, curY + 14);
    ctx.fillStyle = '#b83b2b';
    ctx.font = '500 14px "Noto Sans SC", sans-serif';
    ctx.fillText(`${sp.category} · ${sp.era}`, 78, curY + 40);
    ctx.fillStyle = '#544a3c';
    ctx.font = '400 14.5px "Noto Sans SC", sans-serif';
    wrapText(ctx, sp.desc, 78, curY + 62, W - 156, 20, 1);
    curY += 102;
  }

  curY += 10;
  ctx.fillStyle = '#222428';
  ctx.font = '700 20px "Noto Serif SC", serif';
  ctx.fillText('代表名菜与小吃', 62, curY);
  curY += 32;
  ctx.fillStyle = '#2f6b64';
  ctx.font = '600 18px "Noto Sans SC", sans-serif';
  ctx.fillText(city.dishes.join('  ·  '), 62, curY);

  if (city.quote) {
    curY += 46;
    ctx.fillStyle = '#efe5d1';
    ctx.fillRect(62, curY, W - 124, 62);
    ctx.fillStyle = '#b83b2b';
    ctx.fillRect(62, curY, 5, 62);
    ctx.fillStyle = '#54422a';
    ctx.font = 'italic 16px "Noto Serif SC", serif';
    wrapText(ctx, city.quote, 80, curY + 18, W - 160, 24, 2);
  }

  // Footer
  ctx.fillStyle = '#7c705c';
  ctx.font = '400 14px "Noto Sans SC", sans-serif';
  ctx.fillText(`食味中国 · 点城寻味档案 (?city=${city.id})`, 62, 1055);
  ctx.textAlign = 'right';
  ctx.fillText('先秦两汉 — 当代中华饮食地理图谱', W - 62, 1055);

  downloadCanvas(canvas, `shiwei-${city.id}${compareCity ? `-vs-${compareCity.id}` : ''}.png`);
}

export function exportPassportPoster(cities, visitedIds, avgScores, tasteTitle, regionStats) {
  const { canvas, ctx } = createParchmentCanvas(840, 1120);
  const W = 840;
  const visitedSet = new Set(visitedIds);
  const litCities = cities.filter((c) => visitedSet.has(c.id));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#b83b2b';
  ctx.font = '600 18px "Noto Sans SC", sans-serif';
  ctx.fillText('个人中华美食探索档案 · 食味护照', 62, 126);

  ctx.fillStyle = '#1f2226';
  ctx.font = '700 40px "Noto Serif SC", serif';
  ctx.fillText(tasteTitle, 62, 160);

  ctx.fillStyle = '#2f6b64';
  ctx.font = '700 24px "Noto Sans SC", sans-serif';
  ctx.fillText(`已点亮 ${litCities.length} / ${cities.length} 座风味名城`, 62, 220);

  drawRadar(ctx, 665, 255, 92, avgScores, '#b83b2b');

  // Regional bars
  let ry = 285;
  for (const r of regionStats) {
    ctx.fillStyle = '#3f362a';
    ctx.font = '600 16px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.reg, 62, ry);

    ctx.fillStyle = '#e5dcc9';
    ctx.fillRect(114, ry + 5, 340, 11);
    const pct = r.total ? r.lit / r.total : 0;
    ctx.fillStyle = '#b83b2b';
    ctx.fillRect(114, ry + 5, Math.round(340 * pct), 11);

    ctx.fillStyle = '#6e6250';
    ctx.font = '500 14px "Noto Sans SC", sans-serif';
    ctx.fillText(`${r.lit}/${r.total}`, 468, ry + 2);
    ry += 32;
  }

  ctx.strokeStyle = '#dfd3bd';
  ctx.beginPath();
  ctx.moveTo(62, 535);
  ctx.lineTo(W - 62, 535);
  ctx.stroke();

  ctx.fillStyle = '#222428';
  ctx.font = '700 20px "Noto Serif SC", serif';
  ctx.fillText('已收集风味城市印章', 62, 558);

  // Draw stamps grid
  let sx = 62;
  let sy = 602;
  const colW = 172;
  const rowH = 56;
  const shown = litCities.slice(0, 28);
  shown.forEach((c, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const bx = sx + col * (colW + 12);
    const by = sy + row * (rowH + 10);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(bx, by, colW, rowH);
    ctx.strokeStyle = c.color || '#b83b2b';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, colW, rowH);

    ctx.fillStyle = '#1f2226';
    ctx.font = '700 17px "Noto Serif SC", serif';
    ctx.fillText(c.name, bx + 12, by + 10);
    ctx.fillStyle = '#6d6150';
    ctx.font = '400 12.5px "Noto Sans SC", sans-serif';
    ctx.fillText(`${c.province} · ${c.dishes[0]}`, bx + 12, by + 34);
  });

  if (litCities.length > 28) {
    ctx.fillStyle = '#6d6150';
    ctx.font = '500 15px "Noto Sans SC", sans-serif';
    ctx.fillText(`……及其他 ${litCities.length - 28} 座已点亮风味城市`, 62, 1020);
  }

  ctx.fillStyle = '#7c705c';
  ctx.font = '400 14px "Noto Sans SC", sans-serif';
  ctx.fillText('食味中国 · 中华风物与饮食迁徙图谱', 62, 1055);
  ctx.textAlign = 'right';
  ctx.fillText(`共点亮 ${litCities.length} 城`, W - 62, 1055);

  downloadCanvas(canvas, `shiwei-passport-${litCities.length}.png`);
}
