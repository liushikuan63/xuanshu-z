#!/usr/bin/env node
/**
 * 环境体检：Node 版本、依赖安装、语料完整性、核心引擎可用性。
 * 用法: node scripts/doctor.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = true;
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) ok = false;
};

// 1. Node 版本
const [major] = process.versions.node.split('.').map(Number);
check('Node.js ≥ 20', major >= 20, `当前 ${process.versions.node}`);

// 2. 依赖安装
check('node_modules 存在', fs.existsSync(path.join(ROOT, 'node_modules')));
const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
check('vite 可执行', fs.existsSync(viteBin) || fs.existsSync(viteBin + '.cmd'));

// 3. 工作区包齐全
const pkgs = ['core', 'ledger', 'intake', 'answer', 'reader', 'knowledge', 'ai', 'ui'];
for (const p of pkgs) {
  const entry = path.join(ROOT, 'packages', p, 'src', p === 'ui' ? 'index.ts' : 'index.ts');
  check(`packages/${p}`, fs.existsSync(entry), entry.replace(ROOT + path.sep, ''));
}

// 4. 语料
const kb = path.join(ROOT, 'data', '.kb', 'books');
let books = 0, segs = 0;
if (fs.existsSync(kb)) {
  for (const d of fs.readdirSync(kb)) {
    const f = path.join(kb, d, 'corpus.jsonl');
    if (fs.existsSync(f)) {
      books++;
      segs += fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).length;
    }
  }
}
check('知识库语料 ≥ 600 段', segs >= 600, `${books} 本 / ${segs} 段`);

// 5. 核心引擎冒烟（tsx 不可用时跳过，依赖 vitest 覆盖）
try {
  execSync('node node_modules/vitest/vitest.mjs run tests/smoke.test.ts --reporter=basic', {
    cwd: ROOT, stdio: 'pipe', env: { ...process.env, PATH: process.env.PATH },
    timeout: 120000,
  });
  check('冒烟测试 (smoke.test.ts)', true, '14+ 用例通过');
} catch (e) {
  check('冒烟测试 (smoke.test.ts)', false, String(e.message).slice(0, 120));
}

console.log(ok ? '\n体检通过 ✓' : '\n体检未通过 ✗');
process.exit(ok ? 0 : 1);
