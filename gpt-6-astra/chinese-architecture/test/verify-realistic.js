async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [], results = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload();
  await page.waitForFunction(() => window.__arch?.exterior?.stats().ready);
  const pixels = () => page.evaluate(() => {
    const source = document.querySelector('#exterior canvas');
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, 180, 120);
    const data = ctx.getImageData(0, 0, 180, 120).data;
    let colored = 0, hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > data[i + 1] * 1.16 && data[i + 1] < 155) colored++;
      hash = Math.imul(hash ^ data[i], 16777619);
    }
    return { colored, hash, width: source.width, height: source.height,
      glError: source.getContext('webgl2').getError() };
  });
  const buildings = await page.evaluate(() => ARCH_DATA.BUILDINGS.map((b) => b.id));
  for (const id of buildings) {
    await page.locator(`[data-id="${id}"].dyn-pill`).click();
    await page.waitForFunction((id) => __arch.exterior.stats().building === id, id);
    const state = await page.evaluate(() => __arch.exterior.stats());
    const geometry = await page.evaluate(() => __arch.exterior.inspectGeometry());
    const image = await pixels();
    assert(geometry.failures.length === 0, `${id}: invalid geometry`);
    assert(state.tiles > 2000 && geometry.instances > state.tiles, `${id}: missing tiles or timber`);
    assert(state.projectedBounds.every((p) => Math.abs(p[0]) < .96 && Math.abs(p[1]) < .85),
      `${id}: clipped building`);
    assert(image.colored > 50 && image.glError === 0, `${id}: blank or failed canvas`);
    await page.screenshot({ path: `output/playwright/architecture-${id}.png` });
    results.push({ id, tiles: state.tiles, roofs: state.roofs, geometry, pixels: image });
  }
  const before = await pixels();
  await page.getByRole('button', { name: '自动旋转', exact: true }).click();
  const camera = await page.evaluate(() => __arch.exterior.stats().camera);
  await page.waitForFunction((old) => __arch.exterior.stats().camera.some((v, i) => Math.abs(v - old[i]) > .1), camera);
  await page.getByRole('button', { name: '自动旋转', exact: true }).click();
  assert((await pixels()).hash !== before.hash, 'Rotation must change canvas pixels');
  await page.getByRole('button', { name: '正立面', exact: true }).click();
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  const canvasBox = await page.locator('#exterior canvas').boundingBox();
  const orbitBefore = await page.evaluate(() => __arch.exterior.stats().camera);
  await page.mouse.move(canvasBox.x + canvasBox.width * .55, canvasBox.y + canvasBox.height * .52);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * .67, canvasBox.y + canvasBox.height * .55, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((old) => __arch.exterior.stats().camera.some((v, i) => Math.abs(v - old[i]) > 1), orbitBefore);
  const zoomBefore = await page.evaluate(() => {
    const s = __arch.exterior.stats(); return Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
  });
  await page.mouse.wheel(0, -180);
  await page.waitForFunction((old) => {
    const s = __arch.exterior.stats();
    return Math.hypot(...s.camera.map((v, i) => v - s.target[i])) < old - 1;
  }, zoomBefore);
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  await page.getByRole('combobox', { name: '建筑光照' }).selectOption('raking');
  assert((await pixels()).hash !== before.hash, 'Lighting must change the render');
  await page.getByRole('combobox', { name: '建筑光照' }).selectOption('daylight');
  await page.getByRole('button', { name: '拆解', exact: true }).click();
  assert(await page.evaluate(() => __arch.exterior.stats().exploded), 'Exploded exterior must be enabled');
  await page.getByRole('button', { name: '拆解', exact: true }).click();
  await page.evaluate(() => __arch.setStage(3, true));
  assert(await page.evaluate(() => __arch.exterior.stats().stage === 3), 'Construction stages must synchronize');
  const partial = await pixels();
  await page.evaluate(() => __arch.setStage(9, true));
  assert((await pixels()).hash !== partial.hash, 'Roof construction must change pixels');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存三维画面', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs('output/playwright/architecture-export.png');
  assert(await download.failure() === null, 'Offline PNG export');
  await page.getByRole('button', { name: '结构剖面', exact: true }).click();
  assert(await page.locator('#section').isVisible(), 'Original section view must remain available');
  await page.getByRole('button', { name: '拆解', exact: true }).click();
  assert(await page.locator('#section').evaluate((svg) => svg.classList.contains('exploded')), 'Section explode');
  await page.getByRole('button', { name: '拆解', exact: true }).click();
  await page.getByRole('button', { name: '三维外观', exact: true }).click();
  const restored = await page.evaluate(async () => {
    const canvas = document.querySelector('#exterior canvas');
    const gl = canvas.getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) return 'unsupported';
    const lost = new Promise((resolve) => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    const restored = new Promise((resolve) => canvas.addEventListener('webglcontextrestored', resolve, { once: true }));
    extension.loseContext(); await lost;
    const lostError = gl.getError();
    if (lostError !== gl.CONTEXT_LOST_WEBGL && lostError !== gl.NO_ERROR) {
      throw new Error(`Unexpected error during context loss: ${lostError}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    extension.restoreContext(); await restored;
    return { contextLost: __arch.exterior.stats().contextLost, glError: gl.getError(), lostError };
  });
  if (restored !== 'unsupported') {
    assert(!restored.contextLost && restored.glError === 0, `Context restoration: ${JSON.stringify(restored)}`);
    assert((await pixels()).colored > 50, 'Restored context must contain the building');
  }
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#exterior canvas'), rect = canvas.getBoundingClientRect();
      return canvas.width === Math.floor(rect.width * Math.min(devicePixelRatio || 1, 1.5));
    });
    const state = await page.evaluate(() => __arch.exterior.stats());
    const overflow = await page.evaluate(() => [...document.querySelectorAll('button, select, h1, #modelNote')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); })
      .map((e) => e.id || e.textContent));
    assert(overflow.length === 0, `Overflow at ${width}: ${overflow.join(',')}`);
    assert(state.projectedBounds.every((p) => Math.abs(p[0]) < .96 && Math.abs(p[1]) < .85), `Framing at ${width}`);
    const image = await pixels();
    assert(image.colored > 20 && image.glError === 0, `Mobile render at ${width}`);
    const priorCamera = await page.evaluate(() => __arch.exterior.stats().camera);
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    await page.waitForFunction((old) => __arch.exterior.stats().camera.some((v, i) => Math.abs(v - old[i]) > .15), priorCamera);
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    assert((await pixels()).hash !== image.hash, `Mobile canvas must change during rotation at ${width}`);
    await page.getByRole('button', { name: '复位视角', exact: true }).click();
    await page.screenshot({ path: `output/playwright/architecture-${width}.png` });
    results.push({ width, pixels: image, overflow });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => __arch?.exterior?.stats().ready);
  assert(await page.getByRole('button', { name: '自动旋转', exact: true }).getAttribute('aria-pressed') === 'false',
    'Reduced motion must not auto-rotate');
  const fallback = await page.context().newPage();
  try {
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === 'webgl2' ? null : getContext.call(this, kind, ...args);
      };
    });
    await fallback.goto(page.url());
    await fallback.waitForFunction(() => window.__arch?.state.scene);
    await fallback.evaluate(() => __arch.setStage(9, true));
    assert(await fallback.getByRole('button', { name: '三维外观', exact: true }).isDisabled(), 'Unsupported WebGL fallback');
    assert(await fallback.locator('#section').isVisible(), 'Section must remain usable without WebGL');
  } finally {
    await fallback.close();
  }
  assert(errors.length === 0, `Runtime errors: ${errors.join(',')}`);
  return { results, interactions: 'passed', restored, fallback: 'passed', errors };
}
