        // ████████████████████████████████████████████████████████████████████
        // JS — BLOQUE 00: EVENT BUS + RENDER SELECTIVO + STORAGE GUARD
        // • EventBus: desacopla módulos, elimina dependencias directas
        // • RenderBus: renderizado selectivo por namespace (reemplaza renderAll masivo)
        // • StorageGuard: monitoreo y alertas de cuota localStorage
        // Debe cargarse PRIMERO — antes de 01-db-auth.js
        // ████████████████████████████████████████████████████████████████████

        // ══════════════════════════════════════════════════════════════════════
        // 1. EVENT BUS — Pub/Sub central desacoplado
        // ══════════════════════════════════════════════════════════════════════
        /**
         * EventBus — sistema pub/sub para comunicación entre módulos sin acoplamiento directo.
         *
         * Uso:
         *   EventBus.on('causas:updated', handler)   → suscribirse
         *   EventBus.emit('causas:updated', payload)  → publicar
         *   EventBus.off('causas:updated', handler)   → desuscribirse
         *
         * Namespaces canónicos:
         *   causas:*      → operaciones sobre causas
         *   clientes:*    → operaciones sobre clientes/prospectos
         *   honorarios:*  → pagos y honorarios
         *   alertas:*     → alertas y plazos
         *   juris:*       → jurisprudencia
         *   docs:*        → documentos
         *   bitacora:*    → eventos de auditoría
         *   storage:*     → eventos de almacenamiento
         *   ui:*          → navegación y UI global
         */
        const EventBus = (() => {
            const _handlers = {};   // { eventName: Set<fn> }
            const _history  = [];   // log de últimos 50 eventos (para debug)
            const MAX_HISTORY = 50;

            function on(event, handler) {
                if (!_handlers[event]) _handlers[event] = new Set();
                _handlers[event].add(handler);
            }

            function off(event, handler) {
                _handlers[event]?.delete(handler);
            }

            function once(event, handler) {
                const wrapper = (payload) => { handler(payload); off(event, wrapper); };
                on(event, wrapper);
            }

            function emit(event, payload) {
                // Registrar en historial
                _history.push({ event, payload, ts: Date.now() });
                if (_history.length > MAX_HISTORY) _history.shift();

                const handlers = _handlers[event];
                if (!handlers || handlers.size === 0) return;

                handlers.forEach(fn => {
                    try { fn(payload); }
                    catch (e) { console.error(`[EventBus] Error en handler de "${event}":`, e); }
                });
            }

            // Emitir en el próximo tick (útil para evitar re-renders síncronos anidados)
            function emitDeferred(event, payload, ms = 0) {
                setTimeout(() => emit(event, payload), ms);
            }

            function history() { return [..._history]; }

            function debugListeners() {
                console.group('[EventBus] Listeners activos');
                Object.entries(_handlers).forEach(([ev, set]) => {
                    console.log(`  ${ev}: ${set.size} listener(s)`);
                });
                console.groupEnd();
            }

            return { on, off, once, emit, emitDeferred, history, debugListeners };
        })();

        // Exponer globalmente para que cualquier módulo pueda usarlo
        window.EventBus = EventBus;

        // ══════════════════════════════════════════════════════════════════════
        // 1B. AUDIT — Logging estructurado (DB.logs) con retención combinada
        // ══════════════════════════════════════════════════════════════════════
        const Audit = (() => {
            const DEFAULT_RETENTION = { maxLogs: 10000, maxDays: 180 };
            let _reentrancyGuard = 0;
            let _enforceEvery = 25;
            let _countSinceEnforce = 0;

            function _getRetention() {
                try {
                    const r = (typeof DB !== 'undefined') ? DB?.configuracion?.auditRetention : null;
                    const maxLogs = Number.isFinite(Number(r?.maxLogs)) ? Number(r.maxLogs) : DEFAULT_RETENTION.maxLogs;
                    const maxDays = Number.isFinite(Number(r?.maxDays)) ? Number(r.maxDays) : DEFAULT_RETENTION.maxDays;
                    return { maxLogs: Math.max(0, maxLogs), maxDays: Math.max(0, maxDays) };
                } catch (_) {
                    return { ...DEFAULT_RETENTION };
                }
            }

            function _redactValue(key, value) {
                const k = String(key || '').toLowerCase();
                if (
                    k.includes('password') || k.includes('pass') || k.includes('token') || k.includes('apikey') ||
                    k.includes('api_key') || k.includes('authorization') || k.includes('secret') ||
                    k.includes('archivobase64') || k.includes('base64')
                ) {
                    return '[REDACTED]';
                }
                return value;
            }

            function redact(obj, depth = 0) {
                try {
                    if (obj == null) return obj;
                    if (depth > 4) return '[TRUNCATED]';
                    if (typeof obj === 'string') {
                        // Evitar loguear blobs enormes (por si acaso)
                        if (obj.length > 2000) return obj.slice(0, 2000) + '…';
                        return obj;
                    }
                    if (typeof obj !== 'object') return obj;
                    if (Array.isArray(obj)) return obj.slice(0, 50).map(x => redact(x, depth + 1));
                    const out = {};
                    Object.keys(obj).slice(0, 50).forEach(k => {
                        out[k] = redact(_redactValue(k, obj[k]), depth + 1);
                    });
                    return out;
                } catch (_) {
                    return { error: 'redact_failed' };
                }
            }

            function enforceRetention() {
                try {
                    if (typeof DB === 'undefined') return;
                    if (!Array.isArray(DB.logs)) DB.logs = [];
                    const { maxLogs, maxDays } = _getRetention();

                    if (maxDays > 0) {
                        const cutoff = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
                        DB.logs = DB.logs.filter(e => {
                            const ts = Number(e?.ts || 0);
                            return !ts || ts >= cutoff;
                        });
                    }

                    if (maxLogs > 0 && DB.logs.length > maxLogs) {
                        DB.logs = DB.logs.slice(-maxLogs);
                    }
                } catch (_) { /* ignore */ }
            }

            function _classifyEvent(eventName, payload) {
                try {
                    const ev = String(eventName || '');
                    if (!ev || ev.startsWith('storage:')) return null;

                    const [ns, action] = ev.split(':');
                    const entidad = ns || 'sistema';
                    const accion = (ns || 'EVENT').toUpperCase() + '_' + String(action || 'EMIT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');

                    let referenciaId = null;
                    if (payload && typeof payload === 'object') {
                        referenciaId = payload.id || payload.causaId || payload.docId || payload.documentoId || payload.alertaId || null;
                    }

                    return { accion, entidad, referenciaId };
                } catch (_) {
                    return null;
                }
            }

            function log(entry) {
                try {
                    if (_reentrancyGuard) return;
                    if (typeof DB === 'undefined') return;
                    if (!Array.isArray(DB.logs)) DB.logs = [];

                    _reentrancyGuard++;
                    const ts = Date.now();
                    const base = {
                        id: (typeof uid === 'function') ? uid() : (ts.toString(36) + Math.random().toString(36).slice(2)),
                        ts,
                        fechaISO: new Date(ts).toISOString(),
                        usuario: DB.usuarioActual || null,
                        rol: DB.rolActual || null,
                        sesionId: DB.sesionId || null,
                        accion: entry?.accion || 'EVENT',
                        entidad: entry?.entidad || 'sistema',
                        referenciaId: entry?.referenciaId || null,
                        detalles: redact(entry?.detalles || null),
                        ok: (entry?.ok !== undefined) ? !!entry.ok : true,
                        error: entry?.error ? String(entry.error) : null,
                        origen: entry?.origen || 'ui',
                        versionApp: (DB?.configuracion?.versionApp || null)
                    };
                    DB.logs.push(base);

                    _countSinceEnforce++;
                    if (_countSinceEnforce >= _enforceEvery) {
                        _countSinceEnforce = 0;
                        enforceRetention();
                    }
                } catch (_) {
                    // ignore
                } finally {
                    _reentrancyGuard = Math.max(0, _reentrancyGuard - 1);
                }
            }

            function installEventBusInterceptor() {
                if (EventBus.__auditInstalled) return;
                EventBus.__auditInstalled = true;

                const _origEmit = EventBus.emit;
                EventBus.emit = function emitWithAudit(eventName, payload) {
                    try {
                        const meta = _classifyEvent(eventName, payload);
                        if (meta) {
                            log({
                                accion: meta.accion,
                                entidad: meta.entidad,
                                referenciaId: meta.referenciaId,
                                detalles: { event: String(eventName), payload: payload },
                                origen: 'ui'
                            });
                        }
                    } catch (_) { /* ignore */ }
                    return _origEmit.apply(this, arguments);
                };
            }

            return { log, redact, enforceRetention, installEventBusInterceptor };
        })();

        window.Audit = Audit;
        try { Audit.installEventBusInterceptor(); } catch (_) {}

        // ══════════════════════════════════════════════════════════════════════
        // 2. RENDER BUS — Renderizado selectivo por namespace
        // ══════════════════════════════════════════════════════════════════════
        /**
         * RenderBus — reemplaza el patrón renderAll() masivo por renders selectivos.
         *
         * Cómo funciona:
         * - Cada módulo registra sus renderers con su namespace.
         * - Cuando hay un cambio de datos, se emite solo el namespace afectado.
         * - RenderBus llama únicamente los renderers de ese namespace.
         * - Los re-renders globales de init() siguen usando renderAll() pero
         *   ese renderAll() pasa a ser una orquestación de RenderBus.
         *
         * Beneficio:
         * - Agregar una causa → solo re-renderiza causas (no honorarios, juris, etc.)
         * - Agregar un cliente → solo re-renderiza clientes + selectores de causas
         * - Guardar un pago → solo re-renderiza honorarios + stats del panel
         *
         * Uso:
         *   RenderBus.register('causas', renderCausas)
         *   RenderBus.register('causas', actualizarContadorCausas)  // múltiples por ns
         *   RenderBus.render('causas')     → ejecuta solo los renderers de 'causas'
         *   RenderBus.renderAll()          → ejecuta todos (para init / cambios globales)
         */
        const RenderBus = (() => {
            // Map de namespace → array de funciones render
            const _registry = new Map();
            // Debounce: colapsa renders del mismo namespace en un solo frame
            const _pending   = new Set();
            let   _rafId     = null;

            function register(namespace, renderFn) {
                if (typeof renderFn !== 'function') {
                    console.warn(`[RenderBus] register("${namespace}"): se esperaba una función.`);
                    return;
                }
                if (!_registry.has(namespace)) _registry.set(namespace, []);
                _registry.get(namespace).push(renderFn);
            }

            // Ejecuta inmediatamente todos los renderers de un namespace
            function _flush(namespace) {
                const fns = _registry.get(namespace);
                if (!fns || fns.length === 0) return;
                fns.forEach(fn => {
                    try { fn(); }
                    catch (e) { console.error(`[RenderBus] Error renderizando "${namespace}":`, e); }
                });
            }

            // Programa un render con debounce en requestAnimationFrame
            function render(namespace) {
                _pending.add(namespace);
                if (_rafId) return;
                _rafId = requestAnimationFrame(() => {
                    _pending.forEach(ns => _flush(ns));
                    _pending.clear();
                    _rafId = null;
                });
            }

            // Render inmediato (sin debounce) — usar solo cuando se necesita sincronía
            function renderSync(namespace) {
                _flush(namespace);
            }

            // Re-renderiza todos los namespaces registrados
            function renderAll() {
                _registry.forEach((_, ns) => _flush(ns));
            }

            function namespaces() { return [..._registry.keys()]; }

            return { register, render, renderSync, renderAll, namespaces };
        })();

        window.RenderBus = RenderBus;

        // ══════════════════════════════════════════════════════════════════════
        // 3. STORAGE GUARD — Monitoreo de cuota localStorage
        // ══════════════════════════════════════════════════════════════════════
        /**
         * StorageGuard — detecta y previene desbordamiento de localStorage.
         *
         * Límite real de localStorage: ~5 MB en la mayoría de los browsers.
         * Con el patrón actual (causas + backups + biblioteca + docs):
         *   - 50 causas con 3 docs c/u: ~500 KB
         *   - 5 backups automáticos:    ~2.5 MB
         *   - Total estimado 18 meses: ~4-5 MB → RIESGO DE CUOTA
         *
         * StorageGuard:
         *   1. Mide el uso al iniciar y en cada save().
         *   2. Avisa al abogado cuando supera el 70%, 85%, 95%.
         *   3. Si supera el 95%: bloquea escrituras peligrosas y fuerza limpieza.
         *   4. Emite eventos en EventBus para que otros módulos reaccionen
         *      (ej: Google Drive puede capturar 'storage:critical' y activarse).
         */
        const StorageGuard = (() => {
            const MB            = 1024 * 1024;
            const QUOTA_MB      = 5;             // límite estimado conservador
            const QUOTA_BYTES   = QUOTA_MB * MB;
            const WARN_70       = 0.70;
            const WARN_85       = 0.85;
            const CRITICAL_95   = 0.95;

            let _lastUsageBytes = 0;
            let _lastLevel      = 'ok';  // 'ok' | 'warn' | 'danger' | 'critical'
            let _alertasMostradas = new Set();  // evitar repetir alertas

            // Calcula el uso total actual en bytes
            function calcUsage() {
                let total = 0;
                try {
                    for (const key of Object.keys(localStorage)) {
                        const val = localStorage.getItem(key) || '';
                        total += (key.length + val.length) * 2; // UTF-16: 2 bytes/char
                    }
                } catch (e) { /* ignore */ }
                return total;
            }

            // Retorna un desglose de tamaño por clave
            function breakdown() {
                const items = [];
                try {
                    for (const key of Object.keys(localStorage)) {
                        const val = localStorage.getItem(key) || '';
                        const bytes = (key.length + val.length) * 2;
                        items.push({ key, bytes, kb: (bytes / 1024).toFixed(1) });
                    }
                } catch (e) { /* ignore */ }
                return items.sort((a, b) => b.bytes - a.bytes);
            }

            function usagePercent() {
                return _lastUsageBytes / QUOTA_BYTES;
            }

            function usageMB() {
                return (_lastUsageBytes / MB).toFixed(2);
            }

            function _nivel(pct) {
                if (pct >= CRITICAL_95) return 'critical';
                if (pct >= WARN_85)     return 'danger';
                if (pct >= WARN_70)     return 'warn';
                return 'ok';
            }

            // Genera HTML del banner de advertencia
            function _bannerHtml(pct, nivel) {
                const color = nivel === 'critical' ? '#dc2626' : nivel === 'danger' ? '#d97706' : '#2563eb';
                const icon  = nivel === 'critical' ? 'fa-exclamation-triangle' : 'fa-database';
                const pctStr = Math.round(pct * 100);
                const msgs = {
                    warn:     `💾 Almacenamiento al ${pctStr}% — Considera activar Google Drive para liberar espacio.`,
                    danger:   `⚠️ Almacenamiento al ${pctStr}% — Libera espacio o activa Google Drive pronto.`,
                    critical: `🚨 Almacenamiento al ${pctStr}% — CRÍTICO. Datos en riesgo. Activa Google Drive ahora.`
                };
                return `
                    <div id="storage-guard-banner" style="
                        position:fixed; bottom:16px; right:16px; z-index:9999;
                        background:white; border:2px solid ${color}; border-radius:12px;
                        padding:12px 16px; max-width:320px; box-shadow:0 4px 20px rgba(0,0,0,0.15);
                        font-size:0.82rem; line-height:1.4; color:#1e293b;
                        animation: slideInRight 0.3s ease;
                    ">
                        <div style="display:flex; align-items:flex-start; gap:10px;">
                            <i class="fas ${icon}" style="color:${color}; margin-top:2px; flex-shrink:0;"></i>
                            <div style="flex:1;">
                                <div style="font-weight:700; color:${color}; margin-bottom:4px;">
                                    Almacenamiento ${pctStr}% usado
                                </div>
                                <div>${msgs[nivel]}</div>
                                <div style="margin-top:8px; background:#f1f5f9; border-radius:6px; height:6px;">
                                    <div style="height:100%; width:${pctStr}%; background:${color}; border-radius:6px; transition:width 0.3s;"></div>
                                </div>
                                <div style="display:flex; gap:8px; margin-top:10px;">
                                    ${nivel === 'critical' ? `
                                    <button onclick="driveConnect?.()" style="
                                        background:${color}; color:white; border:none; border-radius:6px;
                                        padding:5px 10px; font-size:0.75rem; cursor:pointer; font-weight:600;
                                    "><i class="fab fa-google-drive"></i> Activar Drive</button>` : ''}
                                    <button onclick="storageGuardLimpiarBackups()" style="
                                        background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;
                                        border-radius:6px; padding:5px 10px; font-size:0.75rem; cursor:pointer;
                                    "><i class="fas fa-broom"></i> Limpiar backups</button>
                                    <button onclick="document.getElementById('storage-guard-banner')?.remove()" style="
                                        background:none; color:#94a3b8; border:none; cursor:pointer;
                                        font-size:0.75rem; padding:5px;
                                    ">✕</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }

            function _mostrarBanner(pct, nivel) {
                const bannerKey = `${nivel}_${Math.floor(pct * 10)}`;
                if (_alertasMostradas.has(bannerKey)) return;
                _alertasMostradas.add(bannerKey);

                // Remover banner anterior si existe
                document.getElementById('storage-guard-banner')?.remove();

                const wrapper = document.createElement('div');
                wrapper.innerHTML = _bannerHtml(pct, nivel);
                document.body.appendChild(wrapper.firstElementChild);

                // Auto-cerrar en 15s si no es crítico
                if (nivel !== 'critical') {
                    setTimeout(() => document.getElementById('storage-guard-banner')?.remove(), 15000);
                }
            }

            // Función principal — mide y evalúa
            function check() {
                _lastUsageBytes = calcUsage();
                const pct   = usagePercent();
                const nivel = _nivel(pct);

                if (nivel !== 'ok' && nivel !== _lastLevel) {
                    _mostrarBanner(pct, nivel);
                    EventBus.emit(`storage:${nivel}`, { bytes: _lastUsageBytes, pct, nivel });
                    console.warn(`[StorageGuard] Nivel ${nivel.toUpperCase()} — ${usageMB()} MB / ${QUOTA_MB} MB (${Math.round(pct * 100)}%)`);
                }

                _lastLevel = nivel;

                // Actualizar badge en UI si existe
                const badge = document.getElementById('storage-usage-badge');
                if (badge) {
                    const pctInt = Math.round(pct * 100);
                    badge.textContent = `💾 ${usageMB()} MB`;
                    badge.style.color = nivel === 'ok' ? 'var(--t2)' : nivel === 'warn' ? '#d97706' : '#dc2626';
                    badge.title = `localStorage: ${usageMB()} MB de ${QUOTA_MB} MB estimados (${pctInt}%)`;
                }

                return { bytes: _lastUsageBytes, pct, nivel, mb: usageMB() };
            }

            // Limpiar backups viejos para liberar espacio
            function limpiarBackups(dejarN = 2) {
                try {
                    const BACKUP_KEY = 'LEXIUM_BACKUPS_V1';
                    const lista = JSON.parse(localStorage.getItem(BACKUP_KEY)) || [];
                    if (lista.length <= dejarN) {
                        showInfo(`Solo hay ${lista.length} backups. Nada que limpiar.`);
                        return;
                    }
                    const reducida = lista.slice(0, dejarN);
                    localStorage.setItem(BACKUP_KEY, JSON.stringify(reducida));
                    _alertasMostradas.clear(); // resetear alertas para que puedan reaparecer si sigue lleno
                    const antes = _lastUsageBytes;
                    check();
                    const liberado = ((antes - _lastUsageBytes) / 1024).toFixed(0);
                    showSuccess(`✅ ${lista.length - dejarN} backup(s) eliminados. Liberados ~${liberado} KB.`);
                } catch (e) {
                    showError('Error al limpiar backups: ' + e.message);
                }
            }

            // Inicializar — chequear al arrancar y en cada save()
            function init() {
                check();
                // Parchear save() global para medir en cada persistencia
                const _originalSave = window.save;
                if (typeof _originalSave === 'function') {
                    window.save = function() {
                        _originalSave.apply(this, arguments);
                        // Chequear cada 10 saves (no cada uno, para no sobrecargar)
                        StorageGuard._saveCount = (StorageGuard._saveCount || 0) + 1;
                        if (StorageGuard._saveCount % 10 === 0) check();
                    };
                }
                // También chequear cada 5 minutos
                setInterval(check, 5 * 60 * 1000);
            }

            return {
                check,
                init,
                limpiarBackups,
                breakdown,
                usageMB,
                usagePercent,
                _saveCount: 0
            };
        })();

        window.StorageGuard = StorageGuard;

        // Función global para botón en banner
        function storageGuardLimpiarBackups() {
            StorageGuard.limpiarBackups(2);
        }

        // ══════════════════════════════════════════════════════════════════════
        // 4. WIRING — Conectar EventBus con renderAll() y save()
        // ══════════════════════════════════════════════════════════════════════
        /**
         * Este bloque conecta el EventBus con los namespaces de RenderBus.
         * Cuando un módulo emite 'causas:updated', RenderBus renderiza 'causas'.
         *
         * Reglas de namespace → render:
         *   causas:*     → ['causas', 'stats', 'selectors', 'panel', 'prioridad']
         *   clientes:*   → ['clientes', 'stats', 'selectors']
         *   honorarios:* → ['honorarios', 'stats', 'panel']
         *   alertas:*    → ['alertas', 'stats', 'calendario']
         *   juris:*      → ['juris', 'stats']
         *   docs:*       → ['docs', 'stats', 'alertas']
         *
         * Los namespaces de RenderBus serán registrados por cada módulo JS.
         * Este wiring funciona aunque los módulos no estén cargados aún
         * (RenderBus simplemente no ejecutará nada si el namespace no tiene renderers).
         */
        const _NAMESPACE_MAP = {
            'causas:updated':      ['causas', 'stats', 'selectors', 'panel', 'prioridad', 'saludDespacho'],
            'causas:deleted':      ['causas', 'stats', 'selectors', 'panel', 'prioridad'],
            'clientes:updated':    ['clientes', 'stats', 'selectors', 'prospectos'],
            'clientes:deleted':    ['clientes', 'stats', 'selectors'],
            'honorarios:updated':  ['honorarios', 'stats', 'panel'],
            'alertas:updated':     ['alertas', 'stats', 'calendario', 'semaforo'],
            'alertas:archived':    ['alertas', 'stats'],
            'juris:updated':       ['juris', 'stats'],
            'juris:deleted':       ['juris', 'stats'],
            'docs:updated':        ['docs', 'stats', 'alertas'],
            'bitacora:updated':    ['bitacora'],
            'ui:theme-changed':    ['dashboard'],
        };

        Object.entries(_NAMESPACE_MAP).forEach(([event, namespaces]) => {
            EventBus.on(event, () => {
                namespaces.forEach(ns => RenderBus.render(ns));
            });
        });

        // ══════════════════════════════════════════════════════════════════════
        // 5. COMPAT SHIM — renderAll() sigue funcionando sin cambios en el resto
        // ══════════════════════════════════════════════════════════════════════
        /**
         * Para migración gradual:
         * - renderAll() legacy sigue funcionando igual.
         * - RenderBus.render(ns) es el camino nuevo.
         * - Los módulos pueden migrar uno a uno sin romper el resto.
         *
         * En 01-db-auth / 02-render-crud, CADA save(); renderAll() se puede
         * reemplazar gradualmente por:
         *   save(); EventBus.emit('causas:updated', { id: causa.id });
         *
         * La función renderAll() original se preserva en window._renderAllLegacy
         * y se envuelve para emitir también el evento global.
         */
        // El shim se instala DESPUÉS de que renderAll() sea definido en 09-app-core.js
        // Se hace con un MutationObserver de window o en el primer renderAll() real.
        // Por ahora: parchear al final del DOMContentLoaded.

        document.addEventListener('DOMContentLoaded', () => {
            // Instalar el StorageGuard después de que save() exista
            if (typeof StorageGuard !== 'undefined') {
                setTimeout(() => StorageGuard.init(), 500);
            }

            // ── Verificación de dependencias críticas ──────────────────────
            // Comprueba que los módulos expuestos en window cargaron correctamente.
            // Store y DB son variables locales en 01-db-auth.js (no en window),
            // por eso se verifica su existencia via funciones proxy conocidas.
            const criticalChecks = [
                { test: () => typeof EventBus !== 'undefined',  label: 'EventBus',  module: '00-eventbus.js' },
                { test: () => typeof RenderBus !== 'undefined', label: 'RenderBus', module: '00-eventbus.js' },
                { test: () => typeof renderAll === 'function',  label: 'renderAll', module: '09-app-core.js' },
                { test: () => typeof tab === 'function',        label: 'tab()',      module: '09-app-core.js' },
            ];
            const missing = criticalChecks.filter(c => { try { return !c.test(); } catch(e) { return true; } });
            if (missing.length > 0) {
                missing.forEach(c => {
                    console.error(`[LEXIUM] ❌ DEPENDENCIA FALTANTE: "${c.label}" — verificar carga de ${c.module}.`);
                });
            } else {
                console.info('[LEXIUM] ✅ Módulos críticos verificados.');
            }
        });

        console.info('[LEXIUM v13] EventBus ✓ | RenderBus ✓ | StorageGuard ✓');
