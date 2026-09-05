/** 其余页面：首页 / 路径卡 / 统计 / 设置 / 盘面还原 */
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ART_LIST, ART_NAMES, ART_TAGLINES, defaultConfig, type ArtType, type ResolvedConfig,
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou,
  liuyaoBoard, baziBoard, meihuaBoard, ziweiBoard, qimenBoard, liurenBoard, xiaoliurenBoard, jinkouBoard,
  qimenDayBoard,
} from '@xuanshu/core';
import { allPlaybooks, playbookById } from '@xuanshu/intake';
import { computeFeedbackStats, getDB, type CaseRecord } from '@xuanshu/ledger';
import { useApp, ART_META } from './state';
import { BoardRenderer } from './boards';
import { RuleHits, AiQuickBar, AIResultModal } from './components';
import { CITY_LONGS, CITY_PROVINCES, citiesOfProvince, cityNameOf } from './castShared';
import { DISCLAIMER } from '@xuanshu/answer';
import { PROVIDERS, callAIStrict, hasEmbeddedAIFallback } from '@xuanshu/ai';
import { dailySign, SIGNS, badgesEarned, nextBadge } from './engage';
import { dailyAdvice, huangliOf, HOUR_RANGES } from '@xuanshu/core';
const providers = PROVIDERS;
const hasBuildAIFallback = hasEmbeddedAIFallback();

