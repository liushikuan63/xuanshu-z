/** 梅花易数（P2）：时间/报数/字占起卦、体用生克、互卦变卦、万物类象 */
import {
  type ResolvedConfig, type RuleHit, type BoardSpec, type Warning, type CitationRef, type RawInput,
  type NormalizedMoment, type TimingCandidate, type FactBundle,
} from '../../config/types';
import { cite } from '../../plugins/contract';
import { normalizeMoment } from '../../calendar/normalize';
import { DI_ZHI } from '../../calendar/ganzhi';
import { TRIGRAMS, SHU_TO_TRIGRAM, guaByBin } from '../liuyao/data';

export interface MeihuaChart {
  art: 'meihua';
  method: string; detail: string;
  guaName: string; bin: string;
  upper: string; lower: string;      // 卦名（三爻卦）
  movingIdx: number;                 // 0..5
  tiTrigram: string; yongTrigram: string; tiSide: '上' | '下';
  tiWx: string; yongWx: string;
  relation: string;                  // 体用生克
  auspiciousness: '吉' | '凶' | '中';
  huGuaName: string; bianGuaName: string; cuoGuaName: string; xzGuaName: string;
  huWx: string; bianWx: string;
  xiangs: string[];                  // 类象提示
  waiYing?: string;
  normalized: NormalizedMoment;
  configHash: string;
}

