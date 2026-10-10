@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-AICA-Demo.ps1"
if errorlevel 1 pause
