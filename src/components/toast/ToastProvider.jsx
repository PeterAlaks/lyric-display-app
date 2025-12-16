import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContext = createContext(null);

let idSeq = 1;

export function ToastProvider({ children, position = 'bottom-right', offset = 20, max = 3, isDark = false }) {
  const [muted, setMuted] = useState(() => {
    try {
      const stored = localStorage.getItem('toast-muted');
      return stored === 'true';
    } catch { return false; }
  });

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem('toast-muted', String(next)); } catch { }
      return next;
    });
  }, []);

  const [toasts, setToasts] = useState([]);
  const removeTimer = useRef(new Map());
  const exitTimer = useRef(new Map());

  const remove = useCallback((id) => {

    setToasts((prev) => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    const t = removeTimer.current.get(id);
    if (t) { clearTimeout(t); removeTimer.current.delete(id); }
    const ex = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      exitTimer.current.delete(id);
    }, 320);
    exitTimer.current.set(id, ex);
  }, []);

  const show = useCallback(({ title, message, variant = 'info', duration = 4000, actions = [], playTone }) => {
    const id = idSeq++;
    const toast = { id, title, message, variant, actions, createdAt: Date.now(), entering: true, exiting: false };
    setToasts((prev) => {
      const arr = [...prev, toast];
      if (arr.length > max) {
        const removed = arr.shift();
        const tOld = removed && removeTimer.current.get(removed.id);
        if (tOld) { clearTimeout(tOld); removeTimer.current.delete(removed.id); }
        const tExit = removed && exitTimer.current.get(removed.id);
        if (tExit) { clearTimeout(tExit); exitTimer.current.delete(removed.id); }
      }
      return arr;
    });

    if (typeof playTone === 'function' && !muted) {
      try { playTone(variant); } catch { }
    }

    requestAnimationFrame(() => {
      setToasts((prev) => prev.map(t => t.id === id ? { ...t, entering: false } : t));
    });

    if (duration > 0) {
      const t = setTimeout(() => remove(id), duration);
      removeTimer.current.set(id, t);
    }
    return id;
  }, [remove, muted]);

  useEffect(() => () => {
    removeTimer.current.forEach((t) => clearTimeout(t));
    removeTimer.current.clear();
    exitTimer.current.forEach((t) => clearTimeout(t));
    exitTimer.current.clear();
  }, []);

  const value = useMemo(() => ({ show, remove, muted, toggleMute }), [show, remove, muted, toggleMute]);

  const posStyle = useMemo(() => {
    const base = { position: 'fixed', zIndex: 9999, pointerEvents: 'none' };
    const space = `${offset}px`;
    if (position === 'bottom-right') return { ...base, right: space, bottom: space };
    if (position === 'bottom-left') return { ...base, left: space, bottom: space };
    if (position === 'top-right') return { ...base, right: space, top: space };
    return { ...base, left: space, top: space };
  }, [position, offset]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={posStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {toasts.map(({ id, title, message, variant, actions, entering, exiting }) => {
            const accent = variant === 'error' ? '#ef4444' : variant === 'warn' ? '#f59e0b' : variant === 'success' ? '#10b981' : '#3b82f6';
            const bg = isDark
              ? (variant === 'error' ? '#7f1d1d' : variant === 'warn' ? '#78350f' : variant === 'success' ? '#064e3b' : '#111827')
              : '#ffffff';
            const textColor = isDark ? '#e5e7eb' : '#111827';
            const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
            const shadow = isDark ? '0 8px 24px rgba(0,0,0,0.25)' : '0 6px 18px rgba(0,0,0,0.12)';
            const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? XCircle : variant === 'warn' ? AlertTriangle : Info;
            return (
              <div key={id}
                style={{
                  pointerEvents: 'auto',
                  minWidth: 280,
                  maxWidth: 420,
                  padding: '12px 14px',
                  borderRadius: 10,
                  boxShadow: shadow,
                  background: bg,
                  color: textColor,
                  border: `1px solid ${borderColor}`,
                  transition: 'opacity 300ms cubic-bezier(.2,.9,.3,1), transform 300ms cubic-bezier(.2,.9,.3,1)',
                  opacity: (entering || exiting) ? 0 : 1,
                  transform: entering ? 'translateX(32px)' : (exiting ? 'translateX(120%)' : 'translateX(0)')
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                  <div style={{ lineHeight: 1, marginTop: 2, color: accent, display: 'flex' }}>
                    <Icon size={18} aria-hidden />
                  </div>
                  <div style={{ flex: 1 }}>
                    {title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>}
                    {message && <div style={{ opacity: 0.95, fontSize: 13, lineHeight: 1.4 }}>{message}</div>}
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); remove(id); }}
                    style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', opacity: 0.7, padding: 2, display: 'flex' }}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                {Array.isArray(actions) && actions.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {actions.map((a, idx) => (
                      <button key={idx}
                        onClick={(e) => { e.stopPropagation(); try { a.onClick?.(); } catch { }; remove(id); }}
                        style={{
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                          background: 'transparent',
                          color: textColor,
                          padding: '6px 10px',
                          fontSize: 12,
                          borderRadius: 8,
                          cursor: 'pointer'
                        }}
                      >{a.label}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
