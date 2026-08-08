param(
    [string]$ImageTag = "novelverse-web:deployment-a-local",
    [string]$ContainerName = "novelverse-web-deployment-a-smoke",
    [int]$HostPort = 3100,
    [string]$DeploymentSlot = "local",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
if (docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}") {
    throw "Container '$ContainerName' already exists."
}

try {
    if (-not $SkipBuild) {
        docker build -t $ImageTag .
        if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed." }
    }
    $null = docker run -d --name $ContainerName -p "${HostPort}:3000" --read-only `
        --tmpfs /tmp:rw,noexec,nosuid,size=64m `
        -e "NOVELVERSE_DEPLOYMENT_SLOT=$DeploymentSlot" $ImageTag
    if ($LASTEXITCODE -ne 0) { throw "Frontend container start failed." }

    $baseUrl = "http://localhost:$HostPort"
    $healthy = $false
    foreach ($attempt in 1..30) {
        try {
            if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$baseUrl/health").StatusCode -eq 200) {
                $healthy = $true
                break
            }
        }
        catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $healthy) { throw "Frontend health did not become healthy." }

    foreach ($path in @("/", "/login", "/notifications", "/story/library-after-rain",
            "/story/library-after-rain/chapter/1")) {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "$baseUrl$path"
        if ($response.StatusCode -ne 200) { throw "$path returned $($response.StatusCode)." }
    }
    $user = docker inspect $ContainerName --format "{{.Config.User}}"
    if ($user -match "^0(?::0)?$") { throw "Frontend container is running as root." }
    Write-Output "Deployment A Frontend container smoke PASS (user $user, port $HostPort)."
}
finally {
    if (docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}") {
        if (docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}") {
            docker stop -t 10 $ContainerName | Out-Null
        }
        docker rm $ContainerName | Out-Null
    }
}
