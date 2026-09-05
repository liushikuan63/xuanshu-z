/** 八术插件注册（ShuPlugin 契约 v5）：统一工厂，逐术差异注入 */
import type {
  ArtType, ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, RawInput,
  NormalizedMoment, TimingCandidate, FactBundle, CategoryId, AnswerTemplate, GuidanceBlock,
} from '../config/types';
import type { ShuPlugin } from '../plugins/contract';
import { normalizeMoment } from '../calendar/normalize';

import { computeBazi, baziRules, baziBoard, baziWarnings, baziEvidence, type BaziChart } from './bazi/engine';
import { computeLiuyao, liuyaoRules, liuyaoBoard, liuyaoWarnings, liuyaoEvidence, liuyaoTiming, liuyaoFacts, type LiuyaoChart } from './liuyao/engine';
import { computeMeihua, meihuaRules, meihuaBoard, meihuaWarnings, meihuaEvidence, meihuaTiming, meihuaFacts, type MeihuaChart } from './meihua/engine';
import { castZiwei, ziweiRules, ziweiBoard, ziweiWarnings, ziweiEvidence, ziweiTiming, ziweiFacts, type ZiweiChart } from './ziwei/engine';
import { computeQimen, qimenRules, qimenBoard, qimenWarnings, qimenEvidence, qimenTiming, qimenFacts, type QimenChart } from './qimen/engine';
import { computeLiuren, liurenRules, liurenBoard, liurenWarnings, liurenEvidence, liurenTiming, liurenFacts, type LiurenChart as LiurenChartLR } from './liuren/engine';
import { computeXiaoliuren, xiaoliurenRules, xiaoliurenBoard, xiaoliurenWarnings, xiaoliurenEvidence, xiaoliurenTiming, xiaoliurenFacts, type XiaoliurenChart } from './xiaoliuren/engine';
import { computeJinkou, jinkouRules, jinkouBoard, jinkouWarnings, jinkouEvidence, jinkouTiming, jinkouFacts, type JinkouChart } from './jinkou/engine';

type ChartOf<A> =
  A extends 'bazi' ? BaziChart : A extends 'liuyao' ? LiuyaoChart : A extends 'meihua' ? MeihuaChart :
  A extends 'ziwei' ? ZiweiChart : A extends 'qimen' ? QimenChart : A extends 'liuren' ? LiurenChartLR :
  A extends 'xiaoliuren' ? XiaoliurenChart : A extends 'jinkou' ? JinkouChart : never;

/** 术数擅长的建议事项 */
export const ART_CATEGORIES: Record<ArtType, CategoryId[]> = {
  bazi: ['事业', '感情', '学业', '健康', '决策'],
  liuyao: ['失物', '感情', '事业', '求财', '决策', '出行', '官非', '健康'],
  meihua: ['决策', '失物', '感情', '出行'],
  ziwei: ['事业', '感情', '健康', '其他'],
  qimen: ['出行', '事业', '求财', '失物', '择日'],
  liuren: ['合作', '官非', '感情', '其他'],
  xiaoliuren: ['失物', '出行', '决策'],
  jinkou: ['合作', '求财', '出行'],
};

