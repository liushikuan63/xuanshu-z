/** 八字一生趋势（问真式大运流年多维 + 一生能量曲线 + 白话解读）。
 * 确定性纯函数：只依赖 chart（含 dayun/pillars/yongShen），评分模型透明可解释。
 * 白话层定位：文化参考语气，不做确定论断（R11/D28 约束）。
 */
import type { BaziChart } from './engine';
import { TIAN_GAN, DI_ZHI, GAN_WUXING, ZHI_WUXING, JIAZI60, ganzhiIndex, shiShen, liuchong, xiangxing, LIUHE, SANHE } from '../../calendar/ganzhi';

export interface TrendYear {
  year: number;          // 公历年
  age: number;           // 虚岁约略（按起运前实岁计）
  gz: string;            // 流年干支
  shiShen: string;       // 流年天干对日主的十神
  score: number;         // -6..+6，喜忌加权（透明模型，见 scoreOf）
  events: string[];      // 冲合刑害等事件（与命局/大运作用）
  plain: string;         // 白话解读
}

export interface TrendStage {
  index: number;         // 第几步大运（0 起）
  ganzhi: string;
  startAge: number; endAge: number;
  startYear: number; endYear: number;
  shiShen: string;
  plain: string;         // 阶段白话总评
  years: TrendYear[];
}

export interface LifeTrend {
  stages: TrendStage[];
  summary: string;       // 一生走势总评（白话）
  bestYears: Array<{ year: number; gz: string; plain: string }>;
  hardYears: Array<{ year: number; gz: string; plain: string }>;
}

const WX_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const GAN_WUHE: Array<[string, string, string]> = [
  ['甲', '己', '合土'], ['乙', '庚', '合金'], ['丙', '辛', '合水'], ['丁', '壬', '合木'], ['戊', '癸', '合火'],
];

function zhiEvents(yearZhi: string, chart: BaziChart): string[] {
  const out: string[] = [];
  const branches = chart.pillars.map(p => ({ label: p.label, zhi: p.gz[1] }));
  for (const { label, zhi } of branches) {
    if (liuchong(yearZhi, zhi)) out.push(`冲${label}支（${zhi}）——动象，主变动出行`);
  }
  for (const { label, zhi } of branches) {
    if (LIUHE.some(([a, b]) => (a === yearZhi && b === zhi) || (b === yearZhi && a === zhi))) out.push(`合${label}支（${zhi}）——缓合，主人事融洽`);
  }
  for (const { label, zhi } of branches) {
    if (xiangxing(yearZhi, zhi)) out.push(`刑${label}支（${zhi}）——磨擦，防细节差错`);
  }
  for (const { group } of SANHE) {
    const [a, b, c] = group;
    if (yearZhi === a || yearZhi === b || yearZhi === c) {
      const other = [a, b, c].filter(x => x !== yearZhi);
      if (branches.some(br => br.zhi === other[0]) && branches.some(br => br.zhi === other[1])) {
        out.push(`与命局${other.join('、')}三合成局——力量汇聚`);
      }
    }
  }
  return [...new Set(out)];
}

function ganEvent(yearGan: string, chart: BaziChart): string | null {
  const he = GAN_WUHE.find(([a, b]) => a === yearGan && b === chart.dayGan || b === yearGan && a === chart.dayGan);
  return he ? `与日主${he[2]}——有牵引、合作之象` : null;
}

/** 透明评分模型：喜用 +2/字，忌仇 -2/字，冲 -1、刑 -1、合 +1、三合局 +2、干合 +1，夹逼 [-6,6] */
function scoreOf(yearGz: string, events: string[], chart: BaziChart): number {
  const ganWx = GAN_WUXING[TIAN_GAN.indexOf(yearGz[0])];
  const zhiWx = ZHI_WUXING[DI_ZHI.indexOf(yearGz[1])];
  let s = 0;
  for (const wx of [ganWx, zhiWx]) {
    if (chart.yongShen.favorable.includes(wx)) s += 2;
    if (chart.yongShen.unfavorable.includes(wx)) s -= 2;
  }
  for (const e of events) {
    if (e.includes('冲')) s -= 1;
    else if (e.includes('刑')) s -= 1;
    else if (e.includes('三合成局')) s += 2;
    else if (e.includes('合')) s += 1;
  }
  return Math.max(-6, Math.min(6, s));
}

const SHISHEN_PLAIN: Record<string, string> = {
  比肩: '同辈并肩之年，利合作与结伴，也须防分利',
  劫财: '竞争破耗之年，合作先小人后君子，忌担保借贷',
  食神: '表达与生财之年，利创作、教学、才艺展示，心境较宽',
  伤官: '才华外露之年，利技术输出与创新，但言语易得罪人',
  正财: '正财当值，收入稳中有进，宜务实积累',
  偏财: '流动之财活跃，机会多来去也快，宜见好就收',
  正官: '规矩与责任之年，利考核升迁考编，行事宜守正',
  七杀: '压力与魄力并存之年，挑战大但突破亦大，注意身体与是非',
  正印: '贵人文书之年，利学习考试签约，长辈缘旺',
  偏印: '偏门学识之年，宜钻研技艺，思虑较多防内耗',
};

