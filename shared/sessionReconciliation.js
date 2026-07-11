import { getAllRoutableOutputIds } from './outputRegistry.js';

const ROUTABLE_OUTPUT_IDS = new Set(getAllRoutableOutputIds());

export const getDesktopBootstrapOutputIds = (storeState = {}) => (
  (Array.isArray(storeState.customOutputIds) ? storeState.customOutputIds : [])
    .filter((outputId) => ROUTABLE_OUTPUT_IDS.has(outputId) && outputId !== 'output1' && outputId !== 'output2')
);

export const shouldBootstrapDesktopSession = ({ snapshot, isDesktopApp } = {}) => (
  Boolean(isDesktopApp) && snapshot?.sessionAuthority?.bootstrapAllowed === true
);

export const emitDesktopSessionBootstrap = (socket, storeState = {}) => {
  if (!socket?.emit || !storeState || typeof storeState !== 'object') return false;

  const customOutputs = getDesktopBootstrapOutputIds(storeState);
  socket.emit('outputsRegister', { outputs: customOutputs });

  for (const key of Object.keys(storeState)) {
    if (key.startsWith('output') && key.endsWith('Settings') && storeState[key]) {
      const outputId = key.slice(0, -'Settings'.length);
      if (!ROUTABLE_OUTPUT_IDS.has(outputId)) continue;
      socket.emit('styleUpdate', {
        output: outputId,
        settings: storeState[key],
      });
    }
  }

  if (storeState.stageSettings) {
    socket.emit('styleUpdate', { output: 'stage', settings: storeState.stageSettings });
  }

  socket.emit('outputToggle', Boolean(storeState.isOutputOn));
  for (const key of Object.keys(storeState)) {
    if (!key.startsWith('output') || !key.endsWith('Enabled') || typeof storeState[key] !== 'boolean') continue;
    const outputId = key.slice(0, -'Enabled'.length);
    if (!ROUTABLE_OUTPUT_IDS.has(outputId)) continue;
    socket.emit('individualOutputToggle', {
      output: outputId,
      enabled: storeState[key],
    });
  }
  if (typeof storeState.stageEnabled === 'boolean') {
    socket.emit('individualOutputToggle', { output: 'stage', enabled: storeState.stageEnabled });
  }

  if (Array.isArray(storeState.lyrics) && storeState.lyrics.length > 0) {
    socket.emit('lyricsLoad', {
      lyrics: storeState.lyrics,
      fileName: storeState.lyricsFileName || '',
      rawLyricsContent: storeState.rawLyricsContent || '',
      lyricsSource: storeState.lyricsSource || null,
      songMetadata: storeState.songMetadata || null,
      lyricsTimestamps: storeState.lyricsTimestamps || [],
      lyricsEnhancedTimestamps: storeState.lyricsEnhancedTimestamps || [],
      sections: storeState.lyricsSections || [],
      lineToSection: storeState.lineToSection || {},
    });
    socket.emit('lineUpdate', { index: storeState.selectedLine });
  }

  return true;
};
