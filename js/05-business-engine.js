// ═══════════════════════════════════════════════════════

// ─── UTILIDADES ──────────────────────────────────────
// ── Generador de IDs únicos — crypto.randomUUID() ───────────────────
/**
 * Genera un identificador único de 9 caracteres alfanuméricos (base36 + timestamp).
 * Suficientemente único para el contexto de una app single-user local.
 * En Fase 2: los IDs serán asignados por el servidor en la respuesta POST.
 * @returns {string} ID único, e.g. "k7x2m9p4a".
 */
function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback para navegadores muy antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

window.beEnviarAlertaWhatsApp = async function(alertaId) {
    const alerta = (DB.alertas || []).find(a => String(a.id) === String(alertaId));
    if (!alerta) return;
    if (alerta.waAlertadoEn && !confirm('Esta alerta ya fue enviada por WhatsApp. ¿Desea reenviarla?')) return;
    if (!window.electronAPI?.whatsapp?.enviarAlertaA && !window.electronAPI?.whatsapp?.enviarAlerta) {
        if (typeof showError === 'function') showError('WhatsApp no está disponible en este entorno.');
        return;
    }
    const causa = (DB.causas || []).find(c => String(c.id) === String(alerta.causaId));
    const causaLabel = causa?.caratula || causa?.cliente || `Causa ${alerta.causaId}`;
    const fecha = alerta.fechaObjetivo ? new Date(alerta.fechaObjetivo).toLocaleDateString('es-CL') : 'fecha por definir';
    const msg = `🔔 Alerta legal\nCausa: ${causaLabel}\nTipo: ${alerta.tipo || 'evento'}\nDetalle: ${alerta.mensaje || 'Sin detalle'}\nFecha: ${fecha}`;

    try {
        const cli = (DB.clientes || []).find(c => {
            const n = String(c?.nombre || c?.nom || '').trim().toLowerCase();
            const cNom = String(causa?.cliente || '').trim().toLowerCase();
            return n && cNom && n === cNom;
        });
        const tel = String(cli?.telefono || cli?.tel || cli?.whatsapp || '').replace(/[^\d]/g, '');
        let r = null;
        if (tel && window.electronAPI?.whatsapp?.enviarAlertaA) {
            r = await window.electronAPI.whatsapp.enviarAlertaA(tel, msg);
        } else if (window.electronAPI?.whatsapp?.enviarAlerta) {
            r = await window.electronAPI.whatsapp.enviarAlerta(msg);
        } else if (typeof showError === 'function') {
            showError('No hay teléfono del cliente ni destinatarios globales para WhatsApp.');
            return;
        }
        if (r?.ok) {
            const nowIso = new Date().toISOString();
            alerta.waAlertadoEn = nowIso;
            if (causa && Array.isArray(causa.eventosProcesalesIA)) {
                causa.eventosProcesalesIA.forEach(ev => {
                    if (String(ev?.tipo || '').toLowerCase() !== 'audiencia') return;
                    const sameFecha = !ev.fecha || String(ev.fecha || '') === String(alerta.fechaObjetivo || '');
                    const sameTitulo = String(alerta.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
                    if (sameFecha || sameTitulo) ev.waAlertadoEn = nowIso;
                });
            }
            if (typeof markAppDirty === 'function') markAppDirty();
            guardarDB();
            if (typeof showSuccess === 'function') showSuccess('Alerta enviada por WhatsApp.');
            renderCalendario();
        } else if (typeof showError === 'function') {
            showError(r?.error || 'No se pudo enviar alerta por WhatsApp.');
        }
    } catch (e) {
        if (typeof showError === 'function') showError(e?.message || 'No se pudo enviar alerta por WhatsApp.');
    }
};

window.beCerrarAlerta = function(alertaId) {
    const alerta = (DB.alertas || []).find(a => String(a.id) === String(alertaId));
    if (!alerta) return;
    if (!confirm('¿Marcar esta alerta como gestionada/cerrada?')) return;
    alerta.estado = 'cerrada';
    alerta.gestionadaEn = new Date().toISOString();

    const causa = (DB.causas || []).find(c => String(c.id) === String(alerta.causaId));
    if (causa && Array.isArray(causa.eventosProcesalesIA) && String(alerta.tipo || '').toLowerCase() === 'audiencia') {
        causa.eventosProcesalesIA.forEach(ev => {
            if (String(ev?.tipo || '').toLowerCase() !== 'audiencia') return;
            const sameFecha = !ev.fecha || String(ev.fecha || '') === String(alerta.fechaObjetivo || '');
            const sameTitulo = String(alerta.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
            if (sameFecha || sameTitulo) {
                ev.gestionado = true;
                ev.gestionadoEn = new Date().toISOString();
            }
        });
    }

    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    try {
        if (typeof EventBus !== 'undefined' && EventBus?.emit) EventBus.emit('alertas:updated', { id: alerta.id, estado: 'cerrada' });
    } catch (_) {}
    if (typeof showInfo === 'function') showInfo('Alerta marcada como gestionada.');
    renderCalendario();
};

window.beEliminarAlerta = async function(alertaId) {
    try {
        const alertas = (DB.alertas || []);
        const idx = alertas.findIndex(a => String(a?.id) === String(alertaId));
        if (idx < 0) return;
        const alerta = alertas[idx];

        const origen = String(alerta?.origen || 'auto').toLowerCase();
        const esManual = origen === 'manual';
        const confirmar = confirm(esManual
            ? '¿Eliminar esta alerta manual?'
            : '¿Eliminar esta alerta automática?\nRequiere autorización y se recomienda solo si fue generada por error.');
        if (!confirmar) return;

        if (!esManual) {
            if (typeof window.uiAutorizarAccionCritica === 'function') {
                const ok = await window.uiAutorizarAccionCritica({
                    titulo: 'Eliminar alerta automática',
                    detalle: 'Esta alerta fue generada por el sistema (plazos/procesos). Para eliminarla, ingrese clave admin o clave temporal.'
                });
                if (!ok) return;
            } else {
                if (typeof showError === 'function') showError('No está disponible el sistema de autorización.');
                return;
            }
        }

        alertas.splice(idx, 1);
        DB.alertas = alertas;
        if (typeof markAppDirty === 'function') markAppDirty();
        guardarDB();
        try {
            if (typeof EventBus !== 'undefined' && EventBus?.emit) EventBus.emit('alertas:updated', { id: alertaId, deleted: true });
        } catch (_) {}
        if (typeof showSuccess === 'function') showSuccess('Alerta eliminada.');
        renderCalendario();
    } catch (e) {
        console.error('[CAL] Error eliminando alerta:', e);
        if (typeof showError === 'function') showError('No se pudo eliminar la alerta.');
    }
};

function _addMonthsKeepDay(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // Ajuste si el mes destino no tiene ese día (ej. 31)
    while (d.getDate() < day) d.setDate(d.getDate() - 1);
    return d;
}

function _sumPagosLegacy(pagos) {
    return (Array.isArray(pagos) ? pagos : []).reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0);
}

function _sumPlanPagosPagados(planPagos) {
    return (Array.isArray(planPagos) ? planPagos : []).reduce((s, c) => s + (c?.estado === 'PAGADA' ? (parseFloat(c?.monto) || 0) : 0), 0);
}

/**
 * Genera automáticamente un plan de pagos mensual.
 *
 * @param {string|number} causaId
 * @param {number} montoTotal
 * @param {number} numeroCuotas
 * @param {string|Date} fechaInicio - fecha base del primer vencimiento
 * @returns {Array<{numero:number,monto:number,fechaVencimiento:string,estado:'PENDIENTE'|'PAGADA',fechaPago:(string|null)}>} planPagos
 */
function generarPlanPagos(causaId, montoTotal, numeroCuotas, fechaInicio) {
    const total = parseFloat(montoTotal) || 0;
    const n = parseInt(numeroCuotas) || 0;
    if (!causaId) throw new Error('causaId requerido');
    if (!total || total <= 0) throw new Error('montoTotal inválido');
    if (!n || n <= 0) throw new Error('numeroCuotas inválido');

    const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
    if (Number.isNaN(inicio.getTime())) throw new Error('fechaInicio inválida');

    // Distribuir enteros CLP con residuo en la última cuota
    const totalInt = Math.round(total);
    const base = Math.floor(totalInt / n);
    const resto = totalInt - (base * n);

    return Array.from({ length: n }).map((_, idx) => {
        const numero = idx + 1;
        const monto = base + (numero === n ? resto : 0);
        const venc = _addMonthsKeepDay(inicio, idx);
        return {
            numero,
            monto,
            fechaVencimiento: venc.toISOString(),
            estado: 'PENDIENTE',
            fechaPago: null
        };
    });
}

function generarID() { return uid(); }
function hoy() { return new Date(); }
function diasEntre(fecha1, fecha2) {
    return Math.floor((fecha2 - fecha1) / (1000 * 60 * 60 * 24));
}

// ─── MODELO PROCESAL ─────────────────────────────────
function generarEtapas(tipo) {
    const modelos = {
        "Ordinario Civil": ["Demanda interpuesta", "Admisibilidad", "Notificación válida", "Contestación", "Réplica", "Dúplica", "Conciliación obligatoria", "Recepción a prueba", "Término probatorio", "Observaciones", "Citación para sentencia", "Sentencia", "Recurso"],
        "Ejecutivo": ["Demanda ejecutiva", "Mandamiento", "Requerimiento de pago", "Oposición", "Prueba", "Sentencia", "Ejecución / Remate"],
        "Sumario": ["Demanda", "Citación audiencia", "Contestación", "Prueba", "Sentencia"],
        "Familia": ["Demanda", "Admisibilidad", "Audiencia preparatoria", "Audiencia juicio", "Sentencia", "Recurso"]
    };
    return (modelos[tipo] || []).map(nombre => ({ nombre, completada: false, fecha: null, observacion: "", documentoAsociado: null }));
}

function obtenerEtapaActual(causa) {
    return causa.etapasProcesales?.find(e => !e.completada)?.nombre || "Concluida";
}

function recalcularAvance(causa) {
    const total = causa.etapasProcesales?.length || 0;
    const completadas = causa.etapasProcesales?.filter(e => e.completada).length || 0;
    causa.porcentajeAvance = total === 0 ? 0 : Math.round((completadas / total) * 100);
    if (causa.porcentajeAvance === 100) causa.estadoGeneral = "Finalizada";
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

// ─── CREAR CAUSA (sistema extendido) ─────────────────
/**
 * Crea una nueva causa con los datos del formulario, la agrega a Store y persiste.
 * Genera etapas procesales automáticas según tipoProcedimiento, calcula avance inicial
 * y registra el evento en la bitácora.
 *
 * @param {object} data
 * @param {string} data.caratula         - Nombre de las partes (requerido).
 * @param {string} [data.tipoProcedimiento='Ordinario Civil']
 * @param {string} [data.rama='Civil']
 * @param {string} [data.juzgado]
 * @param {string} [data.clienteId]      - ID del cliente vinculado.
 * @param {string} [data.rol]             - ROL/RIT del tribunal.
 * @returns {object} Objeto causa creado y agregado a DB.causas.
 */
function crearCausa(data) {
    const tipoExpediente = String(data.tipoExpediente || '').toLowerCase() === 'tramite'
        ? 'tramite'
        : 'judicial';
    const nueva = {
        id: generarID(),
        clienteId: data.clienteId,
        caratula: data.caratula,
        tipoProcedimiento: data.tipoProcedimiento || "Ordinario Civil",
        tipoExpediente,
        rama: data.rama || "",
        estadoGeneral: "En tramitación",
        instancia: "Primera",
        prioridadManual: false,
        porcentajeAvance: 0,
        fechaCreacion: hoy(),
        fechaUltimaActividad: hoy(),
        etapasProcesales: generarEtapas(data.tipoProcedimiento || "Ordinario Civil"),
        documentos: [],
        recursos: [],
        partes: { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} },
        estrategia: {},
        riesgo: {},
        honorarios: {},
        jurisprudenciaAsociada: [],
        revisadoHoy: false,
        docsCliente: [],
        docsTribunal: [],
        docsContraparte: [],
        docsTramites: [],
        tramiteMeta: { organismo: '', tipoTramite: '', lugarGestion: '', numeroIngreso: '' },
        hitosTramite: {
            fechaIngresoSistema: new Date().toISOString().slice(0, 10),
            fechaCargaDocumentos: null,
            fechaIngresoOrganismo: null,
            fechaRespuestaOrganismo: null,
            fechaFinalizacion: null
        },
        reparos: [],
        iaSugerencias: null,
        eventosProcesalesIA: [],
        audiencias: { habilitado: false }
    };
    if (typeof Store !== 'undefined' && Store?.agregarCausa) {
        Store.agregarCausa(nueva);
    } else {
        DB.causas.push(nueva);
    }
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
    renderDashboard();
    return nueva;
}

/**
 * Marca o desmarca una etapa procesal de una causa y recalcula el % de avance.
 * Registra el cambio en la bitácora y persiste.
 *
 * @param {string} causaId - ID de la causa.
 * @param {number} index   - Índice de la etapa en causa.etapasProcesales.
 */
function marcarEtapa(causaId, index) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    const etapa = causa.etapasProcesales[index];
    if (!etapa.documentoAsociado) { showError("Debe asociar un documento a esta etapa."); return; }
    etapa.completada = true;
    etapa.fecha = hoy();
    causa.fechaUltimaActividad = hoy();
    recalcularAvance(causa);
    renderDashboard();
}

