Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'public\favicon.png'
$outputDirectory = Join-Path $projectRoot 'build\appx'

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function New-SquareAsset {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Image] $Source,

        [Parameter(Mandatory)]
        [int] $Size,

        [Parameter(Mandatory)]
        [string] $OutputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($Source, 0, 0, $Size, $Size)
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function New-WhiteGlyph {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Bitmap] $Source
    )

    $glyph = New-Object System.Drawing.Bitmap $Source.Width, $Source.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($y = 0; $y -lt $Source.Height; $y++) {
        for ($x = 0; $x -lt $Source.Width; $x++) {
            $pixel = $Source.GetPixel($x, $y)
            $minimumChannel = [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))
            $alpha = [Math]::Max(0, [Math]::Min(255, [Math]::Round(($minimumChannel - 205) * 5.1)))
            $glyph.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
    }

    return $glyph
}

function New-WideAsset {
    param(
        [Parameter(Mandatory)]
        [System.Drawing.Image] $Glyph,

        [Parameter(Mandatory)]
        [string] $OutputPath
    )

    $width = 310
    $height = 150
    $glyphSize = 132
    $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $width, $height),
        [System.Drawing.Color]::FromArgb(255, 116, 103, 225),
        [System.Drawing.Color]::FromArgb(255, 137, 202, 209)
    )

    try {
        $graphics.FillRectangle($gradient, 0, 0, $width, $height)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $x = [Math]::Floor(($width - $glyphSize) / 2)
        $y = [Math]::Floor(($height - $glyphSize) / 2)
        $graphics.DrawImage($Glyph, $x, $y, $glyphSize, $glyphSize)
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $gradient.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
    New-SquareAsset -Source $source -Size 50 -OutputPath (Join-Path $outputDirectory 'StoreLogo.png')
    New-SquareAsset -Source $source -Size 44 -OutputPath (Join-Path $outputDirectory 'Square44x44Logo.png')
    New-SquareAsset -Source $source -Size 150 -OutputPath (Join-Path $outputDirectory 'Square150x150Logo.png')

    $glyph = New-WhiteGlyph -Source $source
    try {
        New-WideAsset -Glyph $glyph -OutputPath (Join-Path $outputDirectory 'Wide310x150Logo.png')
    }
    finally {
        $glyph.Dispose()
    }
}
finally {
    $source.Dispose()
}

Write-Host "Generated Microsoft Store assets in $outputDirectory"
