import React from 'react';
import { Globe, List, RefreshCw, Shield, FolderOpen, FileText, Type, Paintbrush, AlignVerticalSpaceAround, Scissors, Copy, ClipboardPaste, Wand2, Bold, Italic, Underline, CaseUpper, ScreenShare } from 'lucide-react';

const HelpSection = ({ icon: Icon, title, description, darkMode }) => (
    <div className={`flex gap-3 p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-white'
            }`}>
            <Icon className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1">
            <h4 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h4>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {description}
            </p>
        </div>
    </div>
);

export const ControlPanelHelp = ({ darkMode }) => (
    <div className="space-y-3">
        <HelpSection
            icon={Globe}
            title="Search Online Lyrics"
            description="Search multiple lyrics databases simultaneously. Find songs from LRCLIB, ChartLyrics, Lyrics.ovh, Vagalume, Hymnary.org, and more. Results include synced LRC files when available."
            darkMode={darkMode}
        />

        <HelpSection
            icon={List}
            title="Setlist Manager"
            description="Build and organize your service setlist. Add up to 25 songs, reorder with drag-and-drop, and load lyrics instantly during live events. Perfect for planning your worship services."
            darkMode={darkMode}
        />

        <HelpSection
            icon={RefreshCw}
            title="Sync Outputs"
            description="Force a manual synchronization of all output displays. Use this if displays get out of sync or when reconnecting. Sends current lyrics, line selection, and all settings to connected displays."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Shield}
            title="Connection Status"
            description="View your secure JWT authentication status and backend connection health. Click to see detailed diagnostics, refresh tokens, or view the 6-digit join code for mobile controllers."
            darkMode={darkMode}
        />

        <HelpSection
            icon={FolderOpen}
            title="Load Lyrics File"
            description="Import .txt or .lrc files from your computer. Supports plain text lyrics and timestamped LRC format. Files are automatically formatted with smart capitalization and religious term handling."
            darkMode={darkMode}
        />

        <HelpSection
            icon={FileText}
            title="Create New Song"
            description="Open the song canvas to compose lyrics from scratch. Includes formatting tools, translation support, line duplication, and cleanup utilities. Save locally or load directly to the control panel."
            darkMode={darkMode}
        />

        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                💡 <strong>Pro Tip:</strong> Use Ctrl/Cmd+O to quickly load files and Ctrl/Cmd+N for new songs. The Display Output toggle controls visibility on all connected displays simultaneously.
            </p>
        </div>
    </div>
);

