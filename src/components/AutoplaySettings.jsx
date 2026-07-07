import React from 'react';
import { ModalActionButton } from '@/components/modal/modalActions';

const AutoplaySettings = ({ settings, onSave, darkMode, close }) => {
  const [localSettings, setLocalSettings] = React.useState(settings);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    close();
  };

  return (
    <div className="space-y-6">
      {/* Interval Setting */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
          Interval (seconds)
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={localSettings.interval}
          onChange={(e) => handleChange('interval', Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
          className={`w-full px-4 py-2 rounded-lg border ${darkMode
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Time between automatic line transitions
        </p>
      </div>

      {/* Loop Setting */}
      <div className="flex items-center justify-between">
        <div>
          <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Loop at end
          </label>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Return to first line after reaching the end
          </p>
        </div>
        <button
          onClick={() => handleChange('loop', !localSettings.loop)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.loop
              ? darkMode ? 'bg-green-500' : 'bg-black'
              : darkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.loop ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      {/* Auto-start Setting */}
      <div className="flex items-center justify-between">
        <div>
          <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Start from first line
          </label>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Begin autoplay from the first line
          </p>
        </div>
        <button
          onClick={() => handleChange('startFromFirst', !localSettings.startFromFirst)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.startFromFirst
              ? darkMode ? 'bg-green-500' : 'bg-black'
              : darkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.startFromFirst ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      {/* Skip blank lines Setting */}
      <div className="flex items-center justify-between">
        <div>
          <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Skip blank lines
          </label>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Automatically skip empty lines during playback
          </p>
        </div>
        <button
          onClick={() => handleChange('skipBlankLines', !localSettings.skipBlankLines)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.skipBlankLines
              ? darkMode ? 'bg-green-500' : 'bg-black'
              : darkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.skipBlankLines ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <ModalActionButton
          type="button"
          tone="secondary"
          darkMode={darkMode}
          onClick={() => close()}
        >
          Cancel
        </ModalActionButton>
        <ModalActionButton
          type="button"
          tone="primary"
          darkMode={darkMode}
          onClick={handleSave}
        >
          Save Settings
        </ModalActionButton>
      </div>
    </div>
  );
};

export default AutoplaySettings;
