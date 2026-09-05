/** 紫微大限 × 流年时间轴（对标「一生趋势」的结构化视图）：纯确定性数据排布，不做任何吉凶打分。
 *  大限 = iztro decadal 区间 + 宫位主星；流年 = 虚岁→公历年（(y-4) 干支周期）→ 流年四化 + 流年命宫（该年地支落宫）。 */
import React, { useMemo, useState } from 'react';
import { yearGanzhiOf, SIHUA_QUANJI, type ZiweiChart, type ZiweiPalaceOut } from '@xuanshu/core';

interface LimitRow { start: number; end: number; palace: ZiweiPalaceOut }
interface YearRow { year: number; age: number; gz: string; sihua: [string, string, string, string] | null; mingGong?: ZiweiPalaceOut }

const starsOf = (p: ZiweiPalaceOut) => p.stars.filter(s => s.kind === 'major').map(s => s.name + (s.mutagen ? s.mutagen : '')).join('·') || '空宫';

export function ZiweiTimeline({ chart }: { chart: ZiweiChart }) {
  const [open, setOpen] = useState(true);
  const birthYear = useMemo(() => Number(chart.solarDate.split('-')[0]) || 1980, [chart.solarDate]);

  const limits: LimitRow[] = useMemo(() => chart.palaces
    .filter(p => p.decadalRange && /^\d+-\d+$/.test(p.decadalRange))
    .map(p => { const [a, b] = p.decadalRange!.split('-').map(Number); return { start: a, end: b, palace: p }; })
    .sort((x, y) => x.start - y.start), [chart.palaces]);

  const thisYear = new Date().getFullYear();
  const thisAge = thisYear - birthYear + 1; // 虚岁
  const [selStart, setSelStart] = useState<number | null>(null);
  const sel = useMemo(() => limits.find(l => l.start === selStart) ?? limits.find(l => thisAge >= l.start && thisAge <= l.end) ?? limits[0], [limits, selStart, thisAge]);

  const years: YearRow[] = useMemo(() => {
    if (!sel) return [];
    const rows: YearRow[] = [];
    for (let age = sel.start; age <= sel.end; age++) {
      const year = birthYear + age - 1;
      const gz = yearGanzhiOf(year);
      const q = SIHUA_QUANJI[gz[0]];
      rows.push({
        year, age, gz,
        sihua: q ? [q[0] + '禄', q[1] + '权', q[2] + '科', q[3] + '忌'] as unknown as [string, string, string, string] : null,
        mingGong: chart.palaces.find(p => p.earthlyBranch === gz[1]),
      });
    }
    return rows;
  }, [sel, birthYear, chart.palaces]);

  if (!limits.length) return null;

  return (
    <div className="card">
      <h3 className="card-title">大限 × 流年（紫微时间轴 · 数据排布，不作吉凶量化）
        <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setOpen(o => !o)}>{open ? '收起' : '展开'}</button>
      </h3>
      {!open && <div className="muted small">按虚岁排布十二大限与各限十个流年：流年四化按当年年干、流年命宫按该年地支落宫——点选查看。</div>}
      {open && (
        <>
          <div className="muted small" style={{ marginBottom: 8 }}>大限按虚岁区间排布（起限岁数随五行局）；点击切换大限，再看该限十个流年。</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {limits.map(l => {
              const active = sel?.start === l.start;
              const isNow = thisAge >= l.start && thisAge <= l.end;
              return (
                <button key={l.start} className={`btn sm ${active ? 'primary' : ''}`} style={isNow && !active ? { borderColor: 'var(--gold)' } : undefined}
                  onClick={() => setSelStart(l.start)}
                  aria-label={`大限 ${l.start}-${l.end} ${l.palace.name}`}>
                  {l.start}–{l.end}<br />
                  <b style={{ fontFamily: 'var(--font-classical)' }}>{l.palace.name}</b>
                  <span className="muted" style={{ fontSize: 11, display: 'block' }}>{starsOf(l.palace).slice(0, 10) || '空宫'}{isNow ? ' ·当前' : ''}</span>
                </button>
              );
            })}
          </div>
          {sel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {years.map(y => (
                <div key={y.year} className={`card ${y.year === thisYear ? '' : ''}`} style={{ padding: '8px 10px', margin: 0, borderColor: y.year === thisYear ? 'var(--gold)' : undefined }}>
                  <div className="small muted">{y.year} 年 · {y.age} 虚岁{y.year === thisYear ? '（当前）' : ''}</div>
                  <div style={{ fontFamily: 'var(--font-classical)', fontWeight: 700, fontSize: 16 }}>{y.gz}</div>
                  {y.sihua && <div className="small" style={{ color: 'var(--gold)' }}>{y.sihua.join(' ')}</div>}
                  <div className="small" style={{ marginTop: 2 }}>流年命宫：<b>{y.mingGong?.name ?? '—'}</b></div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{y.mingGong ? starsOf(y.mingGong) : ''}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
