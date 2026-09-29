# Qingming Scroll Development

- Read `HANDOFF.md` and the relevant source/test files first. Do not reload old
  conversation transcripts wholesale.
- Preserve existing uncommitted work and the original artwork. Do not commit,
  rebuild raster assets or export videos unless the current task requires it.
- This is an offline HTML/WebGL viewer. Open `index.html` directly; no server,
  package installation or remote AI service is required to view it.

## Keep Context Small

- Never print or diff the full contents of `assets/actors.js`, `assets/tile-*.js`,
  `assets/lucide.min.js`, images, videos or generated browser artifacts.
  The asset scripts contain megabytes of single-line Base64.
- Exclude `assets/`, `output/` and `.playwright-cli/` from broad content searches.
  For generated assets, use a parser and print only selected metadata, sizes,
  counts or hashes. Use `git diff --stat` for the raster payloads.
- Read source in bounded sections. Redirect long test/browser logs to
  `output/playwright/`, then read only the result/error summary.
- Inspect representative screenshots at useful dimensions, not every frame.
- Update `HANDOFF.md` after meaningful progress and before a context reset.
  Record actual test results and remaining limitations, not raw tool output.

## Verification

- From the model directory (`gpt-6-astra/`): `node --test qingming-scroll/test/*.test.cjs`.
- Browser scripts are Playwright CLI `run-code --filename` functions.
  Run `verify-browser.js`, `verify-processions.js` and `verify-closeups.js`
  sequentially in one dedicated browser session; each controls the same page.
- Test actual canvas pixels and deformed triangles, not only skeleton poses.
  Preserve original-mode fidelity, fixed patch boundaries, mobile layout,
  pause/reduced-motion behavior and offline PNG export.
- For a fresh CLI session with earlier compaction, use
  `sh qingming-scroll/tools/start-codex.sh` from the model directory.
  This only changes per-launch context limits, not global configuration.
