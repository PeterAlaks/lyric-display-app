export function getEmphasisToggleStateClassName(active, darkMode) {
  if (active) {
    return darkMode
      ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
      : '!bg-black !text-white hover:!bg-black !border-gray-300';
  }

  return darkMode
    ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
    : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100';
}
