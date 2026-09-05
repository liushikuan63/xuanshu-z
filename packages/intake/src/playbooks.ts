/** 指引排盘 playbook（§6）：每事项一张九段断事路径卡；每条规则必带 ruleId + citations + confidenceLevel（D16） */
import type { ArtType, CategoryId, CitationRef } from '@xuanshu/core';

export interface Playbook {
  id: string;
  category: CategoryId;
  subCategory?: string;
  version: number;
  arts: { primary: ArtType; alternates: Array<{ art: ArtType; reason: string }>; whyPrimary: string };
  howToAsk: { goodExamples: string[]; badExamples: Array<{ text: string; why: string }>; requiredFields: string[]; clarify: Array<{ id: string; text: string }> };
  howToCast: string;
  yongShen: Array<{ condition: string; yongShen: string; ruleId: string; citations: CitationRef[]; confidenceLevel: 'A' | 'B' | 'C' | 'D' }>;
  signals: Array<{ name: string; meaning: '吉' | '凶' | '变数'; ruleId: string; citations: CitationRef[]; confidenceLevel: 'A' | 'B' | 'C' | 'D'; fact: string }>;
  locating?: { text: string; ruleId: string; citations: CitationRef[]; confidenceLevel: 'A' | 'B' | 'C' | 'D' };
  timing: { rules: Array<{ name: string; ruleId: string; citations: CitationRef[]; confidenceLevel: 'A' | 'B' | 'C' | 'D' }>; fallback: string };
  readingList: Array<{ canonicalId: string; book: string; chapter: string; why: string; priority: 1 | 2 | 3 }>;
  forbidden: string[];
  disclaimer: string;
  recordTemplate: { fields: Array<{ key: string; label: string; type: 'text' | 'number' | 'date' | 'enum'; options?: string[] }>; hint: string };
}

const cA = (canonicalId: string, book: string, chapter: string): CitationRef => ({ canonicalId, book, chapter, segId: `${canonicalId}.${chapter}`, quote: `（《${book}》·${chapter} 原典回链，点开在书阁高亮）`, confidenceLevel: 'A', license: '公有领域' });
const cD = (book: string, chapter: string): CitationRef => ({ canonicalId: 'folk-oral', book, chapter, segId: `folk-oral.${chapter}`, quote: '（民间口诀/流派整理，无原典逐字对应，D 级）', confidenceLevel: 'D', license: '流派说法' });

