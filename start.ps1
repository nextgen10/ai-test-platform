#Requires -Version 5.1
<#
.SYNOPSIS
    Start Agent HUB locally (orchestrator + UI).

.DESCRIPTION
    Windows equivalent of start.sh. Ports 8100/3100 run the backend
    orchestrator and Next.js frontend.

    Environment already set in the session wins over .env, so this still
    works:  $env:ENGINE = 'copilot'; .\start.ps1

    If execution policy blocks the script:
        powershell -ExecutionPolicy Bypass -File .\start.ps1
#>
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-EnvSet([string]$Name) {
    $null -ne [Environment]::GetEnvironmentVariable($Name, 'Process')
}

function Set-EnvDefault([string]$Name, [string]$Value) {
    if (-not (Test-EnvSet $Name)) {
        Set-Item -Path "Env:$Name" -Value $Value
    }
}

function Import-EnvDefaults([string]$File) {
    foreach ($raw in Get-Content -Path $File) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        if ($line.StartsWith('export ')) { $line = $line.Substring(7) }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $line.Substring(0, $eq).TrimEnd()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
        if (Test-EnvSet $key) { continue }
        $value = $line.Substring($eq + 1)
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $value
    }
}

function Resolve-Python {
    if ($env:PYTHON) {
        return @{ Exe = $env:PYTHON; Prefix = @() }
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -c "import sys" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return @{ Exe = 'py'; Prefix = @('-3') }
        }
    }
    foreach ($name in @('python', 'python3')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            return @{ Exe = $cmd.Source; Prefix = @() }
        }
    }
    throw 'Python 3 not found. Install it or set $env:PYTHON.'
}

function Resolve-Npm([string]$Name) {
    $cmd = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "$Name not found. Install Node.js and ensure it is on PATH."
}

function Stop-ListenersOnPort([int]$Port) {
    $procIds = @()
    try {
        $procIds = @(
            Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique
        )
    } catch {
        $procIds = @()
    }
    if (-not $procIds) {
        $escaped = [regex]::Escape(":$Port")
        $procIds = @(
            netstat -ano -p tcp |
                Select-String -Pattern "$escaped\s+\S+\s+LISTENING\s+(\d+)$" |
                ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
                Select-Object -Unique
        )
    }
    foreach ($procId in $procIds) {
        if ($procId -and $procId -ne 0) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Resolve-StartTarget([string]$FilePath, [string[]]$ArgumentList) {
    $ext = [IO.Path]::GetExtension($FilePath)
    if ($ext -in @('.cmd', '.bat')) {
        $quoted = ($ArgumentList | ForEach-Object {
            if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ }
        }) -join ' '
        return @{
            FilePath = $env:ComSpec
            ArgumentList = @('/d', '/s', '/c', "`"`"$FilePath`" $quoted`"")
        }
    }
    $argString = ($ArgumentList | ForEach-Object {
        if ($_ -match '\s') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
    }) -join ' '
    return @{ FilePath = $FilePath; ArgumentList = $argString }
}

function Start-LoggedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$StdOut,
        [Parameter(Mandatory = $true)][string]$StdErr,
        [switch]$Wait
    )
    $target = Resolve-StartTarget $FilePath $ArgumentList
    $start = @{
        FilePath               = $target.FilePath
        ArgumentList           = $target.ArgumentList
        WorkingDirectory       = $WorkingDirectory
        RedirectStandardOutput = $StdOut
        RedirectStandardError  = $StdErr
        WindowStyle            = 'Hidden'
        PassThru               = $true
    }
    if ($Wait) { $start.Wait = $true }
    return Start-Process @start
}

function Show-LogTail([string[]]$Files, [int]$Lines = 20) {
    foreach ($file in $Files) {
        if (Test-Path $file) {
            Get-Content -Path $file -Tail $Lines
        }
    }
}

# Load .env as *defaults*: anything already in the environment wins.
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
    Import-EnvDefaults $envFile
    Write-Host "Loaded $envFile"
}

Set-EnvDefault 'EXECUTOR' 'local'
Set-EnvDefault 'ENGINE' 'mock'
Set-EnvDefault 'BACKEND_PORT' '8100'
Set-EnvDefault 'FRONTEND_PORT' '3100'
Set-EnvDefault 'AUTH_MODE' 'token'
Set-EnvDefault 'ENABLE_DOCS' '1'

$BackendPort = [int]$env:BACKEND_PORT
$FrontendPort = [int]$env:FRONTEND_PORT
$Python = Resolve-Python

