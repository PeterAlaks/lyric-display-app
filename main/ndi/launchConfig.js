export const COMPANION_USER_DATA_ENV = 'LYRICDISPLAY_NDI_USER_DATA_DIR';

export function resolveAuthoritativeCompanionLocation({
  isDevelopment,
  developmentInstallPath,
  developmentEntryPath,
  managedInstallPath,
  legacyInstallPaths = [],
  resolveEntryPath,
  entryExists,
}) {
  if (isDevelopment) {
    return {
      installPath: developmentInstallPath,
      companionPath: developmentEntryPath,
      source: 'development',
    };
  }

  const installCandidates = [managedInstallPath, ...legacyInstallPaths];
  const existingInstallPath = installCandidates.find((installPath) => (
    entryExists(resolveEntryPath(installPath))
  ));
  const installPath = existingInstallPath || managedInstallPath;

  return {
    installPath,
    companionPath: resolveEntryPath(installPath),
    source: existingInstallPath && existingInstallPath !== managedInstallPath ? 'legacy' : 'managed',
  };
}

export function createCompanionLaunchConfig({
  userDataPath,
  appPath = '',
  host,
  port,
  authToken,
  appUrl,
  hashRouting = false,
}) {
  const normalizedUserDataPath = String(userDataPath || '').trim();
  if (!normalizedUserDataPath) {
    throw new Error('NDI companion user-data path is required');
  }

  const args = [
    `--user-data-dir=${normalizedUserDataPath}`,
    ...(appPath ? [appPath] : []),
    '--host', String(host),
    '--port', String(port),
    '--auth-token', String(authToken || ''),
    '--app-url', String(appUrl),
  ];

  if (!hashRouting) {
    args.push('--no-hash');
  }

  return {
    args,
    env: {
      [COMPANION_USER_DATA_ENV]: normalizedUserDataPath,
    },
  };
}
