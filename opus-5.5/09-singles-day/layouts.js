// layouts.js — 每种比例 × 每个镜头的构图：大屏锚点（画面比例坐标，y 向下）、占画面高度、文字区 [x, y, w, h]、对齐
// 09 的「主体」是全屏数据大屏（星座+弧线），所以 anchor 基本居中、size≈满屏；字幕/里程碑/片尾卡放各自的区
// 9:16 避开平台右侧图标列与底部标题带，只粗排（不交付）；只交付 16:9 和 1:1

export const LAYOUTS = {
  '9x16': {
    countdown: { anchor: [0.45, 0.5], size: 1.0, align: 'center', zones: { cap: [0.1, 0.72, 0.72, 0.08], count: [0.1, 0.34, 0.72, 0.3] } },
    ignite: { anchor: [0.45, 0.5], size: 1.0, align: 'center', zones: { cap: [0.1, 0.72, 0.72, 0.08] } },
    arcs: { anchor: [0.45, 0.5], size: 1.0, align: 'center', zones: { cap: [0.1, 0.72, 0.72, 0.08] } },
    gmv: { anchor: [0.45, 0.44], size: 1.0, align: 'center', zones: { cap: [0.1, 0.72, 0.72, 0.08], counter: [0.08, 0.4, 0.76, 0.16] } },
    milestone: { anchor: [0.45, 0.5], size: 1.0, align: 'center', zones: { mile: [0.08, 0.44, 0.74, 0.12] } },
    end: { anchor: [0.45, 0.3], size: 0.5, align: 'center', zones: { logo: [0.1, 0.48, 0.7, 0.08], brand: [0.1, 0.56, 0.7, 0.04], line1: [0.1, 0.62, 0.7, 0.06], line2: [0.1, 0.69, 0.7, 0.08], line3: [0.1, 0.78, 0.7, 0.05] } },
  },
  '1x1': {
    countdown: { anchor: [0.5, 0.46], size: 1.0, align: 'center', zones: { cap: [0.08, 0.82, 0.84, 0.1], count: [0.1, 0.32, 0.8, 0.32] } },
    ignite: { anchor: [0.5, 0.46], size: 1.0, align: 'center', zones: { cap: [0.08, 0.82, 0.84, 0.1] } },
    arcs: { anchor: [0.5, 0.46], size: 1.0, align: 'center', zones: { cap: [0.08, 0.82, 0.84, 0.1] } },
    gmv: { anchor: [0.5, 0.4], size: 1.0, align: 'center', zones: { cap: [0.08, 0.82, 0.84, 0.1], counter: [0.06, 0.42, 0.88, 0.16] } },
    milestone: { anchor: [0.5, 0.46], size: 1.0, align: 'center', zones: { mile: [0.06, 0.42, 0.88, 0.16] } },
    end: { anchor: [0.5, 0.3], size: 0.52, align: 'center', zones: { logo: [0.1, 0.5, 0.8, 0.1], brand: [0.1, 0.6, 0.8, 0.05], line1: [0.1, 0.67, 0.8, 0.07], line2: [0.1, 0.74, 0.8, 0.11], line3: [0.1, 0.85, 0.8, 0.07] } },
  },
  '16x9': {
    countdown: { anchor: [0.5, 0.5], size: 1.0, align: 'center', zones: { cap: [0.3, 0.82, 0.4, 0.1], count: [0.3, 0.3, 0.4, 0.36] } },
    ignite: { anchor: [0.5, 0.5], size: 1.0, align: 'center', zones: { cap: [0.3, 0.82, 0.4, 0.1] } },
    arcs: { anchor: [0.5, 0.5], size: 1.0, align: 'center', zones: { cap: [0.3, 0.82, 0.4, 0.1] } },
    gmv: { anchor: [0.5, 0.44], size: 1.0, align: 'center', zones: { cap: [0.3, 0.82, 0.4, 0.1], counter: [0.2, 0.42, 0.6, 0.16] } },
    milestone: { anchor: [0.5, 0.5], size: 1.0, align: 'center', zones: { mile: [0.12, 0.44, 0.76, 0.14] } },
    end: { anchor: [0.72, 0.5], size: 0.6, align: 'left', zones: { logo: [0.07, 0.2, 0.45, 0.16], brand: [0.07, 0.36, 0.45, 0.07], line1: [0.07, 0.5, 0.45, 0.08], line2: [0.07, 0.59, 0.45, 0.13], line3: [0.07, 0.73, 0.45, 0.08] } },
  },
};
