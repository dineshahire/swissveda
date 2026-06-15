// ─────────────────────────────────────────────────────────────────────────
//  VK Swiss — global configuration
//  The hero is a scroll-scrubbed image sequence: ordered JPG frames drawn per
//  scroll progress, decoded in a sliding window (sharp + RAM-bounded).
// ─────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // How many viewport-heights of scrolling the pinned film consumes.
  // Higher = slower / more deliberate scrub. 4–6 feels cinematic.
  scrollLengthVH: 5,

  sequence: {
    // Frames live in /public/<path>, zero-padded: 0001.jpg … NNNN.jpg.
    // HOLD-ALL: a small frame set, fully decoded into RAM up front, so scrubbing
    // never fetches/decodes mid-scroll → smooth forward + back on every device.
    // Two tiers (engine auto-picks by GPU / RAM / cores / network / screen).
    // To re-export, e.g.:
    //   hi: ffmpeg -i in.mp4 -vf "fps=2.64,scale=1280:720:flags=lanczos" -q:v 3 public/frames-dinesh/%04d.jpg
    //   lo: ffmpeg -i in.mp4 -vf "fps=2.06,scale=854:480:flags=lanczos"  -q:v 4 public/frames-dinesh-sd/%04d.jpg
    ext: 'jpg',
    pad: 4,        // 0001 → padded to 4 digits
    start: 1,      // first frame index
    tiers: {
      hi: { path: 'frames-dinesh/',    count: 1623 }, // 720p HD @ 24fps — cinema-smooth both ways
      lo: { path: 'frames-dinesh-sd/', count: 812 },  // 480p @ 12fps — smooth on low/mid devices
    },
  },

  // Secondary scroll-scrubbed clip shown in a content box (src/clip.js).
  clip: {
    path: 'scroll-frames/',
    ext: 'jpg',
    pad: 4,
    start: 1,
    count: 116,    // ProductSwiss_upscaled.mp4 @ 9fps, 720p — held fully in RAM
  },

  // Scroll-synced captions. `at` is normalized scroll progress 0..1 where the
  // caption is fully visible; it cross-fades around that point.
  captions: [
    { at: 0.08, title: 'From the Alps',  sub: 'Where the herds still roam free' },
    { at: 0.34, title: 'Pure Milk',      sub: 'Hand-collected, untouched' },
    { at: 0.62, title: 'Golden Ghee',    sub: 'Slow-simmered to perfection' },
    { at: 0.90, title: 'Pure Swiss Ghee', sub: 'Sealed at the source' },
  ],
};
