#!/usr/bin/env node
/**
 * 每日吉向生成（D4）：离线按当日干支推算黄道吉时/建除/日空亡，输出 Markdown。
 *  推算核心与 App 内「今日吉向」共用 @xuanshu/core 的 dailyAdvice 纯函数。
 *  使用：node scripts/daily-advice.mjs [--dir=<输出目录>]（默认桌面）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

// 用 esbuild 将 @xuanshu/core 源码（TS）打包为单文件内存模块后加载
const esm = await build({
  entryPoints: ['packages/core/src/index.ts'],
  bundle: true, format: 'esm', platform: 'node', logLevel: 'error',
  write: false,
});
const moduleCache = '__xuanshu_core_bundle.mjs';
const { writeFile } = await import('node:fs/promises');
const outFile = path.join(os.tmpdir(), moduleCache);
await writeFile(outFile, esm.outputFiles[0].text, 'utf8');
const core = await import('file:///' + outFile.replaceAll('\\', '/') + '?t=' + Date.now());

const outDir = (() => {
  const a = process.argv.find(s => s.startsWith('--dir='));
  return a ? a.slice(6) : path.join(os.homedir(), 'Desktop');
})();

const text = core.dailyAdviceMarkdown(new Date());
const file = path.join(outDir, `今日吉向_${new Date().toISOString().slice(0, 10)}.md`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(file, text + '\n', 'utf8');
console.log('已生成今日吉向 → ' + file);
console.log(text.split('\n').slice(0, 8).join('\n'));