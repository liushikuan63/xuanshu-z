import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@xuanshu/core': r('./packages/core/src/index.ts'),
      '@xuanshu/ledger': r('./packages/ledger/src/index.ts'),
      '@xuanshu/intake': r('./packages/intake/src/index.ts'),
      '@xuanshu/answer': r('./packages/answer/src/index.ts'),
      '@xuanshu/reader': r('./packages/reader/src/index.ts'),
      '@xuanshu/knowledge': r('./packages/knowledge/src/index.ts'),
      '@xuanshu/ai': r('./packages/ai/src/index.ts'),
      '@xuanshu/ui': r('./packages/ui/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
