export const LYRIC_VIDEO_STUDIO_STATE_KEY = 'lyric-video-studio-state-v1';
export const LYRIC_VIDEO_STUDIO_CHANNEL = 'lyric-video-studio-live';

export const sanitizeLyricVideoAudioForPersistence = (audio = {}) => ({
  filePath: typeof audio.filePath === 'string' ? audio.filePath : null,
  fileName: typeof audio.fileName === 'string' ? audio.fileName : '',
  mimeType: typeof audio.mimeType === 'string' ? audio.mimeType : '',
  durationMs: Number.isFinite(Number(audio.durationMs)) ? Number(audio.durationMs) : 0,
});

export const sanitizeLyricVideoProjectForPersistence = (project = {}) => ({
  ...project,
  audio: {
    ...sanitizeLyricVideoAudioForPersistence(project.audio),
    objectUrl: '',
    sourceUrl: '',
  },
});

export function readLyricVideoStudioState() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LYRIC_VIDEO_STUDIO_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLyricVideoStudioState(state) {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(LYRIC_VIDEO_STUDIO_STATE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
