# Fase 4 — Auditoría y Hardening Enterprise (Diagnóstico + Diseño de Trazabilidad Total)

Este documento responde al prompt de **Fase 4**: auditoría de arquitectura + diseño de un sistema de auditoría (logging) y propuesta de un módulo de reportes.

> Código observado (referencia):
>
>- Electron main: `main.js`
>- Bridge: `preload.js`
>- Store/DB: `js/01-db-auth.js`
>- EventBus/RenderBus: `js/00-eventbus.js`, `js/19-renderbus-wiring.js`
>- Bitácora actual: `js/05-business-engine.js` (`registrarEvento` → `DB.bitacora`)

---

## PARTE 1 — Auditoría de Arquitectura (Diagnóstico)

### 1) Estructura: ¿patrón MVC/MVVM o plana? ¿Escalable?

**Situación actual:**

- La estructura es **mayormente plana** y orientada a “módulos sueltos” por archivo (`js/*.js`).
- No hay un patrón MVC/MVVM formal.
- Se observa una evolución hacia algo más escalable con:
  - `EventBus` (pub/sub) y `RenderBus` (render selectivo por namespaces).
  - `DiskStorage` como capa de persistencia.

**Diagnóstico:**

- **Escalable a mediano plazo** si se refuerza el patrón `Core (servicios)` + `UI (renderers)`.
- Riesgo actual: muchos módulos mezclan **mutación de DB + render + side-effects** (WhatsApp, documentos, IA, exportaciones) dentro de las mismas funciones.

**Recomendación mínima (sin refactor masivo):**

- Consolidar un “Core por dominios” (sin mover archivos todavía):
  - `CoreCausas` (crear/editar/archivar)
  - `CoreDocs` (subir/leer/eliminar)
  - `CoreHonorarios` (pagos/cuotas)
  - `CoreAlertas` (crear/archivar)
- Cada Core emite eventos a `EventBus` (una única línea), y los renderers se suscriben.

---

### 2) Estado: ¿cómo fluyen los datos? ¿centralizado o disperso?

**Lo bueno (centralizado):**

- Existe un esquema canónico en `js/01-db-auth.js` que normaliza:
  - `DB.causas`, `DB.clientes`, `DB.documentos`, `DB.alertas`, `DB.intentosLogin`, `DB.bitacora`, etc.
- `DiskStorage` se usa como sustituto de `localStorage` (con cache y persistencia cifrada vía IPC).

**Lo riesgoso (dispersión):**

- La app usa **variables globales** (`DB`, `AppConfig`, `EventBus`, `RenderBus`, múltiples `render*`, `save`, `guardarDB`).
- Hay mutaciones de `DB` en múltiples archivos.
- Existe bitácora “humana” `DB.bitacora` con strings (`registrarEvento(descripcion)`), pero no hay trazabilidad estructurada (no hay actor/acción/referencia consistente).

**Conclusión:**

- Estado **semi-centralizado**: el *contenedor* del estado está centralizado (DB), pero los *puntos de escritura* están dispersos.
- Esto dificulta auditoría total y DRY.

---

### 3) Top 3 riesgos de seguridad actuales (prioridad)

> Nota: varias mejoras ya están implementadas en `main.js` (`sandbox`, `contextIsolation`, cifrado AES-GCM, validación IPC). Aun así, estos son los mayores riesgos restantes.

#### Riesgo 1 — XSS / Inyección por uso extensivo de `innerHTML`

- Gran parte de la UI se genera con template strings → `el.innerHTML = ...`.
- Aunque existe `escHtml()` en varios lugares, no es universal.

**Impacto:**

- Si un campo (carátula, descripción, nombres de archivo, etc.) entra sin sanitización, puede ejecutar JS en renderer.
- En Electron esto es especialmente sensible.

**Mitigación recomendada:**

- Asegurar `escHtml()` en todo campo de usuario.
- Para hardening enterprise: migrar progresivamente a `textContent` + DOM APIs o sanitizador estricto.

#### Riesgo 2 — Manejo de API Keys en renderer (aunque cifradas)

- `js/12-ia-providers.js` cifra keys con WebCrypto y las guarda vía `AppConfig`/storage.
- Esto mejora privacidad, pero **sigue en renderer** (DevTools podría leer memoria/DOM).

**Mitigación recomendada (enterprise):**

- Opción A: mover custodia de keys a **main process** (IPC: `keys:set/get`, almacenamiento cifrado en `userData`).
- Opción B: al menos separar el “vault” en un storage aislado y evitar exportarlo en backups.

#### Riesgo 3 — Datos sensibles en logs/bitácora + ausencia de política de retención

- `DB.bitacora` almacena strings; algunos eventos podrían incluir IDs, rutas, nombres de documentos, etc.
- No hay “PII redaction” ni “retention policy” fuerte (solo límite 500 entradas para bitácora).

**Mitigación recomendada:**

- Introducir `DB.logs` estructurado con:
  - redacción selectiva de `detalles`
  - retención por tamaño/fecha
  - exportaciones auditables

---

## PARTE 2 — Diseño del Sistema de Auditoría (Logging)

### Objetivo

- Trazabilidad total **(quién / qué / cuándo / sobre qué / resultado)**.
- DRY: evitar `registrarEvento()` manual en cada función.
- Reutilizar infra actual: `EventBus` y el concepto de namespaces.

---

### 1) Esquema propuesto: `DB.logs`

Agregar una colección nueva:

