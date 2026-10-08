// layouts.js — 每种比例 × 每个镜头的构图：锚点（画面比例坐标，y 向下）、占高、文字区 [x, y, w, h]、对齐
// 镜头用 free 机位（一镜到底），anchor/size 只是兜底；真正要紧的是文字区。只交付 16:9 和 1:1，9:16 是粗排（从 1:1 起）
// 9:16 避开抖音 / 淘宝的右侧图标列和底部标题带（variant.js 的 UNSAFE），字幕区中心在 x ≈ 0.45
// 片尾卡的 card 区是一块米白底板，托住品牌和价签（场景再亮也看得清）
// door 的场景在 1:1 挪到画面上方（§C：anchor [0.5, 0.30]，size 0.42），给下方的价签留位

const END_ZONES_169 = { card: [0.045, 0.16, 0.49, 0.66], logo: [0.07, 0.2, 0.44, 0.14], brand: [0.07, 0.34, 0.44, 0.06], line1: [0.07, 0.46, 0.44, 0.08], line2: [0.07, 0.56, 0.44, 0.12], line3: [0.07, 0.7, 0.44, 0.08] };
const END_ZONES_11 = { card: [0.07, 0.47, 0.86, 0.48], logo: [0.1, 0.5, 0.8, 0.1], brand: [0.1, 0.6, 0.8, 0.05], line1: [0.1, 0.67, 0.8, 0.07], line2: [0.1, 0.74, 0.8, 0.11], line3: [0.1, 0.85, 0.8, 0.07] };
const END_ZONES_916 = { card: [0.07, 0.45, 0.76, 0.38], logo: [0.1, 0.48, 0.7, 0.08], brand: [0.1, 0.56, 0.7, 0.04], line1: [0.1, 0.615, 0.7, 0.055], line2: [0.1, 0.675, 0.7, 0.07], line3: [0.1, 0.75, 0.7, 0.05] };
// AI 画面变体（beans-ai / lantern-ai）的紧凑片尾卡：实拍底图生成时就把主体放在右侧 2/3（16:9）或上半（1:1），这几块区正好落在留白里
const AI_END_169 = { ai_card: [0.04, 0.22, 0.31, 0.56], ai_logo: [0.06, 0.26, 0.27, 0.11], ai_brand: [0.06, 0.37, 0.27, 0.05], ai_line1: [0.06, 0.45, 0.27, 0.08], ai_line2: [0.06, 0.54, 0.27, 0.11], ai_line3: [0.06, 0.66, 0.27, 0.07] };
const AI_END_11 = { ai_card: [0.06, 0.6, 0.88, 0.35], ai_logo: [0.09, 0.62, 0.38, 0.09], ai_brand: [0.09, 0.705, 0.38, 0.055], ai_line1: [0.48, 0.615, 0.43, 0.13], ai_line2: [0.09, 0.765, 0.82, 0.1], ai_line3: [0.09, 0.865, 0.82, 0.065] };
const AI_END_916 = Object.fromEntries(Object.entries(END_ZONES_916).map(([k, z]) => [`ai_${k}`, z]));   // 9:16 不交付，沿用粗排
const END_169 = { ...END_ZONES_169, ...AI_END_169 }, END_11 = { ...END_ZONES_11, ...AI_END_11 }, END_916 = { ...END_ZONES_916, ...AI_END_916 };

