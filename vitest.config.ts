import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 15000 }
})
