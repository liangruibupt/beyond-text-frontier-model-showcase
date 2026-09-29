// pile.js — count 镜头：亮面方块（下单的日子）一块块从墙上跳起来，在空中翻着变成包裹，落成一堆；浅面方块缩小沉下去
// 包裹堆是圆锥里的一格格柱子：格子大小二分到正好放下 n 个，按"低、靠中间"的先后落，下面的总先落。
// 每帧的矩阵都是 lt 的闭式函数（同 wall.js），墙上方块在 lt = 0 的姿态就是 open 结束时的姿态
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOX } from '../meta.js';
import { rand, seedOf } from '../../factory/engine/rng.js';
import { clamp, easeIn, easeOut, smooth } from '../../factory/engine/ease.js';
import { clay } from './models/clay.js';

/** 堆的中心在墙前方（包围盒 BOX.pile 的中心），底半径 R、高 H */
const [[bx0, , bz0], [bx1, , bz1]] = BOX.pile;
export const PILE = { x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, R: 0.72, H: 0.95 };
export const LIFT = 0.4, FLY = 0.35, SQUASH = 0.14;                 // 起跳的时间窗（最后一块在 LIFT 起跳）· 一块飞多久 · 落地后压扁回弹多久
export const SIZE = { foot: [0.7, 0.76], tall: [0.6, 0.85], yaw: (15 * Math.PI) / 180, jitter: 0.03 };   // 包裹的底边、高（格子的倍数）、偏转、错位

/** 格子大小 c 时堆里的全部位置：每根柱子从下往上叠，顶和外沿都不出圆锥 */
function slotsAt(c, seed) {
  const K = Math.ceil(PILE.R / c), out = [];
  for (let i = -K; i <= K; i++) for (let k = -K; k <= K; k++) {
    const x = i * c, z = k * c, d = Math.hypot(x, z), col = (i + K) * (2 * K + 1) + k + K;
    for (let l = 0, y = 0; ; l++) {
      const h = c * (SIZE.tall[0] + (SIZE.tall[1] - SIZE.tall[0]) * rand(seed, col * 64 + l));
      if ((y + h) / PILE.H + (d + c / 2) / PILE.R > 1) break;
      out.push({ col, level: l, x, z, y, h, score: (y + h / 2) / PILE.H + d / PILE.R });
      y += h;
    }
  }
  return out;
}

/**
 * n 个包裹的排布，按落地先后：[{ x, z, y（底）, h, sx, sz, yaw, col, level, color（亮度偏移）}]，x、z 是场景坐标。
 * 格子 c 二分到最大的、还放得下 n 个的；取分数最低的 n 个位置（同一根柱子下面的分数总更低，所以叠得起来）
 */
export function layoutPile(n, seed = 1) {
  let lo = 0.02, hi = 0.6;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (slotsAt(mid, seed).length >= n) lo = mid; else hi = mid; }
  const c = lo, r = (j, q) => rand(seed ^ 0x51ed, j * 8 + q), span = ([a, b], k) => c * (a + (b - a) * k);
  return slotsAt(c, seed).sort((a, b) => a.score - b.score || a.col - b.col || a.level - b.level).slice(0, n).map((s, j) => ({
    x: PILE.x + s.x + (r(j, 0) - 0.5) * 2 * SIZE.jitter * c, z: PILE.z + s.z + (r(j, 1) - 0.5) * 2 * SIZE.jitter * c, y: s.y, h: s.h,
    sx: span(SIZE.foot, r(j, 2)), sz: span(SIZE.foot, r(j, 3)), yaw: (r(j, 4) - 0.5) * 2 * SIZE.yaw, col: s.col, level: s.level, color: (r(j, 5) - 0.5) * 0.12,
    hop: 0.35 + 0.25 * r(j, 6), spin: (r(j, 7) < 0.5 ? -1 : 1) * (1.2 + r(j, 7)), c,
  }));
}

