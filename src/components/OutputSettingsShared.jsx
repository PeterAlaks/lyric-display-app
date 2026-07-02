import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, TextCursorInput, PaintBucket, Bold, Italic, Underline, CaseUpper, AlignVerticalSpaceAround, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import { sanitizeIntegerInput } from '../utils/numberInput';

export const LabelWithIcon = ({ icon: Icon, text, darkMode }) => (
  <div className="flex items-center gap-2 min-w-[140px]">
    <Icon className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
    <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
  </div>
);

export const blurInputOnEnter = (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;

  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  requestAnimationFrame(() => {
    if (typeof target.blur === 'function') {
      target.blur();
    }
  });
};

const compactOptionButtonClass = '!h-9 !w-9 rounded-md [&_svg]:!size-3.5';

export const AdvancedToggle = ({ expanded, onToggle, darkMode, ariaLabel, disabled = false, className = '' }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`p-1 rounded transition-colors ${darkMode
      ? 'hover:bg-gray-700 text-gray-400'
      : 'hover:bg-gray-100 text-gray-500'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    aria-label={ariaLabel}
  >
    {expanded ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    )}
  </button>
);

const advancedCollapseTransition = {
  gridTemplateRows: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  marginTop: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  opacity: { duration: 0.2, ease: 'easeOut' },
  y: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

export const AdvancedCollapse = React.forwardRef(({
  expanded,
  children,
  className = '',
  contentClassName = '',
  openMarginTop = 16,
}, ref) => {
  const isOpen = Boolean(expanded);

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        marginTop: isOpen ? openMarginTop : 0,
        opacity: isOpen ? 1 : 0,
        y: isOpen ? 0 : -3,
      }}
      transition={advancedCollapseTransition}
      className={`grid overflow-hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${className}`}
      aria-hidden={!isOpen}
      style={{
        marginBlockEnd: 0,
        willChange: 'grid-template-rows, margin, opacity, transform',
      }}
    >
      <div className={`min-h-0 overflow-hidden ${contentClassName}`}>
        {children}
      </div>
    </motion.div>
  );
});

AdvancedCollapse.displayName = 'AdvancedCollapse';

export const FontSettingsRow = ({
  darkMode,
  sizeValue,
  colorValue,
  onSizeChange,
  onColorChange,
  minSize = 12,
  maxSize = 200,
  label = "Font Settings",
  tooltip = "Font size and color settings",
  disabled = false
}) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content={tooltip} side="right">
      <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${disabled ? 'opacity-50' : ''}`}>{label}</label>
    </Tooltip>
    <div className="flex items-center gap-2">
      <TextCursorInput className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} ${disabled ? 'opacity-50' : ''}`} />
      <Input
        type="number"
        value={sizeValue}
        onChange={(e) => onSizeChange(
          sanitizeIntegerInput(
            e.target.value,
            sizeValue ?? minSize,
            { min: minSize, max: maxSize, clampMin: false }
          )
        )}
        min={minSize}
        max={maxSize}
        disabled={disabled}
        className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      <PaintBucket className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} ${disabled ? 'opacity-50' : ''}`} />
      <ColorPicker
        value={colorValue}
        onChange={onColorChange}
        disabled={disabled}
        darkMode={darkMode}
        className={`${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  </div>
);

export const EmphasisRow = ({
  darkMode,
  icon,
  boldValue,
  italicValue,
  underlineValue,
  allCapsValue,
  onBoldChange,
  onItalicChange,
  onUnderlineChange,
  onAllCapsChange,
  disabled = false
}) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
      <LabelWithIcon icon={icon} text="Emphasis" darkMode={darkMode} />
    </Tooltip>
    <div className="flex gap-1.5 flex-wrap">
      <Tooltip content="Make text bold" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onBoldChange(!boldValue)}
          disabled={disabled}
          className={
            boldValue
              ? darkMode
                ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
              : darkMode
                ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
          }
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Make text italic" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onItalicChange(!italicValue)}
          disabled={disabled}
          className={
            italicValue
              ? darkMode
                ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
              : darkMode
                ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
          }
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Underline text" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onUnderlineChange(!underlineValue)}
          disabled={disabled}
          className={
            underlineValue
              ? darkMode
                ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
              : darkMode
                ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
          }
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Convert text to uppercase" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onAllCapsChange(!allCapsValue)}
          disabled={disabled}
          className={
            allCapsValue
              ? darkMode
                ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
              : darkMode
                ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
          }
        >
          <CaseUpper className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
    </div>
  </div>
);

export const AlignmentRow = ({
  darkMode,
  icon,
  value,
  onChange,
  label = "Alignment",
  tooltip = "Text alignment",
  disabled = false
}) => {
  const currentValue = value || 'center';

  return (
    <div className="flex items-center justify-between gap-4">
      <Tooltip content={tooltip} side="right">
        <LabelWithIcon icon={icon} text={label} darkMode={darkMode} />
      </Tooltip>
      <div className="flex gap-1.5 flex-wrap">
        <Tooltip content="Align text to the left" side="top">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onChange('left')}
            disabled={disabled}
            className={
              currentValue === 'left'
                ? darkMode
                  ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                  : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
                : darkMode
                  ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                  : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
            }
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Align text to the center" side="top">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onChange('center')}
            disabled={disabled}
            className={
              currentValue === 'center'
                ? darkMode
                  ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                  : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
                : darkMode
                  ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                  : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
            }
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Align text to the right" side="top">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onChange('right')}
            disabled={disabled}
            className={
              currentValue === 'right'
                ? darkMode
                  ? `${compactOptionButtonClass} !bg-white !text-gray-900 hover:!bg-white !border-gray-300`
                  : `${compactOptionButtonClass} !bg-black !text-white hover:!bg-black !border-gray-300`
                : darkMode
                  ? `${compactOptionButtonClass} !bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700`
                  : `${compactOptionButtonClass} !bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100`
            }
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
