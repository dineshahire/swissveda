# Swiss Veda — Pure Swiss Ghee

A premium, single-page hero site built around a **cinematic scroll-scrub film**:
as you scroll, the cow → milk → golden ghee → sealed jar film plays forward;
scroll up and it reverses. Built with **Three.js** (fullscreen plane +
orthographic camera) and **GSAP ScrollTrigger**, bundled with **Vite**.

Two scrub engines are built in and selectable from one flag:

| Mode         | What it does                                               | Best for                     |
|--------------|------------------------------------------------------------|------------------------------|
| `"video"`    | `VideoTexture` on a plane, `currentTime` tied to scroll    | Small downloads, long films  |
| `"sequence"` | Ordered JPG frames, drawn per scroll progress              | **Sharpest** on 4K monitors  |

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the built dist/
```

---

## Where your media lives

```
public/
  video/
    hero.mp4     ← stitched film, H.264 high profile (served to all browsers)
    hero.webm    ← stitched film, VP9 (served to capable browsers first)
  frames/
    0001.jpg … 0504.jpg   ← ordered frames for "sequence" mode
```

The source clips (`1 video.mp4` … `5 video.mp4`) sit in the project root and
are stitched into `public/video/hero.mp4`. The current film is **42s**,
**1280×720**, 24 fps. (`main video.mp4` is a separate 4K master kept in the
root if you want to switch to it later.)

### Re-stitch the film after changing the source clips

```bash
# list clips in order (absolute paths!), then concat + re-encode high profile
printf "file '%s'\n" "$PWD/1 video.mp4" "$PWD/2 video.mp4" "$PWD/3 video.mp4" \
  "$PWD/4 video.mp4" "$PWD/5 video.mp4" > /tmp/concat.txt

ffmpeg -y -f concat -safe 0 -i /tmp/concat.txt \
  -c:v libx264 -profile:v high -level 4.2 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart -an \
  public/video/hero.mp4

# VP9 webm twin
ffmpeg -y -i public/video/hero.mp4 -c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1 -an \
  public/video/hero.webm

# frames for sequence mode (12 fps → keep CONFIG.sequence.count in sync)
ffmpeg -y -i public/video/hero.mp4 -vf "fps=12" -q:v 2 public/frames/%04d.jpg
```

`-movflags +faststart` puts the MP4 index at the front so the browser can begin
playback/scrubbing while still buffering.

---

## Export settings for QUALITY (fix big-screen blur)

The single biggest factor in sharpness is the **source resolution** — Three.js
cannot invent detail that isn't there. The stitched clips are **720p**, which
looks crisp up to ~1080p displays but is soft on a true 4K monitor. A 4K master
(`main video.mp4`) is kept in the root — re-encode from it for razor-sharp 4K.

> ⚠️ Never upscale a low-res file to 4K — it just blurs. Feed a real 4K (or at
> least 1080p) master.

**Recommended export targets:**

| Display target | Resolution  | H.264 bitrate | VP9 (CRF) |
|----------------|-------------|---------------|-----------|
| Minimum        | 1920×1080   | 10–14 Mbps    | crf 30    |
| Ideal          | 3840×2160   | 16–20 Mbps    | crf 28    |

- **Format:** H.264 **high profile**, `yuv420p`, `+faststart` (MP4) **and** VP9 (WebM).
- **Frame rate:** keep the source fps (24). For `sequence` mode, 12–24 fps frames
  scrub smoothly; more frames = smoother + heavier.
- **Sequence frames:** export JPG at quality 2 (`-q:v 2`) or PNG for lossless.
  Match `CONFIG.sequence.count` to the number of frames produced.

The renderer already does its part for sharpness:

- `setPixelRatio(min(devicePixelRatio, 2))`, refreshed on every resize
- `LinearFilter` min/mag, **no mipmaps**, `SRGBColorSpace`, **max anisotropy**
- the plane is scaled to **cover** the viewport at any aspect ratio — no
  stretching, no letterboxing

---

## Flip the mode: `video` ↔ `sequence`

Edit [`src/config.js`](src/config.js):

```js
export const CONFIG = {
  mode: 'video',      // ← change to 'sequence' for the sharpest big-screen scrub
  scrollLengthVH: 5,  // how many screen-heights the pinned film consumes
  ...
};
```

When using `sequence`, make sure `sequence.count`, `pad`, `start`, `ext`, and
`path` match the files in `public/frames/`.

---

## How it's structured

```
index.html        loading screen, fixed header (logo + nav), pinned film stage, content sections
src/
  config.js       the CONFIG flag + captions + file paths
  scene.js        Three.js Stage — renderer, ortho camera, cover-resize, texture quality
  video.js        VideoEngine — VideoTexture + scrub(progress)
  sequence.js     SequenceEngine — preloads frames, swaps texture per progress
  main.js         bootstrap: loading → engine → ScrollTrigger scrub → captions → reveals
  style.css       palette, layout, captions, sections
public/video/*    hero.mp4 + hero.webm
public/frames/*   0001.jpg … (sequence mode)
```

**Scroll flow:** the `.stage` section is `scrollLengthVH × 100vh` tall; `.sticky`
inside it is pinned with native CSS `position: sticky`. ScrollTrigger reads the
section's progress (0→1) and feeds it to the engine and the captions. After the
film finishes, the pin releases naturally and the content sections scroll in.

**Captions** are defined in `CONFIG.captions` with an `at` (0–1 progress) point
and cross-fade as you scroll past each.

**Fallback:** if the visitor has `prefers-reduced-motion: reduce`, the scrub is
skipped and the film simply autoplay-loops on a single screen.

---

## Deploy

It's a static site — build and host the `dist/` folder anywhere.

```bash
npm run build
```

- **Netlify / Vercel:** build command `npm run build`, publish directory `dist`.
- **GitHub Pages / any static host:** upload the contents of `dist/`.
- Make sure your host serves `.mp4`, `.webm`, and `.jpg` with correct MIME types
  (most do by default). Large media benefits from a CDN / HTTP range support so
  scrubbing can seek quickly.

> The film + frames are ~150 MB total. For production, consider serving only the
> mode you ship (delete the unused `video/` or `frames/`) to cut deploy size.
