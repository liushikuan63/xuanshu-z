// 统一「六壬」→「大六壬」（避开已是大六壬、小六壬的情形）；
// 替换规则：把「六壬」前面不是「大」的补上「大」。
// 注意：会同时把「小六壬」→ ？不会，因为「小六壬」里前一个字符是「小」，不是「大」；需要额外保护：前一个字符是「小」不替换。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'packages/intake/src/playbooks.ts',
  'packages/knowledge/src/books.ts',
  'packages/ui/src/components.tsx',
  'packages/ui/src/boards.tsx',
  'packages/knowledge/src/termTeach.ts',
  'packages/knowledge/src/glossary.ts',
  'packages/ui/src/IntakeWizard.tsx',
  'packages/core/src/config/types.ts',
  'packages/core/src/calendar/normalize.ts',
  'packages/ui/src/state.tsx',
  'packages/ui/src/styles.css',
  'packages/core/src/arts/jingpi.ts',
  'packages/ui/src/WelcomeGuide.tsx',
  'packages/ui/src/ProCast.tsx',
  'packages/core/src/arts/xiaoliuren/engine.ts',
  'packages/core/src/arts/liuren/engine.ts',
  'apps/web/index.html',
  'tests/engage.test.ts',
  'tests/engine.test.ts',
  'tests/jingpi-audit.test.ts',
  'tests/smoke.test.ts',
];

// 逐字扫描：凡遇到「六壬」且前一字符不是「大」也不是「小」，把「六」前插「大」
function fix(text) {
  const chars = [...text];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '六' && chars[i + 1] === '壬') {
      const prev = out[out.length - 1] ?? '';
      if (prev !== '大' && prev !== '小') out.push('大');
    }
    out.push(chars[i]);
  }
  return out.join('');
}

let total = 0;
for (const rel of files) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log('SKIP', rel); continue; }
  const raw = fs.readFileSync(fp, 'utf8');
  const next = fix(raw);
  const replaced = (next.match(/大六壬/g) ?? []).length;
  if (next !== raw) {
    fs.writeFileSync(fp, next, 'utf8');
    total++;
    console.log(`OK   ${rel}（大六壬 ${replaced} 处）`);
  } else {
    console.log('SAME', rel);
  }
}
console.log(`\n共修改 ${total} 个源文件`);