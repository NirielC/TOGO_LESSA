@echo off
rem Abre la pantalla de Togo a pantalla completa (sin internet).
rem Para salir: Alt+F4.
set "PAGINA=%~dp0index.html"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk "%PAGINA%" --edge-kiosk-type=fullscreen --no-first-run
  goto :eof
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk "%PAGINA%"
  goto :eof
)
rem Sin Edge ni Chrome: se abre normal; presiona F11 para pantalla completa.
start "" "%PAGINA%"
