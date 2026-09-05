/** 紫微斗数（P2，D19）：iztro 适配层（唯一 import 'iztro' 之处）+ 四化版本化规则层 + 三方四正 + 运限 */
import { astro } from 'iztro';
import type {
  ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput,
  NormalizedMoment, TimingCandidate, FactBundle, ConfidenceLevel, BoardCell,
} from '../../config/types';
import { normalizeMoment } from '../../calendar/normalize';
import { TIAN_GAN, ganzhiIndex } from '../../calendar/ganzhi';
import { cite } from '../../plugins/contract';

export interface ZiweiStar { name: string; brightness?: string; mutagen?: string; kind: 'major' | 'minor' | 'adj' }

export interface ZiweiPalaceOut {
  name: string; index: number;
  heavenlyStem: string; earthlyBranch: string;
  stars: ZiweiStar[];
  decadalRange?: string;
  isBody: boolean; isOriginal: boolean;
  changsheng?: string;
  sanfang: number[]; // 三方四正宫序
  duigong: number;   // 对宫
}

export interface ZiweiChart {
  art: 'ziwei';
  solarDate: string; timeIndex: number; gender: '男' | '女';
  fiveElementsClass: string; soul: string; body: string;
  palaces: ZiweiPalaceOut[];
  decadal: Array<{ index: number; range: string; name: string }>;
  horoscope?: {
    decadal: { index: number; name: string; stem: string; branch: string; mutagen: string[] } | null;
    yearly: { index: number; name: string; stem: string; branch: string; mutagen: string[] } | null;
  };
  yearStem: string;
  sihua: { lu: string; quan: string; ke: string; ji: string; version: string; disputed: boolean; alternatives?: Array<{ star: string; version: string }> };
  configHash: string;
  normalized: NormalizedMoment;
  degraded: boolean;
  config: { fixLeap: boolean };
}

/** 四化表（附录 G.1）：全集主流口径 + 占验门分歧 */
const SIHUA_QUANJI: Record<string, [string, string, string, string]> = {
  甲: ['廉贞', '破军', '武曲', '太阳'], 乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'], 丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'], 己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'], 辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'], 癸: ['破军', '巨门', '太阴', '贪狼'],
};
const SIHUA_ZHANYAN_OVERRIDE: Record<string, Partial<Record<'lu' | 'quan' | 'ke' | 'ji', string>>> = {
  庚: { ke: '天相' }, 壬: { ke: '武曲' },
};

export const PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

