import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Info,
  LayoutGrid,
  Loader2,
  Trash2,
  User,
} from 'lucide-react';
import { stageTemplates } from '../utils/outputTemplates';
import { paintToCss } from '../utils/paint';
import useDelayedCardPreview from '../hooks/useDelayedCardPreview';
import useModal from '../hooks/useModal';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const getAlignment = (alignment) => {
  if (alignment === 'right') return 'right';
  if (alignment === 'center') return 'center';
  return 'left';
};

const StageTemplatePreview = ({ settings = {}, expanded = false }) => {
  const liveSize = expanded
    ? clamp((settings.liveFontSize || 72) / 3, 22, 38)
    : clamp((settings.liveFontSize || 72) / 6, 10, 15);
  const nextSize = expanded
    ? clamp((settings.nextFontSize || 48) / 3, 15, 24)
    : clamp((settings.nextFontSize || 48) / 6, 8, 11);
  const prevSize = expanded
    ? clamp((settings.prevFontSize || 32) / 3, 12, 18)
    : clamp((settings.prevFontSize || 32) / 6, 7, 10);

  const textStyle = (role) => {
    const prefix = role === 'live' ? 'live' : role === 'next' ? 'next' : 'prev';
    const fontSize = role === 'live' ? liveSize : role === 'next' ? nextSize : prevSize;
    return {
      color: settings[`${prefix}Color`] || (role === 'live' ? '#FFFFFF' : '#808080'),
      fontSize,
      fontStyle: settings[`${prefix}Italic`] ? 'italic' : 'normal',
      fontWeight: settings[`${prefix}Bold`] ? 700 : role === 'live' ? 600 : 400,
      textAlign: getAlignment(settings[`${prefix}Align`]),
      textDecoration: settings[`${prefix}Underline`] ? 'underline' : 'none',
      textTransform: settings[`${prefix}AllCaps`] ? 'uppercase' : 'none',
    };
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden ${expanded ? 'aspect-video px-8 py-6' : 'h-20 px-3 py-2'}`}
      style={{
        background: paintToCss(settings.backgroundPaint, settings.backgroundColor || '#000000'),
        fontFamily: settings.fontStyle || 'Inter',
      }}
      aria-hidden="true"
    >
      <div className={`flex items-center justify-between font-semibold uppercase tracking-[0.12em] ${expanded ? 'text-[11px]' : 'text-[7px]'}`}>
        <span style={{ color: settings.currentSongColor || '#FFFFFF' }}>Current song</span>
        {settings.showTime !== false && <span style={{ color: settings.bottomBarColor || '#FFFFFF' }}>10:24</span>}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col justify-center leading-none ${expanded ? 'gap-4' : 'gap-1'}`}>
        {settings.showPrevLine !== false && <div style={textStyle('prev')}>Previous lyric line</div>}
        <div style={textStyle('live')}>Current lyric line</div>
        {settings.showNextLine !== false && (
          <div className="flex items-center gap-1.5">
            {settings.showNextArrow !== false && (
              <span style={{ color: settings.nextArrowColor || '#FFA500', fontSize: nextSize }}>›</span>
            )}
            <div className="min-w-0 flex-1" style={textStyle('next')}>Next lyric line</div>
          </div>
        )}
      </div>
    </div>
  );
};

