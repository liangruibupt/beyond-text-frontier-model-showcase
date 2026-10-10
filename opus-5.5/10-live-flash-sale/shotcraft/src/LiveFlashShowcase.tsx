// LiveFlashShowcase.tsx — 10 直播间秒杀的 video-shotcraft 对比样片（15s/1920×1080/30fps）
// 叙事：商品上架 → 抢购倒计时 → 价格暴跌冲击 → 库存条清零 → 已抢光庆祝 → 片尾 logo
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ProductCardProgressiveAssemble } from '../demos/ui-entrance/product-card-progressive-assemble/ProductCardProgressiveAssemble';
import { CountdownArcScatter } from '../demos/typography/countdown-arc-scatter/CountdownArcScatter';
import { CelFlashStomp } from '../demos/typography/cel-flash-stomp/CelFlashStomp';
import { NeedleSweepSelftest } from '../demos/data/gauge-readout-moves/NeedleSweepSelftest';
import { CounterConfetti } from '../demos/data/counter-confetti/CounterConfetti';
import { WhiteFlashLogoSimplifyCut } from '../demos/transition/white-flash-logo-simplify-cut/WhiteFlashLogoSimplifyCut';

const SHOTS: { from: number; dur: number; C: React.FC }[] = [
  { from: 0,   dur: 70,  C: ProductCardProgressiveAssemble }, // 0.0–2.3 商品上架
  { from: 70,  dur: 45,  C: CountdownArcScatter },            // 2.3–3.8 抢购倒计时
  { from: 115, dur: 55,  C: CelFlashStomp },                  // 3.8–5.7 价格暴跌冲击「¥359」
  { from: 170, dur: 85,  C: NeedleSweepSelftest },            // 5.7–8.5 库存条清零
  { from: 255, dur: 95,  C: CounterConfetti },                // 8.5–11.7 已抢光庆祝
  { from: 350, dur: 100, C: WhiteFlashLogoSimplifyCut },      // 11.7–15.0 片尾 logo
];

export const LiveFlashShowcase: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#0a0e14' }}>
    {SHOTS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur}>
        <s.C />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const LIVE_FLASH_SHOWCASE_DURATION = 450;
