# 玄枢知识库语料采集规范（给采集执行者）

## 目标
为玄枢占卜工作台采集**公有领域古籍全文**，产出结构化语料文件，供 BM25 检索、典籍查阅器、断语引用回链使用。目标总量 600–1200 段（段 = 80~260 字），覆盖下列书目。

## 输出位置与文件
```
data/.kb/books/<canonicalId>/corpus.jsonl   每行一个 JSON 对象（UTF-8，无 BOM）
data/.kb/books/<canonicalId>/meta.json      书籍元数据
data/.kb/books/manifest.json                全部书籍清单汇总
```

## corpus.jsonl 每行字段（全部必填，可空字符串）
```json
{
  "canonical_id": "zengshan",
  "title": "增删卜易",
  "author": "野鹤老人",
  "edition": "网络通行标点整理本（转录）",
  "publication_date": "清",
  "source_url": "https://...",
  "access_date": "2026-08-29",
  "license": "公有领域",
  "volume": "卷一",
  "chapter": "用神章",
  "section": "",
  "seq": 1,
  "segId": "zengshan.1.1",
  "text": "……",
  "normalized_text": "……（异体字归一 + 去空白后的文本）",
  "charRange": [0, 120],
  "tags": ["六爻"],
  "annotations": "",
  "transcription_confidence": 0.95,
  "isPublicDomain": true,
  "confidence_level": "A"
}
```
- `segId` = `<canonical_id>.<章序号>.<段序号>`，章序号按全书顺序 1..N，段序号在章内 1..M；**同一书内 segId 绝不重复**。
- `charRange` = [0, text.length]（JavaScript UTF-16 长度）。
- `segId` 推荐使用 `canonical_id.chapter.segment`；历史导入的全局唯一 `canonical_id.sequence` 可继续保留，新增语料不得再使用两段格式。
- 单段推荐 40–260 字；古籍短句、歌诀和韵文允许少于 40 字，但不得为空。超过 260 字应重新分段。
- `normalized_text` = text 先做异体字归一（packages/knowledge/src/variants.json：㐫→凶、𥁞→盡、𡈽→土…），再去除所有空白字符（含全角空格、换行）。原文 `text` 永不改动——罕见异体字是真实转录的特征，仅归一层与检索侧（opencc 繁→简）做归一；阅读器对异体字做悬浮正字提示。
- `text` 为简体（若来源是繁体，用 OpenCC 思路手工转简体有难度——**允许保留繁体**，normalized_text 同样保留繁体；title/edition 注明「繁体」）。
- `confidence_level`：古籍原文 A；古人注疏（如任铁樵注《滴天髓》）B；现代白话解释 C；现代人口诀/流派 D。**分段标注**：原文段 A、紧跟的注疏段 B。
- `transcription_confidence`：逐字复制 0.95+；手工重新打字 0.85；凭资料整理 0.7 以下并注明。
- 严禁编造原文。找不到就少收，宁缺毋滥；每段必须真实来自来源页面（或权威公开文本）。

## meta.json
```json
{
  "canonical_id": "zengshan", "title": "增删卜易", "author": "野鹤老人",
  "edition": "…", "publication_date": "清", "license": "公有领域",
  "art": ["liuyao"], "source_urls": ["…"], "segment_count": 0,
  "collected_at": "2026-08-29", "confidence": "A"
}
```
`art` 取值: bazi/liuyao/meihua/ziwei/qimen/liuren/xiaoliuren/jinkou/calendar。

## 书目清单（canonicalId → 书名 → 用途）。按优先级采集：
| 优先 | canonicalId | 书名 | art |
|---|---|---|---|
| P0 | zengshan | 增删卜易（野鹤老人） | liuyao |
| P0 | bianshi | 卜筮正宗（王洪绪） | liuyao |
| P0 | huangjince | 黄金策 | liuyao |
| P0 | meihua | 梅花易数 | meihua |
| P0 | zhouyi | 周易（卦辞爻辞） | liuyao/meihua |
| P0 | taiwei-fu | 太微赋 | ziwei |
| P0 | suidi-fu | 骨髓赋（斗数骨髓赋） | ziwei |
| P1 | ziwei-quanshu | 紫微斗数全书 | ziwei |
| P1 | ziwei-quanji | 紫微斗数全集 | ziwei |
| P1 | ditiansui | 滴天髓（含任铁樵注） | bazi |
| P1 | zipingzhenquan | 子平真诠 | bazi |
| P1 | yanbodiaosouge | 烟波钓叟歌 | qimen |
| P1 | bianta | 毕法赋（六壬） | liuren |
| P2 | ziwei-jielan | 紫微斗数捷览 | ziwei |
| P2 | liurenzhinan | 六壬指南 | liuren |
| P2 | yuanhaiziping | 渊海子平 | bazi |
| P2 | jijibianfang | 协纪辨方书（选录卷首/神煞） | calendar |

## 可用网络源（已实测连通性）
- ✅ https://so.gushiwen.cn （古诗文网·古籍，有周易等；搜索路径 /gw/.../ .aspx）
- ✅ https://www.zhouyi.cc （周易网，有六爻/梅花/紫微栏目）
- ✅ https://www.yuceweb.com
- ✅ https://www.guoxuemeng.com （国学梦，古籍多）
- ✅ https://baike.baidu.com （百科词条含原文节选）
- ✅ https://www.ruiwen.com 、 https://www.arteducation.com.tw
- ✅ https://sou-yun.cn （搜韵）
- ✅ https://cn.bing.com / https://m.baidu.com （搜索定位章节页面）
- ❌ wikisource/github/ctext 不通，不要浪费时间。
- 提示：curl 加 `-A "Mozilla/5.0"` 与 `--compressed`；HTML 用 sed/grep 去标签；注意站点可能是 GBK 编码（用 `iconv -f gbk -t utf-8`）。

## 质量与验收
1. 每个 corpus.jsonl 用 `node -e` 逐行 JSON.parse 校验。
2. segId 唯一、连续；chapter 字段不得为空（无卷章概念的短文用「全文」）。
3. 总段数 600–1200；每本书至少 8 段（短赋文除外，可为 1–5 段）。
4. manifest.json 汇总各书 segment_count。
5. 完成后运行 `node scripts/kb-lint.mjs`（若不存在则写一个：校验字段完整性/segId 唯一/字数区间）输出通过报告。
