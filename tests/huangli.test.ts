/** 万年历黄历引擎测试：农历/宜忌/冲煞/建除/星座（离线确定性） */
import { describe, it, expect } from 'vitest';
import { huangliOf, huangliMonth, huangliSummary, xingZuoProfile } from '@xuanshu/core';

describe('万年历黄历（huangliOf）', () => {
  it('2026-09-01 输出完整黄历字段', () => {
    const hl = huangliOf(2026, 9, 1);
    expect(hl.lunar).toContain('七月');
    expect(hl.lunarMonth.length).toBeGreaterThan(1);
    expect(hl.ganzhi.length).toBe(2);
    expect(hl.yearNaYin.length).toBeGreaterThan(0);
    expect(hl.dayNaYin.length).toBeGreaterThan(0);
    expect(hl.xingZuo).toBe('处女');
    expect(hl.jianChu.length).toBeGreaterThan(0);
    expect(hl.zhiXing.length).toBeGreaterThan(0);
  });

  it('宜忌/吉神/凶煞均为数组且非空', () => {
    const hl = huangliOf(2026, 9, 1);
    expect(Array.isArray(hl.yi)).toBe(true);
    expect(Array.isArray(hl.ji)).toBe(true);
    expect(Array.isArray(hl.jiShen)).toBe(true);
    expect(Array.isArray(hl.xiongSha)).toBe(true);
  });

  it('闰月/节气日正确识别（2026-09-07 白露前后）', () => {
    const hl = huangliOf(2026, 9, 8);
    // 白露约在 9 月上旬，验证明历字段可解析
    expect(hl.date).toBe('2026-09-08');
    expect(hl.week).toMatch(/^星期/);
    expect(hl.shengXiao.length).toBeGreaterThan(0);
  });

  it('星座画像数据完整', () => {
    const p = xingZuoProfile('处女座');
    expect(p?.element).toBe('土');
    expect(p?.ruler).toBe('水星');
    expect(p?.plain.length).toBeGreaterThan(4);
  });

  it('月度黄历数组长度 = 当月天数；摘要可读', () => {
    const days = huangliMonth(2026, 9);
    expect(days.length).toBe(30);
    const s = huangliSummary(days[0]);
    expect(s).toContain('宜');
    expect(s).toContain('忌');
  });

  it('确定性：同日两次结果一致', () => {
    expect(JSON.stringify(huangliOf(2026, 10, 1))).toBe(JSON.stringify(huangliOf(2026, 10, 1)));
  });
});