/** 个人今日运势引擎测试：生辰×当日 → 幸运色/数字/四维指数/注意事项（确定性） */
import { describe, it, expect } from 'vitest';
import { computeBazi, defaultConfig, stableHash, fortuneOf } from '@xuanshu/core';

const cfg = defaultConfig();

describe('个人今日运势（fortuneOf）', () => {
  const birth = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: '男' as '男' | '女' };

  it('输出完整字段：幸运色/数字/四维/注意事项', () => {
    const f = fortuneOf(birth, 2026, 9, 1, cfg, stableHash(cfg));
    expect(f.luckyColors.length).toBeGreaterThanOrEqual(2);
    expect(f.luckyNumbers.length).toBeGreaterThanOrEqual(2);
    expect(f.metrics.length).toBe(4);
    expect(f.metrics.map(m => m.label)).toEqual(['爱情', '财富', '事业', '健康']);
    for (const m of f.metrics) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
      expect(m.text.length).toBeGreaterThan(5);
    }
    expect(f.cautions.length).toBeGreaterThan(0);
    expect(f.tips.length).toBeGreaterThanOrEqual(3);
    expect(f.summary).toContain('参考');
    expect(f.xingZuoAdvice.length).toBeGreaterThan(3);
  });

  it('确定性：同输入两次结果一致', () => {
    const a = fortuneOf(birth, 2026, 9, 1, cfg, stableHash(cfg));
    const b = fortuneOf(birth, 2026, 9, 1, cfg, stableHash(cfg));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('缺时辰生辰也能正常计算（降级三柱）', () => {
    const f = fortuneOf({ year: 1992, month: 8, day: 22 }, 2026, 9, 1, cfg, stableHash(cfg));
    expect(f.dayGan.length).toBe(1);
    expect(f.healthScore).toBeGreaterThan(0);
  });

  it('不同日期运势不同（日柱变化）', () => {
    const a = fortuneOf(birth, 2026, 9, 1, cfg, stableHash(cfg));
    const b = fortuneOf(birth, 2026, 9, 2, cfg, stableHash(cfg));
    expect(a.dayPillar).toBe('戊寅');
    expect(b.dayPillar).not.toBe(a.dayPillar);
  });
});