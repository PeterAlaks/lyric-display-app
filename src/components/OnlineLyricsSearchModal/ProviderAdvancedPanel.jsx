import { ChevronRight, Globe2, Key, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const providerLogoMap = {
  lyricsOvh: '/logos/lyricsovh-logo.png',
  openHymnal: '/logos/openhymnal-logo.png',
  lrclib: '/logos/lrclib-logo.png',
  chartlyrics: '/logos/chartlyrics-logo.png',
};

const providerIconMap = {
  openHymnal: '/logos/openhymnal-icon.png',
  lyricsOvh: '/logos/lyricsovh-icon.png',
  lrclib: '/logos/lrclib-icon.png',
  chartlyrics: '/logos/chartlyrics-icon.png',
};

const FeaturedLibraries = ({ darkMode, providerDefinitions }) => {
  if (!providerDefinitions?.length) return null;

  return (
    <div className="mt-6">
      <p className={`mb-3 text-xs font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Featured libraries
      </p>
      <div className="grid grid-cols-4 gap-3">
        {providerDefinitions.map((provider) => (
          <a
            key={provider.id}
            href={provider.homepage}
            target="_blank"
            rel="noreferrer"
            className="group relative transition-all hover:opacity-85 hover:scale-105"
          >
            <img
              src={providerLogoMap[provider.id]}
              alt={provider.displayName}
              className="h-9 w-auto object-contain"
            />
          </a>
        ))}
      </div>
    </div>
  );
};

const ProviderKeys = ({
  darkMode,
  handleDeleteKey,
  handleSaveKey,
  keyEditor,
  keyInputValue,
  openKeyEditor,
  providerDefinitions,
  resetKeyEditor,
  savingKey,
  setKeyInputValue,
}) => {
  const providersRequiringKeys = providerDefinitions.filter((provider) => provider.requiresKey);
  if (!providersRequiringKeys.length) return null;

  return (
    <div className="pt-4">
      <p className={`mb-3 flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        <Key className="w-4 h-4" />
        Provider access keys
      </p>
      <div className="space-y-4">
        {providersRequiringKeys.map((provider) => {
          const configured = provider.configured;
          const isEditing = keyEditor === provider.id;

          return (
            <div key={provider.id} className={`rounded-md border px-3 py-3 ${darkMode ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {providerIconMap[provider.id] && (
                    <img
                      src={providerIconMap[provider.id]}
                      alt={provider.displayName}
                      className="h-8 w-8 object-contain"
                    />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{provider.displayName}</p>
                    <p className={`text-xs ${configured ? 'text-green-500' : 'text-red-500'}`}>
                      {configured ? 'Configured' : 'Key required'}
                    </p>
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openKeyEditor(provider.id)}
                      className={darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : ''}
                    >
                      {configured ? 'Update key' : 'Add key'}
                    </Button>
                    {configured && (
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteKey(provider.id)} disabled={savingKey}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="mt-3 space-y-3">
                  <Input
                    type="text"
                    value={keyInputValue}
                    onChange={(event) => setKeyInputValue(event.target.value)}
                    placeholder="Paste provider API key"
                    className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500' : ''}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetKeyEditor}
                      disabled={savingKey}
                      className={darkMode ? 'text-gray-400 hover:bg-gray-700/60 hover:text-white' : ''}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveKey(provider.id)} disabled={savingKey || !keyInputValue.trim()}>
                      {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save key'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProviderStatus = ({ darkMode, hasKeyProviders, providerStatuses }) => {
  if (!providerStatuses?.length) return null;

  return (
    <div className={hasKeyProviders ? 'pt-0' : 'pt-4'}>
      <p className={`font-medium mb-3 flex items-center gap-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        <Globe2 className="w-4 h-4" />
        Provider status
      </p>
      <ul className="space-y-1 text-xs">
        {providerStatuses.map((provider) => (
          <li key={provider.id} className="flex items-center justify-between gap-3">
            <span className="font-medium">{provider.displayName}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200/40 text-gray-600'}`}>
                {provider.count} hit{provider.count === 1 ? '' : 's'}
              </span>
              {provider.duration != null && (
                <span className={`text-[10px] ${provider.duration > 3000 ? 'text-red-500' : provider.duration > 1200 ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {provider.duration}ms
                </span>
              )}
              {provider.penalty > 0 && (
                <span className="text-[10px] text-yellow-500">penalty -{provider.penalty}</span>
              )}
              {provider.health?.requests > 0 && (
                <span className={`text-[10px] ${provider.health.failures > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {Math.round((provider.health.failures / provider.health.requests) * 100)}% fail
                </span>
              )}
              {provider.errors?.[0] && (
                <span className="text-[10px] text-red-500">{provider.errors[0]}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProviderAdvancedPanel = ({
  advancedExpanded,
  darkMode,
  handleDeleteKey,
  handleSaveKey,
  keyEditor,
  keyInputValue,
  openKeyEditor,
  providerDefinitions,
  providerStatuses,
  resetKeyEditor,
  savingKey,
  setAdvancedExpanded,
  setKeyInputValue,
}) => {
  const hasKeyProviders = providerDefinitions.some((provider) => provider.requiresKey);
  const shouldShowAdvanced = providerStatuses?.length > 0 || hasKeyProviders;

  return (
    <>
      <FeaturedLibraries darkMode={darkMode} providerDefinitions={providerDefinitions} />

      {shouldShowAdvanced && (
        <div className={`mt-6 rounded-md border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={() => {
              const newExpanded = !advancedExpanded;
              setAdvancedExpanded(newExpanded);
              try {
                localStorage.setItem('lyricdisplay_advancedExpanded', newExpanded.toString());
              } catch (err) {
                console.warn('Failed to save advanced section state:', err);
              }
            }}
            className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'}`}
          >
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Advanced Options (API Key Management and more)
            </span>
            <ChevronRight
              className={`w-4 h-4 transition-transform ${advancedExpanded ? 'rotate-90' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
          </button>

          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${advancedExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className={`px-4 pb-4 space-y-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <ProviderKeys
                  darkMode={darkMode}
                  handleDeleteKey={handleDeleteKey}
                  handleSaveKey={handleSaveKey}
                  keyEditor={keyEditor}
                  keyInputValue={keyInputValue}
                  openKeyEditor={openKeyEditor}
                  providerDefinitions={providerDefinitions}
                  resetKeyEditor={resetKeyEditor}
                  savingKey={savingKey}
                  setKeyInputValue={setKeyInputValue}
                />
                <ProviderStatus
                  darkMode={darkMode}
                  hasKeyProviders={hasKeyProviders}
                  providerStatuses={providerStatuses}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProviderAdvancedPanel;
