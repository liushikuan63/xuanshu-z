/**
 * 日家奇门（R-奇门扩充）：以太乙排局法为核心（《神奇之门》所载太乙法），
 * 以「日」为单位起局，专用于择日/一日吉凶的大方向指导。
 *
 * 与时家奇门六大差异（日家五异 + 体系不同）：
 *  1. 不用时家十八局，以「洛书九宫 + 阴阳遁」直接按日柱演局，共 120 局（60 日 × 阴阳二遁）；
 *  2. 九星不同：太乙、摄提、轩辕、招摇、天符、青龙、咸池、太阴、天乙（九星飞布，一日一宫）；
 *  3. 八门以「休门三日一宫」起排：阳日顺排、阴日逆排，三日用一门（不涉中五）；
 *  4. 分十二黑黄道（十二时将神），看某日中十二时辰的吉凶；
 *  5. 论「喜神方位」「天乙贵人」；时家奇门不论；
 *  6. 忌五不遇时（时干克日干）。
 * 说明：月家/年家奇门各有独立演局法，本库暂不内置（缺公开黄金样本，标「资料不足」）。
 */
import type { RawInput, ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, TimingCandidate, FactBundle, BoardCell } from '../../config/types';
import { normalizeMoment } from '../../calendar/normalize';
import { ganzhiIndex, TIAN_GAN, DI_ZHI } from '../../calendar/ganzhi';
import { jieqiOfDay, GONG_NAMES, YANG_JIE } from './engine';

export const RI_NINE_STARS = ['太乙', '摄提', '轩辕', '招摇', '天符', '青龙', '咸池', '太阴', '天乙'] as const;
/** 日家九星吉凶：太乙/青龙/太阴/天乙 大吉；摄提/招摇/咸池 凶；轩辕/天符 中平 */
export const RI_STAR_LEVEL: Record<string, '吉' | '凶' | '平'> = {
  太乙: '吉', 摄提: '凶', 轩辕: '平', 招摇: '凶', 天符: '平', 青龙: '吉', 咸池: '凶', 太阴: '吉', 天乙: '吉',
};
const BAGUA_GATE_ORDER = ['休', '生', '伤', '杜', '景', '死', '惊', '开'] as const;
/** 洛书顺行宫序（日家排八门用，跳过中五：即 1→2→3→4→6→7→8→9 与引擎 CW 等价表达不同） */
const GONG_SEQ = [1, 2, 3, 4, 6, 7, 8, 9] as const;
/** 阳遁休门宫序：坎一→坤二→震三→巽四→乾六→兑七→艮八→离九（三日一移，不入中五） */
const XIU_YANG = [1, 2, 3, 4, 6, 7, 8, 9] as const;
/** 阴遁休门宫序：离九→艮八→兑七→乾六→巽四→震三→坤二→坎一 */
const XIU_YIN = [9, 8, 7, 6, 4, 3, 2, 1] as const;
/** 十二黑黄道（本日时辰吉凶）：青龙·明堂·金匮·天德·玉堂·司命为黄道，余为黑道 */
export const HEI_HUANG_DAO = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'] as const;
export const HUANG_DAO = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
/** 日支 → 青龙所起时辰支（《玉匣记》十二黄道口诀） */
const QING_LONG_SHICHEN: Record<string, string> = { 子: '申', 午: '申', 卯: '寅', 酉: '寅', 寅: '子', 申: '子', 巳: '午', 亥: '午', 辰: '辰', 戌: '辰', 丑: '戌', 未: '戌' };
/** 喜神方位（指日，《吉神方歌》）：甲己艮、乙庚乾、丙辛坤、丁壬离、戊癸巽（卦宫位描述另见方位） */
export const XI_SHEN_FANG: Record<string, string> = { 甲: '艮（东北）', 己: '艮（东北）', 乙: '乾（西北）', 庚: '乾（西北）', 丙: '坤（西南）', 辛: '坤（西南）', 丁: '离（正南）', 壬: '离（正南）', 戊: '巽（东南）', 癸: '巽（东南）' };
/** 天乙贵人（日家）：甲戊庚牛羊、乙己鼠猴乡、丙丁猪鸡位、壬癸兔蛇藏、六辛逢虎马 */
const GUI_REN: Record<string, string[]> = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'] };

