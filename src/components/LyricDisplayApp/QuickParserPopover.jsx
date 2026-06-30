import React from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  presentation = 'popover',
}) {
  const renderTriggerButton = (triggerProps = {}) => (
    <button
      type="button"
      disabled={quickParserLoading}
      className={`${presentation === 'sheet' ? 'h-8' : 'h-9'} px-3 rounded-md flex items-center justify-center transition-all ${darkMode
        ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
        : 'bg-transparent text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'
        } ${quickParserLoading ? 'opacity-60 cursor-wait' : ''}`}
      {...triggerProps}
    >
      <SlidersHorizontal className="h-4.5 w-4.5" />
    </button>
  );

  const controls = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
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

      <div className="flex items-center justify-between gap-3">
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
    </div>
  );

  const reloadButton = (
    <button
      type="button"
      onClick={handleReloadWithQuickParser}
      disabled={reloadingWithParser}
      className={`w-full rounded-full py-2 text-sm font-medium transition-colors ${reloadingWithParser
        ? 'bg-gray-400 text-gray-700 cursor-wait'
        : darkMode
          ? 'bg-blue-500 hover:bg-blue-400 text-white'
          : 'bg-black hover:bg-gray-900 text-white'
        }`}
    >
      {reloadingWithParser ? 'Reloading...' : 'Reload Lyrics'}
    </button>
  );

  if (presentation === 'sheet') {
    return (
      <>
        <Tooltip content="Quick parser controls" side="bottom" disabled={quickParserOpen}>
          {renderTriggerButton({ onClick: () => setQuickParserOpen(true) })}
        </Tooltip>
        {quickParserOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-2350 bg-black/45 p-2"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setQuickParserOpen(false);
            }}
          >
            <div className={`flex h-full flex-col overflow-hidden rounded-3xl border shadow-2xl ${darkMode ? 'border-gray-800 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}>
              <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Quick Parser</div>
                  <div className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Adjust parsing and reload the current lyrics.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuickParserOpen(false)}
                  className={darkMode ? 'border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800' : ''}
                  aria-label="Close quick parser"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {controls}
              </div>
              <div className={`border-t p-5 ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
                {reloadButton}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <Popover open={quickParserOpen} onOpenChange={setQuickParserOpen}>
      <Tooltip content="Quick parser controls" side="bottom" disabled={quickParserOpen}>
        <PopoverTrigger asChild>
          {renderTriggerButton()}
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className={`w-80 rounded-xl p-5 ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'}`}
      >
        <div className="space-y-3">
          {controls}
          <div className="pt-2">
            {reloadButton}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
