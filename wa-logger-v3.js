/**
 * LEXIUM – wa-logger-v3.js  (Corrección #3 — límite de cola)
 * ─────────────────────────────────────────────────────────────
 * Mejoras sobre v2:
 *   ✅ Límite máximo de cola de reintentos (evita fuga de memoria)
 *   ✅ Descarte de mensajes más antiguos si se supera el límite
 *   ✅ Log de descarte para trazabilidad
 *   ✅ Advertencia al acercarse al límite
 */

'use strict';

const fs   = require('fs');
const path = require('path');

let _dataDir   = null;
let _cifrar    = null;
let _descifrar = null;

const LOG_FILE    = 'wa_logs.enc';
const MAX_ENTRIES = 1000;

// ── Cola de reintentos con límite (#3) ────────────────────────
const MAX_COLA         = 50;   // máximo mensajes en cola
const WARN_COLA        = 30;   // advertir al llegar a este umbral
const MAX_REINTENTOS   = 3;
const BACKOFF_BASE_MS  = 30 * 1000;

const _colaReintentos = new Map();
let   _timerReintentos = null;

function init({ DATA_DIR, cifrar, descifrar }) {
    _dataDir   = DATA_DIR;
    _cifrar    = cifrar;
    _descifrar = descifrar;
}

// ── Logs ───────────────────────────────────────────────────────
function _leerLogs() {
    try {
        const ruta = path.join(_dataDir, LOG_FILE);
        if (!fs.existsSync(ruta)) return [];
        const raw = _descifrar(fs.readFileSync(ruta, 'utf8'));
        return raw ? JSON.parse(raw) : [];
    } catch(e) {
        console.error('[WALogger] Error leyendo logs:', e.message);
        return [];
    }
}

function _guardarLogs(logs) {
    try {
        const recortado = logs.length > MAX_ENTRIES
            ? logs.slice(logs.length - MAX_ENTRIES)
            : logs;
        const ruta = path.join(_dataDir, LOG_FILE);
        fs.writeFileSync(ruta, _cifrar(JSON.stringify(recortado)), 'utf8');
    } catch(e) {
        console.error('[WALogger] Error guardando logs:', e.message);
    }
}

const NIVELES = { INFO: 'info', OK: 'ok', WARN: 'warn', ERROR: 'error', RETRY: 'retry' };

