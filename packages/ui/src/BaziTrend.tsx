/** 一生趋势视图（问真式）：SVG 能量曲线 + 分大运阶段 + 逐年白话。纯 DOM/SVG，无依赖。 */
import React, { useMemo, useState } from 'react';
import { baziLifeTrend, type BaziChart, type LifeTrend } from '@xuanshu/core';

const scoreColor = (s: number) => s >= 3 ? '#2e7d32' : s >= 1 ? '#66a36a' : s > -1 ? '#9a8f7d' : s > -3 ? '#c26b4e' : '#a63f36';

export function BaziTrend({ chart }: { chart: BaziChart }) {
  const trend: LifeTrend = useMemo(() => baziLifeTrend(chart), [chart]);
  const [sel, setSel] = useState<{ year: number; gz: string; plain: string; age: number; score: number; shiShen: string; events: string[] } | null>(null);
  const [open, setOpen] = useState(true);

  const all = trend.stages.flatMap(s => s.years);
  const W = 1180, H = 150, PAD = 26;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, all.length - 1);
  const y = (score: number) => H / 2 - (score / 6) * (H / 2 - 14);

  if (!open) {
    return (
      <div className="card">
        <h3 className="card-title">一生趋势（大运 × 流年 · 白话版）
          <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setOpen(true)}>展开</button>
        </h3>
        <div className="muted small">{trend.summary}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">一生趋势（大运 × 流年 · 白话版）
        <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>收起</button>
      </h3>
      <div className="muted small" style={{ marginBottom: 8 }}>{trend.summary}</div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H + 46} role="img" aria-label="一生运势趋势曲线" style={{ minWidth: W }}>
          {/* 大运分段背景 */}
          {trend.stages.map((st, si) => {
            const i0 = all.findIndex(y => y.year === st.startYear);
            return (
              <g key={si}>
                <rect x={x(i0) - 2} y={6} width={x(Math.min(i0 + 9, all.length - 1)) - x(i0) + 6} height={H - 4}
                  fill={si % 2 ? 'rgba(154,123,45,.07)' : 'transparent'} rx={8} />
                <text x={(x(i0) + x(Math.min(i0 + 9, all.length - 1))) / 2} y={H + 26} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                  {st.ganzhi}运 {st.startYear % 100}–{String(st.endYear % 100).padStart(2, '0')}
                </text>
              </g>
            );
          })}
          {/* 零轴 */}
          <line x1={PAD - 8} y1={H / 2} x2={W - PAD + 8} y2={H / 2} stroke="var(--line)" strokeWidth={1} />
          {/* 曲线 */}
          <polyline fill="none" stroke="var(--dai)" strokeWidth={1.6}
            points={all.map((yr, i) => `${x(i)},${y(yr.score)}`).join(' ')} />
          {/* 年份刻度点 */}
          {all.map((yr, i) => (
            <g key={yr.year} onClick={() => setSel({ ...yr })} style={{ cursor: 'pointer' }}>
              <circle cx={x(i)} cy={y(yr.score)} r={yr.year % 10 === 0 || all.length <= 20 ? 5 : 3} fill={scoreColor(yr.score)}>
                <title>{`${yr.year} ${yr.gz}｜${yr.score > 0 ? '+' : ''}${yr.score}｜点击看白话`}</title>
              </circle>
              {(yr.year % 10 === 0 || i === 0) && (
                <text x={x(i)} y={H + 40} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">{yr.year}</text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {sel && (
        <div className="notice info" style={{ marginTop: 8 }}>
          <b>{sel.year} 年 · {sel.gz} · {sel.age} 岁 · 流年{sel.shiShen}</b>
          <div className="small" style={{ marginTop: 4 }}>喜忌评分 {sel.score > 0 ? '+' : ''}{sel.score}（{sel.events.length ? sel.events.join('；') : '与命局无直接刑冲合'}）</div>
          <div className="small" style={{ marginTop: 4 }}>{sel.plain}</div>
        </div>
      )}

      <div className="grid2" style={{ marginTop: 10 }}>
        <div>
          <div className="small" style={{ fontWeight: 700, margin: '6px 0' }}>▲ 偏旺年份</div>
          {trend.bestYears.map(b => (
            <div key={b.year} className="small" style={{ marginBottom: 4 }}>
              <span className="tag ji">{b.year} {b.gz}</span> {b.plain}
            </div>
          ))}
        </div>
        <div>
          <div className="small" style={{ fontWeight: 700, margin: '6px 0' }}>▼ 需留意年份</div>
          {trend.hardYears.map(b => (
            <div key={b.year} className="small" style={{ marginBottom: 4 }}>
              <span className="tag xiong">{b.year} {b.gz}</span> {b.plain}
            </div>
          ))}
        </div>
      </div>

      <details style={{ marginTop: 8 }}>
        <summary className="small" style={{ cursor: 'pointer', color: 'var(--dai)' }}>分步大运白话总评（8 步）</summary>
        {trend.stages.map(st => (
          <div key={st.index} className="small" style={{ marginTop: 6 }}>
            <b>第{st.index + 1}运 {st.ganzhi}（{st.startAge}–{st.endAge} 岁 · {st.startYear}–{st.endYear}）· 运干{st.shiShen}</b>
            <div className="muted">{st.plain}</div>
          </div>
        ))}
      </details>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
        评分模型透明可查：喜用五行每字 +2、忌仇每字 −2，冲/刑 −1，合 +1，三合成局 +2，干合 +1，区间 [−6, +6]；与排盘同样确定性可复现。
      </div>
    </div>
  );
}
