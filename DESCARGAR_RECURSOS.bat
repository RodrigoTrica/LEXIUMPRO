@echo off
echo ================================================
echo  AppBogado - Descarga de recursos locales
echo ================================================
echo.

:: Crear carpetas necesarias
mkdir assets\fonts 2>nul
mkdir assets\fa\css 2>nul
mkdir assets\fa\webfonts 2>nul

echo [1/3] Descargando Font Awesome CSS...
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" -o "assets\fa\css\all.min.css"

echo [2/3] Descargando webfonts de Font Awesome...
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2" -o "assets\fa\webfonts\fa-solid-900.woff2"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.ttf" -o "assets\fa\webfonts\fa-solid-900.ttf"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2" -o "assets\fa\webfonts\fa-regular-400.woff2"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.ttf" -o "assets\fa\webfonts\fa-regular-400.ttf"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2" -o "assets\fa\webfonts\fa-brands-400.woff2"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.ttf" -o "assets\fa\webfonts\fa-brands-400.ttf"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-v4compatibility.woff2" -o "assets\fa\webfonts\fa-v4compatibility.woff2"
curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-v4compatibility.ttf" -o "assets\fa\webfonts\fa-v4compatibility.ttf"

echo [3/3] Descargando fuentes DM Sans y DM Mono...
curl -L "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4ET-DNl0.woff2" -o "assets\fonts\DMSans-Regular.woff2"
curl -L "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4Hj-D.woff2" -o "assets\fonts\DMSans-Medium.woff2"
curl -L "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4ET-D.woff2" -o "assets\fonts\DMSans-Bold.woff2"
curl -L "https://fonts.gstatic.com/s/dmmono/v14/aFTU7PB1QTsUX8KYvrumzBkL.woff2" -o "assets\fonts\DMMono-Regular.woff2"
curl -L "https://fonts.gstatic.com/s/dmmono/v14/aFTR7PB1QTsUX8KYth-orYataIf4.woff2" -o "assets\fonts\DMMono-Medium.woff2"

echo.
echo ================================================
echo  Listo! Recursos descargados en assets/
echo ================================================
pause
