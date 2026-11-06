import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@x4/domain': path.resolve(__dirname, 'packages/domain/src/index.js'),
      '@x4/application': path.resolve(__dirname, 'packages/application/src/index.js'),
      '@x4/adapter-xml': path.resolve(__dirname, 'packages/adapter-xml/src/index.js'),
      '@x4/adapter-three': path.resolve(__dirname, 'packages/adapter-three/src/index.js'),
      '@x4/catalog': path.resolve(__dirname, 'packages/catalog/src/index.js')
    }
  },
  plugins: [
    {
      name: 'vsc-logger',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/api/log')) {
            const url = new URL(req.url, 'http://localhost');
            const msg = url.searchParams.get('msg') || '';
            const type = url.searchParams.get('type') || 'log';
            if (type === 'warn') {
              console.warn(msg);
            } else if (type === 'error') {
              console.error(msg);
            } else {
              console.log(msg);
            }
            res.statusCode = 200;
            res.end('ok');
          } else if (req.url.startsWith('/api/save-snap-points') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const filePath = path.resolve(__dirname, 'packages/catalog/src/custom-snap-points.json');
                let existing = {};
                if (fs.existsSync(filePath)) {
                  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {}
                }
                const updated = { ...existing, ...data };
                fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, table: updated }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } else if (req.url.startsWith('/api/module-asset-files')) {
            // Lists the .dae component files inside a module's asset folder
            // (e.g. /assets1/structures/production/prod_gen_energycells_data)
            res.setHeader('Content-Type', 'application/json');
            try {
              const url = new URL(req.url, 'http://localhost');
              const folder = (url.searchParams.get('folder') || '').replace(/^\/+/, '');
              const assetsRoot = path.resolve(__dirname, 'assets1');
              const absFolder = path.resolve(__dirname, folder);
              if (!absFolder.startsWith(assetsRoot + path.sep) || !fs.existsSync(absFolder)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ files: [] }));
                return;
              }
              const files = fs.readdirSync(absFolder)
                .filter(f => f.toLowerCase().endsWith('.dae'))
                .sort();
              res.end(JSON.stringify({ files }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message, files: [] }));
            }
          } else if (req.url.startsWith('/api/load-custom-snap-points')) {
            const filePath = path.resolve(__dirname, 'packages/catalog/src/custom-snap-points.json');
            res.setHeader('Content-Type', 'application/json');
            if (fs.existsSync(filePath)) {
              res.end(fs.readFileSync(filePath, 'utf8'));
            } else {
              res.end('{}');
            }
          } else if (req.url.startsWith('/textures/') || req.url.startsWith('/assets1/textures/') || req.url.startsWith('/assets/textures/')) {
            const relUrl = req.url.replace(/^\/(?:assets1?\/)?textures\//, '').split('?')[0];
            const localPath = path.resolve(__dirname, 'assets1/textures', relUrl);
            const localGzPath = localPath.replace(/\.dds$/i, '.gz');
            const gameTexturesBase = 'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\assets\\textures';
            const steamGzPath = path.resolve(gameTexturesBase, relUrl.replace(/\.dds$/i, '.gz'));

            if (fs.existsSync(localPath)) {
              res.setHeader('Content-Type', 'image/x-dds');
              fs.createReadStream(localPath).pipe(res);
              return;
            }

            const candidateGz = fs.existsSync(localGzPath) ? localGzPath : (fs.existsSync(steamGzPath) ? steamGzPath : null);
            if (candidateGz) {
              try {
                const decomp = zlib.gunzipSync(fs.readFileSync(candidateGz));
                fs.mkdirSync(path.dirname(localPath), { recursive: true });
                fs.writeFileSync(localPath, decomp);
                res.setHeader('Content-Type', 'image/x-dds');
                res.end(decomp);
                return;
              } catch (_) {}
            }
            next();
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: [
        '**/assets/**',
        '**/packages/catalog/src/custom-snap-points.json',
        '**/custom-snap-points.json',
        '**/src/part-main-offsets.json'
      ]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite 8 bundles with Rolldown; codeSplitting groups replace Rollup's manualChunks.
    // includeDependenciesRecursively is off so the addons group does not pull three's core
    // (which every addon imports) into itself. Higher priority wins.
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'three-addons', test: /node_modules[\\/]three[\\/]examples[\\/]/, priority: 30 },
            { name: 'three-core', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'x4-databases', test: /snap-points-db|modules-cost-db|dae_hash_table|module-bounds-hashtable/, priority: 10 },
            { name: 'x4-samples', test: /[\\/]samples\.js$/, priority: 10 },
            { name: 'blueprint-exporter', test: /blueprint-exporter\.js$/, priority: 10 }
          ]
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
});