const StageTemplatesModal = ({ darkMode, onApplyTemplate, onClose }) => {
  const [activeTab, setActiveTab] = useState('presets');
  const [userTemplates, setUserTemplates] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState(stageTemplates[0]?.id || null);
  const [selectedSavedId, setSelectedSavedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { showModal } = useModal();
  const {
    beginCardHover,
    cancelCardHover,
    closeExpandedCard,
    endCardHover,
    expandedCard,
    expandedCardStyle,
    isExpanded,
    keepExpandedCardOpen,
  } = useDelayedCardPreview();

  useEffect(() => {
    let isMounted = true;

    const loadUserTemplates = async () => {
      if (!window.electronAPI?.templates?.load) return;

      setIsLoading(true);
      try {
        const result = await window.electronAPI.templates.load('stage');
        if (isMounted && result.success) {
          const templates = result.templates || [];
          setUserTemplates(templates);
          setSelectedSavedId((currentId) => (
            templates.some((template) => template.id === currentId)
              ? currentId
              : (templates[0]?.id || null)
          ));
        }
      } catch (error) {
        console.error('Error loading user templates:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadUserTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = useCallback(async (template, event) => {
    event.stopPropagation();

    if (!window.electronAPI?.templates?.delete) return;

    cancelCardHover();
    closeExpandedCard();

    const confirmation = await showModal({
      title: `Delete "${template.name}"?`,
      description: 'This saved stage display template will be permanently removed.',
      body: 'This action cannot be undone.',
      variant: 'warning',
      size: 'xs',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline', autoFocus: true },
        { label: 'Delete template', value: 'delete', variant: 'destructive' },
      ],
    });

    if (confirmation !== 'delete') return;

    setDeletingId(template.id);
    try {
      const result = await window.electronAPI.templates.delete('stage', template.id);
      if (result.success) {
        const remainingTemplates = userTemplates.filter((savedTemplate) => savedTemplate.id !== template.id);
        setUserTemplates(remainingTemplates);
        setSelectedSavedId((currentId) => (
          currentId === template.id ? (remainingTemplates[0]?.id || null) : currentId
        ));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setDeletingId(null);
    }
  }, [cancelCardHover, closeExpandedCard, showModal, userTemplates]);

  const selectedTemplate = useMemo(() => {
    if (activeTab === 'saved') {
      return userTemplates.find((template) => template.id === selectedSavedId) || null;
    }
    return stageTemplates.find((template) => template.id === selectedPresetId) || null;
  }, [activeTab, selectedPresetId, selectedSavedId, userTemplates]);

  const handleApply = () => {
    if (!selectedTemplate) return;
    const isUserTemplate = activeTab === 'saved';
    const template = isUserTemplate
      ? { ...selectedTemplate, title: selectedTemplate.name }
      : selectedTemplate;

    onApplyTemplate?.(template, isUserTemplate);
    onClose?.();
  };

  const renderTemplateCard = (template, isUserTemplate = false) => {
    const settings = template.settings || {};
    const title = isUserTemplate ? template.name : template.title;
    const cardKey = `${isUserTemplate ? 'saved' : 'preset'}:${template.id}`;
    const previewPayload = { template, isUserTemplate, settings, title };
    const selectedId = isUserTemplate ? selectedSavedId : selectedPresetId;
    const isSelected = selectedId === template.id;
    const isDeleting = deletingId === template.id;
    const selectTemplate = () => {
      if (isUserTemplate) setSelectedSavedId(template.id);
      else setSelectedPresetId(template.id);
    };

    return (
      <article
        key={cardKey}
        onMouseEnter={(event) => beginCardHover(cardKey, previewPayload, event.currentTarget)}
        onMouseLeave={() => endCardHover(cardKey)}
        className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${expandedCard?.key === cardKey && isExpanded ? 'opacity-0' : 'opacity-100'} ${isSelected
          ? darkMode
            ? 'border-emerald-400/80 bg-emerald-500/10 ring-2 ring-emerald-500/20'
            : 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/15'
          : darkMode
            ? 'border-white/10 bg-slate-900/65 hover:border-white/20 hover:bg-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
          }`}
      >
        <button
          type="button"
          onClick={selectTemplate}
          className="block w-full text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
          aria-pressed={isSelected}
          aria-label={`Select ${title}`}
        >
          <div className="relative overflow-hidden border-b border-white/10">
            <StageTemplatePreview settings={settings} />
            <span
              className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all ${isSelected
                ? 'border-emerald-400 bg-emerald-500 text-white opacity-100'
                : 'border-white/30 bg-black/25 text-transparent opacity-0 backdrop-blur-sm group-hover:opacity-100'
                }`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </div>

          <div className="p-2.5">
            <div className="flex items-start gap-2">
              {isUserTemplate && (
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${darkMode
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'bg-violet-100 text-violet-700'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className={`truncate text-[13px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {title}
                </h3>
                <p
                  className={`mt-0.5 min-h-4 text-[10px] leading-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  style={{
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 1,
                  }}
                >
                  {isUserTemplate ? 'Your saved stage display style, ready to use again.' : template.description}
                </p>
              </div>
            </div>

            <div className={`mt-2 flex items-center gap-2 border-t pt-2 text-[10px] ${darkMode
              ? 'border-white/8 text-slate-400'
              : 'border-slate-100 text-slate-500'
              }`}
            >
              <span className="truncate font-medium">{settings.fontStyle || 'Default font'}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">Live {settings.liveFontSize || 72}px</span>
            </div>
          </div>
        </button>

        {isUserTemplate && (
          <div className={`flex min-h-10 items-center justify-between gap-2 border-t px-2.5 py-1.5 ${darkMode
            ? 'border-white/8 bg-slate-950/20'
            : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-500">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {template.createdAt
                  ? `Saved ${new Date(template.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Saved template'}
              </span>
            </span>
            <button
              type="button"
              onClick={(event) => handleDelete(template, event)}
              onMouseEnter={cancelCardHover}
              onMouseLeave={(event) => {
                const cardElement = event.currentTarget.closest('article');
                if (cardElement?.contains(event.relatedTarget)) {
                  beginCardHover(cardKey, previewPayload, cardElement);
                }
              }}
              disabled={isDeleting}
              className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${darkMode
                ? 'text-slate-400 hover:bg-red-500/10 hover:text-red-300'
                : 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                }`}
              aria-label={`Delete ${title}`}
              title="Delete template"
            >
              {isDeleting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>
          </div>
        )}
      </article>
    );
  };

  const activeCount = activeTab === 'presets' ? stageTemplates.length : userTemplates.length;
  const selectedTitle = selectedTemplate
    ? (activeTab === 'saved' ? selectedTemplate.name : selectedTemplate.title)
    : null;
  const expandedTemplate = expandedCard?.payload || null;

  return (
    <>
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className={`shrink-0 border-b px-4 py-3 sm:px-6 ${darkMode
        ? 'border-white/5 bg-slate-950/20'
        : 'border-slate-100 bg-white'
        }`}
      >
        <div
          className={`grid grid-cols-2 gap-1 rounded-xl p-1 ${darkMode ? 'bg-slate-950/70' : 'bg-slate-100'}`}
          role="tablist"
          aria-label="Template sources"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'presets'}
            onClick={() => {
              closeExpandedCard();
              setActiveTab('presets');
            }}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${activeTab === 'presets'
              ? darkMode
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : darkMode
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Curated presets
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === 'presets'
              ? darkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              : darkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              {stageTemplates.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saved'}
            onClick={() => {
              closeExpandedCard();
              setActiveTab('saved');
            }}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${activeTab === 'saved'
              ? darkMode
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : darkMode
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <User className="h-3.5 w-3.5" />
            Saved by you
            {userTemplates.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === 'saved'
                ? darkMode ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'
                : darkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                {userTemplates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 ${darkMode ? 'bg-slate-950/35' : 'bg-slate-50/70'}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {activeTab === 'presets'
              ? 'Select a template, or pause over a card for 2 seconds to inspect it.'
              : 'Reuse or manage the stage looks you have saved.'}
          </p>
          <span className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {activeCount} {activeCount === 1 ? 'style' : 'styles'}
          </span>
        </div>

        {activeTab === 'saved' && isLoading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className={`h-40 animate-pulse rounded-xl border ${darkMode
                  ? 'border-white/5 bg-white/5'
                  : 'border-slate-200 bg-slate-100'
                  }`}
              />
            ))}
          </div>
        ) : activeTab === 'saved' && userTemplates.length === 0 ? (
          <div className={`flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center ${darkMode
            ? 'border-white/10 bg-white/[0.025]'
            : 'border-slate-300 bg-white'
            }`}
          >
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${darkMode
              ? 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/15'
              : 'bg-violet-50 text-violet-600 ring-1 ring-violet-100'
              }`}
            >
              <User className="h-6 w-6" />
            </div>
            <h3 className={`text-sm font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Your saved stage looks will live here
            </h3>
            <p className={`mt-2 max-w-sm text-xs leading-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Fine-tune the Stage Display, then use the save icon in Stage Settings to keep it as a reusable template.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {activeTab === 'presets'
              ? stageTemplates.map((template) => renderTemplateCard(template, false))
              : userTemplates.map((template) => renderTemplateCard(template, true))}
          </div>
        )}
      </div>

      <div className={`shrink-0 border-t px-4 py-3.5 sm:px-6 ${darkMode
        ? 'border-white/5 bg-slate-900'
        : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <p className={`text-[11px] leading-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedTitle
                ? <><span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{selectedTitle}</span> will replace the current stage display settings.</>
                : 'Select a saved template to continue.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedTemplate}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:ring-offset-slate-900"
          >
            Apply template
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
    {expandedTemplate && typeof document !== 'undefined' && createPortal(
      <div
        style={expandedCardStyle}
        onMouseEnter={keepExpandedCardOpen}
        onMouseLeave={closeExpandedCard}
        aria-hidden="true"
      >
        <article className={`flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_28px_80px_rgba(2,6,23,0.48)] ring-1 ${darkMode
          ? 'border-slate-600/80 bg-slate-900 ring-white/10'
          : 'border-slate-300 bg-white ring-black/5'
          }`}
        >
          <div className="relative shrink-0 overflow-hidden border-b border-white/10">
            <StageTemplatePreview settings={expandedTemplate.settings} expanded />
          </div>
          <div className={`flex h-28 shrink-0 flex-col justify-center px-4 py-3 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-base font-semibold tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>
              {expandedTemplate.title}
            </h3>
            <p className={`mt-1 text-xs leading-4 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {expandedTemplate.isUserTemplate
                ? 'Your saved stage display style, ready to use again.'
                : expandedTemplate.template.description}
            </p>
            <div className={`mt-2 flex items-center gap-2 text-[10px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{expandedTemplate.settings.fontStyle || 'Default font'}</span>
              <span aria-hidden="true">·</span>
              <span>Live {expandedTemplate.settings.liveFontSize || 72}px</span>
              <span aria-hidden="true">·</span>
              <span>Next {expandedTemplate.settings.nextFontSize || 48}px</span>
            </div>
          </div>
        </article>
      </div>,
      document.body
    )}
    </>
  );
};

export default StageTemplatesModal;
