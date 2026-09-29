// facts.js — 每位顾客的订单、统计与文案（浏览器与 Node 共用；订单和文案都用 JSON 模块导入，读进来就不再变）
// 文案 stories/<user>.json 是 factory/story.mjs 写的；它的 key 是 factsOf(user) 的指纹，统计一变就过期，页面拒绝出片
import { USERS, USER_IDS } from './users.js';
import { CATALOG, CATS, ITEMS } from './catalog.js';
import { statsOf } from './stats.js';
import { storyKey } from '../factory/engine/story.js';

const json = async f => {
  try { return (await import(new URL(f, import.meta.url).href, { with: { type: 'json' } })).default; } catch { return null; }
};
const ORDERS = {}, RECORDS = {};
await Promise.all(USER_IDS.map(async u => { [ORDERS[u], RECORDS[u]] = await Promise.all([json(`./data/${u}.json`), json(`./stories/${u}.json`)]); }));

const memo = {};
/** 一位顾客的统计（stats.js），算一次 */
export function statsFor(u) {
  if (!ORDERS[u]) throw new Error(`no orders for ${u}: 04-year-review/data/${u}.json is missing or unreadable`);
  return (memo[u] ??= statsOf(ORDERS[u], CATALOG));
}

const named = id => ({ id, zh: ITEMS[id].name.zh, en: ITEMS[id].name.en });
/**
 * 交给模型的统计（story.mjs 把它的指纹存进文案）：名字、全部统计（不含逐日的 days）、品类和商品带上中英文名。
 * 只有关于这位顾客的数据；商品目录和字数预算在提示词里，改版式不会让文案过期（测试会重新检查它还放不放得下）
 */
export function factsOf(u) {
  const { days, categories, top, firstOrder, ...s } = statsFor(u);
  return {
    user: u, name: USERS[u].name, ...s,
    categories: categories.map(c => ({ ...c, zh: CATS[c.id].zh, en: CATS[c.id].en })),
    top: { ...top, category: { id: top.category, ...CATS[top.category] }, item: named(top.item) },
    firstOrder: { at: firstOrder.at, item: named(firstOrder.item) },
  };
}

/** 页面用的文案：缺了或过期了就报错，并给出要跑的命令 */
export function storyOf(u) {
  const r = RECORDS[u];
  if (!r || r.key !== storyKey(factsOf(u))) throw new Error(`story for ${u} is missing or stale: node factory/story.mjs 04-year-review --user ${u}`);
  return r.story;
}
export const recordOf = u => RECORDS[u];
