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

  const geomInfo = await page.evaluate(async () => {
    const v = window.viewer;
    const url = 'assets/structures/production/prod_gen_advancedelectronics_data/fx_shield-lod0.dae';
    const scene = await v.loadColladaModel(url);
    let mesh = null;
    scene.traverse(c => {
      if (c.isMesh) mesh = c;
    });

    if (!mesh) return { error: 'No mesh in Collada' };
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    const normal = geom.attributes.normal;
    const color = geom.attributes.color;

    return {
      posCount: pos?.count,
      posSample: pos ? [pos.getX(0), pos.getY(0), pos.getZ(0)] : null,
      uvCount: uv?.count,
      uvSample0: uv ? [uv.getX(0), uv.getY(0)] : null,
      uvSample1: uv ? [uv.getX(1), uv.getY(1)] : null,
      normalCount: normal?.count,
      colorCount: color?.count,
      boundsMin: geom.boundingBox ? geom.boundingBox.min : null,
      boundsMax: geom.boundingBox ? geom.boundingBox.max : null
    };
  });

  console.log('Shield geom info:\n', JSON.stringify(geomInfo, null, 2));

  await browser.close();
})();
