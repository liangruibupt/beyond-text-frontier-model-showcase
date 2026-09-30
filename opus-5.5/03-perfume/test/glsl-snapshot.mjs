// glsl-snapshot.mjs — 03 的折射着色器快照：每一遍的顶点 / 片元源码（按 three 的 physical 模板打完补丁后）、defines、程序缓存键、
// uniform 的名字和值、材质开关。只走公开接口（buildBottle + createGlass），所以迁移前后都能取，迁移前取的一份存成
// fixtures/refract-03.json，refract-fixture.test.mjs 断言迁移后逐字节相同。
//   重新生成（只在有意改 03 的画面时）：node 03-perfume/test/glsl-snapshot.mjs --write
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildBottle } from '../js/bottle.js';
import { createGlass } from '../js/glass.js';
import { SKUS } from '../skus.js';

export const FIXTURE = fileURLToPath(new URL('./fixtures/refract-03.json', import.meta.url));

// uniform 值 → 可比较的 JSON：向量 / 矩阵 / 颜色按分量（保留全部位数），纹理只记类型
function val(v) {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(val);
  if (v.isTexture) return `texture:${v.constructor.name}`;
  if (v.isColor) return ['Color', ...v.toArray()];
  if (typeof v.toArray === 'function') return [v.constructor.name, ...v.toArray()];
  return `object:${v.constructor?.name}`;
}
const uniforms = U => Object.fromEntries(Object.keys(U).sort().map(k => [k, val(U[k].value)]));
const flags = m => Object.fromEntries(['type', 'transparent', 'opacity', 'depthWrite', 'depthTest', 'transmission', 'side', 'ior', 'roughness', 'blending', 'blendSrc', 'blendDst',
  'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'colorWrite'].filter(k => k in m).map(k => [k, val(m[k])]));

/** 和 glass.test.mjs 一样的小世界；render 一帧（带涟漪），让逐帧 uniform 也进快照 */
export function snapshot(skuId = 'whitetea') {
  const quads = [];
  const renderer = { autoClear: true, shadowMap: { autoUpdate: true }, setRenderTarget() {}, clear() {},
    render(scene) { if (scene.isMesh && scene.material?.isShaderMaterial) quads.push(scene.material); } };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.01, 100);
  camera.position.set(0, 0.1, 0.5); camera.lookAt(0, 0.08, 0);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.82 }));
  g.rotation.x = -Math.PI / 2; scene.add(g);
  const key = new THREE.DirectionalLight('#fff3e6', 2.4);
  key.position.set(-0.5, 0.9, 0.7); key.castShadow = true; scene.add(key, key.target);
  const ctx = { renderer, scene, camera }, sku = SKUS[skuId], bottle = buildBottle(ctx, sku);
  scene.add(bottle.root);
  const glass = createGlass(ctx, bottle, sku);
  bottle.pose({ ripple: 0.4 });
  glass.render({ width: 1080, height: 1920, texture: new THREE.Texture(), depthTexture: new THREE.DepthTexture(1080, 1920) });

  const out = { passes: {} };
  for (const [name, m] of [['glass', bottle.parts.glass.material], ['liquid', bottle.parts.liquid.material]]) {
    const sh = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
    m.onBeforeCompile(sh);
    out.passes[name] = { vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader, defines: m.defines ?? null, cacheKey: m.customProgramCacheKey(), uniforms: uniforms(sh.uniforms), flags: flags(m) };
  }
  const cz = bottle.root.children.filter(o => o.material?.isShaderMaterial);
  out.caustics = cz.map(o => ({ vertexShader: o.material.vertexShader, fragmentShader: o.material.fragmentShader, uniforms: uniforms(o.material.uniforms), flags: flags(o.material),
    renderOrder: o.renderOrder, frustumCulled: o.frustumCulled, grid: o.geometry.parameters }));
  out.shrink = quads.map(m => ({ vertexShader: m.vertexShader, fragmentShader: m.fragmentShader }));
  return out;
}

/** 除第一个 SKU 外，着色器源码换成 sha256（各 SKU 的着色器相同，只有 uniform 不同；免得夹具里存四份同样的文本） */
export function hashed(s) {
  return JSON.parse(JSON.stringify(s, (k, v) => (/Shader$/.test(k) && typeof v === 'string' ? `sha256:${createHash('sha256').update(v).digest('hex')}` : v)));
}
export const fixtureOf = () => Object.fromEntries(Object.keys(SKUS).map((id, i) => [id, i ? hashed(snapshot(id)) : snapshot(id)]));

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--write')) {
  const all = fixtureOf();
  writeFileSync(FIXTURE, JSON.stringify(all, null, 1) + '\n');
  console.log(`wrote ${FIXTURE}`);
}
