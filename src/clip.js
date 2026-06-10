// ─────────────────────────────────────────────────────────────────────────
//  ClipScrubber — secondary scroll-scrubbed reel drawn into a 2D <canvas>.
//  HOLD-ALL model (same as the hero): the clip is a small set of frames,
//  decoded fully into RAM up front, then scrubbing is pure drawImage swaps —
//  zero runtime fetch/decode, so forward + back scroll never lags.
// ─────────────────────────────────────────────────────────────────────────

const CONC = 10;

export class ClipScrubber {
  /** @param {HTMLCanvasElement} canvas  @param {{path,count,ext,pad,start}} cfg */
  constructor(canvas, cfg) {
    this.ctx = canvas.getContext('2d');
    this.canvas = canvas;
    this.cfg = cfg;
    this.count = cfg.count;
    this.frames = new Array(this.count);
    this.current = -1;
    this._target = 0; this._cur = 0;
    this._warned = false;
  }

  _url(i) {
    const n = String(this.cfg.start + i).padStart(this.cfg.pad, '0');
    return `${this.cfg.path}${n}.${this.cfg.ext}`;
  }

  async _decode(i) {
    try {
      const res = await fetch(this._url(i));
      const blob = await res.blob();
      return await createImageBitmap(blob); // 2D canvas: no flipY needed
    } catch (err) {
      if (!this._warned) { this._warned = true; console.warn(`[clip] decode failed (${this._url(i)})`, err); }
      return null;
    }
  }

  async load() {
    let next = 0;
    const worker = async () => {
      while (next < this.count) { const i = next++; this.frames[i] = await this._decode(i); }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, this.count) }, worker));
    const first = this.frames.find(Boolean);
    if (first) { this.canvas.width = first.width; this.canvas.height = first.height; this._draw(this.frames[0] || first); this.current = 0; }
  }

  scrub(p) { this._target = Math.max(0, Math.min(p, 1)); }
  _draw(bmp) { this.ctx.drawImage(bmp, 0, 0, this.canvas.width, this.canvas.height); }

  update() {
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;
    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));
    if (idx === this.current) return;
    const bmp = this.frames[idx];
    if (!bmp) return;
    this.current = idx;
    this._draw(bmp);
  }
}
