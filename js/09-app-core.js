// JS — BLOQUE 6: UI, UTILIDADES Y MOTOR DE IA
// • tab(), renderAll(), feriados Chile, validación RUT, modales,
//   tipos de escritos, Gemini API, ASK MY CASE, generador de escritos,
//   autenticación init, notificaciones, arranque de la app
// ████████████████████████████████████████████████████████████████████

// ================================
// AUTO-GUARDADO GLOBAL
// ================================
let __appDirty = false;

function markAppDirty() {
    __appDirty = true;
    const btn = document.getElementById('btn-guardar-global');
    if (btn) {
        btn.classList.add('dirty');
        btn.setAttribute('title', '⚠️ Hay cambios sin guardar — clic para guardar (Ctrl+S)');
    }
}

// ── Señal global de escritura para render-guards ───────────────────
try {
    if (typeof window.__lastUserInputAt !== 'number') window.__lastUserInputAt = 0;
    // Registrar una sola vez
    if (!window.__userInputSignalBound) {
        window.__userInputSignalBound = true;
        document.addEventListener('input', () => { window.__lastUserInputAt = Date.now(); }, true);
        document.addEventListener('keydown', (e) => {
            // Solo teclas que suelen modificar (evitar tab/shift/control)
            if (!e) return;
            const k = e.key || '';
            if (k.length === 1 || k === 'Backspace' || k === 'Delete' || k === 'Enter') {
                window.__lastUserInputAt = Date.now();
            }
        }, true);
    }
} catch (_) {}

function __autoSave() {
    if (!__appDirty) return;
    try {
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
            const ro = ae.readOnly || ae.disabled;
            const type = (ae.getAttribute && ae.getAttribute('type')) ? String(ae.getAttribute('type')).toLowerCase() : '';
            const isTextual = (ae.tagName === 'TEXTAREA') || (ae.tagName === 'SELECT') || (!['checkbox','radio','button','submit','reset','file','range','color','date','datetime-local','month','time','week'].includes(type));
            if (!ro && isTextual) {
                // Evitar interrupciones mientras el usuario escribe
                return;
            }
        }
    } catch (_) {}
    try {
        if (typeof saveDataToDisk === 'function') {
            saveDataToDisk();
        } else if (window.AppStorage && typeof window.AppStorage.save === 'function') {
            window.AppStorage.save();
        } else if (typeof save === 'function') {
            save();
        } else {
            console.warn('[AutoSave] No se encontró función de guardado.');
            return;
        }
        console.log('[AutoSave] Guardado automático ejecutado.');
        __appDirty = false;
    } catch (err) {
        console.error('[AutoSave] Error:', err);
    }
}

// Guardar antes de cerrar la ventana
window.addEventListener('beforeunload', () => {
    __autoSave();
});


// ── Helper seguro de localStorage ────────────────────────────────────
// Protege contra QuotaExceededError (almacenamiento lleno) y
// SecurityError (Safari en modo de navegación privada).
function _lsGet(key, fallback = null) {
    try { return localStorage.getItem(key); } catch (e) { console.warn('[LS]', key, e.message); return fallback; }
}
function _lsSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { console.warn('[LS]', key, e.message); return false; }
}
function _lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { console.warn('[LS]', key, e.message); }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN tab() CONSOLIDADA — ÚNICA DEFINICIÓN FINAL
// (Reemplaza todas las versiones encadenadas anteriores)
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN init() CONSOLIDADA — ÚNICA DEFINICIÓN
// ═══════════════════════════════════════════════════════════════════════
// ─── Configuración de Eventos ─────────────────────────────────────
function setupEventListeners() {
    // 1. File Input Handlers
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('ga-drop-zone');
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            gaStagedFiles = Array.from(e.target.files);
            gaShowForm();
        });
    }
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag');
            gaStagedFiles = Array.from(e.dataTransfer.files);
            gaShowForm();
        });
    }

    // 2. RUT Feedback
    const rutEl = document.getElementById('cl-rut');
    if (rutEl) {
        if (!rutEl.nextElementSibling?.classList?.contains('rut-feedback')) {
            const fb = document.createElement('div');
            fb.className = 'rut-feedback';
            fb.style.cssText = 'font-size:0.75rem; font-weight:600; margin-top:3px; min-height:16px; transition:color 0.2s;';
            rutEl.parentNode.insertBefore(fb, rutEl.nextSibling);
        }
        rutEl.addEventListener('input', () => onRutInput(rutEl));
    }

    // 3. IA Config Mutation Observer
    const secConfigIA = document.getElementById('config-ia');
    if (secConfigIA) {
        const obs = new MutationObserver(muts => {
            muts.forEach(m => {
                if (m.attributeName === 'class' && secConfigIA.classList.contains('active')) {
                    iaCargarKeyEnInput();
                }
            });
        });
        obs.observe(secConfigIA, { attributes: true });
    }
}

