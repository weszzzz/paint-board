@echo off
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Please install Python first
    pause
    exit
)

python start.py
pause 