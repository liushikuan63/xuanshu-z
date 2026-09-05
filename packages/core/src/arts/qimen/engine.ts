/** 奇门遁甲（P4）：时家转盘拆补法、阴阳遁、三奇六仪、值符值使、九星八门八神、格局库与四害 */
import type { ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput, TimingCandidate, FactBundle, BoardCell } from '../../config/types';
import { normalizeMoment } from '../../calendar/normalize';
import { DI_ZHI, dayPillarFromJdn, ganzhiIndex, jdnToYmd, liuchong } from '../../calendar/ganzhi';
import { termsOfYear, JIEQI_JIE } from '../../calendar/solarTerms';
import { cite } from '../../plugins/contract';

export const GONG_NAMES = ['坎一', '坤二', '震三', '巽四', '中五', '乾六', '兑七', '艮八', '离九'] as const;
export const NINE_STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'] as const; // 按宫 1-9
export const EIGHT_GATES = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' } as Record<number, string>;
export const EIGHT_GODS = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'] as const;
const YI_ORDER = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']; // 三奇六仪序（戊起）

/** 节气三元局数表（上中下元） */
const JU_TABLE: Record<string, [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [4, 7, 1], 大雪: [4, 7, 1],
};

export const YANG_JIE = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种'];

export interface QimenCell {
  gong: number;           // 1..9
  name: string;
  diGan: string;          // 地盘仪
  tianGan: string;        // 天盘仪/干
  star?: string; gate?: string; god?: string;
  hiddenGan?: string;     // 暗干/隐干
  zhi: string[];          // 宫位地支
  sheng?: string;         // 天盘干十二长生状态（相对地盘干）
  xiaShen?: string;       // 下神（随天盘/值符转的第二层神，如参考图下神：螣蛇/太常/白虎等）
  isTianQin?: boolean;    // 天禽星（标红+禽字）
  isZhifuStar?: boolean;  // 值符星落宫（九星标红）
  isZhishiGate?: boolean; // 值使门落宫（门标红）
  marks: string[];        // 空亡/马星/击刑/入墓/门迫/格局
  isZhifu?: boolean;
}

export interface QimenChart {
  art: 'qimen';
  ju: number; yinYang: '阳遁' | '阴遁'; jieqi: string; yuan: '上元' | '中元' | '下元';
  juMethod: 'chaibu' | 'zhirun' | 'maoshan' | 'nianjia' | 'yuejia';   // 定局法
  juNote?: string;                              // 定局过程说明
  panType: 'zhuan' | 'fei';                     // 排布法（转盘/飞盘）
  timeType: 'shi' | 'ri' | 'yue' | 'nian';      // 时间体系（时家/日家/月家/年家）
  zhifuStar: string; zhifuGate: string; xunShou: string;
  cells: QimenCell[];
  hourPillar: string; dayPillar: string;
  patterns: string[];
  normalized: ReturnType<typeof normalizeMoment>;
  configHash: string;
  /** 年/月家奇门：紫白九星（一白二黑…九紫）供择吉用 */
  ziBai?: Array<{ gong: number; star: string; color: string; level: '吉' | '凶' | '平' }>;
  yearPillar?: string;  // 年家：年干支；月家：年干支
  monthPillar?: string; // 月家：月干支
}

/** 符头（上中下元）：甲己日 + 支（子午卯酉上元、寅申巳亥中元、辰戌丑未下元） */
function determineJu(dayPillar: string): { jieqi: string; yuan: '上元' | '中元' | '下元'; ju: number; yinYang: '阳遁' | '阴遁'; chaibuNote: string } {
  const idx = ganzhiIndex(dayPillar);
  let steps = 0;
  for (let s = 0; s < 10; s++) {
    const g = '甲乙丙丁戊己庚辛壬癸'[(((idx - s) % 60) + 60) % 60 % 10];
    if (g === '甲' || g === '己') { steps = s; break; }
  }
  const touIdx = ((idx - steps) % 60 + 60) % 60;
  const touZhi = '子丑寅卯辰巳午未申酉戌亥'[touIdx % 12];
  const yuan: '上元' | '中元' | '下元' = ['子', '午', '卯', '酉'].includes(touZhi) ? '上元' : ['寅', '申', '巳', '亥'].includes(touZhi) ? '中元' : '下元';
  const { jieqi } = jieqiOfDay(touIdx);
  const yang = YANG_JIE.includes(jieqi);
  const [shang, zhong, xia] = JU_TABLE[jieqi];
  const ju = yuan === '上元' ? shang : yuan === '中元' ? zhong : xia;
  return { jieqi, yuan, ju, yinYang: yang ? '阳遁' : '阴遁', chaibuNote: `符头${'甲乙丙丁戊己庚辛壬癸'[touIdx % 10]}${touZhi}日，${jieqi}${yuan}，${yang ? '阳' : '阴'}遁${ju}局（拆补法）` };
}


/** 置闰法定局（R-奇门扩充）：严格按节气后第一个甲/己日为上元符头。
 *  超神（节气先到、符头未到）→ 接气：继续用上一节气局；
 *  符头到后按距符头天数：0–4 上元 / 5–9 中元 / 10–14 下元 / ≥15 置闰（续用下元）。
 *  与拆补法差异：拆补不管节气与符头错位、直接用当前节气查局。 */
export function determineJuZhirun(jdn: number): { jieqi: string; yuan: string; ju: number; yinYang: '阳遁' | '阴遁'; note: string } {
  const { jieqi, daysInto } = jieqiOfDay(jdn);
  const startJdn = jdn - daysInto;
  let fuTouJdn = startJdn;
  for (let d = 0; d < 10; d++) {
    const gz = dayPillarFromJdn(startJdn + d);
    if (gz[0] === '甲' || gz[0] === '己') { fuTouJdn = startJdn + d; break; }
  }
  const yang = YANG_JIE.includes(jieqi);
  const [shang, zhong, xia] = JU_TABLE[jieqi] ?? [1, 7, 4];
  if (jdn < fuTouJdn) {
    const terms = Object.keys(JU_TABLE);
    const ti = terms.indexOf(jieqi);
    const prev = terms[(ti - 1 + 24) % 24];
    const pVals = JU_TABLE[prev] ?? [1, 7, 4];
    return { jieqi: prev, yuan: '上元（接气）', ju: pVals[0], yinYang: YANG_JIE.includes(prev) ? '阳遁' : '阴遁',
      note: `置闰法：${jieqi}已交但符头未到（超神），接气沿用${prev}上元${pVals[0]}局` };
  }
  const dft = jdn - fuTouJdn;
  const yuan = dft < 5 ? '上元' : dft < 10 ? '中元' : dft < 15 ? '下元' : '置闰（续下元）';
  const ju = dft < 5 ? shang : dft < 10 ? zhong : xia;
  return { jieqi, yuan, ju, yinYang: yang ? '阳遁' : '阴遁',
    note: `置闰法：${jieqi}${yuan}${ju}局，符头${dayPillarFromJdn(fuTouJdn)}日（距${dft}天）` };
}
let cachedTerms: { year: number; list: Array<{ name: string; jd: number; minutes: number }> } | null = null;
export function jieqiOfDay(jdn: number): { jieqi: string; daysInto: number } {
  const y = jdnToYmd(jdn).y;
  if (!cachedTerms || cachedTerms.year !== y) {
    cachedTerms = { year: y, list: termsOfYear(y).concat(termsOfYear(y - 1)).map(t => ({ name: t.name, jd: t.jd, minutes: t.minutes })) };
  }
  let best = { name: '冬至', jd: -1, minutes: 0 };
  for (const t of cachedTerms.list) {
    if (t.jd < jdn || (t.jd === jdn && t.minutes <= 720)) {
      if (t.jd > best.jd) best = t;
    }
  }
  return { jieqi: best.name, daysInto: jdn - best.jd };
}

/** 茅山法定局（R-奇门扩充）：完全以实际节气为界，不用符头。
 *  从交节时刻起：前 60 个时辰（5 天）为上元，次 60 个时辰为中元，
 *  120 个时辰（10 天）之后全部归下元。日干支只影响阴/阳遁之外
 *  的局数查表，不影响元序（下元可能多于 60 时辰）。
 *  与拆补/置闰差异：置闰保三元完整但节气会超前/落后；拆补保证节气一致
 *  但上中下顺序会被「拆补」打乱；茅山法与节气完全对齐且顺序不乱，
 *  代价是忽略符头与日干支的对应关系。 */
