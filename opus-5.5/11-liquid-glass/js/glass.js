// glass.js — 整个画面在这里画，不用 3D 场景：几遍全屏着色器叠起来
//   1. 壁纸：对角渐变 + 五团漂移的柔光色斑（弥散渐变）
//   2. 小组件：磨砂玻璃圆角卡（折射 + 模糊 + 白色薄雾 + 棱边高光 + 投影），再叠 ui.js 画好的字和图标
//   3. 液态玻璃（motion.js 的 lens → sheet → card 三层，依次叠）：每层读上一遍的结果，按形状的距离场算出玻璃的厚度，
//      边缘一圈像凸透镜一样折射（三个颜色通道错开一点：色散），中间可以放大，再加磨砂、薄雾、高光和投影
// 颜色：画布和主题色都是设计稿的 sRGB，着色器里转成线性、再过一遍 PBR Neutral 色调映射的反函数，
// 所以经过引擎后期（tone: 'neutral'）正好显示成设计的颜色；玻璃高光在此之上，由色调映射自然收住
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { MAX_SHAPES } from './motion.js';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const COMMON = /* glsl */`
uniform vec3 view; uniform float aspect;                 // 取景：注视点 view.xy（屏幕坐标），缩放 view.z
varying vec2 vUv;
vec2 toScreen(vec2 uv) { return view.xy + vec2((uv.x - 0.5) * aspect, 0.5 - uv.y) / view.z; }
vec2 toUv(vec2 p) { return vec2(0.5 + (p.x - view.x) * view.z / aspect, 0.5 - (p.y - view.y) * view.z); }
vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
// grade.js 的 neutral 的反函数（不算高光处的去饱和）：线性色 o → 过色调映射后显示成 o 的场景色
vec3 unneutral(vec3 o) {
  float peak = max(o.r, max(o.g, o.b)), s = 0.76, d = 1.0 - s;
  vec3 c = o;
  if (peak > s) { float q = min(peak, 0.985); c *= (d * d / (1.0 - q) - d + s) / peak; }
  float m = min(c.r, min(c.g, c.b)), off = m >= 0.04 ? 0.04 : sqrt(max(m, 0.0) / 6.25) - m;
  return c + off;
}`;

const WALL = /* glsl */`
${COMMON}
uniform vec3 ends[2], blobC[5]; uniform vec4 blobs[5];    // 颜色是 sRGB；色斑 (x, y, 半径, 强度)，屏幕坐标
void main() {
  vec2 p = toScreen(vUv);
  float g = clamp((p.x / aspect + p.y) * 0.5, 0.0, 1.0);
  vec3 c = mix(ends[0], ends[1], smoothstep(0.0, 1.0, g));
  for (int i = 0; i < 5; i++) {
    vec2 d = (p - blobs[i].xy) / blobs[i].z;
    c = mix(c, blobC[i], blobs[i].w * exp(-dot(d, d) * 2.0));
  }
  gl_FragColor = vec4(unneutral(lin(clamp(c, 0.0, 1.0))), 1.0);
}`;