// ─── DASHBOARD (compatible con HTML existente) ────────
function renderDashboard() {
    renderPanelEjecutivo();
    renderDashboardPanel();
    const contenedor = document.getElementById("dashboardCausas");
    if (!contenedor) return;
    contenedor.innerHTML = DB.causas.map(causa => `
        <div class="card" style="margin-bottom:12px;">
            <strong>${escHtml(causa.caratula)}</strong>
            <p style="font-size:0.82rem; color:var(--t2);">${escHtml(causa.tipoProcedimiento)} · ${escHtml(obtenerEtapaActual(causa))}</p>
            <p style="font-size:0.82rem;">Avance: <strong>${causa.porcentajeAvance}%</strong> · ${escHtml(causa.estadoGeneral)}</p>
        </div>`).join('') || '<div class="empty-state"><i class="fas fa-gavel"></i><p>Sin causas en el sistema extendido.</p></div>';
}

// ─── RESET DIARIO ────────────────────────────────────
function resetDiario() {
    const hoyStr = new Date().toDateString();
    if (DB.configuracion.ultimoResetDiario !== hoyStr) {
        DB.causas.forEach(c => { c.revisadoHoy = false; });
        DB.configuracion.ultimoResetDiario = hoyStr;
        if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
    }
}

// ████████████████████████████████████████████████████████████████████
// JS — BLOQUE 4: ALERTAS, CALENDARIO, COMERCIAL, ESTRATEGIA
// • Alertas, calendario, prospectos, honorarios, jurisprudencia avanzada,
//   panel ejecutivo, gestor documental, motor estratégico, seguridad
// ████████████████████████████████████████████████████████████████████

// ─── BLOQUE 2: ALERTAS + CALENDARIO ─────────────────
/**
 * Crea una alerta de vencimiento de plazo y la persiste en DB.alertas.
 *
 * @param {object} data
 * @param {string} data.causaId   - ID de la causa vinculada.
 * @param {string} data.tipo      - Tipo de alerta (e.g. 'plazo', 'audiencia').
 * @param {string} data.mensaje   - Texto descriptivo.
 * @param {string} data.fechaVenc - Fecha de vencimiento (ISO string).
 * @returns {object} Objeto alerta creado.
 */
function crearAlerta(data) {
    // Evitar duplicados exactos el mismo día
    const hoyStr = new Date().toDateString();
    const existe = DB.alertas.find(a =>
        a.causaId === data.causaId && a.tipo === data.tipo &&
        a.mensaje === data.mensaje && new Date(a.fechaObjetivo).toDateString() === hoyStr
    );
    if (existe) return;
    const alertaNueva = {
        id: generarID(),
        causaId: data.causaId,
        tipo: data.tipo,
        mensaje: data.mensaje,
        fechaObjetivo: data.fechaObjetivo || hoy(),
        prioridad: data.prioridad || "media",
        estado: "activa",
        origen: data.origen || 'auto'
    };
    if (typeof Store !== 'undefined' && Store?.agregarAlerta) Store.agregarAlerta(alertaNueva);
    else DB.alertas.push(alertaNueva);
    if (typeof markAppDirty === "function") markAppDirty();
    guardarDB();
    try {
        if (typeof EventBus !== 'undefined' && EventBus?.emit) EventBus.emit('alertas:updated', { id: alertaNueva.id });
    } catch (_) {}
}

