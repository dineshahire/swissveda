// ─────────────────────────────────────────────────────────────────────────
//  CanvasScrubber — scroll-scrubbed frame reel on a plain 2D <canvas>.
//  Why 2D canvas (not WebGL): the hero is just "show the frame for this scroll
//  position". A 2D drawImage of one held-in-RAM frame is hardware-accelerated,
//  has NO texture upload / VRAM / plane-cover quirks — so it can't overlap,
//  tear, flash, or evict. Smooth forward AND back on every device.
// ─────────────────────────────────────────────────────────────────────────

const CACHE_VER = 'c5'; // bump whenever frame sets are re-exported

export function pickTier() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const conn = nav.connection || {};
  const mem = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  const slowNet = conn.saveData === true || ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const smallScreen = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 820;
  const lowEnd =
    slowNet || (coarse && smallScreen) ||
    (typeof mem === 'number' && mem <= 2) ||
    (typeof cores === 'number' && cores <= 2);
  return lowEnd ? 'lo' : 'hi';
}

export class CanvasScrubber {
  /** @param {HTMLCanvasElement} canvas
   *  @param {{path,count,ext,pad,start}} cfg
   *  @param {{maxDPR?:number, conc?:number}} [opts] */
  constructor(canvas, cfg, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.count = cfg.count;
    this.maxDPR = opts.maxDPR ?? 1.5;
    this.conc = opts.conc ?? 10;

    this.frames = new Array(this.count); // idx -> ImageBitmap
    this.current = -1;
    this._target = 0; this._cur = 0;
    this._w = 0; this._h = 0;
    this._warned = false;

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(canvas.parentElement || canvas);
    }
  }

  _url(i) {
    const n = String(this.cfg.start + i).padStart(this.cfg.pad, '0');
    // ?v busts the immutable CDN/browser cache when a frame set is re-exported
    // under the same filenames (else stale old frames mix in → looks like overlap)
    return `${this.cfg.path}${n}.${this.cfg.ext}?v=${CACHE_VER}`;
  }

  async _decode(i) {
    try {
      const res = await fetch(this._url(i));
      const blob = await res.blob();
      return await createImageBitmap(blob); // 2D canvas: natural orientation, no flipY
    } catch (err) {
      if (!this._warned) { this._warned = true; console.warn(`[scrubber] decode failed (${this._url(i)})`, err); }
      return null;
    }
  }

  /** Size the canvas backing store to its displayed box × capped DPR. */
  _resize() {
    const box = this.canvas.parentElement || this.canvas;
    const rect = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this._w && h === this._h) return; // real change only → no scroll churn
    this._w = w; this._h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this._drawIdx(this.current >= 0 ? this.current : 0);
  }

  /** Draw frame `idx` with object-fit: cover. One image, fills canvas. */
  _drawIdx(idx) {
    const bmp = this.frames[idx];
    if (!bmp) return;
    const cw = this.canvas.width, ch = this.canvas.height;
    const iw = bmp.width, ih = bmp.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    this.ctx.drawImage(bmp, 0, 0, iw, ih, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  async load(onProgress) {
    let done = 0, next = 0;
    const worker = async () => {
      while (next < this.count) {
        const i = next++;
        this.frames[i] = await this._decode(i);
        done++;
        if (onProgress) onProgress(done / this.count);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.conc, this.count) }, worker));
    this._resize();
    const firstIdx = this.frames.findIndex(Boolean);
    if (firstIdx >= 0) { this.current = firstIdx; this._drawIdx(firstIdx); }
  }

  scrub(p) { this._target = Math.max(0, Math.min(p, 1)); }

  /** Ease toward target; draw the matching frame. Call once per rAF. */
  update() {
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;
    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));
    if (idx === this.current) return;
    if (!this.frames[idx]) return;
    this.current = idx;
    this._drawIdx(idx);
  }
}
