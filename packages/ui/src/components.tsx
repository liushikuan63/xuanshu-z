/** 共享组件：引用角标（点击跳阅读器）、断语卡（A/B 与 D/E 分区）、答复面板 */
import React, { useEffect, useRef, useState } from 'react';
import type { RuleHit, CitationRef } from '@xuanshu/core';
import { ART_NAMES } from '@xuanshu/core';
import { GLOSSARY, GLOSSARY_TERMS } from '@xuanshu/knowledge';
import { LEVEL_META, buildDeepLink, partitionByLevel } from '@xuanshu/reader';
import type { ComposedAnswer } from '@xuanshu/answer';
import type { AISettings } from '@xuanshu/ai';
import { exportBoardImage } from './exportBoard';

export function CitationBadge({ citation: cit, from }: { citation?: CitationRef; from?: string }) {
  if (!cit) return null; // 坏数据降级：缺引用对象时隐藏角标而非崩溃（D28）
  const meta = LEVEL_META[cit.confidenceLevel] ?? LEVEL_META.C;
  const href = buildDeepLink(cit, from);
  return (
    <a
      className={`cit-badge ${cit.confidenceLevel}`}
      href={href}
      title={`${meta.label}·${cit.book}·${cit.chapter}（${meta.desc}）→ 点击在书阁中打开并高亮`}
      aria-label={`出处：${meta.label}《${cit.book}》${cit.chapter}`}
      onClick={(e) => e.stopPropagation()}
    >
      〔{meta.label}·{cit.book}·{cit.chapter} ↗〕
    </a>
  );
}

