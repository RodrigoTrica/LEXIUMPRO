/**
 * AppBogado — js/00-disk-storage.js
 * 
 * Reemplaza localStorage por almacenamiento cifrado en disco cuando
 * la app corre dentro de Electron. Si corre en navegador normal,
 * cae en localStorage como siempre (compatibilidad total).
 *
 * DEBE CARGARSE PRIMERO — antes de cualquier otro script JS.
 *
 * API pública (misma interfaz que localStorage):
 *   DiskStorage.getItem(key)       → string | null
 *   DiskStorage.setItem(key, val)  → void
 *   DiskStorage.removeItem(key)    → void
 *   DiskStorage.clear()            → void
 *   DiskStorage.isElectron         → boolean
 */

(function() {
    'use strict';

    const ES_ELECTRON = !!(window.electronAPI && window.electronAPI.esElectron);

    // ── Cache en memoria para lecturas síncronas ───────────────────────────────
    // Electron IPC es async, pero la app espera sync. Solución: cache en memoria
    // que se hidrata al inicio y se mantiene sincronizado.
    let _cache = {};
    let _inicializado = false;
    let _pendientes = [];  // callbacks esperando inicialización

    // Inicialización asíncrona: carga todos los datos del disco a memoria
    async function _init() {
        if (!ES_ELECTRON) { _inicializado = true; _flush(); return; }
        try {
            const claves = await window.electronAPI.storage.list();
            const promesas = claves.map(async (k) => {
                const valor = await window.electronAPI.storage.get(k);
                if (valor !== null) _cache[k] = valor;
            });
            await Promise.all(promesas);
            console.info(`[DiskStorage] Cargadas ${claves.length} claves desde disco.`);
        } catch(e) {
            console.error('[DiskStorage] Error al inicializar:', e);
        }
        _inicializado = true;
        _flush();
    }

    function _flush() {
        _pendientes.forEach(fn => fn());
        _pendientes = [];
    }

    // Espera hasta que esté inicializado (para llamadas que llegan muy temprano)
    function _cuandoListo(fn) {
        if (_inicializado) fn();
        else _pendientes.push(fn);
    }

    // ── Escritura asíncrona al disco (fire-and-forget con reintentos) ──────────
    const _escriturasPendientes = new Map(); // key → valor (deduplica escrituras rápidas)
    let _timerEscritura = null;

    function _programarEscritura(key, value) {
        _escriturasPendientes.set(key, value);
        clearTimeout(_timerEscritura);
        _timerEscritura = setTimeout(_ejecutarEscrituras, 300); // debounce 300ms
    }

    async function _ejecutarEscrituras() {
        if (!ES_ELECTRON) return;
        const entradas = Array.from(_escriturasPendientes.entries());
        _escriturasPendientes.clear();
        for (const [key, value] of entradas) {
            try {
                if (value === null) {
                    await window.electronAPI.storage.delete(key);
                } else {
                    await window.electronAPI.storage.set(key, value);
                }
            } catch(e) {
                console.error(`[DiskStorage] Error escribiendo "${key}":`, e);
            }
        }
    }

    // ── API pública ────────────────────────────────────────────────────────────
    const DiskStorage = {

        isElectron: ES_ELECTRON,

        getItem(key) {
            if (!ES_ELECTRON) return localStorage.getItem(key);
            return _cache[key] !== undefined ? _cache[key] : null;
        },

        setItem(key, value) {
            const str = String(value);
            if (!ES_ELECTRON) {
                try { localStorage.setItem(key, str); } catch(e) { console.error(e); }
                return;
            }
            _cache[key] = str;
            _programarEscritura(key, str);
        },

        removeItem(key) {
            if (!ES_ELECTRON) { localStorage.removeItem(key); return; }
            delete _cache[key];
            _programarEscritura(key, null);
        },

        clear() {
            if (!ES_ELECTRON) { localStorage.clear(); return; }
            Object.keys(_cache).forEach(k => _programarEscritura(k, null));
            _cache = {};
        },

        // Forzar escritura inmediata (para el botón Guardar)
        async flush() {
            clearTimeout(_timerEscritura);
            await _ejecutarEscrituras();
            return { ok: true, claves: Object.keys(_cache).length };
        },

        // Estado
        get length() {
            if (!ES_ELECTRON) return localStorage.length;
            return Object.keys(_cache).length;
        },

        key(index) {
            if (!ES_ELECTRON) return localStorage.key(index);
            return Object.keys(_cache)[index] || null;
        },

        // Esperar a que esté listo (para inicialización de la app)
        cuandoListo(fn) { _cuandoListo(fn); },

        // Info de diagnóstico
        info() {
            return {
                modo: ES_ELECTRON ? 'disco-cifrado' : 'localStorage',
                claves: Object.keys(_cache).length,
                inicializado: _inicializado
            };
        }
    };

    // ── Parchar localStorage globalmente si estamos en Electron ───────────────
    // Esto hace que todo el código existente (que usa localStorage) funcione sin cambios
    if (ES_ELECTRON) {
        const _lsProxy = new Proxy(DiskStorage, {
            get(target, prop) {
                if (prop in target) return target[prop];
                // Acceso por índice numérico (localStorage[0], etc.)
                if (!isNaN(prop)) return target.key(Number(prop));
                return undefined;
            }
        });

        // NO podemos reemplazar window.localStorage directamente (read-only),
        // pero sí parchamos el Store de la app para que use DiskStorage.
        // El parche se aplica en 00b-config.js (ver modificación abajo).
    }

    // ── Pre-hidratación síncrona (solo Electron) ──────────────────────────────
    // Carga las claves críticas al caché ANTES de que 01-db-auth.js las necesite.
    // Usa IPC síncrono (sendSync) para bloquear hasta tener los datos del disco.
    if (ES_ELECTRON && window.electronAPI?.storage?.getSync) {
        const CLAVES_CRITICAS = ['APPBOGADO_DATA_V395', 'APPBOGADO_CONFIG_V1'];
        let hidratadas = 0;
        CLAVES_CRITICAS.forEach(k => {
            try {
                const v = window.electronAPI.storage.getSync(k);
                if (v !== null && v !== undefined) {
                    _cache[k] = v;
                    hidratadas++;
                }
            } catch(e) {
                console.warn(`[DiskStorage] Pre-hidratación falló para ${k}:`, e);
            }
        });
        if (hidratadas > 0) {
            _inicializado = true;
            console.info(`[DiskStorage] Pre-hidratación síncrona OK — ${hidratadas} clave(s) cargadas.`);
        }
    }

    // Exponer globalmente
    window.DiskStorage = DiskStorage;

    // Inicializar
    _init();

    console.info(`[DiskStorage] Modo: ${ES_ELECTRON ? '🔒 Disco cifrado (Electron)' : '🌐 localStorage (navegador)'}`);

})();
