/** 奇门合婚引擎（hehun/qimen.ts）：以当日当时奇门盘的中宫乙庚六合落宫断婚缘。
 * 维度：① 乙奇（女方）落宫 ② 庚（男方）落宫 ③ 乙庚五行生克 ④ 六合（婚约）落宫状态
 * ⑤ 值符/值使 ⑥ 空亡/凶门凶神参考。确定性规则 + 白话；不做绝对断言。
 */
import type { QimenChart } from '../qimen/engine';

export interface QimenHehunItem {
  dimension: string;
  verdict: '相合' | '注意' | '中性';
  relation: '生' | '克' | '比和' | '中性';
  detail: string;
  plain: string;
}

export interface QimenHehunResult {
  chartDesc: string;            // 盘面概要（局/遁/时辰）
  yiPalace: string;             // 乙奇落宫
  gengPalace: string;           // 庚落宫
  liuhePalace: string;          // 六合落宫
  score: number;                // 0..100 文化参考分
  items: QimenHehunItem[];
  summary: string;
}

const GONG_WUXING: Record<number, string> = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
const GATE_GOOD = ['开', '休', '生'];
const STAR_GOOD = ['天心', '天辅', '天任', '天冲'];

/** 宫位天盘干 => 该干所代表的格位（乙/庚/六合等） */
function palaceOf(chart: QimenChart, target: string): { gong: number; cell?: (typeof chart.cells)[number] } | null {
  const cell = chart.cells.find(c => c.tianGan === target || c.diGan === target || c.god === target || c.xiaShen === target);
  return cell ? { gong: cell.gong, cell } : null;
}

function shengke(g1: number, g2: number): '生' | '克' | '比和' {
  const w1 = GONG_WUXING[g1], w2 = GONG_WUXING[g2];
  if (w1 === w2) return '比和';
  const sheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  if (sheng[w1] === w2 || sheng[w2] === w1) return '生';
  if (ke[w1] === w2 || ke[w2] === w1) return '克';
  return '比和';
}

