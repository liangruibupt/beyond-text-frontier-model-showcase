async (page) => {
  const progress = await page.evaluate(() => window.qingmingExport);
  if (progress?.status !== "complete") throw new Error(JSON.stringify(progress));
  const downloading = page.waitForEvent("download");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = window.qingmingExport.url;
    link.download = "qingming-unfolding.h264";
    link.click();
  });
  const download = await downloading;
  await download.saveAs("output/playwright/qingming-unfolding.h264");
  if (await download.failure()) throw new Error(await download.failure());
  await page.evaluate(() => URL.revokeObjectURL(window.qingmingExport.url));
  return { path: "output/playwright/qingming-unfolding.h264", ...progress, url: undefined };
}
