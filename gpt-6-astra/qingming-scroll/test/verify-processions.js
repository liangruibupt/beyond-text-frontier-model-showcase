async (page) => {
  await page.route("**/*", (route) => route.continue());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  await page.getByRole("checkbox", { name: "水纹", exact: true }).uncheck();
  await page.locator("#wind").fill("0");
  await page.locator("#wind").dispatchEvent("input");
  const kinematics = await page.evaluate(() => {
    const api = window.qingming;
    const before = api.actorPoses(0);
    const after = api.actorPoses(.73);
    return before.filter((actor) => ["carry", "ride", "amble"].includes(actor.action)).map((actor) => {
      const next = after.find((other) => other.id === actor.id);
      return {
        id: actor.id,
        travel: Math.hypot(...next.root.map((v, axis) => v - actor.root[axis])),
        limbs: actor.feet.map((foot, i) => Math.hypot(...foot.map((v, axis) =>
          next.feet[i][axis] - next.root[axis] - (v - actor.root[axis])))),
        finite: [actor, next].every((p) => [...p.root, ...p.feet.flat(), ...p.flex.flat()].every(Number.isFinite)),
      };
    });
  });
  if (kinematics.length !== 5) throw new Error(`Expected 5 ensembles, received ${kinematics.length}`);
  for (const actor of kinematics) {
    if (!actor.finite || actor.travel < 2 || Math.max(...actor.limbs) < 1) {
      throw new Error(`Unanimated ensemble: ${JSON.stringify(actor)}`);
    }
  }
  const pixels = [];
  for (const [name, x, y] of [
    ["camel-caravan", 4080, 775], ["market-sedan", 3200, 835],
    ["town-sedans", 7160, 480], ["country-sedan", 19870, 685],
    ["donkey-riders", 20220, 965],
  ]) {
    await page.evaluate(({ x, y }) => window.qingming.moveTo(x, y, 3.5), { x, y });
    await page.waitForFunction(() => window.qingming.getState().ready);
    const result = await page.evaluate(() => {
      const api = window.qingming;
      const canvas = document.getElementById("painting");
      const gl = canvas.getContext("webgl");
      const read = () => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      api.seek(0);
      const before = read();
      api.seek(.73);
      const after = read();
      let changed = 0;
      for (let i = 0; i < before.length; i += 4) {
        if (Math.max(...[0, 1, 2].map((c) => Math.abs(before[i + c] - after[i + c]))) > 2) changed++;
      }
      return { changed, glError: gl.getError() };
    });
    if (result.changed < 300 || result.glError) throw new Error(`${name}: ${JSON.stringify(result)}`);
    for (const time of [0, .73, 2.5]) {
      await page.evaluate((t) => window.qingming.seek(t), time);
      await page.screenshot({ path: `output/playwright/${name}-${time}.png` });
    }
    pixels.push({ name, ...result });
  }
  return { kinematics, pixels };
}
