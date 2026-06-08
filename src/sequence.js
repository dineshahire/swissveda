// ─────────────────────────────────────────────────────────────────────────
//  Image-sequence engine — the site's hero.
//  Scroll-scrubbed frame reel. Sharpest option on big screens — every pixel is
//  a real decoded JPG, never a re-sampled video frame.
//
//  MEMORY MODEL — sliding window (the whole point):
//   • We do NOT hold every frame decoded. A long 1080p/1440p reel decoded in
//     full is multiple GB of bitmaps → the tab OOM-crashes.
//   • Instead we keep only a small WINDOW of ImageBitmaps around the current
//     frame (ahead-biased for forward scroll) and close() the rest, so RAM is
//     bounded no matter how many frames or how high-res they are.
//   • Compressed JPEGs are cheap (img src), decode happens on demand into the
//     window with look-ahead prefetch so scrubbing stays smooth.
// ─────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from './config.js';

// Sliding-window sizes around the playhead. Prefetch is direction-aware so
// scrubbing UP is as smooth as scrubbing DOWN (LEAD = travel direction).
const LEAD = 30;   // prefetch ahead in the current scroll direction
const TRAIL = 24;  // prefetch behind — generous so a direction REVERSAL finds
                   // frames already decoded instead of stalling on re-decode
const WIN = 46;    // eviction half-window; keeps recently-passed frames cached
                   // (≈92 frames ~0.75GB @1080p) so back-scroll is instant
const MAX_INFLIGHT = 8; // concurrent decodes cap (faster catch-up on fast scrub)

export class SequenceEngine {
  constructor() {
    this.count = CONFIG.sequence.count;
    this.current = -1;
    this._target = 0;
    this._cur = 0;
    this._lastIdx = 0; // for scroll-direction detection
    this.aspect = 16 / 9;

    this.bitmaps = new Map();  // idx -> ImageBitmap (the live window)
    this.inflight = new Set(); // idx currently decoding
    this._queue = [];          // pending idx to decode (ordered by priority)
    this._queued = new Set();  // O(1) membership for _queue
    this._active = 0;          // running decodes
    this._warned = false;      // surface the first decode failure once
  }

  _frameURL(i) {
    const n = String(CONFIG.sequence.start + i).padStart(CONFIG.sequence.pad, '0');
    return `${CONFIG.sequence.path}${n}.${CONFIG.sequence.ext}`;
  }