// Aplica estilos de dashboard header según el tema activo
// Aplica tema al dashboard directamente en los elementos DOM
function _applyDashboardTheme(theme) {
    const dark = theme === 'dark';

    // Helper: aplicar estilos inline directamente al elemento
    function applyEl(sel, styles) {
        document.querySelectorAll(sel).forEach(el => {
            Object.assign(el.style, styles);
        });
    }

    if (dark) {
        applyEl('.modo-toggle', {
            background: '#0f172a', border: '1px solid #334155', borderRadius: '8px'
        });
        applyEl('.modo-btn', {
            background: '#0f172a', color: '#64748b', border: 'none'
        });
        applyEl('.modo-btn.activo', {
            background: '#1e293b', color: '#38bdf8', boxShadow: 'none'
        });
        applyEl('.db-export-btn', {
            background: '#1e293b', border: '1px solid #334155', color: '#94a3b8'
        });
        applyEl('.db-export-excel', {
            background: '#0d7a5f', borderColor: '#0d7a5f', color: '#fff'
        });
        applyEl('.db-export-csv', {
            background: '#334155', borderColor: '#475569', color: '#e2e8f0'
        });
        applyEl('.notif-bell-btn', {
            background: '#1e293b', border: '1px solid #334155', color: '#94a3b8'
        });
        applyEl('.db-filtros', {
            background: '#1e293b', borderColor: '#334155'
        });
        applyEl('.db-filtros select', {
            background: '#0f172a', borderColor: '#334155', color: '#f1f5f9'
        });
        applyEl('.db-filtros label', { color: '#94a3b8' });
    } else {
        applyEl('.modo-toggle', {
            background: '', border: '', borderRadius: ''
        });
        applyEl('.modo-btn', {
            background: '', color: '', border: ''
        });
        applyEl('.modo-btn.activo', {
            background: '', color: '', boxShadow: ''
        });
        applyEl('.db-export-btn', {
            background: '', border: '', color: ''
        });
        applyEl('.db-export-excel', {
            background: '#0d7a5f', borderColor: '#0d7a5f', color: '#fff'
        });
        applyEl('.db-export-csv', {
            background: '#475569', borderColor: '#475569', color: '#fff'
        });
        applyEl('.notif-bell-btn', {
            background: '', border: '', color: ''
        });
        applyEl('.db-filtros', { background: '', borderColor: '' });
        applyEl('.db-filtros select', { background: '', borderColor: '', color: '' });
        applyEl('.db-filtros label', { color: '' });
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    // Guardar via AppConfig (usa DiskStorage cifrado en Electron, localStorage fuera)
    if (typeof AppConfig !== 'undefined') {
        AppConfig.set('tema', next);
    } else {
        _lsSet('LEXIUM_THEME', next);
    }
    _updateThemeIcon(next);
    _applyDashboardTheme(next);
    showInfo(`Tema ${next === 'dark' ? 'oscuro' : 'claro'} activado`);
}

function _updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

async function init() {
    // Esperar a que DiskStorage cargue desde disco antes de leer config
    await new Promise(resolve => {
        if (window.DiskStorage && window.DiskStorage.cuandoListo) {
            window.DiskStorage.cuandoListo(resolve);
        } else {
            resolve();
        }
    });

    // Forzar recarga de AppConfig desde disco ya inicializado
    if (typeof AppConfig !== 'undefined') AppConfig.recargar();

    // Leer tema con disco ya cargado
    const savedTheme = (typeof AppConfig !== 'undefined' && AppConfig.get('tema'))
        || _lsGet('LEXIUM_THEME')
        || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    _updateThemeIcon(savedTheme);
    _applyDashboardTheme(savedTheme);

    resetDiario();
    actualizarMotorEstrategico();
    evaluarAlertas();
    uiRenderJurisprudenciaAvanzada();
    // loginRenderUsuarios() ya fue llamado en el IIFE de 01-db-auth.js — no duplicar
    renderAll();
    updateCalcHitos();
    const calcDate = document.getElementById('calc-date');
    if (calcDate) calcDate.value = new Date().toISOString().split('T')[0];

    // Inicializar estados específicos
    escActualizarEstadoBotones(false);
    iaRenderModelList();

    setTimeout(() => {
        // Garantizar que #panel está activo antes de renderizar donnuts
        const panelEl = document.getElementById('panel');
        if (panelEl && !panelEl.classList.contains('active')) {
            document.querySelectorAll('.tabs.active').forEach(s => s.classList.remove('active'));
            panelEl.classList.add('active');
        }

        // Cada llamada protegida individualmente — un error no rompe las demás
        try { notificarPlazosCriticos(); } catch (e) { console.warn('[init] notificarPlazosCriticos:', e.message); }
        try { renderDashboardPanel(); } catch (e) { console.warn('[init] renderDashboardPanel:', e.message); }
        try { if (typeof renderSemaforoPlazos === 'function') renderSemaforoPlazos(); } catch (e) { console.warn('[init] renderSemaforoPlazos:', e.message); }
        try { if (typeof renderPanelEjecutivo === 'function') renderPanelEjecutivo(); } catch (e) { console.warn('[init] renderPanelEjecutivo:', e.message); }

        // Aplicar tema después del render
        const themeActual = document.documentElement.getAttribute('data-theme') || 'light';
        _applyDashboardTheme(themeActual);

        AutoBackup.iniciar();

        // Re-render donnuts con delay extra para garantizar visibilidad
        setTimeout(() => {
            try { renderDashboardPanel(); } catch (e) { }
        }, 300);

    }, 200);
}

// ── Grupos de navegación colapsables ──────────────────────────────

function toggleSidebar() {
    const side = document.getElementById('side');
    const isVisible = side.style.display === 'flex';
    side.style.display = isVisible ? 'none' : 'flex';
    // body.sidebar-open maneja topbar padding + main margin via CSS
    document.body.classList.toggle('sidebar-open', !isVisible);
}
function toggleGrupo(headerBtn) {
    const items = headerBtn.nextElementSibling;
    const isOpen = headerBtn.classList.contains('open');
    headerBtn.classList.toggle('open', !isOpen);
    items.classList.toggle('open', !isOpen);
}

// ── Consolidación de Hubs Funcionales ────────────────────────────

const HUB_MAPPING = {
    'hub-expedientes': [
        { id: 'causas', label: 'Expedientes', icon: 'fas fa-gavel' },
        { id: 'archivos', label: 'Documentos', icon: 'fas fa-folder-open' },
        { id: 'instancias', label: 'Instancias', icon: 'fas fa-sitemap' },
        { id: 'prescripcion', label: 'Prescripción', icon: 'fas fa-hourglass-half' },
        { id: 'biblioteca', label: 'Biblioteca', icon: 'fas fa-book-open' },
        { id: 'tramites', label: 'Trámites', icon: 'fas fa-building' }
    ],
    'hub-inteligencia': [
        { id: 'estrategia', label: 'Riesgo', icon: 'fas fa-brain' },
        { id: 'ficha-estrategia', label: 'Ficha', icon: 'fas fa-chess-knight' },
        { id: 'juris', label: 'Jurisprudencia', icon: 'fas fa-book' },
        { id: 'doctrina', label: 'Doctrina', icon: 'fas fa-graduation-cap' },
        { id: 'coherencia', label: 'Coherencia', icon: 'fas fa-project-diagram' }
    ],
    'hub-produccion': [
        { id: 'escritos', label: 'Generador', icon: 'fas fa-pen-nib' },
        { id: 'historial-escritos', label: 'Historial', icon: 'fas fa-history' },
        { id: 'plantillas-escritos', label: 'Modelos', icon: 'fas fa-layer-group' },
        { id: 'informe', label: 'Informes', icon: 'fas fa-file-alt' }
    ],
    'hub-negocio': [
        { id: 'clientes', label: 'CRM', icon: 'fas fa-users' },
        { id: 'mapa-economico', label: 'Mapa Eco', icon: 'fas fa-chart-bar' },
        { id: 'cuantia', label: 'Cuantía', icon: 'fas fa-coins' },
        { id: 'timesheet', label: 'Timesheet', icon: 'fas fa-stopwatch' }
    ],
    'hub-sistema': [
        { id: 'calendario', label: 'Agenda', icon: 'fas fa-calendar-week' },
        { id: 'busqueda', label: 'Búsqueda', icon: 'fas fa-search' },
        { id: 'calculadora-pro', label: 'Calculadora', icon: 'fas fa-calculator' },
        { id: 'config-ia', label: 'IA Config', icon: 'fas fa-robot' },
        { id: 'bitacora', label: 'Seguridad', icon: 'fas fa-shield-alt' },
        { id: 'admin-usuarios', label: 'Usuarios', icon: 'fas fa-users-cog' }
    ]
};

function hub(hubId, defaultTabId, btn) {
    const container = document.getElementById('hub-nav-container');
    if (container && HUB_MAPPING[hubId]) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(-10px)';
        container.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

        container.innerHTML = `
                    <div class="hub-nav">
                        ${HUB_MAPPING[hubId].map(t => `
                            <button class="hub-tab ${t.id === defaultTabId ? 'active' : ''}" 
                                    onclick="tab('${t.id}', this)" 
                                    data-hub="${hubId}">
                                <i class="${t.icon}"></i> ${t.label}
                            </button>
                        `).join('')}
                    </div>
                `;

        requestAnimationFrame(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        });
    }
    const targetBtn = container ? container.querySelector(`.hub-tab[onclick*="'${defaultTabId}'"]`) : null;
    tab(defaultTabId, targetBtn || btn);
}

/**
 * Navega a una sección de la app activando el panel correspondiente y
 * desactivando todos los demás. Actualiza el botón de navegación activo.
 * También ejecuta el render específico de la sección si existe
 * (e.g. renderDashboardPanel, renderEscritosDB, etc.).
 *
 * @param {string} id  - ID del panel de contenido (sin '#'), e.g. 'dashboard'.
 * @param {HTMLElement} [btn] - Botón de nav que disparó el cambio (para marcar activo).
 */
