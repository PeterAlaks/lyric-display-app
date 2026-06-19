export const launchHeadlessActionClass = '!border-transparent !bg-blue-600 !text-white hover:!bg-blue-700';

export async function confirmAndLaunchHeadlessMode({ showModal, showToast } = {}) {
  const confirmation = await showModal?.({
    title: 'Launch Headless Mode?',
    description: 'LyricDisplay will close the current app windows and relaunch in LyricDisplay Dock headless mode.',
    body: 'Use this when you want LyricDisplay Dock to control LyricDisplay without keeping the main desktop window open. Unsaved work should be saved before continuing.',
    variant: 'warn',
    size: 'sm',
    actions: [
      { label: 'Cancel', value: 'cancel', variant: 'outline' },
      { label: 'Launch Headless Mode', value: 'start', variant: 'destructive' },
    ],
  });

  if (confirmation !== 'start') return false;

  try {
    const result = await window.electronAPI?.obsDock?.startHeadlessNow?.();
    if (result?.success === false) {
      showToast?.({
        title: 'Headless Launch Failed',
        message: result.error || 'Could not relaunch LyricDisplay in headless mode.',
        variant: 'error',
      });
      return false;
    }
    return true;
  } catch (error) {
    showToast?.({
      title: 'Headless Launch Failed',
      message: error.message || 'Could not relaunch LyricDisplay in headless mode.',
      variant: 'error',
    });
    return false;
  }
}

export function createLyricDisplayDockSetupActions(onLaunchHeadlessMode) {
  return [
    { label: 'Close', variant: 'outline' },
    {
      label: 'Launch Headless Mode',
      variant: 'default',
      autoFocus: true,
      closeOnClick: false,
      className: launchHeadlessActionClass,
      onSelect: onLaunchHeadlessMode,
    },
  ];
}
