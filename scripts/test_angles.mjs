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

  // 1. Isolate Advanced Electronics: hide all other modules
  await page.evaluate(() => {
    const v = window.viewer;
    v.modulesGroup.children.forEach(mod => {
      if (!mod.userData?.macro?.includes('gen_advancedelectronics')) {
        mod.visible = false;
      } else {
        mod.visible = true;
      }
    });

    // Fit camera to Advanced Electronics
    let advMod = v.modulesGroup.children.find(m => m.userData?.macro?.includes('gen_advancedelectronics'));
    const box = new v.camera.position.constructor().setFromObject ? new window.THREE.Box3().setFromObject(advMod) : null;
  });

  // Let's use viewer's controls to view Advanced Electronics from an orbit
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = v.modulesGroup.children.find(m => m.userData?.macro?.includes('gen_advancedelectronics'));
    let shieldMesh = null;
    advMod.traverse(c => {
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

    // View 1: Default with Bloom ON, outside the centrifuge (dist 100m, high angle)
    v.controls.enableDamping = false;
    v.controls.target.copy(center);
    v.camera.position.set(center.x + 80, center.y + 60, center.z + 80);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/angle_bloom_on.png' });

  // View 2: With Bloom OFF
  await page.evaluate(() => {
    const v = window.viewer;
    const bloomCb = document.getElementById('bloom-checkbox');
    if (bloomCb) {
      bloomCb.checked = false;
      bloomCb.dispatchEvent(new Event('change'));
    }
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/angle_bloom_off.png' });

  // View 3: Outside view looking from perpendicular to the shield surface
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = v.modulesGroup.children.find(m => m.userData?.macro?.includes('gen_advancedelectronics'));
    let shieldMesh = null;
    advMod.traverse(c => {
      if (c.name && c.name.includes('fx_shield') && c.isMesh) shieldMesh = c;
    });

    const bb = shieldMesh.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(shieldMesh.matrixWorld);

    // Front/Side view of the cylinder
    v.controls.target.copy(center);
    v.camera.position.set(center.x, center.y, center.z + 100);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/angle_perpendicular.png' });

  await browser.close();
})();
