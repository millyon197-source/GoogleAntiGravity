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

  // Verify materials and inspect detail_l_main
  const verifyResult = await page.evaluate(() => {
    const v = window.viewer;
    let advMod = null;
    v.modulesGroup.children.forEach(mod => {
      if (mod.userData?.macro?.includes('prod_gen_advancedelectronics')) {
        advMod = mod;
      }
    });

    const subnodes = [];
    advMod?.traverse(child => {
      if (child.name && child.name.includes('detail_l_main') && child.isMesh) {
        const orig = child.userData?.originalMaterial;
        subnodes.push({
          name: child.name,
          matName: orig?.name,
          hasMap: Boolean(orig?.map),
          mapRepeat: orig?.map ? { x: orig.map.repeat.x, y: orig.map.repeat.y } : null,
          mapOffset: orig?.map ? { x: orig.map.offset.x, y: orig.map.offset.y } : null,
          hasNormal: Boolean(orig?.normalMap),
          hasRoughness: Boolean(orig?.roughnessMap),
          hasMetalness: Boolean(orig?.metalnessMap),
          hasEmissive: Boolean(orig?.emissiveMap),
          uvCount: child.geometry?.attributes?.uv?.count
        });
      }
    });

    return { foundAdvMod: Boolean(advMod), subnodes };
  });

  console.log('Verification result in Various prod.xml:\n', JSON.stringify(verifyResult, null, 2));

  // Turn off Colorized mode and isolate prod_gen_advancedelectronics
  const colorizedCb = await page.$('#colorized-checkbox');
  if (colorizedCb) {
    const isChecked = await (await colorizedCb.getProperty('checked')).jsonValue();
    if (isChecked) {
      await colorizedCb.click();
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  // Set camera to detail_l_main close up
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
      v.camera.position.set(worldCenter.x + 50, worldCenter.y + 25, worldCenter.z + 70);
      v.controls.update();
      v.renderScene();
    }
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/various_prod_detail_l_verified_1.png' });
  console.log('Saved various_prod_detail_l_verified_1.png');

  // Closer view
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
      v.camera.position.set(worldCenter.x + 20, worldCenter.y + 10, worldCenter.z + 30);
      v.controls.update();
      v.renderScene();
    }
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/various_prod_detail_l_verified_close.png' });
  console.log('Saved various_prod_detail_l_verified_close.png');

  await browser.close();
})();
