/** answer 答复装配（§0.4）：模板 + 计算事实 + 知识原文 + (可选)AI 四层；应期 ruleId 化；敏感拦截 */
import type { ArtType, CategoryId, RuleHit, CitationRef, ResolvedConfig, FactBundle, TimingCandidate } from '@xuanshu/core';
import { ART_NAMES } from '@xuanshu/core';
import type { Playbook } from '@xuanshu/intake';
import { playbookFor } from '@xuanshu/intake';

/** 敏感领域拦截（§10.5 / §13.1）：intake 阶段即拦截，给专业机构指引 */
const SENSITIVE: Partial<Record<CategoryId, { notice: string; referral: string[] }>> = {
  健康: { notice: '健康类问题：术数解释不构成医疗意见，不能替代就诊。', referral: ['如有不适请及时就医并遵医嘱', '心理困扰可拨打心理援助热线 12356'] },
  生育: { notice: '孕产类问题：请以妇产科医生意见为准。', referral: ['产检与用药遵医嘱'] },
  官非: { notice: '法律类问题：卦象不作为法律证据。', referral: ['重要事务请咨询执业律师', '劳动纠纷可申请劳动仲裁'] },
  求财: { notice: '财务类问题：不构成投资建议。', referral: ['重大决策请咨询持牌机构'] },
  决策: { notice: '', referral: [] },
};

export function safetyCheck(category: CategoryId): { sensitive: boolean; notice?: string; referrals: string[] } {
  const s = SENSITIVE[category];
  return { sensitive: !!s && !!s.notice, notice: s?.notice || undefined, referrals: s?.referral ?? [] };
}

export const DISCLAIMER = '本软件提供中国传统术数排盘、古籍检索与文化研究辅助。排盘结果由既定规则计算；解释不构成医疗、投资、法律、人生或行为的确定性预测。请自行理性判断并咨询有资质的专业人士。';

export interface AnswerSection {
  id: string; title: string;
  kind: 'conclusion' | 'facts' | 'signals' | 'timing' | 'evidence' | 'counter' | 'advice' | 'disclaimer' | 'playbook';
  content: string;
  citations?: CitationRef[];
  fallbackShown?: boolean;
}

export interface ComposedAnswer {
  art: ArtType;
  category: CategoryId;
  summary: string;
  sections: AnswerSection[];
  playbook?: Playbook;
  safety: { sensitive: boolean; notice?: string; referrals: string[] };
  aiEnabled: boolean;
}

export interface ComposeInput {
  art: ArtType;
  category: CategoryId;
  question: string;
  facts: FactBundle;
  rules: RuleHit[];
  timing: TimingCandidate[];
  knowledge: Array<{ citation: CitationRef; score: number }>;
  warnings?: Array<{ code: string; message: string }>;
}

/** AnswerComposer：四层装配，不靠模型自由发挥（D7） */
export function composeAnswer(input: ComposeInput): ComposedAnswer {
  const sections: AnswerSection[] = [];
  const pb = playbookFor(input.category, input.art);
  const safety = safetyCheck(input.category);

  // ① 结论层（模板组装，全部来自计算事实）
  const jis = input.rules.filter(r => r.level === '吉');
  const xiongs = input.rules.filter(r => r.level === '凶');
  const tendency = jis.length > xiongs.length + 1 ? '偏吉，可进取' : xiongs.length > jis.length + 1 ? '偏凶，宜谨慎保守' : '吉凶互见，进退有据';
  const yongFact = input.facts.facts.find(f => /用神|体用|命宫|四位|落宫|四柱|盘|四课/.test(f.label))?.value ?? '';
  sections.push({
    id: 'conclusion', title: '结论', kind: 'conclusion',
    content: `按「${ART_NAMES[input.art] ?? input.art}·${input.category}」的规则路径：整体${tendency}。关键事实：${yongFact || '见下'}`,
  });

  // ② 事实层（计算层）
  sections.push({
    id: 'facts', title: '依据（计算事实）', kind: 'facts',
    content: input.facts.facts.map(f => `${f.label}：${f.value}`).join('\n'),
  });

  // ③ 信号层（规则命中；出处以文字角标注，不暴露内部 ruleId）
  sections.push({
    id: 'signals', title: '关键信号（规则命中）', kind: 'signals',
    content: input.rules.map(r => {
      const c = r.citations?.[0];
      return `【${r.level}】${r.title}：${r.fact}${c ? `　〔${c.book}·${c.chapter}〕` : ''}`;
    }).join('\n'),
  });

  // ④ 应期层（无规则则明示）
  const hasTiming = input.timing.length > 0;
  sections.push({
    id: 'timing', title: '应期', kind: 'timing',
    content: hasTiming
      ? input.timing.map(t => {
        const c = t.citations?.[0];
        return `${t.text}${t.window ? `（${t.window}）` : ''}${c ? `　〔${c.book}·${c.chapter}〕` : ''}`;
      }).join('\n')
      : '暂无内置应期推法（不硬造）',
    fallbackShown: !hasTiming,
  });

  // ⑤ 证据层（知识层原文，BM25 命中带出处；无命中显式报缺口）
  const minHits = 1;
  const kn = input.knowledge.filter(k => k && k.citation && k.citation.book);
  if (kn.length >= minHits) {
    sections.push({
      id: 'evidence', title: '古籍依据', kind: 'evidence',
      content: kn.slice(0, 5).map(k => `〔${k.citation.confidenceLevel} 级·${k.citation.book}·${k.citation.chapter}〕${k.citation.quote}`).join('\n'),
      citations: kn.slice(0, 5).map(k => k.citation).filter(Boolean),
    });
  } else {
    sections.push({
      id: 'evidence', title: '古籍依据', kind: 'evidence',
      content: '此流派/术语暂无内置依据，请在书阁导入书库（缺口已记录）。', fallbackShown: true,
    });
  }

  // ⑥ 反证与注意（warnings + 规则中的变数）
  const counters = [
    ...(input.warnings ?? []).map(w => w.message),
    ...input.rules.filter(r => r.level === '变数').slice(0, 3).map(r => `${r.title}：${r.fact}`),
  ];
  sections.push({
    id: 'counter', title: '反证与注意', kind: 'counter',
    content: counters.length ? counters.join('\n') : '无特别反证；仍请避免过度依赖单一卦象。',
  });

  // ⑦ playbook（九段路径提示）
  if (pb) {
    sections.push({
      id: 'playbook', title: `断事路径卡：${pb.category}${pb.subCategory ? `（${pb.subCategory}）` : ''}`, kind: 'playbook',
      content: `为何主用${ART_NAMES[pb.arts.primary] ?? pb.arts.primary}：${pb.arts.whyPrimary}\n怎么问：${pb.howToAsk.goodExamples[0] ?? ''}\n怎么起：${pb.howToCast}\n读哪本书：${pb.readingList.map(r => `《${r.book}》${r.chapter}`).join('、')}\n禁用：${pb.forbidden.join('；')}`,
    });
  }

  // ⑧ 免责（always）
  sections.push({
    id: 'disclaimer', title: '免责声明', kind: 'disclaimer',
    content: [safety.notice, DISCLAIMER].filter(Boolean).join('\n') + (safety.referrals.length ? '\n指引：' + safety.referrals.join('；') : ''),
  });

  const summary = `${ART_NAMES[input.art] ?? input.art}·${input.category}：${tendency}`;
  return { art: input.art, category: input.category, summary, sections, playbook: pb, safety, aiEnabled: false };
}

