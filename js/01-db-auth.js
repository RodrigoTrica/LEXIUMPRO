// ████████████████████████████████████████████████████████████████████
// JS — BLOQUE 1: MANEJO DE ERRORES + BASE DE DATOS + PERSISTENCIA
// • Error handlers, Store, AutoBackup, localStorage
// ████████████████████████████████████████████████████████████████████

// ══════════════════════════════════════════════════════════════════
// MANEJADOR GLOBAL DE ERRORES
// Captura errores silenciosos y promesas rechazadas sin manejar
// ══════════════════════════════════════════════════════════════════
window.addEventListener('error', function (e) {
    console.error('[LEXIUM] Error global:', e.message, '→', e.filename, 'línea', e.lineno);
});

window.addEventListener('unhandledrejection', function (e) {
    console.error('[LEXIUM] Promesa rechazada sin capturar:', e.reason);
    e.preventDefault();
});

// ══════════════════════════════════════════════════════════════════
// LIMPIEZA DE BACKUPS HUÉRFANOS
// Elimina entradas APP_BACKUP_* que pudieran haber quedado de
// versiones anteriores del código sin rotación controlada
// ══════════════════════════════════════════════════════════════════
(function _limpiarBackupsHuerfanos() {
    try {
        const huerfanos = Object.keys(localStorage)
            .filter(k => k.startsWith('APP_BACKUP_'))
            .sort();
        if (huerfanos.length > 0) {
            huerfanos.forEach(k => localStorage.removeItem(k));
            console.info('[LEXIUM] Limpiados', huerfanos.length, 'backup(s) huérfano(s).');
        }
    } catch (e) {
        console.warn('[LEXIUM] Error limpiando backups huérfanos:', e);
    }
})();

// ─── DB & Persistence ──────────────────────────────────────────────
// ESQUEMA CANÓNICO ÚNICO — toda la app usa estas propiedades
// ═══════════════════════════════════════════════════════════════════
// STORE LAYER — Capa de acceso a datos centralizada
// Todos los módulos leen/escriben a través de Store.
// DB es el objeto interno del Store (nunca se accede directo desde
// código de negocio nuevo — el legacy sigue funcionando via proxy).
// ═══════════════════════════════════════════════════════════════════

const DB_KEY = 'LEXIUM_DATA_V1';
const BACKUP_KEY = 'LEXIUM_BACKUPS_V1';   // historial rotativo
const BACKUP_MAX = 5;                          // snapshots guardados
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;        // auto-backup cada 5 min

// ── 1. Cargar datos crudos ──────────────────────────────────────────
// Usa DiskStorage (cifrado en disco) si corre en Electron, localStorage si no
const _storage = (window.DiskStorage && window.DiskStorage.isElectron) ? window.DiskStorage : localStorage;
let _raw = (() => {
    try { return JSON.parse(_storage.getItem(DB_KEY)) || {}; }
    catch (e) { return {}; }
})();

