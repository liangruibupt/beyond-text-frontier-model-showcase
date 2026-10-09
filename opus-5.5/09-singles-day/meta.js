// meta.js — 双11 零点大屏 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、文件命名
// 80 bpm，一小节 3 秒；命中点落在 0.75 秒（一拍）的网格上。方法一 code-authored（Three.js 实例化弧线 + 画布 motion graphics）

export const BAR = 3.0, GRID = 0.75;
export const SHOTS = ['countdown', 'ignite', 'arcs', 'gmv', 'milestone', 'end'];

export const CUTS = {
  15: {
    shots: [
      { shot: 'countdown', dur: 2.25 },
      { shot: 'ignite', dur: 3.0 },
      { shot: 'arcs', dur: 3.0 },
      { shot: 'gmv', dur: 3.0, transition: { type: 'dissolve', dur: 0.25 } },
      { shot: 'milestone', dur: 0.75, transition: { type: 'flash', dur: 0.15 } },
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.4 } },
    ],
    hits: { tick: 0.75, zero: 2.25, ignite: 2.25, launch: 3.0, peak: 6.0, pulse: 7.5, gmv: 8.25, gear: 9.75, burst: 11.25, logo: 12.0 },
    cover: 11.4,
  },
  6: {
    shots: [
      { shot: 'ignite', dur: 1.5, from: 0.75 },                                         // 入画即点亮爆发
      { shot: 'milestone', dur: 1.5, from: 0.0, transition: { type: 'flash', dur: 0.2 } }, // 里程碑爆屏
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { ignite: 0.0, burst: 1.5, logo: 3.0 },
    cover: 4.4,
  },
};

export const META = {
  id: '09-singles-day',
  axes: {
    theme: ['national', 'megacity', 'crossborder', 'logistics'],
    lang: ['zh', 'en'],
    cut: [15, 6],
    promo: ['none', '1111', 'launch'],
  },
  sceneAxes: ['theme'],
  cuts: CUTS,
  fileName: v => `startide_${v.theme}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
