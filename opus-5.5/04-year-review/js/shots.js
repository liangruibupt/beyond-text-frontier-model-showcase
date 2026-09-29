// shots.js — 六个镜头：每个镜头只由镜头本地时间 s.lt 决定主体的动作、相机意图和字幕（主体见 scene.js）
// 框取对象、仰角、方位角都写在 meta.js 的 VIEW 表里（layouts 测试也用它），这里只管随时间怎么动；
// 画面接着上一镜头的地方（meta.js 的 joinOf），开头的机位从上一镜头的终点机位缓过来
import * as THREE from 'three';
import { SHOTS as NAMES, VIEW, BOX, endBox, viewDir, joinOf } from '../meta.js';
import { LAYOUTS } from '../layouts.js';
import { layersFor } from '../captions.js';
import { lerp, easeInOut } from '../../factory/engine/ease.js';

const box3 = ([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
const BOXES = Object.fromEntries(Object.entries(BOX).map(([k, b]) => [k, box3(b)]));
/** 镜头框取的盒子：片尾按促销换（1111 是推荐的商品） */
export const boxOf = (name, v) => (name === 'end' ? endBox(v.promo) : VIEW[name].box);
export const EASE_IN = 0.9;                                           // 接缝处机位缓过来用的秒数

/** 按 VIEW 表框取；方位角随镜头进度 u 从起值缓动到止值 */
function fit(name, u, v) {
  const V = VIEW[name];
  return { type: 'fit', box: BOXES[boxOf(name, v)], dir: viewDir(V.pitch, lerp(V.yaw[0], V.yaw[1], easeInOut(u))), fov: V.fov };
}
/** 在 fit 之外改相机意图：open 慢推，主体从 90% 线性长到 100% */
const PUSH = { open: u => ({ scale: lerp(0.9, 1, u) }) };

/**
 * 镜头 name 的相机意图。接缝处开头 EASE_IN 秒是 blend：a 是上一镜头的终点机位（带上它那一行构图的锚点和大小，
 * 因为 blend 的两头都按本镜头的构图行求解），b 是本镜头的；所以接缝两边的第一帧和最后一帧机位完全一样
 */
export function cameraOf(name, s, v, ar) {
  const b = { ...fit(name, s.u, v), ...PUSH[name]?.(s.u) }, prev = joinOf(v.cut, name), k = easeInOut(s.lt / EASE_IN);
  if (!prev || k >= 1) return b;
  const row = LAYOUTS[ar][prev];
  return { type: 'blend', a: { ...fit(prev, 1, v), ...PUSH[prev]?.(1), anchor: row.anchor, size: row.size, maxW: row.maxW }, b, k };
}

/** 各镜头露出的主体 */
const SHOW = {
  open: () => ['wall'], count: () => ['wall', 'pile'], months: () => ['bars'],
  top: v => (joinOf(v.cut, 'top') ? ['bars', 'top'] : ['top']), title: () => ['medal'], end: v => [endBox(v.promo)],
};
/** 各镜头的主体随时间怎么动；cam 是本镜头的 fit（奖牌的闪光朝它的机位方向） */
const ACT = {
  open: (S, s) => S.wall.pose(s.lt),
  count: (S, s) => S.pile.pose(s.lt),
  months: (S, s) => S.chart.pose(s.lt),
  top: (S, s) => { S.chart.sink(s.lt); S.top.pose(s.lt); },
  title: (S, s, cam) => S.medal.drop(s.lt, cam.dir),
  end: (S, s) => { S.medal.rest(s.lt); S.stand.pose(s.lt); },
};
/** 镜头的后期（泛光门限是全片的，见 scene.js）。接缝两边一样，泛光不跳 */
const glow = (strength, radius) => ({ bloom: { strength, radius } });
const POST = { open: glow(0.45, 0.5), count: glow(0.45, 0.5), months: glow(0.4, 0.5), top: glow(0.4, 0.5), title: glow(0.55, 0.55), end: glow(0.45, 0.5) };

export const SHOTS = Object.fromEntries(NAMES.map(name => [name, (ctx, s) => {
  const v = ctx.variant, S = ctx.subjects, camera = cameraOf(name, s, v, ctx.ar);
  S.show(...SHOW[name](v));
  ACT[name](S, s, camera.type === 'blend' ? camera.b : camera);
  return { camera, text: layersFor(v, s), post: POST[name] };
}]));
