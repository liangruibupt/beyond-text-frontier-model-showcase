// milk.js — 茶汤的颜色场（闭式，不做流体模拟）：接在共享折射模块给液体材质装的 onBeforeCompile 后面，只改 diffuseColor，引擎不动
//   顶上一层清茶（flavor.liquid.band 厚），下面是奶茶；奶从上往下冲：一道随 uMilk（0..1）往下推进的密度前沿，
//   前沿附近用值噪声做域扭曲，卷出大理石纹；黑糖款再加几道沿杯壁往下挂的虎纹（stripes）
// 颜色只由（本地坐标, uMilk, 口味常数）决定，镜头每帧只设 uMilk：跳着看和顺序播放同一帧
import * as THREE from 'three';
import { CUP } from '../meta.js';

const NOISE = /* glsl */`
float mHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mHash(i), mHash(i + vec3(1,0,0)), f.x), mix(mHash(i + vec3(0,1,0)), mHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mHash(i + vec3(0,0,1)), mHash(i + vec3(1,0,1)), f.x), mix(mHash(i + vec3(0,1,1)), mHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float mFbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * mNoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
`;

/**
 * 把奶纹接到液体材质上。material = 折射模块换好的液体材质（refract.js 的 liquid 遍）；flavor = FLAVORS[...]。
 * 返回 set(milk)：milk 0..1 奶冲下去的进度（1 = 已经混成均匀的奶茶，只剩一点纹理）
 */
export function attachMilk(material, flavor) {
  const U = {
    uMilk: { value: 1 }, uTea: { value: new THREE.Color(flavor.liquid.color).multiplyScalar(0.72) }, uMilkC: { value: new THREE.Color(flavor.milk) },
    uMix: { value: new THREE.Color(flavor.liquid.color) }, uSyrup: { value: new THREE.Color(flavor.syrup ?? flavor.liquid.color) },
    uBand: { value: flavor.liquid.band }, uFill: { value: CUP.fill }, uBase: { value: CUP.base }, uStripes: { value: flavor.stripes ? 1 : 0 },
  };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = sh => {
    prev?.(sh);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLocal;
uniform float uMilk, uBand, uFill, uBase, uStripes; uniform vec3 uTea, uMilkC, uMix, uSyrup;
${NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 p = vLocal;
  float h = (p.y - uBase) / (uFill - uBase);                            // 0 杯底 … 1 液面
  vec3 w = p * 70.0 + vec3(0.0, uMilk * 2.5, 0.0);
  vec3 q = w + 1.6 * vec3(mFbm(w + 3.1), mFbm(w + 7.7), mFbm(w + 1.9));  // 域扭曲：奶在茶里卷开
  float front = 1.0 - uMilk * 1.25;                                     // 奶的前沿从液面（h = 1）往下推，uMilk = 0.8 左右到底
  float swirl = smoothstep(front - 0.18, front + 0.18, h + 0.35 * (mFbm(q) - 0.5));
  float marble = smoothstep(0.35, 0.65, mFbm(q * 1.7));
  vec3 c = mix(uTea, mix(uMix, uMilkC, 0.55 * marble), swirl);
  c = mix(c, uMix, smoothstep(0.75, 1.0, uMilk) * 0.7);                 // 冲完以后渐渐混匀，只留一点纹
  if (uStripes > 0.5) {                                                 // 虎纹：沿杯壁往下挂的黑糖，底下浓、上面细
    float a = atan(p.z, p.x), stripe = smoothstep(0.55, 0.9, sin(a * 7.0 + 2.2 * mFbm(vec3(a * 2.0, p.y * 30.0, 1.0)) + p.y * 18.0));
    float edge = smoothstep(0.7, 1.0, length(p.xz) / (0.0296 + 0.1 * p.y));
    c = mix(c, uSyrup, stripe * edge * (1.0 - smoothstep(0.1, 0.95, h)) * 0.85);
  }
  float band = smoothstep(uFill - uBand, uFill - uBand * 0.4, p.y);     // 顶上一层清茶
  c = mix(c, uTea * 1.15, band * (1.0 - 0.6 * uMilk));
  diffuseColor.rgb = c;
}`);
  };
  material.customProgramCacheKey = (k => () => `${k()}-milk`)(material.customProgramCacheKey);
  material.needsUpdate = true;
  return milk => { U.uMilk.value = milk; };
}
