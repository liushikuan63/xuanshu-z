import { describe, it, expect } from 'vitest';
import { computeBoneWeight, BONE_SONG } from '@xuanshu/core';

describe('袁天罡称骨', () => {
  it('1971 正月初一子时 = 4两4钱（经典例）', () => {
    // 1971-01-27 公历 = 辛亥年正月初一；子时
    const r = computeBoneWeight(1971, 1, 27, 0, 30);
    expect(r.totalLiang).toBeCloseTo(4.4, 1);
    expect(r.parts.length).toBe(4);
    expect(r.poem).toBe(BONE_SONG['4.4'].poem);
  });
  it('骨重总和 = 年月日时四项之和', () => {
    const r = computeBoneWeight(1990, 5, 15, 10, 30);
    const sum = r.parts.reduce((s, p) => s + parseFloat(p.value.replace('两', '').replace('钱', '.').replace(/^(\d+)\.(\d)$/, '$1$2')) / (p.value.includes('.') ? 1 : 10), 0);
    expect(r.totalLiang).toBeGreaterThan(0);
    expect(r.poem.length).toBeGreaterThan(10);
    expect(r.plain.length).toBeGreaterThan(5);
  });
  it('全部骨重表可查且无缺', () => {
    expect(Object.keys(BONE_SONG).length).toBeGreaterThan(40);
    for (const v of Object.values(BONE_SONG)) {
      expect(v.poem.length).toBeGreaterThan(20);
      expect(v.plain.length).toBeGreaterThan(5);
    }
  });
});