@echo off
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
set "PYTHONLEGACYWINDOWSSTDIO=0"
set "TERM=dumb"
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-utf8.ps1" %*
