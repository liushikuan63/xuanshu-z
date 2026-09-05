/** 星座星象独立页（XingZuoView）：与万年历黄历拆分开，避免两套体系互相干扰。
 * 有预设生辰时优先展示「本命星座」完整画像（由生辰推算），并提供 12 星座总览点选查看。
 */
import React, { useMemo, useState } from 'react';
import { huangliOf, xingZuoProfile, fortuneOf, defaultConfig, stableHash, type XingZuoProfile, type HuangliDay } from '@xuanshu/core';
import { useApp } from './state';

const ALL_XZ = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];

const ELEMENT_EMOJI: Record<string, string> = { 火: '🔥', 土: '⛰️', 风: '🌬️', 水: '💧' };

/** 单个星座完整画像卡（性格/爱情/幸运/健康/配对/事业），多处共用 */
export function XzProfileCard({ xz }: { xz: XingZuoProfile }) {
  return (
    <>
      <div className="grid2" style={{ gap: 8, marginBottom: 8 }}>
        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)' }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>性格特质</div>
          <div className="small" style={{ lineHeight: 1.8 }}>
            <span className="row wrap" style={{ gap: 4, marginBottom: 4 }}>
              {xz.traits.map(t => <span key={t} className="tag dai" style={{ fontSize: 11 }}>{t}</span>)}
            </span>
            <span className="muted">{xz.plain}。</span>
          </div>
          <div className="small" style={{ marginTop: 6, lineHeight: 1.7 }}>
            <span style={{ color: 'var(--green)' }}><b>优：</b>{xz.strengths.join('、')} </span>
            <span style={{ color: 'var(--lv-d)' }}><b>待修：</b>{xz.weaknesses.join('、')}</span>
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)' }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>爱情 · 幸运 · 健康</div>
          <div className="small" style={{ lineHeight: 1.8 }}>❤️ {xz.love}</div>
          <div className="row wrap" style={{ gap: 6, margin: '6px 0' }}>
            <span className="tag gold" style={{ fontSize: 11 }}>🎨 幸运色 {xz.luckyColors.join('、')}</span>
            <span className="tag gold" style={{ fontSize: 11 }}>🔢 幸运数字 {xz.luckyNumbers.join('、')}</span>
            <span className="tag gold" style={{ fontSize: 11 }}>🍀 幸运物 {xz.luckyItem}</span>
          </div>
          <div className="small" style={{ lineHeight: 1.7 }}>💪 {xz.healthNote}</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}>
        <span className="tag dai" style={{ fontSize: 12 }}>💞 最佳配对：{xz.matchBest.join('、')}</span>
        <span className="tag dai" style={{ fontSize: 12 }}>🤝 需磨合：{xz.matchWatch.join('、')}</span>
        <span className="tag dai" style={{ fontSize: 12 }}>🏆 事业特质：{xz.careerNote}</span>
      </div>
    </>
  );
}

