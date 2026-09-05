/** 6 步引导式起卦向导（§6）：选事项 → 细化问法 → 术数与配置 → 起卦 → 出盘解释 → 记录标注 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ART_LIST, ART_NAMES, ART_TAGLINES, CATEGORIES, defaultConfig, checkDegradation, stableHash,
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou,
  liuyaoRules, baziRules, meihuaRules, ziweiRules, qimenRules, liurenRules, xiaoliurenRules, jinkouRules,
  liuyaoBoard, baziBoard, meihuaBoard, ziweiBoard, qimenBoard, liurenBoard, xiaoliurenBoard, jinkouBoard,
  liuyaoEvidence, baziEvidence, meihuaEvidence, ziweiEvidence, qimenEvidence, liurenEvidence, xiaoliurenEvidence, jinkouEvidence,
  liuyaoTiming, meihuaTiming, ziweiTiming, qimenTiming, liurenTiming, xiaoliurenTiming, jinkouTiming,
  liuyaoFacts, meihuaFacts, ziweiFacts, qimenFacts, liurenFacts, xiaoliurenFacts, jinkouFacts,
  type ArtType, type RawInput, type RuleHit, type BoardSpec, type CitationRef, type TimingCandidate, type FactBundle, type Warning, type CategoryId,
} from '@xuanshu/core';
import { taxonomyOf, checkQuestionQuality, recommendArts, WIZARD_STEPS } from '@xuanshu/intake';
import { composeAnswer, type ComposedAnswer } from '@xuanshu/answer';
import { searchWithBoost } from '@xuanshu/knowledge';
import { saveCase, checkQuotaBeforeWrite, findDuplicate } from '@xuanshu/ledger';
import { useApp, ART_META } from './state';
import { BoardRenderer, TimingBanner, ComprehensiveZhaJi, ExplainerPopup, type PopupState, TimeInfoStrip, YingQiBoard, type YingQiTarget, GlossarySearchPanel, ClassicTextCard, YearlyReportCard, PaipanTutorialCard, CategoryYongshenNote, TimeCalibrateRow, buildPromptSnapshot, DiFenPicker, LocationPickRow } from './boards';
import { callAIStrict } from '@xuanshu/ai';
import { RuleHits, AnswerPanel, AiQuickBar, AIResultModal } from './components';
import { exportBoardImage, exportAlbum } from './exportBoard';
import { BaziTrend } from './BaziTrend';
import { ZiweiTimeline } from './ZiweiTimeline';
import { runCast, baziFactsWeb, calibNow, fmtClock, type CastResult } from './castShared';
import { QUESTION_TEMPLATES, oneLineHuman } from './engage';
import { DateTimePick } from './DateTimePick';

export interface IntakeInitials {
  initialCategory?: CategoryId;
  initialArt?: ArtType;
  initialTime?: { year: number; month: number; day: number; hour: number; minute: number };
  initialGender?: '男' | '女';
  initialQuestion?: string;
}
export function IntakeWizard({ initialCategory, initialArt, initialTime, initialGender, initialQuestion }: IntakeInitials) {
  const { config, setConfig, corpus, kbIndex, toast, ai, settings } = useApp();
  // AI 精解状态（自带 Key；默认关闭；仅手动触发）
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const askAI = async () => {
    if (!ai.enabled) { toast('AI 辅助解读未开启（设置中可开启）'); return; }
    if (!cast || !art) return;
    setAiBusy(true); setAiErr(null); setAiText(null);
    try {
      const user = buildPromptSnapshot(cast, art, birth, { gender, category: category ?? '其他', question, timeLabel: fmtClock(birth) });
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
  // 同盘继续追问：带上本盘上下文 + 追问语，重新走严格解读
  const askFollow = async (q: string) => {
    if (!ai.enabled) { toast('AI 辅助解读未开启（设置中可开启）'); return; }
    if (!cast || !art) return;
    setAiBusy(true); setAiErr(null);
    try {
      const user = buildPromptSnapshot(cast, art, birth, { gender, category: category ?? '其他', question, timeLabel: fmtClock(birth) })
        + `\n\n【补充追问】${q}（请只就这一追问展开，保持六段结构）`;
      const r = await callAIStrict(ai, user);
      if (r.ok) setAiText(r.text ?? '（AI 未返回内容）');
      else setAiErr(r.error ?? '调用失败');
    } catch (e) { setAiErr((e as Error).message); }
    finally { setAiBusy(false); }
  };
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [category, setCategory] = useState<CategoryId | undefined>(initialCategory);
  const [sub, setSub] = useState<string>('');
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [art, setArt] = useState<ArtType | undefined>(initialArt);
  const [cast, setCast] = useState<CastResult | null>(null);
  const [answer, setAnswer] = useState<ComposedAnswer | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [castPopup, setCastPopup] = useState<PopupState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // 起卦输入（第 4 步）；支持合参页带参直达预填；八字/紫微优先取「设置 → 预设个人生辰」
  const [birth, setBirth] = useState(() => {
    if (initialTime && initialTime.year && initialTime.year > 1900) return { ...initialTime, hour: initialTime.hour ?? 12 };
    if (settings.birth && (initialArt === 'bazi' || initialArt === 'ziwei')) {
      return { year: settings.birth.year, month: settings.birth.month, day: settings.birth.day, hour: settings.birth.hour, minute: settings.birth.minute };
    }
    return calibNow(config); // 默认取校准后的当前时刻（系统时间不准时可在向导内校对）
  });
  const [gender, setGender] = useState<'男' | '女'>(settings.birth?.gender ?? initialGender ?? '男');
  const [hourMissing, setHourMissing] = useState(false);
  // 出生地省份筛选（由 LocationPickRow 内部管理）
  // 进入第 4 步时，为时间型术数刷新一次「起局时刻」为校准后的当前时刻（之后用户可手动改，不被反复覆盖）
  const timeSynced = useRef('');
  useEffect(() => {
    if (step !== 4 || !art || art === 'bazi' || art === 'ziwei') return;
    const key = art;
    if (timeSynced.current === key) return;
    timeSynced.current = key;
    setBirth({ ...calibNow(config) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, art]);
  const [coins, setCoins] = useState<number[][]>([]);
  const [tossing, setTossing] = useState(false);
  const [numbers, setNumbers] = useState('');
  const [hexSel, setHexSel] = useState({ upper: 1, lower: 1, moving: 0 });
  const [text, setText] = useState('');
  const [waiYing, setWaiYing] = useState('');
  const [diFen, setDiFen] = useState('午');

  const taxonomy = category ? taxonomyOf(category) : null;
  const quality = useMemo(() => category ? checkQuestionQuality(category, question, art) : null, [category, question, art]);

  const input: RawInput = useMemo(() => ({
    time: birth, gender,
    coins: coins.length === 6 ? coins : undefined,
    numbers: numbers.trim() ? numbers.trim().split(/[\s,，、]+/).map(Number).filter(n => Number.isFinite(n)) : undefined,
    hexagram: hexSel.moving ? hexSel : { upper: hexSel.upper, lower: hexSel.lower },
    text: text.trim() || undefined,
    method: art === 'liuyao' ? (coins.length === 6 ? 'coins' : numbers.trim() ? 'numbers' : hexSel.moving ? 'manual' : 'time') : undefined,
    hourMissing, allowHourMissingFallback: degraded,
    question, category,
  }), [birth, gender, coins, numbers, hexSel, text, art, hourMissing, degraded, question, category]);

  const doCast = () => {
    if (!art) return;
    // 八字/紫微用用户填写的出生时间；其余术数用 step4 可编辑的「起局时刻」（默认=校准后的当前时刻，可手动改）
    const effInput: RawInput = input;
    const deg = checkDegradation(art, effInput);
    if (deg?.blocked) { toast(deg.notice ?? '信息不足，已拒排（不编造盘面）'); return; }
    const cfg = { ...config, category: category ?? '其他' };
    try {
      const r = runCast(art, effInput, cfg);
      setCast(r);
      const knowledgeHits = searchWithBoost(kbIndex, `${taxonomy?.guide ?? ''} ${question} ${category ?? ''}`, category).slice(0, 5)
        .map(h => ({ citation: { canonicalId: h.doc.canonicalId, book: h.doc.book, chapter: h.doc.chapter, segId: h.doc.segId, quote: h.doc.text.slice(0, 120), confidenceLevel: h.doc.confidenceLevel as CitationRef['confidenceLevel'] }, score: h.score }));
      setAnswer(composeAnswer({
        art, category: (category ?? '其他') as CategoryId, question, facts: r.facts,
        rules: r.rules, timing: r.timing, knowledge: knowledgeHits, warnings: r.warnings,
      }));
      setStep(5);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const tossOnce = () => {
    setTossing(true);
    setTimeout(() => {
      const g = Array.from({ length: 3 }, () => (Math.random() < 0.5 ? 3 : 1)); // 3=背 1=字
      setCoins(prev => {
        const next = [...prev, g];
        if (next.length === 6) {
          setTossing(false);
          return next;
        }
        setTossing(false);
        return next;
      });
    }, 420);
  };

  const saveToLedger = async () => {
    if (!cast || !art) return;
    const cfg = { ...config, category: category ?? '其他' };
    const hash = stableHash(cfg);
    const dup = await findDuplicate(hash, question || category || art);
    if (dup) { toast('5 分钟内已有同配置同问题的记录，避免重复起卦（初筮告，再三渎）'); return; }
    const q = await checkQuotaBeforeWrite(art);
    if (!q.ok) { toast(q.message ?? '配额已满'); return; }
    const rec = await saveCase({
      artType: art, category: (category ?? '其他') as CategoryId,
      question: { category: (category ?? '其他') as CategoryId, text: question, summary: question || `${category}·${ART_NAMES[art]}` },
      input: { raw: input, normalized: (cast.chart as { normalized: never }).normalized, config: cfg, configHash: hash, engineVersion: 'xuanshu-core@1.0.0' },
      result: {
        chart: cast.chart, ruleHits: cast.rules, warnings: cast.warnings,
        evidenceRefs: cast.rules.flatMap(r => r.citations), boardHash: stableHash(cast.board),
      },
      degraded: hourMissing,
    });
    setSaved(rec.caseId);
    toast('已存入案例本（第 6 步可标注）');
    setStep(6);
  };

  return (
    <div>
      <div className="steps" role="tablist" aria-label="起卦向导步骤">
        {WIZARD_STEPS.map(s => (
          <div key={s.n} className={`step ${step === s.n ? 'on' : step > s.n ? 'done' : ''}`} role="tab" aria-selected={step === s.n}>
            {s.n}. {s.title}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card xuanshu-pop">
          <div className="row wrap" style={{ gap: 6, padding: '6px 10px', background: 'var(--soft-c)', borderRadius: 10, marginBottom: 10 }}>
            <b className="small">👣 三步出盘：</b>
            <span className="tag dai">① 选事项</span><span className="tag dai">② 想清楚怎么问</span><span className="tag dai">③ 选术数起盘 → 看结论 → 记结果</span>
          </div>
          <h3 className="card-title">① 选事项</h3>
          <p className="muted small">不填事项也能排盘，但解释会偏泛——推荐花 20 秒选一下（取用神、应期、方位全由事项决定）。</p>
          <div className="grid3">
            {CATEGORIES.map(c => {
              const t = taxonomyOf(c);
              return (
                <button key={c} className="art-card" onClick={() => { setCategory(c); setStep(2); }} aria-label={`选择事项：${c}`}>
                  <div className="n">{c}</div>
                  <div className="d">{t.subs.slice(0, 4).join(' · ')}</div>
                  <div className="p">{t.sensitive ? <span className="tag xiong">敏感：前置免责</span> : <span className="tag dai">{t.recommendArts[0]?.art && ART_NAMES[t.recommendArts[0].art]}优先</span>}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && category && (
        <div className="card">
          <h3 className="card-title">② 细化问法 <span className="tag dai">{category}</span></h3>
          <p className="muted small">{taxonomy?.guide}</p>
          <label className="field">
            <span>你想问什么？（建议：对象 + 时限，如「三天内能否找回」）</span>
            <textarea className="textarea" value={question} onChange={e => setQuestion(e.target.value)} placeholder={taxonomy?.category === '失物' ? '例：我的身份证昨天下午在地铁站附近丢了，三天内能找回吗' : '写下具体的问题…'} aria-label="问句" />
          </label>
          {QUESTION_TEMPLATES[category] && (
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              <span className="muted small" style={{ alignSelf: 'center' }}>不知道怎么问？照着挑一个：</span>
              {QUESTION_TEMPLATES[category].map(t => (
                <span key={t} className="tag clickable" style={{ fontSize: 12 }} onClick={() => setQuestion(t)}>{t}</span>
              ))}
            </div>
          )}
          {taxonomy && taxonomy.subs.length > 0 && (
            <label className="field"><span>细类（可选）</span>
              <select className="select" value={sub} onChange={e => setSub(e.target.value)}>
                <option value="">— 不选 —</option>
                {taxonomy.subs.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          )}
          {quality && quality.hints.length > 0 && (
            <div className={`notice ${quality.ok ? 'info' : 'warn'}`}>
              {quality.hints.map((h, i) => <div key={i}>· {h}</div>)}
            </div>
          )}
          {taxonomy?.sensitive && <div className="notice danger">{taxonomy.forbidden.join('；')}——此类问题将强制前置免责并给专业机构指引。</div>}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>← 上一步</button>
            <button className="btn primary" onClick={() => setStep(3)} disabled={!quality?.ok && !!question}>下一步 →</button>
          </div>
        </div>
      )}

      {step === 3 && category && (
        <div className="card">
          <h3 className="card-title">③ 术数与配置</h3>
          <div className="small" style={{ fontWeight: 700, margin: '6px 0' }}>推荐（按事项）：</div>
          <div className="grid3">
            {recommendArts(category).map(r => (
              <button key={r.art} className={`art-card ${art === r.art ? '' : ''}`} style={{ borderColor: art === r.art ? 'var(--zhu)' : undefined }} onClick={() => setArt(r.art)}>
                {!ART_NAMES[r.art].includes(ART_META[r.art].icon) && <div className="art-ico" style={{ background: ART_META[r.art].color + '22', color: ART_META[r.art].color }}>{ART_META[r.art].icon}</div>}
                <div className="n">{ART_NAMES[r.art]} <span className="tag dai">{ART_META[r.art].klass}</span></div>
                <div className="d">{r.reason}</div>
                <div className="p muted">{r.tagline}</div>
              </button>
            ))}
          </div>
          <hr className="sep" />
          <div className="small" style={{ fontWeight: 700, margin: '6px 0' }}>全部术数：</div>
          <div className="row wrap">
            {ART_LIST.map(a => (
              <button key={a} className={`btn sm ${art === a ? 'primary' : ''}`} onClick={() => setArt(a)}>{ART_NAMES[a]}</button>
            ))}
          </div>
          {/* 问事精断：八术各看什么（共享跨系统引擎表，按当前分类展示） */}
          <CategoryYongshenNote category={category} onShow={setCastPopup} />
          {art === 'ziwei' && (
            <div style={{ marginTop: 12 }}>
              <div className="notice info">紫微配置：四化版本（进设置页可切换 全集主流 / 占验门；庚/壬干差异将并列标注）。所选版本随记录保存，切换后可复现原盘。</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(2)}>← 上一步</button>
            <button className="btn primary" disabled={!art} onClick={() => setStep(4)}>下一步 →</button>
          </div>
        </div>
      )}

      {step === 4 && art && (
        <div className="card">
          <h3 className="card-title">④ {ART_NAMES[art]} · 起卦/输入</h3>
          {taxonomy && <p className="muted small">怎么问：{taxonomy.guide}</p>}
          {art !== 'bazi' && art !== 'ziwei' && (
            <div style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <b className="small" style={{ paddingBottom: 8 }}>🕛 起局/起课时刻（可手动改，避开系统时间不准的影响）</b>
                <label className="field" style={{ flex: '1 1 240px', marginBottom: 0 }}><span>时刻（弹出日历选择）</span>
                  <DateTimePick value={birth} onChange={setBirth} />
                </label>
                <button className="btn sm" onClick={() => setBirth({ ...calibNow(config) })}>⏱ 取当前（校准后）时刻</button>
              </div>
              <div className="muted small">默认取校准后的当前时刻；若系统时间不准，可①直接在上框改成正确时刻，或②用下方校对条调好偏移后点「取当前（校准后）时刻」→ 起卦即按此时刻起局/起课。</div>
              <TimeCalibrateRow />
            </div>
          )}

          {(art === 'bazi' || art === 'ziwei') && (
            <div>
              <div className="grid3">
                <label className="field"><span>公历日期（统一以公历为排盘输入，农历转换复用历法层）</span>
                  <input type="date" className="input" value={`${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}`}
                    onChange={e => { const [y, m, d] = e.target.value.split('-').map(Number); setBirth(b => ({ ...b, year: y, month: m, day: d })); }} />
                </label>
                <label className="field"><span>时间（24h）</span>
                  <input type="time" className="input" value={`${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}`}
                    onChange={e => { const [h, m] = e.target.value.split(':').map(Number); setBirth(b => ({ ...b, hour: h, minute: m })); setHourMissing(false); }} />
                </label>
                <label className="field"><span>性别（紫微大限顺逆相关）</span>
                  <select className="select" value={gender} onChange={e => setGender(e.target.value as '男' | '女')}>
                    <option>男</option><option>女</option>
                  </select>
                </label>
                <label className="field"><span>📍 出生地（真太阳时换算，可留空）</span>
                  <LocationPickRow />
                </label>
              </div>
              <label className="row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" style={{ marginTop: 2, flex: 'none' }} checked={hourMissing} onChange={e => { setHourMissing(e.target.checked); }} />
                <span className="small" style={{ flex: 1, minWidth: 0, lineHeight: 1.6 }}>不清楚出生时辰（{art === 'ziwei' ? '紫微对时辰高度敏感：时辰错则全盘错' : '八字将缺时柱'}）</span>
              </label>
              {hourMissing && art === 'ziwei' && (
                <div className="notice warn">
                  若无确切时辰，建议改用六爻/梅花（不依赖生辰）。确需继续，请勾选下方「无时辰降级」，结果仅供参考——本软件不提供反推时辰功能。
                  <label className="row" style={{ cursor: 'pointer', marginTop: 6 }}>
                    <input type="checkbox" checked={degraded} onChange={e => setDegraded(e.target.checked)} />
                    <span className="small">我已知悉，使用「仅用年月日」降级模式（宫位与四化不完整）</span>
                  </label>
                </div>
              )}
              {hourMissing && art === 'bazi' && <div className="notice warn">缺时柱：盘面将明示「缺时柱」，需时柱的规则自动禁用；单事占问建议改用六爻。</div>}
            </div>
          )}

          {art === 'liuyao' && (
            <div>
              <p className="muted small">摇卦：净手静心，专念一事，连摇六次自下而上成卦（一事一卦，勿因卦不吉重摇）。</p>
              <div className="coin-row">
                {(coins[coins.length - 1] ?? [0, 0, 0]).map((v, i) => (
                  <div key={i} className={`coin ${tossing ? 'toss' : ''}`}>{tossing ? '摇' : v === 3 ? '背' : '字'}</div>
                ))}
                {Array.from({ length: Math.max(0, 3) }).map((_, i) => coins.length === 0 && <div key={'e' + i} className="coin" style={{ opacity: .3 }}>?</div>)}
              </div>
              <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 8 }}>
                <button className="btn primary" onClick={tossOnce} disabled={tossing || coins.length >= 6}>
                  {coins.length >= 6 ? '六爻已成' : `第 ${coins.length + 1} 次摇卦`}
                </button>
                <button className="btn ghost sm" onClick={() => setCoins([])}>重摇</button>
                <button className="btn sm" onClick={() => { setCoins([]); }}>改用时间卦</button>
              </div>
              <div className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>
                {coins.length > 0 ? `已摇 ${coins.length}/6 次（3背=老阳◎，3字=老阴×，1背=少阳，2背=少阴）` : '或直接用当前时间起卦（下方按钮）'}
              </div>
            </div>
          )}

          {(art === 'meihua' || art === 'xiaoliuren') && (
            <div>
              <label className="field"><span>{art === 'meihua' ? '报数起卦（2–3 个数，临时起念勿事先想好）' : '报三个数（月→日→时递推）'}</span>
                <input className="input" value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="例：7 23 5" />
              </label>
              {art === 'meihua' && (
                <label className="field"><span>或字占（1–2 汉字，按笔画起卦）</span>
                  <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="例：信" />
                </label>
              )}
              {art === 'meihua' && (
                <label className="field"><span>外应（可选：起卦时突发的人/事/物/声）</span>
                  <input className="input" value={waiYing} onChange={e => setWaiYing(e.target.value)} placeholder="例：忽闻鹊噪" />
                </label>
              )}
              <div className="muted small">留空则用当前时间起卦。</div>
            </div>
          )}

          {art === 'qimen' && (<div>
            <div className="notice info">奇门以当前时刻起局（{new Date().toLocaleString('zh-CN')}）。看方位与时机是奇门所长；四害（空亡/马星/击刑/入墓/门迫）将自动标红。</div>
            <label className="field" style={{ maxWidth: 320, marginTop: 8 }}><span>时间体系</span>
              <select className="select" value={config.paipan?.qimenTimeType ?? 'shi'}
                onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenTimeType: e.target.value as 'shi' | 'ri' } })}>
                <option value="shi">时家奇门（精确到时辰，主流）</option>
                <option value="ri">日家奇门（择日专用，看一日大势）</option>
              </select>
            </label>
            {(config.paipan?.qimenTimeType ?? 'shi') === 'ri' && (
              <div className="muted small">日家：以日柱定休门（三日一宫）与太乙九星（一日一宫），配十二黑黄道/喜神/天乙贵人，适合「今天适不适合做某事」「哪天宜签约」类问题；问到具体时辰请切回时家。</div>
            )}
            {(config.paipan?.qimenTimeType ?? 'shi') === 'shi' && (
              <>
                <label className="field" style={{ maxWidth: 320, marginTop: 8 }}><span>定局法</span>
                  <select className="select" value={config.paipan?.qimenJuMethod ?? 'chaibu'}
                    onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenJuMethod: e.target.value as 'chaibu' | 'zhirun' | 'maoshan' } })}>
                    <option value="chaibu">拆补法（通行）</option>
                    <option value="zhirun">置闰法（超神接气·严格）</option>
                    <option value="maoshan">茅山法（节气对位·简洁）</option>
                  </select>
                </label>
                <label className="field" style={{ maxWidth: 320, marginTop: 8 }}><span>排布法</span>
                  <select className="select" value={config.paipan?.qimenPanType ?? 'zhuan'}
                    onChange={e => setConfig({ ...config, paipan: { ...config.paipan, qimenPanType: e.target.value as 'zhuan' | 'fei' } })}>
                    <option value="zhuan">转盘（排宫法·通行）</option>
                    <option value="fei">飞盘（飞宫法·星门神飞布）</option>
                  </select>
                </label>
                <div className="muted small">拆补：符头定元后直接用当前节气局；置闰：须等节气后第一个甲/己日为上元符头，超神时接气沿用上一局；茅山：交节即用本节气、前 60 时辰为上元、中 60 为中元、其余归下元，不取符头。转盘三星顺时针齐转；飞盘三盘按洛书宫序飞布（阳顺阴逆）。临近节气交接时各定局法可能不同局。</div>
              </>
            )}
          </div>)}
          {art === 'liuren' && <div className="notice info">大六壬以当前时刻起课：月将加时 → 天地盘 → 四课三传。来意占等高阶技法无公开样本时将明示「资料不足」。</div>}
          {art === 'jinkou' && (
            <div>
              <div className="notice info">金口诀以当前时刻起课，月将加时定将神。</div>
              <DiFenPicker value={diFen} onChange={setDiFen} />
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(3)}>← 上一步</button>
            <button className="btn primary" onClick={doCast}>{art === 'liuyao' && coins.length < 6 ? '用时间起卦' : '起卦排盘 →'}</button>
          </div>
        </div>
      )}

      {step === 5 && cast && art && (
        <div>
          {hourMissing && <div className="notice warn" style={{ fontSize: 15 }}>⚠ {art === 'ziwei' ? '时辰缺失：命宫与十二宫不可靠，宫位与四化不完整——结果仅供参考，建议改用六爻/梅花。' : '缺时柱：需时柱的规则已禁用。'}</div>}
          <div ref={boardRef}>
            <BoardRenderer spec={cast.board} chart={cast.chart} category={category} />
          </div>
          {/*  时间信息条：三历对照+节气+建除+黄黑道+宜忌+神位 */}
          <TimeInfoStrip time={birth} />
          {/*  AI 快速条：不懂就看，或复制提示词自己问 */}
          <AiQuickBar
            onAskAI={askAI}
            aiBusy={aiBusy}
            onCopyPrompt={async () => {
              const p = buildPromptSnapshot(cast, art, birth, { gender, category: category ?? '其他', question, timeLabel: fmtClock(birth) });
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
          {/*  术语大全检索（800+ 白话词库） */}
          <GlossarySearchPanel onShowDetail={setCastPopup} />
          {/*  古籍原文库（8部经典·原文/白话对照·推荐次第） */}
          <ClassicTextCard art={art} onShowDetail={setCastPopup} />
          {/*  年度运程合参报告 */}
          <YearlyReportCard birth={birth} chart={cast.chart} art={art} />
          {/*  排盘分步教学 */}
          <PaipanTutorialCard art={art} chart={cast.chart} />
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
            {/*  文本快照：一键复制盘面结论（发微信群/存笔记轻量方案） */}
            <button className="btn sm" onClick={async () => {
              const lines: string[] = [
                `【玄术工作台·${ART_NAMES[art]}排盘快照】${new Date().toLocaleString()}`,
                `时间：${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')} ${birth.hour == null || birth.hour < 0 ? '（缺时辰）' : `${String(birth.hour).padStart(2, '0')}:${String(birth.minute ?? 0).padStart(2, '0')}`}`,
              ];
              cast.rules.forEach(r => lines.push(`- ${r.title}：${r.fact ?? ''}【${r.level}】`));
              (cast.timing ?? []).slice(0, 8).forEach(t => lines.push(`- 应期：${t.text}${t.window ? `（${t.window}）` : ''}`));
              try {
                await navigator.clipboard.writeText(lines.join('\n'));
                setExportMsg('已复制盘面文本快照'); setTimeout(() => setExportMsg(null), 3200);
              } catch { setExportMsg('复制失败，请检查浏览器权限'); setTimeout(() => setExportMsg(null), 3200); }
            }}>复制文本快照</button>
            {exportMsg && <span className="muted small" role="status">{exportMsg}</span>}
          </div>
          {art === 'bazi' && <BaziTrend chart={cast.chart as never} />}
          {art === 'ziwei' && <ZiweiTimeline chart={cast.chart as never} />}
          {/* R7a 统一应期引擎 */}
          {cast.timing?.length > 0 && (() => {
            const ART_N: Record<string, string> = { bazi: '八字', liuyao: '六爻', meihua: '梅花易数', ziwei: '紫微斗数', qimen: '奇门遁甲', liuren: '大六壬', xiaoliuren: '小六壬', jinkou: '金口诀' };
            const hits = cast.timing.map(t => ({ ruleId: t.ruleId, text: t.text, window: t.window, level: (t.confidenceLevel ?? 'B') as 'A' | 'B' | 'C' | 'D' }));
            return <TimingBanner hits={hits} artName={ART_N[art] ?? art} onShowPopup={setCastPopup} />;
          })()}
          {/*  应期真实日期引擎（六爻/奇门/大六壬：自动提取动爻用神+空亡） */}
          {(() => {
            const ch = cast.chart as never as {
              xunkong?: string; dayZhi?: string;
              lines?: Array<{ moving?: boolean; branch?: string; index?: number }>;
              yongShenInfo?: { lineIdx?: number; name?: string };
            };
            const targets: YingQiTarget[] = [];
            if (art === 'liuyao') {
              (ch.lines ?? []).forEach((ln, i) => {
                if (ln?.moving && ln.branch) targets.push({ label: `动爻${i + 1}`, zhis: [ln.branch] });
              });
              const yIdx = ch.yongShenInfo?.lineIdx;
              if (yIdx != null && ch.lines?.[yIdx]?.branch) {
                targets.push({ label: ch.yongShenInfo?.name ? `用神${ch.yongShenInfo.name}` : '用神', zhis: [ch.lines[yIdx].branch ?? ''] });
              }
            }
            if (art === 'qimen' || art === 'liuren') {
              const ming = { label: '马星', zhis: ['寅', '申', '巳', '亥'] };
              targets.push(ming);
            }
            const xk = ch.xunkong;
            if ((!targets.length || targets.every(t => !t.zhis.length)) && !xk && !ch.dayZhi) return null;
            return <YingQiBoard base={birth} targets={targets} xunkong={xk} onShowPopup={setCastPopup} />;
          })()}
          {/* R6 综合择吉系统（奇门/日家奇门时启用，其他术数也展示黄黑道吉时） */}
          {(() => {
            const ch = cast.chart as never as {
              cells?: Array<{ gong: number; name: string; gate?: string; god?: string; star?: string; marks: string[] }>;
              dayPillar?: string;
              xiShen?: string; huangHeiDao?: Array<{ hour: string; zhi: string; kind: '黄道' | '黑道'; name: string }>;
              ziBai?: Array<{ gong: number; star: string; level: '吉' | '凶' | '平' }>;
              timeType?: string;
            };
            const tt = (cast.chart as never as { timeType?: string }).timeType;
            if ((art === 'qimen' && (tt === 'ri' || !tt || tt === 'shi' || tt === 'nian' || tt === 'yue')) || art === 'liuren' || art === 'xiaoliuren' || art === 'jinkou' || art === 'bazi') {
              const dp = (ch.dayPillar ?? (cast.chart as never as { day?: string }).day ?? '甲子日');
              // 日家奇门会自带 xiShen+huangHeiDao；其他术数只给黄黑道简化版（基于日柱推算十二时辰黑黄道）
              const HH: Record<string, [string, string]> = { 子: ['青龙', '黄道'], 丑: ['明堂', '黄道'], 寅: ['天刑', '黑道'], 卯: ['朱雀', '黑道'], 辰: ['金匮', '黄道'], 巳: ['天德', '黄道'], 午: ['白虎', '黑道'], 未: ['玉堂', '黄道'], 申: ['天牢', '黑道'], 酉: ['玄武', '黑道'], 戌: ['司命', '黄道'], 亥: ['勾陈', '黑道'] };
              // 简化黄黑道（日家奇门覆盖所有时辰）
              const hhList: Array<{ hour: string; zhi: string; kind: '黄道' | '黑道'; name: string }> =
                (ch.huangHeiDao && ch.huangHeiDao.length === 12) ? ch.huangHeiDao :
                  ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].map(z => {
                    const [nm, kd] = HH[z] ?? ['司命', '黄道'];
                    return { hour: z + '时', zhi: z, kind: (kd as '黄道' | '黑道'), name: nm };
                  });
              return <ComprehensiveZhaJi
                dayPillar={dp.slice(0, 2)}
                qimenCells={ch.cells}
                huangHeiDao={hhList}
                xiShenFang={ch.xiShen}
                ziBai={ch.ziBai}
                timeType={tt === 'ri' ? '日家·择日专用' : tt === 'nian' ? '年家·全年大势' : tt === 'yue' ? '月家·流月择吉' : '时家·时辰决策'}
                onShowPopup={setCastPopup}
              />;
            }
            return null;
          })()}
          {/*  综合可视化速览：九宫热力+五行流向+神煞网络+应期时间轴 */}
          <div className="card" style={{ marginTop: 10 }}>
            <h3 className="card-title">🧭 可视化速览 · 九宫热力｜五行流向｜神煞网络｜应期时间轴</h3>
            <div className="row wrap" style={{ gap: 8, padding: '8px 10px', background: 'var(--soft-a)', borderRadius: 10 }}>
              {((art: string) => {
                const tips: Record<string, string> = {
                  qimen: '重点看：十二长生热力条+九宫热力色+值符值使→快速找吉方',
                  bazi: '重点看：五行柱图+十神柱图+三层大运展开→精确到月',
                  liuyao: '重点看：六神彩色+动爻变箭头+5色连线→全卦关系一图清',
                  ziwei: '重点看：12宫雷达+14主星+4层飞星→原盘/大限/流年/流月四层联动',
                  liuren: '重点看：天地盘生克+720课分类→定课体知70%吉凶',
                  meihua: '重点看：体用生克链+卦气热力+应期定位→知体用定结果',
                  xiaoliuren: '重点看：三宫链色块(过去/现在/未来)→216课组合定性',
                  jinkou: '重点看：四位4层色条+五动识别→知五动断吉凶',
                };
                return tips[art] ? <span className="tag dai">💡 {art}快速上手：{tips[art]}</span> : null;
              })(art ?? '')}
            </div>
            <div className="muted small" style={{ padding: '2px 10px' }}>盘面把旺衰、合冲、应期用颜色与图形直观表达：绿色=相对顺，红色=相对阻；可先看重点宫位，再看生克流向，最后找应验时间。</div>
          </div>
          <div className="card">
            <h3 className="card-title">逐格解释（每条断语可回链原典）</h3>
            <RuleHits hits={cast.rules} />
          </div>
          {answer && <AnswerPanel answer={answer} onAskAI={askAI} aiBusy={aiBusy} aiText={null} aiErr={aiErr} aiQuestion={question} />}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(4)}>← 重新起卦</button>
            <button className="btn primary" onClick={saveToLedger}>记录并标注 →</button>
          </div>
          <ExplainerPopup popup={castPopup} onClose={() => setCastPopup(null)} />
          <AIResultModal text={aiText} error={aiErr} question={question} onClose={() => { setAiText(null); setAiErr(null); }} toastMsg={toast} onAsk={askFollow} askBusy={aiBusy} />
        </div>
      )}

      {step === 6 && cast && (
        <div className="card">
          <h3 className="card-title">⑥ 记录与标注</h3>
          {saved
            ? <div className="notice info">已存入案例本。可在「记录本」中补充事后回标（是否应验、实际时间、关键收获）——这是校准自己解释习惯最快的方式。</div>
            : <div className="notice warn">尚未保存。</div>}
          <div className="muted small" style={{ marginTop: 8 }}>
            记录内容：原始输入 + 归一化时刻 + 完整配置 + 盘面 + 规则命中 + 引用原文 + 你的标注——任意一条可一键还原当时盘面。
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn" href="#/ledger">前往记录本 →</a>
            <a className="btn" href="#/read">去书阁读原典 →</a>
            <button className="btn primary" onClick={() => { setStep(1); setCast(null); setSaved(null); setCoins([]); setQuestion(''); }}>再起一卦</button>
          </div>
        </div>
      )}
    </div>
  );
}
