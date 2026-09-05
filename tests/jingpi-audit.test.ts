import { describe, it, expect } from 'vitest';
import {
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou, computeQimenDay,
  defaultConfig, stableHash,
  jingPiFor,
} from '@xuanshu/core';

const cfg = defaultConfig();
const T = { year: 1990, month: 5, day: 15, hour: 10, minute: 30 };
const H = stableHash(cfg);

describe('各术精解完整性巡检', () => {
  it('八字精批含称骨段', () => {
    const c = computeBazi({ time: T, gender: '男' }, cfg, H);
    const r = jingPiFor('bazi', c as never);
    const t = r.segs.map(s => s.title).join('|');
    expect(t).toContain('称骨');
    expect(t).toContain('六亲');
    expect(Object.keys(r).length).toBeGreaterThan(0);
    // 每段正文都非空
    for (const s of r.segs) {
      expect(s.body.length, s.title).toBeGreaterThan(5);
    }
  });
  it('六爻/梅花/紫微/奇门/大六壬/小六壬/金口/日家 精解均非空且各段有正文', () => {
    const cases: Array<[string, unknown]> = [
      ['liuyao', computeLiuyao({ time: T }, cfg, H)],
      ['meihua', computeMeihua({ time: T }, cfg, H)],
      ['ziwei', computeZiwei({ time: T }, cfg, H)],
      ['qimen', computeQimen({ time: T }, cfg, H)],
      ['liuren', computeLiuren({ time: T }, cfg, H)],
      ['xiaoliuren', computeXiaoliuren({ time: T }, cfg, H)],
      ['jinkou', computeJinkou({ time: T }, cfg, H)],
      ['qimen-day', computeQimenDay({ time: T }, cfg, H)],
    ];
    for (const [art, chart] of cases) {
      const r = jingPiFor(art === 'qimen-day' ? 'qimen' : art, chart as never);
      expect(r.segs.length, art).toBeGreaterThanOrEqual(3);
      expect(r.headline.length, `${art} headline`).toBeGreaterThan(5);
      for (const s of r.segs) {
        expect(s.body.length, `${art} ${s.title}`).toBeGreaterThan(5);
        expect(s.body, `${art} 无 undefined`).not.toContain('undefined');
        expect(s.body, `${art} 无 null 字面`).not.toContain('null');
      }
    }
  });
  it('边界盘：缺时辰八字（称骨降级提示而非报错）', () => {
    const input = { time: { ...T, hour: -1 } as never, hourMissing: true } as never;
    const c = computeBazi(input, cfg, H);
    const r = jingPiFor('bazi', c as never);
    const bone = r.segs.find(s => s.title.includes('称骨'));
    expect(bone).toBeDefined();
    expect(bone!.body).not.toContain('undefined');
  });
  it('多样本扫描：八术精批正文不得出现"空值泄漏/重复标点"（如 忌=。行、。；）', () => {
    // ① 空值泄漏=模板拼接了空数组/空字段又紧跟标点（会话里出现过「忌=。行运…」）
    // ② 重复标点=句号/分号/逗号紧邻（出现过「…再细分）。；子女星…」）
    const LEAK = /([，.；。])(?=[，.；。])|(：|;|；|=)([，。；、,])/;
    const inputs = [
      { year: 1984, month: 1, day: 15, hour: 8, minute: 0 },   // 深冬
      { year: 1990, month: 5, day: 15, hour: 10, minute: 30 }, // 初夏
      { year: 2001, month: 9, day: 18, hour: 16, minute: 0 },  // 初秋
    ];
    for (const t of inputs) {
      const inCfg = { time: t, gender: '男' as const };
      const cases: Array<[string, unknown]> = [
        ['bazi', computeBazi(inCfg, cfg, H)],
        ['liuyao', computeLiuyao(inCfg, cfg, H)],
        ['meihua', computeMeihua(inCfg, cfg, H)],
        ['ziwei', computeZiwei(inCfg, cfg, H)],
        ['qimen', computeQimen(inCfg, cfg, H)],
        ['qimen-day', computeQimenDay({ time: t }, cfg, H)],
        ['liuren', computeLiuren(inCfg, cfg, H)],
        ['xiaoliuren', computeXiaoliuren(inCfg, cfg, H)],
        ['jinkou', computeJinkou(inCfg, cfg, H)],
      ];
      for (const [art, chart] of cases) {
        const r = jingPiFor(art === 'qimen-day' ? 'qimen' : art, chart as never);
        const texts = [r.headline, ...r.segs.map(s => `${s.title}：${s.body}`)];
        for (const txt of texts) {
          expect(txt, `${art} ${JSON.stringify(t)}`).not.toMatch(LEAK);
        }
      }
    }
  });
});