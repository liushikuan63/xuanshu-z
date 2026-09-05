/** App 壳：侧栏导航 + hash 路由（三壳一致） */
import React, { useState } from 'react';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useRouter } from './router';
import { IntakeWizard } from './IntakeWizard';
import { ReaderView } from './ReaderView';
import { LedgerView } from './LedgerView';
import { HomeView, PlaybookView, StatsView, SettingsView, CaseBoardView } from './Pages';
import { ProCast } from './ProCast';
import { CombinedView } from './CombinedView';
import { HehunView } from './HehunView';
import { CalendarView } from './CalendarView';
import { XingZuoView } from './XingZuoView';
import { WelcomeGuide, hasSeenWelcome, markWelcomeSeen } from './WelcomeGuide';
import { AIEnableDialog } from './components';
import { useApp } from './state';
import { ART_LIST, CATEGORIES, type ArtType, type CategoryId } from '@xuanshu/core';
import { hasEmbeddedAIFallback } from '@xuanshu/ai';
import './styles.css';

const Icon = ({ d }: { d: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const NAV = [
  { key: 'home', label: '首页', icon: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z' },
  { key: 'cast', label: '起卦', icon: 'M12 3v18M3 12h18M7 7l10 10M17 7L7 17' },
  { key: 'combine', label: '合参', icon: 'M3 7v10M9 7v10M15 7v10M21 7v10' },
  { key: 'ledger', label: '记录本', icon: 'M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM8 4v16M16 9h-5M16 13h-5' },
  { key: 'read', label: '书阁', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM8 7h8M8 11h6' },
  { key: 'playbook', label: '路径卡', icon: 'M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { key: 'stats', label: '校准', icon: 'M18 20V10M12 20V4M6 20v-6' },
  { key: 'calendar', label: '万年历', icon: 'M7 2v3M17 2v3M3 8h18M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8M9 14h2M13 14h2' },
  { key: 'settings', label: '设置', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

const validArt = (value: string | null): ArtType | undefined =>
  value && ART_LIST.includes(value as ArtType) ? value as ArtType : undefined;
const validCategory = (value: string | null): CategoryId | undefined =>
  value && CATEGORIES.includes(value as CategoryId) ? value as CategoryId : undefined;
const validGender = (value: string | null): '男' | '女' | undefined =>
  value === '男' || value === '女' ? value : undefined;

/** 顶层错误边界：任何视图崩溃给出可读信息而不是白屏（可用性） */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null; stack: string | null }> {
  state = { err: null as Error | null, stack: null as string | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error, info: ErrorInfo) { this.setState({ stack: info.componentStack ?? null }); console.error('[xuanshu] render crash:', err, info.componentStack); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 40 }}>
          <h2>视图渲染出错</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#a63f36' }}>{String(this.state.err.stack || this.state.err.message)}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#666', fontSize: 12 }}>{this.state.stack}</pre>
          <a className="btn primary" href="#/home">返回首页</a>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [route, nav] = useRouter();
  const { ai, setAI, aiSetupOpen, closeAISetup } = useApp();
  // 左侧菜单折叠（桌面端）：收起后仅剩图标，给主区更多空间
  const [collapsed, setCollapsed] = useState(false);
  // 首启引导：首次进入展示，点击“开始使用/跳过”后记录并关闭
  const [welcome, setWelcome] = useState<boolean>(() => !hasSeenWelcome());
  const closeWelcome = () => { markWelcomeSeen(); setWelcome(false); };
  const active = NAV.find(n => route.parts[0] === n.key)?.key ?? 'home';

  let content: React.ReactNode;
  switch (route.parts[0]) {
    case 'pro': content = <ProCast key={route.query.get('art') ?? 'default'} initialArt={validArt(route.query.get('art'))} />; break;
    case 'cast': {
      // 支持合参页带参直达：t=YYYY-MM-DDTHH:mm & g=性别 & q=问题 & art & cat
      let initialTime: { year: number; month: number; day: number; hour: number; minute: number } | undefined;
      const t = route.query.get('t');
      if (t && t.includes('-')) {
        const [d, hm] = t.split('T');
        const [y, m, dd] = d.split('-').map(Number);
        if (y && y > 1900) {
          const [h, mi] = (hm ?? '12:00').split(':').map(Number);
          initialTime = { year: y, month: m, day: dd, hour: Number.isNaN(h) ? 12 : h, minute: Number.isNaN(mi) ? 0 : mi };
        }
      }
      content = (
        <IntakeWizard
          key={`${route.query.get('art') ?? 'default'}-${route.query.get('cat') ?? 'default'}-${route.query.get('t') ?? ''}`}
          initialCategory={validCategory(route.query.get('cat'))}
          initialArt={validArt(route.query.get('art'))}
          initialTime={initialTime}
          initialGender={validGender(route.query.get('g'))}
          initialQuestion={route.query.get('q') ?? undefined}
        />
      );
      break;
    }
    case 'combine': content = <CombinedView />; break;
    case 'read': content = <ReaderView initialCanonical={route.parts[1]} />; break;
    case 'ledger': content = <LedgerView focusCaseId={route.query.get('focus') ?? undefined} />; break;
    case 'case-board': content = <CaseBoardView caseId={route.parts[1] ?? ''} />; break;
    case 'playbook': content = <PlaybookView />; break;
    case 'hehun': content = <HehunView />; break;
    case 'calendar': content = <CalendarView />; break;
    case 'xingzuo': content = <XingZuoView />; break;
    case 'stats': content = <StatsView />; break;
    case 'settings': content = <SettingsView />; break;
    default: content = <HomeView />;
  }

  return (
    <Boundary>
    <div className="app">
      <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="主导航">
        <div className="sidebar-toggle-wrap">
          <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '展开菜单' : '收起菜单'} aria-label={collapsed ? '展开菜单' : '收起菜单'}>
            <Icon d="M3 6h18M3 12h18M3 18h18" />
          </button>
        </div>
        <div className="brand">
          <div className="brand-mark">玄</div>
          <div><div className="brand-name">玄枢八术</div><div className="brand-sub">EIGHT ARTS</div></div>
        </div>
        {NAV.map(n => (
          <button key={n.key} className={`nav-item ${active === n.key ? 'active' : ''}`}
            onClick={() => nav(`/${n.key}`)} aria-current={active === n.key ? 'page' : undefined}>
            <Icon d={n.icon} /><span className="lbl">{n.label}</span>
          </button>
        ))}
      </nav>
      <main className="main" id="main"><div className="page">{content}</div></main>
      <nav className="tabbar" aria-label="移动端导航">
        {NAV.map(n => (
          <button key={n.key} className={`tab-item ${active === n.key ? 'active' : ''}`}
            onClick={() => nav(`/${n.key}`)} aria-current={active === n.key ? 'page' : undefined}>
            <Icon d={n.icon} /><span>{n.label}</span>
          </button>
        ))}
      </nav>
      {welcome && <WelcomeGuide onDone={closeWelcome} />}
      <AIEnableDialog
        open={aiSetupOpen}
        ai={ai}
        hasFallback={hasEmbeddedAIFallback()}
        onChange={setAI}
        onClose={closeAISetup}
        onEnable={() => { setAI({ ...ai, enabled: true }); closeAISetup(); }}
      />
    </div>
    </Boundary>
  );
}
