/**
 * 天文模块：Meeus 简化太阳视黄经 + 均时差（§4）
 * 目标可控、可测试、可复算，不宣称比成熟天文库更精确。
 * 精度表述：简化公式误差约 0.01° 量级（≈15 分钟节气时刻），仅用于交叉复核，
 * 节气主值委托 lunar-javascript（分钟级），差异记入校准报告（§4.2）。
 */

const DEG = Math.PI / 180;

/** 儒略世纪数 */
export function julianCenturies(jde: number): number {
  return (jde - 2451545) / 36525;
}

/** 太阳几何平黄经（度） */
export function sunMeanLongitude(T: number): number {
  return (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
}

/** 太阳平近点角（度） */
export function sunMeanAnomaly(T: number): number {
  return (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
}

/** 中心差（度） */
export function sunEquationOfCenter(M: number): number {
  const Mr = M * DEG;
  return (1.914602 - 0.004817 * 0 - 0.000014 * 0) * Math.sin(Mr)
    + (0.019993 - 0.000101 * 0) * Math.sin(2 * Mr)
    + 0.000289 * Math.sin(3 * Mr);
}

/** 太阳真黄经（度） */
export function sunTrueLongitude(T: number): number {
  const L0 = sunMeanLongitude(T);
  const M = sunMeanAnomaly(T);
  return (L0 + sunEquationOfCenter(M) + 360) % 360;
}

/** 太阳视黄经（含章动与光行差近似，度） */
export function sunApparentLongitude(T: number): number {
  const O = 125.04 - 1934.136 * T;
  return (sunTrueLongitude(T) - 0.00569 - 0.00478 * Math.sin(O * DEG) + 360) % 360;
}

/** 黄赤交角（度） */
export function obliquity(T: number): number {
  return 23.439291 - 0.0130042 * T - 0.00000016 * T * T;
}

/** 太阳赤经（度，由视黄经与黄赤交角） */
export function sunRightAscension(lambda: number, eps: number): number {
  const lr = lambda * DEG, er = eps * DEG;
  const ra = Math.atan2(Math.cos(er) * Math.sin(lr), Math.cos(lr)) / DEG;
  return (ra + 360) % 360;
}

/** 均时差（分钟，Meeus 简化） */
export function equationOfTime(jde: number): number {
  const T = julianCenturies(jde);
  const L0 = sunMeanLongitude(T);
  const eps = obliquity(T);
  const lambda = sunApparentLongitude(T);
  const alpha = sunRightAscension(lambda, eps);
  let dPsi = -0.00478 * Math.sin((125.04 - 1934.136 * T) * DEG); // 简化章动
  let E = L0 - 0.0057183 - alpha + dPsi;
  // 归一到 [-180, 180)
  E = ((E % 360) + 540) % 360 - 180;
  return E * 4; // 度 → 分钟
}

/**
 * 均时差三角近似（分钟，精度 ~0.5min）：
 * B = 360(N-81)/365；EoT = 9.87 sin2B − 7.53 cosB − 1.5 sinB
 */
export function equationOfTimeApprox(y: number, m: number, d: number): number {
  const N = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const B = 2 * Math.PI * (N - 81) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/** 逆迭代求交节 JDE：目标黄经（0/15/…/345）附近的时刻（度） */
export function solveSolarLongitude(targetDeg: number, approxJde: number): number {
  let jde = approxJde;
  for (let i = 0; i < 60; i++) {
    const T = julianCenturies(jde);
    const lambda = sunApparentLongitude(T);
    let diff = targetDeg - lambda;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff * 365.25 / 360) < 1e-6) break; // 每天约 0.9856°
    jde += diff * 365.25 / 360;
  }
  return jde;
}
