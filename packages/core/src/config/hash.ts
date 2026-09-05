/**
 * configHash 确定性底座（§3.5，D27）
 * configHash = stableHash(canonicalize(ResolvedConfig))
 * canonicalize：递归字典序排序 key + 固定序列化，保证同配置不同输入顺序得到同一 hash。
 * 禁止用 JSON.stringify 默认顺序（遍历顺序不确定）。
 */

/** 递归字典序规范化：排序对象 key，数组保序，undefined/null 统一为 null */
export function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) out[k] = canonicalize((value as Record<string, unknown>)[k]);
    return out;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return Number.isInteger(value) ? value : Number(value.toFixed(10));
  }
  return value;
}

/** 稳定序列化（与 canonicalize 配套） */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** FNV-1a 双通道 64 位 hash，输出 16 位 hex（同步、跨壳一致、无 Node 依赖） */
export function fnv1a64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    // 第二通道用反序混合，降低双 lane 相关性
    h2 ^= (code + i) & 0xff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
  );
}

export function stableHash(value: unknown): string {
  return fnv1a64(stableStringify(value));
}

/** 引擎版本（历法内核 / 各 art 包版本；升级后旧记录保留旧值，绝不批量改写） */
export const ENGINE_VERSION = 'xuanshu-core@1.0.0';
