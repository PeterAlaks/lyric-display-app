import React, { useState } from 'react';
import { Monitor, X, Projector, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const DisplayDetectionModal = ({ darkMode, displayInfo, onSave, onCancel, isManualOpen = false, isCurrentlyProjecting = false }) => {
  const [autoUseForStage, setAutoUseForStage] = useState(true);
  const [selectedOutput, setSelectedOutput] = useState('stage');
  const [isSaving, setIsSaving] = useState(false);

  const displayName = displayInfo?.name || 'External Display';
  const displayId = displayInfo?.id;
  const displayBounds = displayInfo?.bounds;

  const handleProject = async () => {
    setIsSaving(true);
    try {
      await onSave?.({
        displayId,
        action: 'project',
        selectedOutput: autoUseForStage ? 'stage' : selectedOutput,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTurnOff = async () => {
    setIsSaving(true);
    try {
      await onSave?.({
        displayId,
        action: 'turnOff',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleIgnore = () => {
    onCancel?.();
  };

  const handleClose = () => {
    onCancel?.();
  };

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
          <h4 className={`font-semibold text-base mb-1 ${darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
            {displayName}
          </h4>
          {displayBounds && (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Resolution: {displayBounds.width} × {displayBounds.height}
            </p>
          )}
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            A new display has been connected to your system
          </p>
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
            checked={autoUseForStage}
            onCheckedChange={setAutoUseForStage}
            className={`flex-shrink-0 !h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
                ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
          />
        </div>

        {/* Manual Output Selection */}
        {!autoUseForStage && (
          <div className={`p-4 rounded-lg border space-y-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
            <label className={`block font-medium text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'
              }`}>
              Select output display
            </label>
            <Select value={selectedOutput} onValueChange={setSelectedOutput}>
              <SelectTrigger className={`w-full ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'
                }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
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
            {isCurrentlyProjecting ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSaving}
                  className={darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
                >
                  Close
                </Button>
                <Button
                  onClick={handleTurnOff}
                  disabled={isSaving}
                  variant="destructive"
                  className={darkMode ? 'bg-red-600 hover:bg-red-700' : ''}
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
                  className={darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
                >
                  Close
                </Button>
                <Button
                  onClick={handleProject}
                  disabled={isSaving}
                  className={`${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
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
              className={darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <X className="w-4 h-4 mr-2" />
              Ignore
            </Button>
            <Button
              onClick={handleProject}
              disabled={isSaving}
              className={`${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
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

export default DisplayDetectionModal;