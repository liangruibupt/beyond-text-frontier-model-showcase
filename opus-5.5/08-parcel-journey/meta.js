// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、沿对角线的工位、一镜到底的机位、文件命名
// 120 bpm，一小节 2 秒；命中点都落在 0.5 秒（一拍）的网格上
import { ITEM_IDS } from './items.js';

export const BAR = 2.0, GRID = 0.5;
export const SHOTS = ['order', 'robots', 'pack', 'sort', 'truck', 'lastmile', 'door'];
// 镜头内部的事件（镜头本地秒）：下单点下（order 1.0）、机械臂取货（robots 本地 2.5，成片 4.0）、
// 面单贴上（pack 本地 1.5，成片 6.5）、摆轮拨进道口（sort 本地 1.0，成片 8.0）、卡车发车（truck 本地 0.5，成片 9.5）、
// 敲门（door 本地 0 的那一拍，成片 13.0）、品牌动机（door 本地 0.5，成片 13.5）
export const EV = { tap: 1.0, pick: 2.5, label: 1.5, divert: 1.0, depart: 0.5 };

// §C 剪辑表（照分镜，逐字）
export const CUTS = {
  15: {
    shots: [
      { shot: 'order', dur: 1.5 }, { shot: 'robots', dur: 3.5 }, { shot: 'pack', dur: 2.0 },
      { shot: 'sort', dur: 2.0 }, { shot: 'truck', dur: 2.0 }, { shot: 'lastmile', dur: 2.0 },
      { shot: 'door', dur: 2.0 },
    ],
    hits: { tap: 1.0, pick: 4.0, label: 6.5, divert: 8.0, depart: 9.5, knock: 13.0, logo: 13.5 }, cover: 4.2,
  },
  6: {
    shots: [
      { shot: 'order', dur: 1.0, from: 0.5 },                                            // 0.5 点下单
      { shot: 'sort', dur: 1.5, from: 0.5, transition: { type: 'flash', dur: 0.2 } },     // 1.5 拨进道口
      { shot: 'door', dur: 3.5, transition: { type: 'flash', dur: 0.2 } },                // 2.5 敲门，3.0 价签
    ],
    hits: { tap: 0.5, divert: 1.5, knock: 2.5, logo: 3.0 }, cover: 4.6,
  },
};

// ── 一镜到底的世界：八个工位沿一条对角线依次摆开（米，世界坐标；+x 向右、+z 朝相机、y 向上） ──
// 手机 → 仓库 → 打包台 → 分拣线 → 月台 → 公路 → 街区 → 门口。相邻两段的机位首尾相接。
// 用长焦（fov≈10°）等距方向冒充正交。每个工位给一个中心点，镜头绕它取景。
export const STATIONS = {
  phone: [0.0, 0.0, 0.0],
  warehouse: [1.6, 0.0, -0.9],
  pack: [3.0, 0.0, -1.7],
  sorter: [4.4, 0.0, -2.5],
  dock: [5.8, 0.0, -3.3],
  road: [7.2, 0.0, -4.1],
  street: [8.6, 0.0, -4.9],
  door: [9.6, 0.0, -5.5],
};

// 等距方向（长焦冒充正交）：相机从这个方向看向工位中心
export const ISO_DIR = [0.9, 0.78, 1.0];
export const FOV = 10;
const D = Math.PI / 180;

/** 工位中心 + 等距方向 × 距离 dist 得到机位；dist 决定取景大小（长焦，距离大） */
function poseAt(station, { dist = 9, lift = 0, aim = [0, 0.18, 0], look = [0, 0, 0] } = {}) {
  const c = STATIONS[station], n = Math.hypot(...ISO_DIR), u = ISO_DIR.map(x => x / n);
  return {
    position: [c[0] + u[0] * dist + look[0], c[1] + u[1] * dist + lift, c[2] + u[2] * dist + look[2]],
    target: [c[0] + aim[0], c[1] + aim[1], c[2] + aim[2]],
  };
}

// 每个镜头的首尾机位（free）：end 的工位 = 下一镜头 start 的工位，连起来是一路往前推的连续镜头。
// dist 越小越近；镜头内部按进度 u 在 a→b 之间缓动插值（framing.js 的 blend 两个 free 意图）。
export const RIG = {
  order: { a: { station: 'phone', dist: 6.5, aim: [0, 0.22, 0] }, b: { station: 'warehouse', dist: 11, aim: [0, 0.3, 0] } },
  robots: { a: { station: 'warehouse', dist: 11, aim: [0, 0.3, 0] }, b: { station: 'pack', dist: 9, aim: [0, 0.35, 0] } },
  pack: { a: { station: 'pack', dist: 9, aim: [0, 0.35, 0] }, b: { station: 'sorter', dist: 9, aim: [0, 0.35, 0] } },
  sort: { a: { station: 'sorter', dist: 9, aim: [0, 0.35, 0] }, b: { station: 'dock', dist: 9.5, aim: [0, 0.4, 0] } },
  truck: { a: { station: 'dock', dist: 9.5, aim: [0, 0.4, 0] }, b: { station: 'road', dist: 11, aim: [0, 0.5, 0] } },
  lastmile: { a: { station: 'road', dist: 11, aim: [0, 0.5, 0] }, b: { station: 'street', dist: 8.5, aim: [0, 0.4, 0] } },
  door: { a: { station: 'street', dist: 8.5, aim: [0, 0.4, 0] }, b: { station: 'door', dist: 7, aim: [0, 0.45, 0] } },
};

/** 镜头进度 u（0–1，已缓动）时的 free 机位意图 {position, target}；a→b 线性插值 */
export function poseFor(name, u) {
  const r = RIG[name], a = poseAt(r.a.station, r.a), b = poseAt(r.b.station, r.b);
  const L = (x, y) => x.map((v, i) => v + (y[i] - v) * u);
  return { position: L(a.position, b.position), target: L(a.target, b.target) };
}

export const META = {
  id: '08-parcel-journey',
  axes: { item: ITEM_IDS, lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['item'],
  cuts: CUTS,
  fileName: v => `youji-parcel_${v.item}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
