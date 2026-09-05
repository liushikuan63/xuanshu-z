#!/usr/bin/env node
/** 确定性修复语料派生字段与可逆 UTF-8 误解码；默认仅预览，--write 才落盘。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', '.kb', 'books');
const write = process.argv.includes('--write');
const variants = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8'));
const variantRe = new RegExp('[' + Object.keys(variants).map(char => `\\u{${char.codePointAt(0).toString(16)}}`).join('') + ']', 'gu');
const foldVariants = text => text.replace(variantRe, char => variants[char] ?? char).replace(/\s+/g, '');
const looksMojibake = text => /(?:[ÃÂ]|[äåæçéè])[\u0080-\u00bf]/u.test(text ?? '');
const cjkCount = text => (text.match(/[\u3400-\u9fff]/gu) ?? []).length;

function decodeMojibake(text) {
  if (!looksMojibake(text)) return text;
  const decoded = Buffer.from(text, 'latin1').toString('utf8');
  const replacementCount = (decoded.match(/\uFFFD/gu) ?? []).length;
  if (cjkCount(decoded) <= cjkCount(text) || cjkCount(decoded) < 2 || replacementCount > decoded.length * 0.4) return text;
  // 源站若已经丢失个别字节无法还原，以校勘惯用缺字框明确标记，避免继续展示整段乱码。
  return decoded.replace(/\uFFFD+/gu, '□');
}

let changedBooks = 0;
let changedRows = 0;
let decodedRows = 0;
let normalizedRows = 0;
let rangeRows = 0;

for (const canonicalId of fs.readdirSync(DATA)) {
  const corpusPath = path.join(DATA, canonicalId, 'corpus.jsonl');
  if (!fs.existsSync(corpusPath)) continue;
  const original = fs.readFileSync(corpusPath, 'utf8');
  let bookChanged = false;
  const lines = original.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const item = JSON.parse(line);
    let rowChanged = false;
    const decoded = decodeMojibake(item.text ?? '');
    if (decoded !== item.text) { item.text = decoded; decodedRows++; rowChanged = true; }
    const normalized = foldVariants(item.text ?? '');
    if (item.normalized_text !== normalized) { item.normalized_text = normalized; normalizedRows++; rowChanged = true; }
    const range = [0, (item.text ?? '').length];
    if (!Array.isArray(item.charRange) || item.charRange[0] !== range[0] || item.charRange[1] !== range[1]) {
      item.charRange = range; rangeRows++; rowChanged = true;
    }
    if (rowChanged) { changedRows++; bookChanged = true; }
    return JSON.stringify(item);
  });
  if (bookChanged) {
    changedBooks++;
    if (write) fs.writeFileSync(corpusPath, lines.join('\n') + '\n', 'utf8');
  }
}

console.log(`${write ? '已修复' : '预览'}: ${changedBooks} 本 / ${changedRows} 段`);
console.log(`  UTF-8 误解码 ${decodedRows} 段；normalized_text ${normalizedRows} 段；charRange ${rangeRows} 段`);
if (!write && changedRows) console.log('确认后运行: node scripts/repair-corpus.mjs --write');