/** AI 层提示工程（§10.2）：只在用户显式开启时调用；禁止自行推算；无证据即报缺口 */
export function buildAIPrompt(input: ComposeInput, chartJson: unknown): { system: string; user: string } {
  const system = [
    '你是玄枢引用助理。只根据提供的【结构化盘面 JSON】、【事项上下文】和【检索片段】输出；',
    '绝不自行推算四柱、干支、节气、世应、纳甲、三传、互变。若盘面 JSON 与引用冲突，以盘面 JSON 为准并在「证据不足」中说明。',
    '每条判断卡必须列出支持证据与反驳证据；无检索依据的论断写入 unsupportedClaims。',
    '答复必须遵循事项模板（结论→依据→关键信号→应期→反证→建议），不得跳步、不得泛化、不得给出医疗/投资/法律的确定性结论。',
    '引用纪律：你只能引用已提供的检索片段，并逐字复制其 quote 字段，附上 canonicalId 与 segId。不得凭记忆写出任何古籍原文。',
    '若片段不足以支撑论断，在 unsupportedClaims 中说明并留空 evidenceIds——这优于编造一条看似合理的引文。',
    '输出 JSON：{ cards: [{ type, text, evidenceIds, counterEvidence, confidence, timingCandidates, citationVerified }], unsupportedClaims: [] }',
  ].join('\n');
  const user = JSON.stringify({
    chart: chartJson,
    context: { category: input.category, question: input.question, keyFactors: input.facts.facts },
    rules: input.rules.map(r => ({ ruleId: r.ruleId, title: r.title, fact: r.fact, level: r.level })),
    timing: input.timing,
    evidence: input.knowledge.map(k => ({ canonicalId: k.citation.canonicalId, segId: k.citation.segId, quote: k.citation.quote, level: k.citation.confidenceLevel })),
  });
  return { system, user };
}

/** AI 判断卡 schema（§10.3） */
export interface JudgmentCard {
  claimId: string;
  type: '格局' | '旺衰' | '用神' | '卦象' | '应期' | '风险提示';
  text: string;
  evidenceRefs: CitationRef[];
  confidence: number;
  counterEvidence: string[];
  timingCandidates?: string[];
  confidenceLevel: 'E';
  citationVerified: boolean;
  needsHumanReview: boolean;
}

/** citationVerified：AI 引用的 quote 必须逐字出现在检索片段中（R11） */
export function verifyAICitations(cards: JudgmentCard, retrievedQuotes: Array<{ segId: string; quote: string }>): JudgmentCard {
  const ok = cards.evidenceRefs.every(ref => retrievedQuotes.some(q => q.segId === ref.segId && q.quote.includes(ref.quote.slice(0, 12))));
  return { ...cards, citationVerified: ok, needsHumanReview: !ok };
}

export { timingFrom } from './timing';