export interface QimenDayCell {
  gong: number;            // 1..9
  name: string;            // 宫名
  gate?: string;           // 八门（本日）
  star?: string;           // 日家九星（本日太乙局）
  dao?: string;            // 十二黑黄道（当前时辰）
  marks: string[];         // 吉星/吉门等标记
  extra?: string;
}

export interface QimenDayChart {
  art: 'qimen';
  timeType: 'ri';
  yinYang: '阳遁' | '阴遁';
  jieqi: string;
  dayPillar: string;       // 日柱
  dayIndex: number;        // 六十甲子序（0=甲子）
  xiuMenGong: number;      // 本日休门宫
  taiYiGong: number;       // 太乙本日宫
  cells: QimenDayCell[];
  /** 十二黑黄道：当前时辰 → 值时神 */
  currentDao: { shichen: string; shen: string; kind: '黄道' | '黑道' };
  xiShen: string;          // 喜神方位
  guiRen?: string;         // 天乙贵人方向（若有）
  wuBuYu: boolean;         // 是否五不遇时
  hourPillar: string;
  patterns: string[];
  normalized: ReturnType<typeof normalizeMoment>;
  configHash: string;
}

/** 太乙九星飞布：以太乙宫为起点，阳遁按 8→9→1→2→3→4→5→6→7 顺飞、阴遁按 …逆飞。
 *  太乙本日宫 = 阳遁 ? FEI_YANG[dayIndex%9] : FEI_YIN[dayIndex%9]（甲子/甲午…锚点经实测与《金函玉镜》歌诀一致） */
const FEI_YANG = [8, 9, 1, 2, 3, 4, 5, 6, 7] as const;
const FEI_YIN = [2, 1, 9, 8, 7, 6, 5, 4, 3] as const;

function dayGate(row: QimenDayCell[], g: number) { return row.find(c => c.gong === g); }

export function computeQimenDay(input: RawInput, cfg: ResolvedConfig, configHash: string): QimenDayChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  const dayPillar = normalized.dayPillar;
  const dayIndex = ganzhiIndex(dayPillar);
  const dayGan = dayPillar[0];
  const dayZhi = dayPillar[1];
  const hourPillar = normalized.hourPillar;
  const hourZhi = hourPillar[1];
  const { jieqi } = jieqiOfDay(normalized.jdn);
  const yang = YANG_JIE.includes(jieqi); // 冬至→芒种 阳遁；夏至→大雪 阴遁

  // 1) 休门三日一宫
  const xiuMenGong = (yang ? XIU_YANG : XIU_YIN)[Math.floor(dayIndex / 3) % 8];

  // 2) 布八门：休门起、阳日顺布、阴日逆布（不涉中五）
  const yangDay = TIAN_GAN.indexOf(dayGan as never) % 2 === 0; // 甲丙戊庚壬=阳
  const gateRow: QimenDayCell[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => ({ gong: g, name: GONG_NAMES[g - 1], marks: [] }));
  {
    const startIdx = GONG_SEQ.indexOf(xiuMenGong as never);
    for (let i = 0; i < 8; i++) {
      const gi = yangDay ? (startIdx + i) % 8 : ((startIdx - i) % 8 + 8) % 8;
      const gong = GONG_SEQ[gi];
      dayGate(gateRow, gong)!.gate = BAGUA_GATE_ORDER[i] + '门';
    }
  }

  // 3) 日家九星：一日一宫，太乙为头，依飞序落九宫
  const feiSeq = yang ? FEI_YANG : FEI_YIN;
  const taiYiGong = feiSeq[dayIndex % 9];
  const starRow: QimenDayCell[] = gateRow.map(c => ({ ...c, star: undefined }));
  for (let i = 0; i < 9; i++) {
    const gong = feiSeq[(feiSeq.indexOf(taiYiGong) + i) % 9];
    (starRow.find(c => c.gong === gong)! as QimenDayCell).star = RI_NINE_STARS[i];
  }

  // 4) 十二黑黄道（当前时辰）
  const qingLongZhi = QING_LONG_SHICHEN[dayZhi] ?? '子';
  const startIdx = DI_ZHI.indexOf(qingLongZhi as never);
  const curIdx = DI_ZHI.indexOf(hourZhi as never);
  const curShen = HEI_HUANG_DAO[((curIdx - startIdx) % 12 + 12) % 12];
  const currentDao = { shichen: hourZhi + '时', shen: curShen, kind: (HUANG_DAO.has(curShen) ? '黄道' : '黑道') as '黄道' | '黑道' };

  // 5) 喜神方位 + 天乙贵人
  const xiShen = XI_SHEN_FANG[dayGan];
  const guiRenZhis = GUI_REN[dayGan] ?? [];
  const guiRen = guiRenZhis.length ? guiRenZhis.join('/') : undefined;
  // 6) 五不遇时：时干克日干（阳克阳/阴克阴）
  const hourGan = hourPillar[0];
  const wuBuYu = isWuBuYu(dayGan, hourGan);

  // 集合盘面
  const cells: QimenDayCell[] = starRow.map(c => {
    const marks: string[] = [];
    const gate = c.gate?.slice(0, 1) ?? '';
    if (['休', '生', '开'].includes(gate)) marks.push('吉门');
    if (c.star && RI_STAR_LEVEL[c.star] === '吉') marks.push('吉星');
    if (c.star === '太乙' || c.gate === '休门') marks.push('太乙');
    return { ...c, marks: marks.filter((m, i, a) => a.indexOf(m) === i), extra: `${c.gate ?? '—'}·${c.star ?? '—'}` };
  });

  const patterns: string[] = [];
  if (wuBuYu) patterns.push('五不遇时（时干克日干）：百事不宜，主事多阻滞');
  if (currentDao.kind === '黄道') patterns.push(`当前时辰为${currentDao.shen}（黄道）：时辰吉，可择时行事`);
  else patterns.push(`当前时辰为${currentDao.shen}（黑道）：时辰凶，宜避`);
  const jiStars = cells.filter(c => c.star && RI_STAR_LEVEL[c.star] === '吉').map(c => c.star);
  if (jiStars.length) patterns.push(`日家吉星：${[...new Set(jiStars)].join('、')}落宫——太乙主求财万事通、青龙主觅利喜重重、太阴主暗财丰、天乙主贵人宜酒食；本日凡吉星所在之方，皆可借势。`);

  return {
    art: 'qimen', timeType: 'ri', yinYang: yang ? '阳遁' : '阴遁', jieqi,
    dayPillar, dayIndex, xiuMenGong, taiYiGong, cells, currentDao, xiShen, guiRen, wuBuYu,
    hourPillar, patterns, normalized, configHash,
  };
}

