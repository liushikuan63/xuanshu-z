/** 六爻引擎（P2）：6 类起卦、装卦（纳甲/六亲/世应/六神/旬空月破）、变卦互卦错综、伏神飞神、用神规则 */
import {
  type ResolvedConfig, type RuleHit, type BoardSpec, type Warning, type CitationRef, type RawInput, type BoardLine,
  type NormalizedMoment, type TimingCandidate, type FactBundle,
} from '../../config/types';
import { cite } from '../../plugins/contract';
import { normalizeMoment } from '../../calendar/normalize';
import { DI_ZHI, TIAN_GAN, GAN_WUXING, ZHI_WUXING, liuchong, xunKong, ganzhiIndex } from '../../calendar/ganzhi';
import {
  GUA64, guaByBin, guaByName, shiPosition, najiaOf, liuShen, liuQin, GONG_WUXING, TRIGRAM_WUXING,
  TRIGRAMS, XIAN_TIAN_SHU, SHU_TO_TRIGRAM, LIU_CHONG_GUA, LIU_HE_GUA, JIN_SHEN,
} from './data';

export interface LyLine {
  index: number;                 // 0=初爻
  yao: 'yang' | 'yin';
  moving: boolean;
  old: boolean;                  // 老阳/老阴（动）
  najia: string;                 // 干支
  liuqin: string;
  liushen: string;
  shiYing: '世' | '应' | null;
  branch: string; gan: string;
  kong: boolean;                 // 旬空
  yuePo: boolean;                // 月破
  anDong: boolean;               // 暗动（静爻逢日冲）
  fuShen?: string;               // 伏神（干支+六亲）
  fuShenLiuqin?: string;
  changed?: { najia: string; liuqin: string; branch: string };
  jinTui?: '进神' | '退神';
}

export interface LiuyaoChart {
  art: 'liuyao';
  method: string;                // 摇卦/报数/时间/指定
  detail?: string;
  guaName: string; gongName: string; gongWuxing: string;
  bin: string;
  lines: LyLine[];
  worldIdx: number; responseIdx: number;
  changedName?: string;          // 变卦
  huGuaName: string;             // 互卦
  cuoGuaName: string; xzGuaName: string; // 错综
  guaType: string;               // 六冲卦/六合卦/…
  dayPillar: string; monthPillar: string; hourPillar: string;
  dayGan: string; monthZhi: string; dayZhi: string; xunkong: string;
  yongShenInfo?: { name: string; lineIdx: number; note: string } | null;
  normalized: NormalizedMoment;
  configHash: string;
  category: string;
  coins?: number[][];
}

// ---------- 起卦 ----------
function coinsToLines(coins: number[][]): { bin: string; moving: boolean[] } {
  // 每组 3 枚：值为背数（0..3）。3背=老阳动，1背=少阳，2背=少阴，0背=老阴动
  const bits: string[] = []; const moving: boolean[] = [];
  for (const g of coins) {
    const backs = g.filter(x => x === 3).length;
    if (backs === 3) { bits.push('1'); moving.push(true); }
    else if (backs === 1) { bits.push('1'); moving.push(false); }
    else if (backs === 2) { bits.push('0'); moving.push(false); }
    else { bits.push('0'); moving.push(true); }
  }
  return { bin: bits.join(''), moving };
}

export function castByTime(normalized: NormalizedMoment, method = 'time'): { bin: string; movingIdx: number; detail: string } {
  // 梅花时间起法（用于六爻时间卦）：年支数+月+日 → 上卦；加时支数 → 下卦；总和 mod 6 → 动爻
  const lunar = normalized.lunar;
  const yZhi = DI_ZHI.indexOf(normalized.yearPillar[1]) + 1;
  const hZhi = normalized.hourPillar ? DI_ZHI.indexOf(normalized.hourPillar[1]) + 1 : 1;
  const up = (yZhi + lunar.month + lunar.day) % 8;
  const down = (yZhi + lunar.month + lunar.day + hZhi) % 8;
  const total = yZhi + lunar.month + lunar.day + hZhi;
  const movingIdx = (total % 6 || 6) - 1;
  const upper = SHU_TO_TRIGRAM[up], lower = SHU_TO_TRIGRAM[down];
  const bin = TRIGRAMS[lower] + TRIGRAMS[upper];
  return { bin, movingIdx, detail: `年${yZhi}+月${lunar.month}+日${lunar.day}=${yZhi + lunar.month + lunar.day}→上卦${upper}(${up})；加时${hZhi}=${total}→下卦${lower}(${down})，动爻第${movingIdx + 1}爻` };
}

