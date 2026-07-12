const NOTIFICATION_PRIORITY = {
  available: 1,
  downloaded: 2,
};

export function createUpdateSessionPolicy() {
  let sessionActive = false;
  let automaticCheckDeferred = false;
  let deferredNotification = null;

  return {
    getSnapshot() {
      return { sessionActive, automaticCheckDeferred, deferredNotification };
    },

    deferAutomaticCheck() {
      if (!sessionActive) return false;
      automaticCheckDeferred = true;
      return true;
    },

    deferNotification(type) {
      if (!sessionActive || !NOTIFICATION_PRIORITY[type]) return false;
      if (!deferredNotification
        || NOTIFICATION_PRIORITY[type] >= NOTIFICATION_PRIORITY[deferredNotification]) {
        deferredNotification = type;
      }
      return true;
    },

    setSessionActive(active) {
      const nextActive = Boolean(active);
      if (nextActive === sessionActive) {
        return { changed: false, runDeferredCheck: false, releaseNotification: null };
      }

      sessionActive = nextActive;
      if (sessionActive) {
        return { changed: true, runDeferredCheck: false, releaseNotification: null };
      }

      const result = {
        changed: true,
        runDeferredCheck: automaticCheckDeferred && !deferredNotification,
        releaseNotification: deferredNotification,
      };
      automaticCheckDeferred = false;
      deferredNotification = null;
      return result;
    },
  };
}