export const LAYOUTS = {
  '16x9': {
    roast: { anchor: [0.58, 0.48], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    cool: { anchor: [0.5, 0.5], size: 0.7 },
    bag: { anchor: [0.6, 0.48], size: 0.6, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    night: { anchor: [0.5, 0.5], size: 0.8 },
    alley: { anchor: [0.55, 0.46], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    pour: { anchor: [0.74, 0.5], size: 0.7, align: 'left', zones: END_169 },
    order: { anchor: [0.5, 0.5], size: 0.5 },
    robots: { anchor: [0.55, 0.45], size: 0.8, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    pack: { anchor: [0.5, 0.5], size: 0.6 },
    sort: { anchor: [0.55, 0.45], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    truck: { anchor: [0.5, 0.5], size: 0.7 },
    lastmile: { anchor: [0.55, 0.46], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    door: { anchor: [0.72, 0.5], size: 0.7, align: 'left', zones: END_169 },
    defeat: { anchor: [0.5, 0.46], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.6, 0.16] } },
    cube: { anchor: [0.5, 0.44], size: 0.8, align: 'left', zones: { cap: [0.06, 0.74, 0.6, 0.16] } },
    route: { anchor: [0.5, 0.45], size: 0.8, align: 'left', zones: { cap: [0.06, 0.74, 0.62, 0.16] } },
    ride: { anchor: [0.5, 0.5], size: 0.7 },
    lift: { anchor: [0.5, 0.46], size: 0.7, align: 'left', zones: { cap: [0.06, 0.74, 0.52, 0.16] } },
    victory: { anchor: [0.72, 0.5], size: 0.7, align: 'left', zones: { ...END_169, vtitle: [0.055, 0.045, 0.4, 0.115], vrank: [0.055, 0.165, 0.4, 0.04] } },
  },
  '1x1': {
    roast: { anchor: [0.5, 0.42], size: 0.76, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    cool: { anchor: [0.5, 0.48], size: 0.76 },
    bag: { anchor: [0.5, 0.42], size: 0.7, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    night: { anchor: [0.5, 0.5], size: 0.8 },
    alley: { anchor: [0.5, 0.42], size: 0.72, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    pour: { anchor: [0.5, 0.28], size: 0.42, align: 'center', zones: END_11 },
    order: { anchor: [0.5, 0.5], size: 0.6 },
    robots: { anchor: [0.5, 0.42], size: 0.84, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    pack: { anchor: [0.5, 0.46], size: 0.7 },
    sort: { anchor: [0.5, 0.42], size: 0.78, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    truck: { anchor: [0.5, 0.46], size: 0.78 },
    lastmile: { anchor: [0.5, 0.44], size: 0.72, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    door: { anchor: [0.5, 0.3], size: 0.42, align: 'center', zones: END_11 },
    defeat: { anchor: [0.5, 0.42], size: 0.76, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    cube: { anchor: [0.5, 0.42], size: 0.84, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    route: { anchor: [0.5, 0.44], size: 0.84, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    ride: { anchor: [0.5, 0.5], size: 0.78 },
    lift: { anchor: [0.5, 0.42], size: 0.72, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.14] } },
    victory: { anchor: [0.5, 0.3], size: 0.42, align: 'center', zones: { ...END_11, vtitle: [0.12, 0.045, 0.76, 0.12], vrank: [0.12, 0.17, 0.76, 0.045] } },
  },
  '9x16': {
    roast: { anchor: [0.45, 0.4], size: 0.7, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    cool: { anchor: [0.45, 0.44], size: 0.7 },
    bag: { anchor: [0.45, 0.4], size: 0.66, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    night: { anchor: [0.45, 0.44], size: 0.72 },
    alley: { anchor: [0.45, 0.4], size: 0.66, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    pour: { anchor: [0.45, 0.26], size: 0.34, align: 'center', zones: END_916 },
    order: { anchor: [0.45, 0.44], size: 0.6 },
    robots: { anchor: [0.45, 0.4], size: 0.8, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    pack: { anchor: [0.45, 0.44], size: 0.66 },
    sort: { anchor: [0.45, 0.4], size: 0.72, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    truck: { anchor: [0.45, 0.44], size: 0.72 },
    lastmile: { anchor: [0.45, 0.42], size: 0.66, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    door: { anchor: [0.45, 0.27], size: 0.34, align: 'center', zones: END_916 },
    defeat: { anchor: [0.45, 0.4], size: 0.7, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    cube: { anchor: [0.45, 0.4], size: 0.78, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    route: { anchor: [0.45, 0.42], size: 0.78, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    ride: { anchor: [0.45, 0.44], size: 0.72 },
    lift: { anchor: [0.45, 0.4], size: 0.66, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.14] } },
    victory: { anchor: [0.45, 0.27], size: 0.34, align: 'center', zones: { ...END_916, vtitle: [0.1, 0.09, 0.7, 0.11], vrank: [0.1, 0.21, 0.7, 0.04] } },
  },
};
