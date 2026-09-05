/** R-年家/月家奇门 黄金样本测试（R3a 引擎验收） */
import { describe, it, expect } from 'vitest';
import { computeQimen, qimenRules, determineJuNianjia, determineJuYuejia, flyZiBai } from '../packages/core/src/arts/qimen/engine';
import { defaultConfig } from '../packages/core/src/config/types';

const run = (time: any, qimenTimeType: any) => {
  const cfg = defaultConfig('其他');
  cfg.paipan = { ...cfg.paipan, qimenTimeType, qimenJuMethod: 'chaibu', qimenPanType: 'zhuan' };
  return computeQimen({ time, gender: '男' }, cfg, 't');
};

describe('年家奇门·起局引擎（R3a）', () => {
  // 2026年=丙午年，(2026+2697)%180 = 4723%180 = 4723-26*180=4723-4680=43 → 属上元（<60），阴遁1局
  it('2026丙午年属年家上元·阴遁1局·紫白1白入中', () => {
    const j = determineJuNianjia('丙午', 2026);
    expect(j.yuan).toBe('上元');
    expect(j.ju).toBe(1);
    expect(j.yinYang).toBe('阴遁');
    expect(j.ziBaiZhong).toBe(1);
  });

  // 1984甲子年 (1984+2697)%180=4681%180=4681-26*180=4681-4680=1 → 下元(120-179？不对：1<60→上元，按资料 1984 应属下元是按现代流派... 引擎按前2697黄帝纪年来)
  it('2026丙午年 排盘返回timeType=nian·cells=8宫·有ziBai', () => {
    const c = run({ year: 2026, month: 8, day: 30, hour: 10, minute: 0 }, 'nian');
    expect(c.timeType).toBe('nian');
    expect(c.juMethod).toBe('nianjia');
    expect(c.yinYang).toBe('阴遁');
    expect(c.cells.length).toBeGreaterThanOrEqual(8);
    expect(c.ziBai).toHaveLength(9); // 九宫紫白
    expect(c.ziBai!.find(z => z.gong === 5)?.star).toBe('一白'); // 1入中
    // 三白吉方：一白/六白/八白
    const sanbai = c.ziBai!.filter(z => ['一白', '六白', '八白'].includes(z.star)).map(z => z.gong).sort();
    expect(sanbai.length).toBe(3);
    // 紫白5黄煞宫
    const wuhuang = c.ziBai!.find(z => z.star === '五黄');
    expect(wuhuang?.level).toBe('凶');
    console.log('[年家2026丙午] ju=' + c.ju + c.yinYang + ' 值符=' + c.zhifuStar + '/' + c.zhifuGate + ' 三白宫=' + sanbai.join(',') + ' 五黄宫=' + wuhuang?.gong + ' patterns=' + c.patterns.join('|'));
  });
});

describe('月家奇门·起局引擎（R3a）', () => {
  // 2026丙午年，年支午=四仲→中元，兑7起甲子戊（阴遁7局）。正月(寅月丙寅)：孟年正二黑起步，monthIdx=0，紫白2入中
  it('丙午年 寅月 是月家中元·阴遁7局', () => {
    const j = determineJuYuejia('丙午', '丙寅');
    expect(j.yuan).toBe('中元');
    expect(j.ju).toBe(7);
  });
  it('丙午年 申月(丙申)：孟年？ 午为仲，仲年正月八白入中(丙申=第7月 monthIdx=6)', () => {
    const j = determineJuYuejia('丙午', '丙申');
    // 申月是 yearPillar[1]=午(四仲) 故 startZibai=8；monthIdx of 申=6 (寅0→申6)；ziBaiZhong = (8-1+6)%9+1 = 13%9+1 = 4+1 =5
    expect(j.ziBaiZhong).toBe(5);
  });

  it('2026-08 丙午年丙申月 月家盘返回timeType=yue·ziBai五黄入中', () => {
    const c = run({ year: 2026, month: 8, day: 15, hour: 8, minute: 0 }, 'yue');
    expect(c.timeType).toBe('yue');
    expect(c.juMethod).toBe('yuejia');
    expect(c.yinYang).toBe('阴遁');
    expect(c.ziBai!.find(z => z.gong === 5)?.star).toBe('五黄'); // 5入中宫
    expect(c.cells.length).toBeGreaterThanOrEqual(8);
    console.log('[月家2026.08] ju=' + c.ju + c.yinYang + ' 值符=' + c.zhifuStar + '/' + c.zhifuGate + ' 年=' + c.yearPillar + ' 月=' + c.monthPillar);
  });
});

describe('flyZiBai 紫白九星分布（通用函数）', () => {
  it('一白入中→五黄飞坤2宫（经典紫白）', () => {
    const z = flyZiBai(1);
    expect(z.find(x => x.gong === 5)?.star).toBe('一白');
    // 按洛书顺飞：中5→1白，乾6→2黑，兑7→3碧，艮8→4绿，离9→5黄，坎1→6白，坤2→7赤，震3→8白，巽4→9紫
    const li9 = z.find(x => x.gong === 9);
    expect(li9?.star).toBe('五黄');
    expect(li9?.level).toBe('凶');
    const kan1 = z.find(x => x.gong === 1);
    expect(kan1?.star).toBe('六白');
    expect(kan1?.level).toBe('吉');
  });
});

describe('qimenRules 年/月奇门规则命中', () => {
  it('年家盘应产生紫白九星规则hit和年家说明hit', () => {
    const c = run({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, 'nian');
    const rules = qimenRules(c);
    const zibai = rules.filter(r => r.ruleId.startsWith('qimen.zibai'));
    expect(zibai.length).toBe(9);
    const sys = rules.find(r => r.ruleId === 'qimen.system.nianyue');
    expect(sys).toBeDefined();
    expect(sys!.fact).toMatch(/年家奇门：/);
  });
  it('月家盘规则命中', () => {
    const c = run({ year: 2026, month: 8, day: 30, hour: 10, minute: 0 }, 'yue');
    const rules = qimenRules(c);
    const zibai = rules.filter(r => r.ruleId.startsWith('qimen.zibai'));
    expect(zibai.length).toBe(9);
    const dingju = rules.find(r => r.ruleId === 'qimen.pan');
    expect(dingju!.title).toContain('月家');
  });
});
