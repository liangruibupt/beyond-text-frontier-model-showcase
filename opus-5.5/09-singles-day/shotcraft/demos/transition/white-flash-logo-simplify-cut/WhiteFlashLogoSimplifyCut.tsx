// white-flash-logo-simplify-cut — White Flash Simplify 冲白降维切换
// （motion-lab 定稿转原生 Remotion）
// 彩色液态质感词标（占位字标）静置后画面 0.2s 冲白（冲白瞬间叠一帧轻微
// blur 做过曝感），紧接扁平渐变版字标从白底淡入 + scale 0.96→1 定格。
// 一次闪白完成"液态质感→扁平字标"的降维切换。
// 设计坐标 480×270（DesignStage 等比放大），参数表数值以此坐标系标定。
import React from 'react';
import { DesignStage, E, lerp, seg, useT } from '../../_fixtures/Motion';

export const WHITE_FLASH_LOGO_SIMPLIFY_CUT_DURATION = 108; // 3600ms @30fps

// 该效果依赖的文件级共享量（扁平字标渐变三色 + 占位词标）
const GRAD_A = '#5fd0ff';
const GRAD_B = '#eaf6ff';
const GRAD_C = '#ffd84a';
const WORDMARK = '星潮 STARTIDE';

export const WhiteFlashLogoSimplifyCut: React.FC = () => {
  const t = useT();
  // 液态层：静置期缓慢流动的渐变 + 高光微移
  const flow = t * 100;
  // 冲白瞬间给彩色层一帧过曝 blur
  const flashK = seg(t, 0.34, 0.42, E.inQuad);
  const blurPulse = Math.sin(seg(t, 0.34, 0.46) * Math.PI);
  // 扁平 logo：opacity 0→1 + scale 0.96→1，cubic ease-out
  const lk = seg(t, 0.48, 0.74, E.outCubic);
  return (
    <DesignStage bg="#08070c">
      <div style={{ position: 'absolute', inset: 0, background: '#08070c', overflow: 'hidden' }}>
        {/* 彩色液态词层 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: `900 40px/1 'Noto Sans CJK SC','Noto Sans SC',sans-serif`,
            letterSpacing: 4,
            whiteSpace: 'nowrap',
            background: 'linear-gradient(105deg,#2f8fd8 0%,#5fd0ff 30%,#eaf6ff 50%,#ffd84a 70%,#5fd0ff 100%)',
            backgroundSize: '320% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: 'none',
            backgroundPosition: `${flow}% 0`,
            filter: `blur(${blurPulse * 5}px) brightness(${1 + blurPulse * 1.2})`,
          }}
        >
          {WORDMARK}
        </div>
        {/* 液态高光扫层（贴在字上方的柔光条） */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 220,
            height: 120,
            margin: '-60px 0 0 -110px',
            background: 'radial-gradient(closest-side,rgba(255,255,255,.28),transparent 70%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
            transform: `translateX(${lerp(t, -30, 30)}px)`,
            opacity: 1 - flashK,
          }}
        />
        {/* 白色全屏层：easeIn 冲入后保持 */}
        <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flashK * (1 - lk) }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 70% at 50% 50%,#0f2a44,#06101c 78%)', opacity: lk }} />
        {/* 扁平渐变字标层（渐变色见顶部 GRAD_*） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: lk,
            transform: `scale(${lerp(lk, 0.96, 1)})`,
          }}
        >
          <div
            style={{
              font: `800 40px/1 'Noto Sans CJK SC','Noto Sans SC',sans-serif`,
              letterSpacing: 5,
              whiteSpace: 'nowrap',
              background: `linear-gradient(92deg,${GRAD_A} 0%,${GRAD_B} 45%,${GRAD_C} 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(95,208,255,.6)) drop-shadow(0 0 26px rgba(255,216,74,.35))',
            }}
          >
            {WORDMARK}
          </div>
          <div style={{ marginTop: 16, font: `700 18px/1 'Noto Sans CJK SC','Noto Sans SC',sans-serif`, letterSpacing: 8, color: '#eaf6ff',
            opacity: seg(t, 0.68, 0.82, E.outCubic), transform: `translateY(${lerp(seg(t, 0.68, 0.82, E.outCubic), 6, 0)}px)` }}>
            峰值，由你点亮
          </div>
        </div>
      </div>
    </DesignStage>
  );
};
