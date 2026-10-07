@echo off
rem Abre RbxUI Studio (editor visual de UIs de Roblox) en el navegador.
cd /d "%~dp0"
start "" http://localhost:5170/
node studio\server.mjs
