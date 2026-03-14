export const formatOutputLabel = (outputKey, { uppercase = false } = {}) => {
  if (!outputKey) return '';

  if (outputKey === 'stage') {
    return uppercase ? 'STAGE' : 'Stage';
  }

  const match = /^output(\d+)$/i.exec(String(outputKey));
  if (match) {
    const num = match[1];
    return uppercase ? `OUTPUT ${num}` : `Output ${num}`;
  }

  const fallback = String(outputKey);
  return uppercase ? fallback.toUpperCase() : fallback;
};