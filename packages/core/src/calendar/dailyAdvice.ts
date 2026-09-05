/** 每日吉向（D4）：按当日干支离线推算黄道吉时/日空亡/宜忌。
 *  纯函数无依赖（复用 ganzhi 历法），Web/App/脚本共用；黄历内容为传统历法口径，非医疗/投资/法律建议。 */
import { TIAN_GAN, DI_ZHI, JIAZI60, ganzhiIndex, dayPillarFromJdn, ymdToJdn, xunKong } from '../calendar/ganzhi';

/** 黄道六神（值神吉凶） */
export const HUANG_DAO_GODS = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'];
export const HUANG_DAO_SET = new Set(['青龙', '明堂', '天德', '金匮', '玉堂', '司命']);

/** 建除十二神（宜忌主纲） */
export const JIAN_CHU = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
const JIAN_CHU_YI: Record<string, string> = {
  建: '宜兴土动土、立约；忌行丧', 除: '宜除旧布新、扫舍去晦', 满: '宜祭祀纳财；忌动土',
  平: '宜平基修路；忌开市', 定: '宜定约嫁娶；忌远行', 执: '宜执守旧业；忌新开',
  破: '宜破屋除害；忌诸吉事', 危: '宜安床祈福；忌轻动', 成: '宜成事嫁娶、百事皆宜',
  收: '宜收纳入仓；忌开市动土', 开: '宜开市出行、百事大吉', 闭: '宜闭藏安床；忌出行',
};
const JIAN_CHU_WU_IMPACT = ['破', '危', '执', '闭'];

export interface DailyHour {
  zhi: string;          // 地支时
  label: string;        // 时段标签
  god: string;          // 值神
  huang: boolean;       // 是否黄道
}

export interface DailyAdvice {
  date: string;          // YYYY-MM-DD
  monthDay: string;      // 公历 "8月31日"
  dayPillar: string;     // 日柱干支
  xunKongZhi: string;    // 日空亡（地支）
  jianChu: string;       // 建除十二神当日值日
  jianChuNote: string;   // 建除宜忌白话
  yi: string[];          // 宜（按建除+通用框取 4-6 条）
  ji: string[];          // 忌（取 4-6 条）
  hours: DailyHour[];    // 十二时辰值神
  bestHours: DailyHour[];// 黄道吉时
  advice: string;        // 一句话白话提醒
}

const HOUR_LABELS = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
const HOUR_RANGES = ['23-1', '1-3', '3-5', '5-7', '7-9', '9-11', '11-13', '13-15', '15-17', '17-19', '19-21', '21-23'];

/** 通用宜忌基础池（依当日五行/建除增删） */
const YI_POOL = ['祭祀', '祈福', '出行', '订婚', '嫁娶', '开市', '交易', '立约', '纳财', '开业', '搬家', '动土', '修造', '安床', '入仓', '求医'];
const JI_POOL = ['动土', '出行', '开市', '搬家', '远行', '诉讼', '伐木', '安葬', '入宅', '结婚', '求财', '冒险'];

const zhiIndex = (z: string) => DI_ZHI.indexOf(z as never);

/** 值神按日支推（甲子日起青龙顺行十二，逢子午卯酉复起）——简式：日支序作偏移的通行做法 */
function dayGodsFor(dayZhi: string): DailyHour[] {
  const base = zhiIndex(dayZhi) % 12;
  return HOUR_LABELS.map((label, i) => {
    const god = HUANG_DAO_GODS[(base + i) % 12];
    return { zhi: DI_ZHI[i], label, god, huang: HUANG_DAO_SET.has(god) };
  });
}

/** 值日建除神：从 JDN 相对锚点（2000-01-01 建）推算 */
function jianChuFor(jdn: number): string {
  return JIAN_CHU[((jdn - 2451545) % 12 + 12) % 12];
}

