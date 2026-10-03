// stories/beans/world.js — 瑰夏咖啡豆的六个布景（真实米制，彼此隔 20 米）：烘豆工坊 / 冷却盘 / 封袋台 / 夜景地图 / 老街门口 / 手冲台。
// 所有会动的东西都是故事时间的闭式函数（没有逐帧模拟）：豆子翻滚、倾泻、搅拌，粒子烟和蒸汽用引擎的 drift，跳着看和顺序播放同一帧。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clay } from '../../../04-year-review/js/models/clay.js';
import { buildProduct } from '../../../04-year-review/js/models/product.js';
import { clamp, lerp, ss } from '../../../factory/engine/ease.js';
import { drift } from '../../../factory/engine/particles.js';
import { mulberry32, seedOf } from '../../../factory/engine/rng.js';
import * as TX from '../../js/textures.js';
import { buildCourier, buildParcel, closeParcel } from '../../js/world.js';
import { SETS, STORY0, NATURAL, EV } from './meta.js';

const localT = (name, t) => clamp(t - STORY0[name], 0, NATURAL[name]);
const mat = (c, o = {}) => clay({ color: c, clearcoat: 0, roughness: 0.7, ...o });
const glow = (c, k = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.6 });
const withTex = (m, tex, rough = false) => { if (tex) { m.map = tex; m.color.set('#ffffff'); if (rough) m.roughnessMap = tex; m.needsUpdate = true; } return m; };
const shadowed = g => { g.castShadow = g.receiveShadow = true; return g; };
const box = (w, h, d, m, at = [0, 0, 0]) => { const g = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); g.position.set(...at); return g; };
const rbox = (w, h, d, m, at = [0, 0, 0], r = 0.01) => { const g = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), m)); g.position.set(...at); return g; };
const cyl = (r0, r1, h, m, at = [0, 0, 0], seg = 24) => { const g = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m)); g.position.set(...at); return g; };
const lathe = (pts, m, at = [0, 0, 0], seg = 40) => { const g = shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m)); g.position.set(...at); return g; };
const setGroup = name => { const g = new THREE.Group(); g.position.set(...SETS[name]); return g; };

/** 一颗咖啡豆：扁椭球，平的一面（+y）中间压一道中线沟 */
function beanGeometry() {
  const g = new THREE.SphereGeometry(1, 14, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 0) y *= 0.55 * (1 - 0.55 * Math.exp(-(z * z) / 0.02));                      // 平面一侧压扁，中线压出沟
    p.setXYZ(i, x * 0.0062, y * 0.0048, z * 0.0046);
  }
  g.computeVertexNormals(); return g;
}
const GREEN = new THREE.Color('#8e9a62'), YELLOW = new THREE.Color('#c9a25a'), BROWN = new THREE.Color('#4a2a17'), DARK = new THREE.Color('#2e190d');
/** 烘焙进度 k ∈ [0, 1] 的豆色：青绿 → 黄 → 棕 → 深棕 */
function roastColor(k, out) {
  if (k < 0.35) return out.copy(GREEN).lerp(YELLOW, k / 0.35);
  if (k < 0.8) return out.copy(YELLOW).lerp(BROWN, (k - 0.35) / 0.45);
  return out.copy(BROWN).lerp(DARK, (k - 0.8) / 0.2);
}

/** 一团粒子（烟 / 蒸汽 / 银皮碎屑）：N 个软圆片，位置由 drift 闭式给出；opacity 由调用方按 fade 控制 */
function puffs(N, tex, color, size, opacity) {
  const g = new THREE.Group(), items = [];
  const m0 = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity, fog: false });
  for (let i = 0; i < N; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m0.clone()); g.add(m); items.push(m); }
  g.userData.items = items; g.userData.op = opacity; return g;
}
function softDot() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** 让粒子团在时刻 t 摆好：box 与 vel 见 particles.drift；grow：粒子沿主轴越走越大；face：朝向相机的方向（只绕 y 转，够用） */
function placePuffs(p, seed, t, box, opts, { grow = 1.8, life = 1, k = 1 } = {}) {
  const span = box[4] - box[1];
  p.userData.items.forEach((m, i) => {
    const [x, y, z, ph, fade] = drift(seed, i, t, box, opts);
    const u = clamp((y - box[1]) / span);
    m.position.set(x, y, z); m.scale.setScalar(1 + grow * u); m.rotation.z = ph * Math.PI * 2;
    m.material.opacity = p.userData.op * fade * (1 - u) ** life * k; m.visible = k > 0.001;
  });
}

