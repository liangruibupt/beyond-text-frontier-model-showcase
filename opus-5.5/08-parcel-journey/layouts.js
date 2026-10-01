// layouts.js — 每种比例 × 每个镜头的构图：锚点（画面比例坐标，y 向下）、占高、文字区 [x, y, w, h]、对齐
// 镜头用 free 机位（一镜到底），anchor/size 只是兜底；真正要紧的是文字区。只交付 16:9 和 1:1，9:16 是粗排（从 1:1 起）
// 9:16 避开抖音 / 淘宝的右侧图标列和底部标题带（variant.js 的 UNSAFE），字幕区中心在 x ≈ 0.45
// 片尾卡的 card 区是一块米白底板，托住品牌和价签（场景再亮也看得清）
// door 的场景在 1:1 挪到画面上方（§C：anchor [0.5, 0.30]，size 0.42），给下方的价签留位

const END_ZONES_169 = { card: [0.045, 0.16, 0.49, 0.66], logo: [0.07, 0.2, 0.44, 0.14], brand: [0.07, 0.34, 0.44, 0.06], line1: [0.07, 0.46, 0.44, 0.08], line2: [0.07, 0.56, 0.44, 0.12], line3: [0.07, 0.7, 0.44, 0.08] };
const END_ZONES_11 = { card: [0.07, 0.47, 0.86, 0.48], logo: [0.1, 0.5, 0.8, 0.1], brand: [0.1, 0.6, 0.8, 0.05], line1: [0.1, 0.67, 0.8, 0.07], line2: [0.1, 0.74, 0.8, 0.11], line3: [0.1, 0.85, 0.8, 0.07] };
const END_ZONES_916 = { card: [0.07, 0.45, 0.76, 0.38], logo: [0.1, 0.48, 0.7, 0.08], brand: [0.1, 0.56, 0.7, 0.04], line1: [0.1, 0.615, 0.7, 0.055], line2: [0.1, 0.675, 0.7, 0.07], line3: [0.1, 0.75, 0.7, 0.05] };

export const LAYOUTS = {
  '16x9': {
    order: { anchor: [0.5, 0.5], size: 0.5 },
    robots: { anchor: [0.55, 0.45], size: 0.8, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    pack: { anchor: [0.5, 0.5], size: 0.6 },
    sort: { anchor: [0.55, 0.45], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    truck: { anchor: [0.5, 0.5], size: 0.7 },
    lastmile: { anchor: [0.55, 0.46], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    door: { anchor: [0.72, 0.5], size: 0.7, align: 'left', zones: END_ZONES_169 },
  },
  '1x1': {
    order: { anchor: [0.5, 0.5], size: 0.6 },
    robots: { anchor: [0.5, 0.42], size: 0.84, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    pack: { anchor: [0.5, 0.46], size: 0.7 },
    sort: { anchor: [0.5, 0.42], size: 0.78, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    truck: { anchor: [0.5, 0.46], size: 0.78 },
    lastmile: { anchor: [0.5, 0.44], size: 0.72, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    door: { anchor: [0.5, 0.3], size: 0.42, align: 'center', zones: END_ZONES_11 },
  },
  '9x16': {
    order: { anchor: [0.45, 0.44], size: 0.6 },
    robots: { anchor: [0.45, 0.4], size: 0.8, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    pack: { anchor: [0.45, 0.44], size: 0.66 },
    sort: { anchor: [0.45, 0.4], size: 0.72, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    truck: { anchor: [0.45, 0.44], size: 0.72 },
    lastmile: { anchor: [0.45, 0.42], size: 0.66, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    door: { anchor: [0.45, 0.27], size: 0.34, align: 'center', zones: END_ZONES_916 },
  },
};
