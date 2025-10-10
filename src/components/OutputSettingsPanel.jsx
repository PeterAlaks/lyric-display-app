import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Type, Paintbrush, Contrast, TextCursorInput, TextQuote, Square, Frame, Move, Italic, Underline, Bold, CaseUpper } from 'lucide-react';

const fontOptions = [
  'Arial', 'Calibri', 'Bebas Neue', 'Fira Sans', 'GarnetCapitals', 'Inter', 'Lato', 'Montserrat',
  'Noto Sans', 'Open Sans', 'Poppins', 'Roboto', 'Work Sans'
];

const OutputSettingsPanel = ({ outputKey }) => {
  const { darkMode } = useDarkModeState();
  const { emitStyleUpdate } = useControlSocket();

  const { settings, updateSettings } =
    outputKey === 'output1' ? useOutput1Settings() : useOutput2Settings();

  const update = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    updateSettings({ [key]: value });
    emitStyleUpdate(outputKey, newSettings);
  };

  const LabelWithIcon = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Icon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
        {outputKey.toUpperCase()} SETTINGS
      </h3>

      {/* Font Picker */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Type} text="Font Style" />
        <Select value={settings.fontStyle} onValueChange={(val) => update('fontStyle', val)}>
          <SelectTrigger className={`w-full ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}>
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
            {fontOptions.map((font) => (
              <SelectItem
                key={font}
                value={font}
                style={{ fontFamily: font }}
                className={darkMode ? 'text-gray-200 hover:bg-gray-600' : ''}
              >
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bold / Italic / Underline / All Caps */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={TextQuote} text="Emphasis" />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="icon"
            variant={settings.bold ? 'default' : 'outline'}
            onClick={() => update('bold', !settings.bold)}
            title="Bold"
            className={!settings.bold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.italic ? 'default' : 'outline'}
            onClick={() => update('italic', !settings.italic)}
            title="Italic"
            className={!settings.italic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.underline ? 'default' : 'outline'}
            onClick={() => update('underline', !settings.underline)}
            title="Underline"
            className={!settings.underline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Underline className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.allCaps ? 'default' : 'outline'}
            onClick={() => update('allCaps', !settings.allCaps)}
            title="All Caps"
            className={!settings.allCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <CaseUpper className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={TextCursorInput} text="Font Size" />
        <Input
          type="number"
          value={settings.fontSize}
          onChange={(e) => update('fontSize', parseInt(e.target.value))}
          min="24"
          max="100"
          className={`w-24 ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}
        />
      </div>

      {/* Font Color */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Paintbrush} text="Font Colour" />
        <Input
          type="color"
          value={settings.fontColor}
          onChange={(e) => update('fontColor', e.target.value)}
          className={`h-9 w-12 p-1 ${darkMode
            ? 'bg-gray-700 border-gray-600'
            : 'bg-white border-gray-300'
            }`}
        />
      </div>

      {/* Text Border */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Frame} text="Text Border" />
        <div className="flex gap-2 items-center">
          <Input
            type="color"
            value={settings.borderColor ?? '#000000'}
            onChange={(e) => update('borderColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.borderSize ?? 0}
            onChange={(e) => update('borderSize', parseInt(e.target.value, 10))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Drop Shadow */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Contrast} text="Drop Shadow" />
        <div className="flex gap-2 items-center">
          <Input
            type="color"
            value={settings.dropShadowColor}
            onChange={(e) => update('dropShadowColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.dropShadowOpacity}
            onChange={(e) => update('dropShadowOpacity', parseInt(e.target.value))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Background */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Square} text="Background" />
        <div className="flex gap-2 items-center">
          <Input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.backgroundOpacity}
            onChange={(e) => update('backgroundOpacity', parseInt(e.target.value))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* X and Y Margins */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Move} text="X & Y Margins" />
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={settings.xMargin}
            onChange={(e) => update('xMargin', parseFloat(e.target.value))}
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.yMargin}
            onChange={(e) => update('yMargin', parseFloat(e.target.value))}
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>
    </div>
  );
};

export default OutputSettingsPanel;
