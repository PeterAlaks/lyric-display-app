import { useEffect, useState } from 'react';

export default function useIsPackagedApp() {
  const [isPackagedApp, setIsPackagedApp] = useState(false);

  useEffect(() => {
    const getRuntimeInfo = window.electronAPI?.getRuntimeInfo;
    if (!getRuntimeInfo) return undefined;

    let cancelled = false;

    getRuntimeInfo()
      .then((result) => {
        if (!cancelled) setIsPackagedApp(result?.success === true && result.isPackaged === true);
      })
      .catch(() => {
        if (!cancelled) setIsPackagedApp(false);
      });

    return () => { cancelled = true; };
  }, []);

  return isPackagedApp;
}
