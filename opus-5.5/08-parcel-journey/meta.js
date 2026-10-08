// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、沿对角线的工位、一镜到底的机位、文件命名
// 120 bpm，一小节 2 秒；命中点都落在 0.5 秒（一拍）的网格上
import { ITEM_IDS, isBeans, isHeadset } from './items.js';
import { LAYOUTS } from './layouts.js';
import { CUTS as BEANS_CUTS } from './stories/beans/meta.js';
import { CUTS as HEADSET_CUTS } from './stories/headset/meta.js';

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
// 对角线自己的坐标系（lane）：s 沿着路往前（从手机算起），q 横向朝相机为正；world = 手机 + D·s + P·q
export const LANE = { D: [0.868, 0, -0.496], P: [0.496, 0, 0.868], theta: 0.519 };   // theta：沿对角线摆放的件绕 y 转的角
export const lane = (s, q = 0, y = 0) => [LANE.D[0] * s + LANE.P[0] * q, y, LANE.D[2] * s + LANE.P[2] * q];

export const STATIONS = {
  phone: [0.0, 0.0, 0.0],
  warehouse: [1.6, 0.0, -0.9],
  pack: [3.0, 0.0, -1.7],
  sorter: [4.4, 0.0, -2.5],
  dock: [5.8, 0.0, -3.3],
  road: [7.2, 0.0, -4.1],
  street: [8.6, 0.0, -4.9],
  door: lane(11.0, -0.55),                       // 门口在路的里侧（街边房子的门廊），不在路面上
};
// 工位在 lane 上的 s（世界坐标反算，沿对角线的距离）
export const S_OF = Object.fromEntries(Object.entries(STATIONS).map(([k, c]) => [k, c[0] * LANE.D[0] + c[2] * LANE.D[2]]));

// ── 会走的两样东西的闭式路程（镜头本地秒 → lane 上的 s），世界和机位共用，镜头才能跟得住 ──
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const inQ = k => k * k;
export const MOTION = {
  /** 卡车：停在月台，0.5 s 发车加速，2.0 s 时开出 4 m（早出了画面） */
  truck: lt => S_OF.dock + 4.0 * inQ(Math.min(1, Math.max(0, (lt - 0.5) / 1.5))),
  /** 三轮车：在公路工位等着交接，lastmile 0–1.4 s 骑到门口前的路边停稳（之后快递员下车走上门廊） */
  trike: lt => S_OF.road + (S_OF.door - 0.15 - S_OF.road) * (1 - (1 - sm(0, 1.4, lt)) ** 2),
};

// 看向取景点的方向（写实焦段，贴地的 3/4 视角——不再是长焦俯瞰的沙盘）：
// y 分量压得很低（相机只比看点高一点点，像蹲在地面上拍），往 +z（朝相机）和 +x（沿路）各偏一些。
// fov ≈ 35°（约等效 50 mm），配上很近的机位距离，前景被浅景深化开、远处纵深压缩，像真的在现场。
export const ISO_DIR = [0.72, 0.24, 1.0];
export const FOV = 35;

/** 取景点 c + 方向 × 距离 dist 得到机位（vertical fov 35°：画面高 ≈ 2·tan(17.5°)·dist ≈ 0.631·dist 米） */
function poseAt(c, dist) {
  const n = Math.hypot(...ISO_DIR), u = ISO_DIR.map(x => x / n);
  return { position: [c[0] + u[0] * dist, c[1] + u[1] * dist, c[2] + u[2] * dist], target: [...c] };
}

