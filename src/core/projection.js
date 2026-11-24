/**
 * Mercator projection & spherical distance utilities.
 */
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export class MercatorProjector {
  constructor(width = 1000, height = 720, bounds = { west: 72, east: 137, south: 17, north: 54.5 }) {
    this.width = width;
    this.height = height;
    this.bounds = bounds;
    this.xMin = this._mercX(bounds.west);
    this.xMax = this._mercX(bounds.east);
    this.yMin = this._mercY(bounds.north);
    this.yMax = this._mercY(bounds.south);
    const dx = this.xMax - this.xMin;
    const dy = this.yMax - this.yMin;
    const scaleX = width / dx;
    const scaleY = height / dy;
    this.scale = Math.min(scaleX, scaleY) * 0.94;
    this.offsetX = (width - dx * this.scale) / 2;
    this.offsetY = (height - dy * this.scale) / 2;
  }

  _mercX(lng) {
    return lng * DEG_TO_RAD;
  }

  _mercY(lat) {
    const clamped = Math.max(-85, Math.min(85, lat));
    return -Math.log(Math.tan(Math.PI / 4 + (clamped * DEG_TO_RAD) / 2));
  }

  toScreen(lng, lat) {
    const x = this.offsetX + (this._mercX(lng) - this.xMin) * this.scale;
    const y = this.offsetY + (this._mercY(lat) - this.yMin) * this.scale;
    return [x, y];
  }

  toGeo(sx, sy) {
    const mx = (sx - this.offsetX) / this.scale + this.xMin;
    const my = (sy - this.offsetY) / this.scale + this.yMin;
    const lng = mx * RAD_TO_DEG;
    const lat = (2 * Math.atan(Math.exp(-my)) - Math.PI / 2) * RAD_TO_DEG;
    return [lng, lat];
  }

  ringToPath(ring) {
    if (!ring || ring.length < 2) return '';
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = this.toScreen(ring[i][0], ring[i][1]);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  }

  lineToPath(coords) {
    if (!coords || coords.length < 2) return '';
    let d = '';
    for (let i = 0; i < coords.length; i++) {
      const [x, y] = this.toScreen(coords[i][0], coords[i][1]);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  }

  greatCircleKm(c1, c2) {
    const [lng1, lat1] = c1;
    const [lng2, lat2] = c2;
    const R = 6371;
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLng = (lng2 - lng1) * DEG_TO_RAD;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
