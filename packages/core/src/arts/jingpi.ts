/** 精批白话层（universal）：
 *  ① jingPiFor：8 术+日家 每术一版"整盘精批白话"（总纲+分段+开运指南），纯函数、可测试；
 *  ② flowYearMonths：八字流年按节气分月，返回 12 个月的逐日流日（日柱），供流月→流日→流时逐层查看。
 * 白话层定位：文化参考语气，不做确定论断（R11/D28 约束）。
 */
import { Solar } from 'lunar-javascript';
import type { BaziChart } from './bazi/engine';
import type { LiuyaoChart } from './liuyao/engine';
import type { MeihuaChart } from './meihua/engine';
import type { ZiweiChart } from './ziwei/engine';
import type { QimenChart } from './qimen/engine';
import type { QimenDayChart } from './qimen/day';
import type { LiurenChart } from './liuren/engine';
import type { XiaoliurenChart } from './xiaoliuren/engine';
import type { JinkouChart } from './jinkou/engine';
import { TIAN_GAN, DI_ZHI, shiShen, hourPillar } from '../calendar/ganzhi';
import { baziLifeTrend } from './bazi/trend';
import { baziStreamPillars } from './bazi/engine';
import { computeBoneWeight } from './boneweight';

export interface JingPiSeg { title: string; body: string; }
export interface JingPiResult { headline: string; segs: JingPiSeg[]; tips: string[]; }

type AnyChart =
  | BaziChart | LiuyaoChart | MeihuaChart | ZiweiChart | QimenChart | QimenDayChart
  | LiurenChart | XiaoliurenChart | JinkouChart;

