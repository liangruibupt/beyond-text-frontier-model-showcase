// users.js — 四位虚构的顾客：名字、配色、订单生成配置（纯数据）
// gen 是 data/gen.mjs 的输入：每月订单数、每件商品的订单数都写死，两者的和都等于 total，所以统计结果是设计好的；
// 种子只决定落在哪天、几点、买几件。tod：下单时段的权重（night 0–5 点 · early 5–9 点 · day 9–18 点 · evening 18–24 点）；
// weekend：订单落在周末的概率；spikes：某天集中下单几单（算在当月里）；qty2：一单买两件的概率
// palette：bg 背景渐变（上、下）· base 没下单那天的方块（比背景深一档，暗色背景则浅一档，翻过来年份才显出来）· lit 下单那天的方块 ·
// parcel 包裹 · pie 饼图里最大一块之外的品类（最大的一块用 lit）· 其余是文字与按钮的配色

export const USERS = {
  coffee: {
    name: { zh: '林一', en: 'Lin Yi' },
    palette: { bg: ['#f6ead8', '#e3c9a4'], base: '#c8ad8a', lit: '#c98a3d', ink: '#3b2518', soft: '#7a5a44', accent: '#b8742c', cta: '#3b2518', ctaInk: '#f6ecdc', shadow: 'rgba(255,248,236,0.6)', parcel: '#d6b48c', pie: ['#6b4630', '#a47551', '#d8c3a5', '#8c6a4f', '#e9dcc6'] },
    gen: {
      total: 146,
      months: [8, 7, 9, 10, 9, 11, 8, 7, 10, 12, 38, 17],
      items: { 'cf-beans': 13, 'cf-drip': 12, 'cf-capsule': 10, 'cf-coldbrew': 8, 'sn-nuts': 12, 'sn-chips': 11, 'sn-jerky': 10, 'hm-tissue': 12, 'hm-detergent': 11, 'hm-bags': 9, 'dr-oat': 12, 'dr-soda': 11, 'dr-tea': 7, 'bb-wipes': 4, 'od-meal': 4 },
      tod: { night: 0.02, early: 0.46, day: 0.3, evening: 0.22 }, weekend: 0.29, spikes: { '11-11': 9 }, qty2: 0.12,
    },
  },
  baby: {
    name: { zh: '陈安', en: 'Chen An' },
    palette: { bg: ['#fde8dc', '#f5c8b6'], base: '#e4b3a3', lit: '#f08b6b', ink: '#2c3a5c', soft: '#5c6a8a', accent: '#3fa888', cta: '#2c3a5c', ctaInk: '#fff4ee', shadow: 'rgba(255,250,246,0.6)', parcel: '#f2c4ae', pie: ['#7fcbb0', '#2c3a5c', '#f6d27a', '#e4b3a3', '#8fc9e8'] },
    gen: {
      total: 212,
      months: [10, 14, 34, 24, 20, 17, 16, 15, 16, 15, 18, 13],
      items: { 'bb-diapers': 31, 'bb-wipes': 29, 'bb-formula': 27, 'bb-bottle': 9, 'hm-tissue': 22, 'hm-detergent': 14, 'hm-bags': 8, 'sn-nuts': 12, 'sn-chips': 8, 'sn-jerky': 6, 'dr-oat': 10, 'dr-soda': 7, 'dr-tea': 5, 'cf-drip': 14, 'cf-capsule': 10 },
      tod: { night: 0.36, early: 0.1, day: 0.24, evening: 0.3 }, weekend: 0.29, spikes: { '03-14': 6 }, qty2: 0.2,
    },
  },
  camp: {
    name: { zh: '周野', en: 'Zhou Ye' },
    palette: { bg: ['#ece3cc', '#cfbf98'], base: '#b3aa86', lit: '#e8742c', ink: '#1f3a2a', soft: '#4d6b56', accent: '#2f6b45', cta: '#1f3a2a', ctaInk: '#f5efe0', shadow: 'rgba(255,250,238,0.6)', parcel: '#c8a878', pie: ['#2f6b45', '#b3aa86', '#4d6b56', '#d9c9a0', '#1f3a2a'] },
    gen: {
      total: 72,
      months: [2, 2, 4, 8, 15, 7, 6, 7, 6, 9, 4, 2],
      items: { 'od-gas': 11, 'od-meal': 10, 'od-lantern': 5, 'sn-jerky': 7, 'sn-nuts': 5, 'sn-chips': 2, 'dr-soda': 6, 'dr-tea': 4, 'dr-energy': 2, 'hm-tissue': 5, 'hm-bags': 5, 'cf-drip': 10 },
      tod: { night: 0.03, early: 0.12, day: 0.5, evening: 0.35 }, weekend: 0.72, spikes: { '05-01': 4 }, qty2: 0.25,
    },
  },
  gamer: {
    name: { zh: '许星', en: 'Xu Xing' },
    palette: { bg: ['#221544', '#0b0718'], base: '#4d3d94', lit: '#35e6f0', ink: '#f2eeff', soft: '#b3a8e0', accent: '#9a5cff', cta: '#35e6f0', ctaInk: '#120a26', shadow: 'rgba(5,0,20,0.7)', parcel: '#5a48a8', pie: ['#9a5cff', '#4d3d94', '#ff5c8a', '#6b3cf0', '#b3a8e0'] },
    gen: {
      total: 104,
      months: [7, 9, 6, 6, 7, 8, 9, 10, 7, 8, 19, 8],
      items: { 'dr-energy': 21, 'dr-soda': 9, 'dr-tea': 6, 'gm-cards': 19, 'gm-controller': 3, 'gm-headset': 2, 'sn-chips': 14, 'sn-jerky': 7, 'sn-nuts': 5, 'hm-tissue': 6, 'hm-bags': 4, 'cf-capsule': 8 },
      tod: { night: 0.56, early: 0.02, day: 0.12, evening: 0.3 }, weekend: 0.35, spikes: { '11-11': 6 }, qty2: 0.15,
    },
  },
};

export const USER_IDS = Object.keys(USERS);
