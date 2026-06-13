// ─────────────────────────────────────────────────────────────────────────
//  CanvasScrubber — scroll-scrubbed frame reel on a plain 2D <canvas>.
//  Why 2D canvas (not WebGL): the hero is just "show the frame for this scroll
//  position". A 2D drawImage of one held-in-RAM frame is hardware-accelerated,
//  has NO texture upload / VRAM / plane-cover quirks — so it can't overlap,
//  tear, flash, or evict. Smooth forward AND back on every device.
// ─────────────────────────────────────────────────────────────────────────

const CACHE_VER = 'c11'; // bump whenever frame sets are re-exported

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
    this._target = 0; this._cur = 0; this._drawn = -1;
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
    this._drawAt(this._cur); // redraw current position into the new size
  }

  /** Draw one bitmap, object-fit: cover, at the given alpha. */
  _blit(bmp, alpha) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const iw = bmp.width, ih = bmp.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(bmp, 0, 0, iw, ih, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /** Draw at a FRACTIONAL position t (0..1), cross-fading the two nearest
     frames so slow scrolling glides smoothly instead of stepping. */
  _drawAt(t) {
    const max = this.count - 1;
    const f = Math.max(0, Math.min(t, 1)) * max;
    const i0 = Math.floor(f);
    const i1 = Math.min(max, i0 + 1);
    const frac = f - i0;
    const a = this.frames[i0], b = this.frames[i1];
    if (!a && !b) return;
    if (a) this._blit(a, 1);            // base frame, opaque
    if (b && frac > 0.004) this._blit(b, frac); // next frame faded in by frac
    this.ctx.globalAlpha = 1;
  }
  _drawIdx(idx) { this._drawAt(idx / (this.count - 1)); }

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
    this._drawAt(0); // open on the first frame
  }

  scrub(p) { this._target = Math.max(0, Math.min(p, 1)); }

  /** Draw the frame for the current scroll position. Call once per rAF.
     Tracks the scroll target DIRECTLY (no internal easing) — Lenis already
     smooths the scroll value, so a second lerp here just made the frame trail
     the finger = the "lag" feeling. Direct = buttery + attached. */
  update() {
    this._cur = this._target;
    if (this._cur === this._drawn) return; // nothing moved → skip
    this._drawn = this._cur;
    this._drawAt(this._cur);
  }
}
