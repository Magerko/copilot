import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias },
    build: { externalizeDeps: true, rollupOptions: { external: ['node:sqlite'] } }
  },
  preload: {
    resolve: { alias },
    build: { externalizeDeps: true }
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          picker: resolve(__dirname, 'src/renderer/picker.html')
        }
      }
    }
  }
})
