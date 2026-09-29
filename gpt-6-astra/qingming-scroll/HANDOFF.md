# Qingming Scroll Handoff

Updated: 2026-09-29.
Migration destination: `beyond-text-frontier-model-showcase/gpt-6-astra/qingming-scroll/`.
Cross-project commands below run from the `gpt-6-astra/` model directory.

## Current Work

Continue animating figures, sedan chairs and animals in the original painting.
The previous session stopped with `Input is too long`; its work was recovered
and retained. The user approved committing the current Qingming changes on
2026-09-29. No remote push or video export was requested.

- Entry point: `index.html`, an offline WebGL 1 viewer.
- `app.js`: camera, five chapters, switches, timeline, original mode, PNG export.
- `characters.js`: articulated silhouettes and connected ensemble surfaces.
- `actors.json`: 14 individual people (8 walkers, 6 gesturing/working figures).
- `processions.json`: 9 annotated subjects merged into 5 connected ensembles:
  two market sedans, two town sedans, one country sedan, two camels and three
  donkeys (two mounted). Shared surfaces preserve overlapping silhouettes.
- `tools/prepare_assets.py` and `tools/prepare_actors.py`: offline asset builders.
- `assets/*.js`: generated raster payloads. Do not print their contents.

## Changes After Recovery

- Added a continuous displacement limit to ensemble rendering. Signed triangle
  area stays above 25% of its rest area; edges stretch by at most 1.8x.
  One shared factor keeps neighboring triangles connected and patch edges fixed.
- Added renderer-level tests. Before the fix, a market-sedan triangle collapsed
  to roughly 6% of its original area even at time zero.
- Added project-local context guidance and `tools/start-codex.sh`.

## Verification

- All 9 Node tests passed: skeletons, full-cycle surface area/edge bounds,
  fixed boundaries, continuity at the limit, and launcher argument preservation.
- All five ensemble close-ups show actual canvas pixel changes, no WebGL errors.
- Full browser regression passed: pause/play, independent layers, original mode,
  stationary architecture, all chapters, pan/zoom, 120-second unrolling and PNG export.
- After waiting for actual canvas resize, 1440/768/390/320px layouts passed with
  nonblank animated canvases, no overflow and no runtime or WebGL errors.
- All 11 close-ups passed. Forced WebGL loss/restoration produced a pixel-identical
  recovered frame. Reduced-motion startup also passed.
- `git diff --check -- qingming-scroll` passed. No new video was made.
- Browser screenshots/logs live in the repository's `output/playwright/`.
  Main logs: `qingming-browser-verification.log`, `qingming-closeup-verification.log`.

## Context Recovery

The previous local configuration declared a 1,050,000-token context window and
waited until 945,000 tokens to compact. Its history contains both an oversized
request error and a failed remote compaction. These observations do not establish
the Bedrock endpoint's actual input limit. Large inline assets, screenshots,
tool schemas and long transcripts can all consume context.

Start a fresh project session with:

```sh
sh qingming-scroll/tools/start-codex.sh
```

The wrapper uses a conservative 64,000-token auto-compaction threshold and a
4,000-token budget per stored tool result. It preserves the selected model,
provider and global config. These are operational safeguards, not a guarantee
of the upstream limit, and do not change the already-running chat.

Use `/compact` before a long session becomes full. If compaction itself fails,
use `/new` and ask: "Read HANDOFF.md and continue the project."
From the model directory, the file is `qingming-scroll/HANDOFF.md`.
Resuming the oversized old transcript does not reduce it.

Official reference:
https://learn.chatgpt.com/docs/config-file/config-reference

## Known Limits And Next Steps

- This is local 2D deformation, not full autonomous movement for every painted
  figure. Ensemble travel is short and periodic; most distant figures are static.
- Fine ink, paper and nearby objects may still deform within annotated surfaces.
  Inspect close-ups before increasing movement or changing contours.
- For more lifelike motion, refine contours and limb joints one ensemble at a
  time and rerun the surface/pixel tests. Do not claim full-painting coverage.
- Keep other showcase/model directories untouched.