/** 术语点选解释（R7）：断语文本中的术语词自动加虚线，悬停看白话释义（glossary 数据源） */
const TERM_RE = new RegExp('(' + GLOSSARY_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\/** 白话讲解层：按规则族给通俗解释（不替代 fact，仅辅助理解；D16/R12 不断言新吉凶） */')).join('|') + ')', 'g');
export function renderWithTerms(text: string): React.ReactNode {
  if (!GLOSSARY_TERMS.some(t => text.includes(t))) return text;
  return text.split(TERM_RE).map((part, i) =>
    GLOSSARY[part]
      ? <span key={i} className="anno-term" title={part + '：' + (GLOSSARY[part].note || GLOSSARY[part].plain)}>{part}</span>
      : part,
  );
}
/** 白话讲解层：按规则族给通俗解释（不替代 fact，仅辅助理解；D16/R12 不断言新吉凶） */
const PLAIN_FAMILIES: Array<[RegExp, (r: RuleHit) => string]> = [
  [/^bazi\.shensha/, () => '神煞是传统命书的「标签」体系，像性格贴纸：吉神旺而不空才有感发力，落空逢冲则减半——看趋势，不必见名就慌或就喜。'],
  [/^bazi\.dayun|^bazi\.luck/, () => '大运是十年的「季节背景」：运干支五行帮到你用神，事情就容易顺；克用神则费力。看它定基调，具体年份再看流年。'],
  [/^bazi\.yongshen|^bazi\.strength|^bazi\.pattern/, () => '用神=让全局变顺的那个五行「调节器」。身弱喜帮扶（印比），身旺喜克泄耗（官财食伤）；趋势判断都以它为标尺。'],
  [/^bazi\.relation|^bazi\.he\b|^bazi\.ke/, () => '刑冲合害是干支之间的「互动关系」：合像牵手合作、冲像对撞变动、刑像内部摩擦——先看谁参与，再看帮谁。'],
  [/^bazi\.zizuo|^bazi\.ling/, () => '日主坐在哪支上、处于十二长生哪一步，描述的是「自身的状态与底气」，旺相则抗压，衰绝则宜休养。'],
  [/^liuyao\.yongshen/, () => '用神=这支卦里代表所问之事的那个爻。先找到它，再看它旺不旺、空不空、有没有人帮——找错用神，全卦皆错。'],
  [/^liuyao\.dong|^liuyao\.changed/, () => '动爻=正在变化的力量，变出的爻叫「化」：化进神是势头上行，化退神是后劲不足，回头生克是结局的反向修正。'],
  [/^liuyao\.shiying/, () => '世爻=求测人自己，应爻=对方/事情落点。世应相生则彼此配合，相冲相克则双方较劲或事来逼迫。'],
  [/^liuyao\.gua\./, () => '卦体大势：六冲卦主快而散、六合卦主慢而成；三合局成则力量成团——先定大势，再抠细节。'],
  [/^liuyao\.spirit/, () => '六神是每爻的「情绪涂色」：青龙喜庆、朱雀口舌、勾陈牵扯、螣蛇虚惊、白虎伤病、玄武暗昧——给同一爻加一层场景联想。'],
  [/^liuyao\.(kong|po|wangxiang|state)/, () => '旬空=暂时「不在场」，出空值日才应事；月破=被月令冲伤，逢合补或出月才复原；旺相休囚=按季节打的状态分。'],
  [/^meihua\.(ti|yong|relation)/, () => '体用=主客双方：体卦是自己、用卦是事情。用生体/体克用偏吉可为，用克体/体生用偏凶耗损，比和则顺。'],
  [/^meihua\.hu|^meihua\.bian/, () => '互卦=事情的中间过程，变卦=结局倾向；体用在互变中的生克，描述「过程中谁占上风、收尾如何」。'],
  [/^ziwei\.(sihua|geju|star)/, () => '四化是四颗「被激活」的星：禄=顺得资源，权=加压掌权，科=名利声望，忌=执着亏欠。落在哪宫，就在那件事上发力。'],
  [/^ziwei\.daxian|^ziwei\.liunian|^ziwei\.timing/, () => '紫微的时间分层：生年四化定底色 → 大限十年定方向 → 流年找具体应期；同层力量强，跨层只能引动。'],
  [/^ziwei\.sanfang/, () => '三方四正=本宫加对宫与两个三合宫，四颗星的组合才是完整判断；单星单宫不下结论。'],
  [/^qimen\.(sihai|geju|mu|kong|ma|renmu)/, () => '四害是奇门的「路况」：空亡=落空、击刑=自伤、入墓=受限、门迫=门被迫不得力；吉门吉格还得看有没有这些减分项。'],
  [/^qimen\.zhifu|^qimen\.yuan/, () => '值符=当班领导、值使=执行窗口；看事看「谁当班、几点开门」。'],
  [/^qimen\.keying\./, () => '十干克应=天盘干加地盘干的「碰巧组合」：青龙返首/飞鸟跌穴等为吉格，龙逃走/虎猖狂等为凶格——看盘先找它，再配门星状态。'],
  [/^qimen\.yinyang\.shichen/, () => '五阳（甲丙戊庚壬）利客：事可主动先手、宜抢先行；五阴（乙丁己辛癸）利主：宜静守后发、以逸待劳。'],
  [/^qimen\.(men|xing)/, () => '八门断吉凶用事：开休生为三吉门（宜行动谋事），伤杜景中平，死惊为凶（只宜特定事）；九星亦然——天辅心任禽冲为吉星，蓬芮英柱为凶星。旺相则吉增、休囚则凶显。'],
  [/^qimen\.fangwei\./, () => '方位用事是奇门看方位的用法：三吉门所在宫即本时的吉利方向，办事可从该方出发/坐向，借吉门之气。'],
  [/^qimen\.ri\./, () => '日家奇门是择日体系：休门三日一宫、太乙一日一宫，配黑黄道、喜神、贵人；「吉门+吉星」齐临的宫即本日吉方。黑黄道看时辰：黄道吉、黑道凶。'],
  [/^qimen\.timing\.(chukong|ma)/, () => '应期看「动」字：马星主速（一两天内见动静）、空亡主迟（等出空/填实之日才显）、值符宫地支也是应期的一种指针。无马星又逢空，事多半要拖。'],
  [/^liuren\.(ke|chuan|tianjiang|shensha)/, () => '四课=事情的表里两端，三传=开端、过程、结局；天将给每段配「性格」。先看发用，再顺传读全程。'],
  [/^liuren\.yuejiang/, () => '月将=太阳所在，加在时辰上转出天地盘——这是大六壬的「坐标系」，盘错则全错。'],
  [/^xiaoliuren.chain/, () => '三宫连读=把月/日/时三个落宫串成小故事：起因（月）→过程（日）→结局（时），比只看最后一宫更立体。'],
  [/^xiaoliuren/, () => '小六壬只管「快问快答」：大安稳、速喜快、小吉顺为吉；留连拖延、赤口口舌、空亡落空须防——答案是「现在去找/等」这类短决策。'],
  [/^jinkou\.(siwei|wudong|laiyi)/, () => '金口诀四位自下而上=事、人、中间、我；五行相生顺、相克阻，「五动」提示谁来发动这件事。'],
  [/^pastfuture|^compare/, () => '复盘类功能是拿已知事实校准解释习惯，不是回放过去；两术冲突时并列分歧、不下二选一结论。'],
];

