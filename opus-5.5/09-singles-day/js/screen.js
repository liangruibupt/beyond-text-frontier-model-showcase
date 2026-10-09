// js/screen.js — 双11 零点大屏的 Three.js 场景：背景、星座节点、仓库环、实例化订单弧线
// 全部从 factory/engine/constellation.js 的确定性布局采样；每帧按 (t, 相位) 更新实例，无逐帧随机
// 画面是一块贴在 XY 平面的「大屏」：节点/弧线都在 [-AX,AX]×[-0.5,0.5] 的归一化平面上（z=0），相机正视

import {
  layoutNodes, layoutHubs, arcSchedule, activeArcs, progressAt, arcPath, cityCenters,
} from '../../factory/engine/constellation.js';
import { easeOut, ss } from '../../factory/engine/ease.js';

const AX = 16 / 9 / 2;          // 大屏在世界空间的半宽（16:9 内容），半高 0.5
// 归一化布局坐标 [0,1] → 世界平面坐标：x∈[-AX,AX]，y∈[0.5,-0.5]（上为正）
const toWorld = (p) => ({ x: (p.x - 0.5) * 2 * AX, y: (0.5 - p.y) });

const ARC_SEGS = 14;            // 每条弧线分段数（折线近似贝塞尔）
const MAX_ARCS = 4000;          // 实例上限（profile 后可调；峰值密度观感靠辉光叠加伪造更密）

/**
 * 构建大屏，返回 { root, box, draw(t, phase), gmvAt(t) }。
 * theme = themes.js 的一款；THREE = ctx.THREE。
 */
