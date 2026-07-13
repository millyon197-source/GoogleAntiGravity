import { defineConfig } from 'vite';

export default defineConfig({
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
