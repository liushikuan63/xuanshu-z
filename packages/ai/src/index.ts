/** ai 精解模块（§10）：ProviderRegistry（用户自带 Key，默认关闭）+ 审计 + 密钥边界 */
export interface AIProvider {
  id: string; displayName: string;
  baseUrlTemplate: string;
  docsUrl?: string; pricingUrl?: string;
  note?: string;
}

export const PROVIDERS: AIProvider[] = [
  { id: 'deepseek', displayName: 'DeepSeek', baseUrlTemplate: 'https://api.deepseek.com/chat/completions', docsUrl: 'https://api-docs.deepseek.com' },
  { id: 'openrouter', displayName: 'OpenRouter', baseUrlTemplate: 'https://openrouter.ai/api/v1/chat/completions', docsUrl: 'https://openrouter.ai/docs', note: '官方免费路由模型：openrouter/free（免费用）或 openrouter/auto（自动含付费档）；也可填任意模型 ID' },
  { id: 'doubao', displayName: '火山方舟 Doubao', baseUrlTemplate: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' },
  { id: 'glm', displayName: '智谱 GLM', baseUrlTemplate: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  { id: 'moonshot', displayName: 'Kimi / Moonshot', baseUrlTemplate: 'https://api.moonshot.cn/v1/chat/completions' },
  { id: 'hunyuan', displayName: '腾讯混元', baseUrlTemplate: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions' },
  { id: 'qwen', displayName: '通义千问 DashScope', baseUrlTemplate: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  { id: 'custom', displayName: '自定义（Ollama/vLLM/网关）', baseUrlTemplate: '' },
];

export interface AISettings {
  enabled: boolean;                 // 默认关闭
  providerId: string;
  baseUrl: string;
  model: string;
  /** Key 仅存当前页面内存，刷新或退出应用后清除。 */
  keyInMemory?: string;
  temperature: number;
  anonymizeBoard: boolean;          // 匿名化盘面（只保留抽象结构）
}

export const DEFAULT_AI: AISettings = { enabled: false, providerId: 'openrouter', baseUrl: '', model: '', temperature: 0.3, anonymizeBoard: true };

export interface AuditLog {
  time: string; provider: string; model: string;
  inputHash: string; outputHash: string;
  latencyMs: number; tokens?: number; schemaVersion: number;
}

/** 结构化输出修复（§10.3）：JSON tool schema + 严格正则修复，attempt ≤ 2，失败降级 */
export function repairJSON(text: string): { ok: boolean; data?: unknown } {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const cleaned = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
      return { ok: true, data: JSON.parse(cleaned) };
    } catch {
      // 尝试截取首个 { ... } 块
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { text = m[0]; continue; }
      return { ok: false };
    }
  }
  return { ok: false };
}

/** 各提供商默认模型（未填写模型名时兜底；不包含任何访问凭据）。 */
export const DEFAULT_MODEL: Record<string, string> = { openrouter: 'openrouter/free', deepseek: 'deepseek-chat' };

/** 调用主入口（Web 壳直连，受 CORS 限制；桌面壳走主进程代理） */
export async function callAI(settings: AISettings, system: string, user: string): Promise<{ ok: boolean; text?: string; error?: string; audit?: AuditLog }> {
  if (!settings.enabled) return { ok: false, error: 'AI 辅助解读未开启' };
  const key = settings.keyInMemory?.trim();
  if (!key) return { ok: false, error: '请先在设置中输入 API Key（仅保存在当前页面内存）' };
  const model = settings.model.trim() || DEFAULT_MODEL[settings.providerId] || '';
  if (!model) return { ok: false, error: '请先填写模型名称' };
  const baseUrl = settings.baseUrl || PROVIDERS.find(p => p.id === settings.providerId)?.baseUrlTemplate;
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) return { ok: false, error: 'baseUrl 非法' };
  const t0 = Date.now();
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: settings.temperature,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
      }),
    });
    if (!res.ok) return { ok: false, error: `AI 请求失败：${res.status} ${await res.text().catch(() => '')}`.slice(0, 300) };
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
    const text = data.choices?.[0]?.message?.content ?? '';
    const enc = new TextEncoder();
    const h = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    return {
      ok: true, text,
      audit: {
        time: new Date().toISOString(), provider: settings.providerId, model,
        inputHash: await h(system + user), outputHash: await h(text),
        latencyMs: Date.now() - t0, tokens: data.usage?.total_tokens, schemaVersion: 1,
      },
    };
  } catch (e) {
    return { ok: false, error: `网络错误：${(e as Error).message}` };
  }
}