export function buildScreen(THREE, theme) {
  const root = new THREE.Group();
  const seed = theme.seed >>> 0;

  // —— 布局（确定性，一次算好）——
  const centers = theme.cities ? cityCenters(16 / 9) : null;
  const nodesN = layoutNodes({
    seed, count: theme.nodeCount, mode: theme.mode, aspect: 16 / 9,
    centers, tightness: 0.08, mapScale: theme.mapScale ?? 1.35,
  });
  const hubsN = centers ? centers.map((c) => ({ x: c.x, y: c.y })) : layoutHubs({ seed, nodes: nodesN, k: theme.hubs });
  const nodes = nodesN.map(toWorld).map((p, i) => ({ ...p, w: nodesN[i].w }));
  const hubs = hubsN.map(toWorld);
  const sched = arcSchedule({ seed, nodeCount: nodes.length, hubCount: hubs.length, n: MAX_ARCS, t0: 2.25, t1: 11.0, durMin: 0.8, durMax: 1.8, reverse: theme.reverse });

  // —— 背景大屏板 ——
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(AX * 2 + 0.02, 1.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.bg) }),
  );
  bg.position.z = -0.02;
  root.add(bg);

  // —— 节点（实例化小方块，加法混合辉光）——
  const nodeGeo = new THREE.PlaneGeometry(0.006, 0.006);
  const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.node), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodes.length);
  nodeMesh.instanceColor = null;
  root.add(nodeMesh);
  // 每节点一个到最近仓库的距离（点亮波纹用）
  const nodeDist = nodes.map((n) => Math.min(...hubs.map((h) => Math.hypot(n.x - h.x, n.y - h.y))));
  const maxDist = Math.max(...nodeDist) || 1;

  // —— 仓库环（实例化圆环）——
  const hubGeo = new THREE.RingGeometry(0.012, 0.018, 24);
  const hubMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.hub), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const hubMesh = new THREE.InstancedMesh(hubGeo, hubMat, hubs.length);
  root.add(hubMesh);

  // —— 弧线拖尾（实例化细长方块当线段：每条弧线 ARC_SEGS 段）——
  const segGeo = new THREE.PlaneGeometry(1, 0.006);
  const segMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.arc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
  const segMesh = new THREE.InstancedMesh(segGeo, segMat, MAX_ARCS * ARC_SEGS);
  segMesh.count = 0;
  segMesh.frustumCulled = false;           // 动态实例，初始 count=0 会被空包围球裁掉，关闭视锥裁剪
  root.add(segMesh);

  // —— 弧线彗头（每条活跃弧线一个明亮大点，飞行中的订单主体）——
  const headGeo = new THREE.PlaneGeometry(0.014, 0.014);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.arc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 });
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_ARCS);
  headMesh.count = 0;
  headMesh.frustumCulled = false;          // 动态实例，初始 count=0 会被空包围球裁掉，关闭视锥裁剪
  root.add(headMesh);

  const box = new THREE.Box3().setFromObject(bg);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();

  // 节点一次性放置 + 仓库一次性放置
  for (let i = 0; i < nodes.length; i++) {
    _p.set(nodes[i].x, nodes[i].y, 0); _m.compose(_p, _q, _s); nodeMesh.setMatrixAt(i, _m);
  }
  nodeMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < hubs.length; i++) {
    _p.set(hubs[i].x, hubs[i].y, 0.001); _m.compose(_p, _q, _s); hubMesh.setMatrixAt(i, _m);
  }
  hubMesh.instanceMatrix.needsUpdate = true;

  // 节点亮度：ignite 相位按与仓库距离的波纹点亮；density = 当前允许的弧线密度 [0,1]
  function draw(t, { nodeLit = 1, density = 1, hubPulse = 0, dim = 1 } = {}) {
    // 节点逐实例缩放模拟点亮（波纹：近仓库先亮）；dim 整体压暗（文字镜头让背景退后）
    for (let i = 0; i < nodes.length; i++) {
      const litFront = nodeLit * (1 + 0.4);          // 波纹推进量
      const d = nodeDist[i] / maxDist;
      const on = ss(0, 0.25, litFront - d);
      const sc = (0.5 + 1.5 * on * (0.7 + 0.3 * nodes[i].w)) * dim;
      _p.set(nodes[i].x, nodes[i].y, 0); _s.set(sc, sc, 1); _m.compose(_p, _q, _s); nodeMesh.setMatrixAt(i, _m);
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
    _s.set(1, 1, 1);

    // 仓库脉冲放大
    const hs = 1 + 0.8 * hubPulse;
    for (let i = 0; i < hubs.length; i++) { _p.set(hubs[i].x, hubs[i].y, 0.001); _s.set(hs, hs, 1); _m.compose(_p, _q, _s); hubMesh.setMatrixAt(i, _m); }
    hubMesh.instanceMatrix.needsUpdate = true;
    _s.set(1, 1, 1);

    // 活跃弧线：按 density 截断实例数（峰值密度分批升上来）
    const active = activeArcs(sched, t);
    const cap = Math.floor(MAX_ARCS * density);
    let seg = 0, head = 0;
    for (const ai of active) {
      if (ai >= cap) continue;
      const a = sched.arcs[ai];
      // reverse 时 from 是 hub、to 是 node；非 reverse 时 from 是 node、to 是 hub
      const P0 = a.fromHub ? hubs[a.from] : nodes[a.from];
      const P1 = a.fromHub ? nodes[a.to] : hubs[a.to];
      if (!P0 || !P1) continue;
      const u = progressAt(sched, ai, t);
      // 彗头：弧线当前进度点，明亮大点（飞行中的订单主体）
      const headPt = arcPath(P0, P1, u, a.lift, a.dir);
      _p.set(headPt.x, headPt.y, 0.0008); _m.compose(_p, _q, _s); headMesh.setMatrixAt(head++, _m);
      // 拖尾：从 max(0,u-tail) 到 u 的折线
      const tail = 0.3;
      const u0 = Math.max(0, u - tail);
      let prev = arcPath(P0, P1, u0, a.lift, a.dir);
      for (let k = 1; k <= ARC_SEGS; k++) {
        const uu = u0 + (u - u0) * (k / ARC_SEGS);
        const pt = arcPath(P0, P1, uu, a.lift, a.dir);
        const dx = pt.x - prev.x, dy = pt.y - prev.y, len = Math.hypot(dx, dy) || 1e-6;
        const ang = Math.atan2(dy, dx);
        _p.set((prev.x + pt.x) / 2, (prev.y + pt.y) / 2, 0.0005);
        _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
        _s.set(len, 1, 1);
        _m.compose(_p, _q, _s);
        segMesh.setMatrixAt(seg++, _m);
        prev = pt;
        if (seg >= MAX_ARCS * ARC_SEGS) break;
      }
      _q.identity(); _s.set(1, 1, 1);
      if (seg >= MAX_ARCS * ARC_SEGS || head >= MAX_ARCS) break;
    }
    segMesh.count = seg;
    segMesh.instanceMatrix.needsUpdate = true;
    headMesh.count = head;
    headMesh.instanceMatrix.needsUpdate = true;
  }

  // GMV 计数器：t 的纯函数缓动（0 在 gmv 镜头起点，涨到 target）
  function gmvAt(local, dur, target) {
    const k = easeOut(Math.min(1, Math.max(0, local / dur)));
    return Math.floor(target * k);
  }

  return { root, box, draw, gmvAt, nodeCount: nodes.length, hubCount: hubs.length, arcCap: MAX_ARCS };
}
