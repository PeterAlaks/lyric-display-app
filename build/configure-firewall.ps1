[CmdletBinding()]
param(
    [ValidateSet('Add', 'Remove')]
    [string]$Action,
    [string]$Program,
    [switch]$NoElevation
)

function Get-LyricDisplayFirewallRuleNames {
    param([string]$Executable)

    # Each installation owns its rules, including installs under other accounts.
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Executable.ToLowerInvariant())
        $id = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
    } finally {
        $sha.Dispose()
    }
    @("LyricDisplay-$id-TCP", "LyricDisplay-$id-UDP")
}

function Get-LyricDisplayFirewallRules {
    param([string]$Executable)
    $names = @(Get-LyricDisplayFirewallRuleNames -Executable $Executable)
    Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction Stop |
        Where-Object { $_.Name -in $names }
}

function Set-LyricDisplayFirewall {
    param([string]$Operation, [string]$Executable)

    $existing = @(Get-LyricDisplayFirewallRules -Executable $Executable)
    if ($Operation -eq 'Remove') {
        $existing | Remove-NetFirewallRule -ErrorAction Stop
        return
    }

    $names = @(Get-LyricDisplayFirewallRuleNames -Executable $Executable)
    foreach ($protocol in @('TCP', 'UDP')) {
        $name = $names | Where-Object { $_.EndsWith("-$protocol") }
        $settings = @{
            PolicyStore = 'PersistentStore'
            Direction = 'Inbound'
            Action = 'Allow'
            Enabled = 'True'
            Profile = 'Any'
            Program = $Executable
            Protocol = $protocol
            EdgeTraversalPolicy = 'Block'
            ErrorAction = 'Stop'
        }
        if ($existing.Name -contains $name) {
            Set-NetFirewallRule -Name $name @settings | Out-Null
        } else {
            New-NetFirewallRule -Name $name -DisplayName "LyricDisplay ($protocol inbound)" @settings | Out-Null
        }
    }
}

# Dot sourcing exposes the rule operations for tests without changing the host firewall.
if ($MyInvocation.InvocationName -eq '.') { return }

$ErrorActionPreference = 'Stop'
try {
    if (-not $Action -or -not $Program -or -not [IO.Path]::IsPathRooted($Program)) {
        throw 'An action and absolute executable path are required.'
    }
    $Program = [IO.Path]::GetFullPath($Program)
    if ($Action -eq 'Add' -and -not (Test-Path -LiteralPath $Program -PathType Leaf)) {
        throw 'The installed executable was not found.'
    }
    if ($Action -eq 'Remove' -and @(Get-LyricDisplayFirewallRules -Executable $Program).Count -eq 0) {
        exit 0
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        if ($NoElevation) { throw 'Administrator approval is required to update Windows Firewall.' }
        # Encode a literal invocation so spaces, apostrophes and PowerShell metacharacters
        # in installation paths survive elevation without being interpreted as code.
        $scriptLiteral = $PSCommandPath.Replace("'", "''")
        $programLiteral = $Program.Replace("'", "''")
        $command = "& '$scriptLiteral' -Action '$Action' -Program '$programLiteral' -NoElevation"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $process = Start-Process -FilePath "$PSHOME\powershell.exe" -Verb RunAs -WindowStyle Hidden -Wait -PassThru `
            -ArgumentList @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded)
        exit $process.ExitCode
    }
    Set-LyricDisplayFirewall -Operation $Action -Executable $Program
    exit 0
} catch {
    Write-Output "Windows Firewall: $($_.Exception.Message)"
    exit 1
}
