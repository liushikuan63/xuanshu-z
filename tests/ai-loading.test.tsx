import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AIEnableDialog, AIResultModal, AiQuickBar, AnswerPanel } from '../packages/ui/src/components';
import { aiSettingsForStorage } from '../packages/ui/src/state';

const answer = {
  art: 'meihua',
  category: '决策',
  summary: '测试答复',
  safety: { sensitive: false, notice: '', referrals: [] },
  sections: [],
} as never;

describe('AI 长耗时等待反馈', () => {
  it('在统一快捷入口显示旋转状态与持续进度', () => {
    const html = renderToStaticMarkup(<AiQuickBar onAskAI={() => undefined} aiBusy />);
    expect(html).toContain('ai-spin');
    expect(html).toContain('ai-quick-progress');
    expect(html).toContain('AI 组织中');
  });

  it('在解读区域显示六爻动画和完整输出阶段', () => {
    const html = renderToStaticMarkup(<AnswerPanel answer={answer} onAskAI={() => undefined} aiBusy />);
    expect(html.match(/ai-oracle-line/g)).toHaveLength(6);
    expect(html).toContain('role="status"');
    expect(html).toContain('免费模型可能需要较长时间');
    expect(html).toContain('应期建议与延伸提醒');
  });

  it('同盘追问时保留原回答并显示追问动画', () => {
    const html = renderToStaticMarkup(
      <AIResultModal
        text="原回答仍然可见"
        question="测试问题"
        onClose={() => undefined}
        toastMsg={() => undefined}
        onAsk={() => undefined}
        askBusy
      />,
    );
    expect(html).toContain('原回答仍然可见');
    expect(html).toContain('AI 正在推演追问');
    expect(html).toContain('追问中');
  });

  it('未开启时显示保留当前结果的开启面板', () => {
    const baseAI = { enabled: false, providerId: 'openrouter', baseUrl: '', model: '', temperature: 0.3, anonymizeBoard: true };
    const fallbackHtml = renderToStaticMarkup(
      <AIEnableDialog open ai={baseAI} hasFallback onChange={() => undefined} onEnable={() => undefined} onClose={() => undefined} />,
    );
    expect(fallbackHtml).toContain('当前排盘和结果已保留');
    expect(fallbackHtml).toContain('可直接开启');
    expect(fallbackHtml).not.toContain('type="password"');

    const manualHtml = renderToStaticMarkup(
      <AIEnableDialog open ai={baseAI} hasFallback={false} onChange={() => undefined} onEnable={() => undefined} onClose={() => undefined} />,
    );
    expect(manualHtml).toContain('type="password"');
    expect(manualHtml).toContain('disabled=""');
  });

  it('持久化 AI 偏好时剔除内存 Key', () => {
    const stored = aiSettingsForStorage({
      enabled: true,
      providerId: 'openrouter',
      baseUrl: '',
      model: 'openrouter/free',
      temperature: 0.3,
      anonymizeBoard: true,
      keyInMemory: 'never-store-this',
    });
    expect(stored.enabled).toBe(true);
    expect(stored).not.toHaveProperty('keyInMemory');
    expect(JSON.stringify(stored)).not.toContain('never-store-this');
  });

  it('所有模型调用页面都接入统一开启入口', () => {
    const files = ['IntakeWizard.tsx', 'ProCast.tsx', 'CombinedView.tsx', 'Pages.tsx'];
    for (const file of files) {
      const source = readFileSync(new URL(`../packages/ui/src/${file}`, import.meta.url), 'utf8');
      expect(source, file).toContain('callAIStrict');
      expect(source, file).toContain('requestAISetup()');
      expect(source, file).toContain('aiBusy={aiBusy}');
    }
  });
});
