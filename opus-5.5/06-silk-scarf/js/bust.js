// bust.js — 人台的尺寸与碰撞体（纯数据，Node 测试和布料烘焙共用；网格在 worlds.js 里按同一组尺寸建）
import { BUST } from '../meta.js';
export const CHEST = BUST.top - 0.07;
export const BUST_COLLIDERS = [
  { type: 'capsule', a: [-BUST.shoulder + 0.05, CHEST, 0], b: [BUST.shoulder - 0.05, CHEST, 0], r: 0.058 },
  { type: 'cylinder', c: [0, 0, 0], r: BUST.shoulder * 0.72, y0: BUST.base, y1: CHEST - 0.02 },
  { type: 'cylinder', c: [0, 0, 0], r: BUST.neck + 0.004, y0: CHEST, y1: CHEST + 0.12 },
];
