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
