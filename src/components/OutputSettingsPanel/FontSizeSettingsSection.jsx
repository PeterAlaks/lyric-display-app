import { Languages, ListStart, TextCursorInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { AdvancedCollapse, AdvancedToggle, LabelWithIcon } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const getAutosizerDisplayState = (settings) => {
  const baseFont = Number.isFinite(settings.fontSize) ? settings.fontSize : 24;
  const instanceCount = settings.instanceCount || 0;
  const hasMultipleInstances = instanceCount > 1;
  const allInstances = settings.allInstances || [];

  let anyInstanceResizing = false;
  let primaryAdjustedSize = null;

  if (settings.maxLinesEnabled && instanceCount > 0) {
    if (hasMultipleInstances && allInstances.length > 0) {
      anyInstanceResizing = allInstances.some((inst) => inst.autosizerActive === true);
      const primaryInstance = allInstances.reduce((largest, current) => {
        if (!largest) return current;
        const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
        const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
        return currentArea > largestArea ? current : largest;
      }, null);
      primaryAdjustedSize = primaryInstance?.adjustedFontSize ?? null;
    } else if (allInstances.length > 0) {
      const singleInstance = allInstances[0];
      anyInstanceResizing = Boolean(singleInstance?.autosizerActive);
      primaryAdjustedSize = singleInstance?.adjustedFontSize ?? null;
    } else if (settings.autosizerActive) {
      anyInstanceResizing = true;
      primaryAdjustedSize = null;
    }
  }

  const primaryInstanceResizing = anyInstanceResizing && primaryAdjustedSize !== null && primaryAdjustedSize !== baseFont;
  const displayFontSize = primaryInstanceResizing ? primaryAdjustedSize : baseFont;

  const primaryViewport = settings.primaryViewportWidth && settings.primaryViewportHeight
    ? `${settings.primaryViewportWidth}x${settings.primaryViewportHeight}`
    : null;

  let inputDisplayValue = displayFontSize;
  if (hasMultipleInstances && anyInstanceResizing && allInstances.length > 0) {
    const primaryValue = displayFontSize;
    const otherResizingInstance = allInstances.find((inst) =>
      inst.autosizerActive === true &&
      inst.adjustedFontSize !== primaryValue
    );

    if (otherResizingInstance) {
      const otherValue = otherResizingInstance.adjustedFontSize ?? baseFont;
      inputDisplayValue = allInstances.length > 2
        ? `${primaryValue}, ${otherValue}...`
        : `${primaryValue}, ${otherValue}`;
    } else if (allInstances.length > 1) {
      inputDisplayValue = `${primaryValue}...`;
    }
  }

  let tooltipText = '';
  if (anyInstanceResizing) {
    if (hasMultipleInstances) {
      tooltipText = `Auto-resizing active on ${instanceCount} displays\n\nPrimary (${primaryViewport}): ${displayFontSize}px`;
      if (allInstances.length > 0) {
        allInstances.forEach((inst, idx) => {
          const viewport = `${inst.viewportWidth}x${inst.viewportHeight}`;
          const size = inst.adjustedFontSize ?? baseFont;
          tooltipText += `\nDisplay ${idx + 1} (${viewport}): ${size}px`;
        });
      }
      tooltipText += `\n\nPreferred size: ${settings.fontSize}px`;
    } else {
      tooltipText = `Auto-resizing active: ${displayFontSize}px (preferred: ${settings.fontSize}px)`;
    }
  } else {
    tooltipText = 'Set the preferred font size in pixels';
  }

  return {
    anyInstanceResizing,
    displayFontSize,
    inputDisplayValue,
    primaryInstanceResizing,
    tooltipText,
  };
};

const AutosizerIcon = () => (
  <span className="inline-flex items-center justify-center" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2zm7 11l1.1 2.4L23 16l-2.4 1.1L19 19l-1.1-2.4L15 16l2.4-1.1L19 13zM3 13l1.1 2.4L6 16l-2.4 1.1L3 19l-1.1-2.4L0 16l2.4-1.1L3 13z" fill="url(#spark-grad)" />
    </svg>
  </span>
);

const FontSizeSettingsSection = ({
  currentFontSize,
  darkMode,
  fontSizeAdvancedExpanded,
  handleTranslationFontSizeChange,
  handleTranslationFontSizeModeChange,
  maxLinesEnabled,
  setFontSizeAdvancedExpanded,
  settings,
  translationFontSize,
  translationFontSizeMode,
  update,
}) => {
  const {
    anyInstanceResizing,
    displayFontSize,
    inputDisplayValue,
    primaryInstanceResizing,
    tooltipText,
  } = getAutosizerDisplayState(settings);

  const innerClassBase = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust text size in pixels (24-300)" side="right">
          <LabelWithIcon icon={TextCursorInput} text="Font Size" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontSizeAdvancedExpanded ? 'Hide advanced settings' : 'Show advanced settings'} side="top">
            <AdvancedToggle
              expanded={fontSizeAdvancedExpanded}
              onToggle={() => setFontSizeAdvancedExpanded(!fontSizeAdvancedExpanded)}
              darkMode={darkMode}
              ariaLabel="Toggle font size advanced settings"
            />
          </Tooltip>
          <div className={`flex items-center ${anyInstanceResizing ? 'gap-2' : ''}`} aria-live={anyInstanceResizing ? 'polite' : undefined}>
            {anyInstanceResizing && (
              <span title={tooltipText}>
                <AutosizerIcon />
              </span>
            )}
            <div className="relative flex-1">
              {settings.instanceCount > 1 && anyInstanceResizing && primaryInstanceResizing ? (
                <div
                  className={`w-24 h-9 px-3 flex items-center justify-start text-sm rounded-md border cursor-not-allowed ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-500'
                    : 'bg-gray-50 border-gray-300 text-gray-500'
                    }`}
                  style={{ fontWeight: 400 }}
                  title={tooltipText}
                >
                  {inputDisplayValue}
                </div>
              ) : (
                <Input
                  type="number"
                  value={Number.isFinite(displayFontSize) ? displayFontSize : 24}
                  onChange={(e) => {
                    const next = sanitizeIntegerInput(
                      e.target.value,
                      settings.fontSize ?? 24,
                      { min: 24, max: 300, clampMin: false }
                    );
                    update('fontSize', next);
                  }}
                  min="24"
                  max="300"
                  disabled={primaryInstanceResizing}
                  className={`w-24 ${innerClassBase} ${primaryInstanceResizing ? 'opacity-80 cursor-not-allowed' : ''}`}
                  title={tooltipText}
                />
              )}
            </div>
          </div>
          <Tooltip content="Enable adaptive text fitting with max lines limit" side="top">
            <Button
              size="icon"
              variant="outline"
              onClick={() => update('maxLinesEnabled', !settings.maxLinesEnabled)}
              className={
                settings.maxLinesEnabled
                  ? darkMode
                    ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                    : '!bg-black !text-white hover:!bg-black !border-gray-300'
                  : darkMode
                    ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                    : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
              }
            >
              <ListStart className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <AdvancedCollapse expanded={fontSizeAdvancedExpanded}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Max Lines
            </label>
            <Input
              type="number"
              value={settings.maxLines ?? 3}
              onChange={(e) => update(
                'maxLines',
                sanitizeIntegerInput(e.target.value, settings.maxLines ?? 3, { min: 1, max: 10 })
              )}
              min="1"
              max="10"
              disabled={!maxLinesEnabled}
              className={`w-16 ${innerClassBase} ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Min Font Size
            </label>
            <Input
              type="number"
              value={settings.minFontSize ?? 24}
              onChange={(e) => update(
                'minFontSize',
                sanitizeIntegerInput(
                  e.target.value,
                  settings.minFontSize ?? 24,
                  { min: 12, max: 100, clampMin: false }
                )
              )}
              min="12"
              max="100"
              disabled={!maxLinesEnabled}
              className={`w-16 ${innerClassBase} ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between w-full">
          <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Translation Size
          </label>

          <div className="flex items-center gap-2">
            <Select
              value={translationFontSizeMode}
              onValueChange={handleTranslationFontSizeModeChange}
            >
              <SelectTrigger className={`w-[120px] ${innerClassBase}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                <SelectItem value="bound">Bound</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {translationFontSizeMode === 'custom' && (
              <Tooltip content={`Translation font size (max: ${currentFontSize}px)`} side="top">
                <div className="flex items-center gap-2">
                  <Languages className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <Input
                    type="number"
                    value={translationFontSize}
                    onChange={(e) => handleTranslationFontSizeChange(e.target.value)}
                    min="12"
                    max={currentFontSize}
                    className={`w-16 ${innerClassBase}`}
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </AdvancedCollapse>
    </div>
  );
};

export default FontSizeSettingsSection;
