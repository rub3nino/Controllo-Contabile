@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
start "WPS-API" cmd /c "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
cd ui
if not exist node_modules call npm install
echo.
echo Controllo contabile  http://127.0.0.1:5173
echo.
npm run dev