function plainOfRule(r: RuleHit): string | null {
  for (const [re, fn] of PLAIN_FAMILIES) if (re.test(r.ruleId)) return fn(r);
  return null;
}

export function RuleHits({ hits, fromCaseId }: { hits: RuleHit[]; fromCaseId?: string }) {
  const { canonical, folk } = partitionByLevel(hits);
  const [plainMode, setPlainMode] = useState(() => localStorage.getItem('xuanshu.plain') !== '0');
  useEffect(() => { localStorage.setItem('xuanshu.plain', plainMode ? '1' : '0'); }, [plainMode]);
  const render = (r: RuleHit) => {
    const plain = plainMode ? plainOfRule(r) : null;
    return (
    <div key={r.ruleId + (r.target ?? '')} className={`rule-hit ${r.level === '吉' ? 'ji' : r.level === '凶' ? 'xiong' : r.level === '变数' ? 'bian' : ''}`}>
      <div className="rule-head">
        <span className={`tag ${r.level === '吉' ? 'ji' : r.level === '凶' ? 'xiong' : r.level === '变数' ? 'bian' : ''}`}>{r.level}</span>
        <span className="rule-title">{r.title}{r.target ? <span className="muted">（{r.target}）</span> : null}</span>
        {r.confidenceExtra && <span className="tag gold">{r.confidenceExtra}</span>}
      </div>
      <div style={{ fontSize: 13.5 }}>{renderWithTerms(r.fact)}</div>
      {plain && (
        <div className="small" style={{ marginTop: 4, color: 'var(--dai)', background: 'var(--paper-2, rgba(47,72,88,.06))', borderRadius: 8, padding: '6px 9px' }}>
          <span className="tag dai" style={{ marginRight: 6 }}>白话</span>{plain}
        </div>
      )}
      {r.alternatives && (
        <div className="small muted" style={{ marginTop: 4 }}>
          版本并列（系统不判定优劣）：
          {r.alternatives.map(a => <span key={a.version + a.label} className="tag gold" style={{ marginLeft: 6 }}>{a.version}：{a.label}</span>)}
        </div>
      )}
      {(r.citations?.length ?? 0) > 0 && (
        <div style={{ marginTop: 5 }}>
          {(r.citations ?? []).map((c, i) => <CitationBadge key={i} citation={c} from={fromCaseId} />)}
        </div>
      )}
    </div>
    );
  };
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
        <div className="small" style={{ fontWeight: 700, margin: '6px 0' }}>原典与注疏依据（优先采信）</div>
        <label className="row small" style={{ cursor: 'pointer', gap: 6 }}>
          <input type="checkbox" checked={plainMode} onChange={e => setPlainMode(e.target.checked)} />
          <span>白话讲解</span>
        </label>
      </div>
      {canonical.length ? canonical.map(render) : <div className="muted small">此范围暂无原典依据命中</div>}
      {folk.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="notice warn" style={{ margin: '6px 0' }}>以下为「流派说法 / AI 生成」类内容，与原典分区展示，不作主依据：</div>
          {folk.map(render)}
        </div>
      )}
    </div>
  );
}

