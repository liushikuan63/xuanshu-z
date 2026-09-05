/** 语料加载：按典籍拆分为异步构建块，保持离线可用且不阻塞应用入口下载。 */
import type { KBDocument } from '@xuanshu/knowledge';

const files = import.meta.glob<string>('../../../data/.kb/books/*/corpus.jsonl', { query: '?raw', import: 'default' });

function parseCorpus(path: string, raw: string): KBDocument[] {
  const docs: KBDocument[] = [];
  const canonicalId = path.match(/books\/([^/]+)\/corpus\.jsonl/)?.[1] ?? 'unknown';
  for (const line of raw.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    try {
      const item = JSON.parse(text);
      docs.push({
        docId: `${item.canonical_id ?? canonicalId}.${item.segId}`,
        canonicalId: item.canonical_id ?? canonicalId,
        book: item.title ?? canonicalId,
        chapter: item.chapter ?? '全文',
        section: item.section ?? '',
        segId: item.segId ?? `${canonicalId}.1.1`,
        volume: item.volume ?? '',
        text: item.text ?? '',
        confidenceLevel: (item.confidence_level ?? 'A') as KBDocument['confidenceLevel'],
        license: item.license ?? '公有领域',
        sourceUrl: item.source_url,
        tags: item.tags ?? [],
      });
    } catch { /* 单条损坏不影响其余离线语料 */ }
  }
  return docs;
}

export async function loadCorpus(): Promise<KBDocument[]> {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  const books = await Promise.all(entries.map(async ([path, load]) => parseCorpus(path, await load())));
  return books.flat();
}
