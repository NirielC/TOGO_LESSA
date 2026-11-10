# Compila la APK de Togo (solo arm64, la de los telefonos actuales) y la deja en dist/.
#
#   powershell -ExecutionPolicy Bypass -File build-apk.ps1
#
# En Windows el compilador de C++ (ninja) no acepta rutas de mas de 260 caracteres
# y las de node_modules las pasan. Por eso la app se copia a una carpeta real y
# corta (C:\L\TOGO_MOVIL) y se compila ahi. Una unidad virtual (subst) ya no
# sirve: Node resuelve la ruta real y Gradle termina mezclando L:\ y C:\.
# node_modules y android/ se conservan en C:\L entre compilaciones.

$ErrorActionPreference = 'Stop'
$movil = $PSScriptRoot
$corto = 'C:\L\TOGO_MOVIL'
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }

$version = (Get-Content "$movil\src\data\app.ts" | Select-String "APP_VERSION = '(.+)'").Matches[0].Groups[1].Value -replace ' ', '-'

# 1. Copiar el codigo (sin node_modules, android, dist ni .expo de la app, que no se tocan en el destino).
#    Con ruta completa: un nombre suelto en /XD excluiria tambien modules\togo-vision\android (Kotlin y modelos).
$excluir = 'node_modules', 'android', 'dist', '.expo' | ForEach-Object { Join-Path $movil $_ }
robocopy $movil $corto /MIR /XD @excluir "$movil\modules\togo-vision\android\build" /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Fallo la copia a $corto (robocopy $LASTEXITCODE)" }

Push-Location $corto
try {
  # 2. Dependencias: solo si cambiaron (se compara package-lock.json).
  $lock = (Get-FileHash "$corto\package-lock.json").Hash
  $marca = "$corto\node_modules\.togo-lock"
  if (-not (Test-Path $marca) -or (Get-Content $marca) -ne $lock) {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Fallo npm ci (codigo $LASTEXITCODE)" }
    Set-Content $marca $lock
  }

  # 3. Proyecto nativo (aplica app.json) y compilacion.
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw "Fallo expo prebuild (codigo $LASTEXITCODE)" }
  & "$corto\android\gradlew.bat" -p "$corto\android" assembleRelease `
    "-PreactNativeArchitectures=arm64-v8a" "-Pkotlin.incremental=false" `
    "-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m" --console=plain
  if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion (codigo $LASTEXITCODE)" }

  # 4. Dejar la APK en dist/ del proyecto.
  New-Item -ItemType Directory -Force "$movil\dist" | Out-Null
  $destino = "$movil\dist\Togo-$version.apk"
  Copy-Item "$corto\android\app\build\outputs\apk\release\app-release.apk" $destino -Force
  Write-Host "APK lista: $destino"
}
finally {
  Pop-Location
}
