// ─────────────────────────────────────────────────────────────────────────
//  VK Swiss — bootstrap
//  • runs the image-sequence engine (scroll-scrubbed JPG frame reel)
//  • shows loading screen w/ progress until the opening frames are ready
//  • pins the film stage and scrubs it with GSAP ScrollTrigger
//  • drives scroll-synced captions + reveal-on-scroll for content
//  • falls back to autoplay-loop when scrubbing isn't appropriate
// ─────────────────────────────────────────────────────────────────────────

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CONFIG } from './config.js';
import { Stage } from './scene.js';
import { SequenceEngine } from './sequence.js';
import { ClipScrubber } from './clip.js';

gsap.registerPlugin(ScrollTrigger);

// Always open at the very top so the film starts on frame 0, not wherever the
// browser restored the previous scroll position to (that showed a mid-video frame).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ── Lenis smooth scroll ──────────────────────────────────────────────────────
// Inertia-based scrolling that feels premium and removes native scroll jank.
// We drive it from GSAP's ticker and tell ScrollTrigger to update on each Lenis
// frame so the scrub stays perfectly in sync.
let lenis = null;
function initSmoothScroll(enable = true) {
  // Skip Lenis on reduced-motion AND on the low tier — its per-frame rAF
  // smoothing is extra work weak CPUs don't need; native scroll is lighter
  // and ScrollTrigger still drives the scrub fine.
  if (REDUCED || !enable) return;
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
    smoothWheel: true,
    syncTouch: false, // native touch on mobile = better battery + no fight
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const $ = (sel) => document.querySelector(sel);

// ── DOM handles ────────────────────────────────────────────────────────────
const loaderEl   = $('#loader');
const fillEl     = $('#loader-fill');
const pctEl      = $('#loader-pct');
const canvas     = $('#scene');
const captionsEl = $('#captions');
const hintEl     = $('#scroll-hint');

// Use autoplay-loop fallback when the user prefers reduced motion.
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── build caption DOM from CONFIG ───────────────────────────────────────────
const captionNodes = CONFIG.captions.map((c) => {
  const el = document.createElement('div');
  el.className = 'caption';
  el.innerHTML = `<h3>${c.title}</h3><p>${c.sub}</p>`;
  captionsEl.appendChild(el);
  return { ...c, el };
});

// ── loading-screen progress ─────────────────────────────────────────────────
function setProgress(p) {
  const pct = Math.round(Math.max(0, Math.min(p, 1)) * 100);
  fillEl.style.width = pct + '%';
  pctEl.textContent = pct;
}

function hideLoader() {
  loaderEl.classList.add('is-hidden');
  // entrance for header + first content reveal
  gsap.from('.ui--header', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.1 });
}

// ── main ────────────────────────────────────────────────────────────────────
async function init() {
  const engine = new SequenceEngine();

  // load media with progress feedback
  let texture, aspect;
  try {
    ({ texture, aspect } = await engine.load(setProgress));
    setProgress(1);
  } catch (err) {
    console.error('Media failed to load:', err);
    // still reveal so the page isn't stuck on the loader
    hideLoader();
    return;
  }

  // build the Three.js stage now that we know the media aspect ratio.
  // engine.maxDPR caps render resolution per device tier (lower on phones).
  // If WebGL is unavailable (very old / locked-down device), fall back to a
  // static poster of the first frame so the site still WORKS instead of blanking.
  let stage;
  try {
    stage = new Stage(canvas, { aspect, maxDPR: engine.maxDPR ?? 2 });
  } catch (err) {
    console.warn('WebGL unavailable → static poster fallback:', err);
    posterFallback(canvas, engine);
    hideLoader();
    setupContentReveals();
    setupClip();
    return;
  }

  // NOTE: the SVG unsharp pass (#scene.sharp) is intentionally NOT applied — a
  // per-frame full-screen feConvolveMatrix is too GPU-heavy and made scrubbing
  // lag. The cheap CSS colour grade stays; sharpness comes from the 1080p frames.
  stage.preupload(engine.textures); // push every frame to the GPU up front
  stage.setTexture(texture);
  stage.resize();
  // re-fit after layout settles (catches the Chrome "half frame" case)
  requestAnimationFrame(() => stage.resize());
  setTimeout(() => stage.resize(), 200);

  // small delay so the 100% reads, then reveal
  setTimeout(hideLoader, 350);

  initSmoothScroll(engine.tier !== 'lo');
  // snap to top so the reveal starts on the first frame
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });
  ScrollTrigger.refresh();

  if (REDUCED) {
    startAutoplay(engine, stage);
  } else {
    startScrub(engine, stage);
  }

  setupContentReveals();
  setupClip();
}

// ── static poster when WebGL can't run (graceful degrade, no blank screen) ────
function posterFallback(canvas, engine) {
  canvas.style.display = 'none';
  const poster = document.createElement('img');
  poster.src = engine._frameURL(0);
  poster.alt = '';
  poster.className = 'poster-fallback';
  canvas.parentElement.appendChild(poster);
}

// ── secondary scroll-scrubbed clip in a content box ──────────────────────────
async function setupClip() {
  const el = document.getElementById('clip-canvas');
  if (!el || !CONFIG.clip) return;
  const clip = new ClipScrubber(el, CONFIG.clip);
  await clip.load();

  // scrub the clip across the .clip-stage spacer's pinned scroll progress
  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => clip.scrub(self.progress),
  });

  // separate activation window (a viewport early/late) so the render loop only
  // runs near the clip — frames are warm before it's visible, idle otherwise.
  let clipActive = false;
  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => { clipActive = self.isActive; },
  });

  // its own render loop — eases toward the scroll target each frame
  const tick = () => {
    requestAnimationFrame(tick);
    if (clipActive) clip.update();
  };
  requestAnimationFrame(tick);

  // keep the scrub mapping correct after layout shifts
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ScrollTrigger.refresh(); });
}

