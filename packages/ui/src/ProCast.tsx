/** 专业自选模式（#/pro）：跳过向导，自选术数与起卦方式直接排盘——与向导共用同一排盘/解释层 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ART_LIST, ART_NAMES, ART_TAGLINES, defaultConfig, stableHash,
  type ArtType, type RawInput, type CategoryId,
} from '@xuanshu/core';
import { composeAnswer, type ComposedAnswer } from '@xuanshu/answer';
import { searchWithBoost } from '@xuanshu/knowledge';
import { saveCase, checkQuotaBeforeWrite, findDuplicate } from '@xuanshu/ledger';
import { useApp, ART_META } from './state';
import { BoardRenderer, ExplainerPopup, type PopupState, TimeInfoStrip, GlossarySearchPanel, ClassicTextCard, YearlyReportCard, YingQiBoard, type YingQiTarget, TimingBanner, TermTeachCard, type TermTeachArt, PaipanTutorialCard, TimeCalibrateRow, buildPromptSnapshot, DiFenPicker, LocationPickRow } from './boards';
import { callAIStrict } from '@xuanshu/ai';
import { RuleHits, AnswerPanel, AiQuickBar, AIResultModal } from './components';
import { exportBoardImage, exportAlbum } from './exportBoard';
import { BaziTrend } from './BaziTrend';
import { ZiweiTimeline } from './ZiweiTimeline';
import { runCast, calibNow, fmtClock, type CastResult } from './castShared';
import { QUESTION_TEMPLATES, oneLineHuman } from './engage';
import { DateTimePick } from './DateTimePick';

type Method = 'time' | 'numbers' | 'coins' | 'text' | 'hexagram';

const METHODS: Record<ArtType, Array<{ key: string; label: string }>> = {
  bazi: [{ key: 'time', label: '生辰（公历）' }],
  ziwei: [{ key: 'time', label: '生辰（公历）' }],
  liuyao: [{ key: 'time', label: '时间卦' }, { key: 'numbers', label: '报数' }, { key: 'coins', label: '指定六爻' }],
  meihua: [{ key: 'time', label: '时间卦' }, { key: 'numbers', label: '报数' }, { key: 'text', label: '字占' }],
  qimen: [{ key: 'time', label: '当前时刻起局' }],
  liuren: [{ key: 'time', label: '当前时刻起课' }],
  xiaoliuren: [{ key: 'time', label: '当前时刻递推' }, { key: 'numbers', label: '报三个数' }],
  jinkou: [{ key: 'time', label: '当前时刻起课' }],
};

const CATEGORIES_OPT: CategoryId[] = ['求财', '事业', '感情', '学业', '健康', '出行', '官非', '失物', '择日', '家宅', '生育', '合作', '决策', '其他'];

export function ProCast({ initialArt }: { initialArt?: ArtType }) {
  const { config, setConfig, kbIndex, toast, ai, settings, requestAISetup } = useApp();
  // AI 精解状态（自带 Key；默认关闭；默认不自动调用）
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const askAI = async () => {
    if (!ai.enabled) { requestAISetup(); return; }
    if (!cast) return;
    setAiBusy(true); setAiErr(null); setAiText(null);
    try {
      const user = buildPromptSnapshot(cast, art, birth, { gender, category, question, timeLabel: fmtClock(birth) });
      const r = await callAIStrict(ai, user);
      if (r.ok) setAiText(r.text ?? '（AI 未返回内容）');
      else {
        const msg = r.error ?? '调用失败';
        setAiErr(msg);
        toast(`AI 辅助解读失败：${msg}`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setAiErr(msg);
      toast(`AI 辅助解读失败：${msg}`);
    }
    finally { setAiBusy(false); }
  };
  // 外部 hash 直达 art 变化（如 #/pro?art=x 切换）时同步内部状态（不依赖组件重挂）
  const [art, setArt] = useState<ArtType>(initialArt ?? 'bazi');
  const [method, setMethod] = useState<Method>('time');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncArt = () => {
    const m = new URLSearchParams((typeof location !== 'undefined' ? location.hash.split('?')[1] : '') ?? '');
    const q = m.get('art');
    if (q && q !== art) {
      setArt(q as ArtType);
      setMethod(METHODS[q as ArtType]?.[0]?.key as Method ?? 'time');
      setCast(null); setAnswer(null); setSaved(null);
    }
  };
  useEffect(() => {
    syncArt();
    window.addEventListener('hashchange', syncArt);
    return () => window.removeEventListener('hashchange', syncArt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art]);
  const [cast, setCast] = useState<CastResult | null>(null);
  const [answer, setAnswer] = useState<ComposedAnswer | null>(null);
  const [category, setCategory] = useState<CategoryId>('其他');
  const [question, setQuestion] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  // 切到时间型术数/时间法时，刷新一次起局时刻为校准后的当前时刻（用户后续可手动改，不被反复覆盖）
  const timeSynced = useRef('');
  useEffect(() => {
    const k = `${art}:${method}`;
    const timeCast = ['qimen', 'liuren', 'jinkou'].includes(art as string)
      || (['liuyao', 'meihua', 'xiaoliuren'].includes(art as string) && method === 'time');
    if (!timeCast || timeSynced.current === k) return;
    timeSynced.current = k;
    setBirth({ ...calibNow(config) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, method]);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  //  应期目标（与合参页同一逻辑：六爻取动爻/用神，奇门大六壬取马星+空亡）
  const yqTargets = useMemo<YingQiTarget[]>(() => {
    const ch = (cast?.chart ?? {}) as { lines?: Array<{ moving?: boolean; branch?: string; index?: number }>; yongShenInfo?: { lineIdx?: number; name?: string } };
    const ts: YingQiTarget[] = [];
    if (art === 'liuyao') {
      (ch.lines ?? []).forEach((ln, i) => { if (ln?.moving && ln.branch) ts.push({ label: `动爻${i + 1}`, zhis: [ln.branch] }); });
      const yi = ch.yongShenInfo?.lineIdx;
      if (yi != null && ch.lines?.[yi]?.branch) ts.push({ label: ch.yongShenInfo?.name ?? '用神', zhis: [ch.lines[yi].branch ?? ''] });
    }
    if (art === 'qimen' || art === 'liuren') ts.push({ label: '马星', zhis: ['寅', '申', '巳', '亥'] });
    return ts;
  }, [cast, art]);
  // 生辰：优先取「设置 → 预设个人生辰」，否则当前校准时刻
  const [birth, setBirth] = useState(() => {
    if (settings.birth) return { year: settings.birth.year, month: settings.birth.month, day: settings.birth.day, hour: settings.birth.hour, minute: settings.birth.minute };
    const n = calibNow(config); return { year: n.year, month: n.month, day: n.day, hour: n.hour, minute: n.minute };
  });
  const [gender, setGender] = useState<'男' | '女'>(settings.birth?.gender ?? '男');
  const [hourMissing, setHourMissing] = useState(false);
  // 报数/字占/指定爻
  const [numbers, setNumbers] = useState('');
  const [text, setText] = useState('');
  const [coins, setCoins] = useState<number[]>([3, 2, 1, 1, 2, 3]);
  const [diFen, setDiFen] = useState('午');

  const cfg = useMemo(() => ({ ...config, category }), [config, category]);

  const buildInput = (): RawInput => {
    const base: RawInput = { time: { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, minute: birth.minute }, gender, hourMissing } as never;
    switch (art) {
      case 'bazi':
      case 'ziwei':
        return base;
      case 'liuyao':
        if (method === 'numbers') return { ...base, method: 'numbers', numbers: numbers.trim().split(/\s+/).map(Number).filter(n => !Number.isNaN(n)) } as never;
        if (method === 'coins') return { ...base, method: 'coins', coins } as never;
        return base; // 时间卦（coins 留空时 runCast 走时间）
      case 'meihua':
        if (method === 'numbers') return { ...base, method: 'numbers', numbers: numbers.trim().split(/\s+/).map(Number).filter(n => !Number.isNaN(n)) } as never;
        if (method === 'text') return { ...base, method: 'text', text } as never;
        return { ...base, method: 'time' } as never;
      case 'xiaoliuren':
        if (method === 'numbers') return { ...base, method: 'numbers', numbers: numbers.trim().split(/\s+/).map(Number).filter(n => !Number.isNaN(n)) } as never;
        return base;
      case 'jinkou':
        return { ...base, diFen } as never;
      default:
        return base;
    }
  };

  const doCast = () => {
    try {
      const input = buildInput();
      const r = runCast(art, input, cfg);
      setCast(r);
      const knowledgeHits = searchWithBoost(kbIndex, `${question} ${category}`, category).slice(0, 5)
        .map(h => ({ citation: { canonicalId: h.doc.canonicalId, book: h.doc.book, chapter: h.doc.chapter, segId: h.doc.segId, quote: h.doc.text.slice(0, 120), confidenceLevel: h.doc.confidenceLevel as never }, score: h.score }));
      setAnswer(composeAnswer({
        art, category, question, facts: r.facts,
        rules: r.rules, timing: r.timing, knowledge: knowledgeHits, warnings: r.warnings,
      }));
      setSaved(null);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const save = async () => {
    if (!cast) return;
    const hash = stableHash(cfg);
    try {
      const dup = await findDuplicate(hash, question || `${category}·${ART_NAMES[art]}`);
      if (dup) { toast('5 分钟内已有同配置同问题的记录，避免重复起卦'); return; }
      await checkQuotaBeforeWrite(art);
      const rec = await saveCase({
        caseId: '', createdAt: new Date().toISOString(),
        artType: art, category, question: { category, text: question, summary: question || `${category}·${ART_NAMES[art]}` },
        input: { raw: buildInput(), normalized: (cast.chart as { normalized: never }).normalized, config: cfg, configHash: hash, engineVersion: 'xuanshu-core@1.0.0' },
        result: { chart: cast.chart, ruleHits: cast.rules, warnings: cast.warnings, evidenceRefs: cast.rules.flatMap(r => r.citations ?? []), boardHash: stableHash(cast.board) },
        degraded: hourMissing,
      });
      setSaved(rec.caseId);
      toast('已存入案例本');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const inputLabel = (): string => {
    switch (art) {
      case 'bazi': return '出生信息';
      case 'ziwei': return '出生信息（时辰关键）';
      case 'liuyao': case 'meihua': case 'xiaoliuren': return '起卦输入';
      case 'jinkou': return '来方地分';
      default: return '以当前时刻起盘';
    }
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">专业排盘 · 自选方式</div>
        <span className="tag dai">跳过向导，熟手直排；与向导共用同一引擎与解释层</span>
      </div>

      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {ART_LIST.map(a => (
            <button key={a} className={`btn sm ${art === a ? 'primary' : ''}`}
              title={ART_TAGLINES[a]}
              onClick={() => { setArt(a); setMethod(METHODS[a][0].key as Method); setCast(null); setAnswer(null); }}>
              {!ART_NAMES[a].includes(ART_META[a].icon) && <span style={{ color: ART_META[a].color }}>{ART_META[a].icon}</span> }{ART_NAMES[a]}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          {METHODS[art].length > 1 && (
            <label className="field"><span>起法</span>
              <select className="select" value={method} onChange={e => setMethod(e.target.value as Method)}>
                {METHODS[art].map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
          )}
          {(art === 'bazi' || art === 'ziwei' || method === 'time' || ['qimen', 'liuren', 'jinkou', 'xiaoliuren'].includes(art as string)) && (
            <>
              <label className="field"><span>{inputLabel()}</span>
                <DateTimePick value={birth} onChange={setBirth} />
              </label>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {hourMissing && <span className="tag xiong">时辰未知</span>}
                <label className="row" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={gender === '男'} onChange={e => setGender(e.target.checked ? '男' : '女')} />
                  <span className="small">男命（女命取消勾选）</span>
                </label>
                {(art === 'bazi' || art === 'ziwei') && (
                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={hourMissing} onChange={e => setHourMissing(e.target.checked)} />
                    <span className="small">不清楚时辰（{art === 'ziwei' ? '紫微将不完整' : '八字缺时柱'}）</span>
                  </label>
                )}
                {art !== 'bazi' && art !== 'ziwei' && (
                  <button className="btn sm" onClick={() => setBirth({ ...calibNow(config) })}>⏱ 取当前（校准后）时刻</button>
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="small" style={{ color: 'var(--ink-2)', marginBottom: 5 }}>📍 出生地（用于真太阳时换算，可留空）</div>
                <LocationPickRow />
              </div>
              {(['qimen', 'liuren', 'jinkou'].includes(art as string) || (['liuyao', 'meihua', 'xiaoliuren'].includes(art as string) && method === 'time')) && (
                <div style={{ marginTop: 8 }}>
                  <div className="muted small">起局时刻默认取校准后的当前时刻：可直接点上方时间框弹出日历改成目标时刻（或点「⏱ 取当前（校准后）时刻」刷新）；系统时间若不准，也可用下方校对条调好偏移后再取当前。</div>
                  <TimeCalibrateRow />
                </div>
              )}
            </>
          )}
          {(method === 'numbers') && (
            <label className="field"><span>报数（空格分隔，2–3 个）</span>
              <input className="input" value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="例：7 23 5" />
            </label>
          )}
          {art === 'liuyao' && method === 'coins' && (
            <div>
              <div className="small muted" style={{ marginBottom: 4 }}>自初爻至上爻（0=老阴 1=少阳 2=少阴 3=老阳）</div>
              <div className="row" style={{ gap: 6 }}>
                {coins.map((c, i) => (
                  <select key={i} className="select" style={{ width: 66 }} value={c} onChange={e => setCoins(cs => cs.map((x, j) => j === i ? +e.target.value : x))}>
                    {[0, 1, 2, 3].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}
          {art === 'meihua' && method === 'text' && (
            <label className="field"><span>字占（1–2 汉字）</span>
              <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="例：信" />
            </label>
          )}
          {art === 'jinkou' && (
            <DiFenPicker value={diFen} onChange={setDiFen} />
          )}
          {art === 'qimen' && (
            <div style={{ marginBottom: 8 }}>
              <label className="field"><span>奇门体系</span>
                <select className="select" value={config.paipan?.qimenTimeType ?? 'shi'}
                  onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenTimeType: e.target.value as 'shi' | 'ri' } })}>
                  <option value="shi">时家（精确到时辰）</option>
                  <option value="ri">日家（择日看一日大势）</option>
                </select>
              </label>
              {(config.paipan?.qimenTimeType ?? 'shi') === 'shi' && (
                <div className="grid2" style={{ gap: 6, marginTop: 6 }}>
                  <label className="field"><span>定局法</span>
                    <select className="select" value={config.paipan?.qimenJuMethod ?? 'chaibu'}
                      onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenJuMethod: e.target.value as 'chaibu' | 'zhirun' | 'maoshan' } })}>
                      <option value="chaibu">拆补</option><option value="zhirun">置闰</option><option value="maoshan">茅山</option>
                    </select>
                  </label>
                  <label className="field"><span>排布法</span>
                    <select className="select" value={config.paipan?.qimenPanType ?? 'zhuan'}
                      onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenPanType: e.target.value as 'zhuan' | 'fei' } })}>
                      <option value="zhuan">转盘</option><option value="fei">飞盘</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
          {(art === 'qimen' || art === 'liuren') && <div className="notice info">以当前时刻{art === 'qimen' ? '起局' : '起课'}，无需输入。</div>}

          <hr className="sep" />
          <label className="field"><span>占事类目（影响取用神与解释侧重）</span>
            <select className="select" value={category} onChange={e => setCategory(e.target.value as CategoryId)}>
              {CATEGORIES_OPT.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span>问句（可选，进入检索与案例本）</span>
            <textarea className="textarea" value={question} onChange={e => setQuestion(e.target.value)} placeholder="一句话说明要问什么（对象 + 时限）" />
          </label>
          {category && QUESTION_TEMPLATES[category] && (
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              <span className="muted small" style={{ alignSelf: 'center' }}>不知道怎么问？照着挑一个：</span>
              {QUESTION_TEMPLATES[category].map(t => (
                <span key={t} className="tag clickable" style={{ fontSize: 12 }} onClick={() => setQuestion(t)}>{t}</span>
              ))}
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={doCast}>起盘</button>
            {cast && <button className="btn" onClick={save}>存入案例本</button>}
            {saved && <a className="btn ghost" href={`#/case-board/${saved}`}>查看记录</a>}
          </div>
        </div>
      </div>

      {cast && (
        <div>
          <div ref={boardRef}>
            <BoardRenderer spec={cast.board} chart={cast.chart} category={category} />
          </div>
          {/*  AI 快速条：放顶部，不懂就看/复制提示词 */}
          <AiQuickBar
            onAskAI={askAI}
            aiBusy={aiBusy}
            onCopyPrompt={async () => {
              const p = buildPromptSnapshot(cast, art, birth, { gender, category, question, timeLabel: fmtClock(birth) });
              try { await navigator.clipboard.writeText(p); setExportMsg('已复制提示词（可发给任意大模型/搜索）'); setTimeout(() => setExportMsg(null), 3200); }
              catch { setExportMsg('复制失败，请检查浏览器权限'); setTimeout(() => setExportMsg(null), 3200); }
            }}
            copyMsg={exportMsg ?? undefined}
            hint="🤖 想直接听白话结论就点「AI 辅助解读」；想换别的 AI/搜索引擎接着问，就点「复制提示词」粘贴过去。"
          />
          {/* 一句人话：先给白话结论，再给依据 */}
          {cast.rules.length > 0 && (() => {
            const hl = oneLineHuman(ART_NAMES[art], cast.rules);
            return (
              <div className="card xuanshu-pop" style={{ marginTop: 10, background: 'var(--soft-d)' }}>
                <h3 className="card-title">{hl.emoji} 一句人话（结论先行）</h3>
                <div style={{ fontSize: 15, lineHeight: 1.8 }}>{hl.line}</div>
                <div className="muted small" style={{ marginTop: 4 }}>下面是依据，逐条点开看白话；想听完整长解释，用上方「AI 辅助解读」。</div>
              </div>
            );
          })()}
          {/*  专业模式对齐向导：时间条/年度报告/应期引擎/术语库/古籍卡/应期横幅 */}
          <TimeInfoStrip time={birth} />
          <YearlyReportCard birth={birth} chart={cast.chart} art={art} />
          {cast.timing?.length > 0 && (() => {
            const hits = cast.timing.map(t => ({ ruleId: t.ruleId, text: t.text, window: t.window, level: (t.confidenceLevel ?? 'B') as 'A' | 'B' | 'C' | 'D' }));
            return <TimingBanner hits={hits} artName={ART_NAMES[art]} onShowPopup={setPopup} />;
          })()}
          {yqTargets.length > 0 && (
            <YingQiBoard base={birth} targets={yqTargets} xunkong={(cast.chart as never as { xunkong?: string })?.xunkong} onShowPopup={setPopup} />
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={async () => {
              if (!boardRef.current) return;
              const msg = await exportBoardImage(boardRef.current, `xuanshu-${art ?? 'paipan'}.png`);
              setExportMsg(msg); setTimeout(() => setExportMsg(null), 3200);
            }}>导出盘面图</button>
            <button className="btn sm" onClick={async () => {
              if (!boardRef.current) return;
              const msg2 = await exportAlbum({
                board: boardRef.current,
                title: `玄枢 · ${ART_NAMES[art]}排盘结册`,
                sub: `时间：${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')} ${birth.hour == null || birth.hour < 0 ? '（缺时辰）' : `${String(birth.hour).padStart(2, '0')}:${String(birth.minute ?? 0).padStart(2, '0')}`}｜问：${(question || category || '未填')}`,
                lines: cast.rules.slice(0, 12).map(r => `【${r.level}】${r.title}：${r.fact ?? ''}`),
                tail: aiText ? `🤖 AI 辅助解读：\n${aiText.slice(0, 1200)}` : undefined,
                filename: `xuanshu-album-${art ?? 'paipan'}.png`,
              });
              setExportMsg(msg2); setTimeout(() => setExportMsg(null), 3200);
            }}>📜 导出结册长图</button>
            {exportMsg && <span className="muted small" role="status">{exportMsg}</span>}
          </div>
          {art === 'bazi' && <BaziTrend chart={cast.chart as never} />}
          {art === 'ziwei' && <ZiweiTimeline chart={cast.chart as never} />}
          <div className="card">
            <h3 className="card-title">逐格解释（每条断语可回链原典）</h3>
            <RuleHits hits={cast.rules} />
          </div>
          {answer && <AnswerPanel answer={answer} onAskAI={askAI} aiBusy={aiBusy} aiText={null} aiErr={aiErr} aiQuestion={question} />}
          <GlossarySearchPanel onShowDetail={setPopup} />
          <ClassicTextCard art={art} onShowDetail={setPopup} />
          <TermTeachCard art={art as TermTeachArt} onShowDetail={setPopup} />
          <PaipanTutorialCard art={art} chart={cast.chart} />
          <ExplainerPopup popup={popup} onClose={() => setPopup(null)} />
          <AIResultModal text={aiText} error={aiErr} question={question} onClose={() => { setAiText(null); setAiErr(null); }} toastMsg={toast} />
        </div>
      )}
    </div>
  );
}
