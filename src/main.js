// ─────────────────────────────────────────────────────────────────────────
//  VK Swiss — bootstrap (2D-canvas scroll-scrub)
//  • hero + clip are scroll-scrubbed frame reels drawn on a plain 2D <canvas>
//    (CanvasScrubber). No WebGL/three → no texture upload, VRAM, overlap, or
//    flash. Smooth forward AND back on every device.
//  • Lenis smooth scroll + GSAP ScrollTrigger drive the scrub + content reveals
// ─────────────────────────────────────────────────────────────────────────

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CONFIG } from './config.js';
import { CanvasScrubber, pickTier } from './scrubber.js';
import { mountLoaderLottie } from './lottie.js';

gsap.registerPlugin(ScrollTrigger);
// Fewer ScrollTrigger recalcs: ignore the mobile URL-bar resize storm, and snap
// work to the end of fast fling-scrolls instead of every intermediate frame.
ScrollTrigger.config({ ignoreMobileResize: true });

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;
function initSmoothScroll(enable = true) {
  if (REDUCED || !enable) return;
  // lerp (frame-rate-independent) feels "attached to the finger" on trackpads —
  // duration-based easing floats; lerp tracks input. 0.1 ≈ Apple's feel.
  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1,
    syncTouch: false,          // native touch on mobile = lighter, no fight
    touchInertiaMultiplier: 12,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Debounced refresh on real resize (not the scroll-driven svh jiggle).
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => ScrollTrigger.refresh(), 200);
  });
}

const $ = (sel) => document.querySelector(sel);
const loaderEl   = $('#loader');
const fillEl     = $('#loader-fill');
const pctEl      = $('#loader-pct');
const canvas     = $('#scene');
const captionsEl = $('#captions');
const hintEl     = $('#scroll-hint');

const captionNodes = CONFIG.captions.map((c) => {
  const el = document.createElement('div');
  el.className = 'caption';
  el.innerHTML = `<h3>${c.title}</h3><p>${c.sub}</p>`;
  captionsEl.appendChild(el);
  return { ...c, el };
});

function setProgress(p) {
  const pct = Math.round(Math.max(0, Math.min(p, 1)) * 100);
  fillEl.style.width = pct + '%';
  pctEl.textContent = pct;
}
const loaderAnim = mountLoaderLottie(document.getElementById('loader-lottie'));
function hideLoader() {
  loaderEl.classList.add('is-hidden');
  setTimeout(() => loaderAnim?.destroy(), 900); // after the fade completes
  gsap.from('.ui--header', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.1 });
}

const TIER = pickTier();
// Cap canvas pixel-ratio at 1 — a scroll-scrubbed video reel gains nothing
// from 1.5–2× DPR but pays a big per-frame fill cost. 1× = far smoother fill,
// imperceptible softness on moving footage.
const TIER_DPR = 1.0;

async function init() {
  const cfg = CONFIG.sequence.tiers[TIER] || CONFIG.sequence.tiers.hi;
  const hero = new CanvasScrubber(canvas, {
    path: cfg.path, count: cfg.count,
    ext: CONFIG.sequence.ext, pad: CONFIG.sequence.pad, start: CONFIG.sequence.start,
  }, { maxDPR: TIER_DPR });

  console.info(`[hero] tier=${TIER} (${cfg.path}, ${cfg.count} frames, 2D canvas)`);
  await hero.load(setProgress);
  setProgress(1);
  setTimeout(hideLoader, 350);

  initSmoothScroll(TIER !== 'lo');
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });

  if (REDUCED) {
    document.querySelector('.stage').style.height = '100vh';
    hintEl.style.display = 'none';
  } else {
    setupHeroScroll(hero);
  }

  setupClip();
  setupContentReveals();

  // header readability: white over the dark film, ink once the cream content
  // is under it
  const header = document.querySelector('.ui--header');
  ScrollTrigger.create({
    trigger: '.content',
    start: 'top 64px',
    endTrigger: '.section--footer', // footer is dark again → back to white there
    end: 'top 64px',
    onToggle: (self) => header.classList.toggle('on-light', self.isActive),
  });

  ScrollTrigger.refresh();
}

function setupHeroScroll(hero) {
  document.querySelector('.stage').style.height = `${CONFIG.scrollLengthVH * 100}vh`;

  // intro white-light reveal
  const flashEl = document.getElementById('intro-flash');
  const introTl = gsap.timeline({ delay: 1.3 });
  introTl
    .set(canvas, { scale: 1.14 })
    .set(flashEl, { opacity: 1 })
    .to(flashEl, { opacity: 0, duration: 2.6, ease: 'power2.inOut' }, 0)
    .to(canvas, { scale: 1.0, duration: 3.2, ease: 'power2.out' }, 0)
    .fromTo(captionNodes[0].el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' }, 1.4);

  let introDone = false;
  const endIntro = () => {
    if (introDone) return;
    introDone = true;
    introTl.kill();
    gsap.to(flashEl, { opacity: 0, duration: 0.3 });
    gsap.to(canvas, { scale: 1.0, duration: 0.4, ease: 'power2.out' });
  };

  let active = true;
  ScrollTrigger.create({
    trigger: '.stage',
    start: 'top top',
    end: 'bottom bottom',
    fastScrollEnd: true,        // settle cleanly after fast flings (no overrun jitter)
    invalidateOnRefresh: true,
    onToggle: (self) => { active = self.isActive; },
    onUpdate: (self) => {
      if (self.progress > 0.002) endIntro();
      hero.scrub(self.progress);
      updateCaptions(self.progress);
      hintEl.style.opacity = self.progress > 0.04 ? '0' : '1';
    },
  });

  const tick = () => {
    requestAnimationFrame(tick);
    if (active) hero.update();
  };
  requestAnimationFrame(tick);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { ScrollTrigger.refresh(); if (lenis) lenis.resize(); }
  });
}

function setupClip() {
  const el = document.getElementById('clip-canvas');
  if (!el || !CONFIG.clip) return;
  const clip = new CanvasScrubber(el, CONFIG.clip, { maxDPR: TIER_DPR });
  clip.load();

  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => clip.scrub(self.progress),
  });

  let active = false;
  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => { active = self.isActive; },
  });

  const tick = () => {
    requestAnimationFrame(tick);
    if (active) clip.update();
  };
  requestAnimationFrame(tick);
}

function updateCaptions(p) {
  const FADE = 0.12;
  captionNodes.forEach((c) => {
    const d = Math.abs(p - c.at);
    const vis = d < FADE ? 1 - d / FADE : 0;
    c.el.style.opacity = vis.toFixed(3);
    c.el.style.transform = `translateY(${(1 - vis) * 20}px)`;
  });
}

function setupContentReveals() {
  const targets = document.querySelectorAll('.section h2, .lede, .card, .stores, .btn, .footer__cols, .footer__brand');
  targets.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
}

init();
