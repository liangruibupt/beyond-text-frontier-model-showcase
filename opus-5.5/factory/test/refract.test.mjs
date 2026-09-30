import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRefraction, refractGLSL, enter, exit, boundsOf, prismShape, frustumShape, LAYER } from '../engine/refract.js';

const S2 = Math.SQRT1_2;
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) < eps, `${msg} ${a} vs ${b}`);
const nearV = (a, b, eps = 1e-9, msg = '') => a.forEach((x, i) => near(x, b[i], eps, `${msg}[${i}]`));

// 八角棱柱：半宽 a、半深 b、切角 k（同 03 bottle.js 的 planes()）
const oct = (a, b, k, y) => { const c = (a + b - k) * S2; return { planes: [[1, 0, a], [-1, 0, a], [0, 1, b], [0, -1, b], [S2, S2, c], [S2, -S2, c], [-S2, S2, c], [-S2, -S2, c]], y }; };
const PRISM = prismShape({ outer: oct(0.037, 0.023, 0.013, [0, 0.105]), cavity: oct(0.0325, 0.0185, 0.011, [0.018, 0.094]), liquid: oct(0.032, 0.018, 0.0108, [0.0183, 0.074]) });
// 奶茶杯：底半径 3 cm、口半径 4.5 cm、高 10 cm → 侧面斜率 k = 0.15
const CUP = frustumShape({ rBottom: 0.03, rTop: 0.045, height: 0.1, wall: 0.0006, base: 0.0012, fill: 0.08 });
const K = 0.15, rOut = y => 0.03 + K * y;

// 点在实体里（闭集，带容差）：蛮力对照用
const inside = (shape, solid, p, e = 0) => {
  const S = shape[solid];
  if (p[1] < S.y[0] - e || p[1] > S.y[1] + e) return false;
  if (shape.kind === 'prism') return S.planes.every(([nx, nz, d]) => nx * p[0] + nz * p[2] <= d + e);
  const r = S.r[0] + ((S.r[1] - S.r[0]) * (p[1] - S.y[0])) / (S.y[1] - S.y[0]);
  return Math.hypot(p[0], p[2]) <= r + e;
};
/** 沿光线细步进找进出点（t ∈ [-1, 1]，与解析求交的初值范围一样） */
function march(shape, solid, p, d, n = 200000) {
  let t0 = null, t1 = null;
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n, q = p.map((x, j) => x + d[j] * t);
    if (inside(shape, solid, q)) { if (t0 === null) t0 = t; t1 = t; }
  }
  return t0 === null ? null : [t0, t1];
}

