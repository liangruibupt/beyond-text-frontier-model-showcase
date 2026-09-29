// gen.mjs — 按 users.js 的 gen 生成每位顾客一年的订单，写进 data/<user>.json（入库）
//   node 04-year-review/data/gen.mjs
// 真实平台会直接给这份文件，成片关于顾客只读它。生成是精确的：每月几单、每件商品几单都照 gen 来，
// 种子（rng.js）只决定落在哪天、几点、买几件。同样的 gen 永远生成同样的文件，测试逐字节核对
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, seedOf } from '../../factory/engine/rng.js';
import { isMain } from '../../factory/lib/args.mjs';
import { USERS } from '../users.js';
import { ITEMS } from '../catalog.js';

export const YEAR = 2026;
const TOD = { night: [0, 5], early: [5, 9], day: [9, 18], evening: [18, 24] };
const pad = (n, w = 2) => String(n).padStart(w, '0');
const daysIn = m => new Date(Date.UTC(YEAR, m, 0)).getUTCDate();
const weekday = (m, d) => new Date(Date.UTC(YEAR, m - 1, d)).getUTCDay();
/** 双11（11 月 1–11 日）和 618（6 月 1–18 日）按到手价付款 */
const onDeal = (m, d) => (m === 11 && d <= 11) || (m === 6 && d <= 18);

function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickWeighted(w, r) {
  const keys = Object.keys(w), sum = keys.reduce((s, k) => s + w[k], 0);
  let x = r() * sum;
  for (const k of keys) { x -= w[k]; if (x < 0) return k; }
  return keys[keys.length - 1];
}

/** 一位顾客的全部订单，按时间排好：[{ id, at, item, qty, paid }] */
export function generate(user) {
  const g = USERS[user].gen, r = mulberry32(seedOf(`youji-${user}`));
  const sum = a => a.reduce((s, x) => s + x, 0);
  if (g.months.length !== 12 || sum(g.months) !== g.total) throw new Error(`${user}: months add up to ${sum(g.months)}, not ${g.total}`);
  if (sum(Object.values(g.items)) !== g.total) throw new Error(`${user}: items add up to ${sum(Object.values(g.items))}, not ${g.total}`);
  for (const id of Object.keys(g.items)) if (!ITEMS[id]) throw new Error(`${user}: ${id} is not in the catalogue`);

  const items = shuffle(Object.entries(g.items).flatMap(([id, n]) => Array(n).fill(id)), r);
  const orders = [];
  let k = 0;
  g.months.forEach((count, i) => {
    const m = i + 1, all = Array.from({ length: daysIn(m) }, (_, j) => j + 1);
    const weekend = all.filter(d => [0, 6].includes(weekday(m, d))), weekdays = all.filter(d => !weekend.includes(d));
    const spiked = Object.entries(g.spikes ?? {}).filter(([md]) => +md.slice(0, 2) === m).flatMap(([md, n]) => Array(n).fill(+md.slice(3)));
    if (spiked.length > count) throw new Error(`${user}: month ${m} has ${spiked.length} spike orders but only ${count} orders`);
    for (let j = 0; j < count; j++) {
      const pool = r() < g.weekend ? weekend : weekdays;
      const d = j < spiked.length ? spiked[j] : pool[Math.floor(r() * pool.length)];
      const [h0, h1] = TOD[pickWeighted(g.tod, r)], h = h0 + Math.floor(r() * (h1 - h0)), min = Math.floor(r() * 60);
      const item = items[k++], qty = r() < g.qty2 ? 2 : 1, it = ITEMS[item];
      orders.push({ at: `${YEAR}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}`, item, qty, paid: qty * (onDeal(m, d) ? it.deal.CNY : it.price.CNY) });
    }
  });
  orders.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const seq = {};
  return orders.map(o => {
    const day = o.at.slice(2, 10).replaceAll('-', '');
    seq[day] = (seq[day] ?? 0) + 1;
    return { id: `YJ${day}${pad(seq[day], 3)}`, ...o };
  });
}

/** 一行一单，改了哪单 diff 一眼看得出 */
export const format = orders => `[\n${orders.map(o => `  ${JSON.stringify(o)}`).join(',\n')}\n]\n`;

export const dataFile = user => path.join(path.dirname(fileURLToPath(import.meta.url)), `${user}.json`);

if (isMain(import.meta.url)) {
  for (const user of Object.keys(USERS)) {
    const orders = generate(user);
    fs.writeFileSync(dataFile(user), format(orders));
    console.log(`${user}: ${orders.length} orders → ${path.relative(process.cwd(), dataFile(user))}`);
  }
}
