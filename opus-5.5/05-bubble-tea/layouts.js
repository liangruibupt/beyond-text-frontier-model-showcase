// layouts.js — 每种比例 × 每个镜头的构图：杯子锚点（画面比例坐标，y 向下）、占画面高度、最大宽度、文字区 [x, y, w, h]、对齐
// 9:16 避开抖音 / 淘宝的右侧图标列和底部标题带（variant.js 的 UNSAFE），安全区中心在 x ≈ 0.45。只交付 16:9 和 1:1，9:16 是粗排

export const LAYOUTS = {
  '9x16': {
    pearls: { anchor: [0.45, 0.34], size: 0.36, maxW: 0.78, align: 'center', zones: { hook: [0.08, 0.6, 0.74, 0.12] } },
    pour: { anchor: [0.45, 0.42], size: 0.52 },
    ice: { anchor: [0.45, 0.42], size: 0.4, maxW: 0.78 },
    hero: { anchor: [0.45, 0.33], size: 0.4, align: 'center', zones: { title: [0.08, 0.58, 0.74, 0.1], sub: [0.08, 0.69, 0.74, 0.05] } },
    straw: { anchor: [0.45, 0.33], size: 0.42, align: 'center', zones: { parts: [0.08, 0.62, 0.74, 0.1] } },
    end: { anchor: [0.45, 0.27], size: 0.32, align: 'center', zones: { logo: [0.1, 0.48, 0.7, 0.08], brand: [0.1, 0.56, 0.7, 0.04], line1: [0.1, 0.615, 0.7, 0.055], line2: [0.1, 0.675, 0.7, 0.07], line3: [0.1, 0.75, 0.7, 0.05] } },
  },
  '1x1': {
    pearls: { anchor: [0.5, 0.4], size: 0.6, maxW: 0.8, align: 'center', zones: { hook: [0.08, 0.8, 0.84, 0.12] } },
    pour: { anchor: [0.5, 0.48], size: 0.78 },
    ice: { anchor: [0.5, 0.48], size: 0.66, maxW: 0.8 },
    hero: { anchor: [0.5, 0.38], size: 0.6, align: 'center', zones: { title: [0.08, 0.73, 0.84, 0.12], sub: [0.08, 0.86, 0.84, 0.06] } },
    straw: { anchor: [0.5, 0.38], size: 0.6, align: 'center', zones: { parts: [0.08, 0.8, 0.84, 0.1] } },
    end: { anchor: [0.5, 0.26], size: 0.4, align: 'center', zones: { logo: [0.1, 0.5, 0.8, 0.1], brand: [0.1, 0.6, 0.8, 0.05], line1: [0.1, 0.67, 0.8, 0.07], line2: [0.1, 0.74, 0.8, 0.11], line3: [0.1, 0.85, 0.8, 0.07] } },
  },
  '16x9': {
    pearls: { anchor: [0.7, 0.47], size: 0.74, maxW: 0.4, align: 'left', zones: { hook: [0.06, 0.4, 0.4, 0.2] } },
    pour: { anchor: [0.62, 0.5], size: 0.84 },
    ice: { anchor: [0.62, 0.5], size: 0.78, maxW: 0.52 },
    hero: { anchor: [0.7, 0.5], size: 0.86, align: 'left', zones: { title: [0.07, 0.3, 0.42, 0.24], sub: [0.07, 0.55, 0.42, 0.08] } },
    straw: { anchor: [0.68, 0.5], size: 0.88, align: 'left', zones: { parts: [0.07, 0.4, 0.42, 0.2] } },
    end: { anchor: [0.73, 0.5], size: 0.7, align: 'left', zones: { logo: [0.07, 0.2, 0.45, 0.16], brand: [0.07, 0.36, 0.45, 0.07], line1: [0.07, 0.5, 0.45, 0.08], line2: [0.07, 0.59, 0.45, 0.13], line3: [0.07, 0.73, 0.45, 0.08] } },
  },
};
