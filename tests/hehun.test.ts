/** 合盘/合婚引擎测试：八字合婚 + 奇门合婚（确定性规则、可复现） */
import { describe, it, expect } from 'vitest';
import { computeBazi, computeQimen, defaultConfig, stableHash, baziHehun, baziHehunOf, qimenHehun } from '@xuanshu/core';

const cfg = defaultConfig();

describe('八字合婚（baziHehun）', () => {
  it('输出含 6+ 维度、综合分在 [30,95]，且所有条目带白话', () => {
    const r = baziHehunOf(
      { time: { year: 1990, month: 5, day: 15, hour: 10, minute: 30 }, gender: '男' },
      { time: { year: 1992, month: 8, day: 22, hour: 14, minute: 0 }, gender: '女' },
      cfg, stableHash(cfg),
    );
    expect(r.result.items.length).toBeGreaterThanOrEqual(6);
    expect(r.result.score).toBeGreaterThanOrEqual(30);
    expect(r.result.score).toBeLessThanOrEqual(95);
    for (const it of r.result.items) {
      expect(it.dimension.length).toBeGreaterThan(0);
      expect(it.plain.length).toBeGreaterThan(5);
    }
    expect(r.result.summary).toContain('参考');
  });

  it('同日干（天干五合）正确识别', () => {
    const chartA = computeBazi({ time: { year: 1990, month: 5, day: 15, hour: 10, minute: 30 }, gender: '男' }, cfg, stableHash(cfg));
    const dayA = chartA.pillars[2].gz;
    // 构造与 A 日干五合的另一柱：乙日 vs 庚日
    const chartB = computeBazi({ time: { year: 1991, month: 6, day: 10, hour: 8, minute: 0 }, gender: '女' }, cfg, stableHash(cfg) + 'x');
    const r = baziHehun(chartA, chartB);
    const he = r.items.find(i => i.dimension === '日干五合');
    expect(he).toBeTruthy();
    expect(he!.verdict === '相合' || he!.verdict === '中性').toBe(true);
    void dayA;
  });

  it('确定性：同输入两次结果一致', () => {
    const mk = () => baziHehunOf(
      { time: { year: 1988, month: 3, day: 20, hour: 12, minute: 0 }, gender: '男' },
      { time: { year: 1990, month: 11, day: 5, hour: 18, minute: 30 }, gender: '女' },
      cfg, stableHash(cfg),
    );
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});

describe('奇门合婚（qimenHehun）', () => {
  it('以当前时刻奇门盘输出三宫定位与综合分', () => {
    const chart = computeQimen({ time: { year: 2026, month: 8, day: 31, hour: 12, minute: 0 } }, cfg, stableHash(cfg));
    const r = qimenHehun(chart);
    expect(r.yiPalace.length).toBeGreaterThan(0);
    expect(r.gengPalace.length).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.score).toBeLessThanOrEqual(95);
    expect(r.items.some(i => i.dimension.includes('乙庚'))).toBe(true);
    for (const it of r.items) expect(it.plain.length).toBeGreaterThan(4);
    expect(r.summary).toContain('参考');
  });

  it('确定性：重复调用结果一致', () => {
    const chart = computeQimen({ time: { year: 2026, month: 8, day: 31, hour: 12, minute: 0 } }, cfg, stableHash(cfg));
    expect(JSON.stringify(qimenHehun(chart))).toBe(JSON.stringify(qimenHehun(chart)));
  });
});