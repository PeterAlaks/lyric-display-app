import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installerScript = fs.readFileSync(path.join(projectRoot, 'build', 'installer.nsh'), 'utf8');
const credentialScript = fs.readFileSync(
  path.join(projectRoot, 'build', 'remove-lyricdisplay-credentials.ps1'),
  'utf8'
);

test('Windows user-data deletion is opt-in and confined to the uninstaller', () => {
  const customInstallMacro = installerScript.match(/!macro customInstall[\s\S]*?!macroend/)?.[0];

  assert.match(installerScript, /!ifdef BUILD_UNINSTALLER[\s\S]*Function un\.UserDataPage/);
  assert.match(installerScript, /StrCpy \$DeleteUserDataSelection \$\{BST_UNCHECKED\}/);
  assert.match(
    installerScript,
    /\$\{If\} \$DeleteUserDataSelection == \$\{BST_CHECKED\}[\s\S]*RMDir \/r "\$APPDATA\\LyricDisplay"/
  );
  assert.ok(customInstallMacro);
  assert.doesNotMatch(customInstallMacro, /DeleteUserDataSelection/);
});

test('Windows cleanup covers current, legacy, and local application data', () => {
  assert.match(
    installerScript,
    /\$installMode == "all"[\s\S]*SetShellVarContext current[\s\S]*RMDir \/r "\$APPDATA\\LyricDisplay"[\s\S]*SetShellVarContext all/
  );

  for (const expectedPath of [
    '$APPDATA\\LyricDisplay',
    '$APPDATA\\lyric-display-app',
    '$APPDATA\\lyricdisplay-ndi',
    '$LOCALAPPDATA\\LyricDisplay',
    '$DOCUMENTS\\LyricDisplay',
  ]) {
    assert.ok(installerScript.includes(`RMDir /r "${expectedPath}"`), expectedPath);
  }
});

test('Windows cleanup explicitly warns before removing app-created documents', () => {
  assert.match(
    installerScript,
    /This also removes lyrics, imported songs and setlists\. Files saved elsewhere are not removed\./
  );
  assert.match(
    installerScript,
    /\$\{If\} \$DeleteUserDataSelection == \$\{BST_CHECKED\}[\s\S]*RMDir \/r "\$DOCUMENTS\\LyricDisplay"/
  );
});

test('the NSIS uninstaller embeds credential cleanup for every LyricDisplay service', () => {
  assert.match(
    installerScript,
    /File \/oname=\$PLUGINSDIR\\remove-lyricdisplay-credentials\.ps1/
  );
  assert.match(
    installerScript,
    /powershell\.exe[\s\S]*-File "\$PLUGINSDIR\\remove-lyricdisplay-credentials\.ps1"/
  );

  for (const servicePrefix of [
    'LyricDisplay/',
    'LyricDisplayAuthTokens/',
    'LyricDisplayProviderKeys/',
  ]) {
    assert.ok(credentialScript.includes(`'${servicePrefix}'`), servicePrefix);
  }
});
