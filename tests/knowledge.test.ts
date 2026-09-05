/**
 * 知识库/书阁/答复装配测试：BM25 检索、引文定位降级链、答复安全层
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, bm25Search, exactMatch, foldVariants, preloadFold, termHitsIn, type KBDocument } from '@xuanshu/knowledge';
import { createMemoryCorpus, locate, verifyCitations, partitionByLevel, collate, buildDeepLink } from '@xuanshu/reader';
import { composeAnswer, verifyAICitations } from '@xuanshu/answer';

const KB_DIR = path.resolve('data/.kb/books');

function loadBook(cid: string): KBDocument[] {
  const f = path.join(KB_DIR, cid, 'corpus.jsonl');
  return fs
    .readFileSync(f, 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const o = JSON.parse(line);
      return {
        docId: o.canonical_id + '.' + o.segId,
        canonicalId: o.canonical_id,
        book: o.title,
        chapter: o.chapter,
        section: o.section ?? '',
        segId: o.segId,
        volume: o.volume ?? '',
        text: o.text,
        confidenceLevel: o.confidence_level,
        license: o.license,
        tags: o.tags ?? [],
      } as unknown as KBDocument;
    });
}

describe('BM25 检索（CJK 双字分词 + 异体字/繁简归一）', () => {
  const docs = [...loadBook('zengshan'), ...loadBook('meihua'), ...loadBook('yanbodiaosouge'), ...loadBook('bianta')];
  // 索引必须在归一层预热后构建（与 AppProvider 行为一致）
  let index: ReturnType<typeof buildIndex>;
  beforeAll(async () => {
    await preloadFold();
    index = buildIndex(docs);
  });

  it('「用神 旺衰」命中增删卜易用神章居前', () => {
    const hits = bm25Search(index, '用神 旺衰', { topK: 8 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].doc.canonicalId).toBe('zengshan');
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it('「妻财」（简体）可召回「妻財」（繁体）相关段', () => {
    const hits = bm25Search(index, '妻财', { topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('异体字归一：检索「趋吉避凶」「高」命中含 㐫/髙 的原段', () => {
    const hitsXiong = bm25Search(index, '趋吉避凶', { topK: 5 });
    expect(hitsXiong.length).toBeGreaterThan(0);
    expect(hitsXiong[0].doc.canonicalId).toBe('zengshan');
    const hitsGao = bm25Search(index, '贵人高中', { topK: 5 });
    expect(hitsGao.some(h => h.doc.canonicalId === 'bianta')).toBe(true);
  });

  it('foldVariants：罕见异体归一为通行正字', () => {
    expect(foldVariants('趨吉避㐫，𥁞矣，𡈽也，髙也，淂之')).toBe('趨吉避凶，盡矣，土也，高也，得之');
  });

  it('exactMatch 精确引文通道（含异体容错）', () => {
    const sample = docs[0].text.slice(0, 10);
    const hit = exactMatch(index, sample);
    expect(hit).toBeTruthy();
    expect(hit!.text).toContain(sample);
    // 引文写成通行正字也能定位到含异体字的原段
    const segWithVar = docs.find(d => d.text.includes('㐫'));
    if (segWithVar) {
      const q = foldVariants(segWithVar.text.slice(0, 12));
      const h = exactMatch(index, q);
      expect(h?.segId).toBe(segWithVar.segId);
    }
  });

  it('无关查询几乎无召回分', () => {
    const hits = bm25Search(index, '量子力学薛定谔方程', { topK: 3 });
    expect(hits[0]?.score ?? 0).toBeLessThan(12);
  });
});

describe('书阁定位降级链（segId → 章节 → 引文 → not-found）', () => {
  const docs = loadBook('zengshan');
  const corpus = createMemoryCorpus(docs);

  it('segId 精确命中 → ok', () => {
    const r = locate(corpus, { canonicalId: 'zengshan', book: '增删卜易', chapter: docs[0].chapter, segId: docs[0].segId, quote: '', charRange: [0, docs[0].text.length], confidenceLevel: 'A' } as never);
    expect(r.status).toBe('ok');
    expect(r.doc!.segId).toBe(docs[0].segId);
  });

  it('segId 失效但章节在 → segment-only', () => {
    const r = locate(corpus, { canonicalId: 'zengshan', book: '增删卜易', chapter: docs[0].chapter, segId: 'zengshan.999.999', quote: '', confidenceLevel: 'A' } as never);
    expect(r.status).toBe('segment-only');
    expect(r.message).toContain('章节');
  });

  it('全不中 → not-found（记录 kb-gap）', () => {
    const r = locate(corpus, { canonicalId: 'zengshan', book: '增删卜易', chapter: '不存在的章', segId: 'zengshan.999.998', quote: '绝不存在的引文字符串QqQ', confidenceLevel: 'A' } as never);
    expect(r.status).toBe('not-found');
  });

  it('未入库书 → not-found 且提示导入', () => {
    const r = locate(corpus, { canonicalId: 'folk-oral', book: '民间口诀', chapter: '六神断', segId: 'folk-oral.x', quote: '', confidenceLevel: 'D' } as never);
    expect(r.status).toBe('not-found');
  });

  it('verifyCitations 批量校验可发现坏引用', () => {
    const issues = verifyCitations(
      [
        { canonicalId: 'zengshan', book: '增删卜易', chapter: docs[0].chapter, segId: docs[0].segId, quote: '', charRange: [0, docs[0].text.length], confidenceLevel: 'A' },
        { canonicalId: 'ghost-book', book: '幽灵书', chapter: '不存在', segId: 'ghost-book.1.1', quote: '', confidenceLevel: 'A' },
      ] as never,
      corpus,
    );
    expect(issues.length).toBe(1);
    expect(issues[0].ref.canonicalId).toBe('ghost-book');
  });
});

describe('五档分级与深链（D10–D13）', () => {
  it('partitionByLevel 分离原典/流派', () => {
    const items = [{ confidenceLevel: 'A' }, { confidenceLevel: 'B' }, { confidenceLevel: 'D' }, { confidenceLevel: 'E' }];
    const p = partitionByLevel(items as never);
    expect(p.canonical.length).toBe(2);
    expect(p.folk.length).toBe(2);
  });

  it('collate 同文比对无异文', () => {
    const r = collate([
      { book: '增删卜易', edition: 'A本', text: '天道' },
      { book: '增删卜易', edition: 'B本', text: '天道' },
    ]);
    expect(r[0].same).toBe(true);
  });

  it('buildDeepLink 生成 hash 协议链接', () => {
    const link = buildDeepLink(
      { canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', segId: 'zengshan.8.1', charRange: [0, 10], quote: '用神' } as never,
      'answer',
    );
    expect(link).toContain('#/read/zengshan');
    expect(link).toContain('seg=zengshan.8.1');
    expect(link).toContain('hl=0-10');
  });
});

describe('答复装配（D7 四层 + 敏感类目安全层）', () => {
  const baseInput = {
    art: 'liuyao' as const,
    category: '失物' as const,
    question: '丢的钥匙能找到吗',
    facts: { facts: ['卦得乾为天', '世爻午火'] } as never,
    rules: [
      { ruleId: 't1', text: '用神旺相', level: '吉', confidenceLevel: 'A', citations: [{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', segId: 'zengshan.1.1', quote: '', confidenceLevel: 'A' }] },
      { ruleId: 't2', text: '兄弟发动', level: '凶', confidenceLevel: 'A', citations: [] },
    ] as never[],
    timing: [] as never[],
    knowledge: [] as never[],
  };

  it('生成免责声明分区与结论', () => {
    const a = composeAnswer(baseInput as never);
    expect(a.summary).toBeTruthy();
    expect(a.sections.some((sec) => sec.kind === 'disclaimer')).toBe(true);
    expect(a.safety.sensitive).toBe(false);
  });

  it('健康类目触发转介安全层', () => {
    const a = composeAnswer({ ...baseInput, category: '健康' } as never);
    expect(a.safety.sensitive).toBe(true);
    expect(a.safety.referrals.length).toBeGreaterThan(0);
  });
});

describe('AI 引文核验（§10 默认关闭 + 防编造）', () => {
  it('编造 segId 的 AI 卡片标记 needsHumanReview', () => {
    const card = {
      claimId: 'c1',
      type: '卦象',
      text: '此事可成',
      evidenceRefs: [{ canonicalId: 'zengshan', book: '增删卜易', chapter: 'x', segId: 'zengshan.999.999', quote: '不存在', confidenceLevel: 'E' }],
      confidence: 0.8,
      counterEvidence: [],
    };
    const out = verifyAICitations(card as never, [{ segId: 'zengshan.1.1', quote: '真实引文句子' }]);
    expect((out as unknown as { needsHumanReview: boolean }).needsHumanReview).toBe(true);
  });
});

describe('白话导读（termHitsIn：段落命中术语提取）', () => {
  it('术语按序提取且带白话释义', () => {
    const hits = termHitsIn('断卦先取用神，月破逢冲而应爻空亡，待出空方应事。');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.some(h => h.term === '用神' || h.term === '取用神')).toBe(true);
    expect(hits.some(h => h.term === '月破')).toBe(true);
    expect(hits.some(h => h.term === '应爻')).toBe(true);
    for (const h of hits) {
      expect(h.plain.length).toBeGreaterThan(0);
      expect(h.term.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('长词优先：同时命中「梅花易数」与「梅花」时按长词返回', () => {
    const hits = termHitsIn('以梅花易数起卦，看本卦变卦与体用生克。');
    const first = hits[0];
    expect(first.term).toBe('梅花易数');
  });

  it('无术语文本返回空数组', () => {
    expect(termHitsIn('序言——此本流传有序，版刻精良。', 6)).toEqual([]);
  });

  it('limit 生效且不重复', () => {
    const hits = termHitsIn('用神用神，还是用神；应爻应爻，月破月破，旬空旬空。', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(new Set(hits.map(h => h.term)).size).toBe(hits.length);
  });
});
