/* Shared centimetre recipes become a metre-scale exterior. No DOM or Three.js. */
(function (root) {
  'use strict';
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  function axes(bays) {
    const result = [-sum(bays) / 200];
    for (const bay of bays) result.push(result.at(-1) + bay / 100);
    return result;
  }
  function profile(part, depth) {
    const heights = new Map();
    for (const point of part.shapes[0].pts) {
      if (point[0] <= depth / 2 + .01) {
        heights.set(point[0], Math.max(heights.get(point[0]) || -Infinity, point[1]));
      }
    }
    const points = [...heights].sort((a, b) => a[0] - b[0]);
    const start = points[0][0], end = points.at(-1)[0];
    return points.map(([x, y]) => [(x - start) / (end - start), y / 100]);
  }
  function profileHeight(points, t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [x0, y0] = points[i - 1], [x1, y1] = points[i];
        return y0 + (y1 - y0) * (t - x0) / (x1 - x0);
      }
    }
    return points.at(-1)[1];
  }
  function layout(building, section) {
    const b = building, depth = sum(b.layers[0].depthBays);
    const x = axes(b.elevation.bays), z = axes(b.layers[0].depthBays);
    const width = x.at(-1) - x[0];
    const lower = b.lowerEave;
    const mainX = lower ? x.slice(1, -1) : x;
    const levels = b.layers.map((layer, index) => {
      const columns = section.parts.filter((p) => new RegExp(`^L${index}-col-c\\d+$`).test(p.id));
      const front = columns.find((p) => p.id.endsWith('c0'));
      const rear = columns.at(-1);
      const base = Math.min(...columns.map((p) => p.bbox.y)) / 100;
      const top = (rear.bbox.y + rear.bbox.h) / 100;
      const bracket = root.ARCH_GEO.bracketHeight(layer.bracket, b.module.cm, 30);
      const roof = section.parts.find((p) => p.id === `L${index}-roof`);
      return {
        index, base, top, frontBase: front.bbox.y / 100,
        diameter: (layer.columns.find((c) => c.kind === 'eave').d || 50) / 100,
        xs: mainX.map((v, i) => v + (i === 0 ? 1 : i === mainX.length - 1 ? -1 : 0)
          * ((layer.columns[0].inset || 0) / 100)),
        depth: depth / 100 - 2 * (layer.columns[0].inset || 0) / 100,
        bracketHeight: bracket.toLiao / 100,
        reach: root.ARCH_GEO.bracketOutreach(layer.bracket, b.module.cm) / 100,
        recipe: layer, roofProfile: roof ? profile(roof, depth) : null,
        roofDepth: roof ? roof.bbox.w / 100 : null,
      };
    });
    return {
      id: b.id, width, depth: depth / 100, xs: x, zs: z, levels,
      platform: b.platform.h / 100,
      platformWidth: width + b.platform.margin / 50,
      platformDepth: depth / 100 + b.platform.margin / 50,
      lowerDepth: lower ? depth / 100 + lower.depth / 50 : null,
      roofType: b.elevation.roofType.includes('xieshan') ? 'xieshan' : 'wudian',
    };
  }
  function roofPoint(roof, side, u, t) {
    const gable = roof.type === 'xieshan';
    const shoulder = gable ? Math.min(1, t / .46) : t;
    const half = roof.a + (roof.ridge - roof.a) * shoulder;
    const kick = roof.kick * Math.pow(Math.abs(u), 8) * Math.pow(1 - t, 3);
    const y = profileHeight(roof.profile, t) + kick;
    const depth = roof.b + ((roof.innerB || 0) - roof.b) * t;
    if (side < 2) return [u * half, y, (side === 0 ? 1 : -1) * depth];
    return [(side === 2 ? 1 : -1) * half, y, u * depth];
  }
  function lattice(width, height, kind) {
    const segments = [];
    if (kind === 'zhiling' || kind === 'pozi') {
      for (let x = .12; x < width; x += .14) segments.push([x, 0, x, height]);
      return segments;
    }
    const slope = kind === 'linghua' ? Math.sqrt(3) : 1;
    for (const sign of [-1, 1]) {
      const m = slope * sign;
      for (let c = -width * slope; c <= height + width * slope; c += .32) {
        const lo = Math.max(0, Math.min(-c / m, (height - c) / m));
        const hi = Math.min(width, Math.max(-c / m, (height - c) / m));
        if (hi - lo > .03) segments.push([lo, Math.max(0, m * lo + c), hi, Math.min(height, m * hi + c)]);
      }
    }
    if (kind === 'linghua') for (let y = .32; y < height; y += .32) segments.push([0, y, width, y]);
    return segments;
  }
  root.ARCH_REALISTIC_MODEL = { axes, layout, profileHeight, roofPoint, lattice };
})(typeof window !== 'undefined' ? window : globalThis);