// ── scroll-scrub mode ────────────────────────────────────────────────────────
function startScrub(engine, stage) {
  const stage_h = CONFIG.scrollLengthVH; // viewport-heights of scroll

  // give the spacer section its scroll length
  const stageEl = document.querySelector('.stage');
  stageEl.style.height = `${stage_h * 100}vh`;

  // a single proxy object we animate; its .p (0..1) drives the engine
  const proxy = { p: 0 };

  // ── INTRO effect: WHITE LIGHT REVEAL (before any scroll) ──────────────────
  // The scene blooms in from a warm-white light: the flash overlay fades out
  // while the canvas eases down from a slight zoom and the first caption rises
  // in. Feels like the film "developing" from light. Killed on first scroll.
  const flashEl = document.getElementById('intro-flash');
  // delay = wait for the loader to finish hiding (350ms hold + 800ms fade)
  // so the white reveal plays in full view, not hidden behind the black loader.
  const introTl = gsap.timeline({ delay: 1.3 });
  introTl
    .set(canvas, { scale: 1.14 })
    .set(flashEl, { opacity: 1 })
    .to(flashEl, { opacity: 0, duration: 2.6, ease: 'power2.inOut' }, 0)   // white → scene
    .to(canvas, { scale: 1.0, duration: 3.2, ease: 'power2.out' }, 0)       // settle zoom
    .fromTo(captionNodes[0].el,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' }, 1.4);

  let introDone = false;
  const endIntro = () => {
    if (introDone) return;
    introDone = true;
    introTl.kill();
    gsap.to(flashEl, { opacity: 0, duration: 0.3 });
    gsap.to(canvas, { scale: 1.0, duration: 0.4, ease: 'power2.out' });
  };

  // NOTE: pinning is done with native CSS `position: sticky` on .sticky (see
  // style.css). ScrollTrigger here only reads scroll progress — using GSAP's
  // own pin on top of CSS sticky would fight it. .stage is the tall spacer.
  // Only run the hero render loop while the film stage is actually on screen.
  // Once you scroll into the content (hero covered by .content), rendering it is
  // wasted GPU that competes with the clip reel — pausing keeps everything smooth.
  let heroActive = true;
  ScrollTrigger.create({
    trigger: '.stage',
    start: 'top top',
    end: 'bottom bottom',
    onToggle: (self) => { heroActive = self.isActive; },
    onUpdate: (self) => {
      if (self.progress > 0.002) endIntro(); // hand off from intro to scrub
      proxy.p = self.progress;
      engine.scrub(self.progress);
      updateCaptions(self.progress);
      // fade the scroll hint out almost immediately
      hintEl.style.opacity = self.progress > 0.04 ? '0' : '1';
    },
  });

  // Tab-switch recovery: hidden tabs suspend video decode + throttle rAF, which
  // leaves the film frozen on a stale frame when you return. On re-show, refresh
  // ScrollTrigger and re-prime the decoder so scrubbing is live again.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    ScrollTrigger.refresh();
    if (lenis) lenis.resize();
    if (typeof engine.kick === 'function') engine.kick();
  });

  // render loop — engine eases toward the scroll target each frame.
  // Runtime quality guard: if frames are consistently slow (weak GPU we can't
  // detect up front), step the pixel-ratio down so scrubbing stays smooth.
  let last = performance.now(), slow = 0, seen = 0, steps = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!heroActive) { last = performance.now(); return; } // hero off-screen → idle
    const now = performance.now();
    const dt = now - last; last = now;
    const changed = engine.update();
    if (changed && changed !== true) stage.setTexture(changed);
    stage.render();

    if (dt > 24) slow++;            // slower than ~42fps
    if (++seen >= 90) {             // every ~1.5s of active frames
      if (steps < 2 && slow > seen * 0.35) {
        steps++;
        stage.setDPR(Math.max(1, stage.maxDPR * 0.7));
        console.info(`[perf] scrub slow → pixelRatio cap ↓ to ${stage.maxDPR.toFixed(2)}`);
      }
      slow = 0; seen = 0;
    }
  };
  requestAnimationFrame(tick);
}

// ── fallback autoplay-loop mode ──────────────────────────────────────────────
function startAutoplay(engine, stage) {
  // collapse the long scroll spacer to one screen — no scrubbing needed
  document.querySelector('.stage').style.height = '100vh';
  hintEl.style.display = 'none';

  engine.autoplayLoop((tex) => stage.setTexture(tex));
  const tick = () => { stage.render(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // show all captions softly cycling? keep it simple: show the last one.
  gsap.to(captionNodes[captionNodes.length - 1].el, { opacity: 1, y: 0, duration: 1.2, delay: 0.6 });
}

// ── captions cross-fade synced to scroll progress ───────────────────────────
function updateCaptions(p) {
  const FADE = 0.12; // half-width of each caption's visible window
  captionNodes.forEach((c) => {
    const d = Math.abs(p - c.at);
    const vis = d < FADE ? 1 - d / FADE : 0;
    c.el.style.opacity = vis.toFixed(3);
    c.el.style.transform = `translateY(${(1 - vis) * 20}px)`;
  });
}

// ── reveal content sections on scroll ────────────────────────────────────────
function setupContentReveals() {
  const targets = document.querySelectorAll('.section h2, .lede, .card, .stores, .btn, .footer__cols, .footer__brand');
  targets.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
  });
}

init();
