import knownArtistsData from '../../shared/data/knownArtists.json';

/**
 * Detects artist name from filename using known artists list
 * @param {string} fileName - The filename to analyze
 * @returns {{artist: string|null, title: string}} - Detected artist and title
 */
export const detectArtistFromFilename = (fileName) => {
  if (!fileName) {
    return { artist: null, title: '' };
  }

  const nameWithoutExt = fileName.replace(/\.(txt|lrc)$/i, '');
  const normalized = nameWithoutExt.toLowerCase();

  for (const artist of knownArtistsData) {
    const artistLower = artist.toLowerCase();
    if (normalized.includes(artistLower)) {

      const byPattern = new RegExp(`(.+?)\\s+by\\s+${artistLower}`, 'i');
      const byMatch = nameWithoutExt.match(byPattern);
      if (byMatch) {
        return {
          artist,
          title: byMatch[1].trim()
        };
      }

      const dashPattern = new RegExp(`(.+?)\\s*-\\s*${artistLower}`, 'i');
      const dashMatch = nameWithoutExt.match(dashPattern);
      if (dashMatch) {
        return {
          artist,
          title: dashMatch[1].trim()
        };
      }

      const reverseDashPattern = new RegExp(`${artistLower}\\s*-\\s*(.+)`, 'i');
      const reverseDashMatch = nameWithoutExt.match(reverseDashPattern);
      if (reverseDashMatch) {
        return {
          artist,
          title: reverseDashMatch[1].trim()
        };
      }

      if (normalized.startsWith(artistLower)) {
        const titlePart = nameWithoutExt
          .substring(artist.length)
          .replace(/^[-_\s]+/, '')
          .trim();

        if (titlePart) {
          return {
            artist,
            title: titlePart
          };
        }
      }

      if (normalized.endsWith(artistLower)) {
        const titlePart = nameWithoutExt
          .substring(0, nameWithoutExt.length - artist.length)
          .replace(/[-_\s]+$/, '')
          .trim();

        if (titlePart) {
          return {
            artist,
            title: titlePart
          };
        }
      }

      const titlePart = nameWithoutExt
        .replace(new RegExp(artist, 'gi'), '')
        .replace(/^[-_\s]+|[-_\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        artist,
        title: titlePart || nameWithoutExt
      };
    }
  }

  return {
    artist: null,
    title: nameWithoutExt
  };
};