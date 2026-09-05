#!/usr/bin/env node
/**
 * 维基文库 raw → 语料入库（D1·批次二）
 * 读取 .tmp-corpus/ws/<cid>.txt（维基文库 action=raw 抓取的纯文本，含 {{Header}} 头），
 * 清理模板/繁简转换标记 → opencc 转简体 → 切 80–260 字段落 → 写 data/.kb/books/<cid>/。
 * 使用：node scripts/import-ws-corpus.mjs [cid...]（不传则跑全部）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '.tmp-corpus', 'ws');
const OUT = path.join(ROOT, 'data', '.kb', 'books');
const TODAY = new Date().toISOString().slice(0, 10);
const VARIANTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8'));
const VAR_RE = new RegExp('[' + Object.keys(VARIANTS).map(c => '\\u{' + c.codePointAt(0).toString(16) + '}').join('') + ']', 'gu');
const foldVariants = (t) => t.replace(VAR_RE, ch => VARIANTS[ch] ?? ch);
const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' }); // 繁体→简体

/** 书目注册：ws 原始文件 → 元数据（title/author/章节正则/渠道） */
const BOOKS = {
  maijing: {
    file: '脈經.txt', title: '脉经', author: '王叔和（西晋）',
    src: '维基文库·脉经（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(脉经卷[一二三四五六七八九十]+|卷[一二三四五六七八九十]+)/,
  },
  lingshu: {
    file: '靈樞經.txt', title: '黄帝内经·灵枢', author: '托名黄帝（先秦—汉）',
    src: '维基文库·灵枢经（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(卷之?[一二三四五六七八九十百\d]+|卷[一二三四五六七八九十百\d]+)/,
  },
  'qianjin-yifang': {
    file: '千金翼方.txt', title: '千金翼方', author: '孙思邈（唐）',
    src: '维基文库·千金翼方（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(卷[一二三四五六七八九十百\d]+)/,
  },
  'wenre-lun': {
    file: '溫熱論.txt', title: '温热论', author: '叶桂（叶香岩）口述·门人整理',
    src: '维基文库·温热论（公版整理）', conf: 0.9, art: [],
    chapterRe: null,
  },
  'xuezheng-lun': {
    file: '血證論.txt', title: '血证论', author: '唐宗海（容川，清）',
    src: '维基文库·血证论（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(卷[一二三四五六七八九十百\d]+)/,
  },
  'fuqingzhu-nvke': {
    file: '傅青主女科.txt', title: '傅青主女科', author: '题 傅山（清）',
    src: '维基文库·傅青主女科（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(卷[一二三四五六七八九十百\d]+)/,
  },
  'qiongtong-baojian': {
    file: '窮通寶鑑.txt', title: '穷通宝鉴', author: '清·余春台编（调候总论）',
    src: '维基文库·穷通宝鉴（公版整理）', conf: 0.9, art: ['bazi'],
    chapterRe: /^\s*(正月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月|春月|夏月|秋月|冬月)/,
  },
  qingnangjing: {
    file: '青囊經.txt', title: '青囊经', author: '题 黄石公/杨筠松（托名）',
    src: '维基文库·青囊经（公版整理）', conf: 0.9, art: [],
    chapterRe: null,
  },
  zhaijing: {
    file: '宅經.txt', title: '宅经', author: '托名皇帝（《黄帝宅经》）',
    src: '维基文库·宅经（公版整理）', conf: 0.9, art: [],
    chapterRe: null,
  },
  tuibeitu: {
    file: '推背圖.txt', title: '推背图', author: '题 李淳风、袁天罡（托名）',
    src: '维基文库·推背图（公版整理）', conf: 0.9, art: [], chapterRe: null,
  },
  shaobingge: {
    file: '燒餅歌.txt', title: '烧饼歌', author: '题 刘基（托名）',
    src: '维基文库·烧饼歌（公版整理）', conf: 0.9, art: [], chapterRe: null,
  },
  lingxian: {
    file: '靈憲.txt', title: '灵宪', author: '张衡（东汉）',
    src: '维基文库·灵宪（公版整理）', conf: 0.9, art: [], chapterRe: null,
  },
  'dongpo-yizhuan': {
    file: '東坡易傳.txt', title: '东坡易传', author: '苏轼（宋）',
    src: '维基文库·东坡易传（公版整理）', conf: 0.9, art: ['liuyao', 'meihua'],
    chapterRe: /^\s*(卷一|卷二|卷三|卷四|卷五|卷六|卷七|卷八|卷九|卷十|卷十一|卷十二|卷十三|卷十四|卷十五|卷十六|卷十七|卷十八|卷十九|卷二十|卷廿)/,
  },
  'jingshi-yizhuan': {
    file: '京氏易傳.txt', title: '京氏易传', author: '京房（西汉）',
    src: '维基文库·京氏易传（公版整理）', conf: 0.9, art: ['liuyao'],
    chapterRe: /^\s*(卷上|卷中|卷下|卷[一二三])/,
  },
  'huangji-shishi': {
    file: '皇極經世書.txt', title: '皇极经世书', author: '邵雍（宋）',
    src: '维基文库·皇极经世书（公版整理）', conf: 0.9, art: ['meihua'],
    chapterRe: /^\s*(卷一|卷二|卷三|卷四|卷五|卷六|卷七|卷八|卷九|卷十|卷十一|卷十二|卷十三|卷十四)/,
  },
  baduanjin: {
    file: '八段錦.txt', title: '八段锦', author: '佚名（托名宋前导引术）',
    src: '维基文库·八段锦（公版整理）', conf: 0.9, art: [], chapterRe: null,
  },
  yijinjing: {
    file: '易筋經.txt', title: '易筋经', author: '题 达摩（明刻本托名）',
    src: '维基文库·易筋经（公版整理）', conf: 0.9, art: [], chapterRe: /^\s*(卷[一二三四五六七八九十百\d]+)/,
  },
  tianguanshu: {
    file: '史記天官書.txt', title: '史记·天官书', author: '司马迁（西汉）',
    src: '维基文库·史记/卷027 天官书（公版整理）', conf: 0.95, art: [],
    chapterRe: /^\s*(中宮|東宮|南宮|西宮|北宮|中宫|东宫|南宫|西宫|北宫)\s*$/,
    dropStarNotes: true,
  },
  'hanshu-tianwenzhi': {
    file: '漢書天文志.txt', title: '汉书·天文志', author: '班固（东汉）',
    src: '维基文库·汉书/卷026 天文志（公版整理）', conf: 0.95, art: [],
    chapterRe: null,
    dropStarNotes: true,
  },
  'taiqing-shenjian': {
    file: '太清神鑑.txt', title: '太清神鉴（六卷）', author: '题 王朴（五代）·四库全书本',
    src: 'kanripo·四库全书文渊阁本（公版整理）', conf: 0.95, art: [],
    chapterRe: /^\s*(太清神鑑卷[一二三四五六]|欽定四庫全書\s*$)/,
  },
  'xingxue-dacheng': {
    file: '星學大成.txt', title: '星学大成（三十卷）', author: '万民英（明）·四库全书本',
    src: 'kanripo·四库全书文渊阁本（公版整理）', conf: 0.95, art: [],
    chapterRe: /^\s*(星學大成\s*卷[一二三四五六七八九十百\d]+|欽定四庫全書\s*$)/,
  },
  lingjianzi: {
    file: '灵剑子.txt', title: '灵剑子', author: '题 许逊（晋）·正统道藏本（道音文化整理）',
    src: '道音文化·正统道藏洞玄部众术类（公版整理）', conf: 0.9, art: [],
    chapterRe: /^\s*(序第一|学问第二|服气第三|道海喻第四|暗铭注第五|松沙记第六|道诚第七|道戒第七|导引势第八)(\s|$)/,
  },
};

