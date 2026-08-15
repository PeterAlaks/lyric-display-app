Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'public\favicon.png'
$outputDirectory = Join-Path $projectRoot 'build\appx'
$storeOutputDirectory = Join-Path $projectRoot 'build\store'

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $storeOutputDirectory -Force | Out-Null

function New-TransparentCanvas {
    param(
        [Parameter(Mandatory)]
        [int] $Width,

        [Parameter(Mandatory)]
        [int] $Height
    )

    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    return $bitmap
}

function Set-HighQualityRendering {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Graphics] $Graphics
    )

    $Graphics.Clear([System.Drawing.Color]::Transparent)
    $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
}

function New-SquareAsset {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Image] $Source,

        [Parameter(Mandatory)]
        [int] $Size,

        [Parameter(Mandatory)]
        [string] $OutputPath
    )

    $bitmap = New-TransparentCanvas -Width $Size -Height $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        Set-HighQualityRendering -Graphics $graphics
        $graphics.DrawImage($Source, 0, 0, $Size, $Size)
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function New-WideAsset {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Image] $Source,

        [Parameter(Mandatory)]
        [int] $Width,

        [Parameter(Mandatory)]
        [int] $Height,

        [Parameter(Mandatory)]
        [string] $OutputPath
    )

    $bitmap = New-TransparentCanvas -Width $Width -Height $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        Set-HighQualityRendering -Graphics $graphics
        $logoSize = [Math]::Max(1, [Math]::Round($Height * 0.88))
        $x = [Math]::Floor(($Width - $logoSize) / 2)
        $y = [Math]::Floor(($Height - $logoSize) / 2)
        $graphics.DrawImage($Source, $x, $y, $logoSize, $logoSize)
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Assert-TransparentPng {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $image = [System.Drawing.Bitmap]::FromFile($Path)
    try {
        if ($image.PixelFormat -notin @(
            [System.Drawing.Imaging.PixelFormat]::Format32bppArgb,
            [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb
        )) {
            throw "$Path does not have a 32-bit alpha pixel format."
        }

        $corners = @(
            $image.GetPixel(0, 0),
            $image.GetPixel($image.Width - 1, 0),
            $image.GetPixel(0, $image.Height - 1),
            $image.GetPixel($image.Width - 1, $image.Height - 1)
        )
        # High-quality downscaling can introduce a mathematically negligible
        # alpha value of 1 at the outermost pixel; Windows still treats it as transparent.
        if (@($corners | Where-Object { $_.A -gt 1 }).Count -gt 0) {
            throw "$Path does not preserve the source logo's transparent corners."
        }
    }
    finally {
        $image.Dispose()
    }
}

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
    # These fallback files and every qualified variant preserve the complete
    # public favicon: gradient rounded square, white LD glyph, and transparent corners.
    New-SquareAsset -Source $source -Size 50 -OutputPath (Join-Path $outputDirectory 'StoreLogo.png')
    New-SquareAsset -Source $source -Size 44 -OutputPath (Join-Path $outputDirectory 'Square44x44Logo.png')
    New-SquareAsset -Source $source -Size 150 -OutputPath (Join-Path $outputDirectory 'Square150x150Logo.png')
    New-WideAsset -Source $source -Width 310 -Height 150 -OutputPath (Join-Path $outputDirectory 'Wide310x150Logo.png')

    $targetSizes = @(16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256)
    foreach ($size in $targetSizes) {
        New-SquareAsset -Source $source -Size $size -OutputPath (Join-Path $outputDirectory "Square44x44Logo.targetsize-$size.png")
        New-SquareAsset -Source $source -Size $size -OutputPath (Join-Path $outputDirectory "Square44x44Logo.targetsize-$size`_altform-unplated.png")
        New-SquareAsset -Source $source -Size $size -OutputPath (Join-Path $outputDirectory "Square44x44Logo.targetsize-$size`_altform-lightunplated.png")
    }

    $scaleFactors = [ordered]@{ 100 = 1.0; 125 = 1.25; 150 = 1.5; 200 = 2.0; 400 = 4.0 }
    foreach ($scaleEntry in $scaleFactors.GetEnumerator()) {
        $scaleName = $scaleEntry.Key
        $factor = $scaleEntry.Value
        $storeSize = [Math]::Round(50 * $factor, [MidpointRounding]::AwayFromZero)
        $appListSize = [Math]::Round(44 * $factor, [MidpointRounding]::AwayFromZero)
        $mediumTileSize = [Math]::Round(150 * $factor, [MidpointRounding]::AwayFromZero)
        $wideTileWidth = [Math]::Round(310 * $factor, [MidpointRounding]::AwayFromZero)

        New-SquareAsset -Source $source -Size $storeSize -OutputPath (Join-Path $outputDirectory "StoreLogo.scale-$scaleName.png")
        New-SquareAsset -Source $source -Size $storeSize -OutputPath (Join-Path $outputDirectory "StoreLogo.scale-$scaleName`_altform-colorful_theme-light.png")
        New-SquareAsset -Source $source -Size $appListSize -OutputPath (Join-Path $outputDirectory "Square44x44Logo.scale-$scaleName.png")
        New-SquareAsset -Source $source -Size $appListSize -OutputPath (Join-Path $outputDirectory "Square44x44Logo.scale-$scaleName`_altform-colorful_theme-light.png")
        New-SquareAsset -Source $source -Size $mediumTileSize -OutputPath (Join-Path $outputDirectory "Square150x150Logo.scale-$scaleName.png")
        New-SquareAsset -Source $source -Size $mediumTileSize -OutputPath (Join-Path $outputDirectory "Square150x150Logo.scale-$scaleName`_altform-colorful_theme-light.png")
        New-WideAsset -Source $source -Width $wideTileWidth -Height $mediumTileSize -OutputPath (Join-Path $outputDirectory "Wide310x150Logo.scale-$scaleName.png")
        New-WideAsset -Source $source -Width $wideTileWidth -Height $mediumTileSize -OutputPath (Join-Path $outputDirectory "Wide310x150Logo.scale-$scaleName`_altform-colorful_theme-light.png")
    }

    New-SquareAsset -Source $source -Size 300 -OutputPath (Join-Path $storeOutputDirectory 'StoreListingLogo-300x300.png')
}
finally {
    $source.Dispose()
}

$generatedAssets = @(
    Get-ChildItem -Path $outputDirectory -Filter '*.png' -File
    Get-ChildItem -Path $storeOutputDirectory -Filter '*.png' -File
)
foreach ($asset in $generatedAssets) {
    Assert-TransparentPng -Path $asset.FullName
}

Write-Host "Generated $($generatedAssets.Count) Microsoft Store assets from public/favicon.png without altering the logo."
