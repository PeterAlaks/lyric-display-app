import React from 'react';
import { Globe, ListMusic, MonitorUp, Moon, RefreshCw, Settings, Sun, Timer } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import AuthStatusIndicator from '../AuthStatusIndicator';

export default function ControlPanelHeaderActions({
  authStatus,
  connectionStatus,
  darkMode,
  forceReconnect,
  handleOpenOnlineLyricsSearch,
  handleOpenSetlist,
  handleOpenTimerControl,
  handleSyncOutputs,
  iconButtonClass,
  isAuthenticated,
  isConnected,
  maxSetlistFiles,
  ready,
  refreshAuthToken,
  setDarkMode,
  setThemeMode,
  showModal,
  themeMode,
}) {
  return (
    <div className="mb-6">
      <div className="grid grid-cols-8 gap-2 w-full">
        <Tooltip content={<span>Search and import lyrics from online providers - <strong>Ctrl+Shift+O</strong></span>} side="bottom">
          <button
            className={iconButtonClass(false)}
            onClick={handleOpenOnlineLyricsSearch}
          >
            <Globe className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content={<span>View and manage your song setlist (up to {maxSetlistFiles} songs) - <strong>Ctrl+Shift+S</strong></span>} side="bottom">
          <button
            className={iconButtonClass(false)}
            onClick={handleOpenSetlist}
          >
            <ListMusic className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Force refresh all output displays with current state" side="bottom">
          <button
            disabled={!isConnected || !isAuthenticated || !ready}
            className={iconButtonClass(!isConnected || !isAuthenticated || !ready)}
            onClick={handleSyncOutputs}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content={
          themeMode === 'system'
            ? "Theme is managed by system preferences. Change in Preferences -> Appearance."
            : darkMode ? "Switch to light mode" : "Switch to dark mode"
        } side="bottom">
          <button
            className={iconButtonClass(themeMode === 'system')}
            disabled={themeMode === 'system'}
            onClick={() => {
              if (themeMode === 'system') return;
              const next = !darkMode;
              const nextMode = next ? 'dark' : 'light';
              setDarkMode(next);
              setThemeMode(nextMode);
              window.electronAPI?.preferences?.set?.('appearance.themeMode', nextMode);
              window.electronAPI?.syncNativeThemeSource?.(nextMode);
              window.electronAPI?.setDarkMode?.(next);
            }}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </Tooltip>

        <Tooltip content="Application preferences and settings" side="bottom">
          <button
            className={iconButtonClass(false)}
            onClick={() => {
              showModal({
                title: 'Preferences',
                headerDescription: 'Configure application settings and preferences',
                component: 'UserPreferences',
                variant: 'info',
                size: 'lg',
                actions: [],
                allowBackdropClose: false,
                customLayout: true
              });
            }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Project an output to this monitor or an external display" side="bottom">
          <button
            className={iconButtonClass(false)}
            onClick={() => {
              showModal({
                title: 'Project to Display',
                headerDescription: 'Choose what to show and where it should appear.',
                component: 'ProjectOutput',
                variant: 'info',
                size: 'lg',
                className: 'max-w-4xl',
                actions: [],
                customLayout: true,
              });
            }}
          >
            <MonitorUp className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Open timer control window" side="bottom">
          <button
            className={iconButtonClass(false)}
            onClick={handleOpenTimerControl}
          >
            <Timer className="h-4 w-4" />
          </button>
        </Tooltip>

        <AuthStatusIndicator
          authStatus={authStatus}
          connectionStatus={connectionStatus}
          onRetry={forceReconnect}
          onRefreshToken={refreshAuthToken}
          darkMode={darkMode}
          compact
          className="h-10 w-full"
        />
      </div>
    </div>
  );
}