export function determineJuMaoshan(jdn: number, hour: number): { jieqi: string; yuan: '上元' | '中元' | '下元'; ju: number; yinYang: '阳遁' | '阴遁'; note: string } {
  const { jieqi, daysInto } = jieqiOfDay(jdn);
  const shichenIdx = Math.floor((hour + 1) / 2) % 12; // 0=子 11=亥
  const totalShichen = daysInto * 12 + shichenIdx;    // 自交节时辰起第几个时辰
  const yang = YANG_JIE.includes(jieqi);
  const [shang, zhong, xia] = JU_TABLE[jieqi] ?? [1, 7, 4];
  const yuan: '上元' | '中元' | '下元' = totalShichen < 60 ? '上元' : totalShichen < 120 ? '中元' : '下元';
  const ju = yuan === '上元' ? shang : yuan === '中元' ? zhong : xia;
  return { jieqi, yuan, ju, yinYang: yang ? '阳遁' : '阴遁',
    note: `茅山法：${jieqi}${yuan}${ju}局（交节起第 ${totalShichen} 个时辰，前60=上元/次60=中元/后归下元，不取符头）` };
}

/** 旬首：时辰干支 → 六甲旬首仪 */
function xunShouYi(hourPillar: string): { xunShou: string; yi: string } {
  const idx = ganzhiIndex(hourPillar);
  const xunStart = idx - (idx % 10);
  const names = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];
  const yis = ['戊', '己', '庚', '辛', '壬', '癸'];
  const xi = Math.floor(xunStart / 10);
  return { xunShou: names[xi], yi: yis[xi] };
}

const STAR_GONG: Record<string, number> = { 天蓬: 1, 天芮: 2, 天冲: 3, 天辅: 4, 天禽: 5, 天心: 6, 天柱: 7, 天任: 8, 天英: 9 };
const GATE_GONG: Record<string, number> = { 休门: 1, 死门: 2, 伤门: 3, 杜门: 4, 开门: 6, 惊门: 7, 生门: 8, 景门: 9 };
const GONG_WX: Record<number, string> = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
const GATE_WX: Record<string, string> = { 休门: '水', 死门: '土', 伤门: '木', 杜门: '木', 开门: '金', 惊门: '金', 生门: '土', 景门: '火' };
/** 转盘顺时针宫序：1→8→3→4→9→2→7→6→(1) */
const CW = [1, 8, 3, 4, 9, 2, 7, 6];
const CW_STARS = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];
const CW_GATES = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];

/** 飞盘（飞宫法）：洛书宫数序 1–9；阳遁顺飞 1→9，阴遁逆飞 9→1（跳中五时阳 4→6、阴 6→4） */
const FEI_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const FEI_STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英']; // 按宫数 1–9
const FEI_GATES = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'];          // 按宫数 1,2,3,4,6,7,8,9
const FEI_GATE_GONG = [1, 2, 3, 4, 6, 7, 8, 9];
/** 飞盘九神：阳遁（值符·螣蛇·太阴·六合·勾陈·太常·朱雀·九地·九天）；阴遁白虎/玄武替勾陈/朱雀 */
const FEI_GODS = ['值符', '螣蛇', '太阴', '六合', '勾陈', '太常', '朱雀', '九地', '九天'];
const FEI_GODS_YIN = ['值符', '螣蛇', '太阴', '六合', '白虎', '太常', '玄武', '九地', '九天'];

/** 宫位对应地支（用于空亡/马星标记）：坎1子、艮8丑寅、震3卯、巽4辰巳、离9午、坤2未申、兑7酉、乾6戌亥 */
const GONG_ZHI: Record<number, string[]> = {
  1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'], 9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'], 5: [],
};

/** 十二长生表（天干 × 地支 → 长生状态名） */
const SHI_ER_CHANG_SHENG: Record<string, string[]> = {
  // [长生,沐浴,冠带,临官,帝旺,衰,病,死,墓,绝,胎,养]  按地支 子..亥
  甲: ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
  丙: ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  戊: ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  庚: ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
  壬: ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
  乙: ['午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未'],
  丁: ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'],
  己: ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'],
  辛: ['子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑'],
  癸: ['卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰'],
};
const SHENG_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
/** 根据天干+地支求十二长生状态（含简版旺衰：旺相休囚死=帝旺临官为旺、长生冠带为相、衰养为休、病沐浴为囚、死墓绝胎为死） */
function shengOf(gan: string, zhi?: string): { name: string; level: '旺' | '相' | '休' | '囚' | '死' | '没' | '废' | '胎' } {
  if (!zhi || !SHI_ER_CHANG_SHENG[gan]) return { name: '—', level: '休' };
  const idx = SHI_ER_CHANG_SHENG[gan].indexOf(zhi);
  const name = idx < 0 ? '—' : SHENG_NAMES[idx];
  const lvlMap: Record<string, '旺' | '相' | '休' | '囚' | '死' | '没' | '废' | '胎'> = {
    帝旺: '旺', 临官: '相', 长生: '相', 冠带: '休', 衰: '休', 养: '休',
    病: '囚', 沐浴: '囚', 死: '死', 墓: '没', 绝: '废', 胎: '胎',
  };
  return { name, level: lvlMap[name] ?? '休' };
}
/** 奇门简版"废休旺相囚死没胎"：按地盘支对天盘干的十二长生转义
 *  参考图所标：废(绝)、休(休/养/衰)、旺(帝旺)、相(临官/长生)、囚(病/沐浴)、死(死)、没(墓)、胎(胎) */
function shengLevelOfCell(tianGan: string, zhiList: string[]): string {
  if (!tianGan || !zhiList.length) return '';
  const z = zhiList[0];
  const { level } = shengOf(tianGan, z);
  return level; // 废/休/旺/相/囚/死/没/胎
}

/** 隐干（暗干）：八门本位地盘干 → 阳顺阴逆布于各宫（天盘门之所临，即该门本位地盘干）
 *  另法：值符所带之干=时干，其余随八神顺布；此处采用"门本位地盘干=暗干"的主流鸣法系。 */
function computeHiddenGans(tianGate: Record<number, string>, dipan: Record<number, string>,
  yang: boolean, zhongJi: number): Record<number, string> {
  const gateToHomeGong: Record<string, number> = { 休门: 1, 死门: 2, 伤门: 3, 杜门: 4, 开门: 6, 惊门: 7, 生门: 8, 景门: 9 };
  const gongs = yang ? [1, 8, 3, 4, 9, 2, 7, 6] : [1, 6, 7, 2, 9, 4, 3, 8]; // 阳顺/阴逆（八门跳中五）
  void gongs;
  const out: Record<number, string> = {};
  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const gate = tianGate[g];
    if (gate && gateToHomeGong[gate]) {
      const homeG = gateToHomeGong[gate];
      const homeDi = dipan[homeG] ?? dipan[zhongJi];
      out[g] = homeDi[0] ?? homeDi;
    }
  }
  return out;
}

/** 下神（第二层神，飞盘+转盘皆有）：八神阳顺阴逆，自值符星落宫起第二轮布神；
 *  参考图：上神=值符/九地/太常… 下神=螣蛇/太常/六合/太阴/玄武/白虎/九天… */
function computeXiaShen(gods: Record<number, string>, zhifuGong: number,
  yang: boolean, panType: 'zhuan' | 'fei', zhongJi: number): Record<number, string> {
  const out: Record<number, string> = {};
  const count = panType === 'fei' ? 9 : 8;
  const shen = panType === 'fei'
    ? (yang ? FEI_GODS : FEI_GODS_YIN)
    : EIGHT_GODS;
  const cw: number[] = panType === 'fei'
    ? (yang ? FEI_ORDER : [...FEI_ORDER].reverse())
    : CW;
  const start = cw.indexOf(zhifuGong === 5 ? zhongJi : zhifuGong);
  for (let i = 0; i < count; i++) {
    const pos = (start + i) % cw.length;
    const gong = cw[pos];
    out[gong] = shen[(i + 1) % shen.length];
  }
  return out;
}

// ---- R-年家/月家奇门：定局辅助（统宗·年家奇门卷） ----
/** 年家奇门定局：60年一元，三元180年循环。
 *  上元坎1起甲子戊、中元巽4起、下元兑7起；天道左旋→只用阴遁。
 *  黄帝纪元(前2697甲子)为上元起；以 (公元年+2697) mod 180 分元。 */
