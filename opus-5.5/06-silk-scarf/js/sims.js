// sims.js — 每款要烘的布料：setup 时按款烘好，镜头按镜头本地时间取（clothAt）
// 烘焙用 32 × 32 的网格（40 × 40 两段要 4 秒多，超过 setup 的预算）；渲染网格同一分辨率
// 敦煌：fly（一角被看不见的手握着沿螺旋往上带，其余在风里拖成飘带）、drape（斜着从肩上方落下，搭在人台肩上垂定）
// 其余款做到对应镜头时在这里加
import { bakeCloth } from '../../factory/engine/cloth.js';
import { SCARF, BUST } from '../meta.js';
import { BUST_COLLIDERS } from './bust.js';

export const N = SCARF.n;
const S = SCARF.size, E = S / (N - 1);

/** 敦煌 fly：握点沿螺旋上升（半径 0.3、每秒升 0.28 米），2 × 2 个顶点一起握住（一个点会把相邻的边拉长） */
export const DH_HAND = t => [Math.cos(1.4 * t) * 0.3, 0.95 + 0.28 * t, Math.sin(1.4 * t) * 0.3 - 0.2];
function dhFly() {
  const grip = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => ({ i, j, pos: t => { const p = DH_HAND(t); return [p[0] + i * E, p[1] - j * E, p[2]]; } }));
  return bakeCloth({
    nx: N, ny: N, rest: (i, j) => { const p = DH_HAND(0); return [p[0] + (i / (N - 1)) * S * 0.5, p[1] - (j / (N - 1)) * S * 0.5, p[2]]; },
    t1: 3.2, seed: 11, damping: 1.6, bend: 0.08, drag: 1.6, pins: grip,
    wind: (x, y, z, t, o, g) => { o[0] = -0.8 + 0.6 * Math.sin(2.1 * t + 7 * g[0] + y * 3); o[1] = 0.8 + 0.4 * Math.sin(1.3 * t + 5 * g[1]); o[2] = 0.5 * Math.cos(1.7 * t + x * 4 + 6 * g[2]); },
  });
}

/** 敦煌 drape：方巾转 45°，中心对着领口，从肩上方 10 cm 落下；摩擦 0.15 让它挂在肩上不滑走 */
function dhDrape() {
  const a = Math.PI / 4;
  return bakeCloth({
    nx: N, ny: N, rest: (i, j) => { const u = (i / (N - 1) - 0.5) * S, v = (j / (N - 1) - 0.5) * S; return [u * Math.cos(a) - v * Math.sin(a), BUST.top + 0.1 + 0.02 * Math.cos(u * 6), (u * Math.sin(a) + v * Math.cos(a)) * 0.98]; },
    t1: 3.0, seed: 12, damping: 2.2, bend: 0.12, friction: 0.15, thickness: 0.005,
    colliders: [...BUST_COLLIDERS, { type: 'ground', y: 0 }],
  });
}

export const SIMS = { dunhuang: { fly: dhFly, drape: dhDrape }, songjin: {}, qinghua: {}, yunhe: {} };
export function bakeFor(scarf) { return Object.fromEntries(Object.entries(SIMS[scarf]).map(([k, f]) => [k, f()])); }
