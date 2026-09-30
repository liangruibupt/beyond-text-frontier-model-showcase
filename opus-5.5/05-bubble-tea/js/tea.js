// tea.js — 奶茶杯的折射：薄壁 PP 截锥杯 + 乳浊的茶汤 + 冰块，由共享的 factory/engine/refract.js 实现，这里只给杯子自己的数据
// 画的顺序：世界（第 0 层，含珍珠、封膜、吸管）→ 冰块（contents 层）→ 茶汤（liquid 层）→ 杯壁（glass 层）
// 茶汤是乳浊液体：scatter 越大越接近它自己被照亮的颜色（flavor.liquid.color）；液面以上留 2.4 cm 空气，折射在那一段和杯壁上最看得出
import { createRefraction, frustumShape } from '../../factory/engine/refract.js';
import { CUP } from '../meta.js';

// PP 折射率 1.49，茶汤按水 1.34；PP 几乎不吸收；焦散网格分辨率比 03 低一档（圆杯的焦散是一圈平滑的亮环，不需要那么细）
export const OPTICS = { glassIor: 1.49, liquidIor: 1.34, glassAbsorb: [0.4, 0.3, 0.4], dispersion: 0.006, frostBlur: 0.004, frostDiffuse: 0.2, causticGrid: 160, causticGain: 0.8, interfaces: 0.9, lowLod: 3.5 };
export const SHAPE = frustumShape({ rBottom: CUP.rBottom, rTop: CUP.rTop, height: CUP.height, wall: CUP.wall, base: CUP.base, fill: CUP.fill });

/** 换上折射材质、加焦散，返回 { render(target) }：film.render 每帧调用 */
export function createTea(ctx, cup, flavor) {
  const { glass, liquid, ice } = cup.parts;
  return createRefraction(ctx, {
    name: 'bocha', shape: SHAPE, optics: OPTICS,
    root: cup.root, glass, liquid, liquidAbsorb: flavor.liquid.absorb,
    scatter: flavor.liquid.scatter, liquidMaterial: { color: flavor.liquid.color, roughness: 0.25 },
    contents: { object: ice, absorb: [0.6, 0.35, 0.25], thickness: 0.016, ior: 1.31 },
  });
}