function tab(id, btn) {
    document.querySelectorAll('.tabs').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('act'));

    // Cerrar modales flotantes del CRM al navegar entre secciones
    ['modal-prospecto-custom', 'modal-propuesta-custom', 'modal-input-generico', 'modal-detalle'].forEach(mid => {
        const m = document.getElementById(mid);
        if (m) {
            m.style.display = 'none';
            m.classList.remove('open');
            // Restaurar max-width del modal genérico si fue modificado
            if (mid === 'modal-input-generico') {
                const box = m.querySelector('.modal-box');
                if (box) box.style.maxWidth = '480px';
                const btnOk = document.getElementById('mig-btn-ok');
                if (btnOk) btnOk.style.display = 'block';
            }
        }
    });

    const navContainer = document.getElementById('hub-nav-container');

    if (btn && btn.classList.contains('hub-tab')) {
        document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const hubId = btn.getAttribute('data-hub');
        if (hubId) {
            const hubBtn = document.querySelector(`nav button[onclick*="'${hubId}'"]`);
            if (hubBtn) hubBtn.classList.add('act');
        }
    } else {
        // Si cambiamos a un tab que no es de hub-tab y no es una acción de hub
        // limpiamos la navegación secundaria si no hay persistencia de hub
        const isHubAction = btn && btn.getAttribute('onclick')?.includes('hub(');
        if (!isHubAction && navContainer) navContainer.innerHTML = '';
    }

    const sec = document.getElementById(id);
    if (sec) sec.classList.add('active');

    if (btn && !btn.classList.contains('hub-tab')) {
        btn.classList.add('act');
        const parentItems = btn.closest('.nav-group-items');
        if (parentItems && !parentItems.classList.contains('open')) {
            parentItems.classList.add('open');
            const header = parentItems.previousElementSibling;
            if (header) header.classList.add('open');
        }
    }

    const icons = { panel: 'chart-line', clientes: 'users', causas: 'gavel', estrategia: 'brain', calculadora: 'calendar-alt', 'calculadora-pro': 'calculator', archivos: 'folder-open', juris: 'book', honorarios: 'wallet', prospectos: 'funnel-dollar', 'causas-pro': 'sitemap', 'detalle-causa': 'folder-open', recursos: 'undo', calendario: 'calendar-week', prescripcion: 'hourglass-half', 'estrategia-pro': 'chess', informe: 'file-alt', escritos: 'pen-nib', 'historial-escritos': 'history', 'plantillas-escritos': 'layer-group', 'plantillas-texto': 'file-alt', 'timesheet': 'stopwatch', cuantia: 'coins', 'ficha-estrategia': 'chess-knight', 'matriz-prioridad': 'sort-amount-down', 'mapa-economico': 'chart-bar', instancias: 'sitemap', coherencia: 'project-diagram', busqueda: 'search', bitacora: 'shield-alt', 'audit-reportes': 'shield-halved', biblioteca: 'book-open', 'admin-usuarios': 'users-cog', 'config-ia': 'robot', tramites: 'building', doctrina: 'graduation-cap', 'whatsapp-chat': 'comments' };
    const names = { panel: 'Panel Ejecutivo', clientes: 'Clientes & Prospectos', causas: 'Gestión de Causas', estrategia: 'Estrategia & Riesgo', calculadora: 'Calculadora de Plazos', 'calculadora-pro': 'Calculadora Pro', archivos: 'Gestor de Archivos', juris: 'Jurisprudencia', honorarios: 'Honorarios', prospectos: 'Prospectos CRM', 'causas-pro': 'Causas Pro', 'detalle-causa': 'Detalle de Causa', recursos: 'Recursos Procesales', calendario: 'Agenda y Alertas Críticas', prescripcion: 'Control de Prescripción', 'estrategia-pro': 'Estrategia Pro', informe: 'Informes de Causa', escritos: 'Generador de Escritos', 'historial-escritos': 'Historial de Escritos', 'plantillas-escritos': 'Plantillas Personalizadas', 'plantillas-texto': 'Plantillas de Texto', 'timesheet': 'Registro de Tiempo', cuantia: 'Cuantía Dinámica', 'ficha-estrategia': 'Ficha de Estrategia', 'matriz-prioridad': 'Matriz de Prioridad', 'mapa-economico': 'Mapa Económico', instancias: 'Control de Instancias', coherencia: 'Análisis de coherencia', busqueda: 'Búsqueda Global', bitacora: 'Bitácora del Sistema', 'audit-reportes': 'Auditoría y Reportes', biblioteca: 'Biblioteca Documental', 'admin-usuarios': 'Gestión de Usuarios', 'config-ia': 'Configurar Inteligencia Artificial', tramites: 'Trámites Administrativos', doctrina: 'Doctrina & Práctica Forense', 'whatsapp-chat': 'Chat WhatsApp' };
    const subtitles = { panel: 'Vista general de tu operación legal', clientes: 'Gestión de clientes y conflictos', causas: 'Listado y seguimiento de causas', estrategia: 'Análisis de riesgo y estrategia', calculadora: 'Cálculo automático de plazos procesales', 'calculadora-pro': 'Cálculos judiciales avanzados, UF, UTM y reajustabilidad', archivos: 'Gestor de documentos por causa', juris: 'Base de jurisprudencia', honorarios: 'Gestión de honorarios', prospectos: 'CRM de prospectos y oportunidades', 'causas-pro': 'Gestión avanzada de causas', 'detalle-causa': 'Ficha detallada de la causa', recursos: 'Control de recursos procesales', calendario: 'Agenda y alertas críticas', prescripcion: 'Control de plazos de prescripción', 'estrategia-pro': 'Análisis estratégico avanzado', informe: 'Generación de informes', escritos: 'Redacción asistida por IA', 'historial-escritos': 'Escritos generados y guardados en el despacho', 'plantillas-escritos': 'Modelos propios reutilizables', 'plantillas-texto': 'Plantillas con variables dinámicas', 'timesheet': 'Control de horas por causa', cuantia: 'Cálculo de cuantía dinámica', 'ficha-estrategia': 'Ficha estratégica de causa', 'matriz-prioridad': 'Clasificación por prioridad', 'mapa-economico': 'Visualización económica', instancias: 'Seguimiento de instancias', coherencia: 'Análisis de coherencia', busqueda: 'Búsqueda en todo el sistema', bitacora: 'Registro de actividad del sistema', 'audit-reportes': 'Caja negra: quién hizo qué y cuándo', biblioteca: 'Repositorio documental', 'admin-usuarios': 'Gestión de accesos y roles', 'config-ia': 'Configuración de inteligencia artificial', tramites: 'CBR, SII, DT, SERVIU, Municipalidades, TGR y más', doctrina: 'Textos doctrinales, práctica forense y bibliografía jurídica', 'whatsapp-chat': 'Lee y responde mensajes desde LEXIUM' };
    const subEl = sec ? sec.querySelector('.page-subtitle') : null;
    if (subEl) subEl.textContent = subtitles[id] || '';
    const titleEl = sec ? sec.querySelector('.page-title') : null;
    if (titleEl && icons[id]) titleEl.innerHTML = `<i class="fas fa-${icons[id]}"></i> ${names[id]}`;

    // Lógica específica por módulo
    if (id === 'cuantia') calcularCuantia();
    if (id === 'calculadora-pro') cpRecalcular();
    if (id === 'ficha-estrategia') { renderFichasGuardadas(); }
    if (id === 'matriz-prioridad') renderMatrizPrioridad();
    if (id === 'mapa-economico') renderMapaEconomico();
    if (id === 'instancias') { renderInstancias(); }
    if (id === 'coherencia') renderCoherenciaGlobal();
    if (id === 'biblioteca') bibRender();
    if (id === 'admin-usuarios') renderGestionUsuarios();
    if (id === 'config-estudio') { if (typeof renderConfigEstudio === 'function') renderConfigEstudio(); }
    if (id === 'tramites') {
        if (typeof tramitesRender === 'function') tramitesRender();
        if (typeof inyectarTramitesNav === 'function') inyectarTramitesNav();
    }
    if (id === 'doctrina') { if (typeof doctrinaRender === 'function') doctrinaRender(); }
    if (id === 'prescripcion') renderPrescripcion();
    if (id === 'honorarios') { if (typeof renderHonorarios === 'function') renderHonorarios(); }
    if (id === 'panel') { renderDashboardPanel(); }
    if (id === 'escritos') { gaSelectCausa(); }
    if (id === 'historial-escritos') { if (typeof historialRenderEscritos === 'function') historialRenderEscritos(); }
    if (id === 'plantillas-escritos') { if (typeof plantillasRender === 'function') plantillasRender(); }
    if (id === 'prospectos') { if (typeof prospectosRender === 'function') prospectosRender(); }
    if (id === 'audit-reportes') { if (window.AuditReportes && typeof window.AuditReportes.render === 'function') window.AuditReportes.render(); }
    if (id === 'whatsapp-chat') { if (typeof waChatRender === 'function') waChatRender(); }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN renderAll() CONSOLIDADA — ÚNICA DEFINICIÓN FINAL
