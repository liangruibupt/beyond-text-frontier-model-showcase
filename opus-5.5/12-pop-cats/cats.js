// cats.js — 六只绒毛波普猫猫：数据 + 纯函数 SVG 生成器（浏览器和 Node 都能用）
// 每只猫只由 (数据, 序号) 决定：所有「随机」都取自带种子的随机数，同一只猫每次生成的 SVG 逐字节相同。

const T = Math.PI * 2, PI = Math.PI;

export const cats = [
  { slug: 'calico', n: '三花 · 小橘子', bg: '#1f6fe5', bg2: '#ffd23f', deco: ['#ff3d8b', '#ffd23f', '#3ee07a'], fur: '#fffaf4', muz: '#ffffff', shade: '#7c88a6', earL: '#1c1c1c', earR: '#1c1c1c',
    p: [['#1c1c1c', 84, 146, 58, 52], ['#1c1c1c', 216, 146, 58, 52], ['#f57a1f', 64, 240, 44, 38], ['#f57a1f', 236, 240, 44, 38]], eye: '#ffc21a', blush: '#ff7a2a', rot: -3 },
  { slug: 'white-longhair', n: '白色长毛 · 蓝眼', bg: '#ff4a1c', bg2: '#ff3d8b', deco: ['#ffd23f', '#ff9a1f', '#ffb3c7'], fur: '#ffffff', muz: '#ffffff', shade: '#7f8db0', p: [], eye: '#2a9bff', blush: '#ffadc2', fluffy: 1, neck: 1, rot: 2 },
  { slug: 'orange-tabby', n: '橘猫 · 虎斑大脸', bg: '#ff2f7d', bg2: '#ff9a1f', deco: ['#ffd23f', '#2b7de9', '#ffffff'], fur: '#f7962e', muz: '#fff1dc', shade: '#a8480c', p: [], eye: '#8ad83a', stripe: '#c4560c', blush: '#ff5a3d', rot: -2 },
  { slug: 'black', n: '黑猫 · 煤球', bg: '#ffd23f', bg2: '#ff3d8b', deco: ['#ff3d8b', '#1f6fe5', '#ff6a1c'], fur: '#1f1f1f', muz: '#2b2b2b', shade: '#000000', p: [], eye: '#d6e82a', dark: 1, blush: '#ff4f8b', rot: 3 },
  { slug: 'siamese', n: '暹罗 · 小咖啡', bg: '#7a4dff', bg2: '#2aa8ff', deco: ['#ffd23f', '#ff3d8b', '#3ee07a'], fur: '#fbecd2', muz: '#5a3a26', shade: '#a4876a', p: [], eye: '#1f8bff', point: '#5a3a26', blush: '#ff9a8a', rot: -2.5 },
  { slug: 'british-blue', n: '英短蓝猫 · 灰汤圆', bg: '#12c2a5', bg2: '#ff4a1c', deco: ['#ffd23f', '#ff3d8b', '#ffffff'], fur: '#8f9db3', muz: '#bcc7d8', shade: '#56637a', p: [], eye: '#ff9a1a', blush: '#ff8aa0', rot: 2 },
];

export const FONT = "'Noto Sans SC','Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif";
export const VIEW = { w: 306, h: 386 };   // 292×372 的画框 + 右下 7px 硬投影

const rng = s => () => (s = (s * 9301 + 49297) % 233280) / 233280;
const F = v => v.toFixed(1);