export function determineJuNianjia(yearPillar: string, year: number): {
  jieqi: string; yuan: '上元' | '中元' | '下元'; ju: number; yinYang: '阴遁';
  note: string; ziBaiZhong: number; // 紫白九星入中宫（1白/4绿/7赤）
} {
  const cycle180 = ((year + 2697) % 180 + 180) % 180;
  const yuan: '上元' | '中元' | '下元' = cycle180 < 60 ? '上元' : cycle180 < 120 ? '中元' : '下元';
  const ju = yuan === '上元' ? 1 : yuan === '中元' ? 4 : 7;
  const ziBaiZhong = yuan === '上元' ? 1 : yuan === '中元' ? 4 : 7;
  const juDesc = { '上元': '坎一宫起甲子戊（阴遁1局·紫白1白入中）', '中元': '巽四宫起甲子戊（阴遁4局·紫白4绿入中）', '下元': '兑七宫起甲子戊（阴遁7局·紫白7赤入中）' }[yuan];
  return {
    jieqi: `年家·${yearPillar}年`, yuan, ju, yinYang: '阴遁',
    ziBaiZhong,
    note: `年家奇门：${yearPillar}（公元${year}）属${yuan}，${juDesc}。天道左旋，统一用阴遁逆布六仪顺布三奇。三元180年一循环（(年+2697)%180 = ${cycle180}）。`,
  };
}
/** 月家奇门定局：5年(60月)一元；年支四孟(寅申巳亥)上元坎1、
 *  四仲(子午卯酉)中元兑7、四季(辰戌丑未)下元巽4。统一用阴遁。 */
export function determineJuYuejia(yearPillar: string, monthPillar: string): {
  jieqi: string; yuan: '上元' | '中元' | '下元'; ju: number; yinYang: '阴遁';
  note: string; ziBaiZhong: number; // 孟年正月2黑/仲年正月8白/季年正月5黄
} {
  const z = yearPillar[1];
  const isMeng = ['寅', '申', '巳', '亥'].includes(z);
  const isZhong = ['子', '午', '卯', '酉'].includes(z);
  const yuan: '上元' | '中元' | '下元' = isMeng ? '上元' : isZhong ? '中元' : '下元';
  const ju = yuan === '上元' ? 1 : yuan === '中元' ? 7 : 4; // 注意：月家 上1/中7/下4（不同于年家上1/中4/下7）
  const monthIdx = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'].indexOf(monthPillar[1]);
  const startZibai = isMeng ? 2 /* 二黑 */ : isZhong ? 8 /* 八白 */ : 5 /* 五黄 */;
  // 紫白从正月寅月开始，月支顺推→星顺飞（加monthIdx）
  const ziBaiZhong = ((startZibai - 1 + monthIdx) % 9 + 9) % 9 + 1;
  const yuanDesc = { '上元': `寅申巳亥孟年·上元·坎一宫起甲子戊（阴遁1局）`, '中元': `子午卯酉仲年·中元·兑七宫起甲子戊（阴遁7局）`, '下元': `辰戌丑未季年·下元·巽四宫起甲子戊（阴遁4局）` }[yuan];
  return {
    jieqi: `月家·${yearPillar}年${monthPillar}月`, yuan, ju, yinYang: '阴遁',
    ziBaiZhong,
    note: `月家奇门：${yearPillar}年${monthPillar}月属${yuan}，${yuanDesc}。统一用阴遁。本月紫白${ziBaiZhong}入中宫。`,
  };
}
/** 按洛书飞布紫白九星：ziBaiZhong=入中宫的星数(1-9)，阳顺飞 */
export function flyZiBai(zhong: number): Array<{ gong: number; star: string; color: string; level: '吉' | '凶' | '平' }> {
  const ziBaiName = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];
  const ziBaiColor = ['#cfd8ea', '#222', '#2f9d5a', '#3aaa55', '#caa04d', '#e6e6e6', '#d44', '#eee', '#a03b8e'];
  const ziBaiLevel: Array<'吉' | '凶' | '平'> = ['吉', '凶', '平', '吉', '凶', '吉', '凶', '吉', '平']; // 1/4/6/8白吉星，五黄二黑七赤煞
  const LUOSHU_9GONG = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const result = [];
  for (let i = 0; i < 9; i++) {
    const g = LUOSHU_9GONG[i];
    const starIdx = ((zhong - 1) + (LUOSHU_9GONG.indexOf(g) - LUOSHU_9GONG.indexOf(5) + 9) % 9) % 9;
    result.push({ gong: g, star: ziBaiName[starIdx], color: ziBaiColor[starIdx], level: ziBaiLevel[starIdx] });
  }
  return result;
}