  // Decode one frame into the window (returns a promise of the bitmap or null).
  async _decode(i) {
    if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.inflight.has(i)) return null;
    this.inflight.add(i);
    try {
      const res = await fetch(this._frameURL(i));
      const blob = await res.blob();
      // flipY here (paired with tex.flipY=false) — ImageBitmap uploads with the
      // opposite Y origin to HTMLImageElement, so without this the reel is upside-down.
      const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      this.bitmaps.set(i, bmp);
      return bmp;
    } catch (err) {
      if (!this._warned) {
        this._warned = true;
        console.warn(`[sequence] frame decode failed (${this._frameURL(i)}). Check CONFIG.sequence path/count.`, err);
      }
      return null;
    } finally {
      this.inflight.delete(i);
    }
  }

  // Throttled queue runner so a big jump doesn't fire hundreds of decodes.
  _enqueue(i) {
    if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.inflight.has(i) || this._queued.has(i)) return;
    this._queue.push(i);
    this._queued.add(i);
    this._pump();
  }

  _pump() {
    while (this._active < MAX_INFLIGHT && this._queue.length) {
      const i = this._queue.shift();
      this._queued.delete(i);
      this._active++;
      this._decode(i).finally(() => { this._active--; this._pump(); });
    }
  }

  // Drop bitmaps outside the window and free their GPU/CPU memory.
  _evict(idx) {
    const lo = idx - WIN, hi = idx + WIN;
    for (const [i, bmp] of this.bitmaps) {
      if (i < lo || i > hi) {
        bmp.close?.();
        this.bitmaps.delete(i);
      }
    }
    // also forget queued work that's now out of window
    this._queue = this._queue.filter((i) => {
      const keep = i >= lo && i <= hi;
      if (!keep) this._queued.delete(i);
      return keep;
    });
  }

  /** Preload the opening frames so the reveal isn't blank; reports 0..1. */
  async load(onProgress) {
    this.tex = new THREE.Texture();
    this.tex.flipY = false; // bitmaps are decoded with imageOrientation:'flipY' already
    // Decode a starter run sequentially so frame 0 is ready and the first
    // stretch of scroll has zero hitch. Rest stream in on demand.
    const PRELOAD = Math.min(48, this.count);
    for (let i = 0; i < PRELOAD; i++) {
      await this._decode(i);
      if (onProgress) onProgress((i + 1) / PRELOAD);
    }
    const first = this.bitmaps.get(0);
    this.aspect = first ? first.width / first.height : 16 / 9;
    if (first) { this.tex.image = first; this.tex.needsUpdate = true; }
    this.current = first ? 0 : -1;
    return { texture: this.tex, aspect: this.aspect };
  }

  scrub(progress) {
    this._target = Math.max(0, Math.min(progress, 1));
  }

  // Nearest already-decoded frame to idx (so we never flash blank on a jump).
  _nearest(idx) {
    if (this.bitmaps.has(idx)) return idx;
    for (let d = 1; d <= WIN; d++) {
      if (this.bitmaps.has(idx - d)) return idx - d;
      if (this.bitmaps.has(idx + d)) return idx + d;
    }
    return this.current; // fall back to whatever is on screen
  }

  /** Returns the texture to show this frame, or null if unchanged. */
  update() {
    // ease toward target so fast scrolls don't skip jarringly
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;

    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));

    // direction-aware prefetch: load most aggressively where the user is heading
    const dir = idx >= this._lastIdx ? 1 : -1;
    this._lastIdx = idx;
    const lead = dir > 0 ? LEAD : TRAIL;   // frames ahead (in travel dir)
    const trail = dir > 0 ? TRAIL : LEAD;  // frames behind

    // REBUILD the decode queue every frame in priority order (closest-needed
    // first). Without this the queue stays FIFO: on a direction reversal the
    // frames you now need sit BEHIND stale ones → the reel freezes until they
    // drain. Clearing + re-enqueueing nearest-first guarantees the frame you're
    // on (and its immediate neighbours) always decode next. In-flight decodes
    // continue; only the pending order is reset.
    this._queue.length = 0;
    this._queued.clear();
    this._enqueue(idx);
    const reach = Math.max(lead, trail);
    for (let d = 1; d <= reach; d++) {
      if (d <= lead) this._enqueue(idx + dir * d);   // closest in travel dir
      if (d <= trail) this._enqueue(idx - dir * d);  // then the other side
    }
    this._evict(idx);

    const show = this._nearest(idx);
    if (show < 0 || show === this.current) return null;
    const bmp = this.bitmaps.get(show);
    if (!bmp) return null;
    this.current = show;
    this.tex.image = bmp;
    this.tex.needsUpdate = true;
    return this.tex;
  }

  /** Re-prime decoder after a tab-visibility change. */
  kick() {
    const idx = Math.round(this._cur * (this.count - 1));
    this._enqueue(idx);
    for (let d = 1; d <= WIN; d++) { this._enqueue(idx + d); this._enqueue(idx - d); }
  }

  /** Fallback autoplay: cycle frames on a timer at ~12fps, decoding as it goes. */
  autoplayLoop(onFrame) {
    let i = 0;
    const fps = 12;
    this._timer = setInterval(async () => {
      i = (i + 1) % this.count;
      this._enqueue(i);
      for (let d = 1; d <= 6; d++) this._enqueue(i + d);
      this._evict(i);
      const bmp = this.bitmaps.get(i) || this.bitmaps.get(this._nearest(i));
      if (bmp) { this.tex.image = bmp; this.tex.needsUpdate = true; onFrame(this.tex); }
    }, 1000 / fps);
  }
}
