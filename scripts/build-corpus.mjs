#!/usr/bin/env node
/**
 * 玄枢知识库语料生成脚本
 * 读取 .tmp-corpus/raw/<cid>.json 原始抓取数据，
 * 切分为 80–260 字段落，输出 docs/corpus-spec.md 规定的：
 *   data/.kb/books/<canonicalId>/corpus.jsonl
 *   data/.kb/books/<canonicalId>/meta.json
 *   data/.kb/books/manifest.json
 *
 * 严禁编造原文：所有段落均机械切分自来源页面抓取文本。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, '.tmp-corpus', 'raw');
const OUT = path.join(ROOT, 'data', '.kb', 'books');
const VARIANTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8')); // 异体字→正字
const VAR_RE = new RegExp('[' + Object.keys(VARIANTS).map(c => '\\u{' + c.codePointAt(0).toString(16) + '}').join('') + ']', 'gu');
const foldVariants = (t) => t.replace(VAR_RE, ch => VARIANTS[ch] ?? ch);
const TODAY = '2026-08-29';

/** 书目注册表：raw 文件 → 规范元数据 */
const BOOKS = {
  zengshan: {
    raw: 'zengshan.json', title: '增删卜易', author: '野鹤老人 撰、李文辉（觉子）辑',
    edition: '识典古籍·野鹤老人抄本（清·李文辉整理）', publication_date: '清康熙二十九年',
    source_url: 'https://www.shidianguji.com/book/XYXZSBY', art: ['liuyao'],
    license: '公有领域', transcription_confidence: 0.95, cap: 160,
  },
  bianshi: {
    raw: 'bianshi.json', title: '卜筮正宗', author: '王洪绪（王维德）辑',
    edition: '识典古籍·哈佛燕京图书馆藏金闾绿荫堂藏板（清乾隆）', publication_date: '清',
    source_url: 'https://www.shidianguji.com/book/HY1439', art: ['liuyao'],
    license: '公有领域', transcription_confidence: 0.95, cap: 140,
  },
  meihua: {
    raw: 'meihua.json', title: '梅花易数', author: '邵雍（题）',
    edition: '网络通行整理本（观梅拆字数全集七卷）', publication_date: '宋（题）',
    source_url: 'http://vv55.cc/plus/view.php?aid=773', art: ['meihua'],
    license: '公有领域', transcription_confidence: 0.9, cap: 110,
  },
  zhouyi: {
    raw: 'zhouyi.json', title: '周易（周易注·王弼本）', author: '王弼注、韩康伯补注',
    edition: '识典古籍·四部丛刊景上海涵芬楼藏宋刊本', publication_date: '魏晋注、先秦经',
    source_url: 'https://www.shidianguji.com/book/SBCK001', art: ['liuyao', 'meihua'],
    license: '公有领域', transcription_confidence: 0.95, cap: 130,
  },
  'taiwei-fu': {
    raw: 'ziwei-doushu-quanshu.json', onlyChapters: ['太微赋第一', '增补太微赋第七'],
    title: '太微赋', author: '陈抟（题希夷先生）',
    edition: '古文岛·紫微斗数全书卷一所收', publication_date: '明刊本',
    source_url: 'https://www.guwendao.net/guwen/book_d3309a1684f4.aspx', art: ['ziwei'],
    license: '公有领域', transcription_confidence: 0.9, cap: 20,
  },
  'suidi-fu': {
    raw: 'ziwei-doushu-quanshu.json', onlyChapters: ['斗数骨随赋第九', '女命骨髓赋第十'],
    title: '斗数骨髓赋（附女命骨髓赋）', author: '陈抟（题希夷先生）',
    edition: '古文岛·紫微斗数全书卷一所收', publication_date: '明刊本',
    source_url: 'https://www.guwendao.net/guwen/book_d3309a1684f4.aspx', art: ['ziwei'],
    license: '公有领域', transcription_confidence: 0.9, cap: 35,
  },
  'ziwei-quanshu': {
    raw: 'ziwei-doushu-quanshu.json', title: '紫微斗数全书', author: '陈抟（题）、罗洪先 辑',
    edition: '古文岛·通行整理本', publication_date: '明',
    source_url: 'https://www.guwendao.net/guwen/book_d3309a1684f4.aspx', art: ['ziwei'],
    license: '公有领域', transcription_confidence: 0.9, cap: 90,
  },
  ditiansui: {
    raw: 'ditiansui.json', title: '滴天髓阐微', author: '京图 撰、任铁樵 注、袁树珊 增注',
    edition: '古文岛·海宁陈氏手抄秘本通行整理本', publication_date: '清道光（民国刊）',
    source_url: 'https://www.guwendao.net/guwen/book_74c064ea85bf.aspx', art: ['bazi'],
    license: '公有领域', transcription_confidence: 0.9, cap: 120,
    // 滴天髓正文为歌诀（A），任铁樵注疏段（B）
    verseIsOriginal: true,
  },
  yanbodiaosouge: {
    raw: 'yanbodiaosouge.json', title: '烟波钓叟歌', author: '赵普（题）',
    edition: '新浪星座频道摘录通行本', publication_date: '宋（题）',
    source_url: 'http://astro.sina.com.cn/z/2006-11-17/162933849.shtml', art: ['qimen'],
    license: '公有领域', transcription_confidence: 0.9, cap: 20,
  },
  yuanhaiziping: {
    raw: 'yuanhaiziping.json', title: '渊海子平', author: '徐子平（题）、徐升 编',
    edition: '古文岛·通行整理本', publication_date: '宋（明刊）',
    source_url: 'https://www.guwendao.net/guwen/book_fd1502b1700f.aspx', art: ['bazi'],
    license: '公有领域', transcription_confidence: 0.9, cap: 80,
  },
  'sanming-tonghui': {
    raw: 'sanming-tonghui.json', title: '三命通会（选录）', author: '万民英',
    edition: '古文岛·通行整理本（前130卷目）', publication_date: '明',
    source_url: 'https://www.guwendao.net/guwen/book_1fe1780cd61a.aspx', art: ['bazi'],
    license: '公有领域', transcription_confidence: 0.9, cap: 100,
  },
  'shenfeng-tongkao': {
    raw: 'shenfeng-tongkao.json', title: '神峰通考', author: '张楠（神峰子）',
    edition: '古文岛·通行整理本', publication_date: '明',
    source_url: 'https://www.guwendao.net/guwen/book_5a8f2653cd99.aspx', art: ['bazi'],
    license: '公有领域', transcription_confidence: 0.9, cap: 60,
  },
  yizhuan: {
    raw: 'yizhuan.json', title: '易传（十翼）', author: '孔子及后学（传）',
    edition: '古文岛·通行整理本', publication_date: '周（传）',
    source_url: 'https://www.guwendao.net/guwen/book_adb08001c74f.aspx', art: ['liuyao', 'meihua'],
    license: '公有领域', transcription_confidence: 0.9, cap: 100,
  },
  'liuren-daquan': {
    raw: 'liuren-daquan.json', title: '六壬大全（选录）', author: '不著撰人',
    edition: '识典古籍·四库全书本', publication_date: '明（四库收）',
    source_url: 'https://www.shidianguji.com/book/SK1599', art: ['liuren'],
    license: '公有领域', transcription_confidence: 0.95, cap: 100,
  },
  bianta: {
    raw: 'liuren-daquan.json', onlyChaptersMatch: /畢法賦|毕法赋/,
    title: '毕法赋（六壬毕法赋）', author: '凌福之',
    edition: '识典古籍·六壬大全所收（四库本）', publication_date: '宋',
    source_url: 'https://www.shidianguji.com/book/SK1599', art: ['liuren'],
    license: '公有领域', transcription_confidence: 0.95, cap: 40,
  },
  huangjince: {
    raw: 'bianshi.json', onlyChaptersMatch: /黃金|黄金|千金/,
    title: '黄金策（总断千金赋直解）', author: '刘基（题）、王洪绪 直解',
    edition: '识典古籍·卜筮正宗卷八所收', publication_date: '明（题）',
    source_url: 'https://www.shidianguji.com/book/HY1439', art: ['liuyao'],
    license: '公有领域', transcription_confidence: 0.95, cap: 30,
  },
};

