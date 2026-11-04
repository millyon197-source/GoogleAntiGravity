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

  const testDds = await page.evaluate(async () => {
    const v = window.viewer;
    const url = '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds';
    try {
      const tex = await v.loadDdsTexture(url);
      return {
        success: Boolean(tex),
        isTexture: tex?.isTexture,
        hasImage: Boolean(tex?.image),
        mipmapsCount: tex?.mipmaps?.length,
        width: tex?.image?.width || tex?.mipmaps?.[0]?.width,
        height: tex?.image?.height || tex?.mipmaps?.[0]?.height
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('DDS Load result:\n', JSON.stringify(testDds, null, 2));

  // Now test applyTexturesToMeshGroup directly on a freshly loaded Collada scene
  const testApply = await page.evaluate(async () => {
    const v = window.viewer;
    const url = 'assets/structures/production/prod_gen_advancedelectronics_data/detail_l_main-lod0.dae';
    const scene = await v.loadColladaModel(url);
    const sceneClone = scene.clone();
    await v.applyTexturesToMeshGroup(sceneClone, url);

    const meshes = [];
    sceneClone.traverse(child => {
      if (child.isMesh) {
        meshes.push({
          name: child.name,
          matName: child.material?.name,
          hasMap: Boolean(child.material?.map),
          mapRepeat: child.material?.map?.repeat,
          mapOffset: child.material?.map?.offset,
          texWidth: child.material?.map?.image?.width || child.material?.map?.mipmaps?.[0]?.width,
          texHeight: child.material?.map?.image?.height || child.material?.map?.mipmaps?.[0]?.height
        });
      }
    });
    return meshes;
  });

  console.log('ApplyTextures on clone result:\n', JSON.stringify(testApply, null, 2));

  await browser.close();
})();
