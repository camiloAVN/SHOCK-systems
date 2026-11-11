import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Pruebas de lógica pura (sin base de datos ni servidor). Ejecutar con: npm test
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