function AiBusyLabel({ text }: { text: string }) {
  return (
    <span className="ai-busy-label">
      <span className="ai-spin" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

function AiGenerationWait({ followup = false }: { followup?: boolean } = {}) {
  const yao = ['yang', 'yin', 'yang', 'yin', 'yin', 'yang'] as const;
  return (
    <div id={followup ? undefined : 'ai-result'} className="ai-wait" role="status" aria-live="polite" aria-atomic="true">
      <div className="ai-oracle" aria-hidden="true">
        {yao.map((kind, index) => (
          <span className={`ai-oracle-line ${kind}`} style={{ animationDelay: `${index * 120}ms` }} key={`${kind}-${index}`}>
            <i />{kind === 'yin' && <i />}
          </span>
        ))}
      </div>
      <div className="ai-wait-copy">
        <b>AI 正在推演{followup ? '追问' : '整盘解读'}<span className="ai-ellipsis" aria-hidden="true"><i>·</i><i>·</i><i>·</i></span></b>
        <div className="ai-wait-progress" aria-hidden="true"><span /></div>
        <div className="muted small">免费模型可能需要较长时间，请稍候。</div>
        <div className="muted small">将按盘面事实、解读推断、立场结论、原因依据、应期建议与延伸提醒分节输出。</div>
      </div>
    </div>
  );
}

export function AnswerPanel({ answer, onAskAI, aiBusy, aiText, aiErr, aiQuestion }: { answer: ComposedAnswer; onAskAI?: () => void; aiBusy?: boolean; aiText?: string | null; aiErr?: string | null; aiQuestion?: string }) {
  // AI 结果打字机呈现：逐字输出，完成后平滑滚动到结果区块
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!aiText) { setTyped(''); return; }
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 8;
      setTyped(aiText.slice(0, i));
      if (i >= aiText.length) {
        clearInterval(id);
        setTimeout(() => document.getElementById('ai-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }, 24);
    return () => clearInterval(id);
  }, [aiText]);
  return (
    <div className="card">
      <h3 className="card-title" style={{ rowGap: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 0 }}>
          精准答复 · {ART_NAMES[answer.art as never] ?? answer.art} / {answer.category}
          {onAskAI && <button className="btn sm ai-answer-button" style={{ marginLeft: 'auto' }} onClick={onAskAI} disabled={aiBusy}>{aiBusy ? <AiBusyLabel text="AI 组织中" /> : 'AI 辅助解读'}</button>}
        </span>
        <span className="tag dai" style={{ flexBasis: '100%' }}>{answer.summary}</span>
      </h3>
      {answer.safety.sensitive && <div className="notice danger">{answer.safety.notice}<br />{answer.safety.referrals.join('；')}</div>}
      {answer.sections.map(s => (
        <div key={s.id} style={{ marginBottom: 12 }}>
          <div className="small" style={{ fontWeight: 700, color: 'var(--ink-2)', marginBottom: 3 }}>{s.title}</div>
          {s.kind === 'signals' || s.kind === 'facts' ? (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{s.content}</div>
          ) : s.kind === 'evidence' && !s.fallbackShown ? (
            <div>{(s.citations ?? []).map((c, i) => { if (!c) { (window).__badCite = (window).__badCite || []; (window).__badCite.push(s.id + '#' + i); return null; } return <div key={i} className="quote-block">{c.quote}<div><CitationBadge citation={c} /></div></div>; })}</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, color: s.fallbackShown ? 'var(--ink-3)' : undefined }}>{s.content}</div>
          )}
        </div>
      ))}
      {aiBusy && !aiText && <AiGenerationWait />}
      {aiText && (
        <div id="ai-result" style={{ marginTop: 10, padding: 12, border: '1px dashed var(--violet, #8b5cf6)', borderRadius: 10, background: 'rgba(124,77,166,.07)' }}>
          <b className="small">🤖 AI 辅助解读（模型生成 · 未经原典核实 · 仅供参考）</b>
          {aiQuestion && <div className="muted small" style={{ marginTop: 2 }}>针对问题：{aiQuestion}</div>}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, marginTop: 6, lineHeight: 1.7 }}>{typed}{typed.length < (aiText?.length ?? 0) ? <span className="ai-cursor" /> : ''}</div>
        </div>
      )}
      {aiErr && !aiText && <div id="ai-result"><div className="notice warn" style={{ marginTop: 8 }}>AI 辅助解读失败：{aiErr}</div></div>}
    </div>
  );
}

