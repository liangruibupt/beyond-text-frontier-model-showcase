// stats.js — 从订单算出统计（纯函数，页面、测试和 story.js 共用）。画面上的每个数、每块亮起的方块、
// 每根柱子和每片饼都从这里来；模型看到的统计也是这里算的，它只写字
// 订单的 at 是当地时间 'YYYY-MM-DDTHH:MM'，按字面解析，不经过时区

const parse = at => ({ y: +at.slice(0, 4), m: +at.slice(5, 7), d: +at.slice(8, 10), h: +at.slice(11, 13) });
const dayOfYear = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000;
const isWeekend = (y, m, d) => [0, 6].includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
/** 按次数从多到少；次数相同时 order 里排前面的在前 */
const ranked = (counts, order) => order.filter(k => counts[k]).sort((a, b) => counts[b] - counts[a] || order.indexOf(a) - order.indexOf(b));

export const daysInYear = y => (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000;

/**
 * 统计：
 * - year · orders · activeDays · days（有订单的日子，一年里的第几天，从 0 起）· months[12] · busiest { month, orders }
 * - categories [{ id, orders, share }]（多到少）· top { category, item, count, repeat }：最大品类里买得最多的一件，repeat = count − 1（第一次不算回购）
 * - 给模型的底色，不上屏：spend（元）· lateNight（0–5 点）· earlyBird（5–9 点）· weekendShare · longestStreak { days, from } · firstOrder { at, item } · biggestDay { date, orders }
 */
export function statsOf(orders, catalog) {
  if (!orders.length) throw new Error('statsOf: no orders');
  const P = orders.map(o => ({ ...o, ...parse(o.at) })), year = P[0].y;
  const other = P.find(p => p.y !== year);
  if (other) throw new Error(`statsOf: orders span more than one year (${year} and ${other.y})`);
  for (const o of orders) if (!catalog.items[o.item]) throw new Error(`statsOf: ${o.item} is not in the catalogue`);

  const months = Array(12).fill(0), byDay = new Map(), cats = {}, items = {};
  let spend = 0, lateNight = 0, earlyBird = 0, weekend = 0;
  for (const p of P) {
    months[p.m - 1]++;
    const doy = dayOfYear(p.y, p.m, p.d);
    byDay.set(doy, (byDay.get(doy) ?? 0) + 1);
    const cat = catalog.items[p.item].cat;
    cats[cat] = (cats[cat] ?? 0) + 1; items[p.item] = (items[p.item] ?? 0) + 1;
    spend += p.paid;
    if (p.h < 5) lateNight++; else if (p.h < 9) earlyBird++;
    if (isWeekend(p.y, p.m, p.d)) weekend++;
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const busiestMonth = months.indexOf(Math.max(...months));

  const categories = ranked(cats, Object.keys(catalog.cats)).map(id => ({ id, orders: cats[id], share: round(cats[id] / orders.length, 4) }));
  const topCat = categories[0].id, itemOrder = Object.keys(catalog.items);
  const topItem = ranked(items, itemOrder.filter(id => catalog.items[id].cat === topCat))[0];

  let best = { days: 0, from: 0 };
  for (let i = 0, run = 1; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best.days) best = { days: run, from: days[i - run + 1] };
  }
  const dateOf = doy => new Date(Date.UTC(year, 0, 1 + doy)).toISOString().slice(0, 10);
  const [bigDay, bigN] = [...byDay].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const first = P.reduce((a, b) => (b.at < a.at ? b : a));

  return {
    year, orders: orders.length, activeDays: days.length, days, months,
    busiest: { month: busiestMonth + 1, orders: months[busiestMonth] },
    categories,
    top: { category: topCat, item: topItem, count: items[topItem], repeat: items[topItem] - 1 },
    spend, lateNight, earlyBird, weekendShare: round(weekend / orders.length, 2),
    longestStreak: { days: best.days, from: dateOf(best.from) },
    firstOrder: { at: first.at, item: first.item },
    biggestDay: { date: dateOf(bigDay), orders: bigN },
  };
}
