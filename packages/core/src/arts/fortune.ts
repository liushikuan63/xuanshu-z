/** 个人今日运势引擎（fortune.ts）：预设生辰 × 当日干支 → 精细化每日推荐。
 * 数据源：computeBazi（命主日主/喜用/五行） + 当日干支/黄历/星座（huangliOf）。
 * 确定性规则 + 白话；文化参考定位，不作行为断言（R11/D28 约束延伸）。
 */
import { computeBazi, type BaziChart } from './bazi/engine';
import type { ResolvedConfig, RawInput } from '../config/types';
import { TIAN_GAN, GAN_WUXING, DI_ZHI, ZHI_WUXING } from '../calendar/ganzhi';
import { huangliOf, xingZuoProfile, type HuangliDay, type XingZuoProfile } from '../calendar/huangli';
import { Solar } from 'lunar-javascript';

export interface BirthSpec {
  year: number; month: number; day: number;
  hour?: number; minute?: number;
  gender?: '男' | '女';
  location?: string;
}

/** 五行 → 幸运色 / 数字 / 健康要点 / 一句白话 */
export interface WuxingProfile {
  luckyColors: string[];      // 幸运色
  luckyNumbers: string[];     // 幸运数字
  healthy: string;            // 健康要点（归属该系统对应脏腑）
  plain: string;              // 白话
}
const WX = {
  木: { luckyColors: ['青绿', '墨绿', '松花'], luckyNumbers: ['3', '8'], healthy: '肝经、筋骨——忌熬夜动怒，宜舒展', plain: '木气当令，恰似春生，宜亲近自然、舒展筋骨' },
  火: { luckyColors: ['红', '绛紫', '粉'], luckyNumbers: ['2', '7'], healthy: '心经、血脉——宜养心静气，忌过热燥', plain: '火气当令，主热情行动，宜快马加鞭也须防急躁' },
  土: { luckyColors: ['黄', '棕', '米'], luckyNumbers: ['5', '0'], healthy: '脾胃、肌肉——饮食定时定量，忌暴饮', plain: '土气当令，贵在笃实，宜守成积累、稳扎稳打' },
  金: { luckyColors: ['白', '银', '灰'], luckyNumbers: ['4', '9'], healthy: '肺经、皮毛——宜呼吸吐纳，忌烟酒', plain: '金气当令，利断舍离，宜做减法、利落拍板' },
  水: { luckyColors: ['黑', '深蓝', '藏青'], luckyNumbers: ['1', '6'], healthy: '肾经、津液——宜补水休息，忌过度劳累', plain: '水气当令，主智谋流动，宜顺势而为、借力而行' },
} as const satisfies Record<string, WuxingProfile>;

/** 五行相生顺序（木→火→土→金→水→木） */
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克顺序（木→土→水→火→金→木） */
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

export interface FortuneMetric {
  label: string;      // 维度名（爱情/财富/事业/健康）
  score: number;      // 0..100 综合分
  level: '吉' | '平' | '注意';
  text: string;       // 白话解读
}

export interface DailyFortune {
  date: string;
  birthDesc: string;         // 命主生辰摘要（干支/星座）
  dayGan: string;            // 命主日主
  dayGanWx: string;          // 日主五行
  dayPillar: string;         // 当日日柱
  dayZhiWx: string;          // 当日日支五行
  relationWx: string;        // 当日五行 vs 命主日主的关系（生我/克我/比和…）
  luckyColors: string[];     // 幸运色（八字喜用）
  luckyNumbers: string[];    // 幸运数字（八字喜用）
  luckyPillows: string[];    // 幸运方位（后续可由喜用定）
  healthScore: number;       // 健康指数
  metrics: FortuneMetric[];  // 爱情/财富/事业/健康四维
  tips: string[];            // 今日提点/注意事项（结合日柱+喜忌+黄历宜忌）
  cautions: string[];        // 注意事项（凶煞/冲煞/忌事项）
  xingZuo: string;           // 当日星座
  xingZuoAdvice: string;     // 星座今日一句白话
  birthXingZuo: string;      // 本命星座（由生辰决定，如 处女座）
  birthXZ: XingZuoProfile | undefined;  // 本命星座完整画像
  strength: string;          // 身旺/身弱/中和
  yongShenText: string;      // 喜用神文本
  summary: string;           // 一句话总述
}

const XZ_INSPIRED: Record<string, string> = {
  白羊: '能量外放的一天：宜主动推进，别让犹豫拖走状态', 金牛: '稳扎稳打的节奏最舒服：饮食与理财都不妨保守些', 双子: '信息多、扰动快：抓主线，别被碎片带偏', 巨蟹: '情绪带动行动：先把安全感补足，做事更顺', 狮子: '表现欲加持：适合亮相、谈判与展示自己', 处女: '归整与精进日：适合整理、校对与打磨细节', 天秤: '平衡是主题：合作、协调、避极端', 天蝎: '洞察加深：谈重要事、看深层动机的好时机', 射手: '心向远方：宜计划、学习、出门走动', 摩羯: '务实推进：把目标拆小件，逐个落地', 水瓶: '灵感航线：新点子多，适合打破常规', 双鱼: '共情充盈：宜灵感创作，也需守好边界', };

