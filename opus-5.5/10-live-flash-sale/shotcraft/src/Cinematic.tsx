// Cinematic.tsx — 统一美术指导层：镜内运镜、切点冲击（按镜分档）、分色闪光、漏光暗角颗粒
import React from 'react';
import { AbsoluteFill, interpolate, Easing, useCurrentFrame } from 'remotion';

/** 镜内运镜：缓推 + 漂移；punch>0 时入点冲击回落，blur>0 时入点去模糊。stomp 等锁机位镜头传 drift=0 push=0 */
export const ShotCam: React.FC<{
  dur: number; drift?: number; push?: number; punch?: number; blur?: number; children: React.ReactNode;
}> = ({ dur, drift = 1, push = 0.05, punch = 0.06, blur = 0, children }) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, dur], [1, 1 + push], { extrapolateRight: 'clamp' });
  const pk = interpolate(f, [0, 6], [1 + punch, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const x = interpolate(f, [0, dur], [0, -14 * drift]);
  const y = interpolate(f, [0, dur], [0, -6 * drift]);
  const b = interpolate(f, [0, 4], [blur, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px,${y}px) scale(${sc * pk})`, filter: b ? `blur(${b}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/** 切点闪光：每个切点自带颜色与强度 */
export const CutFlash: React.FC<{ cuts: { at: number; color: string; k?: number }[] }> = ({ cuts }) => {
  const f = useCurrentFrame();
  return (
    <>
      {cuts.map((c, i) => {
        const op = interpolate(f, [c.at - 1, c.at, c.at + 5], [0, c.k ?? 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return op > 0 ? <AbsoluteFill key={i} style={{ background: c.color, opacity: op, mixBlendMode: 'screen' }} /> : null;
      })}
    </>
  );
};

/** 漏光 + 暗角 + 胶片颗粒 */
export const FilmLook: React.FC<{ leak?: string; vignette?: number }> = ({ leak = '255,80,60', vignette = 0.42 }) => {
  const f = useCurrentFrame();
  const lx = 30 + 40 * Math.sin(f / 70);
  const ly = 20 + 25 * Math.cos(f / 90);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 50% at ${lx}% ${ly}%, rgba(${leak},.2), transparent 70%),
                       radial-gradient(40% 40% at ${100 - lx}% ${100 - ly}%, rgba(255,190,90,.1), transparent 70%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${vignette}) 100%)` }} />
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.1, mixBlendMode: 'overlay' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 12} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
