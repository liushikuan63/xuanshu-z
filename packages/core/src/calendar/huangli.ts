/** 万年历黄历引擎（calendar/huangli.ts）：每日完整黄历 + 星座星象。
 * 数据源 lunar-javascript（锁 minor，Solar/Lunar），离线确定性；本模块做纯函数封装与白话结构。
 * 定位：传统历法/星象文化参考，非医疗/投资/法律建议（R11/D28 约束延伸）。
 */
import { Solar } from 'lunar-javascript';

export interface HuangliDay {
  date: string;              // YYYY-MM-DD
  lunar: string;             // 农历（如 二〇二六年七月二十）
  lunarMonth: string;        // 农历月日短标（如 七月二十）
  lunarYear: string;         // 农历年干支（立春口径）
  shengXiao: string;         // 当日生肖（年支）
  week: string;              // 星期
  ganzhi: string;            // 日柱干支（如 戊寅）
  monthPillar: string;       // 月柱
  lunarGZ: string;           // 农历干支日
  jianChu: string;           // 建除十二神（值日）
  zhiXing: string;           // 值神（天乙/明堂…）
  yi: string[];              // 宜
  ji: string[];              // 忌
  chong: string;             // 冲（如 冲(壬申)猴）
  sha: string;               // 煞（北/东…）
  jiShen: string[];          // 吉神宜趋
  xiongSha: string[];        // 凶煞宜忌
  pengZu: string[];          // 彭祖百忌（干+支）
  xiu: string;               // 二十八宿（如 觜）
  xiuLuck: string;           // 宿吉凶
  xiuSong: string;           // 宿歌诀
  zheng: string;             // 七政（如 火）
  yearNaYin: string;         // 年纳音
  monthNaYin: string;        // 月纳音
  dayNaYin: string;          // 日纳音
  jieQi: string;             // 当日节气（无则空）
  wuHou: string;             // 物候
  hou: string;               // 72候
  festival: string[];        // 农历节日
  otherFestival: string[];   // 其它节日/纪念日
  xingZuo: string;           // 公历星座（如 处女座）
  solarTermNote: string;     // 节气/节日白话备注（拼接用）
}

/** 星座 → 完整画像（元素/守护星/性格/爱情/配对/幸运/健康/事业，供星象推荐展示） */
export interface XingZuoProfile {
  name: string;              // 星座名（如 白羊座）
  range: string;             // 日期范围（如 3.21–4.19）
  element: string;           // 四元素（火土风/水）
  ruler: string;             // 守护星
  mode: string;              // 基本/固定/变动（星座三分法）
  traits: string[];          // 性格关键词
  strengths: string[];       // 优点
  weaknesses: string[];      // 缺点
  love: string;              // 爱情观一句白话
  matchBest: string[];       // 最佳配对星座
  matchWatch: string[];      // 需磨合星座
  luckyColors: string[];     // 幸运色
  luckyNumbers: string[];    // 幸运数字
  luckyItem: string;         // 幸运物
  healthNote: string;        // 健康注意
  careerNote: string;        // 事业特质
  plain: string;             // 一句白话特质
}

