// fold.js — 闭式折叠：平铺的方巾沿三条折线依次对折（宋锦 sj_fold、片尾礼盒里叠好的丝巾）
// 每一折是绕折线的刚体旋转：折线一侧的顶点绕它转 angle，另一侧不动；角度 0..π，前一折做完下一折才开始。只由 (u, 平铺状态) 决定
// 折线（方巾本地坐标，边长 1，中心为原点）：先左右对折（x = 0），再前后对折（z = 0），再左右对折（x = 0.25 半边上的 x = -0.25 → 折后的宽度一半）
import { SCARF } from '../meta.js';
import { ss } from '../../factory/engine/ease.js';

const LINES = [
  { axis: 'z', at: 0, side: 1 },      // x > 0 的半边绕 z 轴方向的折线（x = 0）翻到左边
  { axis: 'x', at: 0, side: 1 },      // z > 0 的半边绕 x 方向的折线（z = 0）翻到后面
  { axis: 'z', at: -0.25, side: -1 }, // 左右对折后布在 x ∈ [-0.5, 0]：x < -0.25 的那一半再翻到右边 → x ∈ [-0.25, 0]
];
const LIFT = 0.0012;                  // 每折一层抬高一点：叠起来的布不互相穿过

/** n×n 顶点、平铺在 y = y0 的方巾，按折叠进度 u（0..1，三折依次）写进 pos；scale 是边长（米） */
export function foldInto(pos, n, u, { y0 = 0, c = [0, 0, 0], size = SCARF.size } = {}) {
  const prog = LINES.map((_, k) => ss(k / 3, (k + 1) / 3, u));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let x = i / (n - 1) - 0.5, z = j / (n - 1) - 0.5, y = 0;
    LINES.forEach((L, k) => {
      const a = Math.PI * prog[k]; if (a === 0) return;
      const d = L.axis === 'z' ? x - L.at : z - L.at;
      if (d * L.side <= 0) return;
      // 绕折线转 a：在 (d, y) 平面里旋转，再加一层厚度
      const r = Math.abs(d), nd = L.side * r * Math.cos(a), ny = y + r * Math.sin(a) + LIFT * (k + 1) * Math.sin(a / 2) ** 2 / size;
      if (L.axis === 'z') x = L.at + nd; else z = L.at + nd;
      y = ny;
    });
    const v = (j * n + i) * 3;
    pos[v] = c[0] + x * size; pos[v + 1] = c[1] + y0 + y * size; pos[v + 2] = c[2] + z * size;
  }
}
