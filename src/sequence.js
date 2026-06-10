// ─────────────────────────────────────────────────────────────────────────
//  Image-sequence engine — the site's hero.
//  Scroll-scrubbed frame reel rendered to a WebGL plane.
//
//  HOLD-ALL model (why scrubbing is smooth everywhere, both directions):
//   • The reel is a SMALL set of frames (≈140–180) — few enough to decode the
//     WHOLE thing into RAM once, up front, behind the loader.
//   • After that, scrubbing does ZERO fetching/decoding/eviction — every frame
//     swap is just `texture.image = alreadyDecodedBitmap`. So scrolling forward
//     AND back is instant; there is nothing to lag on, even on low-end devices
//     over a CDN. (The old on-demand window re-decoded evicted frames on
//     scroll-back, which was the lag.)
//   • A device tier picks resolution (720p desktop / 480p low) so RAM + decode
//     time stay sane everywhere.
// ─────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from './config.js';

// Per-tier render cap (decode concurrency + DPR). Frame COUNT/res come from
// CONFIG.sequence.tiers so the held set stays within a safe RAM budget.
const PROFILES = {
  hi: { MAXDPR: 1.5, CONC: 12 },  // a video reel doesn't need 2× DPR; 1.5 halves fill cost
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

  // GPU probe — only TRUE software rasterizers count as weak (NOT "Mesa", which
  // is the normal open-source driver for real Intel/AMD GPUs).
  let weakGPU = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) {
      weakGPU = true;
    } else {
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

    this.frames = new Array(this.count);   // idx -> ImageBitmap
    this.textures = new Array(this.count); // idx -> THREE.Texture (pre-uploaded)
    this.current = -1;
    this._target = 0;
    this._cur = 0;
    this.aspect = 16 / 9;
    this._warned = false;

    console.info(`[sequence] tier=${this.tier} (${this.path}, ${this.count} frames, hold-all)`);
  }

  _frameURL(i) {
    const n = String(CONFIG.sequence.start + i).padStart(CONFIG.sequence.pad, '0');
    return `${this.path}${n}.${CONFIG.sequence.ext}`;
  }

  async _decodeFrame(i) {
    try {
      const res = await fetch(this._frameURL(i));
      const blob = await res.blob();
      // flipY (paired with tex.flipY=false): ImageBitmap uploads with opposite
      // Y origin to HTMLImageElement, else the reel renders upside-down.
      return await createImageBitmap(blob, { imageOrientation: 'flipY' });
    } catch (err) {
      if (!this._warned) {
        this._warned = true;
        console.warn(`[sequence] frame decode failed (${this._frameURL(i)}).`, err);
      }
      return null;
    }
  }

  _makeTexture(bmp) {
    const tx = new THREE.Texture(bmp);
    tx.flipY = false; // ImageBitmap decoded with imageOrientation:'flipY'
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.minFilter = THREE.LinearFilter;
    tx.magFilter = THREE.LinearFilter;
    tx.generateMipmaps = false;
    tx.needsUpdate = true; // upload happens once (here / via renderer.initTexture)
    return tx;
  }

  /** Decode + build a GPU texture for EVERY frame up front; reports 0..1. */
  async load(onProgress) {
    let done = 0, next = 0;
    const worker = async () => {
      while (next < this.count) {
        const i = next++;
        const bmp = await this._decodeFrame(i);
        this.frames[i] = bmp;
        if (bmp) this.textures[i] = this._makeTexture(bmp);
        done++;
        if (onProgress) onProgress(done / this.count);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.conc, this.count) }, worker));

    const firstTx = this.textures.find(Boolean) || new THREE.Texture();
    const firstBmp = this.frames.find(Boolean);
    this.aspect = firstBmp ? firstBmp.width / firstBmp.height : 16 / 9;
    this.current = this.textures[0] ? 0 : -1;
    return { texture: this.textures[0] || firstTx, aspect: this.aspect };
  }

  scrub(progress) {
    this._target = Math.max(0, Math.min(progress, 1));
  }

  /** Ease toward the target; return the (already-uploaded) texture for the frame.
      No per-frame GPU upload → switching frames is essentially free. */
  update() {
    this._cur += (this._target - this._cur) * 0.18;
    if (Math.abs(this._target - this._cur) < 0.0005) this._cur = this._target;

    const idx = Math.min(this.count - 1, Math.max(0, Math.round(this._cur * (this.count - 1))));
    if (idx === this.current) return null;

    const tx = this.textures[idx];
    if (!tx) return null; // frame failed to decode → keep current
    this.current = idx;
    return tx;
  }

  kick() { /* pre-uploaded: nothing to re-prime */ }

  /** Fallback autoplay (reduced-motion): cycle the frames on a timer. */
  autoplayLoop(onFrame) {
    let i = 0;
    this._timer = setInterval(() => {
      i = (i + 1) % this.count;
      const tx = this.textures[i];
      if (tx) onFrame(tx);
    }, 1000 / 12);
  }
}
