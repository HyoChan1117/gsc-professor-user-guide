import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api 요청은 백엔드(backend/, 기본 8787 포트)로 전달
const api = { '/api': { target: 'http://localhost:8787', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
});
