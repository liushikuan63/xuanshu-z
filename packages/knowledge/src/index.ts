/** knowledge 知识库（§8）：BM25（CJK unigram+bigram）+ 同义词扩展 + 精确串匹配通道 + 引用图 */
export interface KBDocument {
  docId: string;            // canonicalId.segId
  canonicalId: string;
  book: string;
  chapter: string;
  section: string;
  segId: string;
  volume: string;
  text: string;
  confidenceLevel: 'A' | 'B' | 'C' | 'D' | 'E';
  license: string;
  sourceUrl?: string;
  tags: string[];
}

/** 异体字/旧字形归一 + 繁简检索归一（见 ./normalize，原文 display 不改动） */
import { foldVariants, foldForSearch, preloadFold, VARIANTS, VARIANT_CHARS } from './normalize';
import { GLOSSARY, GLOSSARY_TERMS, type GlossaryEntry } from './glossary';
export { GLOSSARY, GLOSSARY_TERMS, type GlossaryEntry };
import { TERM_TEACH_GROUPS, TERM_TEACH_ART_FALLBACK, BASE_TERM_FALLBACK, TERM_LOOK_HINT, ALL_TERM_TEACH_KEYS, type TermTeachEntry } from './termTeach';
export { TERM_TEACH_GROUPS, TERM_TEACH_ART_FALLBACK, BASE_TERM_FALLBACK, TERM_LOOK_HINT, ALL_TERM_TEACH_KEYS, type TermTeachEntry };
export { BOOK_CATALOG, WUSHU_CATEGORIES, CORPUS_STATUS_LABEL, CORPUS_STATUS_DESCRIPTION, corpusStatusOf, corpusIdOf, catalogContainsCorpus, booksOfCategory, booksOfArt, booksWithTerm, searchBooks, type BookEntry, type BookSource, type CorpusStatus, type WushuCategory } from './books';
export { BOOK_IMAGES, type BookImage } from './bookImages';
export { foldVariants, foldForSearch, preloadFold, VARIANTS, VARIANT_CHARS };

/** 手工术语同义词词典（§8.3，只做查询扩展） */
export const SYNONYMS: Record<string, string[]> = {
  旬空: ['空亡', '落空'], 月破: ['破'], 世应: ['世爻', '应爻'], 进神: ['化进'], 退神: ['化退'],
  三传: ['初传', '中传', '末传'], 四课: ['课体'], 体用: ['体卦', '用卦'], 互卦: ['互体'], 变卦: ['之卦'],
  四化: ['化禄', '化权', '化科', '化忌'], 用神: ['喜用', '喜神'], 空亡: ['旬空'], 驿马: ['马星'],
  庙旺: ['亮度', '落陷'], 应期: ['之期', '应日'], 六亲: ['父母', '兄弟', '子孙', '妻财', '官鬼'],
};

export function expandQuery(query: string): string[] {
  const terms = [query];
  for (const [k, vs] of Object.entries(SYNONYMS)) {
    if (query.includes(k)) terms.push(...vs);
  }
  return terms;
}

/** CJK 分词：unigram + bigram + ASCII 词（检索侧先做异体字归一 + 繁简归一） */
export function tokenize(text: string): string[] {
  const norm = foldForSearch(text).replace(/\s+/g, '');
  const tokens: string[] = [];
  const ascii = norm.match(/[a-zA-Z0-9]+/g) ?? [];
  for (const a of ascii) tokens.push(a.toLowerCase());
  // 按码点迭代（兼容扩展 A/B 增补平面字符），兜底未被映射表的罕见字也可索引
  const cjk = [...norm].filter(ch => /\p{Script=Han}/u.test(ch));
  for (let i = 0; i < cjk.length; i++) {
    tokens.push(cjk[i]);
    if (i + 1 < cjk.length) tokens.push(cjk[i] + cjk[i + 1]);
  }
  return tokens;
}

export interface KBIndex {
  docs: KBDocument[];
  df: Map<string, number>;
  postings: Map<string, Set<number>>;   // term → doc indices
  tf: Array<Map<string, number>>;       // doc → term freqs
  avgLen: number;
  version: string;
}

export function buildIndex(docs: KBDocument[]): KBIndex {
  const df = new Map<string, number>();
  const postings = new Map<string, Set<number>>();
  const tf: Array<Map<string, number>> = [];
  let totalLen = 0;
  docs.forEach((d, i) => {
    const toks = tokenize(d.text);
    totalLen += toks.length;
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    tf.push(m);
    for (const t of m.keys()) {
      df.set(t, (df.get(t) ?? 0) + 1);
      let p = postings.get(t);
      if (!p) { p = new Set(); postings.set(t, p); }
      p.add(i);
    }
  });
  return { docs, df, postings, tf, avgLen: docs.length ? totalLen / docs.length : 0, version: 'kb-index@1' };
}

