/** 真太阳时（§4 geo-time）：地方真太阳时 = 标准时 + 均时差 + 经度差（分钟）；北京时间 ≠ 真太阳时 */
import { equationOfTimeApprox } from '../astronomy/solar';

/**
 * @param hour/minute 标准时（东八区）
 * @param longitude 东经度数（东正西负）
 * @returns 校正后的 hour/minute 与偏移说明
 */
export function trueSolarTime(
  y: number, m: number, d: number, hour: number, minute: number, longitude: number,
): { hour: number; minute: number; offsetMin: number; eotMin: number; longitudeMin: number } {
  const eot = equationOfTimeApprox(y, m, d);           // 分钟
  const lonMin = (longitude - 120) * 4;                // 东八区标准经线 120°E
  let total = hour * 60 + minute + eot + lonMin;
  total = ((total % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(total / 60), minute: Math.round(total % 60),
    offsetMin: Math.round(eot + lonMin), eotMin: Math.round(eot), longitudeMin: Math.round(lonMin),
  };
}

/** 经度差异提示文案（§6.9-①：经度每差 1° 约差 4 分钟，跨时辰边界才影响） */
export function solarTimeNote(): string {
  return '真太阳时 = 北京时间 + 均时差 + 经度差（每差 1° 约 4 分钟）。仅当时辰处在交界附近时影响时柱；默认关闭。';
}
