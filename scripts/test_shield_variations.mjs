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

  // Focus camera directly onto fx_shield of prod_gen_advancedelectronics
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
        mod.visible = true;
      } else {
        mod.visible = false;
      }
    });

    let shieldMesh = null;
    advMod?.traverse(c => {
      if (c.name && c.name.includes('fx_shield') && c.isMesh) {
        shieldMesh = c;
      }
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

    v.controls.enableDamping = false;
    v.controls.target.copy(center);
    v.camera.position.set(center.x + 80, center.y + 40, center.z + 100);
    v.controls.update();
    v.renderScene();
  });

  // Test 1: Just set wrapS and wrapT to RepeatWrapping on existing texture
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

    const mat = shieldMesh.material;
    if (mat.map) {
      mat.map.wrapS = 1000; // RepeatWrapping
      mat.map.wrapT = 1000;
      mat.map.needsUpdate = true;
    }
    if (mat.emissiveMap) {
      mat.emissiveMap.wrapS = 1000;
      mat.emissiveMap.wrapT = 1000;
      mat.emissiveMap.needsUpdate = true;
    }
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_test1_repeat.png' });
  console.log('Saved shield_test1_repeat.png');

  // Test 2: Adjust material properties for clear visible hexagon grid
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

    const mat = shieldMesh.material;
    mat.toneMapped = true; // prevent bloom supernova
    mat.emissiveIntensity = 1.2;
    mat.opacity = 0.65;
    mat.color.setHex(0x002244);
    mat.emissive.setHex(0x00f0ff);
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/shield_test2_styled.png' });
  console.log('Saved shield_test2_styled.png');

  await browser.close();
})();
