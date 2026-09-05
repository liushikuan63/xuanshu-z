/** 节气：主值委托 lunar-javascript（分钟级，锁定 minor 版本 + LunarAdapter），自研 Meeus 交叉复核 */
import { Solar, Lunar } from 'lunar-javascript';
import { solveSolarLongitude, sunApparentLongitude, julianCenturies } from '../astronomy/solar';
import { ymdToJdn } from './ganzhi';

export interface JieQiInstant {
  name: string;
  iso: string;              // YYYY-MM-DD HH:mm
  jd: number;               // 当日儒略日数（整数日）
  minutes: number;          // 当日分钟
  source: 'lunar-js' | 'meeus';
}

const TERM_NAMES = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

const JIE = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']; // 节（月首）
const QI = ['雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至', '大寒']; // 气（月中）

export const JIEQI_JIE = JIE;
export const JIEQI_QI = QI;

/** 某农历年的节气表（lunar-javascript，分钟级） */
export function jieQiTable(year: number): Record<string, JieQiInstant> {
  const lunar = Lunar.fromDate(new Date(year, 6, 1));
  const table = lunar.getJieQiTable();
  const out: Record<string, JieQiInstant> = {};
  for (const [k, solar] of Object.entries(table) as Array<[string, Solar]>) {
    const name = k === 'DA_XUE' ? '大雪' : k === 'DONG_ZHI' ? '冬至' : k === 'XIAO_HAN' ? '小寒' : k === 'DA_HAN' ? '大寒' : k === 'LI_CHUN' ? '立春' : k;
    const y = solar.getYear(), m = solar.getMonth(), d = solar.getDay();
    out[name] = {
      name, iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(solar.getHour()).padStart(2, '0')}:${String(solar.getMinute()).padStart(2, '0')}`,
      jd: ymdToJdn(y, m, d), minutes: solar.getHour() * 60 + solar.getMinute(), source: 'lunar-js',
    };
  }
  return out;
}

/** 某公历年内全部 24 节气（立春~大寒，跨越公历年初的取上一农历年表） */
export function termsOfYear(gYear: number): JieQiInstant[] {
  const t1 = jieQiTable(gYear - 1);
  const t2 = jieQiTable(gYear);
  const all = { ...t1, ...t2 };
  const out: JieQiInstant[] = [];
  for (const name of TERM_NAMES) {
    const inst = all[name];
    if (inst && inst.jd >= ymdToJdn(gYear, 1, 1) && inst.jd < ymdToJdn(gYear + 1, 1, 1)) out.push(inst);
  }
  out.sort((a, b) => a.jd - b.jd || a.minutes - b.minutes);
  return out;
}

/** 某时刻（JDN+分钟）之前最近的节（用于月柱与起运） */
export function prevJie(jdn: number, minutesOfDay: number): JieQiInstant | null {
  const y = requireJdnYear(jdn);
  for (let yy = y + 1; yy >= y - 2; yy--) {
    const terms = termsOfYear(yy).filter(t => JIE.includes(t.name));
    const past = terms.filter(t => t.jd < jdn || (t.jd === jdn && t.minutes <= minutesOfDay));
    if (past.length) return past[past.length - 1];
  }
  return null;
}

/** 某时刻之后最近的节气（任意） */
export function nextJieQi(jdn: number, minutesOfDay: number): JieQiInstant | null {
  const y = requireJdnYear(jdn);
  for (let yy = y - 1; yy <= y + 2; yy++) {
    const terms = termsOfYear(yy);
    const future = terms.filter(t => t.jd > jdn || (t.jd === jdn && t.minutes > minutesOfDay));
    if (future.length) return future[0];
  }
  return null;
}

function requireJdnYear(jdn: number): number {
  // 从 JDN 估年（用于节气表缓存范围），误差无害
  return Math.floor((jdn - 1721060) / 365.2425) + 1;
}

/** 自研 Meeus 节气时刻（研究模式交叉复核用） */
export function meeusTermInstant(year: number, termName: string): { jde: number; iso: string } {
  const idx = TERM_NAMES.indexOf(termName);
  const targetDeg = ((idx * 15) + 315) % 360; // 立春=315°
  const approx = Date.UTC(year, 1, 4) / 86400000 + 2440587.5 + (idx * 365.2422 * 15) / 360;
  const jde = solveSolarLongitude(targetDeg, approx);
  // JDE（TT/UT 未做 deltaT 修正——记入精度表述）
  const ms = Math.round((jde - 2440587.5) * 86400000);
  const dt = new Date(ms);
  return { jde, iso: dt.toISOString().slice(0, 16).replace('T', ' ') };
}

/** 节气交叉校验（校准报告 §4.2）：>2 分钟差异记录但不硬抛错 */
export function calibrateTerms(year: number): Array<{ name: string; lunarJs: string; meeus: string; diffMin: number }> {
  const report: Array<{ name: string; lunarJs: string; meeus: string; diffMin: number }> = [];
  for (const t of termsOfYear(year)) {
    const m = meeusTermInstant(year, t.name);
    const jd = Math.floor(m.jde - 0.5 + 0.5);
    const diffMin = Math.abs(((m.jde - 2440587.5) % 1) * 1440 - t.minutes) % 1440;
    report.push({ name: t.name, lunarJs: t.iso, meeus: m.iso, diffMin: Math.round(Math.min(diffMin, 1440 - diffMin)) });
  }
  void julianCenturies; void sunApparentLongitude;
  return report;
}