// ── 2. Migración y normalización del esquema ────────────────────────
(function _migrar(d) {
    if (!d.clientes) d.clientes = [];
    if (d.clients?.length) {
        d.clients.forEach(c => {
            if (!d.clientes.find(x => x.id === c.id))
                d.clientes.push({
                    id: c.id, nombre: c.nom || c.nombre, rut: c.rut || '',
                    telefono: '',
                    descripcion: c.rel || '', estado: c.status || 'prospecto', fechaCreacion: new Date()
                });
        });
    }
    // Normalizar clientes existentes: asegurar campo telefono (compatibilidad hacia atrás)
    d.clientes.forEach(c => {
        if (typeof c.telefono !== 'string') c.telefono = '';
    });
    if (!d.causas) d.causas = [];
    if (d.causes?.length) {
        d.causes.forEach(c => {
            if (!d.causas.find(x => x.id === c.id))
                d.causas.push({
                    id: c.id, caratula: c.caratula, rut: c.rut || '',
                    tipoProcedimiento: c.tipoProcedimiento || 'Ordinario Civil',
                    rama: c.rama || '', estadoGeneral: c.estadoGeneral || 'En tramitación',
                    instancia: c.instancia || 'Primera', porcentajeAvance: c.porcentajeAvance || 0,
                    fechaCreacion: c.fechaCreacion || new Date(),
                    fechaUltimaActividad: c.fechaUltimaActividad || new Date(),
                    etapasProcesales: c.etapasProcesales || [], documentos: c.documentos || [],
                    recursos: c.recursos || [], estrategia: c.estrategia || {},
                    riesgo: c.risk ? {
                        procesal: c.risk.pr > 50 ? 'Alto' : 'Medio',
                        probatorio: c.risk.p > 50 ? 'Alto' : 'Medio',
                        jurisprudencial: 'Moderado', economico: 'Bajo',
                        estrategico: c.risk.e > 50 ? 'Alto' : 'Bajo'
                    } : {},
                    honorarios: c.honorarios || {}, jurisprudenciaAsociada: c.jurisprudenciaAsociada || [],
                    revisadoHoy: false, prioridadManual: false
                });
        });
    }
    if (!d.jurisprudencia) d.jurisprudencia = [];
    if (d.juris?.length) {
        d.juris.forEach(j => {
            if (!d.jurisprudencia.find(x => x.id === j.id))
                d.jurisprudencia.push({
                    id: j.id, tribunal: j.tribunal || 'No especificado',
                    rol: j.rol || '', materia: j.cat || j.materia || '', ext: j.ext || '',
                    temaCentral: j.ext || '', tendencia: j.tendencia || 'Neutra',
                    nivelRelevancia: j.nivelRelevancia || 'Media',
                    palabrasClave: j.palabrasClave || [], asociadaACausas: j.asociadaACausas || []
                });
        });
    }
    ['prospectos', 'propuestas', 'alertas', 'documentos', 'intentosLogin', 'bitacora', 'logs', '_doctrina'].forEach(k => { if (!d[k]) d[k] = []; });

    // Normalizar alertas (calendario + WhatsApp)
    d.alertas.forEach(a => {
        if (!a || typeof a !== 'object') return;
        if (!a.id) a.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
        if (!a.tipo) a.tipo = 'evento';
        a.tipo = String(a.tipo).toLowerCase();
        if (!a.fechaObjetivo) a.fechaObjetivo = new Date().toISOString().slice(0, 10);
        if (!a.prioridad) a.prioridad = 'media';
        if (!a.estado) a.estado = 'activa';
        if (a.waAlertadoEn === undefined) a.waAlertadoEn = null;
        if (a.gestionadaEn === undefined) a.gestionadaEn = null;
    });

    // Normalizar prospectos (CRM -> causa + contrato)
    d.prospectos.forEach(p => {
        if (!p || typeof p !== 'object') return;
        if (p.tipoExpediente !== 'judicial' && p.tipoExpediente !== 'tramite') p.tipoExpediente = null;
        if (!p.propuesta || typeof p.propuesta !== 'object') {
            p.propuesta = {
                generada: false,
                fechaGeneracion: null,
                fechaVencimiento: null,
                aceptada: false,
                rechazada: false
            };
        }
        if (p.contratoServicios === undefined) p.contratoServicios = null;
    });

    // Normalizar propuestas (CRM comercial)
    d.propuestas.forEach(pr => {
        if (!pr || typeof pr !== 'object') return;
        if (pr.prospectoId === undefined) pr.prospectoId = null;
        if (typeof pr.montoTotal !== 'number') pr.montoTotal = parseFloat(pr.montoTotal) || 0;
        if (!Array.isArray(pr.pagos)) pr.pagos = [];
        if (!pr.estado) pr.estado = 'borrador';
        if (pr.aceptada === undefined) pr.aceptada = false;
        if (pr.rechazada === undefined) pr.rechazada = false;
        if (!pr.fechaCreacion) pr.fechaCreacion = new Date().toISOString();
    });

    // Normalizar esquema de documentos (SID Fase 1)
    // - proveedorIA: identifica el proveedor que generó análisis/insights (openai/gemini/glm)
    //   (para documentos existentes queda null)
    d.documentos.forEach(doc => {
        if (!doc || typeof doc !== 'object') return;
        if (!doc.id) doc.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
        if (doc.causaId === undefined || doc.causaId === '') doc.causaId = null;
        if (!doc.tipo) doc.tipo = 'Otro';
        if (!doc.nombreOriginal && doc.nombre) doc.nombreOriginal = String(doc.nombre).trim();
        if (!doc.nombreOriginal) doc.nombreOriginal = 'documento';
        if (!doc.fechaDocumento) doc.fechaDocumento = new Date().toISOString().slice(0, 10);
        if (!doc.fechaIngreso) doc.fechaIngreso = new Date().toISOString();
        if (!doc.archivoMime && doc.mimetype) doc.archivoMime = doc.mimetype;
        if (doc.proveedorIA === undefined) doc.proveedorIA = null;
    });
    // Migración única: mover Doctrina del localStorage aislado al Store centralizado
    try {
        const rawDoctr = localStorage.getItem('LEXIUM_DOCTRINA_V1');
        if (rawDoctr && !d._doctrina.length) {
            const parsed = JSON.parse(rawDoctr);
            if (Array.isArray(parsed) && parsed.length > 0) {
                d._doctrina = parsed;
                localStorage.removeItem('LEXIUM_DOCTRINA_V1'); // limpiar clave huérfana
                console.info('[Store] Doctrina migrada al Store centralizado:', parsed.length, 'documentos.');
            }
        }
    } catch (_) { }
    if (!d.configuracion) d.configuracion = { ultimoResetDiario: null, modoEstudio: false };
    if (!d.configuracion.auditRetention) d.configuracion.auditRetention = { maxLogs: 10000, maxDays: 180 };
    if (!d.loginBloqueado) d.loginBloqueado = { hasta: null, intentosFallidos: 0 };
    if (d.loginBloqueado.hasta && Date.now() >= d.loginBloqueado.hasta)
        d.loginBloqueado = { hasta: null, intentosFallidos: 0 };
    // Normalizar documentos embebidos en causas
    d.causas.forEach(causa => {
        (causa.documentos || []).forEach(doc => {
            if (!d.documentos.find(x => x.id === doc.id))
                d.documentos.push({ ...doc, causaId: causa.id });
        });

        // Migración comprobantes (PDF base64) → DB.documentos
        // Deja solo comprobanteDocumentoId en pagos/cuotas.
        try {
            if (!causa.honorarios) causa.honorarios = {};
            const h = causa.honorarios;
            if (!Array.isArray(h.planPagos)) h.planPagos = [];
            if (!Array.isArray(h.pagos)) h.pagos = [];

            const _ensureDoc = (base64, nombre, mime, meta) => {
                if (!base64 || typeof base64 !== 'string') return null;
                const archivoNombre = (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : 'comprobante.pdf';
                const archivoMime = (typeof mime === 'string' && mime.trim()) ? mime.trim() : 'application/pdf';

                const ya = d.documentos.find(x =>
                    x && x.causaId === causa.id && x.tipo === 'Comprobante'
                    && x.archivoBase64 === base64
                    && x.archivoNombre === archivoNombre
                );
                if (ya) return ya.id;

                const doc = {
                    id: (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
                    causaId: causa.id,
                    nombreOriginal: archivoNombre,
                    tipo: 'Comprobante',
                    etapaVinculada: '',
                    fechaDocumento: (new Date().toISOString().split('T')[0]),
                    generaPlazo: false,
                    diasPlazo: 0,
                    fechaVencimiento: null,
                    fechaIngreso: new Date().toISOString(),
                    descripcion: meta?.descripcion || 'Comprobante de pago',
                    archivoBase64: base64,
                    archivoNombre: archivoNombre,
                    archivoMime: archivoMime,
                    proveedorIA: null,
                    _origen: meta?._origen || 'migracion-comprobantes'
                };
                d.documentos.push(doc);
                return doc.id;
            };

            // Cuotas (planPagos)
            h.planPagos.forEach(cuota => {
                const comp = cuota?.comprobante;
                if (!comp || !comp.base64) return;
                if (cuota.comprobanteDocumentoId) return;
                const idDoc = _ensureDoc(comp.base64, comp.nombre, comp.mime, {
                    descripcion: `Comprobante cuota Nº ${cuota.numero || ''}`.trim(),
                    _origen: 'cuota'
                });
                if (!idDoc) return;
                cuota.comprobanteDocumentoId = idDoc;
                // Mantener compatibilidad: se deja comp, pero se elimina base64 para reducir peso
                cuota.comprobante = { nombre: comp.nombre || 'comprobante.pdf', mime: comp.mime || 'application/pdf' };
            });

            // Pagos (honorarios.pagos)
            h.pagos.forEach(pago => {
                const comp = pago?.comprobante;
                if (!comp || !comp.base64) return;
                if (pago.comprobanteDocumentoId) return;
                const idDoc = _ensureDoc(comp.base64, comp.nombre, comp.mime, {
                    descripcion: `Comprobante pago (${pago.concepto || 'Pago'})`,
                    _origen: 'pago'
                });
                if (!idDoc) return;
                pago.comprobanteDocumentoId = idDoc;
                pago.comprobante = { nombre: comp.nombre || 'comprobante.pdf', mime: comp.mime || 'application/pdf' };
            });
        } catch (e) {
            console.warn('[Store] Migración comprobantes falló (no crítico):', e);
        }
        // Migración CRM Prospectos (campos documentales y financieros)
        if (!causa.docsCliente) causa.docsCliente = [];
        if (!causa.docsTribunal) causa.docsTribunal = [];
        if (!causa.docsTramites) causa.docsTramites = [];
        if (!causa.docsContraparte) causa.docsContraparte = [];
        if (!Array.isArray(causa.movimientos)) causa.movimientos = [];
        if (!Array.isArray(causa.tareas)) causa.tareas = [];
        if (!Array.isArray(causa.etapasProcesales)) causa.etapasProcesales = [];
        if (!Array.isArray(causa.recursos)) causa.recursos = [];
        if (!causa.prescripcion || typeof causa.prescripcion !== 'object') causa.prescripcion = {};
        if (!causa.honorarios || typeof causa.honorarios !== 'object') causa.honorarios = {};
        if (!causa.estadoCuenta) causa.estadoCuenta = { montoTotal: 0, pagos: [], totalPagado: 0, saldoPendiente: 0 };
        if (!causa.tipoExpediente) causa.tipoExpediente = 'judicial';
        if (!causa.tipoProcedimiento) causa.tipoProcedimiento = causa.tipoExpediente === 'tramite' ? 'Trámite Administrativo' : 'Ordinario Civil';
        if (!causa.partes || typeof causa.partes !== 'object') causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
        if (!causa.iaSugerencias || typeof causa.iaSugerencias !== 'object') causa.iaSugerencias = {};
        if (!Array.isArray(causa.eventosProcesalesIA)) causa.eventosProcesalesIA = [];
        if (!causa.audiencias || typeof causa.audiencias !== 'object') causa.audiencias = {};
        if (typeof causa.audiencias.habilitado !== 'boolean') causa.audiencias.habilitado = false;
        if (!causa.audiencias.filtroVista) causa.audiencias.filtroVista = 'todas';
        if (!causa.contratoServicios || typeof causa.contratoServicios !== 'object') causa.contratoServicios = null;
        if (Array.isArray(causa.eventosProcesalesIA) && Array.isArray(d.alertas)) {
            causa.eventosProcesalesIA.forEach(ev => {
                if (String(ev?.tipo || '').toLowerCase() !== 'audiencia') return;
                if (!ev.waAlertadoEn) return;
                d.alertas.forEach(a => {
                    if (String(a?.causaId) !== String(causa.id)) return;
                    if (String(a?.tipo || '').toLowerCase() !== 'audiencia') return;
                    const sameFecha = !ev.fecha || String(a.fechaObjetivo || '') === String(ev.fecha || '');
                    const sameTitulo = String(a.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
                    if ((sameFecha || sameTitulo) && !a.waAlertadoEn) a.waAlertadoEn = ev.waAlertadoEn;
                });
            });
            d.alertas.forEach(a => {
                if (String(a?.causaId) !== String(causa.id)) return;
                if (String(a?.tipo || '').toLowerCase() !== 'audiencia') return;
                causa.eventosProcesalesIA.forEach(ev => {
                    if (String(ev?.tipo || '').toLowerCase() !== 'audiencia') return;
                    const sameFecha = !ev.fecha || String(a.fechaObjetivo || '') === String(ev.fecha || '');
                    const sameTitulo = String(a.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
                    if (!sameFecha && !sameTitulo) return;
                    if (a.waAlertadoEn && !ev.waAlertadoEn) ev.waAlertadoEn = a.waAlertadoEn;
                    if (String(a.estado || '').toLowerCase() === 'cerrada' && !ev.gestionado) {
                        ev.gestionado = true;
                        ev.gestionadoEn = a.gestionadaEn || new Date().toISOString();
                    }
                });
            });
        }

        // Seguimiento de trámites administrativos (Fase B inicial)
        if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') {
            causa.tramiteMeta = {
                organismo: '',
                organismoLabel: '',
                tipoTramite: '',
                lugarGestion: '',
                numeroIngreso: ''
            };
        }
        if (typeof causa.tramiteMeta.organismoLabel !== 'string') causa.tramiteMeta.organismoLabel = '';
        if (!causa.tramiteMeta.tipoTramite && causa.tipoExpediente === 'tramite') causa.tramiteMeta.tipoTramite = 'Trámite administrativo';
        if (!causa.hitosTramite || typeof causa.hitosTramite !== 'object') {
            causa.hitosTramite = {
                fechaIngresoSistema: causa.fechaCreacion ? String(causa.fechaCreacion).slice(0, 10) : new Date().toISOString().slice(0, 10),
                fechaCargaDocumentos: null,
                fechaIngresoOrganismo: null,
                fechaRespuestaOrganismo: null,
                fechaFinalizacion: null
            };
        }
        if (!Array.isArray(causa.reparos)) causa.reparos = [];

        // Normalización honorarios (modalidad + planPagos) — compatibilidad hacia atrás
        if (!causa.honorarios) causa.honorarios = {};
        const h = causa.honorarios;

        // montoTotal: preferir el nuevo, si no tomar legacy montoBase/base
        const montoTotal = (typeof h.montoTotal === 'number' ? h.montoTotal : (parseFloat(h.montoTotal) || 0))
            || (typeof h.montoBase === 'number' ? h.montoBase : (parseFloat(h.montoBase) || 0))
            || (typeof h.base === 'number' ? h.base : (parseFloat(h.base) || 0));
        if (montoTotal > 0) {
            h.montoTotal = montoTotal;
            h.montoBase = montoTotal; // mantener alias usado por vistas legacy
        }

        // Asegurar pagos legacy como array
        if (!Array.isArray(h.pagos)) h.pagos = [];
        const totalPagadoLegacy = h.pagos.reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0);

        // Modalidad
        if (h.modalidad !== 'CONTADO' && h.modalidad !== 'CUOTAS') {
            // Inferir por presencia de cuotas/plan
            h.modalidad = (Array.isArray(h.cuotas) && h.cuotas.length) ? 'CUOTAS' : 'CONTADO';
        }

        // planPagos
        if (!Array.isArray(h.planPagos) || !h.planPagos.length) {
            if (Array.isArray(h.cuotas) && h.cuotas.length) {
                // Migrar cuotas legacy → planPagos
                h.planPagos = h.cuotas.map((c, idx) => ({
                    numero: c.numero || (idx + 1),
                    monto: parseFloat(c.monto) || 0,
                    fechaVencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento).toISOString() : new Date().toISOString(),
                    estado: (c.pagada || c.estado === 'PAGADA') ? 'PAGADA' : 'PENDIENTE',
                    fechaPago: c.fechaPago ? new Date(c.fechaPago).toISOString() : null
                }));
            } else if (montoTotal > 0) {
                // Default contado: una sola cuota
                h.planPagos = [{
                    numero: 1,
                    monto: montoTotal,
                    fechaVencimiento: new Date().toISOString(),
                    estado: (totalPagadoLegacy >= montoTotal) ? 'PAGADA' : 'PENDIENTE',
                    fechaPago: (totalPagadoLegacy >= montoTotal) ? new Date().toISOString() : null
                }];
            } else {
                h.planPagos = [];
            }
        }

        // saldoPendiente legacy: recalcular desde montoTotal - totalPagado
        const totalP = (montoTotal > 0) ? montoTotal : 0;
        h.saldoPendiente = Math.max(0, totalP - totalPagadoLegacy);
    });
})(_raw);

// ── 3. STORE — interfaz pública ─────────────────────────────────────
/**
 * Store — capa de acceso centralizado a todos los datos de la app.
 *
 * Principios:
 * - TODO el código debe leer/escribir a través de Store o sus alias (DB / save).
 * - Los arrays devueltos por los getters son referencias vivas: mutar el array
 *   refleja el cambio en memoria, pero se debe llamar Store.save() para persistir.
 * - `DB` es un alias de `Store._ref` para compatibilidad con código legacy.
 *
 * En Fase 2: los métodos de consulta (getCausa, getCliente, etc.) y los de
 * mutación (agregarCausa, eliminarCausa, etc.) serán reemplazados por llamadas
 * REST manteniendo la misma firma, sin cambios en el código de negocio.
 *
 * @namespace Store
 */
const Store = (() => {
    const _data = _raw;  // referencia interna

    // — Persistencia —
    function _persist() {
        _data.causes = _data.causas;       // mantener aliases legacy
        _data.juris = _data.jurisprudencia;
        try { _storage.setItem(DB_KEY, JSON.stringify(_data)); }
        catch (e) { console.error('[Store] Error al persistir:', e); }
    }

    // — Getters por colección —
    return {
        // Acceso a colecciones (array vivo — igual que antes)
        get causas() { return _data.causas; },
        get clientes() { return _data.clientes; },
        get jurisprudencia() { return _data.jurisprudencia; },
        get prospectos() { return _data.prospectos; },
        get propuestas() { return _data.propuestas; },
        get alertas() { return _data.alertas; },
        get documentos() { return _data.documentos; },
        get bitacora() { return _data.bitacora; },
        get intentosLogin() { return _data.intentosLogin; },
        get configuracion() { return _data.configuracion; },
        get loginBloqueado() { return _data.loginBloqueado; },
        get _doctrina() { return _data._doctrina; },

        // Setters controlados
        set loginBloqueado(v) { _data.loginBloqueado = v; },
        set configuracion(v) { _data.configuracion = v; },

        // — Persistencia —
        save: _persist,

        // — Consultas tipadas (capa de dominio) —
        getCausa: id => _data.causas.find(c => String(c.id) === String(id)),
        getCliente: id => _data.clientes.find(c => String(c.id) === String(id)),
        getCausasActivas: () => _data.causas.filter(c => c.estadoGeneral !== 'Finalizada'),
        getAlertasActivas: () => _data.alertas.filter(a => a.estado === 'activa'),
        getDocsDeCausa: causaId => _data.documentos.filter(d => String(d.causaId) === String(causaId)),

        // — Mutaciones controladas —
        agregarCausa(causa) {
            const c = (causa && typeof causa === 'object') ? { ...causa } : {};
            if (!c.id) c.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            if (!c.estadoGeneral) c.estadoGeneral = 'En tramitación';
            if (!c.fechaCreacion) c.fechaCreacion = new Date().toISOString();
            if (!c.fechaUltimaActividad) c.fechaUltimaActividad = c.fechaCreacion;
            if (!c.tipoExpediente) c.tipoExpediente = 'judicial';
            if (!c.tipoProcedimiento) c.tipoProcedimiento = c.tipoExpediente === 'tramite' ? 'Trámite Administrativo' : 'Ordinario Civil';
            if (!Array.isArray(c.docsCliente)) c.docsCliente = [];
            if (!Array.isArray(c.docsTribunal)) c.docsTribunal = [];
            if (!Array.isArray(c.docsContraparte)) c.docsContraparte = [];
            if (!Array.isArray(c.docsTramites)) c.docsTramites = [];
            if (!c.partes || typeof c.partes !== 'object') c.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            if (!c.iaSugerencias || typeof c.iaSugerencias !== 'object') c.iaSugerencias = {};
            if (!Array.isArray(c.eventosProcesalesIA)) c.eventosProcesalesIA = [];
            if (!c.audiencias || typeof c.audiencias !== 'object') c.audiencias = {};
            if (typeof c.audiencias.habilitado !== 'boolean') c.audiencias.habilitado = false;
            if (!c.audiencias.filtroVista) c.audiencias.filtroVista = 'todas';
            if (!c.tramiteMeta || typeof c.tramiteMeta !== 'object') c.tramiteMeta = { organismo: '', organismoLabel: '', tipoTramite: '', lugarGestion: '', numeroIngreso: '' };
            if (!c.hitosTramite || typeof c.hitosTramite !== 'object') {
                c.hitosTramite = {
                    fechaIngresoSistema: new Date().toISOString().slice(0, 10),
                    fechaCargaDocumentos: null,
                    fechaIngresoOrganismo: null,
                    fechaRespuestaOrganismo: null,
                    fechaFinalizacion: null
                };
            }
            if (!Array.isArray(c.reparos)) c.reparos = [];
            if (c.contratoServicios === undefined) c.contratoServicios = null;
            _data.causas.push(c);
            _persist();
            return c;
        },
        eliminarCausa(id) {
            _data.causas = _data.causas.filter(c => String(c.id) !== String(id));
            _persist();
        },
        agregarCliente(cliente) {
            const c = (cliente && typeof cliente === 'object') ? { ...cliente } : {};
            if (!c.id) c.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            c.nombre = String(c.nombre || '').trim();
            c.rut = String(c.rut || '').trim();
            c.telefono = String(c.telefono || '').trim();
            if (!c.fechaCreacion) c.fechaCreacion = new Date().toISOString();
            _data.clientes.push(c);
            _persist();
            return c;
        },
        agregarAlerta(alerta) {
            const a = (alerta && typeof alerta === 'object') ? { ...alerta } : {};
            if (!a.id) a.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            a.tipo = String(a.tipo || 'evento').toLowerCase();
            if (a.causaId === undefined) a.causaId = null;
            if (typeof a.mensaje !== 'string') a.mensaje = String(a.mensaje || '').trim();
            if (!a.fechaObjetivo) a.fechaObjetivo = new Date().toISOString().slice(0, 10);
            if (!a.prioridad) a.prioridad = 'media';
            if (!a.estado) a.estado = 'activa';
            if (a.waAlertadoEn === undefined) a.waAlertadoEn = null;
            if (a.gestionadaEn === undefined) a.gestionadaEn = null;
            _data.alertas.push(a);
            _persist();
            return a;
        },
        agregarDocumento(doc) {
            const d = (doc && typeof doc === 'object') ? { ...doc } : {};
            if (!d.id) d.id = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            if (d.causaId === undefined || d.causaId === '') d.causaId = null;
            d.tipo = String(d.tipo || 'Otro').trim() || 'Otro';
            if (!d.nombreOriginal && d.nombre) d.nombreOriginal = String(d.nombre || '').trim();
            d.nombreOriginal = String(d.nombreOriginal || 'documento').trim() || 'documento';
            if (!d.archivoMime && d.mimetype) d.archivoMime = d.mimetype;
            if (d.proveedorIA === undefined) d.proveedorIA = null;
            if (!d.fechaIngreso) d.fechaIngreso = new Date().toISOString();
            if (!d.fechaDocumento) d.fechaDocumento = new Date().toISOString().slice(0, 10);
            _data.documentos.push(d);
            _persist();
            return d;
        },
        registrarEvento(desc) {
            _data.bitacora.push({ descripcion: desc, fecha: new Date() });
            _persist();
        },

        // — Snapshot completo (para backup) —
        snapshot() {
            return JSON.parse(JSON.stringify(_data));
        },

        // — Restaurar desde snapshot —
        restaurar(snap) {
            Object.keys(snap).forEach(k => { _data[k] = snap[k]; });
            _persist();
        },

        // — Referencia interna expuesta para código legacy —
        // Permite que DB.causas siga funcionando como alias
        _ref: _data
    };
})();

// ── 4. DB — alias de compatibilidad con todo el código legacy ───────
// El código existente usa DB.causas, DB.clientes, etc.
// DB apunta al mismo objeto interno del Store → cero cambios en el resto.
const DB = Store._ref;

// ── 5. Funciones de persistencia legacy ─────────────────────────────
/**
 * Persiste el estado completo de DB en localStorage.
 * Alias corto de Store.save() para uso en todo el código legacy.
 * En Fase 2: reemplazar por llamada PATCH /api/db o por cola de mutaciones.
 */
function save() { Store.save(); }
const guardarDB = save;

function cleanupReferenciasHuerfanasDeCausas() {
    try {
        if (!DB || !Array.isArray(DB.causas)) return { ok: false, reason: 'db_no_disponible' };

        const causasIds = new Set((DB.causas || []).map(c => c?.id).filter(Boolean));

        const alertasAntes = Array.isArray(DB.alertas) ? DB.alertas.length : 0;
        const docsAntes = Array.isArray(DB.documentos) ? DB.documentos.length : 0;

        if (Array.isArray(DB.alertas)) {
            DB.alertas = DB.alertas.filter(a => {
                const cid = a?.causaId;
                if (!cid) return true;
                return causasIds.has(cid);
            });
        }

        if (Array.isArray(DB.documentos)) {
            DB.documentos = DB.documentos.filter(d => {
                const cid = d?.causaId;
                if (!cid) return true;
                return causasIds.has(cid);
            });
        }

        const alertasDespues = Array.isArray(DB.alertas) ? DB.alertas.length : 0;
        const docsDespues = Array.isArray(DB.documentos) ? DB.documentos.length : 0;

        const alertasBorradas = Math.max(0, alertasAntes - alertasDespues);
        const docsBorrados = Math.max(0, docsAntes - docsDespues);

        if (alertasBorradas > 0 || docsBorrados > 0) {
            try { if (typeof markAppDirty === 'function') markAppDirty(); } catch (_) {}
            try { save(); } catch (_) {}
            console.info(`[Cleanup] Eliminadas referencias huérfanas: alertas=${alertasBorradas}, documentos=${docsBorrados}`);
        }

        return { ok: true, alertasBorradas, docsBorrados };
    } catch (e) {
        console.warn('[Cleanup] Error limpiando referencias huérfanas:', e?.message || e);
        return { ok: false, error: e?.message || String(e) };
    }
}

window.cleanupReferenciasHuerfanasDeCausas = cleanupReferenciasHuerfanasDeCausas;

function cleanupAlertasPlantillaAntiguas(opts) {
    try {
        if (!DB || !Array.isArray(DB.causas) || !Array.isArray(DB.alertas)) return { ok: false, reason: 'db_no_disponible' };

        const cfg = opts && typeof opts === 'object' ? opts : {};
        const strictSameDay = cfg.strictSameDay !== false;

        const patrones = [
            'contestaci',
            'r\u00e9plica',
            'du\u00faplica',
            't\u00e9rmino probatorio',
            'vencimiento t\u00e9rmino probatorio'
        ];
        const rx = new RegExp(patrones.join('|'), 'i');

        const causasById = new Map((DB.causas || []).filter(Boolean).map(c => [String(c.id), c]));
        const docsGlobal = Array.isArray(DB.documentos) ? DB.documentos : [];

        const hasDocs = (causaId) => {
            const c = causasById.get(String(causaId));
            if (!c) return false;
            const inCausa = (Array.isArray(c.documentos) && c.documentos.length)
                || (Array.isArray(c.docsCliente) && c.docsCliente.length)
                || (Array.isArray(c.docsTribunal) && c.docsTribunal.length)
                || (Array.isArray(c.docsContraparte) && c.docsContraparte.length)
                || (Array.isArray(c.docsTramites) && c.docsTramites.length);
            if (inCausa) return true;
            return docsGlobal.some(d => d && String(d.causaId) === String(causaId));
        };

        const dayKey = (d) => {
            try {
                const x = (d instanceof Date) ? d : new Date(d);
                if (Number.isNaN(x.getTime())) return null;
                x.setHours(0, 0, 0, 0);
                return x.getTime();
            } catch (_) {
                return null;
            }
        };

        const alertasAntes = DB.alertas.length;
        DB.alertas = DB.alertas.filter(a => {
            if (!a || typeof a !== 'object') return true;
            if (String(a.tipo || '').toLowerCase() !== 'plazo') return true;
            if (!a.causaId) return true;
            const msg = String(a.mensaje || '');
            if (!rx.test(msg)) return true;

            const causa = causasById.get(String(a.causaId));
            if (!causa) return true;
            if (hasDocs(a.causaId)) return true;

            if (!strictSameDay) return false;

            const kC = dayKey(causa.fechaCreacion);
            const kA = dayKey(a.fechaCreacion || a.fechaObjetivo);
            if (kC === null || kA === null) return true;
            return kC !== kA;
        });

        const alertasDespues = DB.alertas.length;
        const borradas = Math.max(0, alertasAntes - alertasDespues);
        if (borradas > 0) {
            try { if (typeof markAppDirty === 'function') markAppDirty(); } catch (_) {}
            try { save(); } catch (_) {}
        }
        return { ok: true, borradas };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
}

window.cleanupAlertasPlantillaAntiguas = cleanupAlertasPlantillaAntiguas;

// Cleanup defensivo al inicio: evita “fantasmas” en alertas/semáforos.
// Se ejecuta ANTES de los renders principales.
try { cleanupReferenciasHuerfanasDeCausas(); } catch (_) {}
try { cleanupAlertasPlantillaAntiguas({ strictSameDay: true }); } catch (_) {}

// ── Migración Fase 3A: documentos a archivoDocId (cifrado en disco) ──────────
const DOCS_MIGRATION_FLAG = 'docs_migracion_archivoDocId_2026_03_02';
const DOCS_MIGRATION_FLAG_ALIAS = 'migracion_docs_v3_lista';

function _inferirOrigenDocumento(doc) {
    try {
        if (!doc) return 'cliente';
        if (doc.origen) return doc.origen;
        if (doc.tipo === 'Comprobante') return 'comprobante';

        const o = doc._origen;
        if (o === 'cuota' || o === 'pago' || o === 'migracion-comprobantes' || o === 'ui-comprobante') return 'comprobante';

        const det = doc._origenDetalleCausa;
        const tipo = det?.tipo;
        if (tipo === 'tribunal') return 'tribunal';
        if (tipo === 'tramites') return 'interno';
        if (tipo === 'cliente') return 'cliente';

        return 'cliente';
    } catch (_) {
        return 'cliente';
    }
}

async function migrarDocumentosAArchivoDocIdAsync() {
    const api = window.electronAPI;
    if (!api?.docs?.guardar) return { ok: false, skipped: true, reason: 'electron_docs_no_disponible' };

    let flag = null;
    try { flag = AppConfig.get(DOCS_MIGRATION_FLAG) || null; } catch (_) { flag = null; }
    let flagAlias = null;
    try { flagAlias = AppConfig.get(DOCS_MIGRATION_FLAG_ALIAS) || null; } catch (_) { flagAlias = null; }

    if ((flag && (flag.status === 'done' || flag.status === 'in_progress')) || flagAlias === true) {
        return { ok: true, skipped: true, reason: 'flag' };
    }

    try {
        AppConfig.set(DOCS_MIGRATION_FLAG, { status: 'in_progress', at: new Date().toISOString() });
    } catch (_) {}

    try {
        console.info('[Store] Iniciando migración de documentos...');
    } catch (_) {}

    const docs = (DB && Array.isArray(DB.documentos)) ? DB.documentos : [];
    let migrated = 0;
    let errors = 0;

    const BATCH = 5;
    let processed = 0;

    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        try {
            if (!doc) { processed++; continue; }
            if (doc.archivoDocId) {
                if (!doc.origen) doc.origen = _inferirOrigenDocumento(doc);
                processed++;
                continue;
            }
            const base64 = (typeof doc.archivoBase64 === 'string') ? doc.archivoBase64 : '';
            if (!base64) {
                if (!doc.origen) doc.origen = _inferirOrigenDocumento(doc);
                processed++;
                continue;
            }

            const nombre = doc.archivoNombre || doc.nombreOriginal || 'documento';
            const mime = doc.archivoMime || doc.mime || 'application/pdf';
            const r = await api.docs.guardar(nombre, base64, mime);
            if (!r?.ok || !r.id) throw new Error(r?.error || 'No se pudo guardar el archivo');

            doc.archivoDocId = String(r.id);
            doc.archivoMime = doc.archivoMime || mime;
            doc.archivoNombre = doc.archivoNombre || nombre;
            if (!doc.origen) doc.origen = _inferirOrigenDocumento(doc);

            // IMPORTANT: base64 debe salir del JSON para aligerar DB
            delete doc.archivoBase64;
            migrated++;
            processed++;
        } catch (e) {
            errors++;
            processed++;
            console.warn('[Store] Migración archivoDocId falló para un documento (no crítico):', e?.message || e);
        }

        if (processed % BATCH === 0) {
            try {
                console.info(`[Store] Migración en progreso: ${processed}/${docs.length}...`);
            } catch (_) {}
            await new Promise(r => setTimeout(r, 0));
        }
    }

    if (migrated > 0) {
        try { if (typeof markAppDirty === 'function') markAppDirty(); } catch (_) {}
        try { save(); } catch (_) {}
    }

    try {
        AppConfig.set(DOCS_MIGRATION_FLAG, {
            status: 'done',
            at: new Date().toISOString(),
            migrated,
            errors,
            total: docs.length
        });
    } catch (_) {}

    try { AppConfig.set(DOCS_MIGRATION_FLAG_ALIAS, true); } catch (_) {}

    try {
        console.info(`[Store] Migración completada: ${migrated} documentos procesados.`);
    } catch (_) {}

    return { ok: true, migrated, errors, total: docs.length };
}

window.migrarDocumentosAArchivoDocIdAsync = migrarDocumentosAArchivoDocIdAsync;

// Ejecutar diferido para no bloquear el arranque/render
setTimeout(() => {
    migrarDocumentosAArchivoDocIdAsync().catch(e => {
        console.warn('[Store] Migración archivoDocId (async) falló (no crítico):', e?.message || e);
    });
}, 1500);

// ════════════════════════════════════════════════════════════════════
// AUTO-BACKUP — Sistema de respaldo automático con historial rotativo
// ════════════════════════════════════════════════════════════════════
const AutoBackup = (() => {
    let _timer = null;
    let _lastSaved = null;

    function _listarBackups() {
        try { return JSON.parse(_storage.getItem(BACKUP_KEY)) || []; }
        catch (e) { return []; }
    }

    function _guardarListaBackups(lista) {
        try { _storage.setItem(BACKUP_KEY, JSON.stringify(lista)); }
        catch (e) { console.error('[AutoBackup] Error al guardar lista:', e); }
    }

    function crearSnapshot(motivo = 'auto') {
        const backups = _listarBackups();
        const snap = {
            id: uid(),
            fecha: new Date().toISOString(),
            motivo,
            causas: Store.causas.length,
            clientes: Store.clientes.length,
            datos: Store.snapshot()
        };
        backups.unshift(snap);                    // más reciente primero
        const recortada = backups.slice(0, BACKUP_MAX);  // máx 5
        _guardarListaBackups(recortada);
        _lastSaved = new Date();
        _notificar(motivo);
        return snap;
    }

    function _notificar(motivo) {
        const badge = document.getElementById('backup-badge');
        if (!badge) return;
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        badge.textContent = `💾 Backup ${motivo === 'auto' ? 'auto' : motivo} · ${hora}`;
        badge.style.opacity = '1';
        clearTimeout(badge._hide);
        badge._hide = setTimeout(() => { badge.style.opacity = '0'; }, 4000);
    }

    function listar() { return _listarBackups(); }

    function restaurarDesde(backupId) {
        const lista = _listarBackups();
        const backup = lista.find(b => b.id === backupId);
        if (!backup) { showError('Backup no encontrado.'); return; }
        if (!confirm(`¿Restaurar backup del ${new Date(backup.fecha).toLocaleString('es-CL')}?\n\nEsta acción reemplazará todos los datos actuales.`)) return;
        crearSnapshot('antes-de-restaurar');  // guardar estado actual primero
        Store.restaurar(backup.datos);
        showSuccess('✅ Datos restaurados correctamente. La app se recargará.');
        location.reload();
    }

    function iniciar() {
        crearSnapshot('inicio-sesion');   // snapshot al entrar
        _timer = setInterval(() => crearSnapshot('auto'), BACKUP_INTERVAL_MS);
        // Guardar referencia para poder removerla en detener()
        AutoBackup._unloadHandler = () => crearSnapshot('cierre');
        window.addEventListener('beforeunload', AutoBackup._unloadHandler);
    }

    function detener() {
        if (_timer) { clearInterval(_timer); _timer = null; }
        if (AutoBackup._unloadHandler) {
            window.removeEventListener('beforeunload', AutoBackup._unloadHandler);
            AutoBackup._unloadHandler = null;
        }
    }

    function ultimoBackup() { return _lastSaved; }

    return { iniciar, detener, crearSnapshot, listar, restaurarDesde, ultimoBackup };
})();

// ─── Plazos ───────────────────────────────────────────────────────
const PLAZOS = {
    civil: [
        { n: "Contestación demanda (procedimiento ordinario)", d: 15, l: "Art. 258 CPC" },
        { n: "Apelación sentencia definitiva", d: 10, l: "Art. 189 inc. 1 CPC" },
        { n: "Apelación sentencia interlocutoria", d: 5, l: "Art. 189 inc. 1 CPC" },
        { n: "Casación en la forma", d: 15, l: "Art. 770 CPC" },
        { n: "Recurso de reposición", d: 5, l: "Art. 181 CPC" },
        { n: "Prueba (término ordinario)", d: 20, l: "Art. 328 CPC" }
    ],
    laboral: [
        { n: "Contestación demanda", d: 5, l: "Art. 452 CT" },
        { n: "Recurso de nulidad", d: 10, l: "Art. 479 CT" },
        { n: "Apelación en juicio de cobranza", d: 5, l: "Art. 476 CT" },
        { n: "Recurso de reposición", d: 5, l: "Art. 465 CT" }
    ]
};


// ████████████████████████████████████████████████████████████████████
// JS — BLOQUE 2: AUTENTICACIÓN Y USUARIOS
// • Plazos legales, sistema multi-usuario, login, roles y permisos
// ████████████████████████████████████████████████████████████████████

// ─── Auth ─────────────────────────────────────────────────────────
// Contraseña almacenada como hash base64 (no texto plano)
// Hash de "admin123": btoa("admin123") = "YWRtaW4xMjM="
// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE USUARIOS — Multi-cuenta local con roles y permisos
// ═══════════════════════════════════════════════════════════════════════
// ─── Hashing seguro (SHA-256) ─────────────────────────────────────
/**
 * Genera un hash SHA-256 del texto en claro para almacenamiento seguro de contraseñas.
 * @param {string} pw - Contraseña en texto plano.
 * @returns {Promise<string>} Hash hexadecimal de 64 caracteres.
 * @private
 */
async function _hash(pw) {
    const msgBuffer = new TextEncoder().encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const USERS_KEY = 'LEXIUM_USERS_V1';
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

const ROLES_PERMISOS = {
    admin: { verCausas: true, editarCausas: true, eliminarCausas: true, verHonorarios: true, editarHonorarios: true, verClientes: true, editarClientes: true, verBitacora: true, gestionarUsuarios: true, exportar: true, crearEscritos: true, editarEstrategia: true },
    abogado: { verCausas: true, editarCausas: true, eliminarCausas: false, verHonorarios: true, editarHonorarios: true, verClientes: true, editarClientes: true, verBitacora: false, gestionarUsuarios: false, exportar: true, crearEscritos: true, editarEstrategia: true },
    asistente: { verCausas: true, editarCausas: true, eliminarCausas: false, verHonorarios: false, editarHonorarios: false, verClientes: true, editarClientes: false, verBitacora: false, gestionarUsuarios: false, exportar: false, crearEscritos: false, editarEstrategia: false },
    readonly: { verCausas: true, editarCausas: false, eliminarCausas: false, verHonorarios: false, editarHonorarios: false, verClientes: true, editarClientes: false, verBitacora: false, gestionarUsuarios: false, exportar: false, crearEscritos: false, editarEstrategia: false }
};

const PERMISOS_LABELS = {
    verCausas: 'Ver causas', editarCausas: 'Editar causas', eliminarCausas: 'Eliminar causas',
    verHonorarios: 'Ver honorarios', editarHonorarios: 'Editar honorarios',
    verClientes: 'Ver clientes', editarClientes: 'Editar clientes',
    verBitacora: 'Bitácora del sistema', gestionarUsuarios: 'Gestionar usuarios',
    exportar: 'Exportar datos', crearEscritos: 'Generar escritos', editarEstrategia: 'Editar estrategia'
};

const Users = (() => {
    // Lee y escribe desde AppConfig — fuente única de verdad
    function _cargar() { return AppConfig.get('usuarios') || []; }
    function _guardar(lista) { AppConfig.set('usuarios', lista); }

    return {
        async inicializar() {
            const lista = _cargar();
            if (lista.length === 0) {
                const hpw = await _hash('admin123');
                _guardar([{
                    id: uid(), nombre: 'Administrador', usuario: 'admin',
                    passwordHash: hpw, rol: 'admin', color: '#1a3a6b',
                    activo: true, fechaCreacion: new Date().toISOString()
                }]);
                console.info('[Users] Admin inicial creado.');
            } else {
                console.info('[Users] Usuarios cargados:', lista.length);
            }
        },
        listar() { return _cargar(); },
        buscar(usuario) {
            return _cargar().find(u => u.usuario === usuario && u.activo !== false) || null;
        },
        async agregar(data) {
            const lista = _cargar();
            if (lista.find(u => u.usuario === data.usuario)) return { error: 'Usuario ya existe' };
            if (!data.password || data.password.length < 6) return { error: 'Contrasena minimo 6 caracteres' };
            const hpw = await _hash(data.password);
            const nuevo = {
                id: uid(), nombre: data.nombre, usuario: data.usuario,
                passwordHash: hpw, rol: data.rol || 'abogado',
                color: data.color || '#1a3a6b', activo: true,
                fechaCreacion: new Date().toISOString()
            };
            lista.push(nuevo);
            _guardar(lista);
            return { ok: true, user: nuevo };
        },
        async editar(id, data) {
            const lista = _cargar();
            const u = lista.find(u => String(u.id) === String(id));
            if (!u) return { error: 'Usuario no encontrado' };
            if (data.nombre) u.nombre = data.nombre;
            if (data.password && data.password.length >= 6) u.passwordHash = await _hash(data.password);
            if (data.rol && u.rol !== 'admin') u.rol = data.rol;
            if (data.color) u.color = data.color;
            _guardar(lista);
            return { ok: true };
        },
        eliminar(id) {
            const lista = _cargar();
            const u = lista.find(u => String(u.id) === String(id));
            if (!u) return { error: 'Usuario no encontrado' };
            if (u.rol === 'admin') return { error: 'No se puede eliminar la cuenta admin' };
            _guardar(lista.filter(x => String(x.id) !== String(id)));
            console.info('[Users] Eliminado permanentemente:', u.usuario);
            return { ok: true };
        },
        async verificar(usuario, password) {
            const u = this.buscar(usuario);
            if (!u) return null;
            const hpw = await _hash(password);
            return u.passwordHash === hpw ? u : null;
        },
        tienePermiso(permiso) {
            const rol = DB.rolActual || 'readonly';
            return !!(ROLES_PERMISOS[rol]?.[permiso]);
        }
    };
})();

// Sesión activa
let _sesionUsuario = null;

// Inicializar usuarios al arrancar — espera async antes de renderizar
(async () => {
    if (window.DiskStorage && window.DiskStorage.isElectron) {
        await new Promise(resolve => window.DiskStorage.cuandoListo(resolve));
        AppConfig.recargar();
    }
    await Users.inicializar();
    setTimeout(() => {
        loginRenderUsuarios();
    }, 100);
})();

async function loginRenderUsuarios() {
    const lista = Users.listar();
    const el = document.getElementById('login-user-list');
    if (!el) return;
    el.innerHTML = lista.filter(u => u.activo !== false).map(u => `
                <button class="login-user-btn" data-user-id="${u.id}">
                    <div class="login-avatar" style="background:${u.color || '#1a3a6b'};">${(u.nombre || '?')[0].toUpperCase()}</div>
                    <div class="login-user-info">
                        <div class="login-user-name">${escHtml(u.nombre)}</div>
                        <div class="login-user-role">${escHtml(u.usuario)} · ${u.rol === 'admin' ? '👑 Administrador' : u.rol === 'abogado' ? 'Abogado' : u.rol === 'asistente' ? 'Asistente' : 'Solo lectura'}</div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:var(--t2); font-size:0.7rem;"></i>
                </button>`).join('');
}

let _loginUserId = null;
// Delegación de eventos (CSP estricto: sin handlers inline)
document.addEventListener('click', (ev) => {
    const btn = ev.target && ev.target.closest ? ev.target.closest('.login-user-btn') : null;
    if (!btn) return;
    const cont = document.getElementById('login-user-list');
    if (!cont || !cont.contains(btn)) return;
    const id = btn.dataset.userId;
    if (!id) return;
    loginSeleccionarUsuario(id);
});

async function loginSeleccionarUsuario(id) {
    _loginUserId = id;
    const lista = Users.listar();
    const u = lista.find(u => String(u.id) === String(id));
    if (!u) return;
    document.querySelectorAll('.login-user-btn').forEach(b => b.classList.remove('selected'));
    // Marcar botón seleccionado
    document.querySelectorAll('.login-user-btn').forEach(b => {
        if (String(b.dataset.userId || '') === String(id)) b.classList.add('selected');
    });
    document.getElementById('login-user-list').style.display = 'none';
    const pwBlock = document.getElementById('login-pw-block');
    pwBlock.classList.add('visible');
    document.getElementById('login-pw-label').textContent = `Contraseña de ${u.nombre}`;
    document.getElementById('pw').value = '';
    document.getElementById('pw').focus();
    document.getElementById('err').textContent = '';
}

function loginVolver() {
    _loginUserId = null;
    document.getElementById('login-user-list').style.display = 'flex';
    document.getElementById('login-pw-block').classList.remove('visible');
    document.getElementById('err').textContent = '';
    document.getElementById('pw').value = '';
}

/**
 * Valida las credenciales del formulario de login y abre la app si son correctas.
 * Implementa bloqueo por intentos fallidos (MAX_INTENTOS / BLOQUEO_MS).
 * Al autenticar con éxito, establece DB.usuarioActual, DB.rolActual y llama _abrirApp().
 * @returns {Promise<void>}
 */
async function auth() {
    const ahora = Date.now();
    const btnReset = document.getElementById('btn-reset-bloqueo');
    if (DB.loginBloqueado.hasta && ahora < DB.loginBloqueado.hasta) {
        const restantes = Math.ceil((DB.loginBloqueado.hasta - ahora) / 60000);
        document.getElementById('err').innerText = `Sistema bloqueado. Intente en ${restantes} minuto(s).`;
        // Mostrar botón de desbloqueo solo cuando hay bloqueo activo
        if (btnReset) btnReset.style.display = 'inline';
        return;
    }
    // Ocultar botón si no hay bloqueo activo
    if (btnReset) btnReset.style.display = 'none';
    const pw = document.getElementById('pw').value.trim();
    if (!pw) { document.getElementById('err').innerText = 'Ingrese su contraseña.'; return; }

    // Login por Users si hay un usuario seleccionado
    if (_loginUserId) {
        const lista = Users.listar();
        const u = lista.find(u => String(u.id) === String(_loginUserId));
        const ok = u && await Users.verificar(u.usuario, pw);
        if (ok) {
            _sesionUsuario = ok;
            DB.rolActual = ok.rol;
            DB.usuarioActual = ok.usuario;
            DB.loginBloqueado = { hasta: null, intentosFallidos: 0 };
            registrarIntentoLogin(ok.usuario, true);
            save();
            _abrirApp();
        } else {
            DB.loginBloqueado.intentosFallidos = (DB.loginBloqueado.intentosFallidos || 0) + 1;
            registrarIntentoLogin(u?.usuario || 'desconocido', false);
            const rest = MAX_INTENTOS - DB.loginBloqueado.intentosFallidos;
            if (DB.loginBloqueado.intentosFallidos >= MAX_INTENTOS) {
                DB.loginBloqueado.hasta = ahora + BLOQUEO_MS;
                DB.loginBloqueado.intentosFallidos = 0;
                document.getElementById('err').innerText = 'Demasiados intentos. Bloqueado 5 min.';
            } else {
                document.getElementById('err').innerText = `Contraseña incorrecta. ${rest} intento(s) restante(s).`;
            }
            save();
        }
    } else {
        // Sin usuario seleccionado — no permitir login
        document.getElementById('err').innerText = 'Seleccione un usuario primero.';
        loginVolver();
    }
}

function _abrirApp() {
    const ls = document.getElementById('login-screen');
    if (ls) ls.style.display = 'none';
    document.getElementById('side').style.display = 'flex';
    document.getElementById('app').style.display = 'block';
    document.body.classList.add('sidebar-open');
    const topbar = document.getElementById('topbar');
    if (topbar) topbar.classList.add('visible');
    document.getElementById('pw').value = '';
    document.getElementById('err').innerText = '';
    // Actualizar sidebar con usuario activo
    const u = _sesionUsuario;
    if (u) {
        document.getElementById('su-avatar').textContent = (u.nombre || '?')[0].toUpperCase();
        document.getElementById('su-avatar').style.background = u.color || '#2563eb';
        document.getElementById('su-nombre').textContent = u.nombre;
        document.getElementById('su-rol').textContent = u.rol === 'admin' ? 'Administrador' : u.rol === 'abogado' ? 'Abogado' : u.rol === 'asistente' ? 'Asistente' : 'Solo lectura';
        // Update topbar
        const ta = document.getElementById('topbar-avatar');
        const tn = document.getElementById('topbar-name');
        const te = document.getElementById('topbar-email');
        if (ta) { ta.textContent = (u.nombre || '?')[0].toUpperCase(); ta.style.background = u.color || '#2563eb'; }
        if (tn) tn.textContent = u.nombre;
        if (te) te.textContent = (u.usuario || 'admin') + '@lexium.cl';
    }
    // Botón admin solo visible para admin
    const btnAdmin = document.getElementById('btn-admin-usuarios');
    if (btnAdmin) btnAdmin.style.display = (u && u.rol === 'admin') ? 'inline-flex' : 'none';
    // Aplicar restricciones de UI según rol
    _aplicarRestriccionesRol();
    // Esperar a que los modales parciales estén inyectados (html-loader) antes de init
    var modalsContainer = document.getElementById('modals-container');
    if (modalsContainer && !document.getElementById('modal-nuevo-usuario')) {
        window.addEventListener('modals-loaded', function onModalsLoaded() {
            window.removeEventListener('modals-loaded', onModalsLoaded);
            init();
            if (typeof BackupDisco !== 'undefined') BackupDisco.iniciar();
            if (typeof DocFisico !== 'undefined') DocFisico.iniciar();
        });
    } else {
        init();
        // Backup a disco: iniciar al abrir sesión
        if (typeof BackupDisco !== 'undefined') BackupDisco.iniciar();
        // Almacenamiento físico de documentos
        if (typeof DocFisico !== 'undefined') DocFisico.iniciar();
    }
}

function _aplicarRestriccionesRol() {
    const rol = DB.rolActual || 'readonly';
    const p = ROLES_PERMISOS[rol] || ROLES_PERMISOS.readonly;
    // Ocultar elementos según permisos
    document.querySelectorAll('[data-requiere-permiso]').forEach(el => {
        const permiso = el.dataset.requierePermiso;
        el.style.display = p[permiso] ? '' : 'none';
    });
}

async function resetBloqueo() {
    // Requiere verificar contraseña del administrador para evitar bypass del bloqueo
    const adminUser = Users.listar().find(u => u.rol === 'admin');
    if (!adminUser) {
        document.getElementById('err').innerText = 'No hay usuario administrador configurado.';
        return;
    }
    const codeIngresado = prompt('Ingrese la contraseña del administrador para desbloquear:');
    if (codeIngresado === null) return; // cancelado
    const ok = await Users.verificar(adminUser.usuario, codeIngresado);
    if (!ok) {
        document.getElementById('err').innerText = 'Contraseña incorrecta. No se desbloqueó.';
        document.getElementById('err').style.color = 'var(--danger)';
        return;
    }
    DB.loginBloqueado = { hasta: null, intentosFallidos: 0 };
    save();
    document.getElementById('err').innerText = '✓ Desbloqueado. Puede intentar nuevamente.';
    document.getElementById('err').style.color = 'var(--success)';
}

/**
 * Cierra la sesión del usuario actual: limpia el estado de sesión en DB,
 * oculta la app y muestra la pantalla de login.
 */
function logout() {
    if (!confirm("¿Confirma cerrar sesión?")) return;
    AutoBackup.crearSnapshot('logout');
    AutoBackup.detener();
    _sesionUsuario = null;
    DB.rolActual = null; DB.usuarioActual = null;
    const ls2 = document.getElementById('login-screen');
    if (ls2) ls2.style.display = 'flex';
    const tb = document.getElementById('topbar');
    if (tb) tb.classList.remove('visible');
    document.getElementById('login-user-list').style.display = 'flex';
    document.getElementById('login-pw-block').classList.remove('visible');
    document.getElementById('pw').value = '';
    document.getElementById('err').innerText = '';
    document.getElementById('side').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.body.classList.remove('sidebar-open');
    loginRenderUsuarios();
}

// ─── Admin: CRUD usuarios ─────────────────────────────────────────
let _avatarColorSeleccionado = '#1a3a6b';

function selectAvatarColor(el) {
    document.querySelectorAll('.avatar-color-opt').forEach(e => e.style.border = '2px solid transparent');
    el.style.border = '3px solid white';
    _avatarColorSeleccionado = el.dataset.color;
}

function uiUpdatePermisosPrev() {
    const rol = document.getElementById('nu-rol')?.value || 'abogado';
    const p = ROLES_PERMISOS[rol] || {};
    const el = document.getElementById('permisos-preview');
    if (!el) return;
    el.innerHTML = Object.entries(PERMISOS_LABELS).map(([k, label]) =>
        `<span style="display:inline-flex; align-items:center; gap:4px; margin:2px 4px 2px 0; font-size:0.7rem; color:${p[k] ? 'var(--s)' : '#94a3b8'};">
                    <i class="fas ${p[k] ? 'fa-check' : 'fa-times'}" style="font-size:0.6rem;"></i> ${label}
                </span>`).join('');
}

function uiCrearUsuario(id) {
    document.getElementById('edit-user-id').value = id || '';
    document.getElementById('modal-user-title').innerHTML = id
        ? '<i class="fas fa-user-edit"></i> Editar Usuario'
        : '<i class="fas fa-user-plus"></i> Nuevo Usuario';
    if (id) {
        const u = Users.listar().find(u => String(u.id) === String(id));
        if (u) { document.getElementById('nu-nombre').value = u.nombre; document.getElementById('nu-usuario').value = u.usuario; document.getElementById('nu-password').value = ''; document.getElementById('nu-rol').value = u.rol !== 'admin' ? u.rol : 'abogado'; _avatarColorSeleccionado = u.color || '#1a3a6b'; }
    } else {
        document.getElementById('nu-nombre').value = '';
        document.getElementById('nu-usuario').value = '';
        document.getElementById('nu-password').value = '';
        document.getElementById('nu-rol').value = 'abogado';
        _avatarColorSeleccionado = '#1a3a6b';
    }
    uiUpdatePermisosPrev();
    abrirModal('modal-nuevo-usuario');
}

async function guardarUsuario() {
    const editId = document.getElementById('edit-user-id').value || null;
    const nombre = document.getElementById('nu-nombre').value.trim();
    const usuario = document.getElementById('nu-usuario').value.trim().toLowerCase();
    const password = document.getElementById('nu-password').value;
    const rol = document.getElementById('nu-rol').value;
    if (!nombre || !usuario) { showError('Nombre y usuario son obligatorios.'); return; }
    let res;
    if (editId) {
        res = await Users.editar(editId, { nombre, password, rol, color: _avatarColorSeleccionado });
    } else {
        res = await Users.agregar({ nombre, usuario, password, rol, color: _avatarColorSeleccionado });
    }
    if (res.error) { showError('Error: ' + res.error); return; }
    registrarEvento(`Usuario ${editId ? 'editado' : 'creado'}: ${nombre} (${rol})`);
    save();
    cerrarModal('modal-nuevo-usuario');
    renderGestionUsuarios();
}

async function eliminarUsuario(id) {
    const lista = Users.listar();
    const u = lista.find(u => String(u.id) === String(id));
    if (!u) return;
    if (!confirm(`¿Eliminar al usuario ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    const res = Users.eliminar(id);
    if (res.error) { showError(res.error); return; }
    registrarEvento(`Usuario eliminado: ${u.nombre}`);
    save();
    renderGestionUsuarios();
}

async function renderGestionUsuarios() {
    const lista = Users.listar();
    const el = document.getElementById('users-lista');
    const count = document.getElementById('user-count');
    if (count) count.textContent = `(${lista.length})`;
    if (!el) return;

    el.innerHTML = lista.map(u => `
                <div class="user-card">
                    <div class="user-card-avatar" style="background:${u.color || '#1a3a6b'};">${(u.nombre || '?')[0].toUpperCase()}</div>
                    <div class="user-card-info">
                        <div class="user-card-name">${escHtml(u.nombre)}</div>
                        <div class="user-card-meta">${escHtml(u.usuario)} · Creado ${new Date(u.fechaCreacion || 0).toLocaleDateString('es-CL')}</div>
                    </div>
                    <span class="user-role-badge urb-${u.rol}">${u.rol === 'admin' ? '👑 Admin' : u.rol === 'abogado' ? 'Abogado' : u.rol === 'asistente' ? 'Asistente' : 'Lectura'}</span>
                    ${u.rol !== 'admin' ? `
                    <button class="btn btn-sm" style="background:var(--bg-2,var(--bg));" onclick="uiCrearUsuario('${u.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-d btn-sm" onclick="eliminarUsuario('${u.id}')"><i class="fas fa-trash"></i></button>` : '<span style="font-size:0.7rem; color:var(--t2);">Cuenta maestra</span>'}
                </div>`).join('');

    // Tabla de permisos
    const tbody = document.getElementById('permisos-tabla');
    if (tbody) tbody.innerHTML = Object.entries(PERMISOS_LABELS).map(([k, label]) => {
        const p = Object.fromEntries(Object.entries(ROLES_PERMISOS).map(([r, ps]) => [r, ps[k]]));
        const ic = v => v ? '✓' : '–';
        const cl = v => v ? 'color:var(--s); font-weight:700;' : 'color:#cbd5e1;';
        return `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:5px 8px; font-size:0.73rem;">${label}</td>
                    <td style="text-align:center; ${cl(p.admin)}">${ic(p.admin)}</td>
                    <td style="text-align:center; ${cl(p.abogado)}">${ic(p.abogado)}</td>
                    <td style="text-align:center; ${cl(p.asistente)}">${ic(p.asistente)}</td>
                    <td style="text-align:center; ${cl(p.readonly)}">${ic(p.readonly)}</td>
                </tr>`;
    }).join('');

    const tools = document.getElementById('admin-clave-temp-tools');
    if (tools) {
        const cfg = DB.configuracion || {};
        const expTs = parseInt(cfg.adminClaveTemporalExp || 0, 10) || 0;
        const activa = !!cfg.adminClaveTemporalHash && expTs > Date.now();
        const expTxt = activa ? new Date(expTs).toLocaleString('es-CL') : 'No activa';
        tools.innerHTML = `
            <div class="card" style="border:1px dashed var(--border); background:var(--bg-2);">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div>
                        <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3);">Clave temporal de administrador</div>
                        <div style="font-size:12px; color:var(--text-2); margin-top:4px;">Estado: <strong>${activa ? 'Activa' : 'Inactiva'}</strong> · Expira: ${escHtml(expTxt)}</div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-sm" style="background:#0f766e; color:#fff; border:none;" onclick="uiGenerarClaveTemporalAdmin()"><i class="fas fa-key"></i> Generar clave temporal</button>
                        <button class="btn btn-sm" style="background:#7f1d1d; color:#fff; border:none;" onclick="uiRevocarClaveTemporalAdmin()"><i class="fas fa-ban"></i> Revocar</button>
                    </div>
                </div>
            </div>
        `;
    }
}

async function uiGenerarClaveTemporalAdmin() {
    const u = DB.usuarioActual || {};
    if ((u.rol || '') !== 'admin') { showError('Solo el administrador puede generar claves temporales.'); return; }

    const mins = parseInt(prompt('Duración de la clave temporal (minutos):', '60') || '0', 10) || 0;
    if (mins <= 0) { showError('Duración inválida.'); return; }

    const plain = prompt('Ingrese la clave temporal a delegar (mínimo 6 caracteres):', '');
    if (!plain || plain.length < 6) { showError('Clave temporal inválida (mínimo 6 caracteres).'); return; }

    try {
        const hash = await _hash(plain);
        if (!DB.configuracion) DB.configuracion = {};
        DB.configuracion.adminClaveTemporalHash = hash;
        DB.configuracion.adminClaveTemporalExp = Date.now() + (mins * 60 * 1000);
        if (typeof markAppDirty === 'function') markAppDirty();
        save();
        registrarEvento(`Clave temporal admin generada por ${u.nombre || u.usuario || 'admin'} (${mins} min)`);
        showSuccess('Clave temporal generada y activada.');
        renderGestionUsuarios();
    } catch (e) {
        showError(e?.message || 'No se pudo generar la clave temporal.');
    }
}

function uiRevocarClaveTemporalAdmin() {
    const u = DB.usuarioActual || {};
    if ((u.rol || '') !== 'admin') { showError('Solo el administrador puede revocar claves temporales.'); return; }

    if (!confirm('¿Revocar la clave temporal administrativa activa?')) return;
    if (!DB.configuracion) DB.configuracion = {};
    DB.configuracion.adminClaveTemporalHash = '';
    DB.configuracion.adminClaveTemporalExp = 0;
    if (typeof markAppDirty === 'function') markAppDirty();
    save();
    registrarEvento(`Clave temporal admin revocada por ${u.nombre || u.usuario || 'admin'}`);
    showInfo('Clave temporal revocada.');
    renderGestionUsuarios();
}

// ═══════════════════════════════════════════════════════════════════════
// BIBLIOTECA DOCUMENTAL — Índice estructurado de todos los documentos
// ═══════════════════════════════════════════════════════════════════════
const BIB_KEY = 'LEXIUM_BIBLIOTECA_V1';
let _bibView = 'grid';
let _bibTagActivo = '';

const Biblioteca = (() => {
    function _cargar() { return AppConfig.get('biblioteca') || []; }
    function _guardar(docs) { AppConfig.set('biblioteca', docs); }
    return {
        listar: () => _cargar(),
        agregar(doc) {
            const docs = _cargar();
            const nuevo = { id: uid(), nombre: doc.nombre, tipo: doc.tipo || 'otro', causaId: doc.causaId || null, etapa: doc.etapa || 'General', tags: doc.tags || [], descripcion: doc.descripcion || '', fecha: doc.fecha || new Date().toISOString().split('T')[0], version: doc.version || 'v1.0', fechaCarga: new Date().toISOString(), cargadoPor: DB.usuarioActual || 'admin', versiones: [{ v: doc.version || 'v1.0', fecha: new Date().toISOString(), nota: 'Versión inicial' }] };
            docs.push(nuevo);
            _guardar(docs);
            return nuevo;
        },
        eliminar(id) { const docs = _cargar().filter(d => d.id !== id); _guardar(docs); },
        buscar(query) {
            const q = query.toLowerCase();
            return _cargar().filter(d =>
                d.nombre.toLowerCase().includes(q) ||
                (d.descripcion || '').toLowerCase().includes(q) ||
                (d.tags || []).some(t => t.toLowerCase().includes(q))
            );
        },
        stats() {
            const docs = _cargar();
            const porTipo = {};
            docs.forEach(d => { porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1; });
            return { total: docs.length, porTipo };
        }
    };
})();

function bibAgregarDocumento() {
    // Pre-llenar select de causas
    const sel = document.getElementById('bib-causa-sel');
    if (sel) sel.innerHTML = '<option value="">— Sin causa —</option>' + DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');
    document.getElementById('bib-nombre').value = '';
    document.getElementById('bib-tags').value = '';
    document.getElementById('bib-descripcion').value = '';
    document.getElementById('bib-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('bib-version').value = 'v1.0';
    abrirModal('modal-bib-add');
}

function bibGuardarDocumento() {
    const nombre = document.getElementById('bib-nombre').value.trim();
    if (!nombre) { showError('El nombre es obligatorio.'); return; }
    const tags = document.getElementById('bib-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    Biblioteca.agregar({
        nombre, tipo: document.getElementById('bib-tipo').value,
        causaId: parseInt(document.getElementById('bib-causa-sel').value) || null,
        etapa: document.getElementById('bib-etapa').value,
        tags, descripcion: document.getElementById('bib-descripcion').value,
        fecha: document.getElementById('bib-fecha').value,
        version: document.getElementById('bib-version').value
    });
    registrarEvento(`Documento agregado a biblioteca: ${nombre}`);
    cerrarModal('modal-bib-add');
    bibRender();
}

function bibFiltroTag(tag, el) {
    _bibTagActivo = tag;
    document.querySelectorAll('.bib-tag').forEach(t => t.classList.remove('activo'));
    if (el) el.classList.add('activo');
    bibRender();
}

function bibSetView(view, btn) {
    _bibView = view;
    document.querySelectorAll('.bib-view-btn').forEach(b => b.classList.remove('activo'));
    if (btn) btn.classList.add('activo');
    bibRender();
}

function _bibColorClass(tipo) {
    return { pdf: 'bib-color-pdf', word: 'bib-color-word', excel: 'bib-color-excel', imagen: 'bib-color-img', txt: 'bib-color-txt' }[tipo] || 'bib-color-otro';
}
function _bibIcon(tipo) {
    return { pdf: 'fa-file-pdf', word: 'fa-file-word', excel: 'fa-file-excel', imagen: 'fa-file-image', txt: 'fa-file-alt' }[tipo] || 'fa-file';
}

function bibRender() {
    const el = document.getElementById('bib-contenedor');
    const statsEl = document.getElementById('bib-stats');
    if (!el) return;
    // Solo renderizar cuando la sección está activa (evita interferir con otros módulos)
    const seccion = document.getElementById('biblioteca');
    if (seccion && !seccion.classList.contains('active')) return;

    let docs = Biblioteca.listar();

    // Aplicar filtros
    const q = (document.getElementById('bib-search')?.value || '').toLowerCase();
    const filtroTipo = document.getElementById('bib-filtro-tipo')?.value || '';
    const filtroCausa = document.getElementById('bib-filtro-causa')?.value || '';
    const filtroEtapa = document.getElementById('bib-filtro-etapa')?.value || '';

    if (q) docs = docs.filter(d => d.nombre.toLowerCase().includes(q) || (d.descripcion || '').toLowerCase().includes(q) || (d.tags || []).join(' ').toLowerCase().includes(q));
    if (filtroTipo) docs = docs.filter(d => d.tipo === filtroTipo);
    if (filtroCausa) docs = docs.filter(d => d.causaId === parseInt(filtroCausa));
    if (filtroEtapa) docs = docs.filter(d => d.etapa === filtroEtapa);
    if (_bibTagActivo) docs = docs.filter(d => (d.tags || []).some(t => t.toLowerCase().includes(_bibTagActivo)));

    // Stats
    const stats = Biblioteca.stats();
    if (statsEl) statsEl.innerHTML = [
        ['total', 'Total', stats.total],
        ['pdf', 'PDF', stats.porTipo.pdf || 0],
        ['word', 'Word', stats.porTipo.word || 0],
        ['excel', 'Excel', stats.porTipo.excel || 0],
        ['imagen', 'Imágenes', stats.porTipo.imagen || 0],
    ].map(([, label, val]) => `<div class="bib-stat"><div class="bib-stat-num">${val}</div><div class="bib-stat-label">${label}</div></div>`).join('');

    // Actualizar filtro de causas
    const selCausa = document.getElementById('bib-filtro-causa');
    if (selCausa && selCausa.options.length <= 1) {
        DB.causas.forEach(c => { const o = new Option(c.caratula, c.id); selCausa.add(o); });
    }

    if (!docs.length) {
        el.innerHTML = '<div class="empty-state" style="padding:40px;"><i class="fas fa-book-open"></i><p>No hay documentos. Agrega el primero con el botón +</p></div>';
        return;
    }

    if (_bibView === 'grid') {
        el.innerHTML = `<div class="bib-grid">${docs.map(d => {
            const causa = d.causaId ? DB.causas.find(c => c.id === d.causaId) : null;
            const colorCls = _bibColorClass(d.tipo);
            const icon = _bibIcon(d.tipo);
            return `<div class="bib-doc-card" onclick="bibVerDoc(${d.id})">
                        <div class="bib-version-dot" style="background:var(--s);" title="Versión ${escHtml(d.version)}"></div>
                        <div class="bib-doc-icon ${colorCls}"><i class="fas ${icon}"></i></div>
                        <div class="bib-doc-nombre">${escHtml(d.nombre)}</div>
                        <div class="bib-doc-meta">${d.etapa} · ${d.fecha || '—'} · ${d.version}</div>
                        ${causa ? `<div class="bib-doc-meta" style="margin-top:3px; color:var(--a);">📁 ${escHtml(causa.caratula.substring(0, 30))}</div>` : ''}
                        <div class="bib-doc-tags">${(d.tags || []).slice(0, 3).map(t => `<span class="bib-doc-tag ${colorCls}">${escHtml(t)}</span>`).join('')}</div>
                    </div>`;
        }).join('')}</div>`;
    } else {
        el.innerHTML = docs.map(d => {
            const causa = d.causaId ? DB.causas.find(c => c.id === d.causaId) : null;
            const colorCls = _bibColorClass(d.tipo);
            return `<div class="bib-list-row" onclick="bibVerDoc(${d.id})">
                        <div class="bib-list-icon ${colorCls}"><i class="fas ${_bibIcon(d.tipo)}"></i></div>
                        <div class="bib-list-info">
                            <div class="bib-list-nombre">${escHtml(d.nombre)}</div>
                            <div class="bib-list-meta">${d.etapa} · ${d.fecha || '—'} · ${d.version}${causa ? ' · 📁 ' + escHtml(causa.caratula.substring(0, 25)) : ''}</div>
                        </div>
                        <div class="bib-doc-tags" style="flex-shrink:0;">${(d.tags || []).slice(0, 2).map(t => `<span class="bib-doc-tag ${colorCls}">${escHtml(t)}</span>`).join('')}</div>
                        <button class="btn btn-d btn-sm" onclick="event.stopPropagation(); bibEliminar(${d.id})"><i class="fas fa-trash"></i></button>
                    </div>`;
        }).join('');
    }
}

function bibVerDoc(id) {
    const d = Biblioteca.listar().find(d => d.id === id);
    if (!d) return;
    const causa = d.causaId ? DB.causas.find(c => c.id === d.causaId) : null;
    showInfo(`📄 <strong>${d.nombre}</strong><br>Tipo: ${d.tipo} · Versión: ${d.version}<br>Etapa: ${d.etapa} · Fecha: ${d.fecha || '—'}<br>${causa ? 'Causa: ' + causa.caratula + '<br>' : ''}Etiquetas: ${(d.tags || []).join(', ') || '—'}<br>${d.descripcion || 'Sin descripción.'}<br><small>Cargado: ${new Date(d.fechaCarga || 0).toLocaleString('es-CL')}</small>`);
}

function bibEliminar(id) {
    if (!confirm('¿Eliminar este documento de la biblioteca?')) return;
    Biblioteca.eliminar(id);
    bibRender();
}




// ─── Init ─────────────────────────────────────────────────────────
// init() — única def consolidada al final

// ─── Tab Navigation ───────────────────────────────────────────────
// ─── tab() y renderAll() — definiciones consolidadas al final del script ───
// (ver sección "FUNCIÓN tab() CONSOLIDADA" y "FUNCIÓN renderAll() CONSOLIDADA")

// ─── Render All ───────────────────────────────────────────────────
// ─── renderAll() consolidada al final del script ───
// renderAll() consolidada al final del script (ver 09-app-core.js)

// ████████████████████████████████████████████████████████████████████