// ═══════════════════════════════════════════════════════════════════════
/**
 * Re-renderiza toda la interfaz: causas, clientes, prospectos, alertas, dashboard.
 * Llamar después de cualquier operación CRUD para mantener la UI sincronizada.
 * No re-renderiza secciones de escritos/historial (tienen su propio renderEscritosDB).
 */
function renderAll() {
    // Re-aplicar tema al dashboard después de cada render
    const _theme = document.documentElement.getAttribute('data-theme') || 'light';
    setTimeout(() => _applyDashboardTheme(_theme), 0);
    // Stats canónicas
    const prospectos = DB.clientes.filter(c => c.estado === 'prospecto' || c.status === 'prospecto');
    const plazoAlerts = DB.documentos.filter(d => d.generaPlazo && d.fechaVencimiento).length;
    const alertCount = DB.causas.length + plazoAlerts + DB.alertas.filter(a => a.estado === 'activa').length;

    document.getElementById('st-ca').innerText = DB.causas.length;
    document.getElementById('st-pr').innerText = prospectos.length + DB.prospectos.length;
    document.getElementById('st-al').innerText = alertCount;
    document.getElementById('st-ju').innerText = DB.jurisprudencia.length;
    if (document.getElementById('st-do')) document.getElementById('st-do').innerText = DB.documentos.length;

    renderClientes();
    if (typeof ptRender === 'function') ptRender();
    if (typeof tiempoRender === 'function') tiempoRender();
    if (typeof _tsActualizarSelectores === 'function') _tsActualizarSelectores();
    if (typeof _ptActualizarSelectores === 'function') _ptActualizarSelectores();
    renderCausas();
    if (typeof renderHonorarios === 'function') renderHonorarios();
    renderAlerts();
    renderJuris();

    // Selects de causas — todos de una vez
    const causeOptBase = '<option value="">-- Seleccione una causa --</option>' +
        DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');
    const causeOptOptional = '<option value="">-- Sin causa específica --</option>' +
        DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');

    ['risk-select', 'ga-causa-sel', 'ep-causa-sel', 'doc-causa-sel', 'hr-causa-sel',
        'hr-pago-causa-sel', 'rec-causa-sel', 'inf-causa-sel', 'esc-causa-sel',
        'inst-causa-sel', 'coh-causa-sel', 'fe-causa-sel']
        .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = causeOptBase; });

    // Al cambiar causa en el generador de escritos, actualizar tipos según materia
    const escCausaSel = document.getElementById('esc-causa-sel');
    if (escCausaSel) {
        escCausaSel.onchange = function () {
            const causa = DB.causas.find(c => c.id == this.value);
            rellenarTiposEscritos(causa?.materia || 'civil');
        };
        // Inicializar con la primera causa seleccionada
        const primeraCausa = DB.causas.find(c => c.id == escCausaSel.value);
        rellenarTiposEscritos(primeraCausa?.materia || 'civil');
    }

    ['cal-causa-sel', 'cq-causa-sel']
        .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = causeOptOptional; });

    // Render de módulos principales
    renderPanelEjecutivo();
    renderProspectos();
    renderResumenEconomico();
    // renderDashboard() llamado por actualizarSistema(), no desde renderAll()
    renderCalendario();
    renderBitacora();
    renderHonorariosResumen();
    renderRecursos();

    // Módulos nuevos V6+V7
    renderSemaforoPlazos();
    renderSaludDespacho();
    renderCausasDormidas();
    renderMatrizPrioridad();
    renderMapaEconomico();
    renderCoherenciaGlobal();
    renderInstanciasGlobal();
    renderFichasGuardadas();

    // Modo estudio
    const modo = DB.configuracion?.modoEstudio ? 'estudio' : 'personal';
    document.getElementById('modo-personal-btn')?.classList.toggle('activo', modo === 'personal');
    document.getElementById('modo-estudio-btn')?.classList.toggle('activo', modo === 'estudio');
}


// ═══════════════════════════════════════════════════════════════════
// MÓDULO 1 — FERIADOS LEGALES CHILE 2024-2027
// Fuente: Ley 2.977 y modificaciones. Incluye feriados judiciales.
// ═══════════════════════════════════════════════════════════════════

// Feriados fijos irrenunciables (MM-DD)
const FERIADOS_CHILE = {
    '01-01': 'Año Nuevo',
    '05-01': 'Día del Trabajo',
    '05-21': 'Glorias Navales',
    '06-29': 'San Pedro y San Pablo',
    '07-16': 'Virgen del Carmen',
    '08-15': 'Asunción de la Virgen',
    '09-18': 'Primera Junta Nacional de Gobierno',
    '09-19': 'Glorias del Ejército',
    '10-12': 'Encuentro de Dos Mundos',
    '10-31': 'Día de las Iglesias Evangélicas y Protestantes',
    '11-01': 'Día de Todos los Santos',
    '12-08': 'Inmaculada Concepción',
    '12-25': 'Navidad',
    '12-31': 'Feriado Bancario (fin de año)',
};

// Feriados variables (YYYY-MM-DD) — Semana Santa + Corpus Christi 2024-2027
const FERIADOS_VARIABLES = {
    // 2024
    '2024-03-28': 'Jueves Santo',
    '2024-03-29': 'Viernes Santo',
    '2024-05-30': 'Corpus Christi',
    // 2025
    '2025-04-17': 'Jueves Santo',
    '2025-04-18': 'Viernes Santo',
    '2025-06-19': 'Corpus Christi',
    // 2026
    '2026-04-02': 'Jueves Santo',
    '2026-04-03': 'Viernes Santo',
    '2026-06-04': 'Corpus Christi',
    // 2027
    '2027-03-25': 'Jueves Santo',
    '2027-03-26': 'Viernes Santo',
    '2027-05-27': 'Corpus Christi',
};

// Feriados judiciales — Art. 313 COT
// El Poder Judicial tiene feriado en febrero (receso).
// Se marca receso judicial 1-15 febrero cada año.
function esRecesoJudicial(fecha) {
    return fecha.getMonth() === 1 && fecha.getDate() <= 15;
}

function esFeriadoChileno(fecha) {
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    const yyyy = fecha.getFullYear();
    const keyFijo = `${mm}-${dd}`;
    const keyVariable = `${yyyy}-${mm}-${dd}`;
    return !!(FERIADOS_CHILE[keyFijo] || FERIADOS_VARIABLES[keyVariable]);
}

function getNombreFeriado(fecha) {
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    const yyyy = fecha.getFullYear();
    return FERIADOS_CHILE[`${mm}-${dd}`]
        || FERIADOS_VARIABLES[`${yyyy}-${mm}-${dd}`]
        || null;
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 2 — VALIDACIÓN Y FORMATO DE RUT CHILENO
// Algoritmo módulo 11 (dígito verificador oficial Chile)
// ═══════════════════════════════════════════════════════════════════

function validarRUT(rut) {
    if (!rut || typeof rut !== 'string') return false;
    // Limpiar: solo dígitos y k/K al final
    const limpio = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

    const cuerpo = limpio.slice(0, -1);
    const dvIngresado = limpio.slice(-1);
    let suma = 0;
    let multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i]) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }
    const resto = 11 - (suma % 11);
    const dvCalculado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dvIngresado === dvCalculado;
}

