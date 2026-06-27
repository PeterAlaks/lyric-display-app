import { Palette, Power, Save, Trash2, CircleHelp } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { formatOutputLabel } from '../../utils/outputLabels';

const iconButtonClass = (darkMode) => (
  `p-1.5 rounded-lg transition-colors ${darkMode
    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
    }`
);

const PanelHeaderActions = ({
  applySettings,
  darkMode,
  hideLiveActions = false,
  handleToggleOutput,
  isOutputEnabled,
  onDeleteOutput,
  outputKey,
  title,
  settings,
  showModal,
  showToast,
}) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className={`text-[13px] font-medium uppercase leading-5 tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {title || `${formatOutputLabel(outputKey, { uppercase: true })} SETTINGS`}
    </h3>

    <div className="flex items-center gap-1.5">
      {onDeleteOutput && (
        <Tooltip content={`Delete ${formatOutputLabel(outputKey)}`} side="bottom">
          <button
            onClick={() => onDeleteOutput(outputKey)}
            className={`p-1.5 rounded-lg transition-colors ${darkMode
              ? 'hover:bg-red-600/30 text-gray-400 hover:text-red-400'
              : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
              }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}

      {!hideLiveActions && (
        <Tooltip content={isOutputEnabled
          ? `Turn off ${formatOutputLabel(outputKey)}`
          : `Turn on ${formatOutputLabel(outputKey)}`}
          side="bottom"
        >
          <button
            onClick={handleToggleOutput}
            className={`p-1.5 rounded-lg transition-colors ${!isOutputEnabled
              ? darkMode
                ? 'bg-red-600/80 text-white hover:bg-red-600'
                : 'bg-red-500 text-white hover:bg-red-600'
              : darkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
          >
            <Power className="w-4 h-4" />
          </button>
        </Tooltip>
      )}

      {!hideLiveActions && (
        <Tooltip content="NDI Broadcasting" side="bottom">
          <button
            onClick={async () => {
              const status = await window.electronAPI?.ndi?.checkInstalled();
              if (!status?.installed) {
                showToast({
                  title: 'NDI Unavailable',
                  message: 'Download the NDI companion to enable broadcasting.',
                  variant: 'info',
                  duration: 8000,
                  actions: [{
                    label: 'Download',
                    onClick: () => {
                      showModal({
                        title: 'Preferences',
                        component: 'UserPreferences',
                        variant: 'info',
                        size: 'lg',
                        customLayout: true,
                        initialCategory: 'ndi',
                        actions: []
                      });
                    }
                  }]
                });
                return;
              }
              showModal({
                title: 'NDI Output Settings',
                headerDescription: `Configure NDI broadcast for ${formatOutputLabel(outputKey)}`,
                component: 'NdiOutputSettings',
                variant: 'info',
                size: 'lg',
                outputKey,
                customLayout: true,
                dismissLabel: 'Close',
              });
            }}
            className={`px-1.5 rounded-lg transition-colors text-[12px] leading-none ${darkMode
              ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, height: 28 }}
          >
            NDI
          </button>
        </Tooltip>
      )}

      <Tooltip content="Save current settings as a reusable template" side="bottom">
        <button
          onClick={() => {
            showModal({
              title: 'Save as Template',
              headerDescription: 'Save your current output settings as a reusable template',
              component: 'SaveTemplate',
              variant: 'info',
              size: 'sm',
              actions: [],
              templateType: 'output',
              settings,
              onSave: (template) => {
                showToast({
                  title: 'Template Saved',
                  message: `"${template.name}" has been saved successfully`,
                  variant: 'success',
                });
              }
            });
          }}
          className={iconButtonClass(darkMode)}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      </Tooltip>

      <Tooltip content="Choose from professionally designed output templates" side="bottom">
        <button
          onClick={() => {
            showModal({
              title: 'Output Templates',
              headerDescription: 'Choose from professionally designed output presets',
              component: 'OutputTemplates',
              variant: 'info',
              size: 'large',
              scrollBehavior: 'scroll',
              dismissLabel: 'Close',
              outputKey,
              onApplyTemplate: (template) => {
                const templateSettings = template.getSettings
                  ? template.getSettings(outputKey)
                  : template.settings;
                applySettings(templateSettings);
                showToast({
                  title: 'Template Applied',
                  message: `${template.title} template has been applied successfully`,
                  variant: 'success',
                });
              }
            });
          }}
          className={iconButtonClass(darkMode)}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </Tooltip>

      <Tooltip content="Settings Panel Help" side="bottom">
        <button
          onClick={() => {
            showModal({
              title: 'Output Settings Help',
              headerDescription: 'Customize every aspect of your lyric display appearance',
              component: 'OutputSettingsHelp',
              variant: 'info',
              size: 'large',
              dismissLabel: 'Got it'
            });
          }}
          className={iconButtonClass(darkMode)}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  </div>
);

export default PanelHeaderActions;
