# Compila la APK de Togo (solo arm64, la de los telefonos actuales) y la deja en dist/.
#
#   powershell -ExecutionPolicy Bypass -File build-apk.ps1
#
# En Windows las rutas de node_modules pasan de 260 caracteres: se compila desde
# una unidad virtual corta (L:) que se quita al terminar. El proyecto no puede
# quedar en la raiz de la unidad (falla el autolinking de Expo), por eso L: es la
# carpeta padre (Togo) y se compila en L:\TOGO_MOVIL.

$ErrorActionPreference = 'Stop'
$movil = $PSScriptRoot
$padre = Split-Path $movil -Parent
$nombre = Split-Path $movil -Leaf
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }

$version = (Get-Content "$movil\src\data\equipo.ts" | Select-String "APP_VERSION = '(.+)'").Matches[0].Groups[1].Value -replace ' ', '-'

subst L: /d 2>$null | Out-Null
subst L: "$padre"
try {
  Set-Location "L:\$nombre"
  if (-not (Test-Path "L:\$nombre\android")) {
    npx expo prebuild --platform android --no-install
  }
  Set-Location "L:\$nombre\android"
  & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" "-Pkotlin.incremental=false" --console=plain -q
  if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion (codigo $LASTEXITCODE)" }
  New-Item -ItemType Directory -Force "$movil\dist" | Out-Null
  $destino = "$movil\dist\Togo-$version.apk"
  Copy-Item "L:\$nombre\android\app\build\outputs\apk\release\app-release.apk" $destino -Force
  Write-Host "APK lista: $destino"
}
finally {
  Set-Location $movil
  subst L: /d 2>$null | Out-Null
}
