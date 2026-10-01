// meta.js — 成片骨架（纯数据，浏览器与 Node 测试共用）：轴、剪辑表、命中点、封面时刻、杯子尺寸与机位、文件命名
// 80 bpm，一小节 3 秒；命中点都落在 0.75 秒（一拍）的网格上

export const BAR = 3.0, GRID = 0.75;
export const SHOTS = ['pearls', 'pour', 'ice', 'hero', 'straw', 'end'];
// 镜头内部的事件（镜头本地秒）：珍珠落底（pearls）、奶花绽开（pour）、冰块碰撞（ice）、水珠滑落（hero）、吸管刺破封膜（straw）
export const EV = { land: 1.5, bloom: 0.75, clink: 0.75, drip: 1.5, punch: 0.75 };

export const CUTS = {
  15: {
    shots: [
      { shot: 'pearls', dur: 2.25 }, { shot: 'pour', dur: 2.25 }, { shot: 'ice', dur: 1.5 },
      { shot: 'hero', dur: 3.0 },
      { shot: 'straw', dur: 3.0, transition: { type: 'dissolve', dur: 0.25 } },
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.4 } },
    ],
    hits: { land: 1.5, bloom: 3.0, clink: 5.25, hero: 6.0, drip: 7.5, punch: 9.75, logo: 12.0 }, cover: 7.6,
  },
  6: {
    shots: [
      { shot: 'ice', dur: 1.5 },                                                         // 0.75 冰块碰撞
      { shot: 'straw', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } },   // 从刺破那一刻切入
      { shot: 'end', dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { clink: 0.75, punch: 1.5, logo: 3.0 }, cover: 4.4,
  },
};

// 杯子（米）：透明 PP 杯，杯底半径 3.0 cm、杯口 4.2 cm、高 12 cm，壁厚 0.6 mm，杯底 2 mm；茶汤满到 9.6 cm（上面留 2.4 cm 空气，折射看得出来）
// 杯底 2.6 cm 是珍珠层（pile）：珍珠贴着杯壁、缝里是糖浆 / 果泥，茶汤从它上面开始（不透明的奶茶会把泡在里面的珍珠盖掉）
// 封膜压在杯口；吸管直径 1.2 cm、长 21 cm
export const CUP = { rBottom: 0.030, rTop: 0.042, height: 0.12, wall: 0.0006, base: 0.002, fill: 0.096, pile: 0.026, lid: 0.0012 };
export const STRAW = { r: 0.006, len: 0.21 };
export const PEARL = { r: 0.0048, count: 60 };
const R = CUP.rTop;
export const BOX = {
  cup: [[-R, 0, -R], [R, CUP.height, R]],
  low: [[-R, 0, -R], [R, CUP.height * 0.55, R]],                                         // 杯子下半截：珍珠落杯的特写
  top: [[-R, CUP.height * 0.42, -R], [R, CUP.height, R]],                                 // 杯子上半截：冰块浮在液面上
  straw: [[-R, CUP.height * 0.18, -R], [R, CUP.height + 0.035, R]],                        // 杯子上大半截 + 杯口上方露出的一段吸管
};
// 各镜头框取的对象与机位：pitch 仰角、yaw 绕竖轴（度，[起, 止] 随镜头进度变化），shots.js 与 layouts 测试共用
export const VIEW = {
  pearls: { box: 'low', pitch: 38, yaw: [-10, -4], fov: 30 },
  pour: { box: 'cup', pitch: 14, yaw: [-6, 2], fov: 28 },
  ice: { box: 'top', pitch: 34, yaw: [18, 12], fov: 30 },
  hero: { box: 'cup', pitch: 8, yaw: [-28, 18], fov: 28 },
  straw: { box: 'straw', pitch: 16, yaw: [-14, -8], fov: 28 },
  end: { box: 'cup', pitch: 7, yaw: [10, 4], fov: 28 },
};
const D = Math.PI / 180;
export const viewDir = (pitch, yaw) => [Math.sin(yaw * D) * Math.cos(pitch * D), Math.sin(pitch * D), Math.cos(yaw * D) * Math.cos(pitch * D)];
/** 相机的 up：绕视线滚转 roll 度（荷兰角）。dir = 从主体指向相机 */
export function upFor(dir, roll = 0) {
  if (!roll) return [0, 1, 0];
  const [x, , z] = dir, n = Math.hypot(x, z) || 1, r = [z / n, 0, -x / n], c = Math.cos(roll * D), s = Math.sin(roll * D);
  return [s * r[0], c, s * r[2]];
}
/** 口味风格 cam（styles.js 的 camera）叠在 VIEW 上之后，镜头进度 u 时的机位：{ box, dir, up, fov, scale }；shots.js 与 layouts 测试共用 */
export function viewAt(name, cam, u) {
  const V = VIEW[name], e = u * u * (3 - 2 * u), k = cam.orbit ?? 1, yaw = cam.yaw + V.yaw[0] * k + (V.yaw[1] - V.yaw[0]) * k * e;
  const pitch = Math.max(2, V.pitch + cam.pitch), dir = viewDir(pitch, yaw), push = cam.push ?? [1, 1];
  return { box: V.box, dir, up: upFor(dir, cam.roll ?? 0), fov: V.fov, scale: push[0] + (push[1] - push[0]) * e };
}

export const META = {
  id: '05-bubble-tea',
  axes: { flavor: ['brownsugar', 'jasmine', 'strawberry', 'taro'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] },
  sceneAxes: ['flavor'],
  cuts: CUTS,
  fileName: v => `bocha_${v.flavor}_${v.cut}s_${v.ar}_${v.lang}${v.promo === 'none' ? '' : `_${v.promo}`}${v.vo === 'off' ? '_novo' : ''}`,
};
