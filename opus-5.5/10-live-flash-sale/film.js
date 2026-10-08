// film.js — 10 有集直播间秒杀：数据（轴、剪辑表、构图、字体）+ 影棚世界 + 镜头交给引擎（见 factory/README.md）。
// 背景是代码 3D 影棚（js/studio.js）；直播间图形包装画在相机前的 overlay（js/overlay.js），由 render() 统一重绘——
// 那里相机已 posed，平面放到景深焦距处（coc=0 → 清晰），颜色压在泛光阈值下，所以 UI 清楚、不糊不炸。
// 「motion pack」六组件在 js/pack/（纯函数 (t,参数)）；聚合成图形层数据在 js/pack/state.js。
// vo.mjs 会在 Node 里 import 本文件，顶层不能碰 window/document。
import { META } from './meta.js';
import { ITEMS } from './items.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION, overlayText } from './copy.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { build as buildStudio } from './js/studio.js';
import { createOverlay } from './js/overlay.js';
import { packState } from './js/pack/state.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const item = ITEMS[ctx.variant.item];
    const world = buildStudio(ctx, item);
    world.overlay = createOverlay(ctx, item);
    ctx.world = world;
    ctx.postDefaults = world.post ?? {};
    ctx.subjects = { box: world.subjectBox };
  },
  /** 复位逐帧可变状态：转台转回 0。overlay 每帧 render() 里整幅重绘，无需复位。 */
  reset(ctx) { ctx.world?.reset?.(); },
  /** 镜头函数：转台按成片时间转；算好这一帧的图形层数据（纯函数，确定）并暂存，供 render() 画。 */
  shots: Object.fromEntries(Object.entries(SHOTS).map(([name, fn]) => [name, (ctx, s) => {
    ctx.world?.update?.(s.t);
    if (ctx.world) {
      const state = packState(ctx.variant, s.t);
      ctx.world._frame = { state, txt: overlayText(ctx.variant, state.chrome.viewers) };
    }
    return fn(ctx, s);
  }])),
  /** 成像钩子：相机已 posed。把 overlay 平面放到焦距处并重绘图形层，再把 3D 场景画进目标（含 overlay 平面）。 */
  render(ctx, target) {
    const { renderer, scene, camera, world } = ctx;
    if (world?.overlay && world._frame) {
      // 焦距 = 相机到主体中心（和 DoF focus:'target' 一致）→ 平面放在焦面上，coc=0，清晰
      const c = world.subjectCenter ?? new ctx.THREE.Vector3(0, 0.3, 0);
      const focusDist = camera.position.distanceTo(c);
      world.overlay.draw(world._frame.state, world._frame.txt);
      world.overlay.place(camera, focusDist);
    }
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
  },
  score,
  voLines,
  audition: AUDITION,
};
