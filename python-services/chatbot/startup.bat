@echo off
echo Starting CoE AI Chatbot on port 8001...
cd /d "%~dp0"
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1
pause
