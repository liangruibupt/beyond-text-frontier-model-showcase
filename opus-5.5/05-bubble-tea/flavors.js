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
    palette: { ink: '#f6dcb4', soft: '#c89a6a', accent: '#c9782f', cta: '#f0b060', ctaInk: '#2a1206', shadow: 'rgba(20,8,2,0.75)' },
  },
  jasmine: {
    name: { zh: '茉莉奶绿', en: 'Jasmine Milk Green' },
    image: { zh: '茉莉初开，奶香清透', en: 'Jasmine in bloom, light and clear' },
    pour: { zh: '清茶打底，鲜奶冲下', en: 'Green tea, fresh milk' },
    parts: { zh: ['茉莉绿茶', '鲜奶', '白玉珍珠'], en: ['Jasmine tea', 'Fresh milk', 'Pearl jelly'] },
    price: { CNY: 19, USD: 6 }, deal: { CNY: 13, USD: 4 },
    liquid: { color: '#9fc25a', absorb: [44, 9, 58], scatter: 40, band: 0.012 }, milk: '#eef4d6', syrup: null, stripes: false,
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
    liquid: { color: '#ef8fa3', absorb: [6, 46, 32], scatter: 55, band: 0.008 }, milk: '#fde4e8', syrup: '#c8203e', stripes: false,
    pearl: { color: '#e0304f', roughness: 0.06, clear: 0.45 },
    bg: ['#fbe3e8', '#e7889c'],
    palette: { ink: '#5a0a1e', soft: '#8a1f38', accent: '#e8284a', cta: '#ffd23f', ctaInk: '#5a0a1e', shadow: 'rgba(255,255,255,0)' },
  },
  taro: {
    name: { zh: '芋泥波波', en: 'Taro Boba' },
    image: { zh: '手捣芋泥，绵密香浓', en: 'Hand-mashed taro, rich and smooth' },
    pour: { zh: '芋泥抹壁，鲜奶冲下', en: 'Taro swirl, fresh milk' },
    parts: { zh: ['香芋', '鲜奶', '黑糖珍珠'], en: ['Taro', 'Fresh milk', 'Brown sugar boba'] },
    price: { CNY: 24, USD: 8 }, deal: { CNY: 17, USD: 5 },
    liquid: { color: '#ad8ccb', absorb: [22, 38, 12], scatter: 65, band: 0.006 }, milk: '#efe4f6', syrup: '#9a7ab8', stripes: false,
    pearl: { color: '#1b0d07', roughness: 0.18, clear: 0 },
    bg: ['#ece2f4', '#9f7fbd'],
    palette: { ink: '#2d1b40', soft: '#63507a', accent: '#8a6aae', cta: '#2d1b40', ctaInk: '#f8f3fc', shadow: 'rgba(255,252,255,0.6)' },
  },
};
