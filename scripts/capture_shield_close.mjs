import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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

  // Focus directly onto fx_shield
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) advMod = mod;
    });

    let shieldMesh = null;
    advMod?.traverse(c => {
      if (c.name && c.name.includes('fx_shield') && c.isMesh) shieldMesh = c;
    });

    // Apply RepeatWrapping to test
    const mat = shieldMesh.material;
    if (mat.map) {
      mat.map.wrapS = 1000;
      mat.map.wrapT = 1000;
      mat.map.needsUpdate = true;
    }
    if (mat.emissiveMap) {
      mat.emissiveMap.wrapS = 1000;
      mat.emissiveMap.wrapT = 1000;
      mat.emissiveMap.needsUpdate = true;
    }

    shieldMesh.updateWorldMatrix(true, true);
    if (!shieldMesh.geometry.boundingBox) shieldMesh.geometry.computeBoundingBox();
    const bb = shieldMesh.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(shieldMesh.matrixWorld);

    // Look at shield at a close angle
    v.controls.enableDamping = false;
    v.controls.target.copy(center);
    v.camera.position.set(center.x + 30, center.y + 15, center.z + 40);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_hex_close.png' });
  console.log('Saved shield_hex_close.png');

  await browser.close();
})();
