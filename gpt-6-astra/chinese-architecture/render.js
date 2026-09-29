/* render.js — Scene → SVG DOM. No state, no listeners. y is flipped here (model y-up → SVG y-down). */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (attrs && attrs.fill === 'none') e.style.fill = 'none';   // keep open paths open despite stylesheet fills
    if (parent) parent.appendChild(e);
    return e;
  }
  const fmt = (v) => Math.round(v * 10) / 10;

  function shapeEl(s) {
    if (s.t === 'rect') return el('rect', { x: fmt(s.x), y: fmt(-(s.y + s.h)), width: fmt(s.w), height: fmt(s.h) });
    if (s.t === 'circle') return el('circle', { cx: fmt(s.cx), cy: fmt(-s.cy), r: fmt(s.r) });
    if (s.t === 'line') return el('line', { x1: fmt(s.x1), y1: fmt(-s.y1), x2: fmt(s.x2), y2: fmt(-s.y2) });
    return el('polygon', { points: s.pts.map(p => fmt(p[0]) + ',' + fmt(-p[1])).join(' ') });
  }
  function pathFromShapes(shapes) {
    return shapes.map(s => {
      if (s.t === 'rect') return `M${fmt(s.x)},${fmt(-(s.y + s.h))}h${fmt(s.w)}v${fmt(s.h)}h${fmt(-s.w)}Z`;
      if (s.t === 'circle') return `M${fmt(s.cx - s.r)},${fmt(-s.cy)}a${fmt(s.r)},${fmt(s.r)} 0 1 0 ${fmt(2 * s.r)},0a${fmt(s.r)},${fmt(s.r)} 0 1 0 ${fmt(-2 * s.r)},0Z`;
      if (s.t === 'line') return `M${fmt(s.x1)},${fmt(-s.y1)}L${fmt(s.x2)},${fmt(-s.y2)}`;
      return 'M' + s.pts.map(p => fmt(p[0]) + ',' + fmt(-p[1])).join('L') + 'Z';
    }).join('');
  }

  // <defs>: hatch for end-view members, lattice patterns for windows. Ids prefixed per SVG.
  function defs(svg, prefix) {
    const d = el('defs', null, svg);
    const hatch = el('pattern', { id: prefix + '-hatch', class: 'pat-hatch', patternUnits: 'userSpaceOnUse', width: 9, height: 9, patternTransform: 'rotate(45)' }, d);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 9 }, hatch);
    const rough = el('pattern', { id: prefix + '-rough', class: 'pat-hatch', patternUnits: 'userSpaceOnUse', width: 14, height: 14, patternTransform: 'rotate(-20)' }, d);
    el('line', { x1: 0, y1: 7, x2: 14, y2: 7 }, rough);
    // 直棂窗: vertical bars
    const zl = el('pattern', { id: prefix + '-pat-zhiling', class: 'pat-lattice', patternUnits: 'userSpaceOnUse', width: 13, height: 13 }, d);
    el('rect', { x: 0, y: 0, width: 5, height: 13 }, zl);
    // 破子棂窗: split triangular bars (alternating thick / thin)
    const pz = el('pattern', { id: prefix + '-pat-pozi', class: 'pat-lattice', patternUnits: 'userSpaceOnUse', width: 14, height: 14 }, d);
    el('polygon', { points: '0,0 6,0 3,14' }, pz); el('rect', { x: 8, y: 0, width: 2, height: 14 }, pz);
    // 格子门 四斜方格 (diagonal lattice with a small square)
    const gz = el('pattern', { id: prefix + '-pat-gezi', class: 'pat-lattice', patternUnits: 'userSpaceOnUse', width: 24, height: 24 }, d);
    el('path', { d: 'M0,12L12,0L24,12L12,24Z', fill: 'none', 'stroke-width': 2.4 }, gz);
    el('path', { d: 'M0,0L24,24M24,0L0,24', fill: 'none', 'stroke-width': 1.2 }, gz);
    el('rect', { x: 9.5, y: 9.5, width: 5, height: 5 }, gz);
    // 三交六椀菱花: three line directions + florets
    const lh = el('pattern', { id: prefix + '-pat-linghua', class: 'pat-lattice', patternUnits: 'userSpaceOnUse', width: 28, height: 48.5 }, d);
    el('path', { d: 'M0,0L28,48.5M28,0L0,48.5M0,24.25L28,24.25M14,0V48.5', fill: 'none', 'stroke-width': 2 }, lh);
    el('circle', { cx: 14, cy: 24.25, r: 3.2 }, lh); el('circle', { cx: 0, cy: 0, r: 3.2 }, lh); el('circle', { cx: 28, cy: 0, r: 3.2 }, lh); el('circle', { cx: 0, cy: 48.5, r: 3.2 }, lh); el('circle', { cx: 28, cy: 48.5, r: 3.2 }, lh);
    return d;
  }

  // mountScene(svg, scene, { prefix, labels: 'none'|'dense', on: true → all parts visible immediately })
  function mountScene(svg, scene, opts) {
    opts = opts || {};
    const prefix = opts.prefix || 'sec';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    defs(svg, prefix);
    const frag = document.createDocumentFragment();
    const g = el('g', { class: 'scene' });
    const byId = {};
    const maxOrder = {};
    for (const p of scene.parts) maxOrder[p.stage] = Math.max(maxOrder[p.stage] || 0, p.order);
    for (const p of scene.parts) {
      const cls = ['part', 'cat-' + p.cat];
      for (const k of ['hatch', 'ghost', 'dashed', 'thin', 'rough', 'dim', 'panel', 'nolbl']) if (p.style[k]) cls.push('st-' + k);
      if (p.style.pattern) cls.push('st-pattern');
      if (opts.on) cls.push('on');
      const gp = el('g', { class: cls.join(' '), 'data-id': p.id, 'data-cat': p.cat, 'data-stage': p.stage, 'data-assembly': p.assembly || '', 'data-lens': p.lens || '', 'data-term': p.termKey || '' });
      // stagger: spread each stage over ≤ 1100 ms by assembly order, sub-parts add per-tier delay
      const span = Math.min(1100, 900);
      const dOrder = maxOrder[p.stage] ? (p.order / maxOrder[p.stage]) * span : 0;
      gp.style.setProperty('--d', Math.round(dOrder + p.tier * 55) + 'ms');
      gp.style.setProperty('--exx', fmt(p.explode.dx) + 'px');
      gp.style.setProperty('--exy', fmt(-p.explode.dy) + 'px');
      gp.style.setProperty('--rise', (p.cat === 'column' || p.cat === 'platform' || p.cat === 'ghost' ? 1 : -1));
      const sh = el('g', { class: 'shape' }, gp);
      for (const s of p.shapes) {
        const e = shapeEl(s);
        sh.appendChild(e);
        // inline style beats the stylesheet's fill rule (a presentation attribute would not)
        if (p.style.pattern) { const pe = shapeEl(s); pe.setAttribute('class', 'patfill'); pe.style.fill = `url(#${prefix}-pat-${p.style.pattern})`; sh.appendChild(pe); }
        if (p.style.hatch || p.style.rough) { const h = shapeEl(s); h.setAttribute('class', 'hatchfill'); h.style.fill = `url(#${prefix}-${p.style.rough ? 'rough' : 'hatch'})`; sh.appendChild(h); }
      }
      el('path', { class: 'hit', d: pathFromShapes(p.shapes) }, gp);
      // label (shown only in lens / dense mode via CSS)
      const lx = p.bbox.x + p.bbox.w / 2, ly = -(p.bbox.y + p.bbox.h / 2);
      const t = el('text', { class: 'lbl', x: fmt(lx), y: fmt(ly) }, gp);
      t.textContent = p.label.zh.replace(/（.*?）/g, '').split('·')[0];
      g.appendChild(gp);
      byId[p.id] = gp;
    }
    frag.appendChild(g);
    svg.appendChild(frag);
    return byId;
  }

  // view helpers (viewBox in SVG units = cm, y-down)
  function fitView(bbox, pad, aspect) {
    pad = pad == null ? Math.max(bbox.w, bbox.h) * 0.06 : pad;
    let x = bbox.x - pad, y = -(bbox.y + bbox.h) - pad, w = bbox.w + 2 * pad, h = bbox.h + 2 * pad;
    if (aspect) { // widen or heighten to match the viewport aspect so the drawing is centred
      if (w / h < aspect) { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
      else { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
    }
    return { x, y, w, h };
  }
  function applyView(svg, v) { svg.setAttribute('viewBox', `${fmt(v.x)} ${fmt(v.y)} ${fmt(v.w)} ${fmt(v.h)}`); }

  root.ARCH_RENDER = { mountScene, fitView, applyView, pathFromShapes, el };
})(typeof window !== 'undefined' ? window : globalThis);
