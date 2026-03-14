import { useEffect } from 'react';
import useLyricsStore from '../../context/LyricsStore';
import { useDarkModeState } from '../../hooks/useStoreSelectors';
import useModal from '@/hooks/useModal';

export default function WelcomeSplashBridge() {
  const hasSeenWelcome = useLyricsStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useLyricsStore((state) => state.setHasSeenWelcome);
  const { showModal } = useModal();
  const { darkMode } = useDarkModeState();

  useEffect(() => {
    if (hasSeenWelcome || !window.electronAPI) return;

    const timer = setTimeout(() => {
      showModal({
        title: 'Welcome to LyricDisplay',
        component: 'WelcomeSplash',
        variant: 'info',
        size: 'lg',
        dismissible: true,
        actions: [
          {
            label: 'View Integration Guide',
            variant: 'default',
            onSelect: () => {
              showModal({
                title: 'Streaming Software Integration',
                headerDescription: 'Connect LyricDisplay to OBS, vMix, Wirecast and more',
                component: 'IntegrationInstructions',
                variant: 'info',
                size: 'lg',
                dismissLabel: 'Close'
              });
            }
          },
          {
            label: 'Get Started',
            variant: 'outline',
            onSelect: () => { }
          }
        ]
      });
      setHasSeenWelcome(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasSeenWelcome, setHasSeenWelcome, showModal, darkMode]);

  return null;
}