function buildLines(bin: string, movingSet: Set<number>, gua: NonNullable<ReturnType<typeof guaByBin>>, normalized: NormalizedMoment): LyLine[] {
  const najia = najiaOf(gua);
  const shen = liuShen(normalized.dayPillar[0]);
  const shi = shiPosition(gua);
  const ying = (shi + 3) % 6;
  const kongZhi = xunKong(normalized.dayPillar);
  const dayZhi = normalized.dayPillar[1];
  const monthZhi = normalized.monthPillar[1];
  const gongWx = GONG_WUXING[gua.gong];
  return Array.from({ length: 6 }, (_, i) => {
    const naj = najia[i];
    const branch = naj[1];
    const lineWx = ZHI_WUXING[DI_ZHI.indexOf(branch)];
    const moving = movingSet.has(i);
    return {
      index: i, yao: bin[i] === '1' ? 'yang' : 'yin', moving, old: moving,
      najia: naj, liuqin: liuQin(gongWx, lineWx), liushen: shen[5 - i],
      shiYing: i === shi ? '世' : i === ying ? '应' : null,
      branch, gan: naj[0],
      kong: kongZhi.includes(branch),
      yuePo: liuchong(branch, monthZhi),
      anDong: !moving && liuchong(branch, dayZhi),
    } as LyLine;
  });
}

function huGua(bin: string): string {
  const lower = bin.slice(1, 4), upper = bin.slice(2, 5);
  const name = guaByBin(lower + upper)?.name;
  return name ?? trigramBinName(lower + upper);
}
function trigramBinName(bin: string): string {
  return guaByBin(bin)?.name ?? '未知';
}

export function computeLiuyao(input: RawInput, cfg: ResolvedConfig, configHash: string): LiuyaoChart {
  const normalized = normalizeMoment(input, { calendar: cfg.calendar });
  let bin = ''; let movingSet = new Set<number>(); let method = input.method ?? 'time'; let detail = '';

  if (input.coins && input.coins.length === 6) {
    const r = coinsToLines(input.coins);
    bin = r.bin; movingSet = new Set(r.moving.map((m, i) => m ? i : -1).filter(i => i >= 0));
    method = '摇卦';
  } else if (input.hexagram) {
    const upper = typeof input.hexagram.upper === 'number' ? SHU_TO_TRIGRAM[input.hexagram.upper % 8] ?? '坤' : input.hexagram.upper;
    const lower = typeof input.hexagram.lower === 'number' ? SHU_TO_TRIGRAM[input.hexagram.lower % 8] ?? '坤' : input.hexagram.lower;
    bin = TRIGRAMS[lower] + TRIGRAMS[upper];
    movingSet = new Set(input.hexagram.moving != null ? [input.hexagram.moving - 1] : []);
    method = '手动指定';
  } else if (input.numbers && input.numbers.length >= 2) {
    // 报数：数1→上卦，数2→下卦，数3→动爻（默认动爻规则：和 mod 6 可配）
    const [n1, n2, n3] = input.numbers;
    const upper = SHU_TO_TRIGRAM[(((n1 - 1) % 8) + 8) % 8 + 1] ?? '坤';
    const lower = SHU_TO_TRIGRAM[(((n2 - 1) % 8) + 8) % 8 + 1] ?? '坤';
    bin = TRIGRAMS[lower] + TRIGRAMS[upper];
    const mv = input.numbers.length >= 3 ? (((n3 - 1) % 6) + 6) % 6 : (((n1 + n2 - 1) % 6) + 6) % 6;
    movingSet = new Set([mv]);
    method = '报数';
  } else {
    const r = castByTime(normalized, 'time');
    bin = r.bin; movingSet = new Set([r.movingIdx]); method = '时间卦'; detail = r.detail;
  }

  const gua = guaByBin(bin)!;
  const lines = buildLines(bin, movingSet, gua, normalized);

  // 变卦装卦（动爻化出）
  if (movingSet.size) {
    const newBits = bin.split('');
    for (const i of movingSet) newBits[i] = newBits[i] === '1' ? '0' : '1';
    const changedBin = newBits.join('');
    const changed = guaByBin(changedBin);
    if (changed) {
      const changedNajia = najiaOf(changed);
      
      for (const i of movingSet) {
        const br = changedNajia[i][1];
        lines[i].changed = {
          najia: changedNajia[i], liuqin: liuQin(GONG_WUXING[gua.gong], ZHI_WUXING[DI_ZHI.indexOf(br)]), branch: br,
        };
        // 进退神
        for (const [a, b] of JIN_SHEN) {
          if (lines[i].branch === a && br === b) lines[i].jinTui = '进神';
          if (lines[i].branch === b && br === a) lines[i].jinTui = '退神';
        }
      }
    }
  }

  // 伏神：六亲不全时，从本宫首卦取
  const haveLq = new Set(lines.map(l => l.liuqin));
  const allLq = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
  if (!allLq.every(q => haveLq.has(q))) {
    const zhenGua = GUA64.find(g => g.gong === gua.gong && g.stage === 0)!;
    const zhenNajia = najiaOf(zhenGua);
    const zhenLines = buildLines(zhenGua.bin, new Set(), zhenGua, normalized);
    for (let i = 0; i < 6; i++) {
      const q = zhenLines[i].liuqin;
      if (!haveLq.has(q)) {
        lines[i].fuShen = zhenNajia[i];
        lines[i].fuShenLiuqin = q;
      }
    }
  }

  const guaType = LIU_CHONG_GUA.includes(gua.name) ? '六冲卦' : LIU_HE_GUA.includes(gua.name) ? '六合卦' : gua.stage === 6 ? '游魂卦' : gua.stage === 7 ? '归魂卦' : '';
  const dayZhi = normalized.dayPillar[1];
  const monthZhi = normalized.monthPillar[1];

  return {
    art: 'liuyao', method, detail,
    guaName: gua.name, gongName: gua.gongName + '宫', gongWuxing: GONG_WUXING[gua.gong], bin,
    lines, worldIdx: shiPosition(gua), responseIdx: (shiPosition(gua) + 3) % 6,
    changedName: movingSet.size ? guaByBin(bin.split('').map((b, i) => movingSet.has(i) ? (b === '1' ? '0' : '1') : b).join(''))?.name : undefined,
    huGuaName: huGua(bin),
    cuoGuaName: trigramBinName(bin.split('').map(b => b === '1' ? '0' : '1').join('')),
    xzGuaName: trigramBinName(bin.split('').reverse().join('')),
    guaType, dayPillar: normalized.dayPillar, monthPillar: normalized.monthPillar, hourPillar: normalized.hourPillar,
    dayGan: normalized.dayPillar[0], monthZhi, dayZhi, xunkong: normalized.xunkong,
    normalized, configHash, category: cfg.category, coins: input.coins,
  };
}

