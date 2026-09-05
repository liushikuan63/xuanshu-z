/** AI 严格解读护栏：系统提示词结构 / 输出校验（不合格拦截，避免混乱输出直接给用户） */
import { describe, it, expect } from 'vitest';
import { DEFAULT_AI, STRICT_SYSTEM, callAI, validateStrictReply } from '../packages/ai/src/index';

describe('AI 严格解读护栏', () => {
  it('默认关闭且缺少用户 API Key 时不会发起请求', async () => {
    expect(DEFAULT_AI.enabled).toBe(false);
    const result = await callAI({ ...DEFAULT_AI, enabled: true }, 'system', 'user');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('API Key');
  });
  it('系统提示词包含六段结构与禁编造条款', () => {
    for (const k of ['盘面事实', '解读推断', '立场结论', '原因依据', '应期建议', '未见依据', '延伸提醒', '不夸大', '不编造']) {
      expect(STRICT_SYSTEM).toContain(k);
    }
  });
  it('合格输出通过校验', () => {
    const good = '「盘面事实」体克用，用神旺相，妻财临月建。\n「解读推断」此卦主小吉，进展由自己主导。\n「立场结论」结论：吉，偏顺。\n「原因依据」体克用，五行流通。\n「应期建议」应期看用神冲合，盘面未给出则注明。\n「延伸提醒」传统文化研究仅供参考。';
    expect(validateStrictReply(good).ok).toBe(true);
  });
  it('混乱/缺段/短输出被拦下（避免把乱输出直接给用户）', () => {
    expect(validateStrictReply('We need strict format engine noise 动').ok).toBe(false);
    expect(validateStrictReply('「盘面事实」只有一句。').ok).toBe(false);
    expect(validateStrictReply('太短').ok).toBe(false);
    expect(validateStrictReply('').ok).toBe(false);
    // 大量英文混排（如把提示词原文回吐）应被拦下
    const chunk = 'abc def ghi jkl mno pqr stu vwx yz 12 34 56 78 90 ';
    const engish = '「盘面事实」' + chunk + chunk + chunk + chunk + '「解读推断」x 「立场结论」结论 ok 「原因依据」… 「应期建议」… 「延伸提醒」…';
    expect(validateStrictReply(engish).ok).toBe(false);
  });
});
