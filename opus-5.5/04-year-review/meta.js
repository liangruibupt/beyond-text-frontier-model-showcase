// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、各主体的包围盒与机位、文件命名

export const BAR = 3.0, GRID = 0.75;                   // 80 bpm，一小节 3 秒；命中点都落在 0.75 秒（一拍）的网格上
export const SHOTS = ['open', 'count', 'months', 'top', 'title', 'end'];
// 镜头内部的事件（镜头本地秒），镜头、字幕和配乐共用：
// open 方块按日子顺序翻面 · count 数字滚完、包裹落地 · months 柱子依次升起、最高的一根亮起 ·
// top 饼块扫出、最大的一块滑出、商品落进购物车 · title 奖牌落地
export const EV = { flip: [0.15, 1.85], land: 0.75, rise: [0.1, 1.3], peak: 1.5, sweep: [0.2, 0.9], slide: [0.9, 1.2], cart: 1.5, medal: 0.25 };

export const CUTS = {
  15: {
    shots: [
      { shot: 'open', dur: 2.25 }, { shot: 'count', dur: 2.25 }, { shot: 'months', dur: 3 }, { shot: 'top', dur: 3 },
      { shot: 'title', dur: 1.5, transition: { type: 'flash', dur: 0.2 } },
      { shot: 'end', dur: 3, transition: { type: 'dissolve', dur: 0.4 } },
    ],
    hits: { land: 3.0, peak: 6.0, cart: 9.0, medal: 10.5, logo: 12.0 }, cover: 9.4,
  },
  6: {
    shots: [
      { shot: 'count', dur: 1.5 },
      { shot: 'top', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } },
      { shot: 'end', dur: 3, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { land: 0.75, cart: 2.25, logo: 3.0 }, cover: 3.4,
  },
};

// 各主体的包围盒（场景单位，一块方块约 0.07），按真实模型量的（test/subjects.test.mjs 查每个主体一直在盒子里）：
// open 的方块墙（四个数字）、count 落定的包裹堆、months 的底座和柱子、top 的饼图和购物车（车停下之后）、奖牌、片尾转台上的商品
export const BOX = {
  wall: [[-2.55, 0.15, -0.06], [2.55, 1.75, 0.06]],
  pile: [[-0.65, 0, -0.65], [0.65, 0.82, 0.65]],
  bars: [[-2.6, 0, -0.3], [2.6, 2.13, 0.31]],
  top: [[-1.0, 0, -1.0], [2.58, 1.4, 1.2]],
  medal: [[-0.55, 0, -0.2], [0.55, 1.85, 0.2]],
  product: [[-0.64, 0, -0.64], [0.64, 1.0, 0.64]],
};
// 各镜头框取的对象与机位：pitch 仰角、yaw 绕竖轴（度，[起, 止] 随镜头进度变化）。shots.js 与 layouts 测试共用
// 片尾按促销换主体：none、launch 是奖牌，1111 是推荐的商品（endBox）
export const VIEW = {
  open: { box: 'wall', pitch: 6, yaw: [0, 0], fov: 30 },
  count: { box: 'pile', pitch: 22, yaw: [-18, -12], fov: 30 },
  months: { box: 'bars', pitch: 14, yaw: [-8, -4], fov: 28 },
  top: { box: 'top', pitch: 30, yaw: [-14, -8], fov: 30 },
  title: { box: 'medal', pitch: 6, yaw: [-20, 0], fov: 28 },
  end: { box: 'medal', pitch: 8, yaw: [12, 6], fov: 28 },
};
// 画面接着上一镜头的两处：count 接 open（包裹从年份墙上跳下来），top 接 months（柱子沉下去、饼块升上来）。
// 硬切接在搭档后面、或者是全片第一个镜头（6 秒版的 count），开头的机位就从搭档的终点机位缓过来；top 接 months 时柱子也还在
export const JOIN = { count: 'open', top: 'months' };
/** cut 里镜头 name 从哪个镜头的终点接过来（没有就是 null）：从头播，且是第一个镜头或硬切接在 JOIN 的搭档后面 */
export function joinOf(cut, name) {
  const L = CUTS[cut].shots, i = L.findIndex(e => e.shot === name), e = L[i];
  if (!JOIN[name] || !e || e.from) return null;
  return i === 0 || (L[i - 1].shot === JOIN[name] && !e.transition) ? JOIN[name] : null;
}
export const endBox = promo => (promo === '1111' ? 'product' : 'medal');
const R = Math.PI / 180;
export const viewDir = (pitch, yaw) => [Math.sin(yaw * R) * Math.cos(pitch * R), Math.sin(pitch * R), Math.cos(yaw * R) * Math.cos(pitch * R)];

export const META = {
  id: '04-year-review',
  axes: { user: ['coffee', 'baby', 'camp', 'gamer'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['user'],
  cuts: CUTS,
  fileName: v => `youji_${v.user}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
