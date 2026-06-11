import { defineConfig } from 'vite';

// Vite config. `public/` is served at root, so frames are reachable at
// /frames-dinesh/0001.jpg etc.
export default defineConfig({
  base: './',
  server: {
    host: true,
    open: true,
    port: 5180,        // dev port
    strictPort: false, // if taken, auto-pick the next free port instead of erroring
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // never inline media
    rollupOptions: {
      input: {
        main: 'index.html',
        product: 'product.html', // data-driven product detail page (?id=...)
      },
      output: {
        // split the heavy libs into their own cacheable chunk so the app code
        // chunk stays small and the 500kB warning is a real signal, not noise.
        manualChunks: {
          three: ['three'],
          gsap: ['gsap', 'gsap/ScrollTrigger'],
          lenis: ['lenis'],
        },
      },
    },
  },
});
