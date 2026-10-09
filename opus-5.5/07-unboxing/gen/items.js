// items.js — 07 两款开箱产品：名称、价格、配色、每镜头字幕、配音 hook（纯数据）
// 品牌「开物 KAIWU」(虚构)。caps: { [shot id]: { zh, en } }，shot id 见 meta.js BOARDS。
export const ITEMS = {
  laptop: {
    name: { zh: '开物 · 轻金属本', en: 'KAIWU Ultrabook', say: { zh: '开物轻金属本', en: 'KAIWU Ultrabook' } },
    palette: { ink: '#eef2f6', accent: '#3a6ea5', cta: '#c9a24a', ctaInk: '#10151c', soft: '#9fb3c8' },
    price: { CNY: 6999, USD: 999 }, deal: { CNY: 5999, USD: 899 },
    caps: {
      lap_tape:   { zh: '开箱时刻', en: 'The moment' },
      lap_flaps:  { zh: '层层开启', en: 'Layer by layer' },
      lap_tissue: { zh: '', en: '' },
      lap_rise:   { zh: '轻薄全金属', en: 'All-metal unibody' },
      lap_hero:   { zh: '开物 · 轻金属本', en: 'KAIWU Ultrabook' },
    },
    hook: { zh: '开物开箱，见证开启。', en: 'KAIWU unboxing — the moment it opens.' },
    hero: { zh: '全金属轻薄本。', en: 'An all-metal ultrabook.' },
  },
  drone: {
    name: { zh: '开物 · 掌心无人机', en: 'KAIWU Drone', say: { zh: '开物掌心无人机', en: 'KAIWU Drone' } },
    palette: { ink: '#e8f0f8', accent: '#2a6ad0', cta: '#4db6e6', ctaInk: '#08121f', soft: '#8aa6c4' },
    price: { CNY: 3999, USD: 599 }, deal: { CNY: 3299, USD: 499 },
    caps: {
      drn_tape:   { zh: '开箱时刻', en: 'The moment' },
      drn_flaps:  { zh: '层层开启', en: 'Layer by layer' },
      drn_tissue: { zh: '', en: '' },
      drn_rise:   { zh: '展翼即飞', en: 'Ready to fly' },
      drn_hero:   { zh: '开物 · 掌心无人机', en: 'KAIWU Drone' },
    },
    hook: { zh: '开物开箱，见证开启。', en: 'KAIWU unboxing — the moment it opens.' },
    hero: { zh: '掌心无人机，展翼即飞。', en: 'A palm-sized drone, ready to fly.' },
  },
};
