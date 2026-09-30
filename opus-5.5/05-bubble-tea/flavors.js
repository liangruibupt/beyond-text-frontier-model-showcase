// flavors.js — 四款口味：名称、意象句、配料、价格（整数：配音的 sayNum 只读整数）、茶汤光学参数、珍珠材质、背景与文字配色（纯数据）
// liquid.absorb：茶汤每米的 RGB 吸收（比尔–朗伯）；liquid.scatter：乳浊度（1/米，越大越不透明，走得越远越接近 liquid.color）
// liquid.band：茶汤顶上那一层清茶的厚度（米），透过它能看见杯里的珍珠和冰块；milk：奶花的颜色
// pearl：珍珠的颜色、透明度（爆爆珠半透明）；bg：背景渐变 [上, 下]；palette：文字与按钮的配色

export const FLAVORS = {
  brownsugar: {
    name: { zh: '黑糖珍珠', en: 'Brown Sugar Boba' },
    image: { zh: '黑糖慢炒，珍珠现煮', en: 'Slow-cooked sugar, fresh pearls' },
    pour: { zh: '虎纹挂壁，鲜奶冲下', en: 'Tiger stripes, fresh milk' },
    parts: { zh: ['真茶', '鲜奶', '现煮珍珠'], en: ['Real tea', 'Fresh milk', 'Fresh pearls'] },
    price: { CNY: 22, USD: 7 }, deal: { CNY: 15, USD: 5 },
    liquid: { color: '#c79a6b', absorb: [18, 34, 60], scatter: 90, band: 0.006 }, milk: '#f3e6d4', syrup: '#3a1a0a', stripes: true,
    pearl: { color: '#1b0d07', roughness: 0.18, clear: 0 },
    bg: ['#f1e2cf', '#c79a6b'],
    palette: { ink: '#2b140a', soft: '#6a4630', accent: '#8a4a22', cta: '#2b140a', ctaInk: '#fbf2e6', shadow: 'rgba(255,248,238,0.55)' },
  },
  jasmine: {
    name: { zh: '茉莉奶绿', en: 'Jasmine Milk Green' },
    image: { zh: '茉莉初开，奶香清透', en: 'Jasmine in bloom, light and clear' },
    pour: { zh: '清茶打底，鲜奶冲下', en: 'Green tea, fresh milk' },
    parts: { zh: ['茉莉绿茶', '鲜奶', '白玉珍珠'], en: ['Jasmine tea', 'Fresh milk', 'Pearl jelly'] },
    price: { CNY: 19, USD: 6 }, deal: { CNY: 13, USD: 4 },
    liquid: { color: '#c9dc9c', absorb: [26, 7, 34], scatter: 48, band: 0.012 }, milk: '#f4f7e4', syrup: null, stripes: false,
    pearl: { color: '#f4f5ea', roughness: 0.1, clear: 0.55 },
    bg: ['#e9f0dc', '#86ad73'],
    palette: { ink: '#1f3522', soft: '#557058', accent: '#5f9a5a', cta: '#1f3522', ctaInk: '#f4f9ee', shadow: 'rgba(255,255,250,0.6)' },
  },
  strawberry: {
    name: { zh: '草莓啵啵', en: 'Strawberry Popping Boba' },
    image: { zh: '草莓现捣，一口爆开', en: 'Fresh strawberry, a pop in every sip' },
    pour: { zh: '果泥打底，鲜奶冲下', en: 'Berry base, fresh milk' },
    parts: { zh: ['鲜草莓', '鲜奶', '爆爆珠'], en: ['Fresh berries', 'Fresh milk', 'Popping boba'] },
    price: { CNY: 23, USD: 7 }, deal: { CNY: 16, USD: 5 },
    liquid: { color: '#f2c6cf', absorb: [6, 30, 22], scatter: 70, band: 0.008 }, milk: '#fff4f4', syrup: '#c8203e', stripes: false,
    pearl: { color: '#e0304f', roughness: 0.06, clear: 0.45 },
    bg: ['#fde8ec', '#f2a7b6'],
    palette: { ink: '#4a0f1d', soft: '#8a3a4c', accent: '#d8354f', cta: '#4a0f1d', ctaInk: '#fff1f3', shadow: 'rgba(255,250,251,0.6)' },
  },
  taro: {
    name: { zh: '芋泥波波', en: 'Taro Boba' },
    image: { zh: '手捣芋泥，绵密香浓', en: 'Hand-mashed taro, rich and smooth' },
    pour: { zh: '芋泥抹壁，鲜奶冲下', en: 'Taro swirl, fresh milk' },
    parts: { zh: ['香芋', '鲜奶', '黑糖珍珠'], en: ['Taro', 'Fresh milk', 'Brown sugar boba'] },
    price: { CNY: 24, USD: 8 }, deal: { CNY: 17, USD: 5 },
    liquid: { color: '#c8b3d9', absorb: [14, 24, 10], scatter: 85, band: 0.006 }, milk: '#f6f0fa', syrup: '#9a7ab8', stripes: false,
    pearl: { color: '#1b0d07', roughness: 0.18, clear: 0 },
    bg: ['#f0e8f6', '#b89ccd'],
    palette: { ink: '#2d1b40', soft: '#63507a', accent: '#8a6aae', cta: '#2d1b40', ctaInk: '#f8f3fc', shadow: 'rgba(255,252,255,0.6)' },
  },
};
