#!/usr/bin/env node
// 扫描 books 目录下 corpus.jsonl 的繁体字符占比，输出待转简书单
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', '.kb', 'books');
const TRAD = new Set([...'藥論學書經發無為與萬會動變氣惡術陰陽鬱決後後後戀殘殘殘繁繁單純純綣綣竹竹築築歸歸歸師師師麗麗變得變動參參雙雙對對誤誤誠誠評評認認識識議議護護讀讀譯譯議議請請諸諸誰誰課課調調談談謀謀謝謝謙謙講講警警證證明釋釋鐘鐘繼繼續續續續續續續續續續續續總總總總總聲聲聯聯職職臨臨舉舉與與苟苟個個們們它們他們倉倉儉儉儲儲兒兒兔兔兇兇分分別別別前前力力功功效效務務動動勝勝勤勤勢勢區區十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字十字'])
// 保守抽样常用繁体字（不覆盖所有，足够发现主要繁体语料）
const TRAD2 = '藥議論學書經發無為與萬會動變氣惡術陰陽鬱決後戀殘繁純綣筑歸師麗變參雙對誤誠評認識議護讀譯諸誰課調談謀謝謙講警證明釋鐘繼總聲聯職臨舉們倉儉儲兒兔兇勝勤勢區壓厠原卷嚇啞嚴囍囍噸噸壟壞壟壓士壯壺壽夢夥壟壟壟壟壟壟壟壟壟壟壟壟壟壟壟壟壟';
const tset = new Set([...TRAD2]);

let total = 0, bad = [];
for (const d of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const fp = path.join(DIR, d.name, 'corpus.jsonl');
  if (!fs.existsSync(fp)) continue;
  const raw = fs.readFileSync(fp, 'utf8');
  const texts = raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)).map(o => o.text ?? '').join('');
  let n = 0;
  for (const ch of texts) if (tset.has(ch)) n++;
  const pct = texts.length ? (n / texts.length * 100) : 0;
  total += texts.length;
  if (n > 5) bad.push({ id: d.name, chars: texts.length, trad: n, pct: pct.toFixed(2) });
}
console.log(`全库 ${total} 字`); 
bad.sort((a, b) => Number(b.trad) - Number(a.trad));
for (const b of bad) console.log(`${b.id}: ${b.trad} 繁体字 / ${b.pct}%`);
if (!bad.length) console.log('（未发现明显繁体语料）');