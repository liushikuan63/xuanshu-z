#!/usr/bin/env node
/**
 * 将浏览器中核验过的公开古籍正文从 stdin 导入离线语料库。
 *
 * 用法示例：
 *   Get-Clipboard -Raw | node scripts/import-browser-corpus.mjs \
 *     --cid changshi-wuji --title "苌氏武技书" --author "苌乃周（清）" \
 *     --source-url "https://zh.wikisource.org/wiki/萇氏武技書" \
 *     --source-name "维基文库·苌氏武技书"
 *
 * 浏览器只负责访问和人工核验来源；本脚本负责确定性清洗、切段和清单更新。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', '.kb', 'books');
const TODAY = new Date().toISOString().slice(0, 10);
const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });
const variants = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8'));
const variantPattern = Object.keys(variants).map((char) => `\\u{${char.codePointAt(0).toString(16)}}`).join('');
const variantRe = new RegExp(`[${variantPattern}]`, 'gu');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) throw new Error(`参数格式错误：${key ?? '(空)'}`);
    args[key.slice(2)] = value;
  }
  for (const required of ['cid', 'title', 'author', 'source-url', 'source-name']) {
    if (!args[required]) throw new Error(`缺少参数 --${required}`);
  }
  return args;
}

function readStdin(inputPath) {
  if (inputPath) return Promise.resolve(fs.readFileSync(path.resolve(ROOT, inputPath), 'utf8'));
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function normalize(text) {
  return toSimplified(text)
    .replace(variantRe, (char) => variants[char] ?? char)
    .replace(/\r/g, '')
    .replace(/[ \t　]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isFurniture(line) {
  return /^(?:作者：|版本信息|姊妹计划|下载|分类：|此页面最后编辑|本站的全部文字|知识共享|Wikisource)/.test(line)
    || /^(?:作品|讨论|阅读|编辑|查看历史|工具|打印\/导出)$/.test(line);
}

function splitLong(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > 260) {
    let cut = -1;
    for (let index = 259; index >= 150; index -= 1) {
      if ('。！？；'.includes(rest[index])) {
        cut = index + 1;
        break;
      }
    }
    if (cut < 0) cut = 220;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function segment(raw, chapterPattern, startAt, endBefore) {
  const chapterRe = chapterPattern ? new RegExp(chapterPattern) : null;
  const segments = [];
  let chapter = '正文';
  let buffer = '';
  let source = normalize(raw);

  if (startAt) {
    const start = source.indexOf(startAt);
    if (start < 0) throw new Error(`未找到正文起点：${startAt}`);
    source = source.slice(start);
  }
  if (endBefore) {
    const end = source.indexOf(endBefore);
    if (end < 0) throw new Error(`未找到正文终点：${endBefore}`);
    source = source.slice(0, end);
  }

  const flush = () => {
    const text = buffer.replace(/\s+/g, '').trim();
    buffer = '';
    if (text.length < 24) return;
    for (const chunk of splitLong(text)) segments.push({ chapter, text: chunk });
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim().replace(/编辑$/, '');
    if (!line || isFurniture(line)) continue;
    if (chapterRe?.test(line) && line.length <= 40) {
      flush();
      chapter = line.slice(0, 40);
      continue;
    }
    buffer += line;
    if (buffer.length >= 180 && /[。！？；]$/.test(line)) flush();
  }
  flush();
  return segments;
}

function updateManifest(cid, title, art, count) {
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const record = { canonical_id: cid, title, art, segment_count: count };
  const index = manifest.books.findIndex((book) => book.canonical_id === cid);
  if (index >= 0) manifest.books[index] = record;
  else manifest.books.push(record);
  manifest.books.sort((left, right) => left.canonical_id.localeCompare(right.canonical_id));
  manifest.generated_at = TODAY;
  manifest.total_books = manifest.books.length;
  manifest.total_segments = manifest.books.reduce((sum, book) => sum + book.segment_count, 0);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readStdin(args.input);
  if (raw.trim().length < 100) throw new Error(`stdin 正文过短（${raw.trim().length} 字）`);

  const art = (args.art ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const segments = segment(raw, args['chapter-pattern'], args['start-at'], args['end-before']);
  if (segments.length < 1) throw new Error('没有生成有效语料段');

  const license = args.license ?? '原作公有领域；电子文本 CC BY-SA 4.0';
  const confidence = Number(args.confidence ?? '0.9');
  const rows = segments.map((segmentItem, index) => {
    const text = segmentItem.text;
    return {
      canonical_id: args.cid,
      title: args.title,
      author: args.author,
      edition: args['source-name'],
      publication_date: args['publication-date'] ?? '',
      source_url: args['source-url'],
      access_date: TODAY,
      license,
      volume: '',
      chapter: segmentItem.chapter,
      section: '',
      seq: index + 1,
      segId: `${args.cid}.${index + 1}`,
      text,
      normalized_text: text.replace(/\s+/g, ''),
      charRange: [0, text.length],
      tags: art,
      annotations: '',
      transcription_confidence: confidence,
      isPublicDomain: true,
      confidence_level: args.level ?? 'A',
    };
  });

  const bookDir = path.join(OUT, args.cid);
  fs.mkdirSync(bookDir, { recursive: true });
  fs.writeFileSync(path.join(bookDir, 'corpus.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(bookDir, 'meta.json'), `${JSON.stringify({
    canonical_id: args.cid,
    title: args.title,
    author: args.author,
    edition: args['source-name'],
    publication_date: args['publication-date'] ?? '',
    license,
    art,
    source_urls: [args['source-url']],
    segment_count: rows.length,
    collected_at: TODAY,
    confidence: args.level ?? 'A',
    source_note: args['source-note'] ?? '浏览器核验来源后导入；繁体转简体并按句切段，未改写原文。',
  }, null, 2)}\n`, 'utf8');
  updateManifest(args.cid, args.title, art, rows.length);
  console.log(`OK ${args.cid}：${rows.length} 段，${rows.reduce((sum, row) => sum + row.text.length, 0)} 字`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
