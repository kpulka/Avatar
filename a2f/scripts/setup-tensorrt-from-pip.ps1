# setup-tensorrt-from-pip.ps1
# Buduje kompletny TENSORRT_ROOT_DIR bez logowania na NVIDIA:
#  - nagłówki: GitHub NVIDIA/TensorRT (release/10.13)
#  - DLL-e: pip wheel tensorrt-cu12-libs (publiczny indeks pypi.nvidia.com)
#  - import .lib: generowane z DLL (dumpbin + lib z MSVC)
# Wynik: $Root z include/ lib/ bin/ (gotowe dla FindTensorRT.cmake + run_sample.bat).
param(
  [string]$Root = "D:\TensorRT-10.13",
  [string]$PipLibs = "D:\tmp\opencode\trt_pip2",
  [string]$Ref = "release/10.13"
)

$ErrorActionPreference = "Stop"

$headers = @(
  'NvInfer.h','NvInferImpl.h','NvInferLegacyDims.h','NvInferPlugin.h','NvInferPluginBase.h',
  'NvInferPluginUtils.h','NvInferRuntime.h','NvInferRuntimeBase.h','NvInferRuntimeCommon.h',
  'NvInferRuntimePlugin.h','NvInferVersion.h','NvOnnxConfig.h'
)
$dlls = @('nvinfer_10.dll','nvinfer_plugin_10.dll','nvonnxparser_10.dll','nvinfer_builder_resource_10.dll')
$linkLibs = @('nvinfer_10','nvinfer_plugin_10','nvonnxparser_10')

New-Item -ItemType Directory -Force -Path "$Root\include","$Root\lib","$Root\bin" | Out-Null

Write-Host "[1/4] Naglowki z GitHub ($Ref)..." -ForegroundColor Cyan
foreach ($h in $headers) {
  $url = "https://raw.githubusercontent.com/NVIDIA/TensorRT/$Ref/include/$h"
  curl.exe -sL --fail -o "$Root\include\$h" $url
  if (-not (Test-Path "$Root\include\$h")) { throw "Nie pobrano $h" }
}

Write-Host "[2/4] DLL-e z pip wheel..." -ForegroundColor Cyan
foreach ($d in $dlls) {
  $src = Join-Path $PipLibs "tensorrt_libs\$d"
  if (-not (Test-Path $src)) { throw "Brak $src (uruchom najpierw uv pip install tensorrt-cu12-libs)" }
  Copy-Item $src "$Root\bin\$d" -Force
  Copy-Item $src "$Root\lib\$d" -Force
}

Write-Host "[3/4] Generowanie import libs (dumpbin + lib)..." -ForegroundColor Cyan
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw "Nie znaleziono Visual Studio z C++ tools" }
$vcTools = Get-ChildItem "$vsPath\VC\Tools\MSVC" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$dumpbin = Join-Path $vcTools.FullName "bin\Hostx64\x64\dumpbin.exe"
$libexe  = Join-Path $vcTools.FullName "bin\Hostx64\x64\lib.exe"

foreach ($name in $linkLibs) {
  $dll = "$Root\lib\$name.dll"
  & $dumpbin /nologo /exports $dll > "$Root\lib\$name.exports.txt"
  $lines = Get-Content "$Root\lib\$name.exports.txt"
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    $t = ($line.Trim() -split '\s+')
    if ($t.Count -ge 4 -and $t[0] -match '^\d+$' -and $t[1] -match '^[0-9A-Fa-f]+$' -and $t[2] -match '^[0-9A-Fa-f]+$') {
      $names.Add($t[3]) | Out-Null
    }
  }
  if ($names.Count -eq 0) { throw "Brak eksportow w $name.dll" }
  $def = "LIBRARY $name`nEXPORTS`n" + (($names | Sort-Object -Unique) -join "`n") + "`n"
  Set-Content -Path "$Root\lib\$name.def" -Value $def -Encoding ASCII
  & $libexe /nologo /def:"$Root\lib\$name.def" /machine:x64 /out:"$Root\lib\$name.lib" | Out-Null
  Write-Host ("  {0}: {1} eksportow -> {0}.lib" -f $name, $names.Count)
}

Write-Host "[4/4] Weryfikacja..." -ForegroundColor Cyan
$ok = Test-Path "$Root\include\NvInfer.h"
foreach ($name in $linkLibs) { $ok = $ok -and (Test-Path "$Root\lib\$name.lib") -and (Test-Path "$Root\lib\$name.dll") }
if (-not $ok) { throw "Brakuje plikow w $Root" }

[Environment]::SetEnvironmentVariable('TENSORRT_ROOT_DIR', $Root, 'User')
Write-Host "OK: TENSORRT_ROOT_DIR=$Root (user env). include/: $( (Get-ChildItem "$Root\include").Count ) plikow, lib/: $( (Get-ChildItem "$Root\lib" -Filter *.lib).Count ) lib." -ForegroundColor Green