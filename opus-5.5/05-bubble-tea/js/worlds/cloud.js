// cloud.js — 芋泥 · 紫雾云朵：杯子浮在一片淡紫色的云海里（脚下是一层柔软的云面，没有桌子），四周雾团慢慢翻涌、
// 飘着几颗发光的小光球和切成小方块的芋头（紫色带白色细纹），一切都慢。光很软：正上方一大块柔光，背后一点粉紫的轮廓光。重泛光、轻柔焦
import * as THREE from 'three';
import { sweep, softSprites, dotTexture, driftField, puffAtlas, keyLight } from './common.js';

/** 芋头丁：圆角小方块，淡紫里带几道白色的细纹（顶点色按位置取噪声） */
function taroGeometry() {
  const g = new THREE.BoxGeometry(0.012, 0.012, 0.012, 4, 4, 4), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#b596d6'), b = new THREE.Color('#f2eaf8'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize().multiplyScalar(0.0062); p.setXYZ(i, ...v.lerp(n, 0.35).toArray());
    const k = 0.5 + 0.5 * Math.sin(v.x * 900 + v.y * 600 + v.z * 1300);
    col.set(c.copy(a).lerp(b, k ** 6 * 0.8).toArray(), i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

export function build(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color('#d9ccef');
  scene.fog = new THREE.FogExp2('#dccff0', 1.6);
  const floor = new THREE.Mesh(sweep(['#e8def7', '#cdbbe8'], { floor: 0.6, R: 0.4, wall: 1.4, z0: 0.4, mid: 0.2 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  floor.receiveShadow = true; scene.add(floor);

  const key = keyLight('#fff6ff', 1.8, [0.1, 1.0, 0.3], { radius: 12, size: 0.3 });          // 很软的顶光：影子几乎化开
  const rim = new THREE.DirectionalLight('#ff9ee8', 1.4); rim.position.set(-0.4, 0.3, -0.7);    // 背后粉紫轮廓光
  const rim2 = new THREE.DirectionalLight('#9ec8ff', 0.8); rim2.position.set(0.5, 0.2, -0.6);
  scene.add(key, key.target, rim, rim2, new THREE.HemisphereLight('#f8f0ff', '#b8a0dc', 1.2));

  // 云：脚下一圈低矮的云团贴着地面翻 + 远处几团大的
  const atlas = puffAtlas(91);
  const low = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 30, seed: 91, fade: 'alpha',
    material: softSprites({ map: atlas, color: '#fbf6ff', opacity: 0.55, atlas: true }),
    box: [-0.35, 0.0, -0.25, 0.35, 0.03, 0.2], vel: [0.012, 0.002, 0], sway: 0.01, swayHz: 0.15, size: [0.08, 0.16], spin: 0,
  });
  const far = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 12, seed: 92, fade: 'alpha',
    material: softSprites({ map: atlas, color: '#efe4fb', opacity: 0.45, atlas: true }),
    box: [-0.8, 0.05, -1.0, 0.8, 0.45, -0.5], vel: [0.01, 0.003, 0], sway: 0.02, swayHz: 0.1, size: [0.35, 0.6], spin: 0,
  });
  const orbs = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 16, seed: 93, fade: 'alpha',
    material: softSprites({ map: dotTexture(), color: '#ffe8ff', opacity: 0.8, additive: true, twinkle: 0.45 }),
    box: [-0.25, 0.02, -0.3, 0.25, 0.3, 0.1], vel: [0, 0.01, 0], sway: 0.015, swayHz: 0.25, size: [0.008, 0.022], spin: 0,
  });
  const taro = driftField({
    geometry: taroGeometry(), count: 10, seed: 94, fade: 'scale',
    material: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }),
    box: [-0.17, 0.03, -0.12, 0.17, 0.2, 0.1], vel: [0.004, 0.006, 0], sway: 0.01, swayHz: 0.2, size: [0.7, 1.3], spin: 0.3,
  });
  scene.add(far.mesh, low.mesh, orbs.mesh, taro.mesh);

  return {
    env: {
      base: '#dccff0', strip: '#ffffff', k: 2.5,
      fill(add, B) {
        add(10, 10, [0, 10, 2], B('#ffffff', 1.8));
        add(4, 6, [-8, 2, -6], B('#ffb0ec', 2.2));                  // 背后粉紫：杯壁边上一圈柔的彩色亮边
        add(4, 6, [8, 2, -6], B('#b0d0ff', 1.6));
      },
    },
    post: { exposure: 1.1, vignette: 0.18, grain: 0.01, saturation: 1.05, lift: [0.03, 0.02, 0.05], gamma: [1, 1, 1], gain: [1.0, 0.97, 1.04], bloom: { strength: 0.55, threshold: 0.7, radius: 0.8 }, aperture: 0.22, maxBlur: 0.005 },
    update(s) {
      for (const f of [low, far, orbs, taro]) f.update(s.t);
      orbs.mesh.material.uniforms.uTime.value = s.t;
    },
    reset() {},
    dispose() { atlas.dispose(); },
  };
}
