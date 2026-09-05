/** 六爻基础数据：京房八宫、64 卦、纳甲、六神、卦象二进制（自下而上 1=阳） */

export interface GuaInfo {
  name: string;
  bin: string;        // 6 位，自下而上（初爻在前），1=阳
  gong: number;       // 宫序 0..7（乾坎艮震巽离坤兑）
  gongName: string;
  stage: number;      // 0=本宫 1..5=一至五世 6=游魂 7=归魂
}

export const GONG_NAMES = ['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'] as const;
export const GONG_WUXING = ['金', '水', '土', '木', '木', '火', '土', '金'] as const;

/** 八宫卦序（京房）：每宫本宫→一世…五世→游魂→归魂（名称仅作展示与校验） */
const GONG_TABLE: string[][] = [
  ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
  ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
  ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
  ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
  ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
  ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
  ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
  ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'],
];

/** 按京房变卦规则推导二进制：一世~五世自初爻起累计变；游魂=五世复四爻；归魂=游魂内卦复原 */
export function gongBin(gong: number, stage: number): string {
  const tri = TRIGRAMS[GONG_NAMES[gong]];
  const bits = (tri + tri).split('');
  const flip = (i: number) => { bits[i] = bits[i] === '1' ? '0' : '1'; };
  const upto = stage <= 5 ? stage : 5;
  for (let i = 0; i < upto; i++) flip(i);
  if (stage === 6) flip(3);
  if (stage === 7) { flip(3); flip(0); flip(1); flip(2); }
  return bits.join('');
}

/** 八卦（三爻，自下而上） */
export const TRIGRAMS: Record<string, string> = {
  乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000',
};
export const XIAN_TIAN_SHU: Record<string, number> = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };
export const SHU_TO_TRIGRAM: Record<number, string> = { 1: '乾', 2: '兑', 3: '离', 4: '震', 5: '巽', 6: '坎', 7: '艮', 8: '坤', 0: '坤' };

function trigramName(bin3: string): string {
  for (const [n, b] of Object.entries(TRIGRAMS)) if (b === bin3) return n;
  return '坤';
}

export const GUA64: GuaInfo[] = GONG_TABLE.flatMap((list, gong) =>
  list.map((name, stage) => ({ name, bin: gongBin(gong, stage), gong, gongName: GONG_NAMES[gong], stage })),
);

export function guaByBin(bin: string): GuaInfo | undefined {
  return GUA64.find(g => g.bin === bin);
}

export function guaByName(name: string): GuaInfo | undefined {
  return GUA64.find(g => g.name === name);
}

/** 世爻位（0=初爻…5=上爻）：本宫 5，一世 0…五世 4，游魂 3，归魂 2 */
export function shiPosition(gua: GuaInfo): number {
  return gua.stage === 0 ? 5 : gua.stage <= 5 ? gua.stage - 1 : gua.stage === 6 ? 3 : 2;
}

/** 纳甲：内卦/外卦地支序列 + 天干（宫干：乾内甲外壬…） */
const NAJIA: Record<string, { inner: string[]; outer: string[]; innerGan: string; outerGan: string }> = {
  乾: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'], innerGan: '甲', outerGan: '壬' },
  坎: { inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'], innerGan: '戊', outerGan: '戊' },
  艮: { inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'], innerGan: '丙', outerGan: '丙' },
  震: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'], innerGan: '庚', outerGan: '庚' },
  巽: { inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'], innerGan: '辛', outerGan: '辛' },
  离: { inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'], innerGan: '己', outerGan: '己' },
  坤: { inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'], innerGan: '乙', outerGan: '癸' },
  兑: { inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'], innerGan: '丁', outerGan: '丁' },
};

export function najiaOf(gua: GuaInfo): string[] {
  const lower = trigramName(gua.bin.slice(0, 3));
  const upper = trigramName(gua.bin.slice(3, 6));
  const li = NAJIA[lower], lo = NAJIA[upper];
  return [
    li.innerGan + li.inner[0], li.innerGan + li.inner[1], li.innerGan + li.inner[2],
    lo.outerGan + lo.outer[0], lo.outerGan + lo.outer[1], lo.outerGan + lo.outer[2],
  ];
}

/** 六神起法：甲乙日青龙起初爻，顺行 */
export const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'] as const;
export function liuShen(dayGan: string): string[] {
  const g = '甲乙丙丁戊己庚辛壬癸'.indexOf(dayGan);
  const start = Math.floor(g / 2); // 甲乙0 丙丁1 戊2 己3 庚辛4 壬癸5
  return Array.from({ length: 6 }, (_, i) => LIU_SHEN[(start + i) % 6]);
}

/** 六亲：以本宫五行为我 */
export function liuQin(gongWx: string, lineWx: string): string {
  const order = ['木', '火', '土', '金', '水'];
  const me = order.indexOf(gongWx), it = order.indexOf(lineWx);
  if (it === me) return '兄弟';
  if ((me + 1) % 5 === it) return '子孙';   // 我生
  if ((it + 1) % 5 === me) return '父母';   // 生我
  if ((me + 2) % 5 === it) return '妻财';   // 我克
  if ((it + 2) % 5 === me) return '官鬼';   // 克我
  return '';
}

/** 八卦五行 */
export const TRIGRAM_WUXING: Record<string, string> = { 乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土' };

/** 六冲卦（十卦）：八纯卦 + 无妄 + 大壮；六合卦：否泰复豫节困旅贲 */
export const LIU_CHONG_GUA = ['乾为天', '坎为水', '艮为山', '震为雷', '巽为风', '离为火', '坤为地', '兑为泽', '天雷无妄', '雷天大壮'];
export const LIU_HE_GUA = ['天地否', '地天泰', '地雷复', '雷地豫', '水泽节', '泽水困', '火山旅', '山火贲'];

/** 进神/退神对：亥子 寅卯 巳午 申酉 丑辰未戌 */
export const JIN_SHEN: Array<[string, string]> = [['亥', '子'], ['寅', '卯'], ['巳', '午'], ['申', '酉'], ['丑', '辰'], ['辰', '未'], ['未', '戌'], ['戌', '丑']];

/** 长生十二宫所用地支序（墓库判断用） */
export const MU_KU: Record<string, string> = { 木: '未', 火: '戌', 金: '丑', 水: '辰' };
