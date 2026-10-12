@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
set "ROOT=%~dp0"
cd /d "%ROOT%"

if exist "%ROOT%releases\win-unpacked\OpenGrokBot Studio.exe" (
    start "" "%ROOT%releases\win-unpacked\OpenGrokBot Studio.exe"
) else (
    node "%ROOT%desktop\launch.cjs"
)
exit /b 0

