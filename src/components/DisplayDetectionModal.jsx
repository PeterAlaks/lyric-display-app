import React, { useState } from 'react';
import { Monitor, X, Projector, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const DisplayDetectionModal = ({
  darkMode,
  displayInfo,
  displays,
  onSave,
  onCancel,
  isManualOpen = false,
  isCurrentlyProjecting = false
}) => {

  const displaysArray = displays || (displayInfo ? [displayInfo] : []);
  const hasMultipleDisplays = displaysArray.length > 1;

  const [activeTab, setActiveTab] = useState(displaysArray[0]?.id?.toString() || '0');

  const [displaySettings, setDisplaySettings] = useState(() => {
    const settings = {};
    displaysArray.forEach(display => {
      const storageKey = `display-modal-state-${display.id}`;
      let savedState = { autoUseForStage: true, selectedOutput: 'stage' };

      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          try {
            savedState = JSON.parse(saved);
          } catch { }
        }
      }

      settings[display.id] = savedState;
    });
    return settings;
  });

  const [savingStates, setSavingStates] = useState({});

  const updateDisplaySetting = (displayId, key, value) => {
    setDisplaySettings(prev => ({
      ...prev,
      [displayId]: {
        ...prev[displayId],
        [key]: value
      }
    }));

    if (typeof window !== 'undefined') {
      const storageKey = `display-modal-state-${displayId}`;
      const newSettings = {
        ...displaySettings[displayId],
        [key]: value
      };
      window.localStorage.setItem(storageKey, JSON.stringify(newSettings));
    }
  };

  const handleProject = async (display) => {
    setSavingStates(prev => ({ ...prev, [display.id]: true }));
    try {
      const settings = displaySettings[display.id];
      await onSave?.({
        displayId: display.id,
        action: 'project',
        selectedOutput: settings.autoUseForStage ? 'stage' : settings.selectedOutput,
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [display.id]: false }));
    }
  };

  const handleTurnOff = async (display) => {
    setSavingStates(prev => ({ ...prev, [display.id]: true }));
    try {
      const settings = displaySettings[display.id];
      await onSave?.({
        displayId: display.id,
        action: 'turnOff',
        selectedOutput: settings.autoUseForStage ? 'stage' : settings.selectedOutput,
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [display.id]: false }));
    }
  };

  const handleIgnore = () => {
    onCancel?.();
  };

  const handleClose = () => {
    onCancel?.();
  };

  const renderDisplayContent = (display, index) => {
    const settings = displaySettings[display.id] || { autoUseForStage: true, selectedOutput: 'stage' };
    const isSaving = savingStates[display.id] || false;
    const displayName = display.name || 'External Display';
    const displayBounds = display.bounds;
    const isProjecting = display.isProjecting || false;

    return (
      <div className={`space-y-6 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
        {/* Display Info Section */}
        <div className={`flex items-start gap-4 p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
          }`}>
          <div className={`flex-shrink-0 p-3 rounded-lg ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
            <Monitor className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold text-base mb-1 ${darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                {displayName}
              </h4>
              {isProjecting && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                  }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Projecting
                </span>
              )}
            </div>
            {displayBounds && (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Resolution: {displayBounds.width} × {displayBounds.height}
              </p>
            )}
            {!hasMultipleDisplays && (
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                A new display has been connected to your system
              </p>
            )}
          </div>
        </div>

        {/* Configuration Section */}
        <div className="space-y-4">
          {/* Auto-use for Stage Section */}
          <div className={`flex items-start justify-between gap-4 p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
            <div className="flex-1">
              <label className={`block font-medium text-sm mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                Automatically use display for stage monitor
              </label>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This display will be used as the default stage output for performers and worship leaders
              </p>
            </div>
            <Switch
              checked={settings.autoUseForStage}
              onCheckedChange={(checked) => updateDisplaySetting(display.id, 'autoUseForStage', checked)}
              disabled={isProjecting}
              className={`flex-shrink-0 !h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
                ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                } ${isProjecting ? 'opacity-50 cursor-not-allowed' : ''}`}
              thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
            />
          </div>

          {/* Manual Output Selection */}
          {!settings.autoUseForStage && (
            <div className={`p-4 rounded-lg border space-y-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}>
              <label className={`block font-medium text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                Select output display
              </label>
              <Select
                value={settings.selectedOutput}
                onValueChange={(value) => updateDisplaySetting(display.id, 'selectedOutput', value)}
                disabled={isProjecting}
              >
                <SelectTrigger className={`w-full ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'
                  } ${isProjecting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  <SelectItem value="output1">Output 1</SelectItem>
                  <SelectItem value="output2">Output 2</SelectItem>
                  <SelectItem value="stage">Stage</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Choose which output window should be displayed on this monitor
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className={`p-3 rounded-lg border-l-4 ${darkMode
          ? 'bg-blue-500/10 border-blue-500 text-gray-300'
          : 'bg-blue-50 border-blue-500 text-gray-700'
          }`}>
          <p className="text-xs leading-relaxed">
            <strong>Tip:</strong> You can change this setting later from the Window menu or by reconnecting the display.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isManualOpen ? (
            <>
              {isProjecting ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSaving}
                    className={darkMode ? 'bg-transparent border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-500' : ''}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => handleTurnOff(display)}
                    disabled={isSaving}
                    variant="destructive"
                    className={darkMode ? 'bg-red-600 hover:bg-red-700 text-white border-0' : 'bg-red-600 hover:bg-red-700 text-white'}
                  >
                    {isSaving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Turning Off...
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 mr-2" />
                        Turn Off
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSaving}
                    className={darkMode ? 'bg-transparent border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-500' : ''}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => handleProject(display)}
                    disabled={isSaving}
                    className={darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                  >
                    {isSaving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Projecting...
                      </>
                    ) : (
                      <>
                        <Projector className="w-4 h-4 mr-2" />
                        Project
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleIgnore}
                disabled={isSaving}
                className={darkMode ? 'bg-transparent border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-500' : ''}
              >
                <X className="w-4 h-4 mr-2" />
                Ignore
              </Button>
              <Button
                onClick={() => handleProject(display)}
                disabled={isSaving}
                className={darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'bg-blue-600 hover:bg-blue-700 text-white'}
              >
                {isSaving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Projecting...
                  </>
                ) : (
                  <>
                    <Projector className="w-4 h-4 mr-2" />
                    Project
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!hasMultipleDisplays) {
    return renderDisplayContent(displaysArray[0], 0);
  }

  const gridColsClass = displaysArray.length === 2 ? 'grid-cols-2' : displaysArray.length >= 3 ? 'grid-cols-3' : 'grid-cols-1';

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className={`w-full grid ${gridColsClass} mb-6 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100'
        }`}>
        {displaysArray.map((display, index) => {
          const isProjecting = display.isProjecting || false;
          return (
            <TabsTrigger
              key={display.id}
              value={display.id.toString()}
              className={`relative ${darkMode
                ? 'data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400'
                : 'data-[state=active]:bg-white data-[state=active]:text-gray-900'
                }`}
            >
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>{display.name || `Display ${index + 1}`}</span>
                {isProjecting && (
                  <span className={`w-2 h-2 rounded-full ${darkMode ? 'bg-green-400' : 'bg-green-500'
                    } animate-pulse`} />
                )}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {displaysArray.map((display, index) => (
        <TabsContent key={display.id} value={display.id.toString()} className="mt-0">
          {renderDisplayContent(display, index)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default DisplayDetectionModal;