export function build(ctx, item) {
  const { scene } = ctx, R = mulberry32(seedOf('08-beans-world'));
  const DOT = softDot();
  const M = {
    copper: new THREE.MeshPhysicalMaterial({ color: '#b8703f', metalness: 0.9, roughness: 0.32, clearcoat: 0.3 }),
    brass: new THREE.MeshPhysicalMaterial({ color: '#b08a45', metalness: 0.9, roughness: 0.42 }),
    enamel: new THREE.MeshPhysicalMaterial({ color: '#1d1f22', metalness: 0.2, roughness: 0.35, clearcoat: 0.6 }),
    steel: new THREE.MeshPhysicalMaterial({ color: '#b6bbc1', metalness: 0.85, roughness: 0.3 }),
    perf: withTex(new THREE.MeshPhysicalMaterial({ color: '#a9adb2', metalness: 0.7, roughness: 0.4 }), TX.perforated()),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 0.92, thickness: 0.004, transparent: true, opacity: 0.35, ior: 1.45 }),
    cavity: mat('#120b07', { roughness: 0.9 }), flame: glow('#ff7a2a', 1.6),
    bean: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    wood: withTex(mat('#8a6040', { roughness: 0.6 }), TX.wood('#8a6040')), woodDark: withTex(mat('#4a3020', { roughness: 0.7 }), TX.wood('#4a3020')),
    floor: withTex(mat('#6b4c34', { roughness: 0.7 }), TX.wood('#6b4c34')), brick: withTex(mat('#9c5a46', { roughness: 0.9 }), TX.brick('#8f5440', '#c9bba8')),
    plaster: withTex(mat('#e9e2d4', { roughness: 0.95 }), TX.plaster()), stone: withTex(mat('#7d7a73', { roughness: 0.85 }), TX.stone(), true), tiles: withTex(mat('#4a4f55', { roughness: 0.8 }), TX.tiles()),
    lattice: withTex(mat('#5a3a22', { roughness: 0.7 }), TX.wood('#5a3a22')), redPaper: mat('#b3242a', { roughness: 0.8 }), paperGlow: glow('#ffb35a', 1.2), lanternRed: glow('#d8402a', 0.9),
    bamboo: withTex(mat('#c9a66b', { roughness: 0.8 }), TX.wood('#c9a66b')), ceramic: new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.25, clearcoat: 0.6 }),
    kettle: new THREE.MeshPhysicalMaterial({ color: '#1e1f21', metalness: 0.6, roughness: 0.35, clearcoat: 0.4 }),
    water: new THREE.MeshPhysicalMaterial({ color: '#d8ecff', roughness: 0.02, transmission: 0.9, transparent: true, opacity: 0.55, thickness: 0.002 }),
    coffee: new THREE.MeshPhysicalMaterial({ color: '#3a1d0c', roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.92 }), grounds: withTex(mat('#5a3a22', { roughness: 0.95 }), TX.concrete('#5a3a22')),
    kraft: withTex(mat('#b8946c', { roughness: 0.85 }), TX.cardboard('#b8946c')), label: withTex(mat('#f3ede2', { roughness: 0.7 }), TX.beanLabel()),
    hay: mat('#d9b56a', { roughness: 0.9 }), seal: mat('#3a3d42', { roughness: 0.5, metalness: 0.4 }), seat: mat('#2b3038', { roughness: 0.6 }),
    stampNew: new THREE.MeshBasicMaterial({ map: TX.stampMark('今日烘焙'), transparent: true, depthWrite: false, opacity: 0, color: TX.stampMark('今日烘焙') ? '#ffffff' : '#c0262d' }),
    stampOld: new THREE.MeshBasicMaterial({ map: TX.stampMark('昨日烘焙'), transparent: true, depthWrite: false, color: TX.stampMark('昨日烘焙') ? '#ffffff' : '#c0262d' }),
    window: glow('#fff2d6', 1.4), map: withTex(new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 2.6 }), TX.nightMap()), route: glow('#ffb347', 1.1), vanDot: glow('#fff1c8', 3.0),
    cityWin: (() => { const t = TX.cityWindows(), m = new THREE.MeshStandardMaterial({ color: t ? '#ffffff' : '#3a2a1a', map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: t ? 1.4 : 0.3, roughness: 0.8 }); return m; })(), cityBlock: mat('#1a120c', { roughness: 0.9 }),
    // 快递员 / 纸箱（共用部件要的材质名）
    courier: mat('#e9c46a', { roughness: 0.7 }), helmet: mat('#f0820f', { roughness: 0.3, clearcoat: 0.5 }), skin: mat('#e6b98f', { roughness: 0.6 }), glove: mat('#2b3038', { roughness: 0.8 }), dark: mat('#2b3038', { roughness: 0.6 }), labelOrange: mat('#f0820f'),
    box: withTex(mat('#c79a5e', { roughness: 0.9 }), TX.cardboard('#b8946c')), tape: mat('#d9b98a', { roughness: 0.4, clearcoat: 0.3 }), label2: withTex(mat('#f5f0e8', { roughness: 0.6 }), TX.waybill()),
  };
  if (M.map.map) M.map.emissiveMap = M.map.map;
  const root = new THREE.Group(); scene.add(root);
  const parts = {}, BEAN = beanGeometry(), col = new THREE.Color();

  // ═════ 1 烘豆工坊：铜色滚筒烘豆机正面 + 观察窗里翻滚的豆子 + 排烟管冒烟；身后砖墙和一扇透晨光的窗 ═════
  {
    const g = setGroup('roast');
    g.add(box(4, 0.02, 3, M.floor, [0, -0.01, 0])); g.add(box(4, 2.4, 0.06, M.brick, [0, 1.2, -0.7]));
    g.add(box(0.7, 0.9, 0.02, M.window, [-0.9, 1.25, -0.66])); for (const x of [-1.25, -0.9, -0.55]) g.add(box(0.03, 0.94, 0.04, M.woodDark, [x, 1.25, -0.64])); g.add(box(0.74, 0.03, 0.04, M.woodDark, [-0.9, 1.25, -0.64]));
    g.add(rbox(0.62, 0.44, 0.5, M.enamel, [0, 0.22, -0.05], 0.03));                       // 机身
    g.add(box(0.3, 0.03, 0.01, M.flame, [0, 0.12, 0.205]));                               // 炉口火光
    const drum = cyl(0.22, 0.22, 0.46, M.copper, [0, 0.56, -0.02], 48); drum.rotation.x = Math.PI / 2; g.add(drum);   // 滚筒外壳（轴朝相机）
    const face = cyl(0.245, 0.245, 0.03, M.brass, [0, 0.56, 0.22], 64); face.rotation.x = Math.PI / 2; g.add(face);   // 黄铜前面板
    const cavity = cyl(0.085, 0.085, 0.02, M.cavity, [0, 0.56, 0.226], 40); cavity.rotation.x = Math.PI / 2; g.add(cavity);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 12, 48), M.brass); ring.position.set(0, 0.56, 0.246); g.add(shadowed(ring));
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.086, 48), M.glass); win.position.set(0, 0.56, 0.252); g.add(win);
    for (const [x, y] of [[-0.16, 0.66], [0.16, 0.66]]) {                                 // 两只温度表
      const d = cyl(0.03, 0.03, 0.012, M.brass, [x, y, 0.24], 24); d.rotation.x = Math.PI / 2; g.add(d);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), mat('#f4efe4', { roughness: 0.4 })); dial.position.set(x, y, 0.247); g.add(dial);
      const nd = box(0.002, 0.018, 0.001, M.dark, [x, y + 0.007, 0.249]); nd.rotation.z = x > 0 ? -0.6 : 0.4; g.add(nd);
    }
    const spout = cyl(0.05, 0.065, 0.12, M.brass, [0, 0.33, 0.24], 24); spout.rotation.x = Math.PI / 2.4; g.add(spout);   // 出豆口
    g.add(lathe([[0.04, 0], [0.04, 0.06], [0.16, 0.22], [0.165, 0.23]], M.steel, [0, 0.78, -0.08]));   // 进料斗
    g.add(cyl(0.05, 0.05, 1.5, M.steel, [0.22, 1.5, -0.3], 24));                          // 排烟管
    g.add(box(0.05, 0.02, 0.4, M.steel, [-0.3, 0.88, -0.05])); g.add(cyl(0.01, 0.01, 0.12, M.dark, [-0.3, 0.88, 0.17], 8).rotateX(Math.PI / 2));   // 采样勺把
    // 豆子：在观察窗后面的竖截面里，被滚筒带上去再落下（闭式）
    const N = 140, beans = new THREE.InstancedMesh(BEAN, M.bean, N); beans.castShadow = true; g.add(beans);
    const seeds = Array.from({ length: N }, () => [R(), R(), R(), R()]);
    const smoke = puffs(18, DOT, '#d8d2c8', 0.18, 0.35); smoke.position.set(0.22, 2.2, -0.3); g.add(smoke);
    const chaff = puffs(16, DOT, '#e6c48a', 0.012, 0.9); chaff.position.set(0, 0.56, 0.244); g.add(chaff);
    const light = new THREE.PointLight('#ffb36b', 0.2, 2.5, 2); light.position.set(0.1, 0.62, 0.6); g.add(light);
    root.add(g); parts.roast = { g, beans, seeds, smoke, chaff };
  }

  // ═════ 2 冷却盘：圆形冲孔盘（腿 + 外圈）、两支慢转的搅拌臂、豆子从出豆口倾泻进盘；盘上热气 ═════
  {
    const g = setGroup('cool');
    g.add(box(4, 0.02, 3, M.floor, [0, -0.01, 0])); g.add(box(4, 2.4, 0.06, M.brick, [0, 1.2, -0.9]));
    g.add(cyl(0.34, 0.3, 0.56, M.enamel, [0, 0.28, 0], 48));                              // 底座
    const tray = cyl(0.34, 0.34, 0.012, M.perf, [0, 0.566, 0], 64); g.add(tray);
    g.add(lathe([[0.34, 0], [0.355, 0], [0.355, 0.07], [0.34, 0.07]], M.steel, [0, 0.56, 0], 64));   // 盘边
    const arms = new THREE.Group(); arms.position.set(0, 0.6, 0); g.add(arms);
    arms.add(cyl(0.02, 0.02, 0.06, M.steel, [0, 0.02, 0], 16));
    for (const a of [0, Math.PI]) { const arm = box(0.3, 0.012, 0.02, M.steel, [Math.cos(a) * 0.16, 0.0, Math.sin(a) * 0.16]); arm.rotation.y = -a; arms.add(arm); for (const r of [0.08, 0.16, 0.24]) arms.add(box(0.006, 0.03, 0.03, M.steel, [Math.cos(a) * r, -0.015, Math.sin(a) * r])); }
    const chute = cyl(0.06, 0.08, 0.26, M.brass, [-0.4, 0.82, -0.05], 24); chute.rotation.z = -1.0; g.add(chute);   // 烘豆机出豆口伸到盘边
    const roaster = cyl(0.24, 0.24, 0.5, M.copper, [-0.7, 0.95, -0.1], 48); roaster.rotation.z = Math.PI / 2; g.add(roaster);
    const N = 1100, beans = new THREE.InstancedMesh(BEAN, M.bean, N); beans.castShadow = true; g.add(beans);
    const seeds = Array.from({ length: N }, () => [Math.sqrt(R()) * 0.31, R() * Math.PI * 2, R(), R()]);
    const S = 46, stream = new THREE.InstancedMesh(BEAN, M.bean, S); g.add(stream);
    const sseeds = Array.from({ length: S }, () => [R(), R(), R()]);
    const steam = puffs(16, DOT, '#ffffff', 0.12, 0.16); steam.position.set(0, 0.62, 0); g.add(steam);
    root.add(g); parts.cool = { g, arms, beans, seeds, stream, sseeds, steam };
  }

  // ═════ 3 封袋台：工作台上一只牛皮纸立袋（单向排气阀 + 标签），豆子从铜勺落进袋口，热封条压下，盖「今日烘焙」章；旁边一只垫着干草纸的小纸箱 ═════
  {
    const g = setGroup('bag');
    g.add(box(1.6, 0.04, 0.9, M.wood, [0, -0.02, 0])); g.add(box(3, 2, 0.04, M.plaster, [0, 0.9, -0.5]));
    const bag = buildProduct({ kind: 'pouch', colors: ['#b8946c', '#1f3b35', '#e9c46a'] }); bag.scale.setScalar(0.3); g.add(bag);
    bag.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material?.color?.getHexString?.() === 'b8946c') o.material = M.kraft; } });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), M.label); label.position.set(0, 0.11, 0.054); g.add(label);   // 正面标签（贴在袋身最鼓的地方前一点）
    const valve = cyl(0.008, 0.008, 0.004, M.seal, [0.0, 0.19, 0.05], 20); valve.rotation.x = Math.PI / 2; g.add(valve);         // 单向排气阀
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), M.stampNew); stamp.position.set(0.024, 0.085, 0.0575); stamp.rotation.z = -0.15; g.add(stamp);
    const stamper = new THREE.Group(); g.add(stamper);                                  // 木柄印章：从相机这侧伸过来按一下
    stamper.add(cyl(0.022, 0.022, 0.012, M.redPaper, [0, 0, 0], 24).rotateX(Math.PI / 2)); stamper.add(cyl(0.012, 0.016, 0.07, M.woodDark, [0, 0, 0.04], 16).rotateX(Math.PI / 2));
    const sealer = new THREE.Group(); sealer.position.set(0, 0.3, 0); g.add(sealer);   // 热封条（两根钢条夹住袋口）
    sealer.add(rbox(0.2, 0.014, 0.02, M.seal, [0, 0, 0.025], 0.004), rbox(0.2, 0.014, 0.02, M.seal, [0, 0, -0.025], 0.004));
    const scoop = new THREE.Group(); scoop.position.set(-0.08, 0.36, 0.0); g.add(scoop);
    scoop.add(lathe([[0, 0], [0.03, 0.002], [0.04, 0.03], [0.041, 0.034]], M.brass, [0, 0, 0], 24)); scoop.add(cyl(0.006, 0.006, 0.1, M.woodDark, [-0.06, 0.02, 0], 8).rotateZ(1.2));
    const N = 40, fall = new THREE.InstancedMesh(BEAN, M.bean, N); g.add(fall);
    const fseeds = Array.from({ length: N }, () => [R(), R(), R()]);
    const crate = buildParcel([0.2, 0.12, 0.16], { ...M, label: M.label2 }); crate.position.set(0.26, 0, -0.04); closeParcel(crate, 0); crate.userData.tape.visible = false; g.add(crate);
    for (let k = 0; k < 90; k++) { const s = box(0.04 + R() * 0.03, 0.0015, 0.003, M.hay, [0.26 + (R() - 0.5) * 0.18, 0.1 + R() * 0.03, -0.04 + (R() - 0.5) * 0.14]); s.rotation.set(R() * 3, R() * 3, R() * 3); g.add(s); }   // 干草纸
    g.add(cyl(0.05, 0.045, 0.06, M.ceramic, [-0.3, 0.03, -0.12], 32));                   // 一只装着熟豆的碗
    const bowl = new THREE.InstancedMesh(BEAN, M.bean, 30); g.add(bowl); { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); for (let i = 0; i < 30; i++) { e.set(R() * 6, R() * 6, R() * 6); q.setFromEuler(e); m4.compose(new THREE.Vector3(-0.3 + (R() - 0.5) * 0.07, 0.062 + R() * 0.008, -0.12 + (R() - 0.5) * 0.07), q, new THREE.Vector3(1, 1, 1)); bowl.setMatrixAt(i, m4); bowl.setColorAt(i, roastColor(0.9 + R() * 0.1, col)); } }
    root.add(g); parts.bag = { g, stamp, stamper, sealer, scoop, fall, fseeds, bag };
  }

  // ═════ 4 夜里的干线：一块暖色夜景地图（路网 + 河 + 城区灯海）+ 城区几簇亮窗小楼 + 从烘焙坊到城里的路线一点点亮起，一颗光点沿线走 ═════
  {
    const g = setGroup('night');
    const map = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), M.map); const under = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat('#0b0806', { roughness: 1 })); under.rotation.x = -Math.PI / 2; under.position.y = -0.002; g.add(under); map.rotation.x = -Math.PI / 2; map.receiveShadow = true; g.add(map);
    const curve = new THREE.CatmullRomCurve3([[-1.5, 0.01, 0.9], [-0.9, 0.01, 0.55], [-0.4, 0.01, 0.6], [0.2, 0.01, 0.1], [0.7, 0.01, -0.05], [1.15, 0.01, -0.35]].map(p => new THREE.Vector3(...p)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.012, 8, false), M.route); g.add(tube);
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.035, 8, false), new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(halo);
    const van = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.vanDot); g.add(van);
    const vanLight = new THREE.PointLight('#ffcf8a', 0.8, 0.8, 2); g.add(vanLight);
    const home = cyl(0.05, 0.05, 0.01, M.route, [-1.5, 0.01, 0.9], 24); g.add(home);
    // 城区：一簇小楼（越往中心越高），窗户发光
    const city = new THREE.Group(); city.position.set(1.15, 0, -0.45); g.add(city);
    for (let i = 0; i < 60; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.55, h = 0.04 + (1 - r / 0.55) * 0.3 * R(); const b = box(0.04 + R() * 0.04, h, 0.04 + R() * 0.04, R() < 0.85 ? M.cityWin : M.cityBlock, [Math.cos(a) * r, h / 2, Math.sin(a) * r * 0.7]); city.add(b); }
    const cityLight = new THREE.PointLight('#ffb15a', 0.5, 2.5, 2); cityLight.position.set(1.15, 0.5, -0.45); g.add(cityLight);
    root.add(g); parts.night = { g, curve, tube, halo, van, vanLight };
  }

  // ═════ 5 老街清晨：青石板路、白墙小青瓦、木格门 + 红春联 + 红灯笼；快递员把小纸箱递到门口；前景早餐摊的蒸笼冒白汽 ═════
  {
    const g = setGroup('alley');
    g.add(box(8, 0.04, 6, M.stone, [0, -0.02, 0.8]));
    const house = (x, w, h, door) => {
      const hg = new THREE.Group(); hg.position.set(x, 0, -0.3); g.add(hg);
      hg.add(box(w, h, 0.5, M.plaster, [0, h / 2, -0.25]));
      hg.add(box(w + 0.02, 0.18, 0.52, M.woodDark, [0, 0.09, -0.25]));                   // 墙脚木裙
      for (const yy of [h * 0.55, h - 0.04]) hg.add(box(w + 0.02, 0.05, 0.03, M.woodDark, [0, yy, 0.005]));   // 木梁
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, 0.75), M.tiles); roof.position.set(0, h + 0.2, 0.05); roof.rotation.x = -0.95; roof.castShadow = roof.receiveShadow = true; hg.add(roof);
      hg.add(box(w + 0.3, 0.05, 0.06, M.tiles, [0, h + 0.47, -0.2]));                    // 屋脊
      if (door) {
        hg.add(box(0.86, 1.6, 0.06, M.woodDark, [0, 0.8, 0.01]));                         // 门框
        for (const sx of [-1, 1]) {                                                         // 两扇木格门
          const leaf = new THREE.Group(); leaf.position.set(sx * 0.19, 0, 0.045); hg.add(leaf);
          leaf.add(box(0.36, 1.5, 0.03, M.lattice, [0, 0.77, 0]));
          for (let yy = 0.9; yy < 1.45; yy += 0.07) leaf.add(box(0.3, 0.012, 0.012, M.woodDark, [0, yy, 0.02]));
          for (let xx = -0.12; xx <= 0.121; xx += 0.06) leaf.add(box(0.012, 0.56, 0.012, M.woodDark, [xx, 1.17, 0.02]));
          leaf.add(box(0.28, 0.54, 0.004, M.paperGlow, [0, 1.17, 0.01]));                 // 窗格后透出暖光
          hg.add(box(0.12, 0.8, 0.005, M.redPaper, [sx * 0.52, 1.05, 0.04]));            // 春联
        }
        hg.add(box(0.5, 0.14, 0.005, M.redPaper, [0, 1.68, 0.04]));                       // 横批
        hg.add(box(1.2, 0.08, 0.5, M.stone, [0, 0.04, 0.3]));                             // 门口石阶
        for (const sx of [-0.65, 0.65]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), M.lanternRed); l.scale.set(1, 1.2, 1); l.position.set(sx, 1.75, 0.15); hg.add(l); hg.add(cyl(0.004, 0.004, 0.2, M.dark, [sx, 1.95, 0.15], 6)); }
      } else for (const yy of [0.95]) for (const xx of [-w / 4, w / 4]) { hg.add(box(0.36, 0.42, 0.04, M.woodDark, [xx, yy, 0.01])); hg.add(box(0.3, 0.36, 0.004, R() < 0.5 ? M.paperGlow : M.lattice, [xx, yy, 0.035])); }
    };
    house(-2.15, 1.7, 1.95, false); house(0, 1.9, 2.1, true); house(2.2, 1.8, 1.9, false);
    const courier = buildCourier(M); courier.scale.setScalar(4.6); g.add(courier);          // 共用快递员（原件按 0.4 米高做的，放大到真人身高）
    const parcel = buildParcel([0.2, 0.22, 0.16], { ...M, label: M.label2 }); parcel.userData.label.visible = true; g.add(parcel);
    // 前景左下角的早餐摊：一摞竹蒸笼 + 小推车，蒸汽一直往上冒
    const stall = new THREE.Group(); stall.position.set(-1.0, 0, 1.55); g.add(stall);
    stall.add(rbox(0.9, 0.7, 0.5, M.woodDark, [0, 0.35, 0], 0.02));
    for (let k = 0; k < 4; k++) stall.add(cyl(0.2, 0.2, 0.09, M.bamboo, [0.12, 0.75 + k * 0.095, 0], 32));
    stall.add(cyl(0.21, 0.2, 0.03, M.bamboo, [0.12, 1.14, 0], 32));
    const steam = puffs(24, DOT, '#ffffff', 0.35, 0.28); steam.position.set(1.12 - 1.0, 1.2, 1.55); g.add(steam);
    const sun = new THREE.PointLight('#ffd2a0', 0.6, 4, 2); sun.position.set(0, 1.5, 0.6); g.add(sun);
    root.add(g); parts.alley = { g, courier, parcel, steam };
  }

  // ═════ 6 手冲台：木桌、白瓷 V60 滤杯架在玻璃分享壶上、黑色细嘴壶从右上注水（水柱 + 粉层闷蒸鼓起）、蒸汽、旁边立着盖「昨日烘焙」章的豆袋 ═════
  {
    const g = setGroup('pour');
    g.add(box(1.6, 0.04, 1.0, M.wood, [0, -0.02, 0])); g.add(box(3, 2, 0.04, M.plaster, [0, 0.9, -0.55]));
    g.add(box(0.7, 0.8, 0.02, M.window, [-0.45, 0.75, -0.52]));                            // 背后一扇窗（晨光）
    const server = lathe([[0.0, 0], [0.05, 0.0], [0.058, 0.02], [0.06, 0.07], [0.05, 0.1], [0.045, 0.11], [0.044, 0.112]], M.glass, [0, 0, 0], 48); g.add(server);   // 玻璃分享壶
    const liquid = lathe([[0.0, 0.002], [0.048, 0.002], [0.055, 0.02], [0.056, 0.05], [0.0, 0.05]], M.coffee, [0, 0, 0], 48); g.add(liquid);
    const dripper = lathe([[0.03, 0.115], [0.036, 0.115], [0.064, 0.19], [0.066, 0.192], [0.061, 0.192], [0.032, 0.122], [0.03, 0.122]], M.ceramic, [0, 0, 0], 48); g.add(dripper);
    g.add(lathe([[0.034, 0.112], [0.075, 0.112], [0.075, 0.118], [0.034, 0.118]], M.ceramic, [0, 0, 0], 48));   // 滤杯底座
    const bed = lathe([[0, 0], [0.05, 0], [0.04, 0.012], [0, 0.016]], M.grounds, [0, 0.162, 0], 40); g.add(bed);   // 粉层（闷蒸时鼓起）
    const kettle = new THREE.Group(); kettle.position.set(0.18, 0.2, 0.02); g.add(kettle);
    kettle.add(lathe([[0, 0], [0.06, 0], [0.065, 0.02], [0.062, 0.1], [0.04, 0.13], [0.02, 0.135]], M.kettle, [0, 0, 0], 40));
    const spoutCurve = new THREE.CatmullRomCurve3([[-0.055, 0.02, 0], [-0.1, 0.07, 0], [-0.13, 0.13, 0], [-0.16, 0.15, 0]].map(p => new THREE.Vector3(...p)));
    kettle.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 40, 0.005, 10), M.kettle)));
    kettle.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 10, 30, Math.PI), M.kettle)).rotateZ(-Math.PI / 2).translateX(-0.07));   // 把手
    const streamGeo = new THREE.CylinderGeometry(0.0022, 0.0028, 1, 12, 1, true); streamGeo.translate(0, -0.5, 0);
    const stream = new THREE.Mesh(streamGeo, M.water); g.add(stream);
    const steam = puffs(14, DOT, '#ffffff', 0.08, 0.2); steam.position.set(0, 0.2, 0); g.add(steam);
    const cup = lathe([[0, 0], [0.035, 0], [0.04, 0.06], [0.042, 0.065], [0.038, 0.065], [0.032, 0.005], [0, 0.005]], M.ceramic, [-0.2, 0, 0.1], 40); g.add(cup);
    const bag = buildProduct({ kind: 'pouch', colors: ['#b8946c', '#1f3b35', '#e9c46a'] }); bag.scale.setScalar(0.3); bag.position.set(-0.24, 0, -0.14); bag.rotation.y = 0.35; g.add(bag);
    bag.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material?.color?.getHexString?.() === 'b8946c') o.material = M.kraft; } });
    const bl = new THREE.Group(); bl.position.set(-0.24, 0, -0.14); bl.rotation.y = 0.35; g.add(bl);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), M.label); lab.position.set(0, 0.11, 0.0555); bl.add(lab);
    const old = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), M.stampOld); old.position.set(0.024, 0.085, 0.0575); old.rotation.z = -0.15; bl.add(old);
    const grinder = new THREE.Group(); grinder.position.set(0.3, 0, -0.18); g.add(grinder);   // 手摇磨豆机
    grinder.add(cyl(0.045, 0.045, 0.16, M.steel, [0, 0.08, 0], 32)); grinder.add(cyl(0.004, 0.004, 0.1, M.steel, [0.04, 0.2, 0], 8).rotateZ(1.3)); grinder.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), M.woodDark).translateX(0.09).translateY(0.21));
    root.add(g); parts.pour = { g, stream, bed, liquid, steam, kettle };
  }

  // ═════ 灯光：主平行光跟着取景点（布景各自的晨光方向），半球光给暖色环境 ═════
  const key = new THREE.DirectionalLight('#ffe2bd', 2.6); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.2, far: 12 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.006;
  const amb = new THREE.HemisphereLight('#ffe6cc', '#3a2618', 0.5);
  scene.add(key, key.target, amb); scene.background = new THREE.Color('#1a120c');
  let env = null, pmrem = null;
  try { if (ctx.renderer && typeof ctx.renderer.compile === 'function') { pmrem = new THREE.PMREMGenerator(ctx.renderer); env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env; if (scene.environmentIntensity != null) scene.environmentIntensity = 0.45; } } catch { env = null; }

  // 每个布景的主光方向（本地，从哪边打过来）、颜色、强度和环境光；夜景几乎只靠自发光
  const LIGHT = {
    roast: { dir: [-2.2, 2.4, 1.2], color: '#ffd7a8', k: 2.6, amb: 0.45, bg: '#1a120c' },
    cool: { dir: [-1.6, 3.0, -1.2], color: '#ffe0b8', k: 2.8, amb: 0.5, bg: '#1a120c' },
    bag: { dir: [-1.8, 2.2, 0.8], color: '#ffe6c4', k: 2.4, amb: 0.55, bg: '#2a2018' },
    night: { dir: [1, 3, 1], color: '#6f7fb0', k: 0.15, amb: 0.06, bg: '#120c08' },
    alley: { dir: [2.6, 1.6, 1.8], color: '#ffc78f', k: 2.6, amb: 0.5, bg: '#9fb3c9' },
    pour: { dir: [-1.4, 1.6, -1.6], color: '#ffe2b8', k: 3.0, amb: 0.45, bg: '#2a2018' },
  };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  root.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; });   // 实例会挪到很远（藏起来 / 倾泻），缓存的包围球不准，别让它被裁掉
  const setBean = (im, i, x, y, z, rx, ry, rz, s = 1) => { tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, y, z), tmpQ, s === 1 ? one : new THREE.Vector3(s, s, s)); im.setMatrixAt(i, tmpM); };

  const handle = {
    root, parts, M, item, scene, key, amb, env, pmrem,
    post: { exposure: 1.0, vignette: 0.32, grain: 0.025, bloom: { strength: 0.32, threshold: 0.8 }, saturation: 1.04 },
    update(s) {
      const t = s.t;
      // ── 烘豆：滚筒转，豆子在窗后的下半圈被带起、到高处落下；颜色按故事时间从青绿烘到深棕（2.0 一爆时已是浅棕） ──
      { const P = parts.roast, lt = localT('roast', t), k = clamp(0.25 + 0.55 * (t / 2.5)), w = 2.4;
        P.seeds.forEach((sd, i) => {
          const r = 0.022 + 0.058 * sd[0], th = sd[1] * 6.283 + w * t, lift = Math.sin(th);
          const a = -Math.PI / 2 + (lift > 0 ? 1.25 * lift : 0.6 * lift) * (0.6 + 0.4 * sd[2]);       // 往上带得高，落回去快
          setBean(P.beans, i, Math.cos(a) * r, 0.56 + Math.sin(a) * r * 0.95, 0.239 + sd[3] * 0.005, th * 1.3 + sd[2] * 9, sd[3] * 7, th);
          P.beans.setColorAt(i, roastColor(clamp(k + (sd[2] - 0.5) * 0.08), col));
        });
        P.beans.instanceMatrix.needsUpdate = true; if (P.beans.instanceColor) P.beans.instanceColor.needsUpdate = true;
        placePuffs(P.smoke, 11, t, [-0.08, 0, -0.08, 0.08, 1.2, 0.08], { vel: [0.02, 0.35, 0], sway: 0.06, swayHz: 0.25 }, { grow: 3 });
        const pop = ss(EV.crack - 0.05, EV.crack + 0.05, lt) * (1 - ss(EV.crack + 0.2, EV.crack + 0.7, lt));   // 一爆：银皮碎屑在窗里一闪
        placePuffs(P.chaff, 12, t, [-0.07, -0.07, 0, 0.07, 0.07, 0.004], { vel: [0, 0.1, 0], sway: 0.01, swayHz: 1.5 }, { grow: 0.2, life: 0.3, k: pop }); }
      // ── 冷却盘：tip 时出豆口开闸，豆子倾泻（一条抛物线的豆流），盘里的豆越积越多；搅拌臂一直慢转，豆子跟着转 ──
      { const P = parts.cool, lt = localT('cool', t), fill = ss(EV.tip, EV.tip + 1.6, lt), flow = ss(EV.tip - 0.1, EV.tip + 0.1, lt) * (1 - ss(EV.tip + 1.6, EV.tip + 2.0, lt)), spin = 0.5 * t;
        P.arms.rotation.y = -spin;
        P.seeds.forEach((sd, i) => {
          const show = sd[2] < fill, a = sd[1] - spin * (0.35 + 0.3 * sd[0] / 0.31), r = sd[0];
          setBean(P.beans, i, Math.cos(a) * r, show ? 0.576 + sd[3] * 0.014 * (1 - (r / 0.31) ** 2 * 0.5) : -5, Math.sin(a) * r, sd[3] * 6, a * 2, sd[2] * 6);
          P.beans.setColorAt(i, roastColor(0.86 + sd[3] * 0.12, col));
        });
        P.sseeds.forEach((sd, i) => {
          const u = ((lt * 1.6 + i / P.sseeds.length + sd[0] * 0.05) % 1 + 1) % 1, x0 = -0.3, y0 = 0.74;
          const x = x0 + 0.28 * u + (sd[1] - 0.5) * 0.02, y = y0 + 0.05 * u - 0.3 * u * u * 2.2, z = -0.04 + (sd[2] - 0.5) * 0.03 + 0.04 * u;
          setBean(P.stream, i, x, flow > 0.05 ? Math.max(y, 0.58) : -5, z, u * 9 + sd[0] * 5, sd[1] * 6, u * 7);
          P.stream.setColorAt(i, roastColor(0.9, col));
        });
        for (const im of [P.beans, P.stream]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
        placePuffs(P.steam, 21, t, [-0.25, 0, -0.25, 0.25, 0.5, 0.25], { vel: [0, 0.18, 0], sway: 0.04, swayHz: 0.3 }, { grow: 2.5, k: 0.4 + 0.6 * fill }); }
      // ── 封袋：0–1.0 铜勺倾斜、豆子落进袋口；1.0–1.3 热封条夹下；stamp（1.5）印章按上去，章印出现 ──
      { const P = parts.bag, lt = localT('bag', t), tilt = ss(0.0, 0.3, lt) * (1 - ss(0.9, 1.2, lt));
        P.scoop.rotation.z = -0.9 * tilt; P.scoop.position.y = 0.36 + 0.03 * (1 - tilt);
        P.fseeds.forEach((sd, i) => { const u = ((lt * 2.2 + i / P.fseeds.length) % 1 + 1) % 1, on = tilt > 0.5; setBean(P.fall, i, -0.05 + 0.04 * u + (sd[0] - 0.5) * 0.015, on ? 0.34 - 0.12 * u : -5, (sd[1] - 0.5) * 0.015, u * 8, sd[2] * 6, u * 5); P.fall.setColorAt(i, roastColor(0.92, col)); });
        P.fall.instanceMatrix.needsUpdate = true; if (P.fall.instanceColor) P.fall.instanceColor.needsUpdate = true;
        const clamp1 = ss(1.0, 1.15, lt) * (1 - ss(1.3, 1.45, lt)); P.sealer.position.y = 0.3 - 0.035 * clamp1; P.sealer.children[0].position.z = 0.025 - 0.012 * clamp1; P.sealer.children[1].position.z = -0.025 + 0.012 * clamp1;
        const press = ss(EV.stamp - 0.3, EV.stamp, lt) * (1 - ss(EV.stamp + 0.1, EV.stamp + 0.5, lt));
        P.stamper.position.set(0.024, 0.085, 0.07 + 0.12 * (1 - press)); P.stamper.visible = false;   // 印章本体从相机这侧伸进来，柄正对镜头读不出是什么；只留章印「咚」地一下按上去
        { const on = ss(EV.stamp - 0.06, EV.stamp, lt); parts.bag.stamp.material.opacity = 0.92 * on; parts.bag.stamp.scale.setScalar(1 + 0.35 * (1 - ss(EV.stamp, EV.stamp + 0.15, lt)) * on); } }
      // ── 夜：depart（0.5）起路线从烘焙坊一点点亮到城里，光点沿线走 ──
      { const P = parts.night, lt = localT('night', t), u = ss(EV.depart - 0.2, NATURAL.night + 0.2, lt) * 0.98 + 0.02;
        const n = Math.floor(P.tube.geometry.index.count * u / 6) * 6; P.tube.geometry.setDrawRange(0, n); P.halo.geometry.setDrawRange(0, n);
        const p = P.curve.getPointAt(Math.min(0.999, u)); P.van.position.set(p.x, 0.03, p.z); P.vanLight.position.set(p.x, 0.15, p.z); }
      // ── 老街：快递员从左边走到门口，handoff（1.0）把箱子放到门口石阶上，然后后退半步 ──
      { const P = parts.alley, lt = localT('alley', t), walk = ss(0, EV.handoff - 0.1, lt), give = ss(EV.handoff - 0.25, EV.handoff + 0.1, lt), back = ss(EV.handoff + 0.3, 2.4, lt);
        const x = lerp(-0.95, 0.38, walk) + 0.12 * back, z = 0.55 - 0.08 * back;
        P.courier.position.set(x, 0, z); P.courier.rotation.y = lerp(Math.PI / 2 - 0.2, -0.5, ss(EV.handoff - 0.5, EV.handoff, lt));
        const sw = Math.sin(lt * 9) * 0.5 * (1 - ss(EV.handoff - 0.4, EV.handoff - 0.1, lt)) * (walk < 1 ? 1 : 0), L = P.courier.userData.limbs;
        L.legL.rotation.x = sw; L.legR.rotation.x = -sw; L.armL.rotation.x = -0.9 + 0.3 * give; L.armR.rotation.x = -0.9 + 0.3 * give;
        P.courier.userData.carry.visible = give < 0.5;
        const held = new THREE.Vector3(0, 0.235 * 4.6, 0.07 * 4.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.courier.rotation.y).add(P.courier.position);
        if (give < 0.5) P.parcel.position.set(-9, 0, 0); else P.parcel.position.copy(new THREE.Vector3(0.1, 0.08, 0.05).lerp(held, 0));
        P.parcel.rotation.y = 0.15;
        placePuffs(P.steam, 31, t, [-0.12, 0, -0.12, 0.12, 1.6, 0.12], { vel: [0.04, 0.32, 0], sway: 0.1, swayHz: 0.2 }, { grow: 3.5 }); }
      // ── 手冲：pour（0.5）起水柱从壶嘴落到粉层中心，粉层闷蒸鼓起；分享壶里的咖啡慢慢变多；蒸汽一直冒 ──
      { const P = parts.pour, lt = localT('pour', t), on = ss(EV.pour - 0.15, EV.pour, lt), tilt = ss(EV.pour - 0.6, EV.pour - 0.05, lt);
        P.kettle.rotation.z = 0.35 * tilt; P.kettle.position.set(0.18, 0.2 + 0.03 * tilt, 0.02);
        const tip = new THREE.Vector3(-0.16, 0.15, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), P.kettle.rotation.z).add(P.kettle.position);
        const top = Math.min(tip.y, 0.33), len = Math.max(0.001, top - 0.18);
        P.stream.visible = on > 0.02; P.stream.position.set(lerp(tip.x, 0, 0.6), top, 0); P.stream.scale.set(1, len * on, 1);
        const bloom = ss(EV.pour, EV.pour + 1.2, lt); P.bed.scale.set(1, 1 + 1.8 * bloom, 1); P.bed.position.y = 0.162 + 0.004 * bloom;
        P.liquid.scale.set(1, 0.3 + 0.7 * ss(EV.pour + 0.4, 2.5, lt), 1);
        placePuffs(P.steam, 41, t, [-0.03, 0, -0.03, 0.03, 0.3, 0.03], { vel: [0.01, 0.12, 0], sway: 0.02, swayHz: 0.4 }, { grow: 2.2, k: 0.5 + 0.5 * bloom }); }
      // ── 灯光：主光对准当前取景点所在的布景 ──
      const f = s.focus ?? SETS.roast, name = Object.keys(SETS).reduce((a, k) => (Math.abs(SETS[k][0] - f[0]) < Math.abs(SETS[a][0] - f[0]) ? k : a), 'roast'), Lt = LIGHT[name];
      key.color.set(Lt.color); key.intensity = Lt.k; amb.intensity = Lt.amb;
      key.position.set(SETS[name][0] + Lt.dir[0], Lt.dir[1], Lt.dir[2]); key.target.position.set(SETS[name][0], 0.3, 0); key.target.updateMatrixWorld();
      scene.background.set(Lt.bg);
    },
    reset() { this.update({ t: 0 }); },
    dispose() {
      root.traverse(o => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.()); else o.material?.dispose?.(); });
      scene.remove(key, key.target, amb, root); scene.environment = null; env?.dispose?.(); pmrem?.dispose?.(); TX.disposeTextures();
    },
  };
  handle.reset();
  return handle;
}
