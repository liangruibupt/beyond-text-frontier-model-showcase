// items.js — 第一轴 item 的三件商品（纯数据，浏览器与 Node 测试共用）
// 品牌「有集 Youji」，直播间叫「有集直播」，沿用 04 / 08 的虚构购物 App。
// 商品、价格直接取自 04 的 catalog.js（整数，照搬）；建模用 04 的 product.js（只读引用），和 08 一样。
// 每件商品：04 目录里的 id（商品名、价格、one 的叫法从那里来）、建模用的 model（product.js 的 kind）、
// accent（背景主色 / 弹窗小图主色，有集橙为底时的点缀），sceneTint（影棚背景主色随商品换）。

import { ITEMS as CATALOG } from '../04-year-review/catalog.js';

export const ORANGE = '#ff7a1a';   // 有集橙
export const RED = '#ff2d3d';      // 秒杀红
export const GOLD = '#ffcf4a';     // 金

// item → { catId（04 目录里的键）, model（product.js 的 kind）, accent（商品主色，用于弹窗 / 背景辉光）, sceneTint（影棚环形灯主色） }
export const ITEM_SPEC = {
  lantern: { catId: 'od-lantern', model: 'lantern', accent: '#2f6b45', sceneTint: '#1c3a2b' },
  headset: { catId: 'gm-headset', model: 'headset', accent: '#ff5c8a', sceneTint: '#2a1c3a' },
  beans: { catId: 'cf-geisha', model: 'pouch', accent: '#1f3b35', sceneTint: '#2a241c' },
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