/** 从 raw JSON 取章节数组 */
function loadChapters(meta) {
  const p = path.join(RAW, meta.raw);
  if (!fs.existsSync(p)) return null;
  const book = JSON.parse(fs.readFileSync(p, 'utf8'));
  let chapters = book.chapters.filter((c) => c.paras.length > 0);
  if (meta.onlyChapters) {
    chapters = chapters.filter((c) => meta.onlyChapters.includes(c.title));
  } else if (meta.onlyChaptersMatch) {
    chapters = chapters.filter((c) => meta.onlyChaptersMatch.test(c.title));
  }
  return chapters;
}

/** 判断段落是否近似歌诀诗体（滴天髓原文） */
const isVerse = (t) => {
  const clean = t.replace(/[，。、；？！]/g, '');
  if (t.length > 120) return false;
  // 5/7 言偶句为主
  const m = t.match(/[，。；]/g);
  return clean.length / (m ? m.length + 1 : 1) >= 4 && /^[^。]{4,30}[，][^。]{4,30}[。；]/.test(t) && (t.length % 2 === 0 || t.length <= 90);
};

/** 剔除版式噪声：页眉、章名重复行、单行“XX注”等 */
const isNoise = (t, chTitle, bookTitle) => {
  if (t.length > 20) return false;
  if (t === chTitle) return true;
  if (bookTitle && (t === bookTitle || (bookTitle.length > 2 && bookTitle.includes(t) && t.length > 2))) return true;
  if (/^[\u4e00-\u9fa5]{1,5}注$/.test(t)) return true;
  if (/^(卷|第)[之〇一二三四五六七八九十0-9]+$/.test(t)) return true;
  if (/^(目录|總目|总目|敘|叙|序)$/.test(t) && t.length <= 2) return true;
  return false;
};

