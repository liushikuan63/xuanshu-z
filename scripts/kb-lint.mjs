#!/usr/bin/env node
/**
 * 知识库语料校验（docs/corpus-spec.md）
 * 用法: node scripts/kb-lint.mjs [dataDir]
 * 退出码: 0 全部通过 / 1 存在错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(ROOT, process.argv[2] || 'data/.kb/books');
const VARIANTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8')); // 异体字→正字
const VAR_RE = new RegExp('[' + Object.keys(VARIANTS).map(c => '\\u{' + c.codePointAt(0).toString(16) + '}').join('') + ']', 'gu');
const foldVariants = (t) => t.replace(VAR_RE, ch => VARIANTS[ch] ?? ch);
const SPEC_FIELDS = [
  'canonical_id', 'title', 'author', 'edition', 'publication_date', 'source_url',
  'access_date', 'license', 'volume', 'chapter', 'section', 'seq', 'segId', 'text',
  'normalized_text', 'charRange', 'tags', 'annotations', 'transcription_confidence',
  'isPublicDomain', 'confidence_level',
];
const LEVELS = new Set(['A', 'B', 'C', 'D', 'E']);
const ARTS = new Set(['bazi', 'liuyao', 'meihua', 'ziwei', 'qimen', 'liuren', 'xiaoliuren', 'jinkou', 'calendar']);

let errors = 0;
let warns = 0;
let shortSegments = 0;
const MAX_DETAILS = 40;
const fail = (m) => { if (errors < MAX_DETAILS) console.error('  ✗', m); errors++; };
const warn = (m) => { if (warns < MAX_DETAILS) console.warn('  ⚠', m); warns++; };
const looksMojibake = (text) => /(?:[ÃÂ]|[äåæçéè])[\u0080-\u00bf]/u.test(text ?? '');

if (!fs.existsSync(DATA)) {
  console.error(`✗ 目录不存在: ${DATA}`);
  process.exit(1);
}
const books = fs.readdirSync(DATA).filter((d) => fs.statSync(path.join(DATA, d)).isDirectory());
const manifestPath = path.join(DATA, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
if (!manifest) fail('缺少 manifest.json');
const totalSegs = [];
let bookCount = 0;
const seenSegIds = new Set();

for (const cid of books) {
  const dir = path.join(DATA, cid);
  const jsonl = path.join(dir, 'corpus.jsonl');
  const meta = path.join(dir, 'meta.json');
  if (!fs.existsSync(jsonl)) { fail(`${cid}: 缺 corpus.jsonl`); continue; }
  if (!fs.existsSync(meta)) fail(`${cid}: 缺 meta.json`);
  bookCount++;
  const lines = fs.readFileSync(jsonl, 'utf8').split('\n').filter((l) => l.trim());
  if (!lines.length) fail(`${cid}: corpus.jsonl 为空`);
  let lastVol = '';
  const chSeen = new Set();
  for (const [i, line] of lines.entries()) {
    let o;
    try { o = JSON.parse(line); } catch { fail(`${cid} 第${i + 1}行 JSON 解析失败`); continue; }
    const where = `${cid}/${o.segId || '第' + (i + 1) + '行'}`;
    for (const f of SPEC_FIELDS) if (!(f in o)) fail(`${where}: 缺字段 ${f}`);
    if (o.canonical_id !== cid) fail(`${where}: canonical_id 不一致`);
    // 新格式 canonical.chapter.segment；历史导入格式 canonical.sequence 继续兼容，均由全局唯一性兜底。
    if (!/^[\w-]+\.(?:\d+\.\d+|\d+)$/.test(o.segId || '')) fail(`${where}: segId 格式错误`);
    if (seenSegIds.has(o.segId)) fail(`${where}: segId 重复`);
    seenSegIds.add(o.segId);
    if (!o.text || o.text.length > 260) fail(`${where}: 段长越界 (${o.text?.length})`);
    else if (o.text.length < 40) shortSegments++;
    if (looksMojibake(o.text)) fail(`${where}: 疑似 UTF-8 误解码乱码`);
    if (o.normalized_text !== foldVariants(o.text).replace(/\s+/g, '')) fail(`${where}: normalized_text 与 text 不一致（异体归一+去空白）`);
    if (!Array.isArray(o.charRange) || o.charRange[0] !== 0 || o.charRange[1] !== o.text.length) fail(`${where}: charRange 错误`);
    if (!LEVELS.has(o.confidence_level)) fail(`${where}: confidence_level 非法`);
    if (typeof o.transcription_confidence !== 'number' || o.transcription_confidence <= 0 || o.transcription_confidence > 1) fail(`${where}: transcription_confidence 非法`);
    if (o.isPublicDomain !== true) fail(`${where}: 非公有领域语料不允许入库`);
    if (!/公有领域|public domain/i.test(o.license || '')) fail(`${where}: license 标注异常`);
    if (!Array.isArray(o.tags) || !o.tags.every((t) => ARTS.has(t))) fail(`${where}: tags 含非法 art 值`);
    // 段序号应从 1 连续递增（同章内）
    const m = (o.segId || '').match(/\.(\d+)\.(\d+)$/);
    if (m) {
      const [, ch, seg] = m.map(Number);
      const key = `${cid}.${ch}`;
      if (seg === 1 && chSeen.has(key)) warn(`${where}: 章号 ${ch} 重新开始`);
      chSeen.add(key);
    }
    if (o.volume) lastVol = o.volume;
  }
  totalSegs.push([cid, lines.length]);
  if (manifest && !manifest.books.some((b) => b.canonical_id === cid)) warn(`${cid}: 未登记于 manifest.json`);
}

if (manifest) {
  for (const b of manifest.books || []) {
    if (!books.includes(b.canonical_id)) fail(`manifest 引用不存在的书: ${b.canonical_id}`);
  }
}

console.log(`\n校验 ${bookCount} 本书 / ${totalSegs.reduce((s, [, n]) => s + n, 0)} 段`);
for (const [cid, n] of totalSegs) console.log(`  ${cid.padEnd(18)} ${n} 段`);
console.log(errors ? `\n✗ ${errors} 个错误` : '✓ 全部通过');
if (errors > MAX_DETAILS) console.error(`  仅展示前 ${MAX_DETAILS} 条错误；其余 ${errors - MAX_DETAILS} 条已省略`);
if (shortSegments) warn(`${shortSegments} 个短段（<40 字）按古籍短句/韵文保留`);
if (warns) console.warn(`⚠ ${warns} 个警告`);
process.exit(errors ? 1 : 0);
