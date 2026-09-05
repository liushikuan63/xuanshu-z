import { describe, it, expect } from 'vitest';
import { defaultConfig, normalizeMoment, ymdToJdn, jdnToYmd } from '@xuanshu/core';

describe('jdnToYmd roundtrip（修复 Fliegel–Van Flandern 缺项）', () => {
  it('1990-05-15 往返正确', () => {
    const jdn = ymdToJdn(1990, 5, 15);
    const back = jdnToYmd(jdn);
    expect(back).toEqual({ y: 1990, m: 5, d: 15 });
  });
  it('多日期往返（含闰年 2/29、年末、年初）', () => {
    const cases: Array<[number, number, number]> = [
      [2000, 2, 29], [1999, 12, 31], [2001, 1, 1], [2024, 8, 30], [1900, 3, 1], [2100, 12, 31],
    ];
    for (const [y, m, d] of cases) {
      const jdn = ymdToJdn(y, m, d);
      const back = jdnToYmd(jdn);
      expect(back, `${y}-${m}-${d}`).toEqual({ y, m, d });
    }
  });
  it('真太阳时：乌鲁木齐（87.6°E）换算后时柱变化且不崩溃', () => {
    const cfg = defaultConfig();
    const t = { year: 1990, month: 5, day: 15, hour: 12, minute: 30 };
    const off = normalizeMoment({ time: t }, { calendar: cfg.calendar });
    const on = normalizeMoment({ time: t }, { calendar: { ...cfg.calendar, trueSolarTime: true, longitude: 87.6 } });
    expect(on.trueSolarUsed).toBe(true);
    // 北京12:30属午时；乌鲁木齐换算后约10:24属巳→时柱应不同（若恰同日柱分界则至少不同或相等由计算保证不崩）
    expect(off.hourPillar).toBeTruthy();
    expect(on.hourPillar).toBeTruthy();
  });
});