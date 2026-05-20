import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';

export default function QuickParserPopover({
  clampGroupSize,
  darkMode,
  handleReloadWithQuickParser,
  quickParserLoading,
  quickParserOpen,
  quickParserSettings,
  quickSwitchClassName,
  quickSwitchThumbClassName,
  reloadingWithParser,
  setQuickParserOpen,
  updateQuickParserSetting,
}) {
  return (
    <Popover open={quickParserOpen} onOpenChange={setQuickParserOpen}>
      <Tooltip content="Quick parser controls" side="bottom">
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={quickParserLoading}
            className={`h-9 px-3 rounded-md border flex items-center justify-center transition-colors ${darkMode
              ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              } ${quickParserLoading ? 'opacity-60 cursor-wait' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className={`w-80 p-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto line grouping</p>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Group normal consecutive lines automatically</p>
            </div>
            <Switch
              checked={quickParserSettings.enableAutoLineGrouping}
              onCheckedChange={(checked) => updateQuickParserSetting('enableAutoLineGrouping', checked)}
              className={quickSwitchClassName}
              thumbClassName={quickSwitchThumbClassName}
            />
          </div>

          {quickParserSettings.enableAutoLineGrouping && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Maximum lines per group</label>
              <Input
                type="number"
                min="2"
                max="12"
                value={quickParserSettings.maxLinesPerGroup}
                onChange={(e) => updateQuickParserSetting('maxLinesPerGroup', clampGroupSize(e.target.value))}
                className={darkMode ? 'bg-gray-900 border-gray-700' : ''}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Translation grouping</p>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Keep bracketed translation pairs</p>
            </div>
            <Switch
              checked={quickParserSettings.enableTranslationGrouping}
              onCheckedChange={(checked) => updateQuickParserSetting('enableTranslationGrouping', checked)}
              className={quickSwitchClassName}
              thumbClassName={quickSwitchThumbClassName}
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReloadWithQuickParser}
              disabled={reloadingWithParser}
              className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${reloadingWithParser
                ? 'bg-gray-400 text-gray-700 cursor-wait'
                : darkMode
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'bg-black hover:bg-gray-900 text-white'
                }`}
            >
              {reloadingWithParser ? 'Reloading...' : 'Reload Lyrics'}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
