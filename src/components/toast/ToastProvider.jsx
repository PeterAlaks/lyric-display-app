import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import useLyricsStore from '../../context/LyricsStore';

export const ToastContext = createContext(null);
export const globalToastRef = { current: null };

let idSeq = 1;

export function ToastProvider({ children, position = 'bottom-right', offset = 20, max = 3, isDark = false, density = 'default' }) {
  const muted = useLyricsStore((state) => state.toastSoundsMuted);
  const compact = density === 'dock' || density === 'compact';

  const [toasts, setToasts] = useState([]);
  const removeTimer = useRef(new Map());
  const exitTimer = useRef(new Map());
  const lastToneAt = useRef(0);
  const TONE_GAP_MS = 350;

  const clearTimersForId = (id) => {
    const t = removeTimer.current.get(id);
    if (t) {
      clearTimeout(t);
      removeTimer.current.delete(id);
    }
    const ex = exitTimer.current.get(id);
    if (ex) {
      clearTimeout(ex);
      exitTimer.current.delete(id);
    }
  };

  const remove = useCallback((id) => {

    setToasts((prev) => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    clearTimersForId(id);
    const ex = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      exitTimer.current.delete(id);
    }, 320);
    exitTimer.current.set(id, ex);
  }, []);

  const show = useCallback(({ title, message, variant = 'info', duration = 4000, actions = [], playTone, dedupeKey }) => {
    const id = idSeq++;
    const toast = { id, title, message, variant, actions, createdAt: Date.now(), entering: true, exiting: false, dedupeKey: dedupeKey || null };
    setToasts((prev) => {
      const next = dedupeKey
        ? prev.filter((t) => {
          if (t.dedupeKey !== dedupeKey) return true;
          clearTimersForId(t.id);
          return false;
        })
        : [...prev];

      const arr = [...next, toast];
      if (arr.length > max) {
        const removed = arr.shift();
        if (removed) {
          clearTimersForId(removed.id);
        }
      }
      return arr;
    });

    const now = Date.now();
    if (typeof playTone === 'function' && !muted && (now - lastToneAt.current > TONE_GAP_MS)) {
      try { playTone(variant); } catch { }
      lastToneAt.current = now;
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

  useEffect(() => {
    globalToastRef.current = { show, remove };
    return () => { globalToastRef.current = null; };
  }, [show, remove]);

  const value = useMemo(() => ({ show, remove }), [show, remove]);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 12 }}>
          {toasts.map(({ id, title, message, variant, actions, entering, exiting }) => {
            const normalizedVariant = variant === 'warning' ? 'warn' : variant;
            const palette = {
              error: {
                accent: '#ef4444',
                soft: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(254, 226, 226, 0.95)',
                border: isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(248, 113, 113, 0.35)'
              },
              warn: {
                accent: '#f59e0b',
                soft: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(254, 243, 199, 0.95)',
                border: isDark ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.35)'
              },
              success: {
                accent: '#10b981',
                soft: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(209, 250, 229, 0.95)',
                border: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.32)'
              },
              info: {
                accent: '#3b82f6',
                soft: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(219, 234, 254, 0.95)',
                border: isDark ? 'rgba(59, 130, 246, 0.30)' : 'rgba(59, 130, 246, 0.35)'
              }
            };
            const tone = palette[normalizedVariant] || palette.info;
            const bg = isDark ? 'rgba(31, 41, 55, 0.96)' : 'rgba(248, 250, 252, 0.97)';
            const textColor = isDark ? '#e5e7eb' : '#111827';
            const mutedTextColor = isDark ? '#9ca3af' : '#4b5563';
            const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)';
            const shadow = isDark ? '0 18px 42px rgba(0,0,0,0.36)' : '0 18px 42px rgba(15,23,42,0.16)';
            const Icon = normalizedVariant === 'success' ? CheckCircle2 : normalizedVariant === 'error' ? XCircle : normalizedVariant === 'warn' ? AlertTriangle : Info;
            const closeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
            const actionBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';
            return (
              <div key={id}
                role={normalizedVariant === 'error' ? 'alert' : 'status'}
                style={{
                  pointerEvents: 'auto',
                  position: 'relative',
                  overflow: 'hidden',
                  minWidth: compact ? 220 : 320,
                  maxWidth: compact ? 300 : 440,
                  padding: compact ? '11px 12px' : '16px 16px',
                  borderRadius: compact ? 12 : 14,
                  boxShadow: shadow,
                  background: bg,
                  color: textColor,
                  border: `1px solid ${borderColor}`,
                  transition: 'opacity 260ms cubic-bezier(.2,.9,.3,1), transform 260ms cubic-bezier(.2,.9,.3,1)',
                  opacity: (entering || exiting) ? 0 : 1,
                  transform: entering ? 'translateX(32px)' : (exiting ? 'translateX(120%)' : 'translateX(0)')
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? 10 : 13 }}>
                  <div
                    style={{
                      alignItems: 'center',
                      background: tone.soft,
                      border: `1px solid ${tone.border}`,
                      borderRadius: 999,
                      color: tone.accent,
                      display: 'flex',
                      flexShrink: 0,
                      height: compact ? 25 : 32,
                      justifyContent: 'center',
                      marginTop: compact ? 0 : 1,
                      width: compact ? 25 : 32
                    }}
                  >
                    <Icon size={compact ? 14 : 17} aria-hidden />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: compact ? 1 : 1 }}>
                    {title && (
                      <div style={{
                        color: textColor,
                        fontSize: compact ? 12 : 13,
                        fontWeight: 700,
                        lineHeight: 1.28,
                        marginBottom: message ? (compact ? 3 : 5) : 0
                      }}>
                        {title}
                      </div>
                    )}
                    {message && (
                      <div style={{
                        color: mutedTextColor,
                        fontSize: compact ? 11 : 12,
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere'
                      }}>
                        {message}
                      </div>
                    )}
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); remove(id); }}
                    style={{
                      alignItems: 'center',
                      background: closeBg,
                      border: 'none',
                      borderRadius: 999,
                      color: mutedTextColor,
                      cursor: 'pointer',
                      display: 'flex',
                      flexShrink: 0,
                      height: compact ? 23 : 26,
                      justifyContent: 'center',
                      padding: 0,
                      marginLeft: compact ? 1 : 2,
                      width: compact ? 23 : 26
                    }}
                  >
                    <X size={compact ? 13 : 14} aria-hidden />
                  </button>
                </div>
                {Array.isArray(actions) && actions.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: compact ? 10 : 13, flexWrap: 'wrap', paddingLeft: compact ? 35 : 45 }}>
                    {actions.map((a, idx) => (
                      <button key={idx}
                        onClick={(e) => { e.stopPropagation(); try { a.onClick?.(); } catch { }; remove(id); }}
                        style={{
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'}`,
                          background: actionBg,
                          color: textColor,
                          padding: compact ? '5px 9px' : '7px 12px',
                          fontSize: compact ? 11 : 12,
                          fontWeight: 650,
                          borderRadius: 999,
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
