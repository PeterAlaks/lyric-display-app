export const MAX_OLDER_RELEASES = 3;

export const normalizeVersionText = (value = '') => String(value).trim().replace(/^v/i, '');

export const compareVersions = (a, b) => {
  const left = normalizeVersionText(a).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersionText(b).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const maxParts = Math.max(left.length, right.length, 3);

  for (let index = 0; index < maxParts; index += 1) {
    const leftPart = left[index] || 0;
    const rightPart = right[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
};

export const selectOlderReleases = (
  releases,
  availableVersion,
  limit = MAX_OLDER_RELEASES,
) => {
  const normalizedAvailableVersion = normalizeVersionText(availableVersion);
  if (!Array.isArray(releases) || !normalizedAvailableVersion) return [];

  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : MAX_OLDER_RELEASES;
  const boundedLimit = Math.min(MAX_OLDER_RELEASES, Math.max(0, requestedLimit));
  const seenVersions = new Set();

  return releases
    .filter((release) => !release?.draft && !release?.prerelease)
    .map((release) => ({
      version: normalizeVersionText(release?.tag_name),
      releaseName: typeof release?.name === 'string' ? release.name : '',
      releaseNotes: typeof release?.body === 'string' ? release.body.trim() : '',
      releaseDate: typeof release?.published_at === 'string'
        ? release.published_at
        : (typeof release?.created_at === 'string' ? release.created_at : ''),
    }))
    .filter((release) => (
      release.version
      && release.releaseNotes
      && compareVersions(release.version, normalizedAvailableVersion) < 0
    ))
    .sort((left, right) => compareVersions(right.version, left.version))
    .filter((release) => {
      if (seenVersions.has(release.version)) return false;
      seenVersions.add(release.version);
      return true;
    })
    .slice(0, boundedLimit);
};
