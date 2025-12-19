import React from 'react';
import { ChevronDown, ChevronUp, TextCursorInput, Paintbrush, Bold, Italic, Underline, CaseUpper, AlignVerticalSpaceAround } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import { sanitizeIntegerInput } from '../utils/numberInput';

export const LabelWithIcon = ({ icon: Icon, text, darkMode }) => (
  <div className="flex items-center gap-2 min-w-[140px]">
    <Icon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
    <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
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
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )}
  </button>
);

export const FontSettingsRow = ({
  darkMode,
  sizeValue,
  colorValue,
  onSizeChange,
  onColorChange,
  minSize = 12,
  maxSize = 200,
  label = "Font Settings",
  tooltip = "Font size and color settings"
}) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content={tooltip} side="right">
      <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</label>
    </Tooltip>
    <div className="flex items-center gap-2">
      <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
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
        className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
      />
      <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      <ColorPicker
        value={colorValue}
        onChange={onColorChange}
        darkMode={darkMode}
        className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
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
  onAllCapsChange
}) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
      <LabelWithIcon icon={icon} text="Emphasis" darkMode={darkMode} />
    </Tooltip>
    <div className="flex gap-2 flex-wrap">
      <Tooltip content="Make text bold" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onBoldChange(!boldValue)}
          className={
            boldValue
              ? darkMode
                ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                : '!bg-black !text-white hover:!bg-black !border-gray-300'
              : darkMode
                ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
          }
        >
          <Bold className="w-4 h-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Make text italic" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onItalicChange(!italicValue)}
          className={
            italicValue
              ? darkMode
                ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                : '!bg-black !text-white hover:!bg-black !border-gray-300'
              : darkMode
                ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
          }
        >
          <Italic className="w-4 h-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Underline text" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onUnderlineChange(!underlineValue)}
          className={
            underlineValue
              ? darkMode
                ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                : '!bg-black !text-white hover:!bg-black !border-gray-300'
              : darkMode
                ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
          }
        >
          <Underline className="w-4 h-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Convert text to uppercase" side="top">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onAllCapsChange(!allCapsValue)}
          className={
            allCapsValue
              ? darkMode
                ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                : '!bg-black !text-white hover:!bg-black !border-gray-300'
              : darkMode
                ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
          }
        >
          <CaseUpper className="w-4 h-4" />
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
  tooltip = "Text alignment"
}) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content={tooltip} side="right">
      <LabelWithIcon icon={icon} text={label} darkMode={darkMode} />
    </Tooltip>
    <Select value={value || 'center'} onValueChange={onChange}>
      <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
        <SelectItem value="left">Left</SelectItem>
        <SelectItem value="center">Centre</SelectItem>
        <SelectItem value="right">Right</SelectItem>
      </SelectContent>
    </Select>
  </div>
);