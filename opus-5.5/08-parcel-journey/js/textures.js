// textures.js — 程序生成的画布贴图（瓦楞纸、面单、水泥、沥青、砖、木、织物），给写实材质用。
// 关键：CanvasTexture 要有 document / canvas 才能建，Node 测试里没有。所以这里全部惰性生成——
// make(key, draw) 在 document 不存在时返回 null（材质就退回纯色），有 document 时按 key 缓存一张贴图。
// 画面只由（变体, t）决定：贴图在 setup 一次性建好，不随帧变；随机只用 rng.js 的确定随机。
import * as THREE from 'three';
import { mulberry32 } from '../../factory/engine/rng.js';

const HAS_DOC = typeof document !== 'undefined';
const _cache = new Map();

/** 建一张 size×size（或 w×h）的 CanvasTexture；Node 里返回 null。draw(ctx, w, h, rng) 画内容。 */
export function make(key, draw, { w = 512, h = w, repeat = [1, 1], aniso = 8, srgb = true } = {}) {
  if (!HAS_DOC) return null;
  if (_cache.has(key)) return _cache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h, mulberry32(hash(key)));
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  if (srgb && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cache.set(key, tex);
  return tex;
}

/** 释放缓存里的贴图（dispose 时调） */
export function disposeTextures() { for (const t of _cache.values()) t?.dispose?.(); _cache.clear(); }

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const jitter = (rng, c, k) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16), d = (rng() - 0.5) * 2 * k; const cl = x => Math.max(0, Math.min(255, Math.round(x + d))); return `rgb(${cl(r)},${cl(g)},${cl(b)})`; };

// ── 瓦楞纸：底色 + 细楞纹（竖向明暗条）+ 稀疏斑点压痕 ──
export const cardboard = (base = '#c79a5e') => make(`card-${base}`, (g, w, h, rng) => {
  // 牛皮纸面：大块的轻微色斑 + 极细的纤维点；楞纹只在纸面下隐约透出（很淡的细横条），不是一道道竖条
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.globalAlpha = 0.04 + rng() * 0.05; g.fillStyle = rng() < 0.5 ? '#6b4a26' : '#e8c99a'; g.beginPath(); g.ellipse(rng() * w, rng() * h, 30 + rng() * 90, 20 + rng() * 60, rng() * 7, 0, 7); g.fill(); }
  g.globalAlpha = 0.035; g.fillStyle = '#000'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);
  for (let i = 0; i < 3000; i++) { g.globalAlpha = rng() * 0.12; g.fillStyle = rng() < 0.5 ? '#4a3218' : '#f3dcb4'; g.fillRect(rng() * w, rng() * h, 1, 1 + rng() * 2); }
  g.globalAlpha = 1;
}, { repeat: [2, 2] });

// ── 面单：白底 + 有集橙抬头 + 条码 + 二维码 + 几行字段 ──
export const waybill = (orange = '#f0820f') => make(`waybill-${orange}`, (g, w, h, rng) => {
  g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#cfc8ba'; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = orange; g.fillRect(8, 8, w - 16, 54);                               // 抬头
  g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'middle'; g.fillText('有集 YOUJI', 20, 36);
  g.fillStyle = '#111'; g.font = '15px sans-serif';
  g.fillText('次日达 · NEXT-DAY', 20, 82);
  // 条码
  let x = 20; g.fillStyle = '#111'; while (x < w - 150) { const bw = 1 + Math.floor(rng() * 4); if (rng() < 0.6) g.fillRect(x, 100, bw, 48); x += bw + 1 + Math.floor(rng() * 3); }
  g.font = '13px monospace'; g.fillText('YJ' + Math.floor(rng() * 1e10).toString().padStart(10, '0'), 20, 162);
  // 二维码（右上角一块伪随机模块）
  const q = 128, m = 21, cell = (q - 8) / m, qx = w - q - 16, qy = 92;
  g.fillStyle = '#fff'; g.fillRect(qx, qy, q, q - 8); g.fillStyle = '#111';
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (rng() < 0.5) g.fillRect(qx + 4 + i * cell, qy + 4 + j * cell, cell + 0.5, cell + 0.5);
  const eye = (ex, ey) => { g.fillStyle = '#111'; g.fillRect(ex, ey, cell * 7, cell * 7); g.fillStyle = '#fff'; g.fillRect(ex + cell, ey + cell, cell * 5, cell * 5); g.fillStyle = '#111'; g.fillRect(ex + cell * 2, ey + cell * 2, cell * 3, cell * 3); };
  eye(qx + 4, qy + 4); eye(qx + 4 + cell * 14, qy + 4); eye(qx + 4, qy + 4 + cell * 14);
  // 字段行
  g.fillStyle = '#333'; g.font = '14px sans-serif';
  for (let i = 0; i < 3; i++) g.fillText(['收 / TO: 1 号院', '寄 / FROM: 有集次日仓', '重 / 1.2kg · 当日分拣'][i], 20, 190 + i * 22);
});