test('prism: axis-aligned, oblique onto a chamfer, grazing, miss, and exits', () => {
  // 从左边水平射进外形：入口 x = -a，出口 x = +a，入口法线 -x
  let h = enter(PRISM, 'outer', [-0.1, 0.05, 0], [1, 0, 0]);
  near(h.t0, 0.1 - 0.037); near(h.t1, 0.1 + 0.037); nearV(h.n, [-1, 0, 0]);
  // 从正上方竖直射下：入口顶面（法线 +y），出口底面
  h = enter(PRISM, 'outer', [0.01, 0.3, 0.005], [0, -1, 0]);
  near(h.t0, 0.3 - 0.105); near(h.t1, 0.3); nearV(h.n, [0, 1, 0]);
  // 斜 45° 正对右前切角面的中点射进去（瓶子扁，从中心斜出去先碰的是前后大面，所以要对准切角面）：入口距离 0.2
  const c = (0.037 + 0.023 - 0.013) * S2, mid = [0.037 - 0.0065, 0.05, 0.023 - 0.0065], nC = [S2, 0, S2];
  near(mid[0] * S2 + mid[2] * S2, c, 1e-12);                                     // 中点确实在切角面上
  h = enter(PRISM, 'outer', mid.map((x, i) => x + 0.2 * nC[i]), nC.map(x => -x));
  near(h.t0, 0.2); nearV(h.n, nC);
  // 斜着从右前方射向中心：先碰到前面 z = b（不是切角面）
  h = enter(PRISM, 'outer', [0.2, 0.05, 0.2], norm([-1, 0, -1]));
  near(h.t0, (0.2 - 0.023) / S2); nearV(h.n, [0, 0, 1]);
  // 擦边：贴着右侧面外面走（平行、在外面）打不中；贴着里面走打中
  h = enter(PRISM, 'outer', [0.0371, 0.05, -0.2], [0, 0, 1]); assert.ok(h.t0 >= h.t1);
  h = enter(PRISM, 'outer', [0.0369, 0.05, -0.2], [0, 0, 1]); assert.ok(h.t0 < h.t1);
  // 打偏
  h = enter(PRISM, 'outer', [-0.1, 0.2, 0], [1, 0, 0]); assert.ok(h.t0 >= h.t1);
  h = enter(PRISM, 'outer', [-0.1, 0.05, 0.1], [1, 0, 0]); assert.ok(h.t0 >= h.t1);
  // 从内部出去：朝 +x 到右侧面、朝上到顶面
  let x = exit(PRISM, 'liquid', [0, 0.05, 0], [1, 0, 0]); near(x.t, 0.032); nearV(x.n, [1, 0, 0]);
  x = exit(PRISM, 'cavity', [0, 0.05, 0], [0, 1, 0]); near(x.t, 0.094 - 0.05); nearV(x.n, [0, 1, 0]);
  x = exit(PRISM, 'outer', mid.map((v, i) => v - 0.004 * nC[i]), nC); near(x.t, 0.004); nearV(x.n, nC);
  x = exit(PRISM, 'outer', [0, 0.05, 0], norm([1, 0, 1])); near(x.t, 0.023 / S2); nearV(x.n, [0, 0, 1]);
});

test('frustum: axis-aligned, down the axis, steep through the rim, oblique, grazing, miss, and exits', () => {
  // 水平射进 y = 0.05：半径 0.0375，入口法线朝外且朝下（杯口比杯底大）
  let h = enter(CUP, 'outer', [-0.1, 0.05, 0], [1, 0, 0]);
  near(h.t0, 0.1 - rOut(0.05)); near(h.t1, 0.1 + rOut(0.05)); nearV(h.n, norm([-1, -K, 0]));
  // 沿轴竖直射下：顶面进、底面出
  h = enter(CUP, 'outer', [0, 0.2, 0], [0, -1, 0]);
  near(h.t0, 0.1); near(h.t1, 0.2); nearV(h.n, [0, 1, 0]);
  // x = 0.04 竖直射下（比母线陡）：从杯口进，从侧面 r(y) = 0.04 处出
  h = enter(CUP, 'outer', [0.04, 0.2, 0], [0, -1, 0]);
  near(h.t0, 0.1); near(h.t1, 0.2 - (0.04 - 0.03) / K);
  // x = 0.05 竖直射下：在杯口外面
  h = enter(CUP, 'outer', [0.05, 0.2, 0], [0, -1, 0]); assert.ok(h.t0 >= h.t1);
  // 擦边：水平切过 y = 0.05 的圆，只碰到一点
  h = enter(CUP, 'outer', [-0.1, 0.05, rOut(0.05)], [1, 0, 0]); assert.ok(h.t1 - h.t0 < 1e-6);
  h = enter(CUP, 'outer', [-0.1, 0.05, rOut(0.05) + 1e-4], [1, 0, 0]); assert.ok(h.t0 >= h.t1);
  // 打偏：从上面斜着飞过杯口
  h = enter(CUP, 'outer', [-0.2, 0.2, 0], norm([1, 0.2, 0])); assert.ok(h.t0 >= h.t1);
  // 斜射：与解析的二次方程根比对
  const p = [-0.1, 0.12, 0.01], d = norm([1, -0.6, 0.1]);
  h = enter(CUP, 'outer', p, d);
  const A = d[0] ** 2 + d[2] ** 2 - K * K * d[1] ** 2, r = rOut(p[1]), B = 2 * (p[0] * d[0] + p[2] * d[2] - K * d[1] * r), C = p[0] ** 2 + p[2] ** 2 - r * r;
  const s0 = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A), y0 = p[1] + d[1] * s0;
  assert.ok(y0 > 0 && y0 < 0.1); near(h.t0, s0);
  const q = p.map((x, i) => x + d[i] * s0);
  nearV(h.n, norm([q[0], -K * rOut(q[1]), q[2]]));
  // 从内部出去：水平到侧面、竖直到底面、朝下斜到侧面
  let x = exit(CUP, 'outer', [0, 0.05, 0], [1, 0, 0]); near(x.t, rOut(0.05)); nearV(x.n, norm([1, -K, 0]));
  x = exit(CUP, 'outer', [0, 0.05, 0], [0, -1, 0]); near(x.t, 0.05); nearV(x.n, [0, -1, 0]);
  x = exit(CUP, 'outer', [0.02, 0.05, 0], [0, -1, 0]); near(x.t, 0.05);        // 杯底半径 0.03 > 0.02：落在底面
  x = exit(CUP, 'outer', [0.035, 0.05, 0], [0, -1, 0]); near(x.t, 0.05 - (0.035 - 0.03) / K); nearV(x.n, norm([1, -K, 0]));
});

