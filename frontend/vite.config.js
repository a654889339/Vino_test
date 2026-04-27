import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@cos_base': fileURLToPath(new URL('../common/frontend/cos_base', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5201,
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5202',
        changeOrigin: true,
      },
    },
  },
});
