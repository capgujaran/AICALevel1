param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$taskAppRoot = Join-Path $PSScriptRoot 'p2p-audit'
$taskDemoUrl = 'http://127.0.0.1:8773/'
$taskChatUrl = 'http://127.0.0.1:8781/health'

function Get-DemoResponse([string]$Url) {
    try { return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 } catch { return $null }
}

function Start-DemoService([string]$Script, [int]$Port, [switch]$Compass) {
    $taskPreviousPort = $env:PORT
    $taskPreviousMode = $env:AICA_GATEWAY_MODE
    $taskPreviousOrigins = $env:AICA_ALLOWED_ORIGINS
    try {
        $env:PORT = "$Port"
        if ($Compass) {
            $env:AICA_GATEWAY_MODE = 'local'
            $env:AICA_ALLOWED_ORIGINS = 'http://127.0.0.1:8773,http://localhost:8773'
        }
        $taskLogPrefix = Join-Path ([IO.Path]::GetTempPath()) ("aica-demo-{0}-{1}" -f $Port, [guid]::NewGuid().ToString('N'))
        return Start-Process -FilePath $taskNodePath -ArgumentList $Script -WorkingDirectory $taskAppRoot -WindowStyle Hidden -RedirectStandardOutput ($taskLogPrefix + '.out.log') -RedirectStandardError ($taskLogPrefix + '.err.log') -PassThru
    } finally {
        $env:PORT = $taskPreviousPort
        $env:AICA_GATEWAY_MODE = $taskPreviousMode
        $env:AICA_ALLOWED_ORIGINS = $taskPreviousOrigins
    }
}

function Wait-DemoService([string]$Url, $Process) {
    $taskWatch = [Diagnostics.Stopwatch]::StartNew()
    do {
        $taskResponse = Get-DemoResponse $Url
        if ($taskResponse) { return $taskResponse }
        if ($Process -and $Process.HasExited) { return $null }
        Start-Sleep -Milliseconds 250
    } while ($taskWatch.Elapsed.TotalSeconds -lt 12)
    return $null
}

try {
    if (!(Test-Path -LiteralPath (Join-Path $taskAppRoot 'site/index.html'))) {
        throw 'Keep this launcher in the AICA folder beside p2p-audit.'
    }
    $taskNodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (!$taskNodeCommand) { throw 'Node.js is required. Install Node.js, then double-click the launcher again.' }
    $taskNodePath = $taskNodeCommand.Source

    $taskFrontend = Get-DemoResponse $taskDemoUrl
    if (!$taskFrontend) {
        $taskFrontendProcess = Start-DemoService 'scripts/serve.mjs' 8773
        $taskFrontend = Wait-DemoService $taskDemoUrl $taskFrontendProcess
    }
    if (!$taskFrontend -or $taskFrontend.Content -notmatch 'AICA.*Audit Lab') {
        throw 'The demo could not start on port 8773. Check whether another application is using that port.'
    }

    $taskChat = Get-DemoResponse $taskChatUrl
    if (!$taskChat) {
        $taskChatProcess = Start-DemoService 'gateway/compass.mjs' 8781 -Compass
        $taskChat = Wait-DemoService $taskChatUrl $taskChatProcess
    }
    $taskChatReady = $false
    if ($taskChat) {
        try { $taskChatHealth = $taskChat.Content | ConvertFrom-Json; $taskChatReady = $taskChatHealth.provider -eq 'Compass' -and $taskChatHealth.status -eq 'ok' } catch { }
    }
    if ($taskChatReady) {
        Write-Host 'AICA demo and AI Auditor chatbot are ready.'
    } else {
        Write-Host 'AICA demo is ready. AI Auditor is unavailable; check the server .env settings and port 8781.'
    }
    $taskDraftUrl = 'http://127.0.0.1:8780/health'
    $taskDraft = Get-DemoResponse $taskDraftUrl
    if (!$taskDraft) {
        $taskDraftProcess = Start-DemoService 'gateway/compass-draft.mjs' 8780 -Compass
        $taskDraft = Wait-DemoService $taskDraftUrl $taskDraftProcess
    }
    if ($taskDraft) { Write-Host 'AI drafting gateway is ready on port 8780.' }
    else { Write-Host 'AI drafting is unavailable; check server .env settings and port 8780.' }
    if (!$NoBrowser) { Start-Process $taskDemoUrl }
    Write-Host "Demo: $taskDemoUrl"
    Write-Host 'Upload the separate CSV samples from AICA/sample-data, Run audit, then Ask AI Auditor. Background services are reused on the next launch.'
} catch {
    Write-Host ("Could not open AICA demo: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
