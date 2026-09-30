// styles.js — 四款口味各自的「片子风格」（纯数据，浏览器与 Node 测试共用）：世界、字体、字幕的处理、机位与运镜、配乐
// 杯子、珍珠、奶纹这套引擎四款共用；剪辑表、命中点、配音时段也共用（配音不用重生成）。不同的是这里的每一项：
//   brownsugar 深夜糖铺：暗调、琥珀色侧逆光、旧木吧台、蒸汽；衬线招牌字；机位低、慢推；lo-fi 爵士
//   jasmine    清晨茶席：亮调、窗格斜光、亚麻茶席、茉莉枝与落花；文楷竖排诗句；机位高、平移；古筝 + 长笛
//   strawberry 夏日波普：纯色硬光、几何色块、飞进来的草莓片；粗圆体贴纸字；荷兰角、推拉快；泡泡糖流行（双倍节奏）
//   taro       紫雾云朵：柔焦、雾团与光斑、漂浮的芋块；细体淡入淡出；机位绕、慢；梦幻合成器 + 钢片琴

// yaw / pitch 在 VIEW 的基础上加减（度）；roll = 相机滚转（度，荷兰角）；push = 镜头里 scale 从 [起, 止]（≤ 1：构图表里的大小是上限）
export const STYLES = {
  brownsugar: {
    world: 'syrup',
    fonts: {
      zh: { display: { family: 'Noto Serif SC', weight: 900, fallback: 'serif' }, body: { family: 'Noto Serif SC', weight: 600, fallback: 'serif' } },
      en: { display: { family: 'Playfair Display', weight: 700, fallback: 'serif' }, body: { family: 'Playfair Display', weight: 700, fallback: 'serif' } },
      brand: { family: 'Playfair Display', weight: 700, fallback: 'serif' },
    },
    caption: { tracking: 0.14, box: 'rule', vertical: false, glow: 'rgba(255,170,80,0.55)', ink: '#f6dcb4', soft: '#c89a6a' },
    camera: { pitch: -4, yaw: 8, roll: 0, push: [0.93, 1] },
    post: { exposure: 0.82, vignette: 0.42, grain: 0.015, saturation: 1.08, lift: [0.01, 0.005, 0], gain: [1.04, 0.98, 0.9], bloom: { strength: 0.35, threshold: 0.75 } },
  },
  jasmine: {
    world: 'teatable',
    fonts: {
      zh: { display: { family: 'LXGW WenKai', weight: 700, fallback: 'serif' }, body: { family: 'LXGW WenKai', weight: 700, fallback: 'serif' } },
      en: { display: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' }, body: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' } },
      brand: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' },
    },
    caption: { tracking: 0.2, box: null, vertical: true, glow: 'rgba(255,255,248,0.7)', ink: '#24402a', soft: '#5f7f62' },
    camera: { pitch: 10, yaw: -10, roll: 0, push: [1, 0.96] },
    post: { exposure: 0.98, vignette: 0.14, grain: 0.015, saturation: 0.96, lift: [0.02, 0.025, 0.02], gain: [0.98, 1.0, 0.97], bloom: { strength: 0.28, threshold: 0.82 } },
  },
  strawberry: {
    world: 'pop',
    fonts: {
      zh: { display: { family: 'ZCOOL KuaiLe', weight: 400, fallback: 'sans-serif' }, body: { family: 'ZCOOL KuaiLe', weight: 400, fallback: 'sans-serif' } },
      en: { display: { family: 'Baloo 2', weight: 800, fallback: 'sans-serif' }, body: { family: 'Baloo 2', weight: 600, fallback: 'sans-serif' } },
      brand: { family: 'Baloo 2', weight: 800, fallback: 'sans-serif' },
    },
    caption: { tracking: 0.02, box: 'sticker', vertical: false, glow: null, ink: '#ffffff', soft: '#fff1f3', sticker: '#e8284a', stickerInk: '#ffffff' },
    camera: { pitch: 0, yaw: 14, roll: -7, push: [1, 0.86] },
    post: { exposure: 1.06, vignette: 0.05, grain: 0.0, saturation: 1.22, lift: [0, 0, 0.01], gain: [1.02, 1.0, 1.0], bloom: { strength: 0.1, threshold: 0.95 } },
  },
  taro: {
    world: 'cloud',
    fonts: {
      zh: { display: { family: 'Noto Sans SC', weight: 300, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 300, fallback: 'sans-serif' } },
      en: { display: { family: 'Quicksand', weight: 500, fallback: 'sans-serif' }, body: { family: 'Quicksand', weight: 500, fallback: 'sans-serif' } },
      brand: { family: 'Quicksand', weight: 700, fallback: 'sans-serif' },
    },
    caption: { tracking: 0.32, box: null, vertical: false, glow: 'rgba(255,240,255,0.9)', ink: '#3a2754', soft: '#7a64a0', fadeOut: true },
    camera: { pitch: 6, yaw: -22, roll: 0, push: [0.94, 1], orbit: 1.8 },
    post: { exposure: 0.98, vignette: 0.2, grain: 0.01, saturation: 1.12, lift: [0.02, 0.01, 0.04], gain: [1.0, 0.97, 1.04], bloom: { strength: 0.35, threshold: 0.78, radius: 0.8 }, aperture: 0.12, maxBlur: 0.004 },
  },
};

/** 每款字体的 CDN 样式表（index.html 按变体加载）：fontsource 的包名 + 字重 */
export const FONT_CSS = {
  'Noto Sans SC': 'noto-sans-sc', 'Noto Serif SC': 'noto-serif-sc', 'LXGW WenKai': 'lxgw-wenkai', 'ZCOOL KuaiLe': 'zcool-kuaile',
  Fredoka: 'fredoka', 'Playfair Display': 'playfair-display', 'Cormorant Garamond': 'cormorant-garamond', 'Baloo 2': 'baloo-2', Quicksand: 'quicksand',
};
