// wall.js — open 镜头的方块墙：一年每天一块，沿年份的笔画排（digits.js），按天的顺序翻面，年份一笔一笔写出来
// 两个 InstancedMesh：下单的日子（亮面）和没下单的日子（浅面）。每帧的矩阵都是 lt 的闭式函数，没有逐帧状态
import * as THREE from 'three';
import { layoutYear } from './digits.js';
import { tileGeometry, tileMaterials } from './models/tile.js';
import { EV } from '../meta.js';
import { daysInYear } from '../stats.js';
import { easeInOut } from '../../factory/engine/ease.js';

export const FLIP = 0.3, POP = 0.03;                                  // 一块翻面用的秒数；翻到一半时朝镜头弹出的距离
/** 第 k 块（共 n 块）开始翻面的时刻（open 镜头本地秒）：第一块在 EV.flip[0] 开始，最后一块在 EV.flip[1] 翻完 */
export const flipStart = (k, n) => EV.flip[0] + ((EV.flip[1] - EV.flip[0] - FLIP) * k) / Math.max(1, n - 1);
/** 第 k 块的姿态：z 是弹出，flip 是绕所在道的切向转的角（π 背对镜头 → 0 正面朝镜头） */
export function tilePose(tile, k, n, lt) {
  const p = easeInOut((lt - flipStart(k, n)) / FLIP);
  return { x: tile.x, y: tile.y, z: POP * Math.sin(Math.PI * p), angle: tile.angle, flip: Math.PI * (1 - p) };
}

/** days：下单的日子（一年里的第几天，从 0 起）。返回 { root, tiles, lit, write(poseOf), pose(lt) }；lit 是亮面方块的日子（从早到晚） */
export function buildWall({ year, days, pal }) {
  const n = daysInYear(year), tiles = layoutYear(year, n), on = new Set(days);
  const geo = tileGeometry(), root = new THREE.Group();
  const sets = [true, false].map(lit => {
    const idx = tiles.map((_, k) => k).filter(k => on.has(k) === lit), mesh = new THREE.InstancedMesh(geo, tileMaterials(pal, lit), idx.length);
    mesh.castShadow = true; mesh.frustumCulled = false;                // 包围球只算一次，跟不上翻面
    root.add(mesh);
    return { mesh, idx, lit };
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const wall = {
    root, tiles, lit: sets[0].idx,
    /** poseOf(k, i, lit) → { x, y, z, angle, flip, s }：第 k 天（在它那一组里是第 i 块）的姿态，s 是缩放（默认 1）。count 镜头也用它 */
    write(poseOf) {
      for (const { mesh, idx, lit } of sets) {
        idx.forEach((k, i) => {
          const P = poseOf(k, i, lit);
          mesh.setMatrixAt(i, m.compose(p.set(P.x, P.y, P.z), q.setFromEuler(e.set(P.flip, 0, P.angle, 'ZYX')), sc.setScalar(P.s ?? 1)));   // T · Rz(切向) · Rx(翻面) · S
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    pose(lt) { wall.write(k => tilePose(tiles[k], k, n, lt)); },
  };
  return wall;
}
