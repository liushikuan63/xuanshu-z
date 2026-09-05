#!/usr/bin/env node
/**
 * 玩法手册（playbook）完整性校验：
 *  - 每个 playbook 九个必备 section 齐全
 *  - playbookFor 对 14 类求测 × 支持术覆盖
 *  - 引用的 canonicalId 均已入库
 * 用法: node scripts/verify-playbook.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 用 vitest 跑采集测试，导出 playbooks 摘要
const { execSync } = await import('node:child_process');
const out = path.join(ROOT, '.tmp-corpus', 'playbooks.json');
try {
  execSync('node node_modules/vitest/vitest.mjs run tests/playbook-collect.test.ts --reporter=basic', {
    cwd: ROOT, stdio: 'pipe', env: { ...process.env, XUANSHU_PLAYBOOK_OUT: out },
  });
} catch (e) {
  console.error('✗ 采集测试失败：', String(e.stderr || e.message).slice(0, 300));
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(out, 'utf8'));
const REQUIRED_SECTIONS = data.requiredSections;
let errors = 0;
for (const pb of data.playbooks) {
  const missing = REQUIRED_SECTIONS.filter((s) => !pb.sections.includes(s));
  if (missing.length) { errors++; console.error(`✗ ${pb.id}: 缺 section ${missing.join('/')}`); }
  for (const c of pb.canonicalIds || []) {
    if (!data.corpusCanonicalIds.includes(c)) { errors++; console.error(`✗ ${pb.id}: 引用未入库 ${c}`); }
  }
}
// 覆盖率：每个 ART_CATEGORIES 中的类目至少有一个 playbook 可推荐
const uncovered = data.categories.filter((c) => !data.categoryCoverage.includes(c));
if (uncovered.length) { errors++; console.error(`✗ 求测类目未覆盖: ${uncovered.join(', ')}`); }

console.log(`\nplaybooks: ${data.playbooks.length} 篇`);
if (errors) { console.log(`✗ ${errors} 个问题`); process.exit(1); }
console.log('✓ 手册结构与类目覆盖全部通过');
