/** 异体字/旧字形归一 + 检索侧繁简归一。
 *
 * 目的：古籍转录（真实 OCR/影印转录特征）含有大量罕见异体字——
 * 㐫(凶)、𥁞(盡)、𡈽(土)、䘮(喪)、㸃(點)、髙(高)、淂(得)…
 * 这些字会让「检索不到」「normalized_text 对不上」甚至分词直接丢字。
 * 约定：
 *  - `text` 字段永远保留原文（文献忠实，不改动来源转录）；
 *  - `normalized_text` = foldVariants(text) 再去空白（异体→通行正字，仍为繁体）；
 *  - 检索（分词/查询/exactMatch）再叠加 opencc 繁→简，使「妻财」命中「妻財」。
 */
import VARIANT_MAP from './variants.json';

/** 异体字 → 通行正字（繁体）映射表（opencc 未覆盖的旧字形/异体/兼容字） */
export const VARIANTS: Record<string, string> = VARIANT_MAP;

/** 含异体字的字符集合（阅读器用于渲染提示） */
export const VARIANT_CHARS: string[] = Object.keys(VARIANTS);

const VAR_RE = new RegExp(`[${VARIANT_CHARS.map(c => escapeRe(c)).join('')}]`, 'gu');

function escapeRe(s: string): string {
  return [...s].map(ch => '\\u{' + ch.codePointAt(0)!.toString(16) + '}').join('');
}

type T2S = (s: string) => string;
let t2sFn: T2S | null = null;
let t2sTried = false;

/** 懒加载 opencc 繁→简（包缺失时静默降级为恒等，仅损失繁简归一） */
async function ensureT2S(): Promise<T2S | null> {
  if (t2sTried) return t2sFn;
  t2sTried = true;
  try {
    const mod: any = await import('opencc-js');
    const factory = mod.Converter ?? mod.default?.Converter;
    if (factory) t2sFn = factory({ from: 't', to: 'cn' }) as T2S;
  } catch {
    t2sFn = null;
  }
  return t2sFn;
}

// 启动即预热（不阻塞索引构建——buildIndex 是同步的，首次分词前 opencc 可能未就绪）
let t2sReady: Promise<T2S | null> | null = null;
export function preloadFold(): Promise<T2S | null> {
  t2sReady ??= ensureT2S();
  return t2sReady;
}

/** 异体字归一：罕见变体 → 通行正字（保持繁体，供 normalized_text 与检索共同使用） */
export function foldVariants(text: string): string {
  return text.replace(VAR_RE, ch => VARIANTS[ch] ?? ch);
}

/** 检索归一：异体字归一 + 繁→简（若 opencc 尚未加载完成，则仅做异体归一） */
export function foldForSearch(text: string): string {
  const base = foldVariants(text);
  return t2sFn ? t2sFn(base) : base;
}

/** 模块加载后尽快预热转换器（buildIndex 前 UI 通常有一帧时间） */
export function warmupSearchFold(): void {
  void preloadFold();
}