test('both shapes: analytic entry / exit agree with a brute-force march on random rays (incl. rays steeper than the cone)', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const [shape, solid] of [[PRISM, 'outer'], [PRISM, 'cavity'], [CUP, 'outer'], [CUP, 'cavity'], [CUP, 'liquid']]) {
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      // 对准形状附近的一点，从 0.15 米外射过来（方向含竖直分量大的，比截锥母线陡）
      const aim = [rnd() * 0.05, 0.05 + rnd() * 0.06, rnd() * 0.05], d = norm([rnd(), rnd() * 2, rnd()]), p = aim.map((x, j) => x - d[j] * 0.15);
      const h = enter(shape, solid, p, d), m = march(shape, solid, p, d);
      if (!m || m[1] - m[0] < 1e-4) { assert.ok(h.t0 >= h.t1 - 2e-5 || h.t0 < -0.99, `${shape.kind} ${solid} ray ${i}: marched a miss, got [${h.t0}, ${h.t1}]`); continue; }
      if (m[0] <= -1 + 1e-5) continue;                                          // 起点在里面（初值 -1 截断），不是 enter 的用法
      hits++;
      near(h.t0, m[0], 2e-5, `${shape.kind} ${solid} ray ${i} t0`); near(h.t1, m[1], 2e-5, `${shape.kind} ${solid} ray ${i} t1`);
      // 从入口稍往里一点出发，exit 走到同一个出口
      const e = h.t0 + 1e-6, q = p.map((x, j) => x + d[j] * e);
      near(e + exit(shape, solid, q, d).t, m[1], 2e-5, `${shape.kind} ${solid} ray ${i} exit`);
    }
    assert.ok(hits >= 5, `${shape.kind} ${solid}: only ${hits} hits`);
  }
});

test('frustumShape: the wall is `wall` thick measured normal to the slanted side; cavity is open to the rim; bounds', () => {
  const k = K, s = Math.sqrt(1 + k * k);
  nearV(CUP.outer.r, [0.03, 0.045]); nearV(CUP.outer.y, [0, 0.1]);
  nearV(CUP.cavity.y, [0.0012, 0.1]); nearV(CUP.liquid.y, [0.0015, 0.08]);
  for (const y of [0.01, 0.05]) {
    const rc = CUP.cavity.r[0] + ((CUP.cavity.r[1] - CUP.cavity.r[0]) * (y - CUP.cavity.y[0])) / (CUP.cavity.y[1] - CUP.cavity.y[0]);
    near((rOut(y) - rc) / s, 0.0006, 1e-12);
  }
  near((CUP.cavity.r[1] - CUP.cavity.r[0]) / (CUP.cavity.y[1] - CUP.cavity.y[0]), k, 1e-12);     // 内外壁平行
  assert.deepEqual(boundsOf(CUP), [[-0.045, 0, -0.045], [0.045, 0.1, 0.045]]);
  const b = boundsOf(PRISM); nearV(b[0], [-0.037, 0, -0.023], 1e-12); nearV(b[1], [0.037, 0.105, 0.023], 1e-12);
  assert.throws(() => frustumShape({ rBottom: 0.03, rTop: 0.045, height: 0.1, wall: 0.0006, fill: 0.2 }), /fill/);
});

