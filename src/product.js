import './product.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PRODUCTS, ORDER } from './products-data.js';
import { mountLoaderLottie } from './lottie.js';

// load overlay: lottie until the hero image is ready (or 2.5s cap), then fade
const pdpLoader = document.getElementById('pdp-loader');
const pdpAnim = mountLoaderLottie(document.getElementById('pdp-lottie'));
function hidePdpLoader() {
  if (!pdpLoader || pdpLoader.classList.contains('is-hidden')) return;
  pdpLoader.classList.add('is-hidden');
  setTimeout(() => pdpAnim?.destroy(), 700);
}

gsap.registerPlugin(ScrollTrigger);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;

// ── pick product from ?id (default shilajit) ───────────────────────────────
const id = new URLSearchParams(location.search).get('id');
const key = PRODUCTS[id] ? id : 'shilajit';
const p = PRODUCTS[key];
const firstName = p.name.replace(/^Natural\s+/i, '').split(/[\s/]/)[0];

document.body.style.setProperty('--accent', p.accent);
document.title = `${p.name} — VK Swiss`;

const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
set('#p-eyebrow', p.eyebrow);
set('#p-name', p.name.replace(/^Natural\s+/i, 'Natural\n')); // line break after "Natural"
document.querySelector('#p-name').innerHTML = p.name.replace(/^(Natural)\s+/i, '$1<br>');
set('#p-sub', p.sub);
set('#p-lede', p.lede);
set('#p-price', p.price);
set('#p-self-title', firstName);
set('#p-combo-title', `${firstName} & Swiss Ghee`);
set('#p-ingredients', p.ingredients);
set('#p-orb-cap', firstName);
document.querySelector('#p-orb-cap').innerHTML = `${firstName}<br><small>Ayurvedic origin</small>`;
set('#p-final', `Add to cart — ${p.price}`);

const img = document.querySelector('#p-img');
img.src = p.img; img.alt = `VK Swiss ${p.name}`;
document.querySelector('#p-orb').src = p.img;
// reveal the page once the hero shot is decoded (capped so it never hangs)
img.decode ? img.decode().then(hidePdpLoader, hidePdpLoader) : img.addEventListener('load', hidePdpLoader);
setTimeout(hidePdpLoader, 2500);

// sticky buy bar
const shortName = p.name.replace(/^Natural\s+/i, '');
document.querySelector('#bar-img').src = p.img;
set('#bar-name', shortName);
set('#bar-price', p.price);
const bar = document.querySelector('#buybar');
ScrollTrigger.create({
  trigger: '.hero', start: 'bottom 70%',
  onEnter: () => bar.classList.add('is-show'),
  onLeaveBack: () => bar.classList.remove('is-show'),
});

const fill = (sel, items) => {
  const ul = document.querySelector(sel);
  ul.innerHTML = items.map((t) => `<li>${t}</li>`).join('');
};
fill('#p-self', p.self);
fill('#p-ghee', p.ghee);

// ── header product dropdown ─────────────────────────────────────────────────
const nav = document.querySelector('#pdp-nav');
nav.innerHTML = `
  <a href="/">Home</a>
  <div class="dropdown">
    <button class="dropdown__btn" aria-haspopup="true" aria-expanded="false">Products ▾</button>
    <div class="dropdown__menu">
      ${ORDER.map((k) => `<a href="product.html?id=${k}" class="${k === key ? 'is-active' : ''}">${PRODUCTS[k].name.replace(/^Natural\s+/i, '')}</a>`).join('')}
    </div>
  </div>
  <a href="#combo">The Blend</a>`;
const dd = nav.querySelector('.dropdown');
const ddBtn = nav.querySelector('.dropdown__btn');
ddBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = dd.classList.toggle('is-open');
  ddBtn.setAttribute('aria-expanded', open);
});
document.addEventListener('click', () => { dd.classList.remove('is-open'); ddBtn.setAttribute('aria-expanded', 'false'); });

// ── smooth scroll + reveals ─────────────────────────────────────────────────
if (!REDUCED) {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.querySelectorAll('.reveal').forEach((el) => {
  gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
});
gsap.to('.hero__info .reveal', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.1 });

document.querySelectorAll('.stat__n').forEach((el) => {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.textContent.replace(/[0-9]/g, '');
  if (!target) return;
  const obj = { v: 0 };
  gsap.to(obj, { v: target, duration: 1.4, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; } });
});

if (FINE && !REDUCED) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}