/** 生成某日（默认今天）的吉向 */
export function dailyAdvice(d: Date = new Date()): DailyAdvice {
  const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
  const jdn = ymdToJdn(y, m, dd);
  const dayPillar = dayPillarFromJdn(jdn);
  const kong = xunKong(dayPillar);
  const jc = jianChuFor(jdn);
  const hours = dayGodsFor(dayPillar[1]);
  const bestHours = hours.filter(h => h.huang);

  // 宜忌：建除主纲 + 通用池补齐（建除内容形如「宜…；忌…」需拆开）
  const jcNote = JIAN_CHU_YI[jc] ?? '宜静养守常';
  const jcYiParse = (jcNote.match(/宜([^；;]*?)(?:；|;|$)/)?.[1] ?? '').split(/[、，]/).filter(Boolean);
  const jcJiParse = (jcNote.match(/忌([^；;]*)$/)?.[1] ?? '').split(/[、，]/).filter(Boolean);
  const yi = Array.from(new Set([...jcYiParse, '祭祀', '祈福', '与人方便'])).slice(0, 5);
  const ji = Array.from(new Set([...jcJiParse, ...(JIAN_CHU_WU_IMPACT.includes(jc) ? ['动土', '出行', '开市', '搬家'] : ['勿冒险', '勿冲动行事', '勿失信于人'])])).slice(0, 4);

  const idx = (ganzhiIndex(dayPillar) % 10); // 日干序
  const gan = TIAN_GAN[idx];
  const baseKw = [
    ['甲', '乙', '木气开张，宜谋定而动'], ['丙', '丁', '火星当值，宜快不宜拖'], ['戊', '己', '土性稳重，宜守成不宜冒进'],
    ['庚', '辛', '金气肃杀，宜断舍离、利落决定'], ['壬', '癸', '水气流动，宜灵活变通、顺水行舟'],
  ].find(([g]) => g === gan);
  const advice = `今日日柱${dayPillar}，${summaryLine(dayPillar, jc, kong)}${baseKw ? '；' + baseKw[2] : ''}。`;

  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    monthDay: `${m}月${dd}日`,
    dayPillar, xunKongZhi: kong, jianChu: jc, jianChuNote: JIAN_CHU_YI[jc] ?? '宜静养守常',
    yi, ji, hours, bestHours, advice,
  };
}

function summaryLine(dayPillar: string, jc: string, kong: string): string {
  const dayZhi = dayPillar[1];
  const god = dayGodsFor(dayZhi)[0].god;
  const huang = HUANG_DAO_SET.has(god);
  return `值日建除「${jc}」· 日空亡「${kong}」${huang ? `· 青龙/值神${god}宜行` : '· 宜静养'}`;
}

/** 供脚本/WEB 统一出口：生成 markdown 文本 */
export function dailyAdviceMarkdown(d: Date = new Date()): string {
  const a = dailyAdvice(d);
  const lines: string[] = [];
  lines.push(`# 今日吉向 · ${a.monthDay}`);
  lines.push('');
  lines.push(`日柱：${a.dayPillar}｜建除：${a.jianChu}（${a.jianChuNote}）｜日空亡：${a.xunKongZhi}`);
  lines.push('');
  lines.push(`宜：${a.yi.join('、') || '—'}`);
  lines.push(`忌：${a.ji.join('、') || '—'}`);
  lines.push('');
  lines.push('★ 今日黄道吉时（按日支推值神，方位仅供参考）：');
  for (const h of a.bestHours) lines.push(`  · ${h.label}（${h.zhi}时 ${HOUR_RANGES[zhiIndex(h.zhi)]}→ ${h.god}·黄道）`);
  lines.push('');
  lines.push('温馨提示：以下提醒由玄枢离线推算（历法口径，非医疗/投资/法律建议）。');
  lines.push('重大事项建议搭配八术排盘与应期窗口再定，不要只凭黄道黑道。');
  return lines.join('\n');
}

export { HOUR_LABELS, HOUR_RANGES };