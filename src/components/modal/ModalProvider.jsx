import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import ConnectionDiagnosticsModal from '../ConnectionDiagnosticsModal';
import PreviewOutputsModal from '../PreviewOutputsModal';
import { ControlPanelHelp, OutputSettingsHelp, SongCanvasHelp, LyricVideoStudioHelp, StageDisplayHelp, MobileControllerHelp, ObsWebSocketHelp } from '../HelpContent';
import { WelcomeSplash } from '../WelcomeSplash';
import { IntegrationInstructions } from '../IntegrationInstructions';
import SongInfoModal from '../SongInfoModal';
import ProjectOutputModal from '../ProjectOutputModal';
import AutoplaySettings from '../AutoplaySettings';
import IntelligentAutoplayInfo from '../IntelligentAutoplayInfo';
import OutputTemplatesModal from '../OutputTemplatesModal';
import StageTemplatesModal from '../StageTemplatesModal';
import SaveTemplateModal from '../SaveTemplateModal';
import AboutAppModal from '../AboutAppModal';
import SetlistExportModal from '../SetlistExportModal';
import UserPreferencesModal from '../UserPreferencesModal';
import NdiOutputSettingsModal from '../NdiOutputSettingsModal';
import UserMediaModal from '../UserMediaModal';
import PreServiceHealthModal from '../PreServiceHealthModal';
import OperatorActionLogModal from '../OperatorActionLogModal';
import ObsDockInfoModal from '../ObsDockInfoModal';
import { cn } from '@/lib/utils';
import { REQUEST_MODAL_CLOSE_EVENT } from '@/constants/modalEvents';
import { ModalActionButton, ModalFooter } from './modalActions';

export const ModalContext = createContext(null);

let modalIdSeq = 1;
const animationDuration = 220;
const MAX_OPEN_GLOBAL_MODALS = 3;
const RESERVED_CONFIG_KEYS = new Set([
  'variant',
  'title',
  'description',
  'message',
  'headerDescription',
  'body',
  'component',
  'dismissible',
  'actions',
  'allowBackdropClose',
  'onClose',
  'className',
  'size',
  'icon',
  'dismissLabel',
  'scrollBehavior',
  'dedupeKey',
  'modalKey',
  'id',
  'entering',
  'exiting',
]);

const resolveModalDedupeKey = (config = {}) => {
  if (config.dedupeKey === false) return null;
  if (typeof config.dedupeKey === 'string' && config.dedupeKey.trim()) {
    return config.dedupeKey.trim();
  }
  if (typeof config.modalKey === 'string' && config.modalKey.trim()) {
    return config.modalKey.trim();
  }
  if (typeof config.component === 'string' && config.component.trim()) {
    return `component:${config.component.trim()}`;
  }
  if (Array.isArray(config.actions) && config.actions.some((action) => typeof action?.onSelect === 'function')) {
    return null;
  }

  const title = typeof config.title === 'string' ? config.title.trim() : '';
  const text = typeof (config.description ?? config.message) === 'string'
    ? (config.description ?? config.message).trim()
    : (typeof config.body === 'string' ? config.body.trim() : '');
  if (title && text) {
    return `standard:${title}|${text}`;
  }
  if (title && !Array.isArray(config.actions)) {
    return `standard:${title}`;
  }
  return null;
};

