import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

const configuredBase = process.env.VITE_BASE_PATH?.trim()

export default defineConfig({
  base: configuredBase && configuredBase.length > 0 ? configuredBase : '/',
  plugins: [react(), cloudflare()],
  build: {
    sourcemap: false,
    reportCompressedSize: true,
    ...(process.env.VITE_INLINE_DYNAMIC_IMPORTS === 'true'
      ? { rolldownOptions: { output: { codeSplitting: false } }, chunkSizeWarningLimit: 1000 }
      : {}),
  },
})