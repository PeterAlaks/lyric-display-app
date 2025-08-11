// Project: Lyric Display App
// File: src/components/LyricsList.jsx

import React from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';

const LyricsList = ({ 
  lyrics: propLyrics, 
  selectedLine: propSelectedLine, 
  onSelectLine, 
  searchQuery = '', 
  highlightedLineIndex = null 
}) => {
  const { lyrics: storeLyrics, selectedLine: storeSelectedLine, selectLine } = useLyricsStore();
  const { emitLineUpdate } = useSocket();

  // Use props if provided, fallback to store (maintains backward compatibility)
  const lyrics = propLyrics || storeLyrics;
  const selectedLine = propSelectedLine !== undefined ? propSelectedLine : storeSelectedLine;

  const handleLineClick = (index) => {
    if (onSelectLine) {
      onSelectLine(index); // Use prop function if provided
    } else {
      selectLine(index); // Fallback to store function
      emitLineUpdate(index);
    }
  };

  // Function to highlight search terms in text
  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} className="bg-yellow-200 text-yellow-900 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Function to get line styling based on state
  const getLineClassName = (index) => {
    let baseClasses = 'p-3 rounded cursor-pointer transition-colors ';
    
    if (index === selectedLine) {
      // Selected line (blue)
      baseClasses += 'bg-blue-400 text-white';
    } else if (index === highlightedLineIndex && searchQuery) {
      // Highlighted search result (yellow/orange)
      baseClasses += 'bg-orange-200 text-orange-900 border-2 border-orange-400';
    } else {
      // Default styling
      baseClasses += 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
    
    return baseClasses;
  };

  return (
    <div className="space-y-2">
      {lyrics.map((line, index) => (
        <div
          key={index}
          data-line-index={index}
          className={getLineClassName(index)}
          onClick={() => handleLineClick(index)}
        >
          {highlightSearchTerm(line, searchQuery)}
        </div>
      ))}
    </div>
  );
};

export default LyricsList;