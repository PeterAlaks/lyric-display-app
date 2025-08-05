import React, { useEffect } from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';

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
  const line = lyrics[selectedLine] || '';

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
    // socket.on('outputToggle', (state) => {
    //   setIsOutputOn(state); // Zustand global update
    // });
    return () => {
      socket.off('currentState');
      socket.off('lineUpdate');
      socket.off('lyricsLoad');
      socket.off('styleUpdate');
      // socket.off('outputToggle');
    };
  }, [socket, selectLine, setLyrics, updateOutputSettings, setIsOutputOn]);

  const {
    fontStyle,
    bold,
    italic,
    underline,
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
    return `0px 0px 10px ${dropShadowColor}${opacity}`;
  };

  const getBackground = () => {
    const opacity = Math.round((backgroundOpacity / 10) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${backgroundColor}${opacity}`;
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      {isOutputOn && (
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
          className="w-full h-full flex items-center justify-center text-center"
        >
          {line}
        </div>
      )}
    </div>
  );
};

export default Output2;