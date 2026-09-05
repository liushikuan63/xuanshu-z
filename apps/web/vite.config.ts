import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@xuanshu/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@xuanshu/ledger': path.resolve(__dirname, '../../packages/ledger/src/index.ts'),
      '@xuanshu/intake': path.resolve(__dirname, '../../packages/intake/src/index.ts'),
      '@xuanshu/answer': path.resolve(__dirname, '../../packages/answer/src/index.ts'),
      '@xuanshu/reader': path.resolve(__dirname, '../../packages/reader/src/index.ts'),
      '@xuanshu/knowledge': path.resolve(__dirname, '../../packages/knowledge/src/index.ts'),
      '@xuanshu/ai': path.resolve(__dirname, '../../packages/ai/src/index.ts'),
      '@xuanshu/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  build: {
    target: 'es2020',
    // 最大块是单本离线古籍数据，不是首屏业务代码；入口与 UI 已独立拆分。
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 基础框架层：React 生态
          if (id.includes('node_modules/react') || id.includes('node_modules\\react')) return 'react';
          if (id.includes('dexie')) return 'dexie';
          // 算法引擎层：日历/紫微排盘库
          if (id.includes('iztro') || id.includes('lunar-javascript')) return 'engines';
          // 业务领域层1：核心排盘计算引擎
          if (id.includes('packages/core/')) return 'engines';
          // 业务领域层2：知识库(800+术语Glossary) + 起卦向导/答案/记录
          if (id.includes('packages/knowledge/')) return 'knowledge';
          if (id.includes('packages/ledger/') || id.includes('packages/intake/') || id.includes('packages/answer/') || id.includes('packages/reader/') || id.includes('packages/ai/')) return 'apps';
          // 业务领域层3：UI大组件(boards.tsx 单文件极大) 单独分块；
          // state.tsx（useApp/AppProvider）被 boards 依赖，并入同块打破 circular chunk；
          // castShared（城市经度/runCast）被 boards 与 ProCast/IntakeWizard 共用 → 独立小块阻断环
          if (id.includes('packages/ui/src/castShared')) return 'ui-shared';
          if (id.includes('packages/ui/src/boards') || id.includes('packages/ui/src/state')) return 'ui-boards';
          if (id.includes('packages/ui/')) return 'ui';
          return undefined;
        },
      },
    },
  },
  worker: { format: 'es' },
  server: { port: 5190, strictPort: false },
});
