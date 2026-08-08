[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$CoordinatedVersion,
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$Commit,
    [Parameter(Mandatory)][string]$ImageName,
    [Parameter(Mandatory)][string]$ImageTag,
    [Parameter(Mandatory)][string]$ImageDigest,
    [Parameter(Mandatory)][string]$ImageArchive,
    [Parameter(Mandatory)][string]$Sbom,
    [Parameter(Mandatory)][string]$ScanReport,
    [Parameter(Mandatory)][string]$OutputPath,
    [string]$WorkflowRunId = "local"
)

$ErrorActionPreference = "Stop"
if ($CoordinatedVersion -notmatch '^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$' -and
    $CoordinatedVersion -notmatch '^0\.0\.0-main\+[a-f0-9]{7,40}$') {
    throw "CoordinatedVersion is not an approved immutable release/main identity."
}
if ($Commit -notmatch '^[a-f0-9]{40}$') { throw "Commit must be a full lowercase Git SHA." }
if ($ImageTag -ne $Commit) { throw "The component image tag must equal the full source commit." }
if ($ImageTag -in @("latest", "main", "stable")) { throw "Mutable image tags are prohibited." }
if ($ImageDigest -notmatch '^sha256:[a-f0-9]{64}$') { throw "ImageDigest must be an immutable SHA-256 digest." }
foreach ($path in @($ImageArchive, $Sbom, $ScanReport)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required artifact is missing: $path" }
}

function File-Sha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$manifest = [ordered]@{
    schemaVersion = 1
    coordinatedVersion = $CoordinatedVersion
    component = "frontend"
    repository = $Repository
    commit = $Commit
    workflowRunId = $WorkflowRunId
    image = [ordered]@{
        name = $ImageName
        tag = $ImageTag
        digest = $ImageDigest
        archiveSha256 = File-Sha256 $ImageArchive
    }
    sbom = [ordered]@{
        format = "spdx-json"
        sha256 = File-Sha256 $Sbom
    }
    vulnerabilityScan = [ordered]@{
        scanner = "Trivy"
        failSeverities = @("CRITICAL", "HIGH")
        reportSha256 = File-Sha256 $ScanReport
    }
}

$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
$json = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $json, [Text.UTF8Encoding]::new($false))
