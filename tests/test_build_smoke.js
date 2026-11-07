/**
 * Build smoke test: builds the app into a temporary folder, checks the chunk graph has no import
 * cycles, then serves the build and loads it in headless Chrome. The page must start without
 * errors and load the default plan. A build has no X4 game assets, so the missing-assets pop-up
 * must appear and modules are drawn as placeholders.
 *
 * Catches start-up failures that only exist in production builds, such as the chunk import cycle
 * that broke dist/ ("Class extends value undefined").
 */
import assert from 'node:assert';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

console.log('[*] Build smoke test: building the app and loading it in a browser...');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-build-smoke-'));
// Same reason as the billboard test: Vite's dependency cache is keyed on NODE_ENV
process.env.NODE_ENV = 'production';
const vite = await import('vite');

let server = null;
let browser = null;
try {
  // 1. Build into a temporary folder (leaves the project's dist/ alone)
  await vite.build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
  const assetsDir = path.join(outDir, 'assets');
  const chunks = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')) && chunks.length > 0, 'build produced index.html and chunks');
  console.log(`  ✓ built ${chunks.length} chunks`);

  // 2. No import cycles between chunks (static imports between the emitted files)
  const graph = new Map(chunks.map(f => {
    const code = fs.readFileSync(path.join(assetsDir, f), 'utf8');
    const deps = [...code.matchAll(/(?:import|from)\s*["']\.\/([^"']+\.js)["']/g)].map(m => m[1]);
    return [f, [...new Set(deps)].filter(d => chunks.includes(d))];
  }));
  const state = new Map();
  const cycle = [];
  const visit = (f, trail) => {
    if (state.get(f) === 'done') return false;
    if (state.get(f) === 'active') { cycle.push(...trail.slice(trail.indexOf(f)), f); return true; }
    state.set(f, 'active');
    for (const d of graph.get(f)) if (visit(d, [...trail, f])) return true;
    state.set(f, 'done');
    return false;
  };
  for (const f of chunks) if (visit(f, [])) break;
  assert.deepStrictEqual(cycle, [], `chunk import cycle: ${cycle.join(' -> ')}`);
  console.log('  ✓ no import cycles between chunks');

  // 3. Serve the build and load it in headless Chrome
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
  server = await vite.preview({ logLevel: 'error', build: { outDir }, preview: { port, strictPort: true, open: false } });
  const url = server.resolvedUrls.local[0];

  const puppeteer = (await import('puppeteer')).default;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle'],
    ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {})
  });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.text()} ${msg.location()?.url || ''}`.trim());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.viewer?.modulesGroup?.children.length > 0 &&
      document.getElementById('plan-name')?.textContent !== 'Loading...', { timeout: 60000, polling: 250 });
  } catch (err) {
    throw new Error(`built app did not load its default plan: ${err.message}\n  page errors: ${pageErrors.join(' | ') || 'none'}`);
  }
  const state2 = await page.evaluate(() => ({
    plan: document.getElementById('plan-name').textContent,
    modules: window.viewer.modulesGroup.children.length,
    popup: !!document.getElementById('missing-assets-modal'),
    assetsMissing: window.viewer.gameAssetsMissing
  }));
  assert.deepStrictEqual(pageErrors, [], `uncaught errors in the built app: ${pageErrors.join(' | ')}`);
  assert.deepStrictEqual(consoleErrors, [], `console errors in the built app: ${consoleErrors.join(' | ')}`);
  assert.ok(state2.modules > 0, 'default plan has modules');
  const icon = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="icon"]')?.href;
    if (!href) return { href: null };
    const r = await fetch(href);
    return { href, status: r.status, type: r.headers.get('content-type') };
  });
  assert.ok(icon.href && icon.status === 200 && /svg/.test(icon.type || ''), `favicon served from the build: ${JSON.stringify(icon)}`);
  assert.strictEqual(state2.popup, true, 'missing-assets pop-up shown (a build has no game assets)');
  assert.strictEqual(state2.assetsMissing, true, 'viewer knows the assets are missing');
  console.log(`  ✓ built app starts without errors and loads "${state2.plan}" (${state2.modules} placeholder modules)`);
  console.log('  ✓ missing-assets pop-up shown');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log('\n[PASS] test_build_smoke');
