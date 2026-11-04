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

  const shieldInfo = await page.evaluate(() => {
    const v = window.viewer;
    const shields = [];
    v.modulesGroup.traverse(child => {
      if (child.name && child.name.toLowerCase().includes('shield')) {
        let parentMod = child;
        while (parentMod && (!parentMod.userData || !parentMod.userData.macro)) {
          parentMod = parentMod.parent;
        }
        const macro = parentMod?.userData?.macro || 'unknown';
        const mat = child.material;
        shields.push({
          childName: child.name,
          macro,
          isMesh: child.isMesh,
          visible: child.visible,
          matName: mat?.name,
          matType: mat?.type,
          hasMap: Boolean(mat?.map),
          mapPath: mat?.map?.image?.src || mat?.map?.source?.data?.src || mat?.map?.name,
          hasEmissiveMap: Boolean(mat?.emissiveMap),
          emissiveMapPath: mat?.emissiveMap?.image?.src || mat?.emissiveMap?.source?.data?.src || mat?.emissiveMap?.name,
          color: mat?.color?.getHexString(),
          emissive: mat?.emissive?.getHexString(),
          emissiveIntensity: mat?.emissiveIntensity,
          blending: mat?.blending,
          transparent: mat?.transparent,
          opacity: mat?.opacity,
          depthWrite: mat?.depthWrite
        });
      }
    });
    return shields;
  });

  console.log('Shield info:\n', JSON.stringify(shieldInfo, null, 2));

  await browser.close();
})();