# The orchestrator refuses to start in token mode with no credentials, so that
# an unconfigured deployment can never serve an open API. For a local run we
# mint one here and hand it to both processes: the browser talks to Next, Next
# attaches the token, and nothing sensitive reaches the client.
if ($env:AUTH_MODE -eq 'token' -and -not $env:API_TOKENS) {
    $DevToken = & $Python.Exe @($Python.Prefix + @('-c', 'import secrets; print(secrets.token_urlsafe(32))'))
    if ($DevToken -is [array]) { $DevToken = $DevToken[-1] }
    $DevToken = [string]$DevToken
    $DevToken = $DevToken.Trim()
    if (-not $DevToken) { throw 'Failed to mint a local API token.' }
    $env:API_TOKENS = "${DevToken}:local-dev:admin"
    $env:API_TOKEN = $DevToken
    Write-Host "  auth     token mode, dev credential generated for this run"
} elseif ($env:AUTH_MODE -eq 'disabled') {
    $env:ALLOW_INSECURE_AUTH = '1'
    Write-Host "  auth     DISABLED — every endpoint is open. Loopback only."
} else {
    if (-not (Test-EnvSet 'API_TOKEN')) { $env:API_TOKEN = '' }
    Write-Host "  auth     token mode, using API_TOKENS from the environment"
    if (-not $env:API_TOKEN) {
        Write-Warning "API_TOKEN is unset, so the UI cannot authenticate."
        Write-Warning "Set it to one of the tokens listed in API_TOKENS."
    }
}

$BackendProc = $null
$FrontendProc = $null
$BackendOut = Join-Path $LogDir 'backend.log'
$BackendErr = Join-Path $LogDir 'backend.err.log'
$FrontendOut = Join-Path $LogDir 'frontend.log'
$FrontendErr = Join-Path $LogDir 'frontend.err.log'

function Stop-Hub {
    Write-Host ""
    Write-Host "Stopping…"
    foreach ($proc in @($script:FrontendProc, $script:BackendProc)) {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    Write-Host "AI Test Platform"
    Write-Host "  executor : $($env:EXECUTOR)"
    Write-Host "  engine   : $($env:ENGINE)"
    if ($env:ENGINE -eq 'mock') {
        Write-Host "             (deterministic stand-in — set ENGINE=copilot for real generation)"
    }
    Write-Host ""

    Write-Host "Cleaning up any processes on port $BackendPort..."
    Stop-ListenersOnPort $BackendPort

    Write-Host "Starting orchestrator on :$BackendPort"
    $uvicornArgs = $Python.Prefix + @(
        '-m', 'uvicorn', 'app.main:app',
        '--host', '127.0.0.1',
        '--port', "$BackendPort"
    )
    $BackendProc = Start-LoggedProcess -FilePath $Python.Exe -ArgumentList $uvicornArgs `
        -WorkingDirectory (Join-Path $Root 'backend') `
        -StdOut $BackendOut -StdErr $BackendErr

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/api/v1/health" `
                -UseBasicParsing -TimeoutSec 2
            $ready = $true
            Write-Host "  orchestrator ready"
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if ($BackendProc.HasExited) {
        Write-Host "Orchestrator failed to start. Last lines:" -ForegroundColor Red
        Show-LogTail @($BackendOut, $BackendErr)
        exit 1
    }
    if (-not $ready) {
        Write-Warning "Orchestrator has not answered /api/v1/health yet; continuing."
    }

    Write-Host "Cleaning up any processes on port $FrontendPort..."
    Stop-ListenersOnPort $FrontendPort

    Write-Host "Starting UI on :$FrontendPort"
    $frontendDir = Join-Path $Root 'frontend'
    $npm = Resolve-Npm 'npm'
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Host "  installing frontend dependencies (first run)…"
        $install = Start-LoggedProcess -FilePath $npm `
            -ArgumentList @('install', '--no-audit', '--no-fund') `
            -WorkingDirectory $frontendDir `
            -StdOut $FrontendOut -StdErr $FrontendErr -Wait
        if ($install.ExitCode -ne 0) {
            Write-Host "npm install failed. Last lines:" -ForegroundColor Red
            Show-LogTail @($FrontendOut, $FrontendErr)
            exit $install.ExitCode
        }
    }

    # package.json uses bash ${PORT:-3100}, which cmd.exe will not expand.
    # Invoke next with an explicit --port so the UI binds correctly on Windows.
    $env:PORT = "$FrontendPort"
    $env:API_TARGET = "http://127.0.0.1:$BackendPort"
    $env:UI_AUTH_MODE = 'shared'
    $npx = Resolve-Npm 'npx'
    $FrontendProc = Start-LoggedProcess -FilePath $npx `
        -ArgumentList @('next', 'dev', '--turbopack', '--port', "$FrontendPort") `
        -WorkingDirectory $frontendDir `
        -StdOut $FrontendOut -StdErr $FrontendErr

    Start-Sleep -Seconds 3
    if ($FrontendProc.HasExited) {
        Write-Host "UI failed to start. Last lines:" -ForegroundColor Red
        Show-LogTail @($FrontendOut, $FrontendErr)
        exit 1
    }

    Write-Host ""
    Write-Host "  UI       http://localhost:$FrontendPort"
    Write-Host "  API docs http://localhost:$BackendPort/docs"
    Write-Host "  logs     $LogDir\"
    Write-Host ""
    Write-Host "Ctrl-C to stop."

    while (-not $BackendProc.HasExited -or -not $FrontendProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Hub
}
