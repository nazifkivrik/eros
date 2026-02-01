import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    // SWC plugin for fast TypeScript transformation
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],
    singleThread: true,
    maxThreads: 1,
    minThreads: 1,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/interfaces/**',
        'src/modules/**',
        'src/migrations/**',
      ],
      all: true,
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/application': resolve(__dirname, './src/application'),
      '@/infrastructure': resolve(__dirname, './src/infrastructure'),
      '@/interfaces': resolve(__dirname, './src/interfaces'),
      '@/modules': resolve(__dirname, './src/modules'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/jobs': resolve(__dirname, './src/application/jobs'),
      '@/services': resolve(__dirname, './src/application/services'),
      '@/repositories': resolve(__dirname, './src/infrastructure/repositories'),
      '@/adapters': resolve(__dirname, './src/infrastructure/adapters'),
    },
  },
});