/** 把一章的段落列表切分成 80–260 字段 */
function segmentChapter(paras, chTitle, bookTitle) {
  const out = [];
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t.length >= 40) out.push(t); // 允许少量 40–79 字收尾段
    buf = '';
  };
  for (const raw of paras) {
    let p = raw.replace(/\s+/g, '');
    if (!p) continue;
    if (isNoise(p, chTitle, bookTitle)) continue;
    // 超长段先按句切
    while (p.length > 260) {
      // 找 180–260 区间内最后一个句读
      let cut = -1;
      for (let i = Math.min(p.length - 1, 259); i >= 160; i--) {
        if ('。；？！'.includes(p[i])) { cut = i + 1; break; }
      }
      if (cut <= 0) cut = 200;
      out.push(p.slice(0, cut));
      p = p.slice(cut);
    }
    buf += p;
    if (buf.length >= 80) flush();
  }
  if (buf.trim()) {
    const tail = buf.trim();
    if (tail.length < 40 && out.length && out[out.length - 1].length + tail.length <= 260) {
      out[out.length - 1] += tail; // 尾段过短并入前段
    } else out.push(tail);
  }
  // 二次整形：>260 的合并段再切
  const shaped = [];
  for (const t of out) {
    if (t.length <= 260) { shaped.push(t); continue; }
    let p = t;
    while (p.length > 260) {
      let cut = -1;
      for (let i = Math.min(p.length - 1, 259); i >= 160; i--) {
        if ('。；？！'.includes(p[i])) { cut = i + 1; break; }
      }
      if (cut <= 0) cut = 200;
      shaped.push(p.slice(0, cut));
      p = p.slice(cut);
    }
    if (p.length >= 40) shaped.push(p);
    else if (shaped.length && shaped[shaped.length - 1].length + p.length <= 260) shaped[shaped.length - 1] += p;
    else shaped.push(p);
  }
  return shaped;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [];
  let totalSegs = 0;
  for (const [cid, meta] of Object.entries(BOOKS)) {
    const chapters = loadChapters(meta);
    if (!chapters || !chapters.length) {
      console.log(`SKIP ${cid}: 无可用章节`);
      continue;
    }
    const dir = path.join(OUT, cid);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [];
    let seqGlobal = 0;
    let chapNo = 0;
    for (const ch of chapters) {
      chapNo += 1;
      const segs = segmentChapter(ch.paras, ch.title, meta.title).filter((t) => t.length >= 40);
      const capped = segs.slice(0, Math.max(1, meta.cap));
      capped.forEach((text, i) => {
        seqGlobal += 1;
        // 分级：默认古籍原文 A；滴天髓诗诀为原文 A、注疏段 B
        let level = 'A';
        if (meta.verseIsOriginal && !isVerse(text)) level = 'B';
        const volMatch = (ch.page || ch.title || '').match(/卷[一二三四五六七八九十0-9]+/);
        lines.push({
          canonical_id: cid,
          title: meta.title,
          author: meta.author,
          edition: meta.edition,
          publication_date: meta.publication_date,
          source_url: meta.source_url,
          access_date: TODAY,
          license: meta.license,
          volume: volMatch ? volMatch[0] : '',
          chapter: ch.title,
          section: '',
          seq: seqGlobal,
          segId: `${cid}.${chapNo}.${i + 1}`,
          text,
          normalized_text: foldVariants(text).replace(/\s+/g, ''), // 异体归一+去空白
          charRange: [0, text.length],
          tags: meta.art,
          annotations: '',
          transcription_confidence: meta.transcription_confidence,
          isPublicDomain: true,
          confidence_level: level,
        });
      });
      if (seqGlobal >= meta.cap && meta.onlyChapters === undefined && meta.onlyChaptersMatch === undefined) break;
    }
    const jsonl = lines.map((o) => JSON.stringify(o)).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'corpus.jsonl'), jsonl, 'utf8');
    const segCount = lines.length;
    totalSegs += segCount;
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      canonical_id: cid, title: meta.title, author: meta.author,
      edition: meta.edition, publication_date: meta.publication_date,
      license: meta.license, art: meta.art, source_urls: [meta.source_url],
      segment_count: segCount, collected_at: TODAY,
      confidence: 'A',
    }, null, 2) + '\n', 'utf8');
    manifest.push({ canonical_id: cid, title: meta.title, art: meta.art, segment_count: segCount });
    console.log(`OK ${cid}: ${segCount} 段 / ${chapters.length} 章`);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    generated_at: TODAY, total_books: manifest.length, total_segments: totalSegs, books: manifest,
  }, null, 2) + '\n', 'utf8');
  console.log(`\n完成：${manifest.length} 本 / ${totalSegs} 段 → data/.kb/books/`);
}

main();
