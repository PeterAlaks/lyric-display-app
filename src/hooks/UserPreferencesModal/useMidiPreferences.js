import { useCallback, useState } from 'react';

export const useMidiPreferences = ({ midiStatus, setMidiStatus, showToast, updateNestedPreference }) => {
  const [midiLearnActive, setMidiLearnActive] = useState(false);
  const [midiRefreshing, setMidiRefreshing] = useState(false);
  const [lastLearnedMidi, setLastLearnedMidi] = useState(null);
  const [midiMappingsExpanded, setMidiMappingsExpanded] = useState(false);
  const [midiAssigningAction, setMidiAssigningAction] = useState(null);

  const handleMidiRefreshPorts = useCallback(async () => {
    setMidiRefreshing(true);
    try {
      const result = await window.electronAPI?.midi?.refreshPorts();
      if (result.success) {
        setMidiStatus(prev => ({ ...prev, availablePorts: result.ports }));
      }
    } catch (error) {
      console.error('Failed to refresh MIDI ports:', error);
    } finally {
      setTimeout(() => setMidiRefreshing(false), 500);
    }
  }, [setMidiStatus]);

  const handleMidiSelectPort = useCallback(async (portIndex) => {
    try {
      const result = await window.electronAPI?.midi?.selectPort(parseInt(portIndex));
      if (result.success) {
        setMidiStatus(prev => ({
          ...prev,
          selectedPortIndex: parseInt(portIndex),
          selectedPort: result.port
        }));
      }
    } catch (error) {
      console.error('Failed to select MIDI port:', error);
    }
  }, [setMidiStatus]);

  const handleMidiToggle = useCallback(async () => {
    try {
      if (midiStatus?.enabled) {
        await window.electronAPI?.midi?.disable();
        setMidiStatus(prev => ({ ...prev, enabled: false }));
        updateNestedPreference('externalControl', 'midi', 'enabled', false);
      } else {
        await window.electronAPI?.midi?.enable();
        setMidiStatus(prev => ({ ...prev, enabled: true }));
        updateNestedPreference('externalControl', 'midi', 'enabled', true);
      }
    } catch (error) {
      console.error('Failed to toggle MIDI:', error);
    }
  }, [midiStatus?.enabled, setMidiStatus, updateNestedPreference]);

  const refreshMidiStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI?.midi?.getStatus();
      if (result?.success) {
        setMidiStatus(result.status);
      }
    } catch (error) {
      // ignore
    }
  }, [setMidiStatus]);

  const handleMidiLearn = useCallback(async () => {
    setMidiLearnActive(true);
    try {
      const result = await window.electronAPI?.midi?.startLearn(10000);
      if (result.success) {
        setLastLearnedMidi(result.learned);
        console.log('Learned MIDI input:', result.learned);
      }
    } catch (error) {
      console.log('MIDI learn cancelled or timed out');
    } finally {
      setMidiLearnActive(false);
    }
  }, []);

  const handleMidiAssignAction = useCallback(async (action) => {
    setMidiLearnActive(true);
    setMidiAssigningAction(action);

    try {
      const learnResult = await window.electronAPI?.midi?.startLearn(10000);
      if (!learnResult?.success || !learnResult.learned) {
        showToast({
          title: 'MIDI Learn Failed',
          message: learnResult?.error || 'No MIDI input was learned.',
          variant: 'warning'
        });
        return;
      }

      const learned = learnResult.learned;
      setLastLearnedMidi(learned);

      const type = learned.type === 'note' ? 'notes' : 'controlChanges';
      const key = learned.type === 'note' ? learned.note : learned.controller;

      const mapping = {
        action: action.key,
        description: action.label
      };

      const setResult = await window.electronAPI?.midi?.setMapping(type, key, mapping);
      if (setResult?.success) {
        await refreshMidiStatus();
        showToast({
          title: 'MIDI Mapping Saved',
          message: `${action.label} assigned to ${learned.type === 'note' ? `Note ${learned.note}` : `CC ${learned.controller}`}`,
          variant: 'success'
        });
      } else {
        showToast({
          title: 'Save Failed',
          message: setResult?.error || 'Could not save the MIDI mapping.',
          variant: 'error'
        });
      }
    } catch (error) {
      showToast({
        title: 'MIDI Learn Cancelled',
        message: error?.message || 'Learn mode timed out or was cancelled.',
        variant: 'info'
      });
    } finally {
      setMidiAssigningAction(null);
      setMidiLearnActive(false);
    }
  }, [refreshMidiStatus, showToast]);

  const handleMidiResetMappings = useCallback(async () => {
    try {
      const result = await window.electronAPI?.midi?.resetMappings();
      if (result?.success) {
        await refreshMidiStatus();
        showToast({
          title: 'MIDI Mappings Reset',
          message: 'Mappings have been restored to defaults.',
          variant: 'success'
        });
      } else {
        showToast({
          title: 'Reset Failed',
          message: result?.error || 'Could not reset MIDI mappings.',
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to reset MIDI mappings:', error);
      showToast({
        title: 'Reset Failed',
        message: error?.message || 'Could not reset MIDI mappings.',
        variant: 'error'
      });
    }
  }, [refreshMidiStatus, showToast]);

  return {
    handleMidiAssignAction,
    handleMidiLearn,
    handleMidiRefreshPorts,
    handleMidiResetMappings,
    handleMidiSelectPort,
    handleMidiToggle,
    lastLearnedMidi,
    midiAssigningAction,
    midiLearnActive,
    midiMappingsExpanded,
    midiRefreshing,
    setMidiMappingsExpanded,
  };
};
