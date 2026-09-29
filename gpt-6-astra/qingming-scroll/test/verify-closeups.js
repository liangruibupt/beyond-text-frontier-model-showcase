async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  const results = [];
  for (const [name, x, y] of [
    ["boat", 13290, 650], ["bridge", 12380, 740], ["country", 18790, 500],
    ["servant", 20440, 1030], ["gate", 4060, 750], ["market", 2040, 770],
    ["camel-caravan", 4080, 770], ["market-sedan", 3200, 830],
    ["town-sedans", 7160, 480], ["country-sedan", 19870, 685],
    ["donkey-riders", 20220, 965],
  ]) {
    await page.evaluate(({ x, y }) => window.qingming.moveTo(x, y, 3.5), { x, y });
    await page.waitForFunction(() => window.qingming.getState().ready);
    const changes = await page.evaluate(() => {
      const gl = document.getElementById("painting").getContext("webgl");
      const canvas = gl.canvas;
      const people = document.getElementById("people");
      const water = document.getElementById("water");
      const wind = document.getElementById("wind");
      people.checked = true;
      water.checked = false;
      wind.value = "0";
      people.dispatchEvent(new Event("change"));
      water.dispatchEvent(new Event("change"));
      wind.dispatchEvent(new Event("input"));
      const read = () => {
        const data = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return data;
      };
      window.qingming.seek(0);
      const before = read();
      window.qingming.seek(2);
      const after = read();
      let changed = 0;
      for (let index = 0; index < before.length; index += 4) {
        if (Math.max(...[0, 1, 2].map((channel) =>
          Math.abs(before[index + channel] - after[index + channel]))) > 2) changed++;
      }
      return { changed, glError: gl.getError() };
    });
    if (changes.changed < 500 || changes.glError) throw new Error(`${name}: ${JSON.stringify(changes)}`);
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `output/playwright/closeup-${name}.png` });
    results.push({ name, ...changes });
  }
  const restored = await page.evaluate(async () => {
    const canvas = document.getElementById("painting");
    const gl = canvas.getContext("webgl");
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) return "not supported";
    const before = canvas.toDataURL();
    const lost = new Promise((resolve) => canvas.addEventListener("webglcontextlost", resolve, { once: true }));
    const recovered = new Promise((resolve) => canvas.addEventListener("webglcontextrestored", resolve, { once: true }));
    extension.loseContext();
    await lost;
    await new Promise((resolve) => setTimeout(resolve, 100));
    extension.restoreContext();
    await recovered;
    const deadline = performance.now() + 15000;
    while (!window.qingming.getState().ready) {
      if (performance.now() > deadline) throw new Error("Context restoration timed out");
      await new Promise(requestAnimationFrame);
    }
    window.qingming.seek(2);
    return { identical: canvas.toDataURL() === before, glError: gl.getError() };
  });
  if (restored !== "not supported" && (!restored.identical || restored.glError)) {
    throw new Error(`Context restoration failed: ${JSON.stringify(restored)}`);
  }
  return { regions: results, restored };
}
