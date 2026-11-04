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

  // The module is at [-631.687, 0, 152.977]
  // In the viewer, let's target [-631.687, 160, 152.977] (which is the height of the centrifuge ring)
  // Let's set camera looking from the standard orbit direction
  await page.evaluate(() => {
    const v = window.viewer;
    const target = new v.camera.position.constructor(-631.687, 160, 152.977);
    v.controls.target.copy(target);
    // Camera 400m away
    v.camera.position.set(-631.687 + 300, 160 + 200, 152.977 + 300);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_approach_400m.png' });

  // Camera 200m away
  await page.evaluate(() => {
    const v = window.viewer;
    const target = new v.camera.position.constructor(-631.687, 160, 152.977);
    v.controls.target.copy(target);
    v.camera.position.set(-631.687 + 150, 160 + 100, 152.977 + 150);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_approach_200m.png' });

  // Camera 100m away
  await page.evaluate(() => {
    const v = window.viewer;
    const target = new v.camera.position.constructor(-631.687, 160, 152.977);
    v.controls.target.copy(target);
    v.camera.position.set(-631.687 + 80, 160 + 50, 152.977 + 80);
    v.controls.update();
    v.renderScene();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_approach_100m.png' });

  await browser.close();
})();
