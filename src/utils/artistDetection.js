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

    const escapedArtist = artistLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const wordBoundaryPattern = new RegExp(`(^|[\\s\\-_])${escapedArtist}([\\s\\-_]|$)`, 'i');

    if (!wordBoundaryPattern.test(normalized)) {
      continue;
    }

    const byPattern = new RegExp(`^(.+?)\\s+by\\s+${escapedArtist}\\s*$`, 'i');
    const byMatch = nameWithoutExt.match(byPattern);
    if (byMatch) {
      return {
        artist,
        title: byMatch[1].trim()
      };
    }

    const byMiddlePattern = new RegExp(`^(.+?)\\s+by\\s+${escapedArtist}\\s+(.+)$`, 'i');
    const byMiddleMatch = nameWithoutExt.match(byMiddlePattern);
    if (byMiddleMatch) {
      return {
        artist,
        title: byMiddleMatch[1].trim()
      };
    }

    const dashPattern = new RegExp(`(.+?)\\s*-\\s*${escapedArtist}\\s*$`, 'i');
    const dashMatch = nameWithoutExt.match(dashPattern);
    if (dashMatch) {
      return {
        artist,
        title: dashMatch[1].trim()
      };
    }

    const reverseDashPattern = new RegExp(`^\\s*${escapedArtist}\\s*-\\s*(.+)`, 'i');
    const reverseDashMatch = nameWithoutExt.match(reverseDashPattern);
    if (reverseDashMatch) {
      return {
        artist,
        title: reverseDashMatch[1].trim()
      };
    }

    if (normalized.startsWith(artistLower + ' ') ||
      normalized.startsWith(artistLower + '-') ||
      normalized.startsWith(artistLower + '_')) {
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

    if (normalized.endsWith(' ' + artistLower) ||
      normalized.endsWith('-' + artistLower) ||
      normalized.endsWith('_' + artistLower)) {
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

    const middlePattern = new RegExp(`^(.+?)\\s+${escapedArtist}\\s+(.+)$`, 'i');
    const middleMatch = nameWithoutExt.match(middlePattern);
    if (middleMatch) {
      const beforeArtist = middleMatch[1].trim();
      const afterArtist = middleMatch[2].trim();

      return {
        artist,
        title: beforeArtist
      };
    }
  }

  return {
    artist: null,
    title: nameWithoutExt
  };
};