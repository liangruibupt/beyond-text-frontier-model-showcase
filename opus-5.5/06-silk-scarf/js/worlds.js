// worlds.js — 四款丝巾各一个场景（setup 时按 scarf 建一个）：背景、地面、光、反射环境、后期
// 每个场景返回 { env, post, props, update(s), reset(), dispose() }；props 是镜头要用的东西（人台、石台、瓷瓶……）
// 目前：dunhuang 洞窟做完整；其余三款先是同一套中性影棚（占位），各自的镜头做到时再替换
import * as THREE from 'three';
import { sweep, dotTexture, softSprites, driftField, puffAtlas, keyLight } from '../../05-bubble-tea/js/worlds/common.js';
import { BUST } from '../meta.js';
import { BUST_COLLIDERS, CHEST } from './bust.js';

/** 人台：躯干 + 肩 + 颈，碰撞体和网格同一组尺寸（布料的 colliders 从这里取） */
export function bust(color = '#e9e2d6') {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, sheen: 0.3 });
  const { shoulder: sh, neck, base } = BUST, chest = CHEST;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(sh * 0.78, sh * 0.62, chest - base, 48), m); torso.position.y = (chest + base) / 2; torso.scale.z = 0.62;
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, sh * 2 - 0.11, 8, 24), m); cap.rotation.z = Math.PI / 2; cap.position.y = chest; cap.scale.set(1, 1, 0.7);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(neck, neck * 1.15, 0.12, 32), m); nk.position.y = chest + 0.06;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, base, 16), new THREE.MeshStandardMaterial({ color: '#2a2420', metalness: 0.6, roughness: 0.4 })); stand.position.y = base / 2;
  for (const x of [torso, cap, nk]) { x.castShadow = true; x.receiveShadow = true; }
  g.add(torso, cap, nk, stand);
  return { group: g, colliders: BUST_COLLIDERS, chest };
}

const WORLDS = {
  // 敦煌：烛光洞窟。土黄的窟壁（弯成穹顶的背景），石台，侧面一盏暖烛光，空气里浮着尘
  dunhuang(ctx) {
    const { scene } = ctx;
    scene.background = new THREE.Color('#1b0f08'); scene.fog = new THREE.Fog('#24140a', 1.2, 4.5);
    const wall = new THREE.Mesh(sweep(['#5a3a22', '#2a180c'], { width: 5, floor: 2, R: 0.8, wall: 3, z0: -1.4 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    wall.receiveShadow = true;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 0.9 }));
    plinth.position.set(-0.6, 0.45, -0.3); plinth.castShadow = plinth.receiveShadow = true;
    const key = keyLight('#ffb062', 2.4, [-1.4, 2.2, 1.0], { radius: 3, size: 1.2 });
    const rim = new THREE.DirectionalLight('#ffcf8a', 0.9); rim.position.set(1.2, 1.8, -1.6);
    scene.add(wall, plinth, key, key.target, rim, new THREE.HemisphereLight('#4a3220', '#120a05', 0.5));
    const dust = driftField({
      geometry: new THREE.PlaneGeometry(1, 1), count: 60, seed: 61, fade: 'alpha',
      material: softSprites({ map: dotTexture(), color: '#ffd9a0', opacity: 0.5, additive: true, twinkle: 0.4 }),
      box: [-1.2, 0.2, -1.0, 1.2, 2.2, 0.6], vel: [0.01, 0.006, 0], sway: 0.02, swayHz: 0.15, size: [0.006, 0.014], spin: 0,
    });
    scene.add(dust.mesh);
    return {
      env: { base: '#120a05', strip: '#ffd2a0', k: 2, fill(add, B) { add(3, 6, [-10, 6, 5], B('#ffb060', 3)); add(6, 2, [6, 3, -8], B('#ffcf8a', 1)); } },
      post: { exposure: 0.92, vignette: 0.38, grain: 0.015, saturation: 1.06, lift: [0.01, 0.005, 0], gain: [1.03, 0.98, 0.9], bloom: { strength: 0.18, threshold: 0.85, radius: 0.5 } },
      props: { plinth: { top: 0.9, c: [-0.6, 0.9, -0.3] } },
      update(s) { dust.update(s.t); dust.mesh.material.uniforms.uTime.value = s.t; },
      reset() {}, dispose() {},
    };
  },
};
// 占位影棚（songjin / qinghua / yunhe 的场景做到时替换）
function studio(ctx, k) {
  const { scene } = ctx;
  scene.background = new THREE.Color(k.palette.ink === '#1f2a44' || k.palette.ink === '#16295a' ? '#e8e4dc' : '#241820');
  const wall = new THREE.Mesh(sweep(['#d8d2c6', '#b8b0a2'], { width: 5, floor: 2, R: 0.8, wall: 3, z0: -1.4 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  const key = keyLight('#fff4e6', 2.2, [-1.2, 2.4, 1.4], { radius: 3, size: 1.2 });
  scene.add(wall, key, key.target, new THREE.HemisphereLight('#ffffff', '#806a5a', 0.6));
  return { env: {}, post: { exposure: 1, vignette: 0.2 }, props: {}, update() {}, reset() {}, dispose() {} };
}

export function buildWorld(ctx, scarf, k) { return (WORLDS[scarf] ?? (c => studio(c, k)))(ctx, k); }
