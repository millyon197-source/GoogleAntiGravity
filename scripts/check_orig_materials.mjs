import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

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

  const origMats = await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });

    const res = [];
    advMod?.traverse(child => {
      if (child.name && child.name.includes('detail_l_main') && child.isMesh) {
        const orig = child.userData?.originalMaterial;
        res.push({
          name: child.name,
          currentMatName: child.material?.name,
          currentColor: child.material?.color?.getHexString(),
          currentHasMap: Boolean(child.material?.map),
          origMatName: orig?.name,
          origColor: orig?.color?.getHexString(),
          origHasMap: Boolean(orig?.map),
          origMapRepeat: orig?.map ? { x: orig.map.repeat.x, y: orig.map.repeat.y } : null,
          origMapOffset: orig?.map ? { x: orig.map.offset.x, y: orig.map.offset.y } : null,
          origNormal: Boolean(orig?.normalMap),
          origRoughness: Boolean(orig?.roughnessMap),
          origMetalness: Boolean(orig?.metalnessMap)
        });
      }
    });
    return res;
  });

  console.log('Original materials on detail_l_main:\n', JSON.stringify(origMats, null, 2));

  await browser.close();
})();