function plainOf(y: Omit<TrendYear, 'plain'>, chart: BaziChart): string {
  const band = y.score >= 3 ? '整体顺遂，可积极进取'
    : y.score >= 1 ? '平中偏好，稳中有进'
    : y.score > -1 ? '平年，守常即安'
    : y.score > -3 ? '阻力偏多，宜守不宜攻'
    : '低谷之年，忌重大冒进，宜静养蓄力';
  const shi = SHISHEN_PLAIN[y.shiShen] ?? '';
  const ev = y.events.length ? y.events[0] : '';
  const yong = `喜用为${chart.yongShen.favorable.join('、')}`;
  return `${y.gz}年（${y.age} 岁）：${shi}。${ev ? ev + '。' : ''}按喜忌（${yong}）衡量，${band}。——传统命理文化参考，非确定性预测。`;
}

function stagePlain(scoreAvg: number, stage: { ganzhi: string; shiShen: string }, firstYear: number, lastYear: number): string {
  const tone = scoreAvg >= 1.5 ? '整体向上，是十年中较可施展的阶段'
    : scoreAvg >= 0 ? '平顺过渡，机会与琐碎并存'
    : scoreAvg > -1.5 ? '偏磨炼，进展慢但积淀实'
    : '压力较大的十年，宜低调蓄力、锻炼身心';
  return `${stage.ganzhi}大运（约 ${firstYear}–${lastYear} 年）：运干为${stage.shiShen}，${tone}。`;
}

/** 一生趋势：8 步大运 × 10 流年，逐年评分与白话 */
export function baziLifeTrend(chart: BaziChart): LifeTrend {
  const birthYear = chart.normalized.year;
  const yearIdx0 = ganzhiIndex(chart.pillars[0].gz);
  const stages: TrendStage[] = chart.dayun.map(d => {
    // DayunItem.years = [起年, 止年] 边界；每步大运十年，逐年展开
    const yearCount = Math.max(1, Math.round(d.endAge - d.startAge) || 10);
    const yearList: number[] = Array.from({ length: Math.min(10, yearCount) }, (_, i) => d.years[0] + i);
    const years: TrendYear[] = yearList.map((year, i) => {
      const gz = JIAZI60[(yearIdx0 + (year - birthYear)) % 60];
      const age = d.startAge + i;
      const events = [...zhiEvents(gz[1], chart)];
      const ge = ganEvent(gz[0], chart);
      if (ge) events.push(ge);
      // 流年与大运的作用
      if (liuchong(gz[1], d.ganzhi[1])) events.push(`冲大运支（${d.ganzhi[1]}）——运岁交冲，变动加剧`);
      if (LIUHE.some(([a, b]) => (a === gz[1] && b === d.ganzhi[1]) || (b === gz[1] && a === d.ganzhi[1]))) events.push(`合大运支（${d.ganzhi[1]}）——运岁相合，事有牵引`);
      const partial = { year, age, gz, shiShen: shiShen(chart.dayGan, gz[0]), score: 0, events };
      const score = scoreOf(gz, events, chart);
      const full: TrendYear = { ...partial, score, plain: plainOf({ ...partial, score }, chart) };
      return full;
    });
    const avg = years.reduce((s, y) => s + y.score, 0) / (years.length || 1);
    return {
      index: d.index, ganzhi: d.ganzhi, startAge: d.startAge, endAge: d.endAge,
      startYear: years[0].year, endYear: years[years.length - 1].year,
      shiShen: d.shiShen,
      plain: stagePlain(avg, d, years[0].year, years[years.length - 1].year),
      years,
    };
  });
  const all = stages.flatMap(s => s.years);
  const ranked = [...all].sort((a, b) => b.score - a.score);
  const pick = (arr: TrendYear[]) => arr.slice(0, 3).map(y => ({ year: y.year, gz: y.gz, plain: y.plain.split('。').slice(0, 2).join('。') }));
  const overall = all.reduce((s, y) => s + y.score, 0) / (all.length || 1);
  const summary = `一生趋势总览：共 ${all.length} 个流年，整体均值 ${overall.toFixed(1)}（-6~+6）。`
    + `较旺阶段：${stages.map(s => ({ s, avg: s.years.reduce((x, y) => x + y.score, 0) / (s.years.length || 1) })).sort((a, b) => b.avg - a.avg).slice(0, 2).map(x => `${x.s.ganzhi}运（${x.s.startYear}–${x.s.endYear}）`).join('、')}；`
    + `需留意阶段：${stages.map(s => ({ s, avg: s.years.reduce((x, y) => x + y.score, 0) / (s.years.length || 1) })).sort((a, b) => a.avg - b.avg).slice(0, 1).map(x => `${x.s.ganzhi}运（${x.s.startYear}–${x.s.endYear}）`).join('')}。`
    + '曲线只反映喜忌倾向，人生走向仍由现实选择决定。';
  return { stages, summary, bestYears: pick(ranked), hardYears: pick(ranked.slice(-3).reverse()) };
}
