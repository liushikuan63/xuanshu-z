/** 大六壬（P4）：月将加时、天地盘、四课、三传（九宗门）、遁干、十二天将、课体识别 */
import type { ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput, TimingCandidate, FactBundle } from '../../config/types';
import { normalizeMoment, monthGeneral } from '../../calendar/normalize';
import { DI_ZHI, TIAN_GAN, ganzhiIndex, wushuDun, xunKong } from '../../calendar/ganzhi';
import { cite } from '../../plugins/contract';

export const TIANJIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'] as const;

const DAY_GUI: Record<string, string> = { 甲: '丑', 戊: '丑', 庚: '丑', 乙: '子', 己: '子', 丙: '亥', 丁: '亥', 壬: '巳', 癸: '巳', 辛: '午' };
const NIGHT_GUI: Record<string, string> = { 甲: '未', 戊: '未', 庚: '未', 乙: '申', 己: '申', 丙: '酉', 丁: '酉', 壬: '卯', 癸: '卯', 辛: '寅' };

export interface Kekes { // 课
  label: string;         // 一课/二课/三课/四课
  gan?: string; zhi: string; upper: string; // 上神/下神
}

export interface LiurenChart {
  art: 'liuren';
  yuejiang: string; jiangZhi: string; hourZhi: string;
  heavenPan: Record<string, string>;  // 地支 → 天盘上神
  fourLessons: Kekes[];
  sanChuan: Array<{ label: string; shen: string; diPan: string;遁干: string; tianjiang: string }>;
  keTi: string;                       // 课体（贼克/比用/涉害/遥克/昴星/别责/八专/伏吟/返吟）
  keTiNote: string;
  guiInfo: string;
  shenSha: string[];
  normalized: ReturnType<typeof normalizeMoment>;
  configHash: string;
}

function rotateZhi(from: string, steps: number): number {
  return (DI_ZHI.indexOf(from) + steps) % 12;
}

