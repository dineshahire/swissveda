// ─────────────────────────────────────────────────────────────────────────
//  Three.js stage — a fullscreen plane under an orthographic camera.
//  The plane shows EITHER a VideoTexture (mode "video") or a swappable
//  CanvasTexture/Texture of the current frame (mode "sequence").
//
//  Quality handling (the whole point):
//   • pixelRatio clamped to 2 and refreshed on resize → crisp, not over-rendered
//   • the plane is scaled to COVER the viewport at any aspect ratio (object-fit:
//     cover) so there is never letterboxing or stretching
//   • LinearFilter min/mag, no mipmaps, sRGB, max anisotropy → no big-screen blur
// ─────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

export class Stage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{aspect:number}} opts  aspect = sourceWidth / sourceHeight of media
   */
  constructor(canvas, { aspect }) {
    this.canvas = canvas;
    this.mediaAspect = aspect;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    // Orthographic camera with a fixed -1..1 frustum; the plane is sized in
    // those same units, so "cover" math is just a scale on the mesh.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // unit plane, scaled later to cover
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  }

  /** Apply the shared high-quality texture settings used by both modes. */
  tuneTexture(texture) {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    return texture;
  }

  setTexture(texture) {
    // Only do the expensive work when the texture OBJECT actually changes.
    // The sequence engine reuses one texture and just swaps its .image +
    // bumps .needsUpdate per frame, so calling this every scrubbed frame must
    // NOT re-tune the texture or flag material.needsUpdate (that forces a
    // shader-program recompile every frame → GPU churn / scroll jank).
    if (this.material.map === texture) return;
    this.tuneTexture(texture); // first assignment only: match quality settings
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  /** Lets sequence mode update the media aspect if frames differ from video. */
  setMediaAspect(aspect) {
    this.mediaAspect = aspect;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const viewAspect = w / h;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);

    // COVER: scale the unit plane so the media fills the 2×2 frustum without
    // distortion, cropping the overflowing axis (just like object-fit: cover).
    let sx = 2, sy = 2;
    if (viewAspect > this.mediaAspect) {
      // viewport wider than media → match width, overflow height
      sy = 2 * (viewAspect / this.mediaAspect);
    } else {
      // viewport taller than media → match height, overflow width
      sx = 2 * (this.mediaAspect / viewAspect);
    }
    this.mesh.scale.set(sx, sy, 1);

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.geometry.dispose();
    this.material.dispose();
    if (this.material.map) this.material.map.dispose();
    this.renderer.dispose();
  }
}
