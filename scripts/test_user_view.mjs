import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => console.log('PAGE:', msg.text()));

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

  await page.evaluate(() => {
    const v = window.viewer;
    const idx = v.modulesGroup.children.findIndex(m => m.userData?.macro?.includes('gen_advancedelectronics'));
    console.log('Focusing on index:', idx);
    if (idx !== -1) {
      v.focusCameraOnModule(idx);
    }
  });

  // Wait for camera animation (typically 1-2 seconds)
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/adv_focused_view.png' });
  console.log('Saved adv_focused_view.png');

  await browser.close();
})();
