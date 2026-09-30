// syrup.js — 黑糖珍珠 · 深夜糖铺：打烊后的老糖铺，屋里暗下去，只剩吧台上方一盏琥珀色的灯从左后方斜打过来，
// 杯子的左边缘勾出一道暖亮边、右半边沉进暗里。杯子立在包浆的旧木吧台上；身后是熬糖的铁锅冒着热气（蒸汽在逆光里亮起来），
// 更远处墙上几盏小灯在焦外化成暖色光斑。整个画面偏暖、偏暗、颗粒重一点
import * as THREE from 'three';
import { sweep, woodTexture, dotTexture, softSprites, driftField, puffAtlas, keyLight } from './common.js';

export function build(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color('#120904');
  scene.fog = new THREE.Fog('#150a05', 0.6, 2.6);
  // 吧台：一块宽木板（地面），后面是深色的墙弯
  const wood = woodTexture(11, { light: '#6a3a1c', dark: '#26120a', repeat: [3, 1.2] });
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25 }));
  counter.rotation.x = -Math.PI / 2; counter.position.set(0, 0, -0.05); counter.receiveShadow = true;
  const wall = new THREE.Mesh(sweep(['#1a0d06', '#2a1409'], { floor: 0.4, R: 0.2, wall: 1.4, z0: -0.35 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.position.y = -0.001;
  scene.add(counter, wall);

  // 主光：琥珀色，左后上方（逆光偏侧），硬一点的影子朝镜头这边拉长
  const key = keyLight('#ffb35c', 3.2, [-0.5, 0.55, -0.55], { radius: 2 });
  const fill = new THREE.DirectionalLight('#6a86b0', 0.25); fill.position.set(0.7, 0.3, 0.8);   // 窗外一点冷的街灯，让暗部不死黑
  const bounce = new THREE.PointLight('#ff8a3a', 0.25, 0.6, 2); bounce.position.set(0.05, 0.02, 0.12);  // 木台面反上来的暖光
  scene.add(key, key.target, fill, bounce, new THREE.HemisphereLight('#3a2010', '#120804', 0.35));

  // 熬糖锅的热气：杯子后方的一列雾团，慢慢往上飘，在逆光里亮
  const puffs = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 26, seed: 71, fade: 'alpha',
    material: softSprites({ map: puffAtlas(71), color: '#ffcf9a', opacity: 0.16, atlas: true }),
    box: [-0.22, 0.0, -0.32, -0.02, 0.36, -0.2], vel: [0.004, 0.035, 0], sway: 0.01, swayHz: 0.2, size: [0.08, 0.16], spin: 0,
  });
  // 墙上的小灯：焦外的暖色光斑
  const bokeh = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 14, seed: 72, fade: 'alpha',
    material: softSprites({ map: dotTexture({ ring: 0.35 }), color: '#ffae55', opacity: 0.55, additive: true, twinkle: 0.25 }),
    box: [-0.6, 0.08, -0.9, 0.6, 0.42, -0.7], vel: [0.002, 0, 0], sway: 0.004, size: [0.025, 0.06], spin: 0,
  });
  scene.add(puffs.mesh, bokeh.mesh);

  return {
    env: {
      base: '#0c0604', strip: '#ffd2a0', k: 2.2,
      fill(add, B) {
        add(3, 6, [-10, 4, -6], B('#ffb060', 3.2));                 // 左后方的灯：杯壁左侧一道暖亮线
        add(1, 6, [9, 2, 5], B('#8098c0', 0.5));                    // 右前一点冷光
        add(10, 2, [0, -4, 4], B('#5a2e14', 0.8));                  // 木台面反上来的暖色
      },
    },
    post: { exposure: 0.95, vignette: 0.42, grain: 0.05, saturation: 1.08, lift: [0.012, 0.006, 0], gamma: [1, 1, 1], gain: [1.04, 0.97, 0.88], bloom: { strength: 0.35, threshold: 0.75, radius: 0.6 } },
    update(s) { puffs.update(s.t); bokeh.update(s.t); puffs.mesh.material.uniforms.uTime.value = s.t; bokeh.mesh.material.uniforms.uTime.value = s.t; },
    reset() {},
    dispose() { wood.dispose(); },
  };
}
