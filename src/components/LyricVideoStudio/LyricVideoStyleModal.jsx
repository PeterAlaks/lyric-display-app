import React from 'react';
import { Palette } from 'lucide-react';
import useModal from '../../hooks/useModal';
import OutputSettingsPanel from '../OutputSettingsPanel';

function LyricVideoStyleEditor({ initialSettings, onSettingsChange }) {
  const [draftSettings, setDraftSettings] = React.useState(() => ({
    ...(initialSettings || {}),
    fullScreenMode: true,
    alwaysShowBackground: true,
  }));

  const handleSettingsChange = React.useCallback((partial) => {
    const styleOnlyPartial = Object.fromEntries(
      Object.entries(partial || {}).filter(([key]) => (
        !key.startsWith('fullScreen') && key !== 'alwaysShowBackground'
      ))
    );
    if (Object.keys(styleOnlyPartial).length === 0) return;
    setDraftSettings((current) => ({
      ...current,
      ...styleOnlyPartial,
      fullScreenMode: true,
      alwaysShowBackground: true,
    }));
    onSettingsChange?.(styleOnlyPartial);
  }, [onSettingsChange]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <OutputSettingsPanel
        outputKey="lyricVideo"
        settings={draftSettings}
        onSettingsChange={handleSettingsChange}
        localMode
        hideFullScreenSettings
        hideBackgroundSettings
        title="LYRIC VIDEO STYLE"
      />
    </div>
  );
}

export default function LyricVideoStyleModal({
  open,
  settings,
  onSettingsChange,
  onClose,
}) {
  const { showModal } = useModal();
  const openRef = React.useRef(false);
  const latestRef = React.useRef({ settings, onSettingsChange, onClose });

  React.useEffect(() => {
    latestRef.current = { settings, onSettingsChange, onClose };
  }, [settings, onSettingsChange, onClose]);

  React.useEffect(() => {
    if (!open || openRef.current) return;

    openRef.current = true;
    showModal({
      title: 'Lyric Video Style',
      variant: 'info',
      icon: <Palette className="h-6 w-6" aria-hidden />,
      size: 'md',
      scrollBehavior: 'scroll',
      allowBackdropClose: false,
      modalKey: 'lyricVideo-style-editor',
      body: (
        <LyricVideoStyleEditor
          initialSettings={latestRef.current.settings}
          onSettingsChange={(partial) => latestRef.current.onSettingsChange?.(partial)}
        />
      ),
      actions: [
        {
          label: 'Done',
          value: 'done',
          variant: 'default',
        },
      ],
    }).finally(() => {
      openRef.current = false;
      latestRef.current.onClose?.();
    });
  }, [open, showModal]);

  return null;
}
