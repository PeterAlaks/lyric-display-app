/**
 * Template Applicator
 * Handles applying template settings to output configurations
 */

/**
 * Apply a template to output settings
 * @param {Object} template - The template to apply
 * @param {Object} currentSettings - Current settings object
 * @param {Function} applySettings - Function to apply settings
 * @returns {Object} - The new settings after applying template
 */
export const applyTemplate = (template, currentSettings, applySettings) => {
  if (!template || !template.settings) {
    console.error('Invalid template provided');
    return currentSettings;
  }

  // Merge template settings with current settings
  // Template settings will override current settings
  const newSettings = {
    ...currentSettings,
    ...template.settings,
  };

  // Apply the settings using the provided function
  if (typeof applySettings === 'function') {
    applySettings(template.settings);
  }

  return newSettings;
};

/**
 * Validate template compatibility with output type
 * @param {Object} template - The template to validate
 * @param {string} outputType - The output type ('output1', 'output2', or 'stage')
 * @returns {boolean} - Whether the template is compatible
 */
export const validateTemplate = (template, outputType) => {
  if (!template || !template.settings) {
    return false;
  }

  // Check if template has required fields based on output type
  if (outputType === 'stage') {
    // Stage templates should have stage-specific settings
    return (
      template.settings.hasOwnProperty('liveFontSize') &&
      template.settings.hasOwnProperty('nextFontSize') &&
      template.settings.hasOwnProperty('prevFontSize')
    );
  } else {
    // Output templates should have output-specific settings
    return (
      template.settings.hasOwnProperty('fontSize') &&
      template.settings.hasOwnProperty('fontColor') &&
      template.settings.hasOwnProperty('lyricsPosition')
    );
  }
};

/**
 * Get template preview data for display
 * @param {Object} template - The template to preview
 * @returns {Object} - Preview data with key settings highlighted
 */
export const getTemplatePreview = (template) => {
  if (!template || !template.settings) {
    return null;
  }

  const settings = template.settings;
  const preview = {
    id: template.id,
    title: template.title,
    description: template.description,
  };

  // Add key settings for preview based on template type
  if (settings.liveFontSize) {
    // Stage template
    preview.keySettings = [
      `Live: ${settings.liveFontSize}px`,
      `Next: ${settings.nextFontSize}px`,
      `Font: ${settings.fontStyle}`,
    ];
  } else {
    // Output template
    preview.keySettings = [
      `Size: ${settings.fontSize}px`,
      `Position: ${settings.lyricsPosition}`,
      `Font: ${settings.fontStyle}`,
    ];
  }

  return preview;
};
