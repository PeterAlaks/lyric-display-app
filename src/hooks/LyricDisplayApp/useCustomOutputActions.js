import { useCallback } from 'react';
import useLyricsStore from '../../context/LyricsStore';

export const useCustomOutputActions = ({
  activeTab,
  emitIndividualOutputToggle,
  emitOutputRemove,
  emitOutputsRegister,
  emitStyleUpdate,
  setActiveTab,
  showModal,
  showToast,
}) => {
  const handleAddOutput = useCallback(() => {
    const newId = useLyricsStore.getState().addCustomOutput();
    if (newId) {
      setActiveTab(newId);
      const customOutputs = useLyricsStore.getState().customOutputIds || [];
      emitOutputsRegister({ outputs: customOutputs });

      const newSettings = useLyricsStore.getState()[`${newId}Settings`];
      if (newSettings) {
        emitStyleUpdate(newId, newSettings);
      }
      emitIndividualOutputToggle({ output: newId, enabled: true });
      showToast({ title: 'Output Created', message: `${newId.replace('output', 'Output ')} has been created`, variant: 'success' });
    } else {
      showToast({ title: 'Limit Reached', message: 'Maximum of 6 outputs reached', variant: 'warning' });
    }
  }, [emitIndividualOutputToggle, emitOutputsRegister, emitStyleUpdate, setActiveTab, showToast]);

  const handleDeleteOutput = useCallback((outputId) => {
    const outputLabel = outputId.replace('output', 'Output ');
    showModal({
      title: `Delete ${outputLabel}`,
      description: `Are you sure you want to delete ${outputLabel}? This will remove all its settings permanently.`,
      variant: 'info',
      size: 'sm',
      actions: [
        {
          label: 'Cancel',
          value: 'cancel',
          variant: 'outline',
        },
        {
          label: 'Delete',
          value: 'delete',
          destructive: true,
          onSelect: () => {
            const removed = useLyricsStore.getState().removeCustomOutput(outputId);
            if (removed) {
              if (activeTab === outputId) setActiveTab('output1');
              emitOutputRemove({ output: outputId });
              const customOutputs = useLyricsStore.getState().customOutputIds || [];
              emitOutputsRegister({ outputs: customOutputs });
              showToast({ title: 'Output Deleted', message: `${outputLabel} has been deleted`, variant: 'success' });
            }
          }
        }
      ]
    });
  }, [activeTab, emitOutputRemove, emitOutputsRegister, setActiveTab, showModal, showToast]);

  return { handleAddOutput, handleDeleteOutput };
};
