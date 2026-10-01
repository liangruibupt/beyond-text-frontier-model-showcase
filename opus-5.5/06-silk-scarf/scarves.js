// scarves.js — 四款丝巾：名称、纹样参数、丝的材质、价格（整数：配音的 sayNum 只读整数）、文字配色、每个镜头的字幕（纯数据）
// pattern：纹样生成器的名字（js/pattern.js）和它的配色；silk：sheen / anisotropy 等材质参数
// caps：这一款分镜里每个镜头的字幕 { [镜头 id]: { zh, en } }，镜头 id 见 meta.js 的 BOARDS
import { sayNum } from '../factory/engine/say.js';

export const SCARVES = {
  dunhuang: {
    name: { zh: '敦煌 · 藻井', en: 'Dunhuang Ceiling', say: { zh: '敦煌藻井', en: 'Dunhuang Ceiling' } },
    pattern: { kind: 'zaojing', colors: ['#2f6f73', '#b5442e', '#c99a3b', '#efe2c4', '#1d2b3a'] },
    silk: { color: '#ffffff', sheen: 1, sheenColor: '#ffe7b8', sheenRoughness: 0.35, roughness: 0.42, anisotropy: 0.6 },
    caps: {
      dh_cave: { zh: '风起敦煌', en: 'Wind over Dunhuang' },
      dh_fly: { zh: '千年飞天', en: 'A thousand years in flight' },
      dh_ceiling: { zh: '藻井莲花，一色千年', en: 'Lotus ceiling, colours that last' },
      dh_drape: { zh: '桑蚕丝 · 十六姆米', en: 'Mulberry silk, 16 momme' },
      dh_hero: { zh: '敦煌 · 藻井', en: 'Dunhuang Ceiling' },
    },
    hook: { zh: '风起敦煌，千年飞天。', en: 'Wind over Dunhuang, a thousand years in flight.' },
    palette: { ink: '#f4e3c2', soft: '#d9b98a', accent: '#b5442e', cta: '#c99a3b', ctaInk: '#1d1208', shadow: 'rgba(12,6,2,0.7)' },
  },
  songjin: {
    name: { zh: '宋锦 · 八达晕', en: 'Song Brocade', say: { zh: '宋锦八达晕', en: 'Song Brocade' } },
    pattern: { kind: 'badayun', colors: ['#1f3a68', '#c9a24a', '#8a2f2f', '#e9dfc8', '#2e6a5a'] },
    silk: { color: '#ffffff', sheen: 1, sheenColor: '#fff1cc', sheenRoughness: 0.3, roughness: 0.38, anisotropy: 0.7 },
    caps: {
      sj_warp: { zh: '一梭一线', en: 'Thread by thread' },
      sj_weave: { zh: '宋锦八达晕', en: 'Song brocade, eight-way halo' },
      sj_lift: { zh: '桑蚕丝 · 十六姆米', en: 'Mulberry silk, 16 momme' },
      sj_fold: { zh: '叠作一方', en: 'Folded square' },
      sj_box: { zh: '宋锦 · 八达晕', en: 'Song Brocade' },
    },
    hook: { zh: '一梭一线，织出宋锦。', en: 'Thread by thread, a Song brocade.' },
    palette: { ink: '#1f2a44', soft: '#5a6478', accent: '#1f3a68', cta: '#1f3a68', ctaInk: '#f6efe0', shadow: 'rgba(250,246,236,0.6)' },
  },
  qinghua: {
    name: { zh: '青花 · 缠枝莲', en: 'Blue Lotus Scroll', say: { zh: '青花缠枝莲', en: 'Blue Lotus Scroll' } },
    pattern: { kind: 'chanzhi', colors: ['#f4f6f8', '#1f4fa0', '#2c3e80', '#7a9cd6'] },
    silk: { color: '#ffffff', sheen: 1, sheenColor: '#e8f0ff', sheenRoughness: 0.28, roughness: 0.35, anisotropy: 0.6 },
    caps: {
      qh_paint: { zh: '一笔青花', en: 'One stroke of blue' },
      qh_bloom: { zh: '缠枝不断', en: 'An endless lotus scroll' },
      qh_slip: { zh: '从瓷上来，落在身上', en: 'From porcelain to you' },
      qh_pool: { zh: '桑蚕丝 · 十六姆米', en: 'Mulberry silk, 16 momme' },
      qh_hero: { zh: '青花 · 缠枝莲', en: 'Blue Lotus Scroll' },
    },
    hook: { zh: '一笔青花，缠枝不断。', en: 'One stroke of blue, a lotus without end.' },
    palette: { ink: '#16295a', soft: '#4d6290', accent: '#1f4fa0', cta: '#1f4fa0', ctaInk: '#f4f6f8', shadow: 'rgba(255,255,255,0.6)' },
  },
  yunhe: {
    name: { zh: '云鹤', en: 'Cloud Crane', say: { zh: '云鹤', en: 'Cloud Crane' } },
    pattern: { kind: 'yunhe', colors: ['#b8322a', '#f1ece0', '#e8c27a', '#2a2a3a'] },
    silk: { color: '#ffffff', sheen: 1, sheenColor: '#ffd8c8', sheenRoughness: 0.32, roughness: 0.4, anisotropy: 0.6 },
    caps: {
      yh_dusk: { zh: '云间一鹤', en: 'A crane among clouds' },
      yh_crane: { zh: '振翅', en: 'Wings open' },
      yh_glide: { zh: '朱红月白，云纹仙鹤', en: 'Vermilion and moon-white' },
      yh_land: { zh: '桑蚕丝 · 十六姆米', en: 'Mulberry silk, 16 momme' },
      yh_hero: { zh: '云鹤', en: 'Cloud Crane' },
    },
    hook: { zh: '云间一鹤，振翅而来。', en: 'A crane among the clouds, wings open.' },
    palette: { ink: '#f6ebdc', soft: '#e3c9a8', accent: '#b8322a', cta: '#e8c27a', ctaInk: '#2a1410', shadow: 'rgba(20,10,20,0.7)' },
  },
};
// 价格四款一样：¥399 → 双11 ¥299；$59 → $45（英文双11 不在交付里，只为数据完整）
for (const k of Object.values(SCARVES)) Object.assign(k, { price: { CNY: 399, USD: 59 }, deal: { CNY: 299, USD: 45 } });
export { sayNum };
