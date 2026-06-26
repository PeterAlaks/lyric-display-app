param(
  [Parameter(Mandatory = $true)]
  [int] $ParentPid,

  [Parameter(Mandatory = $true)]
  [string] $ExePath,

  [string] $BaseUrl = 'http://127.0.0.1:4000',
  [string] $Tooltip = 'LyricDisplay Dock Mode',
  [string] $Mode = 'dock'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Invoke-AppControl {
  param([Parameter(Mandatory = $true)][string] $Path)

  try {
    Write-Output "Requesting app control action: $Path"
    Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -TimeoutSec 4 | Out-Null
    Write-Output "Completed app control action: $Path"
    return $true
  } catch {
    [Console]::Error.WriteLine("Failed app control action $Path`: $($_.Exception.Message)")
    return $false
  }
}

function Dispose-And-Exit {
  try {
    if ($script:notifyIcon) {
      $script:notifyIcon.Visible = $false
      $script:notifyIcon.Dispose()
    }
  } catch {
  }

  [System.Windows.Forms.Application]::Exit()
}

$context = New-Object System.Windows.Forms.ApplicationContext
$script:notifyIcon = New-Object System.Windows.Forms.NotifyIcon

try {
  $script:notifyIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($ExePath)
} catch {
  $script:notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$script:notifyIcon.Text = if ($Tooltip.Length -gt 63) { $Tooltip.Substring(0, 63) } else { $Tooltip }
$script:notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = if ($Mode -eq 'dock') { 'Open LyricDisplay Desktop' } else { 'Open LyricDisplay' }
$quitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$quitItem.Text = if ($Mode -eq 'dock') { 'Quit LyricDisplay Dock Mode' } else { 'Quit LyricDisplay' }

$openItem.add_Click({
  if (Invoke-AppControl -Path '/api/app/switch-to-desktop-mode') {
    Dispose-And-Exit
  }
})

$quitItem.add_Click({
  if (Invoke-AppControl -Path '/api/app/quit') {
    Dispose-And-Exit
  }
})

[void] $menu.Items.Add($openItem)
[void] $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void] $menu.Items.Add($quitItem)

$script:notifyIcon.ContextMenuStrip = $menu

$showContextMenu = {
  try {
    $method = [System.Windows.Forms.NotifyIcon].GetMethod(
      'ShowContextMenu',
      [System.Reflection.BindingFlags] 'Instance, NonPublic'
    )
    if ($method) {
      $method.Invoke($script:notifyIcon, $null) | Out-Null
    }
  } catch {
  }
}

$script:notifyIcon.add_MouseUp({
  param($sender, $eventArgs)
  if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    & $showContextMenu
  }
})

$script:notifyIcon.add_DoubleClick({
  if (Invoke-AppControl -Path '/api/app/switch-to-desktop-mode') {
    Dispose-And-Exit
  }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({
  try {
    $parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
    if (-not $parent) {
      Dispose-And-Exit
    }
  } catch {
    Dispose-And-Exit
  }
})
$timer.Start()

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run($context)
