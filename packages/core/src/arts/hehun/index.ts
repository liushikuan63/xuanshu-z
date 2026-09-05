/** 合盘/合婚（hehun/index.ts）：八字合婚 + 奇门合婚。
 * 定位：文化参考工具，确定性规则 + 白话说明，不做"宜婚/忌婚"断言（R11/D28 约束）。
 */
export { baziHehun, type BaziHehunResult, type HehunItem } from './bazi';
export { qimenHehun, type QimenHehunResult, type QimenHehunItem } from './qimen';

/** 双人生辰 → 双方八字合婚（内部用 computeBazi 各自排盘） */
import type { RawInput, ResolvedConfig } from '../../config/types';
import { computeBazi, type BaziChart } from '../bazi/engine';
import { baziHehun, type BaziHehunResult } from './bazi';

export function baziHehunOf(inputA: RawInput, inputB: RawInput, cfg: ResolvedConfig, configHash: string): { a: BaziChart; b: BaziChart; result: BaziHehunResult } {
  const a = computeBazi(inputA, cfg, configHash + ':A');
  const b = computeBazi(inputB, cfg, configHash + ':B');
  return { a, b, result: baziHehun(a, b) };
}