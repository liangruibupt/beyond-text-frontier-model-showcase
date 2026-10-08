// js/world-headset-ai.js — 逐镜 AI 变体（headset-ai）的「混合世界」：七镜里只有 victory 换成 LTX 实拍底图，其余六镜仍是
// stories/headset 的代码 3D 世界。和整片 AI（beans-ai / lantern-ai，js/world-ai.js）不同——那种整片没有 3D 场景，
// 这里 3D 世界照常搭、照常逐帧更新，另外再挂一个只装 victory 片段的「视频背景」。
//
// 怎么逐镜分流（关键）：引擎每帧先跑镜头函数（film.shots[name]），再调 film.render → world.drawInto。
//   - AI 镜头（victory）的镜头函数走 shots-ai：调 world.cue(shot, lt)，把本帧标记成 'ai'；
//   - 代码镜头（defeat…lift）的镜头函数走 stories/headset：调 world.update({t})，把本帧标记成 '3d'。
// 于是 drawInto 看本帧的标记：'ai' 就把 victory 的那一帧实拍画进 target；'3d' 就照常渲染 3D 场景。
// 这样同一个 world 既能当 AI 底图又能当 3D 世界，逐镜切换，不需要引擎知道「现在是第几镜」。
//
// post（景深 / 泛光 / 颗粒 / 暗角）每镜由镜头函数各自给（shots-ai 关景深，stories/headset 开 bloom），
// 所以 world.post 只给一个温和的兜底；真正生效的是 mergePost(postDefaults, shot.post)。
import { createVideoBackground, clipKey } from '../../factory/engine/video.js';
import { build as buildHeadset } from '../stories/headset/world.js';
import { baseItem, aiShotsOf } from '../items.js';
import { AI_POST } from './world-ai.js';

/** 片段帧目录的 URL 前缀：逐镜 AI 的帧仍放在基准商品名下（headset-ai → out/ai/headset/frames） */
export const framesUrl = itemId => `/08-parcel-journey/out/ai/${baseItem(itemId)}/frames`;

export function build(ctx, item) {
  const ar = ctx.ar;
  const aiShots = aiShotsOf(item.id);                 // 逐镜 AI 要换成实拍的镜头（headset-ai = ['victory']）
  const aiSet = new Set(aiShots);
  // 3D 世界照常搭（defeat…lift 的夜城布景都在），victory 这一镜的 3D 内容生成后不会被画出来（drawInto 走实拍）
  const world3d = buildHeadset(ctx, item);
  // 只预载 AI 镜头的片段（当前比例）；victory_16x9 / victory_1x1
  const keys = aiShots.map(s => clipKey(s, ar));
  const bg = createVideoBackground({ baseUrl: framesUrl(item.id), keys });

  let mode = '3d';                                    // 本帧由谁决定画面：'ai'（实拍）或 '3d'（引擎渲染）
  let cueState = { key: keys[0] ?? null, lt: 0 };     // AI 镜头当前该画哪段第几帧

  return {
    // AI 实拍底图不需要引擎再叠景深 / 泛光；代码镜头各自的 post 由镜头函数给。兜底用温和的颗粒 + 暗角。
    post: world3d.post ?? AI_POST,
    ar,
    /** 预载 AI 片段的帧序列（在 film.setup 内 await）。3D 世界没有异步加载 */
    async load() { await bg.load(); return this; },
    /** 代码镜头每帧调用：标记本帧为 3D，并照常更新 3D 世界状态 */
    update(arg) { mode = '3d'; world3d.update(arg); },
    /** AI 镜头（shots-ai）每帧调用：标记本帧为实拍，并记下该画 victory 的第几秒 */
    cue(shot, lt) {
      if (!aiSet.has(shot)) { mode = '3d'; return; }   // 兜底：真调到非 AI 镜头的 cue 就当 3D
      mode = 'ai'; cueState = { key: clipKey(shot, ar), lt: Math.max(0, lt) };
    },
    /** 这个镜头是不是实拍（film.js 的镜头分流表据此选 shots-ai 还是 stories/headset） */
    isAiShot(name) { return aiSet.has(name); },
    reset() { mode = '3d'; cueState = { key: keys[0] ?? null, lt: 0 }; world3d.reset(); },
    /**
     * film.render 调用：本帧是 AI 镜头就把 victory 的那一帧实拍画进 target；否则照常渲染 3D 场景。
     * 返回 'ai' / '3d'，便于测试断言分流正确。
     */
    drawInto(target) {
      if (mode === 'ai') {
        if (!bg.has(cueState.key)) throw new Error(`${item.id}: clip ${cueState.key} not loaded`);
        bg.draw(ctx.renderer, target, cueState);
        return 'ai';
      }
      const { renderer, scene, camera } = ctx;
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      return '3d';
    },
    dispose() { bg.dispose(); world3d.dispose(); },
  };
}
