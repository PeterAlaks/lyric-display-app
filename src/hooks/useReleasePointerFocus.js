import { useEffect } from 'react';

const TRANSIENT_POINTER_CONTROL_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(',');

const findTransientPointerControl = (target) => {
  const element = target?.nodeType === 1 ? target : target?.parentElement;
  const control = element?.closest?.(TRANSIENT_POINTER_CONTROL_SELECTOR);
  if (!control) return null;
  if (control.closest?.('[data-modal-root="true"], [data-keep-pointer-focus="true"]')) return null;
  return control;
};

/**
 * Pointer activation should perform the click without leaving a button armed for
 * a later Space/Enter press. Keyboard focus is untouched, so tabbed-to controls
 * retain their normal accessible activation behavior.
 */
export default function useReleasePointerFocus() {
  useEffect(() => {
    let pressedControl = null;
    let releaseTimer = null;

    const releaseFocus = () => {
      const control = pressedControl;
      pressedControl = null;
      if (!control) return;

      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        releaseTimer = null;
        if (control.isConnected && document.activeElement === control) {
          control.blur();
        }
      }, 0);
    };

    const handlePointerDown = (event) => {
      if (!event.isPrimary || event.button !== 0) {
        pressedControl = null;
        return;
      }
      pressedControl = findTransientPointerControl(event.target);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', releaseFocus, true);
    window.addEventListener('pointercancel', releaseFocus, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', releaseFocus, true);
      window.removeEventListener('pointercancel', releaseFocus, true);
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
    };
  }, []);
}
