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
    // To swap the hero video: extract frames with ffmpeg, e.g.
    //   ffmpeg -i input.mp4 -vf "fps=15,scale=1920:1080:flags=lanczos" -q:v 3 public/frames-x/%04d.jpg
    // then set `path` + `count` below (count = number of frames produced).
    path: 'frames-dinesh/',
    ext: 'jpg',
    pad: 4,        // 0001 → padded to 4 digits
    start: 1,      // first frame index
    count: 1022,   // 1 OG Dinesh.mp4 @ 15fps × 68.1s, 1080p. Sliding-window decode → RAM-bounded.
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
