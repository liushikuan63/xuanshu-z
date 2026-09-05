/** 全局状态：配置 / 语料 / KB 索引 / AI / 主题 / Toast（PlatformAdapter 注入点） */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultConfig, stableHash, type ResolvedConfig, type ArtType } from '@xuanshu/core';
import type { KBDocument, KBIndex } from '@xuanshu/knowledge';
import { buildIndex, preloadFold } from '@xuanshu/knowledge';
import { createMemoryCorpus, type CorpusProvider } from '@xuanshu/reader';
import { DEFAULT_AI, type AISettings } from '@xuanshu/ai';

export interface BirthMoment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: '男' | '女';
  location?: string;   // 出生地（如 青岛）
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  highContrast: boolean;
  reducedMotion: boolean;
  quotaLimit: number | 'unlimited';
  profileName: string;
  birth: BirthMoment | null;   // 预设个人生辰（供每日运势/万年历精细化推荐）
}

interface AppCtx {
  config: ResolvedConfig;
  setConfig: (c: ResolvedConfig) => void;
  configHash: string;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  corpus: CorpusProvider;
  kbIndex: KBIndex;
  kbLoading: boolean;
  ai: AISettings;
  setAI: (a: AISettings) => void;
  aiSetupOpen: boolean;
  requestAISetup: () => void;
  closeAISetup: () => void;
  toast: (msg: string) => void;
  toasts: Array<{ id: number; msg: string }>;
}

const Ctx = createContext<AppCtx>(null as never);
export const useApp = () => useContext(Ctx);

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light', highContrast: false, reducedMotion: false,
  quotaLimit: 99, profileName: '默认配置', birth: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 兼容旧版本保存的局部配置，同时补齐新版本新增的嵌套默认值。 */
export function mergeStored<T>(defaults: T, stored: unknown): T {
  if (stored === undefined) return defaults;
  if (Array.isArray(defaults)) return (Array.isArray(stored) ? stored : defaults) as T;
  if (isRecord(defaults)) {
    if (!isRecord(stored)) return defaults;
    const merged: Record<string, unknown> = { ...stored };
    for (const [key, fallback] of Object.entries(defaults)) {
      merged[key] = mergeStored(fallback, stored[key]);
    }
    return merged as T;
  }
  if (defaults === null) return stored as T;
  return typeof stored === typeof defaults ? stored as T : defaults;
}

function readStored<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? mergeStored(defaults, JSON.parse(raw)) : defaults;
  } catch {
    return defaults;
  }
}

function writeStored(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 存储被禁用或空间不足时仍允许继续使用 */ }
}

export function aiSettingsForStorage(value: AISettings): AISettings {
  const { keyInMemory: _keyInMemory, ...persisted } = value;
  return persisted;
}

export function AppProvider({ corpusDocs, children }: { corpusDocs: KBDocument[]; children: React.ReactNode }) {
  const [config, setConfig] = useState<ResolvedConfig>(() => readStored('xuanshu.config', defaultConfig()));
  const [settings, setSettings] = useState<AppSettings>(() => readStored('xuanshu.settings', DEFAULT_SETTINGS));
  const [ai, setAI] = useState<AISettings>(() => ({ ...readStored('xuanshu.ai', DEFAULT_AI), keyInMemory: undefined }));
  const [aiSetupOpen, setAiSetupOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbIndex, setKbIndex] = useState<KBIndex>(() => buildIndex([]));
  const corpusRef = useRef<CorpusProvider>(createMemoryCorpus(corpusDocs));

  // KB 索引后台构建（性能预算 §7.4：<1s / 600–1200 段）。
  // 先预热检索归一（异体字表 + opencc 繁简），再建索引，保证索引与查询同一归一层。
  useEffect(() => {
    let alive = true;
    setKbLoading(true);
    (async () => {
      try { await preloadFold(); } catch { /* opencc 缺失时仅异体归一 */ }
      if (!alive) return;
      try { setKbIndex(buildIndex(corpusDocs)); } finally { if (alive) setKbLoading(false); }
    })();
    return () => { alive = false; };
  }, [corpusDocs]);

  const configHash = useMemo(() => stableHash(config), [config]);

  useEffect(() => { writeStored('xuanshu.config', config); }, [config]);
  useEffect(() => {
    writeStored('xuanshu.settings', settings);
    const root = document.documentElement;
    const theme = settings.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
  }, [settings]);
  useEffect(() => { writeStored('xuanshu.ai', aiSettingsForStorage(ai)); }, [ai]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3200);
  }, []);

  const value: AppCtx = {
    config, setConfig, configHash, settings, setSettings,
    corpus: corpusRef.current, kbIndex, kbLoading, ai, setAI,
    aiSetupOpen,
    requestAISetup: () => setAiSetupOpen(true),
    closeAISetup: () => setAiSetupOpen(false),
    toast, toasts,
  };
  return <Ctx.Provider value={value}>{children}<div className="toast-wrap">{toasts.map(t => <div key={t.id} className="toast" role="status">{t.msg}</div>)}</div></Ctx.Provider>;
}

/** 术数中文名与配色 */
export const ART_META: Record<ArtType, { icon: string; color: string; klass: '命' | '卜' }> = {
  bazi: { icon: '八字', color: 'var(--dai)', klass: '命' },
  liuyao: { icon: '六爻', color: 'var(--zhu)', klass: '卜' },
  meihua: { icon: '梅花', color: 'var(--gold)', klass: '卜' },
  ziwei: { icon: '紫微', color: 'var(--purple, #7b4b94)', klass: '命' },
  qimen: { icon: '奇门', color: 'var(--green)', klass: '卜' },
  liuren: { icon: '大六壬', color: 'var(--water)', klass: '卜' },
  xiaoliuren: { icon: '小六壬', color: 'var(--orange)', klass: '卜' },
  jinkou: { icon: '金口诀', color: 'var(--metal)', klass: '卜' },
};
