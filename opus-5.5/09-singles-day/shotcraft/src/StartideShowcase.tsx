// StartideShowcase.tsx — 09 数据大屏的 video-shotcraft 对比样片（15s/1920×1080/30fps）
// 把 7 张镜头卡的 demo 实现按叙事串起来：倒计时 → 数据景观开场 → 图表冲击 → 粒子庆祝 →
// 里程碑计数 → odometer 数字滚动 → 片尾闪白 logo。电影感来自各卡调校过的缓动/节拍。
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { CountdownArcScatter } from '../demos/typography/countdown-arc-scatter/CountdownArcScatter';
import { DatavizLandscapeOpen } from '../demos/opening/dataviz-landscape-open/DatavizLandscapeOpen';
import { AxisRescaleShockV2 } from '../demos/data/chart-live-moves/AxisRescaleShockV2';
import { ConfettiCrossfire } from '../demos/data/particle-celebrate-hits/ConfettiCrossfire';
import { CounterConfetti } from '../demos/data/counter-confetti/CounterConfetti';
import { OdometerDigitRoll } from '../demos/data/odometer-digit-roll/OdometerDigitRoll';
import { WhiteFlashLogoSimplifyCut } from '../demos/transition/white-flash-logo-simplify-cut/WhiteFlashLogoSimplifyCut';

// 镜头表（帧 @30fps）：起点 + 时长；相邻略有重叠靠闪白转场衔接
const SHOTS: { from: number; dur: number; C: React.FC }[] = [
  { from: 0,   dur: 45,  C: CountdownArcScatter },   // 0.0–1.5 倒计时归零
  { from: 45,  dur: 75,  C: DatavizLandscapeOpen },  // 1.5–4.0 数据景观开场（订单星座点亮）
  { from: 120, dur: 70,  C: AxisRescaleShockV2 },    // 4.0–6.3 图表轴缩放冲击（弧线汇聚）
  { from: 190, dur: 60,  C: ConfettiCrossfire },     // 6.3–8.3 粒子庆祝（命中点）
  { from: 250, dur: 90,  C: CounterConfetti },       // 8.3–11.3 里程碑计数爆屏
  { from: 340, dur: 60,  C: OdometerDigitRoll },     // 11.3–13.3 GMV odometer 数字滚动
  { from: 400, dur: 50,  C: WhiteFlashLogoSimplifyCut }, // 13.3–15.0 片尾闪白 logo
];

export const StartideShowcase: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0e14' }}>
      {SHOTS.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          <s.C />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const STARTIDE_SHOWCASE_DURATION = 450; // 15s @30fps
