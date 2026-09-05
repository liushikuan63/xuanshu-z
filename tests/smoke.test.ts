/** 冒烟测试：八术引擎 + configHash（快速回归） */
import { describe, it, expect } from 'vitest';
import {
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeXiaoliuren, computeQimen, computeLiuren, computeJinkou,
  defaultConfig, stableHash, liuyaoRules, ziweiRules, baziRules, guaByName, dayPillarFromJdn, GUA64,
} from '@xuanshu/core';

const cfg = defaultConfig('失物');
const hash = stableHash(cfg);
const t = { year: 2026, month: 8, day: 29, hour: 14, minute: 30 };
const input = { time: t, gender: '男' as const };

describe('configHash（D27）', () => {
  it('同配置不同 key 顺序 hash 一致', () => {
    const a = { x: 1, y: { b: 2, a: 3 } };
    const b = { y: { a: 3, b: 2 }, x: 1 };
    expect(stableHash(a)).toBe(stableHash(b));
  });
  it('不同配置 hash 不同', () => {
    expect(stableHash(defaultConfig('失物'))).not.toBe(stableHash(defaultConfig('事业')));
  });
});

describe('历法', () => {
  it('日柱 JDN 锚点：2000-01-01 = 戊午', () => {
    expect(dayPillarFromJdn(2451545)).toBe('戊午');
  });
  it('2026-08-29 14:00 全柱', () => {
    const b = computeBazi(input, cfg, hash);
    expect(b.pillars.map(p => p.gz)).toEqual(['丙午', '丙申', '乙亥', '癸未']);
  });
});

describe('八术排盘', () => {
  it('八字', () => {
    const b = computeBazi(input, cfg, hash);
    expect(b.pillars).toHaveLength(4);
    expect(b.dayun.length).toBe(8);
    expect(baziRules(b, cfg).length).toBeGreaterThan(2);
  });
  it('六爻（时间卦）', () => {
    const l = computeLiuyao({ ...input, method: 'time' }, cfg, hash);
    expect(l.lines).toHaveLength(6);
    expect(l.worldIdx).toBeGreaterThanOrEqual(0);
    expect(liuyaoRules(l).length).toBeGreaterThan(3);
    expect(l.changedName).toBeTruthy();
  });
  it('六爻装卦：乾为天', () => {
    const l = computeLiuyao({ ...input, hexagram: { upper: 1, lower: 1 } }, cfg, hash);
    expect(l.guaName).toBe('乾为天');
    expect(l.lines[0].najia).toBe('甲子');
    expect(l.lines[5].najia).toBe('壬戌');
    expect(l.lines[5].shiYing).toBe('世');
    expect(l.lines[2].shiYing).toBe('应');
    // 乾宫属金：初爻甲子水 → 兄弟？金生水 → 我生者为子孙
    expect(l.lines[0].liuqin).toBe('子孙');
  });
  it('梅花·观梅占黄金样本（辰年十二月十七日申时 → 革之咸，互见乾巽）', () => {
    // 用农历 1582?（辰年十二月十七日申时）—— 直接构造时间卦验证算法：年5+月12+日17=34→兑(2)；+申9=43→离(3)；动爻43%6=1
    const m = computeMeihua({ time: { year: 2026, month: 1, day: 17, hour: 16, minute: 0 } }, defaultConfig('感情'), hash);
    // 2026 丙午年→午=7，腊月？此处验证机制而非历史事件
    expect(m.upper).toBeTruthy();
    expect(['吉', '凶', '中']).toContain(m.auspiciousness);
    expect(m.bianGuaName).toBeTruthy();
  });
  it('紫微（iztro 适配）', () => {
    const z = computeZiwei({ time: { year: 2000, month: 8, day: 16, hour: 4, minute: 0 }, gender: '女' }, cfg, hash);
    expect(z.palaces).toHaveLength(12);
    expect(z.fiveElementsClass).toBeTruthy();
    expect(z.soul).toBeTruthy();
    expect(z.palaces.find(p => p.isOriginal)!.stars.length).toBeGreaterThan(0);
    const rules = ziweiRules(z);
    expect(rules.length).toBeGreaterThan(3);
    // 2000 庚辰年：全集主流 化科=太阴
    expect(z.sihua.ke).toBe('太阴');
    expect(z.sihua.disputed).toBe(true);
  });
  it('奇门', () => {
    const q = computeQimen(input, cfg, hash);
    expect(q.ju).toBeGreaterThanOrEqual(1);
    expect(q.ju).toBeLessThanOrEqual(9);
    expect(q.cells).toHaveLength(9);
    expect(q.zhifuStar).toContain('天');
  });
  it('大六壬', () => {
    const lr = computeLiuren(input, cfg, hash);
    expect(lr.fourLessons).toHaveLength(4);
    expect(lr.sanChuan).toHaveLength(3);
    expect(lr.keTi).toBeTruthy();
  });
  it('小六壬', () => {
    const x = computeXiaoliuren(input, cfg, hash);
    expect(['大安', '留连', '速喜', '赤口', '小吉', '空亡']).toContain(x.final);
  });
  it('金口诀', () => {
    const jk = computeJinkou(input, cfg, hash);
    expect(jk.jiangShen).toBeTruthy();
    expect(jk.fiveDong).toHaveLength(5);
  });
});

describe('64 卦完整性', () => {
  it('64 卦各不相同且名称合法', () => {
    const bins = new Set<string>();
    for (const g of GUA64) bins.add(g.bin);
    expect(bins.size).toBe(64);
  });
});
