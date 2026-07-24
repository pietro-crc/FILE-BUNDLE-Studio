import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname, 'spikes/browser'),
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist-spikes'),
    emptyOutDir: true,
    sourcemap: true,
  },
})
