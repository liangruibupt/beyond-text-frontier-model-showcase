// items.js — 第一轴 item 的三件商品（纯数据，浏览器与 Node 测试共用）
// 品牌「有集 Youji」沿用 04 的虚构购物 App；商品、价格直接取自 04 的 catalog.js（整数，照搬）。
// 每件商品：04 目录里的 id（商品名、价格、one 的叫法从那里来）、建模用的 kind（04 的 product.js，只读引用）、
// 包裹尺寸（米）、门口 / 街区的配色。商品模型用 04 已做好的 lantern / headset / pouch。

import { ITEMS as CATALOG } from '../04-year-review/catalog.js';

// item → { catId（04 目录里的键）, model（product.js 的 kind）, box（纸箱尺寸，米）, street（最后一公里的场景配色） }
// box: [w, h, d] 纸箱外形；lantern 中号纸箱、headset 扁方盒、beans 小号纸箱
// street: wall 墙 / door 门 / ground 地面 / trim 点缀；郊区木门廊 / 城市防盗门 / 老街木格门
export const ITEM_SPEC = {
  lantern: {
    catId: 'od-lantern',
    model: 'lantern',
    box: [0.26, 0.24, 0.26],
    scene: 'suburb',
    street: { wall: '#d8c7a6', door: '#7a4a2a', ground: '#9ba06f', trim: '#f2b233', porch: '#6b4322' },
  },
  headset: {
    catId: 'gm-headset',
    model: 'headset',
    box: [0.34, 0.12, 0.26],
    scene: 'city',
    street: { wall: '#9aa3ad', door: '#3b4654', ground: '#6b7078', trim: '#ff5c8a', porch: '#4a515c' },
  },
  beans: {
    catId: 'cf-geisha',
    model: 'pouch',
    box: [0.2, 0.22, 0.16],
    scene: 'oldstreet',
    street: { wall: '#c9b596', door: '#5a4327', ground: '#8c7a5c', trim: '#e9c46a', porch: '#4a3820' },
  },
  // 咖啡豆 AI 变体：和 beans 同一条故事线（分镜、剪辑表、字幕、配音、配乐、价格都不变），
  // 只是画面改用 LTX 生成的实拍片段当底图。base: 'beans' 让所有「只看故事」的数据沿用 beans
  // （目录、配音文件名、配乐、剪辑表、构图），文件名则保留 beans-ai 以便和代码版并存不覆盖。
  'beans-ai': {
    base: 'beans',
    ai: true,
    catId: 'cf-geisha',
    model: 'pouch',
    box: [0.2, 0.22, 0.16],
    scene: 'oldstreet',
    street: { wall: '#c9b596', door: '#5a4327', ground: '#8c7a5c', trim: '#e9c46a', porch: '#4a3820' },
  },
  // 营地灯 AI 变体：和 lantern 同一条故事线（包裹旅程、剪辑表、字幕、配音、配乐、价格都不变），画面改用 LTX 实拍片段
  'lantern-ai': {
    base: 'lantern',
    ai: true,
    catId: 'od-lantern',
    model: 'lantern',
    box: [0.26, 0.24, 0.26],
    scene: 'suburb',
    street: { wall: '#d8c7a6', door: '#7a4a2a', ground: '#9ba06f', trim: '#f2b233', porch: '#6b4322' },
  },
};

/** item → 合并后的数据：目录条目（name / one / price / deal / colors）+ 本片的 spec */
export const ITEMS = Object.fromEntries(
  Object.entries(ITEM_SPEC).map(([id, spec]) => {
    const c = CATALOG[spec.catId];
    if (!c) throw new Error(`items: catalog has no ${spec.catId}`);
    return [id, { id, ...spec, name: c.name, one: c.one, price: c.price, deal: c.deal, colors: c.colors }];
  }),
);

export const ITEM_IDS = Object.keys(ITEMS);
/** 该 item 底下是哪条故事线（beans-ai → beans）；只看故事的数据都用这个基准 id */
export const baseItem = id => ITEM_SPEC[id]?.base ?? id;
/** 这件商品是不是 AI 画面变体 */
export const isAiItem = id => !!ITEM_SPEC[id]?.ai;
/** 是不是咖啡豆这条线（含 AI 变体） */
export const isBeans = id => baseItem(id) === 'beans';
