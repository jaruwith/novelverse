[CmdletBinding()]
param(
    [string]$ImageTag = "novelverse-web:deployment-b-promotion-proof",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
if (-not $SkipBuild) {
    docker build --tag $ImageTag .
    if ($LASTEXITCODE -ne 0) { throw "Frontend build-once image build failed." }
}
$before = docker image inspect $ImageTag --format "{{.Id}}"
try {
    & (Join-Path $PSScriptRoot "smoke-deployment-a-container.ps1") `
        -ImageTag $ImageTag -ContainerName "novelverse-web-deployment-b-dev" `
        -HostPort 3101 -DeploymentSlot development -SkipBuild
    & (Join-Path $PSScriptRoot "smoke-deployment-a-container.ps1") `
        -ImageTag $ImageTag -ContainerName "novelverse-web-deployment-b-staging" `
        -HostPort 3102 -DeploymentSlot staging -SkipBuild
    $after = docker image inspect $ImageTag --format "{{.Id}}"
    if ($before -ne $after) { throw "Frontend image identity changed between environment runs." }
    Write-Output "Deployment B Frontend build-once promotion proof PASS ($before)."
}
finally {
    if (-not $SkipBuild) { docker image rm $ImageTag *> $null }
}
