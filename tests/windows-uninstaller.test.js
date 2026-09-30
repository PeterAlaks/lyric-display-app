import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

test('Windows upgrades retain electron-builder atomic replacement of the install directory', () => {
  assert.doesNotMatch(installerScript, /!macro\s+customRemoveFiles\b/);
});

test('Windows firewall consent defaults on, preserves navigation state, and skips unattended updates', () => {
  assert.match(installerScript, /Allow LyricDisplay through Windows Firewall \(recommended\)/);
  assert.match(installerScript, /!macro customInit\s+StrCpy \$FirewallSelection \$\{BST_CHECKED\}/);
  assert.match(installerScript, /\$\{NSD_SetState\} \$FirewallCheckbox \$FirewallSelection/);
  assert.match(installerScript, /\$\{NSD_GetState\} \$FirewallCheckbox \$FirewallSelection/);
  const install = installerScript.match(/!macro customInstall[\s\S]*?!macroend/)?.[0];
  assert.match(install, /\$\{IfNot\} \$\{Silent\}[\s\S]*\$\{IfNot\} \$\{isUpdated\}[\s\S]*\$\{If\} \$FirewallSelection == \$\{BST_CHECKED\}/);
  assert.match(install, /!insertmacro ConfigureFirewall "Add"/);
  const uninstall = installerScript.match(/!macro customUnInstall[\s\S]*?!macroend/)?.[0];
  assert.match(uninstall, /\$\{IfNot\} \$\{isUpdated\}[\s\S]*!insertmacro ConfigureFirewall "Remove"/);
});

test('Windows firewall rules are scoped to each executable, repeatable, and removed without touching other rules', {
  skip: process.platform !== 'win32',
}, () => {
  const scriptPath = path.join(projectRoot, 'build', 'configure-firewall.ps1').replaceAll("'", "''");
  const harness = `
    $ErrorActionPreference = 'Stop'
    . '${scriptPath}'
    $script:rules = @([pscustomobject]@{ Name = 'Unrelated'; Program = 'C:\\other.exe' })
    $script:created = 0
    $script:updated = 0
    function Get-NetFirewallRule { param($PolicyStore, $ErrorAction) $script:rules }
    function New-NetFirewallRule {
      param($Name, $DisplayName, $PolicyStore, $Direction, $Action, $Enabled, $Profile, $Program, $Protocol, $EdgeTraversalPolicy, $ErrorAction)
      if ($PolicyStore -ne 'PersistentStore' -or $Direction -ne 'Inbound' -or $Action -ne 'Allow' -or
          $Enabled -ne 'True' -or $Profile -ne 'Any' -or $EdgeTraversalPolicy -ne 'Block' -or
          $Protocol -notin @('TCP', 'UDP')) { throw 'Incorrect rule scope' }
      $script:rules += [pscustomobject]@{ Name = $Name; Program = $Program }
      $script:created++
    }
    function Set-NetFirewallRule {
      param($Name, $PolicyStore, $Direction, $Action, $Enabled, $Profile, $Program, $Protocol, $EdgeTraversalPolicy, $ErrorAction)
      if (@($script:rules | Where-Object Name -eq $Name).Count -ne 1) { throw 'Missing rule to update' }
      $script:updated++
    }
    function Remove-NetFirewallRule {
      param([Parameter(ValueFromPipeline)]$InputObject)
      process { $script:rules = @($script:rules | Where-Object Name -ne $InputObject.Name) }
    }
    $first = "C:\\Users\\O'Brien\\LyricDisplay\\LyricDisplay.exe"
    $second = 'C:\\Program Files\\LyricDisplay\\LyricDisplay.exe'
    Set-LyricDisplayFirewall Add $first
    Set-LyricDisplayFirewall Add $first.ToUpperInvariant()
    if ($script:created -ne 2 -or $script:updated -ne 2) { throw 'Repeated install duplicated rules' }
    Set-LyricDisplayFirewall Add $second
    Set-LyricDisplayFirewall Remove $first
    Set-LyricDisplayFirewall Remove $first
    if ($script:rules.Count -ne 3 -or @($script:rules | Where-Object Program -eq $second).Count -ne 2) {
      throw 'Cleanup affected another installation'
    }
    Set-LyricDisplayFirewall Remove $second
    if ($script:rules.Count -ne 1 -or $script:rules[0].Name -ne 'Unrelated') { throw 'Cleanup affected unrelated rules' }
    function New-NetFirewallRule { throw 'Simulated firewall policy denial' }
    $failed = $false
    try { Set-LyricDisplayFirewall Add $first } catch { $failed = $true }
    if (-not $failed) { throw 'Firewall failure was suppressed' }
  `;
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(harness, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
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
