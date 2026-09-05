/** 典籍查阅器（§9）：书架 / 目录树 / 正文 / 全书搜索 / 批注 / 反查 / 阅读进度 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LEVEL_META, type UserNote, type ReadingProgress } from '@xuanshu/reader';
import { bm25Search, foldForSearch, foldVariants, VARIANT_CHARS, VARIANTS, GLOSSARY, GLOSSARY_TERMS, ALL_TERM_TEACH_KEYS, TERM_TEACH_ART_FALLBACK, BASE_TERM_FALLBACK, BOOK_CATALOG, WUSHU_CATEGORIES, CORPUS_STATUS_LABEL, CORPUS_STATUS_DESCRIPTION, corpusStatusOf, corpusIdOf, catalogContainsCorpus, searchBooks, termHitsIn, BOOK_IMAGES, type KBDocument, type BookEntry, type WushuCategory } from '@xuanshu/knowledge';
import { ART_NAMES } from '@xuanshu/core';
import { useApp } from './state';
import { useQuery } from './router';

/** 检索结果摘要：命中词高亮（归一文本上定位，跳转仍定位原文段） */
function highlightSnippet(text: string, matched: string[]): React.ReactNode {
  const t = foldForSearch(text);
  let start = -1;
  for (const m of matched) {
    if (m.length < 2) continue;
    const i = t.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) start = i;
  }
  const from = Math.max(0, (start < 0 ? 0 : start) - 6);
  const win = t.slice(from, from + 34);
  const parts = win.split(new RegExp('(' + matched.filter(m => m.length >= 2).map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\/** 阅读视图：扫描转录文（原文异体原样）')).join('|') + ')', 'g'));
  return <>{from > 0 ? '…' : ''}{parts.map((p, i) => matched.includes(p) ? <mark key={i}>{p}</mark> : p)}{from + 34 < t.length ? '…' : ''}</>;
}

/** 阅读视图：扫描转录文（原文异体原样）/ 校准文（异体归一）/ 注释文（术语注释）/ 白话文（术语白话对照） */
type ReadView = 'scan' | 'collated' | 'annotated' | 'vernacular';
const VIEW_META: Array<{ key: ReadView; label: string; desc: string }> = [
  { key: 'scan', label: '扫描文', desc: '来源转录原样，保留罕见异体字（悬停见正字）' },
  { key: 'collated', label: '校准文', desc: '异体字归一为通行正字后的文本' },
  { key: 'annotated', label: '注释文', desc: '校准文 + 术语注释（点词看注）' },
  { key: 'vernacular', label: '白话文', desc: '术语白话对照，非逐句翻译' },
];

/** 术语旁路GLOSSARY(800+) ∪ 术语讲辑词（兜底词），长词优先匹配 */
const TERM_LOOKUP_ALL: Record<string, { plain?: string; note?: string }> = (() => {
  const base = { ...(GLOSSARY as Record<string, { plain?: string; note?: string }>) };
  for (const m of Object.values(TERM_TEACH_ART_FALLBACK)) {
    for (const [k, v] of Object.entries(m)) if (!base[k]) base[k] = v;
  }
  for (const [k, v] of Object.entries(BASE_TERM_FALLBACK)) if (!base[k]) base[k] = v;
  return base;
})();
const GLOSS_RE = new RegExp('(' + [...new Set([...GLOSSARY_TERMS, ...ALL_TERM_TEACH_KEYS])]
  .filter(t => t.length >= 2)
  .sort((a, b) => b.length - a.length)
  .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|') + ')', 'g');
/** 本段是否有可解释术语（快速短路，避免全文正则） */
function hasTerm(text: string): boolean {
  return GLOSSARY_TERMS.some(t => text.includes(t)) || ALL_TERM_TEACH_KEYS.some(t => text.includes(t));
}

/** 注释文：术语点选后展开注释（移动端无 hover 也可用） */
function withAnnotations(text: string, onPick: (t: string) => void): React.ReactNode {
  if (!hasTerm(text)) return text;
  return text.split(GLOSS_RE).map((part, i) =>
    TERM_LOOKUP_ALL[part]
      ? <span key={i} role="button" tabIndex={0} className="anno-term" title={part + '：' + (TERM_LOOKUP_ALL[part].note || TERM_LOOKUP_ALL[part].plain)}
          onClick={() => onPick(termEscape(part))} onKeyDown={e => { if (e.key === 'Enter') onPick(termEscape(part)); }}>{part}</span>
      : part,
  );
}
const termEscape = (t: string) => t;

/** 白话对照：术语替换为其白话短义（确定性生成，非逐句翻译） */
function vernacularize(text: string): string {
  return text.split(GLOSS_RE).map(part => TERM_LOOKUP_ALL[part] ? '【' + part + '→' + TERM_LOOKUP_ALL[part].plain + '】' : part).join('');
}

/** 异体字悬浮提示：保留原字（文献忠实），title 给出通行正字（§9 阅读辅助） */
const VAR_SPLIT = new RegExp('([' + VARIANT_CHARS.map(c => '\\u{' + c.codePointAt(0)!.toString(16) + '}').join('') + '])', 'gu');
function withVariantHints(text: string): React.ReactNode {
  if (!VARIANT_CHARS.some(c => text.includes(c))) return text;
  return text.split(VAR_SPLIT).map((part, i) =>
    VARIANTS[part]
      ? <span key={i} className="var-char" title={'异体字，通行作「' + VARIANTS[part] + '」'} style={{ borderBottom: '1px dotted var(--gold)', cursor: 'help' }}>{part}</span>
      : part,
  );
}
export function ReaderView({ initialCanonical, openNoteDraft }: { initialCanonical?: string; openNoteDraft?: { segId: string; quote: string; fromCaseId?: string } | null }) {
  const { corpus, kbIndex, toast } = useApp();
  const q = useQuery();
  const canonical = initialCanonical ?? q.get('book') ?? undefined;
  const targetSeg = q.get('seg') ?? undefined;
  const hl = q.get('hl') ?? undefined;
  const fromParam = q.get('from') ?? undefined;
  const fromLabel = q.get('book') ? '' : fromParam;

  const [bookId, setBookId] = useState<string | undefined>(canonical);
  const [currentSeg, setCurrentSeg] = useState<string | undefined>(targetSeg);
  const [searchText, setSearchText] = useState('');
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [noteDraft, setNoteDraft] = useState<{ docId: string; segId: string; text: string; range: [number, number]; note?: string } | null>(openNoteDraft ? { docId: '', segId: openNoteDraft.segId, text: openNoteDraft.quote, range: [0, openNoteDraft.quote.length] } : null);
  const segRefs = useRef(new Map<string, HTMLDivElement>());
  const [view, setView] = useState<ReadView>(() => (localStorage.getItem('xuanshu.readview') as ReadView) || 'collated');
  useEffect(() => { localStorage.setItem('xuanshu.readview', view); }, [view]);
  const [annoTerm, setAnnoTerm] = useState<{ term: string; segId: string } | null>(null);
  // 五术书库：类别筛选 / 检索 / 书录卡
  const [cat, setCat] = useState<'全部' | WushuCategory>('全部');
  const [bookQ, setBookQ] = useState('');
  const [catalogPopup, setCatalogPopup] = useState<BookEntry | null>(null);
  // R8 阅读体验：字号调节 / 继续上次阅读
  const [fontSize, setFontSize] = useState<number>(() => Number(localStorage.getItem('xuanshu.readerFont')) || 17.5);
  useEffect(() => { localStorage.setItem('xuanshu.readerFont', String(fontSize)); }, [fontSize]);
  useEffect(() => {
    if (!bookId) return;
    const last = localStorage.getItem('xuanshu.lastread.' + bookId);
    if (last) setCurrentSeg(last);
  }, [bookId]);
  useEffect(() => {
    if (bookId && currentSeg) localStorage.setItem('xuanshu.lastread.' + bookId, currentSeg);
  }, [bookId, currentSeg]);
  const exportBookTxt = () => {
    if (!bookId) return;
    const docsAll = corpus.byCanonical(bookId);
    const head = docsAll[0]?.book ?? bookId;
    const lines = docsAll.map(d => `【${d.chapter}】${d.text}`);
    const blob = new Blob([`${head}\n\n${lines.join('\n\n')}\n\n—— 导出自玄枢工作台（公有领域语料）`], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${head}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const books = useMemo(() => {
    const map = new Map<string, { canonicalId: string; book: string; count: number; level: string; chapters: Set<string> }>();
    for (const d of corpus.all()) {
      const b = map.get(d.canonicalId) ?? { canonicalId: d.canonicalId, book: d.book, count: 0, level: d.confidenceLevel, chapters: new Set<string>() };
      b.count++; b.chapters.add(d.volume ? `${d.volume}·${d.chapter}` : d.chapter);
      map.set(d.canonicalId, b);
    }
    return [...map.values()];
  }, [corpus]);

  const docs = useMemo(() => bookId ? corpus.byCanonical(bookId) : [], [corpus, bookId]);

  // 目录树：卷 → 章
  const toc = useMemo(() => {
    const seen = new Map<string, KBDocument>();
    const list: Array<{ key: string; label: string; segId: string; lv: 1 | 2 }> = [];
    for (const d of docs) {
      const chKey = `${d.volume}|${d.chapter}`;
      if (!seen.has(chKey)) {
        seen.set(chKey, d);
        if (d.volume) list.push({ key: chKey + '|v', label: d.volume, segId: d.segId, lv: 1 });
        list.push({ key: chKey, label: (d.volume ? '　' : '') + d.chapter, segId: d.segId, lv: d.volume ? 2 : 1 });
      }
    }
    return list;
  }, [docs]);

  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem('xuanshu.notes') ?? '[]')); } catch { setNotes([]); }
  }, []);
  useEffect(() => { localStorage.setItem('xuanshu.notes', JSON.stringify(notes)); }, [notes]);

  // 跳转定位 + 高亮（L1 charRange 主机制）
  useEffect(() => {
    if (!currentSeg) return;
    const t = setTimeout(() => {
      const el = segRefs.current.get(currentSeg);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 2600);
      }
    }, 80);
    return () => clearTimeout(t);
  }, [currentSeg, docs]);

  useEffect(() => { if (targetSeg) setCurrentSeg(targetSeg); }, [targetSeg]);

  const searchHits = useMemo(() => {
    if (!searchText.trim()) return [];
    return bm25Search(kbIndex, searchText, { topK: 10 }).filter(h => !bookId || h.doc.canonicalId === bookId);
  }, [searchText, kbIndex, bookId]);

  const highlightRange = hl ? (hl.split('-').map(Number) as [number, number]) : undefined;

  const renderSeg = (d: KBDocument) => {
    const isCur = d.segId === currentSeg;
    const base = view === 'scan' ? d.text : (view === 'collated') ? foldVariants(d.text) : (view === 'annotated') ? foldVariants(d.text) : vernacularize(foldVariants(d.text));
    let text: React.ReactNode = view === 'scan' ? withVariantHints(d.text)
      : view === 'annotated' ? withAnnotations(base, t => setAnnoTerm({ term: t, segId: d.segId }))
      : base;
    if (isCur && highlightRange && highlightRange[1] <= d.text.length) {
      text = <>{d.text.slice(0, highlightRange[0])}<mark>{d.text.slice(highlightRange[0], highlightRange[1])}</mark>{d.text.slice(highlightRange[1])}</>;
    } else if (noteDraft?.segId === d.segId) {
      text = <>{d.text.slice(0, noteDraft.range[0])}<mark>{d.text.slice(noteDraft.range[0], noteDraft.range[1])}</mark>{d.text.slice(noteDraft.range[1])}</>;
    }
    const segNotes = notes.filter(n => n.segId === d.segId);
    const vernacularHits = view === 'vernacular' ? termHitsIn(d.text, 5) : [];
    return (
      <div key={d.docId} ref={el => { if (el) segRefs.current.set(d.segId, el); }} id={`seg-${d.segId}`}>
        {view === 'vernacular' && vernacularHits.length > 0 && (
          <div className="notice info small" style={{ marginBottom: 6 }} role="status" aria-label="段落白话导读">
            <b>白话导读 · 本段术语</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {vernacularHits.map(h => (
                <li key={h.term}><b>{h.term}</b>：{h.plain}</li>
              ))}
            </ul>
          </div>
        )}
        <div className={`reader-seg ${isCur ? 'flash' : ''}`}>
          {text}
          <span className="seg-tools">
            <button className="btn sm ghost" title="划词批注（将随下次排盘命中该段时回显）"
              onClick={() => {
                const sel = window.getSelection()?.toString() ?? '';
                const start = sel && d.text.includes(sel) ? d.text.indexOf(sel) : 0;
                const quote = sel || d.text.slice(0, 30);
                setNoteDraft({ docId: d.docId, segId: d.segId, text: quote, range: [start, start + quote.length] });
              }}>批注</button>
            <button className="btn sm ghost" title="复制引用">被引用 (0)</button>
          </span>
        </div>
        {segNotes.map(n => (
          <div key={n.id} className="note-item small">
            <span className="tag gold">我的批注</span> {n.note}
            {n.fromCaseId && <span className="muted">（来自卦例 {n.fromCaseId.slice(0, 8)}）</span>}
          </div>
        ))}
      </div>
    );
  };

  if (!bookId) {
    const corpusIds = new Set(books.map(b => b.canonicalId));
    // 语料里有但目录未收录的书：兜底补进书单（默认归“卜·内置语料”）
    const extras: BookEntry[] = books
      .filter(b => !catalogContainsCorpus(b.canonicalId))
      .map(b => ({ id: b.canonicalId, title: b.book.replace(/（.*?）/, ''), category: '卜' as WushuCategory, sub: '内置语料', hasCorpus: true, note: '已内置全文语料，可在书阁精读。', art: [] }));
    const q = bookQ.trim();
    const inCat = cat === '全部' ? BOOK_CATALOG : BOOK_CATALOG.filter(b => b.category === cat);
    const shown = q
      ? searchBooks(q).filter(b => cat === '全部' || b.category === cat)
      : (cat === '全部' ? [...inCat, ...extras] : inCat);
    // 子类分组（同一类别下按 sub 分组展示）
    const groups = new Map<string, BookEntry[]>();
    for (const b of shown) {
      if (!groups.has(b.sub)) groups.set(b.sub, []);
      groups.get(b.sub)!.push(b);
    }
    const openBook = (b: BookEntry) => {
      const cid = corpusIdOf(b);
      if (b.hasCorpus && corpusIds.has(cid)) { setBookId(cid); setCurrentSeg(undefined); setBookQ(''); }
      else setCatalogPopup(b);
    };
    const catCount = (c: '全部' | WushuCategory) => c === '全部' ? BOOK_CATALOG.length : BOOK_CATALOG.filter(b => b.category === c).length;
    return (
      <div>
        <div className="page-head"><div className="page-title">书阁 · 五术书库</div><div className="page-desc">山医命相卜 {BOOK_CATALOG.length} 部书目 · 全文、相关原典、扫描与存佚状态均据实标注</div></div>
        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
          <span className="tag clickable" style={{ padding: '4px 12px', fontWeight: cat === '全部' ? 700 : 400, background: cat === '全部' ? 'var(--gold-soft)' : undefined }} onClick={() => setCat('全部')}>全部（{catCount('全部')}）</span>
          {WUSHU_CATEGORIES.map(c => (
            <span key={c} className="tag clickable" style={{ padding: '4px 12px', fontWeight: cat === c ? 700 : 400, background: cat === c ? 'var(--gold-soft)' : undefined }} onClick={() => setCat(c)}>{c}（{catCount(c)}）</span>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 420, marginBottom: 12 }} placeholder="在书目中检索（书名 / 作者 / 类别 / 概述）" value={bookQ} onChange={e => setBookQ(e.target.value)} aria-label="书目检索" />
        {books.length === 0 && <div className="notice warn">书阁暂无语料。运行语料采集（data/.kb/books/）或导入书库后，这里会出现典籍书架。</div>}
        {Array.from(groups.entries()).map(([sub, arr]) => (
          <div key={sub} style={{ marginBottom: 14 }}>
            <div className="small" style={{ fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>{cat === '全部' ? '◆' : cat} · {sub}</div>
            <div className="book-grid">
              {arr.map(b => {
                const cid = corpusIdOf(b);
                const has = b.hasCorpus && corpusIds.has(cid);
                const status = corpusStatusOf(b);
                return (
                  <button key={b.id} className="card book-card" onClick={() => openBook(b)} aria-label={`打开《${b.title}》`}>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="book-cover">{b.title.replace(/[《》·]/g, '').slice(0, 2)}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-classical)', fontSize: 15 }}>{b.title}</div>
                        <div className="muted small">{b.era ?? ''}{b.author ? `｜${b.author}` : ''}</div>
                        <div className="row wrap" style={{ gap: 4, marginTop: 3 }}>
                          <span className={`tag ${has ? (status === 'full' ? 'green' : 'gold') : 'dai'}`} style={{ fontSize: 11 }}>{CORPUS_STATUS_LABEL[status]}</span>
                          {(b.art ?? []).map(a => <span key={a} className="tag gold" style={{ fontSize: 11 }}>{ART_NAMES[a as never] ?? a}</span>)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {catalogPopup && (
          <div className="modal-mask" style={{ zIndex: 80, alignItems: 'flex-start', paddingTop: 40 }} onClick={() => setCatalogPopup(null)}>
            <div className="modal" style={{ maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h3 className="card-title">🗂 书目详情 ·《{catalogPopup.title}》
                <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setCatalogPopup(null)}>✕ 关闭</button>
              </h3>
              <div className="muted small">定位：{catalogPopup.category}·{catalogPopup.sub}{catalogPopup.era ? ` ｜ ${catalogPopup.era}` : ''}{catalogPopup.author ? ` ｜ ${catalogPopup.author}` : ''}</div>
              <div style={{ marginTop: 8, lineHeight: 1.75 }}>{catalogPopup.note}</div>
              {catalogPopup.sourceNote && <div className="notice info" style={{ marginTop: 10 }}><b>版本与存佚：</b>{catalogPopup.sourceNote}</div>}
              {(catalogPopup.sources ?? []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>核验来源</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {catalogPopup.sources!.map(source => <a key={source.url} className="btn sm ghost" href={source.url} target="_blank" rel="noreferrer" title={source.note}>{source.label} ↗</a>)}
                  </div>
                </div>
              )}
              {((catalogPopup.art ?? []).length > 0 || ((catalogPopup.terms ?? []).filter(t => GLOSSARY[t]).length > 0)) && (
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {(catalogPopup.art ?? []).map(a => <a key={a} className="btn sm" href={`#/cast?art=${a}`}>用{ART_NAMES[a as never] ?? a}起卦 ↗</a>)}
                  {(catalogPopup.terms ?? []).filter(t => GLOSSARY[t]).slice(0, 8).map(t => (
                    <span key={t} className="tag dai clickable" title={(GLOSSARY[t] as { plain?: string }).plain} onClick={() => setBookQ(t)}>{t}</span>
                  ))}
                </div>
              )}
              <div className="notice info" style={{ marginTop: 12 }}><b>{CORPUS_STATUS_LABEL[corpusStatusOf(catalogPopup)]}：</b>{CORPUS_STATUS_DESCRIPTION[corpusStatusOf(catalogPopup)]}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const curBook = books.find(b => b.canonicalId === bookId);
  const levelMeta = LEVEL_META[curBook?.level ?? 'C'] ?? LEVEL_META.C;

  return (
    <div>
      <div className="page-head">
        <button className="btn sm ghost" onClick={() => setBookId(undefined)}>← 书架</button>
        <div className="page-title">{curBook?.book ?? bookId}</div>
        <span className="cit-badge" style={{ color: levelMeta.color }}>{levelMeta.label}</span>
        <span className="muted small">{docs.length} 段</span>
        {fromLabel && <span className="tag dai">来自：{decodeURIComponent(fromLabel)}</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <button className="btn sm ghost" aria-label="缩小字号" onClick={() => setFontSize(v => Math.max(14, Math.round((v - 1) * 2) / 2))}>A－</button>
          <span className="muted small" aria-live="polite">{fontSize}px</span>
          <button className="btn sm ghost" aria-label="放大字号" onClick={() => setFontSize(v => Math.min(24, Math.round((v + 1) * 2) / 2))}>A＋</button>
          <button className="btn sm ghost" onClick={exportBookTxt} title="导出全书为 TXT（公有领域语料）">导出 TXT</button>
        </span>
      </div>
      <div className="view-switch" role="tablist" aria-label="阅读视图">
        {VIEW_META.map(v => (
          <button key={v.key} role="tab" aria-selected={view === v.key} title={v.desc}
            className={`btn sm ${view === v.key ? 'primary' : 'ghost'}`} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
        <span className="muted small" style={{ marginLeft: 6 }}>{VIEW_META.find(v => v.key === view)?.desc}</span>
      </div>
      {annoTerm && (() => {
        const e = TERM_LOOKUP_ALL[annoTerm.term];
        if (!e) return null;
        return (
        <div className="notice info anno-panel" role="status">
          <b>{annoTerm.term}</b>｜{e.note || e.plain}
          {e.note && <div className="muted small" style={{ marginTop: 2 }}>白话：{e.plain}</div>}
          <div className="muted small" style={{ marginTop: 2 }}>{GLOSSARY[annoTerm.term] ? '' : '来自术语讲辑词库（与主流典籍一致）'}</div>
          <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setAnnoTerm(null)}>收起</button>
        </div>
        );
      })()}
      {view === 'vernacular' && <div className="notice warn small">白话文为术语白话对照（确定性生成，非逐句翻译）；原义以左侧原文为准。</div>}
      {(() => { const imgs = BOOK_IMAGES[bookId!]; if (!imgs || imgs.length === 0) return null; return (
        <div className="card" style={{ marginTop: 10, padding: 10 }}>
          <div className="small" style={{ fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>📖 本卷配图 · {imgs.length} 幅</div>
          <div className="row wrap" style={{ gap: 10 }}>
            {imgs.map((img, i) => (
              <figure key={i} style={{ margin: 0, maxWidth: 240 }}>
                <img src={img.src} alt={img.alt} loading="lazy" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)' }} />
                <figcaption className="muted small">
                  {img.alt}
                  {img.source && <div>{img.source}{img.license ? ` · ${img.license}` : ''}</div>}
                  {img.note && <div>{img.note}</div>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ); })()}
      <div className="reader-layout">
        <div className="reader-toc">
          <label className="field"><span>全书搜索</span>
            <input className="input" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="关键词（BM25）" aria-label="全书搜索" />
          </label>
          {searchHits.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
              {searchHits.map(h => (
                <button key={h.doc.docId} className="toc-item lv3" onClick={() => { setCurrentSeg(h.doc.segId); setSearchText(''); }}>
                  <span className="muted">{h.doc.chapter}</span>｜{highlightSnippet(h.doc.text, h.matched)}
                </button>
              ))}
            </div>
          )}
          <div style={{ maxHeight: 52, overflow: 'hidden' }} />
          {toc.map(item => (
            <button key={item.key + item.segId} className={`toc-item lv${item.lv} ${item.segId === currentSeg ? 'on' : ''}`}
              onClick={() => setCurrentSeg(item.segId)}>{item.label}</button>
          ))}
        </div>
        <div className="reader-body" style={{ fontSize }}>
          {noteDraft && (
            <div className="card" style={{ marginBottom: 14 }}>
              <b className="small">划词批注（自动带 CitationRef，存本地）</b>
              <div className="quote-block" style={{ margin: '6px 0' }}>{noteDraft.text}</div>
              <textarea className="textarea" value={noteDraft.note ?? ''} onChange={e => setNoteDraft({ ...noteDraft, note: e.target.value })} placeholder="写下你的理解——下次排盘命中该段时，批注会随原文一起出现" aria-label="批注内容" />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn primary sm" onClick={() => {
                  if (!noteDraft.note?.trim()) { toast('批注内容为空'); return; }
                  const doc = corpus.get(noteDraft.docId) ?? docs.find(d => d.segId === noteDraft.segId);
                  const n: UserNote = {
                    id: String(Date.now()), docId: doc?.docId ?? noteDraft.docId, canonicalId: doc?.canonicalId ?? bookId ?? '',
                    segId: noteDraft.segId, charRange: noteDraft.range, quoted: noteDraft.text,
                    note: noteDraft.note, createdAt: new Date().toISOString(), fromCaseId: fromParam,
                  };
                  setNotes(ns => [...ns, n]);
                  setNoteDraft(null); toast('批注已保存，将随断语回显');
                }}>保存批注</button>
                <button className="btn sm" onClick={() => setNoteDraft(null)}>取消</button>
              </div>
            </div>
          )}
          {docs.map(renderSeg)}
          <div className="muted small" style={{ textAlign: 'center', padding: '18px 0' }}>—— 已读完本书 {docs.length} 段 ——</div>
        </div>
      </div>
    </div>
  );
}
