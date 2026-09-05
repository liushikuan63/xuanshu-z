/** 金口诀（P4）：地分四位（人元/贵神/将神/地分）+ 五动三动 */
import type { ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput, TimingCandidate, FactBundle } from '../../config/types';
import { normalizeMoment, monthGeneral } from '../../calendar/normalize';
import { TIAN_GAN, DI_ZHI, GAN_WUXING, ZHI_WUXING, hourPillar as calcHourPillar, wushuDun, ganzhiIndex } from '../../calendar/ganzhi';
import { cite } from '../../plugins/contract';

export interface JinkouChart {
  art: 'jinkou';
  renYuan: string;  // 人元（天干）
  guiShen: string;  // 贵神（天干+神名）
  jiangShen: string; // 将神（地支+月将）
  diFen: string;    // 地分（地支）
  fiveDong: string[]; threeDong: string[];
  interpretation: string;
  normalized: ReturnType<typeof normalizeMoment>;
  configHash: string;
}

const TWELVE_GODS = ['贵神', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'] as const;
const GOD_NAMES = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

/** 昼夜贵人起法：甲戊庚牛羊（昼贵）；六辛逢马虎…——金口诀按昼夜取贵神落宫 */
const DAY_GUI: Record<string, string> = { 甲: '丑', 戊: '丑', 庚: '丑', 乙: '子', 己: '子', 丙: '亥', 丁: '亥', 壬: '巳', 癸: '巳', 辛: '午' };
const NIGHT_GUI: Record<string, string> = { 甲: '未', 戊: '未', 庚: '未', 乙: '申', 己: '申', 丙: '酉', 丁: '酉', 壬: '卯', 癸: '卯', 辛: '寅' };

export function computeJinkou(input: RawInput, cfg: ResolvedConfig, configHash: string, diFenOverride?: string): JinkouChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  const minuteOfDay = Math.max(0, input.time.hour) * 60 + input.time.minute;
  const mg = monthGeneral(normalized.jdn, minuteOfDay);
  const hourZhiIdx = DI_ZHI.indexOf(calcHourPillar(normalized.dayPillar, Math.max(0, input.time.hour)).slice(1));

  // 月将加时：从月将起，顺数至占时 → 将神
  const jiangIdx = (DI_ZHI.indexOf(mg.zhi) + hourZhiIdx) % 12;
  const jiangShenZhi = DI_ZHI[jiangIdx];

  // 贵神：昼（卯后~酉前）/夜（酉后~卯前）贵人落宫，从贵人顺数至将神地支
  const isDay = input.time.hour >= 5 && input.time.hour < 19;
  const guiZhi = isDay ? DAY_GUI[normalized.dayPillar[0]] : NIGHT_GUI[normalized.dayPillar[0]];
  const guiStart = DI_ZHI.indexOf(guiZhi);
  const guiOffset = ((jiangIdx - guiStart) + 12) % 12;
  // 贵人在地分左侧起：顺数取神（简化通行法）
  const godIdx = guiOffset % 12;
  const godName = GOD_NAMES[godIdx];

  // 人元：以贵神地支起遁干（日干五鼠遁？金口诀人元按将神/贵神支遁干——通行法：以日干起五鼠遁得地分上干，再顺推）简化：以年干五虎遁月，取时干体系。此处按通行「日上起时」干系：
  const renYuanGan = TIAN_GAN[(wushuDun(normalized.dayPillar[0]) + jiangIdx) % 10];

  const diFen = diFenOverride ?? '午'; // 地分：来方/问方（用户可指定），默认午（正南）
  const diFenIdx = DI_ZHI.indexOf(diFen);

  // 五动：干与神、干与将的生克（正动/动/和/…）简化为生克关系列表
  const wxOfGan = (g: string) => GAN_WUXING[TIAN_GAN.indexOf(g)];
  const wxOfZhi = (z: string) => ZHI_WUXING[DI_ZHI.indexOf(z)];
  const order = ['木', '火', '土', '金', '水'];
  const rel = (a: string, b: string) => {
    if (a === b) return '比和';
    if ((order.indexOf(a) + 1) % 5 === order.indexOf(b)) return '生';
    if ((order.indexOf(b) + 1) % 5 === order.indexOf(a)) return '受生';
    if ((order.indexOf(a) + 2) % 5 === order.indexOf(b)) return '克';
    return '受克';
  };
  const fiveDong = [
    `人元${renYuanGan}（${wxOfGan(renYuanGan)}）对贵神${godName}（${wxOfZhi(DI_ZHI[jiangIdx])}）：${rel(wxOfGan(renYuanGan), wxOfZhi(jiangShenZhi))}`,
    `人元对将神${jiangShenZhi}（${wxOfZhi(jiangShenZhi)}）：${rel(wxOfGan(renYuanGan), wxOfZhi(jiangShenZhi))}`,
    `贵神对将神：${rel(wxOfZhi(DI_ZHI[(guiStart + godIdx) % 12]), wxOfZhi(jiangShenZhi))}`,
    `将神对地分${diFen}：${rel(wxOfZhi(jiangShenZhi), wxOfZhi(diFen))}`,
    `贵神对地分：${rel(wxOfZhi(DI_ZHI[(guiStart + godIdx) % 12]), wxOfZhi(diFen))}`,
  ];
  const threeDong = [`贵神与将神关系`, `将神与地分关系`, `人元与地分关系`];

  const guiGood = ['青龙', '六合', '太常', '太阴', '天后', '贵神'].includes(godName);
  const interpretation = `贵神得${godName}（${guiGood ? '吉神' : '凶神'}），将神${jiangShenZhi}（月将${mg.general}加${DI_ZHI[hourZhiIdx]}时），人元${renYuanGan}。${guiGood ? '吉神临位，谋事多助，宜进' : '凶神临位，谋事多阻，宜守'}；${rel(wxOfZhi(jiangShenZhi), wxOfZhi(diFen))}关系示来意：${({ '生': '有请托求谋之事', '克': '有争斗伤害之事', '比和': '有同辈朋友之事', '受生': '彼来求助', '受克': '彼来寻衅' } as Record<string, string>)[rel(wxOfZhi(jiangShenZhi), wxOfZhi(diFen))]}`;

  return {
    art: 'jinkou', renYuan: renYuanGan, guiShen: `${godName}`, jiangShen: jiangShenZhi, diFen,
    fiveDong, threeDong, interpretation, normalized, configHash,
  };
}

