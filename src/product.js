import './style.css';
import './product.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PRODUCTS, ORDER } from './products-data.js';

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
// banner overlay
const bn = document.querySelector('#banner-name');
if (bn) bn.innerHTML = p.name.replace(/^(Natural)\s+(.+)/i, '$1 <span style="color:#FF8A00">$2</span>');
const bd = document.querySelector('#banner-desc');
if (bd) bd.textContent = p.lede;

set('#p-eyebrow', p.eyebrow);
set('#p-name', p.name.replace(/^Natural\s+/i, 'Natural\n')); // line break after "Natural"
document.querySelector('#p-name').innerHTML = p.name.replace(/^(Natural)\s+(.+)/i, '$1<br><span class="accent">$2</span>');
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

// ── header nav ─────────────────────────────────────────────────────────────
const nav = document.querySelector('#pdp-nav');
nav.innerHTML = `
  <a href="/" onclick="sessionStorage.setItem('fromPDP','1')">Home</a>
  <a href="/#news">News</a>
  <a href="/#products">Our Products</a>
  <a href="/#find">Where To Find Us</a>
  <a href="/#contact">Contact</a>`;

// range strip: chips linking to every product (rich cards)
const rangeLinks = document.querySelector('#range-links');
if (rangeLinks) {
  rangeLinks.innerHTML = ORDER.map((k) =>
    `<a href="product.html?id=${k}" class="range__chip${k === key ? ' is-active' : ''}">
      <img src="${PRODUCTS[k].img}" alt="${PRODUCTS[k].name}" class="range__chip-img" />
      <span class="range__chip-name">${PRODUCTS[k].name.replace(/^Natural\s+/i, '')}</span>
      <span class="range__chip-price">${PRODUCTS[k].price}</span>
    </a>`
  ).join('');
}

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

// ── Blend section: sync product image into duplicate orb ──────────────────
const blendProductImg = document.querySelector('.blend__product-img');
if (blendProductImg) { blendProductImg.src = p.img; blendProductImg.alt = p.name; }

// ── Price + image sync to final CTA section ───────────────────────────────
const finalPriceEl = document.querySelector('#p-price-2');
if (finalPriceEl) finalPriceEl.textContent = p.price;
const ctaImg = document.querySelector('#p-img-cta');
if (ctaImg) { ctaImg.src = p.img; ctaImg.alt = p.name; }

// ── Problem bar animation (scaleY from 0 → --pct) ─────────────────────────
if (!REDUCED) {
  document.querySelectorAll('.problem__bar').forEach((bar) => {
    gsap.fromTo(bar, { scaleY: 0 }, {
      scaleY: 1, duration: 1.4, ease: 'power3.out',
      transformOrigin: 'bottom center',
      scrollTrigger: { trigger: bar, start: 'top 85%', once: true },
    });
  });

  // ── Delivery steps stagger reveal ─────────────────────────────────────
  const deliveryFlow = document.querySelector('.delivery__flow');
  if (deliveryFlow) {
    gsap.from('.delivery__step', {
      opacity: 0, y: 40, stagger: 0.2, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: deliveryFlow, start: 'top 80%', once: true },
    });
  }
}

// Recalculate all ScrollTrigger positions after Lenis + layout settle
requestAnimationFrame(() => ScrollTrigger.refresh());
