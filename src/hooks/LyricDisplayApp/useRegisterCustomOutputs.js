import { useEffect } from 'react';

export const useRegisterCustomOutputs = (customOutputIds) => {
  useEffect(() => {
    if (!window.electronAPI?.ndi?.registerOutputs) return;
    window.electronAPI.ndi.registerOutputs(customOutputIds);
  }, [customOutputIds]);
};