export function computeLiuren(input: RawInput, cfg: ResolvedConfig, configHash: string): LiurenChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  const minuteOfDay = Math.max(0, input.time.hour) * 60 + input.time.minute;
  const mg = monthGeneral(normalized.jdn, minuteOfDay);
  const hourZhi = xunKongOfDayHour(input.time.hour);
  // 天地盘：月将加时（月将支移到占时支上）
  const heavenPan: Record<string, string> = {};
  const jiangIdx = DI_ZHI.indexOf(mg.zhi);
  const hourIdx = DI_ZHI.indexOf(hourZhi);
  for (let i = 0; i < 12; i++) {
    const di = DI_ZHI[i];                                  // 地盘支
    const tian = DI_ZHI[(jiangIdx + ((i - hourIdx) + 12) % 12) % 12]; // 天盘支
    heavenPan[di] = tian;
  }

  // 四课：一课 日干阳神（干寄宫：甲寄寅 乙寄辰 丙寄巳 丁寄未 戊寄巳 己寄未 庚寄申 辛寄戌 壬寄亥 癸寄丑）
  const ganJiGong: Record<string, string> = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
  const dayGan = normalized.dayPillar[0], dayZhi = normalized.dayPillar[1];
  const ganJi = ganJiGong[dayGan];
  const l1Upper = heavenPan[ganJi], l2Upper = heavenPan[l1Upper];
  const l3Upper = heavenPan[dayZhi], l4Upper = heavenPan[l3Upper];
  const fourLessons: Kekes[] = [
    { label: '一课', gan: dayGan, zhi: ganJi, upper: l1Upper },
    { label: '二课', zhi: l1Upper, upper: l2Upper },
    { label: '三课', zhi: dayZhi, upper: l3Upper },
    { label: '四课', zhi: l3Upper, upper: l4Upper },
  ];

  // 贵人：昼贵/夜贵
  const isDay = input.time.hour >= 5 && input.time.hour < 19;
  const guiZhi = isDay ? DAY_GUI[dayGan] : NIGHT_GUI[dayGan];
  const guiInfo = `${isDay ? '昼贵' : '夜贵'}（${dayGan}日贵人在${guiZhi}）`;

  // 三传（九宗门）
  const { chuan, keTi, keTiNote } = sanChuan(fourLessons, heavenPan, dayGan, dayZhi);

  // 贵人顺逆：贵人在亥子丑寅卯辰（天盘）顺行，巳午未申酉戌逆行
  const guiTianPos = Object.entries(heavenPan).find(([, t]) => t === guiZhi)?.[0] ?? '子';
  const clockwise = ['亥', '子', '丑', '寅', '卯', '辰'].includes(guiTianPos);

  // 伏吟/返吟终判（九宗门优先项）：天地盘全同=伏吟；全对冲=返吟（歌诀见《大六壬大全》八伏吟法/九返吟法）
  const ZHI_ALL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const duiChong = (z: string) => ZHI_ALL[(ZHI_ALL.indexOf(z) + 6) % 12];
  const isFuYin = ZHI_ALL.every(z => heavenPan[z] === z);
  const isFanYin = ZHI_ALL.every(z => heavenPan[z] === duiChong(z));
  const keTiFinal = isFuYin ? '伏吟' : isFanYin ? '返吟' : keTi;
  const keTiNoteFinal = isFuYin ? '天地盘全同为伏吟：主静、事迟滞重复。「伏吟有尅還為用，無尅剛干柔取辰」（发用明细见《大六壬大全·八伏吟法》）'
    : isFanYin ? '天地盘全对冲为返吟：主动荡反复、事至而又起。「返吟有尅亦為用，無尅别有井欄名」（见《大六壬大全·九返吟法》)'
    : keTiNote;
  const sanChuanArr = chuan.map((shen, i) => {
    const diPan = Object.entries(heavenPan).find(([, t]) => t === shen)?.[0] ?? '';
    const dunGan = TIAN_GAN[(wushuDun(dayGan) + DI_ZHI.indexOf(shen)) % 10];
    const jiang = tianjiangOf(shen, guiZhi, clockwise);
    return { label: ['初传', '中传', '末传'][i], shen, diPan, 遁干: dunGan, tianjiang: jiang };
  });

  // 神煞（节选常见）
  const shenSha: string[] = [];
  const dayJiang = heavenPan[dayZhi];
  if (dayJiang) shenSha.push(`日干上神${l1Upper}，日支上神${l3Upper}`);

  return {
    art: 'liuren', yuejiang: mg.general, jiangZhi: mg.zhi, hourZhi, heavenPan,
    fourLessons, sanChuan: sanChuanArr, keTi: keTiFinal, keTiNote: keTiNoteFinal, guiInfo, shenSha,
    normalized, configHash,
  };
}

function xunKongOfDayHour(hour: number): string {
  // 占时（活时用正时）
  return DI_ZHI[hour === 23 ? 0 : Math.floor((hour + 1) / 2) % 12];
}

function tianjiangOf(tianZhi: string, guiZhi: string, clockwise: boolean): string {
  const guiIdx = DI_ZHI.indexOf(guiZhi);
  let offset = (DI_ZHI.indexOf(tianZhi) - guiIdx + 12) % 12;
  if (!clockwise) offset = (12 - offset) % 12;
  return TIANJIANG[offset];
}

