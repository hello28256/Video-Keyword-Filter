import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// WHY: 镜像 tsconfig 的 path alias，让单测里 import '#utils/foo' 指向同一文件。
// WHY: jsdom 环境让 adapter/scanner/observer 测试不需要真浏览器。
export default defineConfig({
  resolve: {
    alias: {
      '#core': resolve(__dirname, './core'),
      '#utils': resolve(__dirname, './utils'),
      '#types': resolve(__dirname, './types'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
