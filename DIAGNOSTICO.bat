@echo off
chcp 65001 >nul 2>&1
title AppBogado — Diagnostico
color 0E

echo.
echo  =====================================================
echo   AppBogado — Diagnostico del sistema
echo  =====================================================
echo.

echo  [1] Versiones instaladas:
echo  --------------------------
node --version 2>nul && echo     Node.js: OK || echo     Node.js: NO ENCONTRADO
npm --version 2>nul && echo     npm: OK || echo     npm: NO ENCONTRADO
npx --version 2>nul && echo     npx: OK || echo     npx: NO ENCONTRADO
echo.

echo  [2] Carpeta de la app:
echo  -----------------------
echo  %~dp0
echo.

echo  [3] Archivos clave:
echo  --------------------
if exist "%~dp0package.json"  (echo    OK - package.json)   else (echo    FALTA - package.json)
if exist "%~dp0main.js"       (echo    OK - main.js)        else (echo    FALTA - main.js)
if exist "%~dp0preload.js"    (echo    OK - preload.js)     else (echo    FALTA - preload.js)
if exist "%~dp0index.html"    (echo    OK - index.html)     else (echo    FALTA - index.html)
echo.

echo  [4] Electron instalado:
echo  ------------------------
if exist "%~dp0node_modules\electron" (
    echo    OK - Electron encontrado en node_modules
) else (
    echo    NO - Electron NO instalado. Ejecuta INSTALAR_Y_ABRIR.bat
)
echo.

echo  [5] Carpeta de datos:
echo  ----------------------
if exist "%~dp0datos\" (
    echo    OK - Carpeta datos existe
    dir /b "%~dp0datos\*.enc" 2>nul && echo    (archivos cifrados encontrados) || echo    (aun no hay datos guardados)
) else (
    echo    INFO - Carpeta datos se creara al abrir la app
)
echo.

echo  [6] PATH de Node.js:
echo  ---------------------
where node 2>nul || echo    Node.js no esta en el PATH del sistema
echo.

echo  =====================================================
echo  Copia este texto y envialo si necesitas soporte.
echo  =====================================================
echo.
pause
