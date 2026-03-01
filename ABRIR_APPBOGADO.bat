@echo off
chcp 65001 >nul 2>&1
title AppBogado
color 0A
cd /d "%~dp0"

:: Buscar Node/npx
where npx >nul 2>&1
if %errorlevel% neq 0 (
    for %%P in (
        "%ProgramFiles%\nodejs"
        "%ProgramFiles(x86)%\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
    ) do (
        if exist "%%~P\npx.cmd" (
            set "PATH=%PATH%;%%~P"
            goto :abrir
        )
    )
    echo  Node.js no encontrado. Ejecuta primero INSTALAR_Y_ABRIR.bat
    pause
    exit /b 1
)

:abrir
if not exist "node_modules\electron" (
    echo  Primera vez detectada - ejecutando instalador...
    call INSTALAR_Y_ABRIR.bat
    exit /b
)

npx electron .
