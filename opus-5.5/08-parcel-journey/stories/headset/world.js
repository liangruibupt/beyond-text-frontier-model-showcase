// stories/headset/world.js — 电竞耳机「赛前送达」的七个布景（真实米制，彼此隔 24 米，互不入画）：
//   defeat 暗房电竞桌 / order 手机下单 / cube 立体密集仓储塔 / route 夜城路线地图 / ride 雨后街道 / lift 公寓电梯 / victory 戴上耳机。
// 所有会动的东西都是故事时间的闭式函数（没有逐帧模拟）：机器人沿闭式轨道滑行、料箱提升、路线连通、车灯流动、楼层跳动、积水溅起、
// LED 熄灭 / 点亮——跳着看和顺序播放同一帧。夜蓝 + 霓虹品红 + 游戏 HUD（2D 文字层见 captions.js）。
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
const unlit = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, fog: false });
const withTex = (m, tex, rough = false) => { if (tex) { m.map = tex; m.color.set('#ffffff'); if (rough) m.roughnessMap = tex; m.needsUpdate = true; } return m; };
const shadowed = g => { g.castShadow = g.receiveShadow = true; return g; };
const box = (w, h, d, m, at = [0, 0, 0]) => { const g = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); g.position.set(...at); return g; };
const rbox = (w, h, d, m, at = [0, 0, 0], r = 0.01) => { const g = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), m)); g.position.set(...at); return g; };
const cyl = (r0, r1, h, m, at = [0, 0, 0], seg = 24) => { const g = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m)); g.position.set(...at); return g; };
const plane = (w, h, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.position.set(...at); return g; };
const setGroup = name => { const g = new THREE.Group(); g.position.set(...SETS[name]); return g; };

/** 一团粒子（蒸汽 / 水花）：N 个软圆片，位置由 drift 闭式给出；opacity 由调用方按 fade 控制 */
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
function placePuffs(p, seed, t, box, opts, { grow = 1.8, life = 1, k = 1 } = {}) {
  const span = box[4] - box[1];
  p.userData.items.forEach((m, i) => {
    const [x, y, z, ph, fade] = drift(seed, i, t, box, opts);
    const u = clamp((y - box[1]) / span);
    m.position.set(x, y, z); m.scale.setScalar(1 + grow * u); m.rotation.z = ph * Math.PI * 2;
    m.material.opacity = p.userData.op * fade * (1 - u) ** life * k; m.visible = k > 0.001;
  });
}

const ORANGE = '#ff8a1e';            // 有集橙（耳机 LED 点亮的颜色）
const MAGENTA = '#ff2d7e';           // 霓虹品红