const LAYER = /* glsl */`
${COMMON}
#define MAXS ${MAX_SHAPES}
uniform sampler2D tSrc, tBlur, tOver;
uniform vec2 res;
uniform vec4 sA[MAXS], sB[MAXS], sM[MAXS]; uniform int sN; uniform float sK;
uniform float bevel, refr, disp, frost, tintA, rimA, shadowA, over, lift, spec;
uniform vec3 tint;
float sdShape(int i, vec2 p) {                              // motion.js 的 sdShape 逐行对应
  vec4 a = sA[i], b = sB[i], m = sM[i];
  if (b.w > 0.5) { float s = a.w * p.x + b.x, sl = a.z * a.w * cos(s); return (p.y - a.y - a.z * sin(s)) / sqrt(1.0 + sl * sl); }
  vec2 d = p - a.xy, q = vec2(m.x * d.x + m.z * d.y, m.y * d.x + m.w * d.y), e = abs(q) - a.zw + b.x;
  return (length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - b.x) * b.y;
}
float smin(float a, float b, float k) { if (k <= 0.0) return min(a, b); float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float sdScene(vec2 p) { float d = 1e9; for (int i = 0; i < MAXS; i++) { if (i >= sN) break; d = smin(d, sdShape(i, p), sK); } return d; }
/** 放大的中心和倍数：取最近的形状的 */
vec3 magAt(vec2 p) {
  float best = 1e9; vec3 r = vec3(p, 1.0);
  for (int i = 0; i < MAXS; i++) { if (i >= sN) break; float d = sdShape(i, p); if (d < best) { best = d; r = vec3(sA[i].xy, sB[i].z); } }
  return r;
}
vec3 samp(sampler2D t, vec2 p) { return textureLod(t, toUv(p), 0.0).rgb; }   // 模糊图没有 mip；不用自动 LOD（折射处导数很大，会读到别的 mip 级）
vec3 sharp(vec2 p) { return textureLod(tSrc, toUv(p), 0.0).rgb; }
void main() {
  vec2 p = toScreen(vUv);
  float px = 1.0 / (res.y * view.z);                       // 一个像素在屏幕坐标里多大
  vec3 col = textureLod(tSrc, vUv, 0.0).rgb;
  if (sN > 0) {
    float d = sdScene(p);
    // 投影：形状往下挪一点，在玻璃外面压暗
    if (shadowA > 0.0) { float ds = sdScene(p - vec2(0.0, 0.016)); col *= 1.0 - shadowA * (1.0 - smoothstep(-0.02, 0.07, ds)) * smoothstep(0.0, 2.0 * px, d); }
    float cover = clamp(0.5 - d / px, 0.0, 1.0);
    if (cover > 0.0) {
      vec2 e = vec2(px, 0.0);
      vec2 gr = vec2(sdScene(p + e.xy) - sdScene(p - e.xy), sdScene(p + e.yx) - sdScene(p - e.yx));
      gr /= max(length(gr), 1e-6);                          // 朝外的法线（屏幕平面内）
      float depth = max(-d, 0.0), x = clamp(depth / bevel, 0.0, 1.0);
      float h = sqrt(1.0 - (1.0 - x) * (1.0 - x));           // 圆弧形的棱：边上陡、往里变平
      float bend = 1.0 - h;                                  // 边上折射最强，棱以内是平的
      vec3 M = magAt(p);
      vec2 q = M.xy + (p - M.xy) / M.z;                     // 放大
      vec2 o = -gr * refr * bevel * bend;                    // 凸透镜：边上看到的是往里一点的东西
      vec3 cs = vec3(sharp(q + o * (1.0 - disp)).r, sharp(q + o).g, sharp(q + o * (1.0 + disp)).b);
      vec3 cb = vec3(samp(tBlur, q + o * (1.0 - disp)).r, samp(tBlur, q + o).g, samp(tBlur, q + o * (1.0 + disp)).b);
      vec3 g = mix(cs, cb, frost);
      g = mix(g, tint, tintA) * (1.0 + lift);
      // 高光：光从左上来，亮边在左上，对侧弱一些的反光；最外一圈细亮线；边缘的菲涅尔
      vec2 L = normalize(vec2(-0.55, -0.83));
      float lit = max(dot(gr, L), 0.0), back = max(-dot(gr, L), 0.0);
      // 水珠的高光：穹顶的法线对着左上的光，点状的一小块；背光一侧聚光，亮一道
      vec3 n = normalize(vec3(gr * (1.0 - x) / max(h, 0.08), 1.0));
      g += spec * (pow(max(dot(n, normalize(vec3(-0.45, -0.65, 0.62))), 0.0), 90.0) * 1.6 + 0.35 * smoothstep(0.35, 0.0, x) * back * back);
      float band = pow(bend, 1.5), line = exp(-depth / (1.2 * px)) + 0.4 * exp(-depth / (4.0 * px));
      g += tint * rimA * (band * (1.1 * pow(lit, 3.0) + 0.55 * pow(back, 3.0)) + line * (0.35 + 0.9 * pow(lit, 2.0) + 0.5 * pow(back, 2.0)));
      g *= 1.0 - 0.1 * rimA * band * (1.0 - lit) * (1.0 - back);   // 侧面（不朝光也不背光）稍暗：棱有厚度
      g = mix(g, tint, 0.12 * rimA * band);
      col = mix(col, g, cover);
    }
  }
  if (over > 0.0) { vec4 u = texture2D(tOver, vUv); col = mix(col, unneutral(lin(u.rgb)), u.a); }
  gl_FragColor = vec4(col, 1.0);
}`;

