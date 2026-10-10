// js/world-ai.js — AI 画面变体（beans-ai / lantern-ai）的「世界」：不建 3D 场景，而是用 LTX 生成的实拍画面当底图。
// 对引擎暴露的接口和 world.js 完全一样（{ post, update, reset, dispose }），再多两个给 film.render 用的方法：
//   cue(shot, lt)  —— AI 版镜头函数（shots-ai.js）每帧调用，记下「现在该画哪一段的第几秒」
//   drawInto(target) —— film.render 调用，把当前这一帧实拍画面画进后期的 sceneRT
// 画面之外的一切（字幕、价签、片尾卡、配音、配乐、剪辑表）都沿用基准商品（beans / lantern），所以只是『换了张底图』。
// 帧目录：out/ai/<基准商品>/frames/<shot>_<ar>/（beans-gen.py 的输出，GEN_OUT 决定子目录）
import { createVideoBackground, clipKey } from '../../factory/engine/video.js';
import { baseItem, isBeans, isHeadset } from '../items.js';
import { SHOTS as PARCEL_SHOTS } from '../meta.js';
import { SHOTS as BEANS_SHOTS } from '../stories/beans/meta.js';
import { SHOTS as HEADSET_SHOTS } from '../stories/headset/meta.js';

// 底图不需要景深 / 泛光（LTX 画面自带）：关掉引擎景深、泛光，保留轻微颗粒与暗角让叠层统一。
export const AI_POST = { aperture: 0, maxBlur: 0, bloom: { strength: 0, radius: 0.4, threshold: 1 }, vignette: 0.12, grain: 0.015 };

/** 片段帧目录的 URL 前缀（相对站点根，serve.mjs 的 ROOT = opus-5.5/） */
export const framesUrl = itemId => `/08-parcel-journey/out/ai/${baseItem(itemId)}/frames`;

export function build(ctx, item) {
  const ar = ctx.ar;
  // 加载这条故事线全部镜头（当前比例）：场景按 (item, ar) 复用（meta.sceneAxes），同一页面换剪辑表也不缺片段
  const shots = isBeans(item.id) ? BEANS_SHOTS : isHeadset(item.id) ? HEADSET_SHOTS : PARCEL_SHOTS;
  const keys = shots.map(s => clipKey(s, ar));
  const bg = createVideoBackground({ baseUrl: framesUrl(item.id), keys });
  const first = () => ({ key: keys[0], lt: 0 });
  let cue = first();

  return {
    post: AI_POST,
    ar,
    /** world.setup 内 await：拉清单 + 预载全部帧图，确保出片前就位 */
    async load() { await bg.load(); return this; },
    /** AI 版没有逐帧模拟状态；画面由 cue + drawInto 决定 */
    update() {},
    reset() { cue = first(); },
    /** AI 版镜头函数每帧调用：记下当前镜头与镜头本地秒 */
    cue(shot, lt) { cue = { key: clipKey(shot, ar), lt: Math.max(0, lt) }; },
    /** film.render 调用：把 cue 指定的那一帧画进 target */
    drawInto(target) {
      if (!bg.has(cue.key)) throw new Error(`${item.id}: clip ${cue.key} not loaded`);
      return bg.draw(ctx.renderer, target, cue);
    },
    dispose() { bg.dispose(); },
  };
}
