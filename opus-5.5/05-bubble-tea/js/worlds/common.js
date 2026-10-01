// common.js — 四个世界共用的场景件：背景弯、程序纹理（木纹、亚麻、软圆点）、朝向相机的软面片（雾、蒸汽、光斑）
// 全部只由 seed 决定、用 DataTexture 生成（Node 测试里也能建）；随时间动的件由世界的 update(t) 按闭式摆放
import * as THREE from 'three';
import { rand } from '../../../factory/engine/rng.js';
import { driftField, puffAtlas } from '../../../03-perfume/js/worlds/common.js';
export { driftField, puffAtlas };

const clamp = x => Math.min(1, Math.max(0, x));

/** 背景弯：地面 → 圆弧 → 背墙；顶点色按高度从 bottom（地面）渐变到 top（墙顶） */
export function sweep([top, bottom], { width = 3, floor = 1.2, R = 0.35, wall = 1.6, z0 = 0.5, mid = 0.7 } = {}) {
  const g = new THREE.PlaneGeometry(width, 1, 1, 96), p = g.attributes.position, arc = (Math.PI / 2) * R, L = floor + arc + wall;
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top), col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const s = (0.5 - p.getY(i)) * L;
    let y, z;
    if (s < floor) { y = 0; z = z0 - s; }
    else if (s < floor + arc) { const a = (s - floor) / R; y = R * (1 - Math.cos(a)); z = z0 - floor - R * Math.sin(a); }
    else { y = R + (s - floor - arc); z = z0 - floor - R; }
    p.setXYZ(i, p.getX(i), y, z);
    c.copy(c0).lerp(c1, clamp((s - floor * mid) / (arc + wall * 0.6))); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function dataTex(N, M, fn, { repeat = [1, 1], srgb = true } = {}) {
  const px = new Uint8Array(N * M * 4), c = [0, 0, 0, 255];
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { fn(i / N, j / M, c); px.set(c, (j * N + i) * 4); }
  const t = new THREE.DataTexture(px, N, M);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
/** 周期值噪声（格点 lat），只由 seed 决定 */
function vnoise(seed, lat) {
  const g = (i, j) => rand(seed, (((j % lat) + lat) % lat) * lat + (((i % lat) + lat) % lat));
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
    return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b;
  };
}

/** 旧木台面：顺纹的年轮条纹 + 噪声扰动，light / dark 两色之间 */
export function woodTexture(seed, { light = '#7a4a2a', dark = '#3a1f10', repeat = [2, 1] } = {}) {
  const n = vnoise(seed, 16), a = new THREE.Color(light), b = new THREE.Color(dark), c = new THREE.Color();
  return dataTex(512, 256, (u, v, o) => {
    const w = n(u * 16, v * 4) * 2.2 + n(u * 64, v * 16) * 0.35, ring = 0.5 + 0.5 * Math.sin((v * 22 + w * 3.2) * Math.PI);
    c.copy(a).lerp(b, clamp(ring ** 2.2 * 0.8 + n(u * 128, v * 48) * 0.2));
    o[0] = c.r * 255; o[1] = c.g * 255; o[2] = c.b * 255;
  }, { repeat });
}

/** 亚麻 / 棉布：经纬交织的细格 + 一点深浅不匀 */
export function linenTexture(seed, { color = '#efe8da', repeat = [6, 6] } = {}) {
  const n = vnoise(seed, 8), base = new THREE.Color(color);
  return dataTex(256, 256, (u, v, o) => {
    const warp = 0.5 + 0.5 * Math.sin(u * 256 * Math.PI), weft = 0.5 + 0.5 * Math.sin(v * 256 * Math.PI), k = 0.9 + 0.06 * (warp * weft) + 0.05 * n(u * 8, v * 8);
    o[0] = base.r * 255 * k; o[1] = base.g * 255 * k; o[2] = base.b * 255 * k;
  }, { repeat });
}

/** 软圆点（光斑、闪光）：中心亮、边缘淡到 0 的 alpha；ring > 0 时边缘多一圈（相机镜头里焦外光斑的亮边） */
export function dotTexture({ ring = 0 } = {}) {
  return dataTex(128, 128, (u, v, o) => {
    const r = Math.hypot(u * 2 - 1 + 1 / 128, v * 2 - 1 + 1 / 128), core = clamp(1 - r) ** 1.6, edge = ring * clamp(1 - Math.abs(r - 0.82) * 9) * (r < 1 ? 1 : 0);
    o[0] = o[1] = o[2] = 255; o[3] = Math.round(255 * clamp(core + edge));
  }, { srgb: false });
}

/**
 * 朝向相机的面片材质（配 driftField 的 fade: 'alpha'，几何 PlaneGeometry(1, 1)）：透明度 = map.a × instanceColor.r × opacity × 闪烁。
 * atlas = true 时按实例号取 puffAtlas 的一格；twinkle > 0 时每个实例按自己的相位随 uTime 明暗（光斑闪烁），uTime 由世界的 update 设
 */
export function softSprites({ map, color = '#ffffff', opacity = 1, additive = false, atlas = false, twinkle = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, uTime: { value: 0 }, twinkle: { value: twinkle } },
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */`
uniform float uTime, twinkle; varying vec2 vUv; varying float vA;
void main() {
  vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float s = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vUv = ${atlas ? '(uv + vec2(float(gl_InstanceID % 2), float((gl_InstanceID / 2) % 2))) * 0.5' : 'uv'};
  #ifdef USE_INSTANCING_COLOR
    vA = instanceColor.r;
  #else
    vA = 1.0;
  #endif
  float ph = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453) * 6.2831853;
  vA *= 1.0 - twinkle * (0.5 + 0.5 * sin(uTime * (1.3 + 0.9 * fract(ph)) + ph));
  gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * s, 1.0);
}`,
    fragmentShader: /* glsl */`
uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying float vA;
void main() { gl_FragColor = vec4(color, texture2D(map, vUv).a * vA * opacity); }`,
  });
}

/** 投影的主光：折射模块找第一盏投影的平行光来算焦散，每个世界都要有一盏 */
export function keyLight(color, intensity, pos, { radius = 4, size = 0.25, map = 2048 } = {}) {
  const key = new THREE.DirectionalLight(color, intensity);
  key.position.set(...pos); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.05, far: 4 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.mapSize.set(map, map); key.shadow.bias = -0.0004; key.shadow.radius = radius;
  return key;
}