// 每个镜头的机位：hold 是这个镜头的主体取景（看点 at(lt) + 距离 dist），镜头末尾 move 窗口里把机位
// 交接到下一个镜头的 hold——所以每个镜头一开场就对准自己的主体，6 秒版从中段切入也落在主体上。
// at 返回世界坐标的看点；卡车 / 三轮车的看点跟着 MOTION 走。push：hold 期间缓慢推近的比例。
const P = (k, dy = 0, dq = 0, ds = 0) => () => { const c = STATIONS[k], o = lane(ds, dq, dy); return [c[0] + o[0], o[1], c[2] + o[2]]; };
export const RIG = {
  order: { at: P('phone', 0.06), dist: 1.5, push: 0.12, move: [0.7, 1.0] },
  robots: { at: P('warehouse', 0.06), dist: 1.35, push: 0.1, move: [0.8, 1.0] },
  pack: { at: P('pack', 0.14), dist: 1.5, push: 0.12, move: [0.8, 1.0] },
  sort: { at: P('sorter', 0.12, 0.05, 0.05), dist: 1.9, push: 0.08, move: [0.75, 1.0] },
  truck: { at: lt => lane(Math.min(MOTION.truck(lt) + 0.1, S_OF.road), 0.0, 0.2), dist: 1.6, push: 0, move: [0.85, 1.0] },
  lastmile: { at: lt => lane(MOTION.trike(lt), 0.12, 0.1), dist: 1.35, push: 0, move: [0.9, 1.0] },
  door: { at: P('door', 0.22, 0.14, -0.06), dist: 2.0, push: 0.08, move: [2, 2] },
};
const NEXT = { order: 'robots', robots: 'pack', pack: 'sort', sort: 'truck', truck: 'lastmile', lastmile: 'door' };
// 各镜头的天然时长（15 秒版剪辑表）：镜头本地时间按这个算进度，跟哪一版剪辑无关
export const NATURAL = Object.fromEntries(CUTS[15].shots.map(e => [e.shot, e.dur]));
// 故事时间：每个镜头在 15 秒版里的起点。世界的状态只看故事时间（= 起点 + 镜头本地秒），6 秒版从中段切入也是同一帧
export const STORY0 = (() => { let t = 0; const o = {}; for (const e of CUTS[15].shots) { o[e.shot] = t; t += e.dur; } return o; })();
export const storyT = (name, lt) => STORY0[name] + lt;
/** 镜头用：按比例取构图表 */
export const rowsFor = ar => LAYOUTS[ar] ?? {};

/** 主体在画面里的位置 → setViewOffset 的偏移（anchor 是画面比例坐标；主体出现在 0.5 - offset） */
const offsetOf = row => (row?.anchor ? [0.5 - row.anchor[0], 0.5 - row.anchor[1]] : [0, 0]);

/** 镜头本地秒 lt 时的 free 机位 { position, target, offset }。rows：当前比例的构图表（按镜头名） */
export function poseFor(name, lt, rows = {}) {
  const r = RIG[name], dur = NATURAL[name], u = Math.min(1, Math.max(0, lt / dur));
  const hold = (rr, l, uu) => ({ ...poseAt(rr.at(l), rr.dist * (1 - rr.push * uu)) });
  const a = hold(r, lt, u), oa = offsetOf(rows[name]);
  const nx = NEXT[name], k = nx ? sm(r.move[0], r.move[1], u) : 0;
  if (k <= 0) return { ...a, offset: oa };
  const b = hold(RIG[nx], 0, 0), ob = offsetOf(rows[nx]);
  const L = (x, y) => x.map((v, i) => v + (y[i] - v) * k);
  return { position: L(a.position, b.position), target: L(a.target, b.target), offset: L(oa, ob) };
}

export const META = {
  id: '08-parcel-journey',
  axes: { item: ITEM_IDS, lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['item', 'ar'],   // ar：AI 变体的底图片段按比例分开生成（16:9 / 1:1 构图不同），换比例要重建
  cuts: CUTS,
  cutFor: v => cutFor(v),
  fileName: v => `youji-parcel_${v.item}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
/** 每件商品一套分镜（v2）：咖啡豆走 stories/beans、电竞耳机走 stories/headset 的剪辑表，其余沿用一镜到底的包裹旅程 */
export function cutFor(v) { return (isBeans(v.item) ? BEANS_CUTS : isHeadset(v.item) ? HEADSET_CUTS : CUTS)[v.cut]; }
