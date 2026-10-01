// scarf.js — 丝巾网格：模拟用 n × n 的控制网格（cloth.js 的表或闭式姿态写进 positions），
// 渲染用细 R 倍的网格：每个渲染顶点按均匀三次 B 样条逼近控制网格（二阶导连续，不过冲），折痕和垂坠是圆滑的曲线而不是折角；
// 法线在细网格上算（computeVertexNormals 再做一遍邻域平均），高光不会沿控制网格的边断开
// 材质：MeshPhysicalMaterial 的 sheen（丝的绒光）+ anisotropy（沿经线方向拉长的高光），两面都画
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

/** 均匀三次 B 样条的四个权重（t ∈ [0, 1]，作用于 p[-1], p0, p1, p2）。
 *  不用 Catmull–Rom：它必须穿过每个控制点，在对折的发夹弯（两层隔 4 mm、格距 2.9 cm）上会冲出折线，每格一个小唇边 → 折边一串扇形波纹。
 *  B 样条落在控制点的凸包里，不会冲出去；边界按镜像外推（p[-1] = 2p0 − p1）时，在边上正好等于控制点，四条边不缩 */
function crW(t) {
  const t2 = t * t, t3 = t2 * t, s = 1 - t;
  return [s * s * s / 6, (3 * t3 - 6 * t2 + 4) / 6, (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, t3 / 6];
}
/** 控制网格 n × n → 细网格 m × m（m = (n-1)·R + 1）的插值表：每个细顶点 16 个 (控制点下标, 权重)。边界按镜像外推（p[-1] = 2p0 - p1） */
function upsampler(n, R) {
  const m = (n - 1) * R + 1, W = [], I = [];
  const axis = [];                                                    // 每个细坐标：4 个控制下标 + 4 个权重（外推写成对现有点的线性组合）
  for (let a = 0; a < m; a++) {
    const c = Math.min(Math.floor(a / R), n - 2), t = a / R - c, w = crW(t), terms = new Map();
    const add = (i, x) => terms.set(i, (terms.get(i) ?? 0) + x);
    [-1, 0, 1, 2].forEach((d, q) => {
      const i = c + d;
      if (i < 0) { add(0, 2 * w[q]); add(1, -w[q]); } else if (i > n - 1) { add(n - 1, 2 * w[q]); add(n - 2, -w[q]); } else add(i, w[q]);
    });
    axis.push([...terms]);
  }
  for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) {
    const ti = [], tw = [];
    for (const [j, wj] of axis[b]) for (const [i, wi] of axis[a]) { ti.push(j * n + i); tw.push(wj * wi); }
    I.push(ti); W.push(tw);
  }
  return { m, I, W };
}

/** 丝巾：{ mesh, positions（控制网格，Float32Array，n*n*3，直接写它再 commit()）, commit(), setReveal, flat() } */
export function buildScarf(k, { n = SCARF.n, R = 3 } = {}) {
  const pos = new Float32Array(n * n * 3), up = upsampler(n, R), m = up.m, M = m * m;
  const geo = new THREE.BufferGeometry(), fine = new Float32Array(M * 3), uv = new Float32Array(M * 2);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const v = j * m + i; uv[2 * v] = i / (m - 1); uv[2 * v + 1] = 1 - j / (m - 1); }
  geo.setAttribute('position', new THREE.BufferAttribute(fine, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(clothIndex(m, m));
  const pat = patternTexture(k), S = k.silk;
  const mat = new THREE.MeshPhysicalMaterial({
    map: pat.texture, color: S.color, roughness: S.roughness, sheen: S.sheen, sheenColor: new THREE.Color(S.sheenColor), sheenRoughness: S.sheenRoughness,
    anisotropy: S.anisotropy, anisotropyRotation: 0, specularIntensity: 0.6, side: THREE.DoubleSide, alphaTest: 0.5,   // alphaTest：宋锦没织到的部分（纹理透明）不画，投影也跟着裁
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return {
    mesh, positions: pos, n, fine: m, setReveal: pat.setReveal,
    /** 控制网格写完以后调：插值出细网格，更新法线和切线（各向异性高光沿 uv 的 u 方向 = 经线） */
    commit() {
      for (let v = 0; v < M; v++) {
        const ti = up.I[v], tw = up.W[v]; let x = 0, y = 0, z = 0;
        for (let q = 0; q < ti.length; q++) { const c = ti[q] * 3, w = tw[q]; x += pos[c] * w; y += pos[c + 1] * w; z += pos[c + 2] * w; }
        fine[3 * v] = x; fine[3 * v + 1] = y; fine[3 * v + 2] = z;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      if (geo.attributes.tangent) geo.deleteAttribute('tangent');
      geo.computeTangents(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    },
    /** 平铺：中心在 c，边长 SCARF.size，绕 y 转 rot（写控制网格） */
    flat(c = [0, 0, 0], rot = 0) {
      const h = SCARF.size / 2, cs = Math.cos(rot), sn = Math.sin(rot);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * 2 * h, z = (j / (n - 1) - 0.5) * 2 * h, v = (j * n + i) * 3;
        pos[v] = c[0] + x * cs - z * sn; pos[v + 1] = c[1]; pos[v + 2] = c[2] + x * sn + z * cs;
      }
    },
  };
}
