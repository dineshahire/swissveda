// Shared Lottie loader animation (gold ring + pulsing dot, brand colors).
// Used by the home loading screen and the product-page load overlay.
// To swap the animation: replace src/loader-lottie.json with any Lottie export.
import lottie from 'lottie-web/build/player/lottie_light'; // svg-only build (small)
import animationData from './loader-lottie.json';

/** Mount the loader animation into `el`. Returns the anim (call .destroy()). */
export function mountLoaderLottie(el) {
  if (!el) return null;
  return lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    animationData,
  });
}
