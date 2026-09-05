/** 八字（P2）：四柱/藏干/十神/纳音/大运/流年/十二长生/五行旺衰/格局+旺衰双轨用神/神煞/刑冲合害会 */
import {
  type ResolvedConfig, type RuleHit, type BoardSpec, type Warning, type CitationRef, type RawInput,
  type NormalizedMoment,
} from '../../config/types';
import { cite } from '../../plugins/contract';
import { normalizeMoment } from '../../calendar/normalize';
import { TIAN_GAN, DI_ZHI, JIAZI60, GAN_WUXING, ZHI_WUXING, CANG_GAN, nayin, ganzhiIndex, shiShen, changSheng, shenSha, liuchong, xiangxing, LIUHE, SANHE, wushuDun } from '../../calendar/ganzhi';
import { prevJie, nextJieQi as nextJie } from '../../calendar/solarTerms';
import { monthGeneral } from '../../calendar/normalize';

export interface BaziPillar { label: string; gz: string; shiShen: string; hidden: Array<{ gan: string; shiShen: string; kind?: '本气' | '中气' | '余气' }>; nayin: string; changSheng?: string }

export interface DayunItem { index: number; ganzhi: string; startAge: number; endAge: number; years: [number, number]; shiShen: string }

export interface BaziChart {
  art: 'bazi';
  gender: '男' | '女';
  pillars: BaziPillar[];        // 年月日时（缺时柱时长度 3）
  dayGan: string;
  wuxingCount: Record<string, number>;
  score: { wood: number; fire: number; earth: number; metal: number; water: number };
  strength: '身旺' | '身弱' | '中和';
  selfRatio: number;
  yongShen: { primary: string; method: '扶抑' | '调候' | '通关'; reason: string; favorable: string[]; unfavorable: string[] };
  geju: string;
  dayun: DayunItem[];
  shensha: string[];
  relations: string[];          // 刑冲合害会描述
  shiErChangSheng: Array<{ zhi: string; stage: string }>;
  normalized: NormalizedMoment;
  configHash: string;
  hourMissing: boolean;
  qimenHint?: { general: string; zhi: string };
}

const WX_ORDER = ['木', '火', '土', '金', '水'];
const TIAO_HOU: Record<string, { primary: string; warm: string; cool: string }> = {
  木: { primary: '丙', warm: '丙', cool: '癸' }, 火: { primary: '壬', warm: '壬', cool: '壬' },
  土: { primary: '甲', warm: '甲', cool: '丙' }, 金: { primary: '丁', warm: '丁', cool: '壬' },
  水: { primary: '丙', warm: '丙', cool: '戊' },
};

