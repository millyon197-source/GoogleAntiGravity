import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@x4/domain': path.resolve(__dirname, 'packages/domain/src/index.js'),
      '@x4/application': path.resolve(__dirname, 'packages/application/src/index.js'),
      '@x4/adapter-xml': path.resolve(__dirname, 'packages/adapter-xml/src/index.js')
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
      ignored: ['**/assets/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three/examples') || id.includes('three\\examples')) {
            return 'three-addons';
          }
          if (id.includes('node_modules/three')) {
            return 'three-core';
          }
          if (
            id.includes('snap-points-db') ||
            id.includes('modules-cost-db') ||
            id.includes('dae_hash_table') ||
            id.includes('module-bounds-hashtable')
          ) {
            return 'x4-databases';
          }
          if (id.includes('samples.js')) {
            return 'x4-samples';
          }
          if (id.includes('blueprint-exporter.js')) {
            return 'blueprint-exporter';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
});