/** AI 快速条：放在盘面上方，一键「AI 辅助解读」或「复制提示词」——不熟悉术语的用户可直接得到白话答案 */
export function AiQuickBar({ onAskAI, aiBusy, onCopyPrompt, copyMsg, hint }: {
  onAskAI?: () => void; aiBusy?: boolean; onCopyPrompt?: () => void; copyMsg?: string; hint?: string;
}) {
  return (
    <div className="card" style={{ marginTop: 10, borderLeft: '4px solid var(--gold)', background: 'var(--soft-c)' }}>
      <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
        {onAskAI && <button className="btn primary ai-quick-button" onClick={onAskAI} disabled={aiBusy}>{aiBusy ? <AiBusyLabel text="AI 组织中" /> : '🤖 AI 辅助解读'}</button>}
        {onCopyPrompt && <button className="btn" onClick={onCopyPrompt}>📋 复制提示词</button>}
        {copyMsg && <span className="muted small" role="status">{copyMsg}</span>}
      </div>
      {aiBusy && <div className="ai-quick-progress" aria-hidden="true"><span /></div>}
      {hint && <div className="muted small" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export function AIEnableDialog({ open, ai, hasFallback, onChange, onEnable, onClose }: {
  open: boolean;
  ai: AISettings;
  hasFallback: boolean;
  onChange: (next: AISettings) => void;
  onEnable: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const ready = hasFallback || !!ai.keyInMemory?.trim();
  return (
    <div className="modal-mask" style={{ zIndex: 95 }} onClick={onClose}>
      <div className="modal ai-enable-modal" role="dialog" aria-modal="true" aria-label="AI 开启设置" onClick={event => event.stopPropagation()}>
        <div className="ai-enable-head">
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>AI 开启设置</h3>
            <div className="muted small" style={{ marginTop: 4 }}>当前排盘和结果已保留。</div>
          </div>
          <button className="btn sm" onClick={onClose} aria-label="关闭 AI 开启设置">✕</button>
        </div>
        <div className={`notice ${hasFallback ? 'info' : 'warn'}`} style={{ marginTop: 14 }}>
          {hasFallback ? '已检测到本机构建的加密 OpenRouter 保底，可直接开启。' : '当前构建没有内置保底，请输入 API Key 后开启。'}
        </div>
        {!hasFallback && (
          <label className="field" style={{ marginTop: 12 }}>
            <span>OpenRouter API Key（仅保存在当前页面内存）</span>
            <input
              className="input"
              type="password"
              value={ai.keyInMemory ?? ''}
              onChange={event => onChange({ ...ai, providerId: 'openrouter', keyInMemory: event.target.value })}
              placeholder="sk-or-v1-…"
              autoComplete="off"
              autoFocus
            />
          </label>
        )}
        <div className="ai-enable-actions">
          <button className="btn" onClick={onClose}>返回当前结果</button>
          <button className="btn primary" disabled={!ready} onClick={onEnable}>开启 AI 并返回结果</button>
        </div>
      </div>
    </div>
  );
}

/** AI 辅助解读弹窗：成功=全文+复制/TXT/图片导出；失败=直接弹窗给错误提示 */
export function AIResultModal({ text, error, question, onClose, toastMsg, onAsk, askBusy }: {
  text: string | null;
  error?: string | null;
  question?: string;
  onClose: () => void;
  toastMsg: (m: string) => void;
  onAsk?: (q: string) => void;      // 同盘继续追问
  askBusy?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<'copy' | 'txt' | 'img' | null>(null);
  const [askQ, setAskQ] = useState('');
  if (!text && !error) return null;
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const doCopy = async () => {
    setBusy('copy');
    try {
      if (!navigator.clipboard) throw new Error('浏览器未授权剪贴板');
      await navigator.clipboard.writeText(text ?? '');
      toastMsg('AI 解读已复制到剪贴板');
    } catch (e) { toastMsg('复制失败：' + ((e as Error).message ?? '未知')); }
    setBusy(null);
  };
  const doTxt = async () => {
    setBusy('txt');
    try {
      const head = `玄枢 · AI 辅助解读\n${question ? '针对问题：' + question + '\n' : ''}（模型生成 · 未经原典核实 · 仅供参考）\n${'='.repeat(28)}\n\n`;
      const blob = new Blob([head + text], { type: 'text/plain;charset=utf-8' });
      if (typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor.isNativePlatform?.()) {
        const fsMod: any = await import('@capacitor/filesystem');
        const shareMod: any = await import('@capacitor/share');
        const res = await fsMod.Filesystem.writeFile({
          path: `xuanshu-ai-${stamp()}.txt`,
          data: head + text,
          directory: fsMod.Directory.Documents,
          encoding: fsMod.Encoding.UTF8,
        });
        await shareMod.Share.share({ title: '玄枢AI解读', url: res.uri, dialogTitle: '分享 AI 解读' });
        toastMsg('已生成并拉起分享');
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `玄枢AI解读_${stamp()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toastMsg('TXT 已保存到下载');
      }
    } catch (e) { toastMsg('导出失败：' + ((e as Error).message ?? '未知')); }
    setBusy(null);
  };
  const doImg = async () => {
    if (!bodyRef.current) return;
    setBusy('img');
    const msg = await exportBoardImage(bodyRef.current, `xuanshu-ai-${stamp()}.png`);
    toastMsg(msg);
    setBusy(null);
  };
  return (
    <div className="modal-mask" style={{ zIndex: 80, paddingTop: 26 }} onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="AI 辅助解读" style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 className="card-title" style={{ margin: 0 }}>🤖 AI 辅助解读
            <span className="tag dai">模型生成 · 仅供参考</span>
          </h3>
          <button className="btn sm" onClick={onClose}>✕ 关闭</button>
        </div>
        {question && <div className="muted small" style={{ margin: '4px 0 8px' }}>针对问题：{question}</div>}
        {error && !text ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>⚠️</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16 }}>AI 辅助解读失败</div>
            <div className="muted" style={{ marginTop: 6, wordBreak: 'break-all' }}>{error}</div>
            <div style={{ marginTop: 8 }} className="muted small">可检查网络后再试，或在设置页确认 AI 服务已配置。</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 8 }}>
              <button className="btn primary" onClick={onClose}>知道了</button>
            </div>
          </div>
        ) : (
        <>
        <div ref={bodyRef}
          style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, overflowY: 'auto', maxHeight: '55vh',
            background: 'rgba(124,77,166,.06)', border: '1px dashed var(--violet, #8b5cf6)', borderRadius: 10, padding: 14 }}>
          {text}
        </div>
        <div className="row wrap" style={{ marginTop: 12, gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={doCopy} disabled={!!busy}>{busy === 'copy' ? '复制中…' : '📋 复制'}</button>
          <button className="btn sm" onClick={doTxt} disabled={!!busy}>{busy === 'txt' ? '导出中…' : '📄 导出 TXT'}</button>
          <button className="btn sm" onClick={doImg} disabled={!!busy}>{busy === 'img' ? '生成图片中…' : '🖼 生成图片'}</button>
        </div>
        {onAsk && (
          <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="对同一盘继续追问，如：再帮我细看财运/推一个方向…" value={askQ} onChange={e => setAskQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && askQ.trim() && onAsk) { onAsk(askQ.trim()); setAskQ(''); } }} aria-label="继续追问" />
            <button className="btn sm ai-followup-button" disabled={askBusy || !askQ.trim()} onClick={() => { if (askQ.trim() && onAsk) { onAsk(askQ.trim()); setAskQ(''); } }}>{askBusy ? <AiBusyLabel text="追问中" /> : '继续追问'}</button>
          </div>
        )}
        {askBusy && <AiGenerationWait followup />}
        </>
        )}
      </div>
    </div>
  );
}
