/** reader 典籍查阅器（§9）：CitationRef 校验、三层定位、批注、反查、版本对照、进度 */
import type { CitationRef } from '@xuanshu/core';
import type { KBDocument, KBIndex, CitationGraph } from '@xuanshu/knowledge';
import { exactMatch } from '@xuanshu/knowledge';

/** 语料 Provider：由壳层注入（Web 从打包数据 / 用户导入走 Dexie） */
export interface CorpusProvider {
  all(): KBDocument[];
  byCanonical(canonicalId: string): KBDocument[];
  get(docId: string): KBDocument | undefined;
}

export function createMemoryCorpus(docs: KBDocument[]): CorpusProvider {
  const byId = new Map(docs.map(d => [d.docId, d]));
  return {
    all: () => docs,
    byCanonical: (cid) => docs.filter(d => d.canonicalId === cid),
    get: (docId) => byId.get(docId),
  };
}

/** ⑤档可信度元数据（附录 F） */
export const LEVEL_META: Record<string, { label: string; color: string; canPrimary: boolean; desc: string }> = {
  A: { label: '原典', color: 'var(--lv-a, #2e7d32)', canPrimary: true, desc: '公有领域原典原文' },
  B: { label: '注疏', color: 'var(--lv-b, #1565c0)', canPrimary: true, desc: '历代注疏（需标注家）' },
  C: { label: '现代整理', color: 'var(--lv-c, #757575)', canPrimary: false, desc: '点校本/白话译，仅辅助理解' },
  D: { label: '流派说法', color: 'var(--lv-d, #ef6c00)', canPrimary: false, desc: '口诀、师承、网络整理——需注明非原典' },
  E: { label: 'AI 生成', color: 'var(--lv-e, #c62828)', canPrimary: false, desc: '模型输出，未经原典核实' },
};

export interface LocateResult {
  status: 'ok' | 'segment-only' | 'not-found';
  doc?: KBDocument;
  message?: string;
}

/** L1 定位（主机制）：segId → doc；charRange 校验；失效降级为「高亮整段」（§9.2） */
export function locate(corpus: CorpusProvider, ref: CitationRef): LocateResult {
  const candidates = corpus.byCanonical(ref.canonicalId);
  if (!candidates.length) return { status: 'not-found', message: `典籍《${ref.book}》（${ref.canonicalId}）未内置，请导入书库` };
  const bySeg = candidates.find(d => d.segId === ref.segId);
  if (bySeg) {
    if (ref.charRange && ref.charRange[1] <= bySeg.text.length) return { status: 'ok', doc: bySeg };
    return { status: 'segment-only', doc: bySeg, message: '引文位置可能有微调，已高亮整段' };
  }
  // 兜底：按章节名匹配（语料升级后旧 segId 保留别名前，先宽容定位）
  const byChapter = candidates.find(d => d.chapter === ref.chapter);
  if (byChapter) return { status: 'segment-only', doc: byChapter, message: '已定位到章节，段落可能有微调' };
  // 兜底：quote 精确串匹配（§8.3 v4 通道）
  const hit = exactMatch({ docs: candidates } as unknown as KBIndex, ref.quote);
  if (hit) return { status: 'segment-only', doc: hit, message: '按引文定位到相近段落' };
  return { status: 'not-found', message: `《${ref.book}》${ref.chapter} 暂无匹配段落，请导入完整书库` };
}

/** 深链协议（§9.2）：xuanshu://read/{canonicalId}?seg=...&hl=...&from=... */
export function buildDeepLink(ref: CitationRef, from?: string): string {
  const params = new URLSearchParams({ seg: ref.segId, book: ref.book, chapter: ref.chapter });
  if (ref.charRange) params.set('hl', `${ref.charRange[0]}-${ref.charRange[1]}`);
  if (ref.quote) params.set('q', ref.quote.slice(0, 60));
  if (from) params.set('from', from);
  return `#/read/${ref.canonicalId}?${params.toString()}`;
}

/** 引用校验（§9.8 verify-citation 的运行时对等物） */
export interface CitationIssue { ref: CitationRef; problem: string }
export function verifyCitations(refs: CitationRef[], corpus: CorpusProvider): CitationIssue[] {
  const issues: CitationIssue[] = [];
  for (const ref of refs) {
    const res = locate(corpus, ref);
    if (res.status === 'not-found') issues.push({ ref, problem: res.message ?? '无法定位' });
    else if (res.status === 'segment-only') issues.push({ ref, problem: res.message ?? '仅定位到段' });
  }
  return issues;
}

// ---------- 批注（划词 + CitationRef，原文与批注分离存储） ----------
export interface UserNote {
  id: string;
  docId: string;              // canonicalId.segId
  canonicalId: string;
  segId: string;
  charRange: [number, number];
  quoted: string;             // 划词原文
  note: string;
  createdAt: string;
  fromCaseId?: string;        // 从卦例跳转来写的批注
}

export interface ReadingProgress {
  canonicalId: string;
  segId: string;              // 最后阅读段
  percent: number;
  updatedAt: string;
  bookmarks: Array<{ segId: string; label: string }>;
}

// ---------- 版本对照（§9.6：并列 + 差异标注，不判定优劣） ----------
export interface CollateEntry { book: string; edition: string; text: string }
export function collate(entries: CollateEntry[]): Array<{ same: boolean; chars: Array<{ ch: string; variants: string[] }> }> {
  // 轻量版：逐字对位（同长度）差异标注
  const base = entries[0]?.text ?? '';
  return entries.slice(1).map(e => {
    const chars: Array<{ ch: string; variants: string[] }> = [];
    for (let i = 0; i < Math.max(base.length, e.text.length); i++) {
      const a = base[i] ?? '∅', b = e.text[i] ?? '∅';
      chars.push({ ch: a, variants: a === b ? [] : [b] });
    }
    return { same: e.text === base, chars };
  });
}

/** 反查：段 → 引用它的卦例/规则（backlink 数据来自 CitationGraph + 用户批注） */
export function backlinksFor(segId: string, graph: CitationGraph): Array<{ kind: string; label: string }> {
  return graph.backlinks(segId).map(e => ({
    kind: e.kind,
    label: e.kind === 'case' ? `卦例 ${e.caseId ?? ''}` : e.kind === 'rule' ? `规则 ${e.ruleId}` : `AI 卡 ${e.ruleId}`,
  }));
}

/** D/E 级与 A/B 级分区（§9.4 UI 硬性规则） */
export function partitionByLevel<T extends { confidenceLevel?: string }>(items: T[]): { canonical: T[]; folk: T[] } {
  const canonical: T[] = [], folk: T[] = [];
  for (const it of items) (it.confidenceLevel === 'A' || it.confidenceLevel === 'B' ? canonical : folk).push(it);
  return { canonical, folk };
}
