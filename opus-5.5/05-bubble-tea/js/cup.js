// cup.js — 奶茶杯：透明 PP 杯（薄壁截锥）、茶汤（顶上一层清茶 + 奶纹 + 黑糖虎纹）、封膜（被吸管压凹、刺破成几瓣）、吸管、
// 杯壁冷凝水珠（闭式：位置和半径由 rand(seed, i) 定，随 t 长大；一颗在 hero 里滑下来）、杯底的珍珠（烘好的表按 t 取样）、冰块
// 原点在杯底中心，y 向上，米；尺寸取 meta.js 的 CUP / STRAW / PEARL。玻璃和茶汤的折射由 js/tea.js 接到共享的 refract.js
import * as THREE from 'three';
import { CUP, STRAW, PEARL } from '../meta.js';
import { rand } from '../../factory/engine/rng.js';
import { clamp, ss, easeOut, lerp } from '../../factory/engine/ease.js';
import { pearlAt } from './pearls.js';

const K = (CUP.rTop - CUP.rBottom) / CUP.height, SLANT = Math.sqrt(1 + K * K);
/** 外壁 y 处的半径 */
export const rOut = y => CUP.rBottom + K * y;
/** 内壁 y 处的半径 */
export const rIn = y => rOut(y) - CUP.wall * SLANT;

// ── 冷凝水珠（闭式）──
// 杯壁上 N 颗水珠：高度在液面以下（冰茶把杯壁冷下来的那一段），方位角、半径都由 rand 定；半径随 t 从 0 长到 r（凝出来）
export const DEW = { seed: 23, n: 200, r: [0.0005, 0.0024], grow: [0.2, 2.2], drip: { i: 0, at: 1.5, dur: 1.3, fall: 0.055 } };
/** 第 i 颗水珠在 hero 本地 t 秒的 [方位角, 高度, 半径]；drip 那颗在 drip.at 秒开始往下滑，边滑边拉长（半径不变） */
export function dewAt(i, t, D = DEW) {
  const a = rand(D.seed, 3 * i) * Math.PI * 2, y0 = CUP.base + 0.006 + rand(D.seed, 3 * i + 1) * (CUP.fill - CUP.base - 0.012);
  const r1 = lerp(D.r[0], D.r[1], rand(D.seed, 3 * i + 2) ** 2), g = ss(D.grow[0] * (0.6 + rand(D.seed, 7000 + i) * 0.8), D.grow[1], t);
  if (i !== D.drip.i) return [a, y0, r1 * g];
  const top = CUP.fill - 0.004, k = easeOut(clamp((t - D.drip.at) / D.drip.dur)) ** 1.4;   // 滑落那颗放在正面偏上，个头最大
  return [-0.35, top - D.drip.fall * k, D.r[1] * 1.25 * g];
}

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
  const body = new THREE.Mesh(frustumGeo(r(CUP.pile), r(CUP.fill), CUP.pile, CUP.fill, 96, false), liqMat);   // 茶汤从珍珠层上面开始
  liquid.add(body);
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
  // 水珠：几乎全透明，只剩高光和一点折射的暗边（白色半透明的点看起来像涂上去的斑）
  const dewMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.0, metalness: 0, transmission: 1, thickness: 0.0015, ior: 1.33, specularIntensity: 1, envMapIntensity: 2.2, transparent: true, opacity: 0.8, depthWrite: false });
  const dew = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), dewMat, DEW.n);
  dew.frustumCulled = false;

  // 封膜 + 吸管
  const lidMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: art, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
  const lid = buildLid(lidMat); lid.mesh.position.y = CUP.height + 0.0006; lid.flaps.position.y = CUP.height + 0.0006;
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(STRAW.r, STRAW.r, STRAW.len, 40, 1, true),
    new THREE.MeshPhysicalMaterial({ color: flavor.palette.accent, roughness: 0.25, clearcoat: 0.7, side: THREE.DoubleSide }));
  straw.castShadow = true;
  const tip = new THREE.Mesh(new THREE.RingGeometry(STRAW.r * 0.85, STRAW.r, 40), straw.material); tip.rotation.x = Math.PI / 2; tip.position.y = STRAW.len / 2; straw.add(tip);

  root.add(glass, lip, liquid, syrup, pearlMesh, ice, dew, lid.mesh, lid.flaps, straw, contactShadow());

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), q3 = [0, 0, 0], UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3();
  const lp = lid.mesh.geometry.attributes.position;
  let shownDent = NaN;
  function shapeLid(press) {
    if (press === shownDent) return;
    for (let v = 0; v < lp.count; v++) lp.setY(v, -lidDent(Math.hypot(lid.base[3 * v], lid.base[3 * v + 2]), press));
    lp.needsUpdate = true; lid.mesh.geometry.computeVertexNormals(); shownDent = press;
  }

  const cup = {
    root, parts: { glass, liquid, body, syrup, ice, pearls: pearlMesh, dew, lid: lid.mesh, straw }, posed: null,
    /**
     * 完整姿态，没写的量回到默认：
     *   pearlsT 珍珠表的取样时刻（秒，默认烘焙末尾：已堆好）；fill 茶汤高度 0..1（0 = 空杯）；iceT 冰块落下后的秒数（< 0 = 没有冰）；
     *   dewT 冷凝长出来的秒数（< 0 = 没有）；press 吸管压封膜 0..1，punch 刺破后的秒数（< 0 = 没刺破）；straw 吸管插进去的深度 0..1（< 0 = 不显示）；
     *   lid 显示封膜；nudge 吸管搅动珍珠的秒数
     */
    pose({ pearlsT = pearls.t1, fill = 1, iceT = -1, dewT = -1, press = 0, punch = -1, straw: sd = -1, lid: showLid = true, nudge = -1 } = {}) {
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
      // 冰块：落下（阻尼的弹簧沉浮），第二块在 0.75 秒撞上第一块；iceT < 0 不显示
      ice.visible = iceT >= 0;
      ice.children.forEach((c, j) => {
        const [x, z, rot] = c.userData.rest, t = iceT - 0.12 * j, drop = Math.max(t, 0), y0 = top + 0.05;
        const sink = top - 0.006 - 0.004 * j, y = t <= 0 ? y0 : t < 0.18 ? lerp(y0, sink, (t / 0.18) ** 2) : sink + 0.006 * Math.exp(-3.5 * (t - 0.18)) * Math.cos(9 * (t - 0.18));
        c.position.set(x, y, z); c.rotation.set(0.3 * j + 0.4 * ss(0, 0.6, drop), rot, 0.2 * j);
      });
      // 冷凝：半球按杯壁的法线贴上去。看不见时也照样写（dewT 当 0：全是没长出来的零大小），否则会留着上一帧的矩阵
      dew.visible = dewT >= 0;
      for (let i = 0; i < DEW.n; i++) {
        const dt = Math.max(dewT, 0), [a, y, rr] = dewAt(i, dt), R = rOut(y), stretch = i === DEW.drip.i ? 1 + 0.8 * ss(DEW.drip.at, DEW.drip.at + 0.3, dt) : 1;
        N.set(Math.cos(a), -K, Math.sin(a)).normalize(); Q.setFromUnitVectors(UP, N);
        P.set(Math.cos(a) * R, y, Math.sin(a) * R);
        S.set(rr, rr * 0.55, rr * stretch);                                  // 扁：贴在壁上的水珠只鼓起来一点
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
      cup.posed = { pearlsT, fill, iceT, dewT, press, punch, straw: sd, lid: showLid, nudge, top };
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
