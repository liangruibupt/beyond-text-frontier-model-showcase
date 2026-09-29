async (page) => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();

  const pixelChecks = await page.evaluate(() => {
    const api = window.qingming;
    const canvas = document.getElementById("painting");
    const gl = canvas.getContext("webgl");
    function read() {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    }
    function configure(people, water, wind) {
      for (const [id, value] of [["people", people], ["water", water]]) {
        const control = document.getElementById(id);
        control.checked = value;
        control.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const control = document.getElementById("wind");
      control.value = wind;
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const camera = api.getState().viewport;
    const scale = canvas.height / camera.h;
    function compare(a, b, bounds) {
      let changed = 0;
      let total = 0;
      let sum = 0;
      for (let y = 0; y < canvas.height; y++) {
        const wy = camera.top + (canvas.height - y - 1) / scale;
        if (bounds && (wy < bounds[1] || wy > bounds[3])) continue;
        for (let x = 0; x < canvas.width; x++) {
          const wx = camera.left + x / scale;
          if (bounds && (wx < bounds[0] || wx > bounds[2])) continue;
          const p = (y * canvas.width + x) * 4;
          const difference = Math.max(
            Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]),
          );
          if (difference > 2) changed++;
          sum += difference;
          total++;
        }
      }
      return { changed, total, mean: sum / total };
    }
    const checks = {};
    for (const [name, options] of [
      ["allDisabled", [false, false, 0]],
      ["people", [true, false, 0]],
      ["trees", [false, false, 80]],
      ["water", [false, true, 0]],
      ["allEnabled", [true, true, 55]],
    ]) {
      configure(...options);
      api.seek(0);
      const a = read();
      api.seek(1.31);
      const b = read();
      checks[name] = compare(a, b);
      if (name === "people") {
        checks.boatman = compare(a, b, [13230, 620, 13340, 749]);
        checks.walker = compare(a, b, [12250, 768, 12355, 920]);
      }
      if (name === "allEnabled") checks.staticRoof = compare(a, b, [12900, 900, 13150, 1010]);
    }
    document.getElementById("original").click();
    api.seek(0);
    const a = read();
    api.seek(3.5);
    checks.original = compare(a, read());
    document.getElementById("original").click();
    let nonblank = 0;
    for (let p = 0; p < a.length; p += 400) if (a[p] > 65) nonblank++;
    checks.nonblankSamples = nonblank;
    checks.glError = gl.getError();
    return checks;
  });
  assert(pixelChecks.allDisabled.changed === 0, "Disabled layers must remain pixel-identical");
  assert(pixelChecks.original.changed === 0, "Original view must remain pixel-identical");
  assert(pixelChecks.people.changed > 100, "People must animate");
  assert(pixelChecks.boatman.changed > 10, "The visible boatman must animate");
  assert(pixelChecks.walker.changed > 30, "A walking figure must change pixels along the street");
  assert(pixelChecks.trees.changed > 1000, "Trees must animate");
  assert(pixelChecks.water.changed > 1000, "Water must animate");
  assert(pixelChecks.staticRoof.changed === 0, "Foreground architecture must stay still");
  assert(pixelChecks.nonblankSamples > 1000, "Canvas must contain the painting");
  assert(pixelChecks.glError === 0, "WebGL must not report errors");
  results.push({ pixelChecks });
  const poses = await page.evaluate(() => {
    const a = window.qingming.actorPoses(0);
    const b = window.qingming.actorPoses(2);
    return a.map((actor, index) => ({
      id: actor.id, action: actor.action,
      travel: Math.hypot(...actor.root.map((v, axis) => v - b[index].root[axis])),
      gesture: Math.max(...actor.hands.map((hand, side) =>
        Math.hypot(...hand.map((v, axis) => v - b[index].hands[side][axis])))),
    }));
  });
  assert(poses.filter((actor) => actor.action === "walk").every((actor) => actor.travel >= 19),
    "Every walking figure must actually translate in painting coordinates");
  assert(poses.filter((actor) => ["wave", "pull"].includes(actor.action)).every((actor) => actor.gesture > 3),
    "Stationary figures must articulate their hands");
  assert(poses.filter((actor) => ["carry", "ride", "amble"].includes(actor.action)).length === 5,
    "All sedan and animal ensembles must be present");
  assert(poses.filter((actor) => ["carry", "ride", "amble"].includes(actor.action)).every((actor) => actor.travel > 5),
    "Sedans and animals must travel, not only warp in place");
  results.push({ articulatedFigures: poses });

  const pausedTime = await page.evaluate(() => window.qingming.getState().time);
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => window.qingming.getState().time) === pausedTime, "Pause must stop time");
  await page.getByRole("button", { name: "播放动画", exact: true }).click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(() => window.qingming.getState().time) > pausedTime, "Play must resume time");
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  results.push({ pauseAndPlay: "passed" });

  await page.getByRole("button", { name: "放大", exact: true }).click();
  assert(await page.evaluate(() => window.qingming.getState().zoom) === 1.25, "Zoom-in control");
  await page.getByRole("button", { name: "缩小", exact: true }).click();
  assert(await page.evaluate(() => window.qingming.getState().zoom) === 1, "Zoom-out control");
  const oldX = await page.evaluate(() => window.qingming.getState().x);
  await page.mouse.move(800, 420);
  await page.mouse.down();
  await page.mouse.move(990, 420, { steps: 8 });
  await page.mouse.up();
  assert(await page.evaluate(() => window.qingming.getState().x) < oldX, "Drag must pan");
  results.push({ zoomAndPan: "passed" });

  for (const [key, title] of [
    ["country", "郊野春风"], ["river", "汴河行舟"], ["gate", "城门往来"],
    ["market", "街市烟火"], ["bridge", "虹桥人家"],
  ]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.waitForFunction((scene) => {
      const state = window.qingming.getState();
      return state.scene === scene && state.ready && Math.abs(state.zoom - 1) < 0.001;
    }, key);
    await page.waitForTimeout(1800);
    assert(await page.locator("#loading").isHidden(), `${title} must load`);
  }
  results.push({ allScenes: "passed" });

  await page.getByRole("button", { name: "展卷", exact: true }).click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(() => {
    const state = window.qingming.getState();
    return state.tour && state.x > 22000 && state.reveal > 0 && state.reveal < 1;
  }), "Unrolling must start from the right-hand beginning of the scroll");
  await page.getByRole("button", { name: "展卷", exact: true }).click();
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  const tourFrames = [];
  for (const time of [0, 1.2, 2.4, 15, 30, 60, 90, 120]) {
    const state = await page.evaluate((time) => window.qingming.renderTourFrame(time), time);
    tourFrames.push({ time, ...state });
  }
  assert(tourFrames.every((state, index) => state.ready && (!index || state.x <= tourFrames[index - 1].x)),
    "All tour frames must load and move continuously right-to-left");
  assert(tourFrames[0].reveal === 0 && tourFrames[1].reveal === .5 && tourFrames[2].reveal === 1,
    "The scroll must visibly unfold before travelling");
  assert(tourFrames[0].x - tourFrames.at(-1).x > 20000, "The film must traverse the entire painting");
  await page.evaluate(() => window.qingming.moveTo(13350, 600, 1));
  await page.waitForFunction(() => window.qingming.getState().ready);
  results.push({ unfolding: tourFrames });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存当前画面", exact: true }).click();
  const image = await download;
  await image.saveAs("output/playwright/qingming-snapshot.png");
  assert((await image.failure()) === null, "PNG export must remain origin-clean");
  results.push({ unfoldingAndDownload: "passed" });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const canvas = document.getElementById("painting");
      const rect = document.querySelector(".stage").getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      return canvas.width === Math.round(rect.width * ratio)
        && canvas.height === Math.round(rect.height * ratio);
    });
    await page.evaluate(() => window.qingming.moveTo(13350, 600, 1));
    await page.waitForFunction(() => window.qingming.getState().ready);
    const layout = await page.evaluate(() => {
      const overflow = [...document.querySelectorAll("button, select, .identity, .switch-label, .wind-control, .provenance")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width && (box.left < -1 || box.right > innerWidth + 1);
        }).map((element) => element.id || element.className);
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl");
      const read = () => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      window.qingming.seek(0);
      const before = read();
      window.qingming.seek(.73);
      const after = read();
      let changed = 0, nonblank = 0;
      for (let i = 0; i < before.length; i += 4) {
        if (before[i] > 65) nonblank++;
        if (Math.max(...[0, 1, 2].map((c) => Math.abs(before[i + c] - after[i + c]))) > 2) changed++;
      }
      return {
        overflow, documentWidth: document.documentElement.scrollWidth, width: innerWidth,
        canvasHeight: canvas.getBoundingClientRect().height, changed, nonblank, glError: gl.getError(),
      };
    });
    assert(layout.overflow.length === 0, `Controls overflow at ${viewport.width}: ${layout.overflow.join(",")}`);
    assert(layout.documentWidth <= layout.width, `Horizontal page overflow at ${viewport.width}`);
    assert(layout.canvasHeight >= 260, "Painting should remain visible");
    assert(layout.nonblank > 1000 && layout.changed > 100,
      `Painting must render and animate at ${viewport.width}px`);
    assert(layout.glError === 0, `WebGL failure at ${viewport.width}px`);
    await page.screenshot({ path: `output/playwright/qingming-${viewport.width}.png`, fullPage: true });
    results.push({ viewport, layout });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  assert(await page.evaluate(() => !window.qingming.getState().playing), "Reduced motion must start paused");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  results.push({ reducedMotion: "passed", runtimeErrors: errors });
  assert(errors.length === 0, "Unexpected browser errors");
  return results;
}
