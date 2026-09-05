/** 五术书库目录数据校验：类别数量 / id 唯一 / 术数合法 / 内置语料映射成对 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOK_CATALOG, WUSHU_CATEGORIES, catalogContainsCorpus, corpusIdOf, corpusStatusOf, booksOfCategory } from '../packages/knowledge/src/books';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 语料目录（data/.kb/books/*）：以磁盘真实目录为准，随新语料自动扩充
const CORPUS_IDS = new Set(
  fs.existsSync(path.join(ROOT, 'data/.kb/books'))
    ? fs.readdirSync(path.join(ROOT, 'data/.kb/books'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [],
);
const ARTS = ['bazi', 'ziwei', 'liuyao', 'meihua', 'qimen', 'liuren', 'xiaoliuren', 'jinkou'];

describe('五术书库目录', () => {
  it('五个类别齐全，且子类分组的书数总和等于总数', () => {
    expect(WUSHU_CATEGORIES).toEqual(['山', '医', '命', '相', '卜']);
    const sum = WUSHU_CATEGORIES.reduce((n, c) => n + booksOfCategory(c).length, 0);
    expect(sum).toBe(BOOK_CATALOG.length);
  });
  it('id 唯一、类别合法、必填字段齐全', () => {
    const ids = BOOK_CATALOG.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BOOK_CATALOG) {
      expect(b.title).toBeTruthy();
      expect(WUSHU_CATEGORIES).toContain(b.category);
      expect(b.sub).toBeTruthy();
      expect(b.note).toBeTruthy();
      for (const a of (b.art ?? [])) expect(ARTS).toContain(a);
    }
  });
  it('用户清单分类数量至少覆盖：山12 医12 命14 相23 卜11', () => {
    const n = (c: string) => booksOfCategory(c as never).length;
    expect(n('山')).toBeGreaterThanOrEqual(12);
    expect(n('医')).toBeGreaterThanOrEqual(12);
    expect(n('命')).toBeGreaterThanOrEqual(14);
    expect(n('相')).toBeGreaterThanOrEqual(23);
    expect(n('卜')).toBeGreaterThanOrEqual(11);
  });
  it('用户点名书目全部收录', () => {
    const titles = BOOK_CATALOG.map(b => b.title).join('|');
    for (const k of ['渊海子平', '三命通会', '滴天髓', '穷通宝鉴', '斗数骨髓赋', '女命骨髓赋', '星学大成',
      '卜筮正宗', '增删卜易', '黄金策', '梅花易数', '皇极经世书', '易传', '东坡易传',
      '素问', '灵枢', '伤寒杂病论', '本草纲目', '八段锦', '易筋经', '五禽戏',
      '青囊经', '葬经', '麻衣神相', '冰鉴', '推背图']) {
      expect(titles).toContain(k);
    }
  });
  it('所有标记为可读正文或相关原典的书都能对到语料目录', () => {
    for (const b of BOOK_CATALOG) {
      if (b.hasCorpus) expect(CORPUS_IDS.has(corpusIdOf(b))).toBe(true);
    }
  });
  it('异名或相关原典语料已由目录覆盖，不会作为额外书目重复展示', () => {
    for (const id of ['taijiquan-lun', 'yangsheng-yanminglu', 'xiuling-yaozhi']) {
      expect(catalogContainsCorpus(id), id).toBe(true);
    }
  });
  it('书目状态、正文能力和核验来源保持一致', () => {
    for (const b of BOOK_CATALOG) {
      const status = corpusStatusOf(b);
      expect(['full', 'related'].includes(status)).toBe(b.hasCorpus);
      for (const source of b.sources ?? []) expect(source.url).toMatch(/^https:\/\//);
      if (!b.hasCorpus) expect(b.sourceNote, b.title).toBeTruthy();
    }
    expect(BOOK_CATALOG.find(b => b.id === 'guanyin-jingyan')?.title).toBe('观命经验谈');
    expect(BOOK_CATALOG.find(b => b.id === 'dili-zhengzong')?.title).toBe('地理大成');
    expect(BOOK_CATALOG.find(b => b.id === 'guanren-yuwei')?.corpusStatus).toBe('restricted');
  });
  it('浏览器采集的古籍语料不包含网页导航和版权页脚', () => {
    const forbidden = /资助|创建账号|此页面最后编辑|Cookie声明|在全世界都属于公有领域/;
    for (const id of ['changshi-wuji', 'taijiquan-lun', 'yangsheng-yanminglu']) {
      const corpus = fs.readFileSync(path.join(ROOT, 'data/.kb/books', id, 'corpus.jsonl'), 'utf8');
      expect(corpus, id).not.toMatch(forbidden);
    }
  });
});
