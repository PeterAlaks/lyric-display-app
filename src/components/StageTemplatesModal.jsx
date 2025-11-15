import React from 'react';
import { Monitor, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageTemplates } from '../utils/outputTemplates';

const StageTemplatesModal = ({ darkMode, onApplyTemplate, onClose }) => {
  const handleApply = (template) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}>
      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 space-y-4 pr-2">
        {/* Hero Section */}
        <div className={`rounded-lg p-6 text-center ${darkMode ? 'bg-gradient-to-br from-green-900/40 to-blue-900/40 border border-green-500/30' : 'bg-gradient-to-br from-green-50 to-blue-50 border border-green-200'}`}>
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${darkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <Monitor className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Stage Display Templates
          </h3>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Professionally designed layouts optimized for performers and worship leaders
          </p>
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          {stageTemplates.map((template) => (
            <div
              key={template.id}
              className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                darkMode
                  ? 'bg-gray-800 border-gray-700 hover:border-green-500/50'
                  : 'bg-white border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Template Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
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
                      {template.settings.fontStyle}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      Live: {template.settings.liveFontSize}px
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      Next: {template.settings.nextFontSize}px
                    </span>
                    {template.settings.showNextArrow && (
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        Arrow
                      </span>
                    )}
                  </div>
                </div>

                {/* Apply Button */}
                <Button
                  onClick={() => handleApply(template)}
                  className={`flex-shrink-0 ${
                    darkMode
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Note */}
        <div className={`rounded-lg p-4 border ${darkMode ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-800'}`}>
            <strong>Tip:</strong> Templates will override your current stage display settings. You can fine-tune individual settings after applying a template.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StageTemplatesModal;
