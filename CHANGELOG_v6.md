# AppBogado v6 — Changelog del Refactor

## Resumen de cambios

### 1. Separación 11-escritos-db → 11a + 11b

El módulo monolítico `11-escritos-db.js` (756 líneas) que mezclaba acceso a datos y renderizado fue dividido en dos capas con responsabilidades claras:

#### `11a-escritos-data.js` — Capa de datos (pura)
- **Sin DOM, sin `innerHTML`, sin `document.getElementById`.**
- Toda función que muta o consulta `DB.historialEscritos` / `DB.plantillasEscritos`.
- Funciones renombradas con sufijo `Data` para marcar su naturaleza:
  - `historialEliminarEscritoData(id)`
  - `historialToggleFavoritoData(id)`
  - `historialObtenerEscrito(id)`
  - `historialFiltrarData(filtro)` ← antes mezclada con render
  - `historialRestaurarVersionData(escritoId, numVersion)`
  - `plantillaCrearData(datos)`
  - `plantillaActualizarData(id, datos)`
  - `plantillaEliminarData(id)`
  - `plantillaObtenerData(id)`
  - `plantillaRegistrarUsoData(id)`
  - `detectarOrigenEscrito()` ← lee DOM sólo para detección, no escribe
- `aplicarVariablesDinamicas(texto, causa)` — función pura (sin efectos).
- `historialGuardarVersion(escritoId, texto, nota)` — datos puros.

**En Fase 2:** reemplazar cada función con su equivalente REST (`GET /api/escritos/...`, `POST`, `DELETE`) sin tocar `11b-escritos-ui.js`.

#### `11b-escritos-ui.js` — Capa de vista (pura)
- **Sin acceso directo a `DB` excepto lecturas de colección** (`DB.historialEscritos.length`, `DB.causas.find`).
- Todo `innerHTML`, `document.getElementById`, `abrirModal`, `cerrarModal`.
- Funciones de render: `historialRenderEscritos()`, `plantillasRender()`.
- Orquestadores UI↔datos: `historialEliminarEscrito()`, `historialToggleFavorito()`, `historialCargarEscrito()`, `uiGuardarEscrito()`, `uiAplicarVariables()`, `plantillaGuardar()`, etc.
- Estado de filtros (`_hFiltro`) y estado de edición (`_plantillaEditing`) en este módulo.

---

### 2. Código muerto eliminado

| Archivo | Línea original | Elemento eliminado |
|---|---|---|
| `01-db-auth.js` | 865 | `function renderAll_PLACEHOLDER_REMOVED() { /* eliminada */ }` |

El comentario que lo precedía (`// renderAll() consolidada al final del script`) se mantuvo, simplificado.

---

### 3. JSDoc añadido — 30 funciones críticas

#### `01-db-auth.js`
- `Store` (namespace completo con guía de Fase 2)
- `save()` / `guardarDB()`
- `_hash(pw)`
- `auth()`
- `logout()`

#### `05-business-engine.js`
- `uid()`
- `crearCausa(data)`
- `marcarEtapa(causaId, index)`
- `crearAlerta(data)`
- `guardarEscritoComoDocumento(causaId, texto, tipoEscrito)`

#### `08-dashboard.js`
- `renderDashboardPanel()`

#### `09-app-core.js`
- `tab(id, btn)`
- `renderAll()`
- `showConfirm(titulo, mensaje, onOk, type)`

#### `10-ia-escritos.js`
- `showError(msg)`
- `showSuccess(msg)`
- `showInfo(msg)`
- `escActualizarEstadoBotones(habilitado)`

#### `11a-escritos-data.js` (nuevo — documentado completo)
- `historialGuardarEscrito(params)`
- `historialEliminarEscritoData(id)`
- `historialToggleFavoritoData(id)`
- `historialFiltrarData(filtro)`
- `historialGuardarVersion(escritoId, textoNuevo, notaVersion)`
- `historialRestaurarVersionData(escritoId, numVersion)`
- `aplicarVariablesDinamicas(texto, causa)`
- `plantillaCrearData(datos)`
- `plantillaActualizarData(id, datos)`
- `VAR_MAP` (documentado como `@type`)
- `TIPOS_ESCRITOS_EXTRA` (documentado como `@type`)
- `detectarOrigenEscrito()`

#### `11b-escritos-ui.js` (nuevo — documentado completo)
- `historialRenderEscritos()`
- `historialFiltrar()`
- `historialCargarEscrito(id)`
- `historialRestaurarVersion(escritoId, numVersion)`
- `historialVerVersiones(escritoId)`
- `uiAplicarVariables()`
- `plantillaNueva()`
- `plantillaEditar(id)`
- `plantillaGuardar()`
- `plantillaEliminar(id)`
- `plantillaUsar(id)`
- `plantillasRender()`
- `rellenarTiposEscritos(materiaId)`
- `uiGuardarEscrito()`
- `renderEscritosDB()`

---

### Convención para Fase 2

Cada función de `11a-escritos-data.js` incluye un comentario inline:

```js
// En Fase 2: POST /api/escritos/historial
// En Fase 2: DELETE /api/escritos/historial/:id
// En Fase 2: GET /api/escritos/historial?texto=&origen=&favoritos=
```

Esto hace explícito el punto de corte entre la lógica local (v1) y la futura implementación con API REST.