const GUIDES: Record<ArtType, GuidanceBlock> = {
  bazi: {
    ask: ['我未来三年适不适合创业', '我和 TA 八字合不合（需双方生辰）'],
    cast: '提供阳历/农历生日 + 出生时辰 + 性别；时辰缺失走降级（缺时柱）',
    tips: ['换年默认以立春为准（可配）', '北京时间≠真太阳时，跨时辰边界建议开真太阳时'],
  },
  liuyao: {
    ask: ['我的身份证昨天下午在地铁站附近丢了，三天内能找回吗', '我投的 A 公司岗位一个月内能否拿到 offer'],
    cast: '摇卦：净手静心、专念一事、连摇六次自下而上成卦；或报数/时间卦',
    tips: ['一事一卦，不因卦不吉重摇（初筮告，再三渎）', '先填事项与问法再起卦，取用神才准'],
  },
  meihua: {
    ask: ['今天谈判 A/B 两个方案选哪个', '丢的钥匙能否很快找到'],
    cast: '临时起念报 2-3 个数（勿事先想好），或时间卦/字占',
    tips: ['外应（突发的人事物声）是梅花特色，可补充', '体用生克定吉凶，类象定细节'],
  },
  ziwei: {
    ask: ['我适合什么方向，下一步 3-5 年怎么走', '我的婚姻宫怎么看'],
    cast: '阳历生日 + 出生时辰 + 性别（大限顺逆相关）+ 出生地经度（真太阳时）',
    tips: ['时辰错则全盘错；无确切时辰建议改用六爻/梅花', '四化有版本分歧（庚/壬干），已按所选版本计算并记录'],
  },
  qimen: {
    ask: ['今天从哪个方向出发谈这个项目最顺', '这个月哪天适合签约'],
    cast: '以问事时刻起局（时家转盘·拆补法，可切置闰/茅山、转盘/飞盘、日家择日）',
    tips: ['看方位与时机是奇门所长', '四害（空亡/马星/击刑/入墓/门迫）已标红', '择日看「日家」，精确到时辰用「时家」'],
  },
  liuren: {
    ask: ['对方没说来意，这次接触所为何事', '这场合作谈判过程会怎样'],
    cast: '以问事时刻起课（月将加时），正时/活时皆可',
    tips: ['四课定现状、三传定过程与结局', '「来意占」为高级技法，样本不足时明示'],
  },
  xiaoliuren: {
    ask: ['现在要不要去找这件东西', '今天出门顺不顺'],
    cast: '月→日→时递推，或报三个数',
    tips: ['速断可否，不宜断长期', '口诀属民间传承（D 级），仅供参考'],
  },
  jinkou: {
    ask: ['这次见面对方所为何来', '这笔生意可否做'],
    cast: '以问事时刻起课 + 指定地分（来方）',
    tips: ['四位（人元/贵神/将神/地分）+ 五动定来意', '口诀属师传体系（D 级）'],
  },
};

function templateFor(art: ArtType, cat: string): AnswerTemplate {
  return {
    id: `${art}.${cat}.v1`,
    category: cat,
    sections: [
      { id: 'conclusion', title: '结论', from: 'composer', require: ['fact:用神'] },
      { id: 'yongshen', title: '依据（事实层）', from: 'core' },
      { id: 'signals', title: '关键信号', from: 'rules' },
      { id: 'timing', title: '应期', from: 'timing', fallback: '暂无内置应期推法' },
      { id: 'evidence', title: '古籍依据', from: 'knowledge', fallback: '此流派暂无内置依据，请导入书库' },
      { id: 'counter', title: '反证与注意', from: 'composer' },
      { id: 'advice', title: '建议', from: 'ai' },
      { id: 'disclaimer', title: '免责', from: 'safety' },
    ],
    forbidden: ['确定性结果承诺', '医疗/投资/法律结论', '断言他人行为与隐私'],
    recordHint: '记入案例本，事后回标实际结果与时间，以校准自己的解释习惯',
  };
}

