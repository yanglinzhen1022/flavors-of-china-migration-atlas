/**
 * Smooth SVG Camera Controller with rAF coalescing and deferred settle layout.
 * Inspired by Jiangshan Atlas camera-performance engineering.
 */
export class CameraController {
  constructor(svgEl, { width = 1000, height = 720, onUpdate, onSettle } = {}) {
    this.svg = svgEl;
    this.baseW = width;
    this.baseH = height;
    this.onUpdate = onUpdate || (() => {});
    this.onSettle = onSettle || (() => {});

    this.cam = { x: 0, y: 0, w: width, h: height, zoom: 1 };
    this._rafPending = false;
    this._settleTimer = null;
    this._animRaf = null;
    this._dragging = false;
    this._dragStart = null;
    this._didMove = false;
    this._cachedRect = null;
    this._pinch = null;

    this._applyViewBox();
    this._bindEvents();
  }

  invalidateRect() {
    this._cachedRect = null;
  }

  _getRect() {
    if (!this._cachedRect) {
      this._cachedRect = this.svg.getBoundingClientRect();
    }
    return this._cachedRect;
  }

  _applyViewBox() {
    const { x, y, w, h } = this.cam;
    this.svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  }

  _scheduleRender(isMoving = true) {
    if (isMoving) this.svg.classList.add('is-panning-zooming');
    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => {
        this._rafPending = false;
        this._applyViewBox();
        this.onUpdate(this.cam);
      });
    }
    clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => {
      this.svg.classList.remove('is-panning-zooming');
      this.onSettle(this.cam);
    }, 120);
  }

  clientToSvg(clientX, clientY) {
    const r = this._getRect();
    const rx = r.width > 0 ? (clientX - r.left) / r.width : 0.5;
    const ry = r.height > 0 ? (clientY - r.top) / r.height : 0.5;
    return [this.cam.x + rx * this.cam.w, this.cam.y + ry * this.cam.h];
  }

  zoomAt(factor, clientX, clientY) {
    this.stopAnimation();
    const nextZoom = Math.max(0.95, Math.min(7.5, this.cam.zoom * factor));
    const nextW = this.baseW / nextZoom;
    const nextH = this.baseH / nextZoom;

    const r = this._getRect();
    const rx = r.width > 0 ? (clientX - r.left) / r.width : 0.5;
    const ry = r.height > 0 ? (clientY - r.top) / r.height : 0.5;

    const anchorX = this.cam.x + rx * this.cam.w;
    const anchorY = this.cam.y + ry * this.cam.h;

    this.cam.zoom = nextZoom;
    this.cam.w = nextW;
    this.cam.h = nextH;
    this.cam.x = anchorX - rx * nextW;
    this.cam.y = anchorY - ry * nextH;
    this._clamp();
    this._scheduleRender(true);
  }

  _clamp() {
    const padX = this.baseW * 0.22;
    const padY = this.baseH * 0.22;
    this.cam.x = Math.max(-padX, Math.min(this.baseW + padX - this.cam.w, this.cam.x));
    this.cam.y = Math.max(-padY, Math.min(this.baseH + padY - this.cam.h, this.cam.y));
  }

  reset(animate = true) {
    const target = { x: 0, y: 0, w: this.baseW, h: this.baseH, zoom: 1 };
    if (animate) this.animateTo(target);
    else {
      this.cam = target;
      this._applyViewBox();
      this.onUpdate(this.cam);
      this.onSettle(this.cam);
    }
  }

  focusPoint(sx, sy, targetZoom = 2.4, xFrac = 0.44, yFrac = 0.48) {
    const w = this.baseW / targetZoom;
    const h = this.baseH / targetZoom;
    this.animateTo({
      x: sx - w * xFrac,
      y: sy - h * yFrac,
      w,
      h,
      zoom: targetZoom,
    });
  }

  focusBounds(points, padding = 95, xFrac = 0.47, yFrac = 0.48) {
    if (!points || points.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const spanX = Math.max(180, maxX - minX + padding * 2);
    const spanY = Math.max(140, maxY - minY + padding * 2);
    const zoom = Math.max(1, Math.min(3.5, Math.min(this.baseW / spanX, this.baseH / spanY)));
    const w = this.baseW / zoom;
    const h = this.baseH / zoom;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.animateTo({
      x: cx - w * xFrac,
      y: cy - h * yFrac,
      w,
      h,
      zoom,
    });
  }

  stopAnimation() {
    if (this._animRaf) {
      cancelAnimationFrame(this._animRaf);
      this._animRaf = null;
    }
  }

  animateTo(target, duration = 420) {
    this.stopAnimation();
    const start = { ...this.cam };
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const k = ease(p);
      this.cam.x = start.x + (target.x - start.x) * k;
      this.cam.y = start.y + (target.y - start.y) * k;
      this.cam.w = start.w + (target.w - start.w) * k;
      this.cam.h = start.h + (target.h - start.h) * k;
      this.cam.zoom = this.baseW / this.cam.w;
      this._clamp();
      this._applyViewBox();
      this.onUpdate(this.cam);
      if (p < 1) {
        this._animRaf = requestAnimationFrame(step);
      } else {
        this._animRaf = null;
        this.svg.classList.remove('is-panning-zooming');
        this.onSettle(this.cam);
      }
    };
    this.svg.classList.add('is-panning-zooming');
    this._animRaf = requestAnimationFrame(step);
  }

  wasDragged() {
    return this._didMove;
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.invalidateRect());

    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
        this.zoomAt(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    this.svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      this.stopAnimation();
      this._dragging = true;
      this._didMove = false;
      this._dragStart = {
        cx: e.clientX,
        cy: e.clientY,
        camX: this.cam.x,
        camY: this.cam.y,
      };
      this.invalidateRect();
    });

    // Touch pan & two-finger pinch zoom
    this.svg.addEventListener(
      'touchstart',
      (e) => {
        this.stopAnimation();
        this.invalidateRect();
        if (e.touches.length === 1) {
          this._pinch = null;
          this._dragging = true;
          this._didMove = false;
          this._dragStart = {
            cx: e.touches[0].clientX,
            cy: e.touches[0].clientY,
            camX: this.cam.x,
            camY: this.cam.y,
          };
        } else if (e.touches.length === 2) {
          this._dragging = false;
          const [t1, t2] = [e.touches[0], e.touches[1]];
          this._pinch = {
            dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1,
            cx: (t1.clientX + t2.clientX) / 2,
            cy: (t1.clientY + t2.clientY) / 2,
          };
        }
      },
      { passive: true }
    );

    this.svg.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this._pinch) {
          e.preventDefault();
          const [t1, t2] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
          const factor = dist / this._pinch.dist;
          this._pinch.dist = dist;
          this.zoomAt(factor, (t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
        } else if (e.touches.length === 1 && this._dragging && this._dragStart) {
          e.preventDefault();
          const dxPx = e.touches[0].clientX - this._dragStart.cx;
          const dyPx = e.touches[0].clientY - this._dragStart.cy;
          if (Math.hypot(dxPx, dyPx) > 4) this._didMove = true;
          const r = this._getRect();
          if (r.width <= 0 || r.height <= 0) return;
          this.cam.x = this._dragStart.camX - (dxPx / r.width) * this.cam.w;
          this.cam.y = this._dragStart.camY - (dyPx / r.height) * this.cam.h;
          this._clamp();
          this._scheduleRender(true);
        }
      },
      { passive: false }
    );

    this.svg.addEventListener('touchend', () => {
      this._pinch = null;
      this._dragging = false;
      this._dragStart = null;
      setTimeout(() => {
        this._didMove = false;
      }, 40);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this._dragging || !this._dragStart) return;
      const dxPx = e.clientX - this._dragStart.cx;
      const dyPx = e.clientY - this._dragStart.cy;
      if (Math.hypot(dxPx, dyPx) > 4) this._didMove = true;
      const r = this._getRect();
      if (r.width <= 0 || r.height <= 0) return;
      this.cam.x = this._dragStart.camX - (dxPx / r.width) * this.cam.w;
      this.cam.y = this._dragStart.camY - (dyPx / r.height) * this.cam.h;
      this._clamp();
      this._scheduleRender(true);
    });

    const endDrag = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this._dragStart = null;
      setTimeout(() => {
        this._didMove = false;
      }, 40);
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }
}
