import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.viewer && !window.viewer.isLoading);

  const debugInfo = await page.evaluate(async () => {
    const v = window.viewer;
    const url = 'assets/structures/production/prod_gen_advancedelectronics_data/detail_l_main-lod0.dae';
    
    // Test resolveTextureForModel on subnode names:
    const tests = [
      'detail_l_main-lod0_comp',
      'detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture',
      'detail_l_main-lod0Xlod0XgenericXgeneric_p1_fx',
      'detail_l_main-lod0Xlod0XgenericXgeneric_p1_alphatexture',
      'detail_l_main-lod0Xlod0XgenericXgeneric_p1_hullpattern',
      'detail_l_main-lod0Xlod0Xp1effectsXp1_lightcone_soft',
      'generic_p1_hulltexture',
      'theresonlyone'
    ];
    const resolved = tests.map(name => ({
      name,
      res: v.resolveTextureForModel(url, name)
    }));

    // Test loading Collada model directly:
    const scene = await v.loadColladaModel(url);
    const meshes = [];
    scene.traverse(child => {
      meshes.push({
        name: child.name,
        type: child.type,
        parent: child.parent?.name,
        mat: child.material ? {
          type: child.material.type,
          name: child.material.name,
          map: child.material.map ? 'yes' : 'no'
        } : null
      });
    });

    return { resolved, meshes };
  });

  console.log('Resolved textures:\n', JSON.stringify(debugInfo.resolved, null, 2));
  console.log('Collada scene meshes:\n', JSON.stringify(debugInfo.meshes, null, 2));

  await browser.close();
})();
