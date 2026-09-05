/** 万年历（CalendarView）：今日/明日/本周/本月/本年 多周期页签 = 黄历 + 个人运势解析(+星座摘要)。
 * 星座完整画像在独立页 #/xingzuo；此页保留轻摘要与入口。
 */
import React, { useMemo, useState } from 'react';
import { huangliMonth, huangliOf, xingZuoProfile, fortuneOf, defaultConfig, stableHash, type HuangliDay, type DailyFortune, type BirthSpec } from '@xuanshu/core';
import { useApp } from './state';

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'];
const CN_MONTH = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const ARAB_MONTH = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const FORTUNE_COLORS: Record<string, string> = { 吉: 'var(--lv-a, #3a8f5f)', 平: 'var(--lv-b, #b8860b)', 注意: 'var(--lv-d, #a63f36)' };

type TabKey = 'today' | 'tomorrow' | 'week' | 'month' | 'year';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'tomorrow', label: '明日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
];

function fortuneFor(birth: BirthSpec | null, y: number, m: number, d: number): DailyFortune | null {
  if (!birth) return null;
  try { return fortuneOf({ ...birth }, y, m, d, defaultConfig(), stableHash(defaultConfig())); } catch { return null; }
}

const fmtScore = (n: number) => (n >= 70 ? '吉' : n >= 45 ? '平' : '注意');

/** 某日黄历详情卡 */
function DayDetailCard({ hl }: { hl: HuangliDay }) {
  return (
    <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
      <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
        <h3 className="card-title" style={{ margin: 0 }}>{hl.date.slice(0, 4)}年{Number(hl.date.slice(5, 7))}月{Number(hl.date.slice(8))}日 · {hl.week}</h3>
        <span className="tag" style={{ marginLeft: 'auto', background: 'var(--gold-soft)' }}>{hl.ganzhi}日 {hl.monthPillar}月</span>
      </div>
      <div className="muted small" style={{ marginBottom: 10 }}>{hl.lunar} · {hl.lunarYear}年 · 生肖{hl.shengXiao} · 纳音 {hl.yearNaYin}（年）/{hl.monthNaYin}（月）/{hl.dayNaYin}（日）</div>
      {hl.solarTermNote && <div className="notice info small" style={{ marginBottom: 10 }}>{hl.solarTermNote}</div>}

      <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
        <div style={{ padding: 10, background: 'var(--green)', color: '#fff', borderRadius: 10, opacity: .92 }}>
          <div className="small" style={{ opacity: .85 }}>宜</div>
          <div>{hl.yi.join('、') || '无特别宜事'}</div>
        </div>
        <div style={{ padding: 10, background: 'var(--red)', color: '#fff', borderRadius: 10, opacity: .9 }}>
          <div className="small" style={{ opacity: .85 }}>忌</div>
          <div>{hl.ji.join('、') || '无特别禁忌'}</div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
        <span className="tag dai">建除 {hl.jianChu}</span>
        <span className="tag dai">值神 {hl.zhiXing}</span>
        <span className="tag dai">冲 {hl.chong || '无'} · 煞{hl.sha || '无'}</span>
        <span className="tag dai">二十八宿 {hl.xiu}（{hl.xiuLuck}）· 七政{hl.zheng}</span>
        {hl.wuHou && <span className="tag dai">物候 {hl.wuHou}</span>}
        {hl.hou && <span className="tag dai">72候 {hl.hou}</span>}
      </div>

      {hl.jiShen.length > 0 && <div className="small" style={{ marginBottom: 4 }}><b>吉神宜趋：</b>{hl.jiShen.join('、')}</div>}
      {hl.xiongSha.length > 0 && (
        <div className="small" style={{ marginBottom: 4, color: 'var(--lv-d)' }}><b>凶煞宜忌：</b>{hl.xiongSha.join('、')}</div>
      )}
      {hl.pengZu.length > 0 && (
        <div className="small" style={{ marginBottom: 4, lineHeight: 1.7 }}><b>彭祖百忌：</b>
          {hl.pengZu.map(p => <span key={p} className="tag dai" style={{ marginRight: 4, fontSize: 11 }}>{p.trim()}</span>)}
        </div>
      )}
      {hl.xiuSong && (
        <details style={{ marginTop: 4 }}>
          <summary className="small" style={{ cursor: 'pointer', color: 'var(--dai)' }}>宿歌（点击展开全文）</summary>
          <div className="muted small" style={{ marginTop: 4, lineHeight: 1.9 }}>{hl.xiuSong}</div>
        </details>
      )}
    </div>
  );
}