export function computeQimen(input: RawInput, cfg: ResolvedConfig, configHash: string): QimenChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  const timeType: 'shi' | 'ri' | 'yue' | 'nian' = (cfg.paipan?.qimenTimeType as any) ?? 'shi';
  const hourPillar = normalized.hourPillar;
  const yearPillar = normalized.yearPillar;
  const monthPillar = normalized.monthPillar;

  // ====== 年家/月家奇门 入口分支 ======
  if (timeType === 'nian' || timeType === 'yue') {
    const nj = timeType === 'nian'
      ? determineJuNianjia(yearPillar, normalized.year)
      : determineJuYuejia(yearPillar, monthPillar);
    const { ju, yinYang, yuan, jieqi, note, ziBaiZhong } = nj;
    const yang = false; // 年/月家统一阴遁
    const refPillar = timeType === 'nian' ? yearPillar : monthPillar;
    const { xunShou, yi } = xunShouYi(refPillar);
    const seq = YI_ORDER; // 戊己庚辛壬癸丁丙乙
    const zhongJi = cfg.paipan?.qimenZhongJi === 'gen' ? 8 : 2;
    const panType: 'zhuan' | 'fei' = cfg.paipan?.qimenPanType ?? 'zhuan';
    // 地盘：阴遁逆布六仪（戊起ju宫）
    const dipan: Record<number, string> = {};
    {
      const arr: Array<[number, string]> = [];
      let g = ju;
      for (let i = 0; i < 9; i++) { arr.push([g, seq[i]]); g = g === 1 ? 9 : g - 1; }
      for (const [gg, y] of arr) dipan[gg] = y;
      if (dipan[5] !== undefined) { dipan[zhongJi] = dipan[zhongJi] + dipan[5]; }
    }
    const findGongOfYi = (y: string): number => {
      for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) if (dipan[g] === y) return g;
      return zhongJi;
    };
    const xsGong = findGongOfYi(yi);
    const zhifuStar = NINE_STARS[xsGong - 1];
    // 值符随年/月干：年干/月干对应地盘仪→值符星落该宫
    const refGan = refPillar[0];
    const ganToYi: Record<string, string> = { 甲: yi };
    const refYi = ganToYi[refGan] ?? refGan;
    const targetGong = refYi === '甲' ? xsGong : findGongOfYi(refYi);
    // 值使随年/月支：年/月支所在宫→值使门加临此宫
    const ZHI_GONG: Record<string, number> = { 子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6 };
    const refZhi = refPillar[1];
    const zhishiGong = ZHI_GONG[refZhi] ?? 1;
    const yinYangGanShun: Record<string, boolean> = { 甲: true, 丙: true, 戊: true, 庚: true, 壬: true, 乙: false, 丁: false, 己: false, 辛: false, 癸: false };
    const isYangGan = yinYangGanShun[refGan] ?? true;

    // 布置九星/八门/奇仪/八神：按时家转盘/飞盘的规则模拟
    // 值符星→refGan宫，值使门→refZhi宫，余星/门按顺/逆（阳年顺，阴年逆，转盘用CW顺序）
    const tianStar: Record<number, string> = {};
    const tianYi: Record<number, string> = {};
    const tianGate: Record<number, string> = {};
    const gods: Record<number, string> = {};
    const xsIdxInCw = CW.indexOf(xsGong === 5 ? zhongJi : xsGong);
    const stepForGan = isYangGan ? 1 : -1; // 阳年/阳月干顺布，阴年阴月干逆布
    // 天盘仪：值符(旬首仪=yi)加临 refGan 对应的地盘仪宫→即 targetGong；其余仪按转盘阳顺阴逆
    const targetIdxInCw = CW.indexOf(targetGong === 5 ? zhongJi : targetGong);
    for (let i = 0; i < 8; i++) {
      const srcGong = CW[(xsIdxInCw + (isYangGan ? i : 8 - i)) % 8];
      const dstGong = CW[(targetIdxInCw + i) % 8];
      tianYi[dstGong] = dipan[srcGong]?.[0] ?? dipan[srcGong];
      tianStar[dstGong] = NINE_STARS[(srcGong === 5 ? zhongJi : srcGong) - 1];
    }
    // 值使门：zhifuGate 加到 zhishiGong（按CW序，阳顺阴逆排剩余7门）
    const zsGateName = zhifuStar === '天禽' ? '死门' : (Object.entries(GATE_GONG).find(([, g]) => g === (xsGong === 5 ? zhongJi : xsGong))?.[0] ?? '死门');
    const zsIdxInGates8 = CW_GATES.indexOf(zsGateName);
    const zsTargetIdxInCw = CW.indexOf(zhishiGong === 5 ? zhongJi : zhishiGong);
    for (let i = 0; i < 8; i++) {
      const gateIdx = (zsIdxInGates8 + (isYangGan ? i : 8 - i) + 8) % 8;
      const dstGong = CW[(zsTargetIdxInCw + i) % 8];
      tianGate[dstGong] = CW_GATES[gateIdx];
    }
    // 八神：值符→值符星落宫(targetGong)，其余按阴遁逆布
    const zhifuGongForGods = targetGong === 5 ? zhongJi : targetGong;
    const zsGodIdx = CW.indexOf(zhifuGongForGods);
    for (let i = 0; i < 8; i++) {
      const g = CW[(zsGodIdx + i) % 8];
      gods[g] = EIGHT_GODS[i]; // 年/月家八神：阳顺阴逆这里统一用顺；核心是值符定位
    }
    void stepForGan;
    // 计算隐干、下神、十二长生、四害、cells
    const hiddenGans = computeHiddenGans(tianGate, dipan, yang, zhongJi);
    const xiaShen = computeXiaShen(gods, zhifuGongForGods, yang, 'zhuan', zhongJi);
    const kongZhi = xunKongOf(refPillar);
    const refZhi2 = refPillar[1];
    const ma = ({ 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' } as Record<string, string>)[refZhi2] ?? '';
    const cells: QimenCell[] = [1, 2, 3, 4, 6, 7, 8, 9].map(g => {
      const dg = dipan[g]?.[0] ?? dipan[g] ?? '';
      const tg = tianYi[g] ?? '';
      const zhi = GONG_ZHI[g] ?? [];
      const marks: string[] = [];
      if (zhi.some(z => kongZhi.includes(z))) marks.push('空亡');
      if (ma && zhi.includes(ma)) marks.push('马星');
      const xing: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
      if (tg && xing[tg] === g) marks.push('击刑');
      if ((tg === '乙' || tg === '丙') && g === 6) marks.push('入墓');
      if (tg === '丁' && g === 8) marks.push('入墓');
      const gate = tianGate[g];
      if (gate && GONG_WX[g] && GATE_WX[gate]) {
        const order = ['木', '火', '土', '金', '水'];
        if ((order.indexOf(GATE_WX[gate]) + 2) % 5 === order.indexOf(GONG_WX[g])) marks.push('门迫');
      }
      const star = tianStar[g];
      return {
        gong: g, name: GONG_NAMES[g - 1], diGan: dg, tianGan: tg,
        star, gate, god: gods[g] ?? '', hiddenGan: hiddenGans[g],
        zhi, sheng: shengLevelOfCell(tg, zhi),
        xiaShen: xiaShen[g],
        isTianQin: star === '天禽',
        isZhifuStar: g === (targetGong === 5 ? zhongJi : targetGong),
        isZhishiGate: g === (zhishiGong === 5 ? zhongJi : zhishiGong),
        marks, isZhifu: g === (targetGong === 5 ? zhongJi : targetGong),
      };
    });
    // 格局
    const patterns: string[] = [];
    const allFu = cells.every(c => !c.tianGan || c.tianGan === c.diGan);
    if (allFu) patterns.push(timeType === 'nian' ? '年家伏吟局（流年主静守）' : '月家伏吟局（流月主迟滞）');
    // 紫白九星
    const ziBai = flyZiBai(ziBaiZhong);
    patterns.push(`${timeType === 'nian' ? '年家' : '月家'}奇门·紫白：五黄在${ziBai.find(z => z.star === '五黄')?.gong ?? 0}宫（注意此方），三白在${ziBai.filter(z => ['一白', '六白', '八白'].includes(z.star)).map(z => z.gong + '宫').join('·') || ''}（三白吉方）`);
    return {
      art: 'qimen', ju, yinYang, jieqi, yuan,
      juMethod: timeType === 'nian' ? 'nianjia' : 'yuejia',
      juNote: note, panType, timeType,
      zhifuStar, zhifuGate: zsGateName, xunShou,
      cells, hourPillar, dayPillar: normalized.dayPillar,
      patterns, normalized, configHash, ziBai,
      yearPillar, monthPillar,
    };
  }

  // ====== 时家奇门：原流程 ======
  const juMethod: 'chaibu' | 'zhirun' | 'maoshan' = cfg.paipan?.qimenJuMethod ?? 'chaibu';
  const panType: 'zhuan' | 'fei' = cfg.paipan?.qimenPanType ?? 'zhuan';
  const zr = juMethod === 'zhirun' ? determineJuZhirun(normalized.jdn) : null;
  const ms = juMethod === 'maoshan' ? determineJuMaoshan(normalized.jdn, normalized.hour) : null;
  const cb = juMethod === 'chaibu' ? determineJu(normalized.dayPillar) : null;
  const jieqi = zr ? zr.jieqi : ms ? ms.jieqi : (cb as ReturnType<typeof determineJu>).jieqi;
  const yuan: '上元' | '中元' | '下元' = zr ? (zr.yuan as '上元' | '中元' | '下元') : ms ? ms.yuan : (cb as ReturnType<typeof determineJu>).yuan;
  const ju = zr ? zr.ju : ms ? ms.ju : (cb as ReturnType<typeof determineJu>).ju;
  const yinYang = zr ? zr.yinYang : ms ? ms.yinYang : (cb as ReturnType<typeof determineJu>).yinYang;
  const juNote = zr ? zr.note : ms ? ms.note : (cb as ReturnType<typeof determineJu>).chaibuNote;
  const { xunShou, yi } = xunShouYi(hourPillar);
  void yi;
  const yang = yinYang === '阳遁';

  // 地盘：戊落局宫，阳顺阴逆布九仪（跳中五或寄宫）
  const diGan: Record<number, string> = {};
  const seq = YI_ORDER; // 戊己庚辛壬癸丁丙乙
  let gong = ju;
  for (let i = 0; i < 9; i++) {
    diGan[gong] = seq[i];
    if (yang) gong = gong === 9 ? 1 : gong + 1;
    else gong = gong === 1 ? 9 : gong - 1;
  }
  void diGan;

  // 地盘仪按宫 1-9 顺序（含中五寄坤二 or 艮八）
  const zhongJi = cfg.paipan?.qimenZhongJi === 'gen' ? 8 : 2;
  const dipan: Record<number, string> = {};
  {
    const arr: Array<[number, string]> = [];
    let g = ju;
    for (let i = 0; i < 9; i++) {
      arr.push([g, seq[i]]);
      g = yang ? (g % 9) + 1 : g === 1 ? 9 : g - 1;
    }
    for (const [gg, y] of arr) dipan[gg] = y;
    if (dipan[5] !== undefined) { dipan[zhongJi] = dipan[zhongJi] + dipan[5]; }
  }

  // 旬首宫（仪所在宫）→ 值符星 / 值使门
  const xunShouGong = Object.entries(dipan).find(([g, y]) => y === yi || (typeof y === 'string' && y.split('').includes(yi)))?.[0] ? Number(Object.entries(dipan).find(([g, y]) => y === yi)![0]) : 1;
  void xunShouGong;
  const findGongOfYi = (y: string): number => {
    for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) if (dipan[g] === y) return g;
    return zhongJi;
  };
  const xsGong = findGongOfYi(yi);
  const zhifuStar = NINE_STARS[xsGong - 1];
  const zhifuGate = zhifuStar === '天禽' ? '死门' : (Object.entries(GATE_GONG).find(([, g]) => g === xsGong)?.[0] ?? '死门');
  // 值使门所在宫：值符星宫对应门（宫 5 无门 → 寄宫门）
  const zhifuGateActual = xsGong === 5 ? (zhongJi === 2 ? '死门' : '生门') : Object.entries(GATE_GONG).find(([, g]) => g === xsGong)![0];

  // 天盘：值符随时干（时干所在宫）
  const hourGan = hourPillar[0];
  const ganToYi: Record<string, string> = { 甲: yi }; // 六甲遁仪
  const timeYi = ganToYi[hourGan] ?? hourGan; // 时干若为仪/奇直接用
  const targetGong = timeYi === '甲' ? xsGong : findGongOfYi(timeYi);

  const tianStar: Record<number, string> = {};
  const tianYi: Record<number, string> = {};
  const tianGate: Record<number, string> = {};
  const gods: Record<number, string> = {};
  const hourIdxInXun = ((ganzhiIndex(hourPillar) % 60) % 10); // 时辰在旬内序 0..9

  if (panType === 'fei') {
    // ---- 飞盘（飞宫法）：星、门、神皆按洛书宫数序飞，阳遁顺飞 1→9、阴遁逆飞 9→1 ----
    // 九星：值符星落时干宫，其余星按 FEI_STARS（蓬芮冲辅禽心柱任英）接续飞；天盘干=星原宫地盘干
    {
      const starHome = (si: number) => ((si % 9) + 1);
      const zhifuStarIdx = FEI_STARS.indexOf(zhifuStar);
      const seq = yang ? FEI_ORDER : [...FEI_ORDER].reverse();
      const gongPos = seq.indexOf(targetGong);
      for (let i = 0; i < 9; i++) {
        const g = seq[(gongPos + i) % 9];
        const si = (zhifuStarIdx + i) % 9;
        const g2 = starHome(si);
        tianStar[g] = FEI_STARS[si];
        tianYi[g] = g2 === 5 ? (dipan[5] ?? dipan[zhongJi]) : (dipan[g2] ?? dipan[zhongJi]);
      }
    }
    // 八门：值使门从旬首宫起按飞序走 hourIdxInXun 步（跳过中五），其余门按 FEI_GATES 接续
    {
      const feiGateSeq = yang ? [...FEI_GATE_GONG] : [...FEI_GATE_GONG].reverse();
      let startIdx = feiGateSeq.indexOf(xsGong === 5 ? zhongJi : xsGong);
      if (startIdx < 0) startIdx = 0;
      const destGong = feiGateSeq[(startIdx + hourIdxInXun) % 8];
      const destPos = feiGateSeq.indexOf(destGong);
      const zi = FEI_GATES.indexOf(zhifuGateActual);
      for (let i = 0; i < 8; i++) {
        tianGate[feiGateSeq[(destPos + i) % 8]] = FEI_GATES[(zi + i) % 8];
      }
    }
    // 九神：值符落时干宫，其余九神按飞序（阳顺阴逆）布于九宫
    {
      const seq = yang ? FEI_ORDER : [...FEI_ORDER].reverse();
      const godArr = yang ? FEI_GODS : FEI_GODS_YIN;
      const gongPos = seq.indexOf(targetGong);
      for (let i = 0; i < 9; i++) gods[seq[(gongPos + i) % 9]] = godArr[i];
    }
  } else {
    // ---- 转盘（排宫法）：九星、八门顺时针齐转，八神阳顺阴逆 ----
    // 转盘：把值符星转到时干宫，其余星按顺时针排
    const xsPos = CW.indexOf(xsGong === 5 ? zhongJi : xsGong);
    const tgtPos = CW.indexOf(targetGong === 5 ? zhongJi : targetGong);
    for (let i = 0; i < 8; i++) {
      const srcGongIdx = (xsPos + i) % 8;
      const dstGong = CW[(tgtPos + i) % 8];
      const srcGong = CW[srcGongIdx];
      tianStar[dstGong] = CW_STARS[srcGongIdx];
      tianYi[dstGong] = dipan[srcGong] ?? dipan[zhongJi];
    }
    // 天禽寄宫处理：中宫仪寄 zhongJi
    if (dipan[5]) tianYi[zhongJi] = dipan[5];

    // 门盘：值使随时宫（按宫序飞，阳顺阴逆）
    const gongSeq: number[] = [];
    for (let g = yang ? 1 : 9; yang ? g <= 9 : g >= 1; yang ? g++ : g--) gongSeq.push(g);
    let startIdx = gongSeq.indexOf(xsGong === 5 ? zhongJi : xsGong);
    if (startIdx < 0) startIdx = 0;
    const destGong = gongSeq[(startIdx + hourIdxInXun) % 9];
    const gatePos = CW_GATES.indexOf(zhifuGateActual);
    const destPos = CW.indexOf(destGong === 5 ? zhongJi : destGong);
    for (let i = 0; i < 8; i++) {
      const srcGate = CW_GATES[(gatePos + i) % 8];
      const dstGong = CW[(destPos + i) % 8];
      tianGate[dstGong] = srcGate;
    }

    // 八神：阳遁顺时针、阴遁逆时针，值符落时干宫
    const godStart = tgtPos;
    for (let i = 0; i < 8; i++) {
      const gongIdx = yang ? (godStart + i) % 8 : ((godStart - i) % 8 + 8) % 8;
      gods[CW[gongIdx]] = EIGHT_GODS[i];
    }
  }

  // ---- 计算隐干（暗干）、下神（第二层神）、值符星/值使门落宫 ----
  const hiddenGans = computeHiddenGans(tianGate, dipan, yang, zhongJi);
  const zhifuStarGong = Object.entries(tianStar).find(([, s]) => s === zhifuStar)?.[0]
    ?? Object.keys(dipan).find(g => tianStar[Number(g)] === zhifuStar) ?? String(targetGong);
  const zhishiGateGong = Object.entries(tianGate).find(([, g]) => g === zhifuGateActual)?.[0]
    ?? Object.keys(dipan).find(g => tianGate[Number(g)] === zhifuGateActual) ?? '0';
  void zhifuStarGong;
  const xiaShen = computeXiaShen(gods, targetGong, yang, panType, zhongJi);
  const zsGong = targetGong;

  // 组装 + 四害/格局
  const cells: QimenCell[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => {
    const marks: string[] = [];
    const tg = tianYi[g] ?? '';
    const dg = dipan[g] ?? '';
    const zhi = GONG_ZHI[g] ?? [];
    // 空亡（时辰旬空）
    const kong = xunKongOf(hourPillar);
    if (zhi.some(z => kong.includes(z))) marks.push('空亡');
    // 马星
    const hourZhi = hourPillar[1];
    const ma = ({ 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' } as Record<string, string>)[hourZhi];
    if (ma && zhi.includes(ma)) marks.push('马星');
    // 击刑（六仪击刑）
    const xing: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
    if (tg && xing[tg] === g) marks.push('击刑');
    // 入墓（三奇入墓：乙丙入乾6(戌)、丁入艮8(丑)）
    if ((tg === '乙' || tg === '丙') && g === 6) marks.push('入墓');
    if (tg === '丁' && g === 8) marks.push('入墓');
    // 门迫
    const gate = tianGate[g];
    if (gate && GONG_WX[g] && GATE_WX[gate]) {
      const order = ['木', '火', '土', '金', '水'];
      if ((order.indexOf(GATE_WX[gate]) + 2) % 5 === order.indexOf(GONG_WX[g])) marks.push('门迫');
    }
    const star = tianStar[g] ?? (g === 5 ? '天禽' : undefined);
    return {
      gong: g, name: GONG_NAMES[g - 1], diGan: dg, tianGan: tg,
      star, gate,
      god: gods[g] ?? (g === 5 ? undefined : ''),
      hiddenGan: hiddenGans[g],
      zhi,
      sheng: shengLevelOfCell(tg, zhi),
      xiaShen: xiaShen[g],
      isTianQin: star === '天禽',
      isZhifuStar: g === zsGong,                 // 值符星落宫（九星标红）
      isZhishiGate: g === Number(zhishiGateGong), // 值使门落宫（门标红）
      marks, isZhifu: g === zsGong,
    };
  });

  // 格局：伏吟/反吟 + 龙鸟格
  const patterns: string[] = [];
  const allFu = cells.every(c => !c.tianGan || c.tianGan === c.diGan);
  if (allFu) patterns.push('伏吟局（诸事不宜动，主静守）');
  const allFan = cells.every(c => !c.tianGan || liuchongYi(c.tianGan, c.diGan));
  if (allFan) patterns.push('反吟局（事主反复，成而复败）');
  for (const c of cells) {
    if (c.tianGan === yi && c.diGan === '丙') patterns.push(`青龙返首（${c.name}）：大吉，得贵得财`);
    if (c.tianGan === '丙' && c.diGan === yi) patterns.push(`飞鸟跌穴（${c.name}）：大吉，百事顺遂`);
    if (c.tianGan === '庚' && c.diGan === '庚') patterns.push(`太白同宫（${c.name}）：主争斗阻滞`);
    if (c.tianGan === '乙' && c.diGan === '辛') patterns.push(`青龙逃走（${c.name}）：主失财逃亡`);
    if (c.tianGan === '辛' && c.diGan === '乙') patterns.push(`白虎猖狂（${c.name}）：主凶伤车马`);
    if (c.tianGan === '戊' && c.diGan === '辛') patterns.push(`青龙折足（${c.name}）：主吉中生凶`);
  }

  return { art: 'qimen', ju, yinYang, jieqi, yuan, juMethod, juNote, panType, timeType, zhifuStar, zhifuGate, xunShou, cells, hourPillar, dayPillar: normalized.dayPillar, patterns, normalized, configHash, };
}

function liuchongYi(a: string, b: string): boolean {
  const pairs: Record<string, string> = { 戊: '癸', 己: '甲', 庚: '乙', 辛: '丙', 壬: '丁', 癸: '戊', 乙: '庚', 丙: '辛', 丁: '壬' };
  return pairs[a] === b || pairs[b] === a;
}
function xunKongOf(hourPillar: string): string {
  const idx = ganzhiIndex(hourPillar);
  const gap = Math.floor((idx - (idx % 10)) / 10);
  const z1 = (10 - gap * 2) % 12;
  return DI_ZHI[z1] + DI_ZHI[(z1 + 1) % 12];
}

const C_YB_ALIAS: Record<string,string> = {
  '值符': '全文', '值使': '全文', '击刑': '全文', '格局': '全文', '阴阳顺逆': '全文',
  '门迫': '全文', '空亡': '全文', '入墓': '全文', '马星': '全文',
};
const C_YB = (ch0: string) => {
  const ch = C_YB_ALIAS[ch0] ?? ch0;
  return cite('yanbodiaosouge', '烟波钓叟歌', ch, `yanbodiaosouge.${ch}`, '（《烟波钓叟歌》原典回链，见书阁）', 'A');
};

export function qimenRules(chart: QimenChart): RuleHit[] {
  const hits: RuleHit[] = [];
  const juLabel = chart.juMethod === 'chaibu' ? '拆补' : chart.juMethod === 'zhirun' ? '置闰' : chart.juMethod === 'maoshan' ? '茅山' : chart.juMethod === 'nianjia' ? '年家三元' : '月家五元';
  const panLabel = chart.panType === 'fei' ? '飞盘·飞宫' : '转盘·排宫';
  const timeLabel = chart.timeType === 'shi' ? '时家' : chart.timeType === 'ri' ? '日家' : chart.timeType === 'nian' ? '年家(流年大势)' : '月家(流月运程)';
  hits.push({
    ruleId: 'qimen.pan', title: `${timeLabel}定局`,
    fact: `${chart.yinYang}${chart.ju}局（${chart.jieqi}${chart.yuan}，${juLabel}法）；${panLabel}；旬首${chart.xunShou}，值符${chart.zhifuStar}，值使${chart.zhifuGate}。${chart.timeType === 'shi' ? chart.hourPillar + '时' : (chart.yearPillar && chart.monthPillar && chart.timeType === 'yue') ? `${chart.yearPillar}年${chart.monthPillar}月` : chart.yearPillar ? `${chart.yearPillar}年` : chart.hourPillar + '时'}。${chart.juNote ? '（' + chart.juNote + '）' : ''}`,
    level: '中性', citations: [C_YB('阴阳顺逆')], confidenceLevel: 'A',
  });
  for (const p of chart.patterns) {
    const good = p.includes('大吉') || p.includes('青龙返首') || p.includes('飞鸟跌穴');
    hits.push({
      ruleId: 'qimen.geju', title: good ? '吉格' : '格局', fact: p,
      level: good ? '吉' : p.includes('凶') || p.includes('反吟') || p.includes('伏吟') ? '凶' : '变数',
      citations: [C_YB('格局')], confidenceLevel: 'A',
    });
  }
  for (const c of chart.cells) {
    for (const m of c.marks) {
      hits.push({
        ruleId: `qimen.sihai.${m}`, title: `四害：${m}`,
        fact: `${c.name}（天盘${c.tianGan || '—'}/地盘${c.diGan || '—'}）见${m}：${({ '空亡': '事落空、有名无实', '马星': '事主变动、出行宜速', '击刑': '主刑伤争斗、六仪击刑最忌', '入墓': '主昏晦受困、事暗不明', '门迫': '门克宫、事强为而不成' } as Record<string, string>)[m] || m}`,
        level: m === '马星' ? '变数' : '凶', citations: [C_YB('击刑')], confidenceLevel: 'A',
        target: c.name,
      });
    }
  }
  // ---- 年/月家奇门专用规则：紫白九星+流年/流月应事 ----
  if (chart.timeType === 'nian' || chart.timeType === 'yue') {
    if (chart.ziBai) {
      for (const z of chart.ziBai) {
        hits.push({
          ruleId: `qimen.zibai.${z.gong}`, title: `紫白：${z.star}`,
          fact: `${GONG_NAMES[z.gong - 1]}飞临${z.star}（${z.level}）：${z.level === '吉' ? '此方为三白吉方，宜修造动土、开业搬迁、坐卧朝向。' : z.level === '凶' ? '此方犯煞（五黄/二黑/七赤），宜静不宜动，忌修造、动土、开门，须化解。' : '紫白中性星，无大吉凶，随盘面定。'}`,
          level: z.level === '吉' ? '吉' : z.level === '凶' ? '凶' : '中性', citations: [], confidenceLevel: 'B', target: GONG_NAMES[z.gong - 1],
        });
      }
    }
  }
  // ---- R-奇门扩充：多体系信息备注 ----
  if (chart.panType === 'fei' && chart.timeType === 'shi') {
    hits.push({
      ruleId: 'qimen.system.fei', title: '飞盘说明',
      fact: '本盘按飞宫法排出：星、门、神均按洛书宫数序飞布（阳遁顺飞、阴遁逆飞），八门跳中五（阳 4→6、阴 6→4），用九神（阳遁勾陈/朱雀、阴遁白虎/玄武）。与转盘的区别在「转三盘 vs 飞三盘」；定局、取符取使两法一致。',
      level: '变数', citations: [C_YB('格局')], confidenceLevel: 'B',
    });
  }
  if (chart.timeType === 'nian' || chart.timeType === 'yue') {
    hits.push({
      ruleId: 'qimen.system.nianyue', title: `${chart.timeType === 'nian' ? '年家奇门' : '月家奇门'}说明`,
      fact: chart.timeType === 'nian'
        ? '年家奇门：60年一元(180年三元循环)，天道左旋统一阴遁，值符随年干、值使随年支飞布。主：全年大势(国运/地运/一年流年吉凶方位)、一年的五黄煞、三白吉方定位。应用：居家全年风水布置、企业年度战略。'
        : '月家奇门：5年(60月)一元，统一阴遁，值符随月干、值使随月支飞布。主：一个月的流月吉凶方位、月度择吉。应用：出行择月、开工择月、嫁娶择月、风水月运。',
      level: '变数', citations: [C_YB('阴阳顺逆')], confidenceLevel: 'A',
    });
  } else if (chart.timeType === 'shi') {
    hits.push({
      ruleId: 'qimen.system.note', title: '起局体系说明',
      fact: `本盘为时家${chart.panType === 'fei' ? '飞盘' : '转盘'}（${juLabel}法）。日家/月家/年家奇门均已内置，可在UI中切换时间体系入口获取；鸣法/括囊/山向等少数派分支因缺公开黄金样本，暂不内置。`,
      level: '变数', citations: [C_YB('格局')], confidenceLevel: 'A',
    });
  }
    // ---- 十干克应（R1 扩充）：天盘干加地盘干，格局与歌诀均出自《烟波钓叟歌》原句 ----
  const KE_YING: Array<{ t: string; d: string; name: string; level: '吉' | '凶' | '变数'; fact: string; quote: string }> = [
    { t: '庚', d: '丙', name: '白入荧（太白入荧）', level: '凶', fact: '庚为太白、丙为荧惑：主贼来、外患将至，宜防暗损与竞争者', quote: '六庚加丙白入荧，六丙加庚荧入白。白入荧兮贼即来' },
    { t: '丙', d: '庚', name: '荧入白（荧入太白）', level: '吉', fact: '主贼灭：对方受制，事可反制取胜', quote: '六丙加庚荧入白。荧入白兮贼须灭' },
    { t: '癸', d: '丁', name: '蛇夭矫', level: '凶', fact: '主虚惊、文书官司、口舌缠绕', quote: '六癸加丁蛇夭矫' },
    { t: '丁', d: '癸', name: '朱雀入江', level: '凶', fact: '主文书失落、音信沉溺、口舌得消', quote: '六丁加癸雀入江' },
    { t: '乙', d: '辛', name: '龙逃走', level: '凶', fact: '主逃亡走脱、人事有去意、财物流散', quote: '六乙加辛龙逃走' },
    { t: '辛', d: '乙', name: '虎猖狂', level: '凶', fact: '主伤灾、家宅不宁、人财两伤', quote: '六辛加乙虎猖狂' },
    { t: '丙', d: '戊', name: '飞鸟跌穴', level: '吉', fact: '甲遁于戊：大吉之格，动作得时、事可速成', quote: '丙加甲兮鸟跌穴' },
    { t: '戊', d: '丙', name: '青龙返首', level: '吉', fact: '甲遁于戊：大吉之格，贵人扶持、事可大成', quote: '甲加丙兮龙返首' },
    // R4 扩充：后世整理的五阳时/五阴时吉凶与「十干克应」补充格（无原典可考的以 C 级收录、空引文，见附录 D28）
    { t: '乙', d: '庚', name: '日奇被刑', level: '变数', fact: '乙奇加庚：主流传为「日奇被刑」，主谋事受阻、文书口舌；一说主得文书之喜，吉凶随门', quote: '' },
    { t: '丙', d: '辛', name: '月奇相合', level: '变数', fact: '丙奇加辛：主流传为「月奇相合」，主文书信息往来、谋事需反复确认', quote: '' },
    { t: '丁', d: '壬', name: '星奇入狱', level: '变数', fact: '丁奇加壬：主流传为「星奇入狱」，主文书宫讼、受官方牵制', quote: '' },
    { t: '壬', d: '戊', name: '小蛇化龙', level: '吉', fact: '壬加戊：主流传为「小蛇化龙」，主渐进转好、文书信息可成', quote: '' },
    { t: '戊', d: '癸', name: '青龙入天牢', level: '凶', fact: '戊加癸：主流传为「青龙入天牢」，主谋为受限、暗昧拖延', quote: '' },
    { t: '庚', d: '戊', name: '太白伏宫', level: '凶', fact: '庚加戊：主流传为「太白伏宫」，主阻隔、争斗、事多反复', quote: '' },
    { t: '辛', d: '庚', name: '白虎出力', level: '凶', fact: '辛加庚：主流传为「白虎出力」，主刀兵刑伤、口角争斗', quote: '' },
    { t: '癸', d: '壬', name: '天网四张', level: '凶', fact: '癸加壬：主重重受阻如入网罗；网临下三宫可扬而出，临上三宫无路', quote: '天网四张无走路，阴阳顺逆妙难穷' },
  ];
  const dayGan = chart.dayPillar[0];
  for (const c of chart.cells) {
    for (const k of KE_YING) {
      if (c.tianGan === k.t && c.diGan === k.d) {
        const hasQuote = !!k.quote;
        hits.push({
          ruleId: `qimen.keying.${k.t}${k.d}`, title: `十干克应：${k.name}`,
          fact: `${c.name}：天盘${k.t}加地盘${k.d}——${k.fact}${hasQuote ? `。歌曰：「${k.quote}」` : '（后世整理之说，C 级收录，无原典可查）'}`,
          level: k.level, citations: hasQuote ? [C_YB('格局')] : [], confidenceLevel: hasQuote ? 'A' : 'C', target: c.name,
        });
      }
    }
    if (c.tianGan === '庚' && c.diGan === dayGan) {
      hits.push({
        ruleId: 'qimen.keying.fugan', title: '十干克应：伏干格',
        fact: `${c.name}：天盘庚加地盘日干（${dayGan}）——主日干所代之人受阻、事多阻隔。歌曰：「庚加日干为伏干」`,
        level: '凶', citations: [C_YB('格局')], confidenceLevel: 'A', target: c.name,
      });
    }
    if (c.tianGan === dayGan && c.diGan === '庚') {
      hits.push({
        ruleId: 'qimen.keying.feigan', title: '十干克应：飞干格',
        fact: `${c.name}：天盘日干（${dayGan}）加地盘庚——主人受制于外、身不安宁。歌曰：「日干加庚飞干格」`,
        level: '凶', citations: [C_YB('格局')], confidenceLevel: 'A', target: c.name,
      });
    }
  }
  // ---- R5 扩充：五阳时/五阴时、八门吉凶、九星吉凶（《烟波钓叟歌》/《奇门遁甲统宗》所述） ----
  {
    const hourGan = chart.hourPillar[0];
    const isYangShichen = ['甲', '丙', '戊', '庚', '壬'].includes(hourGan);
    const yangText = isYangShichen
      ? '五阳时（阳干时辰：甲丙戊庚壬）——利客不利主，做事谋事宜先行，远行求财吉；发兵征战亦利'
      : '五阴时（阴干时辰：乙丁己辛癸）——利主不利客，宜静守、后发制人；安居乐业亦吉';
    hits.push({
      ruleId: 'qimen.yinyang.shichen', title: isYangShichen ? '五阳时' : '五阴时',
      fact: `${chart.hourPillar}时为${yangText}。`,
      level: isYangShichen ? '吉' : '变数', citations: [C_YB('阴阳顺逆')], confidenceLevel: 'A',
    });
    // 八门吉凶（见通书：「开休生为三吉门，伤杜景为中平，死惊为凶门」）
    const GATE_JI: Record<string, string> = {
      休门: '休门宜见贵、求财、谋望、嫁娶，吉；不宜征讨（泊水泽之乡）',
      生门: '生门宜征讨、谋望、入官见贵、嫁娶、移徙，诸事皆吉；不宜埋葬治丧',
      开门: '开门宜求名、求财、远行、入官见贵、嫁娶，吉；不宜卖地田产',
      伤门: '伤门宜渔猎、讨捕索债、博戏、收敛货财；其余不宜',
      杜门: '杜门宜捕盗剪凶、决隐狱形、填塞沟壑；其余不宜',
      景门: '景门宜上书献策、觅举求名、嫁娶远行；不宜入宅（火炎之地）',
      惊门: '惊门宜捕捉诉讼、攻伐惊诈；其余不宜',
      死门: '死门宜吊丧送葬、埋葬治丧、猎射；其余不宜',
    };
    for (const c of chart.cells) {
      if (c.gate && GATE_JI[c.gate]) {
        const isJi = ['休门', '生门', '开门'].includes(c.gate);
        hits.push({
          ruleId: `qimen.men.${c.gate}`, title: `八门断例：${c.gate}落${c.name}`,
          fact: `${c.name}见${c.gate}：${GATE_JI[c.gate]}（三门三奇合而用之，大吉）`,
          level: isJi ? '吉' : c.gate === '惊门' || c.gate === '死门' ? '凶' : '变数',
          citations: [C_YB('格局')], confidenceLevel: 'A', target: c.name,
        });
      }
    }
    // 九星吉凶（《烟波钓叟歌》：「天辅冲任禽心吉，天蓬天英芮柱凶」）
    const STAR_JI: Record<string, string> = {
      天辅: '天辅为文曲，主文明昌盛、考试文书利',
      天冲: '天冲为肃杀，主威武果断、宜武事',
      天任: '天任为慈惠，主任劳任怨、田产善化',
      天禽: '天禽为中宫正位，主中正、统御全局，吉',
      天心: '天心为医药，主诊治、修造、谋望皆利',
      天蓬: '天蓬为盗贼之首，主暗昧、破财、盗失，大凶',
      天芮: '天芮为病，主疾病、灾晦、师巫，大凶',
      天柱: '天柱为口舌，主惊叫、破败、官讼，小凶',
      天英: '天英为火血，主血光、官非、文书破败，小凶',
    };
    for (const star of [...new Set(chart.cells.map(c => c.star).filter(Boolean))]) {
      if (star && STAR_JI[star]) {
        const isJi = ['天辅', '天冲', '天任', '天禽', '天心'].includes(star);
        hits.push({
          ruleId: `qimen.xing.${star}`, title: `九星断例：${star}`,
          fact: `${star}：${STAR_JI[star]}（旺相吉、休囚凶）`,
          level: isJi ? '吉' : '凶', citations: [C_YB('格局')], confidenceLevel: 'A',
        });
      }
    }
    // R8 扩充：方位用事（奇门所长：看方位与时机）
    const FANGWEI: Record<string, [string, string]> = { // 门 → [方位, 用事]
      开门: ['西北（乾六）', '谋事、远行、上官见贵，宜向西北'],
      休门: ['正北（坎一）', '休养生息、求财谋望，宜向正北'],
      生门: ['东北（艮八）', '求生、谋财、嫁娶移徙，宜向东北'],
      伤门: ['正东（震三）', '讨债索物、渔猎，宜向正东'],
      杜门: ['东南（巽四）', '藏匿避乱、修筑填塞，宜向东南'],
      景门: ['正南（离九）', '献策求名、文书远行，宜向正南'],
      死门: ['西南（坤二）', '吊丧送葬、猎射，忌日常出入'],
      惊门: ['正西（兑七）', '捕捉诉讼、惊诈举措，宜向正西'],
    };
    const goodwill = chart.cells.filter(c => c.gate && ['开门', '休门', '生门'].includes(c.gate));
    for (const c of goodwill) {
      const [fang, yong] = FANGWEI[c.gate!];
      hits.push({
        ruleId: `qimen.fangwei.${c.gate}`, title: `${c.gate}落${c.name}：方位用事`,
        fact: `${yong}；本时吉门在${c.name}（${fang}），用事可从吉方发起。`,
        level: '吉', citations: [C_YB('格局')], confidenceLevel: 'B', target: c.name,
      });
    }
  }
  return hits;
}

export function qimenTiming(chart: QimenChart): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  const zhifu = chart.cells.find(c => c.isZhifu);
  if (zhifu) {
    const luoshu = zhifu.gong;
    out.push({ ruleId: 'qimen.timing.zhifu', text: `值符落${zhifu.name}（洛书${luoshu}数）：应期可参值符宫地支；洛书计期·旺相=${luoshu}天/月、休囚=${Math.max(1, Math.floor(luoshu / 2))}，或天盘干值日`, citations: [C_YB('值符')], confidenceLevel: 'A' });
  }
  const zhishi = chart.cells.find(c => c.isZhishiGate);
  if (zhishi) out.push({ ruleId: 'qimen.timing.zhishi', text: `值使落${zhishi.name}：值使=时机窗口，此宫地支/洛书数应之；值使临马=当日即动`, citations: [C_YB('格局')], confidenceLevel: 'B' });
  for (const c of chart.cells) if (c.marks.includes('马星')) out.push({
    ruleId: 'qimen.timing.ma', text: `马星在${c.name}：应期主速（当日~${c.gong}日内），变动之期；申子辰马寅 / 巳酉丑马亥 / 寅午戌马申 / 亥卯未马巳`, citations: [C_YB('格局')], confidenceLevel: 'A',
  });
  // 出空/填实应期
  const kongCells = chart.cells.filter(c => c.marks.includes('空亡'));
  for (const c of kongCells) {
    const zhi = GONG_ZHI[c.gong]?.[0];
    if (zhi) {
      const idx = DI_ZHI.indexOf(zhi);
      const chongZhi = DI_ZHI[(idx + 6) % 12];
      out.push({
        ruleId: 'qimen.timing.chukong', text: `${c.name}空亡（${zhi}）：①填实=逢${zhi}值值日/月  ②冲实=逢${chongZhi}冲支日/月。先空后实主事迟，出本旬方真应`, citations: [C_YB('空亡')], confidenceLevel: 'A',
      });
    }
  }
  // 庚格应期（太白金星=阻塞墙，庚落宫对冲支或值年/月/日/时）
  const gengCell = chart.cells.find(c => c.tianGan === '庚');
  if (gengCell) {
    const gengZhi = GONG_ZHI[gengCell.gong]?.[0];
    if (gengZhi) {
      const gIdx = DI_ZHI.indexOf(gengZhi);
      const chong = DI_ZHI[(gIdx + 6) % 12];
      const gLevel = (() => {
        const dg = gengCell.diGan;
        if (dg === (chart.yearPillar ?? '  ')[0]) return '岁格·年内应';
        if (chart.monthPillar && dg === chart.monthPillar[0]) return '月格·月内应';
        if (dg === chart.dayPillar[0]) return '日格·当日/次日应';
        if (dg === chart.hourPillar[0]) return '时格·两时辰内应';
        return '庚阻格';
      })();
      out.push({
        ruleId: 'qimen.timing.ge', text: `庚格在${gengCell.name}（${gLevel}）：庚=阻墙，遇${chong}支冲墙则破——${chong}日/月/时为应`, citations: [C_YB('格局')], confidenceLevel: 'A',
      });
    }
  }
  // 三合六合应期：取值符宫地支，合局成全/对冲
  if (zhifu) {
    const zfz = GONG_ZHI[zhifu.gong]?.[0];
    if (zfz) {
      const sanheKeys = Object.keys(SANHE_ZHI);
      for (const k of sanheKeys) {
        if (k.includes(zfz)) {
          const other = k.split('').filter(x => x !== zfz);
          out.push({ ruleId: 'qimen.timing.sanhe', text: `值符宫三合局（${k}合${SANHE_ZHI[k as keyof typeof SANHE_ZHI]}）：待${other.join('/')}支值值之日则成全，应之`, citations: [C_YB('格局')], confidenceLevel: 'B' });
          break;
        }
      }
      const liuhePartner = LIUHE_ZHI[zfz as keyof typeof LIUHE_ZHI];
      if (liuhePartner) out.push({ ruleId: 'qimen.timing.liuhe', text: `值符宫六合：${zfz}合${liuhePartner}——逢${liuhePartner}值值则合事，吉则成凶则结`, citations: [C_YB('格局')], confidenceLevel: 'B' });
    }
  }
  // 洛书数计期总览（乾6坎1艮8震3巽4离9坤2兑7中5）
  out.push({
    ruleId: 'qimen.timing.luoshu', text: `【洛书计期·总诀】旺相取大数、休囚取小数、本气取中数。乾6/坎1/艮8/震3/巽4/离9/坤2/兑7/中5。例：值符落离9·旺=9天/9月；休囚=1~3天。`, citations: [C_YB('格局')], confidenceLevel: 'B',
  });
  // 返吟/伏吟应期
  if (chart.patterns.some(p => p.includes('返吟'))) {
    out.push({ ruleId: 'qimen.timing.fanyin', text: '返吟局（冲）：主反复、动中应、去而又回；应期多取对冲支。', citations: [C_YB('格局')], confidenceLevel: 'B' });
  }
  if (chart.patterns.some(p => p.includes('伏吟'))) {
    out.push({ ruleId: 'qimen.timing.fuyin', text: '伏吟局（不动）：主迟、停滞；待值符/值使被冲或出空填实方应。', citations: [C_YB('格局')], confidenceLevel: 'B' });
  }
  return out;
}
const LIUHE_ZHI: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const SANHE_ZHI: Record<string, string> = { 申子辰: '水', 亥卯未: '木', 寅午戌: '火', 巳酉丑: '金' };

