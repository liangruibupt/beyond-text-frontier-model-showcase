// film.js — 10 有集直播间秒杀：把数据（轴、剪辑表、构图、字体）、影棚世界和镜头交给引擎（见 factory/README.md 的成片约定）
// 背景是代码 3D 影棚（js/studio.js），图形叠在相机前的 CanvasTexture 平面上（js/overlay.js），文字走引擎文字层。
// 「motion pack」六个可复用组件在 js/pack/，都是纯函数 (t, 参数)。vo.mjs 会在 Node 里 import 本文件，顶层不能碰 window/document。
import { META } from './meta.js';
import { ITEMS } from './items.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { build as buildStudio } from './js/studio.js';
import { createOverlay } from './js/overlay.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const item = ITEMS[ctx.variant.item];
    const world = buildStudio(ctx, item);
    world.overlay = createOverlay(ctx, item);     // 相机前的图形层（Node 里是空操作壳）
    world.rows = LAYOUTS[ctx.ar] ?? {};
    ctx.world = world;
    ctx.postDefaults = world.post ?? {};
    ctx.subjects = { box: world.subjectBox };
  },
  /** 每次求值镜头前复位逐帧可变状态：转台转回 t=0；overlay 每帧自己重绘，无需复位 */
  reset(ctx) { ctx.world?.reset?.(); },
  /** 镜头函数：先把转台转到当前成片时间，再交给 shots（shots 负责取景 + 画 overlay + 字幕） */
  shots: Object.fromEntries(Object.entries(SHOTS).map(([name, fn]) => [name, (ctx, s) => {
    ctx.world?.update?.(s.t);                     // 转台按成片时间转（跨镜头连续）
    return fn(ctx, s);
  }])),
  score,
  voLines,
  audition: AUDITION,
};
