import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
