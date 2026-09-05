// 全库简体化：遍历 data/.kb/books/*/corpus.jsonl，将 text 字段用 opencc(hk→cn) 转简体并修正「乾」卦误转
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', '.kb', 'books');
const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });

function fixQian(t) {
  // opencc hk→cn 按「干湿」音把卦名「乾」误转「干」：常见语境词后必为「乾」卦
  return t
    .replace(/干(?=上|下|刚|为|务|象|卦|首|三|初|吉|悔|亢|利|用|始)/g, '乾')
    .replace(/干干/g, '乾乾')
    .replace(/䷀干/g, '䷀乾');
}

let totalChanged = 0, totalBooks = 0;
for (const d of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const fp = path.join(DIR, d.name, 'corpus.jsonl');
  if (!fs.existsSync(fp)) continue;
  totalBooks++;
  const lines = fs.readFileSync(fp, 'utf8').split('\n').filter(l => l.trim());
  let changed = 0, out = [];
  for (const line of lines) {
    const o = JSON.parse(line);
    const s = fixQian(toSimplified(o.text ?? ''));
    if (s !== (o.text ?? '')) { o.text = s; o.normalized_text = s; changed++; }
    out.push(JSON.stringify(o));
  }
  if (changed > 0) {
    fs.writeFileSync(fp, out.join('\n') + '\n', 'utf8');
    totalChanged += changed;
    console.log(`  ${d.name}: ${changed} 段已转简`);
  }
}
console.log(`\n完成：${totalBooks} 部扫描，${totalChanged} 段转简`);