function sanChuan(fourLessons: Kekes[], heavenPan: Record<string, string>, dayGan: string, dayZhi: string): { chuan: string[]; keTi: string; keTiNote: string } {
  const WX_OF: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const order = ['木', '火', '土', '金', '水'];
  const ke = (a: string, b: string) => (order.indexOf(WX_OF[a]) + 2) % 5 === order.indexOf(WX_OF[b]); // a 克 b

  // 上神克下神（贼）= 下被上克；下贼上（克）= 下克上 → 贼克法取下贼上为主
  const xiaKeShang: string[] = [];   // 下贼上：下神克上神
  const shangKeXia: string[] = [];
  for (const l of fourLessons) {
    if (ke(l.zhi, l.upper)) xiaKeShang.push(l.upper);
    if (ke(l.upper, l.zhi)) shangKeXia.push(l.upper);
  }

  if (xiaKeShang.length || shangKeXia.length) {
    const cands = xiaKeShang.length ? [...new Set(xiaKeShang)] : [...new Set(shangKeXia)];
    const name = xiaKeShang.length ? (cands.length > 1 ? '比用' : '贼克') : '元首';
    if (cands.length === 1) {
      return { chuan: [cands[0], heavenPan[cands[0]], heavenPan[heavenPan[cands[0]]]], keTi: xiaKeShang.length === 1 && shangKeXia.length === 0 ? '重审' : name, keTiNote: `${cands.length > 1 ? '多课被克，取与日干比用者' : '一课贼克'}：以下贼上为用` };
    }
    // 比用：与日干同阴阳者
    const dayGanYang = TIAN_GAN.indexOf(dayGan) % 2 === 0;
    const yinYangOf = (z: string) => DI_ZHI.indexOf(z) % 2 === 0 ? '阳' : '阴';
    const same = cands.filter(z => (yinYangOf(z) === '阳') === dayGanYang);
    if (same.length === 1) return { chuan: [same[0], heavenPan[same[0]], heavenPan[heavenPan[same[0]]]], keTi: '比用', keTiNote: '两课上神俱被克，取与日干同阴阳者为用' };
    if (same.length > 1) {
      // 涉害：取受克深者（简化：取孟上神）
      const meng = same.find(z => ['寅', '申', '巳', '亥'].includes(z));
      const pick = meng ?? same[0];
      return { chuan: [pick, heavenPan[pick], heavenPan[heavenPan[pick]]], keTi: '涉害', keTiNote: `比用复多，取涉害深者（${meng ? '孟上神' : '首课'}）为用——涉害深浅明细可进分歧台账` };
    }
    // 俱不比 → 涉害
    const first = cands[0];
    return { chuan: [first, heavenPan[first], heavenPan[heavenPan[first]]], keTi: '涉害', keTiNote: '诸课俱不比，取涉害深者（简化：首课）为用' };
  }

  // 无克：遥克（四课上神克日干 / 日干克上神）
  const dayWx = ({ 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' } as Record<string, string>)[dayGan];
  const ups = fourLessons.map(l => l.upper);
  const keDay = ups.filter(u => ke(u, dayWx)); // 上神五行克日干五行（简化）
  const dayKe = ups.filter(u => ke(dayWx, u));
  if (keDay.length) {
    const u = keDay[0];
    return { chuan: [u, heavenPan[u], heavenPan[heavenPan[u]]], keTi: '遥克（蒿矢）', keTiNote: '四课上神克日干，取为用（蒿矢格）' };
  }
  if (dayKe.length) {
    const u = dayKe[0];
    return { chuan: [u, heavenPan[u], heavenPan[heavenPan[u]]], keTi: '遥克（弹射）', keTiNote: '日干克四课上神，取为用（弹射格）' };
  }

  // 昴星：阳日取酉上神为初传，中传取支上神，末传取干上神；阴日取酉下神为初传，中传取干上神，末传取支上神
  const youShang = heavenPan['酉'];
  const dayGanYang = TIAN_GAN.indexOf(dayGan) % 2 === 0;
  const ganShang = fourLessons[0].upper, zhiShang = fourLessons[2].upper;
  if (dayGanYang) {
    return { chuan: [youShang, zhiShang, ganShang], keTi: '昴星（虎视）', keTiNote: '阳日昴星：酉宫上神为初传，支上神为中传，干上神为末传' };
  }
  const youXia = Object.entries(heavenPan).find(([, t]) => t === '酉')?.[0] ?? '酉';
  return { chuan: [youXia, ganShang, zhiShang], keTi: '昴星（冬蛇掩目）', keTiNote: '阴日昴星：天盘酉下神为初传，干上神为中传，支上神为末传' };
}

export function liurenRules(chart: LiurenChart): RuleHit[] {
  const hits: RuleHit[] = [];
  hits.push({
    ruleId: 'liuren.pankai', title: '盘开',
    fact: `月将${chart.yuejiang}（${chart.jiangZhi}）加占时${chart.hourZhi}，天地盘已立；${chart.guiInfo}。`,
    level: '中性', citations: [cite('liuren-daquan', '六壬大全', '一賊尅法', 'liuren-daquan.5.1', '取課先從下賊呼，如無下賊上尅初', 'A')], confidenceLevel: 'A',
  });
  hits.push({
    ruleId: 'liuren.sike', title: '四课',
    fact: chart.fourLessons.map(l => `${l.label}：${l.gan ?? ''}${l.zhi}上见${l.upper}`).join('；'),
    level: '中性', citations: [cite('liuren-daquan', '六壬大全', '十干寄宫', 'liuren-daquan.4.1', '甲課寅兮乙課辰，丙戊課巳不須論', 'A')], confidenceLevel: 'A',
  });
  // ---- R5 扩充：九宗门课体细化（伏吟/返吟/别责/八专；引文出自《大六壬大全》原章）----
  if (chart.keTi === '伏吟' || chart.keTi === '返吟') {
    hits.push({
      ruleId: chart.keTi === '伏吟' ? 'liuren.keti.fuyin' : 'liuren.keti.fanyin', title: `课体：${chart.keTi}`,
      fact: chart.keTi === '伏吟'
        ? '天地盘全同——诸事不动、迟滞重复，宜守旧。「伏吟有尅還為用，無尅剛干柔取辰。迤邐刑之作中末」'
        : '天地盘全对冲——动荡反复、事至又起，往来不定。「返吟有尅亦為用，無尅别有井欄名」',
      level: chart.keTi === '返吟' ? '凶' : '变数',
      citations: [cite('liuren-daquan', '六壬大全', chart.keTi === '伏吟' ? '八伏吟法' : '九返吟法', chart.keTi === '伏吟' ? 'liuren-daquan.12.1' : 'liuren-daquan.13.1', '（《大六壬大全》宗门法原章回链）', 'A')],
      confidenceLevel: 'A',
    });
  }
  const uppers = new Set(chart.fourLessons.map(l => l.upper));
  if (uppers.size === 3) {
    hits.push({
      ruleId: 'liuren.keti.buze', title: '课体备注：四课不全（近别责）',
      fact: '四课不全三课备——若无遥克当以别责法发用。「四課不全三課備，無遥無尅别責例」；本库仅存歌诀，发传明细标「资料不足」，不自动推传。',
      level: '变数',
      citations: [cite('liuren-daquan', '六壬大全', '六别責法', 'liuren-daquan.10.1', '（《大六壬大全》别责法原章回链）', 'A')],
      confidenceLevel: 'A',
    });
  }
  const dayGZ = (chart.fourLessons[0]?.gan ?? '') + (chart.fourLessons[0]?.zhi ?? '');
  if (['甲寅', '庚申', '丁未', '己未'].includes(dayGZ) && uppers.size === 2) {
    hits.push({
      ruleId: 'liuren.keti.bazhuan', title: '课体备注：干支同位（近八专）',
      fact: '干支同位日两课无克——当论八专。「論尅不論遥兩課無尅號八專」；本库仅存歌诀，发传明细标「资料不足」，不自动推传。',
      level: '变数',
      citations: [cite('liuren-daquan', '六壬大全', '七八專法', 'liuren-daquan.11.1', '（《大六壬大全》八专法原章回链）', 'A')],
      confidenceLevel: 'A',
    });
  }
  hits.push({
    ruleId: 'liuren.sanchuan', title: `三传（${chart.keTi}）`,
    fact: `${chart.sanChuan.map(s => `${s.label}${s.shen}（${s.tianjiang}，遁${s.遁干}）`).join('，')}。${chart.keTiNote}`,
    level: '中性', citations: [cite('bianta', '毕法赋', '全文', 'bianta.1.1', '（《毕法赋》逐条对号，见书阁）', 'A')], confidenceLevel: 'A',
  });
  // 毕法赋节选对号
  const first = chart.sanChuan[0];
  if (first) {
    hits.push({
      ruleId: 'bianta.guiche', title: '毕法对号：贵人为传',
      fact: `初传${first.shen}，天将得${first.tianjiang}：${['贵人', '青龙', '六合', '太常', '太阴', '天后'].includes(first.tianjiang) ? '吉将发用，事多顺遂，贵人相助' : '凶将发用，事多阻隔，宜守不宜进'}`,
      level: ['贵人', '青龙', '六合', '太常', '太阴', '天后'].includes(first.tianjiang) ? '吉' : '凶',
      citations: [cite('bianta', '毕法赋', '全文', 'bianta.1.2', '（《毕法赋》原典回链）', 'A')], confidenceLevel: 'A',
    });
  }
  return hits;
}

export function liurenTiming(chart: LiurenChart): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  const first = chart.sanChuan[0];
  if (first) out.push({ ruleId: 'liuren.timing.chuan', text: `初传${first.shen}之值日/值月为期；末传为事之终应之期`, citations: [cite('bianta', '毕法赋', '全文', 'bianta.1.2', '彼求我事支傳干，我求彼事干傳支', 'B')], confidenceLevel: 'B' });
  return out;
}

export function liurenBoard(chart: LiurenChart): BoardSpec {
  const heavenCells = DI_ZHI.map((z, i) => ({
    pos: i, name: z, branch: chart.heavenPan[z],
    marks: [chart.heavenPan[z] === chart.jiangZhi ? '月将' : ''],
  }));
  return {
    kind: 'ring', art: 'liuren',
    title: `大六壬 · 月将${chart.yuejiang}加${chart.hourZhi}时（${chart.keTi}课）`,
    cells: heavenCells as never,
    info: [
      { label: '四课', value: chart.fourLessons.map(l => `${l.zhi}↑${l.upper}`).join(' ') },
      { label: '三传', value: chart.sanChuan.map(s => `${s.shen}(${s.tianjiang})`).join(' → ') },
      { label: '课体', value: `${chart.keTi}：${chart.keTiNote}` },
      { label: '贵人', value: chart.guiInfo },
    ],
  };
}

export function liurenWarnings(): Warning[] {
  return [
    { code: 'liuren/keti', message: '涉害深浅、贵人顺逆等存在流派分歧，取通行口径，分歧可进台账比对' },
    { code: 'liuren/laiyi', message: '「来意占」等高级课体技法无公开可核对黄金样本，系统标「资料不足，仅供参考」' },
  ];
}

export function liurenEvidence(chart: LiurenChart, rules: RuleHit[]): CitationRef[] {
  const out: CitationRef[] = []; const seen = new Set<string>();
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function liurenFacts(chart: LiurenChart, _cat: string): FactBundle {
  return { facts: [
    { key: 'pan', label: '盘', value: `月将${chart.yuejiang}加时${chart.hourZhi}` },
    { key: 'sike', label: '四课', value: chart.fourLessons.map(l => `${l.zhi}↑${l.upper}`).join(' ') },
    { key: 'sanchuan', label: '三传', value: chart.sanChuan.map(s => s.shen).join('→') + `（${chart.keTi}）` },
  ] };
}

export { TIANJIANG as TIANJIANG_TABLE };
