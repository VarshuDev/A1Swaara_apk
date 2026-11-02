# Ralph Autonomous Agent Loop for Windows (PowerShell)
# Usage: .\ralph.ps1 [-MaxIterations 10] [-Tool amp|claude]

param(
    [int]$MaxIterations = 10,
    [string]$Tool = "amp"
)

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$PrdFile = Join-Path $ScriptDir "prd.json"
$ProgressFile = Join-Path $ScriptDir "progress.txt"
$ArchiveDir = Join-Path $ScriptDir "archive"
$LastBranchFile = Join-Path $ScriptDir ".last-branch"

# Archive previous run if branch changed
if ((Test-Path $PrdFile) -and (Test-Path $LastBranchFile)) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        $currentBranch = $prdContent.branchName
        $lastBranch = (Get-Content $LastBranchFile -Raw).Trim()

        if ($currentBranch -and $lastBranch -and ($currentBranch -ne $lastBranch)) {
            $date = (Get-Date).ToString("yyyy-MM-dd")
            $folderName = $lastBranch -replace "^ralph/", ""
            $archiveFolder = Join-Path $ArchiveDir "$date-$folderName"

            Write-Host "Archiving previous run: $lastBranch" -ForegroundColor Yellow
            if (!(Test-Path $archiveFolder)) { New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null }
            Copy-Item $PrdFile (Join-Path $archiveFolder "prd.json") -Force
            if (Test-Path $ProgressFile) { Copy-Item $ProgressFile (Join-Path $archiveFolder "progress.txt") -Force }
            Write-Host "   Archived to: $archiveFolder" -ForegroundColor Gray

            # Reset progress file
            "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n" | Set-Content $ProgressFile -Encoding UTF8
        }
    } catch {
        Write-Warning "Could not parse previous branch from prd.json"
    }
}

# Track current branch
if (Test-Path $PrdFile) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        if ($prdContent.branchName) {
            $prdContent.branchName | Set-Content $LastBranchFile -Encoding UTF8
        }
    } catch {}
}

# Initialize progress file if missing
if (!(Test-Path $ProgressFile)) {
    "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n" | Set-Content $ProgressFile -Encoding UTF8
}

Write-Host "Starting Ralph - Tool: $Tool - Max iterations: $MaxIterations" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Green
    Write-Host "  Ralph Iteration $i of $MaxIterations ($Tool)" -ForegroundColor Green
    Write-Host "===============================================================" -ForegroundColor Green

    $promptFile = if ($Tool -eq "claude") { Join-Path $ScriptDir "CLAUDE.md" } else { Join-Path $ScriptDir "prompt.md" }
    
    # Check if tool is available on PATH
    $cmd = Get-Command $Tool -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "Note: '$Tool' is not in PATH. You can run iterations inside Antigravity using the Ralph prompt directly." -ForegroundColor Yellow
        break
    }

    if ($Tool -eq "amp") {
        $output = Get-Content $promptFile -Raw | amp --dangerously-allow-all 2>&1
    } else {
        $output = Get-Content $promptFile -Raw | claude --dangerously-skip-permissions --print 2>&1
    }

    Write-Host $output

    if ($output -match "<promise>COMPLETE</promise>") {
        Write-Host ""
        Write-Host "Ralph reached COMPLETE condition!" -ForegroundColor Green
        break
    }
}