export function computeBazi(input: RawInput, cfg: ResolvedConfig, configHash: string): BaziChart {
  const hourMissing = !!input.hourMissing || input.time.hour < 0;
  const normalized = normalizeMoment(input, { calendar: cfg.calendar, hourMissing });
  const { yearPillar, monthPillar, dayPillar } = normalized;
  const hourPillar = hourMissing ? '' : normalized.hourPillar;

  const dayGan = dayPillar[0];
  const pillars: BaziPillar[] = [
    { label: '年柱', gz: yearPillar, shiShen: shiShen(dayGan, yearPillar[0]), hidden: hiddenOf(yearPillar[1], dayGan), nayin: nayin(ganzhiIndex(yearPillar)) },
    { label: '月柱', gz: monthPillar, shiShen: shiShen(dayGan, monthPillar[0]), hidden: hiddenOf(monthPillar[1], dayGan), nayin: nayin(ganzhiIndex(monthPillar)) },
    { label: '日柱', gz: dayPillar, shiShen: '日主', hidden: hiddenOf(dayPillar[1], dayGan), nayin: nayin(ganzhiIndex(dayPillar)) },
  ];
  if (!hourMissing) pillars.push({ label: '时柱', gz: hourPillar, shiShen: shiShen(dayGan, hourPillar[0]), hidden: hiddenOf(hourPillar[1], dayGan), nayin: nayin(ganzhiIndex(hourPillar)) });

  // 五行计分：天干 1.2、地支本气 1.0、中余气 0.4；月令本气 ×1.5
  const score: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const [i, p] of pillars.entries()) {
    score[GAN_WUXING[TIAN_GAN.indexOf(p.gz[0])]] += 1.2;
    const zhi = p.gz[1];
    const hidden = CANG_GAN[zhi];
    hidden.forEach((g, hi) => {
      const w = GAN_WUXING[TIAN_GAN.indexOf(g)];
      score[w] += hi === 0 ? (i === 1 ? 1.5 : 1.0) : 0.4;
    });
  }
  const dayWx = GAN_WUXING[TIAN_GAN.indexOf(dayGan)];
  const seal = WX_ORDER[(WX_ORDER.indexOf(dayWx) + 4) % 5];   // 生我
  const peer = dayWx;
  const selfScore = score[peer] + score[seal];
  const total = WX_ORDER.reduce((s, k) => s + score[k], 0);
  const ratio = selfScore / total;
  const strength = ratio > 0.55 ? '身旺' : ratio < 0.38 ? '身弱' : '中和';
  const selfRatio = Math.round(ratio * 100);

  // 双轨用神：旺衰法（扶抑）为主，调候为辅
  const yinShi = WX_ORDER[(WX_ORDER.indexOf(dayWx) + 1) % 5];  // 我生
  const guan = WX_ORDER[(WX_ORDER.indexOf(dayWx) + 3) % 5];    // 克我
  const cai = WX_ORDER[(WX_ORDER.indexOf(dayWx) + 2) % 5];     // 我克
  let yongShen: BaziChart['yongShen'];
  if (strength === '身旺') {
    yongShen = { primary: cai, method: '扶抑', reason: `日主${dayGan}属${dayWx}，同党（比劫+印）占比 ${(ratio * 100).toFixed(0)}% 偏旺，取克泄耗之${cai}/${yinShi}/${guan}为喜`, favorable: [cai, yinShi, guan], unfavorable: [peer, seal] };
  } else if (strength === '身弱') {
    yongShen = { primary: seal, method: '扶抑', reason: `同党占比 ${(ratio * 100).toFixed(0)}% 偏弱，取生扶之${seal}/${peer}为喜`, favorable: [seal, peer], unfavorable: [cai, guan, yinShi] };
  } else {
    const season = monthPillar[1];
    const seasonWx = ZHI_WUXING[DI_ZHI.indexOf(season)];
    const t = TIAO_HOU[dayWx];
    const need = seasonWx === '水' || seasonWx === '金' ? t.warm : t.cool;
    yongShen = { primary: need, method: '调候', reason: `日主中和，按《穷通宝鉴》调候取${need}（${dayGan}生${season}月）`, favorable: [need, dayWx === '木' || dayWx === '水' ? '火' : '水'], unfavorable: [] };
  }

  // 大运：月柱顺逆（阳年男顺/阴女顺，反之逆行），起运数=距节气天数/3
  const gender = input.gender ?? '男';
  const yearGanYang = TIAN_GAN.indexOf(yearPillar[0]) % 2 === 0;
  const forward = (yearGanYang && gender === '男') || (!yearGanYang && gender === '女');
  const birthJdn = normalized.jdn;
  const birthMin = input.time.hour * 60 + input.time.minute;
  let startYears = 8; // 默认
  if (forward) {
    const nj = nextJie(birthJdn, birthMin);
    if (nj) startYears = Math.max(1, Math.round(((nj.jd * 1440 + nj.minutes) - (birthJdn * 1440 + birthMin)) / (3 * 1440) * 10) / 10);
  } else {
    const pj = prevJie(birthJdn, birthMin);
    if (pj) startYears = Math.max(1, Math.round(((birthJdn * 1440 + birthMin) - (pj.jd * 1440 + pj.minutes)) / (3 * 1440) * 10) / 10);
  }
  const dayun: DayunItem[] = [];
  const monthIdx = ganzhiIndex(monthPillar);
  for (let i = 1; i <= 8; i++) {
    const idx = ((monthIdx + (forward ? i : -i)) % 60 + 60) % 60;
    const gz = JIAZI60[idx];
    const s = Math.round((startYears + (i - 1) * 10) * 10) / 10;
    const e = Math.round((startYears + i * 10) * 10) / 10;
    const birthYear = input.time.year;
    dayun.push({
      index: i, ganzhi: gz, startAge: s, endAge: e,
      years: [Math.round(birthYear + s), Math.round(birthYear + e)],
      shiShen: shiShen(dayGan, gz[0]),
    });
  }

  const shensha = shenSha(dayPillar, yearPillar, pillars.map(p => p.gz), gender);

  // 刑冲合害会（地支）
  const relations: string[] = [];
  const zhis = pillars.map(p => p.gz[1]);
  for (let i = 0; i < zhis.length; i++) for (let j = i + 1; j < zhis.length; j++) {
    const a = zhis[i], b = zhis[j];
    const pn = pillars[i].label.slice(0, 1), pn2 = pillars[j].label.slice(0, 1);
    if (liuchong(a, b)) relations.push(`${pn}${pn2}冲：${a}${b}相冲`);
    else if (LIUHE.some(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a))) relations.push(`${pn}${pn2}合：${a}${b}六合`);
    if (xiangxing(a, b) && a !== b) relations.push(`${pn}${pn2}刑：${a}${b}相刑`);
  }
  for (const sh of SANHE) if (sh.group.every(g => zhis.includes(g))) relations.push(`三合${sh.element}局：${sh.group.join('')}`);

  const shiErChangSheng = zhis.map(z => ({ zhi: z, stage: changSheng(dayGan, z) }));
  const mg = monthGeneral(birthJdn, birthMin);

  return {
    art: 'bazi', gender, pillars, dayGan, selfRatio, wuxingCount: countWx(score), score: { wood: score['木'], fire: score['火'], earth: score['土'], metal: score['金'], water: score['水'] },
    strength, yongShen, geju: gejuOf(pillars, dayGan), dayun, shensha, relations, shiErChangSheng,
    normalized, configHash, hourMissing, qimenHint: mg,
  };
}

