// ─────────────────────────────────────────────────────────────────────────
//  VK Swiss — bootstrap (real <video> scroll-scrub)
//  • hero + clip are actual muted <video> elements; scroll position drives
//    video.currentTime (eased) so the footage plays/reverses with the scroll
//  • no frame-image canvas — the browser decodes the video, which is smooth
//    and light on every device (hardware video decode)
//  • Lenis smooth scroll + GSAP ScrollTrigger drive the scrub & content reveals
// ─────────────────────────────────────────────────────────────────────────

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CONFIG } from './config.js';

gsap.registerPlugin(ScrollTrigger);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;
function initSmoothScroll() {
  if (REDUCED) return;
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
    syncTouch: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const $ = (sel) => document.querySelector(sel);
const loaderEl   = $('#loader');
const fillEl     = $('#loader-fill');
const pctEl      = $('#loader-pct');
const heroVideo  = $('#hero-video');
const captionsEl = $('#captions');
const hintEl     = $('#scroll-hint');

// build captions from CONFIG
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
function hideLoader() {
  loaderEl.classList.add('is-hidden');
  gsap.from('.ui--header', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.1 });
}

// ── video scrubber: eases video.currentTime toward the scroll target ─────────
const COARSE = window.matchMedia('(pointer: coarse)').matches;
function makeScrubber(video) {
  let target = 0, cur = 0, active = true, primed = false;
  const ready = () => video.readyState >= 1 && video.duration > 0;

  // Only TOUCH devices need a play()/pause() to unlock currentTime seeking;
  // on desktop calling play() just makes the clip lurch forward on first scroll
  // (the "wrong frame on open" bug). Re-seek to target right after.
  const prime = () => {
    if (primed || !COARSE) { primed = true; return; }
    primed = true;
    const p = video.play();
    if (p && p.then) p.then(() => { video.pause(); video.currentTime = cur * video.duration; }).catch(() => {});
  };

  const STEP = 1 / 15; // source is 15fps → don't seek finer than one frame
  let lastT = -1;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!active || !ready()) return;
    cur += (target - cur) * 0.15;
    if (Math.abs(target - cur) < 0.0004) cur = target;
    const t = cur * video.duration;
    // only seek when: last seek finished AND we've moved at least one frame.
    // fastSeek (Safari/FF) jumps to the nearest keyframe instantly — and since
    // the video is all-intra, every frame IS a keyframe, so backward scrubbing
    // is as quick as forward. Chrome lacks fastSeek → fall back to currentTime.
    if (!video.seeking && Math.abs(t - lastT) >= STEP) {
      lastT = t;
      try {
        if (typeof video.fastSeek === 'function') video.fastSeek(t);
        else video.currentTime = t;
      } catch {}
    }
  };
  requestAnimationFrame(tick);

  return {
    scrub: (p) => { target = Math.max(0, Math.min(p, 1)); prime(); },
    setActive: (a) => { active = a; },
  };
}

// Wait until the video is FULLY buffered (progress bar runs to a real 100%),
// then reveal — so scrubbing never stalls on un-downloaded footage.
function waitForVideo(video, onProgress) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; onProgress(1); resolve(); } };
    const check = () => {
      if (video.duration && video.buffered.length) {
        const end = video.buffered.end(video.buffered.length - 1);
        const p = end / video.duration;
        onProgress(Math.min(0.99, p));
        if (p >= 0.999) finish(); // whole clip downloaded → safe to enter
      }
    };
    video.addEventListener('progress', check);
    video.addEventListener('loadeddata', check, { once: true });
    video.addEventListener('canplaythrough', check);
    video.addEventListener('error', finish, { once: true });
    setTimeout(finish, 30000); // safety: never hang forever on a flaky network
    video.load();
  });
}

async function init() {
  await waitForVideo(heroVideo, setProgress);
  try { heroVideo.currentTime = 0; } catch {} // always open on the first frame
  setProgress(1);
  setTimeout(hideLoader, 350);

  initSmoothScroll();
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });

  if (REDUCED) {
    // reduced motion: just loop the footage, no scrub
    document.querySelector('.stage').style.height = '100vh';
    hintEl.style.display = 'none';
    heroVideo.loop = true;
    heroVideo.play().catch(() => {});
  } else {
    setupHeroScroll();
  }

  setupClip();
  setupContentReveals();
  ScrollTrigger.refresh();
}

function setupHeroScroll() {
  document.querySelector('.stage').style.height = `${CONFIG.scrollLengthVH * 100}vh`;
  const hero = makeScrubber(heroVideo);

  // intro white-light reveal
  const flashEl = document.getElementById('intro-flash');
  const introTl = gsap.timeline({ delay: 1.3 });
  introTl
    .set(heroVideo, { scale: 1.14 })
    .set(flashEl, { opacity: 1 })
    .to(flashEl, { opacity: 0, duration: 2.6, ease: 'power2.inOut' }, 0)
    .to(heroVideo, { scale: 1.0, duration: 3.2, ease: 'power2.out' }, 0)
    .fromTo(captionNodes[0].el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' }, 1.4);

  let introDone = false;
  const endIntro = () => {
    if (introDone) return;
    introDone = true;
    introTl.kill();
    gsap.to(flashEl, { opacity: 0, duration: 0.3 });
    gsap.to(heroVideo, { scale: 1.0, duration: 0.4, ease: 'power2.out' });
  };

  ScrollTrigger.create({
    trigger: '.stage',
    start: 'top top',
    end: 'bottom bottom',
    onToggle: (self) => hero.setActive(self.isActive),
    onUpdate: (self) => {
      if (self.progress > 0.002) endIntro();
      hero.scrub(self.progress);
      updateCaptions(self.progress);
      hintEl.style.opacity = self.progress > 0.04 ? '0' : '1';
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { ScrollTrigger.refresh(); if (lenis) lenis.resize(); }
  });
}

function setupClip() {
  const v = document.getElementById('clip-video');
  if (!v) return;
  const clip = makeScrubber(v);
  clip.setActive(false);

  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => clip.scrub(self.progress),
  });
  // activate a viewport early/late so it's primed before it's seen
  ScrollTrigger.create({
    trigger: '.clip-stage',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => clip.setActive(self.isActive),
  });
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
