# Mapa de Arquitectura (UI vs Core) — LEXIUM / AppBogado (Pro)

> Objetivo: documentar cómo está estructurada la app hoy (Electron + HTML + JS), qué archivos corresponden a UI vs Core/negocio, y cuáles son los puntos de entrada y dependencias.

## 0) Resumen ejecutivo

- **Tipo de app**: Electron Desktop.
- **UI**: `index.html` + `css/*.css` + renderizadores en `js/*.js`.
- **Core (datos/negocio)**: Store/DB en `js/01-db-auth.js` + lógica de casos/documentos/alertas en varios módulos JS.
- **Seguridad**: `main.js` aplica `contextIsolation`, `sandbox`, `nodeIntegration:false`, y expone IPCs validados y cifrados.
- **Persistencia**:
  - Renderer: `DiskStorage` (vía `electronAPI.storage`) o `localStorage` como fallback.
  - Main: archivos `.enc` cifrados en `userData/datos/`.
- **Documentos**: cifrados en disco vía IPC (`docs:guardar`, `docs:leer`) y referenciados por `archivoDocId`.

---

## 1) Tree (alto nivel)

- `main.js`
  - Electron main process.
  - IPC handlers (storage/docs/pdf/whatsapp/etc.).
  - Crypto AES-256-GCM y filesystem.

- `preload.js`
  - `contextBridge.exposeInMainWorld('electronAPI', ...)`.
  - Validación de tipos antes de llamar IPC.

- `index.html`
  - Estructura completa de UI (tabs/containers/partials).

- `js/`
  - Módulos del renderer: render, features, core de DB, IA, dashboard, documentos, etc.

- `css/`
  - `styles.css`: estilos globales + tokens + componentes.
  - `rediseno.css`, `fixes.css`: ajustes/overrides.

- `assets/`
  - Recursos (íconos, etc.).

---

## 2) Configuración y dependencias

### package.json

- **Framework**: Electron.
- **Build**: `electron-builder`.
- **Dependencias destacadas**:
  - `pdf-parse`: extracción de texto de PDFs.
  - `whatsapp-web.js`: integración WhatsApp.
  - `node-cron`: scheduler.
  - `qrcode`: QR (WhatsApp login / etc.).

---

## 3) Mapa UI vs Core por archivo (tabla)

> Convención de “Capa”:
>
>- **Main**: proceso principal Electron (FS/IPC/crypto/CSP).
>- **Bridge**: preload/contextBridge (`window.electronAPI`).
>- **Core**: esquema DB/Store, migraciones, lógica de negocio.
>- **UI**: renderizadores DOM/UX, wiring de eventos.
>- **IA**: proveedores, prompts, panel IA, extracción contexto.