// ---------- 用神取法 ----------
export function pickYongShen(chart: LiuyaoChart): { name: string; lineIdx: number | null; note: string } {
  const cat = chart.category;
  const findLq = (lq: string, preferShi = false): { name: string; lineIdx: number | null; note: string } => {
    // 先找动爻临用神，再找持世，再找旺相安静
    const candidates = chart.lines.filter(l => l.liuqin === lq || l.fuShenLiuqin === lq);
    if (!candidates.length) return { name: lq, lineIdx: null, note: `卦中无${lq}（含伏神）——用神不现，事多难成或另有蹊跷` };
    const moving = candidates.find(l => l.moving && l.liuqin === lq);
    const shi = candidates.find(l => l.shiYing === '世');
    const normal = candidates.find(l => !l.kong && !l.yuePo) ?? candidates[0];
    const pick = moving ?? shi ?? normal;
    return {
      name: lq, lineIdx: pick.index,
      note: `${pick.fuShenLiuqin === lq && !pick.liuqin.includes(lq) ? `伏神${pick.fuShen}（伏于${pick.liuqin}之下）` : `${pick.liuqin}${pick.najia}`}${pick.moving ? '发动' : '安静'}${pick.shiYing ? '（持世）' : ''}${pick.kong ? '，旬空' : ''}${pick.yuePo ? '，月破' : ''}`,
    };
  };
  if (cat === '失物') return findLq('妻财'); // 具体物类由 playbook 决定，默认妻财
  if (cat === '感情') return findLq('妻财');
  if (cat === '事业' || cat === '官非') return findLq('官鬼');
  if (cat === '求财' || cat === '合作') return findLq('妻财');
  if (cat === '学业') return findLq('父母');
  if (cat === '健康') return findLq('官鬼');
  if (cat === '出行') return { name: '世爻', lineIdx: chart.worldIdx, note: `世爻${chart.lines[chart.worldIdx].liuqin}${chart.lines[chart.worldIdx].najia}为求测人` };
  return { name: '世爻', lineIdx: chart.worldIdx, note: `世爻${chart.lines[chart.worldIdx].najia}为求测人，应爻为对方/所测之事` };
}

