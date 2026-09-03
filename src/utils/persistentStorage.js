export const getPersistentStorage = () => {
  if (typeof window === 'undefined') return undefined;

  const nativeStorage = window.electronAPI?.persistentStorage;
  if (
    nativeStorage
    && typeof nativeStorage.getItem === 'function'
    && typeof nativeStorage.setItem === 'function'
    && typeof nativeStorage.removeItem === 'function'
  ) {
    return nativeStorage;
  }

  try {
    return window.localStorage || undefined;
  } catch {
    return undefined;
  }
};

export const readPersistentStorageItem = (key) => {
  try {
    return getPersistentStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writePersistentStorageItem = (key, value) => {
  try {
    const storage = getPersistentStorage();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removePersistentStorageItem = (key) => {
  try {
    const storage = getPersistentStorage();
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
