// themes.js — 琉光的三款主题（虚构）：壁纸的弥散渐变、界面配色、价格（纯数据，颜色都是设计稿上的 sRGB）
// wall：底色两端 [左上, 右下] + 五团柔光色斑 { c 颜色, at 画面比例位置, r 半径（画面高度的倍数）, drift 漂移幅度 }
// ink 字色，shadow 字影，cta 按钮底色 / 字色，accent 点缀（日历的星期、进度条），art 专辑封面的两色

export const THEMES = {
  iris: {
    name: { zh: '鸢尾', en: 'Iris' },
    wall: {
      ends: ['#3b5ff0', '#c9b8ff'],
      blobs: [
        { c: '#2544d8', at: [0.12, 0.18], r: 0.55, drift: 0.06 },
        { c: '#7f8dff', at: [0.52, 0.4], r: 0.5, drift: 0.08 },
        { c: '#dccfff', at: [0.88, 0.82], r: 0.6, drift: 0.05 },
        { c: '#a48cf6', at: [0.26, 0.92], r: 0.45, drift: 0.07 },
        { c: '#f1ecff', at: [0.74, 0.12], r: 0.32, drift: 0.05 },
      ],
    },
    ink: '#ffffff', shadow: '#1d2a8a', accent: '#ff6f91', cta: ['#ffffff', '#3b4fd6'], art: ['#6f7dff', '#f0a6ff'],
  },
  dawn: {
    name: { zh: '晨桃', en: 'Dawn' },
    wall: {
      ends: ['#ffb27c', '#ee5f8c'],
      blobs: [
        { c: '#ffcf9c', at: [0.14, 0.16], r: 0.55, drift: 0.06 },
        { c: '#ff8b7c', at: [0.5, 0.42], r: 0.5, drift: 0.08 },
        { c: '#e8527f', at: [0.86, 0.84], r: 0.58, drift: 0.05 },
        { c: '#ffc3cf', at: [0.28, 0.9], r: 0.45, drift: 0.07 },
        { c: '#fff0e4', at: [0.76, 0.12], r: 0.32, drift: 0.05 },
      ],
    },
    ink: '#ffffff', shadow: '#9a2f4f', accent: '#ffffff', cta: ['#ffffff', '#d9486f'], art: ['#ffb46b', '#ff5f8f'],
  },
  mint: {
    name: { zh: '薄荷', en: 'Mint' },
    wall: {
      ends: ['#2cbad6', '#a6efcf'],
      blobs: [
        { c: '#1797c4', at: [0.12, 0.18], r: 0.55, drift: 0.06 },
        { c: '#56dccd', at: [0.5, 0.4], r: 0.5, drift: 0.08 },
        { c: '#c6fbe2', at: [0.86, 0.82], r: 0.6, drift: 0.05 },
        { c: '#79cdef', at: [0.26, 0.92], r: 0.45, drift: 0.07 },
        { c: '#eefff7', at: [0.74, 0.12], r: 0.32, drift: 0.05 },
      ],
    },
    ink: '#ffffff', shadow: '#0d6478', accent: '#ffffff', cta: ['#ffffff', '#11889c'], art: ['#39c6e0', '#b7f5b0'],
  },
};

// 价格：日常价与双11 到手价（CNY 元 / USD 美元，都是整数：配音读得出来）
export const PRICE = { price: { CNY: 12, USD: 2 }, deal: { CNY: 6, USD: 1 } };
