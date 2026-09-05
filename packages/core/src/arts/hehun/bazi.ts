/** 八字合婚引擎（hehun/bazi.ts）：双人 BaziChart 逐维比对。
 * 维度：① 生肖六合/三合/六冲/六害 ② 年柱纳音生克 ③ 日干五合 ④ 日支六合/冲
 * ⑤ 用神互补 ⑥ 神煞（孤辰寡宿/阴差阳错/桃花） ⑦ 五行互补。
 * 口径：确定性规则 + 白话说明；不做绝对吉凶断言、不给"宜婚/忌婚"结论（R11/D28 约束）。
 */
import type { BaziChart } from '../bazi/engine';
import { DI_ZHI, ZHI_SHENGXIAO, LIUHE, SANHE, nayin } from '../../calendar/ganzhi';

export interface HehunItem {
  dimension: string;        // 维度名
  relation: '合' | '冲' | '害' | '生' | '克' | '同比' | '中性';
  verdict: '相合' | '注意' | '中性';
  detail: string;           // 双方事实
  plain: string;            // 白话
}

export interface BaziHehunResult {
  pair: { a: string; b: string };   // 双方四柱摘要
  score: number;                    // 0..100 综合（文化参考分，非论断）
  items: HehunItem[];
  summary: string;                  // 白话总述
}

const GAN_FIVE = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' } as const;
const GAN_WUHE: Array<[string, string, string]> = [['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火']];
const LIUHAI: Array<[string, string]> = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];

const SX = (zhi: string): string => ZHI_SHENGXIAO[DI_ZHI.indexOf(zhi as never)] ?? '';

/** 地支关系：返回 六合/三合/六冲/六害/刑 or null（谁跟谁） */
function zhiRelation(a: string, b: string): { kind: '六合' | '三合' | '六冲' | '六害' | '刑'; note: string } | null {
  if (LIUHE.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) {
    const e = LIUHE.find(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))!;
    return { kind: '六合', note: `${a}${b}六合（${e[0]}${e[1]}合），意向相投` };
  }
  if (LIUHAI.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) {
    return { kind: '六害', note: `${a}${b}相害，相处需多包容` };
  }
  if (Math.abs(DI_ZHI.indexOf(a as never) - DI_ZHI.indexOf(b as never)) === 6) {
    return { kind: '六冲', note: `${a}${b}六冲，性格易有碰撞` };
  }
  const sanhe = SANHE.find(g => g.group.includes(a) && g.group.includes(b));
  if (sanhe) return { kind: '三合', note: `${a}${b}同属${sanhe.element}三合局` };
  return null;
}

/** 纳音五行（相生/比和/相克） */
function nayinShengke(a: string, b: string): '生' | '克' | '同比' | '中性' {
  const wxa = a.includes('金') ? '金' : a.includes('木') ? '木' : a.includes('水') ? '水' : a.includes('火') ? '火' : '土';
  const wxb = b.includes('金') ? '金' : b.includes('木') ? '木' : b.includes('水') ? '水' : b.includes('火') ? '火' : '土';
  const sheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  if (wxa === wxb) return '同比';
  if (sheng[wxa] === wxb || sheng[wxb] === wxa) return '生';
  if (ke[wxa] === wxb || ke[wxb] === wxa) return '克';
  return '中性';
}

/** 神煞：正缘/婚姻类（简取日支生肖桃花、孤辰寡宿映射） */
function hehunShensha(chart: BaziChart): string[] {
  const out: string[] = [];
  const dayZhi = chart.pillars[2]?.gz[1];
  if (!dayZhi) return out;
  const sx = SX(dayZhi);
  const taohua: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
  const flower = taohua[dayZhi];
  // 桃花看时支
  const hourZhi = chart.pillars[3]?.gz[1];
  if (hourZhi && flower && hourZhi === flower) out.push(`桃花（日支${dayZhi}查，时支${hourZhi}临桃花）`);
  // 孤辰寡宿：生于亥子丑年见寅为孤见戌为寡（简例：年支查）
  const yearZhi = chart.pillars[0]?.gz[1];
  if (yearZhi) {
    const gu: Record<string, string> = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
    if (dayZhi === gu[yearZhi]) out.push(`孤辰（年支${SX(yearZhi)}年生，日支见${dayZhi}` + '）');
  }
  return out;
}

/** 阴差阳错日（对婚姻有考量的神煞日） */
const YINYANG_CHACUO = new Set(['丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥']);

