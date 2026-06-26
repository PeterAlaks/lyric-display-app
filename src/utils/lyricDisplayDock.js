export const launchHeadlessActionClass = '!border-transparent !bg-blue-600 !text-white hover:!bg-blue-700';

export async function confirmAndLaunchHeadlessMode({ showModal, showToast } = {}) {
  const confirmation = await showModal?.({
    title: 'Switch to Dock Mode?',
    description: 'LyricDisplay will keep running for the OBS dock without the desktop window.',
    body: 'Save any unsaved work before continuing. After the switch, use LyricDisplay Dock in OBS to control lyrics and output settings.',
    variant: 'warn',
    size: 'sm',
    actions: [
      { label: 'Cancel', value: 'cancel', variant: 'outline' },
      { label: 'Switch to Dock Mode', value: 'start', variant: 'destructive' },
    ],
  });

  if (confirmation !== 'start') return false;

  try {
    const result = await window.electronAPI?.obsDock?.startHeadlessNow?.();
    if (result?.success === false) {
      showToast?.({
        title: 'Dock Mode Could Not Start',
        message: result.error || 'LyricDisplay could not switch to Dock Mode.',
        variant: 'error',
      });
      return false;
    }
    return true;
  } catch (error) {
    showToast?.({
      title: 'Dock Mode Could Not Start',
      message: error.message || 'LyricDisplay could not switch to Dock Mode.',
      variant: 'error',
    });
    return false;
  }
}

export function createLyricDisplayDockSetupActions(onLaunchHeadlessMode) {
  return [
    { label: 'Close', variant: 'outline' },
    {
      label: 'Switch to Dock Mode',
      variant: 'default',
      autoFocus: true,
      closeOnClick: false,
      className: launchHeadlessActionClass,
      onSelect: onLaunchHeadlessMode,
    },
  ];
}
