import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Sparkles, User, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { outputTemplates } from '../utils/outputTemplates';

const OutputTemplatesModal = ({ darkMode, onApplyTemplate, onClose, outputKey = 'output1' }) => {
  const [activeTab, setActiveTab] = useState('presets');
  const [userTemplates, setUserTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const loadUserTemplates = async () => {
      if (!window.electronAPI?.templates?.load) return;

      setIsLoading(true);
      try {
        const result = await window.electronAPI.templates.load('output');
        if (result.success) {
          setUserTemplates(result.templates || []);
        }
      } catch (error) {
        console.error('Error loading user templates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserTemplates();
  }, []);

  const handleApply = (template, isUserTemplate = false) => {
    if (onApplyTemplate) {
      onApplyTemplate(template, isUserTemplate);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleDelete = useCallback(async (templateId, e) => {
    e.stopPropagation();

    if (!window.electronAPI?.templates?.delete) return;

    setDeletingId(templateId);
    try {
      const result = await window.electronAPI.templates.delete('output', templateId);
      if (result.success) {
        setUserTemplates(prev => prev.filter(t => t.id !== templateId));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const getTemplateSettings = (template) => {
    if (template.getSettings) {
      return template.getSettings(outputKey);
    }
    return template.settings;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const renderTemplateCard = (template, isUserTemplate = false) => {
    const settings = isUserTemplate ? template.settings : getTemplateSettings(template);
    const isDeleting = deletingId === template.id;

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
              {isUserTemplate ? (
                <User className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              ) : (
                <Sparkles className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              )}
              <h4 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {isUserTemplate ? template.name : template.title}
              </h4>
            </div>

            {!isUserTemplate && template.description && (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {template.description}
              </p>
            )}

            {isUserTemplate && template.createdAt && (
              <div className={`flex items-center gap-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Clock className="w-3 h-3" />
                <span>Created {formatDate(template.createdAt)}</span>
              </div>
            )}

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
              {settings.transitionAnimation && settings.transitionAnimation !== 'none' && (
                <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  {settings.transitionAnimation}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isUserTemplate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(template.id, e)}
                disabled={isDeleting}
                className={`h-9 w-9 ${darkMode
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={() => handleApply(
                isUserTemplate
                  ? { ...template, title: template.name }
                  : template,
                isUserTemplate
              )}
              className={`${darkMode
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
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
          Choose from professionally designed presets or your saved templates
        </p>
      </div>

      {/* Tab Switcher */}
      <div className={`flex rounded-lg p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'presets'
            ? darkMode
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-900 shadow-sm'
            : darkMode
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          Presets
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'saved'
            ? darkMode
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-900 shadow-sm'
            : darkMode
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <User className="w-4 h-4" />
          My Templates
          {userTemplates.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${darkMode ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700'
              }`}>
              {userTemplates.length}
            </span>
          )}
        </button>
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {activeTab === 'presets' ? (
          outputTemplates.map((template) => renderTemplateCard(template, false))
        ) : isLoading ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading templates...
          </div>
        ) : userTemplates.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <User className={`w-12 h-12 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className="font-medium mb-1">No saved templates yet</p>
            <p className="text-sm">
              Use the "Save as Template" button in the settings panel to save your current configuration
            </p>
          </div>
        ) : (
          userTemplates.map((template) => renderTemplateCard(template, true))
        )}
      </div>

      {/* Info Note */}
      <div className={`rounded-lg p-4 border ${darkMode ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
        <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
          <strong>Tip:</strong> Templates will override your current settings. You can always adjust individual settings after applying a template.
        </p>
      </div>
    </div>
  );
};

export default OutputTemplatesModal;