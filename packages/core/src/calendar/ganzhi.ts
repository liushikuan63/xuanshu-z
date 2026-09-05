/** 干支基础常量与算法（自研，日柱只从 JDN 锚点取模导出，绝不由年柱推导 —— §4.2） */

export const TIAN_GAN: readonly string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const DI_ZHI: readonly string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ZHI_SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const;
export const GAN_WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'] as const;
export const ZHI_WUXING = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'] as const;
export const GAN_YINYANG = ['阳', '阳', '阴', '阴', '阳', '阳', '阴', '阴', '阳', '阳'] as const;

export const SHI_ER_CHANG_SHENG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;

/** 六十甲子（0=甲子） */
export const JIAZI60: string[] = Array.from({ length: 60 }, (_, i) =>
  TIAN_GAN[i % 10] + DI_ZHI[i % 12]);

/** 六十甲子纳音 */
const NAYIN_GROUPS = [
  ['海中金', '炉中火', '大林木', '路旁土', '剑锋金'],
  ['山头火', '涧下水', '城头土', '白蜡金', '杨柳木'],
  ['泉中水', '屋上土', '霹雳火', '松柏木', '长流水'],
  ['砂石金', '山下火', '平地木', '壁上土', '金箔金'],
  ['覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木'],
  ['大溪水', '沙中土', '天上火', '石榴木', '大海水'],
] as const;

export function nayin(jiaziIndex: number): string {
  // 每组纳音管两柱（甲子乙丑=海中金…），先折成对序再定位：甲申乙酉(20,21)→泉中水
  const pair = Math.floor(jiaziIndex / 2);
  return NAYIN_GROUPS[Math.floor(pair / 5)]?.[pair % 5] ?? '';
}

export function ganzhiIndex(gz: string): number {
  return JIAZI60.indexOf(gz);
}

/** 日干支序：只从 JDN 锚点取模（锚点：2000-01-01 = 戊午，JDN 2451545 → idx 54） */
export function dayPillarFromJdn(jdn: number): string {
  const idx = ((jdn + 49) % 60 + 60) % 60;
  return JIAZI60[idx];
}

/** 公历 → 儒略日数（当日整数，本地日期） */
export function ymdToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function jdnToYmd(jdn: number): { y: number; m: number; d: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  // Fliegel–Van Flandern：日 = e + 1 - floor((153*m+2)/5)（漏掉该修正项会把日算成 76 等问题日）
  return { y: b * 100 + dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e + 1 - Math.floor((153 * mm + 2) / 5) };
}

/** 五鼠遁：日干 → 子时天干 */
export function wushuDun(dayGan: string): number {
  const g = TIAN_GAN.indexOf(dayGan as never);
  return g % 5 * 2; // 甲己→甲(0), 乙庚→丙(2), 丙辛→戊(4), 丁壬→庚(6), 戊癸→壬(8)
}

/** 五虎遁：年干 → 正月（寅月）天干 */
export function wuhuDun(yearGan: string): number {
  const g = TIAN_GAN.indexOf(yearGan as never);
  return (g % 5) * 2 + 2; // 甲己→丙(2), 乙庚→戊(4), 丙辛→庚(6), 丁壬→壬(8), 戊癸→甲(0)
}

/** 时柱干支：dayGan 为起遁所用日干（晚子时按次日干），hour 0..23 */
export function hourPillar(dayGan: string, hour: number): string {
  const zhiIdx = Math.floor((hour + 1) / 2) % 12; // 23/0→子
  const startGan = wushuDun(dayGan);
  const gan = TIAN_GAN[(startGan + zhiIdx) % 10];
  return gan + DI_ZHI[zhiIdx];
}

/** 月柱干支：yearGan 五虎遁 + 月支序（寅=2） */
export function monthPillar(yearGan: string, zhiIdx: number): string {
  const startGan = wuhuDun(yearGan);
  const offset = ((zhiIdx - 2) + 12) % 12; // 寅月起
  return TIAN_GAN[(startGan + offset) % 10] + DI_ZHI[zhiIdx];
}

/** 旬空：日柱所在旬中空亡的两支 */
export function xunKong(dayPillar: string): string {
  const idx = ganzhiIndex(dayPillar);
  const xunStart = idx - (idx % 10); // 旬首
  const gap = Math.floor(xunStart / 10); // 甲子0 甲戌1 甲申2 甲午3 甲辰4 甲寅5 旬 → 空亡从 10-2*gap 开始
  const z1 = (10 - gap * 2) % 12;
  return DI_ZHI[z1] + DI_ZHI[(z1 + 1) % 12];
}

/** 年柱干支序（0=甲子） */
export function yearPillarIndex(yearGanzhi: string): number {
  return ganzhiIndex(yearGanzhi);
}

/** 公历年 → 年干支（(y-4) 周期法；用于紫微流年等展示层标签） */
export function yearGanzhiOf(year: number): string {
  const gi = ((year - 4) % 60 + 60) % 60;
  return TIAN_GAN[gi % 10] + DI_ZHI[gi % 12];
}