const OPTICS = { glassIor: 1.5, liquidIor: 1.36, glassAbsorb: [1.6, 0.5, 1.2], dispersion: 0.012, frostBlur: 0.012, frostDiffuse: 0.4, causticGrid: 8, causticGain: 1, interfaces: 0.85, lowLod: 3.5 };
const RIPPLE = { amp: 0.0008, k: 800, c: 0.055, decay: 1.6, r0: 0.004, at: [0, 0] };
const clean = (s, what) => {
  for (const bad of ['${', 'undefined', 'NaN', 'Infinity', '[object']) assert.ok(!s.includes(bad), `${what} contains ${bad}`);
  for (const [a, b] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(s.split(a).length, s.split(b).length, `${what}: unbalanced ${a}${b}`);
};

test('GLSL builds for both kinds: expected functions and defines, no template leftovers, the options add exactly their code', () => {
  const base = { optics: OPTICS };
  const P = refractGLSL({ ...base, shape: PRISM, neck: { wall: 0.0045 }, occluder: { y: [0.105, 0.162], r: 0.019 }, ripple: RIPPLE });
  const F = refractGLSL({ ...base, shape: CUP, contents: { object: null, absorb: [0, 0, 0], thickness: 0.02 }, scatter: 60 });
  const Fmin = refractGLSL({ ...base, shape: CUP });
  for (const [n, g] of Object.entries({ P, F, Fmin })) for (const [k, s] of Object.entries(g)) clean(s, `${n}.${k}`);
  for (const g of [P, F, Fmin]) {
    for (const fn of ['float exitP(', 'vec2 enterP(', 'vec3 through(', 'vec3 behind(', 'float fresnelOut(']) assert.ok(g.pars.includes(fn), fn);
    assert.match(g.main, /#ifdef GLASS_PASS[^#]*gl_FragDepth = [^#]*#/);
    for (const fn of ['float fid(', 'vec3 surfaceNormal(', 'void main()']) assert.ok(g.causticVert.includes(fn), fn);
  }
  assert.ok(P.pars.includes('uniform vec3 uOut[8]') && !P.pars.includes('coneSpan'));
  assert.ok(P.main.includes('瓶颈') && P.causticVert.includes('float rip(') && P.causticVert.includes('0.019000'));
  assert.ok(F.pars.includes('uniform vec4 uOut, uCav, uLiq;') && F.pars.includes('vec2 coneSpan(') && !F.pars.includes('vec3 P['));
  assert.ok(F.main.includes('#elif defined(CONTENTS_PASS)') && F.pars.includes('uniform float uThick;') && F.main.includes('uScatter'));
  assert.ok(!Fmin.main.includes('CONTENTS_PASS') && !Fmin.main.includes('uScatter') && !Fmin.main.includes('瓶颈') && !Fmin.causticVert.includes('float rip('));
  assert.ok(F.causticVert.includes('< 0.080000') && F.causticVert.includes('uCav, nc)'));      // 液面高度来自形状描述
  // 一个 4 面的棱柱也行（面编号按 N 进位）
  const sq = y => ({ planes: [[1, 0, 0.02], [0, 1, 0.02], [-1, 0, 0.02], [0, -1, 0.02]], y });
  const Q = refractGLSL({ ...base, shape: prismShape({ outer: sq([0, 0.1]), cavity: sq([0.01, 0.09]), liquid: sq([0.011, 0.05]) }) });
  assert.ok(Q.pars.includes('vec3 P[4]') && Q.causticVert.includes('+ 6.0 * bounce'));
  assert.throws(() => refractGLSL({ ...base, shape: { kind: 'sphere' } }), /unknown shape kind/);
  assert.throws(() => refractGLSL({ ...base, shape: prismShape({ outer: sq([0, 1]), cavity: { planes: sq().planes.slice(1), y: [0, 1] }, liquid: sq([0, 1]) }) }), /planes/);
  assert.throws(() => refractGLSL({ shape: CUP, optics: { ...OPTICS, lowLod: undefined } }), /optics.lowLod/);
});

// 假的渲染器：只记每一遍相机开的层
function cupWorld(o = {}) {
  const calls = [], renderer = { autoClear: true, shadowMap: { autoUpdate: true }, setRenderTarget() {}, clear() {}, render: (s, c) => { if (s.isScene) calls.push(c.layers.mask); } };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.01, 100);
  const key = new THREE.DirectionalLight('#fff', 2); key.position.set(-0.5, 0.9, 0.7); key.castShadow = true; scene.add(key, key.target);
  const root = new THREE.Group(), lathe = (r0, r1, y0, y1) => new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], 32);
  const glass = new THREE.Mesh(lathe(0.03, 0.045, 0, 0.1), new THREE.MeshPhysicalMaterial()), liquid = new THREE.Mesh(lathe(0.0295, 0.0415, 0.0015, 0.08));
  const ice = new THREE.Group(); ice.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02)));
  root.add(glass, liquid, ice); scene.add(root);
  const R = createRefraction({ renderer, scene, camera }, { shape: CUP, optics: OPTICS, root, glass, liquid, liquidAbsorb: [30, 45, 70], ...o(ice) });
  R.render({ width: 1080, height: 1920, texture: new THREE.Texture(), depthTexture: new THREE.DepthTexture(1080, 1920) });
  return { R, calls, glass, liquid, ice };
}

