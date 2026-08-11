@echo off
cd /d "C:\Users\leido\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a745750a04e5bc65d92b6a3"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Starting server...
node server.js
pause
