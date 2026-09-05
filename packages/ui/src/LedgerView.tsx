/** 记录本（§5）：99 条/术配额、标注面板、闭环统计、导出导入 */
import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getDB, quotaStatus, updateAnnotation, setStatus, exportCases, importCases, caseToMarkdown, casesToCSV,
  archiveOldest, restoreFromArchive, DEFAULT_QUOTA, type CaseRecord, type UserAnnotation, type QuotaSettings,
} from '@xuanshu/ledger';
import { ART_LIST, ART_NAMES, type ArtType, type CitationRef } from '@xuanshu/core';
import { useApp, ART_META } from './state';
import { CitationBadge, RuleHits } from './components';

const PRESETS: UserAnnotation['presetTags'] = ['应验', '部分应验', '未应验', '存疑', '重要'];

export function LedgerView({ focusCaseId }: { focusCaseId?: string }) {
  const { settings, toast, kbIndex, corpus } = useApp();
  const [filterArt, setFilterArt] = useState<ArtType | 'all'>('all');
  const [detail, setDetail] = useState<string | null>(focusCaseId ?? null);
  const quota: QuotaSettings = { ...DEFAULT_QUOTA, limit: settings.quotaLimit };

  const cases = useLiveQuery(async () => {
    const db = getDB();
    const all = await db.cases.orderBy('createdAt').reverse().toArray();
    return filterArt === 'all' ? all : all.filter(c => c.artType === filterArt);
  }, [filterArt]) ?? [];

  const quotas = useLiveQuery(async () => Promise.all(ART_LIST.map(a => quotaStatus(a, quota))), [settings.quotaLimit]) ?? [];
  const current = cases.find(c => c.caseId === detail);

  const doExport = async (fmt: 'json' | 'csv' | 'md') => {
    const bundle = await exportCases(filterArt === 'all' ? undefined : filterArt);
    let content = '', mime = 'application/json', name = `xuanshu-cases-${Date.now()}`;
    if (fmt === 'json') { content = JSON.stringify(bundle, null, 2); mime = 'application/json'; name += '.xuan-case.json'; }
    else if (fmt === 'csv') { content = casesToCSV(bundle.cases); mime = 'text/csv'; name += '.csv'; }
    else { content = bundle.cases.map(c => caseToMarkdown(c, true)).join('\n\n---\n\n'); mime = 'text/markdown'; name += '.md'; }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
    toast(`已导出 ${bundle.cases.length} 条（${fmt}）`);
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">记录本 · 案例闭环</div>
        <div className="page-desc">每术独立配额（{String(settings.quotaLimit)} 条）· 软提醒 {quota.softThreshold} · 不静默删除</div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn sm" onClick={() => doExport('json')}>导出 .xuan-case.json</button>
          <button className="btn sm" onClick={() => doExport('csv')}>CSV</button>
          <button className="btn sm" onClick={() => doExport('md')}>Markdown</button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            导入
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              try {
                const bundle = JSON.parse(await f.text());
                const r = await importCases(bundle, false);
                toast(`导入完成：新增 ${r.added}，更新 ${r.updated}，跳过 ${r.skipped}`);
              } catch { toast('导入失败：文件不是合法的 .xuan-case.json'); }
            }} />
          </label>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: 16 }}>
        {ART_LIST.map(a => {
          const st = quotas.find(q => q?.art === a);
          if (!st) return null;
          const pct = st.limit === 'unlimited' ? 0 : Math.min(100, Math.round(st.used / (st.limit as number) * 100));
          return (
            <button key={a} className="stat-card" style={{ cursor: 'pointer', textAlign: 'left', borderColor: filterArt === a ? 'var(--zhu)' : undefined }}
              onClick={() => setFilterArt(filterArt === a ? 'all' : a)} aria-label={`${ART_NAMES[a]}：已用 ${st.used} 条`}>
              <div className="small"><b style={{ color: ART_META[a].color }}>{ART_NAMES[a]}</b> {st.limit !== 'unlimited' && <span className="muted">{st.used}/{st.limit}</span>}</div>
              <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${pct}%` }} /></div>
              {st.soft && <div className="small" style={{ color: 'var(--orange)', marginTop: 4 }}>接近配额（{quota.softThreshold} 软提醒）</div>}
              {st.full && <div className="small" style={{ color: 'var(--red)', marginTop: 4 }}>已满：归档或导出，绝不静默删除</div>}
            </button>
          );
        })}
      </div>

      {cases.length === 0 && <div className="notice info">还没有记录——从「起卦」向导完成一次起卦后会出现在这里。</div>}

      {cases.map(c => (
        <div key={c.caseId} className="case-item" onClick={() => setDetail(c.caseId)} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setDetail(c.caseId)} aria-label={`案例：${c.question.summary}`}>
          <div className="case-art-badge" style={{ background: ART_META[c.artType].color + '22', color: ART_META[c.artType].color }}>{ART_META[c.artType].icon.slice(0, 2)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{c.question.summary || '（无问题摘要）'}</div>
            <div className="muted small">{new Date(c.createdAt).toLocaleString('zh-CN')} · {ART_NAMES[c.artType]} · {c.category} {c.status === 'archived' && <span className="tag">已归档</span>} {c.degraded && <span className="tag xiong">降级</span>}</div>
          </div>
          {c.annotation.presetTags.map(t => <span key={t} className={`tag ${t === '应验' ? 'ji' : t === '未应验' ? 'xiong' : 'gold'}`}>{t}</span>)}
          {c.annotation.outcome && <span className="tag dai">{c.annotation.outcome.result}</span>}
        </div>
      ))}

      {current && (
        <div className="modal-mask" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="案例详情">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <b style={{ fontFamily: 'var(--font-classical)', fontSize: 18 }}>{ART_NAMES[current.artType]} · {current.question.summary}</b>
              <button className="btn sm ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="muted small">{new Date(current.createdAt).toLocaleString('zh-CN')} · 完整盘面与断语均已存档，可按原样还原</div>
            <hr className="sep" />
            <RuleHits hits={current.result.ruleHits} fromCaseId={current.caseId} />
            {current.result.evidenceRefs.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <b className="small">全部出处（点击跳书阁高亮原文）：　</b>
                {current.result.evidenceRefs.map((c: CitationRef, i: number) => <CitationBadge key={i} citation={c} from={current.caseId} />)}
              </div>
            )}
            <hr className="sep" />
            <AnnotationPanel rec={current} onChanged={() => toast('标注已保存')} quota={quota} />
          </div>
        </div>
      )}
    </div>
  );
}

function AnnotationPanel({ rec, onChanged, quota }: { rec: CaseRecord; onChanged: () => void; quota: QuotaSettings }) {
  const ann = rec.annotation;
  const [note, setNote] = useState(ann.note ?? '');
  const [takeaway, setTakeaway] = useState(ann.keyTakeaway ?? '');
  const [outcome, setOutcome] = useState(ann.outcome?.result ?? '');
  const [rating, setRating] = useState(ann.rating ?? 0);
  const patch = async (p: Partial<UserAnnotation>) => { await updateAnnotation(rec.caseId, p); onChanged(); };

  return (
    <div>
      <b className="small">主动标注（本地闭环：只校准你的解释习惯，绝不回写排盘层）</b>
      <div className="row wrap" style={{ margin: '8px 0' }}>
        {PRESETS.map(t => (
          <button key={t} className={`btn sm ${ann.presetTags.includes(t) ? 'primary' : ''}`}
            onClick={() => patch({ presetTags: ann.presetTags.includes(t) ? ann.presetTags.filter(x => x !== t) : [...ann.presetTags, t] })}>{t}</button>
        ))}
      </div>
      <div className="grid2">
        <label className="field"><span>结果反馈</span>
          <select className="select" value={outcome} onChange={e => {
            const v = e.target.value as UserAnnotation['outcome'] extends undefined ? never : '应验' | '部分应验' | '未应验' | '无法判断';
            setOutcome(v);
            if (v) patch({ outcome: { result: v, at: new Date().toISOString() } });
          }}>
            <option value="">— 未回标 —</option>
            <option>应验</option><option>部分应验</option><option>未应验</option><option>无法判断</option>
          </select>
        </label>
        <label className="field"><span>评分（1–5）</span>
          <select className="select" value={rating} onChange={e => { const v = Number(e.target.value) as 1 | 2 | 3 | 4 | 5; setRating(v); if (v) patch({ rating: v }); }}>
            <option value={0}>—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
          </select>
        </label>
      </div>
      <label className="field"><span>备注</span>
        <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== ann.note && patch({ note })} placeholder="自由备注（Markdown）" />
      </label>
      <label className="field"><span>这次学到了什么（keyTakeaway）</span>
        <input className="input" value={takeaway} onChange={e => setTakeaway(e.target.value)} onBlur={() => takeaway !== ann.keyTakeaway && patch({ keyTakeaway: takeaway })} />
      </label>
      <div className="row wrap">
        {rec.status !== 'archived'
          ? <button className="btn sm" onClick={async () => { await setStatus(rec.caseId, 'archived'); onChanged(); }}>归档（不计配额，可恢复）</button>
          : <button className="btn sm" onClick={async () => { await restoreFromArchive(rec.caseId); onChanged(); }}>从归档恢复</button>}
        <button className="btn sm" onClick={async () => {
          const db = getDB();
          const n = await archiveOldest(rec.artType, quota.autoArchiveThreshold);
          n > 0 ? onChanged() : null;
          await db.cases.delete(rec.caseId);
          location.reload();
        }}>删除此条</button>
        <a className="btn sm" href={`#/case-board/${rec.caseId}`}>一键还原当时盘面</a>
      </div>
    </div>
  );
}
