import { defineConfig } from 'vite';

export default defineConfig({
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
      ignored: ['**/assets/**', '**/assests1/**', '**/assests1_up/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
