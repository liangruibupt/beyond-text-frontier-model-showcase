// film.js — 琉光成片模板：数据（轴、剪辑表、字幕区、字体）+ 画面（js/glass.js 的几遍全屏着色器，不用 3D 场景）+ 五个镜头
// 镜头函数只算「屏幕状态」（js/motion.js，纯函数）写进 ctx.subjects.frame；render 先画界面画布（js/ui.js）再叠玻璃
import { META, SHOTS } from './meta.js';
import { LAYOUTS, UI } from './layouts.js';
import { layersFor, fontsFor } from './captions.js';
import { themeOf, voLines, AUDITION } from './copy.js';
import { stateAt } from './js/motion.js';
import { createUI } from './js/ui.js';
import { createGlass } from './js/glass.js';
import { score } from './js/score.js';
import { ASPECTS } from '../factory/engine/variant.js';

// 画面整个是着色器画的，引擎的取景只需要一个固定的相机
const CAMERA = { type: 'free', position: [0, 0, 5], target: [0, 0, 0], fov: 30 };
// 后期：Neutral 色调映射（浅色的渐变不压灰），轻微的泛光给玻璃高光，暗角和颗粒都很轻
export const POST = { tone: 'neutral', vignette: 0.1, grain: 0.012, bloom: { strength: 0.14, radius: 0.5, threshold: 0.9 } };
const aspectOf = ar => ASPECTS[ar][0] / ASPECTS[ar][1];

const shot = name => (ctx, s) => {
  const F = stateAt(name, UI[ctx.ar], aspectOf(ctx.ar), s.lt, ctx.subjects.ui.clockEm());
  F.t = s.t;
  ctx.subjects.frame = F;
  return { camera: CAMERA, text: layersFor(ctx.variant, s) };
};

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const theme = themeOf(ctx.variant), ui = createUI(ctx, theme);
    ctx.postDefaults = POST;
    ctx.subjects = { theme, ui, glass: createGlass(ctx, theme, ui.texture), frame: null };
    ctx.world = { dispose() { ctx.subjects.ui?.dispose(); ctx.subjects.glass?.dispose(); } };
  },
  /** 每次求值镜头前清掉上一次的屏幕状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) { ctx.subjects.frame = null; },
  render(ctx, target) {
    const { ui, glass, frame } = ctx.subjects;
    ui.draw(frame, UI[ctx.ar], aspectOf(ctx.ar), ctx.variant);
    glass.render(target, frame);
  },
  /** 配乐与音效的音符表（js/score.js），由 factory/engine/audio.js 合成 */
  score,
  voLines,
  audition: AUDITION,
  shots: Object.fromEntries(SHOTS.map(n => [n, shot(n)])),
};
