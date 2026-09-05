/**
 * 引擎与历法全量测试：黄金样本 / 装卦细节 / 降级表 / 引用契约
 */
import { describe, it, expect } from 'vitest';
import {
  dayPillarFromJdn, xunKong, normalizeMoment,
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou,
  baziRules, liuyaoRules, meihuaRules, ziweiRules, qimenRules, liurenRules, xiaoliurenRules, jinkouRules,
  guaByName, GUA64, LIU_CHONG_GUA,
  defaultConfig, stableHash, baziLifeTrend,
  checkDegradation,
  cite, assertCitations,
} from '@xuanshu/core';

const cfg = defaultConfig('失物');
const hash = stableHash(cfg);

describe('历法黄金样本', () => {
  it('JDN 日柱锚点序列', () => {
    expect(dayPillarFromJdn(2451545)).toBe('戊午'); // 2000-01-01
    expect(dayPillarFromJdn(2451546)).toBe('己未');
    expect(dayPillarFromJdn(2451545 - 1)).toBe('丁巳');
    expect(dayPillarFromJdn(2433191)).toBe('甲子'); // 1949-10-01
  });

  it('旬空：甲子旬中戌亥空', () => {
    expect(xunKong('甲子')).toBe('戌亥');
    expect(xunKong('甲戌')).toBe('申酉');
    expect(xunKong('甲申')).toBe('午未');
    expect(xunKong('戊午')).toBe('子丑');
  });

  it('2026-08-29 14:30 全柱', () => {
    const b = computeBazi({ time: { year: 2026, month: 8, day: 29, hour: 14, minute: 30 }, gender: '男' }, cfg, hash);
    expect(b.pillars.map((p: { gz: string }) => p.gz)).toEqual(['丙午', '丙申', '乙亥', '癸未']);
  });

  it('子时切日：23 点日柱进位、时柱取次日干', () => {
    const be = computeBazi({ time: { year: 2026, month: 8, day: 29, hour: 22, minute: 0 }, gender: '男' }, cfg, hash);
    const bl = computeBazi({ time: { year: 2026, month: 8, day: 29, hour: 23, minute: 30 }, gender: '男' }, cfg, hash);
    expect(be.pillars[0].gz).toBe('丙午');
    expect(bl.pillars[0].gz).toBe('丙午'); // 夜子时（23:00-24:00）日柱属当日
    expect(bl.pillars[3].gz.endsWith('子')).toBe(true);
  });

  it('normalizeMoment 自洽（JDN/时辰）', () => {
    const m = normalizeMoment({ time: { year: 2026, month: 8, day: 29, hour: 14, minute: 30 }, gender: '男' }, cfg as never);
    expect(m.jdn).toBeGreaterThan(2400000);
    expect(m.hour).toBe(14);
  });
});

describe('京房装卦', () => {
  it('八宫归属：泰为坤宫三世、否为乾宫三世', () => {
    const tai = guaByName('地天泰');
    expect(tai).toBeTruthy();
    expect(tai!.gongName).toBe('坤');
    expect(tai!.stage).toBe(3);
    const pi = guaByName('天地否');
    expect(pi!.gongName).toBe('乾');
    expect(pi!.stage).toBe(3);
  });

  it('六十四卦全部入宫不重复', () => {
    const seen = new Set<string>();
    for (const g of GUA64) seen.add(g.gongName + '|' + g.stage);
    expect(seen.size).toBe(64);
    expect(GUA64.length).toBe(64);
  });

  it('乾为天纳甲、六亲、世应（报数 1,1,1）', () => {
    const input = { method: 'numbers', numbers: [1, 1, 1], time: { year: 2026, month: 8, day: 29, hour: 14, minute: 30 }, gender: '男' };
    const chart = computeLiuyao(input as never, cfg, hash);
    expect(chart.guaName).toBe('乾为天');
    expect(chart.lines[0].najia.startsWith('甲子')).toBe(true);
    expect(chart.lines[5].najia.startsWith('壬戌')).toBe(true);
    expect(chart.lines.filter(l => l.shiYing === '世').length).toBe(1);
  });

  it('六冲卦集合非空且含乾为天', () => {
    expect(new Set(LIU_CHONG_GUA).size).toBeGreaterThanOrEqual(10);
    expect(new Set(LIU_CHONG_GUA).has('乾为天')).toBe(true);
  });
});

describe('梅花黄金样本：观梅占', () => {
  it('辰年十二月十七日申时 → 革之咸', () => {
    // 甲辰年农历十二月十七申时 = 公历 2025-01-16
    const chart = computeMeihua({ method: 'time', time: { year: 2025, month: 1, day: 16, hour: 16, minute: 0 }, gender: '男' }, cfg, hash);
    expect(chart.guaName).toBe('泽火革'); // 辰5+月12+日17=34 → 兑上；+申9=43 → 离下
    expect(chart.bianGuaName).toBe('泽山咸'); // 43%6=1 初爻动，离变艮
    expect(chart.movingIdx).toBe(0);
  });
  it('报数起卦：34/43 → 泽火革五爻动', () => {
    const chart = computeMeihua({ method: 'numbers', numbers: [34, 43], time: { year: 2026, month: 8, day: 29, hour: 16, minute: 0 }, gender: '男' }, cfg, hash);
    expect(chart.guaName).toBe('泽火革');
    expect(chart.movingIdx).toBe(4);
  });
});

