/**
 * 8术同盘一键合参页：同一时间/性别/事项 → 同时排 8 门术数 →
 * 跨术数吉凶共识（投票）+ 各术盘面展开 + 应期汇总。
 * 设计原则：每术盘面完整可点（白话弹窗复用 boards），共识只做"信号级"归纳，
 * 不做"结论合一"（各家取象本就不同，硬合并会失真）。
 */
import React, { useMemo, useState } from 'react';
import { ART_LIST, ART_NAMES, defaultConfig, type ArtType, type RawInput } from '@xuanshu/core';
import { GLOSSARY } from '@xuanshu/knowledge';
import { callAIStrict } from '@xuanshu/ai';
import { runCast, nowParts, type CastResult } from './castShared';
import { BoardRenderer, ExplainerPopup, type PopupState, TimeInfoStrip, YingQiBoard, type YingQiTarget, YearlyReportCard, TermTeachCard, type TermTeachArt, PaipanTutorialCard } from './boards';
import { AiQuickBar, AIResultModal } from './components';
import { useApp } from './state';

type Level = '吉' | '凶' | '变数' | '中性';

/** ：从断语文本中找出命中词库的术语，生成白话 sections（通用，所有术数受益） */
function plainTermSections(texts: string[]): Array<{ label: string; value: string; note?: string }> {
  const hits = new Map<string, { plain?: string; note?: string }>();
  const dict = (GLOSSARY ?? {}) as Record<string, { plain?: string; note?: string }>;
  for (const t of texts) {
    if (!t) continue;
    for (const k of Object.keys(dict)) {
      if (hits.has(k)) continue;
      if (t.includes(k) && dict[k]?.plain) hits.set(k, dict[k]);
    }
  }
  return Array.from(hits.entries())
    .sort((a, b) => b[0].length - a[0].length)
    .slice(0, 6)
    .map(([k, g]) => ({ label: `术语白话 · ${k}`, value: g.plain ?? '', note: g.note ?? '' }));
}

function voteOf(c: CastResult): { ji: number; xiong: number; bian: number; score: number } {
  let ji = 0, xiong = 0, bian = 0;
  for (const r of c.rules) {
    if (r.level === '吉') ji++;
    else if (r.level === '凶') xiong++;
    else if (r.level === '变数') bian++;
  }
  return { ji, xiong, bian, score: ji - xiong };
}

function artTargets(art: ArtType, chart: unknown): YingQiTarget[] {
  const ch = chart as never as { lines?: Array<{ moving?: boolean; branch?: string }>; yongShenInfo?: { lineIdx?: number; name?: string }; xunkong?: string };
  const targets: YingQiTarget[] = [];
  if (art === 'liuyao') {
    (ch.lines ?? []).forEach((ln, i) => { if (ln?.moving && ln.branch) targets.push({ label: `动爻${i + 1}`, zhis: [ln.branch] }); });
    const yi = ch.yongShenInfo?.lineIdx;
    if (yi != null && ch.lines?.[yi]?.branch) targets.push({ label: ch.yongShenInfo?.name ?? '用神', zhis: [ch.lines[yi].branch ?? ''] });
  }
  if (art === 'qimen' || art === 'liuren') targets.push({ label: '马星', zhis: ['寅', '申', '巳', '亥'] });
  return targets;
}

