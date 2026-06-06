export const createStageSlice = (set, defaultStageSettings) => ({
  stageEnabled: true,
  stageSettings: defaultStageSettings,

  setStageEnabled: (enabled) => set({ stageEnabled: enabled }),
});