export function jinkouRules(chart: JinkouChart): RuleHit[] {
  const siwei = siweiRelations(chart);
  return [
    {
      ruleId: 'jinkou.gui', title: '贵神断',
      fact: `贵神得${chart.guiShen}：${(['青龙', '六合', '太常', '太阴', '天后', '贵神'].includes(chart.guiShen)) ? '吉神，谋事多助' : '凶神，谋事多阻'}`,
      level: (['青龙', '六合', '太常', '太阴', '天后', '贵神'].includes(chart.guiShen)) ? '吉' : '凶',
      citations: [], confidenceLevel: 'D', confidenceExtra: '金口诀断语多为师传口诀，无原典逐字对应',
    },
    {
      ruleId: 'jinkou.five-dong', title: '五动', fact: chart.fiveDong.join('；'), level: '中性',
      citations: [], confidenceLevel: 'D',
    },
    {
      ruleId: 'jinkou.laiyi', title: '来意', fact: chart.interpretation, level: '中性',
      citations: [], confidenceLevel: 'D',
    },
    {
      ruleId: 'jinkou.siwei.rel', title: '四位生克连读',
      fact: `自下而上：${siwei.join('；')}。相生多则事顺有助，相克多则阻隔反复；克在人元/贵神主外阻，克在将神/地分主内耗。`,
      level: siwei.filter(r => r.includes('克')).length >= 2 ? '凶' : siwei.some(r => r.includes('克')) ? '变数' : '吉',
      citations: [], confidenceLevel: 'D',
    },
  ];
}

function siweiRelations(chart: JinkouChart): string[] {
  const wxOfZhi: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const wxOfGan: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const order = ['木', '火', '土', '金', '水'];
  const sheng = (a: string, b: string) => (order.indexOf(a) + 1) % 5 === order.indexOf(b);
  const ke = (a: string, b: string) => (order.indexOf(a) + 2) % 5 === order.indexOf(b);
  const stack = [
    { name: '人元', wx: wxOfGan[chart.renYuan?.[0]] ?? '' },
    { name: '贵神', wx: wxOfGan[chart.guiShen?.[0]] ?? '' },
    { name: '将神', wx: wxOfZhi[chart.jiangShen?.[0]] ?? '' },
    { name: '地分', wx: wxOfZhi[chart.diFen?.[0]] ?? '' },
  ];
  const relations: string[] = [];
  for (let i = 0; i < stack.length - 1; i++) {
    const a = stack[i], b = stack[i + 1];
    if (!a.wx || !b.wx) continue;
    relations.push(sheng(b.wx, a.wx) ? `${b.name}生${a.name}` : ke(b.wx, a.wx) ? `${b.name}克${a.name}` : sheng(a.wx, b.wx) ? `${a.name}生${b.name}` : ke(a.wx, b.wx) ? `${a.name}克${b.name}` : `${a.name}${b.name}比和`);
  }
  return relations;
}

export function jinkouTiming(_chart: JinkouChart): TimingCandidate[] {
  return [{ ruleId: 'jinkou.timing.none', text: '暂无内置应期推法（金口诀应期多凭口诀心传，系统不硬写）', citations: [], confidenceLevel: 'D' }];
}

export function jinkouBoard(chart: JinkouChart): BoardSpec {
  return {
    kind: 'list', art: 'jinkou', title: `金口诀 · 四位一元`,
    cells: [
      { pos: 0, name: '人元', extra: chart.renYuan },
      { pos: 1, name: '贵神', extra: chart.guiShen },
      { pos: 2, name: '将神', extra: chart.jiangShen },
      { pos: 3, name: '地分', extra: chart.diFen },
    ],
    info: [
      { label: '五动', value: chart.fiveDong.join('；') },
      { label: '断', value: chart.interpretation },
      { label: '⚠ 分级', value: '金口诀断语属师传口诀，D 级流派说法' },
    ],
  };
}

export function jinkouWarnings(): Warning[] {
  return [{ code: 'jinkou/level-d', message: '金口诀口诀属民间传承，全部标 D 级；断语仅供参考' }];
}

export function jinkouEvidence(chart: JinkouChart, rules: RuleHit[]): CitationRef[] {
  const out: CitationRef[] = []; const seen = new Set<string>();
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function jinkouFacts(chart: JinkouChart, _cat: string): FactBundle {
  return { facts: [
    { key: 'siwei', label: '四位', value: `人元${chart.renYuan} 贵神${chart.guiShen} 将神${chart.jiangShen} 地分${chart.diFen}` },
    { key: 'laiyi', label: '来意', value: chart.interpretation },
  ] };
}

export { GOD_NAMES, TWELVE_GODS, DAY_GUI, NIGHT_GUI, ganzhiIndex };
