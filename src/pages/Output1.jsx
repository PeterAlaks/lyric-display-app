import React, { useEffect } from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';

const Output1 = () => {
  const { socket } = useSocket('output');
  const {
    lyrics,
    selectedLine,
    output1Settings,
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
    socket.on('currentState', ({ lyrics, selectedLine, output1Settings, isOutputOn }) => {
      setLyrics(lyrics);
      selectLine(selectedLine);
      if (output1Settings) updateOutputSettings('output1', output1Settings);
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
      if (output === 'output1') {
        updateOutputSettings('output1', settings);
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
  } = output1Settings;

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
          className="w-full text-center"
        >
          {line}
        </div>
      )}
    </div>
  );
};

export default Output1;