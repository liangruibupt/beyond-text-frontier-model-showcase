// layouts.js — 每种比例 × 每个镜头的构图：主体锚点（画面比例坐标，y 向下）、占画面高度、最大宽度、文字区 [x, y, w, h]、对齐
// 16:9 主体在右、字在左；1:1 主体在上、字在下。open 的方块墙和 months 的柱子很宽，三种比例都居中，字放在墙下、柱子上方
// 9:16 只做粗排（避开 variant.js 的 UNSAFE：右侧图标列和底部标题带，安全区中心在 x ≈ 0.45）
// 1111 的片尾卡按 1:1 交付，line1–line4 先按 1:1 定尺寸

export const LAYOUTS = {
  '16x9': {
    open: { anchor: [0.5, 0.36], size: 0.4, maxW: 0.8, align: 'center', zones: { name: [0.1, 0.66, 0.8, 0.12], sub: [0.1, 0.79, 0.8, 0.07] } },
    count: { anchor: [0.72, 0.52], size: 0.6, maxW: 0.44, align: 'left', zones: { num: [0.07, 0.24, 0.42, 0.21], line: [0.07, 0.48, 0.42, 0.18] } },
    months: { anchor: [0.5, 0.6], size: 0.52, maxW: 0.84, align: 'center', zones: { line: [0.08, 0.08, 0.84, 0.15] } },
    top: { anchor: [0.71, 0.54], size: 0.62, maxW: 0.5, align: 'left', zones: { line: [0.06, 0.36, 0.4, 0.3] } },
    title: { anchor: [0.7, 0.5], size: 0.7, maxW: 0.36, align: 'left', zones: { label: [0.08, 0.32, 0.44, 0.07], title: [0.08, 0.4, 0.44, 0.24] } },
    end: { anchor: [0.73, 0.5], size: 0.6, maxW: 0.36, align: 'left', zones: {
      logo: [0.07, 0.17, 0.45, 0.16], brand: [0.07, 0.33, 0.45, 0.06],
      line1: [0.07, 0.44, 0.45, 0.08], line2: [0.07, 0.53, 0.45, 0.1], line3: [0.07, 0.64, 0.45, 0.11], line4: [0.07, 0.76, 0.45, 0.07] } },
  },
  '1x1': {
    open: { anchor: [0.5, 0.36], size: 0.3, maxW: 0.86, align: 'center', zones: { name: [0.08, 0.63, 0.84, 0.12], sub: [0.08, 0.76, 0.84, 0.07] } },
    count: { anchor: [0.5, 0.3], size: 0.42, maxW: 0.8, align: 'center', zones: { num: [0.08, 0.57, 0.84, 0.19], line: [0.08, 0.77, 0.84, 0.15] } },
    months: { anchor: [0.5, 0.6], size: 0.5, maxW: 0.86, align: 'center', zones: { line: [0.08, 0.07, 0.84, 0.15] } },
    top: { anchor: [0.5, 0.35], size: 0.44, maxW: 0.86, align: 'center', zones: { line: [0.08, 0.71, 0.84, 0.18] } },
    title: { anchor: [0.5, 0.33], size: 0.5, maxW: 0.5, align: 'center', zones: { label: [0.08, 0.65, 0.84, 0.06], title: [0.08, 0.71, 0.84, 0.19] } },
    end: { anchor: [0.5, 0.24], size: 0.34, maxW: 0.5, align: 'center', zones: {
      logo: [0.1, 0.44, 0.8, 0.11], brand: [0.1, 0.55, 0.8, 0.05],
      line1: [0.1, 0.61, 0.8, 0.07], line2: [0.1, 0.68, 0.8, 0.08], line3: [0.1, 0.76, 0.8, 0.1], line4: [0.1, 0.86, 0.8, 0.07] } },
  },
  '9x16': {
    open: { anchor: [0.45, 0.3], size: 0.14, maxW: 0.74, align: 'center', zones: { name: [0.08, 0.46, 0.74, 0.07], sub: [0.08, 0.53, 0.74, 0.04] } },
    count: { anchor: [0.45, 0.28], size: 0.26, maxW: 0.7, align: 'center', zones: { num: [0.08, 0.47, 0.74, 0.11], line: [0.08, 0.59, 0.74, 0.1] } },
    months: { anchor: [0.45, 0.44], size: 0.22, maxW: 0.74, align: 'center', zones: { line: [0.08, 0.1, 0.74, 0.1] } },
    top: { anchor: [0.45, 0.32], size: 0.24, maxW: 0.74, align: 'center', zones: { line: [0.08, 0.55, 0.74, 0.12] } },
    title: { anchor: [0.45, 0.29], size: 0.3, maxW: 0.5, align: 'center', zones: { label: [0.08, 0.52, 0.74, 0.04], title: [0.08, 0.56, 0.74, 0.11] } },
    end: { anchor: [0.45, 0.2], size: 0.2, maxW: 0.5, align: 'center', zones: {
      logo: [0.1, 0.36, 0.7, 0.07], brand: [0.1, 0.43, 0.7, 0.035],
      line1: [0.1, 0.48, 0.7, 0.045], line2: [0.1, 0.53, 0.7, 0.05], line3: [0.1, 0.59, 0.7, 0.06], line4: [0.1, 0.66, 0.7, 0.045] } },
  },
};