/** 时辰映射（§7.8-②）：0→早子 23→晚子，否则 floor((h+1)/2) */
export function iztroTimeIndex(hour: number): number {
  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

/** iztro 大限起讫：2.6 为 {range:[起,终],...}，兼容数组/字符串（§7.8） */
function decadalText(d: unknown): string {
  if (Array.isArray(d)) return d.join('-');
  if (d && typeof d === 'object' && Array.isArray((d as { range?: unknown }).range)) return (d as { range: unknown[] }).range.join('-');
  return d == null ? '' : String(d);
}

export function castZiwei(
  input: RawInput, cfg: ResolvedConfig, configHash: string, degraded = false,
): ZiweiChart {
  const { year, month, day } = input.time;
  const hour = degraded || input.hourMissing ? 0 : input.time.hour;
  const gender = input.gender ?? '男';
  const timeIndex = degraded || input.hourMissing ? 0 : iztroTimeIndex(hour);
  const fixLeap = cfg.ziwei.fixLeap;
  const a = astro.bySolar(`${year}-${month}-${day}`, timeIndex, gender, fixLeap, 'zh-CN');

  const palaces: ZiweiPalaceOut[] = a.palaces.map((p) => {
    const stars: ZiweiStar[] = [
      ...(p.majorStars ?? []).map(s => ({ name: s.name, brightness: s.brightness || undefined, mutagen: s.mutagen || undefined, kind: 'major' as const })),
      ...(p.minorStars ?? []).map(s => ({ name: s.name, kind: 'minor' as const })),
      ...(p.adjectiveStars ?? []).map(s => ({ name: s.name, kind: 'adj' as const })),
    ];
    const idx = p.index ?? 0;
    return {
      name: p.name, index: idx,
      heavenlyStem: p.heavenlyStem, earthlyBranch: p.earthlyBranch,
      stars, decadalRange: decadalText(p.decadal),
      isBody: !!p.isBodyPalace, isOriginal: !!p.isOriginalPalace,
      changsheng: p.changsheng12,
      duigong: (idx + 6) % 12,
      sanfang: [idx, (idx + 4) % 12, (idx + 8) % 12, (idx + 6) % 12],
    };
  });

  const yearStem = a.chineseDate?.split(' ')[0]?.[0] ?? TIAN_GAN[(year % 10 - 4 + 10) % 10];
  const versionLabel = cfg.ziwei.sihuaVersion === 'zhanyan' ? '占验门' : cfg.ziwei.sihuaVersion === 'feixing' ? '飞星派' : '全集主流';
  const base = SIHUA_QUANJI[yearStem] ?? ['廉贞', '破军', '武曲', '太阳'];
  const ov = cfg.ziwei.sihuaVersion === 'zhanyan' ? SIHUA_ZHANYAN_OVERRIDE[yearStem] : undefined;
  const sihua = {
    lu: ov?.lu ?? base[0], quan: ov?.quan ?? base[1], ke: ov?.ke ?? base[2], ji: ov?.ji ?? base[3],
    version: versionLabel,
    disputed: ['庚', '壬'].includes(yearStem),
    alternatives: ['庚', '壬'].includes(yearStem)
      ? [{ star: SIHUA_ZHANYAN_OVERRIDE[yearStem].ke!, version: '占验门' }, { star: SIHUA_QUANJI[yearStem][2], version: '全集主流' }]
      : undefined,
  };

  // 大限
  let decadal: Array<{ index: number; range: string; name: string }> = [];
  for (const p of palaces) {
    if (p.decadalRange && /\d+-\d+/.test(p.decadalRange)) {
      decadal.push({ index: p.index, range: p.decadalRange, name: p.name });
    }
  }

  // 运限（若给定排盘时刻之后日期，取当前流年；默认用今天）
  let horoscope: ZiweiChart['horoscope'] | undefined;
  try {
    const now = new Date();
    const h = a.horoscope(`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`, timeIndex);
    const map = (x: { index: number; name: string; heavenlyStem: string; earthlyBranch: string; mutagen: string[] } | undefined) =>
      x ? { index: x.index, name: x.name, stem: x.heavenlyStem, branch: x.earthlyBranch, mutagen: x.mutagen ?? [] } : null;
    horoscope = { decadal: map((h as never as { decadal: never }).decadal), yearly: map((h as never as { yearly: never }).yearly) };
  } catch { /* 运限失败不阻塞排盘 */ }

  const normalized = normalizeMoment(input, { calendar: cfg.calendar, hourMissing: degraded || input.hourMissing });

  return {
    art: 'ziwei', solarDate: `${year}-${month}-${day}`, timeIndex, gender,
    fiveElementsClass: a.fiveElementsClass, soul: a.soul, body: a.body,
    palaces, decadal, horoscope, yearStem, sihua, configHash, normalized,
    degraded: degraded || !!input.hourMissing, config: { fixLeap },
  };
}

// ---------- 规则层（四化叠加/亮度/三方四正/格局，每条 ruleId + citations） ----------
const C_QS_ALIAS: Record<string,string> = {
  '诸星论': '诸星问答论第八', '命宫论': '诸星问答论第八', '诸星在十二宫论': '诸星问答论第八',
  '诸星在命宫论': '诸星问答论第八', '太岁行事诀': '诸星问答论第八', '安命身宫诀': '诸星问答论第八',
  '定五行局诀': '诸星问答论第八', '格局': '诸星问答论第八', '大限': '诸星问答论第八',
};
const C_QS = (ch0: string, seg?: string) => {
  const ch = C_QS_ALIAS[ch0] ?? ch0;
  return cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');
};
const C_QJ_ALIAS: Record<string,string> = {
  '四化论': '斗数准绳第四', '四化表': '斗数准绳第四',
};
const C_QJ = (ch0: string, seg?: string) => {
  const ch = C_QJ_ALIAS[ch0] ?? ch0;
  return cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');
};
const C_TW = (seg?: string) => cite('taiwei-fu', '太微赋', '全文', seg ?? 'taiwei-fu.1.1', '（《太微赋》原典回链，见书阁）', 'A');

export function ziweiSihuaHit(chart: ZiweiChart): RuleHit {
  const { lu, quan, ke, ji, version, disputed, alternatives } = chart.sihua;
  const hit: RuleHit = {
    ruleId: `ziwei.sihuatab.${chart.yearStem}`,
    title: `生年四化（${chart.yearStem}干·${version}）`,
    fact: `${chart.yearStem}干生人：${lu}化禄、${quan}化权、${ke}化科、${ji}化忌。生年四化为底色，大限/流年四化为引动；论断次序固定「生年→大限→流年」。`,
    level: '中性',
    citations: [C_QJ('四化论', `ziwei-quanshu.sihuatab.${chart.yearStem}`)],
    confidenceLevel: disputed ? 'B' : 'A',
    alternatives: disputed ? alternatives?.map(a => ({ label: `化科作「${a.star}」`, version: a.version })) : undefined,
    confidenceExtra: disputed ? 'version-dependent' : undefined,
  };
  return hit;
}

const BRIGHTNESS_ORDER = ['庙', '旺', '得', '利', '平', '不', '陷'];

export function ziweiRules(chart: ZiweiChart): RuleHit[] {
  const hits: RuleHit[] = [ziweiSihuaHit(chart)];

  // 四化落宫（以星曜自带 mutagen 核对 + 版本表叠加）
  const ming = chart.palaces.find(p => p.name === '命宫') ?? chart.palaces[0];
  for (const [key, label, star] of [['lu', '化禄', chart.sihua.lu], ['quan', '化权', chart.sihua.quan], ['ke', '化科', chart.sihua.ke], ['ji', '化忌', chart.sihua.ji]] as const) {
    const palace = chart.palaces.find(p => p.stars.some(s => s.name === star));
    if (palace) hits.push({
      ruleId: `ziwei.sihua.luo.${key}`, title: `${label}落${palace.name}`,
      fact: `生年${label}（${star}）落${palace.name}（${palace.heavenlyStem}${palace.earthlyBranch}）：${({ lu: '主财禄、缘分、顺利', quan: '主权柄、成就、强势', ke: '主功名、贵人、平和', ji: '主执著、亏欠、阻滞' } as Record<string, string>)[key]}`,
      level: key === 'ji' ? '凶' : key === 'lu' ? '吉' : '中性',
      citations: [C_QS('诸星论'), C_TW()], confidenceLevel: 'A',
      target: palace.name,
    });
  }

  // 命宫三方四正
  hits.push({
    ruleId: 'ziwei.sanfang.ming', title: '命宫三方四正',
    fact: `命宫${ming.heavenlyStem}${ming.earthlyBranch}，三方四正：${ming.sanfang.map(i => chart.palaces[i].name).join('、')}。三方四正为论断格局之基（官禄看事业，财帛看财源，迁移看外出）。`,
    level: '中性', citations: [C_QS('命宫论'), C_TW()], confidenceLevel: 'A',
  });

  // 亮度（陷/不得地之主星提示）
  for (const p of chart.palaces) {
    for (const s of p.stars.filter(s => s.kind === 'major' && s.brightness === '陷')) {
      hits.push({
        ruleId: 'ziwei.brightness.xian', title: `星曜落陷`,
        fact: `${s.name}落陷于${p.name}（庙旺得利平不陷七级之末）：力量最弱，吉性减、凶性增，须以煞曜会照细分。`,
        level: '凶', citations: [C_QS('诸星在十二宫论')], confidenceLevel: 'A',
        target: `${p.name}·${s.name}`,
      });
    }
  }

  // 格局识别（有原典出处的经典格局，节选）
  const starAt = (name: string) => chart.palaces.find(p => p.stars.some(s => s.name === name));
  const same = (a: string, b: string) => chart.palaces.find(p => p.stars.some(s => s.name === a) && p.stars.some(t => t.name === b));
  if (same('紫微', '天府')) hits.push({ ruleId: 'ziwei.geju.ziweifugong', title: '格局：紫府同宫', fact: '紫微天府同守命宫（寅/申）：帝王之坐明堂，主贵人扶助、一生富足，喜百官朝拱', level: '吉', citations: [C_TW(), C_QS('诸星在命宫论')], confidenceLevel: 'A' });
  if (same('紫微', '贪狼')) hits.push({ ruleId: 'ziwei.geju.ziweitanglang', title: '格局：紫贪同宫', fact: '紫微贪狼同宫（卯/酉）：桃花犯主之局，主才艺、欲望强，早岁辛苦晚岁安', level: '变数', citations: [C_QS('诸星在命宫论')], confidenceLevel: 'A' });
  if (same('太阳', '太阴')) hits.push({ ruleId: 'ziwei.geju.riyue', title: '格局：日月同宫', fact: '太阳太阴同宫（丑/未）：日月同临，主阴阳调和、名利兼收，须分昼夜生人论强弱', level: '中性', citations: [C_TW()], confidenceLevel: 'A' });
  const fus = chart.palaces.filter(p => p.stars.some(s => ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'].includes(s.name))).length;
  if (ming.stars.some(s => s.name === '紫微') && fus >= 3) hits.push({ ruleId: 'ziwei.geju.junchen', title: '格局：君臣庆会', fact: '紫微守命而辅弼昌曲魁钺会照：君臣庆会，品格既高，人臣端坐庙堂', level: '吉', citations: [C_TW()], confidenceLevel: 'A' });
  // ---- R4 扩充：命宫主星心性（《紫微斗数全书·诸星问答论》，性格倾向非定命）----
  const MING_TRAIT: Record<string, string> = {
    紫微: '帝座尊贵，稳重大度有主见，喜百官朝拱；无助则孤高自负',
    天机: '善谋多思、机变灵敏，宜策划技术；忌多虑善变、心思难定',
    太阳: '光明博爱、主贵气与付出，劳心劳力而慷慨；男主事业、女主益夫',
    武曲: '财星刚决、行动力强，宜财赋武职；忌孤克急躁、不善表达',
    天同: '福星温和、乐天安逸，有口福有人缘；忌懒散无斗志、不思进取',
    廉贞: '囚星刚硬而带桃花，能文能武、原则性强；忌感情纠葛、钻牛角尖',
    天府: '令星稳重保守、善理财守成，为田宅主；忌守旧不变、城府深沉',
    太阴: '富星柔静细腻、重感情，宜文教静业；男主内敛、女主柔中有谋',
    贪狼: '桃花星多才多艺、欲望广应酬强，宜技艺交际；忌贪多骛远、纵欲',
    巨门: '暗星善思辨口才，宜专业钻研、以口为业；忌是非猜疑、言多招怨',
    天相: '印星忠良，辅佐之才、衣食无忧，重承诺；忌耳根软、被人左右',
    天梁: '荫星如长者，善照顾庇荫、逢凶化解，宜医药法律；忌倚老卖老',
    七杀: '将星肃杀、冲劲开创，宜武职创业；忌人生起伏激烈、性刚易折',
    破军: '耗星先破后成、变动中开创，宜变革性行业；忌横冲直撞、不留退路',
  };
  const mingStars = ming.stars.filter(st => st.kind === 'major');
  if (mingStars.length) {
    const desc = mingStars.map(st => `${st.name}${st.brightness ? '(' + st.brightness + ')' : ''}：${MING_TRAIT[st.name] ?? ''}`).join('；');
    hits.push({
      ruleId: `ziwei.mingstar.${mingStars.map(x => x.name).join('')}`, title: '命宫主星心性',
      fact: `命宫坐${desc}。——性格倾向而非定命，须兼看三方四正与四化。`,
      level: '中性', citations: [C_QS('诸星论')], confidenceLevel: 'A',
    });
  }
  if (ming.stars.some(s => ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(s.name)) && ming.stars.some(s => s.kind === 'major')) hits.push({ ruleId: 'ziwei.geju.shaxiu', title: '煞星守命', fact: `命宫会六煞（${ming.stars.filter(s => ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(s.name)).map(s => s.name).join('、')}）：人生多波折，宜技术立身`, level: '凶', citations: [C_QS('诸星在命宫论')], confidenceLevel: 'A' });

  // 大限方向提示（阳男阴女顺行/阴男阳女逆行由五行局起运）
  const mg = monthGeneralOf(chart);
  if (mg) hits.push({
    ruleId: 'ziwei.dayun.order', title: '大限起运',
    fact: `五行局${chart.fiveElementsClass}，${chart.gender}生（${chart.yearStem}年，${(ganzhiIndex(chart.yearStem + '子') % 2 === 0 ? '阳' : '阴')}年干）→ 大限${(ganzhiIndex(chart.yearStem + '子') % 2 === 0) === (chart.gender === '男') ? '顺行' : '逆行'}；现行大限：${mg.name}（${mg.range}）`,
    level: '中性', citations: [C_QS('安命身宫诀')], confidenceLevel: 'A',
  });

  if (chart.horoscope?.yearly) {
    const y = chart.horoscope.yearly;
    hits.push({
      ruleId: 'ziwei.timing.cross-layer', title: '流年四化（引动）',
      fact: `流年${y.stem}${y.branch}：${y.mutagen.filter(Boolean).join('、')}四化引动（流年四化只引动当年，不改生年格局）。同层四化力量最强，跨层只能引动不能消除。`,
      level: '中性', citations: [C_QS('太岁行事诀')], confidenceLevel: 'A',
    });
  }

  if (chart.degraded) hits.push({
    ruleId: 'ziwei.degraded.nohour', title: '时辰缺失（降级）',
    fact: '未提供出生时辰：命宫与十二宫以早子时假排，宫位与四化不完整——结果仅供参考，强烈建议改用六爻/梅花（不依赖生辰）。绝不反推时辰。',
    level: '变数', citations: [], confidenceLevel: 'D', confidenceExtra: '降级提示，非断语',
  });

  return hits;
}
function monthGeneralOf(chart: ZiweiChart): { name: string; range: string } | null {
  const nowYear = new Date().getFullYear();
  const age = nowYear - chart.normalized.year;
  for (const d of chart.decadal) {
    const [a, b] = d.range.split('-').map(Number);
    if (age >= a && age <= b) return { name: d.name, range: `${a}-${b} 岁` };
  }
  return null;
}

export function ziweiTiming(chart: ZiweiChart): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  out.push({ ruleId: 'ziwei.timing.sengNian', text: '论断次序固定：先看生年四化定格局根基 → 再看大限定十年方向 → 最后流年找具体应期', citations: [C_QS('定五行局诀')], confidenceLevel: 'A' });
  const cur = monthGeneralOf(chart);
  if (cur) out.push({ ruleId: 'ziwei.timing.dayun', text: `现行大限：${cur.name}（${cur.range}）；大限内流年四化引动官禄/财帛/夫妻等宫为应期候选`, citations: [C_QS('太岁行事诀')], confidenceLevel: 'A' });
  if (chart.horoscope?.yearly) out.push({ ruleId: 'ziwei.timing.liunian', text: `流年${chart.horoscope.yearly.stem}${chart.horoscope.yearly.branch}：以流年命宫及其三方四正、流年四化引动之宫为当年重点`, citations: [C_QS('太岁行事诀')], confidenceLevel: 'A' });
  return out;
}

export function ziweiBoard(chart: ZiweiChart): BoardSpec {
  const cells: BoardCell[] = chart.palaces.map(p => ({
    pos: p.index, name: p.name, stem: p.heavenlyStem, branch: p.earthlyBranch,
    stars: p.stars.map(s => ({ name: s.name, brightness: s.brightness, mutagen: s.mutagen, kind: s.kind })),
    marks: [p.decadalRange ? `${p.decadalRange}` : '', p.isBody ? '身宫' : '', p.isOriginal ? '命宫' : ''].filter(Boolean),
    highlight: p.isOriginal || p.isBody,
  }));
  const cur = monthGeneralOf(chart);
  return {
    kind: 'ring', art: 'ziwei',
    title: `紫微命盘 · ${chart.solarDate} ${['早子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '晚子'][chart.timeIndex]}时 ${chart.gender}命`,
    cells,
    info: [
      { label: '五行局', value: chart.fiveElementsClass }, { label: '命主', value: chart.soul }, { label: '身主', value: chart.body },
      { label: '生年四化', value: `${chart.sihua.lu}禄 ${chart.sihua.quan}权 ${chart.sihua.ke}科 ${chart.sihua.ji}忌（${chart.sihua.version}）` },
      ...(chart.sihua.disputed ? [{ label: '⚠ 版本分歧', value: `化科：全集作${chart.sihua.ke}，占验门作${chart.sihua.alternatives?.[0]?.star}（并列不判定，所选版本随记录保存）` }] : []),
      ...(cur ? [{ label: '现行大限', value: `${cur.name}（${cur.range}）` }] : []),
      ...(chart.degraded ? [{ label: '⚠ 降级', value: '时辰缺失，以早子时假排，仅供参考' }] : []),
    ],
    badges: [chart.fiveElementsClass, `${chart.soul}·${chart.body}`, chart.sihua.version],
  };
}

export function ziweiWarnings(chart: ZiweiChart): Warning[] {
  const w: Warning[] = [];
  if (chart.degraded) w.push({ code: 'ziwei/no-hour', message: '时辰缺失：命宫与十二宫不可靠，宫位与四化不完整。建议改用六爻/梅花；本软件不提供反推时辰功能' });
  if (chart.sihua.disputed) w.push({ code: 'ziwei/sihua-version', message: `庚/壬干化科存在版本分歧（全集=${chart.sihua.ke}，占验门=${chart.sihua.alternatives?.[0]?.star}），已按所选版本（${chart.sihua.version}）计算并随记录保存，绝无静默合并` });
  return w;
}

export function ziweiEvidence(chart: ZiweiChart, rules: RuleHit[]): CitationRef[] {
  const seen = new Set<string>(); const out: CitationRef[] = [];
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function ziweiFacts(chart: ZiweiChart, cat: string): FactBundle {
  const ming = chart.palaces.find(p => p.name === '命宫') ?? chart.palaces[0];
  const focus = cat === '感情' ? '夫妻' : cat === '事业' ? '官禄' : cat === '健康' ? '疾厄' : null;
  const facts: FactBundle = {
    facts: [
      { key: 'minggong', label: '命宫', value: `${ming.stars.filter(s => s.kind === 'major').map(s => s.name + (s.brightness ? `(${s.brightness})` : '')).join('、') || '空宫'}（${ming.heavenlyStem}${ming.earthlyBranch}）` },
      { key: 'sihua', label: '生年四化', value: `${chart.sihua.lu}禄/${chart.sihua.quan}权/${chart.sihua.ke}科/${chart.sihua.ji}忌（${chart.sihua.version}${chart.sihua.disputed ? '·有版本分歧' : ''}）` },
      { key: 'wuxingju', label: '五行局', value: chart.fiveElementsClass },
      { key: 'mingshen', label: '命主/身主', value: `${chart.soul} / ${chart.body}` },
    ],
  };
  if (focus) {
    const p = chart.palaces.find(x => x.name === focus);
    if (p) facts.facts.push({ key: 'focus', label: `${focus}宫`, value: `${p.stars.filter(s => s.kind === 'major').map(s => s.name + (s.brightness ? `(${s.brightness})` : '')).join('、') || '空宫（借对宫）'}` });
  }
  const cur = monthGeneralOf(chart);
  if (cur) facts.facts.push({ key: 'dayun', label: '现行大限', value: `${cur.name}（${cur.range}）` });
  return facts;
}

export { SIHUA_QUANJI, SIHUA_ZHANYAN_OVERRIDE, BRIGHTNESS_ORDER, iztroTimeIndex as timeIndexFromHour };
