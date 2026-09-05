/** intake 事项引导（§0.4/§6）：14 类事项词典（附录 B）、问句质量提示、术数推荐 */
import type { ArtType, CategoryId } from '@xuanshu/core';
import { ART_NAMES, ART_TAGLINES } from '@xuanshu/core';

export interface TaxonomyEntry {
  category: CategoryId;
  subs: string[];
  recommendArts: Array<{ art: ArtType; reason: string }>;
  keyFactors: string[];        // 应期/方位/数字/人物/颜色
  guide: string;               // 引导话术
  forbidden: string[];         // 禁用项
  sensitive?: boolean;         // 需前置免责
}

/** 附录 B 事项分类词典（含推荐术数与引导） */
export const TAXONOMY: TaxonomyEntry[] = [
  { category: '求财', subs: ['正财', '偏财', '生意', '讨债', '投资', '合伙分成'], recommendArts: [{ art: 'liuyao', reason: '财爻旺衰与应期最细' }, { art: 'qimen', reason: '求财方位与时机' }, { art: 'bazi', reason: '命局财运长期走势' }], keyFactors: ['应期', '方位', '数额趋势'], guide: '求财先分「正财（工资生意）」与「偏财（投资投机）」，并给时限——「这笔货款 Q3 能否收回」远好于「我财运如何」。', forbidden: ['投资收益承诺', '具体金额保证'] },
  { category: '事业', subs: ['求职', '升迁', '创业', '考公', '项目成败', '职场人际'], recommendArts: [{ art: 'liuyao', reason: '具体岗位/项目成败与应期' }, { art: 'ziwei', reason: '一生格局与阶段方向' }, { art: 'bazi', reason: '行业与大运走势' }], keyFactors: ['应期', '成败倾向', '方向'], guide: '事业问法要具体到「某岗位/某项目 + 时限」；若问长期方向，紫微/八字更擅长。', forbidden: ['承诺录用/中标结果'] },
  { category: '感情', subs: ['姻缘', '婚姻', '分手', '复合', '桃花', '异地'], recommendArts: [{ art: 'liuyao', reason: '关系走向、对方态度、应期最细' }, { art: 'bazi', reason: '合婚与婚运' }, { art: 'meihua', reason: '速断心意' }], keyFactors: ['应期', '对方态度', '走向'], guide: '先明确关系现状（已婚/恋爱/分手/相亲）与诉求（复合/推进/求证）；「他爱不爱我」不可证伪，建议改为「三个月内关系走向」。', forbidden: ['预测具体第三人身份', '「必须分手/结婚」行为指令', '窥探他人隐私'], sensitive: false },
  { category: '学业', subs: ['考试', '升学', '考证', '名次'], recommendArts: [{ art: 'liuyao', reason: '父母爻为文书成绩' }, { art: 'bazi', reason: '印星与学业运' }], keyFactors: ['应期', '成绩趋势'], guide: '说明考试时间与目标（考公/考研/某证），父母爻/印星状态才有意义。', forbidden: ['承诺录取'] },
  { category: '健康', subs: ['疾病趋势(不给诊断)', '康复', '体检'], recommendArts: [{ art: 'liuyao', reason: '官鬼为病、子孙为药（趋势参考）' }, { art: 'ziwei', reason: '疾厄宫健康趋势（强免责）' }], keyFactors: ['趋势'], guide: '术数不能替代就医。此处只提供「趋势参考」，如有不适请先就诊。', forbidden: ['医疗诊断', '停药/就医建议替代'], sensitive: true },
  { category: '出行', subs: ['迁旅', '择日', '安全', '移居'], recommendArts: [{ art: 'qimen', reason: '方位吉凶与时家择时' }, { art: 'liuyao', reason: '世爻应爻看行程' }, { art: 'meihua', reason: '速断可否' }], keyFactors: ['方位', '应期'], guide: '说明出行方向与时间窗，奇门可给方位与时机。', forbidden: ['绝对安全承诺'] },
  { category: '官非', subs: ['诉讼', '纠纷', '口舌', '违章'], recommendArts: [{ art: 'liuyao', reason: '官鬼状态与世应' }, { art: 'liuren', reason: '博弈过程' }], keyFactors: ['胜败倾向', '应期'], guide: '卦象不作为法律证据；重要事务请咨询执业律师。', forbidden: ['法律结论', '替代律师意见'], sensitive: true },
  { category: '失物', subs: ['财物', '证件', '宠物', '人'], recommendArts: [{ art: 'liuyao', reason: '用神断能否寻回+方位应期' }, { art: 'xiaoliuren', reason: '速断可否' }, { art: 'qimen', reason: '方位远近' }, { art: 'meihua', reason: '类象取物形' }], keyFactors: ['方位', '应期', '能否寻回'], guide: '必须说明「丢了什么、何时何地」——证件取父母爻、钱包取妻财爻，用神完全不同。', forbidden: ['指名道姓断言某人盗窃', '教唆搜查他人身体或住宅'] },
  { category: '择日', subs: ['婚嫁', '开业', '动土', '搬家', '签约'], recommendArts: [{ art: 'qimen', reason: '时家择吉' }, { art: 'bazi', reason: '结合命局喜忌' }], keyFactors: ['日期', '方位'], guide: '给出备选日期范围，结合《协纪辨方书》神煞与命局喜忌综合。', forbidden: [] },
  { category: '家宅', subs: ['买房', '租房', '风水', '装修', '迁坟(不给确定结论)'], recommendArts: [{ art: 'liuyao', reason: '家宅卦' }, { art: 'qimen', reason: '方位' }], keyFactors: ['方位', '吉凶倾向'], guide: '说明房产位置与关注点（采光/邻里/价格），盘面按宫位取象。', forbidden: ['风水改运承诺'], sensitive: false },
  { category: '生育', subs: ['怀孕(不给医疗结论)', '生产'], recommendArts: [{ art: 'liuyao', reason: '子孙爻与胎产（趋势参考）' }], keyFactors: ['趋势'], guide: '孕产问题请以妇产科医生意见为准；此处仅传统命理文化视角的趋势参考。', forbidden: ['医疗结论', '胎儿性别相关预测'], sensitive: true },
  { category: '合作', subs: ['合伙', '签约', '谈判', '借贷'], recommendArts: [{ art: 'liuyao', reason: '世应看双方、兄弟看竞争' }, { art: 'liuren', reason: '博弈过程与对方来意' }, { art: 'jinkou', reason: '来意速断' }], keyFactors: ['成败倾向', '对方态度', '应期'], guide: '说明合作对象关系（初识/熟人）与阶段（谈判/签约/履约）。', forbidden: ['借贷风险担保承诺'] },
  { category: '决策', subs: ['A/B选择', '去留', '时机'], recommendArts: [{ art: 'meihua', reason: '体用速断可否' }, { art: 'liuyao', reason: '世应与用神' }, { art: 'bazi', reason: '结合流年走势' }], keyFactors: ['可否', '时机'], guide: '把选项说清楚（A 是什么、B 是什么），一次一问。', forbidden: ['替用户做人生决定'] },
  { category: '其他', subs: ['综合', '自定义'], recommendArts: [{ art: 'liuyao', reason: '通用一事一占' }, { art: 'meihua', reason: '速断' }], keyFactors: [], guide: '泛问不如具体问：给时间窗与对象，解释才有锚点。', forbidden: [] },
];

