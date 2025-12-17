import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import ConnectionDiagnosticsModal from '../ConnectionDiagnosticsModal';
import PreviewOutputsModal from '../PreviewOutputsModal';
import { ControlPanelHelp, OutputSettingsHelp, SongCanvasHelp, StageDisplayHelp, MobileControllerHelp } from '../HelpContent';
import { WelcomeSplash } from '../WelcomeSplash';
import { IntegrationInstructions } from '../IntegrationInstructions';
import SongInfoModal from '../SongInfoModal';
import DisplayDetectionModal from '../DisplayDetectionModal';
import AutoplaySettings from '../AutoplaySettings';
import IntelligentAutoplayInfo from '../IntelligentAutoplayInfo';
import OutputTemplatesModal from '../OutputTemplatesModal';
import StageTemplatesModal from '../StageTemplatesModal';
import AboutAppModal from '../AboutAppModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ModalContext = createContext(null);

let modalIdSeq = 1;
const animationDuration = 220;

const variantPalette = (variant, isDark) => {
  switch (variant) {
    case 'success':
      return {
        accent: isDark ? 'text-emerald-300' : 'text-emerald-600',
        badge: isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-500/10 text-emerald-600',
        ring: isDark ? 'ring-emerald-500/40' : 'ring-emerald-500/20',
      };
    case 'warn':
    case 'warning':
      return {
        accent: isDark ? 'text-amber-300' : 'text-amber-600',
        badge: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-500/10 text-amber-600',
        ring: isDark ? 'ring-amber-500/40' : 'ring-amber-500/20',
      };
    case 'error':
    case 'danger':
    case 'destructive':
      return {
        accent: isDark ? 'text-rose-300' : 'text-rose-600',
        badge: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-500/10 text-rose-600',
        ring: isDark ? 'ring-rose-500/50' : 'ring-rose-500/20',
      };
    default:
      return {
        accent: isDark ? 'text-blue-300' : 'text-blue-600',
        badge: isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-500/10 text-blue-600',
        ring: isDark ? 'ring-blue-500/35' : 'ring-blue-500/20',
      };
  }
};

const variantIcon = (variant) => {
  switch (variant) {
    case 'success':
      return CheckCircle2;
    case 'warn':
    case 'warning':
      return AlertTriangle;
    case 'error':
    case 'danger':
    case 'destructive':
      return XCircle;
    default:
      return Info;
  }
};

