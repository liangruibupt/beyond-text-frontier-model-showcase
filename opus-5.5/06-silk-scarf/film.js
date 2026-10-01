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

/** 礼盒：一只浅口的方盒（盒底 + 四壁），里面铺一层衬纸；片尾用 */
function giftBox(k) {
  const g = new THREE.Group(), w = 0.26, d = 0.26, h = 0.05, t = 0.004, y = 0.88;
  const m = new THREE.MeshPhysicalMaterial({ color: k.palette.accent, roughness: 0.55, sheen: 0.4 }), lining = new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.9 });
  const add = (geo, mat, x, yy, z) => { const s = new THREE.Mesh(geo, mat); s.position.set(x, yy, z); s.castShadow = s.receiveShadow = true; g.add(s); };
  add(new THREE.BoxGeometry(w, t, d), m, 0, y, 0);
  add(new THREE.BoxGeometry(w, h, t), m, 0, y + h / 2, -d / 2); add(new THREE.BoxGeometry(w, h, t), m, 0, y + h / 2, d / 2);
  add(new THREE.BoxGeometry(t, h, d), m, -w / 2, y + h / 2, 0); add(new THREE.BoxGeometry(t, h, d), m, w / 2, y + h / 2, 0);
  add(new THREE.BoxGeometry(w - 2 * t, 0.002, d - 2 * t), lining, 0, y + t, 0);
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, y, 64), new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.6 }));
  stage.position.y = y / 2; stage.receiveShadow = true; g.add(stage);
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
    scarf.mesh.rotation.set(0, 0, 0); scarf.setReveal(1);
    bust.visible = false; giftBox.visible = false; giftBox.rotation.set(0, 0, 0);
    ctx.world.reset?.();
  },
  // 每个镜头先让世界按成片时间摆好会动的东西（洞窟的浮尘）
  shots: Object.fromEntries(Object.entries(SHOTS).map(([name, f]) => [name, (ctx, s) => { ctx.world.update?.(s); return f(ctx, s); }])),
  score,
  voLines,
  audition: AUDITION,
};
