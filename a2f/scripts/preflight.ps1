# Audio2Face-3D SDK - environment preflight (Windows). Phase 9 (09-01).
# Detects toolchain gaps: CUDA 12.8-12.9, TensorRT 10.13, Python 3.8-3.10, VS2022, git-lfs.
# Exit code: 0 = OK, 1 = FAIL (missing critical), 2 = WARN (only warnings).

$ErrorActionPreference = 'SilentlyContinue'
$exitCode = 0

function Check {
    param([string]$Name, [string]$State, [bool]$Ok)
    $mark = if ($Ok) { 'PASS' } else { 'FAIL' }
    Write-Host ("[{0}] {1}: {2}" -f $mark, $Name, $State)
    if (-not $Ok) { $script:exitCode = 1 }
}

function Warn {
    param([string]$Name, [string]$State)
    Write-Host ("[WARN] {0}: {1}" -f $Name, $State)
    if ($script:exitCode -eq 0) { $script:exitCode = 2 }
}

Write-Host '=== A2F-3D preflight (Windows) ==='
Write-Host ("Run at: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# 1) GPU + driver
$gpu = & nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>$null
if ($gpu) {
    $g = ($gpu -split ',')
    Check 'NVIDIA GPU' ("$($g[0].Trim()) / $($g[1].Trim()) / driver $($g[2].Trim())") $true
} else {
    Check 'NVIDIA GPU' 'nvidia-smi missing' $false
}

# 2) CUDA Toolkit (SDK requires 12.8-12.9; 13.x NOT supported)
$cudaRoot = 'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA'
$cudaDirs = @()
if (Test-Path $cudaRoot) { $cudaDirs = Get-ChildItem $cudaRoot -Directory | Select-Object -ExpandProperty Name }
$nvccOut = & nvcc --version 2>$null | Select-String 'release ([0-9.]+)'
$cuda12Dirs = @($cudaDirs | Where-Object { $_ -match '^v?12\.' })
if ($nvccOut) {
    $rel = ($nvccOut.Matches[0].Groups[1].Value)
    $major = [int]($rel -split '\.')[0]
    if ($major -eq 12) { Check 'CUDA Toolkit' "release $rel (in 12.x range)" $true }
    elseif ($major -ge 13) {
        if ($cuda12Dirs.Count -gt 0) {
            Warn 'CUDA Toolkit' "default nvcc is $rel (13.x) but CUDA 12.x dir exists: $($cuda12Dirs -join ', ') - set CUDA_PATH/CUDA_HOME to 12.x for the SDK build"
        } else {
            Warn 'CUDA Toolkit' "release $rel - SDK needs <13.0; install CUDA 12.9 alongside and point CUDA_PATH to it"
        }
    } else { Check 'CUDA Toolkit' "release $rel - too old (need 12.8+)" $false }
} elseif ($cudaDirs.Count -gt 0) {
    Warn 'CUDA Toolkit' "dirs found: $($cudaDirs -join ', ') - nvcc not on PATH; set CUDA_PATH"
} else {
    Check 'CUDA Toolkit' 'not installed' $false
}

# 3) TensorRT (SDK requires >=10.13, <11.0)
$trtCandidates = @()
$trtDefault = Join-Path $cudaRoot 'TensorRT'
foreach ($p in @($env:TENSORRT_ROOT_DIR, $trtDefault, 'C:\Program Files\NVIDIA GPU Computing Toolkit\TensorRT')) {
    if ($p -and (Test-Path $p)) { $trtCandidates += $p }
}
if ($trtCandidates.Count -gt 0) {
    Warn 'TensorRT' "found at: $($trtCandidates -join ' | ') - verify version is >=10.13 and set TENSORRT_ROOT_DIR"
} else {
    Warn 'TensorRT' 'TensorRT not found (need >=10.13, <11.0)'
}

# 4) Python 3.8-3.10 (SDK tooling) + uv
$py310 = $null
foreach ($line in @(& py -0p 2>$null)) {
    if ($line -match '3\.10') { $py310 = $line.Trim() }
}
if ($py310) {
    Check 'Python 3.10' $py310 $true
} else {
    Warn 'Python 3.10' '3.8-3.10 not found - create one: uv python install 3.10'
}
$uvCmd = Get-Command uv -ErrorAction SilentlyContinue
if ($uvCmd) { Check 'uv' $uvCmd.Source $true } else { Warn 'uv' 'not found (optional; any Python manager works)' }

# 5) Visual Studio (MSBuild C++)
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vs) { Check 'Visual Studio C++' $vs $true } else { Warn 'Visual Studio C++' 'VS2022 present but missing C++ workload' }
} else {
    Warn 'Visual Studio C++' 'vswhere missing - VS2022 with C++ required'
}

# 6) git + git-lfs
if (Get-Command git -ErrorAction SilentlyContinue) { Check 'git' (git --version) $true } else { Check 'git' 'missing' $false }
if (Get-Command git-lfs -ErrorAction SilentlyContinue) { Check 'git-lfs' (git lfs version) $true } else { Warn 'git-lfs' 'missing (required for SDK sample-data)' }

# 7) Free disk space
$drive = Get-PSDrive -Name (Get-Location).Drive.Name
if ($drive) {
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGB -ge 20) { Check 'Free space' "$freeGB GB (SDK+models ~10 GB)" $true }
    else { Warn 'Free space' "only $freeGB GB - SDK+models need ~10 GB" }
}

Write-Host ''
if ($exitCode -eq 1) {
    Write-Host 'RESULT: FAIL - critical components missing (see above).' -ForegroundColor Red
} elseif ($exitCode -eq 2) {
    Write-Host 'RESULT: WARN - address warnings before building the SDK.' -ForegroundColor Yellow
} else {
    Write-Host 'RESULT: OK - environment ready for 09-01 (SDK clone).' -ForegroundColor Green
}
exit $exitCode
