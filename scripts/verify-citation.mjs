#!/usr/bin/env node
/**
 * 引用回链校验：把八术规则引擎实际产出的 CitationRef
 * 与知识库语料（data/.kb/books 下各 corpus.jsonl）对账。
 * 用法: node scripts/verify-citation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = path.join(ROOT, 'data', '.kb', 'books');

// ---- 载入语料 ----
const segs = [];
const segIds = new Set();
const chapterKeys = new Set();
for (const d of fs.readdirSync(KB)) {
  const f = path.join(KB, d, 'corpus.jsonl');
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    segs.push(o);
    segIds.add(o.segId);
    chapterKeys.add(`${o.canonical_id}|${o.chapter}`);
  }
}

// ---- 采集引擎 CitationRef（vitest 专用测试 + 环境变量输出）----
const outFile = path.join(ROOT, '.tmp-corpus', 'citations.json');
try {
  execSync('node node_modules/vitest/vitest.mjs run tests/citation-collect.test.ts --reporter=basic', {
    cwd: ROOT, stdio: 'pipe', env: { ...process.env, XUANSHU_CITATION_OUT: outFile },
  });
} catch (e) {
  console.error('✗ 无法运行采集测试：', String(e.stderr || e.message).slice(0, 300));
  process.exit(1);
}

// ---- 对账（与运行时 locate 降级链一致：segId → 章节 → 引文精确匹配）----
const refs = JSON.parse(fs.readFileSync(outFile, 'utf8'));
let segHit = 0, chapHit = 0;
const miss = [];
for (const r of refs) {
  if (r.segId && segIds.has(r.segId)) { segHit++; continue; }
  const key = `${r.canonicalId}|${r.chapter}`;
  if (chapterKeys.has(key)) { chapHit++; continue; }
  const hit = segs.some((s) => s.canonical_id === r.canonicalId && r.quote && r.quote.length > 6 && s.text.includes(r.quote.slice(1, 12)));
  if (hit) chapHit++;
  else miss.push(r);
}
console.log(`引用对账: ${refs.length} 条唯一引用 → segId 命中 ${segHit} / 章节命中 ${chapHit}`);
if (miss.length) {
  console.log(`未命中 ${miss.length} 条（将走 D28 kb-gap 降级）：`);
  for (const m of miss.slice(0, 20)) console.log(`  - ${m.canonicalId}《${m.book}》${m.chapter} [${m.confidenceLevel}]`);
  // D/E 级（民间口诀）允许无语料，属预期降级；A/B 级必须可回链
  const hardMiss = miss.filter((m) => m.confidenceLevel === 'A' || m.confidenceLevel === 'B');
  if (hardMiss.length) {
    console.log(`✗ 其中 A/B 级 ${hardMiss.length} 条必须可回链`);
    process.exit(1);
  }
  console.log('✓ A/B 级引用全部可回链；D/E 级按降级约定记录 kb-gap');
} else {
  console.log('✓ 全部引用可回链到语料');
}
