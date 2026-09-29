# 清明上河图 · 一卷入宋

Open `index.html` in a modern browser. No install, development server, network
connection, or API key is needed. Keep the `assets` directory beside the page.

The viewer animates people, sedan bearers, camels, donkey riders, branches,
boats, and river surfaces in the actual Zhang Zeduan scroll. Eight individual
figures walk short, repeating routes; six gesture or work with their hands.
Five connected ensembles add two market sedans, two town sedans, a country
sedan, two camels, and three donkeys (two mounted). Bearers keep their poles
connected, animals alternate their legs, and riders and necks follow local
joint motion. The remaining annotated crowd regions also make subtle gestures.
Continuous raster silhouettes use repaired backgrounds for individual walkers.
Larger ensembles use locally deformed, edge-pinned surfaces to keep faint ink,
reins, and surrounding paper continuous, without detached cutout silhouettes.
This is a 2D artistic interpretation, not AI-generated video or a historical
reconstruction. Not every figure in the painting is animated. Small retouching
and deformation artifacts may be visible at high magnification.

## Controls

- Drag to pan; pinch or scroll to zoom.
- Select a scene, or scrub the overview to move along the scroll.
- Pause, people and water switches, wind strength, and speed.
- Unroll (`展卷`) starts at the right-hand beginning, opens the scroll, then
  travels continuously to its left-hand end over two minutes at 1x speed.
  Dragging or choosing a scene cancels the tour. Pause freezes both camera and
  figures; the tour ends at the left edge instead of bouncing back.
- Original mode removes all animation and added water highlights.
- Canvas keyboard controls: arrows to pan, `+`/`-` to zoom, `0` to reset, space to pause.
- Camera button downloads the current canvas as PNG. Fullscreen uses the browser API.
- Reduced-motion preference starts the viewer paused. Hidden tabs stop animation time.

## Source

- **Work:** *Along the River During the Qingming Festival*, Zhang Zeduan,
  Northern Song; Palace Museum, Beijing.
- **Scan:** <https://commons.wikimedia.org/wiki/File:Alongtheriver_QingMing.jpg>
- **Image:** <https://upload.wikimedia.org/wikipedia/commons/8/86/Alongtheriver_QingMing.jpg>
- **Status:** Public domain, PD-Art / Public Domain Mark 1.0, as recorded on
  the source page. Downloaded 2026-09-28.
- The scan was resampled from 38,414 × 1,800 to 25,609 × 1,200, with no recoloring.
- Icons: Lucide 0.468.0, ISC license; vendored for offline use.

## Implementation

WebGL 1 renders overlapping image tiles. A second RGBA texture encodes local
subject coordinates, class, phase, and feathered influence. Root-weighted
branch bending, boat bobbing, and water displacement have independent controls.
An additional atlas contains the original full figure silhouettes and healed
backgrounds. A continuous triangle mesh carries joint-driven limb motion, while
walking routes translate figures in image coordinates. Only visible and
neighboring image tiles remain on the GPU.
Overlapping animals share a surface and animation clock, with phase-offset
limbs. Their motion tapers to zero outside the annotated contours and at patch
edges. A continuous displacement limit prevents triangle inversion or collapse
and caps edge stretch, keeping the painted surfaces connected during motion.
Extracted figures are excluded from the crowd mask to avoid double motion.
Tile payloads load as classic scripts containing data URIs, so local-file
rendering and image export remain origin-clean.

`motion.json`, `actors.json`, and `processions.json` record image-space
annotations at 1,200 pixels high. Rebuild
assets from the downloaded original with Python, Pillow, NumPy, and OpenCV:

```sh
python tools/prepare_assets.py /path/to/Alongtheriver_QingMing.jpg
python tools/prepare_actors.py /path/to/Alongtheriver_QingMing.jpg
```

Both tools can also read the shipped image tiles when the source argument is
omitted. `prepare_assets.py --masks-only` updates masks without recompressing
the artwork. Use a Python environment with Pillow, NumPy and OpenCV installed;
viewing the painting does not require Python.

## Verification

`test/verify-browser.js` is a Playwright CLI `run-code --filename` script.
It checks independent layer pixel changes, static architecture, pause/play,
original mode, panning, zoom, all five scenes, roaming, image download,
320/390/768/1440-pixel layouts, articulated movement, full right-to-left
unrolling, and reduced-motion preference.
`test/verify-processions.js` checks the new ensembles' limb motion and captures
three deterministic close-up frames of each group. `test/verify-closeups.js`
also checks WebGL context restoration. Run the renderer-independent pose and
boundary tests, full-cycle surface deformation checks and project-launcher test
with `node --test test/*.test.cjs` from this directory.

## Continuing Development

`HANDOFF.md` records current progress, verification and remaining limitations.
`AGENTS.md` keeps generated Base64 assets and verbose browser output out of
development conversations. From the model directory (`gpt-6-astra/`), start a fresh project
session with `sh qingming-scroll/tools/start-codex.sh`. This uses a conservative
64,000-token compaction threshold and a 4,000-token stored tool-output budget
without changing the global configuration or selected model. These safeguards
reduce context growth; they do not guarantee the provider's input limit.

## Video Export

Rendered videos have been removed. The interactive viewer, artwork assets,
tests, and export scripts are retained. The optional export below generates a
120-second, 1920 x 1080, 30 fps unfolding film; video files are excluded from Git.

`test/export-preview.js` starts a deterministic 3,600-frame WebCodecs H.264
export. Each frame waits for its image tiles, so loading delays and background
tab throttling do not introduce gaps or change the film's timing. The opening
includes a moving scroll edge; subsequent frames traverse the painting.

With a Playwright CLI session open on `index.html`, run from the model directory (`gpt-6-astra/`):

```sh
playwright-cli -s=qingming-export run-code --filename=qingming-scroll/test/export-preview.js
playwright-cli -s=qingming-export eval 'window.qingmingExport'
# When status is "complete":
playwright-cli -s=qingming-export run-code --filename=qingming-scroll/test/save-export.js
ffmpeg -r 30 -i output/playwright/qingming-unfolding.h264 \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  qingming-scroll/qingming-unfolding.mp4
```

Export requires H.264 WebCodecs support (tested in Chrome) and FFmpeg for the
MP4 conversion. Viewing the interactive scroll only requires WebGL 1.
