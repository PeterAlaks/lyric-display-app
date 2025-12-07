import { useCallback } from 'react';

const useOutputToggle = ({ outputKey, isOutputEnabled, setOutputEnabled, emitIndividualOutputToggle, showToast }) => {
  const handleToggleOutput = useCallback(() => {
    const outputName = outputKey === 'output1' ? 'Output 1'
      : outputKey === 'output2' ? 'Output 2'
        : 'Stage Display';

    const newState = !isOutputEnabled;
    setOutputEnabled(newState);
    emitIndividualOutputToggle({ output: outputKey, enabled: newState });

    if (newState) {
      showToast({
        title: `${outputName} Enabled`,
        message: `${outputName} has been turned on.`,
        variant: 'success',
      });
      return;
    }

    showToast({
      title: `${outputName} Turned Off`,
      message: `${outputName} has been disabled. The global toggle still controls overall state.`,
      variant: 'success',
      duration: 6000,
      actions: [
        {
          label: 'Undo',
          onClick: () => {
            setOutputEnabled(true);
            emitIndividualOutputToggle({ output: outputKey, enabled: true });
            showToast({
              title: `${outputName} Restored`,
              message: `${outputName} has been re-enabled.`,
              variant: 'success',
            });
          }
        }
      ]
    });
  }, [emitIndividualOutputToggle, isOutputEnabled, outputKey, setOutputEnabled, showToast]);

  return { handleToggleOutput };
};

export default useOutputToggle;