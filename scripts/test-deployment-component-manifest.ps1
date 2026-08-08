$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("novelverse-web-manifest-test-" + [Guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
    foreach ($name in @("frontend.tar", "frontend.spdx.json", "frontend.sarif")) {
        Set-Content -LiteralPath (Join-Path $temporaryRoot $name) -Value $name -Encoding UTF8
    }
    $commit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    $manifestPath = Join-Path $temporaryRoot "frontend.json"
    & (Join-Path $root "scripts\New-DeploymentComponentManifest.ps1") `
        -CoordinatedVersion v1.4.0-alpha.1 -Repository jaruwith/novelverse `
        -Commit $commit -ImageName novelverse-web -ImageTag $commit `
        -ImageDigest ("sha256:" + ("2" * 64)) -ImageArchive (Join-Path $temporaryRoot "frontend.tar") `
        -Sbom (Join-Path $temporaryRoot "frontend.spdx.json") -ScanReport (Join-Path $temporaryRoot "frontend.sarif") `
        -OutputPath $manifestPath
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.component -ne "frontend" -or $manifest.commit -ne $commit -or
        $manifest.image.tag -ne $commit -or $manifest.sbom.format -ne "spdx-json") {
        throw "Frontend artifact identity was not preserved."
    }

    $mutableRejected = $false
    try {
        & (Join-Path $root "scripts\New-DeploymentComponentManifest.ps1") `
            -CoordinatedVersion v1.4.0-alpha.1 -Repository jaruwith/novelverse `
            -Commit $commit -ImageName novelverse-web -ImageTag latest `
            -ImageDigest ("sha256:" + ("2" * 64)) -ImageArchive (Join-Path $temporaryRoot "frontend.tar") `
            -Sbom (Join-Path $temporaryRoot "frontend.spdx.json") -ScanReport (Join-Path $temporaryRoot "frontend.sarif") `
            -OutputPath (Join-Path $temporaryRoot "invalid.json")
    } catch { $mutableRejected = $true }
    if (-not $mutableRejected) { throw "Mutable image tag was accepted." }

    $missingDigestRejected = $false
    try {
        & (Join-Path $root "scripts\New-DeploymentComponentManifest.ps1") `
            -CoordinatedVersion v1.4.0-alpha.1 -Repository jaruwith/novelverse `
            -Commit $commit -ImageName novelverse-web -ImageTag $commit -ImageDigest "sha256:missing" `
            -ImageArchive (Join-Path $temporaryRoot "frontend.tar") `
            -Sbom (Join-Path $temporaryRoot "frontend.spdx.json") -ScanReport (Join-Path $temporaryRoot "frontend.sarif") `
            -OutputPath (Join-Path $temporaryRoot "invalid.json")
    } catch { $missingDigestRejected = $true }
    if (-not $missingDigestRejected) { throw "Invalid digest was accepted." }

    $missingSbomRejected = $false
    try {
        & (Join-Path $root "scripts\New-DeploymentComponentManifest.ps1") `
            -CoordinatedVersion v1.4.0-alpha.1 -Repository jaruwith/novelverse `
            -Commit $commit -ImageName novelverse-web -ImageTag $commit `
            -ImageDigest ("sha256:" + ("2" * 64)) -ImageArchive (Join-Path $temporaryRoot "frontend.tar") `
            -Sbom (Join-Path $temporaryRoot "missing.spdx.json") -ScanReport (Join-Path $temporaryRoot "frontend.sarif") `
            -OutputPath (Join-Path $temporaryRoot "invalid.json")
    } catch { $missingSbomRejected = $true }
    if (-not $missingSbomRejected) { throw "Missing SBOM was accepted." }

    [pscustomobject]@{
        result = "PASS"
        coordinatedIdentity = $true
        mutableTagRejected = $true
        missingDigestRejected = $true
        missingSbomRejected = $true
    } | ConvertTo-Json
}
finally {
    $resolved = [IO.Path]::GetFullPath($temporaryRoot)
    if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $resolved)) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
