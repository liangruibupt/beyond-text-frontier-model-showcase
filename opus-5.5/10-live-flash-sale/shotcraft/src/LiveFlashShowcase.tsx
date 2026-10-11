// LiveFlashShowcase.tsx — 10「有集直播」耳机秒杀 · video-shotcraft 电影版（15s/1920×1080/30fps）
// 分镜（Opus 5.5 导演复审版）：商品上架 → 6…0 零点开抢 → 限时/秒杀/¥359 → 库存告急→已抢光 → 已抢 999 件 → 有集直播
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate } from 'remotion';
import { ProductCardProgressiveAssemble } from '../demos/ui-entrance/product-card-progressive-assemble/ProductCardProgressiveAssemble';
import { CountdownArcScatter } from '../demos/typography/countdown-arc-scatter/CountdownArcScatter';
import { CelFlashStomp } from '../demos/typography/cel-flash-stomp/CelFlashStomp';
import { NeedleSweepSelftest } from '../demos/data/gauge-readout-moves/NeedleSweepSelftest';
import { CounterConfetti } from '../demos/data/counter-confetti/CounterConfetti';
import { WhiteFlashLogoSimplifyCut } from '../demos/transition/white-flash-logo-simplify-cut/WhiteFlashLogoSimplifyCut';
import { CutFlash, FilmLook, ShotCam } from './Cinematic';

type Shot = { from: number; dur: number; C: React.FC; drift: number; push: number; punch: number; blur: number };
const SHOTS: Shot[] = [
  { from: 0,   dur: 60,  C: ProductCardProgressiveAssemble, drift: 1,  push: 0.05, punch: 0,    blur: 0 },
  { from: 60,  dur: 45,  C: CountdownArcScatter,            drift: -1, push: 0.04, punch: 0.05, blur: 0 },
  { from: 105, dur: 75,  C: CelFlashStomp,                  drift: 0,  push: 0,    punch: 0.08, blur: 0 }, // 锁机位
  { from: 180, dur: 75,  C: NeedleSweepSelftest,            drift: -1, push: 0.06, punch: 0.04, blur: 3 },
  { from: 255, dur: 90,  C: CounterConfetti,                drift: 1,  push: 0.05, punch: 0.06, blur: 0 },
  { from: 345, dur: 105, C: WhiteFlashLogoSimplifyCut,      drift: 0,  push: 0.03, punch: 0,    blur: 0 },
];

// 每个切点自己的颜色（耳机粉 / 白 / 秒杀红 / 金）；logo 镜自带冲白，不另闪
const CUTS = [
  { at: 60, color: '#ff5c8a', k: 0.45 },
  { at: 105, color: '#ffffff', k: 0.6 },
  { at: 180, color: '#ff2d3d', k: 0.45 },
  { at: 255, color: '#ffcf4a', k: 0.5 },
];

// 配音（有集主播 zf_xiaoyi，耳机版现成 Kokoro 句子）：[帧, 文件]
const VO: [number, string][] = [
  [6, 'vo/headset_zh_15_hook.mp3'],
  [94, 'vo/headset_zh_15_link.mp3'],
  [146, 'vo/headset_zh_15_price.mp3'],
  [190, 'vo/headset_zh_15_stock.mp3'],
  [384, 'vo/headset_zh_15_end_none.mp3'],
];
const VO_SPAN: [number, number][] = [[6, 70], [94, 120], [146, 200], [190, 238], [384, 444]];

// 卡点音效：[帧, 文件, 音量]；与配音重叠时自动压到 0.6 倍
const SFX: [number, string, number][] = [
  [0, 'riser-cine.mp3', 0.3],
  [60, 'whoosh-fast.mp3', 0.45],
  [105, 'impact-cine.mp3', 0.55],  // 限时
  [125, 'impact-cine.mp3', 0.55],  // 秒杀
  [145, 'impact-cine.mp3', 0.8],   // ¥359
  [180, 'transition-snap.mp3', 0.4],
  [216, 'pop.mp3', 0.5],           // 0% 已抢光
  [255, 'whoosh-big.mp3', 0.45],
  [300, 'impact-cine.mp3', 0.6],   // 红章
  [302, 'sparkle.mp3', 0.4],
  [345, 'transition-soft.mp3', 0.45],
  [388, 'impact-cine.mp3', 0.5],
];
const duck = (f: number) => (VO_SPAN.some(([a, b]) => f >= a && f < b) ? 0.6 : 1);

export const LiveFlashShowcase: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#0b0710' }}>
    {SHOTS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur}>
        <ShotCam dur={s.dur} drift={s.drift} push={s.push} punch={s.punch} blur={s.blur}>
          <s.C />
        </ShotCam>
      </Sequence>
    ))}
    <CutFlash cuts={CUTS} />
    <FilmLook vignette={0.42} />
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

export const LIVE_FLASH_SHOWCASE_DURATION = 450;
