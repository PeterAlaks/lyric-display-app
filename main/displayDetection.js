/**
 * Show display detection modal for one or more displays
 * @param {Object|Array} displayOrDisplays - Single display object or array of display objects
 * @param {boolean} isStartupCheck - Whether this is a startup check
 * @param {Function} requestRendererModal - Modal request function
 * @param {boolean} isManualOpen - Whether this is manually opened from menu
 */
export async function showDisplayDetectionModal(displayOrDisplays, isStartupCheck, requestRendererModal, isManualOpen = false) {

  const displaysArray = Array.isArray(displayOrDisplays) ? displayOrDisplays : [displayOrDisplays];

  if (!displaysArray || displaysArray.length === 0) {
    console.warn('[DisplayDetection] No displays provided to showDisplayDetectionModal');
    return;
  }

  try {
    const { BrowserWindow } = await import('electron');
    const { getDisplayAssignment } = await import('./displayManager.js');

    const windows = BrowserWindow.getAllWindows();

    const displaysInfo = displaysArray.map((display, index) => {
      const assignment = getDisplayAssignment(display.id);
      let isProjecting = false;
      let currentOutput = null;

      if (assignment) {
        const outputRoute = assignment.outputKey === 'stage' ? '/stage' :
          assignment.outputKey === 'output1' ? '/output1' : '/output2';

        for (const win of windows) {
          if (!win || win.isDestroyed()) continue;
          try {
            const url = win.webContents.getURL();
            if (url.includes(outputRoute)) {
              isProjecting = true;
              currentOutput = assignment.outputKey;
              break;
            }
          } catch (err) {
          }
        }
      }

      let displayName = display.name || display.label || 'External Display';
      if (displaysArray.length > 1) {
        displayName = `Display ${index + 1}`;
      }

      return {
        id: display.id,
        name: displayName,
        bounds: display.bounds,
        isProjecting,
        currentOutput
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
        component: 'DisplayDetection',
        variant: 'info',
        size: 'lg',
        dismissible: true,
        actions: [],
        displays: displaysInfo,
        displayInfo: displaysInfo[0],
        isManualOpen: isManualOpen
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

    await showDisplayDetectionModal(display, false, requestRendererModal);
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