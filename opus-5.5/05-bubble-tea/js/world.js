// world.js — 奶茶的影棚：无缝背景弯（上下两色的渐变，取口味的 bg），冷白的逆光和一盏主光（投影 + 焦散），反射环境里两条长条灯勾出杯壁的高光
// 世界只描述反射环境（env），由 film.setup 生成 PMREM（Node 测试里没有渲染器，世界照样能建）
import * as THREE from 'three';

/** 背景弯：地面 → 圆弧 → 背墙；顶点色按高度从 bg[1]（地面）渐变到 bg[0]（墙顶） */
function sweep([top, bottom], { width = 3, floor = 1.2, R = 0.35, wall = 1.6, z0 = 0.5 } = {}) {
  const g = new THREE.PlaneGeometry(width, 1, 1, 96), p = g.attributes.position, arc = (Math.PI / 2) * R, L = floor + arc + wall;
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top), col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const s = (0.5 - p.getY(i)) * L;
    let y, z;
    if (s < floor) { y = 0; z = z0 - s; }
    else if (s < floor + arc) { const a = (s - floor) / R; y = R * (1 - Math.cos(a)); z = z0 - floor - R * Math.sin(a); }
    else { y = R + (s - floor - arc); z = z0 - floor - R; }
    p.setXYZ(i, p.getX(i), y, z);
    c.copy(c0).lerp(c1, Math.min(1, Math.max(0, (s - floor * 0.7) / (arc + wall * 0.6)))); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function build(ctx, flavor) {
  const { scene } = ctx;
  scene.background = new THREE.Color(flavor.bg[0]);
  const bg = new THREE.Mesh(sweep(flavor.bg), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  bg.receiveShadow = true; scene.add(bg);
  const key = new THREE.DirectionalLight('#fff7ee', 2.2);
  key.position.set(-0.45, 0.8, 0.55); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.1, far: 3 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#eef6ff', 1.6); rim.position.set(0.5, 0.45, -0.7); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', flavor.bg[1], 0.6));
  return {
    env: {
      base: '#dcd8d2', strip: '#ffffff', k: 4,
      fill(add, B) {
        add(6, 4, [0, 4, 10], B('#ffffff', 1.3));                     // 正面大柔光
        add(1.2, 9, [-8, 3, 4], B('#ffffff', 2.4));                   // 左前长条：杯壁左侧一道亮边
        add(1.2, 9, [8, 3, 4], B('#fff4e8', 2.0));                    // 右前长条
        add(12, 3, [0, -4, 6], B(flavor.bg[1], 0.8));                 // 地面反上来的口味色
      },
    },
    post: { exposure: 1.05, aperture: 0, vignette: 0.16, grain: 0.02, saturation: 1.05, bloom: { strength: 0.18, threshold: 0.9 } },
    update() {},
    reset() {},
    dispose() {},
  };
}