const XINGZUO_PROFILES: Record<string, XingZuoProfile> = {
  白羊座: { name: '白羊座', range: '3.21–4.19', element: '火', ruler: '火星', mode: '基本', traits: ['热情', '直接', '冲劲', '勇敢'], strengths: ['行动力强', '敢为人先', '真诚坦率'], weaknesses: ['急躁', '三分钟热度', '心直口快'], love: '喜欢热烈直接，讨厌暧昧拉扯，爱上就大方表达', matchBest: ['狮子座', '射手座'], matchWatch: ['巨蟹座', '摩羯座'], luckyColors: ['红', '橙'], luckyNumbers: ['1', '9'], luckyItem: '红色饰品', healthNote: '易头痛上火，注意用眼与睡眠', careerNote: '适合开拓性岗位，冲锋陷阵是把好手', plain: '行动派，想到就冲，直来直往' },
  金牛座: { name: '金牛座', range: '4.20–5.20', element: '土', ruler: '金星', mode: '固定', traits: ['务实', '稳定', '恋物', '耐心'], strengths: ['踏实可靠', '积累能力强', '审美在线'], weaknesses: ['固执', '慢热', '爱钻牛角尖'], love: '慢热专情，重实际相伴，细水长流胜过轰轰烈烈', matchBest: ['处女座', '摩羯座'], matchWatch: ['狮子座', '水瓶座'], luckyColors: ['绿', '粉'], luckyNumbers: ['6', '0'], luckyItem: '植物盆栽', healthNote: '注意咽喉与颈椎，久坐宜常起身', careerNote: '适合财务、手艺、餐饮等重积累行业', plain: '务实恋物，稳稳当当重视积累' },
  双子座: { name: '双子座', range: '5.21–6.21', element: '风', ruler: '水星', mode: '变动', traits: ['机灵', '好奇', '善变', '话多'], strengths: ['反应快', '信息灵通', '多才多艺'], weaknesses: ['三心二意', '情绪起伏', '话说过头'], love: '需要新鲜感与聊得来的对象，怕被管束', matchBest: ['天秤座', '水瓶座'], matchWatch: ['天蝎座', '双鱼座'], luckyColors: ['黄', '浅蓝'], luckyNumbers: ['5', '3'], luckyItem: '书籍文具', healthNote: '神经易紧张，宜规律作息少熬夜', careerNote: '适合传媒、公关、教学等沟通型岗位', plain: '信息灵通，爱交流点子多' },
  巨蟹座: { name: '巨蟹座', range: '6.22–7.22', element: '水', ruler: '月亮', mode: '基本', traits: ['顾家', '细腻', '念旧', '母性'], strengths: ['体贴入微', '洞察情绪', '守护力强'], weaknesses: ['多愁善感', '过度防御', '爱翻旧账'], love: '先建立安全感才敢全情投入，恋家且护短', matchBest: ['天蝎座', '双鱼座'], matchWatch: ['白羊座', '天秤座'], luckyColors: ['银白', '珍珠色'], luckyNumbers: ['2', '7'], luckyItem: '贝壳挂饰', healthNote: '肠胃敏感，忌生冷焦虑', careerNote: '适合护理、餐饮、房产等给人安心的行业', plain: '顾家重情，安全感第一位' },
  狮子座: { name: '狮子座', range: '7.23–8.22', element: '火', ruler: '太阳', mode: '固定', traits: ['自信', '慷慨', '好面子', '热情'], strengths: ['领导力强', '大方仗义', '天生主角'], weaknesses: ['爱面子', '听不进劝', '易霸道'], love: '要面子也要排面，喜欢被崇拜被需要', matchBest: ['白羊座', '射手座'], matchWatch: ['金牛座', '天蝎座'], luckyColors: ['金', '橘红'], luckyNumbers: ['1', '4'], luckyItem: '金色配饰', healthNote: '心脏与眼睛易劳损，忌过度透支精力', careerNote: '适合管理、演艺、创业等舞台型角色', plain: '自信张扬，舞台中心担当' },
  处女座: { name: '处女座', range: '8.23–9.22', element: '土', ruler: '水星', mode: '变动', traits: ['细致', '挑剔', '自律', '条理'], strengths: ['精益求精', '分析力强', '可靠守诺'], weaknesses: ['过度完美', '爱碎碎念', '自我批评'], love: '爱是用细节堆出来的，边说边帮你把生活理顺', matchBest: ['金牛座', '摩羯座'], matchWatch: ['射手座', '双子座'], luckyColors: ['灰', '米白'], luckyNumbers: ['5', '7'], luckyItem: '文件笔具', healthNote: '肠胃与皮肤敏感，注意清洁与规律', careerNote: '适合医理、质检、数据、编辑等精细活', plain: '精细严苛，追求完美讲规矩' },
  天秤座: { name: '天秤座', range: '9.23–10.23', element: '风', ruler: '金星', mode: '基本', traits: ['优雅', '重平衡', '人缘好', '犹豫'], strengths: ['协调力强', '审美品味佳', '温和讲理'], weaknesses: ['选择困难', '怕冲突', '易迎合'], love: '以和为贵，怕撕破脸，暧昧期常拉得特别长', matchBest: ['双子座', '水瓶座'], matchWatch: ['白羊座', '摩羯座'], luckyColors: ['粉', '淡蓝'], luckyNumbers: ['6', '2'], luckyItem: '香水丝巾', healthNote: '肾与腰留意，久坐伤身宜走动', careerNote: '适合法务、外交、设计、公关等平衡型工种', plain: '讲究平衡，人缘好懂协调' },
  天蝎座: { name: '天蝎座', range: '10.24–11.22', element: '水', ruler: '冥王星', mode: '固定', traits: ['深沉', '敏锐', '执着', '神秘'], strengths: ['洞察力强', '意志坚定', '深情专一'], weaknesses: ['多疑', '记仇', '掌控欲强'], love: '爱得浓烈彻底，眼里揉不得沙子', matchBest: ['巨蟹座', '双鱼座'], matchWatch: ['狮子座', '水瓶座'], luckyColors: ['黑', '深红'], luckyNumbers: ['8', '9'], luckyItem: '玉髓玛瑙', healthNote: '泌尿生殖系统留心，忌积压情绪', careerNote: '适合侦查、病理、金融等深挖型领域', plain: '洞察深刻，爱憎分明有定力' },
  射手座: { name: '射手座', range: '11.23–12.21', element: '火', ruler: '木星', mode: '变动', traits: ['乐观', '自由', '坦率', '爱玩'], strengths: ['心胸开阔', '运气常伴', '幽默豁达'], weaknesses: ['没耐心', '嘴上不把门', '怕束缚'], love: '先朋友后恋人，受不了被绑死的关系', matchBest: ['白羊座', '狮子座'], matchWatch: ['处女座', '双鱼座'], luckyColors: ['紫', '宝蓝'], luckyNumbers: ['3', '9'], luckyItem: '旅行纪念品', healthNote: '腿髋易伤，运动前注意热身', careerNote: '适合外贸、旅游、教育等向外拓展的行当', plain: '向往远方，乐观爱自由' },
  摩羯座: { name: '摩羯座', range: '12.22–1.19', element: '土', ruler: '土星', mode: '基本', traits: ['隐忍', '务实', '责任感', '野心'], strengths: ['自律坚韧', '目标明确', '值得托付'], weaknesses: ['过于严肃', '不懂变通', '压抑情绪'], love: '慢热但长情，爱你就是把未来计划进生活', matchBest: ['金牛座', '处女座'], matchWatch: ['巨蟹座', '天秤座'], luckyColors: ['棕', '深灰'], luckyNumbers: ['8', '4'], luckyItem: '手表时钟', healthNote: '骨关节与消化系统留意，别硬扛疲劳', careerNote: '适合管理、工程、政商等重担型位置', plain: '目标感强，能扛事讲耐力' },
  水瓶座: { name: '水瓶座', range: '1.20–2.18', element: '风', ruler: '天王星', mode: '固定', traits: ['独立', '前卫', '理性', '反叛'], strengths: ['点子新', '思想自由', '公正大方'], weaknesses: ['疏离', '忽冷忽热', '固执己见'], love: '精神契合高于一切，给彼此空间才好相爱', matchBest: ['双子座', '天秤座'], matchWatch: ['金牛座', '天蝎座'], luckyColors: ['青', '电子蓝'], luckyNumbers: ['4', '7'], luckyItem: '电子设备', healthNote: '神经与小腿留心，咖啡因别过量', careerNote: '适合科技、创意、公益等前沿领域', plain: '独立前卫，想法不落俗套' },
  双鱼座: { name: '双鱼座', range: '2.19–3.20', element: '水', ruler: '海王星', mode: '变动', traits: ['温柔', '共情', '浪漫', '想象力'], strengths: ['善解人意', '艺术天赋', '包容慈悲'], weaknesses: ['易逃避', '优柔寡断', '边界模糊'], love: '浪漫至死不渝，为爱付出常多于对方', matchBest: ['巨蟹座', '天蝎座'], matchWatch: ['双子座', '射手座'], luckyColors: ['海蓝', '薰衣草紫'], luckyNumbers: ['2', '6'], luckyItem: '水晶摆件', healthNote: '睡眠与脚部留意，情绪宜及时疏导', careerNote: '适合艺术、心理、影视等感性的创造', plain: '共情温柔，想象力丰富' },
};

