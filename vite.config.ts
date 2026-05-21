import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      // followRedirects handles the /pragna → /pragna/ trailing-slash redirect
      // that the backend issues, keeping the request server-side and avoiding CORS.
      '/pragna': { target: 'http://localhost:8000', changeOrigin: true, followRedirects: true },
    },
  },
});
