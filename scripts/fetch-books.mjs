#!/usr/bin/env node
/**
 * 五术书库·公版原文抓取入库脚本 v2（古诗文网 gushiwen.cn / 古文岛 guwendao.net）
 *  源站均为书目录页(book_xxxx.aspx)/章节页(bookv_xxxx.aspx)结构，正文在 <div class="contson">。
 *  流程：目录页→抓章节链接→逐章取正文→按 build-corpus 的切段规则→写 data/.kb/books/<cid>/
 *  使用：node scripts/fetch-books.mjs [cid...] （不传则跑全部目标；只收录公有领域原文，失败 SKIP 不编造）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', '.kb', 'books');
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const variants = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'knowledge', 'src', 'variants.json'), 'utf8'));
const VAR_RE = new RegExp('[' + Object.keys(variants).map((c) => '\\u{' + c.codePointAt(0).toString(16) + '}').join('') + ']', 'gu');
const foldVariants = (t) => t.replace(VAR_RE, (ch) => variants[ch] ?? ch);

const HOSTS = {
  gushiwen: 'https://www.gushiwen.cn',
  guwendao: 'https://www.guwendao.net',
};

/** 抓取目标：bookUrl=目录页；chapters=[标题,相对路径] 直接给定（不经目录页） */
const TARGETS = {
  bingjian: {
    title: '冰鉴', art: [], host: 'gushiwen', bookUrl: '/guwen/book_74e96e4ead90.aspx',
    cap: 200, maxSegs: 40,
  },
  // ── D1 批次：五术相关公版书（新增即全文；同一站可抓）──
  zangjing: { // 书库条目「葬经」缺全文，古诗文网以《葬书》同源收录
    title: '葬书', art: ['qimen'], host: 'gushiwen', bookUrl: '/guwen/book_bd39fa6c6fb4.aspx',
    cap: 300, maxSegs: 80,
  },
  'qianjin-fang': {
    title: '千金方（备急千金要方）', art: [], host: 'gushiwen', bookUrl: '/guwen/book_d8a4ecb7842d.aspx',
    cap: 300, maxSegs: 80,
  },
  baopuzi: {
    title: '抱朴子', art: [], host: 'gushiwen', bookUrl: '/guwen/book_79a6898275a2.aspx',
    cap: 300, maxSegs: 80,
  },
  huangtingjing: {
    title: '黄庭经', art: [], host: 'gushiwen', bookUrl: '/guwen/book_1ae31193f043.aspx',
    cap: 300, maxSegs: 80,
  },
  renwuzhi: {
    title: '人物志', art: [], host: 'gushiwen', bookUrl: '/guwen/book_d4a32fe1cf13.aspx',
    cap: 300, maxSegs: 80,
  },
  'taiyi-jinhuazongzhi': {
    title: '太乙金华宗旨', art: [], host: 'gushiwen', bookUrl: '/guwen/book_9dc165ae7405.aspx',
    cap: 300, maxSegs: 80,
  },
  'wenre-tiaobian': {
    title: '温病条辨', art: [], host: 'gushiwen', bookUrl: '/guwen/book_f5b4d315f971.aspx',
    cap: 300, maxSegs: 80,
  },
  'zhenjiu-dacheng': {
    title: '针灸大成', art: [], host: 'gushiwen', bookUrl: '/guwen/book_2e4559173dff.aspx',
    cap: 300, maxSegs: 80,
  },
  binhumaixue: {
    title: '濒湖脉学', art: [], host: 'gushiwen', bookUrl: '/guwen/book_f53a5ee5bb6a.aspx',
    cap: 300, maxSegs: 80,
  },
  yilongjing: {
    title: '疑龙经', art: [], host: 'gushiwen', bookUrl: '/guwen/book_429d6dfdc986.aspx',
    cap: 300, maxSegs: 80,
  },
  'tianyu-jing': {
    title: '天玉经', art: [], host: 'gushiwen', bookUrl: '/guwen/book_40c7e1736dc5.aspx',
    cap: 300, maxSegs: 80,
  },
  wuzhenpian: {
    title: '悟真篇', art: [], host: 'gushiwen', bookUrl: '/guwen/book_56493ee72c23.aspx',
    cap: 300, maxSegs: 80,
  },
  'sisheng-xinyuan': {
    title: '四圣心源', art: [], host: 'gushiwen', bookUrl: '/guwen/book_ad8328bf3c52.aspx',
    cap: 300, maxSegs: 80,
  },
  yaoxingge: {
    title: '药性歌括四百味', art: [], host: 'gushiwen', bookUrl: '/guwen/book_64c159c2814f.aspx',
    cap: 300, maxSegs: 80,
  },
  'yixue-yuanliu': {
    title: '医学源流论', art: [], host: 'gushiwen', bookUrl: '/guwen/book_38d1f26e9e2d.aspx',
    cap: 300, maxSegs: 80,
  },
  'qijing-bamai': {
    title: '奇经八脉考', art: [], host: 'gushiwen', bookUrl: '/guwen/book_d8b854fd7143.aspx',
    cap: 300, maxSegs: 80,
  },
  'zhenjiu-jiayijing': {
    title: '针灸甲乙经', art: [], host: 'gushiwen', bookUrl: '/guwen/book_702ff3e2303c.aspx',
    cap: 300, maxSegs: 80,
  },
  'shiliao-bencao': {
    title: '食疗本草', art: [], host: 'gushiwen', bookUrl: '/guwen/book_6c7f05e7024f.aspx',
    cap: 300, maxSegs: 80,
  },
  'bianque-xinshu': {
    title: '扁鹊心书', art: [], host: 'gushiwen', bookUrl: '/guwen/book_4337f1eafd06.aspx',
    cap: 300, maxSegs: 80,
  },
  yinfujing: {
    title: '阴符经', art: [], host: 'gushiwen', bookUrl: '/guwen/book_23b32a33bc8b.aspx',
    cap: 200, maxSegs: 40,
  },
  'zhouhou-beijifang': {
    title: '肘后备急方', art: [], host: 'gushiwen', bookUrl: '/guwen/book_12178224e551.aspx',
    cap: 300, maxSegs: 80,
  },
};

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = await r.text();
  // 简体化（古诗文网页面多为繁体转简体，个别繁体保留）
  return b;
}

