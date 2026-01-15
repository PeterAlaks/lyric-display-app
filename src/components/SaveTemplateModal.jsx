import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SaveTemplateModal = ({
  darkMode,
  templateType = 'output',
  onSave,
  close,
  settings
}) => {
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [nameCheckError, setNameCheckError] = useState('');

  const isStage = templateType === 'stage';

  useEffect(() => {
    if (!templateName.trim()) {
      setNameCheckError('');
      return;
    }

    const checkName = async () => {
      if (!window.electronAPI?.templates?.nameExists) return;

      try {
        const result = await window.electronAPI.templates.nameExists(templateType, templateName.trim());
        if (result.success && result.exists) {
          setNameCheckError('A template with this name already exists');
        } else {
          setNameCheckError('');
        }
      } catch (err) {
        console.error('Error checking template name:', err);
      }
    };

    const timeout = setTimeout(checkName, 300);
    return () => clearTimeout(timeout);
  }, [templateName, templateType]);

  const displayError = error || nameCheckError;

  const handleSave = useCallback(async () => {
    const name = templateName.trim();

    if (!name) {
      setError('Please enter a template name');
      return;
    }

    if (name.length < 2) {
      setError('Template name must be at least 2 characters');
      return;
    }

    if (name.length > 50) {
      setError('Template name must be less than 50 characters');
      return;
    }

    if (nameCheckError) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (window.electronAPI?.templates?.save) {
        const result = await window.electronAPI.templates.save(templateType, {
          name,
          settings
        });

        if (result.success) {
          if (onSave) {
            onSave(result.template);
          }
          close({ action: 'saved', template: result.template });
        } else {
          setError(result.error || 'Failed to save template');
        }
      } else {
        setError('Template saving is not available');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      setError('An error occurred while saving the template');
    } finally {
      setIsSaving(false);
    }
  }, [templateName, templateType, settings, nameCheckError, onSave, close]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !isSaving && !displayError && templateName.trim()) {
      handleSave();
    }
  }, [handleSave, isSaving, displayError, templateName]);

  const canSave = useMemo(() => {
    return !isSaving && !!templateName.trim() && !displayError;
  }, [isSaving, templateName, displayError]);

  return (
    <div className="space-y-4">
      {/* Template Name Input */}
      <div className="space-y-2">
        <label className={cn(
          'block text-sm font-medium',
          darkMode ? 'text-gray-300' : 'text-gray-700'
        )}>
          Template Name
        </label>
        <Input
          type="text"
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter a name for your template..."
          autoFocus
          maxLength={50}
          className={cn(
            darkMode
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-300',
            displayError && 'border-red-500 focus-visible:ring-red-500'
          )}
        />

        {/* Error Message */}
        {displayError && (
          <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Character Count */}
        <div className={`text-xs text-right ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {templateName.length}/50
        </div>
      </div>

      {/* Info Note */}
      <div className={`rounded-lg p-4 border ${darkMode
        ? isStage ? 'bg-green-900/20 border-green-500/30' : 'bg-blue-900/20 border-blue-500/30'
        : isStage ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
        <p className={`text-xs ${darkMode
          ? isStage ? 'text-green-300' : 'text-blue-300'
          : isStage ? 'text-green-800' : 'text-blue-800'
          }`}>
          <strong>Tip:</strong> Your saved templates will appear in the Templates panel under "My Templates" tab,
          where you can apply or delete them anytime.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => close({ dismissed: true })}
          disabled={isSaving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-black text-white hover:bg-gray-800'
            } ${!canSave ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
};

export default SaveTemplateModal;