export function buildPlugin<A extends ArtType>(art: A): ShuPlugin {
  const plugin: ShuPlugin = {
    id: `plugin.${art}`, name: art, art, version: '1.0.0',
    normalize(input, opts) {
      const cal = (opts as never as { calendar?: ResolvedConfig['calendar'] })?.calendar ?? defaultCal();
      return normalizeMoment(input, { calendar: cal, hourMissing: opts?.hourMissing });
    },
    compute(input: RawInput, cfg: ResolvedConfig): ChartOf<A> {
      const configHash = (input as never as { configHash?: string }).configHash ?? 'adhoc';
      switch (art) {
        case 'bazi': return computeBazi(input, cfg, configHash) as never;
        case 'liuyao': return computeLiuyao(input, cfg, configHash) as never;
        case 'meihua': return computeMeihua(input, cfg, configHash) as never;
        case 'ziwei': {
          const degraded = !!input.hourMissing && !!input.allowHourMissingFallback;
          if (input.hourMissing && !input.allowHourMissingFallback) throw new Error('[degrade] 紫微缺时辰：确需排盘请勾选「无时辰降级」，或改用六爻/梅花');
          return castZiwei(input, cfg, configHash, degraded) as never;
        }
        case 'qimen': return computeQimen(input, cfg, configHash) as never;
        case 'liuren': return computeLiuren(input, cfg, configHash) as never;
        case 'xiaoliuren': return computeXiaoliuren(input, cfg, configHash) as never;
        case 'jinkou': return computeJinkou(input, cfg, configHash) as never;
        default: throw new Error('unknown art');
      }
    },
    rules(chart: never, cfg: ResolvedConfig): RuleHit[] {
      const c = chart as never as ChartOf<A>;
      switch (art) {
        case 'bazi': return baziRules(c as BaziChart, cfg);
        case 'liuyao': return liuyaoRules(c as LiuyaoChart);
        case 'meihua': return meihuaRules(c as MeihuaChart);
        case 'ziwei': return ziweiRules(c as ZiweiChart);
        case 'qimen': return qimenRules(c as QimenChart);
        case 'liuren': return liurenRules(c as LiurenChartLR);
        case 'xiaoliuren': return xiaoliurenRules(c as XiaoliurenChart);
        case 'jinkou': return jinkouRules(c as JinkouChart);
        default: return [];
      }
    },
    board(chart: never, cfg: ResolvedConfig): BoardSpec {
      const c = chart as never as ChartOf<A>;
      switch (art) {
        case 'bazi': return baziBoard(c as BaziChart, cfg);
        case 'liuyao': return liuyaoBoard(c as LiuyaoChart);
        case 'meihua': return meihuaBoard(c as MeihuaChart);
        case 'ziwei': return ziweiBoard(c as ZiweiChart);
        case 'qimen': return qimenBoard(c as QimenChart);
        case 'liuren': return liurenBoard(c as LiurenChartLR);
        case 'xiaoliuren': return xiaoliurenBoard(c as XiaoliurenChart);
        case 'jinkou': return jinkouBoard(c as JinkouChart);
        default: return { kind: 'list', art, title: '—' };
      }
    },
    evidence(chart: never, rules: RuleHit[]): CitationRef[] {
      const c = chart as never as ChartOf<A>;
      switch (art) {
        case 'bazi': return baziEvidence(c as BaziChart, rules);
        case 'liuyao': return liuyaoEvidence(c as LiuyaoChart, rules);
        case 'meihua': return meihuaEvidence(c as MeihuaChart, rules);
        case 'ziwei': return ziweiEvidence(c as ZiweiChart, rules);
        case 'qimen': return qimenEvidence(c as QimenChart, rules);
        case 'liuren': return liurenEvidence(c as LiurenChartLR, rules);
        case 'xiaoliuren': return xiaoliurenEvidence(c as XiaoliurenChart, rules);
        case 'jinkou': return jinkouEvidence(c as JinkouChart, rules);
        default: return [];
      }
    },
    warnings(chart: never, _cfg: ResolvedConfig): Warning[] {
      const c = chart as never as ChartOf<A>;
      switch (art) {
        case 'bazi': return baziWarnings(c as BaziChart);
        case 'liuyao': return liuyaoWarnings(c as LiuyaoChart);
        case 'meihua': return meihuaWarnings(c as MeihuaChart);
        case 'ziwei': return ziweiWarnings(c as ZiweiChart);
        case 'qimen': return qimenWarnings(c as QimenChart);
        case 'liuren': return liurenWarnings();
        case 'xiaoliuren': return xiaoliurenWarnings();
        case 'jinkou': return jinkouWarnings();
        default: return [];
      }
    },
    intake: {
      categories: ART_CATEGORIES[art],
      presetFor(category: CategoryId): Partial<ResolvedConfig> {
        return { category };
      },
      guidance(category: CategoryId): GuidanceBlock {
        return GUIDES[art];
      },
      keyFactors(category: CategoryId): string[] {
        const kf: Record<ArtType, string[]> = {
          bazi: ['用神旺衰', '大运流年', '调候', '格局'],
          liuyao: ['用神', '世应', '旬空月破', '动爻变化', '应期'],
          meihua: ['体用', '互变', '类象', '外应'],
          ziwei: ['命宫', '三方四正', '四化落宫', '大限流年', '星曜亮度'],
          qimen: ['用神宫', '值符值使', '四害', '格局', '方位', '定局法/排布法', '时辰黑黄道'],
          liuren: ['四课', '三传', '天将', '课体'],
          xiaoliuren: ['落宫', '六神速断'],
          jinkou: ['四位', '五动', '来意'],
        };
        return kf[art];
      },
    },
    answer: {
      templateFor(category: CategoryId): AnswerTemplate {
        return templateFor(art, category);
      },
      timingRules(chart: never, _cfg: ResolvedConfig): TimingCandidate[] {
        const c = chart as never as ChartOf<A>;
        switch (art) {
          case 'liuyao': return liuyaoTiming(c as LiuyaoChart);
          case 'meihua': return meihuaTiming(c as MeihuaChart);
          case 'ziwei': return ziweiTiming(c as ZiweiChart);
          case 'qimen': return qimenTiming(c as QimenChart);
          case 'liuren': return liurenTiming(c as LiurenChartLR);
          case 'xiaoliuren': return xiaoliurenTiming(c as XiaoliurenChart);
          case 'jinkou': return jinkouTiming(c as JinkouChart);
          default: return [];
        }
      },
      extractFacts(chart: never, _category: CategoryId): FactBundle {
        const c = chart as never as ChartOf<A>;
        switch (art) {
          case 'liuyao': return liuyaoFacts(c as LiuyaoChart, _category);
          case 'meihua': return meihuaFacts(c as MeihuaChart, _category);
          case 'ziwei': return ziweiFacts(c as ZiweiChart, _category);
          case 'qimen': return qimenFacts(c as QimenChart, _category);
          case 'liuren': return liurenFacts(c as LiurenChartLR, _category);
          case 'xiaoliuren': return xiaoliurenFacts(c as XiaoliurenChart, _category);
          case 'jinkou': return jinkouFacts(c as JinkouChart, _category);
          case 'bazi': {
            const b = c as BaziChart;
            return { facts: [
              { key: 'pillars', label: '四柱', value: b.pillars.map(p => p.gz).join(' ') },
              { key: 'yongshen', label: '用神', value: `${b.yongShen.primary}（${b.yongShen.method}）` },
              { key: 'wangshuai', label: '旺衰', value: `${b.strength}（同党 ${b.selfRatio}%）` },
              { key: 'dayun', label: '现行大运', value: b.dayun[0] ? `${(b.dayun.find(d => new Date().getFullYear() - b.normalized.year >= d.startAge && new Date().getFullYear() - b.normalized.year < d.endAge) ?? b.dayun[0]).ganzhi}运` : '—' },
            ] };
          }
          default: return { facts: [] };
        }
      },
    },
  };
  return plugin;
}

function defaultCal(): ResolvedConfig['calendar'] {
  return {
    yearSwitch: 'lichun', monthSwitch: 'jieqi', zishi: 'switch',
    trueSolarTime: false, longitude: null, timeOffsetMin: 0, termAlgoVersion: 'lunar-js-1.7+meeus-check',
  };
}

import { registerPlugin } from '../plugins/contract';
import { ART_LIST } from '../config/types';

/** 注册全部八术（幂等） */
export function registerAllArts(): void {
  for (const art of ART_LIST) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      registerPlugin(buildPlugin(art));
    } catch { /* 已注册 */ }
  }
}