export function qimenBoard(chart: QimenChart): BoardSpec {
  const cells: BoardCell[] = chart.cells.map(c => ({
    pos: c.gong, name: c.name, gan: c.tianGan || '—', marks: c.marks,
    gates: c.gate, nineStars: c.star, gods: c.god, extra: `地盘 ${c.diGan}`,
    highlight: c.isZhifu,
  }));
  return {
    kind: 'grid', art: 'qimen',
    title: `${chart.yinYang}${chart.ju}局（${chart.jieqi}·${chart.yuan}）`,
    cells,
    info: [
      { label: '起局', value: `${chart.dayPillar}日 ${chart.hourPillar}时` },
      { label: '定局', value: `${chart.yinYang}${chart.ju}局（${chart.jieqi}·${chart.yuan}·${chart.juMethod === 'chaibu' ? '拆补' : chart.juMethod === 'zhirun' ? '置闰' : '茅山'}）` },
      { label: '排布', value: chart.panType === 'fei' ? '飞盘（飞宫）' : '转盘（排宫）' },
      { label: '值符/值使', value: `${chart.zhifuStar} / ${chart.zhifuGate}` },
      { label: '旬首', value: chart.xunShou },
      { label: '格局', value: chart.patterns.join('；') || '无特殊格局' },
    ],
  };
}

