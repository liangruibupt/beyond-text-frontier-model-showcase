// layouts.js — 每种比例 × 每个镜头的构图：锚点（画面比例坐标，y 向下）、占高、文字区 [x, y, w, h]、对齐。
// 直播间的图形与大部分文字画在相机前的 overlay（js/overlay.js），所以这里的文字区只剩引擎文字层用到的几个：
// cap（镜头说明字幕）、coupon（已领券章）、片尾卡（card/logo/brand/line1-3）。anchor/size 决定取景。
// 只交付 16:9 和 1:1，9:16 是粗排。9:16 避开抖音 / 淘宝红区（variant.js 的 UNSAFE）：上 7%、右侧中段、下 18%。

// 片尾卡：米白底板托住品牌 + 价签，放在 end 镜头下半部，商品挪到上方。
const END_169 = { card: [0.3, 0.3, 0.4, 0.6], logo: [0.33, 0.34, 0.34, 0.12], brand: [0.33, 0.46, 0.34, 0.05], line1: [0.33, 0.54, 0.34, 0.08], line2: [0.33, 0.63, 0.34, 0.12], line3: [0.33, 0.77, 0.34, 0.07] };
// AI 变体 16:9：LTX 的 end 镜头把商品放在右侧、左半留干净负空间，片尾卡挪到左半（区名带 _l，captions 按变体选）
const END_169_L = { card_l: [0.05, 0.22, 0.4, 0.6], logo_l: [0.08, 0.26, 0.34, 0.12], brand_l: [0.08, 0.38, 0.34, 0.05], line1_l: [0.08, 0.46, 0.34, 0.08], line2_l: [0.08, 0.55, 0.34, 0.12], line3_l: [0.08, 0.69, 0.34, 0.07] };
const END_11 = { card: [0.1, 0.52, 0.8, 0.44], logo: [0.14, 0.55, 0.72, 0.1], brand: [0.14, 0.645, 0.72, 0.045], line1: [0.14, 0.7, 0.72, 0.07], line2: [0.14, 0.77, 0.72, 0.11], line3: [0.14, 0.885, 0.72, 0.06] };
const END_916 = { card: [0.1, 0.5, 0.76, 0.3], logo: [0.13, 0.52, 0.7, 0.08], brand: [0.13, 0.6, 0.7, 0.035], line1: [0.13, 0.645, 0.7, 0.05], line2: [0.13, 0.695, 0.7, 0.075], line3: [0.13, 0.77, 0.7, 0.045] };

const CAP_169 = { cap: [0.2, 0.78, 0.6, 0.12] }, CAP_11 = { cap: [0.1, 0.82, 0.8, 0.12] }, CAP_916 = { cap: [0.1, 0.68, 0.76, 0.12] };
const COUP_169 = { coupon: [0.4, 0.5, 0.2, 0.08] }, COUP_11 = { coupon: [0.36, 0.5, 0.28, 0.09] }, COUP_916 = { coupon: [0.34, 0.46, 0.3, 0.08] };

export const LAYOUTS = {
  '16x9': {
    room: { anchor: [0.5, 0.52], size: 0.6, zones: CAP_169 },
    count: { anchor: [0.5, 0.46], size: 0.6, zones: {} },
    cart: { anchor: [0.5, 0.4], size: 0.42, zones: {} },
    rain: { anchor: [0.5, 0.44], size: 0.52, zones: { ...CAP_169, ...COUP_169 } },
    stock: { anchor: [0.5, 0.4], size: 0.5, zones: {} },
    end: { anchor: [0.5, 0.3], size: 0.4, zones: { ...END_169, ...END_169_L } },
  },
  '1x1': {
    room: { anchor: [0.5, 0.5], size: 0.62, zones: CAP_11 },
    count: { anchor: [0.5, 0.44], size: 0.62, zones: {} },
    cart: { anchor: [0.5, 0.36], size: 0.44, zones: {} },
    rain: { anchor: [0.5, 0.42], size: 0.54, zones: { ...CAP_11, ...COUP_11 } },
    stock: { anchor: [0.5, 0.38], size: 0.52, zones: {} },
    end: { anchor: [0.5, 0.3], size: 0.42, zones: END_11 },
  },
  '9x16': {
    room: { anchor: [0.5, 0.46], size: 0.56, zones: CAP_916 },
    count: { anchor: [0.5, 0.42], size: 0.56, zones: {} },
    cart: { anchor: [0.5, 0.34], size: 0.42, zones: {} },
    rain: { anchor: [0.5, 0.4], size: 0.5, zones: { ...CAP_916, ...COUP_916 } },
    stock: { anchor: [0.5, 0.36], size: 0.5, zones: {} },
    end: { anchor: [0.5, 0.28], size: 0.38, zones: END_916 },
  },
};
