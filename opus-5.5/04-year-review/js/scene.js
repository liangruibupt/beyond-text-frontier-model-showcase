// scene.js — 场景：顾客配色的渐变背景、影棚反射环境（RoomEnvironment）、一盏投影的主光、只接影子的地面，和各镜头的主体
// 主体按 BOX 的名字：wall 方块墙（wall.js）· pile 包裹堆（pile.js）· bars 月度柱子（chart.js）· top 饼图和购物车（pie.js）·
// medal 奖牌（medal.js）· product 1111 片尾转台上的推荐商品（stand.js）。柱子和饼块用裁剪面切掉地面以下的部分
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ungrade } from '../../factory/engine/grade.js';
import { mergePost, POST_DEFAULTS } from '../../factory/engine/post.js';
import { buildWall } from './wall.js';
import { buildPile } from './pile.js';
import { buildChart } from './chart.js';
import { buildTop } from './pie.js';
import { buildMedal } from './medal.js';
import { buildStand } from './stand.js';

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * 竖向渐变的背景（上 → 下），显示出来就是设计稿的颜色：每一行按显示色插值，再反解过全片的调色（grade.js 的 ungrade）。
 * 反解出的线性色可能大于 1，所以是半浮点贴图。返回贴图和其中最亮一行的亮度（泛光的门限要高过它）
 */
function gradient([top, bottom], P) {
  const N = 64, a = rgb(top), b = rgb(bottom), data = new Uint16Array(4 * N);
  let peak = 0;
  for (let i = 0; i < N; i++) {                                        // 第 0 行在画面底部
    const k = (i + 0.5) / N, c = ungrade(b.map((x, j) => x + (a[j] - x) * k), P);
    c.forEach((x, j) => (data[4 * i + j] = THREE.DataUtils.toHalfFloat(x)));
    data[4 * i + 3] = THREE.DataUtils.toHalfFloat(1);
    peak = Math.max(peak, lum(c));
  }
  const tex = new THREE.DataTexture(data, 1, N, THREE.RGBAFormat, THREE.HalfFloatType);
  Object.assign(tex, { colorSpace: THREE.LinearSRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, needsUpdate: true });
  return { tex, peak };
}

/** 全片的后期：PBR Neutral 色调映射，顾客配色里的粉彩背景和方块不被压灰（AgX 会） */
export const TONE = { tone: 'neutral' };

/**
 * stats 是这位顾客的统计（facts.js 的 statsFor），pick 是 1111 推荐的商品（story.pick）。
 * 返回 { wall, pile, chart, top, medal, stand, show(...names), post }：show 只留下这几个主体（不给全藏）；
 * post 是全片的后期，泛光门限高过背景，只挑自发光的亮面。背景按 post 反解，镜头改曝光、调色会让背景偏离设计色
 */
export function buildScene(ctx, { pal, stats, user, pick }) {
  const { scene, renderer } = ctx, bg = gradient(pal.bg, mergePost(TONE));
  renderer.localClippingEnabled = true;
  scene.background = bg.tex;
  const room = new RoomEnvironment(), pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.3;
  pm.dispose(); room.dispose();
  scene.add(new THREE.HemisphereLight('#ffffff', pal.bg[1], 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 1.8);
  key.position.set(-2.5, 5, 4); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.radius = 5;
  scene.add(key, key.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  const wall = buildWall({ year: stats.year, days: stats.days, pal }), pile = buildPile({ wall, pal, user });
  const chart = buildChart({ months: stats.months, pal }), top = buildTop({ categories: stats.categories, item: stats.top.item, pal });
  const medal = buildMedal({ pal }), stand = buildStand({ item: pick, pal });
  const subjects = { wall: wall.root, pile: pile.root, bars: chart.root, top: top.root, medal: medal.root, product: stand.root };
  scene.add(...Object.values(subjects));
  const post = { ...TONE, bloom: { threshold: Math.max(POST_DEFAULTS.bloom.threshold, bg.peak * 1.1) } };
  return { wall, pile, chart, top, medal, stand, post, show(...names) { for (const [k, o] of Object.entries(subjects)) o.visible = names.includes(k); } };
}
