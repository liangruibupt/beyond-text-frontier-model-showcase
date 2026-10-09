// film.js — 双11 零点大屏 成片模板：把数据（轴、剪辑表、构图、字体）、场景（Three.js 大屏）和六个镜头交给引擎
// 方法一 code-authored：大屏是 XY 平面上的实例化星座 + 弧线（js/screen.js），每帧由镜头本地时间确定性驱动
import { META } from './meta.js';
import { THEMES } from './themes.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { buildScreen } from './js/screen.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const { THREE, scene } = ctx;
    const theme = THEMES[ctx.variant.theme];
    scene.background = new THREE.Color(theme.bg);
    // 大屏是自发光平面（加法混合），只需环境光一点点，不需要定向光
    scene.add(new THREE.AmbientLight('#ffffff', 1.0));
    const screen = buildScreen(THREE, theme);
    scene.add(screen.root);
    ctx.subjects = { screen };
    ctx.postDefaults = { bloom: 0.4, vignette: 0.35, exposure: 1.0 };
  },
  /** 复位逐帧可变状态：跳着看与顺序播放得到同一帧。大屏每帧由 shot 的 draw() 全量重写实例，这里只复位相机无关量 */
  reset(ctx) {
    ctx.subjects.screen?.draw(0, { nodeLit: 0, density: 0, hubPulse: 0 });
  },
  shots: SHOTS,
  score,
  voLines,
  audition: AUDITION,
};
