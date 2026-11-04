import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.viewer && !window.viewer.isLoading);

  // Upload Various prod.xml
  const filePath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Various prod.xml';
  const fileInput = await page.$('input#plan-file-input, input[type="file"]');
  await fileInput.uploadFile(filePath);

  await page.waitForFunction(() => {
    return window.viewer && !window.viewer.isLoading &&
      document.querySelector('#plan-name')?.textContent?.includes('Various prod');
  }, { timeout: 45000 });

  await new Promise(r => setTimeout(r, 2000));

  // Inspect each module in modulesGroup
  const modulesSummary = await page.evaluate(() => {
    const v = window.viewer;
    return v.modulesGroup.children.map((mod, idx) => {
      const detailL = [];
      mod.traverse(child => {
        if (child.name && child.name.includes('detail_l_main') && child.isMesh) {
          detailL.push({
            name: child.name,
            matName: child.material?.name,
            hasMap: Boolean(child.material?.map),
            matType: child.material?.type,
            color: child.material?.color?.getHexString(),
            repeat: child.material?.map ? { x: child.material.map.repeat.x, y: child.material.map.repeat.y } : null
          });
        }
      });
      return {
        index: idx,
        macro: mod.userData?.macro,
        name: mod.name,
        detailL
      };
    });
  });

  console.log('Modules summary:\n', JSON.stringify(modulesSummary, null, 2));

  await browser.close();
})();