export function xingZuoProfile(name: string): XingZuoProfile | undefined {
  return XINGZUO_PROFILES[name] ?? XINGZUO_PROFILES[name + '座'];
}

/** 生成某日完整黄历（默认今天） */
export function huangliOf(y: number, m: number, d: number): HuangliDay {
  const solar = Solar.fromYmd(y, m, d);
  const l = solar.getLunar();
  const wd = new Date(y, m - 1, d).getDay();
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const festival = l.getFestivals() ?? [];
  const other = l.getOtherFestivals() ?? [];
  const jieQi = l.getJieQi() || '';

  const notes: string[] = [];
  if (jieQi) notes.push(`节气「${jieQi}」`);
  if (festival.length) notes.push(`节日：${festival.join('、')}`);
  if (other.length) notes.push(`纪念日：${other.slice(0, 2).join('、')}`);

  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    lunar: l.toString(),
    lunarMonth: `${l.getMonthInChinese()}月${l.getDayInChinese()}`,
    lunarYear: l.getYearInGanZhiByLiChun() ?? '',
    shengXiao: l.getYearShengXiao() ?? '',
    week: `星期${WEEK[wd]}`,
    ganzhi: l.getDayInGanZhi() ?? '',
    monthPillar: l.getMonthInGanZhi() ?? '',
    lunarGZ: l.getDayInGanZhi() ?? '',
    jianChu: l.getZhiXing() ?? '',          // 建除十二神（值日·破/建/除…）
    zhiXing: l.getDayTianShen() ?? '',      // 值日天神（青龙/天刑…）
    yi: l.getDayYi() ?? [],
    ji: l.getDayJi() ?? [],
    chong: l.getDayChongDesc() ?? '',
    sha: l.getDaySha() ?? '',
    jiShen: l.getDayJiShen() ?? [],
    xiongSha: l.getDayXiongSha() ?? [],
    pengZu: [l.getPengZuGan() ?? '', l.getPengZuZhi() ?? ''].filter(Boolean),
    xiu: l.getXiu() ?? '',
    xiuLuck: l.getXiuLuck() ?? '',
    xiuSong: l.getXiuSong() ?? '',
    zheng: l.getZheng() ?? '',
    yearNaYin: l.getYearNaYin() ?? '',
    monthNaYin: l.getMonthNaYin() ?? '',
    dayNaYin: l.getDayNaYin() ?? '',
    jieQi,
    wuHou: l.getWuHou() ?? '',
    hou: l.getHou() ?? '',
    festival,
    otherFestival: other,
    xingZuo: solar.getXingZuo() ?? '',
    solarTermNote: notes.join('；'),
  };
}

/** 生成某月整月黄历数组（供月历网格） */
export function huangliMonth(y: number, m: number): HuangliDay[] {
  const daysIn = new Date(y, m, 0).getDate();
  const out: HuangliDay[] = [];
  for (let d = 1; d <= daysIn; d++) out.push(huangliOf(y, m, d));
  return out;
}

/** 一句话黄历白话摘要（供列表/卡片快速展示） */
export function huangliSummary(hl: HuangliDay): string {
  const yiTop = hl.yi.slice(0, 3).join('、') || '无特别宜事';
  const jiTop = hl.ji.slice(0, 3).join('、') || '无特别禁忌';
  const parts = [`农历${hl.lunarMonth}（${hl.lunarYear}）`, `日柱${hl.ganzhi}`, `冲${hl.chong || '无'}${hl.sha ? '煞' + hl.sha : ''}`];
  if (hl.jieQi) parts.push(`节气${hl.jieQi}`);
  return `${parts.join(' · ')} 宜${yiTop}，忌${jiTop}。`;
}