function countWx(score: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(score)) out[k] = Math.round(score[k] * 10) / 10;
  return out;
}

// —— 流年/流月/流日/流时 四柱对照（与命局刑冲破害·十神·藏干·纳音）——
const LIU_PO: Array<[string, string]> = [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']]; // 六破
const LIU_HAI: Array<[string, string]> = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]; // 六害
const GAN_HE: Array<[string, string]> = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']]; // 天干五合
/** 刑冲害破合的白话解释（供流柱与命局对照使用） */
const STREAM_REL_PLAIN: Record<string, string> = {
  冲: '动象·主变动：该柱所主人事易被催动（冲月=父母/事业动、冲日=自身/婚恋动、冲时=子女/下属动），应期偏快，多伴出行或环境变化。',
  刑: '摩擦·防细节差错与口舌：做事易出小纰漏、文书合同反复，需多留余量、分清轻重缓急。',
  害: '暗亏·表面无事暗里损耗：防小人与隐性损失（欠款、口碑、健康钝痛），明面上多一条暗线牵绊。',
  破: '损坏·易破财与计划打乱：器物损坏、日程临时变更、资金意外开销，宜多留备份与余钱。',
  合: '和合/牵绊：该柱所主人事与你产生合力或拉扯——地支六合主合作/姻缘（根合力量大），天干五合主口头约定/人际走近；合而带绊则原局力量被分走一半。',
};

export interface StreamEvent { code: string; plain: string }
export interface StreamPillarInfo {
  label: string;                 // 流年/流月/流日/流时
  gz: string;                    // 干支
  shiShen: string;               // 天干对日主十神
  hidden: Array<{ gan: string; shiShen: string }>; // 地支藏干（逐一相对日主）
  nayin: string;                 // 纳音
  events: StreamEvent[];         // 与命局四柱的刑冲害破合（地支）+ 天干合，含白话解释
}

