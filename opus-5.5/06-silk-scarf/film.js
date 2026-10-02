// film.js — 锦时成片模板：把数据（轴、四套剪辑表、构图、字体）、场景（每款一个世界 + 丝巾 + 人台 + 礼盒）和镜头交给引擎（见 factory/README.md 的成片约定）
import * as THREE from 'three';
import { META } from './meta.js';
import { SCARVES } from './scarves.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { buildWorld, bust } from './js/worlds.js';
import { buildScarf } from './js/scarf.js';
import { bakeFor } from './js/sims.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { envMap } from '../03-perfume/js/worlds/common.js';

/** 礼盒：一只浅口的长方盒（装得下叠好的 22.5 × 43.5 cm 丝巾，四周各留 1.5 cm），衬纸，盒盖斜靠在后面；放在一个圆台上 */
function giftBox(k) {
  const g = new THREE.Group(), w = 0.255, d = 0.465, h = 0.045, t = 0.005, y = 0.88;
  const m = new THREE.MeshPhysicalMaterial({ color: k.palette.accent, roughness: 0.55, sheen: 0.15, sheenColor: new THREE.Color('#ffffff') }), lining = new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.9 });   // sheen 0.5 把深靛的盒子洗成了灰
  const add = (geo, mat, x, yy, z, p = g) => { const s = new THREE.Mesh(geo, mat); s.position.set(x, yy, z); s.castShadow = s.receiveShadow = true; p.add(s); return s; };
  add(new THREE.BoxGeometry(w, t, d), m, 0, y + t / 2, 0);
  add(new THREE.BoxGeometry(w, h, t), m, 0, y + h / 2, -d / 2); add(new THREE.BoxGeometry(w, h, t), m, 0, y + h / 2, d / 2);
  add(new THREE.BoxGeometry(t, h, d), m, -w / 2, y + h / 2, 0); add(new THREE.BoxGeometry(t, h, d), m, w / 2, y + h / 2, 0);
  add(new THREE.BoxGeometry(w - 2 * t, 0.002, d - 2 * t), lining, 0, y + t + 0.001, 0);
  // 盒盖：同尺寸略大一圈，竖着斜靠在盒子后面，盖面朝镜头，烫一道金色缎带
  const lid = new THREE.Group(); lid.position.set(0, y, -d / 2 - 0.03); lid.rotation.x = -0.32; g.add(lid);
  add(new THREE.BoxGeometry(w + 0.01, d + 0.01, 0.012), m, 0, (d + 0.01) / 2, 0, lid);
  add(new THREE.BoxGeometry(0.03, d + 0.012, 0.014), new THREE.MeshStandardMaterial({ color: '#c99a3b', metalness: 0.6, roughness: 0.35 }), 0, (d + 0.01) / 2, 0, lid);
  // 盖面烫金「锦时」+ JINSHI：竖排在缎带右侧（透明底，叠在盖面上 0.5 mm）。字体是异步加载的：等它到了再画一次
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const draw = () => {
      const q = c.getContext('2d'); q.clearRect(0, 0, 256, 512); q.fillStyle = '#e2bf6a'; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.font = '900 92px "Noto Serif SC", serif'; q.fillText('锦', 128, 150); q.fillText('时', 128, 262);
      q.font = '600 30px "Cormorant Garamond", serif'; q.save(); q.translate(128, 380); q.fillText('J I N S H I', 0, 0); q.restore();
      q.fillRect(78, 330, 100, 3); tex.needsUpdate = true;
    };
    draw(); document.fonts?.load('900 150px "Noto Serif SC"', '锦时').then(draw, () => {}); document.fonts?.ready.then(draw);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.17), new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.5, roughness: 0.35, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));   // 第一版 7.5 × 15 cm、纯金属：在暗处几乎看不见；缎带右边留 1.5–12.75 cm，字放在这段中间
    label.position.set(0.071, (d + 0.01) * 0.6, 0.0065); lid.add(label);
  }
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, y, 64), new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.6 }));
  stage.position.y = y / 2; stage.receiveShadow = true; g.add(stage);
  g.userData.floor = y + t + 0.003;                                    // 丝巾放在衬纸上
  // 合盖（宋锦 sj_box）：k = 0 斜靠在后面（盖面 +z 朝镜头）；k = 1 平盖在盒口上，盖面朝上。
  // rotation.x = −π/2 时盖子的 +y 指向 −z，所以合上时铰链（盖子原点）放在盒子前沿 +d/2，盖子往后铺满盒口
  const open = { p: lid.position.clone(), r: lid.rotation.x }, shut = { p: new THREE.Vector3(0, y + h + 0.006, d / 2 + 0.005), r: -Math.PI / 2 };
  g.userData.closeLid = k => {
    const e = k * k * (3 - 2 * k), a = Math.min(1, e * 1.6);
    lid.position.lerpVectors(open.p, shut.p, a); lid.position.y += 0.07 * Math.sin(Math.PI * a);   // 铰链端沿弧线越过盒口（直线插值会从盒壁里穿过去）
    lid.rotation.x = THREE.MathUtils.lerp(open.r, shut.r, e);
  };
  return g;
}

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const k = SCARVES[ctx.variant.scarf];
    const world = buildWorld(ctx, ctx.variant.scarf, k);
    ctx.world = world;
    ctx.scene.environment = envMap(ctx.renderer, world.env);
    ctx.postDefaults = world.post ?? {};
    const scarf = buildScarf(k), b = bust(), box = giftBox(k);
    ctx.scene.add(scarf.mesh, b.group, box);
    ctx.subjects = { scarf, sims: bakeFor(ctx.variant.scarf), world, bust: b.group, giftBox: box };
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) {
    const { scarf, bust, giftBox } = ctx.subjects;
    scarf.mesh.rotation.set(0, 0, 0); scarf.mesh.visible = true; scarf.setReveal(1);
    bust.visible = false; giftBox.visible = false; giftBox.rotation.set(0, 0, 0); giftBox.userData.closeLid?.(0);
    ctx.world.reset?.();
  },
  // 每个镜头先让世界按成片时间摆好会动的东西（洞窟的浮尘）
  shots: Object.fromEntries(Object.entries(SHOTS).map(([name, f]) => [name, (ctx, s) => { ctx.world.update?.(s); return f(ctx, s); }])),
  score,
  voLines,
  audition: AUDITION,
};
