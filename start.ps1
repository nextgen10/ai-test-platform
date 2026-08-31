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

# $MyInvocation.MyCommand.Path is empty when the script is dot-sourced.
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
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

function Test-RealWin32([string]$Path) {
    if (-not $Path) { return $false }
    # The Microsoft Store alias is on PATH but is not a real interpreter.
    if ($Path -match '(?i)\\WindowsApps\\') { return $false }
    return [IO.File]::Exists($Path)
}

function Import-EnvDefaults([string]$File) {
    foreach ($raw in Get-Content -Path $File -Encoding UTF8) {
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
    if ($env:PYTHON -and (Get-Command $env:PYTHON -ErrorAction SilentlyContinue)) {
        return @{ Exe = $env:PYTHON; Prefix = @() }
    }
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py -and ((Test-RealWin32 $py.Source) -or $py.Name -eq 'py.exe' -or $py.Name -eq 'py')) {
        & py -3 -c "import sys" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return @{ Exe = $py.Source; Prefix = @('-3') }
        }
    }
    foreach ($name in @('python', 'python3')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and (Test-RealWin32 $cmd.Source)) {
            return @{ Exe = $cmd.Source; Prefix = @() }
        }
    }
    throw 'Python 3 not found. Install it from python.org (tick "Add python.exe to PATH") or set $env:PYTHON.'
}

function Resolve-Node {
    foreach ($name in @('node', 'node.exe')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and (Test-RealWin32 $cmd.Source)) {
            return $cmd.Source
        }
    }
    throw 'node.exe not found. Install Node.js LTS and open a new terminal so PATH updates.'
}

function Resolve-NpmCli([string]$NodeExe) {
    $dir = Split-Path -Parent $NodeExe
    $candidates = @(
        (Join-Path $dir 'node_modules\npm\bin\npm-cli.js'),
        (Join-Path (Split-Path $dir) 'node_modules\npm\bin\npm-cli.js')
    )
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) {
        $npmDir = Split-Path -Parent $npm.Source
        $viaCmd = Join-Path $npmDir 'node_modules\npm\bin\npm-cli.js'
        if (Test-Path -LiteralPath $viaCmd) { return $viaCmd }
    }
    throw 'npm-cli.js not found next to node.exe. Reinstall Node.js LTS.'
}

function Stop-ListenersOnPort([int]$Port) {
    $procIds = New-Object System.Collections.Generic.List[int]
    foreach ($line in @(netstat -ano -p tcp 2>$null)) {
        if ($line -match ":${Port}\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            $id = [int]$Matches[1]
            if ($id -gt 0 -and -not $procIds.Contains($id)) { $procIds.Add($id) }
        }
    }
    foreach ($procId in $procIds) {
        # /T kills the process tree so a leftover cmd.exe does not leave node.exe bound.
        & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
    }
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
    foreach ($log in @($StdOut, $StdErr)) {
        $dir = Split-Path -Parent $log
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        if (Test-Path -LiteralPath $log) {
            Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
        }
    }

    # Pass an argument *array*. A single joined string is re-quoted by Windows
    # PowerShell 5.1 and uvicorn/next then see one giant argv[1]. Do not
    # pre-quote paths: Start-Process quotes any element that contains spaces.
    $start = @{
        FilePath               = $FilePath
        ArgumentList           = $ArgumentList
        WorkingDirectory       = $WorkingDirectory
        RedirectStandardOutput = $StdOut
        RedirectStandardError  = $StdErr
        WindowStyle            = 'Hidden'
        PassThru               = $true
    }
    if ($Wait) { $start.Wait = $true }
    return Start-Process @start
}

function Stop-ProcessTree($proc) {
    if (-not $proc) { return }
    try { $proc.Refresh() } catch { return }
    if ($proc.HasExited) { return }
    & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
}

function Show-LogTail([string[]]$Files, [int]$Lines = 20) {
    foreach ($file in $Files) {
        if (Test-Path -LiteralPath $file) {
            Get-Content -Path $file -Tail $Lines -ErrorAction SilentlyContinue
        }
    }
}

