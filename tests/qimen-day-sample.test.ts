import { describe, it, expect } from 'vitest';
import { computeQimenDay, defaultConfig } from '@xuanshu/core';

describe('日家奇门运行时样例（2026-08-30 10:00 黄金样本）', () => {
  it('丙子日 阴遁：休门落巽四、太乙落艮八、喜神坤、贵人亥酉、黑道玄武', () => {
    const cfg = defaultConfig('择日');
    cfg.paipan.qimenTimeType = 'ri';
    const d = computeQimenDay({ time: { year: 2026, month: 8, day: 30, hour: 10, minute: 0 }, gender: '男' }, cfg, 'sample');
    expect(d.dayPillar).toBe('丙子');
    expect(d.yinYang).toBe('阴遁');      // 处暑后
    expect(d.xiuMenGong).toBe(4);        // 丙子日休门起巽四（阴遁三日一宫）
    expect(d.taiYiGong).toBe(8);         // 太乙落艮八（阴遁飞序）
    expect(d.xiShen).toContain('坤');    // 丙日喜神在坤（西南）
    expect(d.guiRen).toBe('亥/酉');      // 丙丁日贵人猪鸡位
    expect(d.currentDao.kind).toBe('黑道');
    expect(d.currentDao.shen).toBe('玄武');
    // 八门九星数量
    expect(d.cells.filter(c => c.gate).length).toBe(8);
    expect(d.cells.filter(c => c.star).length).toBe(9);
  });
});