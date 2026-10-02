// Dump window.__NARRATION from index.html to narration.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const DIR = __dirname;
const CHROME = '/home/ubuntu/.cache/ms-playwright/chromium-1208/chrome-linux/chrome';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.goto('file://' + path.join(DIR,'index.html'));
  const narr = await p.evaluate(() => window.__NARRATION);
  fs.writeFileSync(path.join(DIR,'narration.json'), JSON.stringify(narr,null,2));
  console.log('NARR_SCENES', narr.length);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