// ---------- 旺衰判定 ----------
function wangXiang(chart: LiuyaoChart, line: LyLine): { wang: boolean; text: string } {
  const wx = ZHI_WUXING[DI_ZHI.indexOf(line.branch)];
  const monthWx = ZHI_WUXING[DI_ZHI.indexOf(chart.monthZhi)];
  const dayWx = ZHI_WUXING[DI_ZHI.indexOf(chart.dayZhi)];
  const order = ['木', '火', '土', '金', '水'];
  const me = order.indexOf(wx);
  const sheng = (x: string, y: string) => (order.indexOf(x) + 1) % 5 === order.indexOf(y);
  const ke = (x: string, y: string) => (order.indexOf(x) + 2) % 5 === order.indexOf(y);
  const parts: string[] = [];
  let score = 0;
  if (wx === monthWx) { score += 2; parts.push('临月建'); }
  else if (sheng(monthWx, wx)) { score += 2; parts.push('月建生'); }
  else if (sheng(wx, monthWx)) { score -= 1; parts.push('泄于月'); }
  else if (ke(monthWx, wx)) { score -= 2; parts.push('月建克'); }
  else if (ke(wx, monthWx)) { score += 1; parts.push('克月'); }
  if (wx === dayWx) { score += 2; parts.push('临日辰'); }
  else if (sheng(dayWx, wx)) { score += 2; parts.push('日辰生'); }
  else if (sheng(wx, dayWx)) { score -= 1; parts.push('泄于日'); }
  else if (ke(dayWx, wx)) { score -= 2; parts.push('日辰克'); }
  else if (ke(wx, dayWx)) { score += 1; parts.push('克日'); }
  return { wang: score >= 1, text: parts.join('、') || '平' };
}

// ---------- 规则 ----------
const C_BSZZ_ALIAS: Record<string,string> = {
  '用神分类': '用神分類定例第一', '世应论': '世應論用神第二', '卦身': '安月卦身訣', '卦身喜忌': '○卦身喜忌訣', '六冲六合': '合處逢冲，冲中逢合論第十五',
  '月破': '月破論第九', '旬空': '旬空論第十', '六兽': '六獸評論第七', '六亲': '六親變化歌',
  '反吟': '反吟卦定例第十一', '伏吟': '伏吟卦定例第十二', '旺衰': '旺相休囚論第十三', '飞伏': '卦爻呈象，并飛伏神卦身定例',
};
const C_BSZZ = (ch0: string) => {
  const ch = C_BSZZ_ALIAS[ch0] ?? ch0;
  return cite('bianshi', '卜筮正宗', ch, `bianshi.${ch}`, '（《卜筮正宗》原典回链，见书阁）', 'A');
};
const C_ZS_ALIAS: Record<string,string> = {
  '用神章': '用神章第八', '官鬼章': '用神元神忌神仇神章第九', '子孙章': '六親歌第五',
  '应期': '動變生尅冲合章第十五', '克处逢生章': '尅䖏逢生章第十三', '进退神章': '動静生尅章第十四', '元神': '元神忌神衰旺章第十',
  '月建': '四時旺相章第又十五', '旬空': '用神章第八', '世应': '世應章第六', '动变': '動變章第七',
};
const C_ZS = (ch0: string) => {
  const ch = C_ZS_ALIAS[ch0] ?? ch0;
  return cite('zengshan', '增删卜易', ch, `zengshan.${ch}`, '（《增删卜易》原典回链，见书阁）', 'A');
};
const C_HJC_ALIAS: Record<string,string> = {
  '总断': '黃金䇿總斷千金賦直解', '总断千金赋': '黃金䇿總斷千金賦直解', '月破': '黃金䇿總斷千金賦直解',
  '世应': '黃金䇿總斷千金賦直解', '伏神': '黃金䇿總斷千金賦直解', '旬空': '黃金䇿總斷千金賦直解', '暗动': '黃金䇿總斷千金賦直解',
};
const C_HJC = (ch0: string) => {
  const ch = C_HJC_ALIAS[ch0] ?? ch0;
  return cite('huangjince', '黄金策', ch, `huangjince.${ch}`, '（《黄金策》原典回链，见书阁）', 'A');
};

