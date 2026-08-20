@echo off
title Feria Manager
echo.
echo  =============================================
echo   🎪  FERIA MANAGER - Iniciando servidor...
echo  =============================================
echo.

cd /d "%~dp0"

:: Verificar que Node.js está instalado
where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Node.js no está instalado.
    echo  Descargalo desde: https://nodejs.org
    pause
    exit /b
)

:: Verificar que las dependencias están instaladas
if not exist "node_modules" (
    echo  Instalando dependencias por primera vez...
    npm install
    echo.
)

echo  ✅  Servidor iniciado correctamente.
echo.
echo  📌  Sitio público:  http://localhost:3000
echo  🔐  Panel admin:   http://localhost:3000/admin/
echo  🔑  Usuario: admin  /  Contraseña: admin123
echo.
echo  Dejá esta ventana abierta mientras usás la página.
echo  Para detener el servidor, cerrá esta ventana.
echo.

node server.js

echo.
echo  Servidor detenido.
pause