function formatRUT(rut) {
    if (!rut) return '';
    const limpio = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    // Formatear con puntos cada 3 dígitos
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpoFormateado}-${dv}`;
}

// Auto-formato mientras escribe + feedback visual
function onRutInput(inputEl) {
    const raw = inputEl.value;
    const limpio = raw.replace(/[\.\-\s]/g, '').toUpperCase();
    // Solo formatear si tiene suficientes chars
    if (limpio.length >= 2) {
        inputEl.value = formatRUT(raw);
    }
    // Feedback visual
    const nextEl = inputEl.nextElementSibling;
    if (limpio.length >= 8) {
        const valido = validarRUT(raw);
        inputEl.style.borderColor = valido ? '#059669' : '#dc2626';
        inputEl.style.boxShadow = valido
            ? '0 0 0 3px rgba(5,150,105,0.12)'
            : '0 0 0 3px rgba(220,38,38,0.12)';
        if (nextEl && nextEl.classList?.contains('rut-feedback')) {
            nextEl.textContent = valido ? '✓ RUT válido' : '✗ RUT inválido';
            nextEl.style.color = valido ? '#059669' : '#dc2626';
        }
    } else {
        inputEl.style.borderColor = '';
        inputEl.style.boxShadow = '';
        if (nextEl && nextEl.classList?.contains('rut-feedback')) {
            nextEl.textContent = '';
        }
    }
}

// Aplicar feedback automático al campo de RUT del cliente
// Aplicar feedback automático al campo de RUT del cliente
// (Movido a setupEventListeners)

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 3 — MODAL GENÉRICO DE INPUT (reemplaza prompt() nativo)
// migAbrir / migConfirmar / migCancelar — sistema reutilizable
// ═══════════════════════════════════════════════════════════════════

let _migCallback = null;
let _migCampos = [];

/*
 * migAbrir({ titulo, campos, btnOk, onOk })
 * campos: [{ id, label, valor, placeholder, tipo, opciones }]
 *   tipo: 'text' | 'email' | 'tel' | 'date' | 'number' | 'rut' | 'select' | 'textarea'
 *   opciones: [{ value, label }]  (solo para tipo 'select')
 *   requerido: true/false
 * onOk(vals): callback con objeto { id: value }
 */
function migAbrir({ titulo, campos = [], btnOk = 'Guardar', onOk }) {
    _migCallback = onOk;
    _migCampos = campos;

    document.getElementById('mig-titulo').innerHTML = titulo || '<i class="fas fa-edit"></i> Editar';
    document.getElementById('mig-btn-ok').textContent = btnOk;

    const body = document.getElementById('mig-body');
    body.innerHTML = campos.map(c => {
        const isRut = c.tipo === 'rut';
        const isSelect = c.tipo === 'select';
        const isTextarea = c.tipo === 'textarea';
        let inputHtml;

        if (isSelect) {
            inputHtml = `<select id="${c.id}" style="width:100%; margin-top:4px;">
                        ${(c.opciones || []).map(o => `<option value="${escHtml(o.value)}" ${o.value === c.valor ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('')}
                    </select>`;
        } else if (isTextarea) {
            inputHtml = `<textarea id="${c.id}" placeholder="${escHtml(c.placeholder || '')}" style="width:100%; margin-top:4px; min-height:80px;">${escHtml(c.valor || '')}</textarea>`;
        } else {
            const tipo = isRut ? 'text' : (c.tipo || 'text');
            const extraAttr = isRut ? `oninput="onRutInput(this)"` : '';
            inputHtml = `<input id="${c.id}" type="${tipo}" value="${escHtml(c.valor || '')}"
                        placeholder="${escHtml(c.placeholder || '')}" ${extraAttr}
                        style="width:100%; margin-top:4px;"
                        ${c.requerido ? 'required' : ''}>`;
        }

        const feedbackRut = isRut
            ? `<div class="rut-feedback" style="font-size:0.75rem; font-weight:600; margin-top:2px; min-height:16px;"></div>`
            : '';

        return `<div style="margin-bottom:12px;">
                    <label style="font-size:0.8rem; color:#64748b; font-weight:600; display:block;">${escHtml(c.label || '')}</label>
                    ${inputHtml}
                    ${feedbackRut}
                    ${c.ayuda ? `<div style="font-size:0.72rem; color:#94a3b8; margin-top:3px;">${c.ayuda}</div>` : ''}
                </div>`;
    }).join('');

    // Activar feedback en campos RUT recién creados
    campos.filter(c => c.tipo === 'rut').forEach(c => {
        const el = document.getElementById(c.id);
        if (el) {
            // Trigger initial format if has value
            if (el.value) onRutInput(el);
            el.addEventListener('input', () => onRutInput(el));
        }
    });

    abrirModal('modal-input-generico');

    // Focus primer campo
    setTimeout(() => {
        const primer = body.querySelector('input, select, textarea');
        if (primer) primer.focus();
    }, 120);
}

function migConfirmar() {
    const vals = {};
    let hayError = false;

    _migCampos.forEach(c => {
        const el = document.getElementById(c.id);
        if (!el) return;
        const val = el.value?.trim() || '';
        // Validación RUT
        if (c.tipo === 'rut' && val && !validarRUT(val)) {
            el.style.borderColor = '#dc2626';
            el.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)';
            // Mostrar mensaje
            const fb = el.nextElementSibling;
            if (fb && fb.classList?.contains('rut-feedback')) {
                fb.textContent = '✗ RUT inválido — verifique el dígito verificador';
                fb.style.color = '#dc2626';
            }
            hayError = true;
            return;
        }
        // Campo requerido
        if (c.requerido && !val) {
            el.style.borderColor = '#dc2626';
            el.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)';
            hayError = true;
            return;
        }
        vals[c.id] = val;
    });

    if (hayError) return; // No cerrar si hay errores

    cerrarModal('modal-input-generico');
    if (typeof _migCallback === 'function') {
        _migCallback(vals);
    }
    _migCallback = null;
    _migCampos = [];
}

// ─── Confirmación Custom ──────────────────────────────────────────
/**
 * Muestra un modal de confirmación genérico con Aceptar / Cancelar.
 *
 * @param {string}   titulo   - Título del modal.
 * @param {string}   mensaje  - Cuerpo descriptivo.
 * @param {Function} onOk     - Callback ejecutado si el usuario confirma.
 * @param {'warning'|'danger'|'info'} [type='warning'] - Estilo visual del botón Aceptar.
 */
function showConfirm(titulo, mensaje, onOk, type = 'warning') {
    document.getElementById('confirm-titulo').textContent = titulo;
    document.getElementById('confirm-mensaje').textContent = mensaje;
    const iconEl = document.getElementById('confirm-icon');
    const btnOk = document.getElementById('confirm-btn-ok');

    if (type === 'danger') {
        iconEl.style.color = 'var(--danger)';
        btnOk.className = 'btn btn-d';
    } else {
        iconEl.style.color = 'var(--warning)';
        btnOk.className = 'btn btn-p';
    }

    btnOk.onclick = () => {
        cerrarModal('modal-confirm');
        if (onOk) onOk();
    };
    abrirModal('modal-confirm');
}

function migCancelar() {
    cerrarModal('modal-input-generico');
    _migCallback = null;
    _migCampos = [];
}

// Confirmar con Enter en inputs del modal
document.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-input-generico');
    if (modal && modal.classList.contains('active') && e.key === 'Enter') {
        const actEl = document.activeElement;
        // No confirmar si es textarea (Enter = salto de línea)
        if (actEl && actEl.tagName !== 'TEXTAREA') {
            e.preventDefault();
            migConfirmar();
        }
    }
});

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE ESCRITOS — Datos y prompts especializados por materia
// Civil (CPC) · Laboral (CT) · Familia (Ley 19.968)
// ═══════════════════════════════════════════════════════════════════