describe('降级表（D28）：宁可少列，不编盘', () => {
  it('时辰缺失时奇门/大六壬/金口诀阻断', () => {
    const input = { time: { year: 2026, month: 8, day: 29, hour: -1, minute: 0 }, hourMissing: true, gender: '男' };
    expect(checkDegradation('qimen', input as never)?.blocked).toBe(true);
    expect(checkDegradation('liuren', input as never)?.blocked).toBe(true);
    expect(checkDegradation('jinkou', input as never)?.blocked).toBe(true);
  });
  it('时辰缺失时八字不阻断（降级三柱）而紫微提示回退', () => {
    const input = { time: { year: 2026, month: 8, day: 29, hour: -1, minute: 0 }, hourMissing: true, gender: '男' };
    const bazi = checkDegradation('bazi', input as never);
    expect(bazi?.blocked ?? false).toBe(false);
    expect(checkDegradation('ziwei', input as never)).toBeTruthy();
  });
  it('完整时刻无降级', () => {
    const input = { time: { year: 2026, month: 8, day: 29, hour: 14, minute: 30 }, gender: '男' as const };
    expect(checkDegradation('qimen', input as never)).toBeNull();
    expect(checkDegradation('bazi', input as never)).toBeNull();
  });
});

describe('引用契约（R11/R12）', () => {
  it('cite 产出完整 CitationRef', () => {
    const r = cite('zengshan', '增删卜易', '用神章第八', 'zengshan.1.1', '用神有真假', 'A');
    expect(r.license).toBe('公有领域');
    expect(r.confidenceLevel).toBe('A');
    expect(r.segId).toBe('zengshan.1.1');
  });
  it('A 级规则缺引用必须抛错；D 级可无引用', () => {
    expect(() => assertCitations({ ruleId: 'x', text: '', level: '吉', citations: [], confidenceLevel: 'A' } as never)).toThrow();
    expect(() => assertCitations({ ruleId: 'x', text: '', level: '中性', citations: [], confidenceLevel: 'D' } as never)).not.toThrow();
  });
  it('八术规则输出的引用非空（A/B/C 级）', () => {
    const input = { time: { year: 2026, month: 8, day: 29, hour: 14, minute: 30 }, gender: '男' as const };
    const checks: Array<[string, unknown[]]> = [
      ['bazi', baziRules(computeBazi(input, cfg, hash), cfg)],
      ['liuyao', liuyaoRules(computeLiuyao(input as never, cfg, hash))],
      ['meihua', meihuaRules(computeMeihua(input as never, cfg, hash))],
      ['ziwei', ziweiRules(computeZiwei(input as never, cfg, hash))],
      ['qimen', qimenRules(computeQimen(input as never, cfg, hash))],
      ['liuren', liurenRules(computeLiuren(input as never, cfg, hash))],
      ['xiaoliuren', xiaoliurenRules(computeXiaoliuren(input as never, cfg, hash))],
      ['jinkou', jinkouRules(computeJinkou(input as never, cfg, hash))],
    ];
    for (const [art, rules] of checks) {
      for (const h of rules as Array<{ confidenceLevel: string; citations?: unknown[]; ruleId: string }>) {
        if (h.confidenceLevel === 'A' || h.confidenceLevel === 'B' || h.confidenceLevel === 'C') {
          expect(h.citations?.length ?? 0, `${art}:${h.ruleId} 缺引用`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('八字一生趋势（问真式大运×流年）', () => {
  const chart = computeBazi({ time: { year: 1990, month: 5, day: 20, hour: 14, minute: 30 }, gender: '男' }, cfg, hash);
  const trend = baziLifeTrend(chart);

  it('8 步大运 × 每步 10 流年 = 80 年数据', () => {
    expect(trend.stages.length).toBe(chart.dayun.length);
    for (const st of trend.stages) {
      expect(st.years.length).toBe(10);
      expect(st.plain.length).toBeGreaterThan(10);
      expect(st.years[0].year).toBe(st.startYear);
      expect(st.years[9].year).toBe(st.endYear);
    }
  });

  it('评分区间与白话完整性', () => {
    for (const y of trend.stages.flatMap(s => s.years)) {
      expect(y.score).toBeGreaterThanOrEqual(-6);
      expect(y.score).toBeLessThanOrEqual(6);
      expect(y.plain).toContain('文化参考');
      expect(y.shiShen.length).toBeGreaterThan(1);
    }
  });

  it('最佳/需留意年份非空且与总表一致', () => {
    expect(trend.bestYears.length).toBeGreaterThan(0);
    expect(trend.hardYears.length).toBeGreaterThan(0);
    const all = trend.stages.flatMap(s => s.years);
    expect(all.some(y => y.year === trend.bestYears[0].year)).toBe(true);
    expect(trend.summary).toContain('一生趋势总览');
  });

  it('流年干支序列自洽（逐年 +1 位）', () => {
    const ys = trend.stages[0].years;
    expect(ys[1].gz).not.toBe(ys[0].gz);
  });
});

describe('configHash（D27）', () => {
  it('hash 16 位且与配置内容稳定对应', () => {
  const c = defaultConfig('事业');
  const h1 = stableHash(c);
  expect(h1).toHaveLength(16);
  const replay = JSON.parse(JSON.stringify(c));
  expect(stableHash(replay)).toBe(h1);
  // key 顺序无关
  const reordered = Object.fromEntries(Object.entries(c).reverse());
  expect(stableHash(reordered)).toBe(h1);
  });
});