export function liuyaoRules(chart: LiuyaoChart): RuleHit[] {
  const hits: RuleHit[] = [];
  const yong = pickYongShen(chart);
  hits.push({
    ruleId: 'liuyao.yongshen.pick', title: `取用神：${yong.name}`,
    fact: yong.note, level: '中性', citations: [C_BSZZ('用神分类'), C_HJC('总断')], confidenceLevel: 'A',
    target: yong.lineIdx != null ? `第${yong.lineIdx + 1}爻` : undefined,
  });

  if (yong.lineIdx != null) {
    const line = chart.lines[yong.lineIdx];
    const wx = wangXiang(chart, line);
    const jin = wx.wang && !line.kong && !line.yuePo;
    hits.push({
      ruleId: 'liuyao.yongshen.wangxiang', title: `用神旺衰`,
      fact: `用神${line.liuqin}${line.najia}：${wx.text}${line.kong ? '；旬空' : ''}${line.yuePo ? '；月破' : ''}${line.moving ? '；发动' : '；安静'}${line.shiYing ? '（持世）' : ''}`,
      level: jin ? '吉' : '凶',
      citations: [C_ZS('用神章'), C_HJC('总断千金赋')], confidenceLevel: 'A',
      target: `第${yong.lineIdx + 1}爻`,
    });
    if (line.kong) hits.push({
      ruleId: 'liuyao.xunkong', title: '用神旬空',
      fact: `用神落旬空（旬空${chart.xunkong}）：主事未成、落空；出空之日/旬末可应`, level: '凶',
      citations: [C_HJC('旬空')], confidenceLevel: 'A',
    });
    if (line.yuePo) hits.push({
      ruleId: 'liuyao.yuepo', title: '用神月破',
      fact: `用神${line.branch}被月建${chart.monthZhi}冲破：主破败难成，出月/填实之日可应`, level: '凶',
      citations: [C_HJC('月破')], confidenceLevel: 'A',
    });
    if (line.moving && line.changed) {
      const isJin = line.jinTui === '进神', isTui = line.jinTui === '退神';
      hits.push({
        ruleId: isJin ? 'liuyao.jinshen' : isTui ? 'liuyao.tuishen' : 'liuyao.dongyao', title: isJin ? '化进神' : isTui ? '化退神' : '用神发动',
        fact: `用神动而化${line.changed.liuqin}${line.changed.najia}${isJin ? '，化进神，事在推进' : isTui ? '，化退神，事在消退' : ''}`, level: isTui ? '凶' : isJin ? '吉' : '变数',
        citations: [C_ZS('进退神章')], confidenceLevel: 'A',
      });
    }
    if (line.anDong) hits.push({
      ruleId: 'liuyao.andong', title: '暗动', fact: `用神静而逢日辰冲（暗动）：事已萌动，外人不知`, level: '变数',
      citations: [C_HJC('暗动')], confidenceLevel: 'A',
    });
    if (line.fuShenLiuqin && !chart.lines.some(l => l.liuqin === yong.name)) hits.push({
      ruleId: 'liuyao.fushen', title: '用神伏藏',
      fact: `用神不现，伏于第${yong.lineIdx + 1}爻${chart.lines[yong.lineIdx].liuqin}（飞神）之下：事藏未露，待冲飞之日应`, level: '变数',
      citations: [C_HJC('伏神')], confidenceLevel: 'A',
    });
  }

  // 世应
  const world = chart.lines[chart.worldIdx], resp = chart.lines[chart.responseIdx];
  const order = ['木', '火', '土', '金', '水'];
  const wxOf = (z: string) => ZHI_WUXING[DI_ZHI.indexOf(z)];
  const shengX = (a: string, b: string) => (order.indexOf(a) + 1) % 5 === order.indexOf(b);
  const keX = (a: string, b: string) => (order.indexOf(a) + 2) % 5 === order.indexOf(b);
  const rel = shengX(wxOf(world.branch), wxOf(resp.branch)) ? '世生应' : shengX(wxOf(resp.branch), wxOf(world.branch)) ? '应生世' : keX(wxOf(world.branch), wxOf(resp.branch)) ? '世克应' : keX(wxOf(resp.branch), wxOf(world.branch)) ? '应克世' : '世应比和';
  hits.push({
    ruleId: 'liuyao.shiying', title: '世应关系',
    fact: `世爻${world.liuqin}${world.najia}${world.kong ? '（空）' : ''}，应爻${resp.liuqin}${resp.najia}${resp.kong ? '（空）' : ''}，${rel}：${rel === '应生世' || rel === '世应比和' ? '彼来就我，事易成' : rel === '世生应' ? '我求于人，须费周章' : rel === '世克应' ? '我可制彼，主动在我' : '彼来克我，阻力在外'}`,
    level: rel === '应克世' ? '凶' : rel === '应生世' || rel === '世应比和' ? '吉' : '中性',
    citations: [C_BSZZ('世应论'), C_HJC('世应')], confidenceLevel: 'A',
  });

  if (chart.guaType) hits.push({
    ruleId: chart.guaType === '六冲卦' ? 'liuyao.liuchong.gua' : chart.guaType === '六合卦' ? 'liuyao.liuhe.gua' : 'liuyao.guate', title: chart.guaType,
    fact: chart.guaType === '六冲卦' ? '卦逢六冲：事易散、难持久，成亦速败' : chart.guaType === '六合卦' ? '卦逢六合：事易合、久远之象' : chart.guaType === '游魂卦' ? '游魂：心神不定、事多变' : '归魂：事将归、趋于安定',
    level: chart.guaType === '六合卦' ? '吉' : chart.guaType === '六冲卦' ? '凶' : '变数',
    citations: [C_BSZZ('六冲六合')], confidenceLevel: 'A',
  });

  // 官鬼（忧疑/竞争/盗）
  const guiLines = chart.lines.filter(l => l.liuqin === '官鬼');
  if (guiLines.length) {
    const g = guiLines[0];
    hits.push({
      ruleId: 'liuyao.guigui.status', title: '官鬼状态',
      fact: `官鬼${g.najia}${g.moving ? '发动' : '安静'}${g.kong ? '旬空' : ''}${g.yuePo ? '月破' : ''}：${g.moving ? '官鬼动则忧疑生、有阻隔或竞争' : '官鬼安静，阻碍未起'}${chart.category === '失物' ? '（疑被盗时参看官鬼辨盗）' : ''}`,
      level: g.moving ? '凶' : '中性', citations: [C_ZS('官鬼章')], confidenceLevel: 'A',
    });
  }
  const ziSun = chart.lines.find(l => l.liuqin === '子孙');
  if (ziSun && (ziSun.moving || wangXiang(chart, ziSun).wang)) hits.push({
    ruleId: 'liuyao.zisun.wang', title: '子孙旺动',
    fact: `子孙${ziSun.najia}${ziSun.moving ? '发动' : '旺相'}：福神当权，解忧排难，官鬼受制`, level: '吉',
    citations: [C_ZS('子孙章')], confidenceLevel: 'A',
  });

  // ---- R2 扩充：月卦身 / 伏吟 / 反吟 / 克处逢生（引文出自馆内《卜筮正宗》《增删卜易》）----
  const ZHI12 = '子丑寅卯辰巳午未申酉戌亥';
  // 月卦身：阳世从子起、阴世从午起，数至世位（安月卦身訣）
  const worldLine = chart.lines[chart.worldIdx];
  if (worldLine) {
    const startZhi = worldLine.yao === 'yang' ? 0 : 6;
    const shenZhi = ZHI12[(startZhi + chart.worldIdx) % 12];
    const shenOn = chart.lines.some(l => l.branch === shenZhi);
    hits.push({
      ruleId: 'liuyao.guashen', title: `月卦身：${shenZhi}`,
      fact: shenOn
        ? `阳世从子起、阴世从午起，数至世位得${shenZhi}——卦身上卦，事体有着落，看其旺衰空破定事之根基。`
        : `阳世从子起、阴世从午起，数至世位得${shenZhi}——卦身不上卦：事体未定，成败未可遽断，宜兼看世爻。`,
      level: shenOn ? '中性' : '变数',
      citations: [C_BSZZ('卦身'), C_HJC('总断')], confidenceLevel: 'A',
    });
  }
  // 伏吟：变卦与本卦相同
  if (chart.changedName && chart.changedName === chart.guaName) {
    hits.push({
      ruleId: 'liuyao.fuyin', title: '伏吟',
      fact: '变卦与本卦相同：内外不动、呻吟之象——事迟滞难进，忧虑呻吟，宜静不宜动。',
      level: '凶', citations: [C_BSZZ('伏吟'), C_ZS('应期')], confidenceLevel: 'A',
    });
  }
  // 反吟：坎离相冲（既济↔未济，反吟卦定例原句）
  const FANYIN: Array<[string, string]> = [['水火既济', '火水未济'], ['火水未济', '水火既济']];
  if (chart.changedName && FANYIN.some(([a, b]) => chart.guaName === a && chart.changedName === b)) {
    hits.push({
      ruleId: 'liuyao.fanyin', title: '反吟',
      fact: '坎离二卦相冲而变（既济↔未济）：往来反复、事必再度。定例原文：「水火既济变未济，火水未济变既济，此坎离二卦相冲，反吟卦也」。',
      level: '变数', citations: [C_BSZZ('反吟')], confidenceLevel: 'A',
    });
  }
  // 克处逢生：用神被日辰克、得月建生（增删卜易·克处逢生章）
  const BR_WX: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const WX_ORDER = ['木', '火', '土', '金', '水'];
  const wxSheng = (a: string, b: string) => (WX_ORDER.indexOf(a) + 1) % 5 === WX_ORDER.indexOf(b);
  const wxKe = (a: string, b: string) => (WX_ORDER.indexOf(a) + 2) % 5 === WX_ORDER.indexOf(b);
  if (yong.lineIdx != null && yong.lineIdx >= 0) {
    const yl = chart.lines[yong.lineIdx];
    const yWx = BR_WX[yl.branch] ?? '';
    const riKe = wxKe(BR_WX[chart.dayZhi] ?? '', yWx);
    const yueSheng = wxSheng(BR_WX[chart.monthZhi] ?? '', yWx);
    if (riKe && yueSheng) {
      hits.push({
        ruleId: 'liuyao.kechufengsheng', title: '克处逢生',
        fact: `用神${yl.najia}（${yWx}）被日辰克、得月建生——凶中有救，先难后解。《增删卜易》克处逢生章：受克之地，得生则活。`,
        level: '吉', citations: [C_ZS('克处逢生章')], confidenceLevel: 'A',
      });
    }
  }

  return hits;
}

