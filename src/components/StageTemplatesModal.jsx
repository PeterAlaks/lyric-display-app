import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Sparkles, User, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageTemplates } from '../utils/outputTemplates';

const StageTemplatesModal = ({ darkMode, onApplyTemplate, onClose }) => {
  const [activeTab, setActiveTab] = useState('presets');
  const [userTemplates, setUserTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const loadUserTemplates = async () => {
      if (!window.electronAPI?.templates?.load) return;

      setIsLoading(true);
      try {
        const result = await window.electronAPI.templates.load('stage');
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
      const result = await window.electronAPI.templates.delete('stage', templateId);
      if (result.success) {
        setUserTemplates(prev => prev.filter(t => t.id !== templateId));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setDeletingId(null);
    }
  }, []);

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
    const settings = template.settings;
    const isDeleting = deletingId === template.id;

    return (
      <div
        key={template.id}
        className={`rounded-lg border p-4 transition-all hover:shadow-md ${darkMode
          ? 'bg-gray-800 border-gray-700 hover:border-green-500/50'
          : 'bg-white border-gray-200 hover:border-green-300'
          }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Template Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isUserTemplate ? (
                <User className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              ) : (
                <Sparkles className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
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
                Live: {settings.liveFontSize}px
              </span>
              <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                Next: {settings.nextFontSize}px
              </span>
              {settings.showNextArrow && (
                <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  Arrow
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
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-green-500 hover:bg-green-600'
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
          Professionally designed layouts or your saved templates for performers
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
          stageTemplates.map((template) => renderTemplateCard(template, false))
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
      <div className={`rounded-lg p-4 border ${darkMode ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
        <p className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-800'}`}>
          <strong>Tip:</strong> Templates will override your current stage display settings. You can fine-tune individual settings after applying a template.
        </p>
      </div>
    </div>
  );
};

export default StageTemplatesModal;