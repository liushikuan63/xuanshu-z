/** 全局类型：ResolvedConfig / RawInput / NormalizedMoment / RuleHit / CitationRef / Warning（§3.4 §3.5） */
import type { TimingCandidate, FactBundle, GuidanceBlock, AnswerTemplate } from '../plugins/contract';

/** 插件契约类型再导出（引擎层统一从 config/types 引用的历史约定） */
export type { TimingCandidate, FactBundle, GuidanceBlock, AnswerTemplate };

export type ArtType =
  | 'bazi' | 'liuyao' | 'meihua' | 'ziwei'
  | 'qimen' | 'liuren' | 'xiaoliuren' | 'jinkou';

/** 事项分类（14 类，附录 B） */
export type CategoryId =
  | '求财' | '事业' | '感情' | '学业' | '健康' | '出行' | '官非'
  | '失物' | '择日' | '家宅' | '生育' | '合作' | '决策' | '其他';

export const CATEGORIES: CategoryId[] = ['求财', '事业', '感情', '学业', '健康', '出行', '官非', '失物', '择日', '家宅', '生育', '合作', '决策', '其他'];

export const ART_LIST: ArtType[] = ['bazi', 'liuyao', 'meihua', 'ziwei', 'qimen', 'liuren', 'xiaoliuren', 'jinkou'];

export const ART_NAMES: Record<ArtType, string> = {
  bazi: '八字', liuyao: '六爻', meihua: '梅花易数', ziwei: '紫微斗数',
  qimen: '奇门遁甲', liuren: '大六壬', xiaoliuren: '小六壬', jinkou: '金口诀',
};

export const ART_TAGLINES: Record<ArtType, string> = {
  bazi: '五行生克·十神·用神旺衰，看一生格局与大运流年',
  liuyao: '卦象·世应·用神·动变，断具体一事的成败与应期',
  meihua: '体用生克·万物类象·外应，速断决策可否',
  ziwei: '十四主星×十二宫×四化气机，看一生格局与运限',
  qimen: '时空盘·九星八门八神，断方位与时机',
  liuren: '天地盘·四课三传，断人事过程与来意',
  xiaoliuren: '六神递推速断，失物出行可否',
  jinkou: '地分四位·五动三动，断来意与求谋',
};

/** §4.5 统一降级策略入口 */
export interface DegradedInfo {
  degraded: true;
  missing: string;         // 缺失了什么
  impact: string;          // 对结果的影响
  suggestArts: ArtType[];  // 推荐替代术数
}

export interface RawInput {
  /** 公历输入（统一唯一排盘输入，农历转换复用 calendar 农历层） */
  time: { year: number; month: number; day: number; hour: number; minute: number };
  gender?: '男' | '女';
  /** 六爻：每掷三次铜钱结果（3=背 少阳…），或报数/时间/指定卦 */
  coins?: number[][];            // 6 组，每组 3 枚（1=字 3=背）
  numbers?: number[];            // 梅花报数 / 小六壬随机数
  hexagram?: { upper: number; lower: number; moving?: number }; // 手动指定
  text?: string;                 // 字占文本
  method?: string;               // 起卦方法标识
  question?: string;             // 问句
  category?: string;             // 事项类别
  place?: { name?: string; longitude?: number };
  /** 缺信息标记（走统一降级 §4.5） */
  hourMissing?: boolean;
  allowHourMissingFallback?: boolean; // 紫微「仅用年月日」降级确认
}

/** 历法与流派约定（全部进 configHash） */
export interface CalendarConfig {
  yearSwitch: 'lichun' | 'chunyi';        // 换年：立春 / 正月初一
  monthSwitch: 'jieqi' | 'lunar';         // 换月：节气 / 农历初一
  zishi: 'switch' | 'night';              // 子时：23 点切次日 / 夜子时仍属当日
  trueSolarTime: boolean;                 // 真太阳时开关
  longitude: number | null;               // 参考经度（真太阳时需要）
  latitude?: number | null;               // 参考纬度（定位后城市判别：经纬度二维匹配用）
  timeOffsetMin: number;                  // 系统时间校准偏移（分钟，正=比标准快 → 起卦时间相应提前）
  city?: string;                          // 选中的城市名（经度反查的歧义消解：同经度多城时优先显示所选项）
  termAlgoVersion: string;                // 节气算法版本
}

export interface ZiweiConfig {
  sihuaVersion: 'quanji' | 'zhanyan' | 'feixing'; // 四化版本：全集主流/占验门/飞星派
  fixLeap: boolean;                        // 闰月归并（iztro 语义）
  horoscopeLevels: ('decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly')[];
}

export interface PaipanConfig {
  coinFaces: 2 | 3;                        // 硬币面数（六爻）
  baoshuRange: number;                     // 梅花报数范围
  movingRule: 'sum' | 'last';              // 六爻动爻规则（报数）
  leapPolicy: 'iztro-fixleap' | 'keep';    // 闰月处理
  qimenZhongJi: 'kun' | 'gen';             // 奇门中宫寄宫：寄坤二 / 寄艮八
  qimenJuMethod: 'chaibu' | 'zhirun' | 'maoshan';      // 奇门定局法：拆补 / 置闰 / 茅山
  qimenPanType: 'zhuan' | 'fei';           // 奇门排布法：转盘（排宫）/ 飞盘（飞宫）
  qimenTimeType: 'shi' | 'ri' | 'yue' | 'nian';  // 奇门时间体系：时家/日家/月家/年家
}