// ── 水泥地：灰底 + 接缝格线 + 污渍 ──
export const concrete = (base = '#b3b8bd') => make(`concrete-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { g.globalAlpha = rng() * 0.08; g.fillStyle = rng() < 0.5 ? '#000' : '#fff'; g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2); }
  g.globalAlpha = 0.5; g.strokeStyle = '#6f767d'; g.lineWidth = 3;                   // 接缝
  for (const p of [0.5]) { g.beginPath(); g.moveTo(p * w, 0); g.lineTo(p * w, h); g.moveTo(0, p * h); g.lineTo(w, p * h); g.stroke(); }
  for (let i = 0; i < 12; i++) { g.globalAlpha = 0.05 + rng() * 0.06; g.fillStyle = '#2a2d31'; g.beginPath(); g.ellipse(rng() * w, rng() * h, 20 + rng() * 60, 14 + rng() * 40, rng() * 7, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}, { repeat: [3, 3] });

// ── 营地草地：墨绿底 + 密密的短草叶（深浅两色）+ 几块裸土 ──
export const grass = (base = '#3f5233') => make(`grass-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { g.globalAlpha = 0.12 + rng() * 0.12; g.fillStyle = '#5a4a32'; g.beginPath(); g.ellipse(rng() * w, rng() * h, 20 + rng() * 50, 12 + rng() * 30, rng() * 7, 0, 7); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 5000; i++) {
    const x = rng() * w, y = rng() * h, L = 3 + rng() * 7, a = -Math.PI / 2 + (rng() - 0.5) * 0.9;
    g.globalAlpha = 0.25 + rng() * 0.4; g.strokeStyle = rng() < 0.5 ? '#2b3a22' : (rng() < 0.6 ? '#62784a' : '#7d8f55'); g.lineWidth = 1 + rng();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  g.globalAlpha = 1;
}, { repeat: [4, 4] });