/** 三合局：申子辰合水… */
export const SANHE = [
  { group: ['申', '子', '辰'], element: '水' },
  { group: ['亥', '卯', '未'], element: '木' },
  { group: ['寅', '午', '戌'], element: '火' },
  { group: ['巳', '酉', '丑'], element: '金' },
];

/** 六合：子丑、寅亥、卯戌、辰酉、巳申、午未 */
export const LIUHE: Array<[string, string]> = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];

/** 六冲 */
export function liuchong(a: string, b: string): boolean {
  const ia = DI_ZHI.indexOf(a as never), ib = DI_ZHI.indexOf(b as never);
  return ia >= 0 && ib >= 0 && (ia + 6) % 12 === ib;
}

/** 相刑（寅巳申、丑戌未、子卯、辰午酉亥自刑） */
export function xiangxing(a: string, b: string): boolean {
  const pairs = [['寅', '巳'], ['巳', '申'], ['申', '寅'], ['丑', '戌'], ['戌', '未'], ['未', '丑'], ['子', '卯'], ['卯', '子']];
  if (pairs.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) return true;
  return a === b && ['辰', '午', '酉', '亥'].includes(a); // 自刑
}

/** 藏干表：天干序（本气,中气,余气） */
export const CANG_GAN: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

/** 十神：日干 vs 目标干（五行相生 +1、相克 +2，以日干为轴） */
export function shiShen(dayGan: string, otherGan: string): string {
  const WX = ['木', '火', '土', '金', '水'];
  const dg = TIAN_GAN.indexOf(dayGan as never);
  const og = TIAN_GAN.indexOf(otherGan as never);
  const sameYin = (dg % 2) === (og % 2); // 同阴阳
  const me = GAN_WUXING[dg];
  const wu = GAN_WUXING[og];
  const mi = WX.indexOf(me);
  const wi = WX.indexOf(wu);
  if (me === wu) return sameYin ? '比肩' : '劫财';        // 同我
  if ((mi + 1) % 5 === wi) return sameYin ? '食神' : '伤官'; // 我生者
  if ((wi + 1) % 5 === mi) return sameYin ? '偏印' : '正印'; // 生我者
  if ((mi + 2) % 5 === wi) return sameYin ? '偏财' : '正财'; // 我克者
  return sameYin ? '七杀' : '正官';                          // 克我者
}

/** 十二长生：日干（或年干）在某支的状态 */
export function changSheng(gan: string, zhi: string): string {
  // 长生起点：甲亥 丙寅 戊寅 庚巳 壬申（阳干顺行）；乙午 丁酉 己酉 辛子 癸卯（阴干逆行）
  const yangStart: Record<string, number> = { 甲: DI_ZHI.indexOf('亥'), 丙: DI_ZHI.indexOf('寅'), 戊: DI_ZHI.indexOf('寅'), 庚: DI_ZHI.indexOf('巳'), 壬: DI_ZHI.indexOf('申') };
  const yinStart: Record<string, number> = { 乙: DI_ZHI.indexOf('午'), 丁: DI_ZHI.indexOf('酉'), 己: DI_ZHI.indexOf('酉'), 辛: DI_ZHI.indexOf('子'), 癸: DI_ZHI.indexOf('卯') };
  const gz = TIAN_GAN.indexOf(gan as never);
  const z = DI_ZHI.indexOf(zhi as never);
  const yang = gz % 2 === 0;
  const start = yang ? yangStart[gan] : yinStart[gan];
  const offset = yang ? (z - start + 12) % 12 : (start - z + 12) % 12;
  return SHI_ER_CHANG_SHENG[offset];
}