// ---------- 应期规则（ruleId 化，AI 不得自由生成） ----------
export function liuyaoTiming(chart: LiuyaoChart): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  const yong = pickYongShen(chart);
  const add = (ruleId: string, text: string, window: string, level: 'A' | 'B' | 'C' | 'D', cit?: boolean) =>
    out.push({ ruleId, text, window, citations: cit === false ? [] : [C_ZS('应期')], confidenceLevel: level });
  // 卦体层级应期（最高优先级）
  if (chart.guaType === '六冲卦') add('liuyao.timing.liuchonggua', '六冲卦：主事快、动、散——应期近（数日至半月），冲则冲散不宜久拖', '快', 'B');
  else if (chart.guaType === '六合卦') add('liuyao.timing.liuhegua', '六合卦：主事慢、稳、久——应期迟（半月至数月），合则粘住不宜求快', '迟', 'B');
  else if (chart.guaType === '游魂卦') add('liuyao.timing.youhun', '游魂卦：主变动、消息不实、客人主事——应期在游移不定之间，近则三日远则三月', '中', 'B');
  else if (chart.guaType === '归魂卦') add('liuyao.timing.guihun', '归魂卦：主归位、回家、旧事重提——应期在归定之时，近则当日远则三旬', '中', 'B');
  if (yong.lineIdx == null) {
    add('liuyao.timing.none', '暂无内置用神直取应期（用神伏藏或不现，建议参看世爻或月/日支应期口诀）', '—', 'D');
  } else {
    const line = chart.lines[yong.lineIdx];
    const zhiIdx = DI_ZHI.indexOf(line.branch);
    const chong = DI_ZHI[(zhiIdx + 6) % 12];
    const he = heZhi(line.branch);
    // 用神空亡 → 填实/冲实
    if (line.kong) {
      add('liuyao.timing.chukong', `用神旬空（${line.branch}空）→ ①填实：${line.branch}日/月  ②冲实：${chong}日/月。出旬之后方真应，应慢不应急`, '旬~一月', 'A');
    }
    // 动爻 → 合动爻日
    if (line.moving) {
      add('liuyao.timing.dongdaihe', `动待合：用神${line.branch}动 → 逢六合日（${he}）应；或动爻变爻六合日应`, '近期', 'A');
      add('liuyao.timing.dongdaichong', `动待值：动爻旺相 → 逢${line.branch}值值之日即应（动则速）`, '近期', 'B');
      // 动化进神/退神
      if (line.jinTui?.includes('进')) add('liuyao.timing.jinshen', `进神（${line.jinTui}）→力渐强，应期在进阶之支值，日事则3~9日`, '近期', 'B');
      else if (line.jinTui?.includes('退')) add('liuyao.timing.tuishen', `退神（${line.jinTui}）→力渐弱，应期在退气之时，日事则久拖`, '远期', 'B');
    } else {
      add('liuyao.timing.jingdaichong', `静待冲：用神静 → 逢${chong}冲${line.branch}之日应；静极逢冲则动`, '视旺衰', 'A');
    }
    if (line.yuePo) add('liuyao.timing.bupo', `月破（${line.branch}被月建冲破）→ ①出月后逢值（${line.branch}） ②或逢合（${he}）  ③或逢日/动爻生扶为实破`, '出月后', 'A');
    if (line.anDong) add('liuyao.timing.andong', '暗动（旺相静爻被日冲）→ 事在暗中发生，近则次日远则七日', '近~一周', 'B');
    if (line.fuShenLiuqin) add('liuyao.timing.chongfei', `伏神（伏${line.fuShenLiuqin}${line.fuShen ?? ''}）→ 待①冲飞神${line.branch}之日 ②或飞神空亡/月破之日引拔伏神`, '近期', 'A');
    add('liuyao.timing.zhirizhiyue', `用神旺相 → ${line.branch}值值之日/月为正应（这是最常用的"正应期"）`, '视旺衰', 'A');
    // 三合局应期
    const sanheGroups: Array<[string, string]> = [['申子辰', '水'], ['亥卯未', '木'], ['寅午戌', '火'], ['巳酉丑', '金']];
    for (const [g] of sanheGroups) {
      if (g.includes(line.branch)) {
        const need = g.split('').filter(x => x !== line.branch);
        // 看另外两支是否出现于月/日/动爻变爻
        const pool = [chart.monthZhi, chart.dayZhi, ...chart.lines.map(l => l.branch), ...chart.lines.filter(l => l.changed).map(l => l.changed?.branch ?? '')].filter(Boolean) as string[];
        const miss = need.filter(x => !pool.includes(x));
        if (miss.length === 0) add('liuyao.timing.sanhe.cheng', `三合局（${g}）已全 → 立即/近日应（合局成事快）`, '极快', 'A');
        else add('liuyao.timing.sanhe.dai', `三合局（${g}）待补：缺${miss.join('、')} → 逢${miss.join('/')}值支之日成全则应`, '待补', 'B');
        break;
      }
    }
  }
  // 世爻/应爻 合冲应期（兜底）
  const shi = chart.lines.find(l => l.shiYing === '世');
  const ying = chart.lines.find(l => l.shiYing === '应');
  if (shi && ying) {
    const heShi = heZhi(shi.branch), heYing = heZhi(ying.branch);
    const chShi = DI_ZHI[(DI_ZHI.indexOf(shi.branch) + 6) % 12];
    add('liuyao.timing.shihe', `世合应：世${shi.branch}合${heShi} / 应${ying.branch}合${heYing} → 问我事合世支、问他事合应支`, '兜底', 'B');
    if (shi.yuePo || ying.yuePo) add('liuyao.timing.shiPo', `世/应破 → 合破日（世合${heShi}/应合${heYing}）为实，逢${chShi}冲世为病愈/动身`, '出月', 'B');
  }
  // 卦数计期总诀
  add('liuyao.timing.guaShu', '【卦数计期】先天八卦数：乾1兑2离3震4巽5坎6艮7坤8。上卦+下卦+动爻=总数。旺×2、衰÷2。例：乾1+兑2+2爻动=5→5天/5月。', '视旺衰', 'C', false);
  return out;
}
function heZhi(z: string): string {
  const pairs: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  return pairs[z] ?? '';
}

