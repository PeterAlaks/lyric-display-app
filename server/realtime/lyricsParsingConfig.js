import { buildLyricsParsingOptions } from '../../shared/lyricsParsing.js';

const readInitialConfig = () => {
  const serialized = process.env.LYRICDISPLAY_PARSING_CONFIG;
  if (!serialized) return {};

  try {
    const parsed = JSON.parse(serialized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('[LyricsParsing] Ignoring invalid startup parsing configuration:', error.message);
    return {};
  }
};

let currentConfig = readInitialConfig();

export function setLyricsParsingConfig(config = {}) {
  currentConfig = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  return getLyricsParsingOptions();
}

export function getLyricsParsingConfig() {
  return structuredClone(currentConfig);
}

export function getLyricsParsingOptions() {
  return buildLyricsParsingOptions(currentConfig);
}
