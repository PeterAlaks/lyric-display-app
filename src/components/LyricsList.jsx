// Project: Lyric Display App
// File: src/components/LyricsList.jsx

import React from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';

const LyricsList = () => {
  const { lyrics, selectedLine, selectLine } = useLyricsStore();
  const { emitLineUpdate } = useSocket();

  const handleLineClick = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  return (
    <div className="space-y-2">
      {lyrics.map((line, index) => (
        <div
          key={index}
          className={`p-3 rounded cursor-pointer transition-colors ${
            index === selectedLine
              ? 'bg-blue-400 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => handleLineClick(index)}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

export default LyricsList;