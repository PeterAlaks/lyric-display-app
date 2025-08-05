import React, { useRef } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import useFileUpload from '../hooks/useFileUpload';
import LyricsList from './LyricsList';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";


// Main App Component
const LyricDisplayApp = () => {
  // Global state management
  const {
    isOutputOn,
    setIsOutputOn,
    lyrics,
    lyricsFileName,
    selectedLine,
    selectLine,
    output1Settings,
    output2Settings,
    updateOutputSettings
  } = useLyricsStore();

  const { emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate } = useSocket('control');

  // File upload functionality
  const handleFileUpload = useFileUpload();
  const fileInputRef = useRef(null);

  // Tabs
  const [activeTab, setActiveTab] = React.useState('output1');

  // Check if lyrics are loaded
  const hasLyrics = lyrics && lyrics.length > 0;

  // Font options for dropdown
  const fontOptions = [
    'Bebas Neue',
    'Fira Sans',
    'Inter',
    'Lato',
    'Montserrat',
    'Noto Sans',
    'Open Sans',
    'Poppins',
    'Roboto',
    'Work Sans'
  ];

  // Handle file upload button click
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      await handleFileUpload(file);
    }
  };

  // Handle line selection
  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  console.log('Toggle emitted:', !isOutputOn)

  // Get current settings based on active tab
  const getCurrentSettings = () => {
    return activeTab === 'output1' ? output1Settings : output2Settings;
  };

  // Update settings based on active tab
  const updateSettings = (newSettings) => {
    const outputKey = activeTab === 'output1' ? 'output1' : 'output2';
    updateOutputSettings(outputKey, newSettings);
    emitStyleUpdate(outputKey, newSettings);
  };

  // Handle output toggle
  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Left Sidebar - Control Panel */}
      <div className="w-[420px] bg-white shadow-lg p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">LyricDisplay</h1>
          <RefreshCw className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        </div>

        {/* Add Lyrics Button */}
        <button
          className="w-full mb-3 py-3 px-4 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
          onClick={openFileDialog}
        >
          <Plus className="w-5 h-5" />
          Add lyrics file (.txt)
        </button>
        <input
          type="file"
          accept=".txt"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Current File Indicator */}
        {hasLyrics && (
          <div className="mb-6 text-sm font-semibold text-gray-600">
            {lyricsFileName}
          </div>
        )}

        {/* Output Toggle */}
        <div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-4 mx-2">
    <Switch
      checked={isOutputOn}
      onCheckedChange={handleToggle}
      className="scale-[1.8] data-[state=checked]:bg-black"
    />
    <span className="text-sm text-gray-600 ml-5">
      {isOutputOn ? 'Display Output is ON' : 'Display Output is OFF'}
    </span>
  </div>
</div>

<div class="border-t border-gray-100 my-10"></div>

        {/* Output Settings */}
        <div className="mb-6">
          <OutputSettingsPanel
            outputKey={activeTab}
            settings={getCurrentSettings()}
            updateSettings={updateSettings}
            fontOptions={fontOptions}
          />
        </div>

        {/* Output Tabs */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'output1'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('output1')}
          >
            Output 1
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'output2'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('output2')}
          >
            Output 2
          </button>
        </div>

<div className="mt-4 text-[10px] text-gray-400 text-left">
      Designed and Developed by Peter Alakembi and David Okaliwe for Victory City Media ©2025
    </div>

      </div>

      {/* Right Main Area */}
      <div className="flex-1 p-6 overflow-y-hidden h-screen">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {hasLyrics ? lyricsFileName : ''}
          </h2>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-y-auto">
          {hasLyrics ? (
            <div className="p-4 h-full overflow-y-auto">
              <LyricsList
                lyrics={lyrics}
                selectedLine={selectedLine}
                onSelectLine={handleLineSelect}
              />
            </div>
          ) : (
            /* Empty State - Drag and Drop */
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <Plus className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg">Drag and drop TXT lyric files here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LyricDisplayApp;