// ---------- 盘面 ----------
export function liuyaoBoard(chart: LiuyaoChart): BoardSpec {
  const lines: BoardLine[] = chart.lines.map(l => ({
    index: l.index, yao: l.yao, moving: l.moving,
    changed: l.changed ? (l.changed.branch ? (['子', '寅', '辰', '午', '申', '戌'].includes(l.changed.branch) ? 'yang' : 'yin') : null) : null,
    najia: l.najia + (l.changed ? ` → ${l.changed.najia}` : ''),
    liuqin: l.liuqin + (l.fuShenLiuqin ? `（伏:${l.fuShenLiuqin}${l.fuShen}）` : ''),
    liushen: l.liushen,
    shiYing: l.shiYing,
  }));
  return {
    kind: 'stack', art: 'liuyao',
    title: `${chart.guaName}（${chart.gongName}·属${chart.gongWuxing}）${chart.changedName ? ` 之 ${chart.changedName}` : ''}`,
    lines,
    info: [
      { label: '起卦', value: `${chart.method}${chart.detail ? '：' + chart.detail : ''}` },
      { label: '月建', value: chart.monthPillar }, { label: '日辰', value: chart.dayPillar },
      { label: '旬空', value: chart.xunkong }, { label: '卦体', value: chart.guaType || '杂卦' },
      { label: '互/错/综', value: `${chart.huGuaName} / ${chart.cuoGuaName} / ${chart.xzGuaName}` },
    ],
  };
}