function _evaluarAlertasHonorarios() {
    try {
        (DB.causas || []).forEach(causa => {
            const h = causa?.honorarios || {};
            const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
            if (!plan.length) return;
            const pend = plan
                .filter(x => (x?.estado || 'PENDIENTE') !== 'PAGADA')
                .sort((a, b) => new Date(a?.fechaVencimiento || 0) - new Date(b?.fechaVencimiento || 0))[0];
            if (!pend?.fechaVencimiento) return;
            const dias = diasEntre(hoy(), new Date(pend.fechaVencimiento));
            if (dias < 0) return;

            if (dias <= 3) {
                crearAlerta({
                    causaId: causa.id,
                    tipo: 'honorario',
                    mensaje: `Vence cuota #${pend.numero || '?'} por $${Math.round(parseFloat(pend.monto) || 0).toLocaleString('es-CL')}`,
                    fechaObjetivo: pend.fechaVencimiento,
                    prioridad: dias === 0 ? 'critica' : 'alta',
                    origen: 'auto'
                });
            }
        });
    } catch (e) {
        console.warn('[ALERTAS] Honorarios: no se pudo evaluar.', e);
    }
}

function _evaluarAlertasNegocios() {
    try {
        const propuestas = (DB.propuestas || []).filter(Boolean);
        propuestas.forEach(pr => {
            const vig = pr.fechaVigencia || pr.fechaVencimiento || pr.fechaVenc || null;
            if (!vig) return;
            const dias = diasEntre(hoy(), new Date(vig));
            if (dias < 0) return;
            if (dias <= 3) {
                const label = pr.nombre || pr.titulo || (pr.prospectoId ? `Prospecto ${pr.prospectoId}` : 'Propuesta');
                crearAlerta({
                    causaId: null,
                    tipo: 'vencimiento',
                    mensaje: `Vence propuesta económica: ${label}`,
                    fechaObjetivo: vig,
                    prioridad: dias === 0 ? 'critica' : 'alta',
                    origen: 'auto'
                });
            }
        });
    } catch (e) {
        console.warn('[ALERTAS] Negocios: no se pudo evaluar.', e);
    }
}

function _getTramitesLista() {
    try {
        if (typeof window.TramitesDB !== 'undefined' && window.TramitesDB?.todos) {
            return window.TramitesDB.todos() || [];
        }
    } catch (_) {}
    try {
        if (typeof AppConfig !== 'undefined' && AppConfig.get) {
            return AppConfig.get('tramites') || [];
        }
    } catch (_) {}
    return [];
}

function _evaluarAlertasTramites() {
    try {
        const tramites = _getTramitesLista().filter(Boolean);
        tramites.forEach(t => {
            const f = t.fechaObjetivo || t.fechaVencimiento || t.fechaLimite || t.fechaPlazo || null;
            if (!f) return;
            const dias = diasEntre(hoy(), new Date(f));
            if (dias < 0) return;
            if (dias <= 3) {
                const org = t.organismo || t.org || 'Trámite';
                const tipo = t.tipo || t.nombre || 'Gestión';
                const titulo = `${org}: ${tipo}`;
                crearAlerta({
                    causaId: null,
                    tipo: 'plazo',
                    mensaje: `Vence trámite: ${titulo}`,
                    fechaObjetivo: f,
                    prioridad: dias === 0 ? 'critica' : 'alta',
                    origen: 'auto'
                });
            }
        });
    } catch (e) {
        console.warn('[ALERTAS] Trámites: no se pudo evaluar.', e);
    }
}