function Test-BackendReady([int]$Port) {
    $url = "http://127.0.0.1:$Port/api/v1/health"
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        & curl.exe -sf --max-time 2 $url 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    }
    try {
        $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $true
    } catch {
        return $false
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
Set-EnvDefault 'AUTH_MODE' 'disabled'
Set-EnvDefault 'ENABLE_DOCS' '1'

$BackendPort = [int]$env:BACKEND_PORT
$FrontendPort = [int]$env:FRONTEND_PORT
$Python = Resolve-Python
$Node = Resolve-Node

# The orchestrator refuses to start in token mode with no credentials, so that
# an unconfigured deployment can never serve an open API. For a local run we
# mint one here and hand it to both processes: the browser talks to Next, Next
# attaches the token, and nothing sensitive reaches the client.
if ($env:AUTH_MODE -eq 'token' -and -not $env:API_TOKENS) {
    $DevToken = & $Python.Exe @($Python.Prefix + @('-c', 'import secrets; print(secrets.token_urlsafe(32))'))
    if ($DevToken -is [array]) { $DevToken = $DevToken[-1] }
    $DevToken = ([string]$DevToken).Trim()
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

$script:BackendProc = $null
$script:FrontendProc = $null
$BackendOut = Join-Path $LogDir 'backend.log'
$BackendErr = Join-Path $LogDir 'backend.err.log'
$FrontendOut = Join-Path $LogDir 'frontend.log'
$FrontendErr = Join-Path $LogDir 'frontend.err.log'

function Stop-Hub {
    Write-Host ""
    Write-Host "Stopping…"
    Stop-ProcessTree $script:FrontendProc
    Stop-ProcessTree $script:BackendProc
    Stop-ListenersOnPort $script:BackendPort
    Stop-ListenersOnPort $script:FrontendPort
}

# Used by Stop-Hub after Ctrl-C; must be script-scoped.
$script:BackendPort = $BackendPort
$script:FrontendPort = $FrontendPort

try {
    Write-Host "AI Test Platform"
    Write-Host "  executor : $($env:EXECUTOR)"
    Write-Host "  engine   : $($env:ENGINE)"
    if ($env:ENGINE -eq 'mock') {
        Write-Host "             (deterministic stand-in — Copilot CLI is not required)"
        Write-Host "             (set ENGINE=copilot and install @github/copilot for real generation)"
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
    $script:BackendProc = Start-LoggedProcess -FilePath $Python.Exe -ArgumentList $uvicornArgs `
        -WorkingDirectory (Join-Path $Root 'backend') `
        -StdOut $BackendOut -StdErr $BackendErr

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-BackendReady $BackendPort) {
            $ready = $true
            Write-Host "  orchestrator ready"
            break
        }
        Start-Sleep -Milliseconds 500
    }

    $script:BackendProc.Refresh()
    if ($script:BackendProc.HasExited) {
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
    $nextBin = Join-Path $frontendDir 'node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $nextBin)) {
        Write-Host "  installing frontend dependencies (first run)…"
        $npmCli = Resolve-NpmCli $Node
        $install = Start-LoggedProcess -FilePath $Node `
            -ArgumentList @($npmCli, 'install', '--no-audit', '--no-fund') `
            -WorkingDirectory $frontendDir `
            -StdOut $FrontendOut -StdErr $FrontendErr -Wait
        if ($install.ExitCode -ne 0) {
            Write-Host "npm install failed. Last lines:" -ForegroundColor Red
            Show-LogTail @($FrontendOut, $FrontendErr)
            exit $install.ExitCode
        }
        if (-not (Test-Path -LiteralPath $nextBin)) {
            Write-Host "npm install finished but Next.js is missing at $nextBin" -ForegroundColor Red
            exit 1
        }
    }

    # package.json uses bash ${PORT:-3100}, which cmd.exe will not expand.
    # Call next through node.exe so we never wrap npm.cmd / npx.cmd.
    $env:PORT = "$FrontendPort"
    $env:API_TARGET = "http://127.0.0.1:$BackendPort"
    $env:UI_AUTH_MODE = 'shared'
    $script:FrontendProc = Start-LoggedProcess -FilePath $Node `
        -ArgumentList @($nextBin, 'dev', '--turbopack', '--port', "$FrontendPort") `
        -WorkingDirectory $frontendDir `
        -StdOut $FrontendOut -StdErr $FrontendErr

    Start-Sleep -Seconds 3
    $script:FrontendProc.Refresh()
    if ($script:FrontendProc.HasExited) {
        Write-Host "UI failed to start. Last lines:" -ForegroundColor Red
        Show-LogTail @($FrontendOut, $FrontendErr)
        exit 1
    }

    Write-Host ""
    Write-Host "  UI       http://localhost:$FrontendPort"
    try {
        $lanIps = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.ToString() -notlike '127.*' } |
            ForEach-Object { $_.ToString() } |
            Select-Object -Unique
        foreach ($ip in $lanIps) {
            Write-Host "  Network  http://${ip}:$FrontendPort"
        }
    } catch { }
    Write-Host "  API docs http://localhost:$BackendPort/docs"
    Write-Host "  logs     $LogDir\"
    Write-Host ""
    Write-Host "Ctrl-C to stop."

    while ($true) {
        $script:BackendProc.Refresh()
        $script:FrontendProc.Refresh()
        if ($script:BackendProc.HasExited -and $script:FrontendProc.HasExited) { break }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Hub
}
