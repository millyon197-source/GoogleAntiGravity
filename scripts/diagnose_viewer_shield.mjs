import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.viewer && !window.viewer.isLoading);

  // Upload Various prod.xml
  const filePath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Various prod.xml';
  const fileInput = await page.$('input#plan-file-input, input[type="file"]');
  await fileInput.uploadFile(filePath);

  await page.waitForFunction(() => {
    return window.viewer && !window.viewer.isLoading &&
      document.querySelector('#plan-name')?.textContent?.includes('Various prod');
  }, { timeout: 45000 });

  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    const v = window.viewer;
    const results = [];
    v.modulesGroup.traverse(c => {
      if (c.name && c.name.includes('fx_shield')) {
        const mat = c.material;
        results.push({
          name: c.name,
          parentName: c.parent?.name,
          isMesh: c.isMesh,
          visible: c.visible,
          material: mat ? {
            name: mat.name,
            type: mat.type,
            transparent: mat.transparent,
            opacity: mat.opacity,
            blending: mat.blending,
            depthWrite: mat.depthWrite,
            depthTest: mat.depthTest,
            color: mat.color?.getHexString(),
            emissive: mat.emissive?.getHexString(),
            emissiveIntensity: mat.emissiveIntensity,
            map: mat.map ? {
              imageWidth: mat.map.image ? mat.map.image.width : (mat.map.mipmaps?.[0]?.width),
              wrapS: mat.map.wrapS,
              wrapT: mat.map.wrapT,
              repeat: [mat.map.repeat.x, mat.map.repeat.y]
            } : null,
            emissiveMap: mat.emissiveMap ? {
              imageWidth: mat.emissiveMap.image ? mat.emissiveMap.image.width : (mat.emissiveMap.mipmaps?.[0]?.width),
              wrapS: mat.emissiveMap.wrapS,
              wrapT: mat.emissiveMap.wrapT,
              repeat: [mat.emissiveMap.repeat.x, mat.emissiveMap.repeat.y]
            } : null
          } : null
        });
      }
    });
    return results;
  });

  console.log('SHIELD INFO IN LIVE VIEWER:', JSON.stringify(info, null, 2));

  // Also take a screenshot of whatever the viewer looks like right now after loading Various prod
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/viewer_default_view.png' });

  await browser.close();
})();