export function qimenHehun(chart: QimenChart): QimenHehunResult {
  const items: QimenHehunItem[] = [];
  const yi = palaceOf(chart, '乙');
  const geng = palaceOf(chart, '庚');
  const lh = palaceOf(chart, '六合');

  const yiPalace = yi ? `${yi.cell!.name}（${yi.gong}宫）` : '不见乙奇';
  const gengPalace = geng ? `${geng.cell!.name}（${geng.gong}宫）` : '不见庚';
  const liuhePalace = lh ? `${lh.cell!.name}（${lh.gong}宫）` : '不见六合';

  const cellDesc = (p: { cell?: (typeof chart.cells)[number] } | null): string => {
    if (!p?.cell) return '—';
    const c = p.cell;
    return `${c.name}：星${c.star ?? '—'} 门${c.gate ?? '—'} 神${c.god ?? '—'}${c.marks?.length ? `（${c.marks.join('、')}）` : ''}`;
  };

  // ① 乙庚落宫现状
  items.push({
    dimension: '乙奇（女方）落宫', verdict: '中性', relation: '中性',
    detail: `${yiPalace} ｜ ${cellDesc(yi)}`,
    plain: yi ? `乙奇落${yi.cell!.name}。${yi.cell!.god === '六合' ? '且临六合，婚缘信号强。' : ''}${(yi.cell!.gate && GATE_GOOD.includes(yi.cell!.gate)) ? `临${yi.cell!.gate}门（吉门）。` : ''}` : '盘中不见乙奇，按普通参考。',
  });
  items.push({
    dimension: '庚（男方）落宫', verdict: '中性', relation: '中性',
    detail: `${gengPalace} ｜ ${cellDesc(geng)}`,
    plain: geng ? `庚落${geng.cell!.name}。${(geng.cell!.gate && GATE_GOOD.includes(geng.cell!.gate)) ? `临${geng.cell!.gate}门（吉门）。` : ''}` : '盘中不见庚，按普通参考。',
  });

  // ② 乙庚生克
  if (yi && geng) {
    const sk = shengke(yi.gong, geng.gong);
    items.push({
      dimension: '乙庚宫位生克', relation: sk, verdict: sk === '生' || sk === '比和' ? '相合' : '注意',
      detail: `乙落${yi.gong}宫（${GONG_WUXING[yi.gong]}）↔ 庚落${geng.gong}宫（${GONG_WUXING[geng.gong]}）；${sk === '生' ? `乙（${GONG_WUXING[yi.gong]}）与庚（${GONG_WUXING[geng.gong]}）相生` : sk === '比和' ? '五行比和' : `乙（${GONG_WUXING[yi.gong]}）与庚（${GONG_WUXING[geng.gong]}）相克`}`,
      plain: sk === '生' ? '乙庚落宫相生，感情互引，顺遂。' : sk === '比和' ? '乙庚五行比和，相处气场一致。' : '乙庚落宫相克，须留心意气相争，互相包容可解。',
    });
  } else {
    items.push({ dimension: '乙庚宫位生克', relation: '中性', verdict: '中性', detail: '乙/庚未同盘同现', plain: '乙或庚不明，参考有限。' });
  }

  // ③ 六合（婚约/媒人）
  if (lh) {
    const c = lh.cell!;
    const goodGate = c.gate && GATE_GOOD.includes(c.gate);
    const goodStar = c.star && STAR_GOOD.includes(c.star);
    const kong = c.marks?.some(m => m.includes('空')) ?? false;
    items.push({
      dimension: '六合（婚约/媒人）', relation: goodGate || goodStar ? '生' : kong ? '克' : '中性',
      verdict: kong ? '注意' : (goodGate || goodStar) ? '相合' : '中性',
      detail: `${liuhePalace} ｜ ${cellDesc(lh)}${kong ? '（六合逢空）' : ''}`,
      plain: kong ? `六合落${c.name}逢空亡，婚姻事宜宜缓图、防反复。` : goodGate || goodStar ? `六合落${c.name}，临${[c.gate, c.star].filter(Boolean).join('、')}（吉格局），婚约顺利信号。` : `六合落${c.name}，格局平常，谈婚论嫁顺其自然。`,
    });
  } else {
    items.push({ dimension: '六合（婚约/媒人）', relation: '中性', verdict: '中性', detail: '盘中不见六合', plain: '未见六合，婚事参考一般。' });
  }

  // ④ 值符/值使 状态
  const zhifu = chart.cells.find(c => c.isZhifuStar);
  const zhishi = chart.cells.find(c => c.isZhishiGate);
  items.push({
    dimension: '值符/值使', relation: '中性', verdict: '中性',
    detail: `值符星${zhifu?.star ?? chart.zhifuStar}落${zhifu?.name ?? '—'}；值使门${zhishi?.gate ?? chart.zhifuGate}落${zhishi?.name ?? '—'}`,
    plain: '值符值使为盘面主事，吉门吉星所在即当下最顺方位，谈婚事可参考。',
  });

  // ⑤ 丁/丙（第三者信号，简明提示）
  const ding = palaceOf(chart, '丁');
  const bing = palaceOf(chart, '丙');
  if (ding && geng) {
    const sk = shengke(ding.gong, geng.gong);
    if (sk === '生' || sk === '比和') items.push({ dimension: '丁（第三方信号）', relation: '克', verdict: '注意', detail: `丁落${ding.cell!.name}与庚（${geng.cell!.name}）相${sk === '生' ? '生/比' : '近'}`, plain: '丁（第三方女性信号）与庚邻近，传统引申为介入可能（文化参考，不作定论）。' });
  }
  if (bing && yi) {
    const sk = shengke(bing.gong, yi.gong);
    if (sk === '生' || sk === '比和') items.push({ dimension: '丙（第三方信号）', relation: '克', verdict: '注意', detail: `丙落${bing.cell!.name}与乙（${yi.cell!.name}）相${sk === '生' ? '生/比' : '近'}`, plain: '丙（第三方男性信号）与乙邻近，传统引申为介入可能（文化参考，不作定论）。' });
  }

  let score = 60;
  for (const it of items) score += it.verdict === '相合' ? 12 : it.verdict === '注意' ? -6 : 0;
  score = Math.max(30, Math.min(95, score));

  const summary = `综合参考 ${score} 分。${items.filter(i => i.verdict === '相合').length} 项相合、${items.filter(i => i.verdict === '注意').length} 项需注意。奇门合婚以「乙（女）·庚（男）·六合（婚约）」三宫生克为主，结合盘面吉星吉门；结果供文化参考，情感贵在共处经营。`;
  return {
    chartDesc: `${chart.timeType === 'shi' ? '时家' : '日家'}·${chart.yinYang}${chart.ju}局·${chart.panType === 'fei' ? '飞盘' : '转盘'}（${chart.dayPillar}日 ${chart.hourPillar}时）`,
    yiPalace, gengPalace, liuhePalace, score, items, summary,
  };
}