test('createRefraction wires a frustum cup: vec4 shape uniforms, the optional contents pass runs before the liquid', () => {
  const plain = cupWorld(() => ({}));
  assert.deepEqual(plain.calls, [1, 1 << LAYER.liquid, 1 << LAYER.glass, 1 << LAYER.over]);
  assert.ok(plain.R.uniforms.uOut.value.isVector4);
  nearV(plain.R.uniforms.uCav.value.toArray(), [...CUP.cavity.r, ...CUP.cavity.y], 1e-12);
  assert.equal(plain.R.caustics.length, 3);

  const w = cupWorld(ice => ({ name: 'cup', scatter: 80, liquidMaterial: { color: '#c89a6a', roughness: 0.3 }, contents: { object: ice, absorb: [0.2, 0.1, 0.05], thickness: 0.018 } }));
  assert.deepEqual(w.calls, [1, 1 << LAYER.contents, 1 << LAYER.liquid, 1 << LAYER.glass, 1 << LAYER.over]);
  const im = w.ice.children[0].material;
  assert.ok('CONTENTS_PASS' in im.defines && w.ice.children[0].layers.mask === 1 << LAYER.contents && im.customProgramCacheKey() === 'cup-contents');
  assert.equal(w.liquid.material.color.getHexString(), 'c89a6a');
  for (const m of [w.glass.material, w.liquid.material, im]) {
    const sh = { fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
    m.onBeforeCompile(sh);
    clean(sh.fragmentShader, m.customProgramCacheKey());
    assert.ok(sh.fragmentShader.includes('vec2 coneSpan(') && !sh.fragmentShader.includes('#include <transmission_fragment>'));
    assert.equal(sh.uniforms.uScatter.value, 80); assert.equal(sh.uniforms.uThick.value, 0.018);
  }
});
