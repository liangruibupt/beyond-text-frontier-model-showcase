// export.mjs — 生成 assets/svg/*.svg 和拼贴海报 poster.svg，再用 resvg 渲染出对应的 PNG
// 用法（在 opus-5.5/ 下）：node 12-pop-cats/export.mjs [--scale 3]
// 不用浏览器：resvg（Rust 的 SVG 渲染器）支持这里用到的 feTurbulence / feDisplacementMap / feGaussianBlur。
// 标签用的中文字体第一次运行时下载到 opus-5.5/.scratch/fonts/（已在 .gitignore 里）。
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { cats, catSVG, VIEW } from './cats.js';

const here = dirname(fileURLToPath(import.meta.url));
const argScale = process.argv.indexOf('--scale');
const scale = argScale > 0 ? Number(process.argv[argScale + 1]) : 3;
const pad = i => String(i + 1).padStart(2, '0');

const FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Black.otf';
const fontPath = join(here, '../.scratch/fonts/NotoSansCJKsc-Black.otf');
try { await access(fontPath); } catch {
  console.log('downloading Noto Sans CJK SC Black …');
  const r = await fetch(FONT_URL); if (!r.ok) throw new Error(`font download failed: ${r.status}`);
  await mkdir(dirname(fontPath), { recursive: true });
  await writeFile(fontPath, Buffer.from(await r.arrayBuffer()));
}

const render = (svg, out) => {
  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: 'Noto Sans CJK SC' },
  }).render().asPng();
  return writeFile(out, png);
};

await mkdir(join(here, 'assets/svg'), { recursive: true });
await mkdir(join(here, 'assets/png'), { recursive: true });

// 单张：SVG 是纯函数生成的，逐字节可复现
for (const [i, c] of cats.entries()) {
  const svg = catSVG(c, i), name = `${pad(i)}-${c.slug}`;
  await writeFile(join(here, `assets/svg/${name}.svg`), svg);
  await render(svg, join(here, `assets/png/${name}.png`));
  console.log(`  ${name}.svg / .png`);
}

// 海报：3 × 2 拼贴，每张按自己的角度歪着贴在米白底上
const cols = 3, gx = 30, gy = 34, mx = 44, my = 40;
const W = mx * 2 + cols * VIEW.w + (cols - 1) * gx, H = my * 2 + 2 * VIEW.h + gy;
const tiles = cats.map((c, i) => {
  const x = mx + (i % cols) * (VIEW.w + gx), y = my + Math.floor(i / cols) * (VIEW.h + gy);
  const inner = catSVG(c, i).replace(/^<svg [^>]*>/, `<svg x="0" y="0" width="${VIEW.w}" height="${VIEW.h}" viewBox="0 0 ${VIEW.w} ${VIEW.h}">`);
  return `<g transform="translate(${x} ${y}) rotate(${c.rot} ${VIEW.w / 2} ${VIEW.h / 2})">${inner}</g>`;
}).join('\n');
const poster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>六只绒毛波普猫猫</title>
<rect width="${W}" height="${H}" fill="#f3efe6"/>
${tiles}
</svg>
`;
await writeFile(join(here, 'assets/poster.svg'), poster);
await render(poster, join(here, 'assets/poster.png'));
console.log(`  poster.svg / .png  (${W}×${H} @${scale}x)`);
