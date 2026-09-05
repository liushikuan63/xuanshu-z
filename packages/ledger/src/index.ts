/** ledger 案例本（§5）：CaseRecord schema、schemaVersion、99 条/术配额、标注、归档、导入导出 */
import Dexie, { type Table } from 'dexie';
import type { ArtType, CitationRef, RuleHit, Warning, ResolvedConfig, RawInput, NormalizedMoment, CategoryId } from '@xuanshu/core';
import { ENGINE_VERSION } from '@xuanshu/core';

export const SCHEMA_VERSION = 1;

export interface UserAnnotation {
  presetTags: Array<'应验' | '部分应验' | '未应验' | '存疑' | '重要'>;
  customTags: string[];
  outcome?: { result: '应验' | '部分应验' | '未应验' | '无法判断'; at: string; note?: string };
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  keyTakeaway?: string;
  matchedRuleIds?: string[];
  updatedAt: string;
}

export interface CaseRecord {
  caseId: string;                       // uuid v7 风格（时间序）
  artType: ArtType;
  createdAt: string;
  schemaVersion: number;
  category: CategoryId;
  question: { category: CategoryId; text?: string; summary: string };
  input: { raw: RawInput; normalized: NormalizedMoment; config: ResolvedConfig; configHash: string; engineVersion: string };
  result: { chart: unknown; ruleHits: RuleHit[]; warnings: Warning[]; evidenceRefs: CitationRef[]; boardHash: string };
  annotation: UserAnnotation;
  status: 'open' | 'resolved' | 'archived';
  remindAt?: string;
  linkedCaseIds: string[];
  tags: string[];
  revision: number;
  degraded?: boolean;
}

/** 配额设置（D5：99/199/无限 + 自动归档阈值） */
export interface QuotaSettings {
  limit: number | 'unlimited';          // 每术上限
  softThreshold: number;                // 软提醒阈值
  autoArchiveThreshold: number;         // 超限自动引导归档条数
}

export const DEFAULT_QUOTA: QuotaSettings = { limit: 99, softThreshold: 90, autoArchiveThreshold: 5 };

class XuanshuDB extends Dexie {
  cases!: Table<CaseRecord, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  annotations!: Table<{ id: string; caseId: string; kind: string; refSegId?: string; text: string; createdAt: string }, string>;

  constructor() {
    super('xuanshu');
    this.version(1).stores({
      cases: 'caseId, artType, createdAt, category, status, remindAt, *tags, *annotation.presetTags',
      meta: 'key',
      annotations: 'id, caseId, refSegId',
    });
  }
}

let db: XuanshuDB | null = null;
export function getDB(): XuanshuDB {
  if (!db) db = new XuanshuDB();
  return db;
}