/** 隐私提示（§10.4） */
export const PRIVACY_NOTE = 'AI 请求将把盘面结构与相关检索片段发送给你配置的提供商，按其自身政策处理；玄枢不承诺端到端零留存。API Key 只保存在当前页面内存，刷新或退出应用后清除。';

/** 解读系统提示词（严格结构）：客观、白话、分“盘面事实/解读推断”，限制幻觉与夸张 */
export const STRICT_SYSTEM = [
  '你是资深传统命理/占卜研究者，性格平实客观，不夸大、不恐吓、不编造。',
  '请始终用简体中文输出，逐条给出用户盘面数据中的结论；对数据里没有的信息，明确写「未见依据（盘面未给出）」，绝不虚构具体年份、金额、人名等细节。',
  '输出必须使用以下固定结构，按顺序完整呈现六个小节，每节用「」括起的标题开头：',
  '「盘面事实」：只复述用户提供的盘面数据（卦象/宫位/爻位/十神/星曜/规则断语等），原样引用，不做解释。',
  '「解读推断」：对照“盘面事实”给出你的白话解读，明确标注这是研究者经验延伸。',
  '「立场结论」：一句话先给结论（吉/凶/平/有反复），紧扣数据。',
  '「原因依据」：从“盘面事实”里挑 2-3 条作为支持，逐条说为什么。',
  '「应期建议」：说明可能的时间窗口（须来自盘面的应期规则，没有就写“盘面未给出应期”），再给 1 条安全、可执行、合乎常理的行动建议。',
  '「延伸提醒」：传统文化研究仅供参考，涉医疗/投资/法律等请以专业人士意见为准。',
  '禁止：堆砌纷乱术语；输出英文混排；自创结论；在任何小节里遗漏上述结构。若盘面数据本身不足，直说不足。',
].join('\n');

/** 校验 AI 输出是否符合严格结构：必须含“盘面事实”与“解读推断”两节、长度达标、无明显英文混乱 */
export function validateStrictReply(text: string): { ok: boolean; reason?: string } {
  const t = text ?? '';
  if (t.length < 60) return { ok: false, reason: '过短' };
  if (!t.includes('盘面事实')) return { ok: false, reason: '缺少「盘面事实」' };
  if (!t.includes('解读推断')) return { ok: false, reason: '缺少「解读推断」' };
  if (!t.includes('结论')) return { ok: false, reason: '缺少「立场结论」' };
  // 中英文比例检查：英文字符数超过汉字即视为“英文混排/提示词回吐”（简单英文卦名等少量术语不影响）
  const han = (t.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const ascii = (t.match(/[A-Za-z0-9]{3,}/g) ?? []).join('').length;
  if (han === 0 || ascii > han) return { ok: false, reason: '英文混排或非中文内容' };
  return { ok: true };
}

/** 严格解读调用：不合格自动重问一次；仍不合格则原样带回并标记 strictFailed（不直接判错） */
export async function callAIStrict(
  settings: AISettings, user: string,
  opts?: { extraSystem?: string },
): Promise<{ ok: boolean; text?: string; error?: string; strictFailed?: boolean; audit?: AuditLog }> {
  let system = STRICT_SYSTEM;
  if (opts?.extraSystem) system += '\n' + opts.extraSystem;
  const first = await callAI(settings, system, user);
  if (!first.ok) return first;
  const v1 = validateStrictReply(first.text ?? '');
  if (v1.ok) return first;
  const second = await callAI(settings, system + '\n注意：上一轮输出'+v1.reason+'，结构不合格。请严格按六个小节完整重写，不得省略、不得解释结构、不得输出任何多余开头语。', user);
  if (!second.ok) return second;
  const v2 = validateStrictReply(second.text ?? '');
  if (v2.ok) return second;
  return { ok: true, text: '（AI 输出未完全符合六段结构，已按原文呈现，请自行甄别）\n' + (second.text ?? ''), strictFailed: true, audit: second.audit };
}
