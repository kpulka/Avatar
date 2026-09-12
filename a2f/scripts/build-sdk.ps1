# build-sdk.ps1 - build Audio2X SDK on Windows without admin:
#  - forces CUDA 12.9 (CUDAToolkit_ROOT) despite VS 2026,
#  - adds -allow-unsupported-compiler (VS18/195x outside CUDA 12.9 support),
#  - uses CMake/Ninja from _deps (after fetch_deps) and vcvarsall from VS.
param(
  [string]$Config = "release",
  [switch]$Clean,
  [string]$Cuda = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9",
  [string]$TensorRt = "D:\TensorRT-10.13"
)
$ErrorActionPreference = "Stop"
$sdk = "D:\Projects\Avatar\a2f\sdk"

if (-not (Test-Path $Cuda)) { throw "Missing CUDA dir: $Cuda" }
if (-not (Test-Path "$TensorRt\include\NvInfer.h")) { throw "Missing TensorRT: $TensorRt (run setup-tensorrt-from-pip.ps1)" }

$env:CUDA_PATH = $Cuda
$env:CUDA_HOME = $Cuda
$env:CUDAToolkit_ROOT = $Cuda
$env:TENSORRT_ROOT_DIR = $TensorRt
$env:NVCC_PREPEND_FLAGS = "-allow-unsupported-compiler"

$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.Component.MSBuild -property installationPath
if (-not $vs) { throw "Visual Studio (MSBuild) not found" }

$ninja = "$sdk\_deps\build-deps\ninja"
$cmake = "$sdk\_deps\build-deps\cmake\bin\cmake.exe"
if (-not (Test-Path $cmake)) { throw "CMake missing in _deps - run fetch_deps.bat first" }
$env:PATH = "$env:PATH;$ninja"

$buildDir = "$sdk\_build\$Config"
if ($Clean -and (Test-Path "$sdk\_build")) { Remove-Item -Recurse -Force "$sdk\_build" }

$cmakeArgs = "-B `"$buildDir`" -G Ninja -S `"$sdk`" -DCMAKE_BUILD_TYPE=$Config -DCMAKE_CUDA_FLAGS=-allow-unsupported-compiler"
$cmd = "call `"$vs\VC\Auxiliary\Build\vcvarsall.bat`" x64 && `"$cmake`" $cmakeArgs && `"$cmake`" --build `"$buildDir`" --target all --config $Config --parallel"
Write-Host "Configure+Build: $cmakeArgs" -ForegroundColor Cyan
cmd /c $cmd
exit $LASTEXITCODE