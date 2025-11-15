/**
 * Show display detection modal for a newly connected display
 * @param {Object} display - Display object from Electron
 * @param {boolean} isStartupCheck - Whether this is a startup check
 * @param {Function} requestRendererModal - Modal request function
 */
export async function showDisplayDetectionModal(display, isStartupCheck, requestRendererModal) {
  if (!display || !display.id) return;

  try {
    const { getDisplayAssignment } = await import('./displayManager.js');
    const assignment = getDisplayAssignment(display.id);

    if (assignment) {
      console.log(`[DisplayDetection] Skipping modal for display ${display.id}, it already has assignment: ${assignment.outputKey}`);
      return;
    }

    const title = isStartupCheck ? 'External Display Detected' : 'New Display Detected';
    const headerDesc = isStartupCheck
      ? 'An external display is connected. Configure how to use it.'
      : 'Configure how to use the newly connected display';

    const displayInfo = {
      id: display.id,
      name: display.name || display.label || `Display ${display.id}`,
      bounds: display.bounds
    };

    console.log(`[DisplayDetection] Showing display detection modal for ${display.id} (${displayInfo.name})`);

    await requestRendererModal(
      {
        title: title,
        headerDescription: headerDesc,
        component: 'DisplayDetection',
        variant: 'info',
        size: 'lg',
        dismissible: true,
        actions: [],
        displayInfo: displayInfo
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
      await showDisplayDetectionModal(externalDisplays[0], true, requestRendererModal);
    } else {
      console.log('[DisplayDetection] Startup check: No external displays found.');
    }
  } catch (error) {
    console.error('[DisplayDetection] Error during startup display check:', error);
  }
}