const buildModalConfig = (id, config = {}) => {
  const normalizedVariant = (config.variant || 'info').toLowerCase();
  const hasExplicitActions = Array.isArray(config.actions);
  const modal = {
    id,
    dedupeKey: resolveModalDedupeKey(config),
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
    scrollBehavior: config.scrollBehavior || 'auto',
    ...Object.keys(config).reduce((acc, key) => {
      if (!RESERVED_CONFIG_KEYS.has(key)) {
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

  return modal;
};

const mergeDisplays = (...displayLists) => {
  const merged = new Map();

  displayLists.flat().forEach((display) => {
    if (!display) return;
    const id = display.id ?? display.displayId ?? display.name ?? display.label;
    if (id === null || typeof id === 'undefined') return;
    const key = String(id);
    merged.set(key, { ...(merged.get(key) || {}), ...display });
  });

  return Array.from(merged.values());
};

const updateProjectOutputDetectionCopy = (modal) => {
  if (modal.component !== 'ProjectOutput' || modal.triggerSource === 'manual') return modal;

  const displayCount = Array.isArray(modal.detectedDisplays) ? modal.detectedDisplays.length : 0;
  if (displayCount < 1) return modal;

  const isStartupCheck = modal.triggerSource === 'startup';
  return {
    ...modal,
    title: isStartupCheck
      ? (displayCount > 1 ? `${displayCount} External Displays Detected` : 'External Display Detected')
      : (displayCount > 1 ? `${displayCount} New Displays Detected` : 'New Display Detected'),
    headerDescription: isStartupCheck
      ? (displayCount > 1 ? 'Multiple external displays are connected. Configure how to use them.' : 'An external display is connected. Configure how to use it.')
      : (displayCount > 1 ? 'Configure how to use the newly connected displays' : 'Configure how to use the newly connected display'),
  };
};

const mergeDuplicateModal = (existing, config = {}) => {
  let next = {
    ...buildModalConfig(existing.id, {
      ...existing,
      ...config,
      actions: Array.isArray(config.actions) ? config.actions : existing.actions,
    }),
    entering: false,
    exiting: false,
  };

  if (next.component === 'ProjectOutput') {
    const detectedDisplays = mergeDisplays(
      existing.detectedDisplays || existing.displays || [],
      config.detectedDisplays || config.displays || []
    );

    if (detectedDisplays.length > 0) {
      next = {
        ...next,
        displays: detectedDisplays,
        detectedDisplays,
        displayInfo: detectedDisplays[0],
        preferredDisplayId: config.preferredDisplayId ?? existing.preferredDisplayId ?? detectedDisplays[0]?.id,
        triggerSource: config.triggerSource || existing.triggerSource || 'manual',
      };
    }

    next = updateProjectOutputDetectionCopy(next);
  }

  return next;
};

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
  const modalPromises = useRef(new Map());
  const removalTimers = useRef(new Map());
  const modalsRef = useRef([]);
  const queuedModals = useRef([]);
  const bodyOverflowRef = useRef(null);
  const topMenuHeight = useMemo(() => {
    if (typeof document === 'undefined') return '0px';
    const val = getComputedStyle(document.body).getPropertyValue('--top-menu-height');
    return val && val.trim() ? val.trim() : '0px';
  }, [modals.length]);

  const setModalStack = useCallback((nextModals) => {
    modalsRef.current = nextModals;
    setModals(nextModals);
  }, []);

  const scheduleEnterAnimation = useCallback((id) => {
    requestAnimationFrame(() => {
      setModalStack(
        modalsRef.current.map((m) => (m.id === id ? { ...m, entering: false } : m))
      );
    });
  }, [setModalStack]);

  const promoteQueuedModals = useCallback(() => {
    const availableSlots = MAX_OPEN_GLOBAL_MODALS - modalsRef.current.length;
    if (availableSlots <= 0 || queuedModals.current.length === 0) return;

    const promotedEntries = queuedModals.current.splice(0, availableSlots);
    const promotedModals = promotedEntries.map((entry) => ({
      ...entry.modal,
      entering: true,
      exiting: false,
    }));

    setModalStack([...modalsRef.current, ...promotedModals]);
    promotedModals.forEach((modal) => scheduleEnterAnimation(modal.id));
  }, [scheduleEnterAnimation, setModalStack]);

  const updateDuplicateModal = useCallback((dedupeKey, config) => {
    const activeModal = modalsRef.current.find((modal) => (
      modal.dedupeKey === dedupeKey && !modal.exiting
    ));

    if (activeModal) {
      const updatedModal = mergeDuplicateModal(activeModal, config);
      setModalStack(
        modalsRef.current.map((modal) => (modal.id === activeModal.id ? updatedModal : modal))
      );
      return modalPromises.current.get(activeModal.id) || null;
    }

    const queuedEntry = queuedModals.current.find((entry) => (
      entry.modal.dedupeKey === dedupeKey
    ));

    if (queuedEntry) {
      queuedEntry.modal = mergeDuplicateModal(queuedEntry.modal, config);
      return modalPromises.current.get(queuedEntry.modal.id) || null;
    }

    return null;
  }, [setModalStack]);

  const showModal = useCallback((config = {}) => {
    const dedupeKey = resolveModalDedupeKey(config);
    if (dedupeKey) {
      const existingPromise = updateDuplicateModal(dedupeKey, config);
      if (existingPromise) return existingPromise;
    }

    const id = modalIdSeq++;
    const modal = buildModalConfig(id, config);
    let resolveModal;
    const promise = new Promise((resolve) => {
      resolveModal = resolve;
    });

    resolverMap.current.set(id, resolveModal);
    modalPromises.current.set(id, promise);

    if (modalsRef.current.length >= MAX_OPEN_GLOBAL_MODALS) {
      queuedModals.current.push({ modal });
      return promise;
    }

    setModalStack([...modalsRef.current, modal]);
    scheduleEnterAnimation(id);
    return promise;
  }, [scheduleEnterAnimation, setModalStack, updateDuplicateModal]);

  const finalizeRemoval = useCallback((id) => {
    setModalStack(modalsRef.current.filter((m) => m.id !== id));
    removalTimers.current.delete(id);
    modalPromises.current.delete(id);
    promoteQueuedModals();
  }, [promoteQueuedModals, setModalStack]);

  const closeModal = useCallback((id, result, opts = {}) => {
    setModalStack(modalsRef.current.map((m) => (m.id === id ? { ...m, exiting: true } : m)));

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

    const currentModal = modalsRef.current.find((m) => m.id === id);
    if (currentModal && typeof currentModal.onClose === 'function') {
      try {
        currentModal.onClose(result, opts);
      } catch { }
    }
  }, [finalizeRemoval, setModalStack]);

  useEffect(() => () => {
    removalTimers.current.forEach((timer) => clearTimeout(timer));
    removalTimers.current.clear();
    resolverMap.current.clear();
    modalPromises.current.clear();
    queuedModals.current = [];
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

    const registerCloseCandidate = (event) => {
      const top = modals[modals.length - 1];
      if (!top) return;
      const detail = event?.detail;
      if (!detail || !Array.isArray(detail.candidates)) return;

      const priority = 1300 + (modals.length - 1);
      if (top.dismissible) {
        detail.candidates.push({
          priority,
          close: () => closeModal(top.id, { dismissed: true, reason: 'escape' }),
        });
        return;
      }

      // Non-dismissible top modal consumes Esc to prevent underlying modal closures.
      detail.candidates.push({
        priority,
        close: () => { },
      });
    };

    window.addEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
    return () => window.removeEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
  }, [closeModal, modals]);

  const contextValue = useMemo(
    () => ({ showModal, closeModal }),
    [showModal, closeModal]
  );

  const modalMaxHeight = `calc(100vh - ${topMenuHeight} - 80px)`;

  const content = modals.length > 0 ? (
    <div
      className="pointer-events-none fixed inset-0 z-[1300] flex flex-col">
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
        const defaultFocusIndex = anyAutoFocus ? -1 : Math.max(0, modal.actions.length - 1);
        const overlayStateClass = modal.entering || modal.exiting ? 'opacity-0' : 'opacity-100';
        const panelStateClass = modal.entering || modal.exiting
          ? 'translate-y-8 opacity-0 scale-95'
          : isTopModal
            ? 'opacity-100'
            : 'translate-y-2 opacity-90 scale-[0.98]';

        return (
          <div
            key={modal.id}
            className="pointer-events-none fixed inset-0 flex flex-col"
            style={{ zIndex, top: topMenuHeight }}
            aria-modal={isTopModal ? 'true' : undefined}
            aria-hidden={isTopModal ? undefined : 'true'}
            role={isTopModal ? 'dialog' : undefined}
            aria-labelledby={isTopModal ? `modal-${modal.id}-title` : undefined}
            aria-describedby={isTopModal ? `modal-${modal.id}-description` : undefined}
          >
            <div
              className={cn(
                'absolute inset-0 transition-opacity duration-200',
                isTopModal
                  ? cn('pointer-events-auto bg-black/40 backdrop-blur-sm', overlayStateClass)
                  : 'pointer-events-none bg-transparent opacity-0 backdrop-blur-0'
              )}
              onClick={() => {
                if (modal.dismissible && modal.allowBackdropClose && isTopModal) {
                  closeModal(modal.id, { dismissed: true, reason: 'backdrop' });
                }
              }}
            />

            <div
              className="pointer-events-none relative flex h-full items-center justify-center px-4 py-10">
              <div
                className={cn(
                  'pointer-events-auto rounded-2xl border ring-1 transition-all duration-200 flex min-h-0 flex-col overflow-hidden',
                  isDark ? 'bg-gray-900 text-gray-50 border-slate-800/80' : 'bg-white text-gray-900 border-slate-200/80',
                  palette.ring,
                  isTopModal ? 'shadow-2xl' : 'shadow-xl',
                  widthClass,
                  panelStateClass,
                  sizeClass,
                  modal.className
                )}
                data-modal-root="true"
                style={{ maxHeight: modalMaxHeight }}
              >
                {/* Fixed Header */}
                <div className={cn(
                  'flex gap-4 border-b px-6 py-5 shrink-0',
                  modal.headerDescription ? 'items-start' : 'items-center',
                  isDark ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'
                )}>
                  <div className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ring-white/25',
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
                        'relative shrink-0 rounded-full p-2 transition-colors',
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
                <div className={cn(
                  'min-h-0 flex-1',
                  modal.customLayout ? 'overflow-hidden' : 'px-6 py-5',
                  !modal.customLayout && (modal.scrollBehavior === 'scroll' ? 'overflow-y-scroll' : 'overflow-y-auto')
                )}>
                  {(modal.description || modal.body || modal.component) && (
                    <div
                      id={`modal-${modal.id}-description`}
                      className={cn(
                        modal.customLayout ? 'h-full min-h-0' : 'text-sm leading-relaxed text-gray-500 dark:text-gray-300'
                      )}
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
                      {modal.component === 'LyricVideoStudioHelp' && (
                        <LyricVideoStudioHelp darkMode={isDark} />
                      )}
                      {modal.component === 'StageDisplayHelp' && (
                        <StageDisplayHelp darkMode={isDark} />
                      )}
                      {modal.component === 'MobileControllerHelp' && (
                        <MobileControllerHelp darkMode={isDark} />
                      )}
                      {modal.component === 'ObsWebSocketHelp' && (
                        <ObsWebSocketHelp darkMode={isDark} />
                      )}
                      {modal.component === 'WelcomeSplash' && (
                        <WelcomeSplash darkMode={isDark} onOpenIntegration={modal.onOpenIntegration} />
                      )}
                      {modal.component === 'IntegrationInstructions' && (
                        <IntegrationInstructions
                          darkMode={isDark}
                          onRequestClose={() => closeModal(modal.id, { action: 'open-obs-source-creator' })}
                        />
                      )}
                      {modal.component === 'SongInfoModal' && (
                        <SongInfoModal darkMode={isDark} />
                      )}
                      {modal.component === 'ProjectOutput' && (
                        <ProjectOutputModal
                          darkMode={isDark}
                          preferredDisplayId={modal.preferredDisplayId}
                          triggerSource={modal.triggerSource || 'manual'}
                          detectedDisplays={modal.detectedDisplays || modal.displays || []}
                          initialOutputKey={modal.initialOutputKey}
                          extraOutputOptions={modal.extraOutputOptions}
                          onOpenIntegrationGuide={() => {
                            closeModal(modal.id, { action: 'open-integration-guide' });
                            showModal({
                              title: 'Streaming Software Integration',
                              headerDescription: 'Connect LyricDisplay to OBS, vMix, Wirecast and more',
                              component: 'IntegrationInstructions',
                              variant: 'info',
                              size: 'lg',
                              customLayout: true,
                              dismissLabel: 'Close'
                            });
                          }}
                          onClose={(result) => closeModal(modal.id, result || { dismissed: true })}
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
                      {modal.component === 'SaveTemplate' && (
                        <SaveTemplateModal
                          darkMode={isDark}
                          templateType={modal.templateType}
                          settings={modal.settings}
                          onSave={modal.onSave}
                          close={(value) => closeModal(modal.id, value)}
                        />
                      )}
                      {modal.component === 'AboutApp' && (
                        <AboutAppModal
                          darkMode={isDark}
                          version={modal.version}
                          onClose={(result) => closeModal(modal.id, result)}
                        />
                      )}
                      {modal.component === 'SetlistExport' && (
                        <SetlistExportModal
                          darkMode={isDark}
                          onExport={modal.onExport}
                          defaultTitle={modal.defaultTitle || 'Setlist'}
                          setExportState={modal.setExportState}
                        />
                      )}
                      {modal.component === 'UserPreferences' && (
                        <UserPreferencesModal
                          darkMode={isDark}
                          initialCategory={modal.initialCategory}
                          onClose={() => closeModal(modal.id, { dismissed: true })}
                        />
                      )}
                      {modal.component === 'NdiOutputSettings' && (
                        <NdiOutputSettingsModal
                          darkMode={isDark}
                          outputKey={modal.outputKey}
                          onClose={() => closeModal(modal.id, { dismissed: true })}
                        />
                      )}
                      {modal.component === 'UserMedia' && (
                        <UserMediaModal
                          darkMode={isDark}
                          allowedTypes={modal.allowedTypes}
                          initialTab={modal.initialTab}
                          description={modal.mediaDescription}
                          onSelect={modal.onSelect}
                          onClose={(result) => closeModal(modal.id, result || { dismissed: true })}
                        />
                      )}
                      {modal.component === 'PreServiceHealth' && (
                        <PreServiceHealthModal darkMode={isDark} />
                      )}
                      {modal.component === 'OperatorActionLog' && (
                        <OperatorActionLogModal darkMode={isDark} />
                      )}
                      {modal.component === 'ObsDockInfo' && (
                        <ObsDockInfoModal darkMode={isDark} />
                      )}

                      {/* Render standard description/body modals */}
                      {!modal.component && modal.description && (
                        <p className="whitespace-pre-wrap font-semibold">{modal.description}</p>
                      )}
                      {!modal.component && modal.body && (
                        <div
                          className={cn("text-sm text-gray-500 dark:text-gray-300", modal.description && "mt-3")}
                          style={typeof modal.body === 'string' ? { whiteSpace: 'pre-wrap' } : undefined}
                        >
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
                  <ModalFooter darkMode={isDark}>
                    {modal.actions.map((action, idx) => {
                      return (
                        <ModalActionButton
                          key={`${modal.id}-action-${idx}`}
                          type="button"
                          action={action}
                          actionIndex={idx}
                          actionCount={modal.actions.length}
                          darkMode={isDark}
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
                          className={action.className}
                          autoFocus={action.autoFocus ?? idx === defaultFocusIndex}
                          disabled={action.disabled}
                        >
                          {action.label}
                        </ModalActionButton>
                      );
                    })}
                  </ModalFooter>
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
