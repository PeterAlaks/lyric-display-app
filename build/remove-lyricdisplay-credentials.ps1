[CmdletBinding()]
param(
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

$credentialInterop = @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct LyricDisplayCredential
{
    public UInt32 Flags;
    public UInt32 Type;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
    [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
    [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
}

public static class LyricDisplayCredentialManager
{
    [DllImport("advapi32.dll", EntryPoint = "CredEnumerateW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredEnumerate(
        string filter,
        UInt32 flags,
        out UInt32 count,
        out IntPtr credentials);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

    [DllImport("advapi32.dll", SetLastError = false)]
    public static extern void CredFree(IntPtr buffer);
}
'@

Add-Type -TypeDefinition $credentialInterop

if ($ValidateOnly) {
    Write-Output 'Credential cleanup helper loaded successfully.'
    exit 0
}

$credentialTypeGeneric = [UInt32]1
$notFoundError = 1168
$servicePrefixes = @(
    'LyricDisplay/',
    'LyricDisplayAuthTokens/',
    'LyricDisplayProviderKeys/'
)

[UInt32]$credentialCount = 0
[IntPtr]$credentialPointers = [IntPtr]::Zero
$enumerated = [LyricDisplayCredentialManager]::CredEnumerate(
    $null,
    0,
    [ref]$credentialCount,
    [ref]$credentialPointers
)

if (-not $enumerated) {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($errorCode -eq $notFoundError) {
        Write-Output 'No LyricDisplay credentials were found.'
        exit 0
    }

    throw "Could not enumerate Windows credentials (error $errorCode)."
}

$removedCount = 0
$failedTargets = [System.Collections.Generic.List[string]]::new()

try {
    for ($index = 0; $index -lt $credentialCount; $index += 1) {
        $pointerOffset = $index * [IntPtr]::Size
        $credentialPointer = [Runtime.InteropServices.Marshal]::ReadIntPtr(
            $credentialPointers,
            $pointerOffset
        )
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
            $credentialPointer,
            [type][LyricDisplayCredential]
        )

        $isLyricDisplayCredential = $false
        foreach ($prefix in $servicePrefixes) {
            if ($credential.TargetName.StartsWith($prefix, [StringComparison]::Ordinal)) {
                $isLyricDisplayCredential = $true
                break
            }
        }

        if (-not $isLyricDisplayCredential) {
            continue
        }

        if ([LyricDisplayCredentialManager]::CredDelete(
            $credential.TargetName,
            $credentialTypeGeneric,
            0
        )) {
            $removedCount += 1
        } else {
            $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            $failedTargets.Add("$($credential.TargetName) (error $errorCode)")
        }
    }
} finally {
    [LyricDisplayCredentialManager]::CredFree($credentialPointers)
}

Write-Output "Removed $removedCount LyricDisplay credential(s)."

if ($failedTargets.Count -gt 0) {
    Write-Error "Could not remove: $($failedTargets -join ', ')"
    exit 1
}
