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

  // Uncheck Colorized checkbox in UI
  const colorizedCb = await page.$('#colorized-checkbox');
  if (colorizedCb) {
    const isChecked = await (await colorizedCb.getProperty('checked')).jsonValue();
    if (isChecked) {
      await colorizedCb.click();
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  // Compute world center of detail_l_main on prod_gen_advancedelectronics
  const targetInfo = await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });

    let detailL = null;
    advMod?.traverse(c => {
      if (c.name && c.name.includes('detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture')) {
        detailL = c;
      }
    });

    if (!detailL) return { error: 'No detailL found' };

    detailL.updateWorldMatrix(true, true);
    if (!detailL.geometry.boundingBox) detailL.geometry.computeBoundingBox();
    const bb = detailL.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(detailL.matrixWorld);

    // Position camera looking straight at detailL
    v.controls.target.copy(center);
    v.camera.position.set(center.x + 80, center.y + 40, center.z + 100);
    v.controls.update();
    v.renderScene();

    return { center: { x: center.x, y: center.y, z: center.z } };
  });

  console.log('Target detail_l info:\n', JSON.stringify(targetInfo, null, 2));

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_detail_l_view1.png' });
  console.log('Saved adv_detail_l_view1.png');

  // Even closer shot of hull panels
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });

    let detailL = null;
    advMod?.traverse(c => {
      if (c.name && c.name.includes('detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture')) {
        detailL = c;
      }
    });

    const bb = detailL.geometry.boundingBox;
    const centerLocal = new v.camera.position.constructor(
      (bb.min.x + bb.max.x) / 2,
      (bb.min.y + bb.max.y) / 2,
      (bb.min.z + bb.max.z) / 2
    );
    const center = centerLocal.applyMatrix4(detailL.matrixWorld);

    v.controls.target.copy(center);
    v.camera.position.set(center.x + 25, center.y + 12, center.z + 30);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_detail_l_view2_close.png' });
  console.log('Saved adv_detail_l_view2_close.png');

  await browser.close();
})();
