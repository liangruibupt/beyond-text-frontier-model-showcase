// video.js — 可选的「视频背景」图层：把一段预先拆好的帧序列按『故事时间』采样，画进后期的 sceneRT。
// 用途：AI 变体把 LTX 生成的实拍画面当作底图，字幕 / 价签 / 片尾卡 / 配音 / 配乐仍由现有引擎合成。
//
// 为什么用「拆成帧」而不是 <video>：导出时引擎的 draw(t) 是同步的（t = i/fps 决定每一帧），而 <video>
// 的 currentTime 定位是异步的（seeked 事件），放进同步循环里会产生竞态、帧不确定。把片段预先用 ffmpeg
// 拆成 PNG（beans-gen.py 做的），按故事时间取最近的一帧，就是 (变体, t) 的纯函数——跳着看和顺序播放同一帧。
//
// 显存：只保留一张可复用纹理，每帧把当前这一张帧图画进一个离屏 canvas 再上传；帧图本身以压缩 PNG（Image）
// 常驻内存，解码后不长期占显存。所以 N 段 × 几十帧也只是几十 MB 内存 + 一张纹理。
//
// 这个模块只在浏览器里跑（要 document / Image / WebGL）；Node 侧的测试走纯函数 pickFrame / clipPlan。
import * as THREE from 'three';

/** 片段清单：拆帧时写在 frames/<key>/manifest.json，给出帧数与帧率，用来反查某个故事时间对应第几帧。
 *  fetchImpl 可注入，便于 Node 单测；默认用全局 fetch（浏览器 / 出片的无头 Chromium 里都有）。 */
export async function loadManifest(baseUrl, key, { fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  if (!fetchImpl) throw new Error('video: no fetch available to load manifest');
  const res = await fetchImpl(`${baseUrl}/${key}/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`video: no manifest for ${key} (${res.status}) at ${baseUrl}/${key}/manifest.json`);
  const m = await res.json();
  if (!(m.frames > 0) || !(m.fps > 0)) throw new Error(`video: bad manifest for ${key}: ${JSON.stringify(m)}`);
  return m;
}

/** 故事本地秒 lt（相对该镜头的片段起点）→ 第几帧（0..frames-1）。四舍五入到最近帧并钳进范围，确定、单调 */
export function pickFrame(lt, { frames, fps }) {
  const i = Math.round(Math.max(0, lt) * fps);
  return Math.min(frames - 1, Math.max(0, i));
}

/** 片段文件名（帧目录名）：<shot>_<ar>，和 beans-gen.py 的输出一一对应 */
export const clipKey = (shot, ar) => `${shot}_${ar}`;

/**
 * 一个视频背景：持有若干片段（每个片段 = 一组帧图 + manifest），和一张铺满画面的四边形。
 * - baseUrl：帧目录的 URL 前缀（如 <film>/out/ai/beans/frames）
 * - clips：[{ shot, lt(storyLocalSeconds→可从外部给), key }]；真正取第几帧在 render 时按传入的 lt 算
 * 用法：world.setup 里 await bg.load(...)；film.render 里 bg.draw(renderer, target, { key, lt })。
 */
export function createVideoBackground({ baseUrl, keys }) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  // 离屏 canvas：把当前帧图画进去再做成纹理；一张纹理反复复用，避免每帧新建
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g2d = canvas?.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas ?? new OffscreenCanvasLike());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: true, depthTest: false, toneMapped: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(quad);

  const clips = new Map();   // key -> { manifest, imgs: Image[], cur: number }
  let shownKey = null, shownIdx = -1;   // 共用纹理里当前是哪个片段的哪一帧

  async function loadImage(url) {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error(`video: failed to load frame ${url}`)); img.src = url; });
    if (img.decode) { try { await img.decode(); } catch { /* onload already fired; decode is best-effort */ } }
    return img;
  }

  return {
    /** 预加载 keys 里每个片段的 manifest 与全部帧图（在 world.setup 内 await，确保出片前就位） */
    async load() {
      for (const key of keys) {
        const manifest = await loadManifest(baseUrl, key);
        const imgs = [];
        for (let i = 1; i <= manifest.frames; i++) {
          imgs.push(await loadImage(`${baseUrl}/${key}/f${String(i).padStart(4, '0')}.png`));
        }
        clips.set(key, { manifest, imgs, cur: -1 });
      }
      return this;
    },
    has: key => clips.has(key),
    manifestOf: key => clips.get(key)?.manifest,
    /** 把 key 片段在故事本地秒 lt 的那一帧画进 target（null = 画布）。只换纹理的底图，不新建对象 */
    draw(renderer, target, { key, lt }) {
      const c = clips.get(key);
      if (!c) throw new Error(`video: clip ${key} not loaded (have: ${[...clips.keys()].join(', ') || 'none'})`);
      const idx = pickFrame(lt, c.manifest);
      // 纹理是所有片段共用的一张：「上次上传的是哪一帧」必须按 (片段, 帧) 记，不能按片段各记一份——
      // 否则叠化时两个镜头交替绘制，停在同一帧的那一方会被误判为「无需更新」而画出另一方的画面
      if (key !== shownKey || idx !== shownIdx) {
        const img = c.imgs[idx];
        if (canvas) {
          if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; }
          g2d.drawImage(img, 0, 0);
        }
        tex.needsUpdate = true; shownKey = key; shownIdx = idx; c.cur = idx;
      }
      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prevTarget);
      return idx;
    },
    dispose() {
      quad.geometry.dispose(); mat.dispose(); tex.dispose();
      for (const c of clips.values()) c.imgs.length = 0;
      clips.clear();
    },
  };
}

// 极简兜底：没有 document 时（不会走到 draw，只是让 CanvasTexture 构造不炸）
class OffscreenCanvasLike { constructor() { this.width = 1; this.height = 1; } getContext() { return null; } }
