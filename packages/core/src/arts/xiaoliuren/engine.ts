/** 小六壬（P4）：月→日→时递推 + 六神细断（速断通道） */
import type { ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput, NormalizedMoment, TimingCandidate, FactBundle } from '../../config/types';
import { normalizeMoment } from '../../calendar/normalize';
import { cite } from '../../plugins/contract';

export const XLR_POSITIONS = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const;
const XLR_HOURS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export interface XiaoliurenChart {
  art: 'xiaoliuren';
  positions: Array<{ label: string; name: string; note: string }>;
  final: string; step: string; source: '月日时' | '报数';
  meaning: { jiXiong: '吉' | '凶' | '中'; text: string; detail: string };
  normalized: NormalizedMoment;
  configHash: string;
}

const DETAILS: Record<string, { jiXiong: '吉' | '凶' | '中'; text: string; detail: string }> = {
  大安: { jiXiong: '吉', text: '大安事事昌，求谋在东方', detail: '主安泰、平稳、事可成但缓慢；失物在东、南方向近处；出行平安；宜守不宜攻' },
  留连: { jiXiong: '凶', text: '留连事难成，求谋日未明', detail: '主纠缠、拖延、暗昧不明；失物难寻或向北方寻；出行有阻；防阴人小事搅扰' },
  速喜: { jiXiong: '吉', text: '速喜喜来临，求财向南行', detail: '主喜讯、快速、三日内有音信；失物可寻在南；文书消息将到' },
  赤口: { jiXiong: '凶', text: '赤口主口舌，是非切莫争', detail: '主口舌、官非、争执；不宜出行与人争辩；失物因争而失；防金属伤' },
  小吉: { jiXiong: '吉', text: '小吉最吉昌，路上好商量', detail: '主和合、顺利、有人相助；失物在东南；婚约可成；短期有成' },
  空亡: { jiXiong: '凶', text: '空亡事不祥，阴人少乖张', detail: '主落空、无果、白忙；失物难寻；求谋无成；宜静守待时' },
};

export function computeXiaoliuren(input: RawInput, cfg: ResolvedConfig, configHash: string): XiaoliurenChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  const positions: XiaoliurenChart['positions'] = [];
  let source: '月日时' | '报数' = '月日时';
  let step = '';

  let m: number, d: number, h: number;
  if (input.numbers && input.numbers.length >= 3) {
    [m, d, h] = [input.numbers[0], input.numbers[1], input.numbers[2]];
    source = '报数'; step = `报数 ${m} → ${d} → ${h}`;
  } else {
    m = Math.abs(normalized.lunar.month);
    d = Math.abs(normalized.lunar.day);
    h = normalized.hourPillar ? (((normalized.hour + 1) % 24) / 2 | 0) + 1 || 1 : 1;
    // 时辰序：子1丑2…；用实际小时映射
    h = hourSeq(normalized.hour);
    step = `农历${m}月 → ${d}日 → ${XLR_HOURS[h - 1]}时（第${h}步）`;
  }
  const walk = (n: number) => ((n - 1) % 6 + 6) % 6;
  let idx = walk(m);
  positions.push({ label: '月起', name: XLR_POSITIONS[idx], note: `农历${m}月落${XLR_POSITIONS[idx]}` });
  idx = (idx + walk(d)) % 6;
  positions.push({ label: '日落', name: XLR_POSITIONS[idx], note: `再加${d}日落${XLR_POSITIONS[idx]}` });
  idx = (idx + walk(h)) % 6;
  const final = XLR_POSITIONS[idx];
  positions.push({ label: '时落（落宫）', name: final, note: `再加${h}（时辰序）落${final}` });

  return { art: 'xiaoliuren', positions, final, step, source, meaning: DETAILS[final], normalized, configHash };
}

function hourSeq(hour: number): number {
  // 子(23,0)=1 丑(1,2)=2 寅(3,4)=3…
  const seq = hour === 23 ? 1 : Math.floor((hour + 1) / 2) + 1;
  return ((seq - 1) % 12) + 1;
}

export function xiaoliurenRules(chart: XiaoliurenChart): RuleHit[] {
  return [
    {
      ruleId: 'xiaoliuren.fall', title: `落宫：${chart.final}`,
      fact: `${chart.step} → 落「${chart.final}」。诀曰：${chart.meaning.text}`,
      level: chart.meaning.jiXiong === '吉' ? '吉' : '凶',
      citations: [cite('xiaoliuren-koujue', '小六壬口诀', '六神断', 'xiaoliuren-koujue.1.1', '大安事事昌…速喜喜来临…', 'D')],
      confidenceLevel: 'D', // 民间口诀无原典逐字对应 → D 级（D16）
    },
    {
      ruleId: 'xiaoliuren.detail', title: '细断',
      fact: chart.meaning.detail, level: chart.meaning.jiXiong === '吉' ? '吉' : '凶',
      citations: [cite('xiaoliuren-koujue', '小六壬口诀', '六神断', 'xiaoliuren-koujue.1.2', chart.meaning.text, 'D')],
      confidenceLevel: 'D',
    },
    {
      ruleId: 'xiaoliuren.chain', title: '三宫连读（月→日→时）',
      fact: `起因看月宫「${chart.positions[0]?.name}」（${chart.positions[0]?.note}），过程看日宫「${chart.positions[1]?.name}」（${chart.positions[1]?.note}），落点看时宫「${chart.positions[2]?.name}」（${chart.positions[2]?.note}）——三宫递进，先看起点、再看行进、后看结局。`,
      level: '中性',
      citations: [],
      confidenceLevel: 'D',
    },
  ];
}

export function xiaoliurenTiming(_chart: XiaoliurenChart): TimingCandidate[] {
  return [{ ruleId: 'xiaoliuren.timing.speed', text: '小六壬为速断法：应期短（当日至三日内），不宜断长期', citations: [], confidenceLevel: 'D' }];
}

export function xiaoliurenBoard(chart: XiaoliurenChart): BoardSpec {
  return {
    kind: 'grid', art: 'xiaoliuren', title: `小六壬 · 落「${chart.final}」（${chart.source}）`,
    cells: chart.positions.map((p, i) => ({ pos: i, name: p.label, extra: p.name, marks: [p.note], highlight: p.name === chart.final })),
    info: [
      { label: '落宫', value: chart.final }, { label: '吉凶', value: chart.meaning.jiXiong },
      { label: '断', value: chart.meaning.text }, { label: '细断', value: chart.meaning.detail },
      { label: '⚠ 分级', value: '小六壬口诀为民间传承，D 级「流派说法」，与原典分区展示' },
    ],
  };
}

export function xiaoliurenWarnings(): Warning[] {
  return [{ code: 'xiaoliuren/level-d', message: '小六壬口诀无原典逐字依据，全部标 D 级流派说法（绝不冒充原典）' }];
}

export function xiaoliurenEvidence(chart: XiaoliurenChart, rules: RuleHit[]): CitationRef[] {
  const out: CitationRef[] = []; const seen = new Set<string>();
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function xiaoliurenFacts(chart: XiaoliurenChart, _cat: string): FactBundle {
  return {
    facts: [
      { key: 'step', label: '递推', value: chart.step },
      { key: 'final', label: '落宫', value: `${chart.final}（${chart.meaning.jiXiong}）` },
      { key: 'text', label: '断语', value: chart.meaning.detail },
    ],
  };
}
