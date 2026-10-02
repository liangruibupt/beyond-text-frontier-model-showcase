// stories/beans/world-ai.js — 咖啡豆 AI 变体（beans-ai）的「世界」：不建 3D 场景，而是用 LTX 生成的实拍画面当底图。
// 对引擎暴露的接口和 world.js 完全一样（{ post, update, reset, dispose }），再多两个给 film.render 用的方法：
//   cue(shot, lt)  —— AI 版镜头函数（shots-ai.js）每帧调用，记下「现在该画哪一段的第几秒」
//   drawInto(target) —— film.render 调用，把当前这一帧实拍画面画进后期的 sceneRT
// 画面之外的一切（字幕、价签、片尾卡、配音、配乐、剪辑表、构图）都沿用代码版 beans，所以只是『换了张底图』。
import { createVideoBackground, clipKey } from '../../../factory/engine/video.js';
import { SHOTS } from './meta.js';

// 底图不需要景深 / 泛光（LTX 画面自带），也不要调色叠加太重：关掉引擎景深、泛光，保留轻微颗粒与暗角让叠层统一。
// 片比例由变体决定，帧目录按 <shot>_<ar> 取（beans-gen.py 的输出）。
export const AI_POST = { aperture: 0, maxBlur: 0, bloom: { strength: 0, radius: 0.4, threshold: 1 }, vignette: 0.12, grain: 0.015 };

/** 这一变体（剪辑表）用到的镜头 → 片段 key 列表（只加载需要的，省内存/时间） */
export function keysForCut(cut, ar) {
  return cut.shots.map(e => clipKey(e.shot, ar));
}

export function build(ctx, item) {
  const ar = ctx.ar;
  const baseUrl = `/08-parcel-journey/out/ai/beans/frames`;   // 相对站点根（serve.mjs 的 ROOT = opus-5.5/）
  // 本变体剪辑表里出现的镜头，才加载其片段
  const cut = ctx.built ?? null;
  const shotsInCut = cut ? [...new Set(cut.entries.map(e => e.shot))] : SHOTS;
  const keys = [...new Set(shotsInCut.map(s => clipKey(s, ar)))];
  const bg = createVideoBackground({ baseUrl, keys });

  let cue = { key: clipKey(SHOTS[0], ar), lt: 0 };

  const handle = {
    post: AI_POST,
    ar,
    /** world.setup 内 await：拉清单 + 预载全部帧图，确保出片前就位 */
    async load() { await bg.load(); return this; },
    /** 引擎每次求值镜头前复位；AI 版没有逐帧模拟状态，只记一下故事时间（用不到，占位保持接口一致） */
    update() { /* 画面由 cue + drawInto 决定；这里无状态可复位 */ },
    reset() { cue = { key: clipKey(SHOTS[0], ar), lt: 0 }; },
    /** AI 版镜头函数每帧调用：记下当前镜头与镜头本地秒 */
    cue(shot, lt) { cue = { key: clipKey(shot, ar), lt: Math.max(0, lt) }; },
    /** film.render 调用：把 cue 指定的那一帧画进 target */
    drawInto(target) {
      const renderer = ctx.renderer;
      if (!bg.has(cue.key)) throw new Error(`beans-ai: clip ${cue.key} not loaded`);
      return bg.draw(renderer, target, cue);
    },
    dispose() { bg.dispose(); },
  };
  return handle;
}
