/** DateTimePick：移动端友好的日期时间弹出选择组件（日历网格 + 时分下拉），替代裸数字输入框
 *  点击显示框弹出弹层（portal 挂到 body，避免嵌套在 label/表单内被吞事件）：翻月选日 → 选时/分 → 确定；
 *  关闭带 300ms 去抖，防止移动端"点确定后弹层关闭又立刻被同一次触摸触发重开" */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DateTimeValue { year: number; month: number; day: number; hour: number; minute: number; }

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const YEARS = Array.from({ length: 2100 - 1900 + 1 }, (_, i) => 1900 + i);
const pad2 = (n: number) => String(n).padStart(2, '0');

const CalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export function DateTimePick({ value, onChange }: {
  value: DateTimeValue;
  onChange: (v: DateTimeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const lockUntil = useRef(0); // 关闭后短暂上锁，防止移动端同一次触摸穿透重开弹层
  const [viewYear, setViewYear] = useState(value.year);
  const [viewMonth, setViewMonth] = useState(value.month);
  const [selDay, setSelDay] = useState(value.day);
  const [pickHour, setPickHour] = useState(value.hour);
  const [pickMinute, setPickMinute] = useState(value.minute);

  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

  const cells = useMemo(() => {
    const first = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // 周一为首
    const arr: Array<number | null> = [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length: daysInMonth(viewYear, viewMonth) }, (_, i) => i + 1),
    ];
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth]);

  const closeIt = () => { setOpen(false); lockUntil.current = Date.now() + 300; };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeIt(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openPop = () => {
    if (Date.now() < lockUntil.current) return;
    setViewYear(value.year); setViewMonth(value.month);
    setSelDay(value.day);
    setPickHour(value.hour); setPickMinute(value.minute);
    setOpen(true);
  };

  const nav = (dy: number) => {
    let m = viewMonth + dy, y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y); setViewMonth(m);
  };

  const toNow = () => {
    const n = new Date();
    setViewYear(n.getFullYear()); setViewMonth(n.getMonth() + 1);
    setSelDay(n.getDate()); setPickHour(n.getHours()); setPickMinute(n.getMinutes());
  };

  const confirm = () => {
    onChange({ year: viewYear, month: viewMonth, day: Math.min(selDay, daysInMonth(viewYear, viewMonth)), hour: pickHour, minute: pickMinute });
    closeIt();
  };

  const isToday = (d: number) => {
    const n = new Date();
    return n.getFullYear() === viewYear && n.getMonth() + 1 === viewMonth && n.getDate() === d;
  };

  const fmt = `${value.year}年${value.month}月${value.day}日 ${pad2(value.hour)}:${pad2(value.minute)}`;

  return (
    <div className="dtp">
      <button type="button" className="dtp-field" onClick={openPop} aria-haspopup="dialog" aria-expanded={open}>
        <span className="dtp-val mono">{fmt}</span>
        <CalIcon />
      </button>
      <div className="dtp-hint muted small">点按弹出日历选择（移动端友好）</div>
      {open && createPortal(
        <>
          <div className="dtp-mask" onClick={closeIt} />
          <div className="dtp-pop" role="dialog" aria-modal="true" aria-label="选择日期时间">
            <div className="dtp-head">
              <button type="button" className="nav" aria-label="上个月" onClick={() => nav(-1)}>‹</button>
              <select className="select" value={viewYear} aria-label="年份"
                onChange={e => { const y = +e.target.value; setViewYear(y); setSelDay(Math.min(selDay, daysInMonth(y, viewMonth))); }}>
                {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select className="select" value={viewMonth} aria-label="月份"
                onChange={e => { const m = +e.target.value; setViewMonth(m); setSelDay(Math.min(selDay, daysInMonth(viewYear, m))); }}>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}月</option>)}
              </select>
              <button type="button" className="nav" aria-label="下个月" onClick={() => nav(1)}>›</button>
            </div>
            <div className="dtp-week">{WEEK_LABELS.map(w => <span key={w}>{w}</span>)}</div>
            <div className="dtp-grid">
              {cells.map((d, i) => d == null
                ? <span key={i} />
                : (
                  <button key={i} type="button"
                    className={`dtp-day${d === selDay ? ' sel' : ''}${isToday(d) ? ' today' : ''}`}
                    onClick={() => setSelDay(d)}>
                    {d}
                  </button>
                ))}
            </div>
            <div className="dtp-time">
              <select className="select" value={pickHour} aria-label="小时"
                onChange={e => setPickHour(+e.target.value)}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad2(i)}时</option>)}
              </select>
              <span style={{ color: 'var(--ink-3)' }}>:</span>
              <select className="select" value={pickMinute} aria-label="分钟"
                onChange={e => setPickMinute(+e.target.value)}>
                {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{pad2(i)}分</option>)}
              </select>
              <button type="button" className="btn sm" onClick={toNow}>今天</button>
            </div>
            <div className="dtp-foot">
              <button type="button" className="btn" onClick={closeIt}>取消</button>
              <button type="button" className="btn primary" onClick={confirm}>确定</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}