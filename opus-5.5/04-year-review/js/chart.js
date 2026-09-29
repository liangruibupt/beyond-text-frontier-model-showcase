// chart.js — months 镜头：一条圆角底座，十二根柱子按月依次从底座里升起（高按月订单数），最多的那根亮起来；
// 底座正面是月份数字（圆点，digits.js 的 layoutLabel），最多的那个月跟着亮。top 镜头开头整座沉进地面（sink），把地方让给饼图
// 柱子用裁剪面切在底座顶面，升起就是往上平移；所有部件也都切在地面，沉下去之后隔着透明的地面看不见。每帧的状态都是 lt 的闭式函数
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EV } from '../meta.js';
import { layoutLabel } from './digits.js';
import { clay } from './models/clay.js';
import { easeIn, easeInOut, easeOut, clamp, ss } from '../../factory/engine/ease.js';

/** 底座 [宽, 高, 深] · 柱宽 · 柱距 · 最高一根的高 · 升满时埋进底座的长度 · 月份数字（字高、圆点直径、字框底边） */
export const CHART = { plinth: [5.2, 0.34, 0.6], bar: 0.32, pitch: 0.42, tall: 1.7, sunk: 0.06, label: { height: 0.2, dot: 0.022, y0: 0.07 } };
export const RISE = 0.35, SINK = 0.3, SHRINK = 0.25;                 // 一根柱子升多久；top 开头底座沉下去、柱子缩回去各用多久
/** 第 i 根柱子开始升起的时刻：第一根在 EV.rise[0]，最后一根在 EV.rise[1] 升满 */
export const riseAt = i => EV.rise[0] + ((EV.rise[1] - EV.rise[0] - RISE) * i) / 11;
export const barX = i => (i - 5.5) * CHART.pitch;

/** months：十二个月的订单数。返回 { root, peak, pose(lt), sink(lt) } */
export function buildChart({ months, pal }) {
  const max = Math.max(...months), peak = months.indexOf(max), [pw, ph, pd] = CHART.plinth, root = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0), floorClip = new THREE.Plane(up, 0), barClip = new THREE.Plane(up.clone(), -ph);
  const base = new THREE.Color(pal.base), lit = new THREE.Color(pal.lit), soft = new THREE.Color(pal.soft);

  const plinth = new THREE.Mesh(new RoundedBoxGeometry(pw, ph, pd, 3, 0.05), clay({ color: pal.base, clippingPlanes: [floorClip], clipShadows: true }));
  plinth.position.y = ph / 2; plinth.castShadow = plinth.receiveShadow = true;
  root.add(plinth);
  const bars = months.map((m, i) => {
    const h = (CHART.tall * m) / max, color = base.clone().lerp(lit, 0.15 + (0.45 * m) / max);
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(CHART.bar, h + CHART.sunk, CHART.bar, 3, 0.04), clay({ color, emissive: pal.lit, emissiveIntensity: 0, clippingPlanes: [barClip, floorClip], clipShadows: true }));
    mesh.position.x = barX(i); mesh.castShadow = true;
    root.add(mesh);
    return { mesh, h, color };
  });

  // 月份数字：两组圆点，平常的一组和最多那个月的一组（它的材质随亮起变成点缀色、微微自发光，在底座上还认得出来）
  const dot = CHART.label.dot, dotGeo = new THREE.CylinderGeometry(dot / 2, dot / 2, 0.008, 14).rotateX(Math.PI / 2);
  const labels = months.map((_, i) => layoutLabel(String(i + 1), { ...CHART.label, x: barX(i) }));
  const m4 = new THREE.Matrix4();
  const dots = (list, mat) => {
    const mesh = new THREE.InstancedMesh(dotGeo, mat, list.length);
    list.forEach((d, j) => mesh.setMatrixAt(j, m4.makeTranslation(d.x, d.y, pd / 2 + 0.002)));
    root.add(mesh);
    return mesh;
  };
  dots(labels.filter((_, i) => i !== peak).flat(), clay({ color: pal.soft, clippingPlanes: [floorClip] }));
  const hotMat = clay({ color: pal.soft, emissive: pal.lit, emissiveIntensity: 0, clippingPlanes: [floorClip] }), hot = new THREE.Color(pal.accent);
  dots(labels[peak], hotMat);

  /** grow(i) 是第 i 根柱子露出的比例，bump 是最多那根多冒出的比例，k 是它亮起的程度，drop 是整座沉下的距离 */
  function write({ grow, bump = 0, k, drop }) {
    root.position.y = -drop;
    barClip.constant = -(ph - drop);
    bars.forEach((b, i) => { b.mesh.position.y = ph + b.h * (grow(i) + (i === peak ? bump : 0)) - (b.h + CHART.sunk) / 2; });
    const P = bars[peak].mesh.material;
    P.color.copy(bars[peak].color).lerp(lit, k); P.emissiveIntensity = 0.9 * k;
    hotMat.color.copy(soft).lerp(hot, k); hotMat.emissiveIntensity = 0.35 * k;
  }
  return {
    root, peak, labels,
    /** months 镜头：依次升起；EV.peak 前后最多那根往上冒一下、亮起来 */
    pose(lt) {
      write({ grow: i => easeOut((lt - riseAt(i)) / RISE), bump: 0.05 * Math.sin(Math.PI * clamp((lt - (EV.peak - 0.15)) / 0.3)), k: ss(EV.peak - 0.15, EV.peak + 0.1, lt), drop: 0 });
    },
    /** top 镜头开头（只在 15 秒版里接着 months）：柱子缩回底座，底座连着数字沉到地面下 */
    sink(lt) {
      const g = 1 - easeIn(lt / SHRINK);
      write({ grow: () => g, k: 1, drop: (ph + 0.02) * easeInOut(lt / SINK) });
    },
  };
}
