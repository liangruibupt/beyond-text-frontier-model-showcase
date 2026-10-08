// overlay.js — 相机前的图形层：一块贴在相机前、填满画面的平面，贴一张每帧重绘的 CanvasTexture。
// 直播间的全部包装都画在这里（弹幕、外框、倒计时、购物车弹窗及其文字、红包雨、库存条、印章），
// 所有东西在同一套画布坐标里，所以弹窗底板和它的文字天然对齐。
// 关键（R2 修）：平面放在景深焦距处（coc=0 → 清晰，不被 DoF 糊开）；颜色压在泛光阈值以下（不炸成白团）；
// 文字用成片已加载的字体（Noto Sans SC / Fredoka），document.fonts 就绪后再画。
// 画面只由（变体, t）决定：draw(state, txt) 按 pack/state.js 的纯数据重绘，无逐帧随机。Node 无 document 时是空操作壳。
import * as THREE from 'three';
import { ORANGE, RED, GOLD } from '../items.js';
import { countdownSpot } from '../layouts.js';

const HAS_DOC = typeof document !== 'undefined';
const CWREF = 1600;   // 画布参考分辨率（横）；竖屏按比例换高

const FZH = `"Noto Sans SC", "Fredoka", sans-serif`;
const FEN = `"Fredoka", "Noto Sans SC", sans-serif`;
const font900 = (lang) => (lang === 'en' ? FEN : FZH);