/** 当前时刻的流年/流月/流日/流时四柱：逐柱给出十神/藏干/纳音，并对照命局四柱列出刑冲害破合（含白话解释） */
export function baziStreamPillars(chart: BaziChart, now: { year: number; month: number; day: number; hour: number; minute: number }): StreamPillarInfo[] {
  const cal = { yearSwitch: 'lichun' as const, monthSwitch: 'jieqi' as const, zishi: 'switch' as const, trueSolarTime: false, longitude: null as number | null, timeOffsetMin: 0, termAlgoVersion: 'lunar-js-1.7+meeus-check' };
  let n: NormalizedMoment;
  try { n = normalizeMoment({ time: now }, { calendar: cal }); } catch { return []; }
  const srcs: Array<{ label: string; gz: string }> = [
    { label: '流年', gz: n.yearPillar },
    { label: '流月', gz: n.monthPillar },
    { label: '流日', gz: n.dayPillar },
    { label: '流时', gz: n.hourPillar },
  ].filter(x => !!x.gz);
  const dayGan = chart.dayGan;
  const natal = chart.pillars;
  return srcs.map(({ label, gz }) => {
    const gan = gz[0];
    const zhi = gz[1];
    const events: StreamEvent[] = [];
    const push = (e: StreamEvent) => { if (!events.some(x => x.code === e.code)) events.push(e); };
    for (const p of natal) {
      const pn = p.label.slice(0, 1); // 年/月/日/时
      const b = p.gz[1];
      if (liuchong(zhi, b)) push({ code: `冲${pn}支「${b}」`, plain: `冲${pn}柱地支「${b}」——${STREAM_REL_PLAIN['冲']}` });
      if (zhi !== b && xiangxing(zhi, b)) push({ code: `刑${pn}支「${b}」`, plain: `刑${pn}柱地支「${b}」——${STREAM_REL_PLAIN['刑']}` });
      if (LIU_HAI.some(l => (l[0] === zhi && l[1] === b) || (l[0] === b && l[1] === zhi))) push({ code: `害${pn}支「${b}」`, plain: `害${pn}柱地支「${b}」——${STREAM_REL_PLAIN['害']}` });
      if (LIU_PO.some(l => (l[0] === zhi && l[1] === b) || (l[0] === b && l[1] === zhi))) push({ code: `破${pn}支「${b}」`, plain: `破${pn}柱地支「${b}」——${STREAM_REL_PLAIN['破']}` });
      if (LIUHE.some(l => (l[0] === zhi && l[1] === b) || (l[0] === b && l[1] === zhi))) push({ code: `合${pn}支「${b}」`, plain: `合${pn}柱地支「${b}」（六合）——${STREAM_REL_PLAIN['合']}` });
      if (GAN_HE.some(l => (l[0] === gan && l[1] === p.gz[0]) || (l[0] === p.gz[0] && l[1] === gan))) push({ code: `合${pn}干「${p.gz[0]}」`, plain: `合${pn}柱天干「${p.gz[0]}」（五合）——${STREAM_REL_PLAIN['合']}` });
    }
    return { label, gz, shiShen: shiShen(dayGan, gan), hidden: hiddenOf(zhi, dayGan), nayin: nayin(ganzhiIndex(gz)), events: events.slice(0, 4) };
  });
}

function hiddenOf(zhi: string, dayGan: string) {
  const kinds = ['本气', '中气', '余气'] as const;
  return CANG_GAN[zhi].map((g, index) => ({ gan: g, shiShen: shiShen(dayGan, g), kind: kinds[index] }));
}

function gejuOf(pillars: BaziPillar[], dayGan: string): string {
  const mgz = pillars[1].gz;
  const mg = TIAN_GAN.indexOf(mgz[0]);
  const ss = shiShen(dayGan, mgz[0]);
  const transparent = pillars.some(p => p.shiShen === ss && p.gz[0] === TIAN_GAN[mg]);
  const yueLingMain = GAN_WUXING[TIAN_GAN.indexOf(mgz[0])];
  if (['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官'].includes(ss)) {
    return `${ss}格（月令${yueLingMain}，月干透${mgz[0]}${transparent ? '，透干成格' : '，藏支待引'}）`;
  }
  return `月令${yueLingMain}，以旺衰法论`;
}

// ---------- 规则 ----------
const C_ZZYQ = () => cite('yuanhaiziping', '渊海子平', '基础第一', 'yuanhaiziping.1.13', '假令月令有用神，得父母力；年有用神，得祖宗力', 'A');
const C_DTS = () => cite('ditiansui', '滴天髓', '通神论', 'ditiansui.1.1', '能知衰旺之真机，其于三命之奥，思过半矣', 'A');

export function baziRules(chart: BaziChart, _cfg: ResolvedConfig): RuleHit[] {
  const hits: RuleHit[] = [];
  hits.push({
    ruleId: 'bazi.yongshen.fufu', title: '用神（扶抑/调候）',
    fact: `${chart.yongShen.method}取用：喜${chart.yongShen.favorable.join('、') || '—'}；忌${chart.yongShen.unfavorable.join('、') || '—'}。${chart.yongShen.reason}`,
    level: '中性', citations: [C_ZZYQ(), C_DTS()], confidenceLevel: 'A',
  });
  hits.push({
    ruleId: 'bazi.geju', title: '格局',
    fact: chart.geju, level: '中性', citations: [C_ZZYQ()], confidenceLevel: 'A',
  });
  if (chart.strength !== '中和') {
    hits.push({
      ruleId: 'bazi.wangshuai', title: '旺衰',
      fact: `日主${chart.dayGan}，全局${chart.strength}（同党占比 ${chart.selfRatio}%）`,
      level: chart.strength === '身旺' ? '吉' : '凶', citations: [C_DTS()], confidenceLevel: 'A',
    });
  }
  for (const r of chart.relations) {
    const isChong = r.includes('冲');
    hits.push({
      ruleId: isChong ? 'bazi.zhi.chong' : r.includes('合') ? 'bazi.zhi.he' : 'bazi.zhi.xing',
      title: isChong ? '地支相冲' : r.includes('合') ? '地支相合' : '地支相刑',
      fact: r, level: isChong ? '变数' : '中性', citations: [C_DTS()], confidenceLevel: 'A',
    });
  }
  if (chart.shensha.length) {
    hits.push({
      ruleId: 'bazi.shensha', title: '神煞',
      fact: chart.shensha.join('、'), level: '中性', citations: [C_DTS()], confidenceLevel: 'B',
    });
  }
  const cur = currentDayun(chart);
  if (cur) {
    hits.push({
      ruleId: 'bazi.dayun.current', title: '现行大运',
      fact: `${cur.ganzhi}运（${cur.startAge}~${cur.endAge} 岁，约 ${cur.years[0]}–${cur.years[1]} 年），十神：${cur.shiShen}`,
      level: '中性', citations: [C_ZZYQ()], confidenceLevel: 'A',
    });
  }
  if (chart.hourMissing) {
    hits.push({
      ruleId: 'bazi.degraded.nohour', title: '缺时柱（降级）',
      fact: '出生时辰缺失，时柱不可排；时干支相关旺衰、子女宫论断不可用。建议补齐时辰或改用六爻。',
      level: '变数', citations: [], confidenceLevel: 'D', confidenceExtra: '降级提示，非断语',
    });
  }
  return hits;
}

