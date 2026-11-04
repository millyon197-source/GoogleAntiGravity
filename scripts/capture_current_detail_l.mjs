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

  // Turn off Colorized mode so textures are visible, and focus camera on prod_gen_advancedelectronics detail_l_main
  await page.evaluate(() => {
    const v = window.viewer;
    v.setColorized(false);
    
    // Find prod_gen_advancedelectronics module
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });

    if (!advMod) {
      console.error('Could not find prod_gen_advancedelectronics module');
      return;
    }

    // Hide other modules so only adv electronics is visible
    v.modulesGroup.children.forEach(mod => {
      mod.visible = (mod === advMod);
    });

    // Find detail_l_main
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
      
      // Transform center to world
      const worldCenter = detailL.localToWorld(detailL.position.clone().set(center.x, center.y, center.z));

      // Position camera right in front of a prominent detail_l surface
      v.controls.target.copy(worldCenter);
      v.camera.position.set(worldCenter.x + 60, worldCenter.y + 30, worldCenter.z + 80);
      v.controls.update();
      v.renderScene();
    }
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_detail_l_current_state.png' });
  console.log('Saved adv_detail_l_current_state.png');

  await browser.close();
})();
