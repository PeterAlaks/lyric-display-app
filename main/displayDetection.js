/**
 * Show display detection modal for one or more displays
 * @param {Object|Array} displayOrDisplays - Single display object or array of display objects
 * @param {boolean} isStartupCheck - Whether this is a startup check
 * @param {Function} requestRendererModal - Modal request function
 * @param {boolean} isManualOpen - Whether this is manually opened from menu
 */
export async function showDisplayDetectionModal(displayOrDisplays, isStartupCheck, requestRendererModal, isManualOpen = false) {

  const displaysArray = (Array.isArray(displayOrDisplays) ? displayOrDisplays : [displayOrDisplays]).filter(Boolean);

  if (!displaysArray || displaysArray.length === 0) {
    console.warn('[DisplayDetection] No displays provided to showDisplayDetectionModal');
    return;
  }

  try {
    const displaysInfo = displaysArray.map((display, index) => {
      const nativeName = display.name || display.label;
      const displayName = nativeName || (displaysArray.length > 1 ? `External Display ${index + 1}` : 'External Display');

      return {
        id: display.id,
        name: displayName,
        label: display.label || null,
        bounds: display.bounds,
      };
    });

    const displayCount = displaysInfo.length;
    const title = isStartupCheck
      ? (displayCount > 1 ? `${displayCount} External Displays Detected` : 'External Display Detected')
      : (displayCount > 1 ? `${displayCount} New Displays Detected` : 'New Display Detected');

    const headerDesc = isStartupCheck
      ? (displayCount > 1 ? 'Multiple external displays are connected. Configure how to use them.' : 'An external display is connected. Configure how to use it.')
      : (displayCount > 1 ? 'Configure how to use the newly connected displays' : 'Configure how to use the newly connected display');

    console.log(`[DisplayDetection] Showing display detection modal for ${displayCount} display(s):`, displaysInfo.map(d => `${d.id} (${d.name})`).join(', '));

    await requestRendererModal(
      {
        title: title,
        headerDescription: headerDesc,
        component: 'ProjectOutput',
        dedupeKey: 'component:ProjectOutput',
        variant: 'info',
        size: 'lg',
        className: 'max-w-4xl',
        dismissible: true,
        actions: [],
        customLayout: true,
        displays: displaysInfo,
        displayInfo: displaysInfo[0],
        preferredDisplayId: displaysInfo[0]?.id,
        detectedDisplays: displaysInfo,
        triggerSource: isManualOpen ? 'manual' : (isStartupCheck ? 'startup' : 'hotplug'),
      },
      {
        timeout: 60000,
        fallback: () => {
          console.log('[DisplayDetection] Display detection modal fallback');
          return { dismissed: true };
        }
      }
    );
  } catch (error) {
    console.error('[DisplayDetection] Error showing display detection modal:', error);
  }
}

/**
 * Handle display change events (added/removed)
 * @param {string} changeType - Type of change ('added' or 'removed')
 * @param {Object} display - Display object
 * @param {Function} requestRendererModal - Modal request function
 */
export async function handleDisplayChange(changeType, display, requestRendererModal) {
  if (changeType === 'added') {
    console.log('[DisplayDetection] New display detected via listener:', display.id);

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const { getAllDisplays } = await import('./displayManager.js');
      const allDisplays = getAllDisplays();
      const externalDisplays = allDisplays.filter(d => !d.primary);
      await showDisplayDetectionModal(externalDisplays.length > 0 ? externalDisplays : display, false, requestRendererModal);
    } catch (error) {
      console.warn('[DisplayDetection] Falling back to display event payload:', error);
      await showDisplayDetectionModal(display, false, requestRendererModal);
    }
  }
}

/**
 * Perform startup display check for external displays
 * @param {Function} requestRendererModal - Modal request function
 */
export async function performStartupDisplayCheck(requestRendererModal) {
  try {
    const { getAllDisplays } = await import('./displayManager.js');
    const allDisplays = getAllDisplays();
    const externalDisplays = allDisplays.filter(d => !d.primary);

    if (externalDisplays.length > 0) {
      console.log(`[DisplayDetection] Startup check: Found ${externalDisplays.length} external display(s).`);
      await showDisplayDetectionModal(externalDisplays, true, requestRendererModal);
    } else {
      console.log('[DisplayDetection] Startup check: No external displays found.');
    }
  } catch (error) {
    console.error('[DisplayDetection] Error during startup display check:', error);
  }
}
