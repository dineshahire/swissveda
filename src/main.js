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
function initSmoothScroll() {
  if (REDUCED) return; // honor reduced-motion: keep native scroll
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
  const stage = new Stage(canvas, { aspect, maxDPR: engine.maxDPR ?? 2 });

  // Apply the GPU unsharp pass only on the capable (hi) tier — keeps weak
  // mobile GPUs out of the per-frame convolution so they stay smooth.
  if (engine.tier === 'hi') canvas.classList.add('sharp');
  stage.tuneTexture(texture);
  stage.setTexture(texture);
  stage.resize();

  // small delay so the 100% reads, then reveal
  setTimeout(hideLoader, 350);

  initSmoothScroll();
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
  setupAnchorScroll();
}

// ── smooth in-page anchor scrolling via Lenis (falls back to native) ──────────
function setupAnchorScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.2 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ── secondary scroll-scrubbed clip in a content box ──────────────────────────
async function setupClip() {
  const el = document.getElementById('clip-canvas');
  if (!el || !CONFIG.clip) return;
  const clip = new ClipScrubber(el, CONFIG.clip);
  await clip.load();

  // scrub the clip across the .clip-stage spacer's scroll progress
  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => clip.scrub(self.progress),
  });

  // its own render loop — eases toward the scroll target each frame
  const tick = () => { clip.update(); requestAnimationFrame(tick); };
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
  ScrollTrigger.create({
    trigger: '.stage',
    start: 'top top',
    end: 'bottom bottom',
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

  // render loop — engine eases toward the scroll target each frame
  const tick = () => {
    const changed = engine.update();
    // sequence + videos return a texture to swap to; plain video returns a bool
    if (changed && changed !== true) stage.setTexture(changed);
    stage.render();
    requestAnimationFrame(tick);
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
  // generic fade-up for headings, copy, certs and footer blocks
  const fadeUp = document.querySelectorAll(
    '.eyebrow--center, .swiss-made, .tradition__copy p, .cert, .certs__note, ' +
    '.footer__brand-col, .footer__menu, .footer__contact'
  );
  fadeUp.forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: (i % 4) * 0.06,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
  });

  // product rows: packshot slides in from its side, info eases up + staggers
  document.querySelectorAll('.product').forEach((row) => {
    const reversed = row.classList.contains('product--reverse');
    const media = row.querySelector('.product__media');
    const shot = row.querySelector('.product__shot');
    const info = row.querySelectorAll('.product__info > *');

    // packshot wipes in from its side (clip-path) + soft fade → editorial reveal
    if (shot) {
      gsap.fromTo(shot,
        { opacity: 0, clipPath: reversed ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' },
        {
          opacity: 1, clipPath: 'inset(0 0 0 0)', duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: row, start: 'top 80%', once: true },
        });
    }
    // gentle parallax: the packshot drifts as the row scrolls past → depth
    if (media && !REDUCED) {
      gsap.fromTo(media,
        { yPercent: 10 },
        {
          yPercent: -10, ease: 'none',
          scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    }
    gsap.fromTo(info,
      { opacity: 0, y: 28 },
      {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05,
        scrollTrigger: { trigger: row, start: 'top 80%', once: true },
      });
  });
}

init();
