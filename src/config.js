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
    // Two quality tiers; the engine auto-picks per device (RAM / cores / network
    // / screen) so the reel runs smoothly everywhere instead of crashing phones.
    // To re-export, e.g.:
    //   hi: ffmpeg -i in.mp4 -vf "fps=15,scale=1280:720:flags=lanczos"  -q:v 4 public/frames-dinesh/%04d.jpg
    //   lo: ffmpeg -i in.mp4 -vf "fps=10,scale=854:480:flags=lanczos"   -q:v 5 public/frames-dinesh-sd/%04d.jpg
    ext: 'jpg',
    pad: 4,        // 0001 → padded to 4 digits
    start: 1,      // first frame index
    tiers: {
      hi: { path: 'frames-dinesh/',    count: 1022 }, // 720p @15fps — desktop / good devices
      lo: { path: 'frames-dinesh-sd/', count: 681 },  // 480p @10fps — mobile / low-end / slow net
    },
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
