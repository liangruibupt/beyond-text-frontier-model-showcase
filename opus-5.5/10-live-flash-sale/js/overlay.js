// overlay.js — 相机前的图形层：一块贴着相机、填满画面的平面，贴一张每帧重绘的 CanvasTexture。
// §G(a)：非文字图形（红包、金币、心形、库存条、弹窗底板、印章、倒计时数字、冲击波、弹幕）画在这里，
// 挂在相机前所以有透视 / 光晕 / 景深；文字（信息、字幕、价格、已抢光…）走引擎文字层（更清晰、在后期之后）。
// 画面只由（变体, t）决定：draw(spec) 按组件的纯函数输出重绘，没有逐帧随机。Node 测试里没有 document 时整体是空操作。
import * as THREE from 'three';
import { ORANGE, RED, GOLD } from '../items.js';

const HAS_DOC = typeof document !== 'undefined';
const CW = 1280;   // 画布分辨率（横）；竖屏时按比例换高

/** 把画面比例坐标 (x,y)∈[0,1] 映射到画布像素 */
const px = (x, w) => x * w, py = (y, h) => y * h;

export function createOverlay(ctx, item) {
  if (!HAS_DOC) {
    // Node：没有 canvas，返回一个什么都不画的壳，shots 照常调用
    return { plane: null, draw() {}, attach() {}, dispose() {} };
  }
  const w = CW, h = Math.round(CW * (ctx.H / ctx.W || 1));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  plane.renderOrder = 10;
  plane.frustumCulled = false;

  // 平面加到 scene（相机不在场景图里，相机的子物体不会被渲染），每帧按相机世界变换锁到相机前距离 D
  const D = 0.6;
  function attach(camera) {
    if (plane.parent !== ctx.scene) ctx.scene.add(plane);
    camera.updateMatrixWorld();
    const vFov = (camera.fov * Math.PI) / 180;
    const ph = 2 * Math.tan(vFov / 2) * D, pw = ph * (ctx.W / ctx.H);
    plane.scale.set(pw, ph, 1);
    // 位置 = 相机位置 + 朝向 × D；朝向取相机本地 -z 的世界方向
    plane.quaternion.copy(camera.quaternion);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    plane.position.copy(camera.position).addScaledVector(dir, D);
    plane.updateMatrixWorld();
  }

  const acc = item.accent ?? ORANGE;

  function clear() { g.clearRect(0, 0, w, h); }
  function roundRect(x, y, ww, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); }

  // ── 画各组件 ──
  function heart(x, y, s, alpha) {
    g.save(); g.globalAlpha = alpha; g.fillStyle = acc; g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(-10, -4, -8, -14, 0, -8); g.bezierCurveTo(8, -14, 10, -4, 0, 6); g.fill(); g.restore();
  }
  function drawHearts(hearts) { for (const hh of hearts) if (hh.fade > 0.01) heart(px(hh.x, w), py(hh.y, h), 1.1, hh.fade * 0.9); }

  function drawDanmaku(list) {
    g.textBaseline = 'middle'; g.font = `600 ${Math.round(h * 0.03)}px "Noto Sans SC", "Fredoka", sans-serif`;
    for (const d of list) {
      g.save(); g.globalAlpha = d.alpha * 0.92;
      const tx = px(d.x, w), ty = py(d.y, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(d.text, tx + 2, ty + 2);
      g.fillStyle = '#ffffff'; g.fillText(d.text, tx, ty);
      g.restore();
    }
  }

  function drawCountdown(cd) {
    if (cd.shock) { g.save(); g.globalAlpha = cd.shock.alpha; g.strokeStyle = GOLD; g.lineWidth = h * 0.01; g.beginPath(); g.arc(w / 2, h * 0.44, cd.shock.r * h, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (cd.digit) {
      g.save(); g.globalAlpha = cd.digit.alpha; g.translate(w / 2, h * 0.44); g.scale(cd.digit.scale, cd.digit.scale);
      g.font = `900 ${Math.round(h * 0.3)}px "Noto Sans SC", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = h * 0.012; g.strokeStyle = RED; g.strokeText(cd.digit.char, 0, 0);
      g.fillStyle = '#ffffff'; g.fillText(cd.digit.char, 0, 0); g.restore(); g.textAlign = 'start';
    }
    if (cd.linkBurst > 0) { g.save(); g.globalAlpha = cd.linkBurst * 0.7; g.strokeStyle = ORANGE; g.lineWidth = h * 0.02; g.beginPath(); g.arc(w / 2, h * 0.5, (0.1 + 0.4 * cd.linkBurst) * h, 0, Math.PI * 2); g.stroke(); g.restore(); }
  }

  function drawCartBoard(c, row) {
    if (c.rise <= 0.001) return;
    const z = row.cartName ? row : null;   // 构图区（像素）稍后由 shot 传；这里按固定底部弹窗画底板
    const bw = w * 0.9, bx = (w - bw) / 2;
    const bh = h * 0.42, byFull = h - bh - h * 0.04;
    const by = byFull + (1 - Math.min(1, c.rise)) * bh;   // 从底部弹上来
    g.save(); g.globalAlpha = Math.min(1, c.rise);
    g.fillStyle = 'rgba(255,255,255,0.97)'; roundRect(bx, by, bw, bh, h * 0.03); g.fill();
    g.fillStyle = acc; roundRect(bx, by, w * 0.14, bh, h * 0.03); g.fill();          // 左侧商品小图块（主色）
    g.restore();
    if (c.ripple) { g.save(); g.globalAlpha = c.ripple.alpha; g.strokeStyle = ORANGE; g.lineWidth = h * 0.006; g.beginPath(); g.arc(bx + bw * 0.82, by + bh * 0.5, c.ripple.r * h, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (c.badge) { g.save(); g.globalAlpha = 1; g.translate(w * 0.9, h * 0.14); g.scale(c.badge.scale, c.badge.scale); g.fillStyle = RED; g.beginPath(); g.arc(0, 0, h * 0.03, 0, Math.PI * 2); g.fill(); if (c.badge.plus) { g.fillStyle = '#fff'; g.font = `900 ${Math.round(h * 0.03)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+1', 0, 0); g.textAlign = 'start'; } g.restore(); }
  }

  function envelope(x, y, spin, alpha, s = 1) {
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(Math.sin(spin) * 0.4); g.scale(s * (0.6 + 0.4 * Math.cos(spin)), s);
    const ew = h * 0.06, eh = h * 0.08; g.fillStyle = RED; roundRect(-ew / 2, -eh / 2, ew, eh, h * 0.006); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, -eh * 0.08, ew * 0.18, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawEnvelopes(e) {
    for (const en of e.envelopes) if (en.alpha > 0.02) envelope(px(en.x, w), py(en.y, h), en.spin, en.alpha);
    if (e.big) { envelope(px(e.big.x, w), py(e.big.y, h), 0, 1, 1.8 + e.big.open * 0.4);
      if (e.big.open > 0) { g.save(); g.globalAlpha = e.big.open; g.strokeStyle = GOLD; g.lineWidth = h * 0.008; g.beginPath(); g.arc(px(e.big.x, w), py(e.big.y, h), e.big.open * h * 0.12, 0, Math.PI * 2); g.stroke(); g.restore(); } }
    for (const c of e.coins) if (c.alpha > 0.02) { g.save(); g.globalAlpha = c.alpha; g.fillStyle = GOLD; g.beginPath(); g.arc(px(c.x, w), py(c.y, h), h * 0.018, 0, Math.PI * 2); g.fill(); g.restore(); }
  }

  function drawStockbar(sb, cartY = 0.78) {
    const bw = w * 0.6, bx = (w - bw) / 2, by = h * cartY, bh = h * 0.03;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(bx, by, bw, bh, bh / 2); g.fill();
    const fw = bw * (sb.width / 0.37);
    g.fillStyle = RED; roundRect(bx, by, Math.max(0, fw), bh, bh / 2); g.fill();
    g.restore();
  }

  const draw = {
    clear, roundRect, heart, drawHearts, drawDanmaku, drawCountdown, drawCartBoard, drawEnvelopes, drawStockbar,
    commit() { tex.needsUpdate = true; },
    g, w, h, acc,
  };

  return {
    plane, attach, draw,
    dispose() { plane.parent?.remove(plane); plane.geometry.dispose(); mat.dispose(); tex.dispose(); },
  };
}
