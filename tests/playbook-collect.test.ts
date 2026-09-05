/**
 * 手册采集（供 scripts/verify-playbook.mjs 消费）：
 * 导出全部 playbook 结构摘要 + 类目覆盖 + 语料 canonicalId 清单。
 * 写出 $XUANSHU_PLAYBOOK_OUT（默认 .tmp-corpus/playbooks.json）。
 */
import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { allPlaybooks } from '@xuanshu/intake';
import { CATEGORIES } from '@xuanshu/core';

const OUT = process.env.XUANSHU_PLAYBOOK_OUT || path.resolve('.tmp-corpus/playbooks.json');

test('collect playbooks', () => {
  const corpusDir = path.resolve('data/.kb/books');
  const corpusCanonicalIds = fs.readdirSync(corpusDir).filter((d) => {
    try { return fs.statSync(path.join(corpusDir, d)).isDirectory(); } catch { return false; }
  });
  const summary = allPlaybooks.map((pb) => ({
    id: pb.id,
    category: pb.category,
    sections: [
      { kind: 'howToAsk', ok: !!pb.howToAsk },
      { kind: 'howToCast', ok: !!pb.howToCast },
      { kind: 'yongShen', ok: pb.yongShen?.length > 0 },
      { kind: 'signals', ok: pb.signals?.length > 0 },
      { kind: 'timing', ok: !!pb.timing },
      { kind: 'readingList', ok: pb.readingList?.length > 0 },
      { kind: 'forbidden', ok: pb.forbidden?.length > 0 },
      { kind: 'disclaimer', ok: !!pb.disclaimer },
      { kind: 'recordTemplate', ok: !!pb.recordTemplate },
    ].filter((s) => s.ok).map((s) => s.kind),
    canonicalIds: (pb.readingList || []).map((r) => r.canonicalId),
  }));
  const categoryCoverage = CATEGORIES.filter((c) => allPlaybooks.some((p) => p.category === c));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    requiredSections: ['howToAsk', 'howToCast', 'yongShen', 'signals', 'timing', 'readingList', 'forbidden', 'disclaimer', 'recordTemplate'],
    playbooks: summary,
    categories: CATEGORIES,
    categoryCoverage,
    corpusCanonicalIds,
  }, null, 1));
  if (allPlaybooks.length < 20) throw new Error(`playbook 过少: ${allPlaybooks.length}`);
});
