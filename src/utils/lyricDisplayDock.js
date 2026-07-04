export const launchHeadlessActionClass = '!border-transparent !bg-blue-600 !text-white hover:!bg-blue-700';

const DEFAULT_DOCK_TEXT = {
  cancel: 'Cancel',
  close: 'Close',
  confirmBody: 'Save any unsaved work before continuing. After the switch, use LyricDisplay Dock in OBS to control lyrics and output settings.',
  confirmDescription: 'LyricDisplay will keep running for the OBS dock without the desktop window.',
  confirmTitle: 'Switch to Dock Mode?',
  errorFallback: 'LyricDisplay could not switch to Dock Mode.',
  errorTitle: 'Dock Mode Could Not Start',
  switchToDock: 'Switch to Dock Mode',
};

const getDockText = (text = {}) => ({ ...DEFAULT_DOCK_TEXT, ...text });

export async function confirmAndLaunchHeadlessMode({ showModal, showToast, text } = {}) {
  const dockText = getDockText(text);
  const confirmation = await showModal?.({
    title: dockText.confirmTitle,
    description: dockText.confirmDescription,
    body: dockText.confirmBody,
    variant: 'warn',
    size: 'sm',
    actions: [
      { label: dockText.cancel, value: 'cancel', variant: 'outline' },
      { label: dockText.switchToDock, value: 'start', variant: 'destructive' },
    ],
  });

  if (confirmation !== 'start') return false;

  try {
    const result = await window.electronAPI?.obsDock?.startHeadlessNow?.();
    if (result?.success === false) {
      showToast?.({
        title: dockText.errorTitle,
        message: result.error || dockText.errorFallback,
        variant: 'error',
      });
      return false;
    }
    return true;
  } catch (error) {
    showToast?.({
      title: dockText.errorTitle,
      message: error.message || dockText.errorFallback,
      variant: 'error',
    });
    return false;
  }
}

export function createLyricDisplayDockSetupActions(onLaunchHeadlessMode, text) {
  const dockText = getDockText(text);
  return [
    { label: dockText.close, variant: 'outline' },
    {
      label: dockText.switchToDock,
      variant: 'default',
      autoFocus: true,
      closeOnClick: false,
      className: launchHeadlessActionClass,
      onSelect: onLaunchHeadlessMode,
    },
  ];
}