/** 五不遇时：时干与日干五行相克且阴阳相同（阳克阳/阴克阴） */
export function isWuBuYu(dayGan: string, hourGan: string): boolean {
  const T = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const di = T.indexOf(dayGan), hi = T.indexOf(hourGan);
  if (di < 0 || hi < 0) return false;
  if ((di % 2) !== (hi % 2)) return false;          // 阴阳须相同
  const order = ['木', '火', '土', '金', '水'];
  const d = WX[di], h = WX[hi];
  return (order.indexOf(h) + 2) % 5 === order.indexOf(d); // 时干克日干
}

export function qimenDayRules(chart: QimenDayChart, _cfg: ResolvedConfig): RuleHit[] {
  const hits: RuleHit[] = [];
  const { yinYang, jieqi } = chart;
  hits.push({
    ruleId: 'qimen.ri.pan', title: '日家定局',
    fact: `日家奇门（太乙法）：${chart.dayPillar}日（六十甲子第 ${chart.dayIndex}），${jieqi}后 ${yinYang}，本日休门起于${GONG_NAMES[chart.xiuMenGong - 1]}，太乙落${GONG_NAMES[chart.taiYiGong - 1]}。`,
    level: '中性', citations: [], confidenceLevel: 'D',
  });
  for (const c of chart.cells) {
    if (c.marks.includes('吉门') && c.marks.includes('吉星')) {
      hits.push({ ruleId: 'qimen.ri.demen', title: `日家吉格：${c.name}得门得星`,
        fact: `${c.name}：${c.gate} + ${c.star}——吉门（休/生/开）合吉星（太乙/青龙/太阴/天乙），主本日此向/此时行事顺遂，是日家最吉之组合。`,
        level: '吉', citations: [], confidenceLevel: 'D', target: c.name });
    }
  }
  hits.push({
    ruleId: 'qimen.ri.huangdao', title: `时辰${chart.currentDao.kind}：${chart.currentDao.shen}`,
    fact: `${chart.currentDao.shichen}（${chart.hourPillar}时），日家十二黑黄道值${chart.currentDao.shen}，属${chart.currentDao.kind}。${chart.currentDao.kind === '黄道' ? '黄道为吉时，利于出行/谋事/赴约' : '黑道为凶时，宜避不宜动（青龙/明堂/金匮/天德/玉堂/司命为黄道，余为黑道）'}。`,
    level: chart.currentDao.kind === '黄道' ? '吉' : '凶', citations: [], confidenceLevel: 'D',
  });
  hits.push({
    ruleId: 'qimen.ri.xishen', title: '喜神方位',
    fact: `${chart.dayPillar}日喜神在${chart.xiShen}。日家出行/求财/赴宴宜向喜神方。${chart.guiRen ? `天乙贵人在${chart.guiRen}（贵人方亦吉）。` : ''}`,
    level: '吉', citations: [], confidenceLevel: 'D',
  });
  if (chart.wuBuYu) hits.push({
    ruleId: 'qimen.ri.wubuyu', title: '五不遇时（忌）',
    fact: `${chart.hourPillar}时干克日干，犯五不遇时——时家/日家皆忌，凡事不利，宜另择时。`,
    level: '凶', citations: [], confidenceLevel: 'D',
  });
  return hits;
}