// ── 帐篷布：涤纶细格纹（ripstop）+ 轻微褶皱明暗 ──
export const ripstop = (base = '#e07a2e') => make(`ripstop-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { const y = rng() * h; const grd = g.createLinearGradient(0, y - 30, 0, y + 30); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, rng() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, y - 30, w, 60); }
  g.globalAlpha = 0.18; g.strokeStyle = '#000'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.globalAlpha = 1;
}, { repeat: [3, 3] });

// ── 手机屏（横放）：深色 App 商品页——顶栏「有集」、中间一张浅色商品卡（商品本身是立在屏上的 3D 小模型）、价格行、
//    左端留给橙色「立即下单」实体按钮的深色底，屏边一圈细黑边。画面是横的：u 沿机身长边 ──
export const phoneUI = (orange = '#f0820f') => make(`phoneui-${orange}`, (g, w, h) => {
  g.fillStyle = '#0d1016'; g.fillRect(0, 0, w, h);
  const x0 = w * 0.03, y0 = h * 0.06, W = w * 0.94, H = h * 0.88;
  const grd = g.createLinearGradient(0, y0, 0, y0 + H); grd.addColorStop(0, '#26303d'); grd.addColorStop(1, '#161b23'); g.fillStyle = grd; g.fillRect(x0, y0, W, H);
  g.fillStyle = '#e9e4da'; g.beginPath(); g.roundRect(w * 0.38, h * 0.14, w * 0.36, h * 0.72, 18); g.fill();   // 商品卡
  g.fillStyle = orange; g.font = `bold ${h * 0.11}px sans-serif`; g.textBaseline = 'middle'; g.fillText('有集', w * 0.8, h * 0.2);
  g.fillStyle = '#c9d1dc'; g.font = `${h * 0.065}px sans-serif`; g.fillText('次日达', w * 0.8, h * 0.33);
  g.fillStyle = '#ff5a3d'; g.font = `bold ${h * 0.12}px sans-serif`; g.fillText('¥', w * 0.8, h * 0.55);
  g.fillStyle = '#8a95a3'; for (let i = 0; i < 3; i++) g.fillRect(w * 0.8, h * (0.68 + i * 0.07), w * (0.14 - i * 0.03), h * 0.025);
  g.fillStyle = '#3a2410'; g.beginPath(); g.roundRect(w * 0.07, h * 0.12, w * 0.12, h * 0.76, 14); g.fill();   // 按钮槽
}, { w: 1024, h: 512 });

// ── 货车厢侧涂装：白底 + 有集橙斜飘带 + 品牌字 ──
export const truckLivery = (orange = '#f0820f') => make(`livery-${orange}`, (g, w, h) => {
  g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
  g.fillStyle = orange; g.beginPath(); g.moveTo(0, h * 0.72); g.bezierCurveTo(w * 0.35, h * 0.55, w * 0.65, h * 0.95, w, h * 0.62); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#d96f08'; g.fillRect(0, h * 0.94, w, h * 0.06);
  g.fillStyle = orange; g.font = `bold ${h * 0.24}px sans-serif`; g.textBaseline = 'middle'; g.fillText('有集', w * 0.08, h * 0.3);
  g.fillStyle = '#2b3038'; g.font = `${h * 0.1}px sans-serif`; g.fillText('YOUJI · 次日达 NEXT-DAY', w * 0.08, h * 0.5);
}, { w: 1024, h: 512 });

// ════ 瑰夏咖啡豆（stories/beans）用的贴图 ════
// ── 冷却盘冲孔钢板：拉丝不锈钢底 + 规则排布的小圆孔（孔里是暗的） ──
export const perforated = () => make('perforated', (g, w, h, rng) => {
  g.fillStyle = '#a9adb2'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) { g.globalAlpha = 0.05 + rng() * 0.05; g.fillStyle = rng() < 0.5 ? '#fff' : '#555'; g.fillRect(0, y, w, 1); }
  g.globalAlpha = 1; g.fillStyle = '#26282b';
  for (let y = 6, r = 0; y < h; y += 12, r++) for (let x = (r % 2) * 6 + 6; x < w; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
}, { repeat: [6, 6] });
// ── 老墙白灰：米白底 + 斑驳水渍 + 墙脚泛黄 ──
export const plaster = (base = '#e9e2d4') => make(`plaster-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { g.globalAlpha = 0.04 + rng() * 0.06; g.fillStyle = rng() < 0.6 ? '#8a7a62' : '#ffffff'; g.beginPath(); g.ellipse(rng() * w, rng() * h, 20 + rng() * 80, 10 + rng() * 50, rng() * 7, 0, 7); g.fill(); }
  const grd = g.createLinearGradient(0, h * 0.75, 0, h); grd.addColorStop(0, 'rgba(120,96,60,0)'); grd.addColorStop(1, 'rgba(120,96,60,0.35)'); g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, h * 0.75, w, h * 0.25);
  for (let i = 0; i < 2000; i++) { g.globalAlpha = rng() * 0.06; g.fillStyle = '#000'; g.fillRect(rng() * w, rng() * h, 1, 1); }
  g.globalAlpha = 1;
}, { repeat: [1, 1] });
// ── 青石板路：大小不一的长条石板 + 深色缝 + 湿润的反光斑 ──
export const stone = (base = '#7d7a73') => make(`stone-${base}`, (g, w, h, rng) => {
  g.fillStyle = '#3a3936'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h;) { const rh = 40 + rng() * 40; for (let x = -rng() * 80; x < w;) { const rw = 70 + rng() * 120; g.fillStyle = jitter(rng, base, 16); g.fillRect(x + 3, y + 3, rw - 6, rh - 6); x += rw; } y += rh; }
  for (let i = 0; i < 30; i++) { g.globalAlpha = 0.05 + rng() * 0.08; g.fillStyle = rng() < 0.5 ? '#000' : '#cfd3d6'; g.beginPath(); g.ellipse(rng() * w, rng() * h, 10 + rng() * 40, 6 + rng() * 20, rng() * 7, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}, { repeat: [3, 3] });
// ── 小青瓦屋面：一垄一垄的瓦（亮的瓦脊 + 暗的瓦沟） ──
export const tiles = () => make('tiles', (g, w, h, rng) => {
  for (let x = 0; x < w; x += 16) { const grd = g.createLinearGradient(x, 0, x + 16, 0); grd.addColorStop(0, '#2c3034'); grd.addColorStop(0.5, '#6a7076'); grd.addColorStop(1, '#2c3034'); g.fillStyle = grd; g.fillRect(x, 0, 16, h); }
  g.globalAlpha = 0.35; g.fillStyle = '#1b1d20'; for (let y = 0; y < h; y += 14) g.fillRect(0, y, w, 2);
  for (let i = 0; i < 400; i++) { g.globalAlpha = rng() * 0.1; g.fillStyle = '#9aa0a6'; g.fillRect(rng() * w, rng() * h, 2, 2); }
  g.globalAlpha = 1;
}, { repeat: [4, 2] });
// ── 夜里的暖色地图：深褐底 + 河 + 路网（琥珀细线）+ 城区灯点 ──
export const nightMap = () => make('nightmap', (g, w, h, rng) => {
  const grd = g.createRadialGradient(w * 0.75, h * 0.4, 10, w * 0.6, h * 0.5, w * 0.7); grd.addColorStop(0, '#2a1d14'); grd.addColorStop(1, '#0d0a08'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1d2a36'; g.lineWidth = 18; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(0, h * 0.8); g.bezierCurveTo(w * 0.3, h * 0.6, w * 0.55, h * 0.95, w, h * 0.7); g.stroke();
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) { g.globalAlpha = 0.15 + rng() * 0.3; g.strokeStyle = '#c98a3a'; g.lineWidth = 1 + rng() * 1.5; g.beginPath(); let x = rng() * w, y = rng() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 260; y += (rng() - 0.5) * 160; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 1400; i++) { const cx = w * 0.78, cy = h * 0.38, r = Math.abs((rng() + rng() + rng() - 1.5)) * w * 0.25; const a = rng() * 7; g.globalAlpha = 0.3 + rng() * 0.7; g.fillStyle = rng() < 0.8 ? '#ffcf7a' : '#fff1d0'; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 1.5, 1.5); }
  for (let i = 0; i < 160; i++) { g.globalAlpha = 0.3 + rng() * 0.5; g.fillStyle = '#ffcf7a'; g.fillRect(rng() * w * 0.55, rng() * h, 1.2, 1.2); }
  g.globalAlpha = 1;
}, { w: 2048, h: 1536 });
// ── 夜里城区楼面：深色楼体 + 一格格窗，约三成亮着暖灯（同一张图当 map 和 emissiveMap，只有亮窗发光） ──
export const cityWindows = () => make('citywin', (g, w, h, rng) => {
  g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
  for (let y = 4; y < h - 8; y += 14) for (let x = 4; x < w - 6; x += 10) { const lit = rng() < 0.32; g.fillStyle = lit ? (rng() < 0.7 ? '#ffc56a' : '#fff0c8') : '#0c0907'; g.globalAlpha = lit ? 0.6 + rng() * 0.4 : 1; g.fillRect(x, y, 6, 8); }
  g.globalAlpha = 1;
}, { w: 128, h: 256, repeat: [1, 2] });

