# Architecture Realism Handoff

Updated 2026-09-29. User asked to make the existing ancient buildings more
realistic and closer to actual architecture, then said "continue".
No commit or push has been requested for this project.
The current source and uncommitted exterior upgrade are being migrated together
to `beyond-text-frontier-model-showcase/gpt-6-astra/chinese-architecture/`.
Run cross-project verification commands from the `gpt-6-astra/` model directory.

## Implementation

- Added a default Three.js exterior alongside the existing SVG teaching views.
- Six building recipes remain in `data.js`; the original `geometry.js` is unchanged.
- `realistic-model.js`: metre-scale layout, resolved storeys, roof/gable sampling,
  and frame-bounded lattice patterns.
- `realistic.js`: real tiles, layered/curved bracket arms, stone/wood materials,
  shadows, upper/lower roofs, columns, windows, platform stairs and stone rails.
- `app.js`: shared stages/explode, switching renderers, camera/light/export controls.
- Offline classic-script runtime: `assets/three-bundle.js`; rebuild using the
  pinned Three.js/esbuild versions in `package.json`.
- New mobile layouts preserve the main unframed canvas and put the notes below it.

## Verification

- `npm test` passes all original geometry invariants and nine new layout,
  roof/gable and lattice tests.
- `npm run build:vendor` reproduces the locally bundled runtime.
- Browser checks pass across all six buildings and 768/390/320px layouts:
  finite geometry, complete framing, nonblank canvases and live rotation.
- Orbit dragging, wheel zoom, front/reset cameras, lighting, stages, explode,
  PNG export and returning to the SVG section pass.
- Forced WebGL context loss/restoration passes without a remaining GL error.
  Dispose the old environment render target during context loss, not after
  restoration, to avoid deleting objects owned by the old context.
- Reduced-motion startup and no-WebGL fallback to SVG both pass.
- Production dependency audit reports zero vulnerabilities.
- `git diff --check -- chinese-architecture` passes.
Artifacts: `output/playwright/architecture-*.png` and
`output/playwright/architecture-verification.log` from the model directory.

## Constraints

- Read `README.md` for accuracy limits. Do not describe these as exact surveyed
  reconstructions or photorealistic scans.
- Preserve the original structural recipes and teaching functions.
- Do not read/diff minified vendored assets into context.
- Keep other showcase/model directories untouched.
- Do not launch a server for this offline HTML viewer.