// 模糊：先取源的第 2 级 mip（1/4 分辨率，已按盒子滤过），再横竖两遍高斯。sigma 按画面高度算，预览和成片一样糊
const DOWN = /* glsl */`uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = vec4(textureLod(tSrc, vUv, 2.0).rgb, 1.0); }`;
const GAUSS = /* glsl */`
uniform sampler2D tSrc; uniform vec2 dir; uniform float sigma; varying vec2 vUv;
void main() {
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = -12; i <= 12; i++) { float x = float(i) * sigma * 0.25, w = exp(-float(i * i) / 32.0); acc += texture2D(tSrc, vUv + dir * x).rgb * w; ws += w; }
  gl_FragColor = vec4(acc / ws, 1.0);
}`;

/** 每层玻璃的质感：bevel 棱宽（屏幕坐标）、refr 边缘折射（棱宽的倍数）、disp 色散、frost 磨砂、tint 薄雾的颜色和浓度、rimA 高光、shadowA 投影、lift 提亮 */
export const STYLE = {
  widgets: { bevel: 0.022, refr: 0.4, disp: 0.05, frost: 1, tintA: 0.14, rimA: 0.45, shadowA: 0.1, lift: 0.04, spec: 0 },
  // 清透的液态玻璃：棱宽接近形状的半径，整个面是一个穹顶，处处都在折射；不加雾
  lens: { bevel: 0.06, refr: 1.6, disp: 0.03, frost: 0, tintA: 0, rimA: 0.9, shadowA: 0.14, lift: 0.02, spec: 1 },
  sheet: { bevel: 0.1, refr: 1.2, disp: 0.035, frost: 0.5, tintA: 0.08, rimA: 0.8, shadowA: 0.1, lift: 0.04, spec: 0.6 },
  card: { bevel: 0.05, refr: 0.9, disp: 0.03, frost: 0.45, tintA: 0.12, rimA: 0.9, shadowA: 0.14, lift: 0.03, spec: 0.6 },
};
export const BLUR_SIGMA = 0.02;                           // 磨砂的模糊半径（画面高度的比例）
export const ORDER = ['lens', 'sheet', 'card'];