const TIPOS_ESCRITOS = {
    civil: [
        { id: 'demanda_civil_ordinaria', label: 'Demanda Civil — Juicio Ordinario', prompt_extra: 'Estructura obligatoria Art. 254 CPC: (1) SUMA con peticiones en otrosíes. (2) Encabezado con tribunal, RUT, domicilio procesal. (3) I. HECHOS numerados y cronológicos. (4) II. DERECHO con artículos del Código Civil y CPC. (5) III. PETICIONES con "Por tanto, pide a US." (6) OTROSÍES: patrocinio/poder y documentos. (7) Cierre con "ES JUSTICIA". Tono formal y técnico.' },
        { id: 'demanda_civil_sumario', label: 'Demanda Civil — Juicio Sumario', prompt_extra: 'Procedimiento sumario Art. 680 y ss. CPC. Indicar causal que justifica sumariedad (urgencia o naturaleza de la acción). Misma estructura que ordinaria. Citar Art. 683 CPC para citación a audiencia. Peticiones claras y acotadas.' },
        { id: 'contestacion_civil', label: 'Contestación de Demanda', prompt_extra: 'Estructura Art. 309 CPC. Incluir: (1) Excepciones dilatorias si proceden Art. 303 CPC. (2) Excepciones perentorias: pago, prescripción, novación, etc. (3) Negación categórica de hechos uno a uno. (4) Hechos propios de defensa. (5) Derecho aplicable. (6) Petición: rechazar la demanda en todas sus partes, con costas. Plazo: 15 días hábiles Art. 258 CPC.' },
        { id: 'replica_civil', label: 'Réplica', prompt_extra: 'Réplica del demandante Art. 311 CPC. Plazo 6 días hábiles. Refutar argumento por argumento de la contestación. Se puede ampliar o adicionar peticiones sin alterar las fundamentales. No introducir hechos nuevos no relacionados con la demanda original.' },
        { id: 'duplica_civil', label: 'Dúplica', prompt_extra: 'Dúplica del demandado Art. 312 CPC. Plazo 6 días hábiles. Rebatir los argumentos de la réplica. Puede ampliar excepciones opuestas en contestación, no agregar nuevas. Solicitar período de prueba si los hechos son controvertidos.' },
        { id: 'apelacion_civil', label: 'Recurso de Apelación Civil', prompt_extra: 'Art. 186 y ss. CPC. Plazo: 10 días hábiles sentencia definitiva; 5 días interlocutorias Art. 189 CPC. Estructura: (1) Resolución recurrida. (2) Fundamentos de hecho y derecho. (3) Peticiones concretas a la Corte de Apelaciones. (4) Indicar si se pide efecto suspensivo.' },
        { id: 'casacion_forma', label: 'Recurso de Casación en la Forma', prompt_extra: 'Art. 764 y ss. CPC. Plazo 15 días Art. 770 CPC. Indicar causal exacta del Art. 768 CPC (número), el vicio concreto, la norma infringida y el perjuicio causado. Mencionar preparación del recurso Art. 769 si procede. Petición: nulidad y reenvío.' },
        { id: 'casacion_fondo', label: 'Recurso de Casación en el Fondo', prompt_extra: 'Art. 767 CPC. Solo contra sentencias de Cortes de Apelaciones. Infracción de ley que influye sustancialmente en lo dispositivo. Indicar: normas infringidas, modo de infracción (error de interpretación o aplicación errónea) y cómo influyó en el fallo. Petición: invalidar sentencia y dictar sentencia de reemplazo.' },
        { id: 'medida_cautelar', label: 'Medida Precautoria', prompt_extra: 'Art. 290 y ss. CPC. Indicar: (1) El derecho que se reclama. (2) Fundamentos del peligro en la demora. (3) Medida específica: retención, prohibición enajenar, secuestro o nombramiento depositario. Si es prejudicial Art. 279 CPC, ofrecer caución. Incluir petición subsidiaria.' },
        { id: 'obs_prueba', label: 'Observaciones a la Prueba', prompt_extra: 'Escrito post-prueba Art. 430 CPC. Plazo 10 días desde vencimiento término probatorio. Analizar prueba rendida: documental, testimonial, pericial, confesional. Valorar según sana crítica. Atacar prueba de la contraria. Concluir con resumen de hechos probados y solicitar tenerlos por acreditados.' },
    ],
    laboral: [
        { id: 'demanda_laboral_cobro', label: 'Demanda Laboral — Cobro de Prestaciones', prompt_extra: 'Procedimiento aplicación general Art. 446 y ss. CT. Tribunal: Juzgado de Letras del Trabajo. Incluir: (1) Descripción relación laboral: fecha inicio/término, funciones, remuneración. (2) Fundamentos de derecho CT. (3) Tabla detallada de montos: feriado proporcional, aviso previo, indemnización años servicio, feriado legal. (4) Petición: total + reajuste IPC + interés máximo convencional + costas. Indicar causal despido: Art. 168 (injustificado) o Art. 161 CT (necesidades empresa).' },
        { id: 'demanda_tutela', label: 'Demanda Tutela de Derechos Fundamentales', prompt_extra: 'Procedimiento tutela laboral Art. 485 y ss. CT. Indicar: derecho fundamental vulnerado (dignidad, intimidad, no discriminación), acto empresarial lesivo e indicios suficientes (no prueba plena). La carga probatoria se invierte al empleador Art. 493 CT. Describir conducta lesiva, nexo causal y daño. Petición: declaración de vulneración + reparación daño moral + multa Art. 489 CT.' },
        { id: 'nulidad_laboral', label: 'Recurso de Nulidad Laboral', prompt_extra: 'Art. 477 y ss. CT. Plazo 10 días hábiles desde notificación sentencia. Causales: Art. 477 (infracción garantías constitucionales) o Art. 478 (infracciones procesales específicas). Indicar causal concreta, normas infringidas y cómo influyeron en lo dispositivo. Efecto: nulidad del juicio oral y reenvío a tribunal no inhabilitado.' },
        { id: 'demanda_desafuero', label: 'Solicitud de Desafuero', prompt_extra: 'Art. 174 CT. El empleador solicita autorización judicial para despedir trabajador con fuero. Indicar: tipo de fuero (sindical, maternidad, candidato a director), causal de despido invocada (Art. 159, 160 o 161 CT) y su acreditación. El tribunal califica si la causal es plausible.' },
        { id: 'conciliacion_laboral', label: 'Propuesta de Conciliación', prompt_extra: 'Documento para audiencia preparatoria Art. 453 CT. Indicar: monto ofrecido, forma de pago, plazo y finiquito propuesto. Justificar por qué la propuesta es razonable considerando los montos en disputa y la prueba disponible. Redactar en términos claros para facilitar el acuerdo.' },
    ],
    familia: [
        { id: 'demanda_alimentos', label: 'Demanda de Alimentos', prompt_extra: 'Ley 19.968 + Art. 321 y ss. Código Civil. Tribunal: Juzgado de Familia. Indicar: vínculo alimentario, necesidades del alimentario (educación, salud, vivienda, vestuario) y capacidad económica del alimentante. Solicitar alimentos provisorios Art. 327 CC desde la presentación. Petición: suma mensual indexada a UF o porcentaje de remuneración. Si hay hijos mencionar Art. 3 Ley 14.908 (porcentaje mínimo legal).' },
        { id: 'divorcio_mutuo', label: 'Divorcio de Mutuo Acuerdo', prompt_extra: 'Art. 55 inc. 1 Ley 19.947 (LMC). Ambos cónyuges de acuerdo. Requisito: cese convivencia al menos 1 año. Incluir acuerdo completo sobre: alimentos, cuidado personal, relación directa y regular, compensación económica si procede. Acreditar fecha de cese de convivencia (escritura pública o acta ante ORC Art. 22 LMC).' },
        { id: 'divorcio_unilateral', label: 'Demanda de Divorcio Unilateral', prompt_extra: 'Art. 55 inc. 3 LMC. Sin acuerdo del otro cónyuge. Requisito: cese convivencia al menos 3 años. Acreditar cese. Si hay hijos solicitar regulación provisional de cuidado personal y relación directa. Indicar si se solicita compensación económica Art. 62 LMC.' },
        { id: 'tuicion', label: 'Demanda de Cuidado Personal', prompt_extra: 'Art. 225 y ss. Código Civil + Ley 19.968. Principio rector: interés superior del niño Art. 222 CC y Convención Derechos del Niño. Describir: situación actual de convivencia, aptitudes parentales del demandante, carencias del demandado. Solicitar: cuidado personal + alimentos + relación directa y regular para el otro progenitor. Pedir informe y evaluación pericial si hay riesgo.' },
        { id: 'relacion_directa', label: 'Relación Directa y Regular', prompt_extra: 'Art. 229 CC. Derecho-deber del padre/madre que no tiene cuidado personal. Proponer régimen concreto: días específicos, horarios, vacaciones, feriados y días especiales (cumpleaños, Navidad, etc.). Indicar si hay obstaculización de la relación (incumplimiento Art. 229 CC). Solicitar régimen provisorio urgente.' },
        { id: 'denuncia_vif', label: 'Denuncia Violencia Intrafamiliar', prompt_extra: 'Ley 20.066 sobre VIF. Describir episodio(s) de violencia: tipo (física, psicológica, económica), fecha, lugar, testigos y lesiones si las hay. Solicitar medidas cautelares urgentes Art. 92 Ley 19.968: prohibición de acercamiento, salida del hogar, retención de armas. Pedir evaluación psicológica urgente de la víctima. Mencionar si hay hijos presentes o afectados.' },
    ],
};

