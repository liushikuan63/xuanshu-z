/** ShuPlugin 契约 v5（§3.4）：纯函数排盘 + 规则命中 + 盘面 + 证据 + 事项引导 + 答复 + playbook */
import type {
  ArtType, RawInput, NormalizedMoment, ResolvedConfig, RuleHit, BoardSpec, Warning, CitationRef, CategoryId, ConfidenceLevel,
} from '../config/types';

export interface EngineCtx {
  normalized: NormalizedMoment;
  /** 引擎服务注入点（PlatformAdapter），core 内不使用 */
  now?: () => Date;
}

export interface TimingCandidate {
  ruleId: string;
  text: string;               // 如「戌日（冲辰）」
  window?: string;            // 如「1-3 日内」
  citations: CitationRef[];
  confidenceLevel: ConfidenceLevel;
}

export interface FactBundle {
  facts: Array<{ key: string; label: string; value: string }>;
}

export interface GuidanceBlock {
  ask: string[];              // 怎么问（正反例）
  cast: string;               // 怎么起
  tips: string[];             // 即时提示
}

export interface AnswerTemplate {
  id: string;
  category: string;
  sections: Array<{ id: string; title: string; from: 'composer' | 'core' | 'rules' | 'timing' | 'knowledge' | 'ai' | 'safety'; require?: string[]; fallback?: string }>;
  forbidden: string[];
  recordHint: string;
}

export interface ShuPlugin<I = RawInput, C = unknown> {
  id: string;
  name: string;
  art: ArtType;
  version: string;

  normalize(input: RawInput, ctx?: { hourMissing?: boolean }): NormalizedMoment;
  compute(input: I, cfg: ResolvedConfig): C;               // 纯函数：禁 Date.now/IO
  rules(chart: C, cfg: ResolvedConfig): RuleHit[];
  board(chart: C, cfg: ResolvedConfig): BoardSpec;
  evidence(chart: C, rules: RuleHit[]): CitationRef[];
  warnings(chart: C, cfg: ResolvedConfig): Warning[];

  intake: {
    categories: CategoryId[];
    presetFor(category: CategoryId): Partial<ResolvedConfig>;
    guidance(category: CategoryId): GuidanceBlock;
    keyFactors(category: CategoryId): string[];
  };
  answer: {
    templateFor(category: CategoryId): AnswerTemplate;
    timingRules(chart: C, cfg: ResolvedConfig): TimingCandidate[];
    extractFacts(chart: C, category: CategoryId): FactBundle;
  };
}

/** 引文便捷构造（canonicalId 见附录 H 典籍总索引） */
export function cite(canonicalId: string, book: string, chapter: string, segId: string, quote: string, confidenceLevel: ConfidenceLevel = 'A'): CitationRef {
  return { canonicalId, book, chapter, segId, quote, confidenceLevel, license: '公有领域' };
}

/** 引用校验：无原典出处的断语禁止编造引文（R11/R12） */
export function assertCitations(hit: RuleHit): void {
  if (!hit.citations || hit.citations.length === 0) {
    if (hit.confidenceLevel !== 'D' && hit.confidenceLevel !== 'E') {
      throw new Error(`[citation] 规则 ${hit.ruleId} 声称 ${hit.confidenceLevel} 级但无 citations`);
    }
  }
}

/** 插件注册表 */
const registry = new Map<ArtType, ShuPlugin>();

export function registerPlugin(p: ShuPlugin): void {
  if (registry.has(p.art)) throw new Error(`[plugin] art=${p.art} 重复注册`);
  registry.set(p.art, p);
}

export function getPlugin(art: ArtType): ShuPlugin {
  const p = registry.get(art);
  if (!p) throw new Error(`[plugin] 未注册的术数: ${art}`);
  return p;
}

export function allPlugins(): ShuPlugin[] {
  return [...registry.values()];
}
