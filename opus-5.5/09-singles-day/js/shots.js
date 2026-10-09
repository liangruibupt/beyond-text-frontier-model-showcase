// shots.js — 六个镜头：每个镜头只由镜头本地时间 s.lt / 进度 s.u 决定大屏相位、相机意图与字幕
// 大屏是 XY 平面上的一块板，相机正视（dir [0,0,1]）；镜头靠 anchor/size（layouts）与轻微推拉做运镜
import { layersFor } from '../captions.js';
import { THEMES } from '../themes.js';
import { FONTS, T, sayNum } from '../copy.js';
import { ss, easeInOut, easeOut, clamp } from '../../factory/engine/ease.js';

// 正视大屏的相机意图：box = 大屏板；dir 轻微侧移做环绕感；scale 推拉
const cam = (ctx, { scale = 1, dir = [0, 0, 1] } = {}) => ({ box: ctx.subjects.screen.box, dir, up: [0, 1, 0], fov: 32, scale });
const text = (ctx, s) => layersFor(ctx.variant, s);

// 倒计时大数字（countdown 专用覆盖层）：3·2·1·0 每 0.75 秒一跳
function countdownLayer(v, s) {
  const n = Math.max(0, 3 - Math.floor(s.lt / 0.75));            // 3,2,1,0
  const label = n > 0 ? String(n) : '0';
  return {
    lang: 'en', id: 'count', zone: 'count', text: label, font: FONTS.num, size: 0.2, align: 'center', valign: 'middle',
    color: THEMES[v.theme].node, shadow: { color: THEMES[v.theme].glow, blur: 0.8 }, maxLines: 1,
    in: [s.from, s.from + 0.05], pop: true,
  };
}

// GMV 滚动数字（gmv 专用覆盖层）
function gmvLayer(ctx, s) {
  const v = ctx.variant, th = THEMES[v.theme];
  const val = ctx.subjects.screen.gmvAt(s.lt, s.dur, th.gmvTarget);
  const shown = th.gmvUnit === '国' ? `${val}` : th.gmvUnit === '单/分' ? val.toLocaleString('en-US') : `${th.gmvUnit}${val.toLocaleString('en-US')}`;
  return {
    lang: 'en', id: 'counter', zone: 'counter', text: shown, font: FONTS.num, size: 0.09, align: 'center', valign: 'middle',
    color: th.node, shadow: { color: th.glow, blur: 0.6 }, maxLines: 1, in: [s.from, s.from + 0.05],
  };
}

export const SHOTS = {
  // 1 倒计时：大数字跳动，背景星座微弱呼吸待命
  countdown(ctx, s) {
    ctx.subjects.screen.draw(0, { nodeLit: 0.12 + 0.05 * Math.sin(s.lt * 6), density: 0, hubPulse: 0 });
    return { camera: cam(ctx, { scale: 1.04 - 0.02 * s.u }), text: [...text(ctx, s), countdownLayer(ctx.variant, s)] };
  },
  // 2 点亮：归零瞬间星座依次点亮（波纹），弧线开始飞起
  ignite(ctx, s) {
    const lit = easeOut(ss(0, 1.6, s.lt));
    const density = ss(0.75, 2.6, s.lt) * 0.4;
    ctx.subjects.screen.draw(s.lt + 2.25, { nodeLit: lit, density, hubPulse: 0 });
    return { camera: cam(ctx, { scale: 1.02 - 0.02 * s.u }), text: text(ctx, s), post: { bloom: 0.4 } };
  },
  // 3 弧线：密度升到峰值，仓库到达脉冲，轻微环绕
  arcs(ctx, s) {
    const density = 0.4 + 0.6 * easeInOut(ss(0, 1.0, s.lt));       // 分批升到峰值（6.0 落拍）
    const hubPulse = Math.max(0, Math.sin((s.lt - 0.0) * 4)) * ss(0.4, 0.6, (s.lt % 1.5) / 1.5);
    ctx.subjects.screen.draw(s.lt + 5.25, { nodeLit: 1, density, hubPulse });
    const yaw = Math.sin(s.u * Math.PI) * 0.12;
    return { camera: cam(ctx, { dir: [yaw, 0.04, 1], scale: 1.0 + 0.06 * s.u }), text: text(ctx, s), post: { bloom: 0.5 } };
  },
  // 4 GMV：硬切到计数器主视角，背景弧线虚化流动
  gmv(ctx, s) {
    ctx.subjects.screen.draw(s.lt + 8.25, { nodeLit: 1, density: 0.5, hubPulse: 0 });
    return { camera: cam(ctx, { scale: 0.92 }), text: [...text(ctx, s), gmvLayer(ctx, s)], post: { bloom: 0.35, vignette: 0.4 } };
  },
  // 5 里程碑爆屏：全亮背景闪 + 大字冲入
  milestone(ctx, s) {
    const flash = 1 - clamp(s.lt / 0.6);
    ctx.subjects.screen.draw(s.lt + 11.25, { nodeLit: 1 + flash, density: 1, hubPulse: flash });
    return { camera: cam(ctx, { scale: 1.0 }), text: text(ctx, s), post: { bloom: 0.6 + 0.4 * flash, exposure: 1.0 + 0.3 * flash } };
  },
  // 6 片尾：大屏收束成品牌卡，缓慢呼吸
  end(ctx, s) {
    const breathe = 0.9 + 0.03 * Math.sin(s.lt * 1.5);
    ctx.subjects.screen.draw(s.lt + 12.0, { nodeLit: 1, density: 0.18, hubPulse: 0 });
    return { camera: cam(ctx, { scale: breathe }), text: text(ctx, s), post: { bloom: 0.3, vignette: 0.5 } };
  },
};
