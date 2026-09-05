/** 十神与纳音黄金样本（judge 验收发现的系统性映射 bug 的回归锚） */
import { describe, it, expect } from 'vitest';
import { shiShen, nayin } from '@xuanshu/core';

describe('十神黄金矩阵', () => {
  it('乙木日主十神全对', () => {
    expect(shiShen('乙', '壬')).toBe('正印');
    expect(shiShen('乙', '癸')).toBe('偏印');
    expect(shiShen('乙', '庚')).toBe('正官');
    expect(shiShen('乙', '辛')).toBe('七杀');
    expect(shiShen('乙', '甲')).toBe('劫财');
    expect(shiShen('乙', '乙')).toBe('比肩');
    expect(shiShen('乙', '丙')).toBe('伤官');
    expect(shiShen('乙', '丁')).toBe('食神');
    expect(shiShen('乙', '戊')).toBe('正财');
    expect(shiShen('乙', '己')).toBe('偏财');
  });
  it('庚金日主抽查', () => {
    expect(shiShen('庚', '甲')).toBe('偏财');
    expect(shiShen('庚', '乙')).toBe('正财');
    expect(shiShen('庚', '丙')).toBe('七杀');
    expect(shiShen('庚', '丁')).toBe('正官');
    expect(shiShen('庚', '戊')).toBe('偏印');
    expect(shiShen('庚', '己')).toBe('正印');
    expect(shiShen('庚', '壬')).toBe('食神');
    expect(shiShen('庚', '癸')).toBe('伤官');
    expect(shiShen('庚', '辛')).toBe('劫财');
  });
  it('癸水日主抽查', () => {
    expect(shiShen('癸', '甲')).toBe('伤官');
    expect(shiShen('癸', '乙')).toBe('食神');
    expect(shiShen('癸', '丙')).toBe('正财');
    expect(shiShen('癸', '丁')).toBe('偏财');
    expect(shiShen('癸', '戊')).toBe('正官');
    expect(shiShen('癸', '己')).toBe('七杀');
    expect(shiShen('癸', '庚')).toBe('正印');
    expect(shiShen('癸', '辛')).toBe('偏印');
  });
});

describe('六十甲子纳音黄金锚', () => {
  it('首尾与中段', () => {
    expect(nayin(0)).toBe('海中金');   // 甲子乙丑
    expect(nayin(1)).toBe('海中金');
    expect(nayin(6)).toBe('路旁土');   // 庚午
    expect(nayin(17)).toBe('白蜡金');  // 辛巳
    expect(nayin(21)).toBe('泉中水');  // 乙酉
    expect(nayin(18)).toBe('杨柳木');  // 壬午
    expect(nayin(59)).toBe('大海水');  // 癸亥
  });
});