function fmtT(t: { year: number; month: number; day: number; hour: number; minute: number }) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.year}-${p(t.month)}-${p(t.day)}T${p(t.hour) || '12'}:${p(t.minute ?? 0)}`;
}

const ART_DESC: Record<string, string> = {
  bazi: '命理定盘·看一生格局与本问的"命数底色"',
  liuyao: '一事一断·看本问的成败与应期',
  meihua: '速断体用·看本问的吉凶倾向与过程',
  ziwei: '星曜格局·看本问的运气环境（限运层面）',
  qimen: '时空方位·看本问的时机与方位选择',
  liuren: '天地四课·看本问的人事进程与来意',
  xiaoliuren: '六宫速查·看本问的强弱（六宫极简版）',
  jinkou: '四位五行·看本问的五行生克定吉凶',
};

export function CombinedView() {
  const { ai, toast, requestAISetup } = useApp();
  const [time, setTime] = useState(() => nowParts());
  const [gender, setGender] = useState<'男' | '女'>('男');
  const [question, setQuestion] = useState('');
  const [snapshot, setSnapshot] = useState<RawInput | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ bazi: true, liuyao: true, qimen: true, liuren: true });
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const input: RawInput = useMemo(() => ({ time, gender, question: question.trim() || undefined }), [time, gender, question]);

  // 点击「一键排 8 盘」才快照排盘（输入过程不重排）
  const results = useMemo<Array<{ art: ArtType; cast: CastResult }>>(() => {
    if (!snapshot) return [];
    const cfg = defaultConfig();
    return ART_LIST.map(art => ({ art, cast: runCast(art, snapshot, cfg) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const votes = results.map(r => ({ art: r.art, ...voteOf(r.cast) }));
    const jiArts = votes.filter(v => v.score > 0).length;
    const xiongArts = votes.filter(v => v.score < 0).length;
    const pingArts = votes.filter(v => v.score === 0).length;
    const trend = jiArts > xiongArts ? '偏吉' : xiongArts > jiArts ? '偏凶' : '中性';
    return { votes, jiArts, xiongArts, pingArts, trend };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const toggle = (art: string) => setOpen(o => ({ ...o, [art]: !o[art] }));

  // 八术综合解读提示词（供 AI 解读与复制提示词共用）
  const buildCombined = () => {
    const now = `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')} ${String(time.hour).padStart(2, '0')}:${String(time.minute ?? 0).padStart(2, '0')}`;
    const lines: string[] = [];
    lines.push(`# 玄枢 · 八术综合占卜（时间 ${now}，${gender}命）`);
    if (question.trim()) lines.push(`问卦：${question.trim()}`);
    lines.push(`【跨术信号汇总】${summary ? summary.votes.map(v => `${ART_NAMES[v.art]}${v.score > 0 ? '→吉' : v.score < 0 ? '→凶' : '~平'}`).join('、') : ''}；总趋势：${summary?.trend ?? ''}；吉${summary?.jiArts ?? 0}凶${summary?.xiongArts ?? 0}平${summary?.pingArts ?? 0}`);
    lines.push('');
    for (const r of results) {
      lines.push(`## ${ART_NAMES[r.art]}（${ART_DESC[r.art] ?? ''}）`);
      r.cast.rules.slice(0, 6).forEach(x => lines.push(`- [${x.level}] ${x.title}：${x.fact ?? ''}`));
      (r.cast.timing ?? []).slice(0, 3).forEach(t => lines.push(`- 应期参考：${t.text}${t.window ? `（${t.window}）` : ''}`));
      lines.push('');
    }
    lines.push('【解读要求】请先给一句话总览（吉凶倾向+应期），再逐术精读：每术 3-5 条关键断语的白话、依据、与本问的关联；对未在原典/断语中出现的内容明确标注「未见依据」，不得编造具体年份数字或绝对化结论。');
    return lines.join('\n');
  };
  const askAI = async () => {
    if (!ai.enabled) { requestAISetup(); return; }
    setAiBusy(true); setAiErr(null); setAiText(null);
    try {
      const r = await callAIStrict(ai, buildCombined());
      if (r.ok) setAiText(r.text ?? '（AI 未返回内容）');
      else setAiErr(r.error ?? '调用失败');
    } catch (e) { setAiErr((e as Error).message); }
    finally { setAiBusy(false); }
  };
  // 同盘继续追问（八术综合）
  const askFollowC = async (q: string) => {
    if (!ai.enabled) { requestAISetup(); return; }
    setAiBusy(true); setAiErr(null);
    try {
      const r = await callAIStrict(ai, buildCombined() + `\n\n【补充追问】${q}（请只就这一追问展开，保持六段结构）`);
      if (r.ok) setAiText(r.text ?? '（AI 未返回内容）');
      else setAiErr(r.error ?? '调用失败');
    } catch (e) { setAiErr((e as Error).message); }
    finally { setAiBusy(false); }
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">⛩ 8术同盘·一键合参</div>
        <div className="page-desc">同一时间同一问，一次排 8 门术数 → 看各家的"信号级"共识与分歧（不强行合一结论）</div>
      </div>

      {/* 输入卡 */}
      <div className="card">
        <h3 className="card-title">① 输入时间与问法</h3>
        <div className="grid2">
          <label className="field"><span>公历时间</span>
            <input className="input" type="datetime-local" value={`${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}T${String(time.hour).padStart(2, '0')}:${String(time.minute ?? 0).padStart(2, '0')}`}
              onChange={e => {
                const v = e.target.value; if (!v) return;
                const [d, t] = v.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = (t ?? '12:00').split(':').map(Number);
                setTime({ year: y, month: m, day: dd, hour: h, minute: mi });
              }} />
          </label>
          <label className="field"><span>性别</span>
            <select className="select" value={gender} onChange={e => setGender(e.target.value as '男' | '女')}>
              <option value="男">男</option><option value="女">女</option>
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>问什么（可选，推荐填：求财 / 事业 / 感情 / 出行…）</span>
            <input className="input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="例如：这个月能谈成这笔生意吗？" />
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => setSnapshot({ time, gender, question: question.trim() || undefined })}>⚡ 一键排 8 盘</button>
          <button className="btn sm ghost" onClick={() => { setTime(nowParts()); }}>用当前时间</button>
          <button className="btn sm" onClick={async () => {
            if (results.length === 0) { setPopup({ title: '先排盘', sections: [{ label: '提示', value: '请先点击"一键排 8 盘"，再复制快照。', note: '' }] }); return; }
            const lines: string[] = [`【玄枢·8术一键合参快照】${new Date().toLocaleString()}`, `问：${question.trim() || '（未填）'}｜时间：${fmtT(time)}｜性别：${gender}`];
            const sv = summary;
            if (sv) lines.push(`合参趋势：${sv.trend}（吉${sv.jiArts}·凶${sv.xiongArts}·平${sv.pingArts}）`);
            for (const r of results) {
              const v = sv?.votes.find(x => x.art === r.art);
              const sc = v?.score ?? 0;
              lines.push(`\n【${ART_NAMES[r.art]}】信号 ${sc > 0 ? '吉' : sc < 0 ? '凶' : '平'}`);
              r.cast.rules.slice(0, 5).forEach(x => lines.push(`  · ${x.title}（${x.level}）：${x.fact ?? ''}`));
              const ts = r.cast.timing ?? [];
              if (ts.length) lines.push(`  应期：${ts.slice(0, 3).map(t => `${t.text}${t.window ? `(${t.window})` : ''}`).join('；')}`);
            }
            try { await navigator.clipboard.writeText(lines.join('\n')); setPopup({ title: '已复制 8 盘快照', sections: [{ label: '复制成功', value: `共 ${lines.length} 行文本已复制到剪贴板。`, note: '适合发群聊/存笔记；需要图片版可对每个盘面用"导出盘面图"。' }] }); }
            catch { setPopup({ title: '复制失败', sections: [{ label: '提示', value: '浏览器剪贴板权限受限，请手动选中复制。', note: '' }] }); }
          }}>复制8盘快照</button>
          <span className="muted small" style={{ alignSelf: 'center' }}>六爻/梅花按时间起卦（确定性可复算）；如需报数/摇卦请用单术向导。</span>
        </div>
      </div>

      {snapshot && results.length === 0 && <div className="notice warn">正在排盘…</div>}

      {results.length > 0 && (
        <>
          {/* 时间信息条（共用一次） */}
          <TimeInfoStrip time={time} />
          {/* AI 快速条：八术综合解读 + 复制提示词 */}
          <AiQuickBar
            onAskAI={askAI}
            aiBusy={aiBusy}
            onCopyPrompt={async () => {
              try { await navigator.clipboard.writeText(buildCombined()); setCopyMsg('已复制提示词（可发给任意大模型/搜索）'); setTimeout(() => setCopyMsg(''), 3200); }
              catch { setCopyMsg('复制失败，请检查浏览器权限'); setTimeout(() => setCopyMsg(''), 3200); }
            }}
            copyMsg={copyMsg || undefined}
            hint="🤖 想一句话听八术结论就点「AI 辅助解读」；想换别的 AI/搜索引擎接着问，就点「复制提示词」粘贴过去。"
          />
          <AIResultModal text={aiText} error={aiErr} question={question} onClose={() => { setAiText(null); setAiErr(null); }} toastMsg={toast} onAsk={askFollowC} askBusy={aiBusy} />
          {/* 年度运程合参（用八字盘增强） */}
          <YearlyReportCard birth={time} chart={results.find(r => r.art === 'bazi')?.cast.chart} art={results.some(r => r.art === 'bazi') ? 'bazi' : 'other'} />

          {/* 合参总览 */}
          {summary && (
            <div className="card" style={{ marginTop: 10 }}>
              <h3 className="card-title">② 跨术合参总览（信号级投票·不强行归一共识）</h3>
              <div className="row wrap" style={{ gap: 8, padding: '6px 10px', background: 'var(--soft-a)', borderRadius: 10 }}>
                <span className={`tag ${summary.trend === '偏吉' ? 'green' : summary.trend === '偏凶' ? 'red' : 'gold'}`} style={{ fontSize: 13 }}>合参趋势：{summary.trend}（{summary.jiArts}吉 / {summary.xiongArts}凶 / {summary.pingArts}平）</span>
                {summary.votes.map(v => (
                  <span key={v.art} className={`tag clickable ${v.score > 0 ? 'green' : v.score < 0 ? 'red' : 'gold'}`}
                    title={`${ART_NAMES[v.art]}：吉条 ${v.ji} · 凶条 ${v.xiong} · 变数 ${v.bian}`}
                    onClick={() => {
                      const a = results.find(r => r.art === v.art); if (!a) return;
                      setPopup({
                        title: `${ART_NAMES[v.art]}·吉凶信号明细`,
                        sections: [
                          { label: '信号统计', value: `吉 ${v.ji} 条｜凶 ${v.xiong} 条｜变数 ${v.bian} 条 → 倾向 ${v.score > 0 ? '吉' : v.score < 0 ? '凶' : '中性'}`, note: '计分规则：一条"吉"规则 +1、一条"凶"规则 -1、变数/中性 0；总数 >0 偏吉、<0 偏凶、=0 中性。' },
                          ...a.cast.rules.map((r, i) => ({ label: `规则${i + 1}`, value: `${r.title}（${r.level}）`, note: r.fact })),
                        ],
                      });
                    }}>
                    {ART_NAMES[v.art]} {v.score > 0 ? '→吉' : v.score < 0 ? '→凶' : '~平'}
                  </span>
                ))}
              </div>
              <div className="small" style={{ marginTop: 8, color: 'var(--dai)' }}>
                <b>怎么读这一票：</b>多家都吉→大概率吉，可放心行动；多家都凶→即使单家说吉也要谨慎，找应期再动；
                吉凶参半→此事有反复/有争议，重点看"变数"规则（它们通常指向人事摩擦点），并对照应期窗口。
              </div>
            </div>
          )}

          {/* 跨术共识应期：多术应期窗口投票归并（“什么时候”的接口） */}
          {(() => {
            const counts = new Map<string, { arts: string[]; times: number }>();
            for (const r of results) {
              for (const t of (r.cast.timing ?? [])) {
                const key = `${t.text}${t.window ? `（${t.window}）` : ''}`;
                const c = counts.get(key) ?? { arts: [], times: 0 };
                c.arts.push(ART_NAMES[r.art]); c.times += 1;
                counts.set(key, c);
              }
            }
            const top = Array.from(counts.entries()).sort((a, b) => b[1].times - a[1].times).filter(([, c]) => c.times >= 1).slice(0, 4);
            if (!top.length) return null;
            const max = top[0][1].times;
            return (
              <div className="card" style={{ marginTop: 10, background: 'var(--soft-c)' }}>
                <h3 className="card-title">⏳ 跨术共识应期（多术应期窗口投票）</h3>
                {top.map(([key, c]) => (
                  <div key={key} className="row wrap" style={{ gap: 6, margin: '4px 0' }}>
                    <span className="tag gold">{c.times} 家</span>
                    <b>{key}</b>
                    <span className="muted small">{c.arts.join('、')}</span>
                    {c.times === max && <span className="tag green xuanshu-breathe">★ 共识最强</span>}
                  </div>
                ))}
                <div className="muted small" style={{ marginTop: 6 }}>应期是所有术数共同回答“什么时候”的接口；多术窗口重叠处优先采信，落在重叠区间的日子/时辰最值得盯。</div>
              </div>
            );
          })()}

          {/* 各术盘面 */}
          <div className="card" style={{ marginTop: 10 }}>
            <h3 className="card-title">③ 八盘展开（点击术名折叠/展开；盘内元素均可点开白话）</h3>
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              {results.map(r => (
                <button key={r.art} className={`btn sm ${open[r.art] ? '' : 'ghost'}`} onClick={() => toggle(r.art)}>
                  {open[r.art] ? '▾ ' : '▸ '}{ART_NAMES[r.art]}
                </button>
              ))}
            </div>

            {results.map(r => {
              if (!open[r.art]) return null;
              const vi = summary?.votes.find(x => x.art === r.art);
              const timings = r.cast.timing ?? [];
              const termSecs = plainTermSections(r.cast.rules.map(x => `${x.title}${x.fact ?? ''}`));
              return (
                <div key={r.art} className="art-panel card" style={{ borderLeft: `4px solid ${vi && vi.score > 0 ? '#2f9d5a' : vi && vi.score < 0 ? '#c0392b' : '#caa04d'}`, padding: 12, marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      <b style={{ fontSize: 15 }}>{ART_NAMES[r.art]}</b>
                      <span className="muted small" style={{ marginLeft: 8 }}>{ART_DESC[r.art]}</span>
                    </div>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {vi && <span className={`tag ${vi.score > 0 ? 'green' : vi.score < 0 ? 'red' : 'gold'}`}>信号 {vi.score > 0 ? `吉(+${vi.score})` : vi.score < 0 ? `凶(${vi.score})` : '中性'}</span>}
                      {timings.length > 0 && <span className="tag dai clickable" onClick={() => setPopup({ title: `${ART_NAMES[r.art]}·应期规则`, sections: timings.map(t => ({ label: t.text, value: `${t.text}${t.window ? `（${t.window}）` : ''}`, note: '应期是所有术数共同回答"什么时候"的接口。' })) })}>应期 {timings.length} 条</span>}
                      <button className="btn sm" onClick={() => setPopup({ title: `${ART_NAMES[r.art]}·全部断语（自动附术语白话）`, sections: [
                        ...r.cast.rules.map((x, i) => ({ label: `规则${i + 1}·${x.level}`, value: x.title, note: x.fact })),
                        { label: '—— 断语中出现的术语白话 ——', value: termSecs.length ? `命中 ${termSecs.length} 个术语，见下方条目` : '本条断语未命中词库术语（可去下方"术语大全"搜索）', note: '' },
                        ...termSecs,
                      ] })}>断语全览</button>
                      {/*  单盘精读：跳转向导并带参预填 */}
                      <a className="btn sm primary" href={`#/cast?art=${r.art}&t=${fmtT(time)}&g=${gender}&q=${encodeURIComponent(question.trim() || '')}`}>单盘精读 ↗</a>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <BoardRenderer spec={r.cast.board} chart={r.cast.chart} />
                  </div>

                  {r.cast.rules.length > 0 && (
                    <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
                      {r.cast.rules.slice(0, 6).map((x, i) => (
                        <span key={i} className={`tag clickable ${x.level === '吉' ? 'green' : x.level === '凶' ? 'red' : x.level === '变数' ? 'gold' : ''}`} onClick={() => setPopup({ title: `${ART_NAMES[r.art]}·${x.title}`, sections: [{ label: `${x.level}｜${x.title}`, value: x.title, note: x.fact }] })}>
                          {x.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {timings.length > 0 && (
                    <div className="muted small" style={{ marginTop: 8 }}>
                      应期原文：{timings.slice(0, 4).map(t => `${t.text}${t.window ? `(${t.window})` : ''}`).join('；')}
                    </div>
                  )}

                  {/* 应期真实日期引擎（该术专属目标） */}
                  <div style={{ marginTop: 6 }}>
                    <YingQiBoard base={time} targets={artTargets(r.art, r.cast.chart)} xunkong={(r.cast.chart as never as { xunkong?: string })?.xunkong} onShowPopup={setPopup} />
                  </div>

                  {/*  术语白话讲辑（8 术各自词库）+ 排盘分步教学·跟读 */}
                  <TermTeachCard art={r.art as TermTeachArt} onShowDetail={setPopup} />
                  <PaipanTutorialCard art={r.art} chart={r.cast.chart} />
                </div>
              );
            })}
          </div>

          {/* 保存提示 */}
          <div className="notice gold" style={{ fontSize: 12.5 }}>
            提示：单盘精读请到「起卦」向导逐术细算（可摇卦/报数/指定卦）；多盘对照存档可去「记录本」。合参页聚焦"趋势共识"，是所有术数的信号级汇总，不替代任何一门精断。
          </div>
        </>
      )}

      <ExplainerPopup popup={popup} onClose={() => setPopup(null)} />
    </div>
  );
}

export default CombinedView;
