/**
 * 引用采集（供 scripts/verify-citation.mjs 消费）：
 * 全术全类目跑引擎，收集 RuleHit.citations + evidence() 的全部 CitationRef，
 * 写出 $XUANSHU_CITATION_OUT（默认 .tmp-corpus/citations.json）。
 */
import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeXiaoliuren, computeQimen, computeLiuren, computeJinkou,
  baziRules, liuyaoRules, meihuaRules, ziweiRules, xiaoliurenRules, qimenRules, liurenRules, jinkouRules,
  defaultConfig,
} from '@xuanshu/core';

const OUT = process.env.XUANSHU_CITATION_OUT || path.resolve('.tmp-corpus/citations.json');
const cfg = defaultConfig('事业');
const hash = 'testhash';
const times = [
  { year: 2026, month: 8, day: 29, hour: 14, minute: 30 },
  { year: 2024, month: 2, day: 10, hour: 23, minute: 0 },
  { year: 1984, month: 12, day: 1, hour: 8, minute: 0 },
  { year: 2000, month: 1, day: 1, hour: 0, minute: 0 },
];
const refs: any[] = [];
const push = (r: any) => { if (r && r.canonicalId) refs.push(r); };

test('collect citations', () => {
  for (const time of times) {
    for (const gender of ['男', '女'] as const) {
      const input = { time, gender };
      const b = computeBazi(input, cfg, hash); baziRules(b, cfg).forEach((h: any) => h.citations?.forEach(push));
      const ly = computeLiuyao(input, cfg, hash); liuyaoRules(ly).forEach((h: any) => h.citations?.forEach(push));
      const mh = computeMeihua(input, cfg, hash); meihuaRules(mh).forEach((h: any) => h.citations?.forEach(push));
      const zw = computeZiwei(input, cfg, hash); ziweiRules(zw).forEach((h: any) => h.citations?.forEach(push));
      const qm = computeQimen(input, cfg, hash); qimenRules(qm).forEach((h: any) => h.citations?.forEach(push));
      const lr = computeLiuren(input, cfg, hash); liurenRules(lr).forEach((h: any) => h.citations?.forEach(push));
      const xl = computeXiaoliuren(input, cfg, hash); xiaoliurenRules(xl).forEach((h: any) => h.citations?.forEach(push));
      const jk = computeJinkou(input, cfg, hash); jinkouRules(jk).forEach((h: any) => h.citations?.forEach(push));
    }
  }
  // 去重
  const seen = new Set<string>();
  const uniq = refs.filter((r) => {
    const k = `${r.canonicalId}|${r.chapter}|${r.segId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(uniq, null, 1));
  // 满足 vitest 需要断言
  if (uniq.length < 10) throw new Error(`引用过少: ${uniq.length}`);
  
});