export function ModalProvider({ children, isDark = false }) {
  const [modals, setModals] = useState([]);
  const resolverMap = useRef(new Map());
  const removalTimers = useRef(new Map());
  const bodyOverflowRef = useRef(null);

  const showModal = useCallback((config = {}) => {
    const id = modalIdSeq++;
    const normalizedVariant = (config.variant || 'info').toLowerCase();
    const hasExplicitActions = Array.isArray(config.actions);
    const modal = {
      id,
      variant: normalizedVariant,
      title: config.title || '',
      description: config.description ?? config.message ?? '',
      headerDescription: config.headerDescription ?? '',
      body: config.body,
      component: config.component,
      dismissible: config.dismissible !== false,
      actions: hasExplicitActions
        ? config.actions.map((action) => ({ ...action }))
        : [],
      entering: true,
      exiting: false,
      allowBackdropClose: config.allowBackdropClose ?? config.dismissible !== false,
      onClose: config.onClose,
      className: config.className,
      size: config.size || 'md',
      icon: config.icon || null,
      ...Object.keys(config).reduce((acc, key) => {
        if (!['variant', 'title', 'description', 'message', 'headerDescription', 'body', 'component', 'dismissible', 'actions', 'allowBackdropClose', 'onClose', 'className', 'size', 'icon', 'dismissLabel'].includes(key)) {
          acc[key] = config[key];
        }
        return acc;
      }, {})
    };

    if (!hasExplicitActions && modal.actions.length === 0) {
      modal.actions = [
        {
          label: config.dismissLabel || 'Okay',
          value: 'dismiss',
          variant: 'default',
          autoFocus: true,
        },
      ];
    }

    return new Promise((resolve) => {
      resolverMap.current.set(id, resolve);
      setModals((prev) => [...prev, modal]);
      requestAnimationFrame(() => {
        setModals((prev) => prev.map((m) => (m.id === id ? { ...m, entering: false } : m)));
      });
    });
  }, []);

  const finalizeRemoval = useCallback((id) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
    removalTimers.current.delete(id);
  }, []);

  const closeModal = useCallback((id, result, opts = {}) => {
    setModals((prev) => prev.map((m) => (m.id === id ? { ...m, exiting: true } : m)));

    if (!removalTimers.current.has(id)) {
      const timer = setTimeout(() => finalizeRemoval(id), animationDuration);
      removalTimers.current.set(id, timer);
    }

    const resolver = resolverMap.current.get(id);
    if (resolver) {
      try {
        resolver(result);
      } catch { }
      resolverMap.current.delete(id);
    }

    const currentModal = modals.find((m) => m.id === id);
    if (currentModal && typeof currentModal.onClose === 'function') {
      try {
        currentModal.onClose(result, opts);
      } catch { }
    }
  }, [finalizeRemoval, modals]);

  useEffect(() => () => {
    removalTimers.current.forEach((timer) => clearTimeout(timer));
    removalTimers.current.clear();
    resolverMap.current.clear();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    if (!body) return undefined;

    if (modals.length > 0) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = body.style.overflow;
      }
      body.style.overflow = 'hidden';
      return () => {
        body.style.overflow = bodyOverflowRef.current ?? '';
        bodyOverflowRef.current = null;
      };
    }

    return undefined;
  }, [modals.length]);

  useEffect(() => {
    if (modals.length === 0) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        const top = modals[modals.length - 1];
        if (top && top.dismissible) {
          event.preventDefault();
          closeModal(top.id, { dismissed: true, reason: 'escape' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal, modals]);

  const contextValue = useMemo(
    () => ({ showModal, closeModal }),
    [showModal, closeModal]
  );

  const content = modals.length > 0 ? (
    <div className="pointer-events-none fixed inset-0 z-[1300] flex flex-col">
      {modals.map((modal, index) => {
        const palette = variantPalette(modal.variant, isDark);
        const IconComponent = variantIcon(modal.variant);
        const zIndex = 1300 + index;
        const isTopModal = index === modals.length - 1;
        const sizeClass =
          modal.size === 'lg' || modal.size === 'large'
            ? 'max-w-3xl'
            : modal.size === 'sm'
              ? 'max-w-md'
              : modal.size === 'xs'
                ? 'max-w-sm'
                : modal.size === 'auto'
                  ? 'max-w-xl'
                  : 'max-w-2xl';
        const widthClass = modal.size === 'auto' ? 'w-auto max-w-full' : 'w-full';
        const anyAutoFocus = modal.actions.some((action) => action.autoFocus);
        const overlayStateClass = modal.entering || modal.exiting ? 'opacity-0' : 'opacity-100';
        const panelStateClass = modal.entering || modal.exiting
          ? 'translate-y-8 opacity-0 scale-95'
          : 'translate-y-0 opacity-100 scale-100';

        return (
          <div
            key={modal.id}
            className="pointer-events-none fixed inset-0 flex flex-col"
            style={{ zIndex }}
            aria-modal="true"
            role="dialog"
            aria-labelledby={`modal-${modal.id}-title`}
            aria-describedby={`modal-${modal.id}-description`}
          >
            <div
              className={cn(
                'pointer-events-auto absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
                overlayStateClass
              )}
              onClick={() => {
                if (modal.dismissible && modal.allowBackdropClose && isTopModal) {
                  closeModal(modal.id, { dismissed: true, reason: 'backdrop' });
                }
              }}
            />

            <div className="pointer-events-none relative flex min-h-full items-center justify-center px-4 py-10">
              <div
                className={cn(
                  'pointer-events-auto transform rounded-2xl border shadow-2xl ring-1 transition-all duration-200 flex flex-col',
                  isDark ? 'bg-gray-900 text-gray-50 border-gray-800' : 'bg-white text-gray-900 border-gray-200',
                  palette.ring,
                  widthClass,
                  panelStateClass,
                  sizeClass,
                  modal.className
                )}
                style={{ maxHeight: 'calc(100vh - 80px)' }}
              >
                {/* Fixed Header */}
                <div className={cn(
                  'flex gap-4 px-6 py-5 border-b flex-shrink-0',
                  modal.headerDescription ? 'items-start' : 'items-center',
                  isDark ? 'border-gray-800' : 'border-gray-200'
                )}>
                  <div className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                    palette.badge
                  )}>
                    {modal.icon ? modal.icon : <IconComponent className={cn('h-6 w-6', palette.accent)} aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {modal.title && (
                      <h2 id={`modal-${modal.id}-title`} className="text-xl font-semibold tracking-tight">
                        {modal.title}
                      </h2>
                    )}
                    {modal.headerDescription && (
                      <p className={cn(
                        'mt-1 text-xs',
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {modal.headerDescription}
                      </p>
                    )}
                  </div>
                  {modal.dismissible && (
                    <button
                      type="button"
                      className={cn(
                        'relative flex-shrink-0 rounded-full p-2 transition-colors',
                        modal.headerDescription ? '-mr-2 -mt-1' : '-mr-2',
                        isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                      )}
                      onClick={() => {
                        if (isTopModal) {
                          closeModal(modal.id, { dismissed: true, reason: 'close-button' });
                        }
                      }}
                      aria-label="Close dialog"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                  {(modal.description || modal.body || modal.component) && (
                    <div
                      id={`modal-${modal.id}-description`}
                      className="text-sm leading-relaxed text-gray-500 dark:text-gray-300"
                    >
                      {/* Render component-based modals */}
                      {modal.component === 'ConnectionDiagnostics' && (
                        <ConnectionDiagnosticsModal darkMode={isDark} />
                      )}
                      {modal.component === 'PreviewOutputs' && (
                        <PreviewOutputsModal darkMode={isDark} />
                      )}
                      {modal.component === 'ControlPanelHelp' && (
                        <ControlPanelHelp darkMode={isDark} />
                      )}
                      {modal.component === 'OutputSettingsHelp' && (
                        <OutputSettingsHelp darkMode={isDark} />
                      )}
                      {modal.component === 'SongCanvasHelp' && (
                        <SongCanvasHelp darkMode={isDark} />
                      )}
                      {modal.component === 'StageDisplayHelp' && (
                        <StageDisplayHelp darkMode={isDark} />
                      )}
                      {modal.component === 'MobileControllerHelp' && (
                        <MobileControllerHelp darkMode={isDark} />
                      )}
                      {modal.component === 'WelcomeSplash' && (
                        <WelcomeSplash darkMode={isDark} onOpenIntegration={modal.onOpenIntegration} />
                      )}
                      {modal.component === 'IntegrationInstructions' && (
                        <IntegrationInstructions darkMode={isDark} />
                      )}
                      {modal.component === 'SongInfoModal' && (
                        <SongInfoModal darkMode={isDark} />
                      )}
                      {modal.component === 'DisplayDetection' && (
                        <DisplayDetectionModal
                          darkMode={isDark}
                          displayInfo={modal.displayInfo}
                          displays={modal.displays}
                          isManualOpen={modal.isManualOpen || false}
                          isCurrentlyProjecting={modal.isCurrentlyProjecting || false}
                          onSave={async (config) => {
                            if (!window.electronAPI?.display) {
                              closeModal(modal.id, { error: 'Display API not available' });
                              return;
                            }

                            try {
                              if (config.action === 'project') {
                                await window.electronAPI.display.saveAssignment(
                                  config.displayId,
                                  config.selectedOutput
                                );

                                await window.electronAPI.display.openOutputOnDisplay(
                                  config.selectedOutput,
                                  config.displayId
                                );

                                closeModal(modal.id, { action: 'project', output: config.selectedOutput });
                              } else if (config.action === 'turnOff') {
                                const outputToClose = config.selectedOutput;

                                const closeResult = await window.electronAPI.display.closeOutputWindow(outputToClose);

                                if (closeResult.success) {
                                  await window.electronAPI.display.removeAssignment(config.displayId);
                                  closeModal(modal.id, { action: 'turnOff', output: outputToClose });
                                } else {
                                  console.error('Failed to close output window:', closeResult.error);
                                  closeModal(modal.id, { error: 'Failed to close output window' });
                                }
                              }
                            } catch (error) {
                              console.error('Error handling display action:', error);
                              closeModal(modal.id, { error: error.message });
                            }
                          }}
                          onCancel={() => {
                            closeModal(modal.id, { dismissed: true });
                          }}
                        />
                      )}
                      {modal.component === 'AutoplaySettings' && (
                        <AutoplaySettings
                          darkMode={isDark}
                          settings={modal.settings}
                          onSave={modal.onSave}
                          close={(value) => closeModal(modal.id, value)}
                        />
                      )}
                      {modal.component === 'IntelligentAutoplayInfo' && (
                        <IntelligentAutoplayInfo
                          darkMode={isDark}
                          onStart={() => {
                            if (modal.onStart) modal.onStart();
                            closeModal(modal.id, { action: 'start' });
                          }}
                          onClose={() => closeModal(modal.id, { dismissed: true })}
                          dontShowAgain={modal.dontShowAgain || false}
                          setDontShowAgain={modal.setDontShowAgain}
                        />
                      )}
                      {modal.component === 'OutputTemplates' && (
                        <OutputTemplatesModal
                          darkMode={isDark}
                          onApplyTemplate={(template) => {
                            if (modal.onApplyTemplate) modal.onApplyTemplate(template);
                            closeModal(modal.id, { action: 'applied', template });
                          }}
                          onClose={() => closeModal(modal.id, { dismissed: true })}
                        />
                      )}
                      {modal.component === 'StageTemplates' && (
                        <StageTemplatesModal
                          darkMode={isDark}
                          onApplyTemplate={(template) => {
                            if (modal.onApplyTemplate) modal.onApplyTemplate(template);
                            closeModal(modal.id, { action: 'applied', template });
                          }}
                          onClose={() => closeModal(modal.id, { dismissed: true })}
                        />
                      )}
                      {modal.component === 'AboutApp' && (
                        <AboutAppModal
                          darkMode={isDark}
                          version={modal.version}
                          onClose={(result) => closeModal(modal.id, result)}
                        />
                      )}

                      {/* Render standard description/body modals */}
                      {!modal.component && modal.description && (
                        <p className="whitespace-pre-wrap font-semibold">{modal.description}</p>
                      )}
                      {!modal.component && modal.body && (
                        <div className={cn("text-sm text-gray-500 dark:text-gray-300", modal.description && "mt-3")}>
                          {typeof modal.body === 'function'
                            ? modal.body({ close: (value) => closeModal(modal.id, value), isDark })
                            : modal.body}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fixed Footer with Actions */}
                {modal.actions.length > 0 && (
                  <div className={cn(
                    'flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0',
                    isDark ? 'border-gray-800' : 'border-gray-200'
                  )}>
                    {modal.actions.map((action, idx) => {
                      const buttonVariant = isDark
                        ? (action.variant || (action.destructive ? 'destructive' : 'outline'))
                        : (action.variant || (action.destructive ? 'destructive' : idx === 0 ? 'default' : 'outline'));
                      const darkTextClass = isDark
                        ? buttonVariant === 'destructive'
                          ? 'dark:text-red-200 dark:hover:text-red-100'
                          : 'bg-transparent border border-gray-500 text-white hover:text-white hover:border-gray-400 hover:bg-gray-800/40'
                        : '';
                      const destructiveOverride = buttonVariant === 'destructive'
                        ? isDark
                          ? '!bg-red-600 hover:!bg-red-700'
                          : '!bg-red-500 hover:!bg-red-600'
                        : '';
                      return (
                        <Button
                          key={`${modal.id}-action-${idx}`}
                          type="button"
                          variant={buttonVariant}
                          onClick={async () => {
                            if (!isTopModal || action.disabled) return;
                            let shouldClose = action.closeOnClick !== false;
                            let actionResult = action.value ?? action.label ?? true;
                            if (typeof action.onSelect === 'function') {
                              try {
                                const maybe = await action.onSelect();
                                if (typeof maybe !== 'undefined') {
                                  actionResult = maybe;
                                }
                              } catch (error) {
                                console.error('Modal action handler failed', error);
                              }
                            }
                            if (shouldClose) {
                              closeModal(modal.id, actionResult, { actionIndex: idx });
                            }
                          }}
                          className={cn('min-w-[96px] justify-center', darkTextClass, destructiveOverride, action.className)}
                          autoFocus={action.autoFocus ?? (!anyAutoFocus && idx === 0)}
                          disabled={action.disabled}
                        >
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div >
  ) : null;

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {typeof document !== 'undefined' ? createPortal(content, document.body) : null}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return ctx;
}