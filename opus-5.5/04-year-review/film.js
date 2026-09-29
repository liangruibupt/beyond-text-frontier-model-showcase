// film.js — 有集年度报告成片模板：把数据（轴、剪辑表、构图、字体）、场景和六个镜头交给引擎（见 factory/README.md 的成片约定）
// 模型写的文案在 stories/<user>.json（story.js 和 factory/story.mjs），字幕和配音从那里取
import { META } from './meta.js';
import { USERS } from './users.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { storyOf, statsFor } from './facts.js';
import { buildScene } from './js/scene.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { voLines, AUDITION } from './copy.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const u = ctx.variant.user, story = storyOf(u);                  // 文案缺了或过期了先在这里报错，错误里带着重新生成的命令
    ctx.subjects = buildScene(ctx, { pal: USERS[u].palette, stats: statsFor(u), user: u, pick: story.pick });
    ctx.postDefaults = ctx.subjects.post;
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) { ctx.subjects.show(); },
  shots: SHOTS,
  score,
  voLines,
  audition: AUDITION,
};