export function taxonomyOf(category: CategoryId): TaxonomyEntry {
  return TAXONOMY.find(t => t.category === category) ?? TAXONOMY[TAXONOMY.length - 1];
}

/** 术数推荐：按事项交集打分 */
export function recommendArts(category: CategoryId): Array<{ art: ArtType; reason: string; tagline: string }> {
  const entry = taxonomyOf(category);
  return entry.recommendArts.map(r => ({ ...r, tagline: `${ART_NAMES[r.art]}：${ART_TAGLINES[r.art]}` }));
}

/** 问句质量检查（§6.8 即时提示） */
export interface QualityCheck {
  ok: boolean;
  hints: string[];
  overBROAD?: boolean;
  missingKey?: string;
}

export function checkQuestionQuality(category: CategoryId, text: string, art?: ArtType): QualityCheck {
  const hints: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, hints: ['先写下想问的事——先填事项与问法再起卦，顺序反了取用神会失准。'], missingKey: '问句' };
  if (trimmed.length <= 5) hints.push('问句太短，建议补充「对象 + 时限」：例如「我的身份证昨天在地铁站丢了，三天内能找回吗」。');
  if (/^(我)?(事业|感情|财运|健康)(会|能)?(不)?(会)?(好|成功|顺利)?[?？。.!！]?$/.test(trimmed) || /会不会(好|成功)|顺不顺利/.test(trimmed)) {
    hints.push('本术长于断具体事件，建议拆成「某岗位/某项目 + 时限」的形式。');
    return { ok: false, hints, overBROAD: true };
  }
  if (category === '失物' && !/什么|何物|证件|钱包|手机|钥匙|戒指|猫|狗|身份证|卡/.test(trimmed)) {
    hints.push('取用神需要先知道丢的是什么——证件取父母爻、钱包取妻财爻，差别很大。');
    return { ok: false, hints, missingKey: '何物' };
  }
  if (category === '感情' && /爱不爱我|正缘是谁/.test(trimmed)) {
    hints.push('「他爱不爱我」「正缘是谁」主观且不可证伪；建议改为「三个月内这段关系走向如何」。');
    return { ok: false, hints, overBROAD: true };
  }
  if (art === 'ziwei' && category === '事业') hints.push('紫微问事业建议问「方向与大势」：如「我适合什么方向，下一步 3–5 年怎么走」。');
  if (!/(\d+|[一二两三四五六七八九十]+)\s*(天|日|周|个月|年|月)/.test(trimmed)) hints.push('建议给出时限（如「一个月内」），应期推演才有落点。');
  return { ok: true, hints };
}

/** 6 步向导状态机（§0.4 IntakeWizard，融入九段路径） */
export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5 | 6;   // 选事项→细化问法→术数与配置→输入/起卦→出盘解释→记录标注
  category?: CategoryId;
  sub?: string;
  question?: string;
  art?: ArtType;
}

export const WIZARD_STEPS: Array<{ n: 1 | 2 | 3 | 4 | 5 | 6; title: string; hint: string }> = [
  { n: 1, title: '选事项', hint: '想问什么类型的事？这决定推荐术数与取用神路径' },
  { n: 2, title: '细化问法', hint: '把「我想问问」变成可验证的具体问题' },
  { n: 3, title: '术数与配置', hint: '按事项推荐术数，或自选' },
  { n: 4, title: '起卦/输入', hint: '按指引起卦，一事一卦' },
  { n: 5, title: '出盘与解释', hint: '逐格解释，每条断语可回链原典' },
  { n: 6, title: '记录与标注', hint: '存入案例本，事后回标以校准' },
];

export * from './playbooks';
