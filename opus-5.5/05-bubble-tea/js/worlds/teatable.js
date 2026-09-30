// teatable.js — 茉莉奶绿 · 清晨茶席：早上的光从右上方的木格窗斜进来，窗格的影子一道道落在亚麻茶席和背墙上；
// 杯子立在茶席上，前景左下一枝茉莉的剪影伸进画面（焦外），几片白色花瓣慢慢飘落。整体亮、通透、低饱和，空气感
import * as THREE from 'three';
import { sweep, linenTexture, softSprites, dotTexture, driftField, keyLight } from './common.js';

/** 窗格的影子：一块挡在主光前面的木格（只投影、镜头里看不见），落到地面和墙上就是一道道斜的格子影 */
function mullions() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#000', colorWrite: false, depthWrite: false });
  for (let i = -3; i <= 3; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.012), m); bar.position.x = i * 0.07; bar.castShadow = true; g.add(bar); }
  for (let j = -2; j <= 2; j++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.012), m); bar.position.y = j * 0.11; bar.castShadow = true; g.add(bar); }
  return g;
}

/** 一枝茉莉：弯的细枝 + 几对叶子 + 几朵五瓣小白花，程序生成 */
function sprig(seed) {
  const g = new THREE.Group(), stemM = new THREE.MeshStandardMaterial({ color: '#3f5a2a', roughness: 0.7 }), leafM = new THREE.MeshStandardMaterial({ color: '#4d7a36', roughness: 0.55, side: THREE.DoubleSide });
  const petalM = new THREE.MeshPhysicalMaterial({ color: '#fbfbf4', roughness: 0.5, transmission: 0.25, thickness: 0.001, side: THREE.DoubleSide });
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.04, 0.05, 0.01], [0.1, 0.08, 0], [0.17, 0.085, -0.01]].map(p => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.0018, 6), stemM));
  const leaf = new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0).quadraticCurveTo(0.012, 0.018, 0, 0.04).quadraticCurveTo(-0.012, 0.018, 0, 0));
  for (let i = 1; i < 6; i++) {
    const p = curve.getPoint(i / 6), side = i % 2 ? 1 : -1, l = new THREE.Mesh(leaf, leafM);
    l.position.copy(p); l.rotation.set(0.3, 0, side * 1.0 + (i * 0.37) % 0.4); g.add(l);
  }
  const petal = new THREE.CircleGeometry(0.006, 10); petal.scale(1, 1.5, 1); petal.translate(0, 0.008, 0);
  for (let f = 0; f < 5; f++) {
    const flower = new THREE.Group(), p = curve.getPoint(0.55 + f * 0.1);
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(petal, petalM); m.rotation.z = (k / 5) * Math.PI * 2; flower.add(m); }
    flower.position.copy(p).add(new THREE.Vector3(0, 0.008 + 0.004 * (f % 2), 0.004)); flower.rotation.set(-0.5 + 0.2 * f, 0.3 * f, 0); g.add(flower);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function build(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color('#eef2e6');
  const linen = linenTexture(21, { color: '#ece6d6', repeat: [10, 5] });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshStandardMaterial({ color: '#d9d2bf', roughness: 0.85 }));
  table.rotation.x = -Math.PI / 2; table.position.z = -0.1; table.receiveShadow = true;
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.8), new THREE.MeshStandardMaterial({ map: linen, roughness: 0.95 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0.02, 0.0005, -0.1); runner.receiveShadow = true;
  const wall = new THREE.Mesh(sweep(['#f4f6ee', '#dfe6d2'], { floor: 0.3, R: 0.2, wall: 1.2, z0: -0.45 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  scene.add(table, runner, wall);

  // 主光：清晨的太阳从右上方斜进来，微暖；窗格挡在它前面
  const key = keyLight('#fff6e2', 2.6, [0.55, 0.7, 0.25], { radius: 3, size: 0.35 });
  const win = mullions(); win.position.set(0.3, 0.4, 0.14); win.lookAt(0, 0.05, -0.1);
  const sky = new THREE.HemisphereLight('#f2f8ff', '#cfd6bf', 1.0);
  scene.add(key, key.target, win, sky);

  // 前景左下的茉莉枝（焦外）+ 身后右边一枝（清楚些）
  const front = sprig(3); front.position.set(-0.13, 0.0, 0.13); front.rotation.y = 0.5; front.scale.setScalar(1.3);
  const back = sprig(4); back.position.set(0.1, 0.0, -0.14); back.rotation.y = 2.4;
  scene.add(front, back);

  // 飘落的花瓣
  const petalGeo = new THREE.CircleGeometry(0.005, 8); petalGeo.scale(1, 1.6, 1);
  const petals = driftField({
    geometry: petalGeo, count: 18, seed: 51, fade: 'scale',
    material: new THREE.MeshStandardMaterial({ color: '#fcfcf6', roughness: 0.6, side: THREE.DoubleSide }),
    box: [-0.2, 0.0, -0.16, 0.2, 0.26, 0.1], vel: [0.004, -0.018, 0], sway: 0.012, swayHz: 0.35, size: [0.7, 1.2], spin: 0.8,
  });
  // 窗外的亮：几颗很淡的焦外光斑
  const glints = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 8, seed: 52, fade: 'alpha',
    material: softSprites({ map: dotTexture(), color: '#ffffff', opacity: 0.35, additive: true, twinkle: 0.2 }),
    box: [0.1, 0.12, -0.6, 0.5, 0.38, -0.4], vel: [0, 0.002, 0], size: [0.03, 0.07], spin: 0,
  });
  scene.add(petals.mesh, glints.mesh);

  return {
    env: {
      base: '#e8ede0', strip: '#ffffff', k: 3.5,
      fill(add, B) {
        add(5, 4, [8, 6, 3], B('#fffaf0', 3.0));                    // 右上的窗：杯壁右侧一大块亮
        add(8, 3, [0, 3, 10], B('#f4f8ee', 1.2));
        add(10, 2, [0, -4, 5], B('#d8dcc8', 0.8));
      },
    },
    post: { exposure: 1.12, vignette: 0.1, grain: 0.015, saturation: 0.96, lift: [0.02, 0.026, 0.018], gamma: [1, 1, 1], gain: [0.99, 1.0, 0.96], bloom: { strength: 0.28, threshold: 0.82, radius: 0.5 } },
    update(s) { petals.update(s.t); glints.update(s.t); glints.mesh.material.uniforms.uTime.value = s.t; },
    reset() {},
    dispose() { linen.dispose(); },
  };
}
