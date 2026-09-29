/* geometry.js — pure functions: building recipe → Scene { parts, bbox, bboxExploded, assemblies, metrics }
 * Model units: cm of the real building, y-up, x = 0 at the front eave-column axis (bay line 0).
 * No DOM here. Works as a browser classic script and under Node (see test/geometry.test.js).
 */
(function (root) {
  'use strict';

  // ---------- shape helpers (model space, y-up) ----------
  const rect = (x, y, w, h) => ({ t: 'rect', x, y, w, h });           // y = bottom edge
  const poly = (pts) => ({ t: 'poly', pts });
  const circle = (cx, cy, r) => ({ t: 'circle', cx, cy, r });
  const line = (x1, y1, x2, y2) => ({ t: 'line', x1, y1, x2, y2 });
  const bar = (x1, y1, x2, y2, w) => {                                  // thick line as polygon
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * w / 2, ny = dx / L * w / 2;
    return poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
  };
  const trap = (cx, y, wBottom, wTop, h) =>                            // trapezoid (斗 / 驼峰)
    poly([[cx - wBottom / 2, y], [cx + wBottom / 2, y], [cx + wTop / 2, y + h], [cx - wTop / 2, y + h]]);
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  function shapeBBox(s) {
    if (s.t === 'rect') return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
    if (s.t === 'circle') return { x0: s.cx - s.r, y0: s.cy - s.r, x1: s.cx + s.r, y1: s.cy + s.r };
    if (s.t === 'line') return { x0: Math.min(s.x1, s.x2), y0: Math.min(s.y1, s.y2), x1: Math.max(s.x1, s.x2), y1: Math.max(s.y1, s.y2) };
    const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  function unionBox(boxes) {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const s of boxes) { b.x0 = Math.min(b.x0, s.x0); b.y0 = Math.min(b.y0, s.y0); b.x1 = Math.max(b.x1, s.x1); b.y1 = Math.max(b.y1, s.y1); }
    return b;
  }
  const toRect = (b) => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });

  // explode "levels" per category (how far a member lifts when disassembled)
  const LEVEL = { platform: 0, context: 0, wall: 0.4, window: 0.4, column: 0.25, ghost: 0.25, tie: 1, bracket: 2, ceiling: 2.6, beam: 3.2, strut: 3.9, inclined: 3.9, purlin: 4.8, rafter: 5.8, roof: 6.8 };

  // ---------- Scene builder ----------
  function Scene(kind) {
    this.kind = kind; this.parts = []; this.assemblies = {}; this.metrics = {}; this._ids = new Set();
  }
  Scene.prototype.add = function (p) {
    if (!p.shapes || !p.shapes.length) throw new Error('part without shapes: ' + p.id);
    if (this._ids.has(p.id)) { let k = 2; while (this._ids.has(p.id + '~' + k)) k++; p.id = p.id + '~' + k; }
    this._ids.add(p.id);
    p.cat = p.cat || 'context'; p.stage = p.stage == null ? 9 : p.stage; p.tier = p.tier || 0;
    p.order = p.order == null ? this.parts.filter(q => q.stage === p.stage).length : p.order;
    p.style = p.style || {}; p.lens = p.lens || null; p.assembly = p.assembly || null;
    p.label = p.label || { zh: p.id, en: '' };
    p.bbox = toRect(unionBox(p.shapes.map(shapeBBox)));
    p.explode = p.explode || { dx: 0, dy: 0 };
    this.parts.push(p);
    if (p.assembly) {
      const a = this.assemblies[p.assembly] || (this.assemblies[p.assembly] = { id: p.assembly, parts: [], lens: p.lens, label: p.label });
      a.parts.push(p.id); if (p.asmLabel) a.label = p.asmLabel; if (p.lens) a.lens = p.lens;
    }
    return p;
  };
  Scene.prototype.finish = function () {
    const bb = unionBox(this.parts.map(p => ({ x0: p.bbox.x, y0: p.bbox.y, x1: p.bbox.x + p.bbox.w, y1: p.bbox.y + p.bbox.h })));
    this.bbox = toRect(bb);
    const cx = this.bbox.x + this.bbox.w / 2, H = this.bbox.h;
    for (const p of this.parts) {
      const lv = LEVEL[p.cat] == null ? 1 : LEVEL[p.cat];
      const pcx = p.bbox.x + p.bbox.w / 2;
      const local = p.explodeLocal || { dx: 0, dy: 0 };
      p.explode = { dx: 0.16 * (pcx - cx) * (0.6 + lv * 0.12) + local.dx, dy: lv * 0.055 * H + local.dy };
    }
    const eb = unionBox(this.parts.map(p => ({ x0: p.bbox.x + p.explode.dx, y0: p.bbox.y + p.explode.dy, x1: p.bbox.x + p.bbox.w + p.explode.dx, y1: p.bbox.y + p.bbox.h + p.explode.dy })));
    this.bboxExploded = toRect(eb);
    for (const a of Object.values(this.assemblies)) {
      const ps = this.parts.filter(p => p.assembly === a.id);
      a.bbox = toRect(unionBox(ps.map(p => ({ x0: p.bbox.x, y0: p.bbox.y, x1: p.bbox.x + p.bbox.w, y1: p.bbox.y + p.bbox.h }))));
      a.cats = [...new Set(ps.map(p => p.cat))];
    }
    delete this._ids;
    return this;
  };

  // ---------- roof curves ----------
  // 举折 (Song): xs = purlin x (front 撩檐 → back 撩檐, symmetric), y0 = eave purlin y, rise = H/span
  function purlinsJuzhe(xs, y0, rise, fracs) {
    const n = xs.length, mid = (n - 1) / 2, span = xs[n - 1] - xs[0], H = rise * span;
    const ys = new Array(n).fill(y0);
    ys[mid] = y0 + H;
    fracs = fracs || [1 / 10, 1 / 20, 1 / 40, 1 / 80, 1 / 160];
    // front side: iterate from the ridge outward, lowering each purlin below the current chord to the eave
    let ax = xs[mid], ay = ys[mid];
    for (let i = mid - 1, k = 0; i >= 1; i--, k++) {
      const t = (xs[i] - xs[0]) / (ax - xs[0]);
      const chordY = y0 + t * (ay - y0);
      ys[i] = chordY - H * (fracs[k] || fracs[fracs.length - 1]);
      ax = xs[i]; ay = ys[i];
    }
    for (let i = mid + 1; i < n - 1; i++) ys[i] = ys[n - 1 - i];
    return ys;
  }
  // 举架 (Ming/Qing): steps eave→ridge, each = rise/run for that 步架
  function purlinsJujia(xs, y0, steps) {
    const n = xs.length, mid = (n - 1) / 2;
    const ys = new Array(n).fill(y0);
    for (let i = 1; i <= mid; i++) {
      const s = steps[Math.min(i - 1, steps.length - 1)];
      ys[i] = ys[i - 1] + s * (xs[i] - xs[i - 1]);
    }
    for (let i = mid + 1; i < n; i++) ys[i] = ys[n - 1 - i];
    return ys;
  }

  // ---------- bracket set (铺作 / 斗栱) in section, side view ----------
  // r: BracketRecipe in module units; M = cm per module; xa = column axis; yb = base (top of column/普拍枋);
  // dir = -1 (front, outward is -x) or +1 (back). Returns geometry summary + adds parts to scene.
  function bracketSet(sc, r, M, xa, yb, dir, asm, stage, o) {
    o = o || {};
    const f = v => v * M;
    const ludouW = f(r.ludou.w), ludouH = f(r.ludou.h);
    const danCai = f(r.danCai), zuCai = f(r.zuCai), qi = f(r.qi), thick = f(r.thick || 10);
    const slope = r.angSlope == null ? 0.27 : r.angSlope;
    const purlinD = o.purlinD || 30;
    const label = (zh, en) => ({ zh, en });
    const P = (id, cat, lbl, termKey, shapes, tier, extra) => sc.add(Object.assign({
      id: asm + '-' + id, cat, label: lbl, termKey, shapes, stage, tier, assembly: asm, lens: 'bracket',
      asmLabel: label(r.name, r.en || 'bracket set'), explodeLocal: { dx: 0, dy: tier * zuCai * 0.9 }
    }, extra || {}));
    const isMing = r.system === 'doukou';

    // 栌斗 / 坐斗
    P('ludou', 'bracket', isMing ? label('坐斗', 'cap block (zuo dou)') : label('栌斗', 'cap block (lu dou)'), isMing ? 'zuo-dou' : 'lu-dou',
      [trap(xa, yb, ludouW * 0.72, ludouW, ludouH)], 0);
    const yLudouTop = yb + ludouH;
    let out = 0, y = yLudouTop, tipTop = yLudouTop - qi; // tipTop: top of the tip block of the previous tier
    const innerTiers = (r.inner && r.inner.tiers) || [];
    let innerOut = 0;
    const tiers = r.tiers;
    for (let k = 0; k < tiers.length; k++) {
      const t = tiers[k];
      const jumpLen = f(t === 'ang' ? (r.angJump || r.jump) : r.jump);
      const prevOut = out; out += jumpLen;
      const hasInner = k < innerTiers.length;
      if (hasInner) innerOut += f(r.inner.jump || r.jump);
      const xTip = xa + dir * out;
      const xInner = hasInner ? xa - dir * innerOut : xa - dir * (thick / 2 + f(6));
      const tierN = k + 1;
      if (t === 'hua' || t === 'qiao') {
        const x0 = Math.min(xTip, xInner), x1 = Math.max(xTip, xInner);
        const zh = isMing ? (k === 0 ? '头翘' : '二翘') : (k === 0 ? '第一跳华栱' : '第' + '一二三四五'[k] + '跳华栱');
        P('t' + k, 'bracket', label(zh + (hasInner ? '（后尾出里跳）' : ''), isMing ? 'qiao (projecting arm)' : 'hua gong (projecting arm), jump ' + tierN),
          isMing ? 'qiao' : 'hua-gong', [rect(x0, y, x1 - x0, danCai)], tierN);
        // tip block 交互斗
        P('t' + k + 'd', 'bracket', label('交互斗', 'tip block'), 'jiao-hu-dou', [trap(xTip, y + danCai, f(11), f(16), qi)], tierN, { style: { thin: true, nolbl: true } });
        if (hasInner) P('t' + k + 'di', 'bracket', label('交互斗（里跳）', 'inner tip block'), 'jiao-hu-dou', [trap(xInner, y + danCai, f(11), f(16), qi)], tierN, { style: { thin: true, nolbl: true } });
        tipTop = y + danCai + qi;
        // 计心: transverse 瓜子栱 end-view at this tip, sitting on the tip block
        if (r.jixin && r.jixin[k] && k < tiers.length - 1) {
          P('t' + k + 'g', 'bracket', label('瓜子栱（计心，端视）', 'gua zi gong, transverse (end view)'), 'gua-zi-gong',
            [rect(xTip - thick / 2 - f(2), tipTop, thick + f(4), danCai)], tierN, { style: { hatch: true } });
        }
      } else { // 'ang'
        const real = r.angReal !== false;
        if (real) {
          const xPass = xa + dir * prevOut, yPass = tipTop + (k === 0 ? qi : 0);
          const tail = f(r.angTail || 70);
          const xHead = xTip + dir * f(9);
          const yHead = yPass - slope * (out - prevOut + f(9));
          const xTail = xa - dir * tail, yTail = yPass + slope * (prevOut + tail);
          const beak = f(14);
          // body: tail bottom → head bottom tip → beveled head top → tail top
          const pts = [[xTail, yTail], [xHead, yHead], [xHead - dir * beak, yHead + danCai * 0.55], [xHead - dir * beak * 1.6, yHead + danCai], [xTail, yTail + danCai]];
          P('t' + k, 'bracket', label('下昂（真昂）', 'xia ang, true descending cantilever'), 'xia-ang', [poly(pts)], tierN);
          const yTipTopAng = yHead + slope * f(9) + danCai; // approx top of ang over the tip
          P('t' + k + 'd', 'bracket', label('交互斗', 'tip block'), 'jiao-hu-dou', [trap(xTip, yTipTopAng - f(2), f(11), f(16), qi)], tierN, { style: { thin: true, nolbl: true } });
          tipTop = yTipTopAng - f(2) + qi;
          if (r.jixin && r.jixin[k] && k < tiers.length - 1) {
            P('t' + k + 'g', 'bracket', label('瓜子栱（计心，端视）', 'gua zi gong, transverse (end view)'), 'gua-zi-gong',
              [rect(xTip - thick / 2 - f(2), tipTop, thick + f(4), danCai)], tierN, { style: { hatch: true } });
          }
        } else { // 假昂: horizontal arm with an ang-shaped beak
          const xIn = xa - dir * (thick / 2 + f(6));
          const x0 = Math.min(xTip, xIn), x1 = Math.max(xTip, xIn);
          const beak = f(12);
          const pts = dir < 0
            ? [[x1, y], [xTip - beak * 0.4, y], [xTip - beak, y - danCai * 0.6], [xTip - beak * 0.4, y + danCai], [x1, y + danCai]]
            : [[x0, y], [xTip + beak * 0.4, y], [xTip + beak, y - danCai * 0.6], [xTip + beak * 0.4, y + danCai], [x0, y + danCai]];
          P('t' + k, 'bracket', label(isMing ? (k === tiers.length - 1 ? '二昂（假昂）' : '头昂（假昂）') : '假昂', 'jia ang, false (horizontal) ang'), 'jia-ang', [poly(pts)], tierN);
          P('t' + k + 'd', 'bracket', label(isMing ? '十八斗' : '交互斗', 'tip block'), 'jiao-hu-dou', [trap(xTip, y + danCai, f(11), f(16), qi)], tierN, { style: { thin: true, nolbl: true } });
          tipTop = y + danCai + qi;
        }
      }
      // axis stack: 泥道栱 / 柱头枋 end-view (正心栱枋 in Ming)
      P('s' + k, 'bracket', k === 0 ? label(isMing ? '正心瓜栱（端视）' : '泥道栱（端视）', 'ni dao gong, transverse arm on the axis (end view)') : label(isMing ? '正心枋（端视）' : '柱头枋（端视）', 'zhu tou fang, longitudinal tie (end view)'),
        'zhu-tou-fang', [rect(xa - thick / 2, y, thick, danCai)], tierN, { style: { hatch: true, nolbl: true } });
      y += zuCai;
    }
    // 耍头 + 令栱 + 替木 + 撩檐槫 (or 平坐: 枋)
    const xTipEnd = xa + dir * out;
    const ySha = tipTop;
    const n = tiers.length;
    if (r.shuatou !== false) {
      const xIn = xa - dir * (thick / 2 + f(4));
      const xOut = xTipEnd + dir * f(10);
      const x0 = Math.min(xIn, xOut), x1 = Math.max(xIn, xOut);
      const zh = isMing ? '蚂蚱头（耍头）' : (r.shuatou === 'ang' ? '昂形耍头' : '耍头（批竹）');
      P('sha', 'bracket', label(zh, 'shua tou, capping arm'), isMing ? 'ma-zha-tou' : 'shua-tou', [rect(x0, ySha, x1 - x0, danCai)], n + 1);
      P('s' + n, 'bracket', label(isMing ? '正心枋（端视）' : '柱头枋（端视）', 'zhu tou fang (end view)'), 'zhu-tou-fang', [rect(xa - thick / 2, y, thick, danCai)], n + 1, { style: { hatch: true, nolbl: true } });
    }
    let yTop;
    if (r.cap === 'fang') { // 平坐: 令栱 → 地面枋
      P('ling', 'bracket', label('令栱（端视）', 'ling gong (end view)'), 'ling-gong', [rect(xTipEnd - thick / 2 - f(3), ySha, thick + f(6), danCai)], n + 1, { style: { hatch: true } });
      P('fang', 'bracket', label('平坐地面枋', 'floor tie of the terrace'), 'lou-ban', [rect(xTipEnd - f(12), ySha + danCai, f(24), f(12))], n + 2);
      yTop = ySha + danCai + f(12);
      return { outreach: out, innerOut, yInnerTop: yLudouTop + innerTiers.length * zuCai, yAxisTop: y + danCai, yTop, liao: null, height: yTop - yb };
    }
    P('ling', 'bracket', label(isMing ? '厢栱（端视）' : '令栱（端视）', 'ling gong, outermost transverse arm (end view)'), 'ling-gong', [rect(xTipEnd - thick / 2 - f(3), ySha, thick + f(6), danCai)], n + 1, { style: { hatch: true } });
    P('sd', 'bracket', label('散斗', 'san dou, small block'), 'jiao-hu-dou', [trap(xTipEnd, ySha + danCai, f(10), f(14), qi)], n + 2, { style: { thin: true, nolbl: true } });
    let yLiaoBottom;
    if (isMing) {
      P('tyf', 'bracket', label('挑檐枋', 'tiao yan fang, eave tie'), 'ti-mu', [rect(xTipEnd - thick / 2, ySha + danCai + qi, thick, f(1.4))], n + 2);
      yLiaoBottom = ySha + danCai + qi + f(1.4);
    } else {
      P('timu', 'bracket', label('替木', 'ti mu, saddle timber'), 'ti-mu', [rect(xTipEnd - f(14), ySha + danCai + qi, f(28), f(6))], n + 2);
      yLiaoBottom = ySha + danCai + qi + f(6);
    }
    const liao = { x: xTipEnd, y: yLiaoBottom + purlinD / 2 };
    yTop = yLiaoBottom;
    return { outreach: out, innerOut, yInnerTop: yLudouTop + innerTiers.length * zuCai, yAxisTop: y + danCai, yTop, liao, height: yLiaoBottom - yb };
  }

  // inner-column bracket (殿堂造 内柱铺作): symmetric cluster of projecting arms
  function innerBracketSet(sc, r, M, xa, yb, asm, stage) {
    const f = v => v * M;
    const ludouW = f(r.ludou.w), ludouH = f(r.ludou.h), danCai = f(r.danCai), zuCai = f(r.zuCai), qi = f(r.qi), thick = f(r.thick || 10);
    const label = (zh, en) => ({ zh, en });
    const P = (id, lbl, termKey, shapes, tier, extra) => sc.add(Object.assign({ id: asm + '-' + id, cat: 'bracket', label: lbl, termKey, shapes, stage, tier, assembly: asm, lens: 'bracket', asmLabel: label(r.name || '内柱铺作', 'inner bracket set'), explodeLocal: { dx: 0, dy: tier * zuCai * 0.9 } }, extra || {}));
    P('ludou', label('栌斗', 'cap block'), 'lu-dou', [trap(xa, yb, ludouW * 0.72, ludouW, ludouH)], 0);
    let y = yb + ludouH, out = 0;
    for (let k = 0; k < r.tiers.length; k++) {
      out += f(r.jump);
      P('t' + k, label('华栱（双向出跳）', 'hua gong, projecting both ways'), 'hua-gong', [rect(xa - out, y, out * 2, danCai)], k + 1);
      P('t' + k + 'd1', label('交互斗', 'tip block'), 'jiao-hu-dou', [trap(xa - out, y + danCai, f(11), f(16), qi)], k + 1, { style: { thin: true, nolbl: true } });
      P('t' + k + 'd2', label('交互斗', 'tip block'), 'jiao-hu-dou', [trap(xa + out, y + danCai, f(11), f(16), qi)], k + 1, { style: { thin: true, nolbl: true } });
      P('s' + k, label(k === 0 ? '泥道栱（端视）' : '内额枋（端视）', 'axis tie (end view)'), 'zhu-tou-fang', [rect(xa - thick / 2, y, thick, danCai)], k + 1, { style: { hatch: true, nolbl: true } });
      y += zuCai;
    }
    return { yTop: y, outreach: out, height: y - yb };
  }

  // ---------- column ----------
  function columnPart(sc, id, x, y0, h, d, lean, lbl, termKey, stage, extra) {
    const top = y0 + h;
    const dTop = d * 0.88; // 卷杀: gentle taper at the head
    const pts = [[x - d / 2, y0], [x + d / 2, y0], [x + lean + dTop / 2, top - d * 0.25], [x + lean + dTop / 2 * 0.92, top], [x + lean - dTop / 2 * 0.92, top], [x + lean - dTop / 2, top - d * 0.25]];
    return sc.add(Object.assign({ id, cat: 'column', label: lbl, termKey, shapes: [poly(pts)], stage, lens: 'column' }, extra || {}));
  }

  // ---------- section scene ----------
  function sectionScene(b, opts) {
    opts = opts || {};
    const ex = opts.exaggerate || 1;
    const sc = new Scene('section');
    const M = b.module.cm;
    const f = v => v * M;
    const L0 = b.layers[0];
    const bays = L0.depthBays;
    const bayX = [0]; for (const w of bays) bayX.push(bayX[bayX.length - 1] + w);
    const depth = bayX[bayX.length - 1];
    const nLines = bayX.length - 1;
    const roofLayer = b.layers[b.layers.length - 1];
    const purlinD = (roofLayer.roof && roofLayer.roof.purlinD) || 30;
    const zh = (s, e) => ({ zh: s, en: e });
    const tokenX = (tok, layer) => {           // 'c2' column line, 'p3' purlin index, number cm
      if (typeof tok === 'number') return tok;
      if (tok[0] === 'c') return bayX[+tok.slice(1)];
      throw new Error('bad token ' + tok);
    };

    // ---- platform 台基 ----
    const pm = b.platform.margin, ph = b.platform.h;
    sc.add({ id: 'platform', cat: 'platform', label: zh('台基', 'platform (tai ji)'), termKey: 'tai-ji', stage: 0, shapes: [poly([[-pm, -ph], [depth + pm, -ph], [depth + pm - 12, 0], [-pm + 12, 0]])], lens: 'column' });
    if (b.platform.yuetai) { // 月台 in front
      const yt = b.platform.yuetai;
      sc.add({ id: 'yuetai', cat: 'platform', label: zh('月台', 'moon terrace'), termKey: 'tai-ji', stage: 0, shapes: [rect(-pm - yt.w, -ph, yt.w, ph - (yt.drop || 20))], style: { thin: true } });
    }

    // ---- lower eave (副阶 / 下檐) needs to exist before lifted columns; compute its beams first ----
    const lower = b.lowerEave ? buildLowerEave(sc, b, M, bayX, depth, L0, purlinD, ex) : null;

    // ---- layers ----
    let y0 = 0;                       // base of the current layer's columns
    const layerInfo = [];
    b.layers.forEach((L, li) => {
      const info = { li, cols: [], brackets: {}, y0 };
      layerInfo.push(info);
      const cejiao = (L.cejiao || 0) * ex;
      const ghostH = L.columns.find(c => c.kind === 'eave' && typeof c.h === 'number');
      // resolve column x
      for (const c of L.columns) {
        let x = bayX[c.at];
        if (c.inset) x += (c.at === 0 ? 1 : c.at === nLines ? -1 : 0) * c.inset;
        const side = c.at === 0 ? 1 : c.at === nLines ? -1 : 0;   // lean direction (inward)
        info.cols.push({ c, x, side });
      }
      // columns with numeric heights now; 'auto' ones after the roof frame is known
      for (const cc of info.cols) {
        const c = cc.c;
        const id = 'L' + li + '-col-c' + c.at;
        if (c.removed) {
          let h = typeof c.h === 'number' ? c.h : (ghostH ? ghostH.h : 400);
          if (L.ties.includes('da-nei-e')) { const seat = (ghostH ? ghostH.h : 400) + tieHeight(L.ties, M) + bracketHeight(L.bracket, M, purlinD).innerTop + L.bracket.qi * M; cc.daneieTop = seat; h = seat - 84 - y0; }
          sc.add({ id: id + '-ghost', cat: 'ghost', label: zh(c.label || '减柱处（原柱位）', 'omitted column (jian zhu)'), termKey: c.termKey || 'jian-zhu', stage: 1, style: { ghost: true, dashed: true }, shapes: [rect(cc.x - (c.d || 50) / 2, y0, c.d || 50, h)], lens: 'column' });
          cc.top = y0 + h; cc.ghost = true; continue;
        }
        cc.base = y0;
        if (c.lifted && lower) { cc.base = lower.beamTopAt(cc.x); cc.lifted = true; }
        if (typeof c.top === 'number') { cc.h = c.top - cc.base; cc.top = c.top; }
        else if (typeof c.h === 'number') { cc.h = c.h; cc.top = cc.base + c.h; }
        else cc.auto = true;
      }
      // main frame geometry for this layer (also resolves auto heights)
      const cap = L.cap || 'roof';
      const eaveCols = info.cols.filter(cc => cc.c.kind === 'eave' && !cc.ghost);
      const front = eaveCols[0], back = eaveCols[eaveCols.length - 1];
      // pre-compute bracket height (needs nothing but the recipe) to know the eave purlin height
      const brH = bracketHeight(L.bracket, M, purlinD);
      const colTopF = front.top, colTopB = back.top;
      const tieH = tieHeight(L.ties, M);        // 普拍枋 / 平板枋 raise the bracket base
      const yBrF = colTopF + tieH, yBrB = colTopB + tieH;
      const outreach = bracketOutreach(L.bracket, M);
      const liaoF = { x: front.x - outreach, y: yBrF + brH.toLiao + purlinD / 2 };
      const liaoB = { x: back.x + outreach, y: yBrB + brH.toLiao + purlinD / 2 };

      let frame = null;
      if (cap === 'roof') frame = roofFrame(sc, b, L, li, M, info, bayX, liaoF, liaoB, purlinD, tokenX, brH, yBrF);
      else if (cap === 'eave') frame = eaveCap(sc, b, L, li, M, info, bayX, liaoF, liaoB, purlinD, brH, yBrF);
      else if (cap === 'pingzuo') frame = pingzuoCap(sc, b, L, li, M, info, bayX, brH, yBrF);

      // resolve 'auto' inner column heights: top = support level requested by beams
      for (const cc of info.cols) {
        if (!cc.auto) continue;
        const need = frame && frame.columnTop && frame.columnTop[cc.c.at];
        cc.h = (need != null ? need : (front.top)) - cc.base; cc.top = cc.base + cc.h;
      }
      // draw columns
      for (const cc of info.cols) {
        if (cc.ghost) continue;
        const c = cc.c;
        const id = 'L' + li + '-col-c' + c.at;
        const lean = cc.side * cejiao * cc.h;
        const kindLabel = c.label ? zh(c.label, c.en || '') : c.kind === 'eave' ? (li === 0 ? zh('檐柱', 'eave column (yan zhu)') : zh('上层檐柱', 'upper eave column')) : zh(li === 0 ? '内柱' : '上层内柱', 'inner column (nei zhu)');
        const termKey = c.termKey || (c.kind === 'eave' ? 'yan-zhu' : 'nei-zhu');
        columnPart(sc, id, cc.x, cc.base, cc.h, c.d || 50, lean, kindLabel, termKey, 1, { explodeLocal: { dx: 0, dy: 0 } });
        cc.lean = lean;
        if (li === 0 && !cc.lifted) sc.add({ id: id + '-base', cat: 'column', label: zh('柱础', 'column base (zhu chu)'), termKey: 'zhu-chu', stage: 1, shapes: [trap(cc.x, y0, (c.d || 50) * 1.6, (c.d || 50) * 1.25, 14)], style: { thin: true }, lens: 'column' });
        if (cc.lifted) sc.add({ id: id + '-liftghost', cat: 'ghost', label: zh('原柱位（减去，改由梁栿抬柱）', 'original column position, now carried by a beam'), termKey: 'tai-zhu', stage: 1, style: { ghost: true, dashed: true }, shapes: [rect(cc.x - (c.d || 50) / 2, y0, c.d || 50, cc.base - y0 - 2)], lens: 'column' });
        if (c.joint === 'chazhu') sc.add({ id: id + '-joint', cat: 'column', label: zh('叉柱造（柱脚开十字口叉于下层铺作）', 'cha zhu zao: column foot forked over the bracket set below'), termKey: 'cha-zhu-zao', stage: 1, shapes: [poly([[cc.x - (c.d || 50) / 2, cc.base + 26], [cc.x - 6, cc.base + 26], [cc.x - 6, cc.base - 34], [cc.x + 6, cc.base - 34], [cc.x + 6, cc.base + 26], [cc.x + (c.d || 50) / 2, cc.base + 26], [cc.x + (c.d || 50) / 2, cc.base + 30], [cc.x - (c.d || 50) / 2, cc.base + 30]])], style: { thin: true }, lens: 'column' });
        // ties at the head (端视)
        addTies(sc, L, li, M, cc, c, zh);
      }
      // 大内额 at ghost positions
      if (L.ties.includes('da-nei-e')) {
        for (const cc of info.cols) if (cc.ghost) {
          const seat = cc.daneieTop != null ? cc.daneieTop : cc.top;
          sc.add({ id: 'L' + li + '-daneie-c' + cc.c.at, cat: 'tie', label: zh('大内额（端视，跨越减柱处承梁）', 'da nei e: great interior lintel spanning the omitted column and carrying the beams'), termKey: 'da-nei-e', stage: 2, style: { hatch: true }, shapes: [rect(cc.x - 30, seat - 84, 60, 84)] });
        }
      }
      // bracket sets on eave columns (and inner columns if殿堂造)
      const bF = bracketSet(sc, L.bracket, M, front.x + (front.lean || 0), yBrF, -1, 'L' + li + '-br-c' + front.c.at, 3, { purlinD });
      const bB = bracketSet(sc, L.bracket, M, back.x + (back.lean || 0), yBrB, +1, 'L' + li + '-br-c' + back.c.at, 3, { purlinD });
      info.brackets.front = bF; info.brackets.back = bB;
      if (L.innerBracket) for (const cc of info.cols) if (cc.c.kind === 'inner' && !cc.ghost && !cc.c.noBracket) {
        info.brackets['c' + cc.c.at] = innerBracketSet(sc, L.innerBracket, M, cc.x, cc.top + tieHeight(L.innerTies || [], M), 'L' + li + '-br-c' + cc.c.at, 3);
      }
      // frame parts that depend on brackets drawn (nothing else) — set next layer base
      y0 = frame && frame.nextBase != null ? frame.nextBase : y0;
      info.frame = frame;
    });

    // ---- extra parts / overrides ----
    for (const p of (b.extraParts || [])) sc.add(JSON.parse(JSON.stringify(p)));
    for (const ov of (b.overrides || [])) { const p = sc.parts.find(q => q.id === ov.id); if (p) Object.assign(p, ov.patch); }
    sc.finish();

    // ---- metrics ----
    const inf0 = layerInfo[0];
    const mainLayer = layerInfo[layerInfo.length - 1];
    const primary = lower ? lower.metrics : { columnH: inf0.cols.find(c => c.c.kind === 'eave' && !c.ghost).h, bracketH: mainLayer.brackets ? mainLayer.brackets.front.height : 0, overhangTotal: mainLayer.frame && mainLayer.frame.overhangTotal };
    const rf = mainLayer.frame || {};
    sc.metrics = {
      columnH: Math.round(primary.columnH), bracketH: Math.round(primary.bracketH), bracketRatio: +(primary.bracketH / primary.columnH).toFixed(3),
      overhangTotal: Math.round(primary.overhangTotal || 0), overhangRatio: +((primary.overhangTotal || 0) / primary.columnH).toFixed(3),
      span: Math.round(rf.span || 0), rise: Math.round(rf.rise || 0), slopeRatio: rf.span ? +(rf.rise / rf.span).toFixed(3) : 0,
      hasChashou: !!(rf.hasChashou), hasTuojiao: !!(rf.hasTuojiao), hasBraces: sc.parts.some(p => p.termKey === 'xie-cheng'),
      removedColumns: sc.parts.filter(p => p.cat === 'ghost' && p.termKey === 'jian-zhu').length, angReal: !!(b.layers[b.layers.length - 1].bracket.angReal !== false && b.layers[b.layers.length - 1].bracket.tiers.includes('ang')),
      bujianPerBay: b.layers[b.layers.length - 1].bracket.bujianPerBay || 1, storeys: b.layers.length, cejiao: L0.cejiao || 0, ridge: (roofLayer.roof || {}).ridge,
      method: (roofLayer.roof || {}).method
    };
    return sc;
  }

  function tieHeight(ties, M) { let h = 0; if (ties.includes('pupai-fang')) h += 6 * M; if (ties.includes('ping-ban-fang')) h += 2 * M * 1.0; return h; }
  function addTies(sc, L, li, M, cc, c, zh) {
    const x = cc.x + (cc.lean || 0), top = cc.top;
    const f = v => v * M;
    const isMing = L.bracket.system === 'doukou';
    const id = 'L' + li + '-tie-c' + c.at;
    if (c.kind === 'eave' || L.ties.includes('nei-e')) {
      if (L.ties.includes('lan-e') && c.kind === 'eave') sc.add({ id: id + '-lane', cat: 'tie', label: zh('阑额（端视）', 'lan e: architrave between columns (end view)'), termKey: 'lan-e', stage: 2, style: { hatch: true }, shapes: [rect(x - f(5), top - f(15) - 4, f(10), f(15))] });
      if (L.ties.includes('nei-e') && c.kind === 'inner') sc.add({ id: id + '-neie', cat: 'tie', label: zh('内额（端视）', 'nei e: interior lintel (end view)'), termKey: 'nei-e', stage: 2, style: { hatch: true }, shapes: [rect(x - f(5), top - f(15) - 4, f(10), f(15))] });
      if (L.ties.includes('pupai-fang') && c.kind === 'eave') sc.add({ id: id + '-pupai', cat: 'tie', label: zh('普拍枋', 'pu pai fang: plate on the architrave'), termKey: 'pupai-fang', stage: 2, shapes: [rect(x - f(17), top, f(34), f(6))] });
      if (L.ties.includes('e-fang') && c.kind === 'eave') {
        sc.add({ id: id + '-efang', cat: 'tie', label: zh('大额枋（端视）', 'da e fang: great architrave (end view)'), termKey: 'e-fang', stage: 2, style: { hatch: true }, shapes: [rect(x - f(1.2), top - f(3.6), f(2.4), f(3.6))] });
        sc.add({ id: id + '-pbfang', cat: 'tie', label: zh('平板枋', 'ping ban fang: plate'), termKey: 'ping-ban-fang', stage: 2, shapes: [rect(x - f(1.75), top, f(3.5), f(2))] });
      }
    }
    if (isMing && c.kind === 'inner' && L.innerTies && L.innerTies.includes('e-fang')) sc.add({ id: id + '-efang', cat: 'tie', label: zh('金柱额枋（端视）', 'architrave on the inner column (end view)'), termKey: 'e-fang', stage: 2, style: { hatch: true }, shapes: [rect(x - f(1.2), top - f(3.6), f(2.4), f(3.6))] });
  }

  function bracketOutreach(r, M) { return sum(r.tiers.map(t => (t === 'ang' ? (r.angJump || r.jump) : r.jump))) * M; }
  function bracketHeight(r, M, purlinD) {
    // height from the bracket base to the underside of the eave purlin; 昂 tiers drop the tip
    const f = v => v * M;
    const slope = r.angSlope == null ? 0.27 : r.angSlope;
    let tipTop = f(r.ludou.h) - f(r.qi), y = f(r.ludou.h);
    for (let k = 0; k < r.tiers.length; k++) {
      const t = r.tiers[k];
      if (t === 'ang' && r.angReal !== false) {
        const jumpLen = f(r.angJump || r.jump);
        const yPass = tipTop + (k === 0 ? f(r.qi) : 0);
        const yHead = yPass - slope * (jumpLen + f(9));
        tipTop = yHead + slope * f(9) + f(r.danCai) - f(2) + f(r.qi);
      } else tipTop = y + f(r.danCai) + f(r.qi);
      y += f(r.zuCai);
    }
    const cap = r.system === 'doukou' ? f(1.4) : f(6);
    const toLiao = tipTop + f(r.danCai) + f(r.qi) + cap;
    return { toLiao, axisTop: y + f(r.danCai), innerTop: f(r.ludou.h) + ((r.inner && r.inner.tiers) || []).length * f(r.zuCai) };
  }

  // ---------- roof frame (梁架 + 檩 + 椽 + 屋面) ----------
  function roofFrame(sc, b, L, li, M, info, bayX, liaoF, liaoB, purlinD, tokenX, brH, yBr) {
    const R = L.roof, zh = (s, e) => ({ zh: s, en: e });
    const f = v => v * M;
    const r = purlinD / 2;
    const lay = 'L' + li;
    const xs = [liaoF.x].concat(R.purlinX, [liaoB.x]);
    const n = xs.length;
    if (n % 2 === 0) throw new Error(b.id + ': purlin count must be odd (got ' + n + ')');
    const ys = R.method === 'jujia' ? purlinsJujia(xs, liaoF.y, R.steps) : purlinsJuzhe(xs, liaoF.y, R.rise, R.juzheFractions);
    const mid = (n - 1) / 2;
    const purlins = xs.map((x, i) => ({ x, y: ys[i], i }));
    const purlinName = (i) => {
      const k = Math.min(i, n - 1 - i); // rank from eave
      if (i === mid) return R.method === 'jujia' ? ['脊檩', 'ridge purlin (ji lin)', 'ji-lin'] : ['脊槫', 'ridge purlin (ji tuan)', 'ji-tuan'];
      if (k === 0) return R.method === 'jujia' ? ['挑檐檩', 'eave purlin (tiao yan lin)', 'tiao-yan-lin'] : ['撩檐槫', 'eave purlin (liao yan tuan)', 'liao-yan-tuan'];
      if (R.method === 'jujia') return k === 1 ? ['正心檩', 'purlin over the column axis (zheng xin lin)', 'zheng-xin-lin'] : [['', '下金檩', '中金檩', '上金檩'][Math.min(k - 1, 3)] || '金檩', 'intermediate purlin (jin lin)', 'jin-lin'];
      const names = ['下平槫', '中平槫', '上平槫'];
      const inner = mid - 1; // number of intermediate purlins per side
      const nm = inner === 1 ? '上平槫' : inner === 2 ? (k === 1 ? '下平槫' : '上平槫') : (names[Math.min(k - 1, 2)] || '平槫');
      return [nm, 'intermediate purlin (ping tuan)', k === 1 ? 'xia-ping-tuan' : k >= inner ? 'shang-ping-tuan' : 'zhong-ping-tuan'];
    };
    // ---- beams (tiers) ----
    const colTopAt = {};      // requested top for auto columns
    const tiers = [];
    const resolveX = (tok) => {
      if (typeof tok === 'number') return tok;
      if (tok[0] === 'p') return purlins[+tok.slice(1)].x;
      if (tok[0] === 'c') { const cc = info.cols.find(q => q.c.at === +tok.slice(1)); return cc ? cc.x + (cc.lean || 0) * 0 : bayX[+tok.slice(1)]; }
      throw new Error('bad token ' + tok);
    };
    const eaveCols = info.cols.filter(cc => cc.c.kind === 'eave' && !cc.ghost);
    const front = eaveCols[0];
    const levelY = (tier, xA) => {
      if (tier.level === 'bracket') return yBr + brH.innerTop + f(L.bracket.qi);
      if (tier.level === 'top') return yBr + brH.axisTop;
      if (tier.level === 'column') { const cc = info.cols.find(q => Math.abs(q.x - xA) < 1); return cc && cc.top != null ? cc.top : yBr; }
      return null;
    };
    const douH = R.douH == null ? f(10) : R.douH;
    const purlinAt = (x) => purlins.find(p => Math.abs(p.x - x) < 1);
    const raw = [];
    for (const t of R.tiers) {
      raw.push(t);
      if (t.mirror) {
        const m = Object.assign({}, t, { mirror: false, _mirrored: true });
        m.x0 = mirrorTok(t.x1); m.x1 = mirrorTok(t.x0); raw.push(m);
      }
    }
    function mirrorTok(tok) {
      if (typeof tok === 'number') return bayX[bayX.length - 1] - tok;
      if (tok[0] === 'p') return 'p' + (n - 1 - +tok.slice(1));
      if (tok[0] === 'c') return 'c' + (bayX.length - 1 - +tok.slice(1));
      return tok;
    }
    for (const t of raw) {
      const xa = resolveX(t.x0), xb = resolveX(t.x1);
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      let top = levelY(t, x0);
      if (top != null && t.raise) top += t.raise;
      if (top == null) { // purlin level: beam carries the purlins at its ends, or the ones above it
        const pa = purlinAt(x0), pb = purlinAt(x1);
        const yy = [pa, pb].filter(Boolean).map(p => p.y - r - douH);
        if (yy.length) top = Math.min(...yy);
        else {
          const inside = purlins.filter(p => p.x > x0 + 1 && p.x < x1 - 1 && p.i !== 0 && p.i !== n - 1);
          top = inside.length ? Math.min(...inside.map(p => p.y)) - r - douH - f(12) : yBr + brH.axisTop;
        }
      }
      tiers.push({ t, x0, x1, top, bottom: top - t.h, name: t.name });
    }
    tiers.sort((a, b2) => a.top - b2.top);
    // beam supports — pass 1: tops requested from auto-height columns by the beams ending on them
    const seatEave = tieHeight(L.ties, M) + brH.innerTop + f(L.bracket.qi);
    const seatInner = (cc) => (L.innerBracket && cc.c.kind === 'inner' && !cc.c.noBracket) ? bracketHeightInner(L.innerBracket, M) + tieHeight(L.innerTies || [], M) : 0;
    tiers.forEach((tr) => {
      for (const xe of [tr.x0, tr.x1]) {
        const cc = info.cols.find(q => Math.abs(q.x - xe) < 1 && !q.ghost);
        if (cc && cc.auto) {
          const want = tr.bottom - (cc.c.kind === 'eave' ? seatEave : seatInner(cc));
          colTopAt[cc.c.at] = colTopAt[cc.c.at] == null ? want : Math.min(colTopAt[cc.c.at], want);
        }
      }
    });
    // mid-span auto columns stop under the lowest beam that passes over them
    for (const cc of info.cols) if (cc.auto && !cc.ghost && colTopAt[cc.c.at] == null) {
      const sp = tiers.filter(t => t.x0 < cc.x - 1 && t.x1 > cc.x + 1).sort((a, b2) => a.bottom - b2.bottom)[0];
      if (sp) colTopAt[cc.c.at] = sp.bottom - seatInner(cc);
    }
    // pass 2: struts wherever a beam end floats above whatever is beneath it
    const supports = [];
    tiers.forEach((tr, idx) => {
      for (const xe of [tr.x0, tr.x1]) {
        const cc = info.cols.find(q => Math.abs(q.x - xe) < 1 && !q.ghost);
        if (cc) {
          const top = cc.auto ? colTopAt[cc.c.at] : cc.top;
          const supportY = cc.c.kind === 'eave' ? top + tieHeight(L.ties, M) + brH.axisTop : top + seatInner(cc);
          if (tr.bottom - supportY > 16) supports.push({ x: xe, y0: supportY, y1: tr.bottom, kind: 'col', tier: idx });
          continue;
        }
        const below = tiers.filter(q => q !== tr && q.top < tr.bottom - 1 && q.x0 <= xe + 1 && q.x1 >= xe - 1).sort((a, b2) => b2.top - a.top)[0];
        if (below) { if (tr.bottom - below.top > 6) supports.push({ x: xe, y0: below.top, y1: tr.bottom, kind: 'beam', tier: idx }); continue; }
        const gh = info.cols.find(q => Math.abs(q.x - xe) < 1 && q.ghost);
        if (gh && gh.daneieTop != null && tr.bottom - gh.daneieTop > 6) supports.push({ x: xe, y0: gh.daneieTop, y1: tr.bottom, kind: 'daneie', tier: idx });
      }
    });
    // add beam parts
    let beamIdx = 0;
    for (const tr of tiers) {
      const t = tr.t;
      const w = tr.x1 - tr.x0;
      let shapes;
      if (t.shape === 'moon') { // 月梁: cambered top, tapered ends
        const cam = Math.min(t.h * 0.22, 14), e = Math.min(w * 0.06, 40);
        shapes = [poly([[tr.x0, tr.bottom + t.h * 0.12], [tr.x0 + e, tr.bottom], [tr.x1 - e, tr.bottom], [tr.x1, tr.bottom + t.h * 0.12], [tr.x1, tr.top - cam], [tr.x1 - e, tr.top], [tr.x0 + w / 2, tr.top + cam], [tr.x0 + e, tr.top], [tr.x0, tr.top - cam]])];
      } else shapes = [rect(tr.x0, tr.bottom, w, t.h)];
      const id = lay + '-beam-' + beamIdx++;
      const en = t.en || (t.termKey || 'beam');
      sc.add({ id, cat: 'beam', label: zh(t.name, en), termKey: t.termKey || 'liang', stage: 4, tier: Math.round(tr.top / 100), shapes, lens: 'frame', assembly: lay + '-frame', asmLabel: zh('梁架', 'roof frame (liang jia)'), style: t.role === 'cao' ? { rough: true } : {} });
      tr.id = id;
    }
    // ---- purlin carriers: struts / blocks ----
    const topTier = tiers[tiers.length - 1];
    let hasChashou = false, hasTuojiao = false;
    purlins.forEach((p, i) => {
      if (i === 0 || i === n - 1) return;              // eave purlins sit on the bracket sets
      const carrier = tiers.filter(q => q.x0 <= p.x + 1 && q.x1 >= p.x - 1).sort((a, b2) => b2.top - a.top)[0];
      if (!carrier) return;
      const atEnd = Math.abs(carrier.x0 - p.x) < 1 || Math.abs(carrier.x1 - p.x) < 1;
      const gap = (p.y - r) - carrier.top;
      if (i === mid) {
        // ridge: per recipe
        const rg = R.ridge || 'shuzhu+chashou';
        const cx = p.x;
        if (rg.includes('guazhu')) {
          sc.add({ id: lay + '-jiguazhu', cat: 'strut', label: zh('脊瓜柱', 'ridge post (ji gua zhu)'), termKey: 'ji-gua-zhu', stage: 5, shapes: [rect(cx - f(1.2), carrier.top, f(2.4), Math.max(gap, 10))], lens: 'frame', assembly: lay + '-frame' });
          if (rg.includes('jiaobei')) sc.add({ id: lay + '-jiaobei', cat: 'strut', label: zh('角背', 'jiao bei: post stiffener'), termKey: 'jiao-bei', stage: 5, shapes: [poly([[cx - f(3.4), carrier.top], [cx + f(3.4), carrier.top], [cx + f(2.4), carrier.top + Math.min(gap * 0.45, 70)], [cx - f(2.4), carrier.top + Math.min(gap * 0.45, 70)]])], lens: 'frame', assembly: lay + '-frame', style: { thin: true } });
        } else if (rg.includes('shuzhu')) {
          sc.add({ id: lay + '-shuzhu', cat: 'strut', label: zh('蜀柱（侏儒柱）', 'shu zhu: dwarf post under the ridge'), termKey: 'shu-zhu', stage: 5, shapes: [rect(cx - 12, carrier.top, 24, Math.max(gap - douH, 10)), trap(cx, carrier.top + Math.max(gap - douH, 10), 24, 36, douH)], lens: 'frame', assembly: lay + '-frame' });
        }
        if (rg.includes('chashou')) {
          hasChashou = true;
          const w = f(R.chashouW || 9);
          const yTop0 = carrier.top;
          const dx = (carrier.x1 - carrier.x0) / 2;
          sc.add({ id: lay + '-chashou-f', cat: 'inclined', label: zh('叉手', 'cha shou: inclined brace to the ridge'), termKey: 'cha-shou', stage: 5, shapes: [bar(carrier.x0 + w * 0.6, yTop0, cx - r * 0.9, p.y - r * 0.15, w)], lens: 'frame', assembly: lay + '-frame', explodeLocal: { dx: -dx * 0.25, dy: 0 } });
          sc.add({ id: lay + '-chashou-b', cat: 'inclined', label: zh('叉手', 'cha shou: inclined brace to the ridge'), termKey: 'cha-shou', stage: 5, shapes: [bar(carrier.x1 - w * 0.6, yTop0, cx + r * 0.9, p.y - r * 0.15, w)], lens: 'frame', assembly: lay + '-frame', explodeLocal: { dx: dx * 0.25, dy: 0 } });
        }
        return;
      }
      if (atEnd) {
        // purlin on the beam end via a block (斗 / 垫板)
        if (R.purlinAssembly === 'lin3') {
          sc.add({ id: lay + '-lin3-' + i, cat: 'purlin', label: zh('檩垫板·檩枋（檩三件）', 'purlin pad and tie (lin san jian)'), termKey: 'lin-san-jian', stage: 6, shapes: [rect(p.x - f(1.2), carrier.top, f(2.4), Math.max(gap, 6) * 0.55), rect(p.x - f(1.4), carrier.top + Math.max(gap, 6) * 0.55, f(2.8), Math.max(gap, 6) * 0.45)], lens: 'frame', assembly: lay + '-frame', style: { thin: true } });
        } else {
          sc.add({ id: lay + '-dou-' + i, cat: 'strut', label: zh('斗（承槫）', 'block carrying the purlin'), termKey: 'jiao-hu-dou', stage: 5, shapes: [trap(p.x, carrier.top, f(12), f(18), Math.max(gap, 6))], lens: 'frame', assembly: lay + '-frame', style: { thin: true } });
        }
      } else {
        addStrut(sc, lay + '-strut-' + i, R.strut, p.x, carrier.top, gap, f, zh, douH, lay);
      }
    });
    // beam-on-beam supports (驼峰 / 蜀柱 / 瓜柱 under beam ends)
    supports.forEach((s, k) => addStrut(sc, lay + '-bsup-' + k, R.strut, s.x, s.y0, s.y1 - s.y0, f, zh, 0, lay));
    // 托脚: from each lower beam end up to the next purlin inward
    if (R.tuojiao) {
      hasTuojiao = true;
      const w = f(R.tuojiaoW || 8);
      tiers.forEach((tr, k) => {
        if (tr === topTier || tr.t.role === 'ming' || tr.t.noTuojiao) return;   // 明栿 under a ceiling carry no 托脚
        for (const side of [-1, 1]) {
          const xe = side < 0 ? tr.x0 : tr.x1;
          // next purlin strictly inward of this end that is at or above this beam's top
          const cand = purlins.filter(p => side < 0 ? p.x > xe + 30 : p.x < xe - 30).filter(p => p.y - r > tr.top + 20).sort((a, b2) => side < 0 ? a.x - b2.x : b2.x - a.x)[0];
          if (!cand || cand.i === mid) continue;
          if (Math.abs(cand.x - xe) > 420) continue;
          sc.add({ id: lay + '-tuojiao-' + k + (side < 0 ? 'f' : 'b'), cat: 'inclined', label: zh('托脚', 'tuo jiao: inclined brace under a purlin'), termKey: 'tuo-jiao', stage: 5, shapes: [bar(xe - side * 10, tr.top, cand.x - side * r * 0.8, cand.y - r * 0.5, w)], lens: 'frame', assembly: lay + '-frame', explodeLocal: { dx: side * 30, dy: 0 } });
        }
      });
    }
    // ---- purlins ----
    purlins.forEach((p, i) => {
      const [nm, en, tk] = purlinName(i);
      sc.add({ id: lay + '-purlin-' + i, cat: 'purlin', label: zh(nm, en), termKey: tk, stage: 6, tier: Math.min(i, n - 1 - i), shapes: [circle(p.x, p.y, r)], lens: i === 0 || i === n - 1 ? 'eave' : 'frame', assembly: i === 0 ? lay + '-eave-f' : i === n - 1 ? lay + '-eave-b' : lay + '-frame' });
    });
    // ---- rafters, eaves ----
    const E = L.eave || { overhang: 150, feiyan: 0, feiyanRise: 0, rafterD: 12 };
    const rd = E.rafterD || 12;
    const topOf = (p) => p.y + r;
    for (let i = 0; i < n - 1; i++) {
      const a = purlins[i], c = purlins[i + 1];
      let ax = a.x, ay = topOf(a), cx = c.x, cy = topOf(c);
      const isEave = i === 0 || i === n - 2;
      if (isEave) {
        const sl = (cy - ay) / (cx - ax);
        if (i === 0) { ax = a.x - E.overhang; ay = topOf(a) - sl * E.overhang; }
        else { cx = c.x + E.overhang; cy = topOf(c) + sl * E.overhang; }
      }
      const nm = isEave ? ['檐椽', 'eave rafter (yan chuan)', 'yan-chuan'] : (i === mid - 1 || i === mid) ? ['脑椽', 'ridge rafter (nao chuan)', 'chuan'] : ['平椽（花架椽）', 'rafter (chuan)', 'chuan'];
      sc.add({ id: lay + '-rafter-' + i, cat: 'rafter', label: zh(nm[0], nm[1]), termKey: nm[2], stage: 7, tier: Math.min(i, n - 2 - i), shapes: [poly([[ax, ay], [cx, cy], [cx, cy + rd], [ax, ay + rd]])], lens: isEave ? 'eave' : null, assembly: i === 0 ? lay + '-eave-f' : i === n - 2 ? lay + '-eave-b' : null, asmLabel: zh('檐部', 'eave assembly') });
    }
    // 飞椽 on top of the eave rafters
    let tipF = { x: purlins[0].x - E.overhang, y: topOf(purlins[0]) - ((topOf(purlins[1]) - topOf(purlins[0])) / (purlins[1].x - purlins[0].x)) * E.overhang + rd };
    let tipB = { x: purlins[n - 1].x + E.overhang, y: topOf(purlins[n - 1]) + ((topOf(purlins[n - 2]) - topOf(purlins[n - 1])) / (purlins[n - 1].x - purlins[n - 2].x)) * -1 * -E.overhang * -1 + rd };
    // recompute tipB cleanly
    { const s = (topOf(purlins[n - 2]) - topOf(purlins[n - 1])) / (purlins[n - 2].x - purlins[n - 1].x); tipB = { x: purlins[n - 1].x + E.overhang, y: topOf(purlins[n - 1]) + s * E.overhang + rd }; }
    if (E.feiyan > 0) {
      const fr = E.feiyanRise || 0.15;
      const slF = (topOf(purlins[1]) - topOf(purlins[0])) / (purlins[1].x - purlins[0].x);
      const backLen = E.feiyan * 1.6;
      sc.add({ id: lay + '-feiyan-f', cat: 'rafter', label: zh('飞椽', 'fei chuan: flying rafter'), termKey: 'fei-chuan', stage: 7, shapes: [poly([[tipF.x + backLen, tipF.y + slF * backLen], [tipF.x, tipF.y], [tipF.x - E.feiyan, tipF.y - slF * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5], [tipF.x - E.feiyan, tipF.y - slF * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5 + rd * 0.8], [tipF.x + backLen, tipF.y + slF * backLen + rd * 0.8]])], lens: 'eave', assembly: lay + '-eave-f' });
      const slB = (topOf(purlins[n - 2]) - topOf(purlins[n - 1])) / (purlins[n - 1].x - purlins[n - 2].x);
      sc.add({ id: lay + '-feiyan-b', cat: 'rafter', label: zh('飞椽', 'fei chuan: flying rafter'), termKey: 'fei-chuan', stage: 7, shapes: [poly([[tipB.x - backLen, tipB.y - slB * backLen], [tipB.x, tipB.y], [tipB.x + E.feiyan, tipB.y + slB * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5], [tipB.x + E.feiyan, tipB.y + slB * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5 + rd * 0.8], [tipB.x - backLen, tipB.y - slB * backLen + rd * 0.8]])], lens: 'eave', assembly: lay + '-eave-b' });
      tipF = { x: tipF.x - E.feiyan, y: tipF.y - slF * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5 };
      tipB = { x: tipB.x + E.feiyan, y: tipB.y + slB * E.feiyan * (1 - fr) + E.feiyan * fr * 0.5 };
    }
    // 出檐 dimension annotation (context)
    const overhangTotal = front.x - tipF.x;
    sc.add({ id: lay + '-chuyan-dim', cat: 'context', label: zh('出檐 约 ' + (overhangTotal / 100).toFixed(1) + ' m（自檐柱中至檐口）', 'eave projection from column axis to drip'), termKey: 'chu-yan', stage: 9, style: { thin: true, dim: true }, shapes: [line(tipF.x, tipF.y - 60, front.x, tipF.y - 60), line(tipF.x, tipF.y - 75, tipF.x, tipF.y - 45), line(front.x, tipF.y - 75, front.x, tipF.y - 45)], lens: 'eave', assembly: lay + '-eave-f' });
    // ---- roof surface ----
    const T = R.roofT || 22, wb = 4;
    const topsF = purlins.map(p => [p.x, topOf(p) + rd + wb]);
    const roofPts = [[tipF.x, tipF.y + rd + wb]].concat(topsF, [[tipB.x, tipB.y + rd + wb]]);
    const outer = roofPts.map(([x, y]) => [x, y + T]).reverse();
    sc.add({ id: lay + '-roof', cat: 'roof', label: zh('屋面（望板·苫背·瓦）', 'roof surface: boards, mortar bed, tiles'), termKey: 'wu-mian', stage: 8, shapes: [poly(roofPts.concat(outer))], lens: null });
    const ridgeTop = topOf(purlins[mid]) + rd + wb + T;
    sc.add({ id: lay + '-zhengji', cat: 'roof', label: zh('正脊', 'main ridge (zheng ji)'), termKey: 'zheng-ji', stage: 8, tier: 1, shapes: [rect(purlins[mid].x - (R.ridgeW || 46) / 2, ridgeTop - 4, R.ridgeW || 46, R.ridgeH || 50)] });
    // ---- ceilings ----
    const ceils = Array.isArray(L.ceiling) ? L.ceiling : (L.ceiling ? [L.ceiling] : []);
    ceils.forEach((cl, k) => {
      if (!cl || !cl.kind) return;
      const x0 = resolveX(cl.x0), x1 = resolveX(cl.x1);
      if (typeof cl.y === 'object') cl = Object.assign({}, cl, { y: yBr + brH.axisTop + (cl.y.gap || 0) });
      const nm = cl.kind === 'ping-an' ? ['平闇（小方格天花）', 'ping an: fine-grid ceiling'] : cl.kind === 'ping-qi' ? ['平棊（大方格天花）', 'ping qi: coffered ceiling'] : ['天花', 'ceiling'];
      const shapes = [rect(Math.min(x0, x1), cl.y, Math.abs(x1 - x0), 8)];
      if (cl.zaojing) { const cx = (x0 + x1) / 2; shapes.push(poly([[cx - 120, cl.y + 8], [cx + 120, cl.y + 8], [cx + 70, cl.y + 70], [cx - 70, cl.y + 70]])); }
      sc.add({ id: lay + '-ceiling-' + k, cat: 'ceiling', label: zh(nm[0] + (cl.zaojing ? '·藻井' : ''), nm[1] + (cl.zaojing ? ' with zao jing (cupola)' : '')), termKey: cl.zaojing ? 'zao-jing' : cl.kind, stage: 9, shapes, style: { ghost: true } });
    });
    // ---- walls / doors at the eave planes (layer 0 only) ----
    if (li === 0 && L.section) {
      const topOf2 = (cc) => cc.top != null ? cc.top : (colTopAt[cc.c.at] != null ? colTopAt[cc.c.at] : yBr);
      const lanBottom = (cc) => topOf2(cc) - f(15) - 4;
      const S = L.section;
      const frontCol = front, backCol = eaveCols[eaveCols.length - 1];
      const colAt = (tok, dflt) => tok ? (info.cols.find(q => q.c.at === +tok.slice(1)) || dflt) : dflt;
      const fc = colAt(S.frontAt, frontCol), bc = colAt(S.backAt, backCol);
      if (S.front) addOpening(sc, lay + '-front-open', fc.x, 0, lanBottom(fc), S.front, f, zh, -1);
      if (S.back) addOpening(sc, lay + '-back-open', bc.x, 0, lanBottom(bc), S.back, f, zh, +1);
    }
    const span = liaoB.x - liaoF.x;
    return { purlins, tiers, columnTop: colTopAt, span, rise: ys[mid] - liaoF.y, hasChashou, hasTuojiao, overhangTotal, nextBase: null };
  }
  function bracketHeightInner(r, M) { return (r.ludou.h + r.tiers.length * r.zuCai) * M; }

  function addStrut(sc, id, kind, x, y0, gap, f, zh, douH, lay) {
    if (gap < 6) return;
    const asm = lay + '-frame';
    if (kind === 'tuofeng' && gap > 110) kind = 'shuzhu';   // a hump this tall reads as a post
    if (kind === 'tuofeng') {
      if (gap <= douH + 8) { sc.add({ id, cat: 'strut', label: zh('斗', 'block'), termKey: 'jiao-hu-dou', stage: 5, shapes: [trap(x, y0, f(12), f(18), gap)], lens: 'frame', assembly: asm, style: { thin: true } }); return; }
      const hHump = Math.max(gap - douH, 10);
      sc.add({ id, cat: 'strut', label: zh('驼峰（承斗）', 'tuo feng: camel-hump block'), termKey: 'tuo-feng', stage: 5, shapes: [poly([[x - Math.min(hHump * 0.9 + 30, 90), y0], [x + Math.min(hHump * 0.9 + 30, 90), y0], [x + 22, y0 + hHump], [x - 22, y0 + hHump]]), trap(x, y0 + hHump, f(12), f(18), douH)], lens: 'frame', assembly: asm });
    } else if (kind === 'guazhu') {
      sc.add({ id, cat: 'strut', label: zh('瓜柱', 'gua zhu: short post'), termKey: 'gua-zhu', stage: 5, shapes: [rect(x - f(1.1), y0, f(2.2), gap)], lens: 'frame', assembly: asm });
    } else { // shuzhu with a block on top
      const hh = Math.max(gap - douH, 6);
      sc.add({ id, cat: 'strut', label: zh('蜀柱', 'shu zhu: short post'), termKey: 'shu-zhu', stage: 5, shapes: [rect(x - 12, y0, 24, hh), trap(x, y0 + hh, 24, 36, Math.max(gap - hh, 4))], lens: 'frame', assembly: asm });
    }
  }
  function addOpening(sc, id, x, y0, y1, kind, f, zh, side) {
    const h = y1 - y0 - 6;
    if (kind === 'wall') {
      sc.add({ id, cat: 'wall', label: zh('檩墙（土坯厚墙）', 'thick earthen wall'), termKey: 'qiang', stage: 9, shapes: [rect(x - 55, y0, 110, h)], style: { ghost: true } });
    } else if (kind === 'door') {
      sc.add({ id, cat: 'window', label: zh('板门（侧视）', 'plank door, edge-on'), termKey: 'ban-men', stage: 9, shapes: [rect(x - 6, y0 + 8, 12, h - 8), rect(x - 20, y0 + h - 12, 40, 12)], lens: 'window' });
    } else if (kind === 'zhiling') {
      sc.add({ id, cat: 'window', label: zh('直棂窗（侧视，槛墙上）', 'vertical-mullion window over a sill wall, edge-on'), termKey: 'zhi-ling-chuang', stage: 9, shapes: [rect(x - 40, y0, 80, h * 0.35), rect(x - 5, y0 + h * 0.35, 10, h * 0.65)], lens: 'window' });
    } else if (kind === 'gezi' || kind === 'linghua') {
      sc.add({ id, cat: 'window', label: zh(kind === 'gezi' ? '格子门（侧视）' : '菱花格扇（侧视）', kind === 'gezi' ? 'lattice door, edge-on' : 'ling hua lattice panel, edge-on'), termKey: kind === 'gezi' ? 'ge-zi-men' : 'ling-hua-ge-shan', stage: 9, shapes: [rect(x - 5, y0 + 8, 10, h - 8), rect(x - 20, y0 + h * 0.62, 40, 8), rect(x - 20, y0 + 8, 40, 8)], lens: 'window' });
    }
  }

  // ---------- 腰檐 (eave cap of a lower storey) ----------
  function eaveCap(sc, b, L, li, M, info, bayX, liaoF, liaoB, purlinD, brH, yBr) {
    const zh = (s, e) => ({ zh: s, en: e });
    const f = v => v * M, r = purlinD / 2, lay = 'L' + li;
    const E = L.eave;
    const cols = info.cols.filter(cc => !cc.ghost);
    const eaveCols = cols.filter(cc => cc.c.kind === 'eave');
    const inner = cols.filter(cc => cc.c.kind === 'inner');
    const front = eaveCols[0], back = eaveCols[eaveCols.length - 1];
    const innerF = inner[0], innerB = inner[inner.length - 1];
    // inner columns are one jump taller in 观音阁; take them as given (numeric) or make them eave height + rise
    const rise = E.rise || 0.3;
    const colTopAt = {};
    for (const side of [-1, 1]) {
      const ec = side < 0 ? front : back, ic = side < 0 ? innerF : innerB, liao = side < 0 ? liaoF : liaoB;
      const xCol = ic ? ic.x : ec.x - side * 300;
      const xIn = ec.x - side * (E.innerX || 130);                 // waist-eave purlin sits just inside the eave line
      const yIn = liao.y + rise * Math.abs(xIn - liao.x);
      // 乳栿 from the eave bracket to the inner column
      const beamTop = yBr + brH.innerTop + f(L.bracket.qi);
      const x0 = Math.min(ec.x, xCol), x1 = Math.max(ec.x, xCol);
      sc.add({ id: lay + '-rufu-' + (side < 0 ? 'f' : 'b'), cat: 'beam', label: zh('乳栿', 'ru fu: two-rafter beam'), termKey: 'ru-fu', stage: 4, shapes: [rect(x0, beamTop - f(30), x1 - x0, f(30))], lens: 'frame', assembly: lay + '-frame', asmLabel: zh('腰檐梁架', 'waist-eave frame') });
      if (ic && ic.auto) colTopAt[ic.c.at] = beamTop - f(30) - (L.innerBracket ? bracketHeightInner(L.innerBracket, M) : 0);
      sc.add({ id: lay + '-purlin-in-' + (side < 0 ? 'f' : 'b'), cat: 'purlin', label: zh('下平槫（腰檐）', 'purlin of the waist eave'), termKey: 'xia-ping-tuan', stage: 6, shapes: [circle(xIn, yIn, r)], lens: 'frame', assembly: lay + '-frame' });
      addStrut(sc, lay + '-strut-' + (side < 0 ? 'f' : 'b'), 'shuzhu', xIn, beamTop, yIn - r - beamTop, f, zh, f(10), lay);
      sc.add({ id: lay + '-purlin-' + (side < 0 ? 'f' : 'b'), cat: 'purlin', label: zh('撩檐槫', 'eave purlin (liao yan tuan)'), termKey: 'liao-yan-tuan', stage: 6, shapes: [circle(liao.x, liao.y, r)], lens: 'eave', assembly: lay + '-eave-' + (side < 0 ? 'f' : 'b'), asmLabel: zh('腰檐檐部', 'waist-eave assembly') });
      // rafter from inner purlin over the eave purlin and out
      const rd = E.rafterD || 12;
      const sl = (yIn - liao.y) / (xIn - liao.x);
      const tipX = liao.x + side * E.overhang, tipY = liao.y + r - Math.abs(sl) * E.overhang;
      sc.add({ id: lay + '-rafter-' + (side < 0 ? 'f' : 'b'), cat: 'rafter', label: zh('檐椽（腰檐）', 'eave rafter of the waist eave'), termKey: 'yan-chuan', stage: 7, shapes: [poly([[tipX, tipY], [xIn, yIn + r], [xIn, yIn + r + rd], [tipX, tipY + rd]])], lens: 'eave', assembly: lay + '-eave-' + (side < 0 ? 'f' : 'b') });
      let tx = tipX, ty = tipY + rd;
      if (E.feiyan) {
        const fy = E.feiyan, fr = E.feiyanRise || 0.15, bl = fy * 1.6;
        const s = Math.abs(sl);
        sc.add({ id: lay + '-feiyan-' + (side < 0 ? 'f' : 'b'), cat: 'rafter', label: zh('飞椽', 'flying rafter'), termKey: 'fei-chuan', stage: 7, shapes: [poly([[tipX - side * bl, ty + s * bl], [tipX, ty], [tipX + side * fy, ty - s * fy * (1 - fr) + fy * fr * 0.5], [tipX + side * fy, ty - s * fy * (1 - fr) + fy * fr * 0.5 + rd * 0.8], [tipX - side * bl, ty + s * bl + rd * 0.8]])], lens: 'eave', assembly: lay + '-eave-' + (side < 0 ? 'f' : 'b') });
        tx = tipX + side * fy; ty = ty - s * fy * (1 - fr) + fy * fr * 0.5;
      }
      const T = 18, wb = 4;
      const pts = [[tx, ty + wb], [xIn, yIn + r + rd + wb]];
      const outer = pts.map(([x, y]) => [x, y + T]).reverse();
      sc.add({ id: lay + '-roof-' + (side < 0 ? 'f' : 'b'), cat: 'roof', label: zh('腰檐屋面', 'waist-eave roof surface'), termKey: 'wu-mian', stage: 8, shapes: [poly(pts.concat(outer))] });
    }
    // next storey stands on the bracket sets (叉柱造): base = eave bracket axis top
    return { columnTop: colTopAt, nextBase: yBr + brH.axisTop, overhangTotal: front.x - (liaoF.x - E.overhang - (E.feiyan || 0)), span: 0, rise: 0 };
  }

  // ---------- 平坐 (terrace storey with hidden 暗层) ----------
  function pingzuoCap(sc, b, L, li, M, info, bayX, brH, yBr) {
    const zh = (s, e) => ({ zh: s, en: e });
    const f = v => v * M, lay = 'L' + li;
    const PZ = L.pingzuo;
    const cols = info.cols.filter(cc => !cc.ghost);
    const eaveCols = cols.filter(cc => cc.c.kind === 'eave');
    const front = eaveCols[0], back = eaveCols[eaveCols.length - 1];
    const colTopAt = {};
    for (const cc of cols) if (cc.auto) colTopAt[cc.c.at] = front.top;
    // braces in the dark storey: X-braces between adjacent columns (except void bays)
    if (PZ.braces) {
      const sorted = cols.slice().sort((a, b2) => a.x - b2.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], c = sorted[i + 1];
        const bayIdx = a.c.at;
        if ((PZ.voidBays || []).includes(bayIdx)) continue;
        const y0 = a.base + 20, y1 = Math.min(a.top, c.top) - 20;
        sc.add({ id: lay + '-brace-' + i + 'a', cat: 'inclined', label: zh('暗层斜撑', 'diagonal brace in the hidden storey (xie cheng)'), termKey: 'xie-cheng', stage: 5, shapes: [bar(a.x + 30, y0, c.x - 30, y1, 16)], lens: 'frame', assembly: lay + '-frame', asmLabel: zh('平坐暗层', 'terrace and hidden storey') });
        sc.add({ id: lay + '-brace-' + i + 'b', cat: 'inclined', label: zh('暗层斜撑', 'diagonal brace in the hidden storey (xie cheng)'), termKey: 'xie-cheng', stage: 5, shapes: [bar(a.x + 30, y1, c.x - 30, y0, 16)], lens: 'frame', assembly: lay + '-frame' });
      }
    }
    // floor beams + boards on the bracket tops
    const yTop = yBr + brH.axisTop;
    const outreach = bracketOutreach(L.bracket, M);
    const x0 = front.x - outreach - f(12), x1 = back.x + outreach + f(12);
    sc.add({ id: lay + '-floor', cat: 'beam', label: zh('平坐楼板·铺版枋', 'terrace floor boards and joists'), termKey: 'lou-ban', stage: 4, shapes: [rect(x0, yTop, x1 - x0, PZ.floorH || 30)], lens: 'frame', assembly: lay + '-frame' });
    // void for the statue
    (PZ.voidBays || []).forEach(bi => {
      const a = cols.find(c => c.c.at === bi), c = cols.find(c2 => c2.c.at === bi + 1);
      if (a && c) sc.add({ id: lay + '-void-' + bi, cat: 'context', label: zh('空井（容纳观音像）', 'open well for the statue'), termKey: 'kong-jing', stage: 9, style: { ghost: true, dashed: true }, shapes: [rect(a.x + 40, yTop - 2, c.x - a.x - 80, (PZ.floorH || 30) + 4)] });
    });
    // 钩阑 balustrade
    const bh = PZ.railH || 90;
    for (const [x, tag] of [[x0 + f(6), 'f'], [x1 - f(6), 'b']]) {
      sc.add({ id: lay + '-goulan-' + tag, cat: 'context', label: zh('钩阑（栏杆）', 'gou lan: balustrade'), termKey: 'gou-lan', stage: 9, shapes: [rect(x - 5, yTop + (PZ.floorH || 30), 10, bh), rect(x - 22, yTop + (PZ.floorH || 30) + bh - 10, 44, 10), rect(x - 18, yTop + (PZ.floorH || 30) + bh * 0.45, 36, 8)], style: { thin: true } });
    }
    return { columnTop: colTopAt, nextBase: yTop + (PZ.floorH || 30), overhangTotal: 0, span: 0, rise: 0 };
  }

  // ---------- 副阶 / 下檐 (重檐) ----------
  function buildLowerEave(sc, b, M, bayX, depth, L0, purlinD, ex) {
    const LE = b.lowerEave, zh = (s, e) => ({ zh: s, en: e });
    const f = v => v * M, r = purlinD / 2;
    const beams = [];
    const brH = bracketHeight(LE.bracket, M, purlinD);
    const outreach = bracketOutreach(LE.bracket, M);
    const isMing = LE.bracket.system === 'doukou';
    const tieH = tieHeight(LE.ties || [], M);
    let colH = LE.columnH, ovh = 0;
    for (const side of [-1, 1]) {
      const tag = side < 0 ? 'f' : 'b';
      const dep = side < 0 ? (LE.frontDepth || LE.depth) : (LE.backDepth || LE.depth);
      const xMain = side < 0 ? 0 : depth;
      const x = xMain + side * dep;                 // side −1 = front (−x), +1 = back
      const lean = -side * (L0.cejiao || 0) * ex * colH; // lean inward
      columnPart(sc, 'LE-col-' + tag, x, 0, colH, LE.columnD || 46, lean, zh(LE.columnLabel || (isMing ? '檐柱（下檐）' : '副阶柱（廊柱）'), isMing ? 'eave column of the lower eave' : 'fu jie column (veranda column)'), LE.columnTermKey || (isMing ? 'yan-zhu' : 'lang-zhu'), 1, {});
      sc.add({ id: 'LE-col-' + tag + '-base', cat: 'column', label: zh('柱础', 'column base'), termKey: 'zhu-chu', stage: 1, shapes: [trap(x, 0, (LE.columnD || 46) * 1.6, (LE.columnD || 46) * 1.25, 14)], style: { thin: true }, lens: 'column' });
      const top = colH;
      // ties
      if ((LE.ties || []).includes('lan-e')) sc.add({ id: 'LE-tie-' + tag + '-lane', cat: 'tie', label: zh('阑额（端视）', 'lan e (end view)'), termKey: 'lan-e', stage: 2, style: { hatch: true }, shapes: [rect(x + lean - f(5), top - f(15) - 4, f(10), f(15))] });
      if ((LE.ties || []).includes('pupai-fang')) sc.add({ id: 'LE-tie-' + tag + '-pupai', cat: 'tie', label: zh('普拍枋', 'pu pai fang'), termKey: 'pupai-fang', stage: 2, shapes: [rect(x + lean - f(17), top, f(34), f(6))] });
      if ((LE.ties || []).includes('e-fang')) { sc.add({ id: 'LE-tie-' + tag + '-efang', cat: 'tie', label: zh('额枋（端视）', 'e fang (end view)'), termKey: 'e-fang', stage: 2, style: { hatch: true }, shapes: [rect(x + lean - f(1.2), top - f(3.6), f(2.4), f(3.6))] }); sc.add({ id: 'LE-tie-' + tag + '-pbfang', cat: 'tie', label: zh('平板枋', 'ping ban fang'), termKey: 'ping-ban-fang', stage: 2, shapes: [rect(x + lean - f(1.75), top, f(3.5), f(2))] }); }
      const yBr = top + tieH;
      const br = bracketSet(sc, LE.bracket, M, x + lean, yBr, side, 'LE-br-' + tag, 3, { purlinD });
      // tie beam from the lower bracket into the main column (or further, e.g. 圣母殿 前廊)
      const beamTop = yBr + brH.innerTop + f(LE.bracket.qi);
      const bh = LE.beamH || f(30);
      const toTok = side < 0 ? (LE.frontBeamTo || 'c0') : (LE.backBeamTo || ('c' + (bayX.length - 1)));
      const xTo = bayX[+toTok.slice(1)];
      const bx0 = Math.min(x, xTo), bx1 = Math.max(x, xTo);
      const beamName = LE.beamName || (isMing ? ['桃尖梁（抱头梁）', 'tao jian liang: eave tie-beam into the inner column', 'tao-jian-liang'] : ['乳栿（副阶）', 'ru fu of the veranda', 'ru-fu']);
      sc.add({ id: 'LE-beam-' + tag, cat: 'beam', label: zh(Array.isArray(beamName) ? beamName[0] : beamName, Array.isArray(beamName) ? beamName[1] : ''), termKey: Array.isArray(beamName) ? beamName[2] : 'ru-fu', stage: 4, shapes: [rect(bx0, beamTop - bh, bx1 - bx0, bh)], lens: 'frame', assembly: 'LE-frame-' + tag, asmLabel: zh(isMing ? '下檐梁架' : '副阶梁架', 'lower-eave frame') });
      beams.push({ x0: bx0, x1: bx1, top: beamTop });
      // purlin over the main column line: 承椽枋 / 下平槫 of the lower roof
      const liao = br.liao;
      const rise = LE.rise || 0.3;
      const yIn = liao.y + rise * dep;
      const xIn = xMain;
      sc.add({ id: 'LE-purlin-in-' + tag, cat: 'purlin', label: zh(isMing ? '承椽枋（下檐）' : '下平槫（副阶，承椽枋）', 'purlin/tie carrying the lower-eave rafters at the main column'), termKey: isMing ? 'cheng-chuan-fang' : 'xia-ping-tuan', stage: 6, shapes: isMing ? [rect(xIn - f(1.5), yIn - r, f(3), purlinD)] : [circle(xIn, yIn, r)], lens: 'frame', assembly: 'LE-frame-' + tag });
      // strut from the beam to that purlin (if the beam passes under it)
      if (bx0 <= xIn + 1 && bx1 >= xIn - 1) addStrut(sc, 'LE-strut-' + tag, isMing ? 'guazhu' : 'shuzhu', xIn, beamTop, yIn - r - beamTop, f, zh, f(isMing ? 1 : 10), 'LE-' + tag);
      sc.add({ id: 'LE-purlin-' + tag, cat: 'purlin', label: zh(isMing ? '挑檐檩（下檐）' : '撩檐槫（副阶）', 'eave purlin of the lower eave'), termKey: isMing ? 'tiao-yan-lin' : 'liao-yan-tuan', stage: 6, shapes: [circle(liao.x, liao.y, r)], lens: 'eave', assembly: 'LE-eave-' + tag, asmLabel: zh(isMing ? '下檐檐部' : '副阶檐部', 'lower-eave assembly') });
      // rafters
      const E = LE.eave, rd = E.rafterD || 12;
      const sl = (yIn - liao.y) / dep;
      const tipX = liao.x + side * E.overhang, tipY = liao.y + r - sl * E.overhang;
      sc.add({ id: 'LE-rafter-' + tag, cat: 'rafter', label: zh(isMing ? '檐椽（下檐）' : '檐椽（副阶）', 'eave rafter of the lower eave'), termKey: 'yan-chuan', stage: 7, shapes: [poly([[tipX, tipY], [xIn, yIn + r], [xIn, yIn + r + rd], [tipX, tipY + rd]])], lens: 'eave', assembly: 'LE-eave-' + tag });
      let tx = tipX, ty = tipY + rd;
      if (E.feiyan) {
        const fy = E.feiyan, fr = E.feiyanRise || 0.15, bl = fy * 1.6;
        sc.add({ id: 'LE-feiyan-' + tag, cat: 'rafter', label: zh('飞椽', 'flying rafter'), termKey: 'fei-chuan', stage: 7, shapes: [poly([[tipX - side * bl, ty + sl * bl], [tipX, ty], [tipX + side * fy, ty - sl * fy * (1 - fr) + fy * fr * 0.5], [tipX + side * fy, ty - sl * fy * (1 - fr) + fy * fr * 0.5 + rd * 0.8], [tipX - side * bl, ty + sl * bl + rd * 0.8]])], lens: 'eave', assembly: 'LE-eave-' + tag });
        tx = tipX + side * fy; ty = ty - sl * fy * (1 - fr) + fy * fr * 0.5;
      }
      const T = 18, wb = 4;
      const pts = [[tx, ty + wb], [xIn, yIn + r + rd + wb]];
      const outer = pts.map(([px, py]) => [px, py + T]).reverse();
      sc.add({ id: 'LE-roof-' + tag, cat: 'roof', label: zh(isMing ? '下檐屋面' : '副阶屋面', 'lower-eave roof surface'), termKey: 'wu-mian', stage: 8, shapes: [poly(pts.concat(outer))] });
      if (side < 0) { ovh = x - tx; }
      if (LE.section) { const kind = side < 0 ? LE.section.front : LE.section.back; if (kind) addOpening(sc, 'LE-' + tag + '-open', x, 0, top - f(isMing ? 3.6 : 15) - 4, kind, f, zh, side); }
      // 出檐 annotation
      if (side < 0) sc.add({ id: 'LE-chuyan-dim', cat: 'context', label: zh('出檐 约 ' + ((x - tx) / 100).toFixed(1) + ' m（下檐）', 'lower-eave projection'), termKey: 'chu-yan', stage: 9, style: { thin: true, dim: true }, shapes: [line(tx, ty - 60, x, ty - 60), line(tx, ty - 75, tx, ty - 45), line(x, ty - 75, x, ty - 45)], lens: 'eave', assembly: 'LE-eave-f' });
    }
    return {
      beamTopAt: (x) => { const bm = beams.find(q => q.x0 - 1 <= x && x <= q.x1 + 1); return bm ? bm.top : 0; },
      metrics: { columnH: colH, bracketH: brH.toLiao, overhangTotal: ovh }
    };
  }

  // ---------- elevation (正立面) ----------
  function elevationScene(b, opts) {
    opts = opts || {};
    const ex = opts.exaggerate || 1;
    const sc = new Scene('elevation');
    const M = b.module.cm, f = v => v * M;
    const zh = (s, e) => ({ zh: s, en: e });
    const EV = b.elevation;
    const bays = EV.bays; const W = sum(bays);
    const xs = [0]; for (const w of bays) xs.push(xs[xs.length - 1] + w);
    const nCol = xs.length;
    const ph = b.platform.h;
    const roofLayer = b.layers[b.layers.length - 1];
    const purlinD = (roofLayer.roof && roofLayer.roof.purlinD) || 30;
    sc.add({ id: 'platform', cat: 'platform', label: zh('台基', 'platform'), termKey: 'tai-ji', stage: 0, shapes: [poly([[-b.platform.margin, -ph], [W + b.platform.margin, -ph], [W + b.platform.margin - 12, 0], [-b.platform.margin + 12, 0]])] });
    // shengqi: column heights rise toward the corners
    const sq = (i) => { const k = Math.abs(i - (nCol - 1) / 2); const arr = EV.shengqi || [0]; return (arr[Math.min(Math.floor(k), arr.length - 1)] || 0) * ex; };
    // storeys
    let base = 0;
    const lowerEave = b.lowerEave;
    let mainColX0 = 0, mainColX1 = W;
    if (lowerEave) {
      // veranda ring: columns at every bay line, low; the main body columns sit one bay inside
      const colH = lowerEave.columnH;
      for (let i = 0; i < nCol; i++) {
        const lean = ((L0cejiao(b) * ex) * colH) * (i < (nCol - 1) / 2 ? 1 : i > (nCol - 1) / 2 ? -1 : 0);
        columnPart(sc, 'lecol-' + i, xs[i], 0, colH + sq(i), lowerEave.columnD || 46, lean, zh('副阶柱 / 下檐柱', 'lower-eave column'), 'lang-zhu', 1, {});
      }
      const brH = bracketHeight(lowerEave.bracket, M, purlinD).toLiao;
      elevBracketRow(sc, 'le', lowerEave.bracket, M, xs, colH, brH, sq, zh);
      elevOpenings(sc, 'le', EV.openings, xs, colH - f(15), zh, EV.lattice, EV.sill);
      const out = bracketOutreach(lowerEave.bracket, M) + lowerEave.eave.overhang + (lowerEave.eave.feiyan || 0);
      const yE = colH + brH + purlinD;
      const T = 60;
      sc.add({ id: 'le-eave', cat: 'roof', label: zh('下檐（副阶）', 'lower eave'), termKey: 'fu-jie', stage: 8, shapes: [poly([[-out, yE], [W + out, yE], [W + out * 0.6, yE + T + 50], [W - bays[bays.length - 1] * 0.5, yE + T + 80], [bays[0] * 0.5, yE + T + 80], [-out * 0.6, yE + T + 50]])] });
      base = yE + T + 80;
      mainColX0 = bays[0]; mainColX1 = W - bays[bays.length - 1];
    }
    // main body per layer
    let y = base;
    b.layers.forEach((L, li) => {
      const eave = L.columns.find(c => c.kind === 'eave' && typeof c.h === 'number');
      const colH = eave ? eave.h : 400;
      const mxs = lowerEave || li > 0 ? xs.filter(x => x >= mainColX0 - 1 && x <= mainColX1 + 1) : xs;
      const inset = (L.columns.find(c => c.inset) || {}).inset || 0;
      const cxs = mxs.map((x, i) => i === 0 ? x + inset * li : i === mxs.length - 1 ? x - inset * li : x);
      const brH = bracketHeight(L.bracket, M, purlinD).toLiao;
      for (let i = 0; i < cxs.length; i++) {
        const ii = xs.indexOf(mxs[i]);
        const lean = ((L.cejiao || 0) * ex * colH) * (i < (cxs.length - 1) / 2 ? 1 : i > (cxs.length - 1) / 2 ? -1 : 0);
        columnPart(sc, 'L' + li + '-col-' + i, cxs[i], y, colH + (lowerEave || li > 0 ? 0 : sq(ii)), (eave && eave.d) || 50, lean, zh(li ? '上层檐柱' : '檐柱', 'eave column'), 'yan-zhu', 1, {});
      }
      elevBracketRow(sc, 'L' + li, L.bracket, M, cxs, y + colH, brH, (i) => (lowerEave || li > 0 ? 0 : sq(xs.indexOf(mxs[i]))), zh);
      if (li === 0 && !lowerEave) elevOpenings(sc, 'L0', EV.openings, cxs, y + colH - f(15), zh, EV.lattice, EV.sill);
      else elevOpenings(sc, 'L' + li, EV.upperOpenings || EV.openings.map(o => o === 'door' ? 'door' : o), cxs, y + colH - f(15), zh, EV.lattice, li > 0 ? 0 : EV.sill);
      const out = bracketOutreach(L.bracket, M) + (L.eave ? L.eave.overhang + (L.eave.feiyan || 0) : 200);
      const yE = y + colH + brH + purlinD;
      const x0 = cxs[0], x1 = cxs[cxs.length - 1];
      if (L.cap === 'eave') {
        const T = 55;
        sc.add({ id: 'L' + li + '-eave', cat: 'roof', label: zh('腰檐', 'waist eave'), termKey: 'wu-mian', stage: 8, shapes: [poly([[x0 - out, yE], [x1 + out, yE], [x1 + out * 0.55, yE + T + 40], [x0 - out * 0.55, yE + T + 40]])] });
        y = yE + T + 40;
      } else if (L.cap === 'pingzuo') {
        const fl = (L.pingzuo && L.pingzuo.floorH) || 30;
        sc.add({ id: 'L' + li + '-pingzuo', cat: 'beam', label: zh('平坐', 'terrace (ping zuo)'), termKey: 'ping-zuo', stage: 4, shapes: [rect(x0 - out * 0.5, y + colH + brH, x1 - x0 + out, fl + 10)] });
        const rh = (L.pingzuo && L.pingzuo.railH) || 90;
        sc.add({ id: 'L' + li + '-goulan', cat: 'context', label: zh('钩阑', 'balustrade'), termKey: 'gou-lan', stage: 9, shapes: [rect(x0 - out * 0.5, y + colH + brH + fl + 10, x1 - x0 + out, rh)], style: { thin: true, ghost: true } });
        y = y + colH + brH + fl + 10;
      } else {
        // roof silhouette
        const R = L.roof;
        const depth = sum(b.layers[0].depthBays);
        const spanSec = depth + 2 * bracketOutreach(L.bracket, M);
        const rise = R.method === 'jujia' ? spanSec * 0.5 * 0.7 : (R.rise || 0.25) * spanSec;
        const type = EV.roofType || 'wudian';
        const ridgeLen = type.includes('xieshan') ? (x1 - x0) * 0.72 : (x1 - x0) * 0.55;
        const cx = (x0 + x1) / 2;
        const T = 40;
        const tipY = yE;
        const kick = (EV.eaveCurve || 0.03) * (x1 - x0) * ex;
        if (type.includes('xieshan')) {
          const yBo = tipY + rise * 0.55;
          sc.add({ id: 'L' + li + '-roof', cat: 'roof', label: zh('歇山顶', 'xie shan (hip-and-gable) roof'), termKey: 'wu-mian', stage: 8, shapes: [poly([[x0 - out, tipY + kick], [x0 - out * 0.3, tipY], [x1 + out * 0.3, tipY], [x1 + out, tipY + kick], [cx + ridgeLen / 2 + 60, yBo], [cx + ridgeLen / 2, yBo], [cx + ridgeLen / 2, tipY + rise], [cx - ridgeLen / 2, tipY + rise], [cx - ridgeLen / 2, yBo], [cx - ridgeLen / 2 - 60, yBo]])] });
          sc.add({ id: 'L' + li + '-shanhua', cat: 'roof', label: zh('山花', 'gable'), termKey: 'wu-mian', stage: 8, shapes: [poly([[cx - ridgeLen / 2 + 10, yBo + 10], [cx + ridgeLen / 2 - 10, yBo + 10], [cx + ridgeLen / 2 - 10, tipY + rise - 10], [cx - ridgeLen / 2 + 10, tipY + rise - 10]])], style: { ghost: true } });
        } else {
          sc.add({ id: 'L' + li + '-roof', cat: 'roof', label: zh('庑殿顶', 'wu dian (hip) roof'), termKey: 'wu-mian', stage: 8, shapes: [poly([[x0 - out, tipY + kick], [x0 - out * 0.3, tipY], [x1 + out * 0.3, tipY], [x1 + out, tipY + kick], [cx + ridgeLen / 2, tipY + rise], [cx - ridgeLen / 2, tipY + rise]])] });
        }
        sc.add({ id: 'L' + li + '-ridge', cat: 'roof', label: zh('正脊·鸱吻', 'main ridge and ridge ornaments'), termKey: 'zheng-ji', stage: 8, shapes: [rect(cx - ridgeLen / 2 - 20, tipY + rise - 6, ridgeLen + 40, T), rect(cx - ridgeLen / 2 - 30, tipY + rise + T - 6, 50, 90), rect(cx + ridgeLen / 2 - 20, tipY + rise + T - 6, 50, 90)] });
      }
    });
    sc.finish();
    return sc;
  }
  function L0cejiao(b) { return b.layers[0].cejiao || 0; }
  function elevBracketRow(sc, tag, r, M, xs, yBase, brH, sq, zh) {
    const f = v => v * M;
    const w = Math.max(bracketOutreach(r, M) * 1.1, f(40));
    const isMing = r.system === 'doukou';
    for (let i = 0; i < xs.length; i++) {
      const y = yBase + sq(i);
      sc.add({ id: tag + '-cap-' + i, cat: 'bracket', label: zh(isMing ? '柱头科' : '柱头铺作', 'bracket set on the column'), termKey: 'dou-gong', stage: 3, shapes: [trap(xs[i], y, w * 0.35, w, brH)] });
      if (i < xs.length - 1) {
        const nB = r.bujianPerBay || 1;
        for (let k = 1; k <= nB; k++) {
          const x = xs[i] + (xs[i + 1] - xs[i]) * k / (nB + 1);
          const yy = yBase + (sq(i) + sq(i + 1)) / 2;
          sc.add({ id: tag + '-bj-' + i + '-' + k, cat: 'bracket', label: zh(isMing ? '平身科' : '补间铺作', 'intermediate bracket set'), termKey: 'bu-jian-pu-zuo', stage: 3, shapes: [trap(x, yy, w * 0.3, w * (isMing ? 0.95 : 0.85), brH * (isMing ? 1 : 0.92))], style: r.xiegong ? { hatch: true } : {} });
        }
      }
    }
    // 阑额 / 额枋 band
    sc.add({ id: tag + '-lane', cat: 'tie', label: zh(isMing ? '额枋' : '阑额', 'architrave'), termKey: isMing ? 'e-fang' : 'lan-e', stage: 2, shapes: [rect(xs[0], yBase - f(isMing ? 3.6 : 15), xs[xs.length - 1] - xs[0], f(isMing ? 3.6 : 15))] });
  }
  function elevOpenings(sc, tag, openings, xs, yTop, zh, lattice, sill) {
    for (let i = 0; i < xs.length - 1; i++) {
      const o = (openings || [])[i] || 'wall';
      const x0 = xs[i] + 18, w = xs[i + 1] - xs[i] - 36;
      const y0 = 0 + (sill == null ? 0 : 0);
      if (o === 'wall') { sc.add({ id: tag + '-op-' + i, cat: 'wall', label: zh('墙', 'wall'), termKey: 'qiang', stage: 9, shapes: [rect(x0, 0, w, yTop)], style: { ghost: true } }); continue; }
      const base = (o === 'zhiling' || o === 'pozi') ? (sill == null ? 110 : sill) : 0;
      if (base) sc.add({ id: tag + '-sill-' + i, cat: 'wall', label: zh('槛墙', 'sill wall'), termKey: 'qiang', stage: 9, shapes: [rect(x0, 0, w, base)], style: { ghost: true } });
      const kindLbl = { door: ['板门', 'plank door', 'ban-men'], zhiling: ['直棂窗', 'vertical-mullion window', 'zhi-ling-chuang'], pozi: ['破子棂窗', 'split-mullion window', 'zhi-ling-chuang'], gezi: ['格子门', 'lattice door', 'ge-zi-men'], linghua: ['菱花格扇', 'ling hua lattice panel', 'ling-hua-ge-shan'] }[o] || ['门窗', 'opening', 'ban-men'];
      sc.add({ id: tag + '-op-' + i, cat: 'window', label: zh(kindLbl[0], kindLbl[1]), termKey: kindLbl[2], stage: 9, shapes: [rect(x0, base, w, yTop - base - 6)], style: { pattern: o === 'door' ? null : o, panel: o === 'door' }, lens: 'window', meta: { opening: o } });
    }
  }

  // ---------- bracket row, front view (for the lens) ----------
  function bracketFrontScene(b, opts) {
    const sc = new Scene('bracketFront');
    const L = b.layers[b.layers.length - 1];
    const r = L.bracket, M = b.module.cm, f = v => v * M;
    const zh = (s, e) => ({ zh: s, en: e });
    const isMing = r.system === 'doukou';
    const bay = (b.elevation.bays[Math.floor(b.elevation.bays.length / 2)]) || 500;
    const colD = (L.columns.find(c => c.kind === 'eave') || {}).d || 50;
    const yCol = 0;
    // two column heads
    for (const [x, tag] of [[0, 'a'], [bay, 'b']]) sc.add({ id: 'colhead-' + tag, cat: 'column', label: zh('柱头', 'column head'), termKey: 'yan-zhu', stage: 1, shapes: [rect(x - colD / 2, yCol - 160, colD, 160)] });
    sc.add({ id: 'lane', cat: 'tie', label: zh(isMing ? '额枋' : '阑额', 'architrave'), termKey: isMing ? 'e-fang' : 'lan-e', stage: 2, shapes: [rect(0, yCol - f(isMing ? 3.6 : 15), bay, f(isMing ? 3.6 : 15))] });
    if (L.ties.includes('pupai-fang')) sc.add({ id: 'pupai', cat: 'tie', label: zh('普拍枋', 'pu pai fang'), termKey: 'pupai-fang', stage: 2, shapes: [rect(-colD / 2 - f(6), yCol, bay + colD + f(12), f(6))] });
    if (L.ties.includes('ping-ban-fang')) sc.add({ id: 'pbf', cat: 'tie', label: zh('平板枋', 'ping ban fang'), termKey: 'ping-ban-fang', stage: 2, shapes: [rect(-colD / 2 - f(1), yCol, bay + colD + f(2), f(2))] });
    const yB = yCol + tieHeight(L.ties, M);
    const n = r.tiers.length;
    const danCai = f(r.danCai), zuCai = f(r.zuCai), qi = f(r.qi);
    const nB = r.bujianPerBay || 1;
    const xsSet = [0].concat(Array.from({ length: nB }, (_, k) => bay * (k + 1) / (nB + 1)), [bay]);
    xsSet.forEach((x, si) => {
      const isCap = si === 0 || si === xsSet.length - 1;
      const asm = (isCap ? 'cap' : 'bj') + si;
      const lbl = isCap ? zh(isMing ? '柱头科' : '柱头铺作', 'bracket set on the column') : zh(isMing ? '平身科' : '补间铺作', 'intermediate bracket set');
      const P = (id, cat, l, tk, shapes, tier, extra) => { const o = Object.assign({ id: asm + '-' + id, cat, label: l, termKey: tk, shapes, stage: 3, tier, assembly: asm, asmLabel: lbl, lens: 'bracket', explodeLocal: { dx: 0, dy: tier * zuCai } }, extra || {}); if (si !== 0 && si !== 1) o.style = Object.assign({}, o.style, { nolbl: true }); return sc.add(o); };
      P('ludou', 'bracket', zh(isMing ? '坐斗' : '栌斗', 'cap block'), isMing ? 'zuo-dou' : 'lu-dou', [trap(x, yB, f(r.ludou.w) * 0.72, f(r.ludou.w), f(r.ludou.h))], 0);
      let y = yB + f(r.ludou.h);
      for (let k = 0; k < n; k++) {
        const t = r.tiers[k];
        // transverse arm (泥道栱 / 慢栱 / 柱头枋) grows with tier
        const armW = f(isMing ? 6.2 + k * 1.6 : (k === 0 ? 62 : 92));
        const isFang = k > 0 && !isMing && !r.chonggong;
        P('arm' + k, 'bracket', k === 0 ? zh(isMing ? '正心瓜栱' : '泥道栱', 'transverse arm on the axis') : zh(isFang ? '柱头枋' : (isMing ? '正心万栱' : '慢栱'), isFang ? 'longitudinal tie' : 'long transverse arm'), k === 0 || !isFang ? 'ni-dao-gong' : 'zhu-tou-fang', [rect(x - armW / 2, y, armW, danCai)], k + 1);
        // projecting member head seen from the front: 华栱 head = square; 昂 head = pointed (drawn as a downward-pointing beak)
        const headW = f(10);
        if (t === 'ang') P('head' + k, 'bracket', zh(r.angReal === false ? '假昂昂嘴' : '下昂昂嘴', 'ang beak'), r.angReal === false ? 'jia-ang' : 'xia-ang', [poly([[x - headW / 2, y - qi * 1.2], [x + headW / 2, y - qi * 1.2], [x + headW / 2 * 0.6, y + danCai], [x - headW / 2 * 0.6, y + danCai]])], k + 1);
        else P('head' + k, 'bracket', zh(isMing ? '翘头' : '华栱头', 'projecting arm head'), isMing ? 'qiao' : 'hua-gong', [rect(x - headW / 2, y, headW, danCai)], k + 1);
        // 斜栱 (Jin): 45° arms projected → appear as diagonal arms rising outward
        if (r.xiegong && !isCap && k < 2) {
          const len = f(46) * (k + 1);
          P('xg' + k + 'l', 'bracket', zh('斜栱（45°）', 'xie gong: diagonal arm at 45°'), 'xie-gong', [bar(x, y + danCai / 2, x - len, y + danCai / 2 + k * zuCai * 0.35, danCai)], k + 1);
          P('xg' + k + 'r', 'bracket', zh('斜栱（45°）', 'xie gong: diagonal arm at 45°'), 'xie-gong', [bar(x, y + danCai / 2, x + len, y + danCai / 2 + k * zuCai * 0.35, danCai)], k + 1);
        }
        // small blocks on the arm ends
        P('d' + k + 'l', 'bracket', zh('散斗', 'small block'), 'jiao-hu-dou', [trap(x - armW / 2 + f(6), y + danCai, f(9), f(13), qi)], k + 1, { style: { thin: true, nolbl: true } });
        P('d' + k + 'r', 'bracket', zh('散斗', 'small block'), 'jiao-hu-dou', [trap(x + armW / 2 - f(6), y + danCai, f(9), f(13), qi)], k + 1, { style: { thin: true, nolbl: true } });
        y += zuCai;
      }
      P('sha', 'bracket', zh(isMing ? '蚂蚱头' : '耍头', 'capping arm head'), isMing ? 'ma-zha-tou' : 'shua-tou', [rect(x - f(10) / 2, y, f(10), danCai)], n + 1);
    });
    const yTop = yB + f(r.ludou.h) + n * zuCai + danCai;
    sc.add({ id: 'liao', cat: 'purlin', label: zh(isMing ? '挑檐枋·挑檐檩' : '撩檐枋 / 撩檐槫', 'eave tie and purlin'), termKey: isMing ? 'tiao-yan-lin' : 'liao-yan-tuan', stage: 6, shapes: [rect(-colD, yTop + qi, bay + 2 * colD, f(isMing ? 2 : 8)), rect(-colD, yTop + qi + f(isMing ? 2 : 8), bay + 2 * colD, 30)] });
    sc.finish();
    return sc;
  }

  // ---------- window / lattice (for the lens) ----------
  function windowScene(b, kind, opts) {
    const sc = new Scene('window');
    const zh = (s, e) => ({ zh: s, en: e });
    const W = 300, H = 420;
    kind = kind || 'zhiling';
    const info = {
      zhiling: ['直棂窗', 'zhi ling chuang: vertical-mullion window', 'zhi-ling-chuang'],
      pozi: ['破子棂窗', 'po zi ling chuang: split (triangular) mullion window', 'zhi-ling-chuang'],
      gezi: ['格子门（四斜毬文 / 三角纹）', 'ge zi men: lattice door', 'ge-zi-men'],
      linghua: ['三交六椀菱花格扇', 'san jiao liu wan ling hua: triple-crossing lattice with six-petal florets', 'ling-hua-ge-shan'],
      door: ['板门', 'ban men: plank door', 'ban-men']
    }[kind] || ['门窗', 'opening', 'ban-men'];
    sc.add({ id: 'frame', cat: 'tie', label: zh('框（抹头·边挺）', 'frame: rails and stiles'), termKey: kind === 'door' ? 'ban-men' : info[2], stage: 9, shapes: [rect(0, 0, W, 16), rect(0, H - 16, W, 16), rect(0, 0, 16, H), rect(W - 16, 0, 16, H)] });
    if (kind === 'door') {
      sc.add({ id: 'panel', cat: 'window', label: zh('门板（拼板，门钉·门钹）', 'plank leaf with studs and knocker'), termKey: 'ban-men', stage: 9, shapes: [rect(16, 16, W - 32, H - 32)], style: { panel: true } });
    } else {
      const base = kind === 'zhiling' || kind === 'pozi' ? 120 : 0;
      if (base) sc.add({ id: 'sill', cat: 'wall', label: zh('槛墙', 'sill wall'), termKey: 'qiang', stage: 9, shapes: [rect(16, 16, W - 32, base)], style: { ghost: true } });
      if (kind === 'gezi' || kind === 'linghua') {
        sc.add({ id: 'yaohua', cat: 'window', label: zh('腰华板·障水板', 'waist panel and lower panel'), termKey: info[2], stage: 9, shapes: [rect(16, 16, W - 32, 90), rect(16, 106, W - 32, 34)], style: { panel: true } });
        sc.add({ id: 'lattice', cat: 'window', label: zh(info[0] + '棂花', info[1]), termKey: info[2], stage: 9, shapes: [rect(16, 140, W - 32, H - 156)], style: { pattern: kind } });
      } else {
        sc.add({ id: 'lattice', cat: 'window', label: zh(info[0], info[1]), termKey: info[2], stage: 9, shapes: [rect(16, 16 + base, W - 32, H - 32 - base)], style: { pattern: kind } });
      }
    }
    sc.finish();
    return sc;
  }

  root.ARCH_GEO = { sectionScene, elevationScene, bracketFrontScene, windowScene, purlinsJuzhe, purlinsJujia, bracketHeight, bracketOutreach, Scene };
})(typeof window !== 'undefined' ? window : globalThis);
