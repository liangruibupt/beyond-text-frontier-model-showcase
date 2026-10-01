// cup.js — 奶茶杯：透明 PP 杯（薄壁截锥）、茶汤（顶上一层清茶 + 奶纹 + 黑糖虎纹）、封膜（被吸管压凹、刺破成几瓣）、吸管、
// 杯壁冷凝水珠（闭式：位置和半径由 rand(seed, i) 定，随 t 长大；一颗在 hero 里滑下来）、杯底的珍珠（烘好的表按 t 取样）、冰块
// 原点在杯底中心，y 向上，米；尺寸取 meta.js 的 CUP / STRAW / PEARL。玻璃和茶汤的折射由 js/tea.js 接到共享的 refract.js
import * as THREE from 'three';
import { CUP, STRAW, PEARL } from '../meta.js';
import { rand } from '../../factory/engine/rng.js';
import { clamp, ss, easeOut, lerp } from '../../factory/engine/ease.js';
import { pearlAt } from './pearls.js';
import { LAYER } from '../../factory/engine/refract.js';

const K = (CUP.rTop - CUP.rBottom) / CUP.height, SLANT = Math.sqrt(1 + K * K);
/** 外壁 y 处的半径 */
export const rOut = y => CUP.rBottom + K * y;
/** 内壁 y 处的半径 */
export const rIn = y => rOut(y) - CUP.wall * SLANT;

// ── 冷凝水珠（闭式）──
// 杯壁上 N 颗水珠：高度在液面以下（冰茶把杯壁冷下来的那一段），方位角、半径都由 rand 定；半径随 t 从 0 长到 r（凝出来）
export const DEW = { seed: 23, n: 200, r: [0.0004, 0.0019], grow: [0.2, 2.2], drip: { i: 0, at: 1.5, dur: 1.3, fall: 0.055 } };
/** 第 i 颗水珠在 hero 本地 t 秒的 [方位角, 高度, 半径]；drip 那颗在 drip.at 秒开始往下滑，边滑边拉长（半径不变） */
export function dewAt(i, t, D = DEW) {
  const a = rand(D.seed, 3 * i) * Math.PI * 2, y0 = CUP.base + 0.006 + rand(D.seed, 3 * i + 1) * (CUP.fill - CUP.base - 0.012);
  const r1 = lerp(D.r[0], D.r[1], rand(D.seed, 3 * i + 2) ** 2), g = ss(D.grow[0] * (0.6 + rand(D.seed, 7000 + i) * 0.8), D.grow[1], t);
  if (i !== D.drip.i) return [a, y0, r1 * g];
  const top = CUP.fill - 0.004, k = easeOut(clamp((t - D.drip.at) / D.drip.dur)) ** 1.4;   // 滑落那颗放在正面偏上，个头最大
  return [-0.35, top - D.drip.fall * k, D.r[1] * 1.25 * g];
}

// 奶柱：从画面左上方抛下来的一道弧，落点在杯口偏左后方（让开镜头正面的奶纹）；x, z 是落点
//   start 弧的起点（出画）；head 奶头落到液面用的秒数；stop 停止倒的时刻，之后奶尾 tail 秒落完；
//   r 落点处的半径（越往上越粗：流速慢）；twist 截面椭圆沿弧拧几圈（像参考图里那道拧着的奶）；sway 摆动幅度
export const STREAM = { x: -0.012, z: -0.006, r: 0.0032, start: [-0.1, 0.2, -0.02], head: 0.16, stop: 1.6, tail: 0.22, twist: 2.2, sway: 0.0022 };
/** 奶柱中心线：u 0（起点）… 1（落点 y = top）；平抛：水平匀速、竖直按 u² 下落；t = 倒奶后的秒数（摆动用） */
export function streamAt(u, top, t, out = [0, 0, 0]) {
  const [sx, sy, sz] = STREAM.start, w = 4 * u * (1 - u) * STREAM.sway;
  const h = 1 - (1 - u) ** 2;                                           // 出口处几乎是横着出来的，越往下越陡
  out[0] = lerp(sx, STREAM.x, h) + w * Math.sin(9 * u - 7 * t);
  out[1] = sy - (sy - top) * u ** 1.6;
  out[2] = lerp(sz, STREAM.z, h) + 0.6 * w * Math.cos(7 * u - 5 * t);
  return out;
}
/** 倒奶时液面相对静止液面的起伏（米）：落点一个坑、坑沿一圈鼓起、往外扩的波纹、细碎的浪；贴壁处归零。闭式，只由 (x, z, t) 定 */
export function surfaceDisp(x, z, t, R) {
  if (t < 0) return 0;
  const S = STREAM, on = ss(S.head * 0.7, S.head + 0.05, t) * (1 - ss(S.stop + S.tail * 0.6, S.stop + S.tail + 0.15, t));
  const wave = ss(S.head * 0.7, S.head + 0.25, t) * (t > S.stop ? Math.exp(-2.2 * (t - S.stop)) : 1);
  const d = Math.hypot(x - S.x, z - S.z), rr = Math.hypot(x, z) / R;
  const crater = -0.006 * Math.exp(-((d / 0.006) ** 2)) + 0.0024 * Math.exp(-(((d - 0.012) / 0.004) ** 2));
  const ripple = 0.0014 * Math.sin(2 * Math.PI * (d / 0.009 - 3.2 * t)) * Math.exp(-d / 0.035) * Math.min(1, d / 0.006);
  const chop = 0.00045 * Math.sin(x * 260 + t * 9) * Math.sin(z * 230 - t * 7);
  return (1 - rr ** 8) * (on * crater + wave * (ripple + chop));
}
const FOAM = { seed: 41, n: 320, impact: 140 }, SPLASH = { seed: 57, n: 30 };