// ---------- uuid v7（时间序） ----------
export function uuidV7(): string {
  const ts = Date.now();
  const hex = ts.toString(16).padStart(12, '0');
  const rand = crypto.getRandomValues(new Uint8Array(10));
  const b = Array.from(rand, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${b.slice(0, 3)}-${((parseInt(b.slice(3, 4), 16) & 0x3) | 0x8).toString(16)}${b.slice(4, 7)}-${b.slice(7, 19)}`;
}

// ---------- 配额 ----------
export interface QuotaStatus {
  art: ArtType; used: number; limit: number | 'unlimited'; soft: boolean; full: boolean; archived: number;
}

export async function quotaStatus(art: ArtType, settings: QuotaSettings = DEFAULT_QUOTA): Promise<QuotaStatus> {
  const dbi = getDB();
  const used = await dbi.cases.where('artType').equals(art).and(c => c.status !== 'archived').count();
  const archived = await dbi.cases.where('artType').equals(art).and(c => c.status === 'archived').count();
  if (settings.limit === 'unlimited') return { art, used, limit: 'unlimited', soft: false, full: false, archived };
  return {
    art, used, limit: settings.limit, archived,
    soft: used >= settings.softThreshold,
    full: used >= settings.limit,
  };
}

/** 写入前配额检查：绝不静默删除（D5） */
export async function checkQuotaBeforeWrite(art: ArtType, settings: QuotaSettings = DEFAULT_QUOTA): Promise<{ ok: boolean; message?: string; action?: 'archive' | 'export' }> {
  const st = await quotaStatus(art, settings);
  if (st.limit === 'unlimited' || !st.full) return { ok: true };
  return {
    ok: false,
    message: `「${art}」已达 ${st.limit} 条上限（不静默删除）。请归档最旧记录或导出备份后继续。`,
    action: 'archive',
  };
}

// ---------- 写入 ----------
export async function saveCase(record: Omit<CaseRecord, 'caseId' | 'createdAt' | 'schemaVersion' | 'annotation' | 'status' | 'linkedCaseIds' | 'tags' | 'revision'> & Partial<CaseRecord>): Promise<CaseRecord> {
  const dbi = getDB();
  const rec: CaseRecord = {
    caseId: record.caseId ?? uuidV7(),
    createdAt: record.createdAt ?? new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    annotation: record.annotation ?? { presetTags: [], customTags: [], updatedAt: new Date().toISOString() },
    status: record.status ?? 'open',
    linkedCaseIds: record.linkedCaseIds ?? [],
    tags: record.tags ?? [],
    revision: 1,
    ...record,
  } as CaseRecord;
  await dbi.cases.put(rec);
  return rec;
}

export async function updateAnnotation(caseId: string, patch: Partial<UserAnnotation>): Promise<void> {
  const dbi = getDB();
  await dbi.transaction('rw', dbi.cases, async () => {
    const rec = await dbi.cases.get(caseId);
    if (!rec) return;
    rec.annotation = { ...rec.annotation, ...patch, updatedAt: new Date().toISOString() };
    rec.revision += 1;
    if (patch.outcome && rec.status === 'open') rec.status = 'resolved';
    await dbi.cases.put(rec);
  });
}

export async function setStatus(caseId: string, status: CaseRecord['status']): Promise<void> {
  const dbi = getDB();
  await dbi.transaction('rw', dbi.cases, async () => {
    const rec = await dbi.cases.get(caseId);
    if (!rec) return;
    rec.status = status; rec.revision += 1;
    await dbi.cases.put(rec);
  });
}

/** 重复起卦去重（§5.2）：同 configHash + 同问题摘要 + 5 分钟内 */
export async function findDuplicate(configHash: string, summary: string): Promise<CaseRecord | null> {
  const dbi = getDB();
  const recent = await dbi.cases.where('createdAt').above(new Date(Date.now() - 5 * 60 * 1000).toISOString()).toArray();
  return recent.find(c => c.input.configHash === configHash && c.question.summary === summary) ?? null;
}

// ---------- 闭环统计（§5.4：只校准解释，绝不回写排盘层） ----------
export interface FeedbackStats {
  byArt: Record<string, { total: number; judged: number; hit: number }>;
  byCategory: Record<string, { total: number; judged: number; hit: number }>;
  byRuleId: Record<string, { shown: number; confirmed: number }>;
  computedAt: string;
}

export async function computeFeedbackStats(): Promise<FeedbackStats> {
  const dbi = getDB();
  const all = await dbi.cases.toArray();
  const stats: FeedbackStats = { byArt: {}, byCategory: {}, byRuleId: {}, computedAt: new Date().toISOString() };
  for (const c of all) {
    const art = stats.byArt[c.artType] ?? (stats.byArt[c.artType] = { total: 0, judged: 0, hit: 0 });
    art.total++;
    const cat = stats.byCategory[c.category] ?? (stats.byCategory[c.category] = { total: 0, judged: 0, hit: 0 });
    cat.total++;
    const outcome = c.annotation?.outcome?.result;
    if (outcome && outcome !== '无法判断') {
      art.judged++;
      cat.judged++;
      const hit = outcome === '应验';
      if (hit) art.hit++;
      if (hit) cat.hit++;
    }
    for (const rid of c.annotation?.matchedRuleIds ?? []) {
      const r = stats.byRuleId[rid] ?? (stats.byRuleId[rid] = { shown: 0, confirmed: 0 });
      r.confirmed++;
    }
    for (const rh of c.result?.ruleHits ?? []) {
      const r = stats.byRuleId[rh.ruleId] ?? (stats.byRuleId[rh.ruleId] = { shown: 0, confirmed: 0 });
      r.shown++;
    }
  }
  return stats;
}

// ---------- 导入导出（§5.5） ----------
export interface ExportBundle {
  app: 'xuanshu';
  exportedAt: string;
  appVersion: string;
  schemaVersion: number;
  checksum: string;
  cases: CaseRecord[];
}

async function checksumOf(cases: CaseRecord[]): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(cases.map(c => c.caseId + c.revision)));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function exportCases(art?: ArtType): Promise<ExportBundle> {
  const dbi = getDB();
  const cases = art ? await dbi.cases.where('artType').equals(art).toArray() : await dbi.cases.toArray();
  return {
    app: 'xuanshu', exportedAt: new Date().toISOString(), appVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION, checksum: await checksumOf(cases), cases,
  };
}

export async function importCases(bundle: ExportBundle, keepBoth = false): Promise<{ added: number; updated: number; skipped: number }> {
  const dbi = getDB();
  let added = 0, updated = 0, skipped = 0;
  await dbi.transaction('rw', dbi.cases, async () => {
    for (const c of bundle.cases ?? []) {
      const existing = await dbi.cases.get(c.caseId);
      if (!existing) { await dbi.cases.put(migrateCase(c)); added++; }
      else if (keepBoth) {
        await dbi.cases.put({ ...migrateCase(c), caseId: uuidV7() }); added++;
      } else if ((c.revision ?? 0) >= existing.revision) { await dbi.cases.put(migrateCase(c)); updated++; }
      else skipped++;
    }
  });
  return { added, updated, skipped };
}

/** 迁移函数链（D31）：v(n) → v(current)；纯函数、单向 */
export function migrateCase(c: CaseRecord): CaseRecord {
  let rec = { ...c };
  // v0 → v1：补默认字段
  if ((rec.schemaVersion ?? 0) < 1) {
    rec.schemaVersion = 1;
    rec.annotation = rec.annotation ?? { presetTags: [], customTags: [], updatedAt: new Date().toISOString() };
    rec.linkedCaseIds = rec.linkedCaseIds ?? [];
    rec.tags = rec.tags ?? [];
    rec.revision = rec.revision ?? 1;
    rec.category = rec.category ?? rec.question?.category ?? '其他';
  }
  return rec;
}

// ---------- 归档区 ----------
export async function archiveOldest(art: ArtType, n: number): Promise<number> {
  const dbi = getDB();
  const oldest = await dbi.cases.where('artType').equals(art).and(c => c.status !== 'archived').sortBy('createdAt');
  const targets = oldest.slice(0, n);
  for (const t of targets) await setStatus(t.caseId, 'archived');
  return targets.length;
}

export async function restoreFromArchive(caseId: string): Promise<void> {
  await setStatus(caseId, 'open');
}

// ---------- Markdown 导出（含出处） ----------
export function caseToMarkdown(c: CaseRecord, withTextFragment = false): string {
  const lines: string[] = [];
  lines.push(`# 占卜案例 · ${c.artType} · ${c.category}`);
  lines.push(`- 日期：${c.createdAt}`);
  lines.push(`- 问题：${c.question.summary}${c.question.text ? `（${c.question.text}）` : ''}`);
  lines.push('');
  lines.push('## 盘面');
  lines.push('```json');
  lines.push(JSON.stringify(c.result.chart, null, 2).slice(0, 4000));
  lines.push('```');
  lines.push('');
  lines.push('## 断语与出处');
  for (const rh of c.result.ruleHits) {
    lines.push(`- **${rh.title}**（${rh.level}）：${rh.fact}`);
    for (const cit of rh.citations) {
      const frag = withTextFragment && cit.quote ? ` #:~:text=${encodeURIComponent(cit.quote.slice(0, 20))}` : '';
      lines.push(`  - 〔${cit.confidenceLevel} 级·${cit.book}·${cit.chapter}〕${cit.quote}${frag}`);
    }
  }
  if (c.annotation?.outcome) lines.push(`\n## 事后反馈\n- 结果：${c.annotation.outcome.result}（${c.annotation.outcome.at}）`);
  if (c.annotation?.keyTakeaway) lines.push(`- 关键收获：${c.annotation.keyTakeaway}`);
  lines.push('\n> 本软件提供传统术数排盘与文化研究辅助，解释不构成医疗、投资、法律建议。');
  return lines.join('\n');
}

export function casesToCSV(cases: CaseRecord[]): string {
  const head = 'caseId,artType,category,createdAt,summary,status,outcome,rating,keyTakeaway';
  const rows = cases.map(c => [
    c.caseId, c.artType, c.category, c.createdAt,
    `"${(c.question.summary ?? '').replace(/"/g, '""')}"`, c.status,
    c.annotation?.outcome?.result ?? '', String(c.annotation?.rating ?? ''), `"${(c.annotation?.keyTakeaway ?? '').replace(/"/g, '""')}"`,
  ].join(','));
  return '\uFEFF' + head + '\n' + rows.join('\n');
}
