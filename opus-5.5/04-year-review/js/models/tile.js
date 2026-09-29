// tile.js — open 镜头的方块：圆角方块，正面（+z）是这一天的颜色（下单亮色、没下单 base 色），背面和四边近于背景
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WALL } from '../digits.js';
import { clay } from './clay.js';

export const DEPTH = 0.014;
export const tileGeometry = () => new RoundedBoxGeometry(WALL.tile, WALL.tile, DEPTH, 3, 0.006);

/** 背面：墙所在高度的背景色往字色偏一点点，翻面之前年份只是墙上一层淡淡的影子，翻过来才写出来 */
export const backColor = pal => new THREE.Color(pal.bg[0]).lerp(new THREE.Color(pal.bg[1]), 0.45).lerp(new THREE.Color(pal.ink), 0.07);
/** 材质组，按 BoxGeometry 的面序 +x −x +y −y +z −z；lit 的正面自发光，泛光只挑它 */
export function tileMaterials(pal, lit) {
  const back = clay({ color: backColor(pal) });
  const face = lit ? clay({ color: pal.lit, emissive: pal.lit, emissiveIntensity: 1.2 }) : clay({ color: pal.base });
  return [back, back, back, back, face, back];
}