/** BM25（可解释，参数可调并进索引版本） */
export function bm25Search(index: KBIndex, query: string, opts: { k1?: number; b?: number; topK?: number } = {}): Array<{ doc: KBDocument; score: number; matched: string[] }> {
  const k1 = opts.k1 ?? 1.5, b = opts.b ?? 0.75, topK = opts.topK ?? 8;
  const N = index.docs.length;
  if (!N) return [];
  const terms = [...new Set(expandQuery(query).flatMap(q => tokenize(q)))];
  const scores = new Map<number, { score: number; matched: Set<string> }>();
  for (const term of terms) {
    const p = index.postings.get(term);
    if (!p) continue;
    const dfv = index.df.get(term) ?? 0;
    const idf = Math.log(1 + (N - dfv + 0.5) / (dfv + 0.5));
    for (const di of p) {
      const f = index.tf[di].get(term) ?? 0;
      const len = index.tf[di].size;
      const denom = f + k1 * (1 - b + b * len / (index.avgLen || 1));
      const s = idf * f * (k1 + 1) / (denom || 1);
      const cur = scores.get(di) ?? { score: 0, matched: new Set<string>() };
      cur.score += s;
      if (term.length >= 2) cur.matched.add(term);
      scores.set(di, cur);
    }
  }
  return [...scores.entries()]
    .sort((a, b2) => b2[1].score - a[1].score)
    .slice(0, topK)
    .map(([di, v]) => ({ doc: index.docs[di], score: Math.round(v.score * 100) / 100, matched: [...v.matched].slice(0, 5) }));
}

/** 精确串匹配通道（§8.3 v4）：引文定位与校验，quote 逐字对上（双侧归一：异体字 + 繁简） */
export function exactMatch(index: KBIndex, quote: string): KBDocument | null {
  const norm = foldForSearch(quote).replace(/\s+/g, '');
  if (norm.length < 4) return null;
  for (const d of index.docs) {
    if (foldForSearch(d.text).replace(/\s+/g, '').includes(norm)) return d;
  }
  return null;
}

/** 引用图 citationEdges：段 → 引用它的规则（§8.3 反查索引） */
export interface CitationEdge { segId: string; ruleId: string; caseId?: string; kind: 'rule' | 'case' | 'ai' }

export class CitationGraph {
  private edges = new Map<string, CitationEdge[]>();
  add(edge: CitationEdge): void {
    const list = this.edges.get(edge.segId) ?? [];
    list.push(edge);
    this.edges.set(edge.segId, list);
  }
  backlinks(segId: string): CitationEdge[] {
    return this.edges.get(segId) ?? [];
  }
  size(): number { return this.edges.size; }
}

/** 事项联动查询扩展（§8.3 v3）：求财 → 财爻/妻财/求财/谋财 */
export function categoryBoost(category: string): string[] {
  const map: Record<string, string[]> = {
    求财: ['财爻', '妻财', '求财', '谋财'], 失物: ['失脱', '失物', '寻物'], 感情: ['婚姻', '姻缘', '妻妾'],
    事业: ['求名', '仕宦', '官禄'], 学业: ['求名', '考试', '文书'], 健康: ['疾病', '病症'], 官非: ['词讼', '诉讼'],
    出行: ['出行', '行人'], 合作: ['合伙', '交易'],
  };
  return map[category] ?? [];
}

export function searchWithBoost(index: KBIndex, query: string, category?: string): Array<{ doc: KBDocument; score: number; matched: string[] }> {
  const base = bm25Search(index, query, { topK: 24 });
  if (!category) return base.slice(0, 8);
  const boost = categoryBoost(category);
  const boosted = base.map(r => {
    const extra = boost.some(b => r.doc.text.includes(b) || r.doc.chapter.includes(b)) ? r.score * 1.25 : r.score;
    return { ...r, score: Math.round(extra * 100) / 100 };
  });
  return boosted.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** 白话导读：段落命中术语及其白话释义（长词优先，供「白话文」视图段落导读条展示）。
 * 仅返回词库已收录且有 plain 释义的术语；术语按出现顺序去重。 */
export interface TermHit { term: string; plain: string; note?: string }

/** 术语兜底（八术讲辑 fallback 扁平化），供白话导读匹配 */
const TERM_FALLBACK_FLAT: Record<string, { plain?: string; note?: string }> = (() => {
  const flat: Record<string, { plain?: string; note?: string }> = {};
  for (const m of Object.values(TERM_TEACH_ART_FALLBACK)) {
    for (const [k, v] of Object.entries(m)) if (!flat[k]) flat[k] = v;
  }
  for (const [k, v] of Object.entries(BASE_TERM_FALLBACK)) if (!flat[k]) flat[k] = v;
  return flat;
})();

const TERM_HIT_KEYS = [...new Set([...GLOSSARY_TERMS, ...ALL_TERM_TEACH_KEYS])].sort((a, b) => b.length - a.length).filter(k => k.length >= 2);
const TERM_HIT_RE = new RegExp('(' + TERM_HIT_KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');

export function termHitsIn(text: string, limit = 6): TermHit[] {
  const out: TermHit[] = [];
  const seen = new Set<string>();
  TERM_HIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_HIT_RE.exec(text)) && out.length < limit) {
    const term = m[0];
    if (seen.has(term)) continue;
    seen.add(term);
    const e = GLOSSARY[term] ?? TERM_FALLBACK_FLAT[term];
    if (e?.plain) out.push({ term, plain: e.plain, note: e.note });
  }
  return out;
}
