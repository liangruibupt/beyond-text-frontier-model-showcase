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

// ── 青花：明代青花的程式——白地钴蓝，先用深青勾线、再用淡青"分水"平涂（两层青）；
//    方巾：外沿回纹带 → 莲瓣纹带 → 主区缠枝莲（一条连绵的主藤绕中心一圈，四个对角上是侧开的大莲花，藤上卷叶、卷须、花苞）→ 中心一朵俯视团莲 ──
const QH = { di: '#f5f3ec', line: '#162a66', wash: '#2a4f9e', pale: '#8ea6d4' };
/** 勾线 + 分水：path 是一个只描路径的函数 */
function qhShape(g, path, { fill = QH.wash, lw = 2.2, alpha = 1 } = {}) {
  g.save(); g.globalAlpha = alpha; path(); g.fillStyle = fill; g.fill(); g.restore();
  path(); g.strokeStyle = QH.line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
}
/** 尖叶，叶尖往一侧卷（缠枝莲的卷叶）：从 (x, y) 沿 ang 长 len */
function qhLeaf(g, x, y, len, ang, curl = 1, lw = 2) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const w = len * 0.28;
  qhShape(g, () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.3, -w * 1.2, len * 0.75, -w * 0.9 * curl, len, -w * 0.2 * curl); g.bezierCurveTo(len * 0.8, w * 0.2, len * 0.35, w * 0.9, 0, 0); }, { fill: QH.pale, lw });
  g.beginPath(); g.moveTo(len * 0.08, 0); g.quadraticCurveTo(len * 0.5, -w * 0.15, len * 0.9, -w * 0.25 * curl); g.strokeStyle = QH.line; g.lineWidth = lw * 0.6; g.stroke();
  g.restore();
}
/** 侧开的莲花（五瓣：中间高、两侧一对外翻），s 是花高 */
function qhLotus(g, x, y, s, ang = 0, lw = 2.4) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const petal = (ox, rot, h, w) => qhShape(g, () => { g.beginPath(); g.save(); g.translate(ox, 0); g.rotate(rot); g.moveTo(-w, 0); g.bezierCurveTo(-w * 1.15, -h * 0.55, -w * 0.35, -h * 0.9, 0, -h); g.bezierCurveTo(w * 0.35, -h * 0.9, w * 1.15, -h * 0.55, w, 0); g.closePath(); g.restore(); }, { lw });
  petal(-s * 0.3, -0.75, s * 0.62, s * 0.2); petal(s * 0.3, 0.75, s * 0.62, s * 0.2);      // 外翻的一对
  petal(-s * 0.16, -0.32, s * 0.85, s * 0.2); petal(s * 0.16, 0.32, s * 0.85, s * 0.2);    // 里面一对
  petal(0, 0, s, s * 0.22);                                                                // 正中
  // 花托与莲蓬：一道弧 + 几个点
  qhShape(g, () => { g.beginPath(); g.ellipse(0, s * 0.04, s * 0.34, s * 0.11, 0, 0, TAU); }, { fill: QH.wash, lw });
  g.fillStyle = QH.di; for (const k of [-2, -1, 0, 1, 2]) { g.beginPath(); g.arc(k * s * 0.11, s * 0.035, s * 0.025, 0, TAU); g.fill(); }
  // 瓣上的脉：每瓣两道细线
  g.strokeStyle = QH.line; g.lineWidth = lw * 0.5;
  for (const [ox, rot, h] of [[0, 0, s], [-s * 0.16, -0.32, s * 0.85], [s * 0.16, 0.32, s * 0.85]]) { g.save(); g.translate(ox, 0); g.rotate(rot); for (const d of [-0.07, 0.07]) { g.beginPath(); g.moveTo(d * s, -h * 0.12); g.quadraticCurveTo(d * s * 1.4, -h * 0.5, d * s * 0.3, -h * 0.8); g.stroke(); } g.restore(); }
  g.restore();
}
/** 俯视团莲：两圈各 8 瓣 + 莲蓬 */
function qhRosette(g, x, y, r, lw = 2.4) {
  g.save(); g.translate(x, y);
  for (const [rr, off, w] of [[r, 0, 0.42], [r * 0.68, TAU / 16, 0.4]]) for (let q = 0; q < 8; q++) {
    g.save(); g.rotate(off + (q / 8) * TAU);
    qhShape(g, () => { g.beginPath(); g.moveTo(0, -rr * 0.28); g.bezierCurveTo(-rr * w, -rr * 0.45, -rr * w * 0.7, -rr * 0.95, 0, -rr); g.bezierCurveTo(rr * w * 0.7, -rr * 0.95, rr * w, -rr * 0.45, 0, -rr * 0.28); }, { fill: rr === r ? QH.wash : QH.pale, lw });
    g.restore();
  }
  qhShape(g, () => { g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); }, { fill: QH.wash, lw });
  g.fillStyle = QH.di; for (let q = 0; q < 7; q++) { const a = (q / 7) * TAU; g.beginPath(); g.arc(Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17, r * 0.045, 0, TAU); g.fill(); } g.beginPath(); g.arc(0, 0, r * 0.045, 0, TAU); g.fill();
  g.restore();
}
/** 卷须：一小段螺旋 */
function qhTendril(g, x, y, r, ang, dir = 1, lw = 1.6) {
  g.beginPath(); g.strokeStyle = QH.line; g.lineWidth = lw;
  for (let q = 0; q <= 40; q++) { const t = q / 40, a = ang + dir * t * TAU * 1.3, rr = r * (1 - t * 0.85); const px = x + Math.cos(ang) * r * t * 1.2 + Math.cos(a) * rr * t, py = y + Math.sin(ang) * r * t * 1.2 + Math.sin(a) * rr * t; q ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
}
/** 回纹带：沿 (x0, y0) 往 +x 排 count 个回字，每个边长 u */
function qhHui(g, x0, y0, u, count, lw) {
  const hui = [[0, 1], [0, 0], [1, 0], [1, 0.78], [0.24, 0.78], [0.24, 0.24], [0.76, 0.24], [0.76, 0.52], [0.48, 0.52]];
  g.strokeStyle = QH.line; g.lineWidth = lw; g.lineCap = 'square';
  for (let q = 0; q < count; q++) { const ox = x0 + q * u, s = u * 0.82; g.beginPath(); hui.forEach(([a, c], z) => (z ? g.lineTo : g.moveTo).call(g, ox + a * s, y0 + c * s)); g.stroke(); g.beginPath(); g.moveTo(ox, y0 + s); g.lineTo(ox + u, y0 + s); g.stroke(); }
}
/** 莲瓣纹带：一排拱形的瓣，瓣里双勾一道、填淡青，瓣心一点如意 */
function qhPanels(g, x0, y0, w, h, count, up = true, lw = 2) {
  const pw = w / count;
  for (let q = 0; q < count; q++) {
    const cx = x0 + (q + 0.5) * pw, base = up ? y0 + h : y0, tip = up ? y0 : y0 + h, sg = up ? -1 : 1;
    const arch = k => () => { g.beginPath(); g.moveTo(cx - pw * 0.46 * k, base); g.bezierCurveTo(cx - pw * 0.5 * k, base + sg * h * 0.7 * k, cx - pw * 0.12 * k, tip + (base - tip) * (1 - k), cx, tip + (base - tip) * (1 - k) * 0.4); g.bezierCurveTo(cx + pw * 0.12 * k, tip + (base - tip) * (1 - k), cx + pw * 0.5 * k, base + sg * h * 0.7 * k, cx + pw * 0.46 * k, base); };
    qhShape(g, arch(1), { fill: QH.di, lw });
    qhShape(g, arch(0.72), { fill: QH.pale, lw: lw * 0.7 });
    qhShape(g, () => { g.beginPath(); g.arc(cx, base + sg * h * 0.35, pw * 0.09, 0, TAU); }, { fill: QH.wash, lw: lw * 0.6 });
  }
}
function chanzhi(g, S, colors, rng) {
  g.fillStyle = QH.di; g.fillRect(0, 0, S, S);
  const lw = S / 420;
  // 外沿：一道深青边，回纹带，再一道细线
  g.fillStyle = QH.line; g.fillRect(0, 0, S, S * 0.012); g.fillRect(0, S * 0.988, S, S * 0.012); g.fillRect(0, 0, S * 0.012, S); g.fillRect(S * 0.988, 0, S * 0.012, S);
  const e0 = S * 0.022, e1 = S * 0.066, u = (e1 - e0) * 0.8, count = Math.floor((S - 2 * e1) / u), hx = (S - count * u) / 2;
  for (let side = 0; side < 4; side++) {
    g.save(); g.translate(S / 2, S / 2); g.rotate(side * TAU / 4); g.translate(-S / 2, -S / 2);
    qhHui(g, hx, e0 + ((e1 - e0) - u) / 2, u, count, lw * 1.1);
    g.fillStyle = QH.line; g.fillRect(e0, e1 + S * 0.004, S - 2 * e0, lw * 1.4);
    // 莲瓣带（瓣尖朝里）
    qhPanels(g, S * 0.1, e1 + S * 0.012, S * 0.8, S * 0.07, 14, false, lw);
    g.fillRect(S * 0.1, e1 + S * 0.088, S * 0.8, lw * 1.2);
    g.restore();
  }
  // 四角：一朵团莲（莲瓣带在角上断开的地方）
  for (const [x, y] of [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]) qhRosette(g, S * (x - 0.012 * Math.sign(x - 0.5)), S * (y - 0.012 * Math.sign(y - 0.5)), S * 0.036, lw);
  // 主藤：绕中心一圈，半径随角度起伏（四个对角最外、四个正方向最里），画成一条粗细变化的深青线
  const c = S / 2, R0 = S * 0.26, vine = a => { const r = R0 * (1 + 0.16 * Math.cos(4 * (a - Math.PI / 4))) + S * 0.012 * Math.sin(12 * a); return [c + Math.cos(a) * r, c + Math.sin(a) * r]; };
  g.strokeStyle = QH.line; g.lineCap = 'round';
  for (let q = 0; q < 720; q++) { const a0 = (q / 720) * TAU, a1 = ((q + 1) / 720) * TAU, [x0, y0] = vine(a0), [x1, y1] = vine(a1); g.lineWidth = lw * (2.4 + 0.8 * Math.sin(8 * a0)); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  // 藤上的卷叶与卷须：每 1/16 圈一片叶，交替朝外 / 朝里；叶旁一根卷须
  for (let q = 0; q < 32; q++) {
    const a = (q / 32) * TAU + 0.08, [x, y] = vine(a), out = q % 2 ? 1 : -1, nrm = a + (out > 0 ? 0 : Math.PI);
    if (q % 8 === 3 || q % 8 === 4) continue;                                   // 对角处让给大莲花
    qhLeaf(g, x, y, S * (0.06 + 0.012 * rng()), nrm + out * 0.5 + 0.25 * (rng() - 0.5), out, lw);
    if (q % 4 === 1) qhTendril(g, x, y, S * 0.025, nrm - out * 0.8, out, lw * 0.8);
  }
  // 四个对角：侧开大莲花，花梗从藤上分出来；四个正方向：花苞
  for (let q = 0; q < 4; q++) {
    const a = Math.PI / 4 + (q / 4) * TAU, [x, y] = vine(a), outward = a + Math.PI / 2;
    const fx = x + Math.cos(a) * S * 0.06, fy = y + Math.sin(a) * S * 0.06;
    g.strokeStyle = QH.line; g.lineWidth = lw * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * S * 0.04, y + Math.sin(a + 0.5) * S * 0.04, fx, fy); g.stroke();
    qhLeaf(g, fx, fy, S * 0.075, a + 1.9, 1, lw); qhLeaf(g, fx, fy, S * 0.075, a - 1.9, -1, lw);
    qhLotus(g, fx, fy, S * 0.11, outward, lw * 1.1);
    const b = (q / 4) * TAU, [bx, by] = vine(b);
    qhShape(g, () => { g.save(); g.translate(bx, by); g.rotate(b + Math.PI / 2); g.beginPath(); g.moveTo(-S * 0.018, 0); g.bezierCurveTo(-S * 0.03, -S * 0.04, -S * 0.006, -S * 0.06, 0, -S * 0.066); g.bezierCurveTo(S * 0.006, -S * 0.06, S * 0.03, -S * 0.04, S * 0.018, 0); g.closePath(); g.restore(); }, { lw });
  }
  // 中心：双圈 + 团莲 + 一圈小叶
  for (const [r, w] of [[S * 0.14, lw * 2.2], [S * 0.128, lw]]) { g.beginPath(); g.arc(c, c, r, 0, TAU); g.strokeStyle = QH.line; g.lineWidth = w; g.stroke(); }
  for (let q = 0; q < 12; q++) { const a = (q / 12) * TAU; qhLeaf(g, c + Math.cos(a) * S * 0.08, c + Math.sin(a) * S * 0.08, S * 0.04, a + 0.6, 1, lw * 0.9); }
  qhRosette(g, c, c, S * 0.075, lw * 1.1);
}

/** 梅瓶的青花（车床网格的 uv：u 绕瓶一圈，v = 高度 / 瓶高）：口沿回纹 → 肩上如意云肩 → 腹部缠枝莲（绕瓶三组）→ 胫部莲瓣。
 *  W × H 的画布，v 从下往上（画布 y 从上往下 = 1 − v）。reveal：0..0.25 画口沿和云肩，0.25..0.85 腹部的缠枝沿 u 一笔笔画过去，0.85..1 莲瓣 */
export function drawVase(g, W, H, reveal = 1) {
  const y = v => (1 - v) * H, lw = H / 300, rng = mulberry32(5);
  g.fillStyle = QH.di; g.fillRect(0, 0, W, H);
  const band = (v0, v1, k, draw) => { if (reveal <= k[0]) return; g.save(); g.beginPath(); g.rect(0, y(v1), W * Math.min(1, (reveal - k[0]) / (k[1] - k[0])), y(v0) - y(v1)); g.clip(); draw(); g.restore(); };
  const line = v => { g.fillStyle = QH.line; g.fillRect(0, y(v) - lw, W, lw * 2); };
  // 口沿：回纹（v 0.9–0.98）
  band(0.86, 1, [0, 0.12], () => { line(0.98); line(0.9); const u = (y(0.9) - y(0.98)) * 0.86; qhHui(g, 0, y(0.98) + (y(0.9) - y(0.98) - u) / 2, u, Math.ceil(W / u), lw * 1.2); });
  // 肩：如意云肩（四个下垂的如意头，里面一朵团莲），v 0.66–0.88
  band(0.64, 0.9, [0.12, 0.25], () => {
    line(0.88);
    for (let q = 0; q < 4; q++) {
      const cx = (q + 0.5) * W / 4, hw = W / 8 * 0.9, top = y(0.88), bot = y(0.66);
      qhShape(g, () => { g.beginPath(); g.moveTo(cx - hw, top); g.bezierCurveTo(cx - hw, top + (bot - top) * 0.5, cx - hw * 0.5, bot - (bot - top) * 0.15, cx - hw * 0.25, bot - (bot - top) * 0.1); g.arc(cx, bot - (bot - top) * 0.12, hw * 0.25, Math.PI, 0, true); g.bezierCurveTo(cx + hw * 0.5, bot - (bot - top) * 0.15, cx + hw, top + (bot - top) * 0.5, cx + hw, top); g.closePath(); }, { fill: QH.pale, lw: lw * 1.4 });
      qhRosette(g, cx, top + (bot - top) * 0.45, (bot - top) * 0.28, lw);
      for (const sg of [-1, 1]) qhLeaf(g, cx + sg * hw * 0.55, top + (bot - top) * 0.35, (bot - top) * 0.3, sg > 0 ? -0.6 : Math.PI + 0.6, sg, lw);
    }
  });
  // 腹：缠枝莲，主藤沿 u 起伏，三朵大莲花
  band(0.18, 0.64, [0.25, 0.85], () => {
    line(0.62); line(0.2);
    const vy = u => y(0.41 + 0.12 * Math.sin(u * TAU * 3));
    g.strokeStyle = QH.line; g.lineCap = 'round';
    for (let q = 0; q < 600; q++) { const u0 = q / 600, u1 = (q + 1) / 600; g.lineWidth = lw * (2.6 + 0.8 * Math.sin(u0 * TAU * 9)); g.beginPath(); g.moveTo(u0 * W, vy(u0)); g.lineTo(u1 * W, vy(u1)); g.stroke(); }
    for (let q = 0; q < 24; q++) { const u = (q + 0.5) / 24; if (q % 8 === 1) continue; const up = q % 2 ? 1 : -1; qhLeaf(g, u * W, vy(u), H * (0.07 + 0.015 * rng()), up > 0 ? -1.1 : 1.1, up, lw); if (q % 4 === 3) qhTendril(g, u * W, vy(u), H * 0.03, up > 0 ? 0.8 : -0.8, up, lw * 0.8); }
    for (let q = 0; q < 3; q++) { const u = (q + 0.5 / 3 + 0.083) / 3, top = q % 2 === 0; const fx = u * W, fy = vy(u) + (top ? -1 : 1) * H * 0.02; qhLeaf(g, fx, fy, H * 0.09, 2.6, 1, lw); qhLeaf(g, fx, fy, H * 0.09, 0.5, -1, lw); qhLotus(g, fx, fy + H * 0.03, H * 0.15, 0, lw * 1.2); }
  });
  // 胫：莲瓣（瓣尖朝上），v 0.03–0.17
  band(0, 0.18, [0.85, 1], () => { line(0.17); line(0.02); qhPanels(g, 0, y(0.16), W, y(0.03) - y(0.16), 12, true, lw * 1.2); });
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
