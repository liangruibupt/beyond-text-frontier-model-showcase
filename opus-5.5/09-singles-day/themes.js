// themes.js — 四款大屏主题（第一轴 theme）的纯数据：配色、星座布局模式/种子、仓库数、弧线方向、里程碑文案
// 换 theme 即换一套视觉与叙事（sceneAxes:['theme']）；数字全是固定种子的虚构数据，不代表任何真实平台

export const THEMES = {
  // 全国总览（默认）：冷蓝，星座铺满，8 仓库，GMV 破十亿
  national: {
    seed: 909, mode: 'spread', nodeCount: 1200, hubs: 8, reverse: false,
    bg: '#06101c', node: '#5fd0ff', hub: '#ffd84a', arc: '#5fe0ff', glow: '#2f9fff',
    pal: { ink: '#eaf6ff', soft: '#8fb6d8', cta: '#5fd0ff', ctaInk: '#06101c', accent: '#ffd84a', shadow: '#2f9fff' },
    gmvTarget: 10_000_000_000, gmvUnit: '¥', milestoneTime: '1分36秒', milestoneTimeEn: 'one minute thirty-six',
  },
  // 核心都市圈：品红，星座聚成北上广深四城团簇，4 仓库=四城，单城破亿
  megacity: {
    seed: 1111, mode: 'clusters', nodeCount: 1000, hubs: 4, reverse: false, cities: true,
    bg: '#14061c', node: '#ff79d8', hub: '#ffe24a', arc: '#ff7ad0', glow: '#c026d3',
    pal: { ink: '#ffe6f8', soft: '#d08fc0', cta: '#ff79d8', ctaInk: '#14061c', accent: '#ffe24a', shadow: '#c026d3' },
    gmvTarget: 100_000_000, gmvUnit: '¥', milestoneTime: '单城', milestoneTimeEn: 'one city',
  },
  // 全球跨境：青绿，点阵世界地图（无国界线），7 仓库，X 国同时下单
  crossborder: {
    seed: 2026, mode: 'worldmap', nodeCount: 1100, hubs: 7, reverse: false, mapScale: 1.5,
    bg: '#06161c', node: '#38e8c8', hub: '#ffd84a', arc: '#5fe0ff', glow: '#14b8a6',
    pal: { ink: '#e6fff8', soft: '#8fd0c4', cta: '#38e8c8', ctaInk: '#06161c', accent: '#ffd84a', shadow: '#14b8a6' },
    gmvTarget: 68, gmvUnit: '国', milestoneTime: '同时', milestoneTimeEn: 'at once',
  },
  // 物流履约：琥珀金，弧线反向（仓库→星座，代表发货），每分钟 X 单已发出
  logistics: {
    seed: 3080, mode: 'spread', nodeCount: 1200, hubs: 8, reverse: true,
    bg: '#1a1206', node: '#ffc24a', hub: '#5fd0ff', arc: '#ffb347', glow: '#f59e0b',
    pal: { ink: '#fff2d8', soft: '#d0b78f', cta: '#ffc24a', ctaInk: '#1a1206', accent: '#5fd0ff', shadow: '#f59e0b' },
    gmvTarget: 2_400_000, gmvUnit: '单/分', milestoneTime: '每分钟', milestoneTimeEn: 'per minute',
  },
};
