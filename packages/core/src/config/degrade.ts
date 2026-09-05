/** 统一降级检查（§4.5，D28）：任何术数排盘前先跑；命中即明示缺失，绝不编造 */
import type { ArtType, RawInput } from '../config/types';

export interface DegradationCheck {
  blocked: boolean;          // 拒排
  missing: string;
  impact: string;
  suggestArts: ArtType[];
  notice?: string;           // UI 大字提示
}

const RULES: Partial<Record<ArtType, (input: RawInput) => DegradationCheck | null>> = {
  ziwei: (input) => {
    if (input.hourMissing) {
      return input.allowHourMissingFallback
        ? { blocked: false, missing: '出生时辰', impact: '命宫与十二宫不完整，结果仅供参考', suggestArts: ['liuyao', 'meihua'], notice: '时辰缺失，宫位与四化不完整——结果仅供参考，建议改用六爻/梅花（不依赖生辰）' }
        : { blocked: true, missing: '出生时辰', impact: '时辰错则全盘错', suggestArts: ['liuyao', 'meihua'], notice: '紫微以命宫为起点逆布十二宫，时辰错则全盘错。若无法确认时辰，建议改用六爻/梅花（不依赖生辰）。确需继续请勾选「无时辰降级」。' };
    }
    return null;
  },
  bazi: (input) => {
    if (input.hourMissing) {
      return { blocked: false, missing: '出生时辰', impact: '只排年/月/日三柱，缺时柱', suggestArts: ['liuyao'], notice: '缺时柱：盘面明示「缺时柱」，需时柱的规则（时干支旺衰等）已禁用。单事占问建议改用六爻。' };
    }
    return null;
  },
  qimen: (input) => {
    if (input.hourMissing) return { blocked: true, missing: '起局时刻', impact: '时家奇门依赖占时', suggestArts: ['liuyao', 'meihua'] };
    return null;
  },
  liuren: (input) => {
    if (input.hourMissing) return { blocked: true, missing: '占时', impact: '四课三传依赖占时', suggestArts: ['liuyao'] };
    return null;
  },
  jinkou: (input) => {
    if (input.hourMissing) return { blocked: true, missing: '占时', impact: '月将加时依赖占时', suggestArts: ['xiaoliuren'] };
    return null;
  },
  meihua: (input) => {
    if (input.method === 'time' && input.hourMissing) return { blocked: true, missing: '占时', impact: '时间卦需要时辰', suggestArts: ['liuyao'] };
    return null;
  },
};

export function checkDegradation(art: ArtType, input: RawInput): DegradationCheck | null {
  const rule = RULES[art];
  if (!rule) return null;
  return rule(input);
}
