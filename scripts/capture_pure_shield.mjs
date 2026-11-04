import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.viewer && !window.viewer.isLoading);

  const filePath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Various prod.xml';
  const fileInput = await page.$('input#plan-file-input, input[type="file"]');
  await fileInput.uploadFile(filePath);

  await page.waitForFunction(() => {
    return window.viewer && !window.viewer.isLoading &&
      document.querySelector('#plan-name')?.textContent?.includes('Various prod');
  }, { timeout: 45000 });

  await new Promise(r => setTimeout(r, 2000));

  // DO NOT MODIFY ANY MATERIAL PROPERTIES!
  // Just position camera to look at the fx_shield of advanced electronics:
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

    shieldMesh.updateWorldMatrix(true, true);
    if (!shieldMesh.geometry.boundingBox) shieldMesh.geometry.computeBoundingBox();
    const bb = shieldMesh.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(shieldMesh.matrixWorld);

    // Look at shield from front-quarter view, medium close (dist 60m)
    v.controls.enableDamping = false;
    v.controls.target.copy(center);
    v.camera.position.set(center.x + 40, center.y + 20, center.z + 50);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_as_is_60m.png' });

  // Now from 120m away (typical viewing distance when looking at the whole module)
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

    const bb = shieldMesh.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(shieldMesh.matrixWorld);

    v.controls.target.copy(center);
    v.camera.position.set(center.x + 80, center.y + 40, center.z + 100);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_as_is_120m.png' });

  // Now from 250m away (whole module overview)
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

    const bb = shieldMesh.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(shieldMesh.matrixWorld);

    v.controls.target.copy(center);
    v.camera.position.set(center.x + 180, center.y + 100, center.z + 220);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_as_is_250m.png' });

  await browser.close();
})();
