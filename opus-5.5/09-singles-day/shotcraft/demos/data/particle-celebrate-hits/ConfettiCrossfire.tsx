// confetti-crossfire —— 双侧礼炮交叉喷洒
// 中央大 KPI 卡 scale 落定（f0–14），揭晓帧 f16 左下+右下两门炮各射 50 颗矩形彩屑：
// 闭式弹道（初速 ~18px/f + spread 55° + 重力 + decay 0.9 的位移闭式解），每帧翻转 8–15°，
// 灰阶为主 + 1/3 琥珀。全部彩屑 ~f100 前落出画外（越界即条件卸载），结尾真静止 ≥55f。
// 帧确定性：sin 散列伪随机派生每颗初速/角度/翻转率，弹道 = 纯 age 的函数。
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { G } from '../../_fixtures/Fixtures';

const AMBER = '#ffd84a';
const FIRE = 16; // 揭晓帧 = 发射帧
const DECAY = 0.9;
const GRAV = 1.5; // px/f² （等效重力；decay 下终端落速 = GRAV/(1-d) = 15px/f）

const frac = (x: number) => x - Math.floor(x);
const rnd = (i: number, salt: number) => frac(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453);

// decay 弹道闭式解：v 每帧 ×0.9 → 位移 = v0·(1-d^age)/(1-d)；重力项同样按衰减序列累积
const decaySum = (age: number) => (1 - Math.pow(DECAY, age)) / (1 - DECAY);

type Confetto = {
  vx: number; vy: number; w: number; h: number;
  spin: number; phase: number; amber: boolean; shade: string;
};

const makeGun = (originDeg: number, saltBase: number): Confetto[] =>
  Array.from({ length: 50 }).map((_, i) => {
    const ang = ((originDeg + (rnd(i, saltBase) - 0.5) * 55) * Math.PI) / 180;
    // decay 0.9 下初速总位移只有 10×v0（velocity 6.6f 减半），18px/f 只够 180px 完全不可感
    // → 加码到 70–95px/f：最陡颗峰值升到 y≈390（画面上 1/3），弹幕跨越中央卡，~f96 全部落出
    const speed = 70 + rnd(i, saltBase + 1) * 25;
    const grays = ['#5fd0ff', '#eaf6ff', '#2f8fd8', '#9fe4ff'];
    return {
      vx: Math.cos(ang) * speed,
      vy: -Math.sin(ang) * speed, // 屏幕坐标向下为正，射向斜上
      w: 14 + rnd(i, saltBase + 2) * 12,
      h: 8 + rnd(i, saltBase + 3) * 8,
      spin: 8 + rnd(i, saltBase + 4) * 7, // 8–15°/f
      phase: rnd(i, saltBase + 5) * 360,
      amber: rnd(i, saltBase + 6) < 1 / 3,
      shade: grays[Math.floor(rnd(i, saltBase + 7) * 4)],
    };
  });

const LEFT_GUN = makeGun(60, 3);   // 左下炮朝 60°（偏右上）
const RIGHT_GUN = makeGun(120, 9); // 右下炮朝 120°（偏左上）
const LEFT_POS = { x: 140, y: 1040 };
const RIGHT_POS = { x: 1780, y: 1040 };

export const ConfettiCrossfire: React.FC = () => {
  const frame = useCurrentFrame();
  const age = frame - FIRE;

  // KPI 卡 scale 入场落定
  const cardScale = interpolate(frame, [0, 14], [0.6, 1], {
    easing: Easing.out(Easing.back(1.8)),
    extrapolateRight: 'clamp',
  });
  const cardOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  const renderGun = (gun: Confetto[], origin: { x: number; y: number }, keyBase: string) =>
    gun.map((c, i) => {
      if (age <= 0) return null;
      const s = decaySum(age);
      const x = origin.x + c.vx * s;
      // 重力：每帧速度 +GRAV 再统一衰减 → 位移闭式 Σ 可整理为 GRAV·(age - s·d)/(1-d) 的近似；
      // 直接用精确序列和：g 项位移 = GRAV · Σ_{k=1..age} (1-d^k)/(1-d) = GRAV·(age-(d-d^{age+1})/(1-d))/(1-d)
      const gDisp = (GRAV * (age - (DECAY - Math.pow(DECAY, age + 1)) / (1 - DECAY))) / (1 - DECAY);
      const y = origin.y + c.vy * s + gDisp;
      // 落出画外即卸载（左右也裁）
      if (y > 1140 || x < -80 || x > 2000) return null;
      const rot = c.phase + c.spin * age;
      return (
        <div
          key={`${keyBase}${i}`}
          style={{
            position: 'absolute', left: x, top: y, width: c.w, height: c.h,
            background: c.amber ? AMBER : c.shade,
            borderRadius: 2,
            // rotateX 造翻牌式 3D 翻转（宽度不变、高度压扁），再加平面 rotate
            transform: `rotate(${rot}deg) rotateX(${rot * 2.3}deg)`,
          }}
        />
      );
    });

  return (
    <div style={{ width: 1920, height: 1080, background: G.bg, position: 'relative', overflow: 'hidden' }}>

      {/* 中央 KPI 卡 */}
      <div style={{
        position: 'absolute', left: 560, top: 360, width: 800, height: 360,
        background: G.card, border: `2px solid ${G.border}`, borderRadius: 16,
        boxSizing: 'border-box', padding: 36, boxShadow: '0 0 0 1px rgba(255,216,74,.4), 0 0 60px rgba(95,208,255,.25)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${cardScale})`, opacity: cardOp,
      }}>
        <div style={{ fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 700, fontSize: 30, color: G.mid, letterSpacing: 6 }}>星潮双11 · 全国成交额</div>
        <div style={{
          fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 900, fontSize: 150, textShadow: '0 0 36px rgba(255,216,74,.55)',
          color: AMBER, letterSpacing: -3, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
        }}>
          ¥10亿
        </div>
        <div style={{ fontFamily: "'Noto Sans CJK SC','Noto Sans SC',sans-serif", fontWeight: 900, fontSize: 36, color: G.ink, letterSpacing: 4 }}>零点后 1 分 36 秒</div>
      </div>

      {renderGun(LEFT_GUN, LEFT_POS, 'L')}
      {renderGun(RIGHT_GUN, RIGHT_POS, 'R')}
    </div>
  );
};
