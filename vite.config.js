import { defineConfig } from 'vite';

// Vite config. `public/` is served at root, so frames are reachable at
// /frames-dinesh/0001.jpg etc.
export default defineConfig({
  base: './',
  server: {
    host: true,
    open: true,
    port: 5173,        // this project always runs on 5173
    strictPort: true,  // if 5173 is taken, fail loudly instead of drifting to 5174
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // never inline media
    rollupOptions: {
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