/** opts.scrim：AI 实拍底图上加一层很淡的上 / 下渐变暗边（弹幕带、弹窗 / 字幕带），让小字在真实画面上也读得清 */
export function createOverlay(ctx, item, { scrim = false } = {}) {
  if (!HAS_DOC) return { plane: null, draw() {}, place() {}, dispose() {} };

  const w = CWREF, h = Math.round(CWREF * (ctx.H / ctx.W || 1));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // toneMapped:false → UI 颜色按原值写入（白≈1.0 < 泛光阈值 1.1 → 不发光糊团）；DoF 已在 studio 关掉 → 不被景深糊。
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  plane.renderOrder = 50; plane.frustumCulled = false;

  const acc = item.accent ?? ORANGE;
  const _dir = new THREE.Vector3();

  /** 把平面放到相机前「焦距」处（景深 coc=0 → 清晰），并撑满画面。focusDist 由镜头的取景解出。 */
  function place(camera, focusDist) {
    if (plane.parent !== ctx.scene) ctx.scene.add(plane);
    camera.updateMatrixWorld();
    const D = Math.max(0.2, focusDist || 1.2);
    const vFov = (camera.fov * Math.PI) / 180;
    const ph = 2 * Math.tan(vFov / 2) * D, pw = ph * (ctx.W / ctx.H);
    plane.scale.set(pw, ph, 1);
    plane.quaternion.copy(camera.quaternion);
    _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    plane.position.copy(camera.position).addScaledVector(_dir, D);
    plane.updateMatrixWorld();
  }

  // ── 画布助手（画面比例 → 像素） ──
  const X = x => x * w, Y = y => y * h, S = s => s * h;   // 尺寸一律按画面高度，和构图比例一致
  function rr(x, y, ww, hh, r) { r = Math.min(r, ww / 2, hh / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); }
  function text(str, x, y, size, { lang = 'zh', weight = 900, fill = '#fff', align = 'center', outline = null, glow = null } = {}) {
    g.save(); g.font = `${weight} ${size}px ${font900(lang)}`; g.textAlign = align; g.textBaseline = 'middle';
    if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.35; }
    if (outline) { g.lineWidth = Math.max(2, size * 0.08); g.lineJoin = 'round'; g.strokeStyle = outline; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y); g.restore();
  }

  // ── 外框 chrome：左上一枚深色半透明胶囊（头像 + 有集直播 + 在线人数 + 红 LIVE），右下点赞心形 ──
  function drawChrome(ch, txt) {
    if (ch.dim <= 0) return;
    g.save(); g.globalAlpha = ch.dim;
    const ph = S(0.052), top = Y(0.035), left = X(0.03), ah = ph * 0.76;   // 胶囊高 ≈5.2% 画面高；头像直径
    // 先量名称 / 人数两行的宽度，决定胶囊宽
    const nameSz = ph * 0.4, viewSz = ph * 0.34;
    g.font = `900 ${nameSz}px ${font900(txt.lang)}`; const nameW = g.measureText(txt.live).width;
    g.font = `500 ${viewSz}px ${font900(txt.lang)}`; const viewW = g.measureText(txt.viewers).width;
    const liveW = ch.live ? S(0.085) : 0, gap = S(0.012);
    const textW = Math.max(nameW, viewW);
    const pillW = ah + gap + textW + (liveW ? liveW + gap : 0) + ph * 0.5;
    // 胶囊底
    g.fillStyle = 'rgba(14,16,24,0.74)'; rr(left, top, pillW, ph, ph * 0.5); g.fill();
    // 头像
    const ax = left + ph * 0.18 + ah / 2, ay = top + ph / 2;
    g.fillStyle = acc; g.beginPath(); g.arc(ax, ay, ah / 2, 0, Math.PI * 2); g.fill();
    text('有', ax, ay, ah * 0.62, { lang: 'zh', fill: '#fff' });
    // 名称 + 人数两行
    const tx = ax + ah / 2 + gap;
    text(txt.live, tx, top + ph * 0.34, nameSz, { lang: txt.lang, fill: '#fff', align: 'left' });
    text(txt.viewers, tx, top + ph * 0.72, viewSz, { lang: txt.lang, weight: 500, fill: '#ffd9b0', align: 'left' });
    // 红 LIVE 标（胶囊右端）
    if (ch.live) { const lh = ph * 0.5, lx = left + pillW - liveW - ph * 0.22, ly = top + (ph - lh) / 2; g.fillStyle = RED; rr(lx, ly, liveW, lh, lh * 0.3); g.fill(); text('LIVE', lx + liveW / 2, ly + lh / 2, lh * 0.56, { lang: 'en', weight: 700, fill: '#fff' }); }
    g.restore();
    // 点赞心形（右下，更大更饱和）
    for (const hp of ch.hearts) if (hp.fade > 0.02) { g.save(); g.globalAlpha = hp.fade; g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = S(0.01); g.translate(X(hp.x), Y(hp.y)); const s = S(0.028); g.beginPath(); g.moveTo(0, s * 0.6); g.bezierCurveTo(-s, -s * 0.4, -s * 0.8, -s * 1.4, 0, -s * 0.8); g.bezierCurveTo(s * 0.8, -s * 1.4, s, -s * 0.4, 0, s * 0.6); g.fill(); g.restore(); }
  }

  // ── 弹幕：白粗体 + 深描边，深色半透明胶囊，上方 40%；胶囊宽用纯函数给的 w（画面宽比例），和碰撞测试一致 ──
  function drawDanmaku(list, lang) {
    const size = S(0.034);
    for (const d of list) {
      g.save(); g.globalAlpha = d.alpha;
      const bx = X(d.x), bw = X(d.w), by = Y(d.y) - size * 0.9, bh = size * 1.8;
      g.fillStyle = 'rgba(14,16,24,0.6)'; rr(bx, by, bw, bh, bh * 0.5); g.fill();
      g.font = `700 ${size}px ${font900(lang)}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const tx = bx + bw * 0.5 - g.measureText(d.text).width / 2;   // 居中于胶囊
      g.lineWidth = Math.max(2, size * 0.09); g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(d.text, tx, Y(d.y));
      g.fillStyle = '#ffffff'; g.fillText(d.text, tx, Y(d.y));
      g.restore();
    }
  }

  // ── 倒计时：巨大数字（~45% 高）、白/金 + 粗描边 + 辉光 + 冲击波环；上链接大爆开 ──
  function drawCountdown(cd, txt) {
    const spot = countdownSpot(ctx.ar, scrim);   // scrim = AI 实拍变体：避开主播的脸
    const cx = X(spot.digit[0]), cy = Y(spot.digit[1]), k0 = spot.size / 0.45;
    if (cd.shock) { g.save(); g.globalAlpha = cd.shock.alpha; g.strokeStyle = GOLD; g.lineWidth = S(0.016); g.beginPath(); g.arc(cx, cy, S(cd.shock.r * 1.4 * k0), 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (cd.digit) {
      g.save(); g.globalAlpha = cd.digit.alpha; g.translate(cx, cy); g.scale(cd.digit.scale, cd.digit.scale);
      text(cd.digit.char, 0, 0, S(spot.size), { lang: 'en', weight: 900, fill: '#fff', outline: RED, glow: 'rgba(255,45,61,0.9)' });
      g.restore();
    }
    if (cd.linkBurst > 0) {
      g.save(); const k = cd.linkBurst, lx = X(spot.link[0]), ly = Y(spot.link[1]);
      g.globalAlpha = Math.min(1, k * 1.4); g.strokeStyle = GOLD; g.lineWidth = S(0.02); g.beginPath(); g.arc(lx, ly - Y(0.02), S((0.1 + 0.35 * k) * (scrim ? 0.6 : 1)), 0, Math.PI * 2); g.stroke();
      const sc = 0.7 + 0.3 * Math.sin(Math.PI * k) + 0.3 * k;
      g.translate(lx, ly); g.scale(sc, sc);
      text(txt.link, 0, 0, S(0.11), { lang: txt.lang, weight: 900, fill: GOLD, outline: RED, glow: 'rgba(255,45,61,0.9)' });
      g.restore();
    }
  }

  // 商品小图标（白瓷砖上一个干净可辨的矢量图标，按 item 画）：营地灯 / 耳机 / 咖啡立袋
  function productIcon(cx, cy, r, id) {
    g.save(); g.translate(cx, cy); g.lineWidth = Math.max(2, r * 0.12); g.lineJoin = 'round'; g.lineCap = 'round';
    const col = acc;
    if (id === 'lantern') {
      g.strokeStyle = col; g.fillStyle = '#fff3cf';
      g.beginPath(); g.moveTo(-r * 0.08, -r * 0.9); g.lineTo(r * 0.08, -r * 0.9); g.stroke();                 // 提手顶
      g.beginPath(); g.arc(0, -r * 0.9, r * 0.28, Math.PI, 0); g.stroke();                                     // 提手
      g.fillStyle = '#ffe79a'; g.strokeStyle = col; rr(-r * 0.5, -r * 0.45, r, r * 0.9, r * 0.18); g.fill(); g.stroke();  // 灯罩（发光）
      g.beginPath(); rr(-r * 0.6, r * 0.42, r * 1.2, r * 0.22, r * 0.06); g.fillStyle = col; g.fill();          // 底座
    } else if (id === 'headset') {
      g.strokeStyle = col; g.fillStyle = col;
      g.beginPath(); g.arc(0, r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.95); g.stroke();                 // 头梁
      rr(-r * 0.78, -r * 0.05, r * 0.34, r * 0.7, r * 0.12); g.fill();                                          // 左耳罩
      rr(r * 0.44, -r * 0.05, r * 0.34, r * 0.7, r * 0.12); g.fill();                                           // 右耳罩
    } else {   // beans：咖啡立袋
      g.fillStyle = col; g.strokeStyle = col;
      rr(-r * 0.45, -r * 0.5, r * 0.9, r * 1.1, r * 0.1); g.fill();                                             // 袋身
      g.fillStyle = '#fff'; rr(-r * 0.45, -r * 0.62, r * 0.9, r * 0.16, r * 0.04); g.fill();                    // 封口
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill();                      // 标签点
    }
    g.restore();
  }

  // ── 购物车弹窗（底部弹上）：不透明近白卡 + 阴影；左侧白瓷砖 + 商品图标；右侧名称/秒杀价/划掉原价/立即抢 ──
  function drawCart(c, txt) {
    if (c.rise <= 0.001) return;
    const bw = X(0.82), bx = (w - bw) / 2, bh = Y(0.3), byFull = Y(0.62), by = byFull + (1 - Math.min(1, c.rise)) * bh;
    g.save(); g.globalAlpha = Math.min(1, c.rise);
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = S(0.028); g.shadowOffsetY = S(0.008);
    g.fillStyle = '#fdfaf4'; rr(bx, by, bw, bh, S(0.03)); g.fill();                 // 不透明近白卡
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    // 左侧白瓷砖 + 商品图标
    const ps = bh * 0.74, pxx = bx + bh * 0.14, pyy = by + (bh - ps) / 2;
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = Math.max(1, S(0.002));
    rr(pxx, pyy, ps, ps, S(0.015)); g.fill(); g.stroke();
    productIcon(pxx + ps / 2, pyy + ps / 2, ps * 0.34, txt.item);
    // 文字区（紧挨瓷砖右侧）
    const tx = pxx + ps + S(0.03);
    text(txt.name, tx, by + bh * 0.25, S(0.044), { lang: txt.lang, weight: 900, fill: '#2b2016', align: 'left' });
    text(`${txt.deal} ${txt.priceStr}`, tx, by + bh * 0.54, S(0.078), { lang: txt.lang, weight: 900, fill: RED, align: 'left' });
    // 划掉的原价：深灰、粗一点，清楚可见
    g.save(); g.font = `700 ${S(0.036)}px ${font900(txt.lang)}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    const wasStr = `${txt.was} ${txt.wasStr}`, wy = by + bh * 0.82; g.fillStyle = '#6b6258'; g.fillText(wasStr, tx, wy);
    const wW = g.measureText(wasStr).width; g.strokeStyle = '#6b6258'; g.lineWidth = Math.max(2.5, S(0.005)); g.beginPath(); g.moveTo(tx - S(0.004), wy); g.lineTo(tx + wW + S(0.004), wy); g.stroke(); g.restore();
    // 立即抢按钮（右侧）
    const btnw = X(0.16), btnh = bh * 0.44, btx = bx + bw - btnw - S(0.03), bty = by + (bh - btnh) / 2;
    g.fillStyle = ORANGE; rr(btx, bty, btnw, btnh, btnh * 0.4); g.fill();
    text(txt.cta, btx + btnw / 2, bty + btnh / 2, btnh * 0.42, { lang: txt.lang, weight: 900, fill: '#fff' });
    g.restore();
    // 点击水波 + 角标
    if (c.ripple) { g.save(); g.globalAlpha = c.ripple.alpha; g.strokeStyle = '#fff'; g.lineWidth = S(0.008); g.beginPath(); g.arc(btx + btnw / 2, bty + btnh / 2, S(c.ripple.r), 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (c.badge) { g.save(); g.translate(X(0.9), Y(0.12)); g.scale(c.badge.scale, c.badge.scale); g.fillStyle = RED; g.beginPath(); g.arc(0, 0, S(0.035), 0, Math.PI * 2); g.fill(); if (c.badge.plus) text('+1', 0, 0, S(0.035), { lang: 'en', weight: 900, fill: '#fff' }); g.restore(); }
  }

  // ── 红包雨：手掌大小的红包（~6% 高）翻转下落；拆开的那个落在弹窗上（~15% 高）+ 金币；已领券 ──
  function envelope(x, y, spin, alpha, s) {
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(Math.sin(spin) * 0.35);
    const ew = S(0.045) * s, eh = S(0.06) * s; g.scale(0.7 + 0.3 * Math.cos(spin), 1);
    g.fillStyle = RED; rr(-ew / 2, -eh / 2, ew, eh, S(0.006)); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, -eh * 0.05, ew * 0.22, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawRain(e, txt) {
    for (const en of e.envelopes) if (en.alpha > 0.02) envelope(X(en.x), Y(en.y), en.spin, en.alpha * 0.95, 1);
    if (e.big) {
      // 大红包落在弹窗上，手掌大小（约 15% 高），拆开时上盖裂开 + 已领券
      envelope(X(e.big.x), Y(e.big.y), 0, 1, 2.4);
      if (e.big.open > 0) { g.save(); g.globalAlpha = e.big.open * 0.9; g.strokeStyle = GOLD; g.lineWidth = S(0.01); g.beginPath(); g.arc(X(e.big.x), Y(e.big.y), S(0.09 * e.big.open), 0, Math.PI * 2); g.stroke(); g.restore(); }
    }
    for (const c of e.coins) if (c.alpha > 0.02) { g.save(); g.globalAlpha = c.alpha; g.fillStyle = GOLD; g.beginPath(); g.arc(X(c.x), Y(c.y), S(0.016), 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d99a2a'; g.lineWidth = Math.max(1, S(0.002)); g.stroke(); g.restore(); }
  }

  // ── 库存条：厚红/橙渐变条 + 仅剩 N 件；已抢光大印章（旋转、粗边） ──
  function drawStock(sb, txt) {
    const bw = X(0.5), bx = (w - bw) / 2, by = Y(0.72), bh = S(0.035);
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.3)'; rr(bx, by, bw, bh, bh / 2); g.fill();
    const fw = bw * (sb.width / 0.37); const grad = g.createLinearGradient(bx, 0, bx + bw, 0); grad.addColorStop(0, RED); grad.addColorStop(1, ORANGE);
    g.fillStyle = grad; rr(bx, by, Math.max(0, fw), bh, bh / 2); g.fill();
    g.restore();
    text(txt.onlyFn ? txt.onlyFn(sb.left) : txt.only, X(0.5), by - S(0.045), S(0.038), { lang: txt.lang, weight: 900, fill: '#ffffff', outline: 'rgba(0,0,0,0.6)' });
    if (sb.soldout) {
      g.save(); g.globalAlpha = sb.soldout.alpha; g.translate(X(0.5), Y(0.46) + sb.soldout.shake * h); g.rotate(-0.14); g.scale(sb.soldout.scale, sb.soldout.scale);
      const sw = X(0.46), sh = S(0.18); g.fillStyle = 'rgba(255,45,61,0.92)'; rr(-sw / 2, -sh / 2, sw, sh, S(0.02)); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = S(0.012); rr(-sw / 2 + S(0.012), -sh / 2 + S(0.012), sw - S(0.024), sh - S(0.024), S(0.015)); g.stroke();
      text(txt.soldout, 0, 0, S(0.1), { lang: txt.lang, weight: 900, fill: '#fff' });
      g.restore();
    }
  }

  // ── 实拍底图用的淡渐变暗边：上 42%（弹幕带 + 外框）、下 34%（弹窗 / 字幕 / 库存条），跟外框一起在 end 镜头淡出 ──
  function drawScrim(k) {
    if (k <= 0) return;
    g.save(); g.globalAlpha = k;
    const top = g.createLinearGradient(0, 0, 0, Y(0.42)); top.addColorStop(0, 'rgba(8,10,16,0.42)'); top.addColorStop(1, 'rgba(8,10,16,0)');
    g.fillStyle = top; g.fillRect(0, 0, w, Y(0.42));
    const bot = g.createLinearGradient(0, Y(0.66), 0, h); bot.addColorStop(0, 'rgba(8,10,16,0)'); bot.addColorStop(1, 'rgba(8,10,16,0.34)');
    g.fillStyle = bot; g.fillRect(0, Y(0.66), w, h - Y(0.66));
    g.restore();
  }

  function draw(state, txt) {
    g.clearRect(0, 0, w, h);
    if (scrim) drawScrim(state.chrome.dim);
    drawChrome(state.chrome, txt);
    drawDanmaku(state.danmaku, txt.lang);
    if (state.countdown) drawCountdown(state.countdown, txt);
    if (state.cart) drawCart(state.cart, txt);
    if (state.rain || state.envelopes) drawRain(state.envelopes ?? state.rain, txt);
    if (state.stockbar) drawStock(state.stockbar, txt);
    tex.needsUpdate = true;
  }

  return { plane, place, draw, dispose() { plane.parent?.remove(plane); plane.geometry.dispose(); mat.dispose(); tex.dispose(); } };
}