| Archivo | Capa | Responsabilidad | Depende de | Notas / Riesgos |
|---|---|---|---|---|
| `main.js` | Main | Seguridad Electron + IPC + cifrado + FS + CSP | `electron`, `fs`, `crypto` | Autoridad de seguridad y de persistencia cifrada |
| `preload.js` | Bridge | API segura al renderer (`electronAPI.*`) | `ipcRenderer` | No exponer `ipcRenderer` completo |
| `index.html` | UI | Layout global, tabs, contenedores | CSS + JS | Muy grande: separar por vistas sería deseable |
| `css/styles.css` | UI | Estilos globales + tokens + componentes | — | Tokens ya preparados para dark mode |
| `css/rediseno.css` | UI | Ajustes de rediseño/contraste | — | Evitar duplicar reglas con `styles.css` |
| `css/fixes.css` | UI | Fixes puntuales/modales | — | Riesgo de overrides inesperados |
| `js/00-disk-storage.js` | Core | Adaptador DiskStorage (Electron vs localStorage) | `electronAPI.storage` | Clave para performance y consistencia |
| `js/00b-config.js` | Core | Configuración central (AppConfig) | Store/DB | Punto único recomendado para settings |
| `js/00-eventbus.js` | UI/Core | EventBus pub/sub | DOM | Útil para desacoplar renders |
| `js/01-db-auth.js` | Core | **Store/DB canónico**, migraciones, persistencia, normalización | DiskStorage/localStorage | Archivo crítico: “fuente de verdad” de DB |
| `js/02-render-crud.js` | UI | Render principal CRUD (causas/clientes/alertas/juris) | `DB`, helpers | Mezcla UI+algo de lógica; candidato a separar |
| `js/03-causa-detail.js` | UI | Detalle de causa + tabs internas + acciones | `DB`, docs | Alto acoplamiento a DOM |
| `js/04-features.js` | UI/Core | Features varias (legacy) | `DB` | Mezclado: conviene modularizar por dominio |
| `js/05-business-engine.js` | Core | Motor/derivaciones (eventos, etc.) | `DB` | Parte “negocio”; clarificar límites |
| `js/06-calculators-strategy.js` | Core/UI | Cálculos + widgets (semaforos, salud, etc.) | `DB` | Lógica + render: separar cálculos de HTML |
| `js/07-analytics-export.js` | Core/UI | Export/analytics/backups UI | `DB`, storage | Validar permisos/paths en main |
| `js/08-dashboard.js` | UI | Dashboard panel (donuts, barras) | `DB` | Render puro, candidato a “UI layer” |
| `js/09-app-core.js` | UI/Core | Orquestación `renderAll()`, init, wiring | muchos módulos | Entry del renderer (junto a `main-init.js`) |
| `js/main-init.js` | UI/Core | Boot del renderer | `renderAll` | Asegurar orden de carga |
| `js/10-ia-escritos.js` | IA | IA aplicada a escritos | IA providers + DB | Depende de prompt/inputs |
| `js/11a-escritos-data.js` | Core | Datos de escritos/plantillas | `DB` | Separación data vs UI ya existe parcialmente |
| `js/11b-escritos-ui.js` | UI | UI escritos (historial, plantillas) | data.js | Buen patrón: replicable en otros módulos |
| `js/12-ia-providers.js` | IA/Core | Proveedores IA, helpers extracción, análisis docs | `electronAPI.pdf` + `docs` | Punto central de IA “seria” |
| `js/14-features-v8.js` | UI/IA | LexBot legacy hooks/contexto | `clToggleChat` | Puede duplicar con 17 si no se controla |
| `js/15-tramites-admin.js` | UI/Core | Gestión de trámites | `DB` | Dominio aparte: separar servicios |
| `js/16-doctrina.js` / `16b-doctrina-pdf.js` | UI/IA | Doctrina + PDF ingestion | `pdf` IPC | Alto consumo: cuidado con tamaños |
| `js/17-claude-legal.js` | IA/UI | Panel Bot AI + IA Web iframe + toolbars | `IA_PROVIDERS`, `DB` | UI flotante global; evitar solapes |
| `js/18-google-drive.js` | Core | Integración Drive (si aplica) | API | Revisar credenciales / scopes |
| `js/19-renderbus-wiring.js` | UI | Wiring de eventos/render | EventBus | Punto de cohesión de UI |
| `js/20-backup-disco.js` | Core | Backup a disco | `electronAPI.backup` | Debe validar en main |
| `js/21-doc-fisico.js` | Core/UI | Documentos físicos / manejo archivo | `docs` IPC | Asegurar no duplicar storage |
| `js/22-whatsapp-panel-v2.js` | UI | Panel WhatsApp | `electronAPI.whatsapp` | Seguridad depende del main |
| `js/23-causas-pro-docs.js` | UI/Core | Causas Pro: documentos, origen, dashboard pro | `DB`, `electronAPI.docs` | Dominio documentos “pro” |
| `js/23-prospectos-crm.js` / `23-propuestas-crm.js` | UI/Core | CRM prospectos/propuestas | `DB`, IPC PDF | Revisar consistencia con módulo clientes |
| `js/24-honorarios-view.js` | UI | Vista honorarios | `DB` | Buen uso de empty-state |

---

## 4) Puntos de entrada (“entrypoints”) y flujo de ejecución

### 4.1 Electron
1. `npm start` → Electron carga `main.js`.
2. `main.js` crea `BrowserWindow` con políticas de seguridad y carga `index.html`.
3. `preload.js` se inyecta y expone `window.electronAPI`.

### 4.2 Renderer
1. `index.html` carga scripts en orden.
2. `js/01-db-auth.js` hidrata el Store/DB (DiskStorage/localStorage) y ejecuta migraciones.
3. `js/09-app-core.js` / `main-init.js` disparan `renderAll()` y wiring.

---

## 5) Persistencia y seguridad (resumen técnico)

### 5.1 Storage cifrado (DB)
- Renderer llama `electronAPI.storage.get/set/getSync`.
- Main implementa `storage:*`.
- Persistencia real: archivos `.enc` cifrados en `userData/datos/`.

### 5.2 Documentos cifrados
- Renderer: guarda/lee por `electronAPI.docs.guardar/leer`.
- Main: `docs:guardar` escribe un `.enc` con JSON `{nombre, mimeType, data(base64)}` cifrado.
- DB guarda metadatos y un `archivoDocId` como referencia.

### 5.3 Controles principales
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Validación en `preload.js` + validación en `main.js` (defensa en profundidad).
- Mitigación path traversal al leer/eliminar docs.

---

## 6) Recomendación de refactor (siguiente paso)

Si el objetivo es separar definitivamente “negocio” de “UI” sin romper la app:

1. **Crear un "Core" por dominios** (sin mover todo de golpe):
   - `core/store` (DB, persistencia)
   - `core/docs` (CRUD docs + helpers)
   - `core/alertas` (generación/limpieza)
   - `core/causas` (mutaciones y reglas)

2. **Dejar `render*.js` como UI pura**
   - Que solo reciba datos listos y renderice.

3. **Unificar accesos**
   - Todo mutador de `DB` pasa por funciones del core.

---

## 7) Apéndice: archivos clave para auditoría rápida

- Seguridad/IPC: `main.js`, `preload.js`
- Store/DB: `js/01-db-auth.js`, `js/00-disk-storage.js`
- Docs: `main.js (docs:*)`, `js/23-causas-pro-docs.js`, `js/03-causa-detail.js`
- IA: `js/12-ia-providers.js`, `js/17-claude-legal.js`
- Orquestación render: `js/09-app-core.js`, `js/main-init.js`
