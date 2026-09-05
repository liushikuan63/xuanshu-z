#!/usr/bin/env node
/**
 * 点藏网/国学网 raw → 语料入库
 * 读取 .tmp-corpus/ws/<cid>.txt（点藏网/国学网抓取的纯文本，含 \n 字面量等格式问题），
 * 清理 → opencc 转简体 → 切 60–260 字段落 → 写 data/.kb/books/<cid>/。
 * 使用：node scripts/import-diancang-corpus.mjs [cid...]（不传则跑全部已配置书目）
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
const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });

const BOOKS = {
  'duanyi-tianji': {
    file: 'duanyi-tianji.txt', title: '断易天机', author: '明·徐绍锦（校）',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: ['liuyao'],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/duanyitianji/',
    chapterRe: /^\s*(断易天机\s*卷[一二三四五六七八九十]+)/,
  },
  yiyin: {
    file: 'yiyin.txt', title: '易隐', author: '曹九锡（清）',
    src: '国学网·易藏/术数（公版整理）', conf: 0.9, art: ['liuyao'],
    srcUrl: 'https://gushu.net.cn/guji/易藏/术数/易隐.html',
    chapterRe: /^\s*(卷[一二三四五六七八九十]+)/,
  },
  'yangzhai-shishu': {
    file: 'yangzhai-shishu.txt', title: '阳宅十书', author: '明·王君荣辑',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/yangzhaishishu/',
    chapterRe: /^\s*[一二三四五六七八九十]+、/,
  },
  cuiguanpian: {
    file: 'cuiguanpian.txt', title: '催官篇', author: '赖布衣（宋）·四库全书本',
    src: '国学网·易藏/术数（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://gushu.net.cn/guji/易藏/术数/催官篇.html',
    chapterRe: /^\s*(催官篇\s*卷[一二三四五六七八九十]+)/,
    skipLines: 3,
  },
  'xiuling-yaozhi': {
    file: '修龄要指.txt', title: '修龄要指', author: '冷谦（明）',
    src: '国学网（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://gushu.net.cn/',
    chapterRe: /^\s*(四时调摄|起居调摄|延年六字诀|长生一十六字诀|十六段锦|八段锦导引法|导引却病歌诀|却病八则)/,
  },
  // ── 第一批新抓取 ──
  boshanpian: {
    file: 'boshanpian.txt', title: '博山篇', author: '题 黄妙应（五代宋）',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/11586/',
    chapterRe: /^\s*(相地法|论龙|论向首|论合穴|论龙神|论砂|论水|论明堂|论阳宅|论平地|论葬法)/,
    skipLines: 0,
  },
  'shenxiang-tieguan': {
    file: 'shenxiang-tieguan.txt', title: '神相铁关刀', author: '题 陈希夷（托名）',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/shenxiangtieguandao/',
    chapterRe: /^\s*(铁关刀原序|神相铁关刀卷[一二三四五六七八九十]+|神相铁关刀续卷|神相铁关刀后集)/,
    skipLines: 0,
  },
  'liuzhuang-shenxiang': {
    file: 'liuzhuang-shenxiang.txt', title: '柳庄神相', author: '袁珙（明）',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/liuzhuangxiangfa/',
    chapterRe: /^\s*[一二三四五六七八九十]+、/,
    skipLines: 1,
  },
  'gongdu-xiangfa': {
    file: 'gongdu-xiangfa.txt', title: '公笃相法', author: '陈公笃（民国）',
    src: '点藏网·玄学五术（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.diancang.xyz/xuanxuewushu/gongduxiangfa/',
    chapterRe: /^\s*(《公笃相法》[上下]篇卷[一二三四五六七八九十]+|四相法有益引证|男女面痣图说|男女身痣图说|男女面毛图说|手掌图说|男格推论|男女二十四刑克|相法入门|形相五局|五局相法|女人相法|相气色法|相法诀要)/,
    skipLines: 0,
  },
  // ── 第二批新抓取 ──
  'mayi-shenxiang': {
    file: 'mayi-shenxiang.txt', title: '麻衣神相', author: '题 麻衣道者（宋）',
    src: '全学网·古籍（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://www.quanxue.cn/qt_mingxiang/mayixf/',
    chapterRe: /^\s*(《麻衣相法》卷[一二三四五六七八九十]+)/,
    skipLines: 2,
  },
  // ── 第三批：紫微斗数短篇 + 拳经 ──
  'xuanwei-lun': {
    file: 'xuanwei-lun.txt', title: '玄微论', author: '陈希夷（宋）',
    src: '网络公版整理', conf: 0.9, art: ['ziwei'],
    srcUrl: 'https://www.bilibili.com/opus/1080241754543751172',
    skipLines: 1,
  },
  'shiyuge': {
    file: 'shiyuge.txt', title: '十喻歌', author: '佚名（传统歌诀）',
    src: '网络公版整理', conf: 0.9, art: ['ziwei'],
    srcUrl: 'http://ab.newdu.com/book/ms199797.html',
    skipLines: 1,
  },
  'quanjing-quanfa': {
    file: 'quanjing-quanfa.txt', title: '拳经拳法备要', author: '张孔昭（清）',
    src: '太极网（公版整理）', conf: 0.9, art: [],
    srcUrl: 'https://taiji.net.cn/article-8964-1.html',
    chapterRe: /^\s*(拳经序|注张孔昭先生拳经序|拳经|问答歌诀二十款悉尽其中之秘|周身秘诀十二项|下盘细密秘诀|少林寺短打身法统宗拳谱)/,
    skipLines: 0,
  },
};

function clean(raw, cfg = {}) {
  let t = raw.replace(/^\uFEFF/, '');
  // 替换字面量 \n 为实际换行（点藏网文本常有）
  t = t.replace(/\\n/g, '\n');
  // 跳过前 N 行噪音（如 HTML 面包屑残渣）
  if (cfg.skipLines > 0) {
    const lines = t.split('\n');
    t = lines.slice(cfg.skipLines).join('\n').trim();
  }
  // 去除残留 HTML 标签
  t = t.replace(/<[^>]+>/g, '');
  // 繁简转换 + 异体折叠
  t = toSimplified(t);
  t = foldVariants(t);
  // 易卦专名恢复
  t = t.replace(/干(?=上|下|刚|为|务|象|卦|首|三|初|吉|悔|亢|利|用|始)/g, '乾');
  t = t.replace(/干干/g, '乾乾');
  t = t.replace(/䷀干/g, '䷀乾');
  // 规范化空白
  t = t.replace(/[ 　]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function isNoise(seg) {
  if (seg.length < 16) return true;
  if (/^(http|www|category|分类|来源|index|author|title|此页面最后编辑)/i.test(seg)) return true;
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
    if (bookCfg.chapterRe && bookCfg.chapterRe.test(line) && line.length <= 20) {
      pushBuf(chapter);
      chapter = line.slice(0, 40);
      continue;
    }
    buf += line + '\n';
    if (buf.replace(/\s/g, '').length >= 180) {
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
    if (segs.length < 3) { console.log(`SKIP ${cid}: 段落过少(${segs.length})`); continue; }
    const dir = path.join(OUT, cid);
    fs.mkdirSync(dir, { recursive: true });
    const rows = segs.map((s, i) => JSON.stringify({
      canonical_id: cid, title: cfg.title, author: cfg.author,
      edition: cfg.src, publication_date: '', source_url: cfg.srcUrl,
      access_date: TODAY, license: '公有领域', volume: '', chapter: s.chapter.slice(0, 40), section: '', seq: i + 1,
      segId: `${cid}.${i + 1}`, text: s.text, normalized_text: s.text, charRange: [0, s.text.length],
      tags: cfg.art ?? [], annotations: '', transcription_confidence: cfg.conf, isPublicDomain: true, confidence_level: 'A',
    }));
    fs.writeFileSync(path.join(dir, 'corpus.jsonl'), rows.join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      canonical_id: cid, title: cfg.title, author: cfg.author, edition: cfg.src, publication_date: '',
      license: '公有领域', art: cfg.art ?? [], source_urls: [cfg.srcUrl],
      segment_count: segs.length, collected_at: TODAY, confidence: 'A',
      source_note: '抓取自点藏网/国学网（公版整理），未改原文；繁体转简体处理。',
    }, null, 2) + '\n', 'utf8');
    upsertManifest(cid, cfg.title, cfg.art ?? [], segs.length);
    console.log(`  OK ${cid}：${segs.length} 段 (${cleaned.length} 字)`);
    ok += 1;
  }
  console.log(`\n完成：${ok}/${keys.length} 部 → data/.kb/books/`);
}

main();