export const OutputSettingsHelp = ({ darkMode }) => (
    <div className="space-y-3">
        <HelpSection
            icon={AlignVerticalSpaceAround}
            title="Lyrics Position"
            description="Choose where lyrics appear on screen: Upper Third (top), Centre (middle), or Lower Third (bottom). Automatically set to Centre when Full Screen Mode is enabled. Perfect for different presentation styles."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Type}
            title="Font Style & Size"
            description="Select from 13 professional fonts including Arial, Bebas Neue, Inter, Montserrat, and more. Adjust size from 24-100px to ensure perfect readability on any screen or projector."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Bold}
            title="Text Emphasis"
            description="Apply bold, italic, underline, or ALL CAPS styling. Mix and match for maximum impact. Bold and ALL CAPS are particularly effective for large venues and outdoor displays."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Paintbrush}
            title="Font & Shadow Colors"
            description="Choose any color for your lyrics text. Add drop shadows (0-10 opacity) for depth and improved readability over backgrounds. Shadows are especially useful for video overlays."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Type}
            title="Text Border"
            description="Add an outline around text (0-10px thickness) in any color. Essential for ensuring lyrics remain readable over complex backgrounds or when using full screen media."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Paintbrush}
            title="Background Band"
            description="Add a semi-transparent colored band behind lyrics (0-10 opacity). Disabled automatically in Full Screen Mode. Useful for traditional worship presentations and ensuring text contrast."
            darkMode={darkMode}
        />

        <HelpSection
            icon={AlignVerticalSpaceAround}
            title="X & Y Margins"
            description="Fine-tune the exact position of lyrics on screen. Adjust horizontal (X) and vertical (Y) spacing in rem units. Perfect for aligning with your specific presentation layout or avoiding camera overlays."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Wand2}
            title="Transition Style"
            description="Add smooth animations when lyrics change on display. Choose from None (instant), Fade (opacity), Scale (zoom), Slide (vertical motion), or Blur effects. Adjust transition speed from 100-2000ms for the perfect timing."
            darkMode={darkMode}
        />

        <HelpSection
            icon={ScreenShare}
            title="Full Screen Mode"
            description="Expand lyrics to fill the entire display with automatic Centre positioning. Choose between a solid color background or upload custom images/videos (up to 200MB). Ideal for immersive worship experiences and special presentations."
            darkMode={darkMode}
        />

        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-purple-900/20 border border-purple-700/30' : 'bg-purple-50 border border-purple-200'}`}>
            <p className={`text-sm font-medium ${darkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                💡 <strong>Pro Tip:</strong> Output 1 and Output 2 have completely independent settings. Use one for in-house displays and another for broadcast overlays with different styling and positioning.
            </p>
        </div>
    </div>
);

export const SongCanvasHelp = ({ darkMode }) => (
    <div className="space-y-3">
        <HelpSection
            icon={Scissors}
            title="Cut, Copy & Paste"
            description="Standard clipboard operations with automatic formatting. Paste lyrics from any source and they'll be cleaned up automatically. Works with keyboard shortcuts (Ctrl/Cmd+X, C, V) or toolbar buttons."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Wand2}
            title="Auto Cleanup"
            description="Intelligently formats lyrics by removing extra spaces, normalizing line breaks, capitalizing religious terms (Jesus, God, Lord, etc.), and splitting overly long lines. Click the magic wand icon or paste content into the canvas"
            darkMode={darkMode}
        />

        <HelpSection
            icon={Type}
            title="Line Selection & Editing"
            description="Click any line to select it (highlights in blue). Right-click for context menu with options to Copy Line, Add Translation, or Duplicate Line. Selected lines show an inline toolbar for quick actions. You can also use Ctrl/Cmd+L to select the current line."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Bold}
            title="Translation Lines"
            description="Add translation or alternate text below any lyric line by clicking 'Add Translation' or pressing Ctrl/Cmd+T. Translations appear in parentheses () and will display in amber color on output displays."
            darkMode={darkMode}
        />

        <HelpSection
            icon={Copy}
            title="Duplicate Lines"
            description="Quickly repeat a line (like a chorus) by selecting it and choosing 'Duplicate Line' from the context menu or pressing Ctrl/Cmd+D. Creates an empty line followed by an exact copy."
            darkMode={darkMode}
        />

        <HelpSection
            icon={ClipboardPaste}
            title="Context Menu Actions"
            description="Right-click (desktop) or long-press (mobile) to access powerful editing tools. Available actions vary based on whether you have text selected or are targeting a specific line."
            darkMode={darkMode}
        />

        <HelpSection
            icon={FileText}
            title="Save & Load Options"
            description="Save lyrics as .txt files to your computer, or use 'Save & Load' to save AND immediately load into the control panel. Desktop app remembers recent files for quick access."
            darkMode={darkMode}
        />

        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'}`}>
            <p className={`text-sm font-medium ${darkMode ? 'text-green-300' : 'text-green-800'}`}>
                ⌨️ <strong>Keyboard Shortcuts:</strong> Ctrl/Cmd+Z/Y for undo/redo, Ctrl/Cmd+T for translation, Ctrl/Cmd+D for duplicate, Ctrl/Cmd+L to select line. Mobile controllers can submit drafts for desktop approval.
            </p>
        </div>
    </div>
);

export default { ControlPanelHelp, OutputSettingsHelp, SongCanvasHelp };