const WX_OF_TRI: Record<string, string> = { 乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土' };

/** 《梅花易数》八卦万物类象（节选） */
const WANWU_LEIXIANG: Record<string, { guade: string; renwu: string; shenti: string; dongwu: string; tianxiang: string; qiwu: string; changsuo: string; shiqing: string }> = {
  乾: { guade: '刚健', renwu: '君父、大人、老人、长官', shenti: '首、骨、肺', dongwu: '马、龙、狮、象', tianxiang: '天、冰、雹、霰', qiwu: '金玉、珠宝、圆物、木果、冠', changsuo: '京都、大郡、形胜之地、高亢之所', shiqing: '健、决、威严、活动' },
  兑: { guade: '悦', renwu: '少女、妾、歌妓、伶人、译人', shenti: '舌、口、肺、痰、涎', dongwu: '羊、泽中之物', tianxiang: '雨泽、新月、星', qiwu: '金刃、金类、乐器、废缺之物、带口之器', changsuo: '泽、水际、缺池、废井、山崩破裂之地', shiqing: '喜、口舌、毁谤、饮食' },
  离: { guade: '丽', renwu: '中女、文人、大腹人、目疾人、兵甲之人', shenti: '目、心、上焦', dongwu: '雉、龟、鳖、蟹、螺、蚌', tianxiang: '日、电、虹、霓、霞', qiwu: '火、文书、干戈、干燥之物、赤色之物', changsuo: '南方、干亢之地、窑灶、刚燥厥地、阳明之域', shiqing: '文明、虚心、美丽、明察' },
  震: { guade: '动', renwu: '长男、行人、警卒、军人、声音大者', shenti: '足、肝、发、声音', dongwu: '龙、蛇、善鸣之物', tianxiang: '雷、雷雨', qiwu: '木、竹、萑苇、乐器（属木者）、花草繁鲜之物', changsuo: '东方、树木、闹市、大途、竹林草木茂盛之地', shiqing: '奋起、惊、怒、躁动' },
  巽: { guade: '入', renwu: '长女、秀士、寡妇、山林仙道之人、僧道', shenti: '股、肱、气、风疾', dongwu: '鸡、百禽、山林中之禽虫', tianxiang: '风、云、雾', qiwu: '木香、绳、直物、长物、竹木、工巧之器', changsuo: '东南方、草木茂秀之地、花果园、菜园', shiqing: '柔和、不定、鼓舞、利市三倍' },
  坎: { guade: '陷', renwu: '中男、江湖人、舟人、盗贼、酒徒', shenti: '耳、血、肾、膀胱', dongwu: '豕、鱼、水中之物', tianxiang: '月、雨、雪、露、霜、水', qiwu: '水、酒、器皿、酒具、有核之物、水中之物', changsuo: '北方、江湖、溪涧、泉井、卑湿之地、酒肆茶房', shiqing: '险、陷、隐伏、外柔内刚' },
  艮: { guade: '止', renwu: '少男、闲人、山中人、童子', shenti: '手、指、骨、鼻、背', dongwu: '虎、狗、鼠、百兽、黔喙之属', tianxiang: '云、雾、山岚', qiwu: '土石、瓜果、黄色之物、土中之物、门阙', changsuo: '东北方、山径、近山城、丘陵、坟墓', shiqing: '阻止、笃实、保守、固执' },
  坤: { guade: '顺', renwu: '母、老妇、农人、众人、大腹人', shenti: '腹、脾、肉、胃', dongwu: '牛、牝马、百兽', tianxiang: '阴云、雾气、冰霜', qiwu: '方物、柔物、布帛、丝绵、五谷、舆釜、瓦器', changsuo: '西南方、平原、田野、乡里、矮屋、土阶', shiqing: '柔顺、静、厚、载物' },
};

function strokeCount(text: string): number {
  // cnchar 返回数组；繁体取简体笔画（字占需明示繁简）
  try {
    const cnchar = (globalThis as never as { cnchar?: { stroke: (s: string) => number[] } }).cnchar;
    if (cnchar?.stroke) {
      const arr = cnchar.stroke(text.split('')[0]);
      if (arr && arr[0] > 0) return arr[0];
    }
  } catch { /* 忽略，走回退 */ }
  return 0;
}

export function computeMeihua(input: RawInput, cfg: ResolvedConfig, configHash: string): MeihuaChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  let method = input.method ?? 'time';
  let upper = '', lower = '', movingIdx = 0, detail = '';

  if (input.method === 'text' && input.text) {
    // 字占：两字以上按平分笔画；一字取笔画为卦
    const chars = input.text.replace(/\s/g, '').split('');
    const counts = chars.map(c => strokeCount(c) || 1);
    const total = counts.reduce((s, c) => s + c, 0);
    if (chars.length === 1) {
      upper = SHU_TO_TRIGRAM[((total - 1) % 8) + 1];
      lower = upper;
      movingIdx = ((total - 1) % 6);
    } else {
      const half = Math.ceil(chars.length / 2);
      const s1 = counts.slice(0, half).reduce((a, b) => a + b, 0);
      const s2 = counts.slice(half).reduce((a, b) => a + b, 0);
      upper = SHU_TO_TRIGRAM[((s1 - 1) % 8) + 1];
      lower = SHU_TO_TRIGRAM[((s2 - 1) % 8) + 1];
      movingIdx = ((total - 1) % 6);
    }
    method = '字占'; detail = `「${input.text}」笔画合计 ${total}`;
  } else if (input.numbers && input.numbers.length >= 2) {
    const [n1, n2] = input.numbers;
    upper = SHU_TO_TRIGRAM[((n1 - 1) % 8) + 1];
    lower = SHU_TO_TRIGRAM[((n2 - 1) % 8) + 1];
    const mv = input.numbers.length >= 3 ? ((input.numbers[2] - 1) % 6) : (((n1 + n2 - 1) % 6));
    movingIdx = ((mv % 6) + 6) % 6;
    method = '报数'; detail = `报数 ${input.numbers.join('、')}`;
  } else if (input.hexagram) {
    const upName = typeof input.hexagram.upper === 'number' ? SHU_TO_TRIGRAM[input.hexagram.upper % 8] : String(input.hexagram.upper);
    const loName = typeof input.hexagram.lower === 'number' ? SHU_TO_TRIGRAM[input.hexagram.lower % 8] : String(input.hexagram.lower);
    upper = upName; lower = loName;
    movingIdx = input.hexagram.moving ? input.hexagram.moving - 1 : 0;
    method = '手动指定'; detail = `指定卦体`;
  } else {
    // 时间卦
    const yZhi = DI_ZHI.indexOf(normalized.yearPillar[1]) + 1;
    const hZhi = normalized.hourPillar ? DI_ZHI.indexOf(normalized.hourPillar[1]) + 1 : 1;
    const sum = yZhi + normalized.lunar.month + normalized.lunar.day;
    const upN = ((sum - 1) % 8) + 1;
    const total = sum + hZhi;
    const loN = ((total - 1) % 8) + 1;
    upper = SHU_TO_TRIGRAM[upN]; lower = SHU_TO_TRIGRAM[loN];
    movingIdx = ((total - 1) % 6);
    method = '时间卦';
    detail = `年${yZhi}+月${normalized.lunar.month}+日${normalized.lunar.day}=${sum}→上卦${upper}；+时${hZhi}=${total}→下卦${lower}，动爻第${movingIdx + 1}爻`;
  }

  const bin = TRIGRAMS[lower] + TRIGRAMS[upper];
  const guaName = guaByBin(bin)?.name ?? '未知';
  const tiSide: '上' | '下' = movingIdx >= 3 ? '下' : '上'; // 动爻在上卦→上为用，下为体
  const tiTrigram = tiSide === '上' ? upper : lower;
  const yongTrigram = tiSide === '上' ? lower : upper;
  const tiWx = WX_OF_TRI[tiTrigram], yongWx = WX_OF_TRI[yongTrigram];

  const order = ['木', '火', '土', '金', '水'];
  const sheng = (a: string, b: string) => (order.indexOf(a) + 1) % 5 === order.indexOf(b);
  const ke = (a: string, b: string) => (order.indexOf(a) + 2) % 5 === order.indexOf(b);
  let relation: string, auspiciousness: MeihuaChart['auspiciousness'];
  if (sheng(yongWx, tiWx)) { relation = '用生体（大吉）'; auspiciousness = '吉'; }
  else if (ke(tiWx, yongWx)) { relation = '体克用（小吉）'; auspiciousness = '吉'; }
  else if (tiWx === yongWx) { relation = '体用比和（吉）'; auspiciousness = '吉'; }
  else if (sheng(tiWx, yongWx)) { relation = '体生用（耗损，主有耗失之患）'; auspiciousness = '中'; }
  else { relation = '用克体（凶，主受制受损）'; auspiciousness = '凶'; }

  // 互卦（2,3,4 爻为下；3,4,5 爻为上）、变卦
  const huLower = bin[1] + bin[2] + bin[3], huUpper = bin[2] + bin[3] + bin[4];
  const huGuaName = guaByBin(huLower + huUpper)?.name ?? '未知';
  const newBits = bin.split(''); newBits[movingIdx] = newBits[movingIdx] === '1' ? '0' : '1';
  const bianBin = newBits.join('');
  const bianGuaName = guaByBin(bianBin)?.name ?? '未知';
  const cuoGuaName = guaByBin(bin.split('').map(bit => bit === '1' ? '0' : '1').join(''))?.name ?? '未知';
  const xzGuaName = guaByBin(bin.split('').reverse().join(''))?.name ?? '未知';
  const huWx = WX_OF_TRI[trigramOf(huLower)], bianWx = WX_OF_TRI[trigramOf(bianBin.slice(0, 3))];

  const xiangs = [tiTrigram, yongTrigram, trigramOf(huLower), trigramOf(bianBin.slice(3, 6))].map(t =>
    `${t}：${WANWU_LEIXIANG[t].renwu.split('、')[0]}｜${WANWU_LEIXIANG[t].qiwu.split('、').slice(0, 2).join('、')}｜${WANWU_LEIXIANG[t].changsuo.split('、')[0]}`);

  return {
    art: 'meihua', method, detail, guaName, bin, upper, lower, movingIdx,
    tiTrigram, yongTrigram, tiSide, tiWx, yongWx, relation, auspiciousness,
    huGuaName, bianGuaName, cuoGuaName, xzGuaName, huWx, bianWx, xiangs, waiYing: (input as { waiYing?: string }).waiYing,
    normalized, configHash,
  };
}

