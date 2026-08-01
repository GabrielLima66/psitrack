import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'electron/main')
    }
  }
})