export function baziHehun(a: BaziChart, b: BaziChart): BaziHehunResult {
  const items: HehunItem[] = [];
  const aDay = a.pillars[2]?.gz ?? '??';
  const bDay = b.pillars[2]?.gz ?? '??';
  const aYear = a.pillars[0]?.gz ?? '??';
  const bYear = b.pillars[0]?.gz ?? '??';

  // ① 生肖（年支）
  const aSx = SX(aYear[1]), bSx = SX(bYear[1]);
  const zr = zhiRelation(aYear[1], bYear[1]);
  if (zr) {
    const good = zr.kind === '六合' || zr.kind === '三合';
    items.push({
      dimension: '生肖·年支', relation: good ? '合' : (zr.kind === '六冲' ? '冲' : '害'),
      verdict: good ? '相合' : '注意',
      detail: `${aSx}（${aYear[1]}）↔ ${bSx}（${bYear[1]}）· ${zr.note}`,
      plain: good ? `生肖相合：${zr.note}，相处气场顺。` : zr.kind === '六冲' ? `生肖六冲：${zr.note}，观念易冲突，需磨合。` : `生肖相害：${zr.note}，互损，宜多体谅。`,
    });
  } else {
    items.push({ dimension: '生肖·年支', relation: '中性', verdict: '中性', detail: `${aSx}（${aYear[1]}）↔ ${bSx}（${bYear[1]}）· 无合冲害刑`, plain: '生肖地支无刑冲合害，中性，正常交往。' });
  }

  // ② 年柱纳音
  const nyA = a.pillars[0]?.nayin ?? '';
  const nyB = b.pillars[0]?.nayin ?? '';
  const nk = nayinShengke(nyA, nyB);
  items.push({
    dimension: '年命纳音', relation: nk, verdict: nk === '生' || nk === '同比' ? '相合' : nk === '克' ? '注意' : '中性',
    detail: `男命 ${nyA} ↔ 女命 ${nyB}`,
    plain: nk === '生' ? `纳音${nyA}与${nyB}相生，传统视为恩义相加。` : nk === '同比' ? `纳音同为${nyA}，比肩同气，志趣相投。` : nk === '克' ? `纳音${nyA}与${nyB}相克，往来易有磨擦，需一方多让。` : '纳音五行非生非克（比和/无涉），中性。',
  });

  // ③ 日干五合
  const aG = aDay[0], bG = bDay[0];
  const wuhe = GAN_WUHE.find(p => (p[0] === aG && p[1] === bG) || (p[0] === bG && p[1] === aG));
  items.push({
    dimension: '日干五合', relation: wuhe ? '合' : '中性', verdict: wuhe ? '相合' : '中性',
    detail: wuhe ? `日干 ${aG} 与 ${bG} 为${wuhe[0]}${wuhe[1]}${wuhe[2] === '土' ? '（土）' : wuhe[2] === '金' ? '（金）' : wuhe[2] === '水' ? '（水）' : wuhe[2] === '木' ? '（木）' : '（火）'}之合` : `日干 ${aG} 与 ${bG} 无五合`,
    plain: wuhe ? `日干${aG}${bG}合，主性情相引、有共同语言。` : '日干无干合，感情靠后天天意磨合。',
  });

  // ④ 日支（夫妻宫）
  const dzr = zhiRelation(aDay[1], bDay[1]);
  if (dzr) {
    const good = dzr.kind === '六合' || dzr.kind === '三合';
    items.push({
      dimension: '夫妻宫（日支）', relation: good ? '合' : (dzr.kind === '六冲' ? '冲' : '害'),
      verdict: good ? '相合' : '注意',
      detail: `日支 ${aDay[1]} ↔ ${bDay[1]} · ${dzr.note}`,
      plain: good ? `夫妻宫相合（${dzr.note}），婚后生活步调较合拍。` : dzr.kind === '六冲' ? `夫妻宫相冲（${dzr.note}），观念差异大，宜建立沟通机制。` : `夫妻宫相害（${dzr.note}），易有小磨擦，互谦为宜。`,
    });
  } else {
    items.push({ dimension: '夫妻宫（日支）', relation: '中性', verdict: '中性', detail: `日支 ${aDay[1]} ↔ ${bDay[1]} · 无合冲害刑`, plain: '日支配偶宫无冲合，中性，平顺。' });
  }

  // ⑤ 用神互补：一方日主五行 → 另一方用神五行
  const aWx = GAN_FIVE[aG as keyof typeof GAN_FIVE] ?? '?';
  const bWx = GAN_FIVE[bG as keyof typeof GAN_FIVE] ?? '?';
  const aYong = new Set((a.yongShen?.favorable ?? []).map(wx => wx));
  const bYong = new Set((b.yongShen?.favorable ?? []).map(wx => wx));
  const ab = aYong.has(bWx), ba = bYong.has(aWx);
  const complement = ab || ba;
  items.push({
    dimension: '用神互补', relation: complement ? '生' : '中性', verdict: complement ? '相合' : '中性',
    detail: `男喜 ${a.yongShen?.favorable.join('、') ?? '—'}（${aWx}，日主${aG}）；女喜 ${b.yongShen?.favorable.join('、') ?? '—'}（${bWx}，日主${bG}）${ab ? `；对方日主${bWx}正是我方所喜` : ''}${ba ? `；我方日主${aWx}正是对方所喜` : ''}`,
    plain: complement ? `双方喜用与对方日主五行有呼应（${ab ? '对方补我' : ''}${ab && ba ? '、' : ''}${ba ? '我补对方' : ''}），命理上互为补益。` : '喜用与对方日主无直接互补，属普通匹配，靠经营。',
  });

  // ⑥ 五行互补（按各自五格占比）
  const rx = (c: BaziChart) => Object.entries(c.wuxingCount ?? {}).sort((x, y) => y[1] - x[1]);
  const aRank = rx(a), bRank = rx(b);
  const aMost = aRank[0]?.[0] ?? '?', bLeast = bRank.at(-1)?.[0] ?? '?';
  const bMost = bRank[0]?.[0] ?? '?', aLeast = aRank.at(-1)?.[0] ?? '?';
  const wxBetter = (aMost === bLeast && bMost === aLeast);
  items.push({
    dimension: '五行互补', relation: wxBetter ? '生' : '中性', verdict: wxBetter ? '相合' : '中性',
    detail: `男命五行：${aRank.map(([k, v]) => `${k}${v}`).join('、')}；女命五行：${bRank.map(([k, v]) => `${k}${v}`).join('、')}`,
    plain: wxBetter ? `一方最旺正是另一方最缺（男旺${aMost}↔女弱${aLeast}，女旺${bMost}↔男弱${aLeast}），互补结构清晰。` : '五行旺弱未见明显互补结构，尚可。',
  });

  // ⑦ 神煞
  const aSha = hehunShensha(a), bSha = hehunShensha(b);
  const aYC = YINYANG_CHACUO.has(a.pillars[2]?.gz ?? ''), bYC = YINYANG_CHACUO.has(b.pillars[2]?.gz ?? '');
  const shaAll = [...aSha, ...bSha];
  if (shaAll.length || aYC || bYC) {
    items.push({
      dimension: '婚姻神煞', relation: shaAll.length || aYC || bYC ? '害' : '中性', verdict: (shaAll.length || aYC || bYC) ? '注意' : '中性',
      detail: `${[...aSha, ...(aYC ? ['阴差阳错日（男）'] : [])].join('、') || '男无'} ｜ ${[...bSha, ...(bYC ? ['阴差阳错日（女）'] : [])].join('、') || '女无'}`,
      plain: (shaAll.length || aYC || bYC) ? `双方命带婚姻神煞（${[...shaAll, ...(aYC ? ['男·阴差阳错'] : []), ...(bYC ? ['女·阴差阳错'] : [])].join('、')}），传统视为需后天经营婚姻的提示，不作吉凶断言。` : '未查得孤辰寡宿/阴差阳错等婚姻神煞。',
    });
  }

  // 综合分（文化参考：各『相合』+12 分，『注意』−6 分，基准 60）
  let score = 60;
  for (const it of items) score += it.verdict === '相合' ? 12 : it.verdict === '注意' ? -6 : 0;
  score = Math.max(30, Math.min(95, score));

  const summary = `综合参考 ${score} 分。${items.filter(i => i.verdict === '相合').length} 项相合、${items.filter(i => i.verdict === '注意').length} 项需注意。合婚宜多方参看，本结果仅为文化参考项，供相处与磨合时借鉴。`;
  return { pair: { a: a.pillars.map(p => p.gz).join(' '), b: b.pillars.map(p => p.gz).join(' ') }, score, items, summary };
}

export { LIUHAI, GAN_WUHE };