export function createGlass(ctx, theme, uiTexture) {
  const THREE = ctx.THREE, R = ctx.renderer;
  const mk = (frag, uniforms) => new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }));
  const V3 = () => new THREE.Vector3(), V4 = () => new THREE.Vector4();
  const srgb = hex => new THREE.Color().setRGB(...[16, 8, 0].map(s => ((parseInt(hex.slice(1), 16) >> s) & 255) / 255), THREE.NoColorSpace);
  const rtOpt = { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const full = [new THREE.WebGLRenderTarget(1, 1, rtOpt), new THREE.WebGLRenderTarget(1, 1, rtOpt)];
  const qOpt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const quarter = [new THREE.WebGLRenderTarget(1, 1, qOpt), new THREE.WebGLRenderTarget(1, 1, qOpt)];

  const W = theme.wall;
  const wall = mk(WALL, {
    view: { value: V3() }, aspect: { value: 1 },
    ends: { value: W.ends.map(srgb) }, blobC: { value: W.blobs.map(b => srgb(b.c)) }, blobs: { value: W.blobs.map(V4) },
  });
  const tintLin = new THREE.Color(1, 1, 1);                     // 薄雾是白的（线性 1 显示成接近白，高光再往上走）
  const layer = mk(LAYER, {
    view: { value: V3() }, aspect: { value: 1 }, res: { value: new THREE.Vector2() },
    tSrc: { value: null }, tBlur: { value: null }, tOver: { value: uiTexture }, over: { value: 0 },
    sA: { value: Array.from({ length: MAX_SHAPES }, V4) }, sB: { value: Array.from({ length: MAX_SHAPES }, V4) }, sM: { value: Array.from({ length: MAX_SHAPES }, V4) },
    sN: { value: 0 }, sK: { value: 0 }, tint: { value: tintLin },
    ...Object.fromEntries(Object.keys(STYLE.lens).map(k => [k, { value: 0 }])),
  });
  const down = mk(DOWN, { tSrc: { value: null } });
  const gauss = mk(GAUSS, { tSrc: { value: null }, dir: { value: new THREE.Vector2() }, sigma: { value: 1 } });

  function size() {
    const w = ctx.W, h = ctx.H;
    if (full[0].width === w && full[0].height === h) return;
    for (const rt of full) rt.setSize(w, h);
    for (const rt of quarter) rt.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
  }
  const pass = (q, target) => { R.setRenderTarget(target); q.render(R); };
  function blur(src) {
    down.material.uniforms.tSrc.value = src.texture; pass(down, quarter[0]);
    const U = gauss.material.uniforms, qh = quarter[0].height, s = BLUR_SIGMA * qh;
    U.sigma.value = s;
    U.tSrc.value = quarter[0].texture; U.dir.value.set(1 / quarter[0].width, 0); pass(gauss, quarter[1]);
    U.tSrc.value = quarter[1].texture; U.dir.value.set(0, 1 / qh); pass(gauss, quarter[0]);
    return quarter[0].texture;
  }

  /** frame = motion.js 的屏幕状态（带 widgetShapes 算好的 layers.widgets）；最后一遍直接画进 target */
  function render(target, frame) {
    size();
    const a = ctx.W / ctx.H, { f, z } = frame.view;
    // 壁纸：视差，推近时只跟着走四成
    const zw = 1 + (z - 1) * 0.4, fw = [a / 2 + (f[0] - a / 2) * 0.4, 0.5 + (f[1] - 0.5) * 0.4];
    const w = wall.material.uniforms;
    w.view.value.set(fw[0], fw[1], zw); w.aspect.value = a;
    W.blobs.forEach((b, i) => {
      const ph = i * 1.7, t = frame.t;
      w.blobs.value[i].set((b.at[0] + b.drift * Math.sin(0.42 * t + ph)) * a, b.at[1] + b.drift * Math.cos(0.33 * t + ph * 1.3), b.r, 0.85);
    });
    const layers = [['widgets', frame.layers.widgets ?? []], ...ORDER.map(k => [k, frame.layers[k] ?? []]).filter(([, s]) => s.length)];
    let src = full[0], other = full[1];
    pass(wall, src);
    const L = layer.material.uniforms;
    L.view.value.set(f[0], f[1], z); L.aspect.value = a; L.res.value.set(ctx.W, ctx.H);
    layers.forEach(([name, shapes], i) => {
      const st = STYLE[name], last = i === layers.length - 1;
      for (const k of Object.keys(st)) L[k].value = st[k];
      L.sN.value = Math.min(shapes.length, MAX_SHAPES); L.sK.value = frame.k?.[name] ?? 0;
      shapes.slice(0, MAX_SHAPES).forEach((s, j) => {
        L.sA.value[j].set(s.c[0], s.c[1], s.h[0], s.h[1]); L.sB.value[j].set(s.r, s.ds, s.mag, s.kind); L.sM.value[j].set(...s.m);
      });
      L.tSrc.value = src.texture;
      L.tBlur.value = st.frost > 0 && shapes.length ? blur(src) : src.texture;
      L.over.value = name === 'widgets' ? 1 : 0;
      pass(layer, last ? target : other);
      [src, other] = [other, src];
    });
  }

  return { render, dispose() { for (const rt of [...full, ...quarter]) rt.dispose(); for (const q of [wall, layer, down, gauss]) { q.material.dispose(); q.dispose(); } } };
}
