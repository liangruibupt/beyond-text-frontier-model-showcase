// clay.js — 全片的"黏土玩具"材质：偏哑光的 MeshPhysical 加一层薄清漆（方块、包裹、柱子、饼块、商品、购物车共用）
import * as THREE from 'three';

export const clay = o => new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, ...o });
