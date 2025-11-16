import React from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { outputTemplates } from '../utils/outputTemplates';

const OutputTemplatesModal = ({ darkMode, onApplyTemplate, onClose, outputKey = 'output1' }) => {
  const handleApply = (template) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
    if (onClose) {
      onClose();
    }
  };

  const getTemplateSettings = (template) => {
    if (template.getSettings) {
      return template.getSettings(outputKey);
    }
    return template.settings;
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}>
      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 space-y-4 pr-2">
        {/* Hero Section */}
        <div className={`rounded-lg p-6 text-center ${darkMode ? 'bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-500/30' : 'bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200'}`}>
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Palette className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Output Templates
          </h3>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Choose from professionally designed presets to instantly style your lyric display
          </p>
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          {outputTemplates.map((template) => {
            const settings = getTemplateSettings(template);
            return (
              <div
                key={template.id}
                className={`rounded-lg border p-4 transition-all hover:shadow-md ${darkMode
                  ? 'bg-gray-800 border-gray-700 hover:border-blue-500/50'
                  : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Template Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      <h4 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {template.title}
                      </h4>
                    </div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {template.description}
                    </p>

                    {/* Key Settings Preview */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        {settings.fontStyle}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        {settings.fontSize}px
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        {settings.lyricsPosition}
                      </span>
                      {settings.transitionAnimation !== 'none' && (
                        <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                          {settings.transitionAnimation}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Apply Button */}
                  <Button
                    onClick={() => handleApply(template)}
                    className={`flex-shrink-0 ${darkMode
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-blue-500 hover:bg-blue-600'
                      } text-white`}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Note */}
        <div className={`rounded-lg p-4 border ${darkMode ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
            <strong>Tip:</strong> Templates will override your current settings. You can always adjust individual settings after applying a template.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OutputTemplatesModal;