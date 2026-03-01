# AppBogado v2.1 — Modo Escritorio (Electron)

## Qué es nuevo

- Almacenamiento cifrado en disco (AES-256-GCM) — carpeta datos/
- Documentos adjuntos respaldados en datos/documentos/
- Boton Guardar en topbar + Ctrl+S
- Sin dependencia del navegador — datos NO se pierden con el cache
- Los archivos .enc solo son legibles por AppBogado en el mismo equipo

## Instalacion

1. Instala Node.js desde https://nodejs.org (version LTS)
2. Doble clic en INSTALAR_Y_ABRIR.bat
3. Primera vez: descarga Electron (~100MB), espera unos minutos
4. La app se abre automaticamente

Para abrir en el futuro: doble clic en ABRIR_APPBOGADO.bat

## Estructura

datos/                    <- Tus datos (NO borrar)
  ├── *.enc               <- Datos cifrados
  └── documentos/*.enc    <- Archivos adjuntos cifrados

## Cifrado

- Algoritmo: AES-256-GCM
- Clave: secreto interno + nombre del equipo
- Los .enc son ilegibles fuera de la app o en otro PC
- Para migrar a otro equipo: usa Sistema > Backup > Exportar

