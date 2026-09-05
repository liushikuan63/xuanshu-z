/** 合盘/合婚（HehunView）：双人生辰 → 八字合婚报告 + 奇门婚缘盘分析。
 * 确定性规则引擎（@xuanshu/core hehun），白话输出；文化参考定位，不做吉凶断言。
 */
import React, { useState } from 'react';
import { defaultConfig, stableHash, computeBazi, computeQimen, baziHehun, qimenHehun, type BaziHehunResult, type QimenHehunResult } from '@xuanshu/core';
import { DateTimePick, type DateTimeValue } from './DateTimePick';

const cfg = defaultConfig();

const DEFAULT_A: DateTimeValue = { year: 1990, month: 5, day: 15, hour: 10, minute: 30 };
const DEFAULT_B: DateTimeValue = { year: 1992, month: 8, day: 22, hour: 14, minute: 0 };

interface HehunState {
  bazi: BaziHehunResult | null;
  qimen: QimenHehunResult | null;
  err: string | null;
}

export function HehunView() {
  const [tA, setTA] = useState<DateTimeValue>(DEFAULT_A);
  const [tB, setTB] = useState<DateTimeValue>(DEFAULT_B);
  const [gA, setGA] = useState<'男' | '女'>('男');
  const [gB, setGB] = useState<'男' | '女'>('女');
  const [state, setState] = useState<HehunState>({ bazi: null, qimen: null, err: null });

  const run = () => {
    try {
      const chA = computeBazi({ time: tA, gender: gA }, cfg, stableHash(cfg) + ':A');
      const chB = computeBazi({ time: tB, gender: gB }, cfg, stableHash(cfg) + ':B');
      const bazi = baziHehun(chA, chB);
      // 奇门婚缘盘以当前时刻起时家局（传统以问事时刻为盘）
      const now = new Date();
      const qimenChart = computeQimen(
        { time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } },
        cfg, stableHash(cfg) + ':Q',
      );
      const qimen = qimenHehun(qimenChart);
      setState({ bazi, qimen, err: null });
    } catch (e) {
      setState({ bazi: null, qimen: null, err: String((e as Error)?.message ?? e) });
    }
  };

  const scoreColor = (s: number) => (s >= 78 ? 'var(--lv-a, #3a8f5f)' : s >= 55 ? 'var(--lv-b, #b8860b)' : 'var(--lv-d, #a63f36)');

  return (
    <div>
      <div className="page-head">
        <div className="page-title">合盘 · 合婚参考</div>
        <div className="page-desc">双人生辰并排 → 八字合婚七维比对 + 奇门婚缘盘（乙·庚·六合）· 文化参考，非定论</div>
      </div>

      <div className="card" style={{ maxWidth: 860, marginBottom: 12 }}>
        <div className="row wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
          <div>
            <label className="field">
              <span>{gA === '男' ? '♂ 男方' : '♀ 方甲'}生辰</span>
              <DateTimePick value={tA} onChange={setTA} />
            </label>
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              {(['男', '女'] as const).map(g => (
                <button key={g} className={`tag clickable ${gA === g ? 'primary' : ''}`} style={{ fontSize: 12 }} onClick={() => setGA(g)}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="field">
              <span>{gB === '女' ? '♀ 女方' : '♂ 方乙'}生辰</span>
              <DateTimePick value={tB} onChange={setTB} />
            </label>
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              {(['男', '女'] as const).map(g => (
                <button key={g} className={`tag clickable ${gB === g ? 'primary' : ''}`} style={{ fontSize: 12 }} onClick={() => setGB(g)}>{g}</button>
              ))}
            </div>
          </div>
          <button className="btn primary" onClick={run}>🪷 合盘 · 起婚缘分析</button>
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>奇门婚缘盘以「当前时刻」起时家局；八字合婚以双方出生时刻排四柱。结果均确定性可复现。</div>
      </div>

      {state.err && <div className="notice warn">排盘失败：{state.err}</div>}

      {state.bazi && (
        <div className="card" style={{ maxWidth: 860, marginBottom: 12 }}>
          <h3 className="card-title">八字合婚 · 七维比对
            <span className="tag" style={{ marginLeft: 'auto', background: 'var(--gold-soft)', fontSize: 15 }}>
              综合参考 <b style={{ color: scoreColor(state.bazi.score), fontSize: 19 }}>{state.bazi.score}</b> 分
            </span>
          </h3>
          <div className="muted small" style={{ marginBottom: 8 }}>男：{state.bazi.pair.a} ｜ 女：{state.bazi.pair.b}</div>
          {state.bazi.items.map((it, i) => (
            <div key={i} className="row" style={{ gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--line)', alignItems: 'flex-start' }}>
              <span className={`tag ${it.verdict === '相合' ? 'green' : it.verdict === '注意' ? 'red' : 'dai'}`} style={{ fontSize: 11, flex: '0 0 64px', textAlign: 'center' }}>{it.verdict}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.dimension}</div>
                <div className="muted small">{it.detail}</div>
                <div className="small" style={{ marginTop: 2 }}>{it.plain}</div>
              </div>
            </div>
          ))}
          <div className="notice info small" style={{ marginTop: 10 }}>{state.bazi.summary}</div>
        </div>
      )}

      {state.qimen && (
        <div className="card" style={{ maxWidth: 860, marginBottom: 12 }}>
          <h3 className="card-title">奇门婚缘盘 · {state.qimen.chartDesc}
            <span className="tag" style={{ marginLeft: 'auto', background: 'var(--gold-soft)', fontSize: 15 }}>
              综合参考 <b style={{ color: scoreColor(state.qimen.score), fontSize: 19 }}>{state.qimen.score}</b> 分
            </span>
          </h3>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            <span className="tag dai">乙（女方）{state.qimen.yiPalace}</span>
            <span className="tag dai">庚（男方）{state.qimen.gengPalace}</span>
            <span className="tag dai">六合 {state.qimen.liuhePalace}</span>
          </div>
          {state.qimen.items.map((it, i) => (
            <div key={i} className="row" style={{ gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--line)', alignItems: 'flex-start' }}>
              <span className={`tag ${it.verdict === '相合' ? 'green' : it.verdict === '注意' ? 'red' : 'dai'}`} style={{ fontSize: 11, flex: '0 0 64px', textAlign: 'center' }}>{it.verdict}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.dimension}</div>
                <div className="muted small">{it.detail}</div>
                <div className="small" style={{ marginTop: 2 }}>{it.plain}</div>
              </div>
            </div>
          ))}
          <div className="notice info small" style={{ marginTop: 10 }}>{state.qimen.summary}</div>
        </div>
      )}

      {!state.bazi && !state.err && (
        <div className="notice info" style={{ maxWidth: 860 }}>选择双方生辰后点击「合盘 · 起婚缘分析」。本功能为文化参考工具：输出确定性比对与白话说明，不作「宜/忌婚」断言，也不替代现实中的沟通与相处。</div>
      )}
    </div>
  );
}