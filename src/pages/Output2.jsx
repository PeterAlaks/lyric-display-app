import React, { useEffect } from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';

const Output2 = () => {
  const { socket } = useSocket('output');
  const {
    lyrics,
    selectedLine,
    output2Settings,
    isOutputOn,
    setIsOutputOn,
    setLyrics,
    selectLine,
    updateOutputSettings,
  } = useLyricsStore();
  
  // Get the current line and process it for output
  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  useEffect(() => {
    if (!socket) return;
    socket.emit('requestCurrentState');
    socket.on('currentState', ({ lyrics, selectedLine, output2Settings, isOutputOn }) => {
      setLyrics(lyrics);
      selectLine(selectedLine);
      if (output2Settings) updateOutputSettings('output2', output2Settings);
      if (typeof isOutputOn === 'boolean') setIsOutputOn(isOutputOn);
    });

    socket.on('lineUpdate', ({ index }) => {
      selectLine(index);
    });
    socket.on('lyricsLoad', (newLyrics) => {
      setLyrics(newLyrics);
      selectLine(null);
    });
    socket.on('styleUpdate', ({ output, settings }) => {
      if (output === 'output2') {
        updateOutputSettings('output2', settings);
      }
    });
    return () => {
      socket.off('currentState');
      socket.off('lineUpdate');
      socket.off('lyricsLoad');
      socket.off('styleUpdate');
    };
  }, [socket, selectLine, setLyrics, updateOutputSettings, setIsOutputOn]);

  const {
    fontStyle,
    bold,
    italic,
    underline,
    allCaps,
    fontSize,
    fontColor,
    dropShadowColor,
    dropShadowOpacity,
    backgroundColor,
    backgroundOpacity,
    xMargin,
    yMargin,
  } = output2Settings;

  const getTextShadow = () => {
    const opacity = Math.round((dropShadowOpacity / 10) * 255)
      .toString(16)
      .padStart(2, '0');
    return `0px 8px 10px ${dropShadowColor}${opacity}`;
  };

  const getBackground = () => {
    const opacity = Math.round((backgroundOpacity / 10) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${backgroundColor}${opacity}`;
  };

  // Apply text transformations and handle multi-line content
  const processDisplayText = (text) => {
    return allCaps ? text.toUpperCase() : text;
  };

  // Render multi-line content with proper styling for translations
  const renderContent = () => {
    const processedText = processDisplayText(line);
    
    // Check if we have line breaks (from grouped content)
    if (processedText.includes('\n')) {
      const lines = processedText.split('\n');
      return (
        <div className="space-y-1">
          {lines.map((lineText, index) => (
            <div 
              key={index} 
              className={index > 0 ? ' opacity-90' : 'font-medium'}
            >
              {lineText}
            </div>
          ))}
        </div>
      );
    }
    
    return processedText;
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      {isOutputOn && line && (
        <div
          style={{
            fontFamily: fontStyle,
            fontSize: `${fontSize}px`,
            fontWeight: bold ? 'bold' : 'normal',
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
            color: fontColor,
            textShadow: getTextShadow(),
            backgroundColor: getBackground(),
            padding: `${yMargin}rem ${xMargin}rem`,
          }}
          className="w-full h-full flex items-center justify-center text-center leading-none"
        >
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export default Output2;