/* app.js — state, UI wiring, build stepper, selection, explode, zoom/pan, lenses, evolution, tour. */
(function () {
  'use strict';
  const D = window.ARCH_DATA, G = window.ARCH_GEO, R = window.ARCH_RENDER;
  const GL = () => window.ARCH_GLOSSARY || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const svg = $('#section'), stage = $('#stage'), elevSvg = $('#elev'), lensSvg = $('#lensSvg'), lensWrap = $('#lensWrap');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = { b: null, scene: null, els: {}, stage: 9, exploded: false, filter: new Set(), selected: null, lens: null, view: null, timers: [], sameScale: false, exaggerate: false, tour: null, custom: false, cache: {}, building: false, dragging: false };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clearTimers = () => { S.timers.forEach(clearTimeout); S.timers = []; };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); S.timers.push(t); return t; };
  const partById = (id) => S.scene && S.scene.parts.find(p => p.id === id);
  const STAGE_MS = reduced ? 120 : 950;
  let exterior = null, viewMode = 'exterior';
  function setMode(mode) {
    const previous = viewMode;
    viewMode = mode === 'exterior' && exterior ? 'exterior' : 'section';
    document.body.classList.toggle('exterior-mode', viewMode === 'exterior');
    svg.setAttribute('aria-hidden', String(viewMode === 'exterior'));
    $('#exterior').setAttribute('aria-hidden', String(viewMode !== 'exterior'));
    $$('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === viewMode)));
    if (exterior) exterior.setActive(viewMode === 'exterior');
    if (viewMode === 'section' && previous !== viewMode && S.scene) resetView(false);
  }
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => {
    if (S.tour) endTour();
    if (S.lens) exitLens(true);
    if (!$('#evo').hidden) toggleEvo(false);
    setMode(button.dataset.view);
  }));
  $('#modelFront').addEventListener('click', () => exterior?.view('front'));
  $('#modelReset').addEventListener('click', () => exterior?.view('perspective'));
  $('#modelLight').addEventListener('change', (e) => exterior?.light(e.target.value));
  $('#modelRotate').addEventListener('click', (e) => {
    const button = e.currentTarget, on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on)); exterior?.rotate(on);
  });
  $('#modelPhoto').addEventListener('click', () => {
    if (!exterior) return;
    const link = document.createElement('a');
    link.download = S.b.id + '-exterior.png'; link.href = exterior.capture(); link.click();
  });

  // ================= view / zoom / pan =================
  function aspect() { const r = svg.getBoundingClientRect(); return Math.max(r.width, 1) / Math.max(r.height, 1); }
  function maxWidth() { return Math.max(...D.BUILDINGS.map(b => sceneFor(b).bbox.w)); }
  function fitBox() { return S.exploded ? S.scene.bboxExploded : S.scene.bbox; }
  function fitViewFor(box) {
    const r = svg.getBoundingClientRect();
    const topPad = 56, botPad = 108;                       // legend row above, stage bar below (screen px)
    const usableH = Math.max(r.height - topPad - botPad, 120);
    let bb = box;
    if (S.sameScale) { const W = maxWidth() * 1.02; if (W > box.w) bb = { x: box.x + box.w / 2 - W / 2, y: box.y, w: W, h: box.h }; }
    const v = R.fitView(bb, null, Math.max(r.width, 1) / usableH);
    const upp = v.w / Math.max(r.width, 1);
    v.y -= topPad * upp; v.h += (topPad + botPad) * upp;
    return v;
  }
  let viewAnim = null;
  function setView(v, animate) {
    if (viewAnim) { cancelAnimationFrame(viewAnim); viewAnim = null; }
    if (!animate || !S.view || reduced) { S.view = v; R.applyView(svg, v); afterView(); return; }
    const from = Object.assign({}, S.view), t0 = performance.now(), dur = 380;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      S.view = { x: from.x + (v.x - from.x) * e, y: from.y + (v.y - from.y) * e, w: from.w + (v.w - from.w) * e, h: from.h + (v.h - from.h) * e };
      R.applyView(svg, S.view); afterView();
      if (k < 1) viewAnim = requestAnimationFrame(step); else viewAnim = null;
    };
    viewAnim = requestAnimationFrame(step);
  }
  function afterView() {
    const r = svg.getBoundingClientRect();
    const upp = S.view.w / Math.max(r.width, 1);          // user units (cm) per screen px
    svg.style.setProperty('--u', upp + 'px');
    svg.style.setProperty('--label-size', (12.5 * upp) + 'px');
    updateScaleBar(upp);
  }
  function updateScaleBar(upp) {
    const r = svg.getBoundingClientRect();
    const choices = [2000, 1000, 500, 200, 100, 50];
    const cm = choices.find(c => c / upp <= r.width * 0.28) || 50;
    $('#scaleLine').style.width = (cm / upp) + 'px';
    $('#scaleLabel').textContent = cm >= 100 ? (cm / 100) + ' m' : cm + ' cm';
  }
  function svgPoint(e) { const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 }; return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()); }
  function zoomAbout(p, k) {
    const fit = fitViewFor(fitBox());
    const w = Math.max(fit.w / 10, Math.min(fit.w * 2.2, S.view.w * k));
    const kk = w / S.view.w, h = S.view.h * kk;
    setView({ x: p.x - (p.x - S.view.x) * kk, y: p.y - (p.y - S.view.y) * kk, w, h }, false);
    S.custom = true;
  }
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAbout(svgPoint(e), Math.exp(e.deltaY * 0.0016)); }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, view: Object.assign({}, S.view), moved: 0 }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect(), upp = S.view.w / r.width;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved > 4) { S.dragging = true; setView({ x: drag.view.x - dx * upp, y: drag.view.y - dy * upp, w: drag.view.w, h: drag.view.h }, false); S.custom = true; }
  });
  const endDrag = () => { drag = null; setTimeout(() => { S.dragging = false; }, 0); };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  function resetView(animate) { S.custom = false; setView(fitViewFor(fitBox()), animate !== false); }

  // ================= building load =================
  function sceneFor(b, ex) {
    const key = b.id + (ex ? ':ex' : '');
    return S.cache[key] || (S.cache[key] = G.sectionScene(b, { exaggerate: ex ? 3 : 1 }));
  }
  function loadBuilding(id, opts) {
    opts = opts || {};
    if (viewMode === 'exterior') opts = Object.assign({}, opts, { animate: false });
    const b = D.BUILDINGS.find(x => x.id === id) || D.BUILDINGS[0];
    clearTimers(); S.building = false;
    exitLens(false);
    S.exploded = false; svg.classList.remove('exploded'); $('#btnExplode').classList.remove('active');
    deselect(false); S.filter.clear(); applyFilter();
    S.b = b; S.scene = sceneFor(b, S.exaggerate);
    svg.classList.add('swap');
    const mount = () => {
      if (exterior) exterior.load(b, S.scene);
      S.els = R.mountScene(svg, S.scene, { prefix: 'sec' });
      S.custom = false; S.view = null; setView(fitViewFor(S.scene.bbox), false);
      if (opts.animate && !reduced) playBuild(); else setStage(opts.stage == null ? 9 : opts.stage, true);
      svg.classList.remove('swap');
      renderHeader(); renderPanel(); renderInset(); updateNav(); updateLegend();
      history.replaceState(null, '', '#' + b.id);
    };
    if (opts.animate) setTimeout(mount, 120); else mount();
  }

  // ================= build stepper =================
  function setStage(n, instant) {
    S.stage = n;
    exterior?.setStage(n);
    if (instant) svg.classList.add('instant');
    for (const id in S.els) { const g = S.els[id]; g.classList.toggle('on', +g.dataset.stage <= n); }
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('instant')));
    updateStageBar();
  }
  function playBuild() {
    clearTimers(); S.building = true; $('#btnBuild').classList.add('active');
    setStage(-1, true);
    let s = 0;
    const step = () => { setStage(s, false); s++; if (s <= 9) later(step, STAGE_MS); else { S.building = false; $('#btnBuild').classList.remove('active'); } };
    later(step, reduced ? 60 : 420);
  }
  function stepStage(d) { clearTimers(); S.building = false; $('#btnBuild').classList.remove('active'); setStage(Math.max(-1, Math.min(9, S.stage + d)), d < 0); }
  function updateStageBar() {
    $$('.stchip').forEach((c, i) => {
      c.classList.toggle('done', i < S.stage); c.classList.toggle('cur', i === S.stage);
      c.setAttribute('aria-pressed', String(i === S.stage));
    });
    const st = D.STAGES[S.stage];
    $('#stageCaption').innerHTML = st ? `<strong>${esc(st.zh)}</strong>${esc(st.line)}` : `<strong>台基之前</strong>点击「构建」或按 → 逐层搭起这座建筑。`;
  }
  function buildStageBar() {
    $('#stageChips').innerHTML = D.STAGES.map((s, i) => `<button type="button" class="stchip" data-i="${i}" title="${esc(s.line)}">${esc(s.zh)}<b>${esc(s.en)}</b></button>`).join('');
    $$('.stchip').forEach(c => c.addEventListener('click', () => { const i = +c.dataset.i; clearTimers(); S.building = false; setStage(i, i < S.stage); }));
  }

  // ================= selection & panel =================
  function select(partId, asmId) {
    S.selected = { partId, asmId };
    for (const id in S.els) { const g = S.els[id]; g.classList.toggle('sel', asmId ? g.dataset.assembly === asmId : g.dataset.id === partId); g.classList.toggle('sel1', !asmId && g.dataset.id === partId); }
    document.body.classList.add('has-sel');
    renderPanel();
  }
  function deselect(render) {
    S.selected = null;
    exterior?.highlight(null);
    for (const id in S.els) S.els[id].classList.remove('sel', 'sel1');
    document.body.classList.remove('has-sel');
    if (render !== false) renderPanel();
  }
  svg.addEventListener('click', (e) => {
    if (S.dragging) return;
    const g = e.target.closest('.part');
    if (!g) { deselect(); return; }
    const id = g.dataset.id, asm = g.dataset.assembly;
    if (S.lens || !asm) select(id, null); else select(null, asm);
  });
  svg.addEventListener('dblclick', (e) => {
    const g = e.target.closest('.part'); if (!g) return;
    const p = partById(g.dataset.id); if (!p) return;
    enterLens(p.lens || (p.assembly ? 'frame' : 'column'), p.assembly || p.id);
  });
  // hover tooltip
  const tip = $('#tip');
  svg.addEventListener('pointermove', (e) => {
    const g = e.target.closest('.part');
    if (!g || drag) { tip.classList.remove('show'); return; }
    const p = partById(g.dataset.id); if (!p) return;
    tip.innerHTML = esc(p.label.zh) + (p.label.en ? `<em>${esc(p.label.en)}</em>` : '');
    const r = stage.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 16;
    if (x + tip.offsetWidth > r.width - 10) x = e.clientX - r.left - tip.offsetWidth - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('show');
  });
  svg.addEventListener('pointerleave', () => tip.classList.remove('show'));

  function asmTerm(asmId) {
    const b = S.b;
    if (/-br-/.test(asmId) || /^(cap|bj)\d/.test(asmId)) return 'dou-gong';
    if (/eave/.test(asmId)) return 'chu-yan';
    if (/^LE-/.test(asmId)) return (b.lowerEave && b.lowerEave.termKey) || 'fu-jie';
    const m = asmId.match(/^L(\d+)-frame/);
    if (m) { const L = b.layers[+m[1]]; if (L && L.cap === 'pingzuo') return 'ping-zuo'; if (L && L.cap === 'eave') return 'chong-yan'; return b.frameTerm || 'liang'; }
    return 'liang';
  }
  const CAT = Object.fromEntries(D.CATS.map(c => [c.key, c]));
  function termBlock(tk, p) {
    const t = GL()[tk];
    if (!t) return `<p class="note">（词条 ${esc(tk)} 尚未收录）</p>`;
    const per = t.perBuilding && t.perBuilding[S.b.id];
    return `
      ${t.what ? `<h4>是什么 · What</h4><p>${esc(t.what)}</p>` : ''}
      ${t.why ? `<h4>为什么 · Why it matters</h4><p>${esc(t.why)}</p>` : ''}
      ${per ? `<h4>在本建筑 · Here</h4><p class="evo-note">${esc(per)}</p>` : ''}
      ${t.evolution ? `<h4>历代演变 · Evolution</h4><p>${esc(t.evolution)}</p>` : ''}`;
  }
  function renderHeader() {
    const b = S.b, m = S.scene.metrics;
    $('#bDyn').innerHTML = `<b>${esc(b.dynasty.zh)}</b><span>${esc(b.dynasty.en)} · ${esc(b.dynasty.years)}</span>`;
    $('#bName').innerHTML = `${esc(b.name.zh)}<em>${esc(b.name.en)}</em>`;
    $('#bMeta').textContent = `${b.year} 年 · ${b.place.zh} · ${b.place.en}`;
    const ratio = (v) => v > 0 ? '1/' + (1 / v).toFixed(1) : '—';
    $('#bMetrics').innerHTML = `
      <div class="metric"><span>檐柱高 · column</span><b>${(m.columnH / 100).toFixed(1)}</b><small>m</small></div>
      <div class="metric"><span>斗拱高 ÷ 柱高</span><b>约 ${ratio(m.bracketRatio)}</b><small>${(m.bracketH / 100).toFixed(1)} m</small></div>
      <div class="metric"><span>出檐 · eave projection</span><b>${(m.overhangTotal / 100).toFixed(1)}</b><small>m（约 ${m.overhangRatio.toFixed(2)} 柱高）</small></div>
      <div class="metric"><span>举高 ÷ 前后撩檐距</span><b>约 ${ratio(m.slopeRatio)}</b><small>${m.method === 'jujia' ? '举架' : '举折'}</small></div>`;
  }
  function renderPanel() {
    const b = S.b, body = $('#panelBody');
    if (!S.selected) {
      body.innerHTML = `
        <p>${esc(b.summary.zh)}</p>
        <p class="en">${esc(b.summary.en)}</p>
        <h4>要点 · Key facts</h4>
        <ul class="facts">${b.facts.map(f => `<li class="${f.confidence || 'high'}">${esc(f.zh)}<em>${esc(f.en)}</em></li>`).join('')}</ul>
        <p class="note">◐ 表示学界一般看法或近似值。点击图中任一构件查看说明；双击进入细节视图。</p>
        <h4>资料 · Sources</h4><p class="sources">${esc((b.sources || []).join('；'))}</p>`;
      return;
    }
    const { partId, asmId } = S.selected;
    if (asmId) {
      const a = S.scene.assemblies[asmId];
      const parts = a.parts.map(partById).filter(Boolean);
      const tk = asmTerm(asmId);
      const uniq = []; const seen = new Set();
      for (const p of parts) { const key = p.label.zh; if (!seen.has(key)) { seen.add(key); uniq.push(p); } }
      const catKeys = a.cats || [];
      body.innerHTML = `
        <h3>${esc(a.label.zh)}<em>${esc(a.label.en || '')}</em></h3>
        <div class="tagrow">${catKeys.map(c => `<span class="tag cat" style="--sw:var(--c-${c})">${esc(CAT[c] ? CAT[c].zh : c)}</span>`).join('')}<span class="tag">${parts.length} 个构件</span></div>
        <div class="actions"><button id="btnLens">🔍 放大查看细节 (L)</button></div>
        ${termBlock(tk)}
        <h4>组成构件 · Members（点击选中）</h4>
        <div class="subparts">${uniq.map(p => `<button data-pid="${esc(p.id)}">${esc(p.label.zh.replace(/（.*?）/g, ''))}</button>`).join('')}</div>`;
      $('#btnLens').addEventListener('click', () => enterLens(a.lens || 'frame', asmId));
      $$('.subparts button', body).forEach(btn => btn.addEventListener('click', () => select(btn.dataset.pid, null)));
      return;
    }
    const p = partById(partId); if (!p) { deselect(); return; }
    const st = D.STAGES[p.stage];
    const back = p.assembly ? `<button id="btnBackAsm" class="secondary">‹ 返回 ${esc((S.scene.assemblies[p.assembly].label || {}).zh || '组件')}</button>` : '';
    body.innerHTML = `
      <h3>${esc(p.label.zh)}<em>${esc(p.label.en || '')}</em></h3>
      <div class="tagrow"><span class="tag cat" style="--sw:var(--c-${p.cat})">${esc(CAT[p.cat] ? CAT[p.cat].zh : p.cat)}</span>${st ? `<span class="tag stage">第 ${p.stage + 1} 步 · ${esc(st.zh)}</span>` : ''}</div>
      <div class="actions">${back}${p.lens ? `<button id="btnLens">🔍 细节 (L)</button>` : ''}</div>
      ${termBlock(p.termKey, p)}`;
    if (p.assembly) $('#btnBackAsm').addEventListener('click', () => select(null, p.assembly));
    if (p.lens) $('#btnLens').addEventListener('click', () => enterLens(p.lens, p.assembly || p.id));
  }

  // ================= legend / filter =================
  function updateLegend() {
    const present = new Set(S.scene.parts.map(p => p.cat));
    $('#legend').innerHTML = D.CATS.filter(c => present.has(c.key) && c.key !== 'context').map(c => `<span class="chip" data-cat="${c.key}" style="--sw:var(--c-${c.key})"><i></i>${esc(c.zh)}</span>`).join('');
    $$('#legend .chip').forEach(ch => ch.addEventListener('click', () => { const k = ch.dataset.cat; if (S.filter.has(k)) S.filter.delete(k); else S.filter.add(k); applyFilter(); }));
  }
  function applyFilter() {
    svg.classList.toggle('filtered', S.filter.size > 0);
    $$('#legend .chip').forEach(ch => ch.classList.toggle('active', S.filter.has(ch.dataset.cat)));
    for (const id in S.els) { const g = S.els[id]; g.classList.toggle('match', S.filter.has(g.dataset.cat)); }
  }

  // ================= explode =================
  function toggleExplode(force) {
    S.exploded = force == null ? !S.exploded : force;
    svg.classList.toggle('exploded', S.exploded);
    $('#btnExplode').classList.toggle('active', S.exploded);
    exterior?.setExploded(S.exploded);
    if (!S.lens) { S.custom = false; setView(fitViewFor(fitBox()), true); }
  }

  // ================= lenses =================
  const LENS_TABS = {
    bracket: [{ id: 'side', zh: '侧视（剖面）' }, { id: 'front', zh: '正视（补间·斜栱）' }],
    window: [{ id: 'zhiling', zh: '直棂窗' }, { id: 'pozi', zh: '破子棂窗' }, { id: 'gezi', zh: '格子门' }, { id: 'linghua', zh: '菱花格扇' }, { id: 'door', zh: '板门' }]
  };
  const LENS_NOTE = {
    bracket: '斗拱把檩条的荷载一层层传到柱头：撩檐槫 → 替木·令栱 → 华栱／昂 → 栌斗 → 柱。昂斜置，用杠杆把屋檐挑得更远。点击任一小构件看名称与作用。',
    front: '从正面看，柱头上是柱头铺作，两柱之间是补间铺作。唐代每间只一朵，明清密排六至八攒并缩小成装饰。金代斜栱成 45° 伸出，是装饰化的开端。',
    eave: '出檐深度 = 斗拱出跳 + 檐椽伸出 + 飞椽伸出。唐代出檐近四米以保护土墙与台基；明清斗拱缩小、出檐变短。',
    frame: '屋架的荷载路线：屋面 → 椽 → 檩 → 蜀柱／驼峰／叉手／托脚 → 梁栿 → 斗拱 → 柱。留意斜向支撑（叉手·托脚）是否存在。',
    column: '柱子微向内倾（侧脚），角柱略高（生起），使构架向心稳定。减柱、移柱则为了腾出室内空间。勾选「夸大侧脚·生起」更易观察。',
    window: '窗棂从直棂窗（唐辽）到格子门（宋金，棂花多样）再到三交六椀菱花（明清官式），图案越繁、等级越高。'
  };
  function enterLens(type, target) {
    setMode('section');
    exitLens(false);
    if (type === 'window') { const kinds = (S.b.elevation.openings || []).filter(o => o !== 'door' && o !== 'wall'); return openSceneLens('window', kinds[0] || 'door'); }
    const a = S.scene.assemblies[target];
    const box = a ? a.bbox : (partById(target) || {}).bbox;
    if (!box) return;
    S.lens = { type, target, prevView: Object.assign({}, S.view), prevStage: S.stage, prevCustom: S.custom };
    svg.classList.add('lens');
    const inside = new Set(a ? a.parts : [target]);
    // neighbours whose bbox intersects the lens box count as context (kept visible but dimmer)
    for (const id in S.els) {
      const g = S.els[id]; const p = partById(id);
      const inter = p && !(p.bbox.x > box.x + box.w || p.bbox.x + p.bbox.w < box.x || p.bbox.y > box.y + box.h || p.bbox.y + p.bbox.h < box.y);
      g.classList.toggle('inside', inside.has(id));
      g.classList.toggle('outside', !inside.has(id) && !inter);
      if (inside.has(id)) g.classList.add('on');
    }
    const pad = Math.max(box.w, box.h) * 0.22;
    setView(R.fitView(box, pad, aspect()), true);
    const label = a ? a.label : partById(target).label;
    showLensBar(label, type === 'bracket' ? LENS_TABS.bracket : null, 'side', (tab) => { if (tab === 'front') openSceneLens('front'); else enterLens('bracket', target); });
    $('#lensNote').textContent = LENS_NOTE[type] || ''; $('#lensNote').hidden = !LENS_NOTE[type];
    if (a) select(null, target); else select(target, null);
  }
  function openSceneLens(kind, sub) {
    setMode('section');
    const prev = S.lens && S.lens.prevView ? S.lens : null;
    exitLens(false, true);
    S.lens = { type: 'scene', kind, sub, prevView: prev ? prev.prevView : Object.assign({}, S.view), prevStage: prev ? prev.prevStage : S.stage, prevCustom: S.custom };
    let scene, tabs, cur, label;
    if (kind === 'front') { scene = G.bracketFrontScene(S.b); tabs = LENS_TABS.bracket; cur = 'front'; label = { zh: '斗拱正视 · 一间之内', en: 'bracket row, front view' }; }
    else { scene = G.windowScene(S.b, sub); tabs = LENS_TABS.window; cur = sub; label = { zh: '门窗棂花', en: 'door and window lattices' }; }
    lensWrap.hidden = false;
    R.mountScene(lensSvg, scene, { prefix: 'lens', on: true });
    lensSvg.classList.add('dense');
    const r = lensSvg.getBoundingClientRect();
    const asp = r.width > 0 && r.height > 0 ? r.width / r.height : aspect();
    const v = R.fitView(scene.bbox, Math.max(scene.bbox.w, scene.bbox.h) * 0.12, asp);
    R.applyView(lensSvg, v);
    lensSvg.style.setProperty('--label-size', (12.5 * v.w / Math.max(r.width, 300)) + 'px');
    lensSvg.style.setProperty('--u', (v.w / Math.max(r.width, 300)) + 'px');
    const own = new Set(S.b.elevation.openings || []);
    showLensBar(label, tabs, cur, (tab) => { if (kind === 'front' && tab === 'side') { const asm = Object.keys(S.scene.assemblies).find(k => /L\d+-br-c0|LE-br-f/.test(k)); enterLens('bracket', asm); } else if (kind === 'front') { /* already */ } else openSceneLens('window', tab); }, kind === 'window' ? (t) => own.has(t.id) ? '● ' : '' : null);
    $('#lensNote').textContent = kind === 'front' ? LENS_NOTE.front : LENS_NOTE.window + (own.size ? ' ● 为本建筑所用式样。' : ''); $('#lensNote').hidden = false;
    lensSvg.onclick = (e) => { const g = e.target.closest('.part'); if (!g) return; const p = scene.parts.find(q => q.id === g.dataset.id); if (!p) return; $$('.part', lensSvg).forEach(x => x.classList.toggle('sel', x === g)); $('#panelBody').innerHTML = `<h3>${esc(p.label.zh)}<em>${esc(p.label.en || '')}</em></h3>${termBlock(p.termKey, p)}`; };
  }
  function showLensBar(label, tabs, cur, onTab, prefixFn) {
    $('#lensTitle').innerHTML = esc(label.zh) + (label.en ? `<em>${esc(label.en)}</em>` : '');
    $('#lensTabs').innerHTML = tabs ? tabs.map(t => `<button class="${t.id === cur ? '' : 'secondary'}" data-tab="${t.id}">${prefixFn ? prefixFn(t) : ''}${esc(t.zh)}</button>`).join('') : '';
    $$('#lensTabs button').forEach(b => b.addEventListener('click', () => onTab(b.dataset.tab)));
    $('#lensBar').hidden = false;
  }
  function exitLens(restore, keepBar) {
    if (!S.lens) return;
    const L = S.lens; S.lens = null;
    svg.classList.remove('lens');
    for (const id in S.els) { S.els[id].classList.remove('inside', 'outside'); }
    lensWrap.hidden = true; lensSvg.classList.remove('dense'); lensSvg.onclick = null;
    if (!keepBar) { $('#lensBar').hidden = true; $('#lensNote').hidden = true; }
    if (restore !== false) { setStage(L.prevStage, true); S.custom = L.prevCustom; if (L.prevCustom && L.prevView) setView(L.prevView, true); else setView(fitViewFor(fitBox()), true); }
  }
  $('#lensClose').addEventListener('click', () => exitLens(true));

  // ================= elevation inset =================
  function renderInset() {
    const ev = G.elevationScene(S.b, { exaggerate: S.exaggerate ? 3 : 1 });
    R.mountScene(elevSvg, ev, { prefix: 'ins', on: true });
    const v = R.fitView(ev.bbox, Math.max(ev.bbox.w, ev.bbox.h) * 0.04, 232 / 96);
    R.applyView(elevSvg, v);
  }
  $('#inset').addEventListener('click', () => enterLens('window'));

  // ================= evolution drawer =================
  function buildEvo() {
    const all = D.BUILDINGS.map(b => ({ b, sec: sceneFor(b, false), ev: G.elevationScene(b) }));
    const W = Math.max(...all.map(a => a.ev.bbox.w)) * 1.04, H = Math.max(...all.map(a => a.ev.bbox.h)) * 1.06;
    $('#evoCards').innerHTML = all.map(a => `<div class="evo-card" data-id="${a.b.id}"><svg id="evo-${a.b.id}" xmlns="http://www.w3.org/2000/svg"></svg><h3><b>${esc(a.b.dynasty.zh)}</b>${esc(a.b.name.zh)}</h3><small>${a.b.year} · ${esc(a.b.place.zh)} · ${esc(a.b.name.en)}</small><dl>${D.EVOLUTION.metrics.map(mt => { const v = a.sec.metrics[mt.key]; const num = typeof v === 'number' ? v : (v ? 1 : 0); const max = Math.max(...all.map(x => typeof x.sec.metrics[mt.key] === 'number' ? x.sec.metrics[mt.key] : (x.sec.metrics[mt.key] ? 1 : 0))) || 1; return `<dt>${esc(mt.zh)}</dt><dd>${esc(mt.fmt(v))}</dd><div class="evo-bar"><i style="width:${Math.round(100 * num / max)}%"></i></div>`; }).join('')}</dl></div>`).join('');
    all.forEach(a => {
      const s = $('#evo-' + a.b.id);
      R.mountScene(s, a.ev, { prefix: 'evo-' + a.b.id, on: true });
      const cx = a.ev.bbox.x + a.ev.bbox.w / 2;
      R.applyView(s, { x: cx - W / 2, y: -(a.ev.bbox.y + a.ev.bbox.h) - (H - a.ev.bbox.h) * 0.5, w: W, h: H });
    });
    $$('.evo-card').forEach(c => c.addEventListener('click', () => { toggleEvo(false); loadBuilding(c.dataset.id, { animate: true }); }));
    $('#evoTrends').innerHTML = (D.TRENDS || []).map(t => `<div class="trend"><b>${esc(t.zh)}</b>${esc(t.text)}</div>`).join('');
  }
  function toggleEvo(force) {
    if (force !== false) setMode('section');
    const open = force == null ? $('#evo').hidden : force;
    if (open) buildEvo();
    $('#evo').hidden = !open; $('#btnEvo').classList.toggle('active', open);
  }
  $('#evoClose').addEventListener('click', () => toggleEvo(false));

  // ================= tour =================
  const TOUR_MS = 16000;
  function startTour() {
    setMode('section');
    if (!D.TOUR.length) return;
    S.tour = { i: 0, timer: null }; $('#btnTour').classList.add('active'); $('#tourBar').hidden = false; toggleEvo(false);
    tourStep(0);
  }
  function tourStep(i) {
    if (!S.tour) return;
    const steps = D.TOUR; if (i < 0 || i >= steps.length) { endTour(); return; }
    S.tour.i = i; clearTimeout(S.tour.timer);
    const st = steps[i];
    $('#tourText').innerHTML = `<b>${esc(st.title || '')}</b>${esc(st.text)}`;
    $('#tourPos').textContent = `${i + 1} / ${steps.length}`;
    const apply = () => {
      if (!S.tour || S.tour.i !== i) return;
      if (st.evo) { toggleEvo(true); if (!reduced) S.tour.timer = setTimeout(() => tourStep(i + 1), st.dur || TOUR_MS); return; }
      if (S.stage < 9 && !st.build) { clearTimers(); S.building = false; setStage(9, true); }
      if (st.explode != null) toggleExplode(!!st.explode);
      if (st.lens) { const asm = Object.keys(S.scene.assemblies).find(k => new RegExp(st.lens).test(k)); if (asm) enterLens(S.scene.assemblies[asm].lens || 'frame', asm); }
      else if (st.select) { const asm = Object.keys(S.scene.assemblies).find(k => new RegExp(st.select).test(k)); const p = S.scene.parts.find(q => new RegExp(st.select).test(q.id)); if (asm) select(null, asm); else if (p) select(p.id, null); }
      else if (st.filter) { S.filter = new Set(st.filter); applyFilter(); }
      if (!reduced) S.tour.timer = setTimeout(() => tourStep(i + 1), st.dur || TOUR_MS);
    };
    toggleEvo(false);
    if (!S.b || S.b.id !== st.building) { loadBuilding(st.building, { animate: !!st.build, stage: st.stage }); setTimeout(apply, st.build ? STAGE_MS * 10.6 : 250); }
    else { exitLens(true); deselect(false); S.filter.clear(); applyFilter(); if (st.explode == null && S.exploded) toggleExplode(false); if (st.build) playBuild(); else if (st.stage != null) setStage(st.stage, true); setTimeout(apply, st.build ? STAGE_MS * 10.6 : 80); }
  }
  function endTour() { if (!S.tour) return; clearTimeout(S.tour.timer); S.tour = null; $('#tourBar').hidden = true; $('#btnTour').classList.remove('active'); exitLens(true); deselect(); }
  $('#tourPrev').addEventListener('click', () => tourStep(S.tour.i - 1));
  $('#tourNext').addEventListener('click', () => tourStep(S.tour.i + 1));
  $('#tourExit').addEventListener('click', endTour);

  // ================= nav / controls =================
  function buildNav() {
    $('#dynastyNav').innerHTML = D.BUILDINGS.map((b, i) => `<button class="dyn-pill" data-id="${b.id}" title="${esc(b.name.zh)} · ${b.year}（${i + 1}）"><b>${esc(b.dynasty.zh)}</b><span>${b.year}</span><small>${esc(b.dynasty.en)}</small></button>`).join('');
    $$('.dyn-pill').forEach(p => p.addEventListener('click', () => { p.blur(); if (S.tour) endTour(); loadBuilding(p.dataset.id, { animate: true }); }));
  }
  function updateNav() { $$('.dyn-pill').forEach(p => p.classList.toggle('active', p.dataset.id === S.b.id)); }
  $('#btnBuild').addEventListener('click', (e) => { e.currentTarget.blur(); playBuild(); });
  $('#btnExplode').addEventListener('click', (e) => { e.currentTarget.blur(); toggleExplode(); });
  $('#btnEvo').addEventListener('click', (e) => { e.currentTarget.blur(); toggleEvo(); });
  $('#btnTour').addEventListener('click', (e) => { e.currentTarget.blur(); S.tour ? endTour() : startTour(); });
  $('#chkProjector').addEventListener('change', (e) => document.body.classList.toggle('projector', e.target.checked));
  $('#chkExaggerate').addEventListener('change', (e) => { S.exaggerate = e.target.checked; const st = S.stage; loadBuilding(S.b.id, { animate: false, stage: st }); });
  $('#chkSameScale').addEventListener('change', (e) => { S.sameScale = e.target.checked; resetView(true); });
  $('#btnFs').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); });
  document.addEventListener('fullscreenchange', () => setTimeout(() => resetView(false), 80));
  new ResizeObserver(() => { if (!S.view) return; if (S.lens || S.custom) afterView(); else setView(fitViewFor(fitBox()), false); }).observe(svg);
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && S.b && id !== S.b.id && D.BUILDINGS.some(b => b.id === id)) loadBuilding(id, { animate: true }); });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Escape') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '6') { const b = D.BUILDINGS[+k - 1]; if (b) { if (S.tour) endTour(); loadBuilding(b.id, { animate: true }); } }
    else if (k === 'b' || k === 'B') playBuild();
    else if (k === 'e' || k === 'E') toggleExplode();
    else if (k === 'v' || k === 'V') toggleEvo();
    else if (k === 't' || k === 'T') S.tour ? endTour() : startTour();
    else if (k === 'f' || k === 'F') $('#btnFs').click();
    else if (k === 'l' || k === 'L') { if (S.selected) { const { partId, asmId } = S.selected; const p = partById(partId || (S.scene.assemblies[asmId] || {}).parts[0]); enterLens(asmId ? (S.scene.assemblies[asmId].lens || 'frame') : (p && p.lens) || 'column', asmId || partId); } }
    else if (k === '0') { if (viewMode === 'exterior') exterior.view('perspective'); else resetView(true); }
    else if (k === 'ArrowRight') { e.preventDefault(); if (S.tour) tourStep(S.tour.i + 1); else stepStage(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); if (S.tour) tourStep(S.tour.i - 1); else stepStage(-1); }
    else if (k === 'Escape') { if (!$('#evo').hidden) toggleEvo(false); else if (S.lens) exitLens(true); else if (S.tour) endTour(); else deselect(); }
    else return;
  });

  // ================= init =================
  function init() {
    try {
      exterior = rootExterior();
    } catch (error) {
      console.warn('Three-dimensional view unavailable:', error.message);
      $('[data-view="exterior"]').disabled = true;
      $('[data-view="exterior"]').title = '当前浏览器无法启用三维视图';
    }
    setMode(viewMode);
    window.lucide?.createIcons();
    buildNav(); buildStageBar();
    const id = location.hash.slice(1);
    loadBuilding(D.BUILDINGS.some(b => b.id === id) ? id : D.BUILDINGS[0].id, { animate: !reduced });
    if (!D.TOUR.length) $('#btnTour').disabled = true;
  }
  function rootExterior() {
    return window.ARCH_REALISTIC.create($('#exterior'), (cat) => {
      const part = S.scene.parts.find((p) => p.cat === cat && !p.style.ghost);
      if (part) select(part.assembly ? null : part.id, part.assembly || null);
    });
  }
  init();
  // small debug/test surface (used by the Playwright smoke run)
  window.__arch = { state: S, setStage, loadBuilding, toggleExplode, enterLens, exitLens, select, resetView,
    toggleEvo, startTour, endTour, setMode, exterior };
})();