function clean(raw, cfg = {}) {
  let t = raw.replace(/^\uFEFF/, ''); // 去 BOM（文件头元数据行才会被后续行正则命中）
  // 一、先解 -{X}- 繁简标记（保留内层字，如 -{乾}- → 乾；形如 -{zh-hant:..;zh-hans:..}- 择简体），
  //    避免后续模板剥离被 -{ }- 中的花括号干扰
  t = t.replace(/-\{([^}]*)\}-/g, (m, inner) => {
    if (inner.includes(';')) {
      const p = inner.split(';').map(x => x.split(':').pop());
      return p.find(s => /[一-鿿]/.test(s)) ?? p[0] ?? '';
    }
    return inner.replace(/^\s*zh-hans[:：]/, '').trim();
  });
  // 二、注疏本（史记/汉书）：剥离 {{*|…}}（索隐/正义夹注）与颜色模板，仅保留白文
  if (cfg.dropStarNotes) {
    // 1) 先剥单层颜色模板 {{deepPink|…}} / {{green|…}} 等（内部无嵌套花括号）
    t = t.replace(/\{\{(?:deepPink|green|blue|red|purple|orange|teal|violet)\|[^}]*\}\}/g, ' ');
    // 2) 再剥 {{*|…}}（此时内部已无模板与标记，可整体删除；含【正義】等注文一并去除）
    t = t.replace(/\{\{\*\|[^{}]*\}\}/g, ' ');
    t = t.replace(/\{\{annotate\|[^}]*\}\}/g, ' ');
    // 3) 卷末「索隐述赞」是索隐注疏的结尾赞语，非正文，一并剔除
    t = t.replace(/索隱述贊[\s\S]*$/, '');
  }
  // 三、其余模板整体去掉
  if (!cfg.dropStarNotes) {
    // 非注疏本：{{*|夹注}} / {{annotate|...}} 保留内层正文（如京房注文有价值）
    t = t.replace(/\{\{\*\|([^}]*)\}\}/g, '（$1）');
    t = t.replace(/\{\{annotate\|([^}]*)\}\}/g, '（$1）');
  }
  // 四库全书本 {{SK anchor|...}}：保留内容（卦辞/观物篇标题等正文）；{{SKchar|缺字}} {{SK notes|注释}} 丢弃
  t = t.replace(/\{\{SK ?anchor\|([^}]*)\}\}/g, '$1');
  t = t.replace(/\{\{SK ?notes\|([^}]*)\}\}/g, '$1');
  t = t.replace(/\{\{SK ?char\|[^}]*\}\}/g, '□');
  // 其余模板整体去掉
  t = t.replace(/\{\{[^}]*\}\}/g, '');
  t = t.replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1');
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<ref[\s\S]*?<\/ref>/g, '');
  t = t.replace(/<[^>]+>/g, '');
  // 标题行标记归一
  t = t.replace(/^=+\s*(.*?)\s*=+$/gm, '$1');
  t = t.replace(/^[=\s]*$/gm, '');
  // kanripo/org 文件头元数据（#+TITLE:… #+DATE:… # -*- mode…），非正文
  t = t.replace(/^# ?\+[A-Za-z]+:.*$/gm, '');
  t = t.replace(/^# ?-\*-.*$/gm, '');
  // 繁体→简体 + 异体折叠
  t = toSimplified(t);
  t = foldVariants(t);
  // 易卦专名恢复：opencc hk→cn 会按"干湿"音把「乾」误转「干」（卦名语境恢复）
  // 语境词：上/下/刚/为/务/象/卦/首/三/初/吉/悔/亢/利/用/始 —— 出现时「干」必为「乾」卦；「干支」等不受影响
  t = t.replace(/干(?=上|下|刚|为|务|象|卦|首|三|初|吉|悔|亢|利|用|始)/g, '乾');
  t = t.replace(/干干/g, '乾乾');
  t = t.replace(/䷀干/g, '䷀乾');
  // 规范化空白
  t = t.replace(/[ 　]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function isNoise(seg) {
  if (seg.length < 16) return true;
  if (/^(category|分类|来源|index|author|title|此页面最后编辑)/i.test(seg)) return true;
  return false;
}

function segment(text, bookCfg) {
  const out = [];
  let buf = '';
  const pushBuf = (chapter) => {
    const s = buf.replace(/\s+/g, '').trim();
    if (s.length >= 40 && !isNoise(s)) out.push({ text: s, chapter });
    buf = '';
  };
  const lines = text.split('\n');
  let chapter = '正文';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 卷标题行 → 更新 chapter
    if (bookCfg.chapterRe && bookCfg.chapterRe.test(line) && line.length <= 20) {
      pushBuf(chapter);
      chapter = line.slice(0, 40);
      continue;
    }
    buf += line + '\n';
    if (buf.replace(/\s/g, '').length >= 180) {
      // 按句号切
      const joined = buf;
      buf = '';
      for (const sent of joined.split(/(?<=[。！？；])/)) {
        const s = sent.replace(/\s+/g, '').trim();
        if (!s) continue;
        if (s.length > 260) {
          for (let i = 0; i < s.length; i += 240) out.push({ text: s.slice(i, i + 240), chapter });
        } else out.push({ text: s, chapter });
      }
    }
  }
  pushBuf(chapter);
  return out.filter(o => o.text.length >= 24 && !isNoise(o.text));
}

function upsertManifest(cid, title, art, count) {
  const mp = path.join(OUT, 'manifest.json');
  const man = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : { generated_at: TODAY, total_books: 0, total_segments: 0, books: [] };
  const i = man.books.findIndex(b => b.canonical_id === cid);
  const rec = { canonical_id: cid, title, art, segment_count: count };
  if (i >= 0) man.books[i] = rec; else man.books.push(rec);
  man.total_books = man.books.length;
  man.total_segments = man.books.reduce((s, b) => s + b.segment_count, 0);
  fs.writeFileSync(mp, JSON.stringify(man, null, 2) + '\n', 'utf8');
}

async function main() {
  const want = process.argv.slice(2);
  const keys = Object.keys(BOOKS).filter(k => !want.length || want.includes(k));
  let ok = 0;
  for (const cid of keys) {
    const cfg = BOOKS[cid];
    const fp = path.join(SRC, cfg.file);
    if (!fs.existsSync(fp)) { console.log(`SKIP ${cid}: 缺 raw 文件 ${cfg.file}`); continue; }
    const raw = fs.readFileSync(fp, 'utf8');
    const cleaned = clean(raw, cfg);
    if (cleaned.length < 200) { console.log(`SKIP ${cid}: 正文过短(${cleaned.length})，疑似空页`); continue; }
    const segs = segment(cleaned, cfg);
    if (segs.length < 3) { console.log(`SKIP ${cid}: 过段过少(${segs.length})`); continue; }
    const dir = path.join(OUT, cid);
    fs.mkdirSync(dir, { recursive: true });
    const rows = segs.map((s, i) => JSON.stringify({
      canonical_id: cid, title: cfg.title, author: cfg.author,
      edition: cfg.src, publication_date: '', source_url: `https://zh.wikisource.org/wiki/${encodeURIComponent(cfg.file.replace(/\.txt$/, ''))}`,
      access_date: TODAY, license: '公有领域', volume: '', chapter: s.chapter.slice(0, 40), section: '', seq: i + 1,
      segId: `${cid}.${i + 1}`, text: s.text, normalized_text: s.text, charRange: [0, s.text.length],
      tags: cfg.art ?? [], annotations: '', transcription_confidence: cfg.conf, isPublicDomain: true, confidence_level: 'A',
    }));
    fs.writeFileSync(path.join(dir, 'corpus.jsonl'), rows.join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      canonical_id: cid, title: cfg.title, author: cfg.author, edition: cfg.src, publication_date: '',
      license: '公有领域', art: cfg.art ?? [], source_urls: [`https://zh.wikisource.org/wiki/${cfg.file.replace(/\.txt$/, '')}`],
      segment_count: segs.length, collected_at: TODAY, confidence: 'A',
      source_note: '抓取自维基文库（公版整理），未改原文；繁体转简体处理。',
    }, null, 2) + '\n', 'utf8');
    upsertManifest(cid, cfg.title, cfg.art ?? [], segs.length);
    console.log(`  OK ${cid}：${segs.length} 段 (${cleaned.length} 字)`);
    ok += 1;
  }
  console.log(`\n完成：${ok}/${keys.length} 部 → data/.kb/books/`);
}

main();