function log(nivel, evento, detalle = {}) {
    const entrada = {
        id:        `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        nivel,
        evento,
        ...detalle
    };

    const icono = { info:'ℹ️', ok:'✅', warn:'⚠️', error:'❌', retry:'🔄' }[nivel] || '•';
    console.log(`[WALogger] ${icono} ${evento}`, detalle.error || '');

    if (_dataDir && _cifrar) {
        const logs = _leerLogs();
        logs.push(entrada);
        _guardarLogs(logs);
    }

    return entrada.id;
}

const logInfo  = (ev, d) => log(NIVELES.INFO,  ev, d);
const logOk    = (ev, d) => log(NIVELES.OK,    ev, d);
const logWarn  = (ev, d) => log(NIVELES.WARN,  ev, d);
const logError = (ev, d) => log(NIVELES.ERROR, ev, d);
const logRetry = (ev, d) => log(NIVELES.RETRY, ev, d);

// ── Cola de reintentos con límite (#3) ────────────────────────
/**
 * Encolar mensaje para reintento.
 * Si la cola supera MAX_COLA, descarta el mensaje más antiguo.
 */
function encolarReintento(messageId, payload, enviarFn) {
    if (_colaReintentos.has(messageId)) return;

    // ── Verificar límite de cola (#3) ──────────────────────────
    if (_colaReintentos.size >= MAX_COLA) {
        // Encontrar el mensaje más antiguo (primera entrada del Map)
        const [idMasAntiguo, itemMasAntiguo] = _colaReintentos.entries().next().value;

        logError('cola-llena-descarte', {
            descartado:   idMasAntiguo,
            tipodescarte: itemMasAntiguo.payload.tipo,
            tamanoCola:   _colaReintentos.size
        });

        _colaReintentos.delete(idMasAntiguo);
    }

    // Advertencia al acercarse al límite
    if (_colaReintentos.size >= WARN_COLA) {
        logWarn('cola-cercana-limite', {
            tamano:  _colaReintentos.size,
            maximo:  MAX_COLA,
            porcentaje: Math.round((_colaReintentos.size / MAX_COLA) * 100)
        });
    }

    _colaReintentos.set(messageId, {
        payload,
        enviarFn,
        intentos:       0,
        proximoIntento: Date.now() + BACKOFF_BASE_MS,
        encolado:       new Date().toISOString()
    });

    logWarn('reintento-encolado', {
        messageId,
        tipo:      payload.tipo,
        colaSize:  _colaReintentos.size
    });

    _programarRevisionCola();
}

function _programarRevisionCola() {
    if (_timerReintentos) return;
    _timerReintentos = setInterval(_revisarCola, 15 * 1000);
}

async function _revisarCola() {
    if (_colaReintentos.size === 0) {
        clearInterval(_timerReintentos);
        _timerReintentos = null;
        return;
    }

    const ahora = Date.now();

    for (const [messageId, item] of _colaReintentos.entries()) {
        if (ahora < item.proximoIntento) continue;

        item.intentos++;

        if (item.intentos > MAX_REINTENTOS) {
            logError('reintento-agotado', {
                messageId,
                tipo:     item.payload.tipo,
                intentos: item.intentos,
                numero:   item.payload.numero?.replace(/\d(?=\d{4})/g, '*')
            });
            _colaReintentos.delete(messageId);
            continue;
        }

        try {
            logRetry('reintentando', { messageId, intento: item.intentos });
            await item.enviarFn(item.payload.numero, item.payload.mensaje);
            logOk('reintento-exitoso', { messageId, intento: item.intentos });
            _colaReintentos.delete(messageId);
        } catch(e) {
            const delay          = BACKOFF_BASE_MS * Math.pow(2, item.intentos - 1);
            item.proximoIntento  = ahora + delay;
            logRetry('reintento-fallido', {
                messageId,
                intento:    item.intentos,
                proximoEn:  `${Math.round(delay / 1000)}s`,
                error:      e.message
            });
        }
    }
}

// ── Consulta ───────────────────────────────────────────────────
function getLogs(limite = 50, nivel = null) {
    const todos = _leerLogs();
    const filtrados = nivel ? todos.filter(l => l.nivel === nivel) : todos;
    return filtrados.slice(-limite).reverse();
}

function getEstadisticas() {
    const logs   = _leerLogs();
    const ahora  = new Date();
    const hace24h = new Date(ahora - 24 * 60 * 60 * 1000);
    const recientes = logs.filter(l => new Date(l.timestamp) > hace24h);

    return {
        totalLogs:    logs.length,
        enviados24h:  recientes.filter(l => l.nivel === 'ok').length,
        errores24h:   recientes.filter(l => l.nivel === 'error').length,
        enCola:       _colaReintentos.size,
        maxCola:      MAX_COLA,
        porcentajeCola: Math.round((_colaReintentos.size / MAX_COLA) * 100),
        ultimoEnvio:  logs.filter(l => l.nivel === 'ok').slice(-1)[0]?.timestamp || null
    };
}

function limpiarLogs() {
    _guardarLogs([]);
    logInfo('logs-limpiados', {});
}

/** Info de diagnóstico de cola para panel UI */
function getInfoCola() {
    return {
        size:     _colaReintentos.size,
        max:      MAX_COLA,
        warn:     WARN_COLA,
        mensajes: Array.from(_colaReintentos.entries()).map(([id, item]) => ({
            id,
            tipo:     item.payload.tipo,
            intentos: item.intentos,
            encolado: item.encolado
        }))
    };
}

module.exports = {
    init,
    log, logInfo, logOk, logWarn, logError, logRetry,
    encolarReintento,
    getLogs,
    getEstadisticas,
    getInfoCola,
    limpiarLogs,
    NIVELES
};