function o(n: number): number { return Math.round(n); }

/** 八字日主 vs 当日日柱 → 五行关系评分（综合参考，透明规则） */
function scoreDay(rel: string, base: number, chart: BaziChart): number {
  // rel: 'shengMe' 生我 | 'iSheng' 我生 | 'keMe' 克我 | 'iKe' 我克 | 'same' 比和
  let s = base;
  if (rel === 'shengMe') s += 8;       // 生我者印，得助
  else if (rel === 'iSheng') s -= 2;   // 我生者泄
  else if (rel === 'keMe') s += 4;     // 克我者官杀，压力亦是动力（吉凶看旺衰）
  else if (rel === 'iKe') s -= 2;      // 我克者财，费力
  // 身弱逢生我优先、身旺逢泄克合理
  if (chart.strength === '身弱' && rel === 'shengMe') s += 6;
  if (chart.strength === '身旺' && (rel === 'iSheng' || rel === 'keMe')) s += 4;
  return s;
}

/** 生成某日个人运势（birth 必填） */
export function fortuneOf(birth: BirthSpec, y: number, m: number, d: number, cfg: ResolvedConfig, configHash: string): DailyFortune {
  const b = computeBazi(
    { time: { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour ?? 12, minute: birth.minute ?? 0 }, gender: birth.gender ?? '男' },
    cfg, configHash + ':fortune-birth',
  );
  const hl: HuangliDay = huangliOf(y, m, d);

  // 本命星座：由生辰（公历）决定，与当日星座互为补充
  const birthXingZuoRaw = Solar.fromYmd(birth.year, birth.month, Math.max(1, Math.min(31, birth.day))).getXingZuo() ?? '';
  const birthXz = xingZuoProfile(birthXingZuoRaw);
  const birthXingZuo = birthXz?.name ?? birthXingZuoRaw;

  const dayGan = b.dayGan;
  const dayGanWx = GAN_WUXING[TIAN_GAN.indexOf(dayGan as never)] ?? '?';
  const dayZhi = hl.ganzhi[1] ?? (hl.ganzhi.length ? hl.ganzhi[1] : '');
  const dayZhiWx = ZHI_WUXING[DI_ZHI.indexOf(dayZhi as never)] ?? '?';

  // 当日日柱五行 vs 日主五行：取日主与当日天干关系为主
  const gzDay = hl.ganzhi;
  const gan = gzDay[0];
  const ganWx = GAN_WUXING[TIAN_GAN.indexOf(gan as never)] ?? '?';
  let rel: 'shengMe' | 'iSheng' | 'keMe' | 'iKe' | 'same' = 'same';
  if (SHENG[ganWx] === dayGanWx) rel = 'shengMe';       // 当日生我
  else if (SHENG[dayGanWx] === ganWx) rel = 'iSheng';   // 我生日当
  else if (KE[ganWx] === dayGanWx) rel = 'keMe';        // 当日克我
  else if (KE[dayGanWx] === ganWx) rel = 'iKe';         // 我克当日
  else rel = 'same';

  const wx = WX[dayGanWx as keyof typeof WX] ?? WX.土;

  // 四维指数（0..100）
  const loveBase = scoreDay(rel, 62, b) + (hl.chong ? -3 : 0) + (hl.week.includes('五') || hl.week.includes('六') ? 3 : 0);
  const moneyBase = scoreDay(rel, 66, b) + (rel === 'iKe' ? 6 : 0) + (hl.jianChu === '收' || hl.jianChu === '满' ? 5 : hl.jianChu === '破' ? -5 : 0);
  const careerBase = scoreDay(rel, 64, b) + (hl.jianChu === '开' || hl.jianChu === '成' || hl.jianChu === '建' ? 6 : hl.jianChu === '闭' || hl.jianChu === '破' ? -5 : 0);
  const healthBase = (hl.xiongSha.length ? 52 : 64) - (hl.jianChu === '危' ? 8 : 0) + (rel === 'shengMe' ? 6 : 0);

  const clamp = (n: number) => Math.max(15, Math.min(98, o(n)));
  const love = clamp(loveBase), money = clamp(moneyBase), career = clamp(careerBase), health = clamp(healthBase);

  const lvl = (s: number): '吉' | '平' | '注意' => (s >= 70 ? '吉' : s >= 45 ? '平' : '注意');

  const relText: Record<string, string> = {
    shengMe: `今日天干${gan}（${ganWx}）生你的日主${dayGan}（${dayGanWx}），印星得助，宜学习/签文/贵人指引`,
    iSheng: `今日天干${gan}（${ganWx}）为你日主${dayGan}（${dayGanWx}）所生（食伤），输出多、宜表达创造`,
    keMe: `今日天干${gan}（${ganWx}）克你日主${dayGan}（${dayGanWx}）（官杀），担责/压力俱在，宜把事照章办`,
    iKe: `今日天干${gan}（${ganWx}）为你日主${dayGan}（${dayGanWx}）所克（财），求财费力，宜算清账再动`,
    same: `今日天干${gan}（${ganWx}）与你日主${dayGan}（${dayGanWx}）比和，同行协力，喜忧参半`,
  };

  // 幸运色/数字：优先命主喜用五行，其次日主五行
  const fav = (b.yongShen?.favorable ?? [])[0];
  const targetWx = (fav && WX[fav as keyof typeof WX]) ? fav as keyof typeof WX : dayGanWx as keyof typeof WX;
  const luck = WX[targetWx];

  // 注意事项：黄历忌 + 凶煞 + 冲煞 + 建除危执闭
  const cautions: string[] = [];
  if (hl.ji.length) cautions.push(`黄历忌：${hl.ji.slice(0, 4).join('、')}`);
  if (hl.chong) cautions.push(`冲${hl.chong}（今日冲煞方位留意）`);
  if (hl.xiongSha.length) cautions.push(`凶煞宜忌：${hl.xiongSha.slice(0, 4).join('、')}`);
  if (['破', '危', '执', '闭'].includes(hl.jianChu)) cautions.push(`建除「${hl.jianChu}」日，诸事以守成为贵`);
  if (hl.pengZu.length) cautions.push(`彭祖百忌：${hl.pengZu.join('；')}`);

  // 今日提点：结合喜用忌神与当日关系 + 健康 + 本命星座
  const tips: string[] = [];
  tips.push(relText[rel]);
  if (rel === 'shengMe' || rel === 'same') tips.push('贵人位偏吉，可多请教前辈/熟手');
  else tips.push('建议任务拆小、节奏放稳，别硬扛硬上');
  tips.push(`健康宜${luck.healthy}；色系可穿${luck.luckyColors.join('、')}顺气`);
  if (birthXz) tips.push(`本命星座「${birthXingZuo}」（${birthXz.element}象·${birthXz.ruler}守护）：${XZ_INSPIRED[birthXingZuo.replace(/座$/, '')] ?? birthXz.plain}；今日可带${birthXz.luckyItem}或近${birthXz.luckyColors[0] ?? '本命色'}色提运`);
  tips.push(hl.jieQi ? `今日节气「${hl.jieQi}」，顺应天时而动` : `今日${hl.week}，${hl.lunarMonth}`);

  const xzName = hl.xingZuo.replace(/座$/, '');
  const xzAdvice = XZ_INSPIRED[xzName] ?? `${xzName}座：状态在线，按计划行事即可`;

  const metrics: FortuneMetric[] = [
    { label: '爱情', score: love, level: lvl(love), text: rel === 'shengMe' ? '印星助暖，宜表达真诚；单身宜主动约谈，已婚宜陪伴。' : rel === 'same' ? '比和有伴，宜共同行动；忌翻旧账。' : '宫位有生克，感情宜多听少辩，细节胜大话。' },
    { label: '财富', score: money, level: lvl(money), text: rel === 'iKe' ? '财星透出，进项靠实干；宜记账、忌大额冲动。' : rel === 'keMe' ? '官杀当值，忌投机，宜按计划收支。' : '财气平顺，正财为主；逢「收/满」更有积累之象。' },
    { label: '事业', score: career, level: lvl(career), text: hl.jianChu === '开' || hl.jianChu === '成' ? '建除「开/成」日，宜签约、启动新项目。' : hl.jianChu === '破' || hl.jianChu === '闭' ? '建除「破/闭」，避大动，宜复盘与准备。' : '按部就班即可，重点任务放上午精力佳。' },
    { label: '健康', score: health, level: lvl(health), text: `注意${luck.healthy}；${hl.xiongSha.length ? '今日凶煞偏多，宜早睡、清淡饮食。' : '整体平稳，坚持日常作息。'}` },
  ];

  const summary = `今日（${y}.${m}.${d} · ${hl.lunarMonth}）整体参考 ${o((love + money + career + health) / 4)} 分：${relText[rel].split('，')[0]}。八字幸运色 ${luck.luckyColors.join('、')}，数字 ${luck.luckyNumbers.join('、')}；本命星座「${birthXingZuo}」幸运色 ${(birthXz?.luckyColors ?? []).slice(0, 2).join('、') || '—'}。${xzAdvice}。提醒：运势为文化参考，重大决策请以完整排盘与应期为准。`;

  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    birthDesc: `${b.pillars.map(p => p.gz).join(' ')} · 日主${dayGan}(${dayGanWx}) · ${hl.lunarYear}年生（${b.strength}） · 本命星座${birthXingZuo}`,
    dayGan, dayGanWx, dayPillar: hl.ganzhi, dayZhiWx,
    relationWx: relText[rel], luckyColors: luck.luckyColors, luckyNumbers: luck.luckyNumbers,
    luckyPillows: [], healthScore: health, metrics,
    tips, cautions,
    xingZuo: hl.xingZuo, xingZuoAdvice: xzAdvice,
    birthXingZuo, birthXZ: birthXz,
    strength: b.strength, yongShenText: `喜${b.yongShen?.favorable.join('、') ?? '—'} 忌${b.yongShen?.unfavorable.join('、') ?? '—'}`,
    summary,
  };
}

export { WX, SHENG, KE };
