// 底色闪砸字（cel-flash-stomp）——stomp-typography 逐词节拍砸字 ×
// background-cel-flash 纯色底闪的组合变异。三个大词逐拍硬切占满屏，
// 每词像图章一样歪着砸落（scale 1.18→0.98→1 弹落 + 交替 ±2.5° rotate）；
// 词落定帧起背景层每 2f 在 G.bg 与加深灰之间闪切——文字层独立在上纹丝
// 不动，只闪背景是本组合命门（动漫必杀技字卡感）。第三词闪加倍且对比拉大。
// 关键帧：0 "SHIP" 硬切入(rot+2.5°) → 0–6 弹落 → 6–11 背景闪(#cfcfca, 2f 交替×6f)
// → 30 "FASTER" 硬切(rot−2.5°) → 30–36 弹落 → 36–41 背景闪
// → 60 "TODAY" 硬切(rot 0°) → 60–66 弹落 → 66–73 背景闪加倍(8f, #c4c4c0)
// + 66–80 底部标签条淡入 → 80–144 全静止(≥45f, 无逐帧噪声层)。
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { G } from '../../_fixtures/Fixtures';

type Word = {
  text: string;
  start: number; // 硬切入场帧
  end: number; // 显示到此帧前（下一词硬切）
  rot: number; // 图章歪斜角
  flashLen: number; // 落定后背景闪总帧数
  flashDark: string; // 闪切的加深灰
};

const LAND = 6; // 入场弹落时长：start+6 落定，同帧起闪
const WORDS: Word[] = [
  { text: '限时', start: 0, end: 20, rot: 2.5, flashLen: 6, flashDark: '#3a0a1a' },
  { text: '秒杀', start: 20, end: 40, rot: -2.5, flashLen: 6, flashDark: '#3a0a1a' },
  { text: '¥359', start: 40, end: 9999, rot: 0, flashLen: 10, flashDark: '#ff2d55' },
];

export const CelFlashStomp: React.FC = () => {
  const frame = useCurrentFrame();
  const word = WORDS.find((w) => frame >= w.start && frame < w.end)!;
  const t = frame - word.start;

  // 弹落：scale 1.18 → 0.98(2% 过冲) → 1，6f 内完成，poly(5) 出缓
  const scale =
    t < 4
      ? interpolate(t, [0, 4], [1.18, 0.98], {
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.poly(5)),
        })
      : interpolate(t, [4, LAND], [0.98, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.quad),
        });

  // 背景闪：落定帧(start+LAND)起，每 2f 在加深灰与 G.bg 间交替，共 flashLen 帧
  const ft = t - LAND;
  const flashing = ft >= 0 && ft < word.flashLen;
  const bg = flashing && Math.floor(ft / 2) % 2 === 0 ? word.flashDark : G.bg;

  // 第三词落定同帧起底部标签条淡入（66–80）
  const labelOp = interpolate(frame, [46, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <div style={{ width: 1920, height: 1080, background: bg, position: 'relative', overflow: 'hidden' }}>
      {/* 文字层独立在背景之上：背景闪切时它纹丝不动 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif",
            fontWeight: 900,
            fontSize: 260,
            color: G.ink,
            letterSpacing: -4,
            textShadow: '0 0 30px rgba(255,45,85,.85), 0 0 90px rgba(255,107,53,.55), 0 8px 0 #7a0f2a',
            transform: `scale(${scale}) rotate(${word.rot}deg)`,
          }}
        >
          {word.text}
        </div>
      </div>
      {/* 底部标签条：第三词落定同帧淡入 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 96,
          background: 'linear-gradient(90deg,rgba(255,45,85,.28),rgba(20,11,26,.92) 40%)',
          borderTop: '2px solid #ff2d55',
          opacity: labelOp,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 120px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 900, fontSize: 40, color: '#fff4ec', letterSpacing: 4 }}>有集电竞耳机</div>
        <div style={{ fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 700, fontSize: 34, color: '#a8879a', textDecoration: 'line-through' }}>日常价 ¥499</div>
        <div style={{ marginLeft: 'auto', fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 900, fontSize: 40, color: '#0b0710', background: '#ffcf4a', padding: '6px 22px', borderRadius: 10 }}>限量 999 件</div>
      </div>
    </div>
  );
};
