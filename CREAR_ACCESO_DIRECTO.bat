@echo off
SET "DIR=%~dp0"
SET "BAT=%DIR%ABRIR_APPBOGADO.bat"
SET "SHORTCUT=%USERPROFILE%\Desktop\AppBogado.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%BAT%'; $s.WorkingDirectory = '%DIR%'; $s.Description = 'AppBogado'; $s.IconLocation = 'shell32.dll,23'; $s.Save()"

IF EXIST "%SHORTCUT%" (
    echo Acceso directo creado en el escritorio.
) ELSE (
    echo No se pudo crear. Crea el acceso directo manualmente a:
    echo %BAT%
)
pause
