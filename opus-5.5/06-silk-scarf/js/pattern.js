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

// ── 宋锦八达晕：照宋锦的程式画——方格的经纬线（"路"）在每个交点向八个方向放射，交点上是方胜（菱形小窠），
//    格心是八角大窠，窠里一朵宝相花（如意头花瓣，红 → 赭 → 金一层层"晕"开，瓣间夹绿叶，花心联珠）；
//    地子是细密的锦地纹；四边是金边夹红地回纹。reveal 控制从上往下织出的行数 ──
function badayun(g, S, [lan, jin, hong, di, lv], rng, reveal) {
  const n = 4, b = S * 0.08, cell = (S - 2 * b) / n, deep = '#13284c', zhe = '#b45a3a', TAU8 = TAU / 8;
  // 地：靛蓝 + 斜方格锦地（细线）
  g.fillStyle = lan; g.fillRect(0, 0, S, S);
  g.save(); g.beginPath(); g.rect(b, b, S - 2 * b, S - 2 * b); g.clip();
  g.strokeStyle = '#2c4c86'; g.lineWidth = 1.2;
  for (let k = -S; k < S; k += 14) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); }
  // 八达：每个交点向对角放射的金色双线
  const node = i => b + i * cell, ctr = i => b + (i + 0.5) * cell, bw = cell * 0.075;
  g.strokeStyle = jin; g.lineWidth = 2;
  for (let k = -n; k <= n; k++) for (const sgn of [1, -1]) for (const o of [-bw * 0.35, bw * 0.35]) {
    g.beginPath();
    if (sgn > 0) { g.moveTo(node(0) + k * cell + o, node(0)); g.lineTo(node(n) + k * cell + o, node(n)); } else { g.moveTo(node(n) + k * cell + o, node(0)); g.lineTo(node(0) + k * cell + o, node(n)); }
    g.stroke();
  }
  // 经纬两向的"路"：红地金边，中间一串联珠
  const road = (x0, y0, x1, y1) => {
    const horiz = y0 === y1, L = horiz ? x1 - x0 : y1 - y0;
    g.fillStyle = hong; horiz ? g.fillRect(x0, y0 - bw / 2, L, bw) : g.fillRect(x0 - bw / 2, y0, bw, L);
    g.fillStyle = jin; for (const o of [-bw / 2, bw / 2 - 2]) horiz ? g.fillRect(x0, y0 + o, L, 2) : g.fillRect(x0 + o, y0, 2, L);
    g.fillStyle = di; for (let s = bw; s < L; s += bw * 1.15) { g.beginPath(); g.arc(horiz ? x0 + s : x0, horiz ? y0 : y0 + s, bw * 0.2, 0, TAU); g.fill(); }
  };
  for (let i = 0; i <= n; i++) { road(node(0), node(i), node(n), node(i)); road(node(i), node(0), node(i), node(n)); }
  // 如意头花瓣（朝 +x，从 r0 到 r1，半宽 w）：先描金边再填色，内部的描边被填色盖住
  const ruyi = (r0, r1, w, fill, edge, e) => {
    const parts = p => {
      g.beginPath(); g.moveTo(r0, 0); g.quadraticCurveTo(r0 + (r1 - r0) * 0.35, -w, r1 - w * 0.5, -w * 0.85); g.lineTo(r1 - w * 0.5, w * 0.85); g.quadraticCurveTo(r0 + (r1 - r0) * 0.35, w, r0, 0); p();
      for (const [cx, cy, rr] of [[r1 - w * 0.55, -w * 0.5, w * 0.5], [r1 - w * 0.55, w * 0.5, w * 0.5], [r1 - w * 0.3, 0, w * 0.42]]) { g.beginPath(); g.arc(cx, cy, rr, 0, TAU); p(); }
    };
    if (e) { g.strokeStyle = edge; g.lineWidth = e * 2; parts(() => g.stroke()); }
    g.fillStyle = fill; parts(() => g.fill());
  };
  const leaf = (r0, r1, w, fill, edge) => {
    const m = (r0 + r1) / 2; g.beginPath(); g.moveTo(r0, 0); g.quadraticCurveTo(m, -w, r1, 0); g.quadraticCurveTo(m, w, r0, 0);
    g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.moveTo(r0 + (r1 - r0) * 0.15, 0); g.lineTo(r1 - (r1 - r0) * 0.15, 0); g.stroke();   // 叶脉
  };
  const ring = (k, off, f) => { for (let q = 0; q < k; q++) { g.save(); g.rotate(off + (q / k) * TAU); f(); g.restore(); } };
  // 格心：八角大窠 + 宝相花
  const R = cell * 0.4;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    g.save(); g.translate(ctr(i), ctr(j));
    const oct = r => { g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    const gr = g.createRadialGradient ? g.createRadialGradient(0, 0, R * 0.2, 0, 0, R) : null;
    if (gr) { gr.addColorStop(0, '#22437a'); gr.addColorStop(1, deep); }
    oct(R); g.fillStyle = gr ?? deep; g.fill(); g.strokeStyle = jin; g.lineWidth = cell * 0.03; g.stroke();
    oct(R * 0.9); g.lineWidth = 1.5; g.stroke();
    ring(8, TAU / 16, () => leaf(cell * 0.2, cell * 0.37, cell * 0.04, lv, jin));                         // 瓣间绿叶
    ring(8, 0, () => ruyi(cell * 0.07, cell * 0.34, cell * 0.08, hong, jin, 2));                             // 外层如意瓣：红
    ring(8, 0, () => ruyi(cell * 0.09, cell * 0.27, cell * 0.055, zhe, zhe, 0));                             // 晕：赭
    ring(8, 0, () => ruyi(cell * 0.1, cell * 0.2, cell * 0.032, jin, jin, 0));                               // 晕：金
    g.fillStyle = hong; g.beginPath(); g.arc(0, 0, cell * 0.09, 0, TAU); g.fill(); g.strokeStyle = jin; g.lineWidth = 2; g.stroke();
    g.fillStyle = di; ring(12, 0, () => { g.beginPath(); g.arc(cell * 0.068, 0, cell * 0.011, 0, TAU); g.fill(); });   // 花心联珠
    g.fillStyle = jin; g.beginPath(); g.arc(0, 0, cell * 0.04, 0, TAU); g.fill();
    ring(4, TAU8, () => ruyi(cell * 0.004, cell * 0.036, cell * 0.012, hong, hong, 0));
    g.restore();
  }
  // 交点：方胜（菱形小窠）里一朵四瓣小花；"路"的中点：一朵金团花
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    g.save(); g.translate(node(i), node(j));
    const hd = cell * 0.15;
    g.beginPath(); g.moveTo(0, -hd); g.lineTo(hd, 0); g.lineTo(0, hd); g.lineTo(-hd, 0); g.closePath();
    g.fillStyle = lv; g.fill(); g.strokeStyle = jin; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.moveTo(0, -hd * 0.75); g.lineTo(hd * 0.75, 0); g.lineTo(0, hd * 0.75); g.lineTo(-hd * 0.75, 0); g.closePath(); g.lineWidth = 1.2; g.stroke();
    ring(4, TAU8, () => ruyi(cell * 0.015, cell * 0.095, cell * 0.032, hong, jin, 1.5));
    g.fillStyle = jin; g.beginPath(); g.arc(0, 0, cell * 0.022, 0, TAU); g.fill();
    g.restore();
    for (const [x, y] of [[ctr(i), node(j)], [node(i), ctr(j)]]) {
      if (x > S - b || y > S - b) continue;
      g.save(); g.translate(x, y); ring(6, 0, () => ruyi(cell * 0.008, cell * 0.05, cell * 0.018, jin, deep, 1)); g.fillStyle = hong; g.beginPath(); g.arc(0, 0, cell * 0.012, 0, TAU); g.fill(); g.restore();
    }
  }
  g.restore();
  // 边：外圈金边 → 红地金回纹 → 一道金线
  const e0 = S * 0.028, e1 = S * 0.074;
  g.fillStyle = jin; g.fillRect(0, 0, S, e0); g.fillRect(0, S - e0, S, e0); g.fillRect(0, 0, e0, S); g.fillRect(S - e0, 0, e0, S);
  g.fillStyle = hong; g.fillRect(e0, e0, S - 2 * e0, e1 - e0); g.fillRect(e0, S - e1, S - 2 * e0, e1 - e0); g.fillRect(e0, e0, e1 - e0, S - 2 * e0); g.fillRect(S - e1, e0, e1 - e0, S - 2 * e0);
  const u = (e1 - e0) * 0.66, count = Math.floor((S - 2 * e1) / u), x0 = (S - count * u) / 2, y0 = e0 + ((e1 - e0) - u) / 2;
  const hui = [[0, 1], [0, 0], [1, 0], [1, 0.78], [0.24, 0.78], [0.24, 0.24], [0.76, 0.24], [0.76, 0.52], [0.48, 0.52]];   // 一个回字
  g.strokeStyle = jin; g.lineWidth = u * 0.1; g.lineCap = 'square';
  for (let side = 0; side < 4; side++) {
    g.save(); g.translate(S / 2, S / 2); g.rotate(side * TAU / 4); g.translate(-S / 2, -S / 2);
    for (let q = 0; q < count; q++) { const ox = x0 + q * u, s = u * 0.82; g.beginPath(); hui.forEach(([a, c], z) => (z ? g.lineTo : g.moveTo).call(g, ox + a * s, y0 + c * s)); g.stroke(); g.beginPath(); g.moveTo(ox, y0 + s); g.lineTo(ox + u, y0 + s); g.stroke(); }
    g.restore();
  }
  g.fillStyle = jin; g.fillRect(e1, e1, S - 2 * e1, 3); g.fillRect(e1, S - e1 - 3, S - 2 * e1, 3); g.fillRect(e1, e1, 3, S - 2 * e1); g.fillRect(S - e1 - 3, e1, 3, S - 2 * e1);
  // 细密的纬线：每 4 px 一条半透明的线，像织物
  g.globalAlpha = 0.07; g.fillStyle = '#000';
  for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
  g.globalAlpha = 1;
  if (reveal < 1) g.clearRect(0, S * reveal, S, S * (1 - reveal));   // 还没织到的部分：透明（材质 alphaTest 把它裁掉，露出下面的经线）
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
