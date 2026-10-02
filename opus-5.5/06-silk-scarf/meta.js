// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、四套剪辑表（每款丝巾一套分镜）、命中点、封面、机位、文件命名
// 80 bpm，一小节 3 秒；命中点都落在 0.75 秒（一拍）的网格上。片尾 end（12–15 秒）四款共用
export const BAR = 3.0, GRID = 0.75;

// 丝巾（米）：90 cm 方巾；人台肩宽约 36 cm
export const SCARF = { size: 0.9, n: 32 };
export const BUST = { shoulder: 0.18, neck: 0.055, top: 1.42, base: 0.95 };
/** 青花的梅瓶：轮廓 [y（从案面算起）, 半径]（米）——小口、丰肩、收腹、微撇的足。瓶的网格（worlds.js）和丝巾滑落的碰撞体（sims.js）用同一组数 */
export const VASE = { x: 0, z: 0, table: 0.78, h: 0.42, profile: [[0, 0.06], [0.01, 0.07], [0.06, 0.075], [0.16, 0.1], [0.26, 0.135], [0.32, 0.14], [0.36, 0.12], [0.39, 0.06], [0.405, 0.035], [0.42, 0.038]] };

const end = (dur = 3.0) => ({ shot: 'end', dur, transition: { type: 'dissolve', dur: 0.4 } });
const dis = d => ({ transition: { type: 'dissolve', dur: d } });

/** 每款一套分镜：shots 是这一款用到的镜头 id（全局唯一，前缀是款名），cuts[15] / cuts[6] 是它的剪辑表 */
export const BOARDS = {
  dunhuang: {                                                         // 「飞天」：风起敦煌 → 飘带盘旋 → 藻井下展开 → 落人台肩 → 环绕
    15: { shots: [{ shot: 'dh_cave', dur: 2.25 }, { shot: 'dh_fly', dur: 3.0 }, { shot: 'dh_ceiling', dur: 2.25, ...dis(0.3) },
      { shot: 'dh_drape', dur: 3.0 }, { shot: 'dh_hero', dur: 1.5, ...dis(0.3) }, end()],
      hits: { lift: 1.5, soar: 3.75, align: 6.0, land: 9.0, logo: 12.0 }, cover: 6.4 },
    6: { shots: [{ shot: 'dh_ceiling', dur: 1.5, from: 0.0 }, { shot: 'dh_drape', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { align: 0.75, land: 2.25, logo: 3.0 }, cover: 4.4 },
  },
  songjin: {                                                          // 「织」：光作梭逐行织出 → 织成 → 提起离机 → 空中三折 → 落盒合盖
    15: { shots: [{ shot: 'sj_warp', dur: 3.0 }, { shot: 'sj_weave', dur: 2.25, ...dis(0.3) }, { shot: 'sj_lift', dur: 3.0 },
      { shot: 'sj_fold', dur: 2.25 }, { shot: 'sj_box', dur: 1.5 }, end()],
      hits: { shuttle: 1.5, woven: 4.5, lift: 6.75, fold: 9.75, lid: 11.25, logo: 12.0 }, cover: 4.9 },
    6: { shots: [{ shot: 'sj_weave', dur: 1.5, from: 0.75 }, { shot: 'sj_fold', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { woven: 0.75, fold: 2.25, logo: 3.0 }, cover: 4.4 },
  },
  qinghua: {                                                          // 「瓷」：毛笔画缠枝莲 → 钴蓝晕开 → 化作丝巾裹瓶滑落 → 褶子微距 → 升起俯看
    15: { shots: [{ shot: 'qh_paint', dur: 3.0 }, { shot: 'qh_bloom', dur: 1.5 }, { shot: 'qh_slip', dur: 3.75, ...dis(0.3) },
      { shot: 'qh_pool', dur: 2.25 }, { shot: 'qh_hero', dur: 1.5, ...dis(0.3) }, end()],
      hits: { stroke: 2.25, bloom: 3.75, settle: 6.0, gleam: 9.0, logo: 12.0 }, cover: 9.4 },
    6: { shots: [{ shot: 'qh_bloom', dur: 1.5 }, { shot: 'qh_slip', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { bloom: 0.75, settle: 2.25, logo: 3.0 }, cover: 4.4 },
  },
  yunhe: {                                                            // 「鹤」：暮色云海 → 两角扇动如鹤过月 → 贴身跟拍 → 收翅落人台 → 慢推
    15: { shots: [{ shot: 'yh_dusk', dur: 2.25 }, { shot: 'yh_crane', dur: 3.0 }, { shot: 'yh_glide', dur: 2.25 },
      { shot: 'yh_land', dur: 3.0, ...dis(0.3) }, { shot: 'yh_hero', dur: 1.5 }, end()],
      hits: { moon: 1.5, pass: 3.75, glide: 6.75, land: 9.0, logo: 12.0 }, cover: 3.9 },
    6: { shots: [{ shot: 'yh_crane', dur: 1.5, from: 0.75 }, { shot: 'yh_land', dur: 1.5, from: 1.5, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { pass: 0.75, land: 2.25, logo: 3.0 }, cover: 4.4 },
  },
};
export const SHOTS = [...new Set(Object.values(BOARDS).flatMap(b => [15, 6].flatMap(c => b[c].shots.map(e => e.shot))))];

export const META = {
  id: '06-silk-scarf',
  axes: { scarf: ['dunhuang', 'songjin', 'qinghua', 'yunhe'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['scarf'],
  cuts: BOARDS.dunhuang,                                              // 默认（引擎只在没有 cutFor 时用它）
  cutFor: v => BOARDS[v.scarf][v.cut],
  fileName: v => `jinshi_${v.scarf}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