// 圆脸轮廓：两腮（左下、右下）加宽，带一点小起伏
function blob(cx, cy, rx, ry, ch, lobe, R, n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * T, g = Math.exp(-((a - .5) ** 2) / .25) + Math.exp(-((a - (PI - .5)) ** 2) / .25);
    const k = 1 + ch * g + lobe * g * (.5 + .5 * Math.sin(a * 15)) + (R() - .5) * .01;
    pts.push([cx + rx * k * Math.cos(a), cy + ry * (1 + ch * .3 * g) * Math.sin(a)]);
  }
  return { pts, cx, cy, n, d: 'M' + pts.map(p => F(p[0]) + ',' + F(p[1])).join(' L') + 'Z' };
}
const sub = (B, m) => ({ pts: B.pts.filter((p, i) => m(i / B.n * T)), cx: B.cx, cy: B.cy });
const group = (out, w, op) => Object.entries(out).map(([c, d]) => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-opacity="${op}" fill="none" stroke-linecap="round"/>`).join('');

// 轮廓上往外长的短绒毛（inset>0 时从里面长出来、盖住描边）
function hairs(B, R, N, l0, l1, inset, colFn, w, op) {
  const out = {};
  for (let j = 0; j < N; j++) {
    const p = B.pts[Math.floor(R() * B.pts.length)]; let dx = p[0] - B.cx, dy = p[1] - B.cy; const m = Math.hypot(dx, dy); dx /= m; dy /= m;
    const t = (R() - .5) * .7 + .25, ux = dx * Math.cos(t) - dy * Math.sin(t), uy = dx * Math.sin(t) + dy * Math.cos(t), L = l0 + (l1 - l0) * R(), sx = p[0] - ux * inset, sy = p[1] - uy * inset, c = colFn(p);
    out[c] = (out[c] || '') + `M${F(sx)},${F(sy)} q${F(ux * L * .5 + uy * 1.2)},${F(uy * L * .5 - ux * 1.2)} ${F(ux * L)},${F(uy * L)} `;
  }
  return group(out, w, op);
}
// 下巴往下垂的领毛：把头和胸口接起来
function ruff(B, R, N, l0, l1, colFn, w, op) {
  const out = {};
  for (let j = 0; j < N; j++) {
    const p = B.pts[Math.floor(R() * B.pts.length)]; let ux = (p[0] - B.cx) / 110 * .7 + (R() - .5) * .5, uy = 1; const m = Math.hypot(ux, uy); ux /= m; uy /= m;
    const L = l0 + (l1 - l0) * R(), sx = p[0] - ux * 7, sy = p[1] - uy * 7, c = colFn(p), bend = (R() - .5) * 6;
    out[c] = (out[c] || '') + `M${F(sx)},${F(sy)} q${F(ux * L * .5 + bend)},${F(uy * L * .5)} ${F(ux * L)},${F(uy * L)} `;
  }
  return group(out, w, op);
}
// 马克笔式描边：很多短线叠出来的细线；mask 按角度挑出要画的那段
function sketch(B, R, col, w, op, step = 2, span = 4, mask) {
  let d = ''; const n = B.pts.length, j = () => (R() - .5) * 1.6;
  for (let i = 0; i < n; i += step) {
    if (mask && (!mask(i / n * T) || !mask(((i + span) % n) / n * T))) continue;
    const p = B.pts[i], q = B.pts[(i + span) % n];
    d += `M${F(p[0] + j())},${F(p[1] + j())} L${F(q[0] + j())},${F(q[1] + j())} `;
  }
  return `<path d="${d}" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}" fill="none" stroke-linecap="round"/>`;
}
// 面内的细绒笔触（彩铅排线）
function velvet(cx, cy, rx, ry, N, R, col, op, w) {
  let d = '';
  for (let j = 0; j < N; j++) {
    const a = R() * T, q = Math.sqrt(R()) * .97, x = cx + rx * q * Math.cos(a), y = cy + ry * q * Math.sin(a);
    let ux = Math.cos(a) * .6, uy = Math.sin(a) * .6 + .6; const m = Math.hypot(ux, uy); ux /= m; uy /= m; const L = 3 + 5 * R();
    d += `M${F(x)},${F(y)} q${F(ux * L * .5 + 1)},${F(uy * L * .5)} ${F(ux * L)},${F(uy * L)} `;
  }
  return `<path d="${d}" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}
// 胸口一绺一绺的长毛
function locks(R, N, col, op, w) {
  let d = '';
  for (let k = 0; k < N; k++) {
    const x = 50 + R() * 200, y = 286 + R() * 76, s = (x - 150) / 90;
    d += `M${F(x)},${F(y)} q${F(s * 6 + (R() - .5) * 6)},14 ${F(s * 4 + (R() - .5) * 8)},${F(22 + R() * 14)} `;
  }
  return `<path d="${d}" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}
const inE = (p, x, y, rx, ry) => ((p[0] - x) / rx) ** 2 + ((p[1] - y) / ry) ** 2 < 1.1;
const chin = a => a > .27 * PI && a < .73 * PI, notChin = a => !chin(a), chinHint = a => a > .43 * PI && a < .57 * PI;

