// pattern.js — 四款纹样：在 Canvas 2D 上用纯函数画出方巾的纹理（带种子的随机，同一款每次逐像素相同）
// 方巾 90 cm 见方，纹理 1024²；每款都有：外框（边缘的滚边色带）+ 主纹样。reveal 0..1 控制纹样显出的进度（宋锦逐行织出、青花逐笔画出）
//   zaojing 敦煌藻井：方井套叠，中心莲花，四角团花，石青 / 土红 / 赭金
//   badayun 宋锦八达晕：八角与方格交织的几何锦纹，靛蓝地金线
//   chanzhi 青花缠枝莲：白地，钴蓝的缠枝卷草与莲花
//   yunhe   云鹤：朱红地，月白云纹与几只仙鹤
import { mulberry32 } from '../../factory/engine/rng.js';

const TAU = Math.PI * 2;

/** 画一款纹样到 ctx2d（S × S）。kind / colors 来自 scarves.js 的 pattern；reveal 用于逐行 / 逐笔出现 */
export function drawPattern(g, S, { kind, colors }, { seed = 1, reveal = 1 } = {}) {
  const rng = mulberry32(seed);
  g.save();
  ({ zaojing, badayun, chanzhi, yunhe })[kind](g, S, colors, rng, reveal);
  g.restore();
}

function border(g, S, outer, inner, w = 0.045) {
  g.fillStyle = outer; g.fillRect(0, 0, S, S);
  g.fillStyle = inner; g.fillRect(S * w, S * w, S * (1 - 2 * w), S * (1 - 2 * w));
}
function petals(g, x, y, r, n, fill, rot = 0, k = 0.42) {
  g.fillStyle = fill;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * k * 0.5, a, 0, TAU);
    g.fill();
  }
}

// ── 敦煌藻井：一层层转 45° 的方井，中心一朵八瓣莲，四角团花；方井之间是连珠纹 ──
function zaojing(g, S, [qing, hong, jin, di, mo], rng) {
  border(g, S, hong, di);
  const c = S / 2;
  g.translate(c, c);
  const layers = [[0.43, qing], [0.36, jin], [0.3, hong], [0.24, qing], [0.18, di]];
  layers.forEach(([r, col], i) => {
    g.save(); g.rotate(i % 2 ? Math.PI / 4 : 0);
    g.fillStyle = col; g.fillRect(-S * r, -S * r, S * r * 2, S * r * 2);
    g.strokeStyle = mo; g.lineWidth = S * 0.003; g.strokeRect(-S * r, -S * r, S * r * 2, S * r * 2);
    // 连珠：沿方井边一圈小圆
    g.fillStyle = i % 2 ? di : jin;
    const n = 28 - i * 3;
    for (let k = 0; k < n * 4; k++) {
      const side = Math.floor(k / n), t = (k % n + 0.5) / n * 2 - 1, d = S * (r - 0.012);
      const [x, y] = [[t * d, -d], [d, t * d], [-t * d, d], [-d, -t * d]][side];
      g.beginPath(); g.arc(x, y, S * 0.0045, 0, TAU); g.fill();
    }
    g.restore();
  });
  petals(g, 0, 0, S * 0.15, 8, hong, Math.PI / 8, 0.5);
  petals(g, 0, 0, S * 0.1, 8, jin, 0, 0.5);
  g.fillStyle = qing; g.beginPath(); g.arc(0, 0, S * 0.035, 0, TAU); g.fill();
  // 四角团花
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = x * S * 0.42, py = y * S * 0.42;
    petals(g, px, py, S * 0.05, 6, jin, rng() * TAU, 0.6);
    g.fillStyle = qing; g.beginPath(); g.arc(px, py, S * 0.012, 0, TAU); g.fill();
  }
}

// ── 宋锦八达晕：方格里套八角，八角之间连十字；reveal 控制从上往下织出的行数 ──
function badayun(g, S, [lan, jin, hong, di, lv], rng, reveal) {
  border(g, S, jin, lan, 0.035);
  const n = 6, cell = (S * 0.93) / n, o = S * 0.035;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = o + (i + 0.5) * cell, y = o + (j + 0.5) * cell, r = cell * 0.42;
    g.save(); g.translate(x, y);
    g.strokeStyle = jin; g.lineWidth = cell * 0.035;
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.stroke();
    g.fillStyle = (i + j) % 2 ? hong : lv; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.fill();
    petals(g, 0, 0, r * 0.38, 4, jin, Math.PI / 4, 0.45);
    g.fillStyle = di; g.beginPath(); g.arc(0, 0, r * 0.1, 0, TAU); g.fill();
    g.restore();
    // 格角的十字
    g.fillStyle = jin;
    g.fillRect(o + i * cell - cell * 0.12, o + j * cell - cell * 0.02, cell * 0.24, cell * 0.04);
    g.fillRect(o + i * cell - cell * 0.02, o + j * cell - cell * 0.12, cell * 0.04, cell * 0.24);
  }
  // 细密的经纬：每 4 px 一条半透明的线，像织物
  g.globalAlpha = 0.08; g.fillStyle = di;
  for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
  g.globalAlpha = 1;
  if (reveal < 1) { g.fillStyle = di; g.fillRect(0, S * reveal, S, S * (1 - reveal)); }   // 还没织到的部分：素地
}