/** 第 j 个包裹（共 n 个）起跳的时刻；第 0 个在 0，最后一个在 LIFT，落地都在 FLY 之后 */
export const liftAt = (j, n) => (n > 1 ? (LIFT * j) / (n - 1) : 0);
/** 落地后的压扁：0 → 1 → 0 */
const squashAt = (lt, land) => { const w = (lt - land) / SQUASH; return w > 0 && w < 1 ? Math.sin(Math.PI * w) : 0; };

/**
 * wall 是 open 的方块墙（wall.js）。返回 { root, slots, pose(lt) }：pose 同时写墙上的方块和包裹。
 * 第 i 块亮面方块（按日子先后）变成第 i 个包裹
 */
export function buildPile({ wall, pal, user }) {
  const seed = seedOf(`pile:${user}`), n = wall.lit.length, slots = layoutPile(n, seed);
  const below = slots.map(s => slots.filter(o => o.col === s.col && o.level < s.level).map(o => slots.indexOf(o)));
  const unit = new RoundedBoxGeometry(1, 1, 1, 2, 0.1), tapeGeo = new RoundedBoxGeometry(0.2, 1.012, 1.012, 2, 0.1);
  const box = new THREE.InstancedMesh(unit, clay({ color: '#ffffff' }), n), tape = new THREE.InstancedMesh(tapeGeo, clay({ color: pal.lit, emissive: pal.lit, emissiveIntensity: 0.25 }), n);
  const col = new THREE.Color();
  slots.forEach((s, j) => box.setColorAt(j, col.set(pal.parcel).offsetHSL(0, 0, s.color)));
  const root = new THREE.Group();
  for (const m of [box, tape]) { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; root.add(m); }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const landAt = j => liftAt(j, n) + FLY;
  return {
    root, slots,
    /** 第 j 个包裹在 lt 的中心、缩放、朝向，和它对应的方块（缩放 tile 为 0 就不见了） */
    flight(j, lt) {
      const s = slots[j], t0 = liftAt(j, n), k = clamp((lt - t0) / FLY), sq = squashAt(lt, t0 + FLY), sy = 1 - 0.16 * sq, sxz = 1 + 0.05 * sq;
      const bottom = below[j].reduce((y, o) => y + slots[o].h * (1 - 0.16 * squashAt(lt, landAt(o))), 0);
      const t = wall.tiles[wall.lit[j]], y1 = bottom + (s.h * sy) / 2, g = easeOut((k - 0.3) / 0.4);
      return {
        at: [t.x + (s.x - t.x) * k, t.y + (y1 - t.y) * k + s.hop * 4 * k * (1 - k), s.z * k],
        scale: [s.sx * g * sxz, s.h * g * sy, s.sz * g * sxz], yaw: s.yaw + (1 - g) * s.spin, tilt: (1 - g) * 0.8,
        tile: { flip: -2.5 * k, s: 1 - smooth((k - 0.3) / 0.15) },
      };
    },
    pose(lt) {
      const F = slots.map((_, j) => this.flight(j, lt));
      wall.write((k, i, lit) => {
        const t = wall.tiles[k];
        if (lit) { const f = F[i]; return { x: f.at[0], y: f.at[1], z: f.at[2], angle: t.angle, flip: f.tile.flip, s: f.tile.s }; }
        const u = easeIn((lt - 0.3 * rand(seed ^ 0xba5e, k)) / 0.25);   // 浅面方块：错开 0–0.3 秒，0.25 秒里缩小、下沉、侧倒
        return { x: t.x, y: t.y - 0.15 * u, z: 0, angle: t.angle, flip: (Math.PI / 2) * u, s: 1 - u };
      });
      F.forEach((f, j) => {
        m.compose(p.set(...f.at), q.setFromEuler(e.set(f.tilt, f.yaw, 0, 'YXZ')), sc.set(...f.scale));
        box.setMatrixAt(j, m); tape.setMatrixAt(j, m);
      });
      box.instanceMatrix.needsUpdate = tape.instanceMatrix.needsUpdate = true;
    },
  };
}