export function XingZuoView() {
  const { settings } = useApp();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 本命星座：有生辰时直接由生辰公历日期推算；无生辰时回退为当日星座
  const birthXz = useMemo<XingZuoProfile | undefined>(() => {
    if (!settings.birth) return undefined;
    try {
      const f = fortuneOf({ ...settings.birth }, now.getFullYear(), now.getMonth() + 1, now.getDate(), defaultConfig(), stableHash(defaultConfig()));
      return f.birthXZ;
    } catch { return undefined; }
  }, [settings.birth]);

  const dayXz = useMemo(() => huangliOf(now.getFullYear(), now.getMonth() + 1, now.getDate()), []);
  const dayXzProfile = xingZuoProfile(dayXz.xingZuo);

  // 默认选中：本命星座 > 当日星座 > 第一格
  const [active, setActive] = useState('');
  const activeXz = active
    ? xingZuoProfile(active)
    : (birthXz ?? dayXzProfile ?? xingZuoProfile(ALL_XZ[0]));

  // —— 星座周期运势：以 activeXz（默认本命星座）为基准，按黄道同位/对宫关系判定每日顺/平/注意 ——
  const [xzTab, setXzTab] = useState<'today' | 'tomorrow' | 'week' | 'month' | 'year'>('today');
  const relWith = (dayName: string): '顺' | '平' | '注意' => {
    if (!activeXz) return '平';
    const dp = xingZuoProfile(dayName);
    if (!dp) return '平';
    if (dp.element === activeXz.element) return '顺';
    const bi = ALL_XZ.indexOf(activeXz.name);
    const di = ALL_XZ.indexOf(dp.name);
    if (bi >= 0 && di >= 0 && Math.abs(bi - di) === 6) return '注意';
    return '平';
  };
  const relTag: Record<string, { t: string; c: string }> = {
    顺: { t: '顺', c: 'var(--lv-a, #3a8f5f)' },
    平: { t: '平', c: 'var(--lv-b, #b8860b)' },
    注意: { t: '注意', c: 'var(--lv-d, #a63f36)' },
  };
  const xzRows = useMemo(() => {
    const off = (now.getDay() + 6) % 7; // 本周一偏移
    const rows: Array<{ hl: HuangliDay; rel: '顺' | '平' | '注意' }> = [];
    // today/tomorrow：单个代表日（今日+0 / 明日+1）
    if (xzTab === 'today' || xzTab === 'tomorrow') {
      const off2 = xzTab === 'today' ? 0 : 1;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off2);
      const hl = huangliOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
      rows.push({ hl, rel: relWith(hl.xingZuo) });
    } else if (xzTab === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off + i);
        const hl = huangliOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
        rows.push({ hl, rel: relWith(hl.xingZuo) });
      }
    } else if (xzTab === 'month') {
      const y = now.getFullYear(); const m = now.getMonth() + 1;
      const daysIn = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysIn; d++) {
        const hl = huangliOf(y, m, d);
        rows.push({ hl, rel: relWith(hl.xingZuo) });
      }
    } else {
      // year：每月 1/8/15/22 样本
      const y = now.getFullYear();
      for (let m = 1; m <= 12; m++) {
        const daysIn = new Date(y, m, 0).getDate();
        for (const d of [1, 8, 15, 22]) {
          if (d > daysIn) continue;
          const hl = huangliOf(y, m, d);
          rows.push({ hl, rel: relWith(hl.xingZuo) });
        }
      }
    }
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xzTab, activeXz?.name]);
  const xzSummary = useMemo(() => {
    if (!xzRows.length) return null;
    const good = xzRows.filter(r => r.rel === '顺').length;
    const warn = xzRows.filter(r => r.rel === '注意').length;
    const score = Math.round((good * 12 - warn * 10 + xzRows.length * 60) / xzRows.length);
    const clamp = Math.max(15, Math.min(98, score));
    const lvl = clamp >= 70 ? '吉' : clamp >= 45 ? '平' : '注意';
    return { good, warn, score: clamp, lvl, total: xzRows.length };
  }, [xzRows]);
  const xzTabLabel = () => (xzTab === 'today' ? '今日' : xzTab === 'tomorrow' ? '今日/明日' : xzTab === 'week' ? '本周' : xzTab === 'month' ? '本月' : '本年');

  return (
    <div>
      <div className="page-head">
        <div className="page-title">星座星象 · 详解</div>
        <div className="page-desc">本命星座（生辰推算）与 12 星座总览（文化参考 · 与干支黄历分属不同体系）</div>
      </div>

      {birthXz && (
        <div className="card" style={{ maxWidth: 880, marginBottom: 12, borderColor: 'var(--gold)', background: 'var(--gold-soft)' }}>
          <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h3 className="card-title" style={{ margin: 0, color: 'var(--gold)' }}>🎂 你的本命星座 · {birthXz.name}</h3>
            <span className="tag dai" style={{ marginLeft: 'auto' }}>{birthXz.range} · {ELEMENT_EMOJI[birthXz.element] ?? ''}{birthXz.element}象</span>
          </div>
          <div className="muted small" style={{ marginBottom: 8 }}>由「设置 → 预设个人生辰」的公历生日推算，与八字排盘同源。</div>
          <XzProfileCard xz={birthXz} />
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
            <span className="tag gold" style={{ fontSize: 12 }}>🎨 星座幸运色 {birthXz.luckyColors.join('、')}</span>
            <span className="tag gold" style={{ fontSize: 12 }}>🔢 星座数字 {birthXz.luckyNumbers.join('、')}</span>
            <span className="tag gold" style={{ fontSize: 12 }}>🍀 幸运物 {birthXz.luckyItem}</span>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
        <h3 className="card-title">🌙 当日星座参考 · {dayXz.xingZuo}</h3>
        {dayXzProfile && (
          <>
            <div className="muted small" style={{ marginBottom: 6 }}>「{dayXzProfile.name}」{dayXz.date}（{dayXz.week}）黄历星座 · {dayXzProfile.range}</div>
            <div className="small" style={{ lineHeight: 1.8 }}>{dayXzProfile.plain}。可看看下方对应星座的完整画像。</div>
          </>
        )}
        {!dayXzProfile && <div className="muted small">未取到当日星座画像。</div>}
      </div>

      {/* 星座周期运势（以 activeXz 为基准：同位=顺、对宫=注意） */}
      <div className="card" style={{ maxWidth: 880, marginBottom: 12 }}>
        <div className="row wrap" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <h3 className="card-title" style={{ margin: 0 }}>🔭 星座周期运势</h3>
          <span className="tag gold" style={{ fontSize: 12 }}>基准：{activeXz?.name ?? '—'}</span>
          {birthXz && <span className="muted small">（默认本命星座，可点下方 12 星座切换）</span>}
        </div>
        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
          {(['today', 'tomorrow', 'week', 'month', 'year'] as const).map(k => (
            <button key={k} className={`btn sm ${xzTab === k ? 'primary' : ''}`} onClick={() => setXzTab(k)}>
              {k === 'today' ? '今日' : k === 'tomorrow' ? '明日' : k === 'week' ? '本周' : k === 'month' ? '本月' : '本年'}
            </button>
          ))}
          {xzSummary && (
            <span className="muted small" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
              {xzTabLabel()}整体 {xzSummary.score} 分 · {xzSummary.lvl} · 顺 {xzSummary.good} 天 / 注意 {xzSummary.warn} 天
            </span>
          )}
        </div>
        {activeXz && (
          <div className="small" style={{ lineHeight: 1.8, marginBottom: 8 }}>
            {xzSummary && (
              <>
                {xzSummary.lvl === '吉' && `${xzTabLabel()}以「${activeXz.name}」为基准整体偏顺：同位元素日多，适合推进要事、表白与合作。`}
                {xzSummary.lvl === '平' && `${xzTabLabel()}以「${activeXz.name}」为基准整体平稳：顺日推进、注意日守成，张弛有度即可。`}
                {xzSummary.lvl === '注意' && `${xzTabLabel()}以「${activeXz.name}」为基准偏紧：对宫日较多，宜多修内功、少做冲动决定。`}
              </>
            )}
            规则：与「{activeXz.name}」同元素日为「顺」，对宫（相差 6 宫）为「注意」，其余为「平」；天然与你相合（同位）、需磨合（对宫）的日期一目了然。
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {xzRows.map(({ hl, rel }) => {
            const isToday = hl.date === todayStr;
            return (
              <div key={hl.date} className="row wrap" style={{ gap: 6, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                <span className="tag" style={{ background: isToday ? 'var(--gold-soft)' : 'var(--card)', border: '1px solid var(--line)', width: 112, flex: 'none', justifyContent: 'flex-start' }}>
                  <b>{hl.date.slice(5)}</b> {hl.week}{isToday && '·今天'}
                </span>
                <span className="tag dai" style={{ fontSize: 11 }}>黄历星座 {hl.xingZuo}</span>
                <span className="tag" style={{ background: relTag[rel].c, color: '#fff', fontSize: 11, width: 52, justifyContent: 'center' }}>{relTag[rel].t}</span>
                {rel === '顺' && <span className="muted small" style={{ marginLeft: 'auto', color: 'var(--lv-a)' }}>同位元素：宜推进 · 遂意</span>}
                {rel === '注意' && <span className="muted small" style={{ marginLeft: 'auto', color: 'var(--lv-d)' }}>对宫相冲：宜守成 · 缓动</span>}
                {rel === '平' && <span className="muted small" style={{ marginLeft: 'auto' }}>平平常常：照常行事</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 880 }}>
        <h3 className="card-title">✨ 12 星座总览</h3>
        <div className="small muted" style={{ marginBottom: 8 }}>年/月/日任选其一即可定位：点击任一星座查看完整画像。</div>
        <div className="grid4" style={{ gap: 8, marginBottom: 10 }}>
          {ALL_XZ.map(name => {
            const p = xingZuoProfile(name);
            if (!p) return null;
            const isActive = activeXz?.name === p.name;
            return (
              <button key={name} onClick={() => setActive(p.name)}
                style={{
                  padding: '8px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: isActive ? '2px solid var(--gold)' : '1px solid var(--line)',
                  background: isActive ? 'var(--gold-soft)' : 'var(--card)',
                  color: 'var(--ink)',
                }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ELEMENT_EMOJI[p.element]} {p.name}</div>
                <div className="muted small">{p.range}</div>
                <div className="muted small">{p.element}象 · {p.ruler}守护</div>
              </button>
            );
          })}
        </div>
        {activeXz && (
          <>
            <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-classical)' }}>{activeXz.name} · 完整画像</h4>
              {birthXz?.name === activeXz.name && <span className="tag gold">⭐ 你的本命星座</span>}
            </div>
            <XzProfileCard xz={activeXz} />
          </>
        )}
      </div>

      <div className="muted small" style={{ maxWidth: 880, margin: '12px auto 0', textAlign: 'center', lineHeight: 1.8 }}>
        星座特质为文化叙事，与干支黄历分属两种体系——可互为启发，不作行为指导。重大事项请以完整起卦与应期窗口为准。
      </div>
    </div>
  );
}