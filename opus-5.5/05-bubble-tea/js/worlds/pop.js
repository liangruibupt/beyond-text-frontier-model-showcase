// pop.js — 草莓啵啵 · 夏日波普：一整片饱和的粉红纯色影棚，正上方偏右一盏硬光，杯子脚下一道利落的短影子；
// 背后几块几何色块（大红圆、黄色半圆、一条斜的白条纹），草莓切片和彩色小圆点从画外飞进来、绕着杯子转。平涂、高饱和、不要颗粒
import * as THREE from 'three';
import { sweep, driftField, keyLight } from './common.js';

/** 草莓切片：心形截面的薄片，外圈红、里面浅粉，中心一圈白色的放射纹（顶点色） */
function sliceGeometry() {
  const sh = new THREE.Shape(), N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, r = 0.016 * (1 - 0.18 * Math.sin(a)) * (1 + 0.1 * Math.cos(2 * a));
    const x = Math.cos(a) * r * 0.9, y = Math.sin(a) * r * 1.1;
    i ? sh.lineTo(x, y) : sh.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 48 });
  g.center();
  const p = g.attributes.position, col = new Float32Array(p.count * 3), outer = new THREE.Color('#d81a3a'), inner = new THREE.Color('#ff9fb0'), core = new THREE.Color('#fff2f4'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i) / 0.9, p.getY(i) / 1.1) / 0.016, a = Math.atan2(p.getY(i), p.getX(i));
    c.copy(inner).lerp(outer, THREE.MathUtils.smoothstep(r, 0.72, 0.92)).lerp(core, (1 - THREE.MathUtils.smoothstep(r, 0.12, 0.3)) * 0.9 + 0.25 * Math.max(0, Math.cos(a * 9)) * (1 - THREE.MathUtils.smoothstep(r, 0.3, 0.7)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function build(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color('#ff9fb8');
  const bg = new THREE.Mesh(sweep(['#ffb4c6', '#ff8fab'], { floor: 0.5, R: 0.25, wall: 1.4, z0: 0.35, mid: 0.4 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  bg.receiveShadow = true; scene.add(bg);
  // 几何色块：贴在背墙前面一点（z ≈ −0.2），平涂不受光
  const flat = c => new THREE.MeshBasicMaterial({ color: c });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.11, 64), flat('#ff3a5c')); disc.position.set(0.16, 0.2, -0.26);
  const half = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48, 0, Math.PI), flat('#ffd23f')); half.position.set(-0.2, 0.05, -0.24); half.rotation.z = 0.4;
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.028), flat('#fff4f6')); stripe.position.set(0, 0.16, -0.27); stripe.rotation.z = -0.45;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 48), flat('#ffffff')); ring.position.set(-0.13, 0.24, -0.25);
  scene.add(disc, half, stripe, ring);

  // 主光：硬、正上偏右前，影子短而实
  const key = keyLight('#ffffff', 3.0, [0.25, 0.9, 0.35], { radius: 1, size: 0.3 });
  scene.add(key, key.target, new THREE.HemisphereLight('#ffffff', '#ff7090', 1.1));

  // 飞进来的草莓切片（绕杯子外圈，慢慢自转）+ 彩色圆点
  const slices = driftField({
    geometry: sliceGeometry(), count: 9, seed: 31, fade: 'scale',
    material: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 0.8 }),
    box: [-0.2, 0.02, -0.1, 0.2, 0.22, 0.12], vel: [0.03, 0.012, 0], sway: 0.02, swayHz: 0.4, size: [0.8, 1.3], spin: 1.2,
  });
  slices.mesh.castShadow = true;
  const dots = driftField({
    geometry: new THREE.SphereGeometry(0.003, 12, 8), count: 30, seed: 32, fade: 'scale',
    material: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
    box: [-0.25, 0.0, -0.18, 0.25, 0.25, 0.12], vel: [-0.02, 0.01, 0], sway: 0.01, size: [0.6, 1.4], spin: 0,
  });
  const pal = ['#ffd23f', '#ffffff', '#ff3a5c', '#7fe3d0'], c = new THREE.Color();
  for (let i = 0; i < 30; i++) dots.mesh.setColorAt(i, c.set(pal[i % 4]));
  scene.add(slices.mesh, dots.mesh);

  return {
    env: {
      base: '#ffb0c2', strip: '#ffffff', k: 4,
      fill(add, B) {
        add(8, 8, [2, 10, 4], B('#ffffff', 2.2));                   // 顶上的大硬光
        add(1.5, 8, [-9, 3, 3], B('#ffffff', 2.5));                 // 左边一条白：杯壁上一道干净的高光
        add(12, 3, [0, -4, 5], B('#ff7a98', 1.2));                  // 粉色地面反上来
      },
    },
    post: { exposure: 1.06, vignette: 0.05, grain: 0, saturation: 1.22, lift: [0, 0, 0.01], gamma: [1, 1, 1], gain: [1.02, 1.0, 1.0], bloom: { strength: 0.1, threshold: 0.95, radius: 0.3 } },
    update(s) { slices.update(s.t); dots.update(s.t); },
    reset() {},
    dispose() {},
  };
}
