// StartideShowcase.tsx — 09 星潮双11 数据大屏 · video-shotcraft 电影版（15s/1920×1080/30fps）
// 分镜（Opus 5.5 导演复审版）：6→0 零点开抢 → 全国订单汇流 → 成交曲线冲破量程 →
// ¥10亿·1分36秒 礼炮 → 10.00亿 里程表锁定 → 68 国 → 星潮 STARTIDE
// 镜头时长按各 demo 的真实时间轴给足：绝对帧 demo 的高潮帧都落在镜头内。
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate } from 'remotion';
import { CountdownArcScatter } from '../demos/typography/countdown-arc-scatter/CountdownArcScatter';
import { DatavizLandscapeOpen } from '../demos/opening/dataviz-landscape-open/DatavizLandscapeOpen';
import { AxisRescaleShockV2 } from '../demos/data/chart-live-moves/AxisRescaleShockV2';
import { ConfettiCrossfire } from '../demos/data/particle-celebrate-hits/ConfettiCrossfire';
import { OdometerDigitRoll } from '../demos/data/odometer-digit-roll/OdometerDigitRoll';
import { CounterConfetti } from '../demos/data/counter-confetti/CounterConfetti';
import { WhiteFlashLogoSimplifyCut } from '../demos/transition/white-flash-logo-simplify-cut/WhiteFlashLogoSimplifyCut';
import { CutFlash, FilmLook, ShotCam } from './Cinematic';

type Shot = { from: number; dur: number; C: React.FC; drift: number; push: number; punch: number; blur: number };
// 绝对帧 demo 的关键帧：Dataviz 汇点亮 f118+；Axis 重标 f90、标签 f108；Confetti 发射 f16；Odometer 锁定 f63、标签 f66–84
const SHOTS: Shot[] = [
  { from: 0,   dur: 40,  C: CountdownArcScatter,       drift: -1, push: 0.04, punch: 0.05, blur: 0 }, // 0.0–1.3 归一化
  { from: 40,  dur: 95,  C: DatavizLandscapeOpen,      drift: 0,  push: 0.02, punch: 0,    blur: 0 }, // 1.3–4.5 自带横移
  { from: 135, dur: 118, C: AxisRescaleShockV2,        drift: 1,  push: 0.05, punch: 0.04, blur: 3 }, // 4.5–8.4 ≥f108 标签
  { from: 253, dur: 40,  C: ConfettiCrossfire,         drift: 0,  push: 0.03, punch: 0.08, blur: 0 }, // 8.4–9.8 f16 发射
  { from: 293, dur: 75,  C: OdometerDigitRoll,         drift: -1, push: 0.06, punch: 0.04, blur: 0 }, // 9.8–12.3 f63 锁定
  { from: 368, dur: 30,  C: CounterConfetti,           drift: 1,  push: 0.04, punch: 0.06, blur: 0 }, // 12.3–13.3 归一化：0→68 国
  { from: 398, dur: 52,  C: WhiteFlashLogoSimplifyCut, drift: 0,  push: 0.03, punch: 0,    blur: 0 }, // 13.3–15.0 归一化
];

const CUTS = [
  { at: 40, color: '#5fd0ff', k: 0.4 },
  { at: 135, color: '#ffffff', k: 0.45 },
  { at: 253, color: '#ffd84a', k: 0.55 },
  { at: 293, color: '#5fd0ff', k: 0.4 },
  { at: 368, color: '#ffd84a', k: 0.45 },
];

// 配音（national Kokoro，Opus 5.5 复审后重新生成）：hook 对齐 0 落定；hero 在订单汇流镜头；片尾句
const VO: [number, string][] = [
  [22, 'vo/national_zh_15_hook.mp3'],          // 零点！全国点亮。
  [70, 'vo/national_zh_15_hero.mp3'],          // 每秒十万笔，奔向八大仓。
  [380, 'vo/national_zh_15_end_none.mp3'],     // 星潮双十一，峰值由你点亮。
];
const VO_SPAN: [number, number][] = [[22, 66], [70, 136], [380, 450]];

const SFX: [number, string, number][] = [
  [0, 'riser-cine.mp3', 0.3],
  [40, 'whoosh-big.mp3', 0.4],
  [135, 'transition-snap.mp3', 0.4],
  [135 + 62, 'impact-cine.mp3', 0.7], // 曲线冲顶
  [135 + 90, 'whoosh-fast.mp3', 0.4], // 重标
  [253 + 16, 'impact-cine.mp3', 0.8], // 礼炮
  [253 + 17, 'sparkle.mp3', 0.45],
  [293, 'transition-snap.mp3', 0.35],
  [293 + 63, 'impact-cine.mp3', 0.6], // 里程表锁定
  [368, 'transition-soft.mp3', 0.45],
];
const duck = (f: number) => (VO_SPAN.some(([a, b]) => f >= a && f < b) ? 0.6 : 1);

export const StartideShowcase: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#06101c' }}>
    {SHOTS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur}>
        <ShotCam dur={s.dur} drift={s.drift} push={s.push} punch={s.punch} blur={s.blur}>
          <s.C />
        </ShotCam>
      </Sequence>
    ))}
    <CutFlash cuts={CUTS} />
    <FilmLook leak="95,208,255" vignette={0.42} />
    {VO.map(([f, file], i) => (
      <Sequence key={`v${i}`} from={f}>
        <Audio src={staticFile(file)} volume={1} />
      </Sequence>
    ))}
    {SFX.map(([f, file, vol], i) => (
      <Sequence key={`a${i}`} from={f}>
        <Audio src={staticFile(`audio/${file}`)} volume={(lf) => vol * duck(f + lf) * interpolate(lf, [0, 2], [0.6, 1], { extrapolateRight: 'clamp' })} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const STARTIDE_SHOWCASE_DURATION = 450; // 15s @30fps
