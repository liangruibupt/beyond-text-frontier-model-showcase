// layouts.js — 每种比例 × 每个镜头的构图：锚点（画面比例坐标，y 向下）、占高、文字区 [x, y, w, h]、对齐
// 画面是直播间：转台上的商品是 3D 主体，图形（弹幕滚动、倒计时数字、红包、库存条、弹窗底板、印章）画进相机前的
// CanvasTexture 平面（js/overlay.js），文字（直播间信息、字幕、上链接、价格、仅剩 N 件、已抢光、片尾卡）走引擎文字层。
// 只交付 16:9 和 1:1，9:16 是粗排（从 1:1 起）。9:16 避开抖音 / 淘宝的红区（variant.js 的 UNSAFE）：
// 上 7%、右侧中段 [0.86,0.34]~[1,0.86]、下 18%。字幕 / 文字区都躲开这些。
// 弹幕带限定在画面上方 40%（§H），商品构图避开这一条；库存 / 价格落在下半屏。

// 片尾卡：一块米白底板托住品牌 + 价签（场景再亮也看得清），放在 end 镜头下半部，商品挪到上方（§C）
const END_169 = { card: [0.3, 0.3, 0.4, 0.6], logo: [0.33, 0.34, 0.34, 0.12], brand: [0.33, 0.46, 0.34, 0.05], line1: [0.33, 0.54, 0.34, 0.08], line2: [0.33, 0.63, 0.34, 0.12], line3: [0.33, 0.77, 0.34, 0.07] };
const END_11 = { card: [0.1, 0.52, 0.8, 0.44], logo: [0.14, 0.55, 0.72, 0.1], brand: [0.14, 0.645, 0.72, 0.045], line1: [0.14, 0.7, 0.72, 0.07], line2: [0.14, 0.77, 0.72, 0.11], line3: [0.14, 0.885, 0.72, 0.06] };
const END_916 = { card: [0.1, 0.5, 0.76, 0.3], logo: [0.13, 0.52, 0.7, 0.08], brand: [0.13, 0.6, 0.7, 0.035], line1: [0.13, 0.645, 0.7, 0.05], line2: [0.13, 0.695, 0.7, 0.075], line3: [0.13, 0.77, 0.7, 0.045] };

// 直播间外框文字区（chrome，整片常驻）：左上「有集直播」+ 在线人数，LIVE 标。都在上 7% 之下、避开右侧红条。
const CHROME_169 = { room: [0.045, 0.08, 0.3, 0.05], live: [0.045, 0.08, 0.1, 0.05] };
const CHROME_11 = { room: [0.05, 0.085, 0.46, 0.06], live: [0.05, 0.085, 0.14, 0.06] };
const CHROME_916 = { room: [0.06, 0.09, 0.5, 0.055], live: [0.06, 0.09, 0.16, 0.055] };

// 顶部弹幕带（上 40%，但 9:16 从 8% 起避开状态栏红区）——弹幕是画进 overlay 的，这里不放文字区，只记录。
// 字幕带（镜头说明）放在中下部的 cap 区，避开商品也避开红区。

export const LAYOUTS = {
  '16x9': {
    room: { anchor: [0.5, 0.52], size: 0.6, align: 'center', zones: { ...CHROME_169, cap: [0.2, 0.78, 0.6, 0.12] } },
    count: { anchor: [0.5, 0.46], size: 0.6, align: 'center', zones: { ...CHROME_169, link: [0.25, 0.6, 0.5, 0.14] } },
    cart: { anchor: [0.5, 0.4], size: 0.42, align: 'left', zones: { ...CHROME_169, cartName: [0.3, 0.56, 0.3, 0.07], cartPrice: [0.3, 0.63, 0.4, 0.12], cartWas: [0.3, 0.75, 0.4, 0.06], cartCta: [0.62, 0.64, 0.14, 0.1] } },
    rain: { anchor: [0.5, 0.44], size: 0.52, align: 'center', zones: { ...CHROME_169, cap: [0.2, 0.76, 0.6, 0.12], coupon: [0.4, 0.5, 0.2, 0.08] } },
    stock: { anchor: [0.5, 0.4], size: 0.5, align: 'center', zones: { ...CHROME_169, only: [0.3, 0.66, 0.4, 0.07], soldout: [0.28, 0.42, 0.44, 0.16] } },
    end: { anchor: [0.5, 0.3], size: 0.4, align: 'center', zones: { ...CHROME_169, ...END_169 } },
  },
  '1x1': {
    room: { anchor: [0.5, 0.5], size: 0.62, align: 'center', zones: { ...CHROME_11, cap: [0.1, 0.82, 0.8, 0.12] } },
    count: { anchor: [0.5, 0.44], size: 0.62, align: 'center', zones: { ...CHROME_11, link: [0.18, 0.62, 0.64, 0.14] } },
    cart: { anchor: [0.5, 0.36], size: 0.44, align: 'center', zones: { ...CHROME_11, cartName: [0.12, 0.58, 0.5, 0.07], cartPrice: [0.12, 0.65, 0.6, 0.12], cartWas: [0.12, 0.77, 0.6, 0.06], cartCta: [0.66, 0.66, 0.2, 0.1] } },
    rain: { anchor: [0.5, 0.42], size: 0.54, align: 'center', zones: { ...CHROME_11, cap: [0.1, 0.82, 0.8, 0.12], coupon: [0.36, 0.5, 0.28, 0.09] } },
    stock: { anchor: [0.5, 0.38], size: 0.52, align: 'center', zones: { ...CHROME_11, only: [0.2, 0.72, 0.6, 0.08], soldout: [0.2, 0.42, 0.6, 0.18] } },
    end: { anchor: [0.5, 0.3], size: 0.42, align: 'center', zones: { ...CHROME_11, ...END_11 } },
  },
  '9x16': {
    room: { anchor: [0.5, 0.46], size: 0.56, align: 'center', zones: { ...CHROME_916, cap: [0.1, 0.68, 0.76, 0.12] } },
    count: { anchor: [0.5, 0.42], size: 0.56, align: 'center', zones: { ...CHROME_916, link: [0.15, 0.56, 0.6, 0.12] } },
    cart: { anchor: [0.5, 0.34], size: 0.42, align: 'center', zones: { ...CHROME_916, cartName: [0.1, 0.56, 0.5, 0.06], cartPrice: [0.1, 0.62, 0.6, 0.1], cartWas: [0.1, 0.72, 0.6, 0.05], cartCta: [0.6, 0.63, 0.22, 0.09] } },
    rain: { anchor: [0.5, 0.4], size: 0.5, align: 'center', zones: { ...CHROME_916, cap: [0.1, 0.68, 0.76, 0.12], coupon: [0.34, 0.46, 0.3, 0.08] } },
    stock: { anchor: [0.5, 0.36], size: 0.5, align: 'center', zones: { ...CHROME_916, only: [0.15, 0.64, 0.6, 0.07], soldout: [0.15, 0.4, 0.6, 0.16] } },
    end: { anchor: [0.5, 0.28], size: 0.38, align: 'center', zones: { ...CHROME_916, ...END_916 } },
  },
};
