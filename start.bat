@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
set QUADRA_DEV=1
start "WPS-API" cmd /c "python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"
cd ui
if not exist node_modules call npm install
echo.
echo UI aggiornata   http://127.0.0.1:5173/
echo API / OpenAPI   http://127.0.0.1:8000/docs
echo Non aprire http://127.0.0.1:8000/ per l'interfaccia.
echo.
npm run dev
