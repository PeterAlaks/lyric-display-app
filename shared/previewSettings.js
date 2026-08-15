export const PREVIEW_CORE_ITEM_IDS = ['output1', 'output2', 'stage', 'time'];

export const DEFAULT_PREVIEW_SETTINGS = Object.freeze({
  order: [...PREVIEW_CORE_ITEM_IDS],
  gridStyle: 'featured',
  gap: 'comfortable',
  previewResolution: '720p',
  showHeader: true,
  showLabels: true,
  showRoutePaths: false,
});

const GRID_STYLE_OPTIONS = new Set(['featured', 'responsive']);
const GAP_OPTIONS = new Set(['compact', 'comfortable']);
const PREVIEW_RESOLUTION_OPTIONS = new Set(['720p', '1080p']);

export const isPreviewItemId = (value) => (
  value === 'stage'
  || value === 'time'
  || (typeof value === 'string' && /^output\d+$/.test(value))
);

export function normalizePreviewSettings(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const order = Array.from(new Set(
    (Array.isArray(source.order) ? source.order : DEFAULT_PREVIEW_SETTINGS.order)
      .filter(isPreviewItemId)
  ));

  return {
    order,
    gridStyle: GRID_STYLE_OPTIONS.has(source.gridStyle)
      ? source.gridStyle
      : DEFAULT_PREVIEW_SETTINGS.gridStyle,
    gap: GAP_OPTIONS.has(source.gap) ? source.gap : DEFAULT_PREVIEW_SETTINGS.gap,
    previewResolution: PREVIEW_RESOLUTION_OPTIONS.has(source.previewResolution)
      ? source.previewResolution
      : DEFAULT_PREVIEW_SETTINGS.previewResolution,
    showHeader: typeof source.showHeader === 'boolean'
      ? source.showHeader
      : DEFAULT_PREVIEW_SETTINGS.showHeader,
    showLabels: typeof source.showLabels === 'boolean'
      ? source.showLabels
      : DEFAULT_PREVIEW_SETTINGS.showLabels,
    showRoutePaths: typeof source.showRoutePaths === 'boolean'
      ? source.showRoutePaths
      : DEFAULT_PREVIEW_SETTINGS.showRoutePaths,
  };
}

export function getAvailablePreviewItemIds(customOutputIds = []) {
  const customIds = Array.from(new Set(
    (Array.isArray(customOutputIds) ? customOutputIds : [])
      .filter(isPreviewItemId)
      .filter((id) => !PREVIEW_CORE_ITEM_IDS.includes(id))
  ));

  return [...PREVIEW_CORE_ITEM_IDS, ...customIds];
}

export function resolvePreviewItemOrder(order, availableItemIds) {
  const available = Array.from(new Set(
    (Array.isArray(availableItemIds) ? availableItemIds : PREVIEW_CORE_ITEM_IDS)
      .filter(isPreviewItemId)
  ));
  const availableSet = new Set(available);
  const preferred = Array.from(new Set(
    (Array.isArray(order) ? order : [])
      .filter((id) => availableSet.has(id))
  ));

  return [...preferred, ...available.filter((id) => !preferred.includes(id))];
}