export function build(ctx, item) {
  const { scene } = ctx, R = mulberry32(seedOf('08-headset-world'));
  const DOT = softDot();
  const M = {
    desk: withTex(mat('#1b1d26', { roughness: 0.6 }), TX.wood('#1b1d26')), wall: mat('#14151c', { roughness: 0.95 }),
    plastic: mat('#2a2d38', { roughness: 0.5 }), rubber: mat('#15161b', { roughness: 0.85 }),
    steel: new THREE.MeshPhysicalMaterial({ color: '#aeb4bd', metalness: 0.85, roughness: 0.3 }),
    mesh: withTex(new THREE.MeshPhysicalMaterial({ color: '#3a3f4a', metalness: 0.7, roughness: 0.5 }), TX.perforated()),
    glassDark: new THREE.MeshPhysicalMaterial({ color: '#0b0d14', metalness: 0.2, roughness: 0.2, clearcoat: 0.6 }),
    screenDefeat: (() => { const t = TX.gameScreen('DEFEAT', '#ff3b5b'); return new THREE.MeshBasicMaterial({ color: t ? '#ffffff' : '#3a0d14', map: t, fog: false }); })(),
    screenVictory: (() => { const t = TX.gameScreen('VICTORY', '#ffcf4a'); return new THREE.MeshBasicMaterial({ color: t ? '#ffffff' : '#2a2410', map: t, fog: false }); })(),
    phone: (() => { const t = TX.phoneOrder(); return new THREE.MeshBasicMaterial({ color: t ? '#ffffff' : '#101420', map: t, fog: false }); })(),
    neonM: glow(MAGENTA, 1.6), neonC: glow('#38d0ff', 1.4), led: glow('#ff3b5b', 1.6), ledOrange: glow(ORANGE, 1.8),
    route: glow(ORANGE, 1.3), carHead: unlit('#fff4d8'), carTail: unlit('#ff3b2a'),
    road: mat('#0c0e16', { roughness: 0.9 }),
    cityWin: (() => { const t = TX.cityWindows(); return new THREE.MeshStandardMaterial({ color: t ? '#ffffff' : '#20283a', map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: t ? 1.3 : 0.25, roughness: 0.8 }); })(),
    cityBlock: mat('#10131c', { roughness: 0.9 }),
    wetAsphalt: withTex(new THREE.MeshPhysicalMaterial({ color: '#141720', metalness: 0.3, roughness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.25 }), TX.asphalt('#141720'), true),
    puddle: new THREE.MeshPhysicalMaterial({ color: '#0a0d16', metalness: 0.0, roughness: 0.04, clearcoat: 1, reflectivity: 1 }),
    carBody: new THREE.MeshPhysicalMaterial({ color: '#2b2f3a', metalness: 0.6, roughness: 0.3, clearcoat: 0.6 }),
    liftWall: new THREE.MeshPhysicalMaterial({ color: '#3b4150', metalness: 0.75, roughness: 0.28 }),
    liftDoor: new THREE.MeshPhysicalMaterial({ color: '#4a515f', metalness: 0.85, roughness: 0.22 }),
    numPanel: (() => { const t = TX.floorNum(); return new THREE.MeshBasicMaterial({ color: t ? '#ffffff' : '#0b1a14', map: t, fog: false }); })(),
    locker: mat('#2b3140', { roughness: 0.6 }), lockerDoor: mat('#39414f', { roughness: 0.5 }),
    // 快递员 / 纸箱（共用部件要的材质名）
    courier: mat('#1f2733', { roughness: 0.7 }), helmet: mat('#ff5c8a', { roughness: 0.3, clearcoat: 0.5 }), skin: mat('#e6b98f', { roughness: 0.6 }), glove: mat('#15161b', { roughness: 0.8 }), dark: mat('#15161b', { roughness: 0.6 }), labelOrange: mat('#f0820f'),
    box: withTex(mat('#c79a5e', { roughness: 0.9 }), TX.cardboard('#b8946c')), tape: mat('#d9b98a', { roughness: 0.4, clearcoat: 0.3 }), label: withTex(mat('#f5f0e8', { roughness: 0.6 }), TX.waybill()),
  };
  if (M.cityWin.map) M.cityWin.emissiveMap = M.cityWin.map;
  const root = new THREE.Group(); scene.add(root);
  const parts = {};

  // 画一只耳机（复用 04 商品模型）+ 可控 LED（挂在右耳罩外侧）。colors 用 catalog gm-headset。
  const makeHeadset = (ledMat) => {
    const g = buildProduct({ kind: 'headset', colors: item.colors ?? ['#26203a', '#ff5c8a', '#f2eeff'] });
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 32), ledMat); led.position.set(0.3, 0.17, 0); led.rotation.y = Math.PI / 2; g.add(led);
    g.userData.led = led; return g;
  };

  // 一个风格化但可信的玩家（3/4 背侧视角，不露脸）：连帽衫肩膀 + 头 + 深色发帽 + 两只耳朵。原点在座位，面朝 -z（背对相机）。
  const buildGamer = () => {
    const gm = new THREE.Group();
    const hoodie = mat('#2a3040', { roughness: 0.8 }), hair = mat('#241d30', { roughness: 0.85 }), skin = mat('#e3b48c', { roughness: 0.6 });
    gm.add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), hoodie)).translateY(0.14));   // 肩/上身（压扁的球）
    gm.children[0].scale.set(1.0, 0.7, 0.85);
    gm.add(box(0.08, 0.012, 0.3, M.neonM, [0, 0.2, 0.12]));                                   // 帽衫领口霓虹拉链条
    gm.add(cyl(0.055, 0.06, 0.1, skin, [0, 0.36, 0], 20));                                     // 脖子
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.12, 28, 22), skin)); head.position.set(0, 0.47, 0); gm.add(head);
    const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.126, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.62), hair)); cap.position.set(0, 0.47, 0); cap.rotation.x = -0.35; gm.add(cap);   // 发帽盖住头顶 + 后脑
    gm.add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), hair)).translateY(0.44).translateZ(-0.03));   // 后脑头发（朝相机那面）
    for (const sx of [-1, 1]) gm.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), skin).translateX(sx * 0.115).translateY(0.46));   // 耳朵
    return gm;
  };

  // ═════ 1 defeat 暗房电竞桌：显示器「DEFEAT」、桌上耳机特写（LED 1.0 熄灭）、旁边手机弹「明早 9:00 决赛」 ═════
  {
    const g = setGroup('defeat');
    g.add(box(4, 0.04, 2.4, M.desk, [0, -0.02, 0])); g.add(box(5, 3, 0.05, M.wall, [0, 1.5, -1.0]));
    const monitor = new THREE.Group(); monitor.position.set(0, 0, -0.55); g.add(monitor);
    monitor.add(rbox(1.1, 0.62, 0.03, M.plastic, [0, 0.72, 0], 0.015));
    const scr = plane(1.02, 0.56, M.screenDefeat, [0, 0.72, 0.018]); monitor.add(scr);
    monitor.add(box(0.1, 0.26, 0.1, M.plastic, [0, 0.3, -0.02])); monitor.add(box(0.32, 0.03, 0.22, M.plastic, [0, 0.17, -0.02]));
    const glowScr = new THREE.PointLight('#4a6cff', 0.6, 2.2, 2); glowScr.position.set(0, 0.72, 0.4); g.add(glowScr);
    // 桌上的耳机（竖立），LED 一开始亮，1.0 断音熄灭
    const hs = makeHeadset(M.led.clone()); hs.scale.setScalar(0.9); hs.position.set(0.22, 0, 0.1); hs.rotation.y = -0.5; g.add(hs);
    // 键盘（RGB 灯带）
    const kb = box(0.5, 0.03, 0.17, M.plastic, [-0.35, 0.03, 0.3]); g.add(kb); const rgb = box(0.5, 0.004, 0.17, M.neonM, [-0.35, 0.047, 0.3]); g.add(rgb);
    // 手机：横放桌上，弹出通知
    const phone = new THREE.Group(); phone.position.set(0.75, 0.02, 0.35); phone.rotation.x = -Math.PI / 2; phone.rotation.z = -0.3; g.add(phone);
    phone.add(rbox(0.16, 0.33, 0.012, M.glassDark, [0, 0, 0], 0.02));
    const notif = plane(0.14, 0.06, (() => { const t = TX.phoneNotif(); return new THREE.MeshBasicMaterial({ color: t ? '#ffffff' : '#20242e', map: t, transparent: true, opacity: 0, fog: false }); })(), [0, 0.1, 0.008]); phone.add(notif);
    const rim = new THREE.PointLight(MAGENTA, 1.1, 3.0, 2); rim.position.set(-0.7, 0.6, 0.6); g.add(rim);
    const rimC = new THREE.PointLight('#3a6cff', 0.6, 3.0, 2); rimC.position.set(0.7, 0.5, 0.5); g.add(rimC);
    root.add(g); parts.defeat = { g, led: hs.userData.led, notif };
  }

  // ═════ 2 order 手机下单：手机竖屏显示耳机商品页，手指点「立即下单」，0.5 下单，HUD 倒计时开始（HUD 文字层在 captions） ═════
  {
    const g = setGroup('order');
    g.add(box(2, 0.04, 1.4, M.desk, [0, -0.02, 0])); g.add(box(3, 2, 0.05, M.wall, [0, 1.0, -0.6]));
    const phone = new THREE.Group(); phone.position.set(0, 0.1, 0); phone.rotation.x = -0.5; g.add(phone);
    phone.add(rbox(0.34, 0.7, 0.02, M.glassDark, [0, 0.35, 0], 0.03));
    const scr = plane(0.3, 0.64, M.phone, [0, 0.35, 0.012]); phone.add(scr);
    // 下单按钮高亮（0.5 一闪）
    const btn = plane(0.24, 0.06, glow(ORANGE, 0.8), [0, 0.12, 0.014]); phone.add(btn);
    // 手指（简化：一节圆柱）从右下伸进来点按钮
    const finger = new THREE.Group(); g.add(finger); finger.add(cyl(0.018, 0.022, 0.14, M.skin, [0, 0, 0], 16));
    const key = new THREE.PointLight(ORANGE, 0.5, 2, 2); key.position.set(0.3, 0.6, 0.6); g.add(key);
    root.add(g); parts.order = { g, phone, btn, finger };
  }

  // ═════ 3 cube 城市前置仓：立体密集仓储塔（InstancedMesh 料箱网格）+ 顶部轨道机器人（闭式路径）+ 一台 5.0 把装耳机的料箱提上来；侧面剖开 ═════
  {
    const g = setGroup('cube');
    g.add(box(10, 0.04, 10, M.road, [0, -0.02, 0]));
    const COLS = 10, ROWS = 7, DEEP = 4, BW = 0.4, GAP = 0.03, PIT = BW + GAP;      // 一块金属网格塔：10×7 格，深 4 层
    const towerW = COLS * PIT, towerH = ROWS * PIT, towerD = DEEP * PIT;
    const tower = new THREE.Group(); tower.position.set(0, 0, 0); g.add(tower);
    // 网格框架（深色铝合金竖杆 + 横梁）
    const alu = new THREE.MeshPhysicalMaterial({ color: '#565e6c', metalness: 0.9, roughness: 0.35 });
    for (let c = 0; c <= COLS; c++) tower.add(box(0.025, towerH, towerD, alu, [(-COLS / 2 + c) * PIT, towerH / 2, 0]));
    for (let r = 0; r <= ROWS; r++) tower.add(box(towerW, 0.025, towerD, alu, [0, r * PIT, 0]));
    // 料箱：每格一只彩色料箱（InstancedMesh + instanceColor），前面满、往里渐疏
    const N = COLS * ROWS, bins = new THREE.InstancedMesh(new RoundedBoxGeometry(BW - 0.05, BW - 0.05, BW - 0.05, 2, 0.025), new THREE.MeshStandardMaterial({ roughness: 0.5 }), N);
    bins.castShadow = true; tower.add(bins);
    const BIN_COLS = ['#ff6b3d', '#ffb02e', '#36c5f0', '#6ad36a', '#ff4f8b', '#b48cff', '#f2eeff'];
    const binSeed = Array.from({ length: N }, () => R()), col0 = new THREE.Color();
    binSeed.forEach((sd, i) => bins.setColorAt(i, col0.set(BIN_COLS[(sd * BIN_COLS.length) | 0])));
    if (bins.instanceColor) bins.instanceColor.needsUpdate = true;
    // 目标料箱（装耳机）：单独一只，带橙色标记，5.0 被提上来
    const hero = rbox(BW - 0.03, BW - 0.03, BW - 0.03, mat('#20242e', { roughness: 0.4 }), [0, 0, 0], 0.02); g.add(hero);
    const heroTag = plane(0.16, 0.16, glow(ORANGE, 1.4), [0, 0, (BW - 0.03) / 2 + 0.004]); hero.add(heroTag);
    const miniHs = makeHeadset(M.ledOrange.clone()); miniHs.scale.setScalar(0.22); miniHs.position.set(0, -0.03, 0.0); miniHs.rotation.y = 0.4; hero.add(miniHs);
    // 顶部轨道 + 几台机器人（闭式沿矩形轨道滑行，带发光灯带，个头够大能看见）
    const rail = new THREE.Group(); rail.position.set(0, towerH + 0.06, 0); g.add(rail);
    for (const dz of [towerD / 2 + 0.12, -towerD / 2 - 0.12]) rail.add(box(towerW + 0.5, 0.03, 0.04, alu, [0, 0, dz]));
    const ROB = 5, robots = [];
    for (let i = 0; i < ROB; i++) { const rg = new THREE.Group(); rg.add(rbox(0.34, 0.16, 0.4, mat('#2a2f3a', { roughness: 0.45 }), [0, 0.08, 0], 0.03)); rg.add(box(0.26, 0.015, 0.3, M.neonC, [0, 0.165, 0])); rg.add(box(0.05, 0.05, 0.05, glow(ORANGE, 1.5), [0, 0.1, 0.19])); rail.add(rg); robots.push(rg); }
    const lift = new THREE.PointLight(ORANGE, 0.0, 4, 2); lift.position.set(0, towerH * 0.7, towerD); g.add(lift);
    const fill = new THREE.PointLight('#6a86d8', 1.0, 20, 2); fill.position.set(3, towerH + 2, 4); g.add(fill);
    const rimM = new THREE.PointLight(MAGENTA, 0.8, 14, 2); rimM.position.set(-3, towerH * 0.5, 2); g.add(rimM);
    root.add(g); parts.cube = { g, bins, binSeed, hero, heroTag, robots, lift, dims: { COLS, ROWS, PIT, BW, towerH, towerW, towerD } };
  }

  // ═════ 4 route 夜城地图：实例化发光楼块 + 发光道路线 + 流动车灯；有集橙路线 7.0 从前置仓连通到公寓；HUD 小地图在文字层 ═════
  {
    const g = setGroup('route');
    const base = plane(4, 3, M.road, [0, 0, 0]); base.rotation.x = -Math.PI / 2; base.receiveShadow = true; g.add(base);
    // 道路线（发光细线网格，青蓝）
    const roads = new THREE.Group(); g.add(roads);
    for (let i = -3; i <= 3; i++) { roads.add(box(3.6, 0.006, 0.016, glow('#3a6ea8', 1.2), [0, 0.012, i * 0.4])); roads.add(box(0.016, 0.006, 2.6, glow('#3a6ea8', 1.2), [i * 0.5, 0.012, 0])); }
    // 实例化夜蓝楼块（越往中心越高，顶面亮一点蓝，不用金色窗贴图——那在小尺寸下成了金粉）
    const blockMat = new THREE.MeshStandardMaterial({ color: '#1a2740', emissive: '#2a4a7a', emissiveIntensity: 0.6, roughness: 0.7, metalness: 0.2 });
    const NB = 90, blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat, NB);
    const blockSeed = []; const m4 = new THREE.Matrix4();
    for (let i = 0; i < NB; i++) { const x = (R() - 0.5) * 3.4, z = (R() - 0.5) * 2.4, d = Math.hypot(x, z), h = 0.1 + (1.4 - clamp(d / 2)) * 0.5 * (0.4 + R() * 0.6), w = 0.1 + R() * 0.12; m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w)); blocks.setMatrixAt(i, m4); blockSeed.push([x, z]); }
    blocks.instanceMatrix.needsUpdate = true; g.add(blocks);
    // 有集橙路线（从 hub 到公寓的一条曲线，7.0 连通）
    const hub = new THREE.Vector3(-1.5, 0.02, 0.9), home = new THREE.Vector3(1.4, 0.02, -0.8);
    const curve = new THREE.CatmullRomCurve3([hub, new THREE.Vector3(-0.8, 0.02, 0.5), new THREE.Vector3(-0.1, 0.02, 0.2), new THREE.Vector3(0.6, 0.02, -0.2), home]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.03, 8, false), glow(ORANGE, 1.8)); g.add(tube);
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.075, 8, false), new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(halo);
    g.add(cyl(0.06, 0.06, 0.01, M.route, [hub.x, 0.015, hub.z], 20)); g.add(cyl(0.06, 0.06, 0.01, glow(MAGENTA, 1.2), [home.x, 0.015, home.z], 20));
    // 流动车灯（沿几条道路跑的小光点）
    const NC = 24, cars = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), M.carHead, NC); g.add(cars);
    const carSeed = Array.from({ length: NC }, () => [Math.floor(R() * 7) - 3, R(), R() < 0.5 ? 1 : -1, R() < 0.5]);
    const amb = new THREE.PointLight('#33406a', 0.6, 12, 2); amb.position.set(0, 2, 1); g.add(amb);
    root.add(g); parts.route = { g, curve, tube, halo, cars, carSeed };
  }

  // ═════ 5 ride 雨后街道：湿沥青（镜面反射盘）+ 霓虹招牌倒影 + 配送车 9.5 驶过积水溅起水花；低机位 ═════
  {
    const g = setGroup('ride');
    g.add(box(10, 0.02, 4, M.wetAsphalt, [0, -0.01, 0]));
    // 积水（几块镜面平面，稍抬一点）
    for (const [px, pz, pw, pd] of [[0, 0.4, 1.6, 0.8], [-1.4, -0.3, 1.0, 0.6], [1.6, 0.1, 1.2, 0.7]]) { const pl = plane(pw, pd, M.puddle, [px, 0.002, pz]); pl.rotation.x = -Math.PI / 2; g.add(pl); }
    // 街边霓虹招牌（夜蓝建筑 + 大块发光字条）+ 积水上的霓虹倒影条（低、朝上发光）
    for (const [sx, col, h] of [[-2.2, MAGENTA, 1.6], [2.3, '#38d0ff', 1.3], [-3.6, ORANGE, 1.1], [3.6, MAGENTA, 1.4]]) {
      g.add(box(1.1, h, 0.1, M.cityBlock, [sx, h / 2, -1.5]));
      g.add(box(0.9, 0.28, 0.03, glow(col, 2.0), [sx, h * 0.66, -1.42]));                 // 大霓虹字条
      g.add(box(0.5, 0.9, 0.02, glow(col, 1.2), [sx + (sx > 0 ? -0.55 : 0.55), h * 0.5, -1.42]));   // 竖霓虹条
      g.add(box(0.6, 0.02, 1.2, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }), [sx * 0.5, 0.012, 0.3]));   // 积水里的倒影
    }
    g.add(box(10, 1.8, 0.1, M.cityBlock, [0, 0.9, -1.7]));
    // 配送车（厢式小货车）：有集橙车身 + 双前照灯，从右往左驶过
    const van = new THREE.Group(); g.add(van);
    van.add(rbox(1.0, 0.56, 0.56, M.carBody, [0, 0.46, 0], 0.06));                    // 厢体
    van.add(rbox(0.5, 0.46, 0.58, M.carBody, [0.58, 0.4, 0], 0.05));                  // 车头
    van.add(box(0.86, 0.26, 0.57, M.labelOrange, [-0.02, 0.46, 0], ));               // 有集橙车身腰带
    van.add(box(0.52, 0.1, 0.58, glow(ORANGE, 1.2), [0, 0.74, 0]));                   // 车顶橙灯带
    for (const wx of [-0.32, 0.56]) for (const wz of [0.3, -0.3]) van.add(cyl(0.13, 0.13, 0.08, M.rubber, [wx, 0.13, wz], 18).rotateX(Math.PI / 2));
    const hlL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), M.carHead), hlR = hlL.clone();   // 双前照灯（发光球）
    hlL.position.set(0.84, 0.34, 0.2); hlR.position.set(0.84, 0.34, -0.2); van.add(hlL, hlR);
    const headlight = new THREE.SpotLight('#fff2d6', 2.2, 5, 0.7, 0.5, 1.2); headlight.position.set(0.8, 0.34, 0); headlight.target.position.set(-3, 0, 0.3); g.add(headlight, headlight.target);
    const splash = puffs(30, DOT, '#dcebff', 0.14, 0.0); g.add(splash);
    const rimM = new THREE.PointLight(MAGENTA, 0.8, 8, 2); rimM.position.set(-2, 1, 0.6); g.add(rimM);
    const rimC = new THREE.PointLight('#38d0ff', 0.6, 8, 2); rimC.position.set(2.2, 1, 0.6); g.add(rimC);
    root.add(g); parts.ride = { g, van, headlight, splash };
  }

  // ═════ 6 lift 公寓电梯：楼层数字 1→23 飞快跳动，12.5 门开（叮）；门口快递柜 + 门口放着包裹；HUD「已送达 08:12」在文字层 ═════
  {
    const g = setGroup('lift');
    g.add(box(4, 0.04, 3, M.road, [0, -0.02, 0])); g.add(box(5, 3.4, 0.06, mat('#2a2f3a', { roughness: 0.8 }), [0, 1.7, -0.65]));
    // 拉丝不锈钢门框 + 两扇拉丝钢门：中灰调（粗糙度高一点）才不会被环境反射冲成白雾
    const brushed = new THREE.MeshPhysicalMaterial({ color: '#8a9099', metalness: 0.82, roughness: 0.46 });
    const frameMat = new THREE.MeshPhysicalMaterial({ color: '#6b707a', metalness: 0.85, roughness: 0.4 });
    g.add(box(1.9, 2.7, 0.14, frameMat, [0, 1.35, -0.5]));
    const doorL = box(0.78, 2.4, 0.08, brushed, [-0.4, 1.25, -0.42]); const doorR = box(0.78, 2.4, 0.08, brushed, [0.4, 1.25, -0.42]); g.add(doorL, doorR);
    // 门上横向拉丝暗槽（看得出是金属门，不是白板）：每扇门几道细暗线，挂在门上随门移动
    const grooveMat = mat('#4a4f58', { roughness: 0.6 });
    for (const door of [doorL, doorR]) for (let y = -0.9; y <= 0.9; y += 0.45) door.add(box(0.76, 0.012, 0.01, grooveMat, [0, y, 0.045]));
    for (const dx of [-0.4, 0.4]) g.add(box(0.025, 2.4, 0.02, mat('#23262e'), [dx + (dx < 0 ? 0.39 : -0.39), 1.25, -0.37]));   // 门缝暗线（不发光）
    // 门楣楼层数字面板（大、门框正上方略进框、朝相机）：预建 1..23 每层一张，update 里换当前楼层
    const floorTex = Array.from({ length: 23 }, (_, i) => TX.floorNum(i + 1));
    const panelMat = new THREE.MeshBasicMaterial({ color: floorTex[22] ? '#ffffff' : '#0b1a14', map: floorTex[22] ?? null, fog: false });
    g.add(box(1.3, 0.5, 0.04, mat('#0a0c10', { roughness: 0.6 }), [0, 2.42, -0.4]));          // 面板暗框
    const panel = plane(1.16, 0.4, panelMat, [0, 2.42, -0.37]); g.add(panel);
    // 轿厢内（门开后露出）：暗暖内壁 + 一只包裹；只给很弱的暖光，避免门缝漏出白雾
    const car = new THREE.Group(); car.position.set(0, 0, -0.64); g.add(car);
    car.add(box(1.5, 2.4, 0.04, mat('#2a2320', { roughness: 0.75 }), [0, 1.2, -0.08]));        // 暖木色内壁
    car.add(box(1.5, 0.04, 0.5, mat('#1a1612', { roughness: 0.8 }), [0, 0.02, 0.14]));          // 轿厢地板
    const parcel = buildParcel([0.34, 0.12, 0.26], { ...M }); closeParcel(parcel, 1, 0); parcel.position.set(0, 0.0, 0.16); car.add(parcel);
    const carGlow = new THREE.PointLight('#ffdca8', 0.0, 1.4, 2); carGlow.position.set(0, 1.3, -0.4); g.add(carGlow);   // 暖、弱、范围小
    // 快递柜（门口一侧）
    const locker = new THREE.Group(); locker.position.set(1.5, 0, -0.3); g.add(locker);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { locker.add(box(0.34, 0.34, 0.3, M.lockerDoor, [c * 0.36 - 0.18, 0.3 + r * 0.36, 0])); }
    locker.add(box(0.76, 1.56, 0.02, M.locker, [0, 0.9, -0.16]));
    const ding = new THREE.PointLight('#ffe6b8', 0.0, 2.0, 2); ding.position.set(0, 2.0, 0.4); g.add(ding);
    const key = new THREE.PointLight('#9fb0d8', 0.6, 9, 2); key.position.set(1.2, 2.6, 1.8); g.add(key);
    root.add(g); parts.lift = { g, doorL, doorR, panel, panelMat, floorTex, ding, carGlow };
  }

  // ═════ 7 victory 玩家戴上新耳机，屏幕 VICTORY，耳机 LED 亮起有集橙；片尾卡（文字层） ═════
  {
    const g = setGroup('victory');
    g.add(box(4, 0.04, 2.4, M.desk, [0, -0.02, 0])); g.add(box(5, 3, 0.05, M.wall, [0, 1.5, -1.0]));
    const monitor = new THREE.Group(); monitor.position.set(-0.55, 0, -0.55); g.add(monitor);   // 显示器挪到左后，给右侧 / 上方的玩家主体让位
    monitor.add(rbox(1.1, 0.62, 0.03, M.plastic, [0, 0.72, 0], 0.015));
    monitor.add(plane(1.02, 0.56, M.screenVictory, [0, 0.72, 0.018]));
    monitor.add(box(0.1, 0.26, 0.1, M.plastic, [0, 0.3, -0.02])); monitor.add(box(0.32, 0.03, 0.22, M.plastic, [0, 0.17, -0.02]));
    // 风格化玩家（3/4 背侧，不露脸）戴上耳机：耳机从上方降下扣住。放在偏右 / 偏前
    const player = buildGamer(); player.position.set(0.28, 0.0, 0.35); player.rotation.y = 0.6; g.add(player);   // 稍微转 3/4，露出侧后脑和耳朵
    const hs = makeHeadset(M.led.clone()); hs.scale.setScalar(0.56); hs.position.set(0.28, 0.3, 0.35); hs.rotation.y = 0.6; g.add(hs);   // LED 一开始暗红，13.0 戴上后点亮橙
    const glowScr = new THREE.PointLight('#9fb4e0', 0.3, 2.0, 2); glowScr.position.set(-0.55, 0.72, 0.3); g.add(glowScr);   // 屏幕冷光，压低不过曝
    const rim = new THREE.PointLight(ORANGE, 0.0, 2.2, 2); rim.position.set(0.55, 0.6, 0.6); g.add(rim);
    root.add(g); parts.victory = { g, headset: hs, led: hs.userData.led, rim };
  }

  // ═════ 灯光：主平行光跟着取景点（各布景的夜色方向），半球光给夜蓝环境 ═════
  const key = new THREE.DirectionalLight('#aab4e0', 1.4); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.2, far: 16 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.006;
  const amb = new THREE.HemisphereLight('#5a68a0', '#141622', 0.6);
  scene.add(key, key.target, amb); scene.background = new THREE.Color('#0a0d1a');
  let env = null, pmrem = null;
  try { if (ctx.renderer && typeof ctx.renderer.compile === 'function') { pmrem = new THREE.PMREMGenerator(ctx.renderer); env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env; if (scene.environmentIntensity != null) scene.environmentIntensity = 0.65; } } catch { env = null; }

  // 每个布景的主光方向、颜色、强度和环境光、背景色（都偏夜蓝）
  const LIGHT = {
    defeat: { dir: [-1.5, 2.0, 1.5], color: '#7f8fd8', k: 1.3, amb: 0.5, bg: '#0a0d1a' },
    order: { dir: [1.2, 2.0, 1.5], color: '#ffb060', k: 1.4, amb: 0.5, bg: '#0c0f1c' },
    cube: { dir: [1.5, 3.0, 2.0], color: '#aebbe8', k: 2.0, amb: 0.6, bg: '#0d1222' },
    route: { dir: [0.5, 3.0, 1.0], color: '#6a7ac0', k: 1.0, amb: 0.4, bg: '#080b16' },
    ride: { dir: [-1.5, 1.6, 1.2], color: '#8f9cd8', k: 1.5, amb: 0.45, bg: '#0a0e1c' },
    lift: { dir: [1.0, 2.4, 1.5], color: '#c6d2f0', k: 2.0, amb: 0.6, bg: '#121726' },
    victory: { dir: [1.0, 2.0, 1.8], color: '#9fb0e0', k: 1.5, amb: 0.5, bg: '#0c0f1c' },
  };
  const m4 = new THREE.Matrix4(), tmpV = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  root.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; });
  const place = (im, i, x, y, z, s = 1, sy = s, sz = s) => { m4.compose(tmpV.set(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, sy, sz)); im.setMatrixAt(i, m4); };

  const handle = {
    root, parts, M, item, scene, key, amb, env, pmrem,
    post: { exposure: 1.15, vignette: 0.34, grain: 0.025, bloom: { strength: 0.38, radius: 0.5, threshold: 0.82 }, saturation: 1.18, gain: [0.96, 0.99, 1.08], lift: [0.015, 0.0, 0.03], chroma: 0.0012, flashColor: [0.72, 0.71, 0.74] },
    update(s) {
      const t = s.t;
      // ── defeat：LED 在 1.0 断音熄灭（亮红 → 暗）；手机通知在 1.3 后弹出；屏幕一直是 DEFEAT ──
      { const P = parts.defeat, lt = localT('defeat', t), die = ss(EV.mute - 0.08, EV.mute + 0.05, lt);
        const flick = lt < EV.mute ? (0.6 + 0.4 * Math.sin(lt * 60)) : 0;             // 断音前闪一下
        P.led.material.emissiveIntensity = lerp(1.6 * (lt < EV.mute ? flick : 1), 0.0, die); P.led.material.color.setStyle('#ff3b5b'); P.led.material.emissive.setStyle('#ff3b5b');
        if (P.notif) P.notif.material.opacity = ss(1.2, 1.6, lt); }
      // ── order：手指 0.0→0.5 落到按钮，0.5 按下（按钮一闪），之后抬起 ──
      { const P = parts.order, lt = localT('order', t), down = ss(0.0, EV.order, lt) * (1 - ss(EV.order + 0.15, EV.order + 0.5, lt));
        const fy = lerp(0.35, 0.14, ss(0, EV.order, lt)); P.finger.position.set(0.08, 0.12 + 0.18 * (1 - down), 0.22); P.finger.rotation.set(-0.9, 0, -0.4);
        const flash = ss(EV.order - 0.05, EV.order, lt) * (1 - ss(EV.order + 0.1, EV.order + 0.4, lt));
        P.btn.material.opacity = 1; P.btn.material.color.setStyle(ORANGE); P.btn.material.emissive?.setStyle?.(ORANGE); if (P.btn.material.emissiveIntensity != null) P.btn.material.emissiveIntensity = 0.6 + 1.2 * flash; }
      // ── cube：机器人沿顶部轨道闭式滑行；5.0 一台把目标料箱从塔里提上来（lift 灯亮）；料箱网格静止（剖面展示） ──
      { const P = parts.cube, lt = localT('cube', t), D = P.dims;
        P.binSeed.forEach((sd, i) => { const c = i % D.COLS, r = (i / D.COLS) | 0; place(P.bins, i, (-D.COLS / 2 + c + 0.5) * D.PIT, (r + 0.5) * D.PIT, 0, 1); });
        P.bins.instanceMatrix.needsUpdate = true;
        // 机器人：矩形轨道（沿 ±x 跑，两端换到另一条轨），每台相位错开
        P.robots.forEach((rg, i) => { const u = ((lt * 0.4 + i / P.robots.length) % 1 + 1) % 1, side = u < 0.5 ? 1 : -1, uu = (u % 0.5) * 2; rg.position.set((-0.5 + uu) * (D.towerW + 0.4), 0, side * (D.towerD / 2 + 0.12)); });
        // 目标料箱：从塔中部沿塔前面升到顶（z 在塔面前方，看得见），再被顶部机器人接走
        const rise = ss(EV.lift - 1.2, EV.lift, lt), out = ss(EV.lift, EV.lift + 0.6, lt);
        const y = lerp(D.PIT * 2.5, D.towerH + 0.12, rise), z = D.towerD / 2 + 0.1 + lerp(0, 0.25, out);
        P.hero.position.set(0, y, z);
        P.hero.visible = rise > 0.01; P.heroTag.material.emissiveIntensity = 1.4;
        P.lift.intensity = 2.2 * ss(EV.lift - 0.2, EV.lift + 0.1, lt) * (1 - ss(EV.lift + 0.5, EV.lift + 1.0, lt)); }
      // ── route：7.0 (connect) 路线从 hub 一点点连到公寓；车灯沿道路流动 ──
      { const P = parts.route, lt = localT('route', t), u = clamp(ss(0.2, EV.connect, lt));
        const n = Math.max(6, Math.floor(P.tube.geometry.index.count * u / 6) * 6); P.tube.geometry.setDrawRange(0, n); P.halo.geometry.setDrawRange(0, n);
        P.carSeed.forEach((sd, i) => { const [lane, ph, dir, horiz] = sd, uu = ((lt * 0.25 * (0.6 + ph) + ph) % 1 + 1) % 1; const p = dir > 0 ? uu : 1 - uu;
          if (horiz) place(P.cars, i, (p - 0.5) * 3.4, 0.02, lane * 0.4); else place(P.cars, i, lane * 0.5, 0.02, (p - 0.5) * 2.4); });
        P.cars.instanceMatrix.needsUpdate = true; }
      // ── ride：配送车从右往左驶过，9.5 (splash) 过积水溅起水花；车灯一直亮 ──
      { const P = parts.ride, lt = localT('ride', t), drive = ss(0, NATURAL.ride, lt), x = lerp(2.4, -2.4, drive);
        P.van.position.set(x, 0, 0.15); P.van.rotation.y = Math.PI;                   // 车头朝 -x（驶来的方向）
        P.headlight.position.set(x - 0.8, 0.34, 0.15); P.headlight.target.position.set(x - 3, 0, 0.2); P.headlight.target.updateMatrixWorld();
        const sp = ss(EV.splash - 0.12, EV.splash + 0.04, lt) * (1 - ss(EV.splash + 0.15, EV.splash + 0.85, lt));
        placePuffs(P.splash, 7, lt, [-0.45, 0, -0.3, 0.45, 0.8, 0.3], { vel: [0.9, 1.1, 0], sway: 0.06, swayHz: 2 }, { grow: 1.5, life: 0.6, k: sp });
        P.splash.position.set(x + 0.45, 0, 0.15); }
      // ── lift：楼层数字 1→23 飞快跳动（面板纹理不变，这里用面板的 UV 偏移模拟不现实——改用缩放脉冲 + ding 门开）──
      { const P = parts.lift, lt = localT('lift', t), open = ss(EV.ding, EV.ding + 0.6, lt);
        P.doorL.position.x = -0.4 - 0.74 * open; P.doorR.position.x = 0.4 + 0.74 * open;
        P.ding.intensity = 0.4 * ss(EV.ding - 0.05, EV.ding + 0.05, lt) * (1 - ss(EV.ding + 0.3, EV.ding + 0.9, lt));
        P.carGlow.intensity = 0.25 * open;                                           // 轿厢内一点暖光，不从门缝漏出白雾
        // 楼层 1→23 飞快跳动（在 ding 之前到 23 停住）：按故事时间选当前楼层的那张面板贴图
        const climb = clamp(lt / (EV.ding - 0.3)), floor = Math.min(23, 1 + Math.floor(climb * 22 + 1e-6));
        if (P.floorTex[floor - 1]) { P.panelMat.map = P.floorTex[floor - 1]; P.panelMat.needsUpdate = true; } }
      // ── victory：13.0 (wear) 耳机从上降下扣住头，LED 从暗红点亮成有集橙；屏幕 VICTORY 发光 ──
      { const P = parts.victory, lt = localT('victory', t), wear = ss(EV.wear, EV.wear + 0.5, lt);
        P.headset.position.set(0.28, lerp(0.95, 0.35, wear), 0.35); P.headset.rotation.y = 0.6;
        const on = ss(EV.wear + 0.2, EV.wear + 0.8, lt);
        P.led.material.color.set(on > 0.5 ? ORANGE : '#ff3b5b'); P.led.material.emissive.set(on > 0.5 ? ORANGE : '#ff3b5b'); P.led.material.emissiveIntensity = lerp(0.2, 2.0, on);
        P.rim.intensity = 1.0 * on; }
      // ── 灯光：主光对准当前取景点所在的布景 ──
      const f = s.focus ?? SETS.defeat, name = Object.keys(SETS).reduce((a, k) => (Math.abs(SETS[k][0] - f[0]) < Math.abs(SETS[a][0] - f[0]) ? k : a), 'defeat'), Lt = LIGHT[name];
      key.color.set(Lt.color); key.intensity = Lt.k; amb.intensity = Lt.amb;
      key.position.set(SETS[name][0] + Lt.dir[0], Lt.dir[1], Lt.dir[2]); key.target.position.set(SETS[name][0], 0.6, 0); key.target.updateMatrixWorld();
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
