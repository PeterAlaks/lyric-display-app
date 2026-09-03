import { useCallback, useEffect, useRef } from 'react';
import useModal from '@/hooks/useModal';
import useIsPackagedApp from '@/hooks/useIsPackagedApp';
import useToast from '@/hooks/useToast';
import {
  CHECK_APP_ANNOUNCEMENTS_EVENT,
  isAnnouncementSurfaceCalm,
} from '@/constants/modalEvents';
import { readPersistentStorageItem, writePersistentStorageItem } from '@/utils/persistentStorage';

const ANNOUNCEMENT_URL = 'https://lyricdisplay.app/.netlify/functions/app-announcement';
const SEEN_ANNOUNCEMENTS_KEY = 'lyricdisplay.seen-announcement-ids';
const STARTUP_DELAY_MS = 10_000;
const STARTUP_JITTER_MS = 5_000;
const CALM_RETRY_MS = 1_500;
const REQUEST_TIMEOUT_MS = 12_000;

const readSeenAnnouncementIds = () => {
  try {
    const parsed = JSON.parse(readPersistentStorageItem(SEEN_ANNOUNCEMENTS_KEY) || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id) => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
};

const rememberAnnouncement = (id) => {
  try {
    const ids = readSeenAnnouncementIds().filter((seenId) => seenId !== id);
    writePersistentStorageItem(
      SEEN_ANNOUNCEMENTS_KEY,
      JSON.stringify([...ids, id]),
    );
  } catch {
    // A storage failure should not prevent the announcement from being shown.
  }
};

const normalizeAnnouncement = (value) => {
  const id = typeof value?.id === 'string' ? value.id.trim() : '';
  const title = typeof value?.title === 'string' ? value.title.trim() : '';
  const body = typeof value?.body === 'string' ? value.body.trim() : '';
  const imageUrl = typeof value?.image_url === 'string' ? value.image_url.trim() : '';
  if (!id || !title || !body || !imageUrl || title.length > 160 || body.length > 3000) return null;
  try {
    if (new URL(imageUrl).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { id, title, body, imageUrl };
};

export default function AppAnnouncementBridge() {
  const { showModal } = useModal();
  const { showToast } = useToast();
  const isPackagedApp = useIsPackagedApp();
  const surfacedThisSession = useRef(new Set());
  const pendingAnnouncements = useRef(new Set());
  const activeCheck = useRef(null);
  const surfaceTimer = useRef(null);

  const surfaceAnnouncement = useCallback((announcement, { remember = true } = {}) => {
    if (!announcement || surfacedThisSession.current.has(announcement.id)) return false;
    surfacedThisSession.current.add(announcement.id);
    if (remember) rememberAnnouncement(announcement.id);
    showModal({
      title: announcement.title,
      component: 'AppAnnouncement',
      announcement,
      size: 'announcement',
      customLayout: true,
      hideHeader: true,
      hideFooter: true,
      actions: [],
      variant: 'info',
      dedupeKey: `app-announcement:${announcement.id}`,
    });
    return true;
  }, [showModal]);

  const surfaceWhenCalm = useCallback((announcement) => {
    if (
      !announcement
      || surfacedThisSession.current.has(announcement.id)
      || pendingAnnouncements.current.has(announcement.id)
    ) return false;

    pendingAnnouncements.current.add(announcement.id);
    const attempt = () => {
      if (!isAnnouncementSurfaceCalm(document)) {
        surfaceTimer.current = window.setTimeout(attempt, CALM_RETRY_MS);
        return;
      }
      surfaceTimer.current = null;
      pendingAnnouncements.current.delete(announcement.id);
      surfaceAnnouncement(announcement);
    };
    attempt();
    return true;
  }, [surfaceAnnouncement]);

  const checkForAnnouncement = useCallback(async ({ manual = false } = {}) => {
    if (activeCheck.current) {
      if (manual) {
        showToast({
          title: 'Checking notifications',
          message: 'A notification check is already in progress.',
          variant: 'info',
          dedupeKey: 'app-announcement-check-running',
        });
      }
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const requestTimer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    activeCheck.current = controller;
    try {
      const response = await fetch(ANNOUNCEMENT_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Announcement request failed with ${response.status}`);

      const payload = await response.json();
      const announcement = normalizeAnnouncement(payload?.announcement);
      if (payload?.announcement && !announcement) throw new Error('Announcement response was invalid');

      const alreadyHandled = announcement && (
        new Set(readSeenAnnouncementIds()).has(announcement.id)
        || surfacedThisSession.current.has(announcement.id)
        || pendingAnnouncements.current.has(announcement.id)
      );

      if (!announcement || alreadyHandled) {
        if (manual) {
          showToast({
            title: 'No new notifications',
            message: "You're all caught up.",
            variant: 'info',
            dedupeKey: 'app-announcement-none',
          });
        }
        return;
      }

      surfaceWhenCalm(announcement);
    } catch (error) {
      if (error?.name === 'AbortError' && !timedOut) return;
      if (manual) {
        showToast({
          title: "Couldn't check for notifications",
          message: 'Check your internet connection and try again.',
          variant: 'error',
          dedupeKey: 'app-announcement-check-error',
        });
      }
    } finally {
      window.clearTimeout(requestTimer);
      if (activeCheck.current === controller) activeCheck.current = null;
    }
  }, [showToast, surfaceWhenCalm]);

  useEffect(() => {
    const check = () => checkForAnnouncement({ manual: true });
    window.addEventListener(CHECK_APP_ANNOUNCEMENTS_EVENT, check);
    return () => {
      window.removeEventListener(CHECK_APP_ANNOUNCEMENTS_EVENT, check);
    };
  }, [checkForAnnouncement]);

  useEffect(() => {
    if (!isPackagedApp) return undefined;

    const delay = STARTUP_DELAY_MS + Math.floor(Math.random() * STARTUP_JITTER_MS);
    const timer = window.setTimeout(() => checkForAnnouncement(), delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [checkForAnnouncement, isPackagedApp]);

  useEffect(() => () => {
    activeCheck.current?.abort();
    if (surfaceTimer.current) window.clearTimeout(surfaceTimer.current);
    pendingAnnouncements.current.clear();
  }, []);

  return null;
}
