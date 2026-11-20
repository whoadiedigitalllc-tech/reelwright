// Web build: `npm run web:dev` / `npm run web:build` -> dist-web/ (static files, any host).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: 'src/web',
  base: './',
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('dist-web', import.meta.url)), emptyOutDir: true, target: 'es2022' },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] }, // its worker must not be pre-bundled
  server: { fs: { allow: ['..'] } },
  preview: { port: 4173, strictPort: true }
})