// ── 红色圆章：「今日烘焙」/「昨日烘焙」+ 日期线，边缘不匀的印泥 ──
export const stampMark = (text = '今日烘焙') => make(`stamp-${text}`, (g, w, h, rng) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#c0262d'; g.fillStyle = '#c0262d';
  g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w * 0.34, 0, 7); g.stroke();
  g.font = `bold ${w * 0.16}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.slice(0, 2), w / 2, h * 0.4); g.fillText(text.slice(2), w / 2, h * 0.6);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 500; i++) { g.globalAlpha = rng() * 0.6; g.beginPath(); g.arc(rng() * w, rng() * h, 1 + rng() * 3, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}, { w: 256, h: 256 });
// ── 咖啡袋正面的标签：米白纸签 + 有集 + GEISHA + 产地行 ──
export const beanLabel = () => make('beanlabel', (g, w, h) => {
  g.fillStyle = '#f3ede2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f3b35'; g.fillRect(0, 0, w, h * 0.2);
  g.fillStyle = '#e9c46a'; g.font = `bold ${h * 0.11}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('有集 · 瑰夏', w / 2, h * 0.1);
  g.fillStyle = '#1f3b35'; g.font = `bold ${h * 0.16}px serif`; g.fillText('GEISHA', w / 2, h * 0.42);
  g.font = `${h * 0.065}px sans-serif`; g.fillText('PANAMA · WASHED · 250g', w / 2, h * 0.6);
  g.strokeStyle = '#1f3b35'; g.lineWidth = 2; g.strokeRect(w * 0.12, h * 0.72, w * 0.76, h * 0.16);
  g.fillText('烘焙日期 ROASTED ____', w / 2, h * 0.8);
}, { w: 512, h: 512 });

