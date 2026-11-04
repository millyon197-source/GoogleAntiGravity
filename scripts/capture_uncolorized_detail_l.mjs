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
      console.log('Unchecked Colorized in UI');
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  // Isolate prod_gen_advancedelectronics and position camera on detail_l_main
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

    if (!advMod) return;

    let detailL = null;
    advMod.traverse(c => {
      if (c.name && c.name.includes('detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture')) {
        detailL = c;
      }
    });

    if (detailL && detailL.geometry) {
      if (!detailL.geometry.boundingBox) detailL.geometry.computeBoundingBox();
      const bb = detailL.geometry.boundingBox;
      const center = {
        x: (bb.min.x + bb.max.x) / 2,
        y: (bb.min.y + bb.max.y) / 2,
        z: (bb.min.z + bb.max.z) / 2
      };
      
      const worldCenter = detailL.localToWorld(detailL.position.clone().set(center.x, center.y, center.z));
      v.controls.target.copy(worldCenter);
      v.camera.position.set(worldCenter.x + 80, worldCenter.y + 40, worldCenter.z + 120);
      v.controls.update();
      v.renderScene();
    }
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_detail_l_uncolorized.png' });
  console.log('Saved adv_detail_l_uncolorized.png');

  // Also take an even closer screenshot
  await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });
    let detailL = null;
    advMod.traverse(c => {
      if (c.name && c.name.includes('detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture')) {
        detailL = c;
      }
    });
    if (detailL && detailL.geometry) {
      const bb = detailL.geometry.boundingBox;
      const center = {
        x: (bb.min.x + bb.max.x) / 2,
        y: (bb.min.y + bb.max.y) / 2,
        z: (bb.min.z + bb.max.z) / 2
      };
      const worldCenter = detailL.localToWorld(detailL.position.clone().set(center.x, center.y, center.z));
      v.controls.target.copy(worldCenter);
      v.camera.position.set(worldCenter.x + 25, worldCenter.y + 15, worldCenter.z + 35);
      v.controls.update();
      v.renderScene();
    }
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_detail_l_uncolorized_close.png' });
  console.log('Saved adv_detail_l_uncolorized_close.png');

  await browser.close();
})();
