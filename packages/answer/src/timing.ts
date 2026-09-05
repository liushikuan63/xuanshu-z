/** 应期规则聚合（answer/timing，ruleId 化） */
import type { TimingCandidate } from '@xuanshu/core';

export function timingFrom(candidates: TimingCandidate[]): TimingCandidate[] {
  return candidates.filter(t => t.ruleId && t.text);
}