// ════ 电竞耳机（stories/headset）用的贴图：游戏屏 / 手机下单页 / 通知 / 电梯楼层面板 ════
// ── 电竞显示器画面：深色 + 居中大字（DEFEAT 红 / VICTORY 金）+ 边框 HUD 条，用作自发光屏（MeshBasic） ──
export const gameScreen = (word = 'DEFEAT', color = '#ff3b5b') => make(`gamescreen-${word}`, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); grd.addColorStop(0, '#1a1230'); grd.addColorStop(1, '#07060f'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = color; g.globalAlpha = 0.5; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32); g.globalAlpha = 1;
  g.fillStyle = color; g.font = `900 ${h * 0.26}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 24; g.fillText(word, w / 2, h / 2); g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.font = `${h * 0.055}px sans-serif`; g.fillText(word === 'VICTORY' ? 'RANKED · WIN' : 'RANKED · LOSS', w / 2, h * 0.78);
}, { w: 1024, h: 576, repeat: [1, 1] });
// ── 手机下单页：耳机商品页 + 价格 + 「立即下单」橙色按钮 + 底部倒计时条 ──
export const phoneOrder = () => make('phoneorder', (g, w, h) => {
  g.fillStyle = '#0f1220'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1f33'; g.fillRect(0, 0, w, h * 0.08);                                   // 状态栏
  g.fillStyle = '#232a44'; g.fillRect(w * 0.1, h * 0.12, w * 0.8, h * 0.4);                 // 商品图位
  g.fillStyle = '#ff5c8a'; g.font = `bold ${h * 0.05}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('电竞耳机 · PRO', w / 2, h * 0.32);
  g.fillStyle = '#f2eeff'; g.font = `900 ${h * 0.06}px sans-serif`; g.fillText('¥359', w / 2, h * 0.6);
  g.fillStyle = '#ff8a1e'; const by = h * 0.7, bh = h * 0.09; g.fillRect(w * 0.14, by, w * 0.72, bh);
  g.fillStyle = '#1a1020'; g.font = `bold ${h * 0.045}px sans-serif`; g.fillText('立即下单', w / 2, by + bh / 2);
  g.fillStyle = '#38d0ff'; g.font = `${h * 0.035}px sans-serif`; g.fillText('预计 08:30 前送达', w / 2, h * 0.88);
}, { w: 512, h: 1024, repeat: [1, 1] });
// ── 手机通知气泡：「明早 9:00 决赛」 ──
export const phoneNotif = () => make('phonenotif', (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(20,22,34,0.95)'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, w - 16, h - 16, 18) : g.rect(8, 8, w - 16, h - 16); g.fill();
  g.fillStyle = '#ff5c8a'; g.font = `bold ${h * 0.26}px sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('⏰ 赛程提醒', 28, h * 0.34);
  g.fillStyle = '#f2eeff'; g.font = `${h * 0.3}px sans-serif`; g.fillText('明早 9:00 决赛', 28, h * 0.68);
}, { w: 512, h: 200, repeat: [1, 1] });
// ── 电梯楼层面板：深色底 + 发光大数字（静态「23」+ 上行箭头），跳动靠世界里改亮度 ──
export const floorNum = () => make('floornum', (g, w, h) => {
  g.fillStyle = '#06120d'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4affc8'; g.font = `900 ${h * 0.7}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#4affc8'; g.shadowBlur = 20; g.fillText('23', w * 0.6, h * 0.5);
  g.font = `${h * 0.5}px sans-serif`; g.fillText('▲', w * 0.18, h * 0.5); g.shadowBlur = 0;
}, { w: 512, h: 192, repeat: [1, 1] });

