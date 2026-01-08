import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const SetlistExportModal = ({ darkMode, onExport, defaultTitle = 'Setlist', setExportState }) => {
  const [title, setTitle] = useState(defaultTitle);
  const [includeLyrics, setIncludeLyrics] = useState(false);

  React.useEffect(() => {
    if (setExportState) {
      setExportState({ title, includeLyrics });
    }
  }, [title, includeLyrics, setExportState]);

  return (
    <div className="space-y-6">
      {/* Title Input */}
      <div className="space-y-2">
        <label className={cn(
          'text-sm font-medium',
          darkMode ? 'text-gray-300' : 'text-gray-700'
        )}>
          Setlist Title
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter setlist title"
          className={cn(
            darkMode
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-300'
          )}
          autoFocus
        />
      </div>

      {/* Include Lyrics Checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="include-lyrics"
          checked={includeLyrics}
          onCheckedChange={setIncludeLyrics}
          className={cn(
            'mt-0.5',
            darkMode ? 'border-gray-600' : 'border-gray-300'
          )}
        />
        <div className="flex-1">
          <label
            htmlFor="include-lyrics"
            className={cn(
              'text-sm font-medium cursor-pointer leading-none',
              darkMode ? 'text-gray-300' : 'text-gray-700'
            )}
          >
            Include full lyrics
          </label>
          <p className={cn(
            'text-xs mt-1',
            darkMode ? 'text-gray-500' : 'text-gray-500'
          )}>
            Export complete lyrics for each song. If unchecked, only song titles and line counts will be exported.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetlistExportModal;