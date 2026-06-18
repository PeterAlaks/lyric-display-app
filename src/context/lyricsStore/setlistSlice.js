import { DEFAULT_SETLIST_ITEMS, normalizeSetlistItemLimit } from '../../../shared/setlistLimits.js';

let maxSetlistFilesLimit = DEFAULT_SETLIST_ITEMS;

export const createSetlistSlice = (set, get) => ({
  setlistFiles: [],
  setlistModalOpen: false,
  maxSetlistFilesLimit: DEFAULT_SETLIST_ITEMS,
  maxSetlistFilesVersion: 0,

  setSetlistFiles: (files) => set({ setlistFiles: files }),
  setSetlistModalOpen: (open) => set({ setlistModalOpen: open }),
  addSetlistFiles: (newFiles) => set((state) => ({
    setlistFiles: [...state.setlistFiles, ...newFiles],
  })),
  removeSetlistFile: (fileId) => set((state) => ({
    setlistFiles: state.setlistFiles.filter((file) => file.id !== fileId),
  })),
  clearSetlist: () => set({ setlistFiles: [] }),

  getSetlistFile: (fileId) => {
    const state = get();
    return state.setlistFiles.find((file) => file.id === fileId);
  },

  isSetlistFull: () => {
    const state = get();
    return state.setlistFiles.length >= maxSetlistFilesLimit;
  },

  getAvailableSetlistSlots: () => {
    const state = get();
    return Math.max(0, maxSetlistFilesLimit - state.setlistFiles.length);
  },

  getMaxSetlistFiles: () => maxSetlistFilesLimit,

  updateMaxSetlistFiles: (newLimit) => {
    const normalized = normalizeSetlistItemLimit(newLimit);
    maxSetlistFilesLimit = normalized;
    set((state) => ({
      maxSetlistFilesLimit: normalized,
      maxSetlistFilesVersion: state.maxSetlistFilesVersion + 1,
    }));
  },
});