// ── 沥青：深灰细颗粒 + 浅色碎石点 ──
export const asphalt = (base = '#3a3e45') => make(`asphalt-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) { g.globalAlpha = rng() * 0.5; const v = 40 + rng() * 90; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 1 + rng() * 1.5); }
  g.globalAlpha = 1;
}, { repeat: [4, 4] });

// ── 砖墙：错缝砖 + 灰缝 ──
export const brick = (base = '#9c5a46', mortar = '#cfc6b8') => make(`brick-${base}`, (g, w, h, rng) => {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  const bw = w / 6, bh = h / 12;
  for (let r = 0; r < 12; r++) { const off = (r % 2) * bw / 2; for (let c = -1; c < 6; c++) { g.fillStyle = jitter(rng, base, 18); g.fillRect(c * bw + off + 3, r * bh + 3, bw - 6, bh - 6); } }
}, { repeat: [2, 2] });

// ── 木纹：暖棕底 + 顺纹深浅条 + 节疤 ──
export const wood = (base = '#9a7350') => make(`wood-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.globalAlpha = 0.06 + rng() * 0.1; g.fillStyle = rng() < 0.5 ? '#5a3f28' : '#c79a6e'; g.fillRect(0, y + Math.sin(y * 0.05) * 2, w, 1.5); }
  g.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { g.strokeStyle = '#4a3320'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(rng() * w, rng() * h, 6 + rng() * 8, 12 + rng() * 14, 0, 0, 7); g.stroke(); }
  g.globalAlpha = 1;
}, { repeat: [2, 1] });

// ── 织物收纳箱：布纹网格 ──
export const fabric = (base = '#8fa3b5') => make(`fabric-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.12; for (let x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? '#fff' : '#000'; g.fillRect(x, 0, 2, h); }
  for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? '#000' : '#fff'; g.fillRect(0, y, w, 2); }
  g.globalAlpha = 1;
}, { repeat: [1, 1] });

// ── 地面二维码格（仓库地面导航码）：灰底 + 规则排布的小二维码块 ──
export const qrFloor = (base = '#9ca3aa') => make(`qrfloor-${base}`, (g, w, h, rng) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const n = 4, pad = w / n * 0.22, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ox = i * s + pad, oy = j * s + pad, q = s - pad * 2, m = 6, cell = q / m;
    g.fillStyle = '#20242a'; for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) if (rng() < 0.5) g.fillRect(ox + a * cell, oy + b * cell, cell + 0.5, cell + 0.5);
  }
}, { repeat: [1, 1] });
