import { useCallback, useEffect, useState } from 'react';
import { classifyError } from '../../utils/errorClassification';

const useLyricsProviderKeys = ({ hasElectronBridge, isOpen, showToast }) => {
  const [providerDefinitions, setProviderDefinitions] = useState([]);
  const [keyEditor, setKeyEditor] = useState(null);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const loadProviderDefinitions = useCallback(async ({ cancelledRef } = {}) => {
    if (!hasElectronBridge) return;

    try {
      const response = await window.electronAPI.lyrics.listProviders();
      if (!cancelledRef?.current && response?.success) {
        setProviderDefinitions(response.providers || []);
      }
    } catch (error) {
      console.error('Failed to load provider definitions:', error);
    }
  }, [hasElectronBridge]);

  useEffect(() => {
    if (!isOpen || !hasElectronBridge) return undefined;

    const cancelledRef = { current: false };
    loadProviderDefinitions({ cancelledRef });
    return () => {
      cancelledRef.current = true;
    };
  }, [hasElectronBridge, isOpen, loadProviderDefinitions]);

  const resetKeyEditor = useCallback(() => {
    setKeyEditor(null);
    setKeyInputValue('');
  }, []);

  const openKeyEditor = useCallback(async (providerId) => {
    if (!hasElectronBridge) return;
    setKeyEditor(providerId);
    setKeyInputValue('');
    try {
      const response = await window.electronAPI.lyrics.getProviderKey(providerId);
      if (response?.success && response?.key) {
        setKeyInputValue(response.key);
      }
    } catch (error) {
      console.error('Failed to read provider key:', error);
    }
  }, [hasElectronBridge]);

  const handleSaveKey = useCallback(async (providerId) => {
    if (!hasElectronBridge || !providerId) return;
    setSavingKey(true);
    try {
      await window.electronAPI.lyrics.saveProviderKey(providerId, keyInputValue.trim());
      showToast({
        title: 'Key saved',
        message: 'Provider credentials updated successfully.',
        variant: 'success',
      });
      resetKeyEditor();
      await loadProviderDefinitions();
    } catch (error) {
      const classified = classifyError(error);
      showToast({
        title: classified.title,
        message: classified.message,
        variant: 'error',
      });
    } finally {
      setSavingKey(false);
    }
  }, [hasElectronBridge, keyInputValue, loadProviderDefinitions, resetKeyEditor, showToast]);

  const handleDeleteKey = useCallback(async (providerId) => {
    if (!hasElectronBridge || !providerId) return;
    setSavingKey(true);
    try {
      await window.electronAPI.lyrics.deleteProviderKey(providerId);
      showToast({
        title: 'Key removed',
        message: 'Provider key deleted.',
        variant: 'success',
      });
      resetKeyEditor();
      await loadProviderDefinitions();
    } catch (error) {
      const classified = classifyError(error);
      showToast({
        title: classified.title,
        message: classified.message,
        variant: 'error',
      });
    } finally {
      setSavingKey(false);
    }
  }, [hasElectronBridge, loadProviderDefinitions, resetKeyEditor, showToast]);

  return {
    handleDeleteKey,
    handleSaveKey,
    keyEditor,
    keyInputValue,
    openKeyEditor,
    providerDefinitions,
    resetKeyEditor,
    savingKey,
    setKeyInputValue,
  };
};

export default useLyricsProviderKeys;
