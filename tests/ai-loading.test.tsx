import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AIResultModal, AiQuickBar, AnswerPanel } from '../packages/ui/src/components';

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
});