export function qimenDayBoard(chart: QimenDayChart): BoardSpec {
  const cells: BoardCell[] = chart.cells.map(c => ({
    pos: c.gong, name: c.name, gates: c.gate, nineStars: c.star,
    extra: c.extra, marks: c.marks, highlight: c.gong === chart.taiYiGong,
  }));
  return {
    kind: 'grid', art: 'qimen',
    title: `日家奇门 · ${chart.dayPillar}日（${chart.yinYang}）`,
    cells,
    info: [
      { label: '起局', value: `${chart.dayPillar}日（日家以日为主，不看时家盘）` },
      { label: '阴/阳遁', value: `${chart.jieqi}后 ${chart.yinYang}` },
      { label: '休门', value: `落${GONG_NAMES[chart.xiuMenGong - 1]}（三日一宫）` },
      { label: '太乙', value: `落${GONG_NAMES[chart.taiYiGong - 1]}（一日一宫）` },
      { label: '时辰', value: `${chart.currentDao.shichen}-${chart.currentDao.shen}（${chart.currentDao.kind}）` },
      { label: '喜神', value: chart.xiShen },
      { label: '天乙贵人', value: chart.guiRen ?? '—' },
      { label: '格局', value: chart.patterns.join('；') || '无特殊格局' },
    ],
  };
}

export function qimenDayWarnings(chart: QimenDayChart): Warning[] {
  const w: Warning[] = [];
  w.push({ code: 'qimen/ri/levels', message: '日家奇门为民间择吉体系（D级口诀，来源：金函玉镜/神奇之门整理本），只供一日方向参考，精确到时辰请用「时家奇门」。' });
  if (chart.wuBuYu) w.push({ code: 'qimen/ri/wubuyu', message: '五不遇时：本时辰百事不宜。' });
  return w;
}

export function qimenDayEvidence(_c: QimenDayChart, rules: RuleHit[]): CitationRef[] {
  return rules.flatMap(r => r.citations);
}

export function qimenDayTiming(chart: QimenDayChart): TimingCandidate[] {
  return [{
    ruleId: 'qimen.ri.timing', text: `日家应期参本日吉门/吉星方位；时辰层面以黄道为吉（当前为${chart.currentDao.shen}·${chart.currentDao.kind}）、黑道为凶。`,
    citations: [], confidenceLevel: 'D',
  }];
}

export function qimenDayFacts(chart: QimenDayChart, _cat: string): FactBundle {
  return { facts: [
    { key: 'pan', label: '日家盘', value: `${chart.dayPillar}日 · ${chart.yinYang}（${chart.jieqi}）` },
    { key: 'xiu', label: '休门', value: GONG_NAMES[chart.xiuMenGong - 1] },
    { key: 'taiyi', label: '太乙', value: GONG_NAMES[chart.taiYiGong - 1] },
    { key: 'dao', label: '当前时辰', value: `${chart.currentDao.shen}（${chart.currentDao.kind}）` },
    { key: 'xishen', label: '喜神', value: chart.xiShen },
  ] };
}