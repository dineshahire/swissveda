// ─────────────────────────────────────────────────────────────────────────
//  ClipScrubber — a secondary scroll-scrubbed reel rendered into a 2D <canvas>
//  inside a content box (no WebGL needed for a small in-page clip).
//  Same sliding-window decode as the hero so it stays smooth + RAM-bounded on
//  every device: only a window of frames around the playhead is decoded, the
//  rest are close()d.
// ─────────────────────────────────────────────────────────────────────────

const LEAD = 18, TRAIL = 14, WIN = 26, INFLIGHT = 4;

export class ClipScrubber {
  /** @param {HTMLCanvasElement} canvas  @param {{path,count,ext,pad,start}} cfg */
  constructor(canvas, cfg) {
    this.ctx = canvas.getContext('2d');
    this.canvas = canvas;
    this.cfg = cfg;
    this.count = cfg.count;
    this.current = -1;
    this._target = 0; this._cur = 0; this._lastIdx = 0;

    this.bitmaps = new Map();
    this.inflight = new Set();
    this._queue = []; this._queued = new Set();
    this._active = 0; this._warned = false;
  }

  _url(i) {
    const n = String(this.cfg.start + i).padStart(this.cfg.pad, '0');
    return `${this.cfg.path}${n}.${this.cfg.ext}`;
  }

  async _decode(i) {
    if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.inflight.has(i)) return null;
    this.inflight.add(i);
    try {
      const res = await fetch(this._url(i));
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob); // 2D canvas: no flipY needed
      this.bitmaps.set(i, bmp);
      return bmp;
    } catch (err) {
      if (!this._warned) { this._warned = true; console.warn(`[clip] decode failed (${this._url(i)})`, err); }
      return null;
    } finally { this.inflight.delete(i); }
  }

  _enqueue(i) {
    if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.inflight.has(i) || this._queued.has(i)) return;
    this._queue.push(i); this._queued.add(i); this._pump();
  }
  _pump() {
    while (this._active < INFLIGHT && this._queue.length) {
      const i = this._queue.shift(); this._queued.delete(i); this._active++;
      this._decode(i).finally(() => { this._active--; this._pump(); });
    }
  }
  _evict(idx) {
    const lo = idx - WIN, hi = idx + WIN;
    for (const [i, bmp] of this.bitmaps) if (i < lo || i > hi) { bmp.close?.(); this.bitmaps.delete(i); }
    this._queue = this._queue.filter((i) => { const k = i >= lo && i <= hi; if (!k) this._queued.delete(i); return k; });
  }

  async load() {
    const PRELOAD = Math.min(20, this.count);
    for (let i = 0; i < PRELOAD; i++) await this._decode(i);
    const first = this.bitmaps.get(0);
    if (first) { this.canvas.width = first.width; this.canvas.height = first.height; this._draw(first); this.current = 0; }
  }

  scrub(p) { this._target = Math.max(0, Math.min(p, 1)); }

  _nearest(idx) {
    if (this.bitmaps.has(idx)) return idx;
    for (let d = 1; d <= WIN; d++) { if (this.bitmaps.has(idx - d)) return idx - d; if (this.bitmaps.has(idx + d)) return idx + d; }
    return this.current;
  }
  _draw(bmp) { this.ctx.drawImage(bmp, 0, 0, this.canvas.width, this.canvas.height); }

  update() {
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;
    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));

    // settled with a full window + nothing pending → skip the per-frame work
    if (this._cur === this._target && idx === this.current && this._queue.length === 0 && this._active === 0) return;

    const dir = idx >= this._lastIdx ? 1 : -1; this._lastIdx = idx;
    const lead = dir > 0 ? LEAD : TRAIL, trail = dir > 0 ? TRAIL : LEAD;
    this._queue.length = 0; this._queued.clear();
    this._enqueue(idx);
    const reach = Math.max(lead, trail);
    for (let d = 1; d <= reach; d++) { if (d <= lead) this._enqueue(idx + dir * d); if (d <= trail) this._enqueue(idx - dir * d); }
    this._evict(idx);

    const show = this._nearest(idx);
    if (show < 0 || show === this.current) return;
    const bmp = this.bitmaps.get(show);
    if (!bmp) return;
    this.current = show; this._draw(bmp);
  }
}
