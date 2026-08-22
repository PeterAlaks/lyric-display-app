export const REQUEST_MODAL_CLOSE_EVENT = 'lyricdisplay:request-modal-close';
export const CHECK_APP_ANNOUNCEMENTS_EVENT = 'check-app-announcements';

export function isAnnouncementSurfaceCalm(documentRoot) {
  return documentRoot.visibilityState !== 'hidden'
    && !documentRoot.querySelector('[aria-modal="true"]');
}