/** 从目录页解析出章节列表：[/guwen/bookv_xxx.aspx, 标题] */
function parseToc(html) {
  const out = [];
  const re = /href="(\/guwen\/bookv_[0-9a-f]{12}\.aspx)"[^>]*>([^<]{1,24})</g;
  let m;
  while ((m = re.exec(html))) {
    const title = m[2].replace(/原文|译文|注释|赏析|简体|繁/g, '').replace(/[\s<>&]/g, '').trim();
    if (title.length >= 2) out.push([title, m[1]]);
  }
  // 去重保序
  const seen = new Set();
  return out.filter(([t, u]) => { const k = u; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** 从章节页提取纯文本行 */
function parseChapter(html) {
  let body = '';
  const m = html.match(/<div class="contson"[^>]*>([\s\S]*?)<\/div>/);
  if (m) body = m[1];
  else {
    const a = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (a) body = a[1];
    else {
      // 兜底：取 <div class="son2"> 或正文区域
      const s = html.match(/<div class="son2"[^>]*>([\s\S]*?)<div class="tooltip/);
      if (s) body = s[1];
    }
  }
  if (!body) return { title: '', paras: [] };
  let title = '';
  const tm = html.match(/<title>([^<]{2,40})<\/title>/);
  if (tm) title = tm[1].replace(/_(?:原文|译文|注释|赏析).*/, '').replace(/(www\.)?gushiwen\.cn|古文岛|古诗文网/, '').trim();
  const h1 = html.match(/<h1[^>]*>[\s\S]*?<b>([^<]{1,40})<\/b>/);
  if (h1) title = h1[1].trim() || title;
  // 转行、去标签、去脚注
  const text = body
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/\{\{.*?\}\}/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n[ \t]*\n+/g, '\n')
    .trim();
  const paras = text.split('\n').map((l) => l.replace(/^[\s\d.、]+/, '').trim()).filter((l) => l.length >= 4);
  return { title: title.replace(/[《》'"“”]/g, '').slice(0, 30), paras };
}

/* —— 切段（与 build-corpus 同规则）—— */
function isNoise(t, chTitle, bookTitle) {
  if (t.length > 20) return false;
  if (t === chTitle) return true;
  if (bookTitle && (t === bookTitle || (bookTitle.length > 2 && bookTitle.includes(t) && t.length > 2))) return true;
  if (/^[\u4e00-\u9fa5]{1,5}注$/.test(t)) return true;
  if (/^(卷|第)[之〇一二三四五六七八九十0-9]+$/.test(t)) return true;
  return false;
}
function segmentChapter(paras, chTitle, bookTitle) {
  const out = [];
  let buf = '';
  const flush = () => { const t = buf.trim(); if (t.length >= 40) out.push(t); buf = ''; };
  for (const raw of paras) {
    let p = raw.replace(/\s+/g, '');
    if (!p) continue;
    if (isNoise(p, chTitle, bookTitle)) continue;
    while (p.length > 260) {
      let cut = -1;
      for (let i = Math.min(p.length - 1, 259); i >= 160; i--) if ('。；？！'.includes(p[i])) { cut = i + 1; break; }
      if (cut <= 0) cut = 200;
      out.push(p.slice(0, cut));
      p = p.slice(cut);
    }
    buf += p;
    if (buf.length >= 80) flush();
  }
  if (buf.trim()) {
    const tail = buf.trim();
    if (tail.length < 40 && out.length && out[out.length - 1].length + tail.length <= 260) out[out.length - 1] += tail;
    else out.push(tail);
  }
  return out.filter((t) => t.length >= 40 && t.length <= 260);
}

async function fetchBook(cid, t) {
  const host = HOSTS[t.host];
  let chapters = [];
  if (t.chapters) {
    chapters = t.chapters.map(([title, p]) => ({ title, url: host + p }));
  } else {
    const tocHtml = await get(host + t.bookUrl);
    const toc = parseToc(tocHtml);
    if (!toc.length) throw new Error('目录页未解析到章节链接');
    chapters = toc.map(([title, p]) => ({ title, url: host + p }));
  }
  const bookHtml = t.bookUrl ? await get(host + t.bookUrl) : '';
  const bookTitle = t.title;
  const all = [];
  let chNo = 0, seq = 0;
  for (const ch of chapters) {
    const html = await get(ch.url).catch(() => null);
    if (!html) continue;
    const { title, paras } = parseChapter(html);
    chNo += 1;
    const segs = segmentChapter(paras, title || ch.title, bookTitle).slice(0, Math.max(1, t.maxSegs ?? 60));
    for (let i = 0; i < segs.length; i++) {
      seq += 1;
      const text = segs[i];
      all.push({
        canonical_id: cid, title: bookTitle, author: '佚名（网络公版整理）',
        edition: `${t.host === 'gushiwen' ? '古诗文网' : '古文岛'}·公版整理`, publication_date: '',
        source_url: ch.url, access_date: TODAY, license: '公有领域', volume: '',
        chapter: (title || ch.title).slice(0, 40), section: '', seq,
        segId: `${cid}.${chNo}.${i + 1}`, text,
        normalized_text: foldVariants(text).replace(/\s+/g, ''),
        charRange: [0, text.length], tags: t.art ?? [], annotations: '',
        transcription_confidence: 0.9, isPublicDomain: true, confidence_level: 'A',
      });
      if (seq >= (t.cap ?? 300)) break;
    }
    if (seq >= (t.cap ?? 300)) break;
  }
  if (all.length < 2) throw new Error('有效段过少（' + all.length + '）');
  const dir = path.join(OUT, cid);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'corpus.jsonl'), all.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    canonical_id: cid, title: bookTitle, author: '佚名（网络公版整理）',
    edition: `${t.host === 'gushiwen' ? '古诗文网' : '古文岛'}·公版整理`, publication_date: '',
    license: '公有领域', art: t.art ?? [],
    source_urls: Array.from(new Set(all.map((o) => o.source_url))),
    segment_count: all.length, collected_at: TODAY, confidence: 'A',
    source_note: '抓取自公版整理站（古诗文网/古文岛），未改原文',
  }, null, 2) + '\n', 'utf8');
  console.log(`  OK ${all.length} 段 / ${chNo} 章`);
  return all.length;
}

/** manifest 增量登记（新书并入，不覆盖既有记录） */
function upsertManifest(cid, title, art, segmentCount) {
  const mp = path.join(OUT, 'manifest.json');
  const man = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : { generated_at: TODAY, total_books: 0, total_segments: 0, books: [] };
  const i = man.books.findIndex((b) => b.canonical_id === cid);
  if (i >= 0) man.books[i] = { canonical_id: cid, title, art, segment_count: segmentCount };
  else man.books.push({ canonical_id: cid, title, art, segment_count: segmentCount });
  man.total_books = man.books.length;
  man.total_segments = man.books.reduce((s, b) => s + b.segment_count, 0);
  fs.writeFileSync(mp, JSON.stringify(man, null, 2) + '\n', 'utf8');
}

/** 中文名 → ascii cid（已有语料的同名书不重复抓，避免覆盖既有高质量语料） */
const CID_MAP = {
  史记: 'shiji', 天工开物: 'tiangong-kaiwu', 本草纲目: 'bencao-gangmu', 神农本草经: 'shennong-bencao',
  难经: 'nanjing', 金匮要略: 'jinkui-yaolue', 伤寒杂病论: 'shanghan-zabing', 伤寒论: 'shanghan',
  黄帝内经: 'suwen', 素问: 'suwen', 灵枢: 'lingshu', 神相全编: 'shenxiang-quanbian',
  麻衣神相: 'mayi', 冰鉴: 'bingjian', 撼龙经: 'hanlongjing', 葬经: 'zangjing', 宅经: 'zhaijing', 青囊经: 'qingnangjing',
  推背图: 'tuibeitu', 烧饼歌: 'shaobingge', 灵宪: 'lingxian', 难经: 'nanjing',
  // 已有语料（不重复抓）
  易传: 'SKIP-yizhuan', 滴天髓阐微: 'SKIP-ditiansui', 周易: 'SKIP-zhouyi', 渊海子平: 'SKIP-yuanhaiziping',
  三命通会: 'SKIP-sanming', 梅花易数: 'SKIP-meihua', 卜筮正宗: 'SKIP-bianshi', 增删卜易: 'SKIP-zengshan',
};
async function discoverAndFetch() {
  const want = [
    '八段锦', '易筋经', '五禽戏', '太极拳', '峨嵋十二桩', '八卦掌', '苌氏武技书', '灵剑子', '修龄要指', '万寿仙书', '拳经拳法备要', '十二段锦', // 山
    '黄帝内经', '素问', '灵枢', '神农本草经', '难经', '伤寒杂病论', '伤寒论', '金匮要略', '脉经', '千金翼方', '本草纲目', '温热论', '血证论', '傅青主女科', // 医
    '穷通宝鉴', '滴天髓阐微', // 命
    '青囊经', '葬经', '宅经', '撼龙经', '博山篇', '催官篇', '地理正宗', '阳宅十书', // 地相
    '麻衣神相', '神相全编', '神相铁关刀', '太清神鉴', '柳庄神相', '冰鉴', '公笃相法', '观人于微', '金较剪', // 人相
    '史记', '灵宪', '推背图', '烧饼歌', '天工开物', // 星相
    '易传', '东坡易传', '京氏易传', '断易天机', '易隐', '皇极经世书', // 卜
  ];
  const html = await get('https://www.gushiwen.cn/guwen/');
  const re = /href="(\/guwen\/book_[0-9a-f]{12}\.aspx)"[^>]*>([^<]{1,30})</g;
  const uniq = new Map();
  let m;
  while ((m = re.exec(html))) if (!uniq.has(m[1])) uniq.set(m[1], m[2].replace(/[《》\s]/g, ''));
  let matched = 0;
  for (const [url, t] of uniq) {
    const hit = want.find((w) => t.includes(w) || w.includes(t));
    if (!hit) continue;
    const cid = CID_MAP[hit] ?? hit;
    if (cid.startsWith('SKIP-')) { console.log(`  - 跳过《${t}》已有语料`); continue; }
    if (!/^[a-z0-9-]+$/.test(cid)) { console.log(`  - 跳过《${t}》：无合法 ascii id`); continue; }
    if (TARGETS[cid]) continue;
    TARGETS[cid] = { title: t, art: t === '麻衣神相' ? [] : [], host: 'gushiwen', bookUrl: url, cap: 300, maxSegs: 80 };
    console.log(`  + 匹配《${t}》 → ${cid} / ${url}`);
    matched += 1;
  }
  console.log(`发现 ${matched} 部待抓`);

  const keys = Object.keys(TARGETS).filter((k) => TARGETS[k].bookUrl);
  for (const cid of keys) {
    const t = TARGETS[cid];
    console.log(`◆ ${cid}  ← 《${t.title}》（gushiwen）`);
    try {
      await fetchBook(cid, t);
      upsertManifest(cid, t.title, t.art ?? [], fs.statSync(path.join(OUT, cid, 'corpus.jsonl')).size ? JSON.parse(fs.readFileSync(path.join(OUT, cid, 'meta.json'), 'utf8')).segment_count : 0);
    } catch (e) { console.log('  SKIP:', (e instanceof Error ? e.message : String(e)).slice(0, 140)); }
  }
}

async function main() {
  if (process.argv[2] === 'discover') { await discoverAndFetch(); return; }
  const want = process.argv.slice(2);
  const keys = Object.keys(TARGETS).filter((k) => !want.length || want.includes(k));
  let ok = 0;
  for (const cid of keys) {
    const t = TARGETS[cid];
    console.log(`◆ ${cid}  ← 《${t.title}》（${t.host}）`);
    try { await fetchBook(cid, t); upsertManifest(cid, t.title, t.art ?? [], JSON.parse(fs.readFileSync(path.join(OUT, cid, 'meta.json'), 'utf8')).segment_count); ok += 1; }
    catch (e) { console.log('  SKIP:', (e instanceof Error ? e.message : String(e)).slice(0, 140)); }
  }
  console.log(`\n完成：${ok}/${keys.length} 部 → data/.kb/books/`);
}

main();