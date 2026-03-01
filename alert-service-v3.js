/**
 * LEXIUM – alert-service-v3.js  (Correcciones #1 #2 #4)
 * ─────────────────────────────────────────────────────────────
 * Mejoras sobre v2:
 *   ✅ #1 Caché con TTL (evita descifrado en cada llamada)
 *   ✅ #2 Escritura atómica (evita corrupción de DB)
 *   ✅ #4 Sin doble lectura en críticos (se resuelve aquí)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Dependencias inyectadas ────────────────────────────────────
let _dataDir   = null;
let _descifrar = null;
let _cifrar    = null;

function init({ DATA_DIR, descifrar, cifrar }) {
    _dataDir   = DATA_DIR;
    _descifrar = descifrar;
    _cifrar    = cifrar;
}

// ── Caché con TTL (#1) ─────────────────────────────────────────
const CACHE_TTL_MS = 30 * 1000; // 30 segundos
let _cacheDB        = null;
let _cacheTimestamp = 0;
let _cacheArchivoRuta = null;
let _cacheMtime     = null;

/**
 * Lee la DB solo si:
 *  a) No hay caché, o
 *  b) El TTL expiró, o
 *  c) El archivo cambió (mtime diferente)
 */
function _leerDB(forzar = false) {
    if (!_dataDir || !_descifrar) {
        throw new Error('[AlertService] No inicializado. Llamar init() primero.');
    }

    const ahora = Date.now();

    // Verificar si el archivo cambió aunque el TTL no haya expirado
    if (_cacheArchivoRuta && fs.existsSync(_cacheArchivoRuta)) {
        try {
            const mtime = fs.statSync(_cacheArchivoRuta).mtimeMs;
            if (mtime !== _cacheMtime) {
                // Archivo modificado externamente → invalidar caché
                _cacheDB = null;
            }
        } catch(_) {}
    }

    // Usar caché si es válido
    if (!forzar && _cacheDB && (ahora - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cacheDB;
    }

    // Buscar archivo de DB
    const candidatos = ['appbogado_db.enc', 'appbogado.enc', 'lexium_db.enc', 'db.enc'];
    let rutaEncontrada = null;

    for (const nombre of candidatos) {
        const ruta = path.join(_dataDir, nombre);
        if (fs.existsSync(ruta)) { rutaEncontrada = ruta; break; }
    }

    // Búsqueda por contenido si no encontró por nombre
    if (!rutaEncontrada) {
        try {
            const archivos = fs.readdirSync(_dataDir).filter(f => f.endsWith('.enc'));
            for (const archivo of archivos) {
                const ruta = path.join(_dataDir, archivo);
                try {
                    const raw = _descifrar(fs.readFileSync(ruta, 'utf8'));
                    if (!raw) continue;
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.causas || parsed.alertas)) {
                        rutaEncontrada = ruta;
                        break;
                    }
                } catch(_) {}
            }
        } catch(e) {
            console.error('[AlertService] Error escaneando DATA_DIR:', e.message);
        }
    }

    if (!rutaEncontrada) {
        console.warn('[AlertService] No se encontró archivo de DB.');
        return null;
    }

    // Leer, descifrar, parsear
    try {
        const contenido = fs.readFileSync(rutaEncontrada, 'utf8');
        const raw       = _descifrar(contenido);
        if (!raw) return null;

        const db = JSON.parse(raw);

        // Actualizar caché
        _cacheDB          = db;
        _cacheTimestamp   = ahora;
        _cacheArchivoRuta = rutaEncontrada;
        _cacheMtime       = fs.statSync(rutaEncontrada).mtimeMs;

        return db;
    } catch(e) {
        console.error('[AlertService] Error leyendo DB:', e.message);
        return null;
    }
}

/** Invalidar caché manualmente (útil tras escritura) */
function _invalidarCache() {
    _cacheDB        = null;
    _cacheTimestamp = 0;
    _cacheMtime     = null;
}

// ── Escritura atómica (#2) ─────────────────────────────────────
/**
 * Guarda la DB de forma atómica:
 *   1. Escribir en archivo temporal (mismo sistema de archivos)
 *   2. fs.renameSync() — operación atómica en la mayoría de OS
 * Esto garantiza que si falla la escritura, el archivo original queda intacto.
 */
function _escribirDBAtomico(db) {
    if (!_cacheArchivoRuta || !_cifrar) return false;

    const tmpFile = path.join(
        os.tmpdir(),
        `lexium_tmp_${Date.now()}_${process.pid}.enc`
    );

    try {
        // 1. Cifrar y escribir en temporal
        const cifrado = _cifrar(JSON.stringify(db));
        fs.writeFileSync(tmpFile, cifrado, 'utf8');

        // 2. Rename atómico al archivo definitivo
        fs.renameSync(tmpFile, _cacheArchivoRuta);

        // 3. Invalidar caché para forzar relecture
        _invalidarCache();

        return true;
    } catch(e) {
        console.error('[AlertService] Error en escritura atómica:', e.message);
        // Limpiar temporal si quedó
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch(_) {}
        return false;
    }
}

// ── Alertas de cobro pendiente (Fase 4.2) ─────────────────────

/**
 * Retorna las causas con un pago programado para HOY y saldo pendiente > 0.
 * Trabaja sobre la DB ya leída (se recibe como parámetro para evitar doble lectura).
 */