// Rellena el select #esc-tipo según la materia de la causa seleccionada.
// NOTA: La versión definitiva (con KEY_MAP extendido y TIPOS_ESCRITOS_EXTRA) está
// en 11b-escritos-ui.js y sobreescribe esta función al cargar.
// Este stub actúa solo si 11b no está disponible (carga fallida).
// ── Stub de compatibilidad ─────────────────────────────────────────
// La versión extendida (con KEY_MAP completo, TIPOS_ESCRITOS_EXTRA
// y actualización de plantillas propias) está en 11b-escritos-ui.js
// y sobreescribe esta al cargar. Este stub actúa solo si 11b no está.
function rellenarTiposEscritos(materiaId) {
    const sel = document.getElementById('esc-tipo');
    if (!sel) return;
    const key = (materiaId || 'civil').toLowerCase().replace(/[áéíóú\s]/g, m => ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', ' ': '' }[m] || m));
    const tipos = TIPOS_ESCRITOS[key] || TIPOS_ESCRITOS.civil;
    sel.innerHTML = tipos.map(t =>
        `<option value="${t.id}" data-label="${t.label}" data-prompt="${encodeURIComponent(t.prompt_extra)}">${t.label}</option>`
    ).join('');
}

// Obtiene el prompt_extra del tipo de escrito seleccionado actualmente
function getPromptExtraEscrito() {
    const opt = document.getElementById('esc-tipo')?.selectedOptions?.[0];
    return opt ? decodeURIComponent(opt.dataset.prompt || '') : '';
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO IA — ASK MY CASE & GEMINI INTEGRATION v1.1
// ═══════════════════════════════════════════════════════════════════

function askIAExtractContext() {
    let ctx = "ESTADO DE LA OFICINA:\n";
    ctx += `- Causas activas: ${DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').length}\n`;
    ctx += `- Clientes: ${DB.clientes.length}\n`;
    ctx += `- Documentos indexados: ${DB.documentos.length}\n`;
    ctx += `- Eventos/Alertas activas: ${DB.alertas.filter(a => a.estado === 'activa').length}\n\n`;

    ctx += "LISTADO DE CAUSAS ACTIVAS:\n";
    DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').forEach(c => {
        ctx += `[ID ${c.id}] ${c.caratula} - Rama: ${c.rama || 'General'}. Juzgado: ${c.juzgado || 'N/A'}. Avance: ${c.porcentajeAvance}%\n`;
    });

    ctx += "\nPRÓXIMOS PLAZOS CRÍTICOS:\n";
    const hoyStr = new Date().toISOString().split('T')[0];
    DB.alertas.filter(a => a.estado === 'activa' && a.prioridad === 'critica').slice(0, 5).forEach(a => {
        ctx += `- ${a.fecha}: ${a.titulo}\n`;
    });

    return ctx;
}


const GEMINI_KEY_STORAGE = 'LEXIUM_GEMINI_KEY';
const GEMINI_MODEL_STORAGE = 'LEXIUM_GEMINI_MODEL';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Catálogo de modelos conocidos (feb 2026) ──────────────────────
// gemini-1.5-x retirados el 29 abr 2025 → 404 garantizado.
// gemini-2.0-x serán retirados el 31 mar 2026.
// gemini-2.5-x son la familia actual y recomendada.
const GEMINI_CATALOG = [
    {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        badge: 'RECOMENDADO',
        badgeColor: '#15803d',
        desc: 'El más equilibrado: rápido, inteligente y económico. Requiere billing.',
        billing: true,
    },
    {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        badge: 'MÁS POTENTE',
        badgeColor: '#6d28d9',
        desc: 'El modelo más capaz para razonamiento complejo. Mayor latencia y costo.',
        billing: true,
    },
    {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash-Lite',
        badge: 'PREVIEW',
        badgeColor: '#b45309',
        desc: 'Más rápido y barato de la familia 2.5. En preview, puede tener cambios.',
        billing: true,
    },
    {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash',
        badge: 'RETIRO MAR 2026',
        badgeColor: '#dc2626',
        desc: 'Versión anterior. Funcional hasta el 31 mar 2026. Requiere billing.',
        billing: true,
    },
    {
        id: 'gemini-2.0-flash-lite',
        label: 'Gemini 2.0 Flash-Lite',
        badge: 'RETIRO MAR 2026',
        badgeColor: '#dc2626',
        desc: 'El más permisivo en cuotas de la familia 2.0. Retiro el 31 mar 2026.',
        billing: false,
    },
];

// ── Stubs de compatibilidad ────────────────────────────────────────
// Las funciones definitivas (async, multi-proveedor) son definidas por
// 12-ia-providers.js que carga después de este módulo y las sobreescribe.
// Estos stubs solo actúan si 12-ia-providers.js no está disponible.
function iaGetModel(providerId) {
    // Fallback sync (solo Gemini) — sobreescrito por 12-ia-providers.js
    return _lsGet(GEMINI_MODEL_STORAGE) || GEMINI_CATALOG[0].id;
}
function iaSetModel(id) {
    // Fallback — sobreescrito por 12-ia-providers.js
    _lsSet(GEMINI_MODEL_STORAGE, id);
}

// Renderiza los cards de selección de modelo en config-ia
function iaRenderModelList() {
    const container = document.getElementById('ia-model-list');
    if (!container) return;
    const current = iaGetModel();
    container.innerHTML = GEMINI_CATALOG.map(m => `
                <label style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px;
                    border:2px solid ${m.id === current ? '#7c3aed' : 'var(--border)'};
                    border-radius:10px; cursor:pointer; background:${m.id === current ? '#faf5ff' : 'white'};
                    transition:all 0.15s; width:100%; box-sizing:border-box;">
                    <input type="radio" name="ia-model-radio" value="${m.id}"
                        ${m.id === current ? 'checked' : ''}
                        onchange="iaSetModel('${m.id}'); iaRenderModelList();"
                        style="margin-top:4px; accent-color:#7c3aed; flex-shrink:0; width:16px; height:16px;">
                    <div style="flex:1; min-width:0; overflow:hidden;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:0.86rem; font-weight:700; color:var(--t); white-space:nowrap;">${m.label}</span>
                            <span style="font-size:0.58rem; font-weight:700; font-family:'IBM Plex Mono',monospace;
                                background:${m.badgeColor}18; color:${m.badgeColor};
                                border:1px solid ${m.badgeColor}40;
                                padding:1px 7px; border-radius:20px; letter-spacing:0.06em;
                                white-space:nowrap; flex-shrink:0;">${m.badge}</span>
                        </div>
                        <div style="font-size:0.77rem; color:var(--t2); margin-top:3px; line-height:1.4;">${m.desc}</div>
                        <div style="font-size:0.71rem; font-family:'IBM Plex Mono',monospace; color:#94a3b8; margin-top:2px;">${m.id}</div>
                    </div>
                </label>`).join('');
}

