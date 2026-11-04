import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.viewer && !window.viewer.isLoading);

  const res = await page.evaluate(async () => {
    const v = window.viewer;
    const url = '/assets1/textures/fx/pattern_hex_01.dds';
    try {
      const tex = await v.loadDdsTexture(url);
      return {
        success: Boolean(tex),
        isTexture: tex?.isTexture,
        hasImage: Boolean(tex?.image),
        width: tex?.image?.width || tex?.mipmaps?.[0]?.width,
        height: tex?.image?.height || tex?.mipmaps?.[0]?.height,
        format: tex?.format,
        mipmapsCount: tex?.mipmaps?.length
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Hex texture test:\n', JSON.stringify(res, null, 2));

  await browser.close();
})();