function trigramOf(bin3: string): string {
  for (const [n, b] of Object.entries(TRIGRAMS)) if (b === bin3) return n;
  return '坤';
}

const C_MHS_ALIAS: Record<string,string> = {
  '体用总诀': '卷二', '体用互变之诀': '卷二', '八卦万物类占': '卷一', '万物类象': '卷一',
  '三要灵应篇': '卷一', '卦数期例': '卷一', '占断总诀': '卷三', '十应诀': '卷三',
};
const C_MHS = (ch0: string) => {
  const ch = C_MHS_ALIAS[ch0] ?? ch0;
  return cite('meihua', '梅花易数', ch, `meihua.${ch}`, '（《梅花易数》原典回链，见书阁）', 'A');
};

export function meihuaRules(chart: MeihuaChart): RuleHit[] {
  const hits: RuleHit[] = [];
  hits.push({
    ruleId: 'meihua.tiyong', title: '体用生克',
    fact: `上卦${chart.upper}、下卦${chart.lower}，动爻在第${chart.movingIdx + 1}爻（${chart.tiSide}卦）→ 体为${chart.tiTrigram}（${chart.tiWx}），用为${chart.yongTrigram}（${chart.yongWx}）。${chart.relation}`,
    level: chart.auspiciousness === '吉' ? '吉' : chart.auspiciousness === '凶' ? '凶' : '变数',
    citations: [C_MHS('体用总诀')], confidenceLevel: 'A',
  });
  hits.push({
    ruleId: 'meihua.hugua', title: '互卦（事之中间）',
    fact: `互卦${chart.huGuaName}（${chart.huWx}）：中间过程之象${shengOr(chart.huWx, chart.tiWx)}`,
    level: '变数', citations: [C_MHS('体用互变之诀')], confidenceLevel: 'A',
  });
  hits.push({
    ruleId: 'meihua.biangua', title: '变卦（事之终应）',
    fact: `变卦${chart.bianGuaName}（${chart.bianWx}）：事之结局之象${shengOr(chart.bianWx, chart.tiWx)}`,
    level: '变数', citations: [C_MHS('体用互变之诀')], confidenceLevel: 'A',
  });
  hits.push({
    ruleId: 'meihua.leixiang', title: '万物类象（取象提示）',
    fact: chart.xiangs.join('；'), level: '中性', citations: [C_MHS('八卦万物类占')], confidenceLevel: 'A',
  });
  if (chart.waiYing) {
    hits.push({
      ruleId: 'meihua.waiying', title: '外应',
      fact: `外应：${chart.waiYing}（三要十应：闻言听声、观人察物皆可为占）`, level: '变数',
      citations: [C_MHS('三要灵应篇')], confidenceLevel: 'A',
    });
  }
  return hits;
}
function shengOr(hu: string, ti: string): string {
  const order = ['木', '火', '土', '金', '水'];
  if (hu === ti) return '，与体比和';
  if ((order.indexOf(hu) + 1) % 5 === order.indexOf(ti)) return '，生体助势';
  if ((order.indexOf(ti) + 2) % 5 === order.indexOf(hu)) return '，体克之可制';
  if ((order.indexOf(hu) + 2) % 5 === order.indexOf(ti)) return '，克体为忌';
  return '，体生之有耗';
}

