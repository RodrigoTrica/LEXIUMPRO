# AppBogado v15 — Fase 3: Arquitectura CSS Modular

## Estado actual
`styles.css` es un único archivo de ~7.800 líneas. Difícil de mantener.
Las variables de layout ya están centralizadas en `:root` (v15).

## Plan de migración (sin romper la app)

### Paso 1: Extraer variables y reset
**Archivo:** `css/modules/00-tokens.css`
Contenido: `:root { --sidebar-w, --topbar-h, --z-*, colores, radios, tipografía }`

### Paso 2: Extraer layout raíz
**Archivo:** `css/modules/01-layout.css`
Contenido: `html, body, main, #topbar, #side, body.sidebar-open *`

### Paso 3: Módulo por módulo
| Archivo               | Selector clave             | Líneas aprox |
|----------------------|---------------------------|-------------|
| `02-sidebar.css`     | `#side, .nav-*`            | 200         |
| `03-topbar.css`      | `#topbar, .topbar-*`       | 150         |
| `04-dashboard.css`   | `.db-*, .kpi-*`            | 600         |
| `05-escritos.css`    | `.esc-*, section#escritos` | 800         |
| `06-tramites.css`    | `.tr-*, .tr-det-*`         | 700         |
| `07-causas.css`      | `.causa-*, .ca-*`          | 600         |
| `08-clientes.css`    | `.cl-*, .cliente-*`        | 500         |
| `09-documentos.css`  | `.doc-*, .archivo-*`       | 400         |
| `10-modals.css`      | `.modal-overlay, .modal-box` | 300       |
| `11-forms.css`       | `input, select, .form-*`   | 400         |
| `12-responsive.css`  | Todos los @media           | 400         |
| `13-dark-theme.css`  | `[data-theme="dark"] *`    | 300         |

### Paso 4: index.html — reemplazar 1 link por 13
```html
<link rel="stylesheet" href="css/modules/00-tokens.css">
<link rel="stylesheet" href="css/modules/01-layout.css">
...
```

## Ventajas de v15 que facilitan Fase 3
- ✅ Variables centralizadas (`--sidebar-w`, `--topbar-h`, `--z-*`)
- ✅ Un solo scroll container (main)
- ✅ Sistema z-index consistente
- ✅ `body.sidebar-open` como única fuente de verdad

## Migración a CSS Grid (Fase 3 avanzada)
```css
body {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: var(--topbar-h) 1fr;
  grid-template-areas:
    "sidebar topbar"
    "sidebar main";
  height: 100vh;
  overflow: hidden;
}
#side   { grid-area: sidebar; }
#topbar { grid-area: topbar; }
main    { grid-area: main; overflow-y: auto; }
```
