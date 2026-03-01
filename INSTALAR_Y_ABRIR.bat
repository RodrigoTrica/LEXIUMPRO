@echo off
chcp 65001 >nul 2>&1
title AppBogado — Instalador
color 0A

echo.
echo  =====================================================
echo   AppBogado v2.1 - Instalador Electron
echo  =====================================================
echo.

:: Buscar Node.js en rutas comunes de Windows si no esta en PATH
set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node" || (
    for %%P in (
        "%ProgramFiles%\nodejs\node.exe"
        "%ProgramFiles(x86)%\nodejs\node.exe"
        "%APPDATA%\nvm\current\node.exe"
        "%LOCALAPPDATA%\Programs\nodejs\node.exe"
    ) do (
        if exist %%P (
            set "NODE_EXE=%%~P"
            set "PATH=%PATH%;%%~dpP"
            goto :node_found
        )
    )
    goto :no_node
)
:node_found

echo  OK: Node.js encontrado
%NODE_EXE% --version
echo.

:: Ir a la carpeta de la app
cd /d "%~dp0"
echo  Carpeta: %~dp0
echo.

:: Instalar dependencias
echo  Instalando Electron (primera vez puede tardar 3-5 min)...
echo  NO cierres esta ventana.
echo.

call npm install 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR al instalar dependencias.
    echo  Codigo de error: %errorlevel%
    echo.
    echo  Posibles causas:
    echo    - Sin conexion a internet
    echo    - Antivirus bloqueando npm
    echo    - Falta de permisos en la carpeta
    echo.
    goto :fin_error
)

echo.
echo  OK: Dependencias instaladas
echo.

:: Crear acceso directo en escritorio
set "SHORTCUT=%USERPROFILE%\Desktop\AppBogado.bat"
if not exist "%SHORTCUT%" (
    (
        echo @echo off
        echo cd /d "%~dp0"
        echo npx electron .
        echo pause
    ) > "%SHORTCUT%"
    echo  OK: Acceso directo creado en el Escritorio
)

echo.
echo  =====================================================
echo   Iniciando AppBogado...
echo  =====================================================
echo.

npx electron .
goto :fin_ok

:no_node
echo.
echo  ERROR: Node.js no encontrado en este equipo.
echo.
echo  Por favor:
echo  1. Abre el navegador
echo  2. Ve a: https://nodejs.org
echo  3. Descarga e instala la version LTS
echo  4. REINICIA el computador
echo  5. Vuelve a ejecutar este archivo
echo.
goto :fin_error

:fin_error
echo.
echo  Presiona cualquier tecla para cerrar...
pause >nul
exit /b 1

:fin_ok
echo.
echo  App cerrada. Presiona cualquier tecla para salir.
pause >nul
exit /b 0