function evaluarAlertas() {
    DB.causas.forEach(causa => {
        const dias = diasEntre(new Date(causa.fechaUltimaActividad), hoy());
        if (dias > 7) crearAlerta({ causaId: causa.id, tipo: "inactividad", mensaje: "Causa sin movimiento reciente.", prioridad: causa.rama === "Familia" ? "alta" : "media" });
        const sentencia = causa.etapasProcesales?.find(e => e.nombre === "Sentencia");
        if (sentencia?.completada && causa.recursos.length === 0) crearAlerta({ causaId: causa.id, tipo: "procesal", mensaje: "Evaluar procedencia de recurso.", prioridad: "alta" });
        causa.documentos?.forEach(doc => {
            if (doc.generaPlazo && doc.fechaVencimiento) {
                const diasRestantes = diasEntre(hoy(), new Date(doc.fechaVencimiento));
                if (diasRestantes <= 2) crearAlerta({ causaId: causa.id, tipo: "plazo", mensaje: "Plazo próximo a vencer.", prioridad: "critica", fechaObjetivo: doc.fechaVencimiento });
            }
        });
    });
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function generarEventosCalendario() {
    return DB.alertas
        .filter(a => a.estado === "activa")
        .map(alerta => {
            const hasCausa = alerta.causaId !== null && alerta.causaId !== undefined && String(alerta.causaId).trim() !== '';
            const causa = hasCausa ? DB.causas.find(c => String(c.id) === String(alerta.causaId)) : null;
            return {
                id: alerta.id,
                causaId: alerta.causaId,
                titulo: alerta.mensaje,
                fecha: alerta.fechaObjetivo,
                prioridad: alerta.prioridad,
                tipo: (alerta.tipo || 'evento').toLowerCase(),
                causaLabel: causa?.caratula || causa?.cliente || (hasCausa ? `Causa ${alerta.causaId}` : 'Alerta manual'),
                waAlertadoEn: alerta.waAlertadoEn || null
            };
        });
}

let _calMesActual = new Date();

function _calTipoColor(tipo) {
    const t = String(tipo || 'evento').toLowerCase();
    const map = {
        audiencia: '#2563eb',
        plazo: '#dc2626',
        vencimiento: '#dc2626',
        contestacion: '#16a34a',
        contestación: '#16a34a',
        procesal: '#7c3aed',
        honorario: '#7c3aed',
        honorarios: '#7c3aed',
        pago: '#7c3aed',
        inactividad: '#b45309',
        evento: '#64748b'
    };
    return map[t] || map.evento;
}

function _calFormatoMesLabel(dt) {
    try {
        return dt.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    } catch (_) {
        return `${dt.getMonth() + 1}/${dt.getFullYear()}`;
    }
}

function _calRenderMes(eventos) {
    const cont = document.getElementById('calendarioMes');
    if (!cont) return;
    const lbl = document.getElementById('cal-mes-label');
    if (lbl) lbl.textContent = _calFormatoMesLabel(_calMesActual);

    const y = _calMesActual.getFullYear();
    const m = _calMesActual.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = last.getDate();

    const byDate = {};
    (eventos || []).forEach(ev => {
        if (!ev?.fecha) return;
        const d = new Date(ev.fecha);
        if (Number.isNaN(d.getTime())) return;
        if (d.getFullYear() !== y || d.getMonth() !== m) return;
        const key = d.toISOString().slice(0, 10);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(ev);
    });

    const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
        const key = new Date(y, m, day).toISOString().slice(0, 10);
        cells.push({ day, key, events: byDate[key] || [] });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const legend = [
        { t: 'Vencimientos / plazos', c: _calTipoColor('plazo') },
        { t: 'Contestaciones', c: _calTipoColor('contestacion') },
        { t: 'Honorarios / pagos', c: _calTipoColor('honorario') },
        { t: 'Audiencias', c: _calTipoColor('audiencia') },
    ];

    cont.innerHTML = `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin:8px 0 10px; font-size:.72rem; color:var(--text-3);">
            ${legend.map(x => `
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="width:10px; height:10px; border-radius:50%; background:${x.c}; display:inline-block;"></span>
                    <span>${x.t}</span>
                </div>
            `).join('')}
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">
            ${weekdays.map(w => `<div style="text-align:center; font-size:.7rem; font-weight:800; color:var(--text-3); padding:4px 0;">${w}</div>`).join('')}
            ${cells.map(cell => {
                if (!cell) return `<div style="height:52px; border:1px solid var(--border); border-radius:10px; background:var(--bg);"></div>`;
                const dots = cell.events.slice(0, 4).map(ev => {
                    const c = _calTipoColor(ev.tipo);
                    return `<span title="${escHtml(ev.titulo || '')}" style="width:8px; height:8px; border-radius:50%; background:${c}; display:inline-block;"></span>`;
                }).join('');
                const has = cell.events.length > 0;
                const bg = has ? '#f8fafc' : 'var(--bg)';
                const border = has ? '#cbd5e1' : 'var(--border)';
                return `
                    <div style="min-height:52px; border:1px solid ${border}; border-radius:10px; background:${bg}; padding:6px 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="font-weight:900; font-size:.78rem; color:var(--text-2);">${cell.day}</div>
                            <div style="font-size:.68rem; color:var(--text-3);">${cell.events.length ? (cell.events.length + '·') : ''}</div>
                        </div>
                        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:6px;">${dots}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function calendarioMesPrev() {
    _calMesActual = new Date(_calMesActual.getFullYear(), _calMesActual.getMonth() - 1, 1);
    renderCalendario();
}

function calendarioMesNext() {
    _calMesActual = new Date(_calMesActual.getFullYear(), _calMesActual.getMonth() + 1, 1);
    renderCalendario();
}

function renderCalendario() {
    const contenedor = document.getElementById("calendarioEventos");
    if (!contenedor) return;
    const eventos = generarEventosCalendario().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const audienciasIA = (DB.causas || []).filter(c => c?.audiencias?.habilitado);
    _calRenderMes(eventos);
    const audienciasHtml = audienciasIA.length ? `
        <div style="margin-bottom:10px; padding:10px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
            <div style="font-size:.72rem; font-weight:800; color:#1e40af; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px;">
                <i class="fas fa-gavel"></i> Módulo Audiencias (IA)
            </div>
            ${audienciasIA.slice(0, 4).map(c => {
                const auds = (c.eventosProcesalesIA || [])
                    .filter(ev => String(ev?.tipo || '').toLowerCase() === 'audiencia')
                    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
                const prox = auds.find(a => a.fecha) || auds[0] || null;
                const fechaProx = prox?.fecha ? new Date(prox.fecha).toLocaleDateString('es-CL') : 'Sin fecha definida';
                const tituloProx = prox?.titulo || 'Audiencia detectada por IA';
                const causaLabel = escHtml(c.caratula || c.cliente || `Causa ${c.id}`);
                const causaId = String(c.id).replace(/'/g, "\\'");
                return `
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start; margin:6px 0; padding:7px 8px; border:1px solid #dbeafe; border-radius:7px; background:#fff;">
                    <div style="min-width:0;">
                        <div style="font-size:.76rem; color:#1e3a8a; font-weight:700;">${causaLabel}</div>
                        <div style="font-size:.72rem; color:#334155; margin-top:2px;">${escHtml(tituloProx)}</div>
                        <div style="font-size:.68rem; color:#64748b; margin-top:1px;">${fechaProx} · ${auds.length} audiencia(s) IA</div>
                    </div>
                    <button class="btn btn-xs" style="background:#dbeafe; color:#1e40af; border:none;" data-action="cal-ver-causa" data-causa-id="${escHtml(causaId)}">
                        Ver causa
                    </button>
                </div>`;
            }).join('')}
            ${audienciasIA.length > 4 ? `<div style="font-size:.7rem; color:#1d4ed8; margin-top:4px;">+${audienciasIA.length - 4} causa(s) adicional(es)</div>` : ''}
        </div>` : '';

    const eventosHtml = eventos.length ? eventos.map(ev => {
        const hasCausa = ev.causaId !== null && ev.causaId !== undefined && String(ev.causaId).trim() !== '';
        return `
        <div class="alert-item ${ev.prioridad === 'critica' || ev.prioridad === 'alta' ? '' : 'info'}" style="border-left:3px solid ${_calTipoColor(ev.tipo)};">
            <i class="fas fa-calendar-day" style="color:${_calTipoColor(ev.tipo)};"></i>
            <div>
                <strong>${new Date(ev.fecha).toLocaleDateString('es-CL')}</strong> — ${escHtml(ev.titulo)}
                <div style="font-size:.72rem; color:#64748b; margin-top:2px;">${escHtml(ev.causaLabel)}</div>
                ${ev.waAlertadoEn ? `<div style="font-size:.68rem; color:#0f766e; margin-top:2px;"><i class="fab fa-whatsapp"></i> Enviado: ${new Date(ev.waAlertadoEn).toLocaleString('es-CL')}</div>` : ''}
                <div style="margin-top:5px;">
                    ${hasCausa ? `
                    <button class="btn btn-xs" style="background:#eef2ff; color:#4338ca; border:none; margin-right:4px;" data-action="cal-ver-causa" data-causa-id="${escHtml(ev.causaId)}">
                        <i class="fas fa-folder-open"></i> Ver causa
                    </button>
                    ` : ''}
                    <button class="btn btn-xs" style="background:#ecfeff; color:#0f766e; border:none;" data-action="cal-wa-alerta" data-alerta-id="${escHtml(ev.id)}">
                        <i class="fab fa-whatsapp"></i> ${ev.waAlertadoEn ? 'Reenviar' : 'Avisar'}
                    </button>
                    <button class="btn btn-xs" style="background:#f0fdf4; color:#166534; border:none; margin-left:4px;" data-action="cal-cerrar-alerta" data-alerta-id="${escHtml(ev.id)}">
                        <i class="fas fa-check"></i> Gestionada
                    </button>
                    <button class="btn btn-xs" style="background:#fee2e2; color:#b91c1c; border:none; margin-left:4px;" data-action="cal-eliminar-alerta" data-alerta-id="${escHtml(ev.id)}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        </div>`;
    }).join('') : '<div class="alert-empty">Sin eventos próximos.</div>';

    contenedor.innerHTML = audienciasHtml + eventosHtml;
}

function exportCalendarioICS() {
    try {
        const eventos = generarEventosCalendario();
        const pad = (n) => String(n).padStart(2, '0');
        const toIcsDate = (isoDate) => {
            const d = new Date(isoDate);
            if (Number.isNaN(d.getTime())) return null;
            return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        };

        const escapeIcs = (s) => String(s || '')
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');

        const lines = [];
        lines.push('BEGIN:VCALENDAR');
        lines.push('VERSION:2.0');
        lines.push('PRODID:-//LEXIUMPRO//Agenda//ES');
        lines.push('CALSCALE:GREGORIAN');

        eventos.forEach(ev => {
            const d = toIcsDate(ev.fecha);
            if (!d) return;
            const uidVal = `${ev.id || (Date.now() + Math.random())}@lexiumpro`;
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uidVal}`);
            lines.push(`DTSTART;VALUE=DATE:${d}`);
            lines.push(`SUMMARY:${escapeIcs(ev.titulo || 'Evento')}`);
            const desc = `${ev.causaLabel ? ('Causa: ' + ev.causaLabel + '\\n') : ''}${ev.tipo ? ('Tipo: ' + ev.tipo) : ''}`.trim();
            if (desc) lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');

        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lexium-agenda.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (typeof showSuccess === 'function') showSuccess('Calendario exportado (.ics).');
    } catch (e) {
        console.error('[CAL] Error exportando ICS:', e);
        if (typeof showError === 'function') showError('No se pudo exportar el calendario.');
    }
}

window.exportCalendarioICS = exportCalendarioICS;
window.calendarioMesPrev = calendarioMesPrev;
window.calendarioMesNext = calendarioMesNext;

function actualizarSistema() {
    evaluarAlertas();
    _evaluarAlertasHonorarios();
    _evaluarAlertasNegocios();
    _evaluarAlertasTramites();
    renderCalendario();
    renderDashboard();
    renderDashboardPanel();  // actualizar KPIs sin loop
}

// ─── BLOQUE 3: MÓDULO COMERCIAL + HONORARIOS ─────────
function crearProspecto(data) {
    const nuevo = {
        id: generarID(),
        nombre: data.nombre,
        materia: data.materia,
        descripcion: data.descripcion,
        complejidad: data.complejidad,
        probabilidadCierre: data.probabilidadCierre || 50,
        estado: 'Nuevo',
        honorarioPropuesto: data.honorarioPropuesto || 0,
        fechaCreacion: hoy(),
        // ── Nuevos campos v2 ──────────────────────────────────
        tipoHonorario: data.tipoHonorario || 'fijo',   // 'fijo' | 'variable'
        porcentajeLitigio: data.porcentajeLitigio || 0,    // % sobre cuantía
        cuantiaLitigio: data.cuantiaLitigio || 0,       // monto del litigio
        estrategiaJuridica: data.estrategiaJuridica || '',  // texto libre
        propuesta: {
            generada: false,
            fechaGeneracion: null,
            fechaVencimiento: null,   // +15 días desde generación
            aceptada: false,
            rechazada: false,
        },
        tipoExpediente: null,   // 'judicial' | 'tramite' — se fija al aceptar
    };
    if (typeof Store !== 'undefined' && Store?.prospectos) Store.prospectos.push(nuevo);
    else DB.prospectos.push(nuevo);
    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    if (typeof renderProspectos === 'function') renderProspectos();
}

function renderProspectos() {
    const contenedor = document.getElementById("listaProspectos");
    if (!contenedor) return;
    contenedor.innerHTML = DB.prospectos.map(p => `
                <div class="card-premium" style="margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="display:flex; gap:12px; align-items:center;">
                            <div class="icon-box-premium" style="background:var(--warning-bg); color:var(--warning);">
                                <i class="fas fa-funnel-dollar"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem;">${escHtml(p.nombre)}</h4>
                                <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">MATERIA: ${escHtml(p.materia).toUpperCase()}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:14px; font-weight:800; color:var(--success);">$${(p.honorarioPropuesto || 0).toLocaleString('es-CL')}</div>
                            <div style="font-size:10px; color:var(--text-3);">Propuesto</div>
                        </div>
                    </div>
                    
                    <div style="font-size:12.5px; color:var(--text-2); line-height:1.4; margin-bottom:14px; padding:10px; background:var(--bg); border-radius:var(--r-md); border:1px solid var(--border);">
                        ${escHtml(p.descripcion || 'Sin detalles registrados')}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:12px;">
                            <div>
                                <span style="font-size:10px; color:var(--text-3); display:block; text-transform:uppercase;">Probabilidad</span>
                                <span style="font-size:12px; font-weight:700; color:var(--cyan);">${p.probabilidadCierre}%</span>
                            </div>
                            <div>
                                <span style="font-size:10px; color:var(--text-3); display:block; text-transform:uppercase;">Estado</span>
                                <span style="font-size:12px; font-weight:700; color:var(--warning);">${escHtml(p.estado)}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            ${p.estado !== 'Aceptado' ? `<button class="btn btn-p btn-sm" onclick="convertirACliente(${p.id})"><i class="fas fa-check-circle"></i> Aceptar</button>` : ''}
                            <button class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </div>`).join('') || '<div class="empty-state"><i class="fas fa-funnel-dollar"></i><p>Sin prospectos.</p></div>';
}

function _beContratoServiciosHTML(prospecto, tipoExpediente, honorarios) {
    const tipoLabel = tipoExpediente === 'tramite' ? 'Trámite Administrativo' : 'Causa Judicial';
    const hoyStr = new Date().toLocaleDateString('es-CL');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato - ${prospecto.nombre}</title></head>
<body style="font-family:Arial,sans-serif;padding:28px;color:#0f172a;line-height:1.5;">
<h1 style="margin:0 0 8px;">Contrato de Prestación de Servicios</h1>
<div style="font-size:12px;color:#64748b;">${hoyStr} · ${tipoLabel}</div>
<h3>Cliente</h3><p><strong>${prospecto.nombre}</strong><br>RUT: ${prospecto.rut || '—'}</p>
<h3>Objeto</h3><p>${prospecto.descripcion || 'Gestión legal encomendada por el cliente.'}</p>
<h3>Honorarios</h3><p>$${Number(honorarios || 0).toLocaleString('es-CL')} CLP.</p>
<h3>Mandato</h3><p>El cliente confiere patrocinio y poder suficiente para actuaciones propias del encargo profesional.</p>
</body></html>`;
}

function convertirACliente(prospectoId, tipoExpediente) {
    const prospecto = DB.prospectos.find(p => p.id === prospectoId);
    if (!prospecto) return;

    const tipoFinal = (tipoExpediente === 'tramite' || tipoExpediente === 'judicial')
        ? tipoExpediente
        : (confirm('¿Desea crear este expediente como Trámite Administrativo?\nSelecciona "Cancelar" para crear Causa Judicial.') ? 'tramite' : 'judicial');

    // Marcar propuesta como aceptada
    prospecto.estado = 'Aceptado';
    prospecto.tipoExpediente = tipoFinal;
    if (prospecto.propuesta) prospecto.propuesta.aceptada = true;

    // Crear cliente
    const nuevoCliente = {
        id: generarID(),
        nombre: prospecto.nombre,
        rut: prospecto.rut || '',
        fechaCreacion: hoy(),
        prospectoId: prospecto.id,
    };
    const clienteCreado = (typeof Store !== 'undefined' && Store?.agregarCliente)
        ? Store.agregarCliente(nuevoCliente)
        : (DB.clientes.push(nuevoCliente), nuevoCliente);

    // Crear causa con datos completos del prospecto
    const hon = prospecto.tipoHonorario === 'variable'
        ? Math.round((prospecto.cuantiaLitigio || 0) * (prospecto.porcentajeLitigio || 0) / 100)
        : (prospecto.honorarioPropuesto || 0);

    const payload = {
        clienteId: clienteCreado.id,
        caratula: prospecto.nombre,
        tipoProcedimiento: tipoFinal === 'tramite' ? 'Trámite Administrativo' : 'Ordinario Civil',
        rama: prospecto.materia,
        tipoExpediente: tipoFinal,
        honorarios: {
            montoBase: hon,
            tipoHonorario: prospecto.tipoHonorario || 'fijo',
            pagos: [],
            saldoPendiente: hon,
            cuotas: [],   // array de { monto, fechaVencimiento, pagada, alertaEnviada }
        },
        documentosCliente: [],    // nueva colección separada
        documentosTribunal: [],    // nueva colección separada
    };
    const causaNueva = crearCausa(payload);
    if (causaNueva) {
        if (!Array.isArray(causaNueva.docsCliente)) causaNueva.docsCliente = [];
        const htmlContrato = _beContratoServiciosHTML(prospecto, tipoFinal, hon);
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContrato)}`;
        const nombreContrato = `Contrato_${String(prospecto.nombre || 'cliente').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.html`;
        causaNueva.docsCliente.push({
            nombre: nombreContrato,
            mimetype: 'text/html',
            size: dataUrl.length,
            fecha: new Date().toISOString(),
            data: dataUrl,
            tipoIA: 'Contrato',
            etapaIA: 'Contratación',
            resumenIA: `Contrato generado al convertir prospecto (${tipoFinal === 'tramite' ? 'administrativo' : 'judicial'}).`
        });
        causaNueva.contratoServicios = {
            generadoEn: new Date().toISOString(),
            tipoExpediente: tipoFinal,
            nombreDocumento: nombreContrato
        };
        prospecto.contratoServicios = {
            generadoEn: new Date().toISOString(),
            tipoExpediente: tipoFinal,
            causaId: causaNueva.id,
            nombreDocumento: nombreContrato
        };
    }

    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    if (typeof renderProspectos === 'function') renderProspectos();
    if (typeof showSuccess === 'function')
        showSuccess(`✅ Expediente creado: ${prospecto.nombre} → ${tipoFinal === 'tramite' ? 'Trámite' : 'Gestión Judicial'}`);
}

function asignarHonorarios(causaId, montoBase) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;


    const montoTotal = parseFloat(montoBase) || 0;
    if (!montoTotal || montoTotal <= 0) return;

    // Compatibilidad: asignarHonorarios se interpreta como modalidad CONTADO
    // (en UI nueva se gestionará CUOTAS con generarPlanPagos).
    if (!causa.honorarios) causa.honorarios = {};

    const pagosLegacy = Array.isArray(causa.honorarios.pagos) ? causa.honorarios.pagos : [];
    const totalPagadoLegacy = _sumPagosLegacy(pagosLegacy);

    causa.honorarios.modalidad = 'CONTADO';
    causa.honorarios.montoTotal = montoTotal;
    causa.honorarios.planPagos = [
        {
            numero: 1,
            monto: montoTotal,
            fechaVencimiento: new Date().toISOString(),
            estado: (totalPagadoLegacy >= montoTotal) ? 'PAGADA' : 'PENDIENTE',
            fechaPago: (totalPagadoLegacy >= montoTotal) ? new Date().toISOString() : null
        }
    ];

    // Legacy / compat: mantener pagos y campos usados por vistas existentes
    causa.honorarios.pagos = pagosLegacy;
    causa.honorarios.montoBase = montoTotal;
    causa.honorarios.saldoPendiente = Math.max(0, montoTotal - totalPagadoLegacy);

    if (typeof markAppDirty === "function") markAppDirty();
    guardarDB();

    try {
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('honorarios:assigned', {
                causaId,
                montoTotal: montoTotal,
                modalidad: 'CONTADO'
            });
            window.EventBus.emit('honorarios:updated', { causaId });
        }
    } catch (_) {}

    try {
        if (!Array.isArray(DB.alertas)) DB.alertas = [];
        const plan = Array.isArray(causa?.honorarios?.planPagos) ? causa.honorarios.planPagos : [];
        const cuotaPend = plan.find(c => String(c?.estado || '').toUpperCase() === 'PENDIENTE') || plan[0] || null;
        const fechaVenc = cuotaPend?.fechaVencimiento ? new Date(cuotaPend.fechaVencimiento) : null;
        if (fechaVenc && !Number.isNaN(fechaVenc.getTime())) {
            const fechaObj = fechaVenc.toISOString().slice(0, 10);
            const msg = `Cobro pendiente: Honorarios — $${Math.round(montoTotal).toLocaleString('es-CL')}`;
            const existing = DB.alertas.find(a => a && a._cobro && String(a.causaId) === String(causaId));
            if (existing) {
                existing.tipo = 'pago';
                existing.prioridad = 'alta';
                existing.estado = 'activa';
                existing.mensaje = msg;
                existing.fechaObjetivo = fechaObj;
                existing.fechaVencimiento = fechaVenc.toISOString();
            } else {
                DB.alertas.push({
                    id: generarID(),
                    causaId,
                    tipo: 'pago',
                    prioridad: 'alta',
                    estado: 'activa',
                    mensaje: msg,
                    fechaObjetivo: fechaObj,
                    fechaVencimiento: fechaVenc.toISOString(),
                    _cobro: true,
                    alertaEnviadaWA: false,
                    fechaCreacion: new Date().toISOString()
                });
            }
            if (typeof markAppDirty === 'function') markAppDirty();
            guardarDB();
        }
    } catch (_) {}
}

function registrarPago(causaId, monto) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa?.honorarios) return;

    // Mantener pagos legacy
    if (!Array.isArray(causa.honorarios.pagos)) causa.honorarios.pagos = [];
    causa.honorarios.pagos.push({ monto, fecha: hoy() });
    const idxPago = causa.honorarios.pagos.length - 1;

    // Si existe planPagos, intentar marcar la primera cuota pendiente como pagada.
    if (Array.isArray(causa.honorarios.planPagos) && causa.honorarios.planPagos.length) {
        const cuotaPend = causa.honorarios.planPagos.find(c => c.estado === 'PENDIENTE');
        if (cuotaPend) {
            cuotaPend.estado = 'PAGADA';
            cuotaPend.fechaPago = new Date().toISOString();
        }
    }

    const montoTotal = parseFloat(causa.honorarios.montoTotal || causa.honorarios.montoBase) || 0;
    const totalPagado = _sumPagosLegacy(causa.honorarios.pagos);
    causa.honorarios.saldoPendiente = Math.max(0, montoTotal - totalPagado);

    if (typeof markAppDirty === "function") markAppDirty();
    guardarDB();

    try {
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('honorarios:pago-added', {
                causaId,
                monto,
                pagoIndex: idxPago,
                saldoPendiente: causa.honorarios.saldoPendiente
            });
            window.EventBus.emit('honorarios:updated', { causaId });
        }
    } catch (_) {}
}

function calcularIndicadoresEconomicos() {
    let totalFacturado = 0, totalPendiente = 0;
    DB.causas.forEach(c => {
        if (c.honorarios?.montoBase) { totalFacturado += c.honorarios.montoBase; totalPendiente += c.honorarios.saldoPendiente; }
    });
    return { totalFacturado, totalPendiente };
}

function renderResumenEconomico() {
    const contenedor = document.getElementById("resumenEconomico");
    if (!contenedor) return;
    const i = calcularIndicadoresEconomicos();
    contenedor.innerHTML = `<p><strong>Total Facturado:</strong> $${i.totalFacturado.toLocaleString('es-CL')}</p><p><strong>Total Pendiente:</strong> $${i.totalPendiente.toLocaleString('es-CL')}</p>`;
}

// ─── BLOQUE 4: JURISPRUDENCIA AVANZADA ───────────────
// NOTA: renderJurisprudencia ya existe en el sistema original (renderiza #juris-list)
// Esta versión del Bloque 4 renderiza en #listaJurisprudencia (Estrategia Pro)
function renderJurisprudencia() {
    // Llama ambas: la del sistema original y la del módulo avanzado
    uiRenderJurisprudenciaAvanzada();
    // También actualiza la lista original si existe
    const elOrig = document.getElementById("juris-list");
    if (elOrig) {
        if (!DB.jurisprudencia.length) {
            elOrig.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>Sin jurisprudencia indexada</p></div>';
            return;
        }
        elOrig.innerHTML = DB.jurisprudencia.map(j => `
            <div class="juris-card card" style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-family:'IBM Plex Mono',monospace; font-size:0.8rem; color:var(--a); font-weight:600;">${escHtml(j.rol)}</span>
                    <span class="badge badge-a">${escHtml(j.cat || j.materia || '')}</span>
                </div>
                <p style="font-size:0.83rem; color:var(--t2); margin-top:6px;">${escHtml((j.ext || j.temaCentral || '').substring(0, 120))}${(j.ext || j.temaCentral || '').length > 120 ? '...' : ''}</p>
                <button onclick="deleteJuris(${j.id})" class="btn btn-d btn-sm" style="margin-top:10px;"><i class="fas fa-trash"></i></button>
            </div>`).join('');
    }
}
// Se renombra la versión extendida para usar contenedor diferente
function crearJurisprudencia(data) {
    DB.jurisprudencia.push({
        id: generarID(), tribunal: data.tribunal, rol: data.rol, fecha: data.fecha,
        materia: data.materia, procedimiento: data.procedimiento, temaCentral: data.temaCentral || "",
        tendencia: data.tendencia, nivelRelevancia: data.nivelRelevancia,
        palabrasClave: data.palabrasClave || [], asociadaACausas: [], vectorEmbedding: null
    });
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function buscarJurisprudencia(texto) {
    return DB.jurisprudencia.filter(j =>
        j.materia?.toLowerCase().includes(texto.toLowerCase()) ||
        j.temaCentral?.toLowerCase().includes(texto.toLowerCase()) ||
        j.palabrasClave?.some(p => p.toLowerCase().includes(texto.toLowerCase()))
    );
}

function asociarJurisprudenciaACausa(causaId, jurisId) {
    const causa = DB.causas.find(c => c.id === causaId);
    const juris = DB.jurisprudencia.find(j => j.id === jurisId);
    if (!causa || !juris) return;
    if (!juris.asociadaACausas.includes(causaId)) juris.asociadaACausas.push(causaId);
    if (!causa.jurisprudenciaAsociada) causa.jurisprudenciaAsociada = [];
    if (!causa.jurisprudenciaAsociada.includes(jurisId)) causa.jurisprudenciaAsociada.push(jurisId);
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function sugerirJurisprudenciaParaCausa(causa) {
    return DB.jurisprudencia.filter(j => j.materia === causa.rama || j.procedimiento === causa.tipoProcedimiento);
}

function evaluarImpactoJurisprudencial(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa?.jurisprudenciaAsociada) return;
    const desfavorables = causa.jurisprudenciaAsociada.filter(jId => DB.jurisprudencia.find(x => x.id === jId)?.tendencia === "Desfavorable").length;
    if (!causa.riesgo) causa.riesgo = {};
    causa.riesgo.jurisprudencial = desfavorables > 0 ? "Alto" : "Moderado";
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

// ─── BLOQUE 5: PANEL EJECUTIVO AVANZADO ──────────────
function calcularIndicadoresGenerales() {
    return {
        totalClientes: DB.clientes.length,
        totalCausas: DB.causas.length,
        causasActivas: DB.causas.filter(c => c.estadoGeneral !== "Finalizada").length,
        causasFinalizadas: DB.causas.filter(c => c.estadoGeneral === "Finalizada").length,
        causasEnRecurso: DB.causas.filter(c => c.instancia !== "Primera").length
    };
}

function calcularIndicadoresProcesales() {
    if (!DB.causas.length) return { avancePromedio: 0, enPrueba: 0 };
    return {
        avancePromedio: Math.round(DB.causas.reduce((acc, c) => acc + c.porcentajeAvance, 0) / DB.causas.length),
        enPrueba: DB.causas.filter(c => obtenerEtapaActual(c) === "Recepción a prueba").length
    };
}

function calcularIndicadoresComerciales() {
    const aceptados = DB.prospectos.filter(p => p.estado === "Aceptado").length;
    return {
        prospectosActivos: DB.prospectos.filter(p => p.estado !== "Aceptado" && p.estado !== "Rechazado").length,
        tasaConversion: DB.prospectos.length ? Math.round((aceptados / DB.prospectos.length) * 100) : 0
    };
}

function calcularProyeccionAnual() {
    return Math.round(calcularIndicadoresEconomicos().totalFacturado);
}

function renderPanelEjecutivo() {
    const contenedor = document.getElementById("panelEjecutivo");
    if (!contenedor) return;
    const g = calcularIndicadoresGenerales();
    const p = calcularIndicadoresProcesales();
    const c = calcularIndicadoresComerciales();
    const e = calcularIndicadoresEconomicos();
    contenedor.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px;">
            <div class="stat-card"><h4>Clientes</h4><h2 style="color:var(--a)">${g.totalClientes}</h2></div>
            <div class="stat-card"><h4>Causas Activas</h4><h2 style="color:var(--s)">${g.causasActivas}</h2></div>
            <div class="stat-card"><h4>Causas Finalizadas</h4><h2>${g.causasFinalizadas}</h2></div>
            <div class="stat-card"><h4>Avance Promedio</h4><h2 style="color:var(--a)">${p.avancePromedio}%</h2></div>
            <div class="stat-card"><h4>Prospectos Activos</h4><h2 style="color:var(--w)">${c.prospectosActivos}</h2></div>
            <div class="stat-card"><h4>Tasa Conversión</h4><h2>${c.tasaConversion}%</h2></div>
            <div class="stat-card"><h4>Total Facturado</h4><h2 style="color:var(--s); font-size:1.2rem;">$${e.totalFacturado.toLocaleString('es-CL')}</h2></div>
            <div class="stat-card"><h4>Pendiente Cobro</h4><h2 style="color:var(--d); font-size:1.2rem;">$${e.totalPendiente.toLocaleString('es-CL')}</h2></div>
        </div>`;
}

// ─── BLOQUE 6: GESTOR DOCUMENTAL EXTENDIDO ───────────
function agregarDocumento(causaId, data) {
    if (!verificarEdicionPermitida(causaId)) return;
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    const nuevoDoc = {
        id: generarID(), nombreOriginal: data.nombreOriginal,
        tipo: data.tipo, etapaVinculada: data.etapaVinculada,
        fechaDocumento: data.fechaDocumento ? new Date(data.fechaDocumento) : hoy(),
        fechaCarga: hoy(), generaPlazo: data.generaPlazo || false,
        diasPlazo: data.diasPlazo || 0, fechaVencimiento: null
    };
    if (nuevoDoc.generaPlazo && nuevoDoc.diasPlazo > 0) {
        const venc = new Date(nuevoDoc.fechaDocumento);
        venc.setDate(venc.getDate() + nuevoDoc.diasPlazo);
        nuevoDoc.fechaVencimiento = venc;
        crearAlerta({ causaId: causa.id, tipo: "plazo", mensaje: "Nuevo plazo generado por documento.", fechaObjetivo: venc, prioridad: "alta" });
    }
    const etapa = causa.etapasProcesales?.find(e => e.nombre === data.etapaVinculada);
    if (etapa) etapa.documentoAsociado = nuevoDoc.id;
    causa.documentos.push(nuevoDoc);
    causa.fechaUltimaActividad = hoy();
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); recalcularAvance(causa); actualizarSistema();
    registrarEvento("Documento agregado a causa " + causaId);
}

function listarDocumentos(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return [];
    return causa.documentos.sort((a, b) => new Date(a.fechaDocumento) - new Date(b.fechaDocumento));
}

function renderDocumentos(causaId) {
    const contenedor = document.getElementById("listaDocumentos");
    if (!contenedor) return;
    contenedor.innerHTML = listarDocumentos(causaId).map(doc => `
        <div class="card" style="margin-bottom:10px; font-size:0.83rem;">
            <strong>${escHtml(doc.nombreOriginal)}</strong>
            <p>Tipo: ${escHtml(doc.tipo)} · Etapa: ${escHtml(doc.etapaVinculada)}</p>
            <p>Fecha: ${new Date(doc.fechaDocumento).toLocaleDateString('es-CL')}${doc.fechaVencimiento ? ` · <span style="color:var(--d)">Vence: ${new Date(doc.fechaVencimiento).toLocaleDateString('es-CL')}</span>` : ''}</p>
        </div>`).join('') || '<div class="empty-state"><i class="fas fa-file"></i><p>Sin documentos.</p></div>';
}

function cerrarCausa(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    if (causa.etapasProcesales?.some(e => !e.completada)) { showError("No se puede cerrar. Existen etapas pendientes."); return; }
    causa.estadoGeneral = "Finalizada";
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); renderDashboard();
}

function reactivarCausa(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    causa.estadoGeneral = "En tramitación"; causa.instancia = "Segunda";
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); renderDashboard();
}