// Detecta modelos disponibles con la key actual
async function iaDescubrirModelos() {
    const key = await Promise.resolve(iaGetKey('gemini'));  // compatible sync/async
    const st = document.getElementById('ia-model-discover-status');
    if (!key) { st.innerHTML = '<span style="color:#dc2626;">Configure primero su API Key.</span>'; return; }
    st.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando modelos disponibles…';
    try {
        const resp = await fetch(`${GEMINI_API_BASE}?key=${key}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const disponibles = (data.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(m => m.startsWith('gemini-2'));

        // Marcar disponibilidad en catálogo
        const dispSet = new Set(disponibles);
        const enCatalogo = GEMINI_CATALOG.filter(m => dispSet.has(m.id)).map(m => m.id);
        const extras = disponibles.filter(id => !GEMINI_CATALOG.find(m => m.id === id));

        st.innerHTML = `
                    <div style="padding:10px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
                        <div style="font-size:0.78rem; font-weight:600; color:#14532d; margin-bottom:6px;">
                            <i class="fas fa-check-circle"></i> ${disponibles.length} modelos detectados con su key
                        </div>
                        <div style="font-size:0.74rem; font-family:'IBM Plex Mono',monospace; color:#166534; line-height:1.7;">
                            ${enCatalogo.length ? enCatalogo.map(id => `✓ ${id}`).join('<br>') : ''}
                            ${extras.length ? extras.map(id => `◎ ${id} <span style="color:#94a3b8">(no en catálogo)</span>`).join('<br>') : ''}
                        </div>
                    </div>`;
    } catch (e) {
        st.innerHTML = `<span style="color:#dc2626; font-size:0.78rem;"><i class="fas fa-times-circle"></i> Error al listar modelos: ${e.message}</span>`;
    }
}

// ── Helpers de API Key ────────────────────────────────────────────
// ⚠️  NOTA DE SEGURIDAD: Esta implementación almacena la API key en
// localStorage y la envía directamente desde el frontend (cliente).
// Para producción, mover las llamadas a un backend propio (Node/Python)
// con la key en variables de entorno del servidor.
// ── Stubs de compatibilidad ────────────────────────────────────────
// Las funciones definitivas (async, multi-proveedor) son definidas por
// 12-ia-providers.js que carga después de este módulo y las sobreescribe.
// Estos stubs solo actúan si 12-ia-providers.js no está disponible.
// NO llamar a estas funciones directamente: usar await iaGetKey(providerId).
function iaGetKey(providerId) {
    // Fallback sync (solo Gemini, sin cifrado) — sobreescrito por 12-ia-providers.js
    return _lsGet(GEMINI_KEY_STORAGE) || '';
}

function iaGuardarKey() {
    // Delegado a 12-ia-providers.js
    if (typeof iaGuardarKeyProvider === 'function') {
        const key = document.getElementById('ia-api-key-input')?.value.trim();
        if (key) iaGuardarKeyProvider('gemini', key);
    }
}

function iaEliminarKey() {
    // Delegado a 12-ia-providers.js (_iaEliminarKeyUI es la función real)
    if (typeof _iaEliminarKeyUI === 'function') {
        _iaEliminarKeyUI('gemini');
    }
}

function iaToggleVerKey() {
    const inp = document.getElementById('ia-api-key-input');
    const icon = document.getElementById('ia-eye-icon');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

async function iaTestKey() {
    const key = (await Promise.resolve(iaGetKey('gemini'))) || document.getElementById('ia-api-key-input').value.trim();
    if (!key) { showError('Primero ingrese y guarde una API Key.'); return; }
    const st = document.getElementById('ia-key-status');
    const modelLabel = await Promise.resolve(iaGetModel('gemini'));
    st.innerHTML = '<span style="color:#1d4ed8;"><i class="fas fa-spinner fa-spin"></i> Probando conexión con ' + modelLabel + '…</span>';
    try {
        await geminiCall('Responde solo con: OK', key);
        st.innerHTML = `<span style="color:#15803d;"><i class="fas fa-check-circle"></i>
                    Conexión exitosa con <strong>${modelLabel}</strong> ✓</span>`;
    } catch (e) {
        const msg = e.message || '';
        const es429 = e.status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota');
        const es404 = e.status === 404 || msg.includes('404') || msg.includes('not found');
        if (es429) {
            st.innerHTML = `<span style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i>
                        <strong>Cuota excedida (429).</strong> Active facturación en Google Cloud Console y verifique que "Generative Language API" esté habilitada.
                        Use el botón "Detectar modelos disponibles" para ver qué tiene acceso con su key.</span>`;
        } else if (es404) {
            st.innerHTML = `<span style="color:#dc2626;"><i class="fas fa-times-circle"></i>
                        Modelo <strong>${modelLabel}</strong> no encontrado (404). Pruebe otro modelo en el selector de arriba.</span>`;
        } else {
            st.innerHTML = `<span style="color:#dc2626;"><i class="fas fa-times-circle"></i> Error: ${msg}</span>`;
        }
    }
}

// ── Función central de llamada a Gemini ───────────────────────────
// Usa el modelo seleccionado por el usuario como primario.
// Si falla con 429 o 404, hace fallback por el catálogo en orden.

// ── Activar auto-guardado cada 30 segundos ────────────────────────
setInterval(__autoSave, 30000);

// ── Panel switcher para Clientes / Control Financiero ─────────────
window.mostrarPanelClientes = function (panelId, btn) {
    // Race-proof: si el usuario cambia muy rápido entre tabs, ignorar renders atrasados
    if (typeof window.__hubClientesPanelToken !== 'number') window.__hubClientesPanelToken = 0;
    const token = ++window.__hubClientesPanelToken;

    const apply = () => {
        if (token !== window.__hubClientesPanelToken) return;
        // Ocultar todos los panels dentro de #clientes
        document.querySelectorAll('#clientes .hub-panel').forEach(p => p.style.display = 'none');
        // Mostrar el panel seleccionado
        const panel = document.getElementById(panelId);
        if (panel) panel.style.display = 'block';
        // Actualizar estado visual de los hub-tabs
        document.querySelectorAll('#clientes .hub-tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');

        // Si se abre Control Financiero, recargar los selects de honorarios
        if (panelId === 'financiero-panel') {
            try {
                if (typeof RenderBus !== 'undefined' && RenderBus?.render) {
                    RenderBus.render('selectors');
                } else if (typeof renderAll === 'function') {
                    renderAll();
                }
            } catch (_) {}
            try {
                // Refrescar UI del Control Financiero (resumen/estado) sin re-render global
                setTimeout(() => {
                    try { if (typeof renderHonorariosResumen === 'function') renderHonorariosResumen(); } catch (_) {}
                    try { if (typeof uiActualizarHonorariosVista === 'function') uiActualizarHonorariosVista(); } catch (_) {}
                    try {
                        const v = (document.getElementById('hr-causa-sel')?.value || '').toString().trim();
                        if (v && typeof uiRenderPlanPagos === 'function') uiRenderPlanPagos(v);
                        if (v && typeof uiRenderPagosList === 'function') uiRenderPagosList(v);
                    } catch (_) {}
                }, 0);
            } catch (_) {}
            try { if (typeof renderHonorarios === 'function') renderHonorarios(); } catch (_) {}
        }
    };

    try {
        requestAnimationFrame(apply);
    } catch (_) {
        setTimeout(apply, 0);
    }
};
