/** 首启引导浮层（D3a）：首次进入 4 步认识玄枢，一次协议不再打扰 */
import React, { useState } from 'react';

const STEPS = [
  {
    icon: '✦',
    title: '起一卦 · 排一盘',
    desc: '从「起卦」进入：选事项 → 细化问法 → 选术数（八字/六爻/梅花/紫微/奇门/大六壬/小六壬/金口诀）→ 自动排盘出断语。',
    tip: '八术共用一套起盘流程，一次输入、多术可参。',
  },
  {
    icon: '🎂',
    title: '预设个人生辰 · 私人定制',
    desc: '若知道自己的生辰（日期+时辰+性别，出生地可选），建议先到「设置 → 预设个人生辰」填一次：每日运势、万年历推荐、八字与紫微排盘默认值都会自动带上你的八字底色。',
    tip: '选填信息，随时可改；不填则使用当前时刻排盘。',
  },
  {
    icon: '◎',
    title: '合参多术 · 追问 AI',
    desc: '「合参」同时跑多术：跨术共识应期（投票归并）、术语点读白话、AI 严格六段解读与同盘追问都在这里。',
    tip: '同一问题多术互证，窗口重叠处最值得信。',
  },
  {
    icon: '📖',
    title: '书阁精读 · 记录归档',
    desc: '「书阁」可精读几十部已内置公版典籍（周易、渊海子平、黄帝内经……）；「记录本」自动归档每次排盘，可回看、导出结册长图。',
    tip: '术语弹窗会直接推送相关典籍，边学边查。',
  },
];

/** 首启引导：localStorage 记住状态，仅首次完整展示 */
export function WelcomeGuide({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-label="首次使用引导">
      <div className="guide-card">
        <div className="guide-head">
          <div className="guide-logo">玄枢</div>
          <div className="guide-sub">八术综合工作台 · 首次使用</div>
        </div>
        <div className="guide-dots">
          {STEPS.map((_, i) => <span key={i} className={`dot${i === step ? ' on' : ''}`} />)}
        </div>
        <div className="guide-body" key={step}>
          <div className="guide-icon">{s.icon}</div>
          <h3>{s.title}</h3>
          <p>{s.desc}</p>
          <div className="guide-tip">💡 {s.tip}</div>
        </div>
        <div className="guide-actions">
          {!last && <button className="btn" onClick={onDone}>跳过引导</button>}
          <button
            className="btn primary"
            onClick={() => (last ? onDone() : setStep(i => i + 1))}
          >
            {last ? '开始使用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 读取是否已看过引导 */
export function hasSeenWelcome(): boolean {
  try { return localStorage.getItem('xuanshu.welcome.v1') === '1'; } catch { return true; }
}
/** 标记已看过引导 */
export function markWelcomeSeen() {
  try { localStorage.setItem('xuanshu.welcome.v1', '1'); } catch { /* ignore */ }
}