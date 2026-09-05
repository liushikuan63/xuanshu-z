/** LunarAdapter（§4 calendar）：农历/闰月/干支委托 lunar-javascript（锁 minor），自研 JDN 日柱交叉核对 */
import { Solar, Lunar } from 'lunar-javascript';
import type { NormalizedMoment, RawInput, CalendarConfig } from '../config/types';
import { dayPillarFromJdn, ymdToJdn, jdnToYmd, ganzhiIndex, DI_ZHI, TIAN_GAN, xunKong, wuhuDun } from './ganzhi';
import { trueSolarTime } from './solarTime';
import { nextJieQi, prevJie, termsOfYear } from './solarTerms';

export interface NormalizeOptions {
  calendar: CalendarConfig;
  hourMissing?: boolean;
}

/** 归一化输入时刻（全部术数共用，D20） */
export function normalizeMoment(input: RawInput, opts: NormalizeOptions): NormalizedMoment {
  const cal = opts.calendar;
  const time = input.time ?? { year: 2000, month: 1, day: 1, hour: -1, minute: 0 };
  let { year, month, day, hour, minute } = time;
  let trueSolarUsed = false;
  const hourMissing = opts.hourMissing || hour == null || hour < 0 || Number.isNaN(hour);

  if (cal.trueSolarTime && cal.longitude != null && !hourMissing) {
    const ts = trueSolarTime(year, month, day, hour, minute, cal.longitude);
    const shifted = hour * 60 + minute + ts.offsetMin;
    let jdn = ymdToJdn(year, month, day);
    if (shifted < 0) jdn -= 1;
    if (shifted >= 1440) jdn += 1;
    const back = jdnToYmd(jdn);
    year = back.y; month = back.m; day = back.d;
    const total = ((shifted % 1440) + 1440) % 1440;
    hour = Math.floor(total / 60); minute = total % 60;
    trueSolarUsed = true;
  }

  const jdn = ymdToJdn(year, month, day);
  const solar = Solar.fromYmdHms(year, month, day, Math.max(0, hourMissing ? 12 : hour), hourMissing ? 0 : minute, 0);
  const lunar = solar.getLunar();

  // ---- 日柱（按子时约定）----
  let dayPillar: string;
  if (!hourMissing && hour >= 23) {
    dayPillar = cal.zishi === 'switch' ? lunar.getDayInGanZhiExact() : lunar.getDayInGanZhi();
  } else {
    dayPillar = lunar.getDayInGanZhi();
  }
  // 自研 JDN 日柱交叉核对（§4.2：只从 JDN 锚点取模导出）
  const checkJdn = !hourMissing && hour >= 23 && cal.zishi === 'switch' ? jdn + 1 : jdn;
  const selfCheck = dayPillarFromJdn(checkJdn);
  if (selfCheck !== dayPillar) {
    console.warn(`[calendar] 日柱分歧 JDN=${checkJdn} self=${selfCheck} lib=${dayPillar}`);
  }

  // ---- 时柱（晚子时按次日干起子时，两种子时约定一致）----
  const hourPillarStr = hourMissing ? '' : lunar.getTimeInGanZhi();

  // ---- 年柱 ----
  const yearPillar = cal.yearSwitch === 'lichun' ? lunar.getYearInGanZhiByLiChun() : lunar.getYearInGanZhi();

  // ---- 月柱 ----
  let monthPillar: string;
  if (cal.monthSwitch === 'jieqi') {
    monthPillar = lunar.getMonthInGanZhi();
  } else {
    const lmAbs = Math.abs(lunar.getMonth());
    const zhiIdx = (lmAbs + 1) % 12; // 正月→寅(2)
    const startGan = wuhuDun(yearPillar[0]);
    monthPillar = TIAN_GAN[(startGan + ((zhiIdx - 2 + 12) % 12)) % 10] + DI_ZHI[zhiIdx];
  }

  const lunarInfo = {
    year: Math.abs(lunar.getYear()), month: lunar.getMonth(), day: Math.abs(lunar.getDay()),
    isLeap: lunar.getMonth() < 0,
    monthName: (lunar.getMonth() < 0 ? '闰' : '') + lunar.getMonthInChinese() + '月',
    dayName: lunar.getDayInChinese(),
    yearGanzhi: lunar.getYearInGanZhi(),
    jieQiToday: lunar.getJieQi(),
    nextJieQi: lunar.getNextJieQi().getName() + ' ' + lunar.getNextJieQi().getSolar().toYmd(),
  };

  return {
    year: time.year, month: time.month, day: time.day,
    hour: time.hour, minute: time.minute,
    jdn,
    dayPillar, yearPillar, monthPillar, hourPillar: hourPillarStr,
    ganzhiDayIndex: ganzhiIndex(dayPillar),
    xunkong: xunKong(dayPillar),
    lunar: lunarInfo,
    trueSolarUsed,
    confidence: hourMissing ? 'degraded' : 'normal',
    degraded: hourMissing ? {
      degraded: true, missing: '出生时辰',
      impact: '四柱缺时柱，需时柱的规则不可用',
      suggestArts: ['liuyao', 'meihua'],
    } : undefined,
  };
}

/** 月将：中气换将（雨水后亥将…）——供大六壬/金口诀 */
export function monthGeneral(jdn: number, minutesOfDay: number): { general: string; zhi: string } {
  const zhis = ['亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '子', '丑'];
  const generals = ['登明', '河魁', '从魁', '传送', '小吉', '胜光', '太乙', '天罡', '太冲', '功曹', '神后', '大吉'];
  const qis = ['雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至', '大寒'];
  const y = jdnToYmd(jdn).y;
  let best = 11;
  let bestKey = -Infinity;
  for (let yy = y - 1; yy <= y + 1; yy++) {
    for (let i = 0; i < qis.length; i++) {
      const t = termsOfYear(yy).find(x => x.name === qis[i]);
      if (!t) continue;
      if (t.jd < jdn || (t.jd === jdn && t.minutes <= minutesOfDay)) {
        const key = t.jd * 1440 + t.minutes;
        if (key > bestKey) { bestKey = key; best = i; }
      }
    }
  }
  void prevJie; void nextJieQi;
  return { general: generals[best], zhi: zhis[best] };
}

export { Solar, Lunar };