function _getAlertasCobrosHoy(causas) {
    const hoy = new Date().toISOString().split('T')[0];
    const alertas = [];

    (causas || []).forEach(c => {
        if (!c.estadoCuenta?.fechasPago) return;
        c.estadoCuenta.fechasPago.forEach(fecha => {
            const fechaDia = (fecha || '').split('T')[0];
            if (fechaDia !== hoy) return;
            if ((c.estadoCuenta.saldoPendiente || 0) <= 0) return;
            alertas.push({
                tipo:      'cobro-pendiente',
                causaId:   c.id,
                caratula:  c.caratula || c.id,
                monto:     c.estadoCuenta.montoCuota || c.estadoCuenta.saldoPendiente,
                fecha:     hoy
            });
        });
    });

    return alertas;
}

/**
 * Versión pública exportable — lee la DB internamente.
 * Permite verificar desde consola: getAlertasCobrosHoy() → []
 */
function getAlertasCobrosHoy() {
    const db = _leerDB();
    if (!db) return [];
    return _getAlertasCobrosHoy(db.causas);
}

// ── API pública ────────────────────────────────────────────────

function getAlertasActivas(prioridades = null) {
    const db = _leerDB();
    if (!db) return { alertas: [], causas: [] };

    let alertas = (db.alertas || []).filter(a => a.estado === 'activa');
    if (prioridades?.length > 0) {
        alertas = alertas.filter(a => prioridades.includes(a.prioridad));
    }
    return { alertas, causas: db.causas || [] };
}

/**
 * Retorna el resumen completo ya enriquecido.
 * ✅ Una sola lectura de DB — críticos se extraen desde aquí (#4)
 */
function getResumenParaWhatsApp() {
    const db = _leerDB(); // UNA sola lectura
    if (!db) {
        return {
            ok: false,
            error: 'No se pudo leer la base de datos',
            alertas: { criticas: [], altas: [], inactivas: [] },
            honorarios: { causas: [], total: 0 },
            stats: { totalCausas: 0, causasActivas: 0, totalAlertas: 0 }
        };
    }

    const causas         = db.causas  || [];
    const alertasActivas = (db.alertas || []).filter(a => a.estado === 'activa');

    const enriquecer = (a) => {
        const causa = causas.find(c => c.id === a.causaId);
        return {
            ...a,
            _caratula:           causa?.caratula           || 'Causa desconocida',
            _tipoProceso:        causa?.tipoProcedimiento  || '',
            _fechaVencFormatted: a.fechaObjetivo
                ? new Date(a.fechaObjetivo).toLocaleDateString('es-CL')
                : null
        };
    };

    const criticas  = alertasActivas.filter(a => a.prioridad === 'critica').map(enriquecer);
    const altas     = alertasActivas.filter(a => a.prioridad === 'alta' && a.tipo !== 'inactividad').map(enriquecer);
    const inactivas = alertasActivas.filter(a => a.tipo === 'inactividad').map(enriquecer);

    const causasConDeuda = causas.filter(c => c.honorarios?.saldoPendiente > 0);
    const totalDeuda     = causasConDeuda.reduce((s, c) => s + (c.honorarios?.saldoPendiente || 0), 0);

    const cobrosHoy = _getAlertasCobrosHoy(causas); // sin segunda lectura de DB

    return {
        ok: true,
        alertas: { criticas, altas, inactivas, cobrosHoy },
        honorarios: {
            causas: causasConDeuda.map(c => ({
                caratula:       c.caratula,
                saldoPendiente: c.honorarios.saldoPendiente
            })),
            total: totalDeuda
        },
        stats: {
            totalCausas:   causas.length,
            causasActivas: causas.filter(c => c.estadoGeneral !== 'Finalizada').length,
            totalAlertas:  alertasActivas.length
        }
    };
}

/**
 * ✅ Elimina doble lectura (#4):
 * getAlertasCriticas() ya no llama a _leerDB() por separado.
 * Extrae las críticas del resumen completo (una sola lectura).
 */
function getAlertasCriticas() {
    const resumen = getResumenParaWhatsApp();
    return {
        ok:      resumen.ok,
        alertas: resumen.alertas?.criticas || [],
        causas:  [] // ya enriquecidas en el resumen
    };
}

function getCausasConHonorariosPendientes() {
    const db = _leerDB();
    if (!db) return [];
    return (db.causas || []).filter(c => c.honorarios?.saldoPendiente > 0);
}

/**
 * Marca alerta como notificada con escritura atómica (#2).
 */
function marcarAlertaNotificada(alertaId) {
    try {
        const db = _leerDB(true); // forzar lectura fresca antes de escribir
        if (!db) return false;

        const alerta = (db.alertas || []).find(a => a.id === alertaId);
        if (!alerta) return false;

        alerta._notificadoWA = new Date().toISOString();

        return _escribirDBAtomico(db); // escritura atómica
    } catch(e) {
        console.error('[AlertService] Error marcando alerta:', e.message);
        return false;
    }
}

function alertaYaNotificadaHoy(alerta) {
    if (!alerta._notificadoWA) return false;
    const hoy        = new Date().toDateString();
    const notificado = new Date(alerta._notificadoWA).toDateString();
    return hoy === notificado;
}

/** Info de diagnóstico para el panel */
function getCacheInfo() {
    return {
        tieneCacheDB:     !!_cacheDB,
        edadCacheMs:      _cacheTimestamp ? Date.now() - _cacheTimestamp : null,
        ttlMs:            CACHE_TTL_MS,
        archivoDetectado: _cacheArchivoRuta ? path.basename(_cacheArchivoRuta) : null
    };
}

module.exports = {
    init,
    getAlertasActivas,
    getAlertasCriticas,
    getCausasConHonorariosPendientes,
    getResumenParaWhatsApp,
    getAlertasCobrosHoy,
    marcarAlertaNotificada,
    alertaYaNotificadaHoy,
    getCacheInfo
};
