# Chinese Architecture

Open `index.html` directly in a current browser. The Three.js runtime and icons
are vendored, so no server or installation is needed to view the models.
Online Google Fonts are optional; local font fallbacks remain available offline.

## Exterior And Section

The default view is a material-based 3D exterior, with orbit/pan/zoom, front and
perspective cameras, optional rotation, two lighting presets and local PNG export.
The original SVG sections, construction stages, exploded views, component
explanations, detail lenses, guided tour and dynasty comparison remain available.
Three-dimensional rendering requires WebGL 2; unsupported browsers retain the
section view.

The six exteriors reuse `data.js` and resolved section geometry for bay widths,
column heights, bracket proportions, roof profiles and structural levels:

- Foguang East Hall: seven bays, a low single-eave hip roof and deep eaves.
- Jinci Shengmu Hall: a hip-and-gable upper roof above a surrounding veranda.
- Dule Guanyin Pavilion: two exterior storeys, an intermediate structural level,
  a balcony and an open central floor well.
- Chongfu Mituo Hall: a broad hip-and-gable roof and diagonal door lattice.
- Yongle Sanqing Hall: hip roof, painted timber and vertical window lattice.
- Changling Ling'en Hall: double-eave hip roof, ochre glazed tiles, dense bracket
  rows, a three-tier stone platform and stone balustrades.

Tiles, eave ends, curved bracket arms, sloping true ang, tapered blocks, round
columns, stone bases, door frames and lattice bars are actual geometry.
Deterministic canvas textures supply wood grain and surface roughness.
Repeated elements use instancing. Geometry and materials are released when
switching buildings; context restoration regenerates the environment map.

## Accuracy Boundary

These are dimension-informed interpretive models, **not photogrammetric scans,
survey drawings, conservation records or exact historical reconstructions**.
The current recipe dimensions are inherited, not newly field-verified.
Material colours and weathering are approximations. Ridge ornaments, bracket
joinery, carved dragons, decorative painting, window motifs and interiors are
simplified; the Ming stone railing is not an exact copy of its relief carvings.
The models do not establish the original appearance at each building's date.
Use the existing section and its source notes for structural interpretation.

Visual and typological references:

- https://en.wikipedia.org/wiki/Foguang_Temple
- https://commons.wikimedia.org/wiki/File:Foguang_Temple_8.JPG
- https://en.wikipedia.org/wiki/Dule_Temple
- https://en.wikipedia.org/wiki/East_Asian_hip-and-gable_roof
- Building-specific books and reports are listed in `data.js` and the app panel.

No third-party building photograph is bundled or used as a texture.

## Development

```sh
npm ci
npm test
npm run build:vendor
```

`realistic-model.js` contains DOM-free metre-scale layout and roof/lattice
sampling. `realistic.js` builds the meshes, materials, lighting and camera.
`app.js` coordinates both renderers. `geometry.js` remains the existing source
for structural sections.

`test/verify-realistic.js` is a Playwright CLI `run-code --filename` script,
run from the model directory (`gpt-6-astra/`) with this page open. It checks all six buildings,
finite mesh data, camera framing, actual canvas pixels, rotation, lighting,
construction stages, explode, PNG export, the retained section and mobile sizes.
Screenshots and logs go to `output/playwright/`, not the shipped assets.
Use a Playwright configuration with `allowUnrestrictedFileAccess: true` for
local-file QA.

Third-party code:

- Three.js 0.180.0, MIT: `assets/THREE-LICENSE`.
- Lucide 0.468.0, ISC: `assets/LUCIDE-LICENSE`.
- esbuild 0.25.10 is a build-time dependency only.

Do not print `assets/three-bundle.js`, `assets/lucide.min.js`, or image payloads
into development conversations. Use the editable source, bounded test summaries
and `HANDOFF.md` to continue after a context reset.
