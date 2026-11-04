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

  // Wait until initial loading is done
  await page.waitForFunction(() => {
    return window.viewer && !window.viewer.isLoading && document.querySelector('#plan-name')?.textContent !== 'Loading...';
  }, { timeout: 30000 });

  console.log('Initial page loaded.');

  // Upload Various prod.xml
  const filePath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Various prod.xml';
  const fileInput = await page.$('input#plan-file-input, input[type="file"]');
  if (!fileInput) {
    console.error('File input not found');
    await browser.close();
    return;
  }
  await fileInput.uploadFile(filePath);

  // Wait for plan to load
  await page.waitForFunction(() => {
    return window.viewer && !window.viewer.isLoading &&
      document.querySelector('#plan-name')?.textContent?.includes('Various prod');
  }, { timeout: 45000 });

  console.log('Various prod.xml loaded.');

  // Wait extra 2 seconds for textures to finish
  await new Promise(r => setTimeout(r, 2000));

  // Inspect meshes under prod_gen_advancedelectronics
  const inspection = await page.evaluate(() => {
    const v = window.viewer;
    if (!v || !v.modulesGroup) return { error: 'No modulesGroup' };
    
    const results = [];
    v.modulesGroup.traverse(obj => {
      if (obj.name && obj.name.includes('detail_l_main')) {
        let parentMod = obj;
        while (parentMod && (!parentMod.userData || !parentMod.userData.macro)) {
          parentMod = parentMod.parent;
        }
        const macro = parentMod?.userData?.macro || 'unknown';
        const meshes = [];
        obj.traverse(child => {
          if (child.isMesh) {
            const mat = child.material;
            meshes.push({
              name: child.name,
              matName: mat?.name,
              hasMap: Boolean(mat?.map),
              mapRepeat: mat?.map ? { x: mat.map.repeat.x, y: mat.map.repeat.y } : null,
              mapOffset: mat?.map ? { x: mat.map.offset.x, y: mat.map.offset.y } : null,
              hasNormal: Boolean(mat?.normalMap),
              hasRoughness: Boolean(mat?.roughnessMap),
              hasEmissive: Boolean(mat?.emissiveMap),
              hasUv: Boolean(child.geometry?.attributes?.uv),
              uvCount: child.geometry?.attributes?.uv?.count
            });
          }
        });
        results.push({
          objName: obj.name,
          macro,
          meshes
        });
      }
    });
    return results;
  });

  console.log('Inspection results:\n', JSON.stringify(inspection, null, 2));

  await browser.close();
})();
