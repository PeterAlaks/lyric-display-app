export const EASYWORSHIP_VERSIONS = [
  {
    version: '7',
    label: 'EasyWorship 7',
    defaultPath: 'C:\\Users\\Public\\Documents\\Softouch\\Easyworship\\Default\\v6.1\\Databases\\Data',
    fallbackHint: 'Verify checks the selected folder first, then nearby ...\\Databases\\Data and ...\\v6.1\\Databases\\Data paths.'
  },
  {
    version: '6',
    label: 'EasyWorship 6',
    defaultPath: 'C:\\Users\\Public\\Documents\\Softouch\\Easyworship\\Default\\v6.1\\Databases\\Data',
    fallbackHint: 'Verify checks the selected folder first, then nearby ...\\Databases\\Data and ...\\v6.1\\Databases\\Data paths.'
  },
  {
    version: '2009',
    label: 'EasyWorship 2009',
    defaultPath: 'C:\\Users\\Public\\Documents\\Softouch\\EasyWorship\\Default\\Databases\\Data',
    fallbackHint: 'Verify checks the selected folder first, then nearby ...\\Default\\Databases\\Data and ...\\Default_<number>\\Databases\\Data paths.'
  }
];

export const STEPS = {
  INTRO: 0,
  SELECT_SONGS: 1,
  DESTINATION: 2,
  PROGRESS: 3,
  COMPLETE: 4
};