export function meihuaTiming(chart: MeihuaChart): TimingCandidate[] {
  // 梅花应期：体卦旺相之期、用卦值日、卦数之期（坤8/兑2…）
  const num = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 } as Record<string, number>;
  const tiN = num[chart.tiTrigram], yongN = num[chart.yongTrigram];
  return [
    { ruleId: 'meihua.timing.guashu', text: `卦数之期：本卦数 ${num[chart.upper] + num[chart.lower]}（或体${tiN}用${yongN}之和）日/月`, window: '速断之数', citations: [C_MHS('卦数期例')], confidenceLevel: 'B' },
    { ruleId: 'meihua.timing.tiwang', text: `体卦${chart.tiWx}旺相之季（${tiWang(chart.tiWx)}）为应`, window: '季节', citations: [C_MHS('体用总诀')], confidenceLevel: 'A' },
  ];
}
function tiWang(wx: string): string {
  return ({ 木: '春（寅卯月/日）', 火: '夏（巳午月/日）', 土: '四季月（辰戌丑未）', 金: '秋（申酉月/日）', 水: '冬（亥子月/日）' } as Record<string, string>)[wx];
}

export function meihuaBoard(chart: MeihuaChart): BoardSpec {
  return {
    kind: 'plate', art: 'meihua',
    title: `${chart.guaName}${chart.method === '时间卦' ? '' : '（' + chart.method + '）'}`,
    info: [
      { label: '起卦', value: `${chart.method}${chart.detail ? '：' + chart.detail : ''}` },
      { label: '体用', value: `体${chart.tiTrigram}（${chart.tiWx}）｜用${chart.yongTrigram}（${chart.yongWx}）→ ${chart.relation}` },
      { label: '互卦', value: `${chart.huGuaName}（${chart.huWx}）` },
      { label: '变卦', value: `${chart.bianGuaName}（${chart.bianWx}）` },
      { label: '断', value: chart.auspiciousness },
    ],
    badges: [`${chart.upper}上`, `${chart.lower}下`, `动${chart.movingIdx + 1}`, `${chart.tiSide}卦为用`],
    cells: [],
  };
}

export function meihuaWarnings(chart: MeihuaChart): Warning[] {
  const w: Warning[] = [];
  if (chart.method === '字占') w.push({ code: 'meihua/stroke', message: '字占笔画数依赖内置字表，生僻字可能不准确，请人工核对笔画' });
  return w;
}

export function meihuaEvidence(chart: MeihuaChart, rules: RuleHit[]): CitationRef[] {
  const seen = new Set<string>(); const out: CitationRef[] = [];
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function meihuaFacts(chart: MeihuaChart, _cat: string): FactBundle {
  return {
    facts: [
      { key: 'gua', label: '本卦', value: chart.guaName },
      { key: 'tiyong', label: '体用', value: `体${chart.tiTrigram}(${chart.tiWx}) 用${chart.yongTrigram}(${chart.yongWx})：${chart.relation}` },
      { key: 'hu', label: '互卦', value: `${chart.huGuaName}(${chart.huWx})` },
      { key: 'bian', label: '变卦', value: `${chart.bianGuaName}(${chart.bianWx})` },
      { key: 'dongyao', label: '动爻', value: `第${chart.movingIdx + 1}爻` },
    ],
  };
}

export { WANWU_LEIXIANG };