function pct(chart: BaziChart): string {
  void chart;
  return '';
}

export function currentDayun(chart: BaziChart): DayunItem | null {
  const age = currentAge(chart);
  if (age == null) return null;
  return chart.dayun.find(d => age >= d.startAge && age < d.endAge) ?? null;
}
function currentAge(chart: BaziChart): number | null {
  const now = new Date();
  const birth = new Date(chart.normalized.year, chart.normalized.month - 1, chart.normalized.day);
  return Math.floor((now.getTime() - birth.getTime()) / (365.2425 * 86400000));
}

export function baziBoard(chart: BaziChart, _cfg: ResolvedConfig): BoardSpec {
  const rows = chart.pillars.map(p => [p.label, p.gz, p.shiShen, p.hidden.map(h => `${h.gan}(${h.shiShen})`).join(' '), p.nayin, p.changSheng ?? '']);
  const cur = currentDayun(chart);
  const table = {
    headers: ['柱', '干支', '十神', '藏干', '纳音', '长生'],
    rows,
    sections: [
      { name: '大运（顺逆依阴阳年干与性别）', rows: chart.dayun.map(d => [`第${d.index}运`, d.ganzhi, d.shiShen, `${d.startAge}~${d.endAge} 岁`, `${d.years[0]}–${d.years[1]}`, d === cur ? '现行' : '']) },
      { name: '五行旺衰', rows: [['木', String(chart.score.wood)], ['火', String(chart.score.fire)], ['土', String(chart.score.earth)], ['金', String(chart.score.metal)], ['水', String(chart.score.water)], ['旺衰', chart.strength]] },
      { name: '神煞 / 地支关系', rows: [[chart.shensha.join('、') || '—'], [chart.relations.join('；') || '—']] },
      { name: '十二长生（以日干查）', rows: [[chart.shiErChangSheng.map(s => `${s.zhi}:${s.stage}`).join('  ')]] },
    ],
  };
  return {
    kind: 'table', art: 'bazi',
    title: `八字 · ${chart.pillars.map(p => p.gz).join(' ')}（${chart.strength}）`,
    table,
    info: [
      { label: '用神', value: `${chart.yongShen.primary}（${chart.yongShen.method}）` },
      { label: '喜', value: chart.yongShen.favorable.join('、') || '—' },
      { label: '忌', value: chart.yongShen.unfavorable.join('、') || '—' },
      { label: '格局', value: chart.geju },
      ...(chart.hourMissing ? [{ label: '⚠ 降级', value: '缺时柱：时辰未提供，仅三柱' }] : []),
    ],
  };
}

export function baziWarnings(chart: BaziChart): Warning[] {
  const w: Warning[] = [];
  if (chart.hourMissing) w.push({ code: 'degraded/no-hour', message: '缺时柱：需时柱的规则已禁用；单事占问建议改用六爻降级' });
  if (chart.normalized.confidence === 'degraded') w.push({ code: 'calendar/degraded', message: '历法输入降级，结果按明示缺口处理' });
  return w;
}

export function baziEvidence(chart: BaziChart, rules: RuleHit[]): CitationRef[] {
  const seen = new Set<string>();
  const out: CitationRef[] = [];
  for (const r of rules) for (const c of r.citations) {
    const k = c.canonicalId + '/' + c.segId;
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }
  void chart;
  return out;
}

export { wushuDun };
