// browser.mjs — 启动无头 Chromium（Mac 走 Metal，Linux 走 Vulkan）、打开成片页面并等 __app.ready；拿到软件渲染（SwiftShader）直接报错
import { chromium } from 'playwright';
import { ASPECTS } from '../engine/variant.js';

// ANGLE 后端按平台选。Linux 上不指定就落到 SwiftShader；NVIDIA 驱动下 vulkan 和 gl-egl 都能拿到 GPU，这里用 vulkan
const GPU_ARGS = {
  darwin: ['--use-angle=metal'],
  linux: ['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'],
};

/** 启动参数。环境变量 FACTORY_GPU_ARGS（空格分隔）可以换掉按平台选的那一组 */
export const chromeArgs = (platform = process.platform, env = process.env) =>
  [...(env.FACTORY_GPU_ARGS?.trim() ? env.FACTORY_GPU_ARGS.trim().split(/\s+/) : GPU_ARGS[platform] ?? []), '--enable-gpu', '--ignore-gpu-blocklist'];

export const launch = () => chromium.launch({ headless: true, args: chromeArgs() });

/**
 * 打开 <base>/<film>/?<query>，视口 = 成片尺寸。页面报错、字体没加载上、GPU 是软件渲染都会抛错。
 * 返回 { page, info: { gpu, W, H, duration, fonts }, logs: 控制台 error 级消息 }
 */
export async function openFilm(browser, { base, film, query = '', ar = '9x16', timeout = 90_000 }) {
  const [width, height] = ASPECTS[ar];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  const fail = msg => { throw new Error([msg, ...errors.map(e => `  page: ${e}`), ...logs.map(e => `  console: ${e}`)].join('\n')); };
  const died = new Promise(res => page.once('pageerror', res));      // 启动时抛错就别等到超时
  await page.goto(`${base}/${film}/?${query}`);
  await Promise.race([page.waitForFunction(() => window.__app, null, { timeout }), died.then(e => { throw e; })]).catch(() => fail(`${film}: page never created window.__app`));
  let info;
  try { info = await page.evaluate(() => window.__app.ready); } catch (e) { fail(`${film}: __app.ready rejected: ${e.message.split('\n')[0]}`); }
  if (/swiftshader|llvmpipe|software/i.test(info.gpu)) fail(`${film}: software WebGL (${info.gpu}); refusing to render`);
  if (errors.length) fail(`${film}: page errors`);
  return { page, info, logs };
}

/** 页面里画 t 时刻的一帧，返回 { png: Buffer, overflow, shot } */
export async function frameAt(page, t) {
  const r = await page.evaluate(t => { const d = window.__app.draw(t); return { ...d, url: window.__app.png() }; }, t);
  return { png: Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'), overflow: r.overflow, shot: r.shot };
}