/** 六爻失物（§6.4 用户点名示例） */
export const liuyaoLost: Playbook = {
  id: 'liuyao.lost.v1', category: '失物', version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'xiaoliuren', reason: '只想快速知道「现在要不要去找」' },
      { art: 'qimen', reason: '物品可能已流出本地，需看方位与远近' },
      { art: 'meihua', reason: '想用类象推物之形状与所处环境' },
    ],
    whyPrimary: '六爻以用神代表失物，可同时断「能否寻回 + 方位场所 + 应期」，信息量最适合寻物',
  },
  howToAsk: {
    goodExamples: ['我的身份证昨天下午在地铁站附近丢了，三天内能找回吗', '家里丢了一枚金戒指，是不是被人拿走了'],
    badExamples: [{ text: '我东西丢了', why: '不指明何物，取用神会错（证件取父母爻、钱包取妻财爻）' }],
    requiredFields: ['何物', '丢失时间地点', '是否怀疑被盗', '是否要应期'],
    clarify: [{ id: 'isStolen', text: '你怀疑是遗失还是被人拿走？这决定要不要参看官鬼爻辨盗' }],
  },
  howToCast: '摇卦：净手静心，专念「某物现在何处、能否寻回」，连摇六次自下而上成卦；或报数、时间卦。一事一卦，不因第一卦不吉重摇。',
  yongShen: [
    { condition: '现金/钱包/首饰/手机/手表/钥匙/电子产品等有价财物', yongShen: '妻财爻', ruleId: 'liuyao.lost.yongshen.caifu', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一'), cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A' },
    { condition: '证件/合同/车票/书本/车/衣物/眼镜', yongShen: '父母爻', ruleId: 'liuyao.lost.yongshen.fumu', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A' },
    { condition: '宠物/玩具/活物/药品', yongShen: '子孙爻', ruleId: 'liuyao.lost.yongshen.zisun', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A' },
    { condition: '普通衣物鞋帽/共享物品', yongShen: '兄弟爻', ruleId: 'liuyao.lost.yongshen.xiongdi', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A' },
    { condition: '疑似被盗，需辨盗', yongShen: '官鬼爻（辨盗关键）', ruleId: 'liuyao.lost.yongshen.guigui', citations: [cA('zengshan', '增删卜易', '用神章第八'), cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A' },
    { condition: '内卦本宫 vs 外卦他宫', yongShen: '内卦＝家中未远；外卦＝已流向外', ruleId: 'liuyao.lost.neiwai', citations: [cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '用神旺相、不空不破、生合世爻或持世', meaning: '吉', ruleId: 'liuyao.lost.ji.wangxiang', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A', fact: '可寻' },
    { name: '子孙旺动', meaning: '吉', ruleId: 'liuyao.lost.ji.zisun', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A', fact: '福神制鬼，主有人送回线索' },
    { name: '用神安静在内卦', meaning: '吉', ruleId: 'liuyao.lost.ji.neijing', citations: [cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A', fact: '原地未动，只是被遮' },
    { name: '用神旬空化空、月破日绝、无原神生扶', meaning: '凶', ruleId: 'liuyao.lost.xiong.kongpo', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A', fact: '难寻' },
    { name: '用神动化退神/化鬼/化死墓绝', meaning: '凶', ruleId: 'liuyao.lost.xiong.huatui', citations: [cA('bianshi', '卜筮正宗', '合中帶剋論第十四')], confidenceLevel: 'A', fact: '主变卖、丢弃、损毁' },
    { name: '官鬼不上卦/旬空/休囚安静', meaning: '变数', ruleId: 'liuyao.lost.biangui.wuzei', citations: [cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A', fact: '无贼，纯健忘' },
    { name: '官鬼旺动、多鬼齐动、用神被旺鬼克', meaning: '变数', ruleId: 'liuyao.lost.biangui.youzei', citations: [cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A', fact: '蓄意偷窃或拾而不还之象' },
  ],
  locating: {
    text: '爻位：初爻地面墙角鞋柜地下室／二爻厨房卫生间床底／三爻卧室客厅矮柜／四爻高柜书桌玄关／五爻吊顶楼道路途／六爻房顶阁楼远方。地支：子正北水边冰箱／午正南窗台暖气／卯正东木门衣架／酉正西首饰盒金属筐／辰戌丑未箱柜杂物。六神：青龙整洁显眼处／朱雀纸张票据堆／勾陈堆叠杂物下／螣蛇缠绕夹缝／白虎硬物金属下阴暗处／玄武隐蔽暗处抽屉深处。',
    ruleId: 'liuyao.lost.loc', citations: [cD('民间传承整理', '失物定位口诀')], confidenceLevel: 'D',
  },
  timing: {
    rules: [
      { name: '静待冲、动待合、空待出空、墓待冲墓、破待补破、伏待冲飞', ruleId: 'liuyao.lost.timing.general', citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A' },
      { name: '速（1–3 日）：用神旺静临日建在内卦 → 冲日/当日/次日；中（4–15 日）：冲墓/补破/冲飞之日；迟（半月–数月）：出空/解合之月；无应期：用神空绝化鬼、外卦鬼旺动 → 建议止损', ruleId: 'liuyao.lost.timing.speed', citations: [cD('民间传承整理', '应期快慢口诀')], confidenceLevel: 'D' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'bianshi', book: '卜筮正宗', chapter: '用神分類定例第一', why: '取用神「各归其类，物有所主」的原始论述', priority: 1 },
    { canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', why: '用神宜旺不宜空破；鬼动克世之辨', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解', why: '「物失难寻，凭用神之存亡」', priority: 2 },
  ],
  forbidden: ['不得指名道姓断言某人盗窃（只能说「有外力介入」倾向）', '不得教唆搜查他人身体或住宅', '贵重物品被盗应提示报警并保留证据，卦象不作为法律证据'],
  disclaimer: '本答复不构成对物品下落或他人行为的确定性判断，请理性处理并依法维权。',
  recordTemplate: {
    fields: [
      { key: 'object', label: '丢失何物', type: 'text' },
      { key: 'lostAt', label: '丢失时间地点', type: 'text' },
      { key: 'found', label: '是否找回', type: 'enum', options: ['是', '否', '部分'] },
      { key: 'foundAt', label: '实际找到位置（对照卦象方位）', type: 'text' },
      { key: 'foundTime', label: '实际找回时间（对照应期）', type: 'date' },
    ],
    hint: '记录实际找到的位置与时间，与卦象方位、应期对照，这是提升断准率最快的方式',
  },
};

/** 六爻姻缘（§6.5） */
export const liuyaoLove: Playbook = {
  id: 'liuyao.love.v1', category: '感情', version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [{ art: 'bazi', reason: '合婚与婚运时机' }, { art: 'liuren', reason: '人事过程与双方互动' }, { art: 'meihua', reason: '速断心意' }],
    whyPrimary: '六爻断关系走向、对方态度与应期最细',
  },
  howToAsk: {
    goodExamples: ['我和 A 三个月内能否确定关系', '这段婚姻是否还有修复可能（半年内）'],
    badExamples: [
      { text: '他爱不爱我', why: '主观、不可证伪、易反复占' },
      { text: '我的正缘是谁', why: '无法具体到个人' },
    ],
    requiredFields: ['关系现状（已婚/恋爱/分手/相亲）', '对方是否已知', '时限', '诉求（复合/推进/分手/求证）'],
    clarify: [{ id: 'status', text: '你们现在处于什么状态？这决定看用神还是看世应' }],
  },
  howToCast: '一事一卦；忌短期内反复摇（「初筮告，再三渎」），7 日内同事项重复起卦系统会提示先看上一条。',
  yongShen: [
    { condition: '男占', yongShen: '妻财爻为女方/对象', ruleId: 'liuyao.love.yongshen.nan', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A' },
    { condition: '女占', yongShen: '官鬼爻为男方/对象', ruleId: 'liuyao.love.yongshen.nv', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A' },
    { condition: '对方态度', yongShen: '应爻', ruleId: 'liuyao.love.yongshen.ying', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A' },
    { condition: '已婚兼看', yongShen: '父母爻（婚书、家庭）', ruleId: 'liuyao.love.yongshen.fumu', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '世应相生相合、用神旺相生世', meaning: '吉', ruleId: 'liuyao.love.ji.shiying', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A', fact: '两情相悦、关系可推进' },
    { name: '用神持世、与世比和', meaning: '吉', ruleId: 'liuyao.love.ji.chishi', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A', fact: '缘分在身' },
    { name: '世应相克相冲、用神空破、兄爻旺动', meaning: '凶', ruleId: 'liuyao.love.xiong.chong', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A', fact: '有阻碍或竞争者' },
    { name: '玄武临用神', meaning: '变数', ruleId: 'liuyao.love.bian.xuanwu', citations: [cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')], confidenceLevel: 'A', fact: '暗昧、隐瞒之象' },
    { name: '用神化进/化退', meaning: '变数', ruleId: 'liuyao.love.bian.huajin', citations: [cA('zengshan', '增删卜易', '動静生尅章第十四')], confidenceLevel: 'A', fact: '化进推进、化退转淡' },
  ],
  locating: {
    text: '用神地支/卦宫可看对方方位与结识场景；六神看对方性格倾向（青龙温和、朱雀善言、白虎刚烈、玄武深沉）。',
    ruleId: 'liuyao.love.loc', citations: [cD('民间传承整理', '六神性情')], confidenceLevel: 'D',
  },
  timing: {
    rules: [{ name: '合待冲、冲待合、空待出空、旺待值日值月；用神动而逢值逢合之期', ruleId: 'liuyao.love.timing', citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A' }],
    fallback: '暂无内置应期推法，记录后回标',
  },
  readingList: [
    { canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', why: '婚姻占断核心论述', priority: 1 },
    { canonicalId: 'bianshi', book: '卜筮正宗', chapter: '世應論用神第二', why: '用神取法与吉凶', priority: 1 },
    { canonicalId: 'sanming-tonghui', book: '三命通会', chapter: '论五行', why: '八字合婚参照', priority: 3 },
  ],
  forbidden: ['不得预测/暗示具体第三人身份', '不得给出「必须分手」「必须结婚」行为指令', '涉及家暴、胁迫、未成年人 → 直接转专业机构指引', '不得用于窥探他人隐私'],
  disclaimer: '本答复仅为传统术数视角的关系趋势参考，不构成情感或婚姻建议。',
  recordTemplate: {
    fields: [
      { key: 'status', label: '关系现状', type: 'text' },
      { key: 'ask', label: '诉求', type: 'enum', options: ['复合', '推进', '分手', '求证'] },
      { key: 'trend', label: '事后走向', type: 'enum', options: ['确立', '缓和', '分手', '无变化'] },
      { key: 'when', label: '发生时间（对应期）', type: 'date' },
    ],
    hint: '记录实际走向与时间，对照卦象',
  },
};

/** 六爻事业（§6.6） */
export const liuyaoCareer: Playbook = {
  id: 'liuyao.career.v1', category: '事业', version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [{ art: 'bazi', reason: '命局适合什么行业、大运走势（长期方向）' }, { art: 'qimen', reason: '择时、方位、谈判时机' }, { art: 'liuren', reason: '职场人际与博弈过程' }],
    whyPrimary: '六爻断具体岗位/项目成败与应期最直接',
  },
  howToAsk: {
    goodExamples: ['我投的 A 公司这个岗位，一个月内能否拿到 offer', '这个项目下季度能否顺利验收'],
    badExamples: [{ text: '我事业会不会成功', why: '太泛，无法取用神与应期' }],
    requiredFields: ['具体事项（求职/升迁/创业/项目/考公）', '目标', '时限'],
    clarify: [{ id: 'type', text: '问的是某次成败（六爻）还是长期方向（八字/紫微）？' }],
  },
  howToCast: '摇卦专念一事；项目/投标类亦可用时间卦或报数。',
  yongShen: [
    { condition: '功名/职位/录取', yongShen: '官鬼爻', ruleId: 'liuyao.career.yongshen.guigui', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A' },
    { condition: '文书/合同/offer/学历', yongShen: '父母爻', ruleId: 'liuyao.career.yongshen.fumu', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A' },
    { condition: '薪资/利润/收益', yongShen: '妻财爻', ruleId: 'liuyao.career.yongshen.caifu', citations: [cA('zengshan', '增删卜易', '用神元神忌神仇神章第九')], confidenceLevel: 'A' },
    { condition: '同事/竞争者', yongShen: '兄弟爻', ruleId: 'liuyao.career.yongshen.xiongdi', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A' },
    { condition: '下属/创意/产出', yongShen: '子孙爻', ruleId: 'liuyao.career.yongshen.zisun', citations: [cA('bianshi', '卜筮正宗', '用神分類定例第一')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '官父两旺、官鬼持世或生世、父母（offer/合同）旺相不空', meaning: '吉', ruleId: 'liuyao.career.ji', citations: [cA('zengshan', '增删卜易', '用神章第八')], confidenceLevel: 'A', fact: '事可成' },
    { name: '官鬼空破、子孙旺动克官', meaning: '凶', ruleId: 'liuyao.career.xiong.zisunkegu', citations: [cA('bianshi', '卜筮正宗', '世應論用神第二')], confidenceLevel: 'A', fact: '职场是非、岗位难保' },
    { name: '兄弟旺动', meaning: '凶', ruleId: 'liuyao.career.xiong.xiongdi', citations: [cA('zengshan', '增删卜易', '用神元神忌神仇神章第九')], confidenceLevel: 'A', fact: '竞争激烈、利润被分' },
    { name: '官鬼化进/化退；父母空亡（合同未实）；世爻空亡（自身犹豫）', meaning: '变数', ruleId: 'liuyao.career.bian', citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A', fact: '按化爻细分' },
  ],
  timing: { rules: [{ name: '官鬼旺相值日值月、父母出空填实、合待冲', ruleId: 'liuyao.career.timing', citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A' }], fallback: '暂无内置应期推法' },
  readingList: [
    { canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', why: '求名求官断法', priority: 1 },
    { canonicalId: 'bianshi', book: '卜筮正宗', chapter: '世應論用神第二', why: '官鬼父母取用', priority: 1 },
    { canonicalId: 'yuanhaiziping', book: '渊海子平', chapter: '基础第一', why: '八字方向看格局用神', priority: 3 },
  ],
  forbidden: ['不得承诺录用/中标结果', '不得建议违法违规操作（行贿、伪造材料）', '涉及裁员、劳动纠纷 → 提示劳动仲裁/法律咨询渠道'],
  disclaimer: '本答复仅为传统术数视角的趋势参考，不构成职业建议。',
  recordTemplate: {
    fields: [
      { key: 'matter', label: '事项', type: 'text' },
      { key: 'goal', label: '目标与时限', type: 'text' },
      { key: 'result', label: '结果', type: 'enum', options: ['成功', '失败', '延期'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录结果与实际时间，对照应期',
  },
};

/** 紫微事业/格局（§6.9-②） */
export const ziweiCareer: Playbook = {
  id: 'ziwei.career.v1', category: '事业', version: 1,
  arts: {
    primary: 'ziwei',
    alternates: [{ art: 'bazi', reason: '并观看用神喜忌' }, { art: 'liuyao', reason: '问「某岗位/项目成败」时改六爻' }],
    whyPrimary: '紫微看格局 + 大运官禄线，适合「方向与阶段」而非单次成败',
  },
  howToAsk: {
    goodExamples: ['我适合什么方向，下一步 3–5 年怎么走'],
    badExamples: [{ text: '我事业会不会好', why: '过泛，无法定位宫位与运限' }],
    requiredFields: ['出生年月日时', '性别（大限顺逆）', '出生地（真太阳时）'],
    clarify: [{ id: 'hour', text: '能否确认出生时辰？时辰错则全盘错' }],
  },
  howToCast: '阳历/农历生日 + 出生时辰 + 性别 + 出生地经度；无确切时辰 → 改用六爻/梅花，或勾选「无时辰降级」（仅供参考）。',
  yongShen: [
    { condition: '事业主线', yongShen: '官禄宫为主（官星）、财帛宫（财源）', ruleId: 'ziwei.career.yongshen.guanlu', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' },
    { condition: '格局底色', yongShen: '命宫（格局）、福德宫（后天努力）', ruleId: 'ziwei.career.yongshen.ming', citations: [cA('taiwei-fu', '太微赋', '全文')], confidenceLevel: 'A' },
    { condition: '外出发展', yongShen: '迁移宫', ruleId: 'ziwei.career.yongshen.qianyi', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '官禄宫主星组合 + 三方四正（财官迁福）', meaning: '吉', ruleId: 'ziwei.career.sig.sanfang', citations: [cA('taiwei-fu', '太微赋', '全文')], confidenceLevel: 'A', fact: '格局吉则事业线稳' },
    { name: '四化入官禄/财帛', meaning: '吉', ruleId: 'ziwei.career.sig.sihua', citations: [cA('ziwei-quanshu', '紫微斗数全书', '斗数准绳第四')], confidenceLevel: 'A', fact: '化禄权科入主得力，化忌入主劳碌执著' },
    { name: '煞星（擎羊陀罗火铃空劫）会照官禄', meaning: '凶', ruleId: 'ziwei.career.sig.shaxing', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A', fact: '波折多，宜技术立身' },
  ],
  locating: { text: '官禄宫地支方位 + 四化禄权科落宫，可参看方位取象。', ruleId: 'ziwei.career.loc', citations: [cD('流派整理', '方位取象')], confidenceLevel: 'D' },
  timing: {
    rules: [{ name: '大限 → 流年递进：先看第几大限走官禄/财帛，再看该大限内哪一年流年四化引动官禄宫', ruleId: 'ziwei.career.timing.dayun', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' }],
    fallback: '无运限数据时提示「请补全出生信息」',
  },
  readingList: [
    { canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '官禄宫主断语源', priority: 1 },
    { canonicalId: 'taiwei-fu', book: '太微赋', chapter: '全文', why: '星曜组合断事核心口诀', priority: 1 },
    { canonicalId: 'suidi-fu', book: '骨髓赋', chapter: '全文', why: '格局论断', priority: 2 },
  ],
  forbidden: ['不得承诺职位/财富结果', '不得给出「辞职/创业」等确定性指令'],
  disclaimer: '本答复为传统命理文化的趋势参考，不构成职业或投资建议。',
  recordTemplate: {
    fields: [
      { key: 'direction', label: '当前方向', type: 'text' },
      { key: 'dayun', label: '所看大限/流年', type: 'text' },
      { key: 'actual', label: '事后实际走向', type: 'text' },
    ],
    hint: '记录「大限 + 流年应期」，3–5 年后回看验证',
  },
};

/** 紫微姻缘/合婚（§6.9-③） */
export const ziweiLove: Playbook = {
  id: 'ziwei.love.v1', category: '感情', version: 1,
  arts: {
    primary: 'ziwei',
    alternates: [{ art: 'liuyao', reason: '具体关系走向与应期' }, { art: 'bazi', reason: '合婚' }],
    whyPrimary: '夫妻宫主星 + 四化看缘分格局',
  },
  howToAsk: {
    goodExamples: ['我的夫妻宫显示的婚姻倾向如何', '我们两人合婚（需双方完整生辰）'],
    badExamples: [{ text: '我什么时候结婚', why: '需先看大限流年引动，泛问无落点' }],
    requiredFields: ['出生信息', '想看「当前缘分走向」还是「两人合婚」'],
    clarify: [{ id: 'mode', text: '看自己夫妻宫，还是双方合婚？后者需双方完整生辰' }],
  },
  howToCast: '双方各自排盘后比对夫妻宫与命宫互动；单看缘分只排自己盘。',
  yongShen: [
    { condition: '姻缘主线', yongShen: '夫妻宫（主星 + 四化）', ruleId: 'ziwei.love.yongshen.fuqi', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' },
    { condition: '自身对待', yongShen: '命宫 + 福德宫（缘分深浅）', ruleId: 'ziwei.love.yongshen.fude', citations: [cA('taiwei-fu', '太微赋', '全文')], confidenceLevel: 'A' },
    { condition: '合婚', yongShen: '双方命盘夫妻宫与命宫互动', ruleId: 'ziwei.love.yongshen.hehun', citations: [cD('流派说法', '合婚口诀')], confidenceLevel: 'D' },
  ],
  signals: [
    { name: '夫妻宫化禄', meaning: '吉', ruleId: 'ziwei.love.sig.lu', citations: [cA('ziwei-quanshu', '紫微斗数全书', '斗数准绳第四')], confidenceLevel: 'A', fact: '缘浓' },
    { name: '夫妻宫化忌', meaning: '凶', ruleId: 'ziwei.love.sig.ji', citations: [cA('ziwei-quanshu', '紫微斗数全书', '斗数准绳第四')], confidenceLevel: 'A', fact: '纠结亏欠' },
    { name: '桃花星（贪狼/廉贞/天姚）会照', meaning: '变数', ruleId: 'ziwei.love.sig.taohua', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A', fact: '感情丰富、防烂桃花' },
    { name: '煞星冲照夫妻宫', meaning: '凶', ruleId: 'ziwei.love.sig.sha', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A', fact: '波折、晚婚宜' },
  ],
  timing: { rules: [{ name: '大限夫妻宫 + 流年四化引动夫妻宫/红鸾天喜之期为候选', ruleId: 'ziwei.love.timing', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' }], fallback: '无运限数据时提示补全出生信息' },
  readingList: [
    { canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '夫妻宫主断语源', priority: 1 },
    { canonicalId: 'suidi-fu', book: '骨髓赋', chapter: '全文', why: '婚姻格局论', priority: 2 },
  ],
  forbidden: ['合婚说法流派差异极大，无原典出处的配对口诀一律 D 级分区', '不得判定「此人不适合结婚」等结论'],
  disclaimer: '本答复为传统命理文化的趋势参考，不构成情感建议。',
  recordTemplate: { fields: [{ key: 'mode', label: '看盘方式', type: 'enum', options: ['自己夫妻宫', '双方合婚'] }, { key: 'actual', label: '事后实际', type: 'text' }], hint: '回标关系走向' },
};

/** 紫微流年/大运（§6.9-④） */
export const ziweiYear: Playbook = {
  id: 'ziwei.year.v1', category: '其他', subCategory: '流年大运', version: 1,
  arts: {
    primary: 'ziwei',
    alternates: [{ art: 'bazi', reason: '流年五行喜忌并观' }],
    whyPrimary: '紫微「精准」来自时间分层：生年四化定格局 → 大限定十年 → 流年找应期',
  },
  howToAsk: {
    goodExamples: ['2026 这一年我的事业和健康要注意什么'],
    badExamples: [{ text: '我明年运气怎么样', why: '先看大限方向，再落流年，否则无锚点' }],
    requiredFields: ['出生信息', '想看的年份/大限'],
    clarify: [{ id: 'layer', text: '问十年大势（大限）还是某一年（流年）？' }],
  },
  howToCast: '排盘后定位现行大限与流年，逐层展开：生年四化 → 大限四化 → 流年四化。',
  yongShen: [
    { condition: '十年大势', yongShen: '大限命宫及其三方四正 + 大限四化', ruleId: 'ziwei.year.yongshen.dayun', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' },
    { condition: '当年吉凶', yongShen: '流年命宫 + 流年四化引动', ruleId: 'ziwei.year.yongshen.liunian', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '生年四化 = 先天底色（终身课题）', meaning: '变数', ruleId: 'ziwei.timing.cross-layer', citations: [cA('ziwei-quanshu', '紫微斗数全书', '斗数准绳第四')], confidenceLevel: 'A', fact: '同层四化力量最强，跨层只能引动不能消除' },
    { name: '流年四化引动生年忌', meaning: '凶', ruleId: 'ziwei.year.sig.yindong', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A', fact: '当年课题触发，注意该宫位事项' },
  ],
  timing: { rules: [{ name: '论断次序固定：生年 → 大限 → 流年，不可颠倒', ruleId: 'ziwei.year.timing.order', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' }], fallback: '—' },
  readingList: [
    { canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '流年断法', priority: 1 },
    { canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '斗数准绳第四', why: '四化分层', priority: 1 },
  ],
  forbidden: ['AI 不得简化为「某年一定发财/有灾」'],
  disclaimer: '本答复为传统命理文化的趋势参考。',
  recordTemplate: { fields: [{ key: 'year', label: '所看年份', type: 'number' }, { key: 'actual', label: '事后实际', type: 'text' }], hint: '年末回标' },
};

/** 紫微健康趋势（强免责 §6.9） */
export const ziweiHealth: Playbook = {
  id: 'ziwei.health.v1', category: '健康', version: 1,
  arts: { primary: 'ziwei', alternates: [{ art: 'liuyao', reason: '官鬼为病、子孙为药' }], whyPrimary: '疾厄宫看健康趋势——仅趋势，绝不诊断' },
  howToAsk: {
    goodExamples: ['未来几年我的健康趋势需要特别注意什么'],
    badExamples: [{ text: '我是不是得了某病', why: '术数不能诊断，请就医' }],
    requiredFields: ['出生信息'],
    clarify: [{ id: 'medical', text: '如有不适，请先就医——本工具不提供医疗意见' }],
  },
  howToCast: '排盘看疾厄宫主星、煞星会照与四化引动。',
  yongShen: [{ condition: '健康趋势', yongShen: '疾厄宫（主星 + 煞曜 + 四化）', ruleId: 'ziwei.health.yongshen', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' }],
  signals: [{ name: '疾厄宫化忌或煞聚', meaning: '凶', ruleId: 'ziwei.health.sig', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A', fact: '该阶段注意作息与体检（非诊断）' }],
  timing: { rules: [{ name: '大限/流年引动疾厄宫之期注意健康', ruleId: 'ziwei.health.timing', citations: [cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')], confidenceLevel: 'A' }], fallback: '—' },
  readingList: [{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '疾厄宫断语', priority: 1 }],
  forbidden: ['不得给出任何疾病诊断或用药建议', '不适请立即就医', '不得替代体检与医嘱'],
  disclaimer: '★ 强免责：本答复仅为传统命理文化视角的趋势参考，不构成医疗意见。如有不适请及时就医。',
  recordTemplate: { fields: [{ key: 'note', label: '记录', type: 'text' }], hint: '仅作个人趋势记录' },
};

/** 八字事业方向 / 过去未来（复盘） */
export const baziCareer: Playbook = {
  id: 'bazi.career.v1', category: '事业', version: 1,
  arts: { primary: 'bazi', alternates: [{ art: 'ziwei', reason: '并观格局' }, { art: 'liuyao', reason: '单次成败问六爻' }], whyPrimary: '八字看「长期方向 + 大运走势」' },
  howToAsk: {
    goodExamples: ['未来三年适不适合转行', '我这步大运为什么事业反复（复盘）'],
    badExamples: [{ text: '我适合干什么', why: '太泛，需结合具体行业选项' }],
    requiredFields: ['出生信息', '具体方向选项'],
    clarify: [{ id: 'scope', text: '问的是方向（喜用五行）还是某步大运？' }],
  },
  howToCast: '排四柱 → 取用神 → 看大运流年喜忌。',
  yongShen: [
    { condition: '行业方向', yongShen: '用神/喜神之五行对应行业', ruleId: 'bazi.career.yongshen', citations: [cA('ditiansui', '滴天髓', '序第一'), cA('yuanhaiziping', '渊海子平', '基础第一')], confidenceLevel: 'A' },
    { condition: '阶段吉凶', yongShen: '大运干支与用神的生克', ruleId: 'bazi.career.dayun', citations: [cA('ditiansui', '滴天髓', '天道第二')], confidenceLevel: 'A' },
  ],
  signals: [{ name: '大运补喜用', meaning: '吉', ruleId: 'bazi.career.sig.xi', citations: [cA('ditiansui', '滴天髓', '序第一')], confidenceLevel: 'A', fact: '该阶段顺势可为' }, { name: '大运助忌神', meaning: '凶', ruleId: 'bazi.career.sig.ji', citations: [cA('ditiansui', '滴天髓', '序第一')], confidenceLevel: 'A', fact: '宜守、蓄力、防冒进' }],
  timing: { rules: [{ name: '以大运起讫年份为阶段边界，流年天干地支与用神作用定年内吉凶', ruleId: 'bazi.career.timing', citations: [cA('ditiansui', '滴天髓', '天道第二')], confidenceLevel: 'A' }], fallback: '—' },
  readingList: [
    { canonicalId: 'ditiansui', book: '滴天髓', chapter: '序第一', why: '旺衰用神总纲', priority: 1 },
    { canonicalId: 'ditiansui', book: '滴天髓', chapter: '天道第二', why: '行运喜忌', priority: 1 },
  ],
  forbidden: ['不得承诺行业成败', '不构成职业/投资建议'],
  disclaimer: '本答复为传统命理文化参考。',
  recordTemplate: { fields: [{ key: 'q', label: '所问方向', type: 'text' }, { key: 'actual', label: '事后实际', type: 'text' }], hint: '回标' },
};

/** 过去未来（§6.7 拆分） */
export const pastFuture: Playbook = {
  id: 'past-future.v1', category: '其他', subCategory: '过去未来', version: 1,
  arts: {
    primary: 'bazi',
    alternates: [{ art: 'liuyao', reason: '验卦校准' }, { art: 'liuren', reason: '来意占（高阶、样本不足）' }],
    whyPrimary: '「过去」用八字复盘已走大运，「未来」占具体事用六爻/奇门/大六壬、看走势用八字',
  },
  howToAsk: {
    goodExamples: ['2020–2023 这步大运我为什么事业反复（复盘）', '未来三年适不适合转行（走势）', '这笔货款 Q3 能否收回（具体事）'],
    badExamples: [
      { text: '我前世是谁', why: '无法验证，不予支持' },
      { text: '我三年前那天下午到底发生了什么', why: '无法验证，不做「精确回放」' },
    ],
    requiredFields: ['方向（过去/未来）', '具体诉求（复盘/校准/趋势/成败/时机）', '已知事实（看过去必填）'],
    clarify: [{ id: 'facts', text: '请提供已知事实用于对照卦象——这是校准取用神的关键' }],
  },
  howToCast: '看过去：排出生盘走已过大运流年，对照已知事实复盘；看未来：按对应事项 playbook 起卦。',
  yongShen: [
    { condition: '复盘（过去）', yongShen: '已行大运干支与流年，对照用户已知事实', ruleId: 'pastfuture.yongshen.fupan', citations: [cA('ditiansui', '滴天髓', '天道第二')], confidenceLevel: 'A' },
    { condition: '验卦（过去）', yongShen: '对已发生之事起卦，用已知结果校验取用神', ruleId: 'pastfuture.yongshen.yanggua', citations: [cA('zengshan', '增删卜易', '世應章第六')], confidenceLevel: 'A' },
    { condition: '趋势（未来）', yongShen: '大运流年喜忌', ruleId: 'pastfuture.yongshen.qushi', citations: [cA('ditiansui', '滴天髓', '序第一')], confidenceLevel: 'A' },
    { condition: '来意占（过去）', yongShen: '大六壬四课三传观来意', ruleId: 'pastfuture.yongshen.laiyi', citations: [cA('liuren-daquan', '六壬大全', '十干寄宫')], confidenceLevel: 'B' },
  ],
  signals: [{ name: '能力边界（直说）', meaning: '变数', ruleId: 'pastfuture.boundary', citations: [], confidenceLevel: 'D', fact: '对「过去」的作用是复盘与校准，不是精确回放；对「未来」给的是趋势与时机，不是确定结果。来意占等高阶技法无公开可核对样本，系统标「资料不足，仅供参考」。' }],
  timing: { rules: [{ name: '占具体事按对应 playbook 应期推法；走势类以大运起讫为阶段', ruleId: 'pastfuture.timing', citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A' }], fallback: '—' },
  readingList: [
    { canonicalId: 'ditiansui', book: '滴天髓', chapter: '天道第二', why: '大运复盘', priority: 1 },
    { canonicalId: 'zengshan', book: '增删卜易', chapter: '世應章第六', why: '以已知事实校卦', priority: 1 },
  ],
  forbidden: ['不得宣称能「精确回放/预知」具体事件', '不得用于「查他人隐私/前世/因果」', '涉及已发生的伤害事件、案件 → 引导至专业机构，不做推断'],
  disclaimer: '本软件对「过去」的作用是复盘与校准，不是精确回放；对「未来」给趋势与时机，不是确定结果。',
  recordTemplate: { fields: [{ key: 'dir', label: '方向', type: 'enum', options: ['过去', '未来'] }, { key: 'facts', label: '已知事实', type: 'text' }, { key: 'match', label: '吻合度', type: 'enum', options: ['高', '中', '低'] }], hint: '记录实际与卦象吻合度，修正取用神' },
};

/** 紫微 vs 八字并观（§6.9-⑤） */
export const baziZiweiCompare: Playbook = {
  id: 'bazi-ziwei-compare.v1', category: '其他', subCategory: '紫微八字并观', version: 1,
  arts: { primary: 'ziwei', alternates: [{ art: 'bazi', reason: '并观' }], whyPrimary: '两术结论冲突时不做非此即彼，并列分歧点供用户回看校准' },
  howToAsk: {
    goodExamples: ['紫微和八字对我事业方向的判断一致吗'],
    badExamples: [{ text: '哪个更准', why: '系统不判定优劣，只并列呈现' }],
    requiredFields: ['出生信息（两术共用历法层）'],
    clarify: [{ id: 'conflict', text: '如两术结论冲突，您希望并列展示分歧点吗？' }],
  },
  howToCast: '同一出生信息分别排紫微盘与八字盘，对照结论。',
  yongShen: [{ condition: '一致', yongShen: '正常采信，标注两条 ruleId', ruleId: 'compare.same', citations: [], confidenceLevel: 'D' }, { condition: '冲突', yongShen: '断语写「紫微见 X（禄权科落宫）、八字见 Y（用神旺衰）」，列出分歧点与各自依据', ruleId: 'compare.conflict', citations: [], confidenceLevel: 'D' }],
  signals: [{ name: '分歧处理', meaning: '变数', ruleId: 'compare.divergence', citations: [], confidenceLevel: 'D', fact: '不做非此即彼判断；引导用户用后续实际结果回看校准（案例本闭环）' }],
  timing: { rules: [], fallback: '按各自术数 playbook' },
  readingList: [{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '紫微视角', priority: 2 }, { canonicalId: 'ditiansui', book: '滴天髓', chapter: '序第一', why: '八字视角', priority: 2 }],
  forbidden: ['不得宣称某术「更准」'],
  disclaimer: '两种体系、两种切入，分歧记录供自行校准。',
  recordTemplate: { fields: [{ key: 'agree', label: '两术是否一致', type: 'enum', options: ['一致', '分歧'] }, { key: 'note', label: '备注', type: 'text' }], hint: '回看校准' },
};

/** 其余事项卡（简版复用九段结构） */
function simpleCard(id: string, category: CategoryId, primary: ArtType, primaryWhy: string, yongShenText: string, signalText: string, reading: Playbook['readingList']): Playbook {
  return {
    id, category, version: 1,
    arts: { primary, alternates: [], whyPrimary: primaryWhy },
    howToAsk: { goodExamples: [`${category}类事项示例：请补充对象与时限`], badExamples: [{ text: '太泛的问法', why: '补「对象 + 时限」' }], requiredFields: ['对象', '时限'], clarify: [] },
    howToCast: '按所选术数的起卦指引操作（见第 3/4 步）。',
    yongShen: [{ condition: category, yongShen: yongShenText, ruleId: `${id}.yongshen`, citations: reading.length ? [cA(reading[0].canonicalId, reading[0].book, reading[0].chapter)] : [], confidenceLevel: 'A' }],
    signals: [{ name: '核心信号', meaning: '变数', ruleId: `${id}.signal`, citations: [], confidenceLevel: 'A', fact: signalText }],
    timing: { rules: [{ name: '静待冲、动待合、空待出空、墓待冲墓、破待补破、伏待冲飞', ruleId: `${id}.timing.general`, citations: [cA('zengshan', '增删卜易', '動變生尅冲合章第十五')], confidenceLevel: 'A' }], fallback: '暂无内置应期推法' },
    readingList: reading,
    forbidden: ['不得给出确定性结果承诺', '不构成专业建议'],
    disclaimer: '本答复为传统术数文化参考。',
    recordTemplate: { fields: [{ key: 'note', label: '记录', type: 'text' }], hint: '事后回标' },
  };
}

export const allPlaybooks: Playbook[] = [
  liuyaoLost, liuyaoLove, liuyaoCareer, ziweiCareer, ziweiLove, ziweiYear, ziweiHealth, baziCareer, pastFuture, baziZiweiCompare,
  simpleCard('liuyao.wealth.v1', '求财', 'liuyao', '妻财爻旺衰与应期最细', '妻财爻（兼看子孙为财源、兄弟为劫财）', '财爻旺相持世生世则得财；兄弟旺动则破财竞争', [{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神元神忌神仇神章第九', why: '求财断法', priority: 1 }]),
  simpleCard('liuyao.study.v1', '学业', 'liuyao', '父母爻为文书成绩', '父母爻（兼看官鬼为名次）', '父母旺相不空、官鬼生世，考试有利', [{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八', why: '考试断法', priority: 1 }]),
  simpleCard('liuyao.travel.v1', '出行', 'liuyao', '世爻为行人', '世爻（兼看父母为行李车船）', '世爻旺相不冲不克，出行平安', [{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解', why: '出行断法', priority: 1 }]),
  simpleCard('liuyao.lawsuit.v1', '官非', 'liuyao', '官鬼为官府、世应看胜负', '世爻为我、官鬼为官、应爻为对方', '世旺官生世者利我；官鬼克世者防讼累', [{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解', why: '诉讼断法', priority: 1 }]),
  simpleCard('liuyao.health.v1', '健康', 'liuyao', '官鬼为病、子孙为药（趋势）', '官鬼爻（病）、子孙爻（药医）', '子孙旺则病易愈；官鬼旺动防病加深——不构成医疗意见', [{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解', why: '疾病断法', priority: 1 }]),
  simpleCard('qimen.travel.v1', '出行', 'qimen', '看方位吉凶与时机', '开门/生门所在宫为吉方，值使门定时机', '吉门吉格之方宜行；四害之方避之', [{ canonicalId: 'yanbodiaosouge', book: '烟波钓叟歌', chapter: '全文', why: '奇门总纲', priority: 1 }]),
  simpleCard('qimen.wealth.v1', '求财', 'qimen', '生门与戊（资本）落宫', '生门（财源）、戊（本金）、值符（我方）', '生门旺相生值符宫则利求财', [{ canonicalId: 'yanbodiaosouge', book: '烟波钓叟歌', chapter: '全文', why: '奇门总纲', priority: 1 }]),
  simpleCard('liuren.coop.v1', '合作', 'liuren', '四课看双方、三传看过程', '日干为我、日支为彼、三传为事之始终', '三传吉将递生则合作顺遂', [{ canonicalId: 'liuren-daquan', book: '六壬大全', chapter: '一賊尅法', why: '课体断法', priority: 1 }]),
  simpleCard('qimen.date.v1', '择日', 'qimen', '看用事方位与值使时机选课', '所择事项对应吉门（婚娶用开门/生气，出行用开门，安葬看生门），避开四害时辰', '吉门吉格加临且无击刑入墓则课吉；三奇得使为上课', [{ canonicalId: 'yanbodiaosouge', book: '烟波钓叟歌', chapter: '全文', why: '奇门择时总纲', priority: 1 }]),
  simpleCard('liuyao.home.v1', '家宅', 'liuyao', '以世爻为人、宅爻（初爻/父母）为宅', '世爻为人丁、父母爻为宅舍、财爻为宅气', '世宅相生则宅安；父母爻空破或官鬼旺动，宅有不安', [{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解', why: '总断千金赋通则', priority: 1 }]),
  simpleCard('ziwei.child.v1', '生育', 'ziwei', '子女宫星情定子女缘分', '子女宫主星（吉星集则为佳）兼看田宅宫', '子女宫吉星庙旺则子女缘厚；煞星聚则宜晚育——不构成医学意见', [{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八', why: '诸星宫位问答', priority: 1 }]),
  simpleCard('bazi.health.v1', '健康', 'bazi', '五行偏枯与用神受制看体质倾向', '日主强弱与五行分布（过旺过衰之五行对应脏腑）', '五行流通则体健；某行过旺或受克重，其对应脏腑注意——不构成医疗意见', [{ canonicalId: 'yuanhaiziping', book: '渊海子平', chapter: '基础第一', why: '五行基础', priority: 1 }]),
  simpleCard('bazi.wealth.v1', '求财', 'bazi', '财星旺衰与身财平衡', '财星（我克者）兼看食伤生财', '身旺能任财、财星有源则利求财；比劫夺财防破耗', [{ canonicalId: 'yuanhaiziping', book: '渊海子平', chapter: '十神第二', why: '十神取象', priority: 1 }]),
  simpleCard('meihua.love.v1', '感情', 'meihua', '体用生克看双方关系', '体卦为己、用卦为对方', '用生体则彼来就我；体用比和则和睦', [{ canonicalId: 'meihua', book: '梅花易数', chapter: '卷二', why: '体用生克', priority: 1 }]),
  simpleCard('liuren.decision.v1', '决策', 'liuren', '三传递生克定进退', '日干为我、发用为事端、末传为结局', '三传递生入吉门则可行；传克日干则宜守', [{ canonicalId: 'bianta', book: '毕法赋', chapter: '畢法賦上', why: '毕法逐条', priority: 1 }]),
  simpleCard('jinkou.decision.v1', '决策', 'jinkou', '四位生克定来意与可否', '地分为事、贵神为中间、将神为所谋、人元为我', '四位相生则事顺；相克视五动定阻碍', [{ canonicalId: 'bianta', book: '毕法赋', chapter: '畢法賦上', why: '课式总则参考', priority: 2 }]),
  simpleCard('xiaoliuren.lost.v1', '失物', 'xiaoliuren', '六神速断可否', '落宫六神（大安/速喜/小吉吉；留连/赤口/空亡凶）', '速断「要不要现在去找」，长期应期不归它管', [{ canonicalId: 'liuren-daquan', book: '六壬大全', chapter: '十二地支神煞', why: '支神方位参考', priority: 2 }]),
  simpleCard('meihua.decision.v1', '决策', 'meihua', '体用生克定可否', '体卦为我、用卦为事', '用生体/体克用即可为；用克体则止', [{ canonicalId: 'meihua', book: '梅花易数', chapter: '卷二', why: '体用总诀', priority: 1 }]),
];

export function playbookFor(category: CategoryId, art?: ArtType): Playbook | undefined {
  const list = allPlaybooks.filter(p => p.category === category);
  if (art) return list.find(p => p.arts.primary === art) ?? list[0];
  return list[0];
}

export function playbookById(id: string): Playbook | undefined {
  return allPlaybooks.find(p => p.id === id);
}
