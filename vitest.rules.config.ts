import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.rules.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
})
