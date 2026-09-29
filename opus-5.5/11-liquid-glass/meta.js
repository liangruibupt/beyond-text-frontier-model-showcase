// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、文件命名
// 一小节 3 秒（80 bpm 四拍），命中点都落在 0.75 秒（一拍）的网格上

export const BAR = 3.0, BEAT = 0.75;
export const SHOTS = ['wall', 'lens', 'flow', 'sweep', 'end'];
// 镜头内部的事件（镜头本地秒）：小组件依次落位（wall）、玻璃压住数字时分钟翻页（lens）、两滴玻璃相融（flow）、
// 玻璃幕的前沿扫过画面中线（sweep）、片尾玻璃卡成形（end）
export const EV = { pops: [0.75, 1.5, 2.25], tick: 1.5, merge: 1.5, sweep: 1.5, card: 0.6 };

export const CUTS = {
  15: {
    shots: [
      { shot: 'wall', dur: 3.0 },
      { shot: 'lens', dur: 3.0 },
      { shot: 'flow', dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
      { shot: 'sweep', dur: 3.0 },
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.4 } },
    ],
    hits: { pop1: 0.75, pop2: 1.5, pop3: 2.25, tick: 4.5, merge: 7.5, sweep: 10.5, logo: 12.0 }, cover: 4.6,
  },
  6: {
    shots: [
      { shot: 'lens', dur: 1.5, from: 0.75 },
      { shot: 'flow', dur: 1.5, from: 0.75, transition: { type: 'dissolve', dur: 0.25 } },
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { tick: 0.75, merge: 2.25, logo: 3.0 }, cover: 4.5,
  },
};

export const META = {
  id: '11-liquid-glass',
  axes: { theme: ['iris', 'dawn', 'mint'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['theme'],
  cuts: CUTS,
  fileName: v => `liuguang_${v.theme}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
