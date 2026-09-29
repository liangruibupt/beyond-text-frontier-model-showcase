// Node invariants for the geometry generator. Run: node chinese-architecture/test/geometry.test.js
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'data.js'));
require(path.join(__dirname, '..', 'geometry.js'));
let GLOSS = null;
try { require(path.join(__dirname, '..', 'glossary.js')); GLOSS = globalThis.ARCH_GLOSSARY; } catch (e) { /* optional until M2 */ }
const { BUILDINGS } = globalThis.ARCH_DATA;
const G = globalThis.ARCH_GEO;
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('  FAIL', msg); } };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const byId = {};
for (const b of BUILDINGS) {
  const sc = G.sectionScene(b);
  byId[b.id] = sc;
  console.log(`${b.id}: ${sc.parts.length} parts, bbox ${JSON.stringify(sc.bbox)}, metrics ${JSON.stringify(sc.metrics)}`);
  const ids = new Set(sc.parts.map(p => p.id));
  check(ids.size === sc.parts.length, 'duplicate ids');
  check(sc.bbox.y === -b.platform.h, 'ground not at platform bottom (' + sc.bbox.y + ')');
  const missing = new Set();
  for (const p of sc.parts) {
    check(p.stage >= 0 && p.stage <= 9, 'stage out of range ' + p.id);
    check(['platform', 'column', 'tie', 'bracket', 'beam', 'strut', 'inclined', 'purlin', 'rafter', 'roof', 'ceiling', 'wall', 'window', 'ghost', 'context'].includes(p.cat), 'bad cat ' + p.cat + ' ' + p.id);
    for (const s of p.shapes) {
      const vals = s.t === 'poly' ? s.pts.flat() : Object.values(s).filter(v => typeof v === 'number');
      check(vals.every(finite), 'non-finite coordinate in ' + p.id);
      if (s.t === 'rect') check(s.w > 0 && s.h > 0, 'degenerate rect in ' + p.id);
      if (s.t === 'circle') check(s.r > 0, 'degenerate circle in ' + p.id);
    }
    check(finite(p.explode.dx) && finite(p.explode.dy), 'bad explode ' + p.id);
    check(!!p.termKey, 'no termKey ' + p.id);
    if (GLOSS && p.termKey && !GLOSS[p.termKey]) missing.add(p.termKey);
    check(p.label && p.label.zh, 'no zh label ' + p.id);
  }
  if (missing.size) { failures++; console.error('  FAIL glossary missing termKeys:', [...missing].join(', ')); }
  const stages = new Set(sc.parts.map(p => p.stage));
  for (let s = 0; s <= 8; s++) check(stages.has(s), 'empty stage ' + s);
  const ev = G.elevationScene(b);
  check(ev.parts.length > 10, 'elevation too small');
  const bf = G.bracketFrontScene(b);
  check(bf.parts.length > 10, 'bracket front too small');
  for (const k of ['zhiling', 'pozi', 'gezi', 'linghua', 'door']) check(G.windowScene(b, k).parts.length >= 2, 'window scene ' + k);
}
// cross-building expectations (only when those buildings exist)
const m = (id) => byId[id] && byId[id].metrics;
if (m('tang-foguang')) check(m('tang-foguang').bracketRatio > 0.4, 'Tang bracket ratio should exceed 0.4: ' + m('tang-foguang').bracketRatio);
if (m('ming-changling')) {
  check(m('ming-changling').bracketRatio < 0.25, 'Ming bracket ratio should be small: ' + m('ming-changling').bracketRatio);
  check(m('ming-changling').hasChashou === false, 'Ming has no cha shou');
  if (m('tang-foguang')) check(m('tang-foguang').slopeRatio < m('ming-changling').slopeRatio, 'Tang roof flatter than Ming');
}
if (m('jin-mituo')) check(m('jin-mituo').removedColumns > 0, 'Jin shows omitted columns');
if (m('yuan-sanqing')) check(m('yuan-sanqing').removedColumns > 0, 'Yuan shows omitted columns');
if (m('liao-guanyin')) check(m('liao-guanyin').storeys === 3, 'Liao has 3 structural storeys');
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall geometry checks passed');