export function HomeView() {
  const counts = useLiveQuery(async () => {
    const db = getDB();
    const n = await db.cases.count();
    return n;
  }) ?? 0;
  const [sign, setSign] = useState(() => dailySign());
  const [shaking, setShaking] = useState(false);
  const reshuffle = () => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => { setSign(SIGNS[Math.floor(Math.random() * SIGNS.length)]); setShaking(false); }, 900);
  };
  const earned = badgesEarned(counts);
  const next = nextBadge(counts);
  return (
    <div>
      {/* 首页精简头部：仅一句问候 + 功能入口卡片（去除冗余大印章/大标题，更干净） */}
      <div style={{ margin: '6px 0 16px' }}>
        <h1 className="page-title" style={{ marginBottom: 14 }}>今天想测什么？</h1>
        <div className="home-quick">
          <a className="quick-card primary" href="#/cast" aria-label="开始引导起卦">
            <div className="q-ico">🎯</div>
            <div className="qt">引导起卦</div>
            <div className="qd">选事项 → 选术数 → 起盘</div>
          </a>
          <a className="quick-card" href="#/combine" aria-label="8术同盘合参">
            <div className="q-ico">🀄</div>
            <div className="qt">八术合参</div>
            <div className="qd">一题多术 · 共识应期</div>
          </a>
          <a className="quick-card" href="#/pro" aria-label="专业排盘自选方式">
            <div className="q-ico">🧭</div>
            <div className="qt">专业排盘</div>
            <div className="qd">自选术数 · 精细盘面</div>
          </a>
          <a className="quick-card" href="#/read" aria-label="书阁读原典">
            <div className="q-ico">📖</div>
            <div className="qt">书阁原典</div>
            <div className="qd">几十部古籍 · 精读批注</div>
          </a>
          <a className="quick-card" href="#/playbook" aria-label="断事路径卡">
            <div className="q-ico">🗺️</div>
            <div className="qt">断事路径卡</div>
            <div className="qd">九段断事 · 步步白话</div>
          </a>
          <a className="quick-card" href="#/hehun" aria-label="双入合盘合婚参考">
            <div className="q-ico">💑</div>
            <div className="qt">合盘 · 合婚参考</div>
            <div className="qd">八字七维比对 + 奇门婚缘盘</div>
          </a>
        </div>
      </div>
      <div className="card xuanshu-pop" style={{ maxWidth: 780, margin: '0 auto 14px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 className="card-title"><span className="xuanshu-breathe">🎋</span> 每日一签 · {new Date().getMonth() + 1}月{new Date().getDate()}日</h3>
          <button className="btn sm" onClick={reshuffle} disabled={shaking}>{shaking ? '摇签中…' : '🔀 重摇一签'}</button>
        </div>
        <span className={`xuanshu-stamp ${shaking ? 'xuanshu-shake' : ''}`} style={{ fontSize: 14 }}><b>{sign.title}</b></span>
        <div style={{ marginTop: 10, lineHeight: 1.9 }}>{sign.text}</div>
        <div className="muted small" style={{ marginTop: 8 }}>玄枢签是对今日气象的一句白话提醒，当生活小确幸读就好；重大决策仍以完整起卦为准。</div>
      </div>
      {/* 今日吉向（D4）：离线推算当日黄道吉时/建除/空亡 */}
      <DailyAdviceCard />
      {/* 预设生辰引导（未设置时提醒，设置了自动消失） */}
      <BirthGuideCard />
      <div className="card" style={{ maxWidth: 780, margin: '0 auto 14px' }}>
        <h3 className="card-title">🌈 今天可以测什么？<span className="tag dai" style={{ marginLeft: 6 }}>不会问也没关系，点一个直接开始</span></h3>
        <div className="row wrap" style={{ gap: 6 }}>
          <a className="tag clickable" style={{ fontSize: 12.5 }} href="#/cast?q=三天内这件事会不会有结果？">三天内有结果吗？</a>
          <a className="tag clickable" style={{ fontSize: 12.5 }} href="#/cast?q=最近适合换个工作方向吗？">该换个方向吗？</a>
          <a className="tag clickable" style={{ fontSize: 12.5 }} href="#/cast?q=我和TA这段关系的进展如何？">感情进展如何？</a>
          <a className="btn sm ghost" href="#/cast">好，我自己写 ⟶</a>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>点一下直接把问句带入向导：选事项 → 选术数 → 起盘，一分钟出盘。</div>
      </div>
      <div className="card" style={{ maxWidth: 980, margin: '0 auto 14px' }}>
        <h3 className="card-title">🏅 打卡成就</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          {earned.length > 0 && earned.map(b => <span key={b.n} className="tag green" style={{ fontSize: 12.5 }}>{b.icon} {b.name}（{b.desc}）</span>)}
          {!earned.length && <span className="muted small">还没有解锁徽章——完成 5 次起卦，解锁第一枚「🌱 初入玄枢」。</span>}
        </div>
        {next && <div className="muted small" style={{ marginTop: 6 }}>下一枚：{next.icon} {next.name}（累计 {counts}/{next.need}，还差 {Math.max(0, next.need - counts)} 次）。</div>}
      </div>
      <div className="grid4" style={{ maxWidth: 980, margin: '0 auto' }}>
        {ART_LIST.map(a => (
          <a key={a} className="art-card" href={`#/cast?art=${a}`} aria-label={`用${ART_NAMES[a]}起卦`}>
            {!ART_NAMES[a].includes(ART_META[a].icon) && <div className="art-ico" style={{ background: ART_META[a].color + '22', color: ART_META[a].color }}>{ART_META[a].icon}</div>}
            <div className="n">{ART_NAMES[a]} <span className="tag dai" style={{ marginLeft: 4 }}>{ART_META[a].klass}</span></div>
            <div className="d">{ART_TAGLINES[a]}</div>
          </a>
        ))}
      </div>
      <div className="muted small" style={{ textAlign: 'center', marginTop: 22, padding: '0 12px', lineHeight: 1.8 }}>{DISCLAIMER}</div>
    </div>
  );
}

/** 今日吉向卡（D4+黄历增强）：离线推算黄道吉时/建除/空亡 + 农历/星座/黄历宜忌 + 个人运势入口 */
export function DailyAdviceCard() {
  const { settings } = useApp();
  const a = useMemo(() => dailyAdvice(new Date()), []);
  const hl = useMemo(() => {
    const n = new Date();
    return huangliOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }, []);
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return (
    <div className="card xuanshu-rise" style={{ maxWidth: 780, margin: '0 auto 14px' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 className="card-title"><span className="xuanshu-breathe">☀️</span> 今日吉向与黄历 · {a.monthDay}</h3>
        <span className="tag gold" style={{ fontSize: 12 }}>日柱 {a.dayPillar}</span>
      </div>
      <p className="small" style={{ margin: '4px 0 10px', color: 'var(--ink-2)' }}>
        {hl.lunar} · {hl.lunarYear}年 · 星座 {hl.xingZuo} <a href="#/xingzuo" style={{ whiteSpace: 'nowrap' }}>🔮 详解→</a>{hl.solarTermNote ? ` ｜ ${hl.solarTermNote}` : ''}
      </p>
      <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-2)' }}>{a.advice}</p>
      <div className="grid2" style={{ gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--green)', color: '#fff', borderRadius: 10, opacity: .92 }}>
          <div className="small" style={{ opacity: .85 }}>宜</div>
          <div>{a.yi.join('、') || '—'}</div>
        </div>
        <div style={{ padding: 10, background: 'var(--red)', color: '#fff', borderRadius: 10, opacity: .9 }}>
          <div className="small" style={{ opacity: .85 }}>忌</div>
          <div>{a.ji.join('、') || '—'}</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, margin: '10px 0 4px' }}>
        <span className="tag dai">建除「{a.jianChu}」</span>
        <span className="tag dai">空亡「{a.xunKongZhi}」</span>
        <span className="tag dai">冲 {hl.chong || '无'} · 煞{hl.sha || '无'}</span>
        <span className="tag dai">纳音 {hl.dayNaYin}（日）</span>
        {settings.birth && <a className="btn sm ghost" href="#/calendar" style={{ marginLeft: 'auto' }}>🌟 今日个人运势 ⟶</a>}
        {!settings.birth && <a className="btn sm ghost" href="#/calendar" style={{ marginLeft: 'auto' }}>📅 万年历 · 每日黄历 ⟶</a>}
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>★ 今日黄道吉时 {a.bestHours.length} 个：</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {a.bestHours.slice(0, 8).map(h => (
          <span key={h.zhi} className="tag clickable" title={`${h.label}（${h.zhi}） 值神 ${h.god}`}
            style={{ background: 'var(--gold-soft)', color: 'var(--gold)', border: '1px solid var(--line)' }}>
            {h.label} {HOUR_RANGES[ZHI.indexOf(h.zhi)]}
          </span>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>历法口径离线推算，仅供参考；重大事项建议配八术排盘与应期窗口再定。</div>
    </div>
  );
}

/** 预设生辰引导卡（未设置生辰时在首页提醒；设置了自动消失，可"以后再说"关掉） */
export function BirthGuideCard() {
  const { settings } = useApp();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('xuanshu.birthguide.dismiss') === '1'; } catch { return false; }
  });
  if (settings.birth || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('xuanshu.birthguide.dismiss', '1'); } catch { /* ignore */ }
  };
  return (
    <div className="card" style={{ maxWidth: 780, margin: '0 auto 14px', borderColor: 'var(--gold)', background: 'var(--gold-soft)' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 26 }}>🎂</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="card-title" style={{ margin: '0 0 4px', color: 'var(--gold)' }}>设置预设生辰 · 解锁个人定制</h3>
          <div className="small" style={{ lineHeight: 1.7, color: 'var(--ink-2)' }}>
            填一次生辰（日期+时辰+性别，出生地可选）：<b>每日个人运势</b>（幸运色/数字/健康/爱情/财富/事业）、<b>万年历</b>星座画像与精细化推荐、<b>八字·紫微排盘</b>默认值都会自动带上你的八字底色。不填则回退到当前时刻。
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            <a className="btn primary sm" href="#/settings">⚙️ 去设置生辰 ⟶</a>
            <button className="btn sm ghost" onClick={dismiss}>以后再说</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlaybookView() {
  const [open, setOpen] = useState<string | null>(null);
  const pb = open ? playbookById(open) : null;
  if (pb) {
    return (
      <div>
        <div className="page-head">
          <button className="btn sm ghost" onClick={() => setOpen(null)}>← 全部路径卡</button>
          <div className="page-title">{pb.category}{pb.subCategory ? ` · ${pb.subCategory}` : ''}</div>
          <span className="tag gold">九段断事路径卡</span>
        </div>
        <div className="card">
          <h3 className="card-title">① 术数选择</h3>
          <p>主：<b>{ART_NAMES[pb.arts.primary]}</b>——{pb.arts.whyPrimary}</p>
          {pb.arts.alternates.length > 0 && <p className="muted small">备选：{pb.arts.alternates.map(a => `${ART_NAMES[a.art]}（${a.reason}）`).join('；')}</p>}
        </div>
        <div className="card"><h3 className="card-title">② 怎么问</h3>
          {pb.howToAsk.goodExamples.map(g => <div key={g} className="small">✅ {g}</div>)}
          {pb.howToAsk.badExamples.map(b => <div key={b.text} className="small" style={{ color: 'var(--red)' }}>❌ {b.text}（{b.why}）</div>)}
          <div className="muted small" style={{ marginTop: 6 }}>必填：{pb.howToAsk.requiredFields.join('、')}</div>
        </div>
        <div className="card"><h3 className="card-title">③ 怎么起</h3><p className="small">{pb.howToCast}</p></div>
        <div className="card"><h3 className="card-title">④ 取用神</h3>
          {pb.yongShen.map(y => (
            <div key={y.ruleId} className="rule-hit">
              <div className="rule-head"><span className="tag dai">{y.yongShen}</span><span className={`cit-badge ${y.confidenceLevel}`}>{y.confidenceLevel} 级</span></div>
              <div className="small">{y.condition}</div>
              <div>{y.citations.map((c, i) => <a key={i} className={`cit-badge ${c.confidenceLevel}`} href={`#/read/${c.canonicalId}?seg=${encodeURIComponent(c.segId)}&from=${encodeURIComponent(pb.id)}`}>〔{c.book}·{c.chapter} ↗〕</a>)}</div>
            </div>
          ))}
        </div>
        <div className="card"><h3 className="card-title">⑤ 看什么信号</h3>
          {pb.signals.map(s => (
            <div key={s.ruleId} className={`rule-hit ${s.meaning === '吉' ? 'ji' : s.meaning === '凶' ? 'xiong' : 'bian'}`}>
              <div className="rule-head"><span className={`tag ${s.meaning === '吉' ? 'ji' : s.meaning === '凶' ? 'xiong' : 'bian'}`}>{s.meaning}</span><b className="rule-title">{s.name}</b></div>
              <div className="small">{s.fact}</div>
            </div>
          ))}
        </div>
        {pb.locating && <div className="card"><h3 className="card-title">⑥ 定方位/取象 <span className={`cit-badge ${pb.locating.confidenceLevel}`}>{pb.locating.confidenceLevel} 级</span></h3><p className="small">{pb.locating.text}</p></div>}
        <div className="card"><h3 className="card-title">⑦ 断应期</h3>
          {pb.timing.rules.map(r => <div key={r.ruleId} className="small" style={{ marginBottom: 4 }}>· {r.name}</div>)}
          <div className="muted small">兜底：{pb.timing.fallback}</div>
        </div>
        <div className="card"><h3 className="card-title">⑧ 读哪本书（点读直达）</h3>
          {pb.readingList.map(r => (
            <div key={r.canonicalId + r.chapter} className="small" style={{ marginBottom: 6 }}>
              <a className="cit-badge A" href={`#/read/${r.canonicalId}?from=${encodeURIComponent(pb.id)}`}>《{r.book}》·{r.chapter} ↗</a>
              <span className="muted"> {r.why}</span> <span className="tag gold">P{r.priority}</span>
            </div>
          ))}
        </div>
        <div className="card"><h3 className="card-title">⑨ 怎么记</h3>
          <div className="small">{pb.recordTemplate.fields.map(f => f.label).join(' / ')}</div>
          <div className="muted small" style={{ marginTop: 4 }}>{pb.recordTemplate.hint}</div>
        </div>
        <div className="notice danger">禁用：{pb.forbidden.join('；')}</div>
        <div className="notice gold">{pb.disclaimer}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="page-head"><div className="page-title">断事路径卡 · Playbook</div><div className="page-desc">每事项一张九段路径：怎么问 → 怎么起 → 取用神 → 看什么 → 定方位 → 断应期 → 读哪本书 → 怎么记</div></div>
      <div className="grid3">
        {allPlaybooks.map(p => (
          <button key={p.id} className="card book-card" style={{ textAlign: 'left' }} onClick={() => setOpen(p.id)}>
            <div className="row"><b style={{ fontFamily: 'var(--font-classical)', fontSize: 16 }}>{p.category}{p.subCategory ? `·${p.subCategory}` : ''}</b><span className="tag dai">{ART_NAMES[p.arts.primary]}</span></div>
            <div className="muted small" style={{ marginTop: 6 }}>{p.arts.whyPrimary}</div>
            <div className="row" style={{ marginTop: 8 }}>
              {p.readingList.slice(0, 2).map(r => <span key={r.chapter} className="tag gold">《{r.book}》</span>)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatsView() {
  const stats = useLiveQuery(async () => computeFeedbackStats(), []) ?? null;
  const sampleWarn = (n: number) => n < 20 ? <span className="tag gold" title="样本 <20 条时显式标注">样本不足，仅供参考</span> : null;
  return (
    <div>
      <div className="page-head"><div className="page-title">个人校准看板</div><div className="page-desc">本地闭环统计：只校准你的解释习惯，绝不回写排盘层</div></div>
      {!stats || Object.keys(stats.byArt).length === 0 && <div className="notice info">暂无数据——在记录本中回标「应验/未应验」后，这里会给出按术数/事项/规则维度的命中统计。</div>}
      {stats && (
        <>
          <div className="card">
            <h3 className="card-title">按术数</h3>
            <table className="bz-table" style={{ fontFamily: 'var(--font-ui)' }}>
              <thead><tr><th>术数</th><th>总数</th><th>已回标</th><th>应验</th><th>确认率</th><th>样本</th></tr></thead>
              <tbody>
                {Object.entries(stats.byArt).map(([art, v]) => (
                  <tr key={art}><td>{ART_NAMES[art as ArtType] ?? art}</td><td>{v.total}</td><td>{v.judged}</td><td>{v.hit}</td>
                    <td>{v.judged ? `${Math.round(v.hit / v.judged * 100)}%` : '—'}</td>
                    <td>{v.judged < 20 ? sampleWarn(v.judged) : '✓'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(stats.byRuleId).length > 0 && (
            <div className="card">
              <h3 className="card-title">规则维度（shown/confirmed）</h3>
              {Object.entries(stats.byRuleId).slice(0, 20).map(([rid, v], i) => (
                <div key={rid} className="row small" style={{ gap: 10 }}>
                  <code className="rule-id" style={{ flex: 1 }}>规则 {i + 1}</code>
                  <span className="muted">展示 {v.shown} · 确认 {v.confirmed}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SettingsView() {
  const { config, setConfig, settings, setSettings, ai, setAI, toast, corpus, kbIndex } = useApp();
  const [cityProv, setCityProv] = useState('');
  const up = (p: Partial<ResolvedConfig>) => setConfig({ ...config, ...p });
  return (
    <div>
      <div className="page-head"><div className="page-title">设置</div><div className="page-desc">所有历法与流派选择随记录自动保存——改设置只影响新起的盘，旧记录原样保留</div></div>
      <div className="card">
        <h3 className="card-title">历法约定</h3>
        <div className="grid2">
          <label className="field"><span>换年</span>
            <select className="select" value={config.calendar.yearSwitch} onChange={e => up({ calendar: { ...config.calendar, yearSwitch: e.target.value as never } })}>
              <option value="lichun">立春换年（默认）</option><option value="chunyi">正月初一换年</option>
            </select>
          </label>
          <label className="field"><span>换月</span>
            <select className="select" value={config.calendar.monthSwitch} onChange={e => up({ calendar: { ...config.calendar, monthSwitch: e.target.value as never } })}>
              <option value="jieqi">节气换月（默认）</option><option value="lunar">农历初一换月</option>
            </select>
          </label>
          <label className="field"><span>子时约定</span>
            <select className="select" value={config.calendar.zishi} onChange={e => up({ calendar: { ...config.calendar, zishi: e.target.value as never } })}>
              <option value="switch">23 点切次日日柱（默认）</option><option value="night">夜子时仍属当日</option>
            </select>
          </label>
          <label className="field"><span>真太阳时</span>
            <select className="select" value={config.calendar.trueSolarTime ? 'on' : 'off'} onChange={e => up({ calendar: { ...config.calendar, trueSolarTime: e.target.value === 'on', longitude: e.target.value === 'on' ? (config.calendar.longitude ?? 120) : null } })}>
              <option value="off">关闭（默认，北京时间）</option><option value="on">开启（需参考经度）</option>
            </select>
          </label>
          {config.calendar.trueSolarTime && (
            <div className="row wrap" style={{ gap: 6, gridColumn: '1 / -1' }}>
              <label className="field" style={{ width: 130, marginBottom: 0 }}><span>参考省份</span>
                <select className="select" value={cityProv} onChange={e => setCityProv(e.target.value)}>
                  <option value="">全部省份</option>
                  {CITY_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="field" style={{ width: 190, marginBottom: 0 }}><span>参考城市（自动填入经度）</span>
                <select className="select" value={cityNameOf(config.calendar.longitude, config.calendar.city, config.calendar.latitude ?? undefined) ?? 'custom'} onChange={e => {
                  const v = e.target.value;
                  if (v === 'custom') return;
                  const c = CITY_LONGS.find(x => x.n === v);
                  if (c) up({ calendar: { ...config.calendar, longitude: c.lng, latitude: c.lat, city: c.n } });
                }}>
                  <option value="custom">自定义（用下方经度框精调）</option>
                  {citiesOfProvince(cityProv || undefined).map(c => <option key={c.n} value={c.n}>{c.n}（{c.lng}°E）</option>)}
                </select>
              </label>
              <label className="field" style={{ width: 170, marginBottom: 0 }}><span>参考经度（东经°E，精调）</span>
                <input className="input" type="number" step="0.1" value={config.calendar.longitude ?? 120} onChange={e => up({ calendar: { ...config.calendar, longitude: Number(e.target.value), city: undefined, latitude: undefined } })} />
              </label>
            </div>
          )}
        </div>
        <div className="muted small">北京时间 ≠ 真太阳时（均时差 ±16 分钟 + 经度差每度 4 分钟）；仅当时辰处在交界附近才影响时柱。</div>
      </div>
      <div className="card">
        <h3 className="card-title">预设个人生辰（供每日运势 / 万年历 / 八字排盘默认值）</h3>
        {settings.birth ? (
          <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span className="tag gold" style={{ fontSize: 13 }}>
              {settings.birth.year}年{settings.birth.month}月{settings.birth.day}日 {String(settings.birth.hour).padStart(2, '0')}:{String(settings.birth.minute).padStart(2, '0')} · {settings.birth.gender}
              {settings.birth.location ? ` · ${settings.birth.location}` : ''}
            </span>
            <button className="btn sm" onClick={() => setSettings({ ...settings, birth: null })}>清除</button>
            <a className="btn sm ghost" href="#/calendar">查看今日个人运势 ⟶</a>
          </div>
        ) : (
          <div className="muted small">未设置。设置后，每日运势/万年历可给出以你八字为底色的幸运色、数字、健康与爱情/财富/事业指数。</div>
        )}
        <BirthForm
          initial={settings.birth}
          onSave={(b) => setSettings({ ...settings, birth: b })}
        />
      </div>
      <div className="card">
        <h3 className="card-title">紫微配置（四化版本）</h3>
        <div className="grid2">
          <label className="field"><span>四化版本</span>
            <select className="select" value={config.ziwei.sihuaVersion} onChange={e => up({ ziwei: { ...config.ziwei, sihuaVersion: e.target.value as never } })}>
              <option value="quanji">全集主流（默认）</option><option value="zhanyan">占验门</option><option value="feixing">飞星派（D 级，不内置口诀）</option>
            </select>
          </label>
          <label className="field"><span>闰月归并</span>
            <select className="select" value={config.ziwei.fixLeap ? '1' : '0'} onChange={e => up({ ziwei: { ...config.ziwei, fixLeap: e.target.value === '1' } })}>
              <option value="1">闰月归下月（默认）</option><option value="0">闰月按上半月计</option>
            </select>
          </label>
        </div>
        <div className="notice warn" style={{ fontSize: 12.5 }}>庚/壬干化科存在版本分歧（全集=太阴/左辅，占验门=天相/武曲）：差异项将并列标注「版本存疑」，绝不静默合并；所选版本随记录保存，可复现。</div>
      </div>
      <div className="card">
        <h3 className="card-title">案例本配额</h3>
        <label className="field" style={{ maxWidth: 260 }}><span>每术上限</span>
          <select className="select" value={String(settings.quotaLimit)} onChange={e => setSettings({ ...settings, quotaLimit: e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value) })}>
            <option value="99">99 条（默认）</option><option value="199">199 条</option><option value="unlimited">无限（建议仅桌面）</option>
          </select>
        </label>
        <div className="muted small">90 条软提醒；满额引导归档/导出，绝不静默删除。</div>
      </div>
      <div className="card">
        <h3 className="card-title">外观与可访问性</h3>
        <div className="row wrap">
          <label className="field"><span>主题</span>
            <select className="select" value={settings.theme} onChange={e => setSettings({ ...settings, theme: e.target.value as never })}>
              <option value="light">浅色（宣纸）</option><option value="dark">深色（墨）</option><option value="auto">跟随系统</option>
            </select>
          </label>
          <label className="row" style={{ marginTop: 22, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.highContrast} onChange={e => setSettings({ ...settings, highContrast: e.target.checked })} />
            <span className="small">高对比模式</span>
          </label>
        </div>
      </div>
      <div className="card">
        <h3 className="card-title">AI 辅助解读（默认关闭）</h3>
        <label className="row" style={{ cursor: 'pointer', marginBottom: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" style={{ marginTop: 2, flex: 'none' }} checked={ai.enabled} onChange={e => setAI({ ...ai, enabled: e.target.checked })} />
          <span className="small" style={{ flex: 1, minWidth: 0, lineHeight: 1.6 }}>启用 AI 精解（仅语言组织与权衡；受 schema 约束；无证据即报缺口）</span>
        </label>
        {ai.enabled && (
          <div className="grid2">
            <label className="field"><span>提供商</span>
              <select className="select" value={ai.providerId} onChange={e => setAI({ ...ai, providerId: e.target.value })}>
                {providers.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </label>
            <label className="field"><span>baseUrl（custom 必填，openrouter 可留空）</span>
              <input className="input" value={ai.baseUrl} onChange={e => setAI({ ...ai, baseUrl: e.target.value })} placeholder={ai.providerId === 'openrouter' ? '留空即 https://openrouter.ai/api/v1/chat/completions' : 'https://…/chat/completions'} />
            </label>
            <label className="field"><span>模型名（可使用提供商默认值或填写自定义 ID）</span>
              <input className="input" value={ai.model} onChange={e => setAI({ ...ai, model: e.target.value })} placeholder={ai.providerId === 'openrouter' ? '留空使用 openrouter/free' : '如 deepseek-chat'} />
            </label>
            <label className="field"><span>API Key（{hasBuildAIFallback ? '可选；手动值仅保存在内存' : '必填；只保存在当前页面内存'}）</span>
              <input className="input" type="password" value={ai.keyInMemory ?? ''} onChange={e => setAI({ ...ai, keyInMemory: e.target.value })} placeholder={hasBuildAIFallback ? '留空使用本机构建保底' : '刷新或退出应用后清除'} autoComplete="off" />
            </label>
            {ai.providerId === 'openrouter' && <div className="muted small" style={{ gridColumn: '1 / -1' }}>OpenRouter 兼容 OpenAI 接口：模型可留空使用免费路由；手动 Key 始终优先。</div>}
          </div>
        )}
        <div className="muted small">{hasBuildAIFallback ? '本机构建已配置加密 OpenRouter 保底；未输入手动 Key 时会固定使用免费路由。' : '当前构建未配置 AI 保底，需要手动输入 Key。'}手动 Key 不持久化，刷新或退出后清除。AI 输出一律 E 级标注「AI 生成，未经原典核实」。</div>
      </div>
      <div className="card">
        <h3 className="card-title">知识库</h3>
        <div className="muted small">已载入语料 {corpus.all().length} 段；BM25 索引 {kbIndex.docs.length} 文档，平均长度 {Math.round(kbIndex.avgLen)} 词。导入管线支持 txt/md/epub/pdf/docx（用户自有书库标记 user-owned，不云同步）。</div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => toast('导入管线：请将文件放入 data/.kb/books/<canonicalId>/，或使用桌面壳的导入对话框')}>导入书库（说明）</button>
      </div>
      <div className="card">
        <h3 className="card-title">关于 · 数据</h3>
        <div className="muted small" style={{ lineHeight: 2 }}>
          玄枢 xuanshu · 八术综合占卜工作台——传统历法与文化研究工具，非医疗/投资/法律建议。<br />
          {DISCLAIMER}
        </div>
      </div>
    </div>
  );
}

/** 一键还原当时盘面（§5.1 任意一条可还原） */
export function CaseBoardView({ caseId }: { caseId: string }) {
  const rec = useLiveQuery(async () => getDB().cases.get(caseId), [caseId]) as CaseRecord | undefined;
  const { ai, toast, requestAISetup } = useApp();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState('');
  const promptOf = (r: CaseRecord) => {
    const lines: string[] = [];
    lines.push(`# 玄枢 · ${ART_NAMES[r.artType] ?? r.artType} 盘面回看`);
    lines.push(`当时问卦：${r.question.summary}${r.question.text ? `（${r.question.text}）` : ''}`);
    lines.push('当时断语：');
    r.result.ruleHits.slice(0, 12).forEach(x => lines.push(`- [${x.level}] ${x.title}：${x.fact ?? ''}`));
    lines.push('【解读要求】用通俗中文重新解读这些断语：先给结论再给依据；对未在原典/断语中出现的内容标注「未见依据」；不编造具体年份数字。');
    return lines.join('\n');
  };
  const askAI = async () => {
    if (!ai.enabled) { requestAISetup(); return; }
    if (!rec) return;
    setAiBusy(true); setAiErr(null); setAiText(null);
    try {
      const r = await callAIStrict(ai, promptOf(rec));
      if (r.ok) setAiText(r.text ?? '（AI 未返回内容）');
      else setAiErr(r.error ?? '调用失败');
    } catch (e) { setAiErr(e instanceof Error ? e.message : String(e)); }
    finally { setAiBusy(false); }
  };
  const board = useMemo(() => {
    if (!rec) return null;
    try {
      const chart = rec.result.chart as never;
      switch (rec.artType) {
        case 'bazi': return baziBoard(chart, defaultConfig());
        case 'liuyao': return liuyaoBoard(chart);
        case 'meihua': return meihuaBoard(chart);
        case 'ziwei': return ziweiBoard(chart);
        case 'qimen': return (chart as { timeType?: string }).timeType === 'ri'
          ? qimenDayBoard(chart as never)
          : qimenBoard(chart);
        case 'liuren': return liurenBoard(chart);
        case 'xiaoliuren': return xiaoliurenBoard(chart);
        case 'jinkou': return jinkouBoard(chart);
      }
    } catch { return null; }
  }, [rec]);
  if (!rec) return <div className="notice warn">记录不存在或已删除。</div>;
  return (
    <div>
      <div className="page-head">
        <a className="btn sm ghost" href="#/ledger">← 记录本</a>
        <div className="page-title">盘面还原 · {rec.question.summary}</div>
      </div>
      <AiQuickBar
        onAskAI={askAI}
        aiBusy={aiBusy}
        onCopyPrompt={async () => {
          try { await navigator.clipboard.writeText(promptOf(rec)); setCopyMsg('已复制提示词（可发给任意大模型/搜索）'); setTimeout(() => setCopyMsg(''), 3200); }
          catch { setCopyMsg('复制失败，请检查浏览器权限'); setTimeout(() => setCopyMsg(''), 3200); }
        }}
        copyMsg={copyMsg || undefined}
        hint="🤖 时过境迁看回盘：让 AI 白话重读当时的断语，或复制提示词自己问。"
      />
      {rec.degraded && <div className="notice warn">此记录为降级记录（{rec.input.raw.hourMissing ? '缺时辰' : '输入不完整'}）——按当时状态还原。</div>}
      {board && <BoardRenderer spec={board} chart={rec.result.chart} />}
      <div className="card">
        <h3 className="card-title">当时的断语（按记录时的配置生成，绝不批量改写旧记录）</h3>
        <RuleHits hits={rec.result.ruleHits} fromCaseId={rec.caseId} />
      </div>
      <AIResultModal text={aiText} error={aiErr} question={rec.question.summary} onClose={() => { setAiText(null); setAiErr(null); }} toastMsg={toast} />
    </div>
  );
}

/** 预设个人生辰表单（BirthForm）：数字输入 + 出生地省→市二级选择 + 保存/更新 */
function BirthForm({ initial, onSave }: {
  initial: { year: number; month: number; day: number; hour: number; minute: number; gender: '男' | '女'; location?: string } | null;
  onSave: (b: { year: number; month: number; day: number; hour: number; minute: number; gender: '男' | '女'; location?: string }) => void;
}) {
  const now = new Date();
  // 出生地回显：由已存城市反查省份
  const initLoc = initial?.location?.trim() ?? '';
  const initCity = CITY_LONGS.find(c => c.n === initLoc);
  const [b, setB] = useState({
    year: initial?.year ?? 1990,
    month: initial?.month ?? 1,
    day: initial?.day ?? 1,
    hour: initial?.hour ?? 12,
    minute: initial?.minute ?? 0,
    gender: (initial?.gender ?? '男') as '男' | '女',
    location: initLoc,
  });
  const [bProv, setBProv] = useState(initCity?.p ?? '');
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<typeof b>) => setB(prev => ({ ...prev, ...p }));
  const canSave = b.year >= 1900 && b.year <= now.getFullYear() && b.month >= 1 && b.month <= 12 && b.day >= 1 && b.day <= 31;
  return (
    <div className="row wrap" style={{ gap: 6, alignItems: 'flex-end', marginTop: 8 }}>
      <label className="field" style={{ width: 88 }}><span>年</span>
        <input className="input" type="number" min={1900} max={now.getFullYear()} value={b.year} onChange={e => set({ year: Number(e.target.value) })} />
      </label>
      <label className="field" style={{ width: 68 }}><span>月</span>
        <input className="input" type="number" min={1} max={12} value={b.month} onChange={e => set({ month: Number(e.target.value) })} />
      </label>
      <label className="field" style={{ width: 68 }}><span>日</span>
        <input className="input" type="number" min={1} max={31} value={b.day} onChange={e => set({ day: Number(e.target.value) })} />
      </label>
      <label className="field" style={{ width: 68 }}><span>时</span>
        <input className="input" type="number" min={0} max={23} value={b.hour} onChange={e => set({ hour: Number(e.target.value) })} />
      </label>
      <label className="field" style={{ width: 68 }}><span>分</span>
        <input className="input" type="number" min={0} max={59} value={b.minute} onChange={e => set({ minute: Number(e.target.value) })} />
      </label>
      <label className="field" style={{ width: 76 }}><span>性别</span>
        <select className="select" value={b.gender} onChange={e => set({ gender: e.target.value as '男' | '女' })}>
          <option>男</option><option>女</option>
        </select>
      </label>
      <label className="field" style={{ width: 110 }}><span>出生省（可选）</span>
        <select className="select" value={bProv} onChange={e => { setBProv(e.target.value); set({ location: '' }); }}>
          <option value="">不指定</option>
          {CITY_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="field" style={{ width: 130 }}><span>出生城市（可选）</span>
        <select className="select" value={b.location} onChange={e => set({ location: e.target.value })}>
          <option value="">不指定</option>
          {citiesOfProvince(bProv || undefined).map(c => <option key={c.n} value={c.n}>{c.n}</option>)}
        </select>
      </label>
      <button className="btn primary sm" disabled={!canSave}
        onClick={() => {
          onSave({ ...b, location: b.location.trim() || undefined });
          setSaved(true);
          setTimeout(() => setSaved(false), 2200);
        }}>{initial ? '更新生辰' : '保存生辰'}</button>
      {saved && <span className="tag green">已保存 ✓</span>}
    </div>
  );
}
