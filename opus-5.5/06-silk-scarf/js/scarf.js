// scarf.js — 丝巾网格：方格布（顶点由 cloth.js 的表或闭式姿态给出）+ 代码画的纹样纹理 + 丝的材质
// 材质：MeshPhysicalMaterial 的 sheen（丝的绒光）+ anisotropy（沿经线方向拉长的高光），两面都画（背面纹样稍暗）
import * as THREE from 'three';
import { clothIndex } from '../../factory/engine/cloth.js';
import { drawPattern } from './pattern.js';
import { SCARF } from '../meta.js';

/** 纹样画成 CanvasTexture；reveal < 1 时每次重画（宋锦逐行织出、青花逐笔画出）。返回 { texture, setReveal(r) } */
export function patternTexture(k, S = 1024) {
  if (typeof document === 'undefined') return { texture: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1), setReveal() {} };   // Node 测试：不画纹样
  const c = document.createElement('canvas'); c.width = c.height = S;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  let shown = NaN;
  const setReveal = r => {
    const q = Math.round(Math.min(Math.max(r, 0), 1) * 240) / 240;          // 量化：拖动时只在变化时重画
    if (q === shown) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, S, S); drawPattern(g, S, k.pattern, { seed: 3, reveal: q });
    tex.needsUpdate = true; shown = q;
  };
  setReveal(1);
  return { texture: tex, setReveal };
}

/** 丝巾：{ mesh, positions（Float32Array，n*3，直接写它再 commit()）, commit(), setReveal } */
export function buildScarf(k, { n = SCARF.n } = {}) {
  const geo = new THREE.BufferGeometry(), N = n * n, pos = new Float32Array(N * 3), uv = new Float32Array(N * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = j * n + i; uv[2 * v] = i / (n - 1); uv[2 * v + 1] = 1 - j / (n - 1); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(clothIndex(n, n));
  const pat = patternTexture(k), S = k.silk;
  const mat = new THREE.MeshPhysicalMaterial({
    map: pat.texture, color: S.color, roughness: S.roughness, sheen: S.sheen, sheenColor: new THREE.Color(S.sheenColor), sheenRoughness: S.sheenRoughness,
    anisotropy: S.anisotropy, anisotropyRotation: 0, specularIntensity: 0.6, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return {
    mesh, positions: pos, n, setReveal: pat.setReveal,
    /** 顶点写完以后调：更新法线和切线（各向异性高光沿 uv 的 u 方向 = 经线） */
    commit() {
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      if (geo.attributes.tangent) geo.deleteAttribute('tangent');
      geo.computeTangents(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    },
    /** 平铺：中心在 c，边长 SCARF.size，绕 y 转 rot；fold 是闭式折叠时的覆盖（见 fold.js） */
    flat(c = [0, 0, 0], rot = 0) {
      const h = SCARF.size / 2, cs = Math.cos(rot), sn = Math.sin(rot);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * 2 * h, z = (j / (n - 1) - 0.5) * 2 * h, v = (j * n + i) * 3;
        pos[v] = c[0] + x * cs - z * sn; pos[v + 1] = c[1]; pos[v + 2] = c[2] + x * sn + z * cs;
      }
    },
  };
}
