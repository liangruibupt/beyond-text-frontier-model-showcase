// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、文件命名
// 120 bpm，一拍 0.5 秒、一小节 2 秒；命中点都落在 0.5 秒的网格上（分镜 §B / §C，逐字照搬）
import { ITEM_IDS } from './items.js';
import { LAYOUTS } from './layouts.js';

export const BAR = 2.0, BEAT = 0.5, GRID = 0.5;
export const SHOTS = ['room', 'count', 'cart', 'rain', 'stock', 'end'];

// §C 剪辑表（照分镜，逐字）
export const CUTS = {
  15: {
    shots: [
      { shot: 'room', dur: 2.5 }, { shot: 'count', dur: 2.5 }, { shot: 'cart', dur: 2.5 },
      { shot: 'rain', dur: 3.0 }, { shot: 'stock', dur: 2.0 },
      { shot: 'end', dur: 2.5, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { live: 0.5, n3: 3.0, n2: 3.5, n1: 4.0, link: 4.5, cart: 5.0, tap: 6.5, rain: 8.0, open: 9.5, soldout: 12.0, logo: 12.5 },
    cover: 6.6,
  },
  6: {
    shots: [
      { shot: 'count', dur: 2.0, from: 0.5 },                                            // 0 / 0.5 / 1.0 数字，1.5 上链接
      { shot: 'rain', dur: 1.0, from: 1.5, transition: { type: 'flash', dur: 0.15 } },    // 2.0 拆红包
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { n3: 0, n2: 0.5, n1: 1.0, link: 1.5, open: 2.0, logo: 3.0 },
    cover: 4.5,
  },
};

// 各镜头在 15 秒版里的天然时长与起点：镜头本地时间按这个算（6 秒版从中段切入也落在同一帧）
export const NATURAL = Object.fromEntries(CUTS[15].shots.map(e => [e.shot, e.dur]));
export const STORY0 = (() => { let t = 0; const o = {}; for (const e of CUTS[15].shots) { o[e.shot] = t; t += e.dur; } return o; })();
export const storyT = (name, lt) => STORY0[name] + lt;

/** 镜头用：按比例取构图表 */
export const rowsFor = ar => LAYOUTS[ar] ?? {};

export const META = {
  id: '10-live-flash-sale',
  axes: { item: ITEM_IDS, lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['item'],   // 换商品才重建场景（转台模型、弹窗小图、背景主色）；其余轴即时切换
  cuts: CUTS,
  fileName: v => `youji-live_${v.item}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
