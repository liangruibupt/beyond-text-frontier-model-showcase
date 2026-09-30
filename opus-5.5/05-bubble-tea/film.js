// film.js — 啵茶成片模板：把数据（轴、剪辑表、构图、字体）、场景（影棚 + 奶茶杯）和六个镜头交给引擎（见 factory/README.md 的成片约定）
import { META } from './meta.js';
import { FLAVORS } from './flavors.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { FONTS, voLines, AUDITION } from './copy.js';
import { build as buildWorld } from './js/world.js';
import { buildCup, lidArt } from './js/cup.js';
import { bakePearls } from './js/pearls.js';
import { createTea } from './js/tea.js';
import { attachMilk } from './js/milk.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { envMap } from '../03-perfume/js/worlds/common.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const flavor = FLAVORS[ctx.variant.flavor];
    ctx.world = buildWorld(ctx, flavor);
    ctx.scene.environment = envMap(ctx.renderer, ctx.world.env);     // 世界只描述反射环境，这里才生成
    ctx.postDefaults = ctx.world.post ?? {};
    await Promise.all([document.fonts.load(`${FONTS.zh.display.weight} 64px "${FONTS.zh.display.family}"`, '啵茶'), document.fonts.load(`${FONTS.brand.weight} 64px "${FONTS.brand.family}"`, 'BOCHA')]);
    const pearls = bakePearls(), cup = buildCup(ctx, flavor, pearls, { art: lidArt(FONTS, flavor.palette) });
    ctx.scene.add(cup.root);
    const tea = createTea(ctx, cup, flavor);
    ctx.subjects = { cup, pearls, tea, milk: attachMilk(cup.parts.body.material, flavor) };   // createTea 已把茶汤换成折射材质，奶纹接在它后面
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) {
    const { cup, milk } = ctx.subjects;
    cup.pose(); cup.root.rotation.y = 0; milk(1);
    ctx.world.reset?.();
  },
  /** 场景目标里分几遍画：世界 → 冰块 → 茶汤 → 杯壁（js/tea.js） */
  render(ctx, target) { ctx.subjects.tea.render(target); },
  shots: SHOTS,
  /** 配乐与音效的音符表（js/score.js），由 factory/engine/audio.js 合成 */
  score,
  /** 配音台词（copy.js）：factory/vo.mjs 按它生成 assets/vo/，引擎按它把片段排进混音 */
  voLines,
  audition: AUDITION,
};
