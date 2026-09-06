@echo off
title AnnDhara Launcher
echo ===================================================
echo Launching AnnDhara Full-Stack Platform...
echo ===================================================

start "AnnDhara Backend API (Port 5000)" cmd /k "%~dp0run_backend.bat"
timeout /t 2 /nobreak >nul
start "AnnDhara Frontend (Port 5173)" cmd /k "%~dp0run_frontend.bat"

echo.
echo Both servers launched!
echo Open your browser at: http://localhost:5173
echo.
pause
