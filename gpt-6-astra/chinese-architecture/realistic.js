/* Material-based exterior renderer; the original section remains the structural reference. */
(function (root) {
  'use strict';
  const { THREE: T, OrbitControls, RoomEnvironment } = root.ARCH_THREE;
  const M = root.ARCH_REALISTIC_MODEL;
  const STAGE = { platform: 0, column: 1, tie: 2, bracket: 3, beam: 4,
    strut: 5, inclined: 5, purlin: 6, rafter: 7, roof: 8, wall: 9, window: 9, ceiling: 9 };
  const PALETTES = {
    'tang-foguang': { wood: '#6c3526', tile: '#60645c', ridge: '#727268', painted: '#69523d' },
    'song-shengmu': { wood: '#653b2e', tile: '#5b6656', ridge: '#80754c', painted: '#37584d' },
    'liao-guanyin': { wood: '#743c30', tile: '#62645b', ridge: '#73786a', painted: '#576257' },
    'jin-mituo': { wood: '#733b2d', tile: '#576559', ridge: '#9b8950', painted: '#41665e' },
    'yuan-sanqing': { wood: '#78392a', tile: '#4c6559', ridge: '#9a8050', painted: '#3d605a' },
    'ming-changling': { wood: '#80392c', tile: '#bc862e', ridge: '#bf8c37', painted: '#376560' },
  };
  function random(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function texture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(512, 512), rand = random(613);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const wave = kind === 'wood' ? Math.sin(x * .33 + Math.sin(y * .008) * 3)
        * Math.sin(x * .073 + y * .001) * 17 : Math.sin(x * .061) * Math.sin(y * .057) * 9;
      const value = 185 + wave + (rand() - .5) * (kind === 'wood' ? 24 : 38);
      const i = (y * 512 + x) * 4;
      image.data.set([value, value, value, 255], i);
    }
    ctx.putImageData(image, 0, 0);
    if (kind === 'wood') {
      for (let i = 0; i < 130; i++) {
        ctx.strokeStyle = `rgba(40,32,26,${rand() * .12})`;
        const x = rand() * 512, y = rand() * 512;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 3, y + 40, x - 3, y + 110, x + 1, y + rand() * 180); ctx.stroke();
      }
    }
    const map = new T.CanvasTexture(canvas);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }
  function tileGeometry() {
    const vertices = [], uv = [], indices = [], steps = 8;
    for (let z = 0; z <= 1; z++) for (let x = 0; x <= steps; x++) {
      const a = Math.PI * x / steps;
      vertices.push(-Math.cos(a) * .5, Math.sin(a), z - .5);
      uv.push(x / steps, z);
    }
    for (let i = 0; i < steps; i++) {
      indices.push(i, i + steps + 1, i + 1, i + 1, i + steps + 1, i + steps + 2);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }

  function build(building, section, maps) {
    const b = building, layout = M.layout(b, section), palette = PALETTES[b.id];
    const model = new T.Group(), batches = new Map(), groups = new Map(), rand = random(982);
    const object = new T.Object3D(), color = new T.Color();
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    const cylinder = new T.CylinderGeometry(.47, .5, 1, 16);
    const tileGeo = tileGeometry();
    const diskGeo = new T.CylinderGeometry(.5, .5, 1, 10);
    const blockGeo = new T.CylinderGeometry(.5, .36, 1, 4);
    blockGeo.rotateY(Math.PI / 4); blockGeo.scale(Math.SQRT2, 1, Math.SQRT2);
    const armShape = new T.Shape();
    armShape.moveTo(-.5, .45); armShape.lineTo(.5, .45); armShape.lineTo(.5, .05);
    armShape.quadraticCurveTo(.34, .02, .26, -.35); armShape.lineTo(-.26, -.35);
    armShape.quadraticCurveTo(-.34, .02, -.5, .05); armShape.closePath();
    const armGeo = new T.ExtrudeGeometry(armShape, { depth: 1, bevelEnabled: false, curveSegments: 5 });
    armGeo.translate(0, 0, -.5);
    const materials = {};
    for (const [name, tint, roughness, map] of [
      ['wood', palette.wood, .86, maps.wood], ['paint', palette.painted, .76, maps.wood],
      ['stone', '#babcb2', .95, maps.stone], ['wall', '#a49f8c', .96, maps.stone],
      ['tile', palette.tile, b.id.startsWith('ming') ? .42 : .76, maps.stone],
      ['ridge', palette.ridge, .58, maps.stone], ['dark', '#282e2b', 1, maps.wood],
      ['metal', '#716345', .5, null],
    ]) materials[name] = new T.MeshStandardMaterial({
      color: tint, roughness, map, bumpMap: map, bumpScale: name === 'stone' ? .045 : .014,
      metalness: name === 'metal' ? .25 : 0, side: name === 'tile' ? T.DoubleSide : T.FrontSide,
    });
    function materialFor(cat, name) {
      const key = `${cat}:${name}`;
      return materials[key] || (materials[key] = materials[name].clone());
    }
    function group(cat) {
      if (!groups.has(cat)) {
        const g = new T.Group(); g.userData = { cat, stage: STAGE[cat] };
        groups.set(cat, g); model.add(g);
      }
      return groups.get(cat);
    }
    function instance(cat, material, geometry, position, scale, rotation, variation = .07) {
      const key = `${cat}:${material}:${geometry.uuid}`;
      if (!batches.has(key)) batches.set(key, { cat, material, geometry, matrices: [], colors: [] });
      object.position.set(...position); object.scale.set(...scale);
      object.rotation.set(...(rotation || [0, 0, 0])); object.updateMatrix();
      const batch = batches.get(key);
      batch.matrices.push(object.matrix.clone());
      color.setRGB(1, 1, 1).multiplyScalar(1 - rand() * variation);
      batch.colors.push(color.clone());
    }
    const box = (cat, material, x, y, z, w, h, d, ry = 0) =>
      instance(cat, material, boxGeo, [x, y, z], [w, h, d], [0, ry, 0]);
    function beam(cat, material, a, b, diameter, rectangular = false) {
      const start = new T.Vector3(...a), end = new T.Vector3(...b);
      object.position.copy(start).add(end).multiplyScalar(.5);
      object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      instance(cat, material, rectangular ? boxGeo : cylinder, object.position.toArray(),
        [diameter, start.distanceTo(end), diameter], object.rotation.toArray().slice(0, 3));
    }
    function mesh(cat, material, geometry, position = [0, 0, 0]) {
      const m = new T.Mesh(geometry, materialFor(cat, material));
      m.position.set(...position); m.castShadow = true; m.receiveShadow = true;
      m.userData.cat = cat; group(cat).add(m);
      return m;
    }
    const W = layout.platformWidth, D = layout.platformDepth, P = layout.platform;
    const terraces = b.id.startsWith('ming') ? 3 : 1;
    for (let i = 0; i < terraces; i++) {
      const y = -P + (i + .5) * P / terraces;
      box('platform', 'stone', 0, y, 0, W - i * .7, P / terraces, D - i * .7);
      box('platform', 'stone', 0, y + P / terraces / 2, 0, W - i * .7 + .18, .12, D - i * .7 + .18);
    }
    // Individual pavers and masonry joints supply scale cues without painted-on shadows.
    const floorW = W - (terraces - 1) * .7, floorD = D - (terraces - 1) * .7;
    const nx = Math.ceil(floorW / 1.7), nz = Math.ceil(floorD / 1.25);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      box('platform', 'stone', -floorW / 2 + (i + .5) * floorW / nx, .06,
        -floorD / 2 + (j + .5) * floorD / nz, floorW / nx - .035, .055, floorD / nz - .028);
    }
    const blocks = Math.ceil(W / 1.2), blockWidth = W / blocks;
    for (let row = 0; row < Math.ceil(P / .32); row++) for (let col = 0; col < blocks; col++) {
      const x = -W / 2 + (col + .5) * blockWidth, y = -P + (row + .5) * P / Math.ceil(P / .32);
      for (const sign of [-1, 1]) box('platform', 'stone', x, y, sign * (D / 2 + .015),
        blockWidth - .025, P / Math.ceil(P / .32) - .018, .035);
    }
    const steps = Math.ceil(P / .17), stairWidth = b.id.startsWith('ming') ? 8 : 4.8;
    const stairs = b.id.startsWith('ming') ? [-W * .24, 0, W * .24] : [0];
    for (const x of stairs) for (let i = 0; i < steps; i++) {
      const height = P * (i + 1) / steps;
      box('platform', 'stone', x, -P + height / 2,
        D / 2 + (steps - i - .5) * .32, stairWidth, height, .325);
    }
    if (terraces > 1) {
      const railW = floorW - .5, railD = floorD - .5;
      function stoneRail(a, b) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.ceil(length / 1.6);
        for (let i = 0; i <= count; i++) {
          const x = a[0] + (b[0] - a[0]) * i / count, z = a[1] + (b[1] - a[1]) * i / count;
          box('platform', 'stone', x, .59, z, .18, 1.05, .18);
          instance('platform', 'stone', diskGeo, [x, 1.17, z], [.25, .18, .25]);
          if (i < count) {
            const endX = a[0] + (b[0] - a[0]) * (i + 1) / count;
            const endZ = a[1] + (b[1] - a[1]) * (i + 1) / count;
            beam('platform', 'stone', [x, 1.02, z], [endX, 1.02, endZ], .15, true);
            beam('platform', 'stone', [x, .36, z], [endX, .36, endZ], .14, true);
            box('platform', 'stone', (x + endX) / 2, .64, (z + endZ) / 2, .09, .56, .09);
          }
        }
      }
      let previous = -railW / 2;
      for (const x of stairs) {
        stoneRail([previous, railD / 2], [x - stairWidth / 2 - .25, railD / 2]);
        previous = x + stairWidth / 2 + .25;
      }
      stoneRail([previous, railD / 2], [railW / 2, railD / 2]);
      stoneRail([-railW / 2, -railD / 2], [railW / 2, -railD / 2]);
      for (const sign of [-1, 1]) stoneRail([sign * railW / 2, -railD / 2], [sign * railW / 2, railD / 2]);
    }
    function pillar(x, z, base, top, diameter, lean = .008) {
      const insetX = -Math.sign(x) * (top - base) * lean;
      const insetZ = -Math.sign(z) * (top - base) * lean;
      beam('column', 'wood', [x, base + .14, z], [x + insetX, top, z + insetZ], diameter);
      instance('column', 'stone', cylinder, [x, base + .11, z], [diameter * 1.7, .22, diameter * 1.7]);
      instance('column', 'stone', cylinder, [x, base + .25, z], [diameter * 1.24, .14, diameter * 1.24]);
    }
    function bracket(x, z, y, recipe, rotation = 0) {
      const unit = b.module.cm / 100;
      const world = (px, py, pz) => [x + Math.cos(rotation) * px + Math.sin(rotation) * pz,
        y + py, z - Math.sin(rotation) * px + Math.cos(rotation) * pz];
      const local = (px, py, pz, w, h, d, material = 'wood', geometry = boxGeo) => {
        instance('bracket', material, geometry, world(px, py, pz), [w, h, d], [0, rotation, 0]);
      };
      const baseW = recipe.ludou.w * unit, baseH = recipe.ludou.h * unit;
      local(0, baseH / 2, 0, baseW, baseH, baseW, 'wood', blockGeo);
      const tierH = recipe.zuCai * unit;
      let reach = 0;
      recipe.tiers.forEach((tier, i) => {
        reach += (tier === 'ang' ? recipe.angJump || recipe.jump : recipe.jump) * unit;
        const ty = baseH + i * tierH;
        const thick = recipe.danCai * unit;
        if (tier === 'ang' && recipe.angReal !== false) {
          beam('bracket', 'wood', world(0, ty + thick / 2 + reach * (recipe.angSlope || .25), -.15),
            world(0, ty + thick / 2, reach + .08), thick * .78, true);
        } else local(0, ty + thick / 2, reach / 2, baseW * .48, thick, reach + baseW * .6);
        local(0, ty + thick * .95, reach, baseW * 1.55 + i * .12, thick * .8, baseW * .45, 'wood', armGeo);
        for (const dx of [-1, 0, 1]) {
          local(dx * baseW * .5, ty + thick * 1.37, reach, baseW * .4, thick * .42, baseW * .48, 'wood', blockGeo);
        }
        local(0, ty + thick * .8, -.18 - i * .09, baseW * 1.4, thick * .7, baseW * .42);
      });
      local(0, baseH + recipe.tiers.length * tierH, reach * .75,
        baseW * 2.0, tierH * .4, baseW * .65, b.id.startsWith('ming') ? 'paint' : 'wood');
    }
    function ring(xs, depth, y, diameter, recipe, base = 0, frontBase = base, lean = .008, veranda = false) {
      const z = depth / 2;
      for (const x of xs) for (const sign of [-1, 1]) {
        pillar(x, sign * z, sign === 1 ? frontBase : base, y, diameter, lean);
        bracket(x, sign * z, y, recipe, sign === 1 ? 0 : Math.PI);
      }
      for (const side of [-1, 1]) {
        for (const zz of veranda ? layout.zs : layout.zs.slice(1, -1)) {
          pillar(side * Math.abs(xs[0]), zz, base, y, diameter, lean);
          bracket(side * Math.abs(xs[0]), zz, y, recipe, side * Math.PI / 2);
        }
      }
      const span = xs.at(-1) - xs[0];
      for (const sign of [-1, 1]) {
        box('tie', 'wood', 0, y - .24, sign * z, span, .42, diameter * .68);
        box('tie', 'paint', 0, y - .08, sign * (z + .025), span, .095, diameter * .7);
      }
      for (const x of [xs[0], xs.at(-1)]) box('tie', 'wood', x, y - .24, 0, diameter * .68, .42, depth);
      for (let i = 0; i < xs.length - 1; i++) {
        const count = recipe.bujianPerBay || 1;
        for (let j = 1; j <= count; j++) for (const sign of [-1, 1]) {
          bracket(xs[i] + (xs[i + 1] - xs[i]) * j / (count + 1), sign * z, y, recipe,
            sign === 1 ? 0 : Math.PI);
        }
      }
    }
    function facade(xs, depth, base, top, upper = false) {
      const height = top - base - .6, sill = upper ? .65 : b.elevation.sill / 100;
      if (height < .5) return;
      for (const sign of [-1, 1]) {
        const z = sign * (depth / 2 - .16);
        for (let i = 0; i < xs.length - 1; i++) {
          const x = (xs[i] + xs[i + 1]) / 2, w = xs[i + 1] - xs[i] - .54;
          const kind = b.elevation.openings[Math.min(i, b.elevation.openings.length - 1)];
          if (kind === 'wall' || sign < 0 && i % 2 === 0) {
            box('wall', 'wall', x, base + height / 2, z, w, height, .38); continue;
          }
          const panelCount = Math.max(2, Math.round(w / .9)), pw = w / panelCount;
          box('window', 'dark', x, base + height / 2, z, w, height, .11);
          box('window', 'wood', x, base + .1, z + sign * .12, w, .18, .3);
          box('window', 'wood', x, base + height, z + sign * .12, w, .2, .26);
          if (sill) box('wall', 'wall', x, base + sill / 2, z, w, sill, .35);
          for (let j = 0; j < panelCount; j++) {
            const px = x - w / 2 + (j + .5) * pw, lower = Math.max(sill, height * .25);
            if (kind === 'door' && b.elevation.lattice === 'zhiling') {
              box('window', 'wood', px, base + height / 2, z + sign * .09, pw - .055, height - .16, .13);
              for (const fraction of [.25, .75]) box('window', 'wood', px,
                base + height * fraction, z + sign * .17, pw - .1, .08, .07);
              instance('window', 'metal', diskGeo,
                [px + pw * .26, base + height * .42, z + sign * .19], [.09, .03, .09], [Math.PI / 2, 0, 0]);
              continue;
            }
            box('window', 'wood', px, base + (sill + lower) / 2, z + sign * .08,
              pw - .08, Math.max(.12, lower - sill), .12);
            for (const dx of [-1, 1]) box('window', 'wood', px + dx * (pw / 2 - .035),
              base + height / 2, z + sign * .15, .065, height, .16);
            box('window', 'wood', px, base + lower, z + sign * .14, pw, .1, .16);
            const latticeH = height - lower - .2;
            for (const [x1, y1, x2, y2] of M.lattice(pw - .1, latticeH, b.elevation.lattice)) {
              const origin = px - (pw - .1) / 2;
              beam('window', 'wood', [origin + x1, base + lower + y1, z + sign * .17],
                [origin + x2, base + lower + y2, z + sign * .17], .028, true);
            }
            if (kind === 'door') instance('window', 'metal', diskGeo,
              [px + pw * .28, base + lower + .06, z + sign * .22], [.07, .045, .07], [Math.PI / 2, 0, 0]);
          }
        }
      }
      for (const sign of [-1, 1]) {
        box('wall', 'wall', sign * (Math.abs(xs[0]) - .13), base + height / 2, 0, .4, height, depth - .2);
      }
    }
    function rail(width, depth, y) {
      for (const sign of [-1, 1]) {
        box('beam', 'wood', 0, y, sign * depth / 2, width, .22, .22);
        box('window', 'wood', 0, y + .92, sign * depth / 2, width, .12, .12);
        box('window', 'wood', 0, y + .32, sign * depth / 2, width, .1, .12);
        for (let x = -width / 2; x <= width / 2; x += .68) {
          box('window', 'wood', x, y + .49, sign * depth / 2, .085, .98, .085);
        }
      }
      for (const x of [-width / 2, width / 2]) {
        box('window', 'wood', x, y + .92, 0, .12, .12, depth);
        for (let z = -depth / 2; z <= depth / 2; z += .68) box('window', 'wood', x, y + .46, z, .085, .92, .085);
      }
    }
    const roofs = [];
    for (const level of layout.levels) {
      const { xs, depth, top, base, diameter, recipe } = level;
      ring(xs, depth, top, diameter, recipe.bracket, base, level.frontBase, recipe.cejiao || 0);
      for (const column of recipe.columns.filter((c) => c.kind === 'inner' && !c.removed)) {
        const resolved = section.parts.find((p) => p.id === `L${level.index}-col-c${column.at}`);
        if (!resolved) continue;
        for (const x of xs.slice(1, -1)) {
          const z = layout.depth / 2 - (resolved.bbox.x + resolved.bbox.w / 2) / 100;
          pillar(x, z, resolved.bbox.y / 100, (resolved.bbox.y + resolved.bbox.h) / 100, column.d / 100, 0);
        }
      }
      if (level.index === 0) facade(xs, depth, 0, b.lowerEave ? b.lowerEave.columnH / 100 + .7 : top);
      else if (recipe.cap === 'roof') facade(xs, depth, base, top, true);
      if (recipe.cap === 'pingzuo') {
        const deck = top + level.bracketHeight;
        const deckW = xs.at(-1) - xs[0] + 1.4, deckD = depth + 1.4;
        for (const sign of [-1, 1]) {
          box('beam', 'wood', 0, deck, sign * (deckD / 2 - .9), deckW, .24, 1.8);
          box('beam', 'wood', sign * (deckW / 2 - .9), deck, 0, 1.8, .24, deckD - 3.6);
        }
        rail(xs.at(-1) - xs[0] + 1.4, depth + 1.4, deck + .12);
      }
      if (level.roofProfile) {
        const a = (xs.at(-1) - xs[0]) / 2 + (level.roofDepth - depth) / 2;
        const rb = level.roofDepth / 2;
        roofs.push({
          a, b: rb, profile: level.roofProfile, type: layout.roofType,
          ridge: layout.roofType === 'xieshan' ? a - rb * .32 : Math.max(a * .27, a - rb * .85),
          kick: Math.min(.68, layout.width * b.elevation.eaveCurve * .5), index: level.index,
        });
      } else if (recipe.cap === 'eave') {
        const out = level.reach + (recipe.eave?.overhang || 120) / 100;
        roofs.push({ a: (xs.at(-1) - xs[0]) / 2 + out, b: depth / 2 + out,
          ridge: (xs.at(-1) - xs[0]) / 2 - .15, innerB: depth / 2 - .15,
          profile: [[0, top + level.bracketHeight + .12], [1, top + level.bracketHeight + 1.05]],
          type: 'wudian', ring: true, kick: .3 });
      }
    }
    if (b.lowerEave) {
      const lower = b.lowerEave, h = lower.columnH / 100;
      ring(layout.xs, layout.lowerDepth, h, lower.columnD / 100, lower.bracket, 0, 0, .008, true);
      const br = root.ARCH_GEO.bracketHeight(lower.bracket, b.module.cm, 30).toLiao / 100;
      const out = root.ARCH_GEO.bracketOutreach(lower.bracket, b.module.cm) / 100
        + (lower.eave.overhang + lower.eave.feiyan) / 100;
      roofs.push({
        a: layout.width / 2 + out, b: layout.lowerDepth / 2 + out,
        ridge: Math.abs(layout.levels[0].xs[0]) - .15, innerB: layout.depth / 2 - .15,
        profile: [[0, h + br + .3], [1, h + br + .3 + (lower.depth / 100 + out) * lower.rise]],
        type: 'wudian', ring: true, kick: .45,
      });
    }
    // Extrude the existing transverse frame instead of inventing a different roof structure.
    for (const part of section.parts) {
      if (!['beam', 'strut', 'inclined', 'purlin', 'rafter'].includes(part.cat)) continue;
      const levelIndex = Number((part.id.match(/^L(\d+)/) || [0, 0])[1]);
      const level = layout.levels[levelIndex] || layout.levels[0];
      const roof = roofs.find((r) => r.index === levelIndex);
      for (const shape of part.shapes) {
        if (shape.t === 'circle' && part.cat === 'purlin') {
          const z = layout.depth / 2 - shape.cx / 100;
          const span = roof ? Math.abs(M.roofPoint(roof, 0, 1, 1 - Math.abs(z) / roof.b)[0]) * 2 - .5
            : level.xs.at(-1) - level.xs[0];
          beam('purlin', 'wood', [-span / 2, shape.cy / 100, z], [span / 2, shape.cy / 100, z], shape.r / 50);
          continue;
        }
        if (!['poly', 'rect'].includes(shape.t)) continue;
        const pts = shape.t === 'rect' ? [[shape.x, shape.y], [shape.x + shape.w, shape.y],
          [shape.x + shape.w, shape.y + shape.h], [shape.x, shape.y + shape.h]] : shape.pts;
        const outline = new T.Shape(pts.map(([x, y]) => {
          const t = roof ? 1 - Math.abs(x / 100 - layout.depth / 2) / roof.b : 0;
          const top = roof ? M.profileHeight(roof.profile, t) - .09 : Infinity;
          return new T.Vector2(x / 100, Math.min(y / 100, top));
        }));
        const geometry = new T.ExtrudeGeometry(outline, { depth: .24, bevelEnabled: false, steps: 1 });
        geometry.rotateY(Math.PI / 2);
        for (const x of level.xs.filter((x) => !roof || Math.abs(x) < roof.ridge - .4)) {
          mesh(part.cat, 'wood', geometry, [x - .12, 0, layout.depth / 2]);
        }
      }
    }
    let tiles = 0;
    for (const roof of roofs) {
      for (let side = 0; side < 4; side++) {
        const limit = side > 1 && roof.type === 'xieshan' ? .46 : 1;
        const rows = 28, cols = 48, vertices = [], indices = [], uv = [];
        for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
          const t = row / rows * limit, u = col / cols * 2 - 1;
          vertices.push(...M.roofPoint(roof, side, u, t)); uv.push(col / cols * 8, row / rows * 4);
        }
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          const a = row * (cols + 1) + col;
          indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
        geometry.computeVertexNormals(); mesh('roof', 'tile', geometry);
        const pathStart = new T.Vector3(...M.roofPoint(roof, side, 0, 0));
        const pathEnd = new T.Vector3(...M.roofPoint(roof, side, 0, limit));
        const courses = Math.max(3, Math.ceil(pathStart.distanceTo(pathEnd) / .45));
        for (let row = 0; row < courses; row++) {
          const t = (row + .5) / courses * limit;
          const left = new T.Vector3(...M.roofPoint(roof, side, -1, t));
          const right = new T.Vector3(...M.roofPoint(roof, side, 1, t));
          const count = Math.max(1, Math.floor(left.distanceTo(right) / .25));
          for (let col = 0; col < count; col++) {
            const u = (col + .5) / count * 2 - 1;
            const point = new T.Vector3(...M.roofPoint(roof, side, u, t));
            const prev = new T.Vector3(...M.roofPoint(roof, side, u, Math.max(0, t - .5 / courses * limit)));
            const next = new T.Vector3(...M.roofPoint(roof, side, u, Math.min(limit, t + .5 / courses * limit)));
            const tangent = next.clone().sub(prev).normalize();
            const across = side < 2 ? new T.Vector3(side === 0 ? -1 : 1, 0, 0)
              : new T.Vector3(0, 0, side === 2 ? 1 : -1);
            const normal = tangent.clone().cross(across).normalize();
            if (normal.y < 0) normal.negate();
            const xAxis = normal.clone().cross(tangent).normalize();
            const matrix = new T.Matrix4().makeBasis(xAxis, normal, tangent);
            object.rotation.setFromRotationMatrix(matrix);
            point.y += .035;
            instance('roof', 'tile', tileGeo, point.toArray(),
              [.18, .075, Math.min(.68, prev.distanceTo(next) * 1.13)],
              object.rotation.toArray().slice(0, 3), .15);
            tiles++;
          }
        }
        const eaveCount = Math.ceil(pathStart.distanceTo(pathEnd) > 0
          ? new T.Vector3(...M.roofPoint(roof, side, -1, 0)).distanceTo(new T.Vector3(...M.roofPoint(roof, side, 1, 0))) / .25 : 1);
        for (let i = 0; i < eaveCount; i++) {
          const u = (i + .5) / eaveCount * 2 - 1, p = M.roofPoint(roof, side, u, 0);
          instance('roof', 'ridge', diskGeo, [p[0], p[1] + .035, p[2]], [.205, .09, .205],
            side < 2 ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]);
          const inside = M.roofPoint(roof, side, u, .12);
          beam('rafter', 'wood', [p[0], p[1] - .17, p[2]], [inside[0], inside[1] - .2, inside[2]], .095);
        }
      }
      function ridgeLine(points, diameter) {
        for (let i = 1; i < points.length; i++) beam('roof', 'ridge', points[i - 1], points[i], diameter);
      }
      for (const side of [0, 1]) for (const u of [-1, 1]) {
        ridgeLine(Array.from({ length: 24 }, (_, i) => {
          const point = M.roofPoint(roof, side, u, i / 23); point[1] += .13; return point;
        }), .23);
      }
      if (!roof.ring) {
        const y = M.profileHeight(roof.profile, 1);
        box('roof', 'ridge', 0, y + .22, 0, roof.ridge * 2 + .2, .42, .36);
        beam('roof', 'ridge', [-roof.ridge, y + .48, 0], [roof.ridge, y + .48, 0], .24);
        for (const sign of [-1, 1]) {
          const shape = new T.Shape();
          shape.moveTo(-.32, 0); shape.lineTo(.42, 0); shape.quadraticCurveTo(.55, .85, .25, 1.6);
          shape.quadraticCurveTo(.13, .8, -.5, .72); shape.quadraticCurveTo(-.82, .48, -.32, .35);
          shape.closePath();
          const ornament = new T.ExtrudeGeometry(shape, { depth: .32, bevelEnabled: true,
            bevelThickness: .045, bevelSize: .035, bevelSegments: 2, steps: 1, curveSegments: 8 });
          const m = mesh('roof', 'ridge', ornament, [sign * roof.ridge, y + .4, -.16]);
          m.scale.x = sign;
        }
        if (roof.type === 'xieshan') for (const sign of [-1, 1]) {
          const bottom = M.profileHeight(roof.profile, .46), z = roof.b * .54;
          const gable = new T.Shape([new T.Vector2(-z, bottom), new T.Vector2(z, bottom), new T.Vector2(0, y)]);
          const geometry = new T.ExtrudeGeometry(gable, { depth: .14, bevelEnabled: false });
          geometry.rotateY(Math.PI / 2);
          mesh('wall', 'wood', geometry, [sign * roof.ridge - .07, 0, 0]);
        }
      }
    }
    for (const batch of batches.values()) {
      const m = new T.InstancedMesh(batch.geometry, materialFor(batch.cat, batch.material), batch.matrices.length);
      batch.matrices.forEach((matrix, i) => { m.setMatrixAt(i, matrix); m.setColorAt(i, batch.colors[i]); });
      m.castShadow = batch.geometry !== tileGeo;
      m.receiveShadow = true; m.userData.cat = batch.cat;
      m.computeBoundingSphere(); group(batch.cat).add(m);
    }
    model.position.y = P;
    model.userData = { layout, groups, materials, tiles, roofs: roofs.length };
    return model;
  }

  function create(container, onSelect) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '古建筑三维外观');
    renderer.domElement.setAttribute('tabindex', '0');
    const scene = new T.Scene(); scene.background = new T.Color('#d7dcd9');
    const camera = new T.PerspectiveCamera(36, 1, .1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .09;
    controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI * .48;
    controls.autoRotateSpeed = .6;
    const maps = { wood: texture('wood'), stone: texture('stone') };
    const hemi = new T.HemisphereLight('#f4f7ff', '#666c60', 1.15); scene.add(hemi);
    const sun = new T.DirectionalLight('#fff1d5', 2.8); sun.position.set(-35, 58, 35);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 220 });
    sun.shadow.normalBias = .055; sun.shadow.bias = -.00015; scene.add(sun);
    const fill = new T.DirectionalLight('#dbeaff', .8); fill.position.set(30, 18, -25); scene.add(fill);
    let env = null;
    function environment() {
      const generator = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
      if (env) env.dispose();
      env = generator.fromScene(room, .025); scene.environment = env.texture; scene.environmentIntensity = .4;
      room.dispose(); generator.dispose();
    }
    environment();
    const floor = new T.Mesh(new T.PlaneGeometry(1800, 1800), new T.MeshStandardMaterial({
      color: '#b2b9b4', roughness: 1,
    }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    let model = null, active = true, disposed = false, selected = null, exploded = false, currentStage = 9, contextLost = false;
    let frame = 0, lastFrame = 0, bounds = null;
    function draw() { if (model && active && !contextLost && !document.hidden) renderer.render(scene, camera); }
    renderer.domElement.addEventListener('webglcontextlost', () => {
      contextLost = true;
      // Release render-target listeners while they still refer to the lost context.
      env.dispose(); env = null; scene.environment = null;
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      contextLost = false; environment(); draw();
    });
    function resize() {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix(); if (model) fit(false); draw();
    }
    function fit(resetAngle = true, direction = 'perspective') {
      if (!model) return;
      bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
      const delta = !resetAngle ? camera.position.clone().sub(controls.target).normalize()
        : direction === 'front' ? new T.Vector3(0, .11, 1).normalize() : new T.Vector3(.8, .35, 1).normalize();
      if (delta.lengthSq() < .5) delta.set(.8, .35, 1).normalize();
      const right = new T.Vector3(0, 1, 0).cross(delta).normalize(), up = delta.clone().cross(right);
      const tangent = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      let distance = 0;
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
        const point = new T.Vector3(x * size.x, y * size.y, z * size.z);
        distance = Math.max(distance, point.dot(delta) + Math.abs(point.dot(right)) / (tangent * camera.aspect * .90),
          point.dot(delta) + Math.abs(point.dot(up)) / (tangent * .65));
      }
      controls.target.copy(center);
      camera.position.copy(controls.target).addScaledVector(delta, distance);
      controls.minDistance = Math.max(5, size.y * .45); controls.maxDistance = distance * 2.8;
      camera.far = Math.max(700, distance * 5); camera.updateProjectionMatrix(); controls.update();
    }
    function releaseModel() {
      if (!model) return;
      const geometries = new Set();
      model.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.isInstancedMesh) o.dispose();
      });
      geometries.forEach((g) => g.dispose());
      Object.values(model.userData.materials).forEach((m) => m.dispose()); scene.remove(model);
    }
    function load(b, section) {
      releaseModel(); selected = null; exploded = false;
      model = build(b, section, maps); scene.add(model); setStage(9); resize(); fit(); draw();
    }
    function setStage(value) {
      currentStage = value;
      if (model) for (const g of model.userData.groups.values()) g.visible = g.userData.stage <= value;
      draw();
    }
    function setExploded(value) {
      exploded = value;
      if (!model) return;
      const height = model.userData.layout.levels.at(-1).top;
      for (const g of model.userData.groups.values()) {
        const level = g.userData.stage;
        g.position.y = value && level > 0 ? level * Math.max(.45, height * .055) : 0;
      }
      fit(false); draw();
    }
    function highlight(cat) {
      selected = cat;
      if (!model) return;
      model.traverse((o) => {
        if (!o.material) return;
        o.material.emissive.set(selected && o.userData.cat === selected ? '#201b0b' : '#000000');
      });
      draw();
    }
    const raycaster = new T.Raycaster();
    let pointerStart = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { pointerStart = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!model || !pointerStart || Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1,
        1 - (e.clientY - rect.top) / rect.height * 2), camera);
      const hit = raycaster.intersectObject(model, true).find((h) => h.object.parent.visible);
      if (hit) { highlight(hit.object.userData.cat); onSelect(hit.object.userData.cat); }
    });
    renderer.domElement.addEventListener('keydown', (e) => {
      if (e.key === 'Home' || e.key === '0') { e.preventDefault(); fit(); }
    });
    controls.addEventListener('change', draw);
    function animate(time) {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (!active || document.hidden) { lastFrame = time; return; }
      controls.update(Math.min(.05, (time - (lastFrame || time)) / 1000)); lastFrame = time;
    }
    const observer = new ResizeObserver(resize); observer.observe(container);
    frame = requestAnimationFrame(animate);
    return {
      load, setStage, setExploded, highlight,
      capture() { draw(); return renderer.domElement.toDataURL('image/png'); },
      setActive(value) { active = value; if (value) { resize(); draw(); } },
      rotate(value) { controls.autoRotate = value; },
      view(direction) { fit(true, direction); draw(); },
      light(value) {
        sun.position.set(...(value === 'raking' ? [-45, 20, 22] : [-35, 58, 35]));
        sun.intensity = value === 'raking' ? 3.3 : 2.8; draw();
      },
      stats() {
        const screen = [];
        if (bounds) for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
            screen.push(new T.Vector3(x, y, z).project(camera).toArray());
          }
        return { ready: !!model, building: model?.userData.layout.id, tiles: model?.userData.tiles,
          roofs: model?.userData.roofs, stage: currentStage, exploded, active, contextLost,
          camera: camera.position.toArray(), target: controls.target.toArray(),
          calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
          bounds: bounds ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null, projectedBounds: screen };
      },
      inspectGeometry() {
        const geometries = new Set(), failures = [], instances = [];
        model?.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (o.isInstancedMesh) {
            if (!o.instanceMatrix.array.every(Number.isFinite)) failures.push('instance transform');
            instances.push(o.count);
          }
        });
        for (const geometry of geometries) {
          if (!geometry.attributes.position.array.every(Number.isFinite)) failures.push('vertex position');
          if (!geometry.attributes.normal.array.every(Number.isFinite)) failures.push('vertex normal');
        }
        return { failures, geometries: geometries.size, instances: instances.reduce((a, n) => a + n, 0) };
      },
      dispose() {
        disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); releaseModel();
        maps.wood.dispose(); maps.stone.dispose(); env?.dispose(); floor.geometry.dispose(); floor.material.dispose();
        renderer.dispose(); renderer.domElement.remove();
      },
    };
  }
  root.ARCH_REALISTIC = { create };
})(window);