/** 神煞（八字常用） */
export function shenSha(dayPillar: string, yearPillar: string, pillars: string[], gender?: '男' | '女'): string[] {
  const out: string[] = [];
  const allZhi = pillars.map(p => p[1]);
  const dayGan = dayPillar[0];
  const yearGan = yearPillar[0];
  const dayZhi = dayPillar[1];
  // 天乙贵人：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎
  const tianyi: Record<string, string[]> = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'] };
  for (const z of allZhi) if (tianyi[dayGan]?.includes(z)) { out.push('天乙贵人@' + z); break; }
  // 禄：甲禄在寅…
  const lu: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  if (allZhi.includes(lu[dayGan])) out.push('禄@' + lu[dayGan]);
  // 羊刃（阳干帝旺位）
  const ren: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
  if (ren[dayGan] && allZhi.includes(ren[dayGan])) out.push('羊刃@' + ren[dayGan]);
  // 文昌：甲乙巳午报，丙戊申宫…
  const wc: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  if (allZhi.includes(wc[dayGan])) out.push('文昌@' + wc[dayGan]);
  // 驿马：申子辰马在寅…
  const ma: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  const maZhi = ma[dayZhi] ?? ma[allZhi[0]];
  if (allZhi.includes(maZhi)) out.push('驿马@' + maZhi);
  // 桃花（咸池）：申子辰在酉…
  const tao: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
  const taoZhi = tao[dayZhi] ?? tao[yearPillar[1]];
  if (taoZhi && allZhi.includes(taoZhi)) out.push('桃花@' + taoZhi);
  // 华盖：申子辰见辰…
  const hua: Record<string, string> = { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' };
  const huaZhi = hua[dayZhi] ?? hua[yearPillar[1]];
  if (huaZhi && allZhi.includes(huaZhi)) out.push('华盖@' + huaZhi);
  // 将星：申子辰见子…
  const jiang: Record<string, string> = { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯' };
  const jiangZhi = jiang[dayZhi] ?? jiang[yearPillar[1]];
  if (jiangZhi && allZhi.includes(jiangZhi)) out.push('将星@' + jiangZhi);
  // 天德贵人：正丁二申宫，三壬四辛同，五亥六甲上，七癸八寅逢，九丙十居乙，子巳丑庚中（按月支）
  const DE_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const monthZhi0 = (pillars[1] ?? '')[1];
  const tianDe: Record<string, string> = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
  if (monthZhi0 && tianDe[monthZhi0] && (allZhi.includes(tianDe[monthZhi0]) || pillars.some(p => p[0] === tianDe[monthZhi0]))) out.push('天德贵人@' + tianDe[monthZhi0]);
  // 月德贵人：寅午戌月在丙、申子辰月在壬、亥卯未月在甲、巳酉丑月在庚
  const yueDeSanhe: Record<string, string> = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };
  if (monthZhi0 && yueDeSanhe[monthZhi0] && pillars.some(p => p[0] === yueDeSanhe[monthZhi0])) out.push('月德贵人@' + yueDeSanhe[monthZhi0]);
  // 太极贵人：甲乙生人子午，丙丁鸡兔，戊己辰戌丑未，庚辛寅亥，壬癸巳申
  const taiji: Record<string, string[]> = { 甲: ['子', '午'], 乙: ['子', '午'], 丙: ['酉', '卯'], 丁: ['酉', '卯'], 戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'], 庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'] };
  for (const z of allZhi) if (taiji[dayGan]?.includes(z)) { out.push('太极贵人@' + z); break; }
  // 天医：月支前一位（正月见丑…）
  if (monthZhi0) { const yi = DE_ZHI[(DE_ZHI.indexOf(monthZhi0) + 11) % 12]; if (allZhi.includes(yi)) out.push('天医@' + yi); }
  // 红鸾（子年卯逆行）/ 天喜（红鸾对冲）——按年支
  const hongluan: Record<string, string> = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };
  const hl = hongluan[yearPillar[1]];
  const DUI = (z: string) => '子丑寅卯辰巳午未申酉戌亥'[('子丑寅卯辰巳午未申酉戌亥'.indexOf(z) + 6) % 12];
  if (hl && allZhi.includes(hl)) out.push('红鸾@' + hl);
  if (hl && allZhi.includes(DUI(hl))) out.push('天喜@' + DUI(hl));
  // 孤辰寡宿：亥子丑→孤寅寡戌；寅卯辰→孤巳寡丑；巳午未→孤申寡辰；申酉戌→孤亥寡未
  const guchen: Record<string, string> = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
  const guasu: Record<string, string> = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };
  if (allZhi.includes(guchen[yearPillar[1]])) out.push('孤辰@' + guchen[yearPillar[1]]);
  if (allZhi.includes(guasu[yearPillar[1]])) out.push('寡宿@' + guasu[yearPillar[1]]);
  // 劫煞（三合绝位）/ 亡神（三合禄前）：申子辰劫巳亡亥；亥卯未劫申亡寅；寅午戌劫亥亡巳；巳酉丑劫寅亡申
  const jiesha: Record<string, string> = { 申: '巳', 子: '巳', 辰: '巳', 亥: '申', 卯: '申', 未: '申', 寅: '亥', 午: '亥', 戌: '亥', 巳: '寅', 酉: '寅', 丑: '寅' };
  const wangshen: Record<string, string> = { 申: '亥', 子: '亥', 辰: '亥', 亥: '寅', 卯: '寅', 未: '寅', 寅: '巳', 午: '巳', 戌: '巳', 巳: '申', 酉: '申', 丑: '申' };
  if (allZhi.includes(jiesha[yearPillar[1]])) out.push('劫煞@' + jiesha[yearPillar[1]]);
  if (allZhi.includes(wangshen[yearPillar[1]])) out.push('亡神@' + wangshen[yearPillar[1]]);
  // 金舆：禄前二位
  const jinyu: Record<string, string> = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
  if (allZhi.includes(jinyu[dayGan])) out.push('金舆@' + jinyu[dayGan]);
  return [...new Set(out)];
}
