// js/world-ai.js — 整片 AI 变体（lantern-ai / headset-ai / beans-ai）的「世界」：不建 3D 影棚，每个镜头的底图都是
// LTX-2.5 生成的实拍片段（真人主播 + 直播间），按故事时间取帧（factory/engine/video.js 的 createVideoBackground）。
// 直播间图形包（外框、弹幕、倒计时、弹窗、红包雨、库存条、已抢光）仍由 js/overlay.js 画——只是不再挂在 3D 相机前，
// 而是放进一个独立的正交小场景，铺满画面，叠在底图之上（一样的画布坐标、一样清晰）。字幕 / 片尾卡 / 配音 / 配乐不变。
// 帧目录：out/ai/<基准商品>/frames/<shot>_<ar>/f%04d.png + manifest.json（ai/ltx/gen-all.py 的输出）
import * as THREE from 'three';
import { createVideoBackground, clipKey } from '../../factory/engine/video.js';
import { baseItem } from '../items.js';
import { SHOTS } from '../meta.js';
import { createOverlay } from './overlay.js';

// 实拍底图自带景深 / 光感：关掉引擎景深与泛光，只留很轻的颗粒 + 暗角把叠层和画面统一起来
export const AI_POST = { aperture: 0, maxBlur: 0, bloom: { strength: 0, radius: 0.4, threshold: 1 }, vignette: 0.12, grain: 0.012 };

/** 帧目录 URL 前缀（相对站点根，serve.mjs 的 ROOT = opus-5.5/） */
export const framesUrl = itemId => `/10-live-flash-sale/out/ai/${baseItem(itemId)}/frames`;

/** 各镜头片段的最后可用秒（帧数 / 24 减一点余量）：叠化时前一镜头会被求值到 dur 之后，钳住不越界 */
export const CLIP_MAX = { room: 2.95, count: 2.95, cart: 2.95, rain: 3.6, stock: 2.6, end: 2.95 };

export function build(ctx, item) {
  const ar = ctx.ar;
  const keys = SHOTS.map(s => clipKey(s, ar));
  const bg = createVideoBackground({ baseUrl: framesUrl(item.id), keys });
  const overlay = createOverlay(ctx, item, { scrim: true });
  // 图形层：正交相机看一块 1×1 的平面 = 整幅画面
  const ovScene = new THREE.Scene();
  const ovCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 2);
  if (overlay.plane) { overlay.plane.position.set(0, 0, -1); ovScene.add(overlay.plane); }
  const first = () => ({ key: keys[0], lt: 0 });
  let cue = first();

  return {
    post: AI_POST,
    ar,
    overlay,
    async load() { await bg.load(); return this; },
    update() {},
    reset() { cue = first(); },
    /** 镜头函数每帧调用：记下当前镜头与镜头本地秒（钳在片段长度内） */
    cue(shot, lt) { cue = { key: clipKey(shot, ar), lt: Math.min(Math.max(0, lt), CLIP_MAX[shot] ?? 2.9) }; },
    /** film.render 调用：底图画进 target，再把图形层（frame = { state, txt }）叠上去 */
    drawInto(target, frame) {
      const { renderer } = ctx;
      if (!bg.has(cue.key)) throw new Error(`${item.id}: clip ${cue.key} not loaded`);
      bg.draw(renderer, target, cue);
      if (overlay.plane && frame) {
        overlay.draw(frame.state, frame.txt);
        const prev = renderer.getRenderTarget(), ac = renderer.autoClear;
        renderer.setRenderTarget(target); renderer.autoClear = false;
        renderer.render(ovScene, ovCam);
        renderer.autoClear = ac; renderer.setRenderTarget(prev);
      }
    },
    dispose() { bg.dispose(); overlay.dispose(); },
  };
}
