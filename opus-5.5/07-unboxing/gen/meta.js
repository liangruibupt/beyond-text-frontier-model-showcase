// meta.js — 07 开箱 ASMR 成片骨架（纯数据，浏览器与 Node 测试共用）
// 80 bpm，一小节 3 秒；命中点落在 0.75 秒网格。片尾 end 12–15 两款共用。
export const BAR = 3.0, GRID = 0.75;

const end = (dur = 3.0) => ({ shot: 'end', dur, transition: { type: 'dissolve', dur: 0.4 } });
const dis = d => ({ transition: { type: 'dissolve', dur: d } });

// 每款一套分镜：tape 划胶带 → flaps 箱盖开 → tissue 拨衬纸 → rise 升入光束 → hero 定格
export const BOARDS = {
  laptop: {
    15: { shots: [{ shot: 'lap_tape', dur: 2.25 }, { shot: 'lap_flaps', dur: 3.0, ...dis(0.3) }, { shot: 'lap_tissue', dur: 2.25 },
      { shot: 'lap_rise', dur: 3.0, ...dis(0.3) }, { shot: 'lap_hero', dur: 1.5 }, end()],
      hits: { cut: 0.75, open: 3.75, reveal: 6.0, rise: 9.0, logo: 12.0 }, cover: 9.0 },
    6: { shots: [{ shot: 'lap_flaps', dur: 1.5, from: 0.75 }, { shot: 'lap_rise', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { open: 0.75, rise: 2.25, logo: 3.0 }, cover: 2.0 },
  },
  drone: {
    15: { shots: [{ shot: 'drn_tape', dur: 2.25 }, { shot: 'drn_flaps', dur: 3.0, ...dis(0.3) }, { shot: 'drn_tissue', dur: 2.25 },
      { shot: 'drn_rise', dur: 3.0, ...dis(0.3) }, { shot: 'drn_hero', dur: 1.5 }, end()],
      hits: { cut: 0.75, open: 3.75, reveal: 6.0, rise: 9.0, logo: 12.0 }, cover: 9.0 },
    6: { shots: [{ shot: 'drn_flaps', dur: 1.5, from: 0.75 }, { shot: 'drn_rise', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } }, end()],
      hits: { open: 0.75, rise: 2.25, logo: 3.0 }, cover: 2.0 },
  },
};
export const SHOTS = [...new Set(Object.values(BOARDS).flatMap(b => [15, 6].flatMap(c => b[c].shots.map(e => e.shot))))];

export const META = {
  id: '07-unboxing',
  axes: { item: ['laptop', 'drone'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['item'],
  cuts: BOARDS.laptop,
  cutFor: v => BOARDS[v.item][v.cut],
  fileName: v => `kaiwu_${v.item}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
