// medal.js — title 镜头：奖牌从画面上方掉下来，EV.medal 落地，弹两下、压扁回弹，一边转一边停正，四周闪起小星星；
// 片尾（none、launch）奖牌立着轻轻浮动、左右摆。每帧的状态都是 lt 的闭式函数
import * as THREE from 'three';
import { EV } from '../meta.js';
import { buildMedalModel } from './models/medal.js';
import { rand } from '../../factory/engine/rng.js';
import { drift } from '../../factory/engine/particles.js';

export const DROP = 1.6, G = (2 * DROP) / EV.medal ** 2;              // 从多高掉下来；重力按 EV.medal 正好落地反推
export const BOUNCE = [0.12, 0.04];                                   // 两次弹起的高度
const hop = h => 2 * Math.sqrt((2 * h) / G);                         // 弹起 h 在空中的时长
/** 三次着地的时刻（title 本地秒） */
export const CONTACTS = BOUNCE.reduce((t, h) => [...t, t[t.length - 1] + hop(h)], [EV.medal]);
/** 闪光：数量 · 出现的区域 [x0, y0, z0, x1, y1, z1] · 一颗亮多久 · 最早、最晚亮起 */
export const SPARKLE = { n: 14, box: [-0.75, 0.15, -0.2, 0.75, 1.85, 0.3], life: 0.4, at: [EV.medal, EV.medal + 0.9] };

/** 离地高度：落下 → 两次弹起（抛物线）→ 停住 */
export function heightAt(lt) {
  if (lt < EV.medal) return DROP * (1 - (lt / EV.medal) ** 2);
  for (let i = 0; i < BOUNCE.length; i++) {
    const t0 = CONTACTS[i], T = CONTACTS[i + 1] - t0;
    if (lt < CONTACTS[i + 1]) { const t = lt - t0; return (G * t * (T - t)) / 2; }
  }
  return 0;
}
/** 着地时的压扁（y 方向缩的比例），高斯形，越往后越轻 */
const squashAt = lt => CONTACTS.reduce((s, tc, i) => s + [0.14, 0.07, 0.03][i] * Math.exp(-(((lt - tc) / 0.03) ** 2)), 0);

/** 四角星（一个面，朝 +z），闪光用 */
function sparkGeometry() {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = (Math.PI * i) / 4, k = i % 2 ? 0.18 : 1; pts.push(new THREE.Vector2(k * Math.sin(a), k * Math.cos(a))); }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

/** 返回 { root, drop(lt, dir), rest(lt) }：dir 是镜头的机位方向（闪光朝它） */
export function buildMedal({ pal, seed = 7 }) {
  const { root: model } = buildMedalModel(pal), root = new THREE.Group();
  const glow = new THREE.Color(pal.lit).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(3);
  const sparks = new THREE.InstancedMesh(sparkGeometry(), new THREE.MeshBasicMaterial({ color: glow, side: THREE.DoubleSide }), SPARKLE.n);
  sparks.frustumCulled = false;
  root.add(model, sparks);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3();
  const place = (y, yaw, sy) => { model.position.y = y; model.rotation.set(0, yaw, 0); model.scale.set(1 + 0.5 * (1 - sy), sy, 1 + 0.5 * (1 - sy)); };
  const hideSparks = () => { m.makeScale(0, 0, 0); for (let i = 0; i < SPARKLE.n; i++) sparks.setMatrixAt(i, m); sparks.instanceMatrix.needsUpdate = true; };
  return {
    root,
    drop(lt, dir) {
      place(heightAt(lt), 1.1 * Math.exp(-3 * lt) * Math.cos(6 * lt), 1 - squashAt(lt));
      q.setFromUnitVectors(Z, d.set(...dir).normalize());
      for (let i = 0; i < SPARKLE.n; i++) {
        const t0 = SPARKLE.at[0] + (SPARKLE.at[1] - SPARKLE.at[0]) * rand(seed, i), w = (lt - t0) / SPARKLE.life;
        const [x, y, z] = drift(seed, i, lt, SPARKLE.box, { vel: [0, 0.2, 0], sway: 0.02 }), k = w > 0 && w < 1 ? Math.sin(Math.PI * w) : 0;
        const s = k * (0.035 + 0.03 * rand(seed ^ 0x5a, i));
        sparks.setMatrixAt(i, m.compose(p.set(x, y, z), q, sc.setScalar(Math.max(s, 1e-6))));
      }
      sparks.instanceMatrix.needsUpdate = true;
    },
    rest(lt) {
      const w = (2 * Math.PI * lt) / 3;
      place(0.015 * (1 - Math.cos(w)), 0.12 * Math.sin(w), 1);
      hideSparks();
    },
  };
}