// ── 青花缠枝莲：白地，一条主枝绕方巾一圈，枝上长卷叶和莲花；reveal = 主枝画出的比例 ──
function chanzhi(g, S, [bai, qing, shen, dan], rng, reveal) {
  border(g, S, qing, bai, 0.04);
  g.strokeStyle = qing; g.lineWidth = S * 0.006; g.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
  const c = S / 2, N = 360, end = Math.max(1, Math.floor(N * reveal));
  const path = k => { const t = k / N, a = t * TAU * 3, r = S * (0.12 + 0.28 * t); return [c + Math.cos(a) * r, c + Math.sin(a) * r, a]; };
  g.lineCap = 'round'; g.strokeStyle = shen; g.lineWidth = S * 0.007;
  g.beginPath(); for (let k = 0; k <= end; k++) { const [x, y] = path(k); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  for (let k = 12; k <= end; k += 12) {
    const [x, y, a] = path(k), side = (k / 12) % 2 ? 1 : -1, la = a + side * 1.2;
    g.fillStyle = dan; g.beginPath(); g.ellipse(x + Math.cos(la) * S * 0.025, y + Math.sin(la) * S * 0.025, S * 0.026, S * 0.011, la, 0, TAU); g.fill();
    g.strokeStyle = shen; g.lineWidth = S * 0.003; g.beginPath(); g.arc(x + Math.cos(la) * S * 0.04, y + Math.sin(la) * S * 0.04, S * 0.012, la, la + 4); g.stroke();
    if (k % 48 === 0) { petals(g, x, y, S * 0.05, 7, qing, a, 0.55); g.fillStyle = bai; g.beginPath(); g.arc(x, y, S * 0.012, 0, TAU); g.fill(); }
  }
}

// ── 云鹤：朱红地，月白云纹（一组组如意云头）和四只飞鹤 ──
function yunhe(g, S, [zhu, yue, jin, mo], rng) {
  border(g, S, jin, zhu, 0.035);
  const cloud = (x, y, r) => {
    g.fillStyle = yue; g.strokeStyle = jin; g.lineWidth = r * 0.08;
    for (const [dx, dy, k] of [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.7], [0, 0.5, 0.6]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, r * k * 0.55, 0, TAU); g.fill(); g.stroke(); }
  };
  for (let i = 0; i < 26; i++) cloud(S * (0.08 + 0.84 * rng()), S * (0.08 + 0.84 * rng()), S * (0.025 + 0.025 * rng()));
  const crane = (x, y, s, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.fillStyle = yue; g.beginPath(); g.ellipse(0, 0, 40, 12, 0, 0, TAU); g.fill();                                 // 身
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(-20, sgn * 60, 30, sgn * 75); g.quadraticCurveTo(15, sgn * 25, 15, 0); g.fill(); }   // 翅
    g.fillStyle = mo; for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(22, sgn * 62); g.lineTo(30, sgn * 75); g.lineTo(14, sgn * 50); g.fill(); }   // 翅尖黑羽
    g.strokeStyle = yue; g.lineWidth = 5; g.beginPath(); g.moveTo(35, 0); g.quadraticCurveTo(55, -8, 62, -22); g.stroke();   // 颈
    g.fillStyle = zhu; g.beginPath(); g.arc(63, -24, 5, 0, TAU); g.fill();                                            // 丹顶
    g.strokeStyle = mo; g.lineWidth = 3; g.beginPath(); g.moveTo(-38, 0); g.lineTo(-70, 6); g.moveTo(-38, 3); g.lineTo(-70, 12); g.stroke();   // 腿
    g.restore();
  };
  [[0.3, 0.3, -0.3], [0.7, 0.36, 0.4], [0.32, 0.72, 0.2], [0.7, 0.72, -0.5]].forEach(([x, y, r]) => crane(S * x, S * y, S / 900, r));
}