const wxOf = (gan: string): string =>
  ({ 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' } as Record<string, string>)[gan] ?? '';
const zhiWxOf = (z: string): string =>
  ({ 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' } as Record<string, string>)[z] ?? '';

// ---------------- 八字精批 ----------------
/** 十神族分组（用于六亲/财富推断） */
function ssFamily(ss: string): string {
  if (['比肩', '劫财'].includes(ss)) return '比劫';
  if (['食神', '伤官'].includes(ss)) return '食伤';
  if (['正财', '偏财'].includes(ss)) return '财';
  if (['正官', '七杀'].includes(ss)) return '官杀';
  if (['正印', '偏印'].includes(ss)) return '印';
  return 'OTHER';
}
/** 统计十神族在四柱（天干透出 + 藏干）的出现分布 */
function ssDist(chart: BaziChart): Record<string, { tougan: string[]; canggan: string[] }> {
  const d: Record<string, { tougan: string[]; canggan: string[] }> = {};
  for (const p of chart.pillars) {
    const f = ssFamily(p.shiShen);
    if (f === 'OTHER') continue;
    (d[f] ??= { tougan: [], canggan: [] });
    if (!d[f].tougan.includes(p.label)) d[f].tougan.push(p.label);
    for (const h of p.hidden ?? []) {
      const f2 = ssFamily(h.shiShen);
      if (f2 !== 'OTHER') (d[f2] ??= { tougan: [], canggan: [] }), d[f2].canggan.push(`${p.label[0]}(${h.shiShen})`);
    }
  }
  return d;
}
/** 六亲·父母关系白话推断（男命正财为妻/偏财为父；女命正官为夫/食伤为子女；宫位：年祖上/月父母/日自身配偶/时子女）
 *  批注与白话取自同一份十神分布（dist），保证前后口径一致、不互相矛盾。 */
function familyOf(chart: BaziChart, dist: Record<string, { tougan: string[]; canggan: string[] }>): string {
  // 传统取象：偏财=父星、正印=母星；男命正财=妻、女命正官=夫；食伤/官杀=子女
  const palaceOf = (p: string) =>
    p === '月柱' ? '正落父母宫，朝夕相处、缘近而深'
      : p === '年柱' ? '落祖上宫，得长辈/祖辈之荫'
        : p === '日柱' ? '落自身宫，贴身相伴、影响最直接'
          : '落时柱（子女宫/晚运），中晚年更亲近';
  const fuP = dist['财']?.tougan ?? [];
  const muP = dist['印']?.tougan ?? [];
  const qinP = dist['比劫']?.tougan ?? [];
  // —— 批注（此命实际分布） ——
  const fu = fuP.length ? `父星（偏财）透于${fuP.join('、')}` : ((dist['财']?.canggan ?? []).length ? '父星（偏财）不透，父缘藏于地支（重点看年支）' : '父星（偏财）不显');
  const mu = muP.length ? `母星（正印）透于${muP.join('、')}` : ((dist['印']?.canggan ?? []).length ? '母星（正印）不透，母缘藏于地支' : '母星（正印）不显');
  const qin = qinP.length ? `兄弟/同辈比劫透${qinP.join('、')}：手足或同侪缘旺` : '比劫不透，手足缘平';
  const fuSuf = fuP.length === 0 && (dist['财']?.canggan ?? []).length === 0 ? '（财星不见，父缘或较淡，或与父聚少离多）' : '';
  const muSuf = muP.length === 0 && (dist['印']?.canggan ?? []).length === 0 ? '（印星不见，母缘或较淡，或亲近靠后）' : '';
  // —— 白话（与批注同一份事实，口径一致） ——
  const fuPlain = fuP.length ? `偏财透干（${fuP.map(palaceOf).join('；')}）：父能干有能耐，与自己来往较多` : ((dist['财']?.canggan ?? []).length ? '偏财藏支：父能干但内敛，亲情靠日常相处，不张扬' : '财星不显：父缘或较淡，或聚少离多');
  const muPlain = muP.length ? `正印透干（${muP.map(palaceOf).join('；')}）：母慈且给力，是命中的"后台"` : ((dist['印']?.canggan ?? []).length ? '正印藏支：母爱内敛，多在衣食细节处照顾，感情含蓄' : '印星不显：母缘或较淡，或亲近靠后');
  const qinPlain = qinP.length ? `比劫透干（${qinP.map(palaceOf).join('；')}）：重朋友兄弟、合作机会多，但也易分利` : '比劫不透：手足缘平，往来不密，合作多靠大运引动';
  // 宫位：年=祖上父母、月=父母兄弟、日=自己/配偶、时=子女
  const yearKind = dist['印']?.tougan.includes('年柱') || dist['比劫']?.tougan.includes('年柱') ? '年柱见印/比劫，祖上之荫或祖辈同款特性明显' : '年柱为祖上宫，看祖辈底色';
  // 配偶/子女：男女命取象不同，并列说明
  const spouseZhi = chart.pillars[2]?.gz?.[1] ?? ''; // 日支配偶宫
  const spouseMore = spouseZhi
    ? `日支（配偶宫）为${spouseZhi}（五行${zhiWxOf(spouseZhi)}）——看另一半的"脾气与缘分模式"：支生日主=对方迁就你；日主生支=你付出多；支克日主=对方强势压你；比和各半=平等相处（丑辰未戌本气论土，藏干再细分）。`
    : '';
  const spouseTxt = (dist['财']?.tougan ?? []).includes('日柱')
    ? '财星坐日柱（男命妻星贴身），得妻力、婚内多帮衬、易得妻家助力。' + spouseMore
    : (dist['官杀']?.tougan ?? []).includes('日柱')
      ? '官星坐日柱（女命夫星贴身），夫缘得力、婚姻受荫、丈夫有担当。' + spouseMore
      : (dist['财']?.tougan ?? []).length
        ? `财星透于${dist['财']?.tougan.join('、')}（男命妻缘可见，正财正妻、偏财偏缘多情）` + spouseMore
        : (dist['官杀']?.tougan ?? []).length
          ? `官星透于${dist['官杀']?.tougan.join('、')}（女命夫缘可见，正官正夫、七杀偏缘强势）` + spouseMore
          : `财/官星不显，姻缘或迟，需行运引动（见"大运"中的财/官之年）。` + spouseMore;
  const ziTxt = (dist['食伤']?.tougan ?? []).length ? `子女星（食伤，男命亦看官杀）透于${dist['食伤']?.tougan.join('、')}：子息缘旺` : (dist['官杀']?.tougan ?? []).length ? '子女星（官杀）亦透干，子嗣有望' : '子女星不透，子息或迟，视行运引动';
  const spEnd = spouseTxt.replace(/[。；]+$/, '。'); // spouseTxt 各分支自带结尾句号，去重后与子女段直接衔接
  return `${fu}；${mu}。${fuSuf}${muSuf}${qin}。${yearKind}。${spEnd}${ziTxt}。白话：${fuPlain}；${muPlain}；${qinPlain}。宫位口诀：年为祖上、月为父母、日为自己/配偶、时为子女——某亲星落于对应宫位且旺，则该亲缘深。`;
}
/** 财富情况白话推断 */
function wealthOf(chart: BaziChart, dist: Record<string, { tougan: string[]; canggan: string[] }>, sx: string): string {
  const f = dist['财'];
  const touganN = (f?.tougan ?? []).length;
  const cangganN = (f?.canggan ?? []).length;
  const shiShang = dist['食伤'];
  const shiShangN = (shiShang?.tougan ?? []).length + (shiShang?.canggan ?? []).length;
  let w = '';
  if (touganN + cangganN === 0) w = '命局不见财星（正偏财），财不显——不宜单打独斗搏横财，宜靠技术/名分/合作（印/食伤路线）顺带生财，财从贵人来。';
  else {
    w = `命局财星${touganN}透${touganN ? `于${(f?.tougan ?? []).join('、')}` : ''}、${cangganN}处藏干——财可见，求财有路径。`;
    w += sx === '身旺' ? '日主身旺能任财=赚得到也守得住，财可主动求' : '日主身弱不宜硬扛财=财多易成压力（富屋贫人），宜先养身、借印星/贵人搭桥再求财';
    w += shiShangN ? `；食伤（生财之源）${shiShangN}处=财有源头、靠才艺技能或项目生财（食伤生财）。` : '；不见食伤生财=财源偏"固定"，靠职位薪水为主（正财路线），少投机。';
  }
  const caiKu = ['辰', '戌', '丑', '未'].filter(z => chart.pillars.some(p => p.gz[1] === z));
  if (caiKu.length) w += `地支见财库（${caiKu.join('、')}）：主存财蓄财，逢冲之年财库打开=大进大出见真金。`;
  return w;
}

function baziJingPi(chart: BaziChart): JingPiResult {
  const sx = chart.strength === '身旺' ? '身旺' : chart.strength === '身弱' ? '身弱' : '中和';
  const yongText = `${chart.yongShen.primary}（${chart.yongShen.method}法）`;
  const wxCount = chart.wuxingCount ?? ({ 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } as Record<string, number>);
  const wxEntries = Object.entries(wxCount).sort((a, b) => b[1] - a[1]);
  const most = wxEntries[0] ?? ['—', 0];
  const least = wxEntries[wxEntries.length - 1] ?? ['—', 0];
  const dayWx = wxOf(chart.dayGan);
  const genWx = chart.pillars.map(p => p.gz[0]);
  const rootWx = chart.pillars.map(p => p.gz[1]);
  const relShort = chart.relations.slice(0, 3).join('；') || '无明显刑冲合害';
  const trend = baziLifeTrend(chart);
  const best = trend.bestYears[0];
  const hard = trend.hardYears[0];
  const dist = ssDist(chart);
  const familyBody = familyOf(chart, dist);
  const wealthBody = wealthOf(chart, dist, sx);
  // 袁天罡称骨（基于出生时刻，独立于四柱旺衰派）——业界流传的快捷命理法
  const boneBody = (() => {
    try {
      const n = chart.normalized;
      if (!n || !n.year || n.hour == null || n.hour < 0) return '称骨需要年月日时四项；缺时辰时无法计算。';
      const r = computeBoneWeight(n.year, n.month, n.day, chart.hourMissing ? 12 : n.hour, n.minute ?? 0);
      return `出生骨重合计「${r.label}」＝${r.parts.map(p => `${p.name} ${p.value}`).join(' + ')}。《称骨歌》批：${r.poem.replace(/[。；]+$/, '')}。白话：${r.plain}（称骨为民间流传的快捷法，只按出生时刻看个大概，与四柱旺衰互补，不必过分纠结）。`;
    } catch { return '称骨计算失败（时间越界或农历转换异常）。'; }
  })();

  // 流年/流月/流日/流时 四柱对照（当前时刻，含刑冲害破合·十神·藏干·纳音白话解释）
  const streamBody = (() => {
    const n = new Date();
    const rows = baziStreamPillars(chart, { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(), hour: n.getHours(), minute: n.getMinutes() });
    if (!rows.length) return '（当前时刻流柱暂不可得，稍后再试）';
    return `${rows.map(r => `${r.label}${r.gz}（天干${r.shiShen}）｜藏干：${r.hidden.map(h => `${h.gan}·${h.shiShen}`).join('、') || '—'}｜纳音：${r.nayin}｜与命局：${r.events.length ? r.events.map(e => `${e.code}——${e.plain.replace(/[。；]+$/, '')}`).join('；') : '无明显刑冲害破'}`).join('。')}。${rows.some(r => r.events.length) ? '凡流柱与命局成冲/刑/害/破/合者，该柱时段所主人事易被牵动：冲主变、刑主细磨、害主隐亏、破主损、合主和合或牵绊，可借此顺时安排行事。' : '本时四柱与命局暂无显著刑冲害破，行事平稳。'}`;
  })();

  const segs: JingPiSeg[] = [
    { title: '一、日主与用神', body: `日主${chart.dayGan}（${dayWx}），命局${sx}（同党 ${chart.selfRatio}%）。以「${yongText}」为调衡轴：喜用=${chart.yongShen.favorable.join('、') || '—'}，忌=${chart.yongShen.unfavorable.join('、') || '—'}。行运走喜用五行则顺，走忌神五行多阻。` },
    { title: '二、格局气象', body: `格局断为「${chart.geju}」。天干出干：${genWx.join('、')}；地支根基：${rootWx.join('、')}。五行分布 ${wxCount.木 ?? 0}木/${wxCount.火 ?? 0}火/${wxCount.土 ?? 0}土/${wxCount.金 ?? 0}金/${wxCount.水 ?? 0}水——最旺【${most[0]}】（${Math.round(Number(most[1]) * 100) / 100}分），最弱【${least[0]}】（${Math.round(Number(least[1]) * 100) / 100}分）。旺者宜疏泄、弱者宜生扶，不平处即补益下手处。` },
    { title: '三、六亲与父母', body: familyBody },
    { title: '四、财富格局', body: wealthBody },
    { title: '五、袁天罡称骨', body: boneBody },
    { title: '六、刑冲合害', body: `命局主要动态：${relShort}。合主人事牵引、冲主动荡变化、刑主摩擦防情、害主暗亏。看事件先定"谁动了谁"，再看落于哪柱（年月为外部环境、日时为自身家宅）。` },
    ...(chart.shensha.length ? [{ title: '七、神煞提示', body: `命带：${chart.shensha.join('、')}。神煞是"性格与事件的标签"，吉神旺而不空才有感应（桃花旺=人缘、驿马=动中求财、华盖=玄学缘分）；遇凶煞逢冲则减半，不须见名即慌。` }] : []),
    { title: '八、大运节奏', body: `${trend.summary}${best ? ` 最佳流年：${best.year}${best.gz}（${best.plain}）。` : ''}${hard ? ` 需留意：${hard.year}${hard.gz}（${hard.plain}）。` : ''}大运十年一换，交脱前后一年变动最密集。` },
    { title: '九、流年岁运四柱', body: streamBody },
    { title: '十、开运指南', body: `身${sx === '身旺' ? '旺宜泄耗（多动手做事、多社交输出能量），忌再补比劫' : sx === '身弱' ? '弱宜生扶（多近贵人对知识、借力而行），忌再泄克' : '中和宜随四季调候'}；五行最弱${least[0]}可适度补益（颜色/方位/行业见下方"开运"栏），过旺${most[0]}宜疏泄不宜硬填。` },
  ];
  const tips = [
    `补${dayWx}之印比=多学多存；用${chart.yongShen.primary}=办事方向朝它走。`,
    `颜色：喜用金—白/银；木—绿/青；水—黑/蓝；火—红/紫；土—黄/棕（按喜用五行取）。`,
    `行事务求"顺势不顺忌"：喜用年推进、忌神年守常，忌神年忌背水一战。`,
    `求财先看财源：身旺任财逐步加杠杆，身弱先养印（贵人/证书）再经商。`,
  ];
  return { headline: `【名局精批】${chart.dayGan}日主·${sx}·${chart.geju}——用神${yongText}，一生以"旺衰调衡"为纲`, segs, tips };
}

// ---------------- 六爻精批 ----------------
function liuyaoJingPi(c: LiuyaoChart): JingPiResult {
  const ys = c.yongShenInfo;
  const dong = c.lines.map((l, i) => l.moving ? `${i + 1}爻（${(l.branch ?? '')}）` : '').filter(Boolean).join('、') || '无（静卦，以用神旺衰为主）';
  const guaTypeTxt = c.guaType || '杂卦';
  const guaTypeNote = c.guaType === '六冲卦' ? '六冲主快而散' : c.guaType === '六合卦' ? '六合主慢而成' : c.guaType === '游魂卦' ? '游魂心神不定、事多变' : c.guaType === '归魂卦' ? '归魂事将归、趋于安定' : '杂卦=无六冲六合游归的普通卦，以用神旺衰与动爻为主';
  const segs: JingPiSeg[] = [
    { title: '一、卦象总纲', body: `得「${c.guaName}」卦（${c.gongName.replace(/宫$/, '')}宫·五行${c.gongWuxing}），卦性「${guaTypeTxt}」：${guaTypeNote}，${c.method}起卦。` },
    { title: '二、用神定位', body: ys ? `用神取【${ys.name}】（第${ys.lineIdx + 1}爻${ys.note}）：所问之事代表此爻——用神旺相有生扶则事可成，月破旬空则事迟滞，动而化吉则结局转好。` : '本卦未自动给出用神条目，可结合所问事项在六亲中自取：问财取妻财、问官取官鬼、问名取父母。' },
    { title: '三、世应动静', body: `世爻=${c.worldIdx + 1}爻（自己），应爻=${c.responseIdx + 1}爻（对方/事）。${(c.lines[c.worldIdx] ?? {}).moving ? '世爻发动=自己主动求变' : '世爻安静=事宜守正'}，${(c.lines[c.responseIdx] ?? {}).moving ? '应爻发动=对方先动' : '应爻安静=对方不动'}；世应相生合则人愿与事合拍，相冲克则双方较劲。` },
    { title: '四、动变能量', body: `动爻：${dong}。动爻是"事在发动"的信号，看其变爻生克定去向：回头生=越做越有，回头克=越做越损，化退=后劲不足。` },
    { title: '五、应期脉络', body: `日辰${c.dayPillar}、月建${c.monthPillar}。应期口诀：用神值日=当日应，逢冲之日=冲开应，填空之日=填实应，出空之日=落空转实应。临马星动=速应。` },
  ];
  return { headline: `【断卦精批】${c.guaName}·${c.guaType}——${ys ? `用神「${ys.name}」为体察核心` : '静卦以用神旺衰为主'}`, segs, tips: ['动爻看其变，用神看其旺', '世应生合=人和，冲克=事阻', '应期：值/冲/合/空四个关键字'] };
}

// ---------------- 梅花精批 ----------------
function meihuaJingPi(c: MeihuaChart): JingPiResult {
  const segs: JingPiSeg[] = [
    { title: '一、体用关系', body: `${c.tiSide === '上' ? '上卦为体' : '下卦为体'}（${c.tiTrigram}·五行${c.tiWx}=己方），另一卦为用（${c.yongTrigram}·五行${c.yongWx}=所问之事）。体用关系「${c.relation}」：${c.auspiciousness === '吉' ? '吉——用生体或体克用，事来助我' : c.auspiciousness === '凶' ? '凶——用克体或体生用，事来耗我' : '中——比和或平缓，事属平常'}。` },
    { title: '二、过程与结局', body: `互卦「${c.huGuaName}」（五行${c.huWx}）=事情的中间过程；变卦「${c.bianGuaName}」（五行${c.bianWx}）=事情的结局倾向。过程生体=越办越顺，结局生体=收尾得利；反之则中间波折或结局走弱。` },
    { title: '三、类象提示', body: c.xiangs.length ? `所问之事可取的象：${c.xiangs.slice(0, 8).join('、')}。取象=把卦的物象翻到人事上（乾为领导/金玉、坤为母亲/土地……），一卦多象，取最贴合问事的用。` : '本卦暂未扩展类象词库。' },
    ...(c.waiYing ? [{ title: '四、外应加持', body: `起卦时见「${c.waiYing}」。外应在梅花中优先级最高：所见即所应，往往比卦象更直接地点出吉凶。` }] : []),
    { title: '五、应期速断', body: '应期三法：①动爻位（初爻动=当日，五爻动=半月）；②卦数（先天卦数之和，按日/月/年折算）；③体用生克快慢（用生体=快，用克体=慢）。综合看："动爻定范围、卦数定日期"。' },
  ];
  return { headline: `【梅花精批】${c.guaName}（${c.method}）——体用「${c.relation}」，${c.auspiciousness === '吉' ? '总体偏吉，可进' : c.auspiciousness === '凶' ? '总体偏凶，宜守' : '总体平顺，随势而为'}`, segs, tips: ['体为自己用为事，用生体为最吉', '互卦看过程、变卦看结局', '外应最大：所见即所应'] };
}

// ---------------- 紫微精批 ----------------
function ziweiJingPi(c: ZiweiChart): JingPiResult {
  const ming = c.palaces.find(p => p.name === '命宫');
  const mingMajors = (ming?.stars ?? []).filter(s => s.kind === 'major').map(s => s.name);
  const majorTxt = mingMajors.length ? mingMajors.join('、') : '辅星组合';
  const segs: JingPiSeg[] = [
    { title: '一、命宫主星', body: `命宫主星「${majorTxt}」：主星定性格底色，配五行局${c.fiveElementsClass}与${c.soul}、${c.body}看一生格局——庙旺=力量足，落陷=力量弱；主星+辅星组合才是完整判断。` },
    { title: '二、三方四正', body: `本命三方四正（命宫+财帛+官禄+迁移）是看"整体成就"的底盘：四宫主星组合吉=一生底子厚；其中财帛宫管财、官禄宫管事业、迁移宫管机遇。` },
    { title: '三、生年四化', body: `生年四化：禄在${c.sihua.lu}、权在${c.sihua.quan}、科在${c.sihua.ke}、忌在${c.sihua.ji}（${c.sihua.version}）。四化是"最被激活的四件事"：禄落宫=先天好运处，忌落宫=先天功课处。四化同一宫=力量加倍明显。` },
    { title: '四、大限流年', body: (() => {
      const d = c.horoscope?.decadal;
      if (!d) return '大限信息未取。大限十年一换，走入吉宫=这十年资源多别浪费，走入忌宫=这十年守成、锻炼心性。';
      const range = c.decadal?.[d.index]?.range;
      const dNameRaw = c.decadal?.[d.index]?.name ?? d.name ?? '';
      const dName = dNameRaw.replace(/宫$/, '');
      const mut = (d.mutagen ?? []).filter(Boolean).join('、');
      const yearly = c.horoscope?.yearly;
      return `当前大限行至「${dName}宫」（${range ?? ''}），四化引动${mut || '无'}${yearly ? `；流年四化：${(yearly.mutagen ?? []).filter(Boolean).join('、') || '无'}` : ''}。大限十年一换，走入吉宫=这十年资源多别浪费，走入忌宫=这十年守成、锻炼心性；流年四化再叠加，看今年应期。`;
    })() },
    { title: '五、宫位直读', body: `宫位强弱速览：${c.palaces.slice(0, 8).map(p => `${p.name}${p.stars.filter(s => s.kind === 'major').map(s => s.name).join('') || ''}`).join('｜')}。宫名=人生那个领域，主星=那个领域的"氛围颜色"，四化=那个领域的"引动事件"。` },
  ];
  return { headline: `【紫微精批】命宫主星「${majorTxt}」——四化落宫定人生四件大功课`, segs, tips: ['四化其中，忌落宫=此生要修的功课', '大限走吉宫=趁势而为', '三方四正齐看，单宫不下定论'] };
}

// ---------------- 奇门精批 ----------------
function qmJimenGz(c: QimenChart): string[] {
  return c.cells.filter(x => !!(x as { gate?: string }).gate && ['休门', '生门', '开门'].includes((x as { gate?: string }).gate ?? '')).map(x => (x.name ?? '') + '·' + (x as { gate?: string }).gate);
}
function qmJimenGong(c: QimenChart): string[] {
  return c.cells.filter(x => !!(x as { gate?: string }).gate && ['休门', '生门', '开门'].includes((x as { gate?: string }).gate ?? '')).map(x => '第' + x.gong + '宫');
}

function qimenJingPi(c: QimenChart): JingPiResult {
  const juName = c.juMethod === 'chaibu' ? '拆补' : c.juMethod === 'zhirun' ? '置闰' : '茅山';
  const panName = c.panType === 'fei' ? '飞盘' : '转盘';
  const yinYangTxt = c.yinYang;
  const jimen = qmJimenGz(c);
  const jimenGong = qmJimenGong(c);
  const hasSiHai = c.cells.some(x => (x.marks ?? []).includes('空亡') || (x.marks ?? []).includes('击刑') || (x.marks ?? []).includes('入墓') || (x.marks ?? []).includes('门迫'));
  const segs: JingPiSeg[] = [
    { title: '一、盘面总纲', body: `${yinYangTxt}${c.ju}局（${juName}法·${panName}），值符${c.zhifuStar}、值使${c.zhifuGate}、旬首${c.xunShou}。值符=当下总指挥，值使=办事窗口：值符所落宫看事之源头，值使所落宫看落地时间。` },
    { title: '二、用神宫读', body: `求事看用神宫：问财看生门+戊、问官看开门+庚、问婚看乙庚+六合、问病看天芮+死门。当前与所问最相关之吉门：${jimen.join('、') || '本时无三吉门临宫'}。` },
    { title: '三、格局吉凶', body: `本局格局：${c.patterns.join('；') || '无明显特显格局，以门星旺衰为主'}` + (hasSiHai ? '。注意四害：空亡=落空待填、击刑=自伤、入墓=受限、门迫=门陷入被动' : '') + '。' },
    { title: '四、择吉方位', body: `吉门所在宫（${jimenGong.join('、') || '—'}附近）即可办事的方向：出行、求职、谈事朝吉门方借气；避开值使门被克或空亡之宫。` },
    { title: '五、应期脉络', body: `应期三指针：①旬空之字填实/出空之日；②马星（寅申巳亥逢冲）主速动；③值符宫地支=事的应期窗口。本局 ` + (c.patterns.includes('伏吟') ? '伏吟局宜静不宜动，应期延后' : c.patterns.includes('返吟') ? '返吟局反复多变，应期快而反复' : '常态应期') + '。' },
  ];
  const ttName = ({ shi: '时家', ri: '日家', yue: '月家', nian: '年家' } as Record<string, string>)[c.timeType ?? ''] ?? '时家';
  return { headline: `【奇门精批】${yinYangTxt}${c.ju}局·值符${c.zhifuStar}值使${c.zhifuGate}——${ttName}盘断事`, segs, tips: ['先看值符值使，再抠用神宫', '三吉门在宫=可借之势', '空亡看填实、马星看速动'] };
}

// ---------------- 日家奇门精批 ----------------
function qiMenDayGongToFang(gong: number): string {
  return ({ 1: '北', 2: '西南', 3: '东', 4: '东南', 5: '中', 6: '西北', 7: '西', 8: '东北', 9: '南' } as Record<number, string>)[gong] ?? `第${gong}宫`;
}
function qimenDayJingPi(c: QimenDayChart): JingPiResult {
  const ji = c.cells.filter(x => !!(x as { gate?: string }).gate && ['休门', '生门', '开门'].includes((x as { gate?: string }).gate ?? ''));
  const jiTxt = ji.map(x => qiMenDayGongToFang(x.gong) + '·' + (x as { gate?: string }).gate).join('、');
  const segs: JingPiSeg[] = [
    { title: '一、今日大局', body: `${c.dayPillar}日（${c.jieqi}后），日家盘按"休门三日一宫+太乙九星一日一宫"排布。日家奇门=择吉体系：以日为单位，三吉门+吉星=今日可借之方位。` },
    { title: '二、三吉门方位', body: ji.length ? `今日吉门：${jiTxt}。办事行动（出行、搬家、谈判、开业）从此方位出发或坐向朝它，借吉门之气。` : '今日无休生开三吉门临宫，择吉宜选黄道时辰改用事。' },
    { title: '三、黄黑道时辰', body: `当前时辰「${c.currentDao.shen}」（${c.currentDao.kind}）：${c.currentDao.kind === '黄道' ? '黄道吉时——宜主动办正事' : '黑道凶时——宜守，重大启动改选黄道'}。十二时辰按青龙明堂金匮天德玉堂司命=黄道、天刑朱雀白虎天牢玄武勾陈=黑道循环。` },
    { title: '四、喜神贵人', body: `今日喜神${c.xiShen}方（喜庆和合方），财神/福神/贵人方详见日历黄历。喜庆事（相亲、喜事、剪彩）朝喜神方更添彩头。` },
  ];
  return { headline: `【日家奇门精批】${c.dayPillar}日——今日吉门在${jiTxt || '无'}，${c.currentDao.kind}时辰`, segs, tips: ['日家看日、时家看时，小事看日家足够', '黄道吉时+吉门同临=最顺', '黑道日忌动土搬迁'] };
}

// ---------------- 大六壬精批 ----------------
function liurenJingPi(c: LiurenChart): JingPiResult {
  const segs: JingPiSeg[] = [
    { title: '一、课体总纲', body: `月将${c.yuejiang}加时${c.hourZhi}，成「${c.keTi}」课：${c.keTiNote}。课体=这局课的性格（贼克快战、比用择旺、涉害艰难、遥克远取、昴星进退、别责旁求、八专专一、伏吟不动、返吟反复）。` },
    { title: '二、四课表里', body: `四课=${c.fourLessons.map(k => `${k.label}·上神${k.upper}（下神${k.zhi}）`).join('、') || '—'}：干上=我这边表，支上=事/对方那边表。两课克处=事已露头，两课和合=事在酝酿。` },
    { title: '三、三传进程', body: `三传：${c.sanChuan.map(s => `${s.shen}(${s.tianjiang})`).join(' → ')}。初传=事发端、中传=发展、末传=结局。三传五行顺生=顺势而进，三传克战=波折重重。` },
    { title: '四、神将吉凶', body: `天将排出：${c.sanChuan.map(s => s.tianjiang).join('、')}。神将定氛围：六合合和、青龙财喜、贵人提携、白虎凶速、玄武暗昧、螣蛇虚惊——三传逢吉将与次第生克=事有救应。` },
  ];
  return { headline: `【大六壬精批】${c.keTi}课·三传${c.sanChuan.map(s => s.shen).join('→')}`, segs, tips: ['课体定性格、三传定进程', '句句对照《毕法赋》', '发用即事端，末传看结局'] };
}

// ---------------- 小六壬精批 ----------------
function xiaoliurenJingPi(c: XiaoliurenChart): JingPiResult {
  const segs: JingPiSeg[] = [
    { title: '一、落宫直读', body: `以${c.source === '月日时' ? `${c.step}三数递推` : '报数'}得「${c.final}」宫：${c.meaning.text}（${c.meaning.detail}）。${c.meaning.jiXiong === '吉' ? '主吉——可主动推进' : c.meaning.jiXiong === '凶' ? '主防——宜稳不宜急' : '中性——见机行事'}。` },
    { title: '二、三宫连读', body: `${['月起', '日落', '时落'].map((p, i) => `${p}「${c.positions[i]?.name ?? '—'}」`).join(' → ')}：三落宫串成小故事——起因（月）→过程（日）→结局（时）。只落"速喜"喜庆快，但过程走"赤口"则口舌多，要有心理准备。` },
    { title: '三、应期速断', body: `速喜=3 日内见音；小吉=1 周内见顺；大安=当日平稳；留连=7~15 天拖；赤口=当日口舌；空亡=无期难寻。最终落宫即应期节奏。` },
  ];
  return { headline: `【小六壬精批】落宫「${c.final}」——${c.meaning.jiXiong === '吉' ? '吉，事可成，速则应' : c.meaning.jiXiong === '凶' ? '凶，宜守宜防，缓则避' : '平，随势而为'}`, segs, tips: ['三宫连读最灵：首因中程末果', '速喜快、小吉顺、空亡空', '一时一占，问前先静心'] };
}

// ---------------- 金口诀精批 ----------------
function jinkouJingPi(c: JinkouChart): JingPiResult {
  // 解析五动 raw：形如"关系"串；直接把 engine 已算好的关系列出来并配白话
  const REL_PLAIN: Record<string, string> = {
    '生': '相生=有生发、有人来助/事有助力',
    '受生': '受生=被人托付/得到滋养，主吸纳资源',
    '克': '相克=有压制、争斗、阻碍，需防口舌',
    '受克': '受克=被克制、被管束，宜收敛守正',
    '比和': '比和=同类相聚，主平辈合作、各得其所',
  };
  const relOf = (s: string): string => {
    const m = s.match(/[：:](生|受生|克|受克|比和)$/);
    return m ? (REL_PLAIN[m[1]] ?? '') : '';
  };
  const moves = c.fiveDong.map(x => x + (relOf(x) ? `（${relOf(x)}）` : ''));
  const threePlain = c.threeDong.map(t => {
    // threeDong 为三位名称（贵神与将神关系…），转成白话提问/提示
    const map: Record<string, string> = {
      '贵神与将神关系': '贵神与将神：看"贵人是否碰得上这件事"——两者生合则贵人成事、比合则同谋、相克则贵人难靠',
      '将神与地分关系': '将神与地分：看"事体落地方位顺利与否"——生则事有根基、克则事有波折',
      '人元与地分关系': '人元与地分：看"我(天干)与所求出处(地支)的呼应"——生和则心愿得偿、刑克则虚耗',
    };
    return map[t] ?? t;
  });
  const segs: JingPiSeg[] = [
    { title: '一、四位架构', body: `四位：人元${c.renYuan}（上方·天干）→ 贵神${c.guiShen}（贵人）→ 将神${c.jiangShen}（月将·事体）→ 地分${c.diFen}（下方·方位/所问之人事）。自下而上=事之根→人→我→天，四位五行生成定吉凶。` },
    { title: '二、五动事类', body: `${moves.length ? moves.join('；') : '本课无五动（主事平稳不动）'}。五动是"谁在发动"：财动=钱财事、妻动=女人事、鬼动=灾病事、官动=官位升迁、贼动=遗失偷盗。` },
    { title: '三、三位定象', body: `${threePlain.join('；')}。多动叠加=事情不简单，多动多凶时以"贵神-地分"定最终吉凶。` },
    { title: '四、综合判断', body: `${c.interpretation}——金口诀"四位一线看生克"：生我者贵人、克我者官鬼、我生者子孙、我克者财。成局看贵神将神同宫，破局看地分受克。` },
  ];
  return { headline: `【金口诀精批】${c.guiShen}·${c.jiangShen}×${c.renYuan}——${c.fiveDong[0] ?? '平稳无动'}`, segs, tips: ['地分为根、贵神为体、将神为事', '五动是"谁在发动"，三动以上多凶', '贵神-地分定最终吉凶'] };
}

// ---------------- 统一入口 ----------------
export function jingPiFor(art: string, chart: AnyChart): JingPiResult {
  switch (art) {
    case 'bazi': return baziJingPi(chart as BaziChart);
    case 'liuyao': return liuyaoJingPi(chart as LiuyaoChart);
    case 'meihua': return meihuaJingPi(chart as MeihuaChart);
    case 'ziwei': return ziweiJingPi(chart as ZiweiChart);
    case 'qimen': return (chart as unknown as { timeType?: string }).timeType === 'ri'
      ? qimenDayJingPi(chart as QimenDayChart)
      : qimenJingPi(chart as QimenChart);
    case 'liuren': return liurenJingPi(chart as LiurenChart);
    case 'xiaoliuren': return xiaoliurenJingPi(chart as XiaoliurenChart);
    case 'jinkou': return jinkouJingPi(chart as JinkouChart);
    default: return { headline: '精批尚未覆盖此术', segs: [], tips: [] };
  }
}

// ==========================================================
// 八字 流月→流日→流时（节气分月，逐日流日）
// ==========================================================
export interface FlowDay { ymd: string; dayPillar: string; monthPillar: string; note?: string }
export interface FlowMonthGroup { index: number; gz: string; label: string; days: FlowDay[] }

const FLOW_MONTH_LABELS = ['正月(立春)', '二月(惊蛰)', '三月(清明)', '四月(立夏)', '五月(芒种)', '六月(小暑)', '七月(立秋)', '八月(白露)', '九月(寒露)', '十月(立冬)', '冬月(大雪)', '腊月(小寒)'];

/** 流月干支：年干五虎遁起正月（与 UI 一致，放 core 一并管理） */
export function liuYueGanZhi(yearGan: string): string[] {
  const WU_HU: Record<string, string> = { 甲: '丙寅', 己: '丙寅', 乙: '戊寅', 庚: '戊寅', 丙: '庚寅', 辛: '庚寅', 丁: '壬寅', 壬: '壬寅', 戊: '甲寅', 癸: '甲寅' };
  const start = WU_HU[yearGan] ?? '丙寅';
  const sg = TIAN_GAN.indexOf(start[0] as never);
  const sz = DI_ZHI.indexOf(start[1] as never);
  return Array.from({ length: 12 }, (_, i) => TIAN_GAN[(sg + i) % 10] + DI_ZHI[(sz + i) % 12]);
}

/** 按节气把公历年切为 12 个"八字流月"，逐日生成流日（日柱），供流月→流日→流时查看 */
export function flowYearMonths(year: number, monthGzs: string[]): FlowMonthGroup[] {
  const byMonth: Record<string, FlowDay[]> = {};
  const cursor = new Date(year, 0, 1);
  const stop = new Date(year + 1, 2, 1);
  while (cursor < stop) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const d = cursor.getDate();
    try {
      const lunar = Solar.fromYmd(y, m, d).getLunar();
      const mp = lunar.getMonthInGanZhi();
      if (!byMonth[mp]) byMonth[mp] = [];
      byMonth[mp].push({ ymd: `${m}月${d}日`, dayPillar: lunar.getDayInGanZhi(), monthPillar: mp });
    } catch { /* 边界日跳过 */ }
    cursor.setDate(cursor.getDate() + 1);
  }
  const groups: FlowMonthGroup[] = [];
  for (let i = 0; i < monthGzs.length; i++) {
    const gz = monthGzs[i];
    const days = byMonth[gz]?.slice() ?? [];
    // 该流年从立春起算，若首月未跨年则从下一个立春补；直接按全年收集即可
    groups.push({ index: i, gz, label: FLOW_MONTH_LABELS[i] ?? `第${i + 1}月`, days: days.slice(0, 34) });
  }
  return groups;
}

/** 某日 12 个时辰的时柱（五鼠遁），供"流时"查看 */
export function flowHoursOfDay(dayPillar: string): Array<{ zhi: string; gz: string }> {
  const zhish = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return zhish.map((z, i) => ({ zhi: z, gz: hourPillar(dayPillar[0] ?? '甲', i * 2) }));
}

export { shiShen };