// ── 封膜：吸管从正上方压下去，封膜先凹成一个圆锥形的坑，press = 1 那一刻刺破成 FLAPS 瓣往下翻 ──
export const LID = { flaps: 6, dent: 0.009, radius: 0.034 };
/** 封膜离杯口平面往下凹的深度（米）：r 离中心的距离，press 0..1 压下的程度（刺破前）；是 r 的光滑单调函数 */
export function lidDent(r, press, L = LID) {
  const k = clamp(1 - r / L.radius);
  return L.dent * press * k * k * (3 - 2 * k);
}

function frustumGeo(r0, r1, y0, y1, seg = 96, open = true) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** 封膜：一张圆盘网格，逐帧改顶点高度（凹坑）；刺破后换成几瓣往下翻的扇形 */
function buildLid(mat) {
  const R = rOut(CUP.height) + 0.0008, rings = 24, segs = 96, pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let j = 1; j <= rings; j++) for (let i = 0; i < segs; i++) { const r = (R * j) / rings, a = (i / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  const at = (j, i) => 1 + (j - 1) * segs + (i % segs);
  for (let i = 0; i < segs; i++) idx.push(0, at(1, i + 1), at(1, i));
  for (let j = 1; j < rings; j++) for (let i = 0; i < segs; i++) idx.push(at(j, i), at(j, i + 1), at(j + 1, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let v = 0; v < pos.length / 3; v++) { uv[2 * v] = pos[3 * v] / (2 * R) + 0.5; uv[2 * v + 1] = pos[3 * v + 2] / (2 * R) + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, mat), base = Float32Array.from(pos);
  // 刺破后的瓣：中心那一圈（半径 hole）分成 FLAPS 个扇形，绕各自外沿的切线往下翻
  const hole = STRAW.r * 1.9, flaps = new THREE.Group();
  for (let f = 0; f < LID.flaps; f++) {
    const a0 = (f / LID.flaps) * Math.PI * 2, a1 = ((f + 1) / LID.flaps) * Math.PI * 2 - 0.05;
    const s = new THREE.Mesh(new THREE.CircleGeometry(hole, 6, a0, a1 - a0), mat);
    s.rotation.x = -Math.PI / 2;
    const hinge = new THREE.Group(), mid = (a0 + a1) / 2;
    hinge.position.set(Math.cos(mid) * hole, 0, -Math.sin(mid) * hole);
    s.position.set(-Math.cos(mid) * hole, 0, Math.sin(mid) * hole);
    hinge.add(s); hinge.userData.axis = new THREE.Vector3(-Math.sin(mid), 0, -Math.cos(mid)); flaps.add(hinge);
  }
  return { mesh: m, base, flaps, hole };
}

/** 封膜的图案（只在浏览器里用）：啵茶的 logo 圆章。Node 测试里不传 */
export function lidArt(FONTS, pal) {
  const c = document.createElement('canvas'), N = 1024; c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, N, N);
  g.strokeStyle = pal.accent; g.lineWidth = N * 0.02; g.beginPath(); g.arc(N / 2, N / 2, N * 0.4, 0, Math.PI * 2); g.stroke();
  g.fillStyle = pal.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${FONTS.zh.display.weight} ${N * 0.2}px "${FONTS.zh.display.family}"`; g.fillText('啵茶', N / 2, N * 0.46);
  g.font = `${FONTS.brand.weight} ${N * 0.075}px "${FONTS.brand.family}"`; g.letterSpacing = `${N * 0.02}px`; g.fillText('BOCHA', N / 2, N * 0.62);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** flavor = FLAVORS[...]；pearls = bakePearls() 的表；art = lidArt(...) 的纹理（Node 里不传） */
export function buildCup(ctx, flavor, pearls, { art = null } = {}) {
  const root = new THREE.Group();
  // 杯壁：外壁一圈 + 杯底（折射材质由 tea.js 换掉；这里先给一份透明材质，Node 测试和没有折射时用）
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.25, depthWrite: false });
  const glass = new THREE.Mesh(frustumGeo(CUP.rBottom, CUP.rTop, 0, CUP.height), glassMat);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(CUP.rBottom, 64), glassMat); bottom.rotation.x = -Math.PI / 2; glass.add(bottom);
  // 杯口唇边：一圈细圆环（不透明的白 PP，折射模块只管凸实体）
  const lip = new THREE.Mesh(new THREE.TorusGeometry(CUP.rTop + 0.0004, 0.0011, 12, 120), new THREE.MeshPhysicalMaterial({ color: '#f6f4ef', roughness: 0.25, clearcoat: 0.5 }));
  lip.rotation.x = Math.PI / 2; lip.position.y = CUP.height;

  // 茶汤：一个实心截锥，顶面是液面（fill 由 pose 改：pour 镜头里茶汤往上涨）
  const liquid = new THREE.Group(), gap = 0.0003, r = y => rIn(y) - gap * SLANT;
  const liqMat = new THREE.MeshPhysicalMaterial({ color: flavor.liquid.color, roughness: 0.2 });
  const body = new THREE.Mesh(frustumGeo(r(CUP.pile), r(CUP.fill), CUP.pile, CUP.fill, 96, true), liqMat);   // 茶汤从珍珠层上面开始；侧面，顶面另画
  // 液面：极坐标网格，倒奶时逐帧改高度（坑、波纹、浪）；和 body 一样只缩 y，几何坐标里 y = fill 就是液面（奶纹按几何坐标算）
  const SR = r(CUP.fill), SRINGS = 36, SSEGS = 96, spos = [0, CUP.fill, 0], sidx = [];
  for (let j = 1; j <= SRINGS; j++) for (let i = 0; i < SSEGS; i++) { const a = (i / SSEGS) * Math.PI * 2, rr = (SR * j) / SRINGS; spos.push(Math.cos(a) * rr, CUP.fill, Math.sin(a) * rr); }
  const sat = (j, i) => 1 + (j - 1) * SSEGS + (i % SSEGS);
  for (let i = 0; i < SSEGS; i++) sidx.push(0, sat(1, i + 1), sat(1, i));
  for (let j = 1; j < SRINGS; j++) for (let i = 0; i < SSEGS; i++) sidx.push(sat(j, i), sat(j, i + 1), sat(j + 1, i), sat(j, i + 1), sat(j + 1, i + 1), sat(j + 1, i));
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3)); sgeo.setIndex(sidx); sgeo.computeVertexNormals();
  const surface = new THREE.Mesh(sgeo, liqMat), sxz = Float32Array.from(spos);
  liquid.add(body, surface);
  // 珍珠层里的糖浆 / 果泥：半透明，透过杯壁看得见泡在里面的珍珠（在第 0 层画，不走折射）
  const syrupMat = new THREE.MeshPhysicalMaterial({ color: flavor.syrup ?? flavor.liquid.color, roughness: 0.15, transparent: true, opacity: 0.42, depthWrite: false });
  const syrup = new THREE.Mesh(frustumGeo(r(CUP.base + gap), r(CUP.pile), CUP.base + gap, CUP.pile, 96, false), syrupMat);
  syrup.renderOrder = 1;

  // 珍珠：一个 InstancedMesh，逐帧按烘好的表摆位置
  const pearlMat = new THREE.MeshPhysicalMaterial({ color: flavor.pearl.color, roughness: flavor.pearl.roughness, clearcoat: 1, clearcoatRoughness: 0.08,
    transmission: flavor.pearl.clear, thickness: PEARL.r * 1.5, ior: 1.4 });
  const pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(PEARL.r, 20, 14), pearlMat, PEARL.count);
  pearlMesh.frustumCulled = false; pearlMesh.castShadow = true;

  // 冰块：三块圆角立方（contents 层，由 tea.js 接进折射；pose 按闭式轨迹摆）
  const ice = new THREE.Group(), ICE = [[-0.011, 0.004, 0.006, 0.4], [0.013, -0.006, 0.01, 1.3], [-0.002, 0.012, -0.012, 2.1]];
  for (const [x, z, , rot] of ICE) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.016, 0.017, 2, 2, 2), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08 }));
    c.userData.rest = [x, z, rot]; ice.add(c);
  }

  // 冷凝水珠：一个 InstancedMesh，半球贴在外壁上
  // 水珠：基本透明，靠清漆高光读出来。画在 over 层（玻璃之后），放第 0 层会被后画的茶汤和杯壁盖掉，一颗都看不见。
  // 不用 transmission：over 那一遍里开 transmission 会让 three 多渲一遍整个场景
  const dewMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 2.5, transparent: true, opacity: 0.1, depthWrite: false });
  const dew = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), dewMat, DEW.n);
  dew.frustumCulled = false; dew.layers.set(LAYER.over);

  // 封膜 + 吸管
  const lidMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: art, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
  const lid = buildLid(lidMat); lid.mesh.position.y = CUP.height + 0.0006; lid.flaps.position.y = CUP.height + 0.0006;
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(STRAW.r, STRAW.r, STRAW.len, 40, 1, true),
    new THREE.MeshPhysicalMaterial({ color: flavor.palette.accent, roughness: 0.25, clearcoat: 0.7, side: THREE.DoubleSide }));
  straw.castShadow = true;
  const tip = new THREE.Mesh(new THREE.RingGeometry(STRAW.r * 0.85, STRAW.r, 40), straw.material); tip.rotation.x = Math.PI / 2; tip.position.y = STRAW.len / 2; straw.add(tip);

  // 注入的那一道奶：沿 streamAt 的弧扫出来的管子，截面是拧着的椭圆，画在 over 层（玻璃之后，挡在杯壁前面也不会被盖掉）
  const TR = 80, TS = 18, tpos = new Float32Array((TR + 1) * TS * 3), tidx = [];
  for (let j = 0; j < TR; j++) for (let i = 0; i < TS; i++) { const a = j * TS + i, b = j * TS + (i + 1) % TS; tidx.push(a, a + TS, b, b, a + TS, b + TS); }
  const tgeo = new THREE.BufferGeometry(); tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tgeo.setIndex(tidx);
  const stream = new THREE.Mesh(tgeo, new THREE.MeshPhysicalMaterial({ color: flavor.milk, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15, side: THREE.DoubleSide }));
  stream.layers.set(LAYER.over); stream.frustumCulled = false;
  // 奶泡：液面上的小泡，一团围着落点、一圈贴着杯壁；溅起的奶滴：从落点往外抛的小珠（都在第 0 层：浮在液面以上，透过杯壁折射看到）
  const milkC = new THREE.Color(flavor.milk);
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhysicalMaterial({ color: milkC.clone().lerp(new THREE.Color('#ffffff'), 0.45), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }), FOAM.n);
  foam.frustumCulled = false;
  const splash = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhysicalMaterial({ color: flavor.milk, roughness: 0.2, clearcoat: 0.8 }), SPLASH.n);
  splash.frustumCulled = false;

  root.add(glass, lip, liquid, syrup, pearlMesh, ice, dew, stream, foam, splash, lid.mesh, lid.flaps, straw, contactShadow());

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), S3 = new THREE.Vector3(), P = new THREE.Vector3(), q3 = [0, 0, 0], UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3();
  const lp = lid.mesh.geometry.attributes.position;
  let shownDent = NaN;
  function shapeLid(press) {
    if (press === shownDent) return;
    for (let v = 0; v < lp.count; v++) lp.setY(v, -lidDent(Math.hypot(lid.base[3 * v], lid.base[3 * v + 2]), press));
    lp.needsUpdate = true; lid.mesh.geometry.computeVertexNormals(); shownDent = press;
  }

  const cup = {
    root, parts: { glass, liquid, body, surface, syrup, ice, pearls: pearlMesh, dew, stream, foam, splash, lid: lid.mesh, straw }, posed: null,
    /**
     * 完整姿态，没写的量回到默认：
     *   pearlsT 珍珠表的取样时刻（秒，默认烘焙末尾：已堆好）；fill 茶汤高度 0..1（0 = 空杯）；iceT 冰块落下后的秒数（< 0 = 没有冰）；
     *   dewT 冷凝长出来的秒数（< 0 = 没有）；press 吸管压封膜 0..1，punch 刺破后的秒数（< 0 = 没刺破）；straw 吸管插进去的深度 0..1（< 0 = 不显示）；
     *   lid 显示封膜；nudge 吸管搅动珍珠的秒数；pourT 倒奶后的秒数（< 0 = 没在倒：液面是平的，没有奶柱、奶泡、奶滴）
     */
    pose({ pearlsT = pearls.t1, fill = 1, iceT = -1, dewT = -1, press = 0, punch = -1, straw: sd = -1, lid: showLid = true, nudge = -1, pourT = -1 } = {}) {
      // 珍珠：插进去的吸管把附近的珍珠往外推一点
      const sx = 0.004, sz = 0.002;
      for (let i = 0; i < PEARL.count; i++) {
        pearlAt(pearls, pearlsT, i, q3);
        if (nudge > 0) {
          const dx = q3[0] - sx, dz = q3[2] - sz, d = Math.hypot(dx, dz) || 1, push = 0.004 * ss(0, 0.5, nudge) * Math.exp(-d / 0.01) * Math.sin(Math.min(nudge * 3, Math.PI));
          q3[0] += (dx / d) * push; q3[2] += (dz / d) * push;
        }
        M.makeTranslation(q3[0], q3[1], q3[2]); pearlMesh.setMatrixAt(i, M);
      }
      pearlMesh.instanceMatrix.needsUpdate = true;
      // 茶汤：fill 0..1 从杯底涨到 CUP.fill
      const top = lerp(CUP.pile + 0.001, CUP.fill, clamp(fill));
      liquid.visible = fill > 0.001;
      syrup.visible = fill > 0.001;
      body.scale.y = Math.max((top - CUP.pile) / (CUP.fill - CUP.pile), 1e-3); body.position.y = CUP.pile * (1 - body.scale.y);
      surface.scale.y = body.scale.y; surface.position.y = body.position.y;
      // 液面：几何坐标里 y = fill + 起伏 / 缩放（缩回去正好是 top + 起伏）；茶汤很浅时起伏跟着变小，坑不会挖进珍珠层
      const dep = clamp((top - CUP.pile) / 0.012), sp = sgeo.attributes.position;
      const disp = (x, z) => dep * surfaceDisp(x, z, pourT, SR);
      for (let v = 0; v < sp.count; v++) sp.setY(v, CUP.fill + disp(sxz[3 * v], sxz[3 * v + 2]) / body.scale.y);
      sp.needsUpdate = true; sgeo.computeVertexNormals();
      const surfY = (x, z) => top + disp(x, z);
      // 奶柱：u 从奶尾到奶头（倒奶开始时奶头往下落，停止后奶尾往下落），落点那头插进液面一点
      const ST = STREAM, uH = clamp(pourT / ST.head), uT = clamp((pourT - ST.stop) / ST.tail);
      stream.visible = pourT >= 0 && uH - uT > 0.005;
      if (stream.visible) {
        const tp = tgeo.attributes.position, c = [0, 0, 0], c2 = [0, 0, 0], T = new THREE.Vector3(), B1 = new THREE.Vector3(), B2 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
        for (let j = 0; j <= TR; j++) {
          const k = j / TR, u = lerp(uT, uH * 1.03, k);
          streamAt(u, top, pourT, c); streamAt(u + 0.002, top, pourT, c2);
          T.set(c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]).normalize(); B1.crossVectors(T, Z).normalize(); B2.crossVectors(T, B1);
          const cap = (uH < 1 ? Math.sqrt(ss(0, 0.06, uH - u + 0.002)) : 1) * (uT > 0 ? Math.sqrt(ss(0, 0.06, u - uT + 0.002)) : 1);
          const rad = ST.r * (1.9 - 0.9 * Math.min(u, 1)) * Math.max(cap, 0.05), th = ST.twist * Math.PI * u + pourT * 1.5;
          for (let i = 0; i < TS; i++) {
            const a = (i / TS) * Math.PI * 2, ca = Math.cos(a) * rad * 1.7, sa = Math.sin(a) * rad / 1.7;
            const e1 = ca * Math.cos(th) - sa * Math.sin(th), e2 = ca * Math.sin(th) + sa * Math.cos(th), o = (j * TS + i) * 3;
            tp.array[o] = c[0] + B1.x * e1 + B2.x * e2; tp.array[o + 1] = c[1] + B1.y * e1 + B2.y * e2; tp.array[o + 2] = c[2] + B1.z * e1 + B2.z * e2;
          }
        }
        tp.needsUpdate = true; tgeo.computeVertexNormals();
      } else if (tgeo.attributes.position.array[0] !== 0 || tgeo.attributes.position.array[1] !== 0) { tgeo.attributes.position.array.fill(0); tgeo.attributes.position.needsUpdate = true; }   // 看不见时清零：不留上一帧
      // 奶泡：一团围着落点慢慢往外漂、一圈贴着杯壁；奶头落下后陆续冒出来，停止倒奶后陆续破掉
      foam.visible = pourT >= 0;
      for (let i = 0; i < FOAM.n; i++) {
        const t = Math.max(pourT, 0), a0 = rand(FOAM.seed, 5 * i) * Math.PI * 2, q = rand(FOAM.seed, 5 * i + 1), sz = lerp(0.0005, 0.0021, rand(FOAM.seed, 5 * i + 2) ** 2.2);
        const ring = i >= FOAM.impact, born = ST.head + (ring ? 0.35 : 0.05) + rand(FOAM.seed, 5 * i + 3) * 1.1, die = ST.stop + 0.25 + rand(FOAM.seed, 5 * i + 4) * 1.6;
        const g = ss(born, born + 0.2, t) * (1 - ss(die, die + 0.08, t)) * dep;
        let x, z;
        if (ring) { const rr = SR * (0.9 + 0.09 * q); x = Math.cos(a0) * rr; z = Math.sin(a0) * rr; }
        else { const d = 0.006 + 0.013 * q + 0.007 * ss(born, born + 1.5, t), a = a0 + 0.25 * (t - born); x = ST.x + Math.cos(a) * d; z = ST.z + Math.sin(a) * d; const m = Math.hypot(x, z); if (m > SR * 0.93) { x *= SR * 0.93 / m; z *= SR * 0.93 / m; } }
        const rr = Math.max(sz * g, 1e-6);
        M.compose(P.set(x, surfY(x, z) + rr * 0.15, z), Q.identity(), S3.set(rr, rr * 0.75, rr)); foam.setMatrixAt(i, M);
      }
      foam.instanceMatrix.needsUpdate = true;
      // 奶滴：每颗按自己的周期反复从落点抛出去（平抛，g = 9.8），落回液面以下或碰到杯壁就看不见；只在奶柱冲着液面时有
      splash.visible = pourT >= 0;
      for (let j = 0; j < SPLASH.n; j++) {
        const per = 0.28 + 0.2 * rand(SPLASH.seed, j), ph = rand(SPLASH.seed, j + 100), k = Math.floor((pourT - ST.head) / per + ph), t0 = ST.head + (k - ph) * per, tau = pourT - t0;
        const az = rand(SPLASH.seed, 1000 + 7 * j + 3 * k) * Math.PI * 2, el = lerp(0.95, 1.35, rand(SPLASH.seed, 2000 + 7 * j + 3 * k)), v = lerp(0.3, 0.55, rand(SPLASH.seed, 3000 + 7 * j + 3 * k));
        const x = ST.x + Math.cos(az) * Math.cos(el) * v * tau, z = ST.z + Math.sin(az) * Math.cos(el) * v * tau, y = top + 0.001 + Math.sin(el) * v * tau - 4.9 * tau * tau;
        const live = pourT >= ST.head && t0 >= ST.head - 1e-9 && t0 <= ST.stop && y > surfY(x, z) && Math.hypot(x, z) < rIn(y) - 0.002;
        const rr = live ? lerp(0.0009, 0.0019, rand(SPLASH.seed, 4000 + j)) : 1e-6;
        M.compose(P.set(x, y, z), Q.identity(), S3.set(rr, rr * 1.15, rr)); splash.setMatrixAt(j, M);
      }
      splash.instanceMatrix.needsUpdate = true;
      // 冰块：落下（阻尼的弹簧沉浮），第二块在 0.75 秒撞上第一块；iceT < 0 不显示
      ice.visible = iceT >= 0;
      ice.children.forEach((c, j) => {
        const [x, z, rot] = c.userData.rest, t = iceT - 0.12 * j, drop = Math.max(t, 0), y0 = top + 0.05;
        const sink = top - 0.0015 - 0.001 * j, y = t <= 0 ? y0 : t < 0.18 ? lerp(y0, sink, (t / 0.18) ** 2) : sink + 0.006 * Math.exp(-3.5 * (t - 0.18)) * Math.cos(9 * (t - 0.18));
        c.position.set(x, y, z); c.rotation.set(0.3 * j + 0.4 * ss(0, 0.6, drop), rot, 0.2 * j);
      });
      // 冷凝：半球按杯壁的法线贴上去。看不见时也照样写（dewT 当 0：全是没长出来的零大小），否则会留着上一帧的矩阵
      dew.visible = dewT >= 0;
      for (let i = 0; i < DEW.n; i++) {
        const dt = Math.max(dewT, 0), [a, y, rr] = dewAt(i, dt), R = rOut(y), stretch = i === DEW.drip.i ? 1 + 0.8 * ss(DEW.drip.at, DEW.drip.at + 0.3, dt) : 1;
        N.set(Math.cos(a), -K, Math.sin(a)).normalize(); Q.setFromUnitVectors(UP, N);
        P.set(Math.cos(a) * R, y, Math.sin(a) * R);
        S.set(rr, rr * 0.35, rr * stretch);                                  // 扁：贴在壁上的水珠只鼓起来一点
        M.compose(P, Q, S); dew.setMatrixAt(i, M);
      }
      dew.instanceMatrix.needsUpdate = true;
      // 封膜：刺破前凹下去，刺破后中心换成几瓣往下翻
      lid.mesh.visible = showLid; lid.flaps.visible = showLid && punch >= 0;
      shapeLid(punch >= 0 ? 0 : clamp(press));
      const hole = punch >= 0;
      lid.mesh.material.alphaTest = 0;
      lid.flaps.children.forEach(h => { h.quaternion.setFromAxisAngle(h.userData.axis, hole ? (Math.PI / 2.4) * easeOut(clamp(punch / 0.25)) : 0); });
      if (hole) for (let v = 0; v < lp.count; v++) if (Math.hypot(lid.base[3 * v], lid.base[3 * v + 2]) < lid.hole) lp.setY(v, -0.02); // 洞口的膜收进瓣里
      if (hole) { lp.needsUpdate = true; shownDent = NaN; }
      // 吸管：sd 0..1 从封膜上方压到杯底；刺破前压着封膜的坑
      straw.visible = sd >= 0;
      const tipY = hole ? lerp(CUP.height - lidDent(0, 1), CUP.base + 0.003, easeOut(clamp(sd))) : CUP.height - lidDent(0, clamp(press)) + 0.0004;
      straw.position.set(sx, tipY + STRAW.len / 2, sz); straw.rotation.set(0, 0, 0.05);
      cup.posed = { pearlsT, fill, iceT, dewT, press, punch, straw: sd, lid: showLid, nudge, pourT, top };
      root.updateMatrixWorld(true);
    },
    /** 静止液面的世界 y */
    liquidTop: () => root.localToWorld(P.set(0, cup.posed?.top ?? CUP.fill, 0)).y,
  };
  cup.pose();
  return cup;
}

/** 接触阴影：杯底下一块柔和的暗斑（玻璃和茶汤不投影）；用数据纹理，Node 测试里也能建 */
function contactShadow() {
  const N = 64, px = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * 2 - 1, y = ((j + 0.5) / N) * 2 - 1;
    px[(j * N + i) * 4 + 3] = Math.round(255 * (1 - ss(0.3, 1, Math.hypot(x, y))) ** 1.6);
  }
  const tex = new THREE.DataTexture(px, N, N); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CUP.rBottom * 3.2, CUP.rBottom * 3.2), new THREE.MeshBasicMaterial({ color: '#000', map: tex, transparent: true, opacity: 0.45, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0004; m.renderOrder = -1;
  return m;
}
