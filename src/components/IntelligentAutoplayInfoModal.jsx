import React from 'react';
import { Sparkles, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const IntelligentAutoplayInfoModal = ({ darkMode, onStart, onClose, setDontShowAgain }) => {
  const [dontShowAgain, setLocalDontShowAgain] = React.useState(false);

  const handleStart = () => {
    if (dontShowAgain && setDontShowAgain) {
      setDontShowAgain(true);
    }
    onStart();
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}>
      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 space-y-6 pr-2">
        {/* Hero Section */}
        <div className={`rounded-lg p-6 text-center ${darkMode ? 'bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200'}`}>
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${darkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Sparkles className={`w-8 h-8 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Intelligent Autoplay
          </h3>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Your lyrics contain timing information! Let LyricDisplay automatically advance based on the actual song timing.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg flex-shrink-0 ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Clock className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Perfect Timing
              </h4>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Lyrics advance exactly when they should, synchronized with the embedded timestamps from your LRC file or synced lyrics.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg flex-shrink-0 ${darkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <Zap className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Smart Progression
              </h4>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                The system intelligently calculates delays between lines, handling varying gaps naturally - from quick verses to long instrumental breaks.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg flex-shrink-0 ${darkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <CheckCircle2 className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Legacy Mode Available
              </h4>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Your regular autoplay with custom interval settings is still available. Use whichever works best for your workflow.
              </p>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className={`rounded-lg p-4 border ${darkMode ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className={`text-xs ${darkMode ? 'text-yellow-300' : 'text-yellow-800'}`}>
            <strong>Note:</strong> Intelligent autoplay works best when you start playback at the beginning of the song. The timing is based on the timestamps in your lyrics file.
          </p>
        </div>

        {/* Don't Show Again Checkbox */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={setLocalDontShowAgain}
            className={darkMode ? 'border-gray-600' : ''}
          />
          <label
            htmlFor="dont-show-again"
            className={`text-sm cursor-pointer select-none ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Don't show this message again
          </label>
        </div>
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className={`flex-shrink-0 flex items-center justify-end gap-3 pt-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={onClose}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
        >
          Maybe Later
        </button>
        <button
          onClick={handleStart}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Start Intelligent Autoplay
        </button>
      </div>
    </div>
  );
};

export default IntelligentAutoplayInfoModal;