export function liuyaoWarnings(chart: LiuyaoChart): Warning[] {
  const w: Warning[] = [];
  if (chart.method === '摇卦' && !chart.coins) w.push({ code: 'liuyao/coins', message: '摇卦未提供铜钱记录，结果为模拟起卦，仅供参考' });
  return w;
}

export function liuyaoEvidence(chart: LiuyaoChart, rules: RuleHit[]): CitationRef[] {
  const seen = new Set<string>(); const out: CitationRef[] = [];
  for (const r of rules) for (const c of r.citations) {
    const k = c.canonicalId + '/' + c.segId;
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }
  void chart;
  return out;
}

export function liuyaoFacts(chart: LiuyaoChart, _cat: string): FactBundle {
  const yong = pickYongShen(chart);
  const f: FactBundle = { facts: [] };
  const push = (k: string, l: string, v: string) => f.facts.push({ key: k, label: l, value: v });
  push('guaming', '卦名', chart.guaName + (chart.changedName ? ` → ${chart.changedName}` : ''));
  push('shiyong', '世应', `${chart.lines[chart.worldIdx].liuqin}${chart.lines[chart.worldIdx].najia} / ${chart.lines[chart.responseIdx].liuqin}${chart.lines[chart.responseIdx].najia}`);
  push('yongshen', '用神', `${yong.name}：${yong.note}`);
  for (const l of chart.lines) {
    if (l.moving || l.shiYing || (yong.lineIdx === l.index)) push(`yao${l.index + 1}`, `第${l.index + 1}爻`, `${l.liushen} ${l.liuqin} ${l.najia}${l.moving ? ' 动' : ''}${l.kong ? ' 空' : ''}${l.yuePo ? ' 破' : ''}${l.shiYing ? ' ' + l.shiYing : ''}`);
  }
  push('rijian', '日月', `月建${chart.monthPillar} 日辰${chart.dayPillar} 旬空${chart.xunkong}`);
  return f;
}

export { guaByName, GUA64, XIAN_TIAN_SHU, TRIGRAM_WUXING, TIAN_GAN, GAN_WUXING, ganzhiIndex };