```js
DB.logs = [
  {
    id: 'log_...',
    ts: 1700000000000,              // Date.now()
    fechaISO: '2026-03-03T01:02:03.456Z',

    // Actor
    usuario: DB.usuarioActual || null,
    rol: DB.rolActual || null,
    sesionId: DB.sesionId || null,  // generar al login

    // Acción
    accion: 'DELETE_CAUSA',         // enum estable
    entidad: 'causa'|'documento'|'alerta'|'honorario'|'whatsapp'|'auth'|'sistema',
    referenciaId: 'causaId/docId/etc',

    // Detalles
    detalles: { ... },              // JSON (sin PII si no hace falta)

    // Resultado
    ok: true,
    error: null,

    // Contexto técnico
    origen: 'ui'|'auto'|'ipc'|'cron',
    versionApp: '2.2.0'
  }
]
```

**Reglas:**

- Retención: p.ej. **10.000 logs o 180 días**, lo que ocurra primero.
- Redacción: campos sensibles (RUT, API keys, base64) **no se loguean**.

---

### 2) Eventos a capturar (mínimo viable)

#### Auth
- `LOGIN_OK`, `LOGIN_FAIL`, `LOGOUT`

#### Causas
- `CREATE_CAUSA`, `UPDATE_CAUSA`, `ARCHIVE_CAUSA`/`DELETE_CAUSA`

#### Documentos
- `UPLOAD_DOCUMENTO`, `DELETE_DOCUMENTO`, `READ_DOCUMENTO` *(opcional por volumen)*

#### Alertas
- `CREATE_ALERTA`, `ARCHIVE_ALERTA`

#### Honorarios
- `ADD_PAGO`, `DELETE_PAGO`, `ADD_CUOTA`, `MARK_CUOTA_PAGADA`, etc.

#### WhatsApp
- `WHATSAPP_CONNECT`, `WHATSAPP_SEND_ALERT`, `WHATSAPP_SEND_RESUMEN`, `WHATSAPP_ERROR`

#### Sistema
- `BACKUP_EXPORT`, `BACKUP_IMPORT`, `CONFIG_CHANGE`, `THEME_CHANGE`

---

### 3) Implementación DRY: patrón Middleware/Interceptor

Hay dos vías complementarias, y pueden coexistir.

#### Opción A (Recomendada): Interceptor de `EventBus.emit`

Como ya existe `EventBus.emit(event, payload)`, podemos parchearlo **una sola vez**:

- `Audit.install()` reemplaza `EventBus.emit` por un wrapper:
  1. Normaliza (eventName → accion/entidad)
  2. Escribe a `DB.logs` (via `Audit.log()`)
  3. Llama al emit original

**Ventajas:**

- DRY total: log automático cuando los módulos emiten eventos.
- Se integra con el camino de refactor ya existente (de `renderAll()` a eventos por namespace).

**Requisito:**

- Establecer convención de eventos:
  - `causas:created`, `causas:updated`, `causas:deleted`
  - `docs:uploaded`, `docs:deleted`
  - etc.

#### Opción B: Envolver mutadores “core” (services) y loguear ahí

- Crear funciones canónicas para mutaciones:
  - `CausasService.create()`, `CausasService.archive()`
  - `DocsService.upload()`
- En cada service:
  - `Audit.log({accion,...})` + `EventBus.emit('causas:updated')`

**Ventaja:**

- Asegura logging incluso si alguien olvida emitir EventBus.

---

### 4) Reusar lo existente: `DB.bitacora` vs `DB.logs`

- `DB.bitacora` hoy sirve como *bitácora humana* (texto corto, UI rápida).
- `DB.logs` será *auditoría enterprise estructurada*.

**Plan:**

- Mantener `DB.bitacora` para UX.
- Hacer que `registrarEvento(descripcion)` también agregue un log estructurado tipo `accion: 'BITACORA'`.

---

## PARTE 3 — Módulo de Reportes y Auditoría

### 1) Nueva sección: “Reportes y Auditoría”

**UI propuesta (tab):**

- Sidebar: nuevo item `Reportes` (o dentro de `Sistema`).
- Subtabs:
  - `Auditoría` (logs)
  - `Actividad` (KPIs de actividad por usuario/acción)
  - `Exportaciones` (CSV/JSON con filtros)

### 2) Pantalla Auditoría (MVP)

- Filtros:
  - Rango de fechas (desde/hasta)
  - Usuario
  - Acción (select)
  - Entidad
  - Texto libre (buscar en `detalles` o `referenciaId`)
- Tabla:
  - Fecha/hora
  - Usuario/rol
  - Acción
  - Entidad + referencia
  - Resultado (ok/error)
  - Botón “Ver detalle” (modal JSON pretty)

### 3) Exportación

- Exportar filtros a:
  - CSV (para auditoría externa)
  - JSON (backup de logs)

### 4) Retención y performance UI

- Paginación (no renderizar 10.000 en DOM).
- “Top 500 recientes” por defecto + filtros para acotar.

---

## Plan de implementación (incremental y seguro)

### Milestone 1 — Esquema y almacenamiento
- Agregar `DB.logs` en migración (`01-db-auth.js`).
- Agregar `Audit.log()` + `Audit.redact()`.
- Límite/retención.

### Milestone 2 — Interceptor EventBus
- Implementar `Audit.installEventBusInterceptor()`.
- Definir mapa `eventName → accion/entidad`.

### Milestone 3 — Emisión de eventos canónicos
- Reemplazar gradualmente `save(); renderAll();` por `saveAndEmit('causas:updated', {...})`.
- Asegurar que las operaciones críticas emitan:
  - causas, docs, honorarios, alertas, whatsapp.

### Milestone 4 — UI Reportes
- Nuevo tab + filtros + tabla + modal.
- Exportaciones.

---

## Resultado esperado

Con este diseño, la app obtiene:

- Auditoría total y estructurada (`DB.logs`).
- DRY: logging automático vía `EventBus` interceptor.
- Módulo de reportes para inspección y exportación.

