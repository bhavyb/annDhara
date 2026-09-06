@echo off
title AnnDhara Flask Backend
echo ===================================================
echo Starting AnnDhara Flask API on http://localhost:5000
echo ===================================================

cd /d "%~dp0backend"
python app.py
pause