/** 第 i 只猫的完整 SVG 字符串（独立文件可直接打开） */
export function catSVG(c, i) {
  const R = rng(i * 97 + 13), id = 'k' + i, LN = c.dark ? '#e8e8e8' : '#2a2a2a', OL = c.dark ? '#000' : '#2b2b2b';
  const H = blob(150, 200, 106, 84, .1, c.fluffy ? .07 : .04, R), C = blob(150, 352, 124, 96, 0, c.fluffy ? .06 : .03, R);
  const Hlow = sub(H, chin), Hup = sub(H, notChin);
  const colH = p => { for (const q of c.p) if (inE(p, q[1], q[2], q[3], q[4])) return q[0]; if (c.point && inE(p, 150, 238, 60, 50)) return c.point; return c.fur; };
  let dots = '', conf = '';
  for (let k = 0; k < 14; k++) { const x = (k * 73 + i * 31) % 300, y = (k * 47 + i * 19) % 150 + 10, r = 6 + (k * 7) % 10; dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.deco[k % 3]}" opacity=".9"/>`; }
  for (let k = 0; k < 6; k++) { const x = (k * 97 + i * 13) % 280 + 10, y = (k * 61) % 60 + 270; conf += `<path d="M${x},${y} l14,-10 l4,16z" fill="${c.deco[(k + 1) % 3]}" stroke="#111" stroke-width="2"/>`; }
  const patch = q => { const B = blob(q[1], q[2], q[3], q[4], 0, .03, R, 70); return `<path d="${B.d}" fill="${q[0]}" filter="url(#sb${id})"/><g filter="url(#s1${id})">${hairs(B, R, 140, 3, 8, 2, () => q[0], 1.6, .85)}</g>`; };
  const patches = c.p.map(patch).join('');
  const point = c.point ? patch([c.point, 150, 238, 60, 50]) : '';
  const muz = c.point ? '' : `<ellipse cx="150" cy="246" rx="46" ry="28" fill="${c.muz}" opacity=".9" filter="url(#sb${id})"/>`;
  const stripes = c.stripe ? `<g stroke="${c.stripe}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#s2${id})" opacity=".85"><path d="M150,122 v24"/><path d="M131,126 q4,10 7,20"/><path d="M169,126 q-4,10 -7,20"/><path d="M48,196 q18,6 30,0"/><path d="M50,220 q16,4 26,-2"/><path d="M252,196 q-18,6 -30,0"/><path d="M250,222 q-16,4 -26,-2"/></g>` : '';
  const earL = c.earL || c.point || c.fur, earR = c.earR || c.point || c.fur;
  const eye = (x, y, col) => `<circle cx="${x}" cy="${y}" r="27" fill="${col}"/><circle cx="${x}" cy="${y}" r="27" fill="url(#ir${id})"/>
  <ellipse cx="${x}" cy="${y + 1}" rx="15.5" ry="16.5" fill="#0b0b0b"/>
  <circle cx="${x}" cy="${y}" r="27" fill="none" stroke="#1d1d1d" stroke-width="2.4" stroke-opacity=".85"/>
  <path d="M${x - 29},${y - 4} Q${x},${y - 35} ${x + 29},${y - 4}" stroke="#141414" stroke-width="4" fill="none" stroke-linecap="round" stroke-opacity=".85"/>
  <circle cx="${x - 8}" cy="${y - 9}" r="6" fill="#fff"/><circle cx="${x + 9}" cy="${y + 9}" r="2.8" fill="#fff"/>`;
  const brow = (x, s) => `<g stroke="${c.fluffy ? '#9aa6c0' : '#fff'}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".9"><path d="M${x},166 q${s * 10},-18 ${s * 26},-30"/><path d="M${x + s * 8},168 q${s * 12},-14 ${s * 30},-22"/><path d="M${x - s * 6},166 q${s * 6},-18 ${s * 16},-32"/></g>`;
  const wh = s => `<g fill="none" stroke-linecap="round"><g stroke="${LN}" stroke-width="1.3" opacity=".75"><path d="M${150 + s * 36},238 q${s * 50},-14 ${s * 120},-16"/><path d="M${150 + s * 38},246 q${s * 50},-2 ${s * 118},6"/></g><g stroke="#fff" stroke-width="1.3" opacity=".9"><path d="M${150 + s * 34},242 q${s * 48},-8 ${s * 114},-6"/><path d="M${150 + s * 36},252 q${s * 44},6 ${s * 104},22"/></g></g>`;
  const wdots = [[-20, 238], [-26, 246], [-14, 246], [20, 238], [26, 246], [14, 246]].map(q => `<circle cx="${150 + q[0]}" cy="${q[1]}" r="1.3" fill="${c.dark ? '#888' : '#7d6a6a'}" opacity=".7"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" width="${VIEW.w}" height="${VIEW.h}">
 <title>${c.n}</title>
 <defs>
  <clipPath id="fr${id}"><rect x="4" y="4" width="292" height="372"/></clipPath>
  <clipPath id="h${id}"><path d="${H.d}"/></clipPath>
  <clipPath id="c${id}"><path d="${C.d}"/></clipPath>
  <linearGradient id="ir${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>
  <linearGradient id="ear${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.point ? '#c98a7e' : '#ff8fae'}"/><stop offset="1" stop-color="${c.point ? '#e6b9a8' : '#ffd0dc'}"/></linearGradient>
  <radialGradient id="vol${id}" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#fff" stop-opacity="${c.dark ? .12 : .3}"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${c.shade}" stop-opacity="${c.dark ? .35 : .22}"/></radialGradient>
  <radialGradient id="cv${id}" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${c.shade}" stop-opacity="${c.dark ? .3 : .2}"/></radialGradient>
  <filter id="fz${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${i + 3}"/><feDisplacementMap in="SourceGraphic" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="sb${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="sn${id}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="s2${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>
  <filter id="s1${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".55"/></filter>
  <filter id="g${id}"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${i + 7}"/><feColorMatrix values="0 0 0 0 ${c.dark ? 1 : 0}  0 0 0 0 ${c.dark ? 1 : 0}  0 0 0 0 ${c.dark ? 1 : 0}  0 0 0 1.6 -0.75"/></filter>
 </defs>
 <rect x="11" y="11" width="292" height="372" fill="#111"/>
 <rect x="4" y="4" width="292" height="372" fill="${c.bg}"/>
 <path d="M4,270 L296,232 L296,376 L4,376Z" fill="${c.bg2}"/>
 <g clip-path="url(#fr${id})">${dots}
 <path d="M14,250 l18,-16 l18,16 l18,-16 l18,16 l18,-16 l18,16 l18,-16 l18,16 l18,-16 l18,16 l18,-16 l18,16 l18,-16 l18,16" fill="none" stroke="${c.deco[0]}" stroke-width="6" stroke-linejoin="round" opacity=".9"/>
 ${conf}</g>
 <path d="M244,52 l10,-22 l4,18 l18,-6 l-12,16" fill="none" stroke="#111" stroke-width="3"/>
 <g clip-path="url(#fr${id})"><g filter="url(#fz${id})">
  <path d="${C.d}" fill="${c.fur}"/>
  <g clip-path="url(#c${id})">
   ${c.point ? '' : `<ellipse cx="150" cy="318" rx="56" ry="46" fill="${c.muz}" opacity=".85" filter="url(#sb${id})"/>`}
   <ellipse cx="150" cy="290" rx="78" ry="16" fill="${c.shade}" opacity="${c.dark ? .55 : .22}" filter="url(#sn${id})"/>
   ${c.neck ? `<ellipse cx="150" cy="298" rx="60" ry="12" fill="#f4a6c8" opacity=".5" filter="url(#sb${id})"/>` : ''}
   ${velvet(150, 352, 124, 96, 320, R, c.shade, c.dark ? .4 : .14, 1)}${velvet(150, 352, 124, 96, 240, R, '#fff', c.dark ? .1 : .45, .9)}
   ${locks(R, c.fluffy ? 34 : 20, c.dark ? '#000' : c.shade, c.dark ? .6 : .38, 1.3)}${locks(R, 16, '#fff', c.dark ? .18 : .7, 1.1)}
   <rect width="300" height="380" fill="url(#cv${id})"/>
   <rect width="300" height="380" filter="url(#g${id})" opacity=".28"/></g>
  ${sketch(C, R, OL, 2, .5)}
  <g filter="url(#s1${id})">${hairs(C, R, c.fluffy ? 320 : 220, 3, c.fluffy ? 10 : 7, 3, () => c.fur, 1.4, .8)}</g>
 </g></g>
 <g filter="url(#fz${id})">
  <path d="M58,168 C56,112 66,72 84,46 C110,60 130,90 144,120Z" fill="${earL}" stroke="${OL}" stroke-width="2.2" stroke-opacity=".6" stroke-linejoin="round"/>
  <path d="M242,168 C244,112 234,72 216,46 C190,60 170,90 156,120Z" fill="${earR}" stroke="${OL}" stroke-width="2.2" stroke-opacity=".6" stroke-linejoin="round"/>
  <path d="M74,150 C72,112 80,84 88,66 C106,80 118,98 128,122Z" fill="url(#ear${id})" filter="url(#s2${id})"/>
  <path d="M226,150 C228,112 220,84 212,66 C194,80 182,98 172,122Z" fill="url(#ear${id})" filter="url(#s2${id})"/>
  <g stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85" fill="none" filter="url(#s1${id})"><path d="M84,146 q-1,-22 3,-44"/><path d="M92,146 q2,-20 7,-36"/><path d="M78,148 q-3,-16 -1,-32"/><path d="M100,144 q5,-14 11,-24"/><path d="M216,146 q1,-22 -3,-44"/><path d="M208,146 q-2,-20 -7,-36"/><path d="M222,148 q3,-16 1,-32"/><path d="M200,144 q-5,-14 -11,-24"/></g>
 </g>
 <g clip-path="url(#fr${id})"><g filter="url(#fz${id})">
  <path d="${H.d}" fill="${c.fur}"/>
  <g clip-path="url(#h${id})">${patches}${point}${muz}${stripes}
   ${velvet(150, 200, 106, 84, 560, R, c.shade, c.dark ? .45 : .15, 1)}${velvet(150, 200, 106, 84, 400, R, '#fff', c.dark ? .12 : .5, .9)}
   <rect width="300" height="380" fill="url(#vol${id})"/>
   <rect width="300" height="380" filter="url(#g${id})" opacity=".3"/></g>
  ${sketch(H, R, OL, 2.2, .55, 2, 4, notChin)}${sketch(H, R, OL, 1.1, .35, 3, 6, notChin)}
  ${sketch(H, R, OL, 1, .16, 3, 5, chinHint)}
  <g opacity=".4">${hairs(Hup, R, 120, 2, 4.5, 0, () => OL, 1, .8)}</g>
  <g filter="url(#s1${id})">${hairs(Hup, R, c.fluffy ? 380 : 290, 3, c.fluffy ? 9 : 7, 3, colH, 1.4, .8)}
   ${ruff(Hlow, R, c.fluffy ? 420 : 300, 8, c.fluffy ? 22 : 15, colH, 1.6, .9)}
   ${ruff(Hlow, R, 120, 6, 14, () => c.dark ? '#000' : c.shade, 1, c.dark ? .5 : .22)}</g>
 </g></g>
 <ellipse cx="80" cy="236" rx="24" ry="14" fill="${c.blush}" opacity=".55" filter="url(#sb${id})"/><ellipse cx="220" cy="236" rx="24" ry="14" fill="${c.blush}" opacity=".55" filter="url(#sb${id})"/>
 ${brow(104, -1)}${brow(196, 1)}
 ${eye(106, 200, c.eye)}${eye(194, 200, c.eye2 || c.eye)}
 <path d="M141,226 Q150,222 159,226 Q156,233 150,235 Q144,233 141,226Z" fill="${c.dark ? '#ff6f9a' : '#ff7f98'}" stroke="#2a2a2a" stroke-width="1.4" stroke-opacity=".6" stroke-linejoin="round"/>
 <path d="M150,235 v6 M150,241 q-5,6 -12,4 M150,241 q5,6 12,4" fill="none" stroke="${LN}" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".85"/>
 <g clip-path="url(#fr${id})">${wdots}${wh(-1)}${wh(1)}</g>
 <rect x="18" y="16" width="${c.n.length * 15 + 20}" height="30" fill="#fff" stroke="#111" stroke-width="3" transform="rotate(-3 18 16)"/>
 <text x="28" y="38" font-size="15" font-weight="900" fill="#111" font-family="${FONT.replace(/'/g, '&apos;')}" transform="rotate(-3 18 16)">${c.n}</text>
 <rect x="4" y="4" width="292" height="372" fill="none" stroke="#111" stroke-width="6"/>
</svg>
`;
}
