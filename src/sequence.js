// ─────────────────────────────────────────────────────────────────────────
//  Image-sequence engine — the site's hero.
//  Scroll-scrubbed frame reel rendered to a WebGL plane.
//
//  SINGLE-TEXTURE HOLD-ALL (why it's smooth + flicker-free everywhere):
//   • Decode the WHOLE reel into RAM once (ImageBitmaps) behind the loader.
//   • Keep ONE GPU texture; per frame we just swap its .image. Only ~one frame
//     ever lives on the GPU, so weak/Safari GPUs never run out of VRAM and
//     never evict+re-upload mid-scroll (that eviction was the flash + lag).
//   • Lighter resolution per tier keeps the per-frame upload tiny (≈1ms) so
//     scrubbing is smooth forward AND back, even on low devices.
// ─────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from './config.js';

const PROFILES = {
  hi: { MAXDPR: 1.5, CONC: 12 },
  lo: { MAXDPR: 1.0, CONC: 8 },
};

function pickTier() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const conn = nav.connection || {};
  const mem = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  const slowNet = conn.saveData === true || ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const smallScreen = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 820;

  let weakGPU = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) weakGPU = true;
    else {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software|microsoft basic|basic render/i.test(r)) weakGPU = true;
    }
  } catch { weakGPU = true; }

  const lowEnd =
    weakGPU || slowNet || (coarse && smallScreen) ||
    (typeof mem === 'number' && mem <= 2) ||
    (typeof cores === 'number' && cores <= 2);

  return lowEnd ? 'lo' : 'hi';
}

export class SequenceEngine {
  constructor() {
    const tiers = CONFIG.sequence.tiers;
    const picked = pickTier();
    this.tier = tiers[picked] ? picked : 'hi';
    const t = tiers[this.tier];
    const p = PROFILES[this.tier];

    this.path = t.path;
    this.count = t.count;
    this.maxDPR = p.MAXDPR;
    this.conc = p.CONC;

    this.frames = new Array(this.count); // idx -> ImageBitmap (held in RAM)
    this.current = -1;
    this._target = 0;
    this._cur = 0;
    this.aspect = 16 / 9;
    this._warned = false;

    console.info(`[sequence] tier=${this.tier} (${this.path}, ${this.count} frames, single-texture)`);
  }

  _frameURL(i) {
    const n = String(CONFIG.sequence.start + i).padStart(CONFIG.sequence.pad, '0');
    return `${this.path}${n}.${CONFIG.sequence.ext}`;
  }

  async _decodeFrame(i) {
    try {
      const res = await fetch(this._frameURL(i));
      const blob = await res.blob();
      return await createImageBitmap(blob, { imageOrientation: 'flipY' });
    } catch (err) {
      if (!this._warned) {
        this._warned = true;
        console.warn(`[sequence] frame decode failed (${this._frameURL(i)}).`, err);
      }
      return null;
    }
  }

  /** Decode the whole reel into RAM up front; reports 0..1. */
  async load(onProgress) {
    this.tex = new THREE.Texture();
    this.tex.flipY = false;                 // bitmaps decoded with imageOrientation:'flipY'
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;

    let done = 0, next = 0;
    const worker = async () => {
      while (next < this.count) {
        const i = next++;
        this.frames[i] = await this._decodeFrame(i);
        done++;
        if (onProgress) onProgress(done / this.count);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.conc, this.count) }, worker));

    const first = this.frames.find(Boolean) || null;
    this.aspect = first ? first.width / first.height : 16 / 9;
    if (first) { this.tex.image = this.frames[0] || first; this.tex.needsUpdate = true; this.current = 0; }
    return { texture: this.tex, aspect: this.aspect };
  }

  scrub(progress) { this._target = Math.max(0, Math.min(progress, 1)); }

  /** Ease toward target; swap the single texture's image to that frame. */
  update() {
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;

    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));
    if (idx === this.current) return null;

    const bmp = this.frames[idx];
    if (!bmp) return null;
    this.current = idx;
    this.tex.image = bmp;
    this.tex.needsUpdate = true; // re-upload this one small frame (~1ms)
    return this.tex;
  }

  kick() { /* nothing to re-prime */ }

  autoplayLoop(onFrame) {
    let i = 0;
    this._timer = setInterval(() => {
      i = (i + 1) % this.count;
      const bmp = this.frames[i];
      if (bmp) { this.tex.image = bmp; this.tex.needsUpdate = true; onFrame(this.tex); }
    }, 1000 / 12);
  }
}