/** 个人运势卡 */
function FortuneCard({ f, title }: { f: DailyFortune; title: string }) {
  return (
    <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
      <div className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
        <h3 className="card-title" style={{ margin: 0 }}>🌟 {title} · {f.date.slice(5)}</h3>
        <span className="tag dai" style={{ marginLeft: 'auto' }}>{f.birthDesc}</span>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>喜用：{f.yongShenText} · {f.strength} · 星座 {f.xingZuo}</div>
      <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
        <span className="tag gold">🎨 幸运色 {f.luckyColors.join('、')}</span>
        <span className="tag gold">🔢 幸运数字 {f.luckyNumbers.join('、')}</span>
        <span className="tag gold">❤️ 健康指数 {f.healthScore}</span>
      </div>
      <div className="grid2" style={{ gap: 8, marginBottom: 8 }}>
        {f.metrics.map(mt => (
          <div key={mt.label} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--gold-soft)' }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <b>{mt.label}</b>
              <span className="tag" style={{ marginLeft: 'auto', background: FORTUNE_COLORS[mt.level], color: '#fff', fontSize: 11 }}>{mt.score} · {mt.level}</span>
            </div>
            <div className="small" style={{ marginTop: 3 }}>{mt.text}</div>
          </div>
        ))}
      </div>
      {f.tips.length > 0 && (
        <div className="small" style={{ marginBottom: 4 }}>
          <b>今日提点：</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{f.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {f.cautions.length > 0 && (
        <div className="small" style={{ marginBottom: 4, color: 'var(--lv-d)' }}>
          <b>注意事项：</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{f.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      <div className="notice info small" style={{ marginTop: 8 }}>{f.summary}</div>
    </div>
  );
}

/** 星座轻摘要卡（完整画像在 #/xingzuo） */
function XzCard({ f, hl }: { f: DailyFortune | null; hl: HuangliDay }) {
  const xz = xingZuoProfile(hl.xingZuo);
  return (
    <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
      <h3 className="card-title">🔮 星座星象 · 摘要</h3>
      <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
        {f?.birthXZ ? (
          <span className="tag gold" style={{ fontSize: 13 }}>🎂 本命星座：{f.birthXZ.name}（{f.birthXZ.range} · {f.birthXZ.element}象）</span>
        ) : (
          <span className="tag gold" style={{ fontSize: 13 }}>公历星座：{hl.xingZuo ?? '—'}</span>
        )}
        {xz && <span className="tag dai" style={{ fontSize: 13 }}>{xz.range} · 守护星 {xz.ruler}</span>}
      </div>
      {f && <div className="small" style={{ lineHeight: 1.8 }}>⭐ 今日星座：{f.xingZuo} · {f.xingZuoAdvice}</div>}
      {xz && !f && <div className="small" style={{ lineHeight: 1.8 }}>「{xz.name}」{xz.plain}。</div>}
      <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
        <a className="btn sm primary" href="#/xingzuo">🔮 查看星座详解 ⟶</a>
      </div>
    </div>
  );
}

export function CalendarView() {
  const { settings } = useApp();
  const now = new Date();
  const birth = settings.birth ?? null;
  const todayStr = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [tab, setTab] = useState<TabKey>('today');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [selDate, setSelDate] = useState<string>(todayStr);

  // 今日 / 明日
  const todayHl = useMemo(() => huangliOf(now.getFullYear(), now.getMonth() + 1, now.getDate()), []);
  const tomorrow = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return huangliOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);
  const todayF = useMemo(() => fortuneFor(birth, now.getFullYear(), now.getMonth() + 1, now.getDate()), [birth]);
  const tomorrowF = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return fortuneFor(birth, d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, [birth]);

  // 本月
  const days = useMemo(() => huangliMonth(ym.y, ym.m), [ym]);
  const firstWeekday = useMemo(() => (new Date(ym.y, ym.m - 1, 1).getDay() + 6) % 7, [ym]);
  const shift = (delta: number) => {
    let { y, m } = ym;
    m += delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYm({ y, m });
  };

  // 本周（自然周：周一→周日）
  const weekRows = useMemo(() => {
    const mondayOff = (now.getDay() + 6) % 7;
    const rows: Array<{ hl: HuangliDay; f: DailyFortune | null }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOff + i);
      const hl = huangliOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
      rows.push({ hl, f: fortuneFor(birth, d.getFullYear(), d.getMonth() + 1, d.getDate()) });
    }
    return rows;
  }, [birth]);

  // 本月运势解析（当月全部日期）
  const monthRows = useMemo(() => {
    if (tab !== 'month') return [];
    return days.map(hl => {
      const [yy, mm, dd] = hl.date.split('-').map(Number);
      return { hl, f: fortuneFor(birth, yy, mm, dd) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birth, tab, ym]);

  // 本年（每月 1/8/15/22 号样本 → 月均分）
  const yearRows = useMemo(() => {
    if (tab !== 'year') return [];
    const rows: Array<{ m: number; label: string; scores: number[]; avg: number; best: string }> = [];
    const y = now.getFullYear();
    for (let m = 1; m <= 12; m++) {
      const daysIn = new Date(y, m, 0).getDate();
      const samples = [1, 8, 15, 22].filter(d => d <= daysIn);
      const scores: number[] = [];
      let bestScore = -1; let best = '';
      for (const d of samples) {
        const f = fortuneFor(birth, y, m, d);
        if (f) {
          const avg4 = Math.round((f.metrics.reduce((a, x) => a + x.score, 0)) / 4);
          scores.push(avg4);
          if (avg4 > bestScore) { bestScore = avg4; best = iso(y, m, d).slice(5); }
        }
      }
      const avg = samples.length ? Math.round(scores.reduce((a, b) => a + b, 0) / samples.length) : 0;
      rows.push({ m, label: ARAB_MONTH[m], scores, avg, best });
    }
    return rows;
  }, [birth, tab]);

  // 月度汇总
  const monthSummary = useMemo(() => {
    const withF = monthRows.map(r => r.f).filter((x): x is DailyFortune => !!x);
    if (!withF.length) return null;
    const avg = Math.round(withF.reduce((a, f) => a + Math.round(f.metrics.reduce((s, x) => s + x.score, 0) / 4), 0) / withF.length);
    let best = 0; let bestDate = '';
    for (const f of withF) {
      const s = Math.round(f.metrics.reduce((a, x) => a + x.score, 0) / 4);
      if (s > best) { best = s; bestDate = f.date.slice(5); }
    }
    const good = withF.filter(f => Math.round(f.metrics.reduce((s, x) => s + x.score, 0) / 4) >= 70).length;
    const warn = withF.filter(f => Math.round(f.metrics.reduce((s, x) => s + x.score, 0) / 4) < 45).length;
    return { avg, best, bestDate, good, warn, total: withF.length };
  }, [monthRows]);

  const hasBirth = !!birth;
  return (
    <div>
      <div className="page-head">
        <div className="page-title">万年历 · 黄历与个人运势</div>
        <div className="page-desc">今日 / 明日 / 本周 / 本月 / 本年 · 黄历 + 八字运势解析（离线推算 · 文化参考）</div>
      </div>

      {/* 周期页签 */}
      <div className="row wrap" style={{ gap: 6, marginBottom: 12, maxWidth: 880 }}>
        {TABS.map(t => (
          <button key={t.key} className={`btn sm ${tab === t.key ? 'primary' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
        {(tab === 'week' || tab === 'month' || tab === 'year') && !hasBirth && (
          <span className="muted small" style={{ alignSelf: 'center', marginLeft: 6 }}>未设生辰则仅展示黄历；设置后附个人八字运势解析</span>
        )}
      </div>

      {/* 今日 / 明日：单日详情 */}
      {(tab === 'today' || tab === 'tomorrow') && (
        <>
          <DayDetailCard hl={tab === 'today' ? todayHl : tomorrow} />
          {!hasBirth && (
            <div className="notice info" style={{ maxWidth: 880, marginBottom: 12 }}>尚未设置个人生辰——在「设置 → 预设个人生辰」填写后，这里会给出以你八字为底色的运势解析（幸运色/数字/健康/爱情/财富/事业）。</div>
          )}
          {tab === 'today' && todayF && <FortuneCard f={todayF} title="今日个人运势" />}
          {tab === 'tomorrow' && tomorrowF && <FortuneCard f={tomorrowF} title="明日个人运势" />}
          <XzCard f={tab === 'today' ? todayF : tomorrowF} hl={tab === 'today' ? todayHl : tomorrow} />
        </>
      )}

      {/* 本周 */}
      {tab === 'week' && (
        <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
          <h3 className="card-title">📅 本周黄历与运势（{weekRows[0]?.hl.date.slice(5)} ~ {weekRows[6]?.hl.date.slice(5)}）</h3>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            {weekRows.map(({ hl, f }, i) => {
              const s = f ? Math.round(f.metrics.reduce((a, x) => a + x.score, 0) / 4) : null;
              const isToday = hl.date === todayStr;
              return (
                <div key={hl.date} className="row wrap" style={{ gap: 6, padding: '9px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                  <span className="tag" style={{ background: isToday ? 'var(--gold-soft)' : 'var(--card)', border: '1px solid var(--line)', width: 118, flex: 'none', justifyContent: 'flex-start' }}>
                    <b>{hl.date.slice(5)}</b> {hl.week} {isToday && '·今天'}
                  </span>
                  <span className="tag dai" style={{ fontSize: 11 }}>{hl.ganzhi}日</span>
                  <span className="tag dai" style={{ fontSize: 11 }}>建除{hl.jianChu}</span>
                  <span className="tag dai" style={{ fontSize: 11 }}>宜 {hl.yi.slice(0, 2).join('、') || '—'}</span>
                  {s != null && (
                    <>
                      <span className="tag" style={{ background: FORTUNE_COLORS[fmtScore(s)], color: '#fff', fontSize: 11 }}>运势 {s} · {fmtScore(s)}</span>
                      {f && <span className="muted small" style={{ marginLeft: 'auto' }}>🎨{f.luckyColors[0] ?? ''} · 🔢{f.luckyNumbers[0] ?? ''}</span>}
                    </>
                  )}
                  {s == null && <span className="muted small">未设生辰</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 本月：月历网格 + 月运势解析 */}
      {tab === 'month' && (
        <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button className="btn sm ghost" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() + 1 })}>回到今天</button>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <button className="btn sm" onClick={() => shift(-1)}>‹ 上月</button>
              <b style={{ fontSize: 17, fontFamily: 'var(--font-classical)' }}>{ym.y} 年 {CN_MONTH[ym.m]}</b>
              <button className="btn sm" onClick={() => shift(1)}>下月 ›</button>
            </div>
          </div>
          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEEK_HEAD.map(w => <div key={w} className="small" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--ink-2)' }}>{w}</div>)}
            {Array.from({ length: firstWeekday }, (_, i) => <div key={`x${i}`} />)}
            {days.map(d => {
              const isToday = d.date === todayStr;
              const isSel = selDate === d.date;
              const moon = d.lunarMonth.replace('月', '').replace(/^初/, '');
              const hasBad = d.chong || d.jianChu === '破' || d.jianChu === '危' || d.jianChu === '执' || d.jianChu === '闭';
              return (
                <button key={d.date}
                  onClick={() => setSelDate(d.date)}
                  aria-label={`${d.date} ${d.lunarMonth}`}
                  style={{
                    minHeight: 58, borderRadius: 8, border: isSel ? '2px solid var(--gold)' : '1px solid var(--line)',
                    background: isToday ? 'var(--gold-soft)' : isSel ? '#fff8ea' : 'transparent',
                    padding: 4, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                  <span style={{ fontWeight: isToday ? 800 : 600, fontSize: 15 }}>{d.date.slice(8)}</span>
                  <span className="muted small" style={{ fontSize: 11 }}>{moon}</span>
                  {d.jieQi && <span className="tag gold" style={{ fontSize: 9.5, padding: '0 4px' }}>{d.jieQi}</span>}
                  {hasBad && !d.jieQi && <span className="small" style={{ fontSize: 10, color: 'var(--lv-d)' }}>{d.chong ? d.chong.slice(1, 3) : d.jianChu}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'month' && monthSummary && (
        <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
          <h3 className="card-title">📈 本月运势解析 · {ym.y}年{ARAB_MONTH[ym.m]}</h3>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            <span className="tag gold">总体参考 {monthSummary.avg} 分 · {fmtScore(monthSummary.avg)}</span>
            <span className="tag gold">最佳日期 {monthSummary.bestDate}（{monthSummary.best} 分）</span>
            <span className="tag dai">吉日 ~{monthSummary.good} 天</span>
            <span className="tag dai" style={{ color: 'var(--lv-d)' }}>待留意 ~{monthSummary.warn} 天</span>
          </div>
          <div className="small" style={{ lineHeight: 1.8 }}>
            {monthSummary.avg >= 70 && '本月整体偏顺：利主动推进重要事项，把关键决策安排在最佳日附近。'}
            {monthSummary.avg >= 45 && monthSummary.avg < 70 && '本月整体平稳：机会与阻力并存，宜按黄历宜忌择日而动，重要事项挑吉日、错开待留意日。'}
            {monthSummary.avg < 45 && '本月整体偏紧：以守为主，重要决策宜顺延到下月；每日按八字喜用调整节奏，注意健康。'}
            运势为文化参考，重大决策请以完整排盘与应期为准。
          </div>
        </div>
      )}

      {/* 本年 */}
      {tab === 'year' && (
        <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
          <h3 className="card-title">📅 本年逐月运势解析 · {now.getFullYear()} 年（每月以 1/8/15/22 日为样本）</h3>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            {yearRows.map(r => {
              const isCur = r.m === now.getMonth() + 1;
              return (
                <div key={r.m} className="row wrap" style={{ gap: 6, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                  <b style={{ width: 84 }}>{r.label}{isCur ? '（本月）' : ''}</b>
                  <span className="tag" style={{ background: FORTUNE_COLORS[fmtScore(r.avg)], color: '#fff', fontSize: 11, width: 96, justifyContent: 'center' }}>均 {r.avg} · {fmtScore(r.avg)}</span>
                  <span className="tag dai" style={{ fontSize: 11 }}>样本 {r.scores.join(' / ')}</span>
                  <span className="muted small" style={{ marginLeft: 'auto' }}>月中佳日 {r.best}</span>
                </div>
              );
            })}
          </div>
          <div className="muted small" style={{ marginTop: 8, lineHeight: 1.8 }}>
            提示：逐月均分为样本推算（每月 4 个代表日），仅作趋势参考；具体择日用「本月」页签逐日黄历与个人运势为准。
          </div>
        </div>
      )}
    </div>
  );
}