export function qimenWarnings(chart: QimenChart): Warning[] {
  const w: Warning[] = [];
  const juLabel = chart.juMethod === 'chaibu' ? '拆补' : chart.juMethod === 'zhirun' ? '置闰' : '茅山';
  w.push({ code: 'qimen/paibie', message: `当前为时家${chart.panType === 'fei' ? '飞盘' : '转盘'}·${juLabel}法；月家/年家奇门及鸣法/括囊/山向等分支缺公开黄金样本，不内置。` });
  if (chart.patterns.some(p => p.includes('伏吟'))) w.push({ code: 'qimen/fuyin', message: '伏吟局：宜静不宜动' });
  return w;
}

export function qimenEvidence(chart: QimenChart, rules: RuleHit[]): CitationRef[] {
  const out: CitationRef[] = []; const seen = new Set<string>();
  for (const r of rules) for (const c of r.citations) { const k = c.canonicalId + '/' + c.segId; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  void chart; return out;
}

export function qimenFacts(chart: QimenChart, _cat: string): FactBundle {
  return { facts: [
    { key: 'ju', label: '局', value: `${chart.yinYang}${chart.ju}局（${chart.jieqi}${chart.yuan}）` },
    { key: 'zhifu', label: '值符/值使', value: `${chart.zhifuStar}/${chart.zhifuGate}` },
    { key: 'geju', label: '格局', value: chart.patterns.join('；') || '无' },
    ...chart.cells.filter(c => c.marks.length).map(c => ({ key: `g${c.gong}`, label: c.name, value: `${c.tianGan}/${c.diGan} ${c.gate ?? ''} ${c.marks.join('、')}` })),
  ] };
}

export { JU_TABLE, determineJu, GONG_NAMES as QM_GONG_NAMES };