export interface ResolvedConfig {
  category: string;                        // 事项类别（影响应期/取象规则选择）
  playbookVersion: string;
  calendar: CalendarConfig;
  ziwei: ZiweiConfig;
  paipan: PaipanConfig;
  engineVersion: string;
}

export function defaultConfig(category = '其他'): ResolvedConfig {
  return {
    category,
    playbookVersion: 'v1',
    calendar: {
      yearSwitch: 'lichun', monthSwitch: 'jieqi', zishi: 'switch',
      trueSolarTime: false, longitude: null, timeOffsetMin: 0, termAlgoVersion: 'lunar-js-1.7+meeus-check',
    },
    ziwei: { sihuaVersion: 'quanji', fixLeap: true, horoscopeLevels: ['decadal', 'yearly'] },
    paipan: { coinFaces: 3, baoshuRange: 99, movingRule: 'sum', leapPolicy: 'iztro-fixleap', qimenZhongJi: 'kun', qimenJuMethod: 'chaibu', qimenPanType: 'zhuan', qimenTimeType: 'shi' },  // qimenTimeType 可选 shi/ri/yue/nian
    engineVersion: 'xuanshu-core@1.0.0',
  };
}

/** 归一化时刻：全部术数共用（D20 历法复用） */
export interface NormalizedMoment {
  year: number; month: number; day: number; hour: number; minute: number;
  jdn: number;                 // 儒略日数（当日 0 点，本地）
  dayPillar: string;           // 日干支（按子时约定）
  yearPillar: string;          // 年干支（按换年约定）
  monthPillar: string;         // 月干支（按换月约定）
  hourPillar: string;          // 时干支
  ganzhiDayIndex: number;      // 日干支序 0..59（0=甲子）
  xunkong: string;             // 日旬空（如「戌亥」）
  lunar: {
    year: number; month: number; day: number; isLeap: boolean;
    monthName: string; dayName: string;
    yearGanzhi: string; jieQiToday: string; nextJieQi: string;
  };
  trueSolarUsed: boolean;
  confidence: 'normal' | 'degraded';
  degraded?: DegradedInfo;
}

/** 引用五档分级（附录 F） */
export type ConfidenceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

/** CitationRef（§9.1）：canonicalId + segId + charRange 精确到字 */
export interface CitationRef {
  canonicalId: string;
  book: string;
  chapter: string;
  segId: string;
  charRange?: [number, number];
  quote: string;
  confidenceLevel: ConfidenceLevel;
  license?: string;
}

/** 规则命中：每条必带 ruleId + citations + confidenceLevel（D16） */
export interface RuleHit {
  ruleId: string;
  title: string;
  fact: string;                       // 机械事实（由计算层得出，不由模型生成）
  level: '吉' | '凶' | '变数' | '中性';
  citations: CitationRef[];
  confidenceLevel: ConfidenceLevel;
  confidenceExtra?: string;           // 如 version-dependent
  alternatives?: Array<{ label: string; version: string }>; // 四化版本分歧并列
  target?: string;                    // 命中对象（爻位/宫位等）
}

export interface Warning {
  code: string;
  message: string;
}

/** 盘面类型（§3.1 BoardSpec：plate|grid|table|ring|stack|list） */
export type BoardKind = 'plate' | 'grid' | 'table' | 'ring' | 'stack' | 'list';

export interface BoardSpec {
  kind: BoardKind;
  art: ArtType;
  title: string;
  /** 通用网格数据（紫微十二宫/奇门九宫/大六壬天地盘） */
  cells?: BoardCell[];
  /** 六爻/梅花爻位 */
  lines?: BoardLine[];
  /** 八字四柱等表格 */
  table?: { headers: string[]; rows: string[][]; sections?: { name: string; rows: string[][] }[] };
  info?: Array<{ label: string; value: string }>;
  badges?: string[];
}

export interface BoardCell {
  pos: number;               // 0..11（紫微）或 0..8（奇门）
  name?: string;             // 宫名 / 宫位名
  branch?: string;           // 地支
  stem?: string;             // 天干
  stars?: Array<{ name: string; brightness?: string; mutagen?: string; kind: 'major' | 'minor' | 'adj' }>;
  gates?: string;            // 奇门八门
  nineStars?: string;        // 奇门九星
  gods?: string;             // 八神
  gan?: string;              // 天盘干/仪
  marks?: string[];          // 标记（四害/马星/空亡）
  highlight?: boolean;       // 命宫/值符等
  extra?: string;
}

export interface BoardLine {
  index: number;             // 0=初爻
  yao: 'yang' | 'yin';
  moving: boolean;
  changed: 'yang' | 'yin' | null;
  najia?: string;            // 纳甲干支
  liuqin?: string;           // 六亲
  liushen?: string;          // 六神
  shiYing?: '世' | '应' | null;
  fuShen?: string;           // 伏神
  hidden?: string;
}
