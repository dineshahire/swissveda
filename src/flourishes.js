// ─────────────────────────────────────────────────────────────────────────
//  Premium flourishes (isolated so it's easy to revert):
//   1. Magnetic CTA buttons     2. Hero mouse-parallax
//   3. Split-text heading reveal 4. Custom cursor
//   5. Gold-dust particles       6. Ambient wind sound toggle (WebAudio)
//  All motion respects prefers-reduced-motion; pointer effects are desktop-only.
// ─────────────────────────────────────────────────────────────────────────

import gsap from 'gsap';

const FINE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

export function initFlourishes({ canvas, sticky, reduced }) {
  if (!reduced && FINE) {
    initCursor();
    initMagnetic();
    initHeroParallax(canvas);
  }
  if (!reduced) initParticles(sticky);
  initSplitReveals(reduced);
  initSound();
}

// 1 ── magnetic CTAs ─────────────────────────────────────────────────────────
function initMagnetic() {
  document.querySelectorAll('.btn, .btn-more, .brand').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.4);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

// 2 ── hero mouse-parallax (subtle depth) ────────────────────────────────────
function initHeroParallax(canvas) {
  if (!canvas) return;
  const px = gsap.quickTo(canvas, 'x', { duration: 0.7, ease: 'power3' });
  const py = gsap.quickTo(canvas, 'y', { duration: 0.7, ease: 'power3' });
  window.addEventListener('mousemove', (e) => {
    px((e.clientX / window.innerWidth - 0.5) * 18);
    py((e.clientY / window.innerHeight - 0.5) * 18);
  }, { passive: true });
}

// 3 ── split-text heading reveal ─────────────────────────────────────────────
function initSplitReveals(reduced) {
  document.querySelectorAll('.section h2').forEach((el) => {
    if (reduced) return; // leave as plain text
    const parts = el.textContent.split(/(\s+)/);
    el.textContent = '';
    parts.forEach((w) => {
      if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(' ')); return; }
      const wrap = document.createElement('span'); wrap.className = 'word';
      const inner = document.createElement('span'); inner.className = 'word__i'; inner.textContent = w;
      wrap.appendChild(inner); el.appendChild(wrap);
    });
    gsap.from(el.querySelectorAll('.word__i'), {
      yPercent: 115, opacity: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}

// 4 ── custom cursor ─────────────────────────────────────────────────────────
function initCursor() {
  const dot = document.createElement('div');
  dot.className = 'cursor';
  document.body.appendChild(dot);
  document.documentElement.classList.add('has-custom-cursor');
  const x = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3' });
  const y = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3' });
  window.addEventListener('mousemove', (e) => { x(e.clientX); y(e.clientY); }, { passive: true });
  const grow = () => dot.classList.add('is-grow');
  const shrink = () => dot.classList.remove('is-grow');
  document.querySelectorAll('a, button, .btn, .btn-more').forEach((el) => {
    el.addEventListener('mouseenter', grow); el.addEventListener('mouseleave', shrink);
  });
}

// 5 ── gold-dust particles over the hero ─────────────────────────────────────
function initParticles(sticky) {
  if (!sticky) return;
  const cv = document.createElement('canvas');
  cv.className = 'gold-dust';
  sticky.appendChild(cv);
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, parts = [];
  const N = 46;
  const rand = (a, b) => a + Math.random() * (b - a);
  const make = () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.6, 2.2), s: rand(6, 22), o: rand(0.15, 0.6), d: rand(-0.3, 0.3) });
  const size = () => {
    const r = sticky.getBoundingClientRect();
    w = cv.width = Math.round(r.width); h = cv.height = Math.round(r.height);
    parts = Array.from({ length: N }, make);
  };
  size();
  window.addEventListener('resize', size);
  const tick = () => {
    requestAnimationFrame(tick);
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.s * 0.016; p.x += p.d;
      if (p.y < -4) { p.y = h + 4; p.x = rand(0, w); }
      ctx.beginPath();
      ctx.fillStyle = `rgba(230,200,120,${p.o})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  requestAnimationFrame(tick);
}

// 6 ── ambient wind sound toggle (generated, no asset) ───────────────────────
function initSound() {
  const btn = document.createElement('button');
  btn.className = 'sound-toggle';
  btn.setAttribute('aria-label', 'Toggle ambient sound');
  btn.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(btn);

  let actx = null, gain = null, on = false;
  const build = () => {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; // white noise
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.5;
    gain = actx.createGain(); gain.gain.value = 0;
    src.connect(bp).connect(gain).connect(actx.destination); src.start();
  };
  btn.addEventListener('click', () => {
    if (!actx) build();
    if (actx.state === 'suspended') actx.resume();
    on = !on;
    gain.gain.linearRampToValueAtTime(on ? 0.05 : 0, actx.currentTime + 0.6);
    btn.classList.toggle('is-on', on);
  });
}
