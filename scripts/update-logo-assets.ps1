Add-Type -AssemblyName System.Drawing

$srcPath = "C:/Users/meetb/.gemini/antigravity/brain/55057d4f-f546-4803-a933-aae1a20607a0/.user_uploaded/media_1793528127626_352086b5.jpg"
$src = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($image, $targetWidth, $targetHeight, $outPath) {
    $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.Clear([System.Drawing.Color]::White)
    $graph.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
    $graph.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved: $outPath ($targetWidth x $targetHeight)"
}

Resize-Image $src 1024 1024 "assets/images/logo.png"
Resize-Image $src 1024 1024 "assets/images/icon.png"
Resize-Image $src 1024 1024 "assets/images/splash-icon.png"
Resize-Image $src 432 432 "assets/images/android-icon-foreground.png"
Resize-Image $src 96 96 "assets/images/favicon.png"

# Also generate favicon for public folder
if (Test-Path "public") {
    Resize-Image $src 96 96 "public/favicon.png"
    Resize-Image $src 192 192 "public/icon-192.png"
    Resize-Image $src 512 512 "public/icon-512.png"
}

# Also update web portals public favicons / logos if available
$portals = @("HealPointDoctorWeb", "HealPointHospitalAdminWeb", "HealPointSuperAdminWeb")
foreach ($portal in $portals) {
    $pubDir = "$portal/public"
    if (Test-Path $pubDir) {
        Resize-Image $src 96 96 "$pubDir/favicon.png"
        Resize-Image $src 512 512 "$pubDir/logo.png"
    }
}

$src.Dispose()
Write-Output "Logo assets conversion completed successfully."

