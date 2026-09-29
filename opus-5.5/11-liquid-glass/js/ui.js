// ui.js — 屏幕上的内容：日期、时钟、三块小组件里的字和图标，画在一张和画面一样大的 2D 画布上（已经按取景缩放），
// glass.js 把它叠在小组件的磨砂玻璃上面，后面的液态玻璃再折射它。小组件的玻璃本身不在这里画
// 画布是直的 alpha（不预乘），颜色是 sRGB；只用变体加载过的字体（captions.js 的 fontsFor）
import { FONTS, CLOCK, SONG, screenText } from '../copy.js';
import { clamp, lerp, easeInOut } from '../../factory/engine/ease.js';
import { fontStr } from '../../factory/engine/text.js';

const U = 1000;                                                   // 画布单位 = 屏幕坐标 × U：字号在几十个单位上下，不让浏览器去画 0.04px 的字
const scaleUI = ui => ({ date: { ...ui.date, x: ui.date.x * U, y: ui.date.y * U, size: ui.date.size * U }, clock: { ...ui.clock, x: ui.clock.x * U, y: ui.clock.y * U, size: ui.clock.size * U },
  widgets: Object.fromEntries(Object.entries(ui.widgets).map(([id, r]) => [id, r.map(x => x * U)])) });
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function createUI(ctx, theme) {
  const THREE = ctx.THREE, canvas = document.createElement('canvas'), g = canvas.getContext('2d', { willReadFrequently: true });   // 软件光栅化：GPU 加速的 2D 画布画阴影模糊时，同一帧前后可能差一个色阶
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;                       // 着色器自己解 sRGB
  texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  let em = null, K = 1;                                           // K：一个画布单位是几个像素

  /** 时钟字体的字宽（字号的倍数），第一次用时按真实字体量；此时字体已经加载完 */
  function clockEm() {
    if (em) return em;
    g.font = fontStr(FONTS.clock, 100); g.letterSpacing = '0px';
    const w = s => g.measureText(s).width / 100, m = g.measureText('0');
    em = { digit: Math.max(...'0123456789'.split('').map(w)), colon: w(':'), cap: m.actualBoundingBoxAscent / 100 };
    return em;
  }

  /** frame = motion.js 的屏幕状态，ui = UI[ar]，a = 宽高比 */
  function draw(frame, ui0, a, v) {
    const W = ctx.W, H = ctx.H, ui = scaleUI(ui0);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; texture.dispose(); }   // three 的纹理存储是定长的：尺寸变了要重建
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const { f, z } = frame.view, k = H * z;                       // 屏幕坐标 → 像素：(p − f)·H·z + 画面中心
    K = k / U;
    g.setTransform(K, 0, 0, K, W / 2 - f[0] * k, H / 2 - f[1] * k);
    const L = v.lang, F = FONTS[L], S = screenText(v), ink = theme.ink;
    const text = (s, x, y, ff, size, { align = 'left', color = ink, alpha = 1, track = 0 } = {}) => {
      g.font = fontStr(ff, size); g.letterSpacing = `${track * size}px`; g.textAlign = align; g.textBaseline = 'alphabetic';
      g.fillStyle = hexA(color, alpha); g.fillText(s, x, y);
    };
    g.shadowColor = hexA(theme.shadow, 0.28); g.shadowBlur = 12 * K; g.shadowOffsetY = 3 * K;   // 阴影的尺寸按像素算，不跟变换走

    // ── 日期与时钟 ──
    const C = frame.clock, E = clockEm();
    if (C.a > 0) {
      const lift = C.rise * 0.03 * U;
      g.save();
      if (C.blur > 0) g.filter = `blur(${(C.blur * 20 * K).toFixed(2)}px)`;
      g.globalAlpha = C.a;
      text(S.date, ui.date.x, ui.date.y + lift, F.body, ui.date.size, { align: ui.date.align, alpha: 0.92, track: 0.02 });
      drawClock(ui.clock, E, C, lift);
      g.restore();
    }

    // ── 小组件的内容 ──
    for (const [id, r] of Object.entries(ui.widgets)) {
      const st = frame.widgets[id];
      if (!st || st.a <= 0) continue;
      const [x, y, w, h] = r, s = Math.max(0.001, lerp(0.85, 1, clamp(st.g)));
      g.save(); g.globalAlpha = st.a;
      g.translate(x + w / 2, y + h / 2); g.scale(s, s); g.translate(-w / 2, -h / 2);
      WIDGETS[id](w, h);
      g.restore();
    }
    texture.needsUpdate = true;

    function drawClock(c, E, C, lift) {
      const size = c.size, digits = `${CLOCK.hour}:${CLOCK.from}`, w = size * (4 * E.digit + E.colon);
      let x = c.align === 'center' ? c.x - w / 2 : c.x;
      const y = c.y + lift, ff = FONTS.clock;
      const glyph = (ch, cx, cy, alpha = 1) => text(ch, cx, cy, ff, size, { align: 'center', alpha });
      // 等宽排：每个数字占 digit 宽，居中在自己的格子里（不跟着字形跳动）
      for (let i = 0; i < 4; i++) {
        const cellW = i === 2 ? E.colon : E.digit, cx = x + (size * cellW) / 2, ch = digits[i];
        glyph(ch, cx, y);
        x += size * cellW;
      }
      // 最后一位：翻页。旧数字向上滑走、新数字从下面顶上来，裁在数字格里
      const cx = x + (size * E.digit) / 2, p = easeInOut(C.flip), dy = size * E.cap * 1.25;
      g.save();
      g.beginPath(); g.rect(x - size * 0.02, y - size * E.cap - size * 0.12, size * E.digit + size * 0.04, size * E.cap + size * 0.24); g.clip();
      if (p < 1) glyph(CLOCK.from[1], cx, y - dy * p, 1 - p);
      if (p > 0) glyph(CLOCK.to[1], cx, y + dy * (1 - p), p);
      g.restore();
    }
  }

  // ── 三块小组件（局部坐标：左上角 0,0，宽 w 高 h）──
  const pad = h => h * 0.13;
  const WIDGETS = {
    weather(w, h) {
      const S = screenText(ctx.variant), F = FONTS[ctx.variant.lang], p = pad(h), u = h;
      const t = (s, x, y, ff, size, o) => { g.font = fontStr(ff, size); g.letterSpacing = '0px'; g.textAlign = o?.align ?? 'left'; g.fillStyle = hexA(theme.ink, o?.alpha ?? 1); g.fillText(s, x, y); };
      t(S.city, p, p + u * 0.1, F.display, u * 0.1);
      t(S.temp, p - u * 0.01, p + u * 0.43, FONTS.clock, u * 0.33);
      sun(w - p - u * 0.1, p + u * 0.08, u * 0.075);
      t(S.cond, p, h - p - u * 0.14, F.body, u * 0.085, { alpha: 0.95 });
      t(S.range, p, h - p, F.body, u * 0.075, { alpha: 0.85 });
    },
    calendar(w, h) {
      const S = screenText(ctx.variant), F = FONTS[ctx.variant.lang], p = pad(h), u = h;
      const t = (s, x, y, ff, size, o) => { g.font = fontStr(ff, size); g.letterSpacing = `${(o?.track ?? 0) * size}px`; g.textAlign = 'left'; g.fillStyle = hexA(o?.color ?? theme.ink, o?.alpha ?? 1); g.fillText(s, x, y); };
      t(S.week, p, p + u * 0.08, F.display, u * 0.08, { color: theme.accent, track: 0.06 });
      t(S.day, p - u * 0.01, p + u * 0.41, FONTS.clock, u * 0.34);
      g.save(); g.shadowColor = 'transparent';
      g.fillStyle = hexA(theme.accent, 0.95); roundRect(p, h - p - u * 0.2, u * 0.022, u * 0.2, u * 0.011); g.fill(); g.restore();
      t(S.event, p + u * 0.06, h - p - u * 0.105, F.display, u * 0.08);
      t(S.time, p + u * 0.06, h - p, FONTS.clock, u * 0.07, { alpha: 0.8 });
    },
    music(w, h) {
      const F = FONTS.en, p = pad(h), u = h, art = h - 2 * p;
      const t = (s, x, y, ff, size, o) => { g.font = fontStr(ff, size); g.letterSpacing = '0px'; g.textAlign = o?.align ?? 'left'; g.fillStyle = hexA(theme.ink, o?.alpha ?? 1); g.fillText(s, x, y); };
      cover(p, p, art);
      const x0 = p + art + u * 0.1, x1 = w - p;
      t(SONG.title, x0, p + u * 0.12, F.display, u * 0.11);
      t(SONG.artist, x0, p + u * 0.26, F.body, u * 0.085, { alpha: 0.8 });
      // 进度条
      const by = p + u * 0.43, fr = 0.37;
      g.save(); g.shadowColor = 'transparent';
      g.fillStyle = hexA(theme.ink, 0.3); roundRect(x0, by, x1 - x0, u * 0.022, u * 0.011); g.fill();
      g.fillStyle = hexA(theme.ink, 0.95); roundRect(x0, by, (x1 - x0) * fr, u * 0.022, u * 0.011); g.fill();
      g.restore();
      t(SONG.at, x0, by + u * 0.12, FONTS.clock, u * 0.065, { alpha: 0.75 });
      t(SONG.left, x1, by + u * 0.12, FONTS.clock, u * 0.065, { alpha: 0.75, align: 'right' });
      // 上一首 / 暂停 / 下一首
      const cy = h - p - u * 0.06, cx = (x0 + x1) / 2, s = u * 0.065, gap = u * 0.24;
      g.fillStyle = hexA(theme.ink, 1);
      skip(cx - gap, cy, s, -1); skip(cx + gap, cy, s, 1);
      roundRect(cx - s * 0.75, cy - s, s * 0.5, s * 2, s * 0.12); g.fill();
      roundRect(cx + s * 0.25, cy - s, s * 0.5, s * 2, s * 0.12); g.fill();
    },
  };

  function roundRect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function sun(cx, cy, r) {
    g.save(); g.shadowColor = 'rgba(255,170,40,0.55)'; g.shadowBlur = r * 1.6 * K;
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#fff6c4'); gr.addColorStop(1, '#ffc21f');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function skip(cx, cy, s, dir) {
    for (const o of [-0.55, 0.45]) {
      const x = cx + dir * o * s * 1.1;
      g.beginPath(); g.moveTo(x - dir * s * 0.55, cy - s * 0.8); g.lineTo(x + dir * s * 0.65, cy); g.lineTo(x - dir * s * 0.55, cy + s * 0.8); g.closePath(); g.fill();
    }
  }
  /** 专辑封面：两色渐变上叠两个柔和的圆，像一滴光落进水里 */
  function cover(x, y, s) {
    const [c0, c1] = theme.art;
    g.save(); g.shadowColor = hexA(theme.shadow, 0.3); g.shadowBlur = s * 0.12 * K;
    roundRect(x, y, s, s, s * 0.14); g.clip();
    const gr = g.createLinearGradient(x, y, x + s, y + s); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fillRect(x, y, s, s);
    g.shadowColor = 'transparent';
    for (const [fx, fy, fr, al] of [[0.35, 0.62, 0.34, 0.45], [0.7, 0.3, 0.22, 0.35]]) {
      const rg = g.createRadialGradient(x + fx * s, y + fy * s, 0, x + fx * s, y + fy * s, fr * s);
      rg.addColorStop(0, `rgba(255,255,255,${al})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(x, y, s, s);
    }
    g.restore();
  }

  return { texture, draw, clockEm, dispose() { texture.dispose(); } };
}