function generarLineaTiempo(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return [];
    return causa.documentos
        .sort((a, b) => new Date(a.fechaDocumento) - new Date(b.fechaDocumento))
        .map(doc => ({ fecha: doc.fechaDocumento, descripcion: doc.nombreOriginal }));
}

// ─── BLOQUE 7: MOTOR ESTRATÉGICO ─────────────────────
function evaluarRiesgoIntegral(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    let riesgo = { procesal: "Bajo", probatorio: "Bajo", jurisprudencial: causa.riesgo?.jurisprudencial || "Moderado", economico: "Bajo", estrategico: "Bajo" };
    const etapaActual = obtenerEtapaActual(causa);
    if (etapaActual === "Recepción a prueba" || etapaActual === "Prueba") riesgo.procesal = "Medio";
    if (etapaActual === "Sentencia") riesgo.procesal = "Alto";
    if (!causa.documentos?.some(d => d.tipo === "Prueba") && (etapaActual === "Recepción a prueba" || etapaActual === "Prueba")) riesgo.probatorio = "Alto";
    if (causa.honorarios?.saldoPendiente > 0) riesgo.economico = "Medio";
    if (!causa.jurisprudenciaAsociada?.length) riesgo.estrategico = "Medio";
    causa.riesgo = riesgo;
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function generarRecomendaciones(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return [];
    let rec = [];
    const etapa = obtenerEtapaActual(causa);
    if (etapa === "Recepción a prueba" || etapa === "Prueba") rec.push("Revisar estrategia probatoria y testigos.");
    if (causa.riesgo?.jurisprudencial === "Alto") rec.push("Analizar precedentes desfavorables asociados.");
    if (causa.honorarios?.saldoPendiente > 0) rec.push("Revisar estado de pagos antes de avanzar a etapa crítica.");
    if (!causa.jurisprudenciaAsociada?.length) rec.push("Se recomienda asociar jurisprudencia relevante.");
    return rec;
}

function renderAnalisisEstrategico(causaId) {
    const contenedor = document.getElementById("analisisEstrategico");
    if (!contenedor) return;
    evaluarRiesgoIntegral(causaId);
    const causa = DB.causas.find(c => c.id === causaId);
    const rec = generarRecomendaciones(causaId);
    const colorRiesgo = v => v === "Alto" ? "var(--d)" : v === "Medio" ? "var(--w)" : "var(--s)";
    contenedor.innerHTML = `
        <h4 style="margin-bottom:10px;">Evaluación de Riesgo</h4>
        ${Object.entries(causa.riesgo).map(([k, v]) => `
            <div class="risk-row"><div class="risk-label"><span style="text-transform:capitalize">${k}</span><span style="color:${colorRiesgo(v)}">${v}</span></div>
            <div class="risk-meter"><div class="risk-fill" style="width:${v === 'Alto' ? 80 : v === 'Medio' ? 50 : 25}%; background:${colorRiesgo(v)}"></div></div></div>`).join('')}
        <h4 style="margin:14px 0 8px;">Recomendaciones</h4>
        ${rec.length ? rec.map(r => `<div class="alert-item info"><i class="fas fa-lightbulb"></i>${escHtml(r)}</div>`).join('') : '<p style="font-size:0.83rem;color:var(--t2);">Sin recomendaciones activas.</p>'}`;
}

function actualizarMotorEstrategico() {
    DB.causas.forEach(causa => evaluarRiesgoIntegral(causa.id));
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

// ─── BLOQUE 8: SEGURIDAD ESTRUCTURAL ─────────────────
function registrarIntentoLogin(usuario, exito) {
    DB.intentosLogin.push({ usuario, exito, fecha: hoy() });
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function registrarEvento(descripcion) {
    DB.bitacora.push({ descripcion, fecha: hoy() });
    if (DB.bitacora.length > 500) DB.bitacora = DB.bitacora.slice(-500); // límite
    try {
        if (window.Audit && typeof window.Audit.log === 'function') {
            window.Audit.log({
                accion: 'BITACORA',
                entidad: 'bitacora',
                referenciaId: null,
                detalles: { descripcion: String(descripcion || '') },
                origen: 'ui',
                ok: true
            });
        }
    } catch (_) {}
    try {
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('bitacora:updated', { descripcion: String(descripcion || '') });
        }
    } catch (_) {}
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
}

function verificarEdicionPermitida(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return false;
    if (causa.estadoGeneral === "Finalizada") { showError("La causa está cerrada. Debe reactivarse para modificar."); return false; }
    return true;
}

function esAdmin() { return DB.rolActual === "admin"; }

function renderBitacora() {
    const contenedor = document.getElementById("bitacoraSistema");
    if (!contenedor) return;
    contenedor.innerHTML = DB.bitacora.length
        ? [...DB.bitacora].reverse().slice(0, 50).map(e => `
            <div class="alert-item info" style="margin-bottom:6px;">
                <i class="fas fa-shield-alt"></i>
                <div><span>${escHtml(e.descripcion)}</span><br><small style="color:var(--t2);">${new Date(e.fecha).toLocaleString('es-CL')}</small></div>
            </div>`).join('')
        : '<div class="alert-empty">Sin eventos registrados.</div>';
}

// DOMContentLoaded #2 eliminado — init() consolida todo
// ═══════════════════════════════════════════════════════════════
// BLOQUE 9 – GENERADOR DE ESCRITOS
// ═══════════════════════════════════════════════════════════════

let _escritoActual = { causaId: null, texto: '', tipo: '' };

function generarEscrito(causaId, tipoEscrito, hechosUsuario) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return "";
    const etapaActual = obtenerEtapaActual(causa);
    const recomendaciones = generarRecomendaciones(causaId);
    const fechaHoy = new Date().toLocaleDateString('es-CL');

    let encabezado =
        `EN LO PRINCIPAL: ${tipoEscrito.toUpperCase()}; EN EL OTROSÍ: Acompaña documentos.

S.J.L. COMPETENTE

RIT/ROL: _____________
Carátula: ${causa.caratula}
Procedimiento: ${causa.tipoProcedimiento}
Fecha: ${fechaHoy}

[NOMBRE ABOGADO], abogado, en representación de [NOMBRE CLIENTE], en causa
RIT _______, a SS. respetuosamente digo:

`;

    let cuerpo = "";
    switch (tipoEscrito) {
        case "Demanda":
            cuerpo =
                `I. EXPOSICIÓN DE LOS HECHOS

${hechosUsuario}

II. FUNDAMENTOS DE DERECHO

Conforme a la normativa vigente aplicable al procedimiento ${causa.tipoProcedimiento},
y en especial las disposiciones del Código de Procedimiento Civil y normas
sustantivas aplicables a la materia de autos (${causa.rama || 'Civil'}).

III. PETICIONES CONCRETAS

POR TANTO, en mérito de lo expuesto y dispuesto en los artículos citados,
SOLICITO A SS.:

Tener por interpuesta demanda ${causa.tipoProcedimiento}, acogerla en todas
sus partes, con costas.
`;
            break;

        case "Contestación":
            cuerpo =
                `I. CONSIDERACIONES PREVIAS

${hechosUsuario}

II. EXCEPCIONES Y DEFENSAS

Sin perjuicio de lo anterior, se controvierten todos y cada uno de los hechos
señalados por la contraria que no sean expresamente reconocidos en este escrito.

III. PETICIONES CONCRETAS

POR TANTO, SOLICITO A SS.:

Tener por contestada la demanda, rechazarla en todas sus partes, con costas.
`;
            break;

        case "Recurso Apelación":
            cuerpo =
                `I. RESOLUCIÓN IMPUGNADA

Se apela de la resolución de fecha _______, que resolvió _______.

II. FUNDAMENTOS DEL RECURSO — AGRAVIOS

${hechosUsuario}

III. DERECHO APLICABLE

La resolución infringe las normas aplicables al procedimiento
${causa.tipoProcedimiento}, causando agravio a mi representado.

IV. PETICIÓN CONCRETA

POR TANTO, SOLICITO A SS.:

Conceder el presente recurso de apelación, elevando los autos al
tribunal superior para que revoque o enmiende la resolución impugnada.
`;
            break;

        case "Réplica":
            cuerpo =
                `I. HECHOS QUE SE REPLICAN

${hechosUsuario}

II. DERECHO

Se mantienen íntegramente los fundamentos de la demanda. Las excepciones
opuestas por la demandada carecen de asidero jurídico.

III. PETICIÓN

SOLICITO SS. tener por evacuado trámite de réplica, con todo lo favorable.
`;
            break;

        case "Dúplica":
            cuerpo =
                `I. HECHOS QUE SE DUPLICAN

${hechosUsuario}

II. DERECHO

Se mantienen íntegramente las defensas opuestas en la contestación.

III. PETICIÓN

SOLICITO SS. tener por evacuado trámite de dúplica, con todo lo favorable.
`;
            break;

        case "Medida Cautelar":
            cuerpo =
                `I. FUNDAMENTOS DE LA CAUTELA

${hechosUsuario}

II. REQUISITOS LEGALES

Concurren los requisitos del fumus boni iuris y periculum in mora necesarios
para la concesión de la medida solicitada.

III. PETICIÓN CAUTELAR

SOLICITO SS. decretar medida cautelar de _______, bajo apercibimiento de ley.
`;
            break;

        case "Observaciones a la Prueba":
            cuerpo =
                `I. PRUEBA RENDIDA POR LA PARTE DEMANDANTE

${hechosUsuario}

II. ANÁLISIS CRÍTICO DE LA PRUEBA CONTRARIA

Los medios probatorios aportados por la contraria son insuficientes para
acreditar los supuestos de hecho de su pretensión.

III. PETICIÓN

SOLICITO SS. tener por evacuadas las observaciones a la prueba, con todo
lo favorable a mi parte.
`;
            break;

        default:
            cuerpo =
                `I. ANTECEDENTES

${hechosUsuario}

II. PETICIÓN

SOLICITO SS. acceder a lo solicitado, con todo lo favorable.
`;
    }

    const seccionEstrategica = recomendaciones.length
        ? `\n\n[NOTAS INTERNAS — NO INCLUIR EN PRESENTACIÓN FINAL]\n${recomendaciones.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n[FIN NOTAS INTERNAS]\n`
        : '';

    const pie =
        `

_______________________________
[NOMBRE ABOGADO]
Abogado — [RUN]
[Domicilio procesal]
[Correo electrónico]
`;

    const documentoFinal = encabezado + cuerpo + pie + seccionEstrategica;
    registrarEvento(`Escrito generado: ${tipoEscrito} — causa ${causaId}`);
    return documentoFinal;
}

/**
 * Guarda el texto de un escrito como documento adjunto en la causa.
 * Agrega la entrada tanto a causa.documentos (embedded) como a DB.documentos (colección global).
 *
 * @param {string} causaId     - ID de la causa destino.
 * @param {string} texto       - Texto completo del escrito.
 * @param {string} tipoEscrito - ID del tipo de escrito (e.g. 'demanda_civil').
 */
function guardarEscritoComoDocumento(causaId, texto, tipoEscrito) {
    if (!verificarEdicionPermitida(causaId)) return;
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    agregarDocumento(causaId, {
        nombreOriginal: `${tipoEscrito} — borrador ${new Date().toLocaleDateString('es-CL')}`,
        tipo: "Escrito",
        etapaVinculada: obtenerEtapaActual(causa),
        fechaDocumento: new Date().toISOString().split('T')[0],
        generaPlazo: false,
        descripcion: `Borrador generado automáticamente. Revisar antes de presentar.`
    });
    registrarEvento(`Escrito guardado en causa: ${tipoEscrito} — ${causa.caratula}`);
}

/** Agrega una cuota de pago programada a una causa */
function registrarCuota(causaId, { monto, fechaVencimiento, descripcion }) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    if (!causa.honorarios) causa.honorarios = {};
    if (!causa.honorarios.cuotas) causa.honorarios.cuotas = [];
    causa.honorarios.cuotas.push({
        id: generarID(),
        monto,
        fechaVencimiento,
        descripcion: descripcion || 'Cuota de honorarios',
        pagada: false,
        alertaEnviada: false,
        fechaPago: null,
        comprobante: null,   // base64 foto cheque/transferencia
    });
    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
}

/** Marca una cuota como pagada y adjunta comprobante */
function pagarCuota(causaId, cuotaId, { comprobante, fechaPago }) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    const cuota = (causa.honorarios?.cuotas || []).find(q => q.id === cuotaId);
    if (!cuota) return;
    cuota.pagada = true;
    cuota.fechaPago = fechaPago || hoy();
    cuota.comprobante = comprobante || null;
    // Actualizar saldo
    causa.honorarios.saldoPendiente = Math.max(0,
        (causa.honorarios.saldoPendiente || 0) - cuota.monto
    );
    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    if (typeof renderExpedienteFinanciero === 'function')
        renderExpedienteFinanciero(causaId);
}
window.registrarCuota = registrarCuota;
window.pagarCuota = pagarCuota;

// ████████████████████████████████████████████████████████████████████
// JS — BLOQUE 5: ANÁLISIS Y PANEL EJECUTIVO AVANZADO
// • Semáforo de plazos, cuantía dinámica, categorización IA, fichas
//   estrategia, score despacho, matriz prioridad, coherencia, mapa
//   económico, instancias, PDF, conflicto interés, backup, modo estudio
// ████████████████████████████████████████████████████████████████████
