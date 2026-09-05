import { describe, it, expect } from 'vitest';
import { computeBazi, computeLiuyao, computeMeihua, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou, defaultConfig, stableHash, jingPiFor, flowYearMonths, liuYueGanZhi, flowHoursOfDay, normalizeMoment, baziStreamPillars } from '@xuanshu/core';

const TSH = { year: 1990, month: 5, day: 15, hour: 10, minute: 30 };
const cfg = defaultConfig();

describe('jingpi 精批白话层', () => {
  it('八字精批包含八段结构（含六亲/财富）与开运 tips', () => {
    const chart = computeBazi({ time: TSH, gender: '男' }, cfg, stableHash(cfg));
    const r = jingPiFor('bazi', chart as never);
    expect(r.headline.length).toBeGreaterThan(10);
    expect(r.segs.length).toBeGreaterThanOrEqual(7);
    expect(r.tips.length).toBeGreaterThanOrEqual(3);
    expect(r.segs[0].title).toContain('日主');
    const allTitle = r.segs.map(s => s.title).join('|');
    expect(allTitle).toContain('六亲');
    expect(allTitle).toContain('财富');
    // 六亲/财富正文非空
    const fam = r.segs.find(s => s.title.includes('六亲'));
    const wea = r.segs.find(s => s.title.includes('财富'));
    expect(fam?.body.length).toBeGreaterThan(10);
    expect(wea?.body.length).toBeGreaterThan(10);
  });
  it('八术精批全部可输出且非空', () => {
    const arts: Array<[string, never]> = [
      ['liuyao', computeLiuyao({ time: TSH }, cfg, stableHash(cfg)) as never],
      ['meihua', computeMeihua({ time: TSH }, cfg, stableHash(cfg)) as never],
      ['qimen', computeQimen({ time: TSH }, cfg, stableHash(cfg)) as never],
      ['liuren', computeLiuren({ time: TSH }, cfg, stableHash(cfg)) as never],
      ['xiaoliuren', computeXiaoliuren({ time: TSH }, cfg, stableHash(cfg)) as never],
      ['jinkou', computeJinkou({ time: TSH }, cfg, stableHash(cfg)) as never],
    ];
    for (const [art, chart] of arts) {
      const r = jingPiFor(art, chart);
      expect(r.headline.length, `${art} headline`).toBeGreaterThan(5);
      expect(r.segs.length, `${art} segs`).toBeGreaterThanOrEqual(3);
    }
  });
  it('中和/调候命（unfavorable 为空）精批「忌=」不落空（回归：忌=。行）', () => {
    // 调候取用分支在 engine 中 unfavorable:[]，文案必须兜底为 —；不得输出「忌=。行」
    const base = computeBazi({ time: TSH, gender: '男' }, cfg, stableHash(cfg));
    const synthetic = { ...base, yongShen: { ...base.yongShen, unfavorable: [] } } as never;
    const r = jingPiFor('bazi', synthetic);
    expect(r.segs[0].body).toContain('忌=—');
    expect(r.segs[0].body.replace(/\s/g, '')).not.toMatch(/忌=[。，；]/);
  });
  it('多生日扫描：八字精批首段不得出现空忌字段', () => {
    const births = [
      { year: 1984, month: 1, day: 15, hour: 8, minute: 0 },  // 深冬·子丑月
      { year: 1988, month: 6, day: 20, hour: 14, minute: 0 }, // 仲夏·午月
      { year: 1995, month: 3, day: 5, hour: 6, minute: 0 },   // 早春
      { year: 2001, month: 9, day: 18, hour: 16, minute: 0 }, // 早秋·酉月
      { year: 1990, month: 5, day: 15, hour: 10, minute: 30 },
    ];
    for (const t of births) {
      const chart = computeBazi({ time: t, gender: '男' }, cfg, stableHash(cfg));
      const body = jingPiFor('bazi', chart as never).segs[0].body.replace(/\s/g, '');
      expect(body, JSON.stringify(t)).not.toMatch(/忌=[。，；]|忌=$/);
    }
  });
  it('八字六亲：批注与白话口径一致（批注"不透"时白话不得言"透"，反之亦然）', () => {
    const births = [
      { year: 1984, month: 1, day: 15, hour: 8, minute: 0 },
      { year: 1988, month: 6, day: 20, hour: 14, minute: 0 },
      { year: 1995, month: 3, day: 5, hour: 6, minute: 0 },
      { year: 2001, month: 9, day: 18, hour: 16, minute: 0 },
      { year: 1990, month: 5, day: 15, hour: 10, minute: 30 },
    ];
    for (const t of births) {
      const chart = computeBazi({ time: t, gender: '男' }, cfg, stableHash(cfg));
      const body = jingPiFor('bazi', chart as never).segs.find(s => s.title.includes('六亲'))!.body;
      const [note, plain] = body.split('白话：');
      expect(plain, JSON.stringify(t)).toBeTruthy();
      expect(plain, JSON.stringify(t)).toContain('宫位口诀');
      // 母星批注未透 → 白话不得再说“正印透/母慈且给力”
      if (!note.includes('母星（正印）透于')) expect(plain, JSON.stringify(t)).not.toMatch(/(正印|偏印)透/);
      else expect(plain, JSON.stringify(t)).toContain('正印透干');
      // 父星批注未透 → 白话不得再说“偏财透”
      if (!note.includes('父星（偏财）透于')) expect(plain, JSON.stringify(t)).not.toMatch(/偏财透/);
      else expect(plain, JSON.stringify(t)).toContain('偏财透干');
      // 比劫批注不透 → 白话不得再说“比劫透/重朋友兄弟”
      if (note.includes('比劫不透')) { expect(plain, JSON.stringify(t)).not.toMatch(/比劫透/); expect(plain, JSON.stringify(t)).not.toContain('重朋友兄弟'); }
      else expect(plain, JSON.stringify(t)).toContain('比劫透干');
    }
  });
  it('流月干支五虎遁 = 12 个月', () => {
    expect(liuYueGanZhi('甲').length).toBe(12);
    expect(liuYueGanZhi('甲')[0]).toBe('丙寅');
    expect(liuYueGanZhi('乙')[0]).toBe('戊寅');
  });
  it('流年按节气切 12 月且每月有逐日流日', () => {
    const groups = flowYearMonths(2026, liuYueGanZhi('丙'));
    expect(groups.length).toBe(12);
    const totalDays = groups.reduce((s, g) => s + g.days.length, 0);
    expect(totalDays).toBeGreaterThan(330);
    // 每一组日柱长度=2
    for (const g of groups.slice(0, 3)) {
      for (const d of g.days) expect(d.dayPillar.length).toBe(2);
    }
  });
  it('流时 12 时辰：时柱长短正确且子时应为整', () => {
    const hours = flowHoursOfDay('甲子');
    expect(hours.length).toBe(12);
    expect(hours[0].zhi).toBe('子');
    expect(hours[0].gz).toBe('甲子'); // 甲己日起甲子
  });
  it('流年/流月/流日/流时 四柱对照：逐柱给出十神/藏干/纳音并与命局刑冲害破合', () => {
    const chart = computeBazi({ time: TSH, gender: '男' }, cfg, stableHash(cfg));
    const rows = baziStreamPillars(chart, { year: 2026, month: 8, day: 30, hour: 19, minute: 30 });
    expect(rows.map(r => r.label)).toEqual(['流年', '流月', '流日', '流时']);
    for (const r of rows) {
      expect(r.gz.length, r.label).toBe(2);
      expect(r.shiShen, r.label).toBeTruthy();
      expect(r.hidden.length, r.label).toBeGreaterThan(0);
      expect(r.nayin, r.label).toBeTruthy();
      expect(Array.isArray(r.events), r.label).toBe(true);
      // 刑冲害破合事件为 {code,plain}：code 格式「冲/刑/害/破/合 + 柱字 + 支/干」，plain 含白话解释
      for (const e of r.events) {
        expect(e.code, r.label).toMatch(/^(冲|刑|害|破|合)[年月日时](支|干)「[^」]*」/);
        expect(e.plain, r.label).toContain('——');
      }
    }
    // 缺时辰命局仍可出（流柱来自当前时刻，不依赖命主时柱）
    const miss = computeBazi({ time: { ...TSH, hour: -1 } as never, hourMissing: true } as never, cfg, stableHash(cfg));
    expect(baziStreamPillars(miss, { year: 2026, month: 8, day: 30, hour: 19, minute: 30 }).length).toBe(4);
  });
  it('真太阳时：乌鲁木齐（87.6°E）与北京时间时柱不同（跨时辰）', () => {
    const t = { year: 1990, month: 5, day: 15, hour: 12, minute: 30 };
    const off = normalizeMoment({ time: t }, { calendar: cfg.calendar });
    const on = normalizeMoment({ time: t }, { calendar: { ...cfg.calendar, trueSolarTime: true, longitude: 87.6 } });
    // 12:30 北京=午时；乌鲁木齐经度差约 -130 分钟 → 10:20 前 ⇒ 巳时，时柱应不同
    expect(off.hourPillar).not.toBe(on.hourPillar);
    expect(on.trueSolarUsed).toBe(true);
  });
});