        // FUNCIONES NUEVAS — 15 MEJORAS
        // ═══════════════════════════════════════════════════════════════

        // ─── UTILS MODAL ─────────────────────────────────────────────────
        function abrirModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = '';
            el.classList.add('open');
        }

        // ───────────────────────────────────────────────────────────────────
        // Contrato por gestión (Causa / Trámite)
        // ───────────────────────────────────────────────────────────────────
        window.generarContratoGestion = async function (tipo, id) {
            const t = String(tipo || '').toLowerCase() === 'tramite' ? 'tramite' : 'causa';
            const gid = String(id || '').trim();
            if (!gid) {
                if (typeof showError === 'function') showError('Gestión inválida.');
                return;
            }

            const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80);
            const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

            let ent = null;
            let cliente = null;
            let objeto = '';
            let tipoLabel = '';
            let honorariosTexto = '';

            if (t === 'tramite') {
                ent = (window.TramitesDB && typeof window.TramitesDB.porId === 'function')
                    ? window.TramitesDB.porId(gid)
                    : null;
                if (!ent) {
                    if (typeof showError === 'function') showError('Trámite no encontrado.');
                    return;
                }
                cliente = (DB?.clientes || []).find(c => String(c?.id || '') === String(ent?.clienteId || '')) || null;
                objeto = `${ent?.tipo || 'Trámite'}${ent?.caratula ? ' — ' + ent.caratula : ''}`.trim();
                tipoLabel = 'Trámite Administrativo';
            } else {
                ent = _dcFindCausaById(gid);
                if (!ent) {
                    if (typeof showError === 'function') showError('Causa no encontrada.');
                    return;
                }
                cliente = (DB?.clientes || []).find(c => String(c?.id || '') === String(ent?.clienteId || '')) || null;
                objeto = String(ent?.caratula || 'Causa').trim();
                tipoLabel = 'Causa Judicial';
            }

            const h = (ent && ent.honorarios && typeof ent.honorarios === 'object') ? ent.honorarios : {};
            const montoBase = parseFloat(h?.montoBase ?? h?.montoTotal ?? h?.base ?? h?.monto ?? 0) || 0;
            const modalidad = String(h?.modalidad || (Array.isArray(h?.planPagos) && h.planPagos.length > 1 ? 'CUOTAS' : 'CONTADO')).toUpperCase();
            const plan = Array.isArray(h?.planPagos) ? h.planPagos : [];

            const fmtMoney = (n) => `$${Math.round(parseFloat(n || 0) || 0).toLocaleString('es-CL')}`;
            const fmtFecha = (iso) => {
                try {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL');
                } catch (_) { return '—'; }
            };

            if (montoBase > 0) {
                if (modalidad === 'CUOTAS' && plan.length) {
                    const rows = plan.map(c => {
                        const n = parseInt(c?.numero) || '';
                        const m = fmtMoney(c?.monto || 0);
                        const f = fmtFecha(c?.fechaVencimiento);
                        return `<tr><td>${esc(n)}</td><td style="text-align:right;">${esc(m)}</td><td>${esc(f)}</td></tr>`;
                    }).join('');
                    honorariosTexto = `Monto base: <strong>${esc(fmtMoney(montoBase))}</strong> CLP.<br><br>
                        <strong>Plan de pagos (${plan.length} cuota${plan.length === 1 ? '' : 's'}):</strong>
                        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
                          <thead><tr><th style="text-align:left; border-bottom:1px solid #e2e8f0; padding:6px 4px;">Nº</th><th style="text-align:right; border-bottom:1px solid #e2e8f0; padding:6px 4px;">Monto</th><th style="text-align:left; border-bottom:1px solid #e2e8f0; padding:6px 4px;">Vencimiento</th></tr></thead>
                          <tbody>${rows}</tbody>
                        </table>`;
                } else {
                    const f = plan[0]?.fechaVencimiento ? fmtFecha(plan[0].fechaVencimiento) : '—';
                    honorariosTexto = `Monto base: <strong>${esc(fmtMoney(montoBase))}</strong> CLP.<br>Forma de pago: <strong>Contado</strong>.<br>Vencimiento: <strong>${esc(f)}</strong>.`;
                }
            } else {
                honorariosTexto = 'Según acuerdo entre las partes.';
            }

            const hoy = new Date().toLocaleDateString('es-CL');
            const clienteNombre = (cliente?.nombre || cliente?.nom || ent?.cliente || ent?.clienteNombre || 'Cliente').toString();
            const clienteRut = (cliente?.rut || '').toString();
            const clienteEmail = (cliente?.email || '').toString();
            const clienteTelefono = (cliente?.telefono || '').toString();

            const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Contrato de Servicios - ${esc(clienteNombre)}</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;padding:28px;line-height:1.55;}
h1{font-size:22px;margin:0 0 10px;}
h2{font-size:13px;text-transform:uppercase;margin:20px 0 8px;color:#1e3a8a;}
table{width:100%;border-collapse:collapse;font-size:13px;}
td{padding:8px;border-bottom:1px solid #e2e8f0;}
td:first-child{width:34%;font-weight:700;color:#475569}
.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}
.firmas{margin-top:38px;display:grid;grid-template-columns:1fr 1fr;gap:26px}
.firma{border-top:1px solid #94a3b8;padding-top:7px;font-size:12px;color:#475569}
</style></head><body>
<h1>Contrato de Prestación de Servicios</h1>
<div style="font-size:12px;color:#64748b;">Fecha de emisión: ${esc(hoy)} · Tipo: ${esc(tipoLabel)}</div>

<h2>1. Individualización de las partes</h2>
<table>
<tr><td>Cliente</td><td>${esc(clienteNombre || '—')}</td></tr>
<tr><td>RUT</td><td>${esc(clienteRut || '—')}</td></tr>
<tr><td>Email</td><td>${esc(clienteEmail || '—')}</td></tr>
<tr><td>Teléfono</td><td>${esc(clienteTelefono || '—')}</td></tr>
</table>

<h2>2. Objeto del encargo</h2>
<div class="box">${esc(objeto || 'Gestión legal encomendada por el cliente.')}</div>

<h2>3. Honorarios y forma de pago</h2>
<div class="box">${honorariosTexto}</div>

<h2>4. Mandato y facultades</h2>
<div class="box">El cliente confiere patrocinio y poder para ejecutar actuaciones necesarias dentro del encargo profesional.</div>

<div class="firmas">
<div class="firma">Firma Cliente</div>
<div class="firma">Firma Estudio / Abogado</div>
</div>
</body></html>`;

            const pdfApi = window.electronAPI?.prospectos?.generarPDF
                ? window.electronAPI.prospectos
                : (window.electronAPI?.generarPDF ? window.electronAPI : null);
            if (!pdfApi?.generarPDF) {
                if (typeof showError === 'function') showError('La función de generar PDF no está disponible en este entorno.');
                return;
            }

            const pdfOutputDir = (typeof AppConfig !== 'undefined' && AppConfig.get)
                ? (AppConfig.get('pdf_output_dir') || '')
                : '';
            const pdfAskSaveAs = (typeof AppConfig !== 'undefined' && AppConfig.get)
                ? !!AppConfig.get('pdf_preguntar_guardar_como')
                : false;

            const nombrePdf = `Contrato_${safe(clienteNombre)}_${safe(objeto || tipoLabel)}_${new Date().toISOString().slice(0, 10)}.pdf`;
            let r;
            try {
                const forceSaveAsOnce = !!window._lexiumForceSaveAsOnce;
                window._lexiumForceSaveAsOnce = false;
                r = await pdfApi.generarPDF({
                    html,
                    defaultName: nombrePdf,
                    nombre: nombrePdf,
                    outputDir: pdfOutputDir,
                    saveAs: forceSaveAsOnce || pdfAskSaveAs
                });
            } catch (e) {
                if (typeof showError === 'function') showError(e?.message || 'No se pudo generar el PDF.');
                return;
            }

            const base64 = (r && typeof r === 'object') ? (r.base64 || '') : '';
            if (!base64) {
                if (typeof showError === 'function') showError('No se recibió el PDF generado (base64 vacío).');
                return;
            }

            const rutaPdf = (r && typeof r === 'object') ? (r.ruta || r.path || '') : '';

            // Persistir en DB.documentos asociado a la gestión
            try {
                if (!DB || typeof DB !== 'object') return;
                if (!Array.isArray(DB.documentos)) DB.documentos = [];

                const refId = `${t}:${gid}`;
                const docId = (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                DB.documentos.push({
                    id: docId,
                    causaId: refId,
                    nombreOriginal: nombrePdf,
                    tipo: 'Contrato',
                    etapaVinculada: 'Contratación',
                    fechaDocumento: (new Date().toISOString().split('T')[0]),
                    generaPlazo: false,
                    diasPlazo: 0,
                    fechaVencimiento: null,
                    fechaIngreso: new Date().toISOString(),
                    descripcion: 'Contrato de prestación de servicios (por gestión).',
                    archivoBase64: base64,
                    archivoNombre: nombrePdf,
                    archivoMime: 'application/pdf',
                    proveedorIA: null,
                    _origen: 'contrato'
                });
                if (typeof markAppDirty === 'function') markAppDirty();
                if (typeof save === 'function') save();
            } catch (_) { }

            // Abrir PDF vía Electron (evita bloqueos de descargas/popups)
            try {
                if (rutaPdf && window.electronAPI?.sistema?.revelarEnCarpeta) {
                    await window.electronAPI.sistema.revelarEnCarpeta(rutaPdf);
                } else if (rutaPdf && window.electronAPI?.sistema?.abrirRuta) {
                    await window.electronAPI.sistema.abrirRuta(rutaPdf);
                } else {
                    // Fallback web: descargar
                    const bin = atob(base64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = nombrePdf;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        try { URL.revokeObjectURL(blobUrl); } catch (_) { }
                        try { document.body.removeChild(a); } catch (_) { }
                    }, 2500);
                }
            } catch (_) { }

            if (typeof showSuccess === 'function') showSuccess('Contrato generado y guardado en Documentos.');
        };

        function _dcAplicarSugerenciasJudicialesIA(causa, data, nombreArchivo) {
            if (!causa || _dcEsTramiteAdmin(causa) || !data || typeof data !== 'object') return { nuevosEventos: 0, alertasNuevas: 0, audienciasActivadas: false };
            const prevAudienciasHabilitadas = !!causa?.audiencias?.habilitado;
            let nuevosEventos = 0;
            let alertasNuevas = 0;
            const ext = (data.extraer && typeof data.extraer === 'object') ? data.extraer : {};

            if (!causa.iaSugerencias || typeof causa.iaSugerencias !== 'object') causa.iaSugerencias = {};
            causa.iaSugerencias.ultimaFuente = nombreArchivo || null;
            causa.iaSugerencias.ultimoAnalisis = new Date().toISOString();
            causa.iaSugerencias.extraer = ext;
            causa.iaSugerencias.eventos = Array.isArray(data.eventos) ? data.eventos : [];

            if (!causa.materia && ext.materia) causa.materia = String(ext.materia).trim();
            if (!causa.rama && ext.rama) causa.rama = String(ext.rama).trim();
            if (!causa.juzgado && ext.tribunal) causa.juzgado = String(ext.tribunal).trim();
            if (!causa.rit && ext.rolRit) causa.rit = String(ext.rolRit).trim();

            if (!causa.partes || typeof causa.partes !== 'object') {
                causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            }
            if (!causa.partes.demandante) causa.partes.demandante = {};
            if (!causa.partes.demandado) causa.partes.demandado = {};

            const p = ext.partes && typeof ext.partes === 'object' ? ext.partes : {};
            if (!causa.partes.demandante.nombre && p.demandante) causa.partes.demandante.nombre = String(p.demandante).trim();
            if (!causa.partes.demandado.nombre && p.demandado) causa.partes.demandado.nombre = String(p.demandado).trim();

            const adm = String(ext.admisibilidad || '').toLowerCase();
            if (adm.includes('no admite')) causa.iaSugerencias.estadoAdmisibilidad = 'No admite';
            else if (adm.includes('subsan')) causa.iaSugerencias.estadoAdmisibilidad = 'Subsanar';
            else if (adm.includes('admite')) causa.iaSugerencias.estadoAdmisibilidad = 'Admite';
            if (causa.iaSugerencias.estadoAdmisibilidad === 'Admite') {
                if (!causa.audiencias || typeof causa.audiencias !== 'object') causa.audiencias = {};
                causa.audiencias.habilitado = true;
                causa.audiencias.activadoPor = 'ia_admisibilidad';
                causa.audiencias.activadoEn = new Date().toISOString();
            }

            const eventos = Array.isArray(data.eventos) ? data.eventos : [];
            if (eventos.length) {
                if (!Array.isArray(causa.eventosProcesalesIA)) causa.eventosProcesalesIA = [];
                if (!Array.isArray(DB.alertas)) DB.alertas = [];

                eventos.forEach(ev => {
                    const tipo = String(ev?.tipo || '').toLowerCase();
                    const titulo = String(ev?.titulo || '').trim();
                    const fecha = String(ev?.fecha || '').trim();
                    const detalle = String(ev?.detalle || '').trim();
                    if (!titulo) return;
                    const firma = `${tipo}|${titulo}|${fecha}`;
                    const existe = causa.eventosProcesalesIA.some(e => String(e.firma || '') === firma);
                    if (existe) return;

                    const item = {
                        id: (typeof uid === 'function' ? uid() : generarID()),
                        firma,
                        tipo: tipo || 'hito',
                        titulo,
                        fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
                        detalle,
                        fuente: nombreArchivo || null,
                        creadoEn: new Date().toISOString()
                    };
                    causa.eventosProcesalesIA.push(item);
                    nuevosEventos++;

                    if (item.tipo === 'audiencia') {
                        if (!causa.audiencias || typeof causa.audiencias !== 'object') causa.audiencias = {};
                        causa.audiencias.habilitado = true;
                        causa.audiencias.activadoPor = 'ia_evento_audiencia';
                        causa.audiencias.activadoEn = new Date().toISOString();
                    }

                    if (item.fecha && (item.tipo === 'plazo' || item.tipo === 'audiencia')) {
                        const alertaNueva = {
                            id: (typeof uid === 'function' ? uid() : generarID()),
                            causaId: causa.id,
                            tipo: item.tipo,
                            mensaje: `[IA] ${item.titulo} — ${causa.caratula || 'Causa'}`,
                            fechaObjetivo: item.fecha,
                            prioridad: item.tipo === 'audiencia' ? 'alta' : 'media',
                            estado: 'activa',
                            fechaCreacion: new Date().toISOString()
                        };
                        if (typeof Store !== 'undefined' && Store?.agregarAlerta) Store.agregarAlerta(alertaNueva);
                        else DB.alertas.push(alertaNueva);
                        alertasNuevas++;
                    }
                });
            }
            return {
                nuevosEventos,
                alertasNuevas,
                audienciasActivadas: !prevAudienciasHabilitadas && !!causa?.audiencias?.habilitado
            };
        }
        function cerrarModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('open');
            el.style.display = 'none';

            // Al cerrar modal-detalle: restaurar sección anterior (evita quedar en detalle vacío)
            if (id === 'modal-detalle') {
                setTimeout(() => {
                    const seccionTarget = window._lexiumSeccionAnterior
                        ? document.getElementById(window._lexiumSeccionAnterior)
                        : null;
                    const seccionCausas = document.getElementById('causas');
                    const seccionDetalle = document.getElementById('detalle-causa');

                    if (seccionTarget) {
                        document.querySelectorAll('section.tabs').forEach(s => s.classList.remove('active'));
                        seccionTarget.classList.add('active');
                        window._lexiumSeccionAnterior = null;
                    } else if (seccionDetalle && seccionDetalle.classList.contains('active') && seccionCausas) {
                        document.querySelectorAll('section.tabs').forEach(s => s.classList.remove('active'));
                        seccionCausas.classList.add('active');
                    }
                    if (typeof renderCausas === 'function') renderCausas();
                }, 80);
            }
        }

        // ─── 1. VISTA DETALLE DE CAUSA (modal completo) ───────────────────
        // ─── Tab activo en detalle de causa ──────────────────────────────
        let _dcTabActivo = 'movimientos';
        let _dcDetalleDelegadoIniciado = false;

        function _dcNormalizarId(valor) {
            const v = String(valor ?? '').trim();
            if (!v) return v;
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                return v.slice(1, -1);
            }
            return v;
        }

        function _dcFindCausaById(causaId) {
            const id = _dcNormalizarId(causaId);
            return DB.causas.find(c => String(c.id) === String(id));
        }

        function _dcInitDetalleDelegado() {
            if (_dcDetalleDelegadoIniciado) return;
            _dcDetalleDelegadoIniciado = true;

            document.addEventListener('click', (ev) => {
                const el = ev.target.closest('[data-dc-action]');
                if (!el) return;

                const action = el.dataset.dcAction;
                const causaId = _dcNormalizarId(el.dataset.causaId);
                const tabName = el.dataset.dcTab;
                const idx = Number(el.dataset.idx);
                const tipo = el.dataset.tipo;
                const tareaId = _dcNormalizarId(el.dataset.tareaId);
                const rolKey = el.dataset.rolKey;
                const rolLabel = el.dataset.rolLabel;
                const instancia = el.dataset.instancia;
                const adjIdx = Number(el.dataset.adjIdx);

                if (action === 'cerrar-modal-detalle') return cerrarModal('modal-detalle');
                if (action === 'volver-listado-causas') { cerrarModal('modal-detalle'); tab('causas', null); return; }
                if (action === 'cerrar-causa') return uiCerrarCausa(causaId);
                if (action === 'reactivar-causa') return uiReactivarCausa(causaId);
                if (action === 'exportar-pdf-causa') return exportarPDFCausa(causaId);
                if (action === 'generar-contrato') {
                    if (typeof window.generarContratoGestion === 'function') {
                        return window.generarContratoGestion('causa', causaId);
                    }
                    if (typeof showError === 'function') showError('Generador de contrato no disponible.');
                    return;
                }
                if (action === 'generar-contrato-saveas') {
                    window._lexiumForceSaveAsOnce = true;
                    if (typeof window.generarContratoGestion === 'function') {
                        return window.generarContratoGestion('causa', causaId);
                    }
                    if (typeof showError === 'function') showError('Generador de contrato no disponible.');
                    return;
                }
                if (action === 'editar-cuantia') {
                    const causa = _dcFindCausaById(causaId);
                    if (!causa) return;
                    migAbrir({
                        titulo: '<i class="fas fa-coins"></i> Cuantía / Pretensión',
                        btnOk: 'Guardar',
                        campos: [
                            { id: 'mig-cuantia', label: 'Cuantía de la pretensión (CLP)', tipo: 'number', valor: String(parseFloat(causa.cuantiaPretension || 0) || 0), placeholder: '0', requerido: false }
                        ],
                        onOk: (vals) => {
                            causa.cuantiaPretension = parseFloat(vals['mig-cuantia'] || 0) || 0;
                            if (typeof markAppDirty === "function") markAppDirty();
                            guardarDB();
                            abrirDetalleCausa(causaId);
                        }
                    });
                    return;
                }
                if (action === 'abrir-adjuntos') return _abrirModalAdjuntos(causaId);
                if (action === 'abrir-lexbot') return lexbotAbrirConCausa(causaId);
                if (action === 'exportar-pdf-pro') { cerrarModal('modal-detalle'); return exportarInformeMejorado(causaId); }
                if (action === 'abrir-estrategia') {
                    const causa = _dcFindCausaById(causaId);
                    if (!causa || _dcEsTramiteAdmin(causa)) {
                        if (typeof showInfo === 'function') showInfo('Estrategia y riesgo se gestionan solo en causas judiciales.');
                        return;
                    }
                    cerrarModal('modal-detalle');
                    tab('estrategia-pro', null);
                    const sel = document.getElementById('ep-causa-sel');
                    if (sel) sel.value = causaId;
                    return uiRenderEstrategiaPro();
                }
                if (action === 'marcar-etapa') return uiMarcarEtapa(causaId, idx);
                if (action === 'abrir-juris') return uiAbrirBuscarJuris(causaId);
                if (action === 'duplicar-causa') return uiDuplicarCausa(causaId);
                if (action === 'cambiar-tab') return dcCambiarTab(tabName, causaId);
                if (action === 'agregar-movimiento') return dcAgregarMovimiento(causaId);
                if (action === 'dc-doc-open') {
                    const inp = document.getElementById(`dc-doc-file-${causaId}`);
                    if (inp) inp.click();
                    return;
                }
                if (action === 'dc-doc-cancel') {
                    dcDocsClearForm(causaId);
                    return;
                }
                if (action === 'dc-doc-save') {
                    return dcDocsGuardarDocumento(causaId);
                }
                if (action === 'eliminar-movimiento') return dcEliminarMovimiento(causaId, idx);
                if (action === 'toggle-tarea') return dcToggleTarea(causaId, tareaId);
                if (action === 'eliminar-tarea') return dcEliminarTarea(causaId, tareaId);
                if (action === 'agregar-tarea') return dcAgregarTarea(causaId);
                if (action === 'eliminar-doc-requisito') return dcEliminarAdjuntoTarea(causaId, tareaId, adjIdx);
                if (action === 'editar-parte') return dcEditarParte(causaId, rolKey, rolLabel);
                if (action === 'editar-intervinientes-tramite') return dcEditarIntervinientesTramite(causaId);
                if (action === 'editar-tribunal') return dcEditarTribunal(causaId);
                if (action === 'ver-doc') return dcVerDocumento(causaId, tipo, idx, tareaId);
                if (action === 'exportar-doc-pdf') return dcExportarDocumentoPDF(causaId, tipo, idx, tareaId);
                if (action === 'analisis-dual-doc') return dcAnalisisDualDoc(causaId, tipo, idx);
                if (action === 'insight-doc') return dcVerInsightDoc(causaId, tipo, idx);
                if (action === 'eliminar-doc') return dcEliminarDocumento(causaId, tipo, idx);
                if (action === 'cambiar-instancia') return dcCambiarInstancia(causaId, instancia);
                if (action === 'agregar-instancia') return dcAgregarInstancia(causaId);
                if (action === 'agregar-recurso') return dcAgregarRecurso(causaId);
                if (action === 'eliminar-recurso') return dcEliminarRecurso(causaId, idx);
                if (action === 'agregar-reparo-tramite') return dcAgregarReparoTramite(causaId);
                if (action === 'eliminar-reparo-tramite') return dcEliminarReparoTramite(causaId, idx);
                if (action === 'abrir-modulo-tramites') return dcAbrirModuloTramites(causaId);
                if (action === 'crear-tramite-vinculado') return dcCrearTramiteVinculado(causaId);
                if (action === 'aplicar-ia-sugerencias') return dcAplicarSugerenciasIA(causaId);
                if (action === 'descartar-ia-sugerencias') return dcDescartarSugerenciasIA(causaId);
                if (action === 'wa-alerta-audiencia') return dcEnviarAlertaAudienciaWhatsApp(causaId, _dcNormalizarId(el.dataset.eventoId));
                if (action === 'gestionar-audiencia-ia') return dcMarcarAudienciaIAGestionada(causaId, _dcNormalizarId(el.dataset.eventoId));
            });

            document.addEventListener('input', (ev) => {
                const causaId = ev.target?.dataset?.dcMovFilter;
                if (causaId) dcFiltrarMovimientos(causaId);
            });

            document.addEventListener('change', (ev) => {
                const target = ev.target;
                if (!target) return;
                const movCausaId = _dcNormalizarId(target.dataset?.dcMovFilter);
                if (movCausaId) dcFiltrarMovimientos(movCausaId);
                const prescCausaId = _dcNormalizarId(target.dataset?.dcPrescAutosave);
                if (prescCausaId) dcGuardarPrescripcion(prescCausaId);
                const hitoCausaId = _dcNormalizarId(target.dataset?.dcTramiteHito);
                if (hitoCausaId) dcGuardarHitosTramite(hitoCausaId);
                const orgCausaId = _dcNormalizarId(target.dataset?.dcTramOrg);
                if (orgCausaId) dcActualizarTiposTramiteIngreso(orgCausaId);
                const reqUploadCausaId = _dcNormalizarId(target.dataset?.dcReqUpload);
                if (reqUploadCausaId) {
                    dcAdjuntarDocRequisito(reqUploadCausaId, _dcNormalizarId(target.dataset?.tareaId), target.files);
                    target.value = '';
                }
                const audFiltroCausaId = _dcNormalizarId(target.dataset?.dcAudFiltro);
                if (audFiltroCausaId) dcCambiarFiltroAudienciasIA(audFiltroCausaId, target.value);
            });

            document.addEventListener('keydown', (ev) => {
                const target = ev.target;
                if (!target) return;

                const tareaCausaId = _dcNormalizarId(target.dataset?.dcTaskInput);
                if (tareaCausaId && ev.key === 'Enter') {
                    ev.preventDefault();
                    dcAgregarTarea(tareaCausaId);
                }
            });
        }

        function dcCambiarTab(tab, causaId) {
            _dcTabActivo = tab;
            document.querySelectorAll('#modal-detalle .dc-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#modal-detalle .dc-tab-panel').forEach(p => p.classList.remove('active'));
            const btnEl = document.getElementById(`dctab-${tab}`);
            const panEl = document.getElementById(`dcpanel-${tab}`);
            if (btnEl) btnEl.classList.add('active');
            if (panEl) panEl.classList.add('active');
            // Render del panel activo
            if (tab === 'movimientos') dcRenderMovimientos(causaId);
            if (tab === 'tareas') dcRenderTareas(causaId);
            if (tab === 'partes') dcRenderPartes(causaId);
            if (tab === 'docs-cliente')  dcRenderDocs(causaId, 'cliente');
            if (tab === 'docs-tribunal') dcRenderDocs(causaId, 'tribunal');
            if (tab === 'docs-contraparte') dcRenderDocs(causaId, 'contraparte');
            if (tab === 'docs-tramites') dcRenderDocs(causaId, 'tramites');
            if (tab === 'proceso') dcRenderProceso(causaId);
            if (tab === 'tramite') dcRenderTramiteSeguimiento(causaId);
        }

        function _dcGetDocsUnificados(causa) {
            if (!causa) return [];
            const campos = [
                { campo: 'docsCliente', origen: 'cliente' },
                { campo: 'docsTribunal', origen: 'tribunal' },
                { campo: 'docsContraparte', origen: 'contraparte' },
                { campo: 'docsTramites', origen: 'tramites' }
            ];
            const docsTabs = campos.flatMap(({ campo, origen }) =>
                (causa[campo] || []).map((d, i) => ({
                    id: d.id || `${campo}-${i}`,
                    nombreOriginal: d.nombreOriginal || d.nombre || 'Documento',
                    fechaDocumento: d.fechaDocumento ? String(d.fechaDocumento).slice(0, 10) : (d.fecha ? String(d.fecha).slice(0, 10) : null),
                    tipo: d.tipo || d.tipoIA || 'Documento',
                    cuaderno: d.cuaderno || 'Principal',
                    etapaVinculada: d.etapaVinculada || d.etapaIA || '—',
                    folio: d.folio || '—',
                    generaPlazo: !!d.generaPlazo,
                    diasPlazo: Number(d.diasPlazo || 0) || 0,
                    fechaVencimiento: d.fechaVencimiento || null,
                    archivoMime: d.archivoMime || null,
                    archivoNombre: d.archivoNombre || null,
                    archivoBase64: d.archivoBase64 || null,
                    origen
                }))
            );

            if (docsTabs.length > 0) return docsTabs;
            return (causa.documentos || []).map(d => ({ ...d }));
        }

        function _dcEsTramiteAdmin(causa) {
            const tipoExp = String(causa?.tipoExpediente || '').toLowerCase();
            if (tipoExp === 'tramite') return true;
            const tipoProc = String(causa?.tipoProcedimiento || '').toLowerCase();
            return /tr[aá]mite/.test(tipoProc);
        }

        function _dcGetTramitesStore() {
            try {
                if (window.TramitesDB && typeof window.TramitesDB.todos === 'function') {
                    const listDb = window.TramitesDB.todos();
                    return Array.isArray(listDb) ? listDb : [];
                }
                const appCfg = (typeof AppConfig !== 'undefined' && AppConfig) ? AppConfig : window.AppConfig;
                const list = appCfg?.get?.('tramites');
                return Array.isArray(list) ? list : [];
            } catch (_) {
                return [];
            }
        }

        function _dcSetTramitesStore(list) {
            try {
                if (window.TramitesDB && typeof window.TramitesDB._guardar === 'function') {
                    window.TramitesDB._guardar(list);
                    return;
                }
                const appCfg = (typeof AppConfig !== 'undefined' && AppConfig) ? AppConfig : window.AppConfig;
                appCfg?.set?.('tramites', list);
            } catch (_) {}
        }

        function _dcGetTramitesVinculados(causaId) {
            return _dcGetTramitesStore().filter(t => String(t.causaId || '') === String(causaId));
        }

        function _dcGetCatalogoOrganismos() {
            const base = window.TRAMITES_CATALOGO || {};
            const entries = Object.entries(base).map(([key, cfg]) => ({
                key,
                label: cfg?.label || key,
                tipos: Array.isArray(cfg?.tipos) ? cfg.tipos : []
            }));
            if (entries.length) return entries;
            return [
                { key: 'CBR', label: 'Conservador de Bienes Raíces', tipos: ['Inscripción de dominio', 'Certificado de dominio vigente', 'Subinscripción'] },
                { key: 'SII', label: 'Servicio de Impuestos Internos', tipos: ['Inicio de actividades', 'Término de giro', 'Rectificación de declaración'] },
                { key: 'MUNICIPALIDAD', label: 'Municipalidad', tipos: ['Patente comercial', 'Permiso municipal', 'Reclamo administrativo'] },
                { key: 'OTRO', label: 'Otro organismo', tipos: ['Trámite administrativo'] }
            ];
        }

        async function _dcVerificarPasswordActual(pass) {
            try {
                const appCfg = (typeof AppConfig !== 'undefined' && AppConfig) ? AppConfig : window.AppConfig;
                let usuarios = appCfg?.get?.('usuarios') || [];
                if (!Array.isArray(usuarios) || usuarios.length === 0) {
                    try {
                        const raw = localStorage.getItem('APPBOGADO_USERS_V2');
                        usuarios = raw ? (JSON.parse(raw) || []) : [];
                    } catch (_) {
                        usuarios = [];
                    }
                }
                if (!Array.isArray(usuarios) || usuarios.length === 0) return false;

                const activos = usuarios.filter(u => u && u.activo !== false && u.passwordHash);
                if (!activos.length) return false;

                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(pass || '')));
                const hashIngresado = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

                return activos.some(u => hashIngresado === String(u.passwordHash || ''));
            } catch (_) {
                return false;
            }
        }

        function _dcSolicitarPassword(titulo, mensaje) {
            return new Promise((resolve) => {
                const prev = document.getElementById('dc-pass-overlay');
                if (prev) prev.remove();

                const overlay = document.createElement('div');
                overlay.id = 'dc-pass-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,.62);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:16px;isolation:isolate;pointer-events:auto;';
                overlay.innerHTML = `
                    <div id="dc-pass-dialog" style="width:min(420px,94vw);background:var(--bg-1,#0f172a);border:1px solid var(--border,#334155);border-radius:12px;padding:16px;box-shadow:0 20px 48px rgba(0,0,0,.45);pointer-events:auto;" role="dialog" aria-modal="true" tabindex="-1">
                        <div style="font-weight:700;font-size:.95rem;margin-bottom:8px;color:var(--text-1,#e2e8f0);">${escHtml(titulo || 'Confirmar acción')}</div>
                        <div style="font-size:.82rem;color:var(--text-3,#94a3b8);margin-bottom:10px;">${escHtml(mensaje || 'Para continuar, ingresa tu contraseña.')}</div>
                        <input id="dc-pass-input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Contraseña" style="width:100%;padding:9px 11px;border:1px solid var(--border,#334155);border-radius:8px;background:var(--bg-2,#111827);color:var(--text-1,#e2e8f0);box-sizing:border-box;pointer-events:auto;user-select:text;">
                        <div id="dc-pass-err" style="display:none;color:#ef4444;font-size:.76rem;margin-top:6px;">Contraseña incorrecta.</div>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                            <button id="dc-pass-cancel" type="button" class="btn" style="padding:7px 12px;">Cancelar</button>
                            <button id="dc-pass-ok" type="button" class="btn btn-d" style="padding:7px 12px;">Confirmar</button>
                        </div>
                    </div>`;

                const close = (val) => {
                    overlay.remove();
                    resolve(val);
                };
                (document.documentElement || document.body).appendChild(overlay);

                const inp = overlay.querySelector('#dc-pass-input');
                const err = overlay.querySelector('#dc-pass-err');
                const okBtn = overlay.querySelector('#dc-pass-ok');
                const cancelBtn = overlay.querySelector('#dc-pass-cancel');
                const dialog = overlay.querySelector('#dc-pass-dialog');

                dialog?.addEventListener('click', (ev) => ev.stopPropagation());
                dialog?.addEventListener('mousedown', (ev) => ev.stopPropagation());
                dialog?.addEventListener('keydown', (ev) => ev.stopPropagation());

                const onConfirm = async () => {
                    const val = String(inp?.value || '').trim();
                    if (!val) {
                        if (err) { err.textContent = 'Ingresa tu contraseña.'; err.style.display = 'block'; }
                        inp?.focus();
                        return;
                    }
                    const ok = await _dcVerificarPasswordActual(val);
                    if (!ok) {
                        if (err) { err.textContent = 'Contraseña incorrecta.'; err.style.display = 'block'; }
                        if (inp) { inp.value = ''; inp.focus(); }
                        return;
                    }
                    close(true);
                };

                if (okBtn) okBtn.onclick = onConfirm;
                okBtn?.addEventListener('click', onConfirm);
                cancelBtn?.addEventListener('click', () => close(false));
                overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(false); });
                inp?.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') onConfirm();
                    if (ev.key === 'Escape') close(false);
                });
                const focusInput = () => {
                    dialog?.focus();
                    inp?.focus();
                    inp?.select?.();
                };
                focusInput();
                requestAnimationFrame(() => {
                    focusInput();
                    setTimeout(focusInput, 0);
                });
            });
        }

        async function _dcConfirmarAccionSegura(mensajeBase) {
            const ok = await _dcSolicitarPassword('Validación de seguridad', `${mensajeBase} Confirma con tu contraseña para continuar.`);
            if (!ok && typeof showError === 'function') showError('Operación cancelada o contraseña inválida.');
            return ok;
        }

        function _dcSyncLegacyDocumentos(causa) {
            if (!causa) return;
            causa.documentos = _dcGetDocsUnificados(causa);
        }

        function abrirDetalleCausa(causaId) {
            _dcInitDetalleDelegado();
            // Mantener referencia global de la causa actualmente abierta (para acciones rápidas como honorarios)
            window._dcCurrentCausaId = causaId;

            // Guardar sección activa para restaurar al cerrar el modal
            const seccionActiva = document.querySelector('section.tabs.active');
            const idActivo = seccionActiva ? seccionActiva.id : 'causas';
            if (idActivo !== 'causa-detail' && idActivo !== 'detalle-causa') {
                window._lexiumSeccionAnterior = idActivo;
            }

            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const esTramiteAdmin = _dcEsTramiteAdmin(causa);
            if (!esTramiteAdmin) evaluarRiesgoIntegral(causaId);

            // Inicializar estructuras si no existen
            if (!causa.tareas) causa.tareas = [];
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            if (!causa.movimientos) causa.movimientos = [];
            if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') {
                causa.tramiteMeta = { organismo: '', tipoTramite: '', lugarGestion: '', numeroIngreso: '' };
            }
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

            const hon = causa.honorarios || {};
            const etapas = causa.etapasProcesales || [];
            _dcSyncLegacyDocumentos(causa);
            const docs = causa.documentos || [];
            const causaIdJs = JSON.stringify(String(causaId));

            // Contadores para badges
            const tareasPend = causa.tareas.filter(t => !t.done).length;
            const tareasTotal = causa.tareas.length;
            const movCount = causa.movimientos.length + docs.length;

            // Badge estado
            const badgeClass = causa.estadoGeneral === 'Finalizada' ? 'dc-badge-done'
                : causa.estadoGeneral === 'Suspendida' ? 'dc-badge-suspended'
                    : 'dc-badge-active';

            // Cliente asociado
            const cliente = DB.clientes.find(c => c.id === causa.clienteId);

            document.getElementById('modal-detalle-titulo').innerHTML = '';  // limpiamos title (usamos header interno)

            document.getElementById('modal-detalle-body').innerHTML = `

        <!-- ══ HEADER DE CAUSA ══ -->
        <div class="dc-header">
            <div class="dc-breadcrumb">
                <a href="#" data-dc-action="cerrar-modal-detalle"><i class="fas fa-home"></i> Inicio</a>
                <span class="bc-sep">/</span>
                <a href="#" data-dc-action="volver-listado-causas">Listado de Causas</a>
                <span class="bc-sep">/</span>
                <span class="bc-current">${escHtml(causa.caratula).substring(0, 40)}${causa.caratula.length > 40 ? '…' : ''}</span>
            </div>

            <div class="dc-title-row">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
                        <h2 class="dc-title">${escHtml(causa.caratula)}</h2>
                        <span class="dc-badge ${badgeClass}">${escHtml(causa.estadoGeneral || 'En tramitación')}</span>
                    </div>
                    <div class="dc-meta-row">
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">RIT / RUC</div>
                            <div class="dc-meta-value">${escHtml(causa.rit || causa.ruc || causa.rut || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Cliente</div>
                            <div class="dc-meta-value">${escHtml(cliente?.nombre || causa.cliente || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Procedimiento</div>
                            <div class="dc-meta-value">${escHtml(causa.tipoProcedimiento || '—')} ${esTramiteAdmin ? '<span class="badge badge-w" style="margin-left:6px; font-size:10px;">TRÁMITE</span>' : ''}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Instancia</div>
                            <div class="dc-meta-value">${escHtml(causa.instancia || 'Primera')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Último movimiento</div>
                            <div class="dc-meta-value">${causa.fechaUltimaActividad ? new Date(causa.fechaUltimaActividad).toLocaleDateString('es-CL') : '—'}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Avance</div>
                            <div class="dc-meta-value" style="color:#1a3a6b; font-family:'IBM Plex Mono',monospace;">${causa.porcentajeAvance || 0}%</div>
                        </div>
                    </div>
                    <div class="dc-avance-strip"><div class="dc-avance-fill" style="width:${causa.porcentajeAvance || 0}%"></div></div>
                </div>

                <div class="dc-actions">
                    ${causa.estadoGeneral !== 'Finalizada'
                    ? `<button class="dc-btn danger" data-dc-action="cerrar-causa" data-causa-id='${causaIdJs}'><i class="fas fa-lock"></i> Cerrar</button>`
                    : `<button class="dc-btn success" data-dc-action="reactivar-causa" data-causa-id='${causaIdJs}'><i class="fas fa-lock-open"></i> Reactivar</button>`}
                    <button class="dc-btn" data-dc-action="generar-contrato" data-causa-id='${causaIdJs}' title="Generar contrato de prestación de servicios">
                        <i class="fas fa-file-signature"></i> Generar Contrato
                    </button>
                    <button class="dc-btn" data-dc-action="exportar-pdf-causa" data-causa-id='${causaIdJs}'><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="dc-btn" data-dc-action="abrir-adjuntos" data-causa-id='${causaIdJs}' title="Archivos adjuntos">
                        <i class="fas fa-paperclip"></i> Adjuntos
                        <span style="background:rgba(255,255,255,0.3);border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${(causa.adjuntos||[]).length || 0}</span>
                    </button>
                    <button class="dc-btn" data-dc-action="abrir-lexbot" data-causa-id='${causaIdJs}' title="Consultar LexBot con contexto de esta causa"
                        style="background:linear-gradient(135deg,#0891b2,#0d5e8a);">
                        <i class="fas fa-robot"></i> LexBot
                    </button>
                    <button class="dc-btn" data-dc-action="exportar-pdf-pro" data-causa-id='${causaIdJs}' title="Generar informe PDF profesional">
                        <i class="fas fa-star"></i> PDF Pro
                    </button>
                    ${esTramiteAdmin ? '' : `<button class="dc-btn primary" data-dc-action="abrir-estrategia" data-causa-id='${causaIdJs}'>
                        <i class="fas fa-chess"></i> Estrategia
                    </button>`}
                </div>
            </div>
        </div>

        <!-- ══ LAYOUT: sidebar + tabs ══ -->
        <div class="dc-layout">

            <!-- ── SIDEBAR ── -->
            <div class="dc-sidebar">

                <!-- Bitácora de etapas -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header">
                        <span><i class="fas fa-list-check"></i> Etapas</span>
                    </div>
                    <div class="dc-sidebar-body">
                        ${esTramiteAdmin
                        ? '<p style="font-size:0.78rem; color:var(--text-3);">Trámite administrativo: no requiere etapas procesales judiciales.</p>'
                        : (etapas.length ? etapas.map((e, i) => `
                            <div class="dc-etapa-item ${e.completada ? 'done' : ''}"
                                 data-dc-action="marcar-etapa" data-causa-id='${causaIdJs}' data-idx="${i}" style="cursor:pointer;">
                                <div class="dc-etapa-check ${e.completada ? 'done' : ''}">
                                    ${e.completada ? '<i class="fas fa-check" style="font-size:0.55rem;"></i>' : ''}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div class="dc-etapa-nombre">${escHtml(e.nombre)}</div>
                                    ${e.fecha ? `<div style="font-size:0.65rem; color:var(--text-3); font-family:'IBM Plex Mono',monospace; margin-top:1px;">${new Date(e.fecha).toLocaleDateString('es-CL')}</div>` : ''}
                                </div>
                            </div>`).join('')
                    : '<p style="font-size:0.78rem; color:var(--text-3);">Sin etapas definidas.</p>')}
                    </div>
                </div>

                ${esTramiteAdmin ? '' : `<!-- Riesgo -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header">
                        <span><i class="fas fa-shield-alt"></i> Riesgo</span>
                    </div>
                    <div class="dc-sidebar-body">
                        ${Object.entries(causa.riesgo || {}).map(([k, v]) => {
                        const c = v === 'Alto' ? '#c0392b' : v === 'Medio' ? '#b45309' : '#0d7a5f';
                        return `<div class="dc-field">
                                <div class="dc-field-label">${k}</div>
                                <div class="dc-field-value" style="color:${c}; font-weight:700;">${v}</div>
                            </div>`;
                    }).join('') || '<p style="font-size:0.78rem; color:#94a3b8;">Sin evaluación.</p>'}
                    </div>
                </div>`}

                <!-- Acciones extra -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header"><span><i class="fas fa-bolt"></i> Acciones</span></div>
                    <div class="dc-sidebar-body" style="display:flex; flex-direction:column; gap:6px;">
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            data-dc-action="abrir-juris" data-causa-id='${causaIdJs}'>
                            <i class="fas fa-book"></i> Asociar jurisprudencia
                        </button>
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            data-dc-action="duplicar-causa" data-causa-id='${causaIdJs}'>
                            <i class="fas fa-copy"></i> Duplicar causa
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── PANEL PRINCIPAL CON TABS ── -->
            <div>
                <!-- Tabs bar -->
                <div class="dc-tabs-bar">
                    <button id="dctab-movimientos" class="dc-tab-btn active"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="movimientos">
                        <i class="fas fa-exchange-alt"></i> Movimientos
                        <span class="dc-tab-badge">${movCount}</span>
                    </button>
                    <button id="dctab-tareas" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="tareas">
                        <i class="fas fa-tasks"></i> Tareas
                        <span class="dc-tab-badge">${tareasPend > 0 ? `${tareasPend}/${tareasTotal}` : tareasTotal}</span>
                    </button>
                    <button id="dctab-partes" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="partes">
                        <i class="fas fa-users"></i> ${esTramiteAdmin ? 'Intervinientes' : 'Usuarios y partes'}
                    </button>
                    <button id="dctab-docs-cliente" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="docs-cliente">
                        <i class="fas fa-folder"></i> Docs Cliente
                    </button>
                    <button id="dctab-docs-tribunal" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="docs-tribunal">
                        <i class="fas fa-gavel"></i> ${esTramiteAdmin ? 'Docs Organismo' : 'Docs Tribunal'}
                    </button>
                    ${esTramiteAdmin ? '' : `<button id="dctab-docs-contraparte" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="docs-contraparte">
                        <i class="fas fa-user-shield"></i> Contraparte
                    </button>`}
                    ${esTramiteAdmin ? '' : `<button id="dctab-docs-tramites" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="docs-tramites">
                        <i class="fas fa-wrench"></i> Otros Trámites
                    </button>`}
                    ${esTramiteAdmin
                    ? `<button id="dctab-tramite" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="tramite">
                        <i class="fas fa-route"></i> Trámite
                    </button>`
                    : `<button id="dctab-proceso" class="dc-tab-btn"
                        data-dc-action="cambiar-tab" data-causa-id='${causaIdJs}' data-dc-tab="proceso">
                        <i class="fas fa-sitemap"></i> Proceso
                    </button>`}
                </div>

                <!-- Tab panels -->
                <div id="dcpanel-movimientos"   class="dc-tab-panel active"></div>
                <div id="dcpanel-tareas"         class="dc-tab-panel"></div>
                <div id="dcpanel-partes"         class="dc-tab-panel"></div>
                <div id="dcpanel-docs-cliente"   class="dc-tab-panel"></div>
                <div id="dcpanel-docs-tribunal"  class="dc-tab-panel"></div>
                ${esTramiteAdmin ? '' : '<div id="dcpanel-docs-contraparte"  class="dc-tab-panel"></div>'}
                ${esTramiteAdmin ? '' : '<div id="dcpanel-docs-tramites"  class="dc-tab-panel"></div>'}
                ${esTramiteAdmin
                ? '<div id="dcpanel-tramite" class="dc-tab-panel"></div>'
                : '<div id="dcpanel-proceso" class="dc-tab-panel"></div>'}
            </div>
        </div>
    `;
            abrirModal('modal-detalle');

            // Render tab inicial
            const tieneAudienciasIA = !esTramiteAdmin
                && !!causa?.audiencias?.habilitado
                && Array.isArray(causa?.eventosProcesalesIA)
                && causa.eventosProcesalesIA.some(ev => String(ev?.tipo || '').toLowerCase() === 'audiencia');
            dcCambiarTab(tieneAudienciasIA ? 'proceso' : 'movimientos', causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 1: MOVIMIENTOS + DOCUMENTOS (timeline unificado)
        // ════════════════════════════════════════════════════════
        function dcRenderMovimientos(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-movimientos');
            if (!el) return;
            try { dcEnsureMovNormalizeCss(); } catch (_) {}
            const esTramiteAdmin = _dcEsTramiteAdmin(causa);
            const catalogoOrg = _dcGetCatalogoOrganismos();
            const orgActual = causa.tramiteMeta?.organismo || catalogoOrg[0]?.key || 'OTRO';
            const tiposActuales = (catalogoOrg.find(o => o.key === orgActual)?.tipos || ['Trámite administrativo']);
            const tipoActual = causa.tramiteMeta?.tipoTramite || tiposActuales[0] || 'Trámite administrativo';

            const movs = (causa.movimientos || []).map((m, i) => ({ ...m, _origen: 'mov', _idx: i }));
            const docs = _dcGetDocsUnificados(causa).map(d => ({
                id: d.id, nombre: d.nombreOriginal || 'Documento',
                fecha: d.fechaDocumento, tipo: d.tipo || 'Documento',
                cuaderno: d.cuaderno || 'Principal', etapa: d.etapaVinculada || '—',
                folio: d.folio || '—', _origen: 'doc'
            }));
            const todos = [...movs, ...docs].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            el.innerHTML = `
            <div class="dc-mov-toolbar">
                <input class="dc-search-mov" id="dc-search-mov-${causaId}"
                    placeholder="${esTramiteAdmin ? 'Buscar gestiones o hitos...' : 'Buscar movimientos...'}" data-dc-mov-filter="${causaId}">
                ${esTramiteAdmin ? '' : `<select class="dc-cuaderno-sel" id="dc-cuaderno-${causaId}"
                    data-dc-mov-filter="${causaId}">
                    <option value="">Todos los cuadernos</option>
                    <option>Principal</option>
                    <option>Reconvencional</option>
                    <option>Incidental</option>
                </select>`}
                <span class="dc-mov-count" id="dc-mov-count-${causaId}">${todos.length} ${esTramiteAdmin ? 'evento' : 'movimiento'}${todos.length !== 1 ? 's' : ''}</span>
            </div>
            <div id="dc-doc-drop-${causaId}" style="margin:0 0 14px; padding:12px; border:1px dashed var(--border,#334155); border-radius:12px; background:var(--bg-2,#0b1220);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
                    <div style="font-weight:800; font-size:0.9rem; color:var(--text-1,#e2e8f0);">Gestión de Documentos e IA</div>
                    <button type="button" class="btn" style="padding:7px 10px;" data-dc-action="dc-doc-open" data-causa-id="${causaId}">Subir archivo</button>
                </div>
                <div id="dc-doc-dropzone-${causaId}" style="border:1px dashed var(--border,#334155); border-radius:10px; padding:14px; text-align:center; color:var(--text-3,#94a3b8); background:rgba(2,6,23,.25);">
                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-2,#cbd5e1);">Arrastra y suelta un archivo</div>
                    <div style="font-size:0.74rem; margin-top:4px;">PDF, DOCX, JPG, PNG</div>
                    <input id="dc-doc-file-${causaId}" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" style="display:none;" />
                </div>
                <div id="dc-doc-form-${causaId}" style="display:none; margin-top:12px;">
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:220px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Archivo</div>
                            <div id="dc-doc-filename-${causaId}" style="padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0); font-size:0.82rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
                        </div>
                        <div style="width:170px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Fecha</div>
                            <input id="dc-doc-fecha-${causaId}" type="date" style="width:100%; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);" />
                        </div>
                        <div style="width:190px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Tipo sugerido</div>
                            <select id="dc-doc-tipo-${causaId}" style="width:100%; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);">
                                <option>Escrito</option>
                                <option>Resolución</option>
                                <option>Notificación</option>
                                <option>Audiencia</option>
                                <option>Sentencia</option>
                                <option>Otro</option>
                            </select>
                        </div>
                        <div style="width:190px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Cuaderno</div>
                            <select id="dc-doc-cuaderno-${causaId}" style="width:100%; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);">
                                <option>Principal</option>
                                <option>Reconvencional</option>
                                <option>Incidental</option>
                            </select>
                        </div>
                        <div style="width:140px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Folio</div>
                            <input id="dc-doc-folio-${causaId}" type="text" placeholder="Ej: 123" style="width:100%; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);" />
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:flex-start;">
                        <div style="flex:1; min-width:320px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Descripción (opcional)</div>
                            <textarea id="dc-doc-desc-${causaId}" rows="2" style="width:100%; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0); line-height:1.25; resize:vertical;"></textarea>
                        </div>
                        <div style="width:260px;">
                            <div style="font-size:0.72rem; font-weight:800; color:var(--text-3,#94a3b8); margin-bottom:6px;">Plazo (heurístico)</div>
                            <label style="display:flex; gap:8px; align-items:center; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);">
                                <input id="dc-doc-gplazo-${causaId}" type="checkbox" />
                                <span style="font-size:0.82rem;">Genera plazo</span>
                            </label>
                            <div style="display:flex; gap:8px; margin-top:8px;">
                                <input id="dc-doc-dias-${causaId}" type="number" min="0" placeholder="días" style="flex:1; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);" />
                                <input id="dc-doc-venc-${causaId}" type="date" style="flex:1; padding:9px 10px; border:1px solid var(--border,#334155); border-radius:10px; background:var(--bg-1,#0f172a); color:var(--text-1,#e2e8f0);" />
                            </div>
                        </div>
                    </div>
                    <div id="dc-doc-status-${causaId}" style="display:none; margin-top:10px; padding:10px; border-radius:10px; font-size:0.8rem;"></div>
                    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                        <button type="button" class="btn" style="padding:8px 12px;" data-dc-action="dc-doc-cancel" data-causa-id="${causaId}">Cancelar</button>
                        <button type="button" class="btn btn-p" style="padding:8px 12px;" data-dc-action="dc-doc-save" data-causa-id="${causaId}">Guardar documento</button>
                    </div>
                </div>
            </div>
            <div id="dc-mov-list-${causaId}">
                ${dcMovHtml(todos, causaId)}
            </div>
            ${causa.estadoGeneral !== 'Finalizada' ? `
            <div style="margin-top:14px; padding-top:14px; border-top:1px dashed #e4eaf3; display:flex; gap:8px; align-items:stretch;">
                <textarea id="dc-new-mov-nombre-${causaId}" rows="1" placeholder="${esTramiteAdmin ? 'Detalle del ingreso/gestión (opcional)' : 'Nombre del movimiento...'}"
                    style="flex:1; height:44px; min-height:44px; max-height:160px; padding:10px 10px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.85rem; font-family:'IBM Plex Sans',sans-serif; line-height:1.15; resize:none; overflow:hidden;"
                    oninput="this.style.height='44px'; this.style.height=(this.scrollHeight)+'px';"></textarea>
                ${esTramiteAdmin ? `<select id="dc-tram-org-${causaId}" data-dc-tram-org="${causaId}"
                    style="min-width:190px; padding:7px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc;">
                    ${catalogoOrg.map(o => `<option value="${o.key}" ${o.key === orgActual ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('')}
                </select>
                <select id="dc-tram-tipo-${causaId}"
                    style="min-width:220px; padding:7px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc;">
                    ${tiposActuales.map(t => `<option value="${escHtml(t)}" ${t === tipoActual ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
                </select>` : ''}
                <select id="dc-new-mov-tipo-${causaId}"
                    style="height:44px; padding:7px 10px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.8rem; background:#f8fafc;">
                    ${esTramiteAdmin
                    ? '<option>Ingreso</option><option>Reparo</option><option>Subsanación</option><option>Respuesta organismo</option><option>Resolución</option><option>Otro</option>'
                    : '<option>Resolución</option><option>Escrito</option><option>Notificación</option><option>Audiencia</option><option>Sentencia</option><option>Otro</option>'}
                </select>
                <button class="dc-btn primary" style="height:44px; white-space:nowrap;" data-dc-action="agregar-movimiento" data-causa-id="${causaId}">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>` : ''}`;

            try {
                dcDocsInitUploadUI(causaId);
            } catch (_) {}

            try {
                requestAnimationFrame(() => {
                    try { dcFixMovEntryLayout(causaId); } catch (_) {}
                    setTimeout(() => { try { dcFixMovEntryLayout(causaId); } catch (_) {} }, 0);
                });
            } catch (_) {}
        }

        function dcFixMovEntryLayout(causaId) {
            const ta = document.getElementById(`dc-new-mov-nombre-${causaId}`);
            const sel = document.getElementById(`dc-new-mov-tipo-${causaId}`);
            const btn = document.querySelector(`#dcpanel-movimientos button[data-dc-action="agregar-movimiento"][data-causa-id="${CSS.escape(String(causaId))}"]`);
            const row = ta ? ta.closest('div') : null;

            if (row && row.style) {
                row.style.setProperty('display', 'flex', 'important');
                row.style.setProperty('gap', '8px', 'important');
                row.style.setProperty('align-items', 'stretch', 'important');
            }

            const setBase = (el, extra) => {
                if (!el || !el.style) return;
                el.style.setProperty('box-sizing', 'border-box', 'important');
                el.style.setProperty('height', '44px', 'important');
                el.style.setProperty('min-height', '44px', 'important');
                el.style.setProperty('line-height', '1.15', 'important');
                if (extra) {
                    for (const [k, v] of Object.entries(extra)) {
                        el.style.setProperty(k, v, 'important');
                    }
                }
            };

            setBase(ta, {
                'flex': '1 1 auto',
                'width': 'auto',
                'padding': '10px 10px',
                'overflow': 'hidden',
                'resize': 'none'
            });
            setBase(sel, {
                'flex': '0 0 220px',
                'width': '220px',
                'min-width': '220px',
                'padding': '7px 10px',
                'line-height': '1'
            });
            setBase(btn, {
                'flex': '0 0 110px',
                'width': '110px',
                'padding': '0 12px',
                'white-space': 'nowrap',
                'justify-content': 'center'
            });
        }

        function dcEnsureMovNormalizeCss() {
            const id = 'dc-mov-normalize-style';
            if (document.getElementById(id)) return;
            const st = document.createElement('style');
            st.id = id;
            st.textContent = `
#dcpanel-movimientos textarea[id^="dc-new-mov-nombre-"],
#dcpanel-movimientos select[id^="dc-new-mov-tipo-"],
#dcpanel-movimientos button.dc-btn.primary[data-dc-action="agregar-movimiento"]{box-sizing:border-box!important;}

#dcpanel-movimientos textarea[id^="dc-new-mov-nombre-"]{height:44px!important;min-height:44px!important;line-height:1.15!important;padding:10px 10px!important;border-width:1px!important;}
#dcpanel-movimientos select[id^="dc-new-mov-tipo-"]{height:44px!important;line-height:1!important;padding:7px 10px!important;border-width:1px!important;appearance:auto!important;-webkit-appearance:menulist!important;}
#dcpanel-movimientos button.dc-btn.primary[data-dc-action="agregar-movimiento"]{height:44px!important;line-height:1!important;padding:0 12px!important;border-width:1px!important;}
`;
            document.head.appendChild(st);
        }

        const _dcDocsUploadState = {
            files: {},
            extractedText: {},
            analysis: {}
        };

        function dcDocsInitUploadUI(causaId) {
            const dz = document.getElementById(`dc-doc-dropzone-${causaId}`);
            const inp = document.getElementById(`dc-doc-file-${causaId}`);
            if (!dz || !inp) return;

            const setDz = (active) => {
                dz.style.borderColor = active ? 'var(--cyan,#06b6d4)' : 'var(--border,#334155)';
                dz.style.background = active ? 'rgba(6,182,212,.08)' : 'rgba(2,6,23,.25)';
            };

            dz.addEventListener('click', () => inp.click());
            dz.addEventListener('dragover', (e) => { e.preventDefault(); setDz(true); });
            dz.addEventListener('dragleave', (e) => { e.preventDefault(); setDz(false); });
            dz.addEventListener('drop', (e) => {
                e.preventDefault();
                setDz(false);
                const f = e.dataTransfer?.files?.[0];
                if (f) dcDocsHandleFile(causaId, f);
            });
            inp.addEventListener('change', (e) => {
                const f = e.target?.files?.[0];
                if (f) dcDocsHandleFile(causaId, f);
            });

            const hoy = new Date().toISOString().slice(0, 10);
            const fechaEl = document.getElementById(`dc-doc-fecha-${causaId}`);
            if (fechaEl && !fechaEl.value) fechaEl.value = hoy;
        }

        function dcDocsSetStatus(causaId, kind, text) {
            const el = document.getElementById(`dc-doc-status-${causaId}`);
            if (!el) return;
            const css = {
                loading: 'display:block;background:rgba(59,130,246,.10);border:1px solid rgba(59,130,246,.35);color:var(--text-1,#e2e8f0);',
                success: 'display:block;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.35);color:var(--text-1,#e2e8f0);',
                warning: 'display:block;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.35);color:var(--text-1,#e2e8f0);',
                error: 'display:block;background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.35);color:var(--text-1,#e2e8f0);'
            };
            el.style.cssText = `${css[kind] || css.loading} padding:10px;border-radius:10px;font-size:.8rem;line-height:1.4;`;
            el.textContent = String(text || '');
        }

        async function dcDocsHandleFile(causaId, file) {
            const okExt = /\.(pdf|docx|jpe?g|png)$/i.test(String(file?.name || ''));
            const okMime = /pdf|wordprocessingml\.document|image\/(jpeg|png)/i.test(String(file?.type || ''));
            if (!okExt && !okMime) {
                dcDocsSetStatus(causaId, 'error', 'Formato no soportado. Sube PDF, DOCX, JPG o PNG.');
                return;
            }
            if (file.size > 15 * 1024 * 1024) {
                dcDocsSetStatus(causaId, 'error', 'El archivo supera los 15MB.');
                return;
            }

            _dcDocsUploadState.files[causaId] = file;
            _dcDocsUploadState.extractedText[causaId] = '';
            _dcDocsUploadState.analysis[causaId] = null;

            const form = document.getElementById(`dc-doc-form-${causaId}`);
            const fn = document.getElementById(`dc-doc-filename-${causaId}`);
            if (fn) fn.textContent = String(file.name || '');
            if (form) form.style.display = 'block';

            dcDocsSetStatus(causaId, 'loading', 'Pre-clasificando documento...');

            let texto = '';
            try {
                if (/\.pdf$/i.test(file.name) || /pdf/i.test(file.type)) {
                    texto = await dcDocsExtractTextFromPdf(file);
                } else if (/\.docx$/i.test(file.name) || /wordprocessingml\.document/i.test(file.type)) {
                    texto = await dcDocsExtractTextFromDocx(file);
                } else if (/\.(png|jpe?g)$/i.test(file.name) || /image\/(jpeg|png)/i.test(file.type)) {
                    texto = await dcDocsExtractTextFromImage(file, causaId);
                }
            } catch (_) {
                texto = '';
            }

            _dcDocsUploadState.extractedText[causaId] = texto;
            const analysis = dcDocsHeuristicAnalyze({
                filename: String(file.name || ''),
                text: String(texto || '')
            });
            _dcDocsUploadState.analysis[causaId] = analysis;

            dcDocsApplySuggestions(causaId, analysis);

            if (analysis?.plazo?.dias && analysis.plazo.dias > 0) {
                dcDocsSetStatus(causaId, 'success', `Sugerencias listas. Se detectó plazo: ${analysis.plazo.dias} día(s).`);
            } else {
                dcDocsSetStatus(causaId, 'success', 'Sugerencias listas. Revisa y guarda.');
            }
        }

        async function dcDocsExtractTextFromDocx(file) {
            const ab = await file.arrayBuffer();
            if (!window.mammoth) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/mammoth/mammoth.browser.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
            return String(result?.value || '').trim();
        }

        async function dcDocsExtractTextFromImage(file, causaId) {
            if (file.size > 8 * 1024 * 1024) return '';
            if (!window.Tesseract) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            dcDocsSetStatus(causaId, 'loading', 'OCR en progreso (imagen)...');
            const { data } = await window.Tesseract.recognize(file, 'spa', {
                logger: (m) => {
                    try {
                        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                            const pct = Math.round(m.progress * 100);
                            dcDocsSetStatus(causaId, 'loading', `OCR en progreso (imagen)... ${pct}%`);
                        }
                    } catch (_) {}
                }
            });
            return String(data?.text || '').trim();
        }

        async function dcDocsDeepAnalyzeWithProvider(_input) {
            return null;
        }

        async function dcDocsExtractTextFromPdf(file) {
            const ab = await file.arrayBuffer();
            const bytes = new Uint8Array(ab);
            if (!window.pdfjsLib) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
            let out = '';
            const maxPages = Math.min(pdf.numPages, 10);
            for (let p = 1; p <= maxPages; p++) {
                const page = await pdf.getPage(p);
                const content = await page.getTextContent();
                out += content.items.map(i => i.str).join(' ') + '\n';
            }
            return out.trim();
        }

        function dcDocsHeuristicAnalyze({ filename, text }) {
            const src = `${String(filename || '')}\n${String(text || '')}`.toUpperCase();

            const score = {
                escrito: 0,
                resolucion: 0,
                notificacion: 0,
                audiencia: 0,
                sentencia: 0
            };

            const rx = {
                resol: /(RESUELVO|SE RESUELVE|VISTOS|TENIENDO PRESENTE|RESOLUCI[ÓO]N)/,
                notif: /(NOTIF[IÍ]QUESE|NOTIFICACI[ÓO]N|C[ÉE]DULA|POR EL ESTADO DIARIO|SE NOTIFICA)/,
                escrito: /(EN LO PRINCIPAL|PRIMER OTROS[IÍ]|SEGUNDO OTROS[IÍ]|TERCER OTROS[IÍ]|CUARTO OTROS[IÍ]|A S\.S\.|S\.S\.|S\.S\.A\.|SE[ÑN]OR JUEZ|SOLICITO|SOLICITA|VENGO EN|POR TANTO)/,
                audiencia: /(AUDIENCIA|CITACI[ÓO]N A AUDIENCIA|COMPARECENCIA)/,
                sentencia: /(SENTENCIA DEFINITIVA|SE ACOGE|SE RECHAZA|SE CONDENA|FALLO)/,
                contesta: /(CONTESTA\s+DEMANDA|VENGO\s+EN\s+CONTESTAR|CONTESTACI[ÓO]N\s+DE\s+DEMANDA|EVAC[ÚU]A\s+TRASLADO|EVACUAR\s+TRASLADO|TRASLADO\s+CONFERIDO|DENTRO\s+DE\s+PLAZO\s+VENGO\s+EN\s+CONTESTAR)/
            };

            if (rx.sentencia.test(src)) score.sentencia += 6;
            if (rx.audiencia.test(src)) score.audiencia += 5;

            if (rx.escrito.test(src)) score.escrito += 4;
            if (rx.contesta.test(src)) score.escrito += 6;

            if (rx.resol.test(src)) score.resolucion += 3;
            if (rx.notif.test(src)) score.notificacion += 2;

            if (/\.PDF\b/.test(src)) score.escrito += 0;
            if (/(CONTESTA|CONTESTACI[ÓO]N|TRASLADO|DEMANDA)/.test(src)) score.escrito += 2;
            if (/(RESOLUCI[ÓO]N|AUTOS|PROVIDENCIA)/.test(src)) score.resolucion += 1;
            if (/(C[ÉE]DULA|NOTIF)/.test(src)) score.notificacion += 1;

            let tipo = 'Otro';
            const pairs = [
                { k: 'sentencia', t: 'Sentencia', s: score.sentencia },
                { k: 'audiencia', t: 'Audiencia', s: score.audiencia },
                { k: 'escrito', t: 'Escrito', s: score.escrito },
                { k: 'resolucion', t: 'Resolución', s: score.resolucion },
                { k: 'notificacion', t: 'Notificación', s: score.notificacion }
            ].sort((a, b) => b.s - a.s);

            if (pairs[0] && pairs[0].s >= 3) tipo = pairs[0].t;

            let etapaVinculada = '';
            if (rx.contesta.test(src)) etapaVinculada = 'Contestación';
            else if (/DEMANDA\b/.test(src) && tipo === 'Escrito') etapaVinculada = 'Demanda';

            let cuaderno = 'Principal';
            if (/RECONVENC/.test(src)) cuaderno = 'Reconvencional';
            if (/INCIDENTAL|INCIDENTE/.test(src)) cuaderno = 'Incidental';

            let folio = '';
            const mFolio = src.match(/FOLIO\s*[:#-]?\s*(\d{1,6})/);
            if (mFolio && mFolio[1]) folio = mFolio[1];

            const plazo = dcDocsExtractPlazo(src);

            return {
                tipo,
                cuaderno,
                folio,
                plazo,
                etapaVinculada,
                provider: 'heuristica',
                confidence: (tipo === 'Otro') ? 0.35 : 0.72,
                deepAnalysisReady: true
            };
        }

        function dcDocsExtractPlazo(src) {
            const s = String(src || '');

            const mNumeroDias = s.match(/DENTRO\s+DE\s+(\d{1,2})\s+D[IÍ]A(S)?/);
            if (mNumeroDias && mNumeroDias[1]) return { dias: parseInt(mNumeroDias[1], 10) || 0, raw: mNumeroDias[0] };

            const mDiasSimples = s.match(/(\d{1,2})\s+D[IÍ]A(S)?\s+(H[ÁA]BIL(ES)?|CORRIDO(S)?)/);
            if (mDiasSimples && mDiasSimples[1]) return { dias: parseInt(mDiasSimples[1], 10) || 0, raw: mDiasSimples[0] };

            if (/QUINTO\s+D[IÍ]A/.test(s)) return { dias: 5, raw: 'QUINTO DÍA' };
            if (/TERCER\s+D[IÍ]A/.test(s)) return { dias: 3, raw: 'TERCER DÍA' };
            if (/FATAL/.test(s)) return { dias: 3, raw: 'FATAL' };

            return { dias: 0, raw: null };
        }

        function dcDocsApplySuggestions(causaId, analysis) {
            const tipoEl = document.getElementById(`dc-doc-tipo-${causaId}`);
            const cuaEl = document.getElementById(`dc-doc-cuaderno-${causaId}`);
            const folEl = document.getElementById(`dc-doc-folio-${causaId}`);
            const chk = document.getElementById(`dc-doc-gplazo-${causaId}`);
            const diasEl = document.getElementById(`dc-doc-dias-${causaId}`);
            const vencEl = document.getElementById(`dc-doc-venc-${causaId}`);
            const descEl = document.getElementById(`dc-doc-desc-${causaId}`);

            if (tipoEl && analysis?.tipo) tipoEl.value = analysis.tipo;
            if (cuaEl && analysis?.cuaderno) cuaEl.value = analysis.cuaderno;
            if (folEl && analysis?.folio) folEl.value = analysis.folio;

            const dias = Number(analysis?.plazo?.dias || 0);
            if (chk) chk.checked = dias > 0;
            if (diasEl) diasEl.value = dias > 0 ? String(dias) : '';

            const fechaDoc = document.getElementById(`dc-doc-fecha-${causaId}`)?.value;
            if (vencEl && fechaDoc && dias > 0) {
                const base = new Date(`${fechaDoc}T12:00:00`);
                base.setDate(base.getDate() + dias);
                vencEl.value = base.toISOString().slice(0, 10);
            }

            if (descEl && analysis?.etapaVinculada) {
                const existing = String(descEl.value || '').trim();
                if (!existing) descEl.value = `Etapa sugerida: ${analysis.etapaVinculada}`;
            }
        }

        function dcDocsClearForm(causaId) {
            const form = document.getElementById(`dc-doc-form-${causaId}`);
            const fileInp = document.getElementById(`dc-doc-file-${causaId}`);
            const status = document.getElementById(`dc-doc-status-${causaId}`);
            if (fileInp) fileInp.value = '';
            if (form) form.style.display = 'none';
            if (status) status.style.display = 'none';
            _dcDocsUploadState.files[causaId] = null;
            _dcDocsUploadState.extractedText[causaId] = '';
            _dcDocsUploadState.analysis[causaId] = null;
        }

        function _dcDocsFileToBase64(file) {
            return new Promise((resolve, reject) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = String(reader.result || '');
                        const b64 = res.includes(',') ? (res.split(',')[1] || '') : res;
                        resolve(b64);
                    };
                    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
                    reader.readAsDataURL(file);
                } catch (e) {
                    reject(e);
                }
            });
        }

        async function dcDocsGuardarDocumento(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;

            const file = _dcDocsUploadState.files[causaId];
            if (!file) {
                dcDocsSetStatus(causaId, 'error', 'Primero sube un archivo.');
                return;
            }

            const fecha = (document.getElementById(`dc-doc-fecha-${causaId}`)?.value || '').trim();
            const tipo = (document.getElementById(`dc-doc-tipo-${causaId}`)?.value || 'Documento').trim();
            const cuaderno = (document.getElementById(`dc-doc-cuaderno-${causaId}`)?.value || 'Principal').trim();
            const folio = (document.getElementById(`dc-doc-folio-${causaId}`)?.value || '').trim() || '—';
            const desc = (document.getElementById(`dc-doc-desc-${causaId}`)?.value || '').trim();
            const generaPlazo = !!document.getElementById(`dc-doc-gplazo-${causaId}`)?.checked;
            const diasPlazo = parseInt(document.getElementById(`dc-doc-dias-${causaId}`)?.value || '0', 10) || 0;
            const fechaVenc = (document.getElementById(`dc-doc-venc-${causaId}`)?.value || '').trim();

            if (!fecha) {
                dcDocsSetStatus(causaId, 'error', 'Ingresa la fecha del documento.');
                return;
            }

            dcDocsSetStatus(causaId, 'loading', 'Guardando documento...');

            let base64 = null;
            try {
                base64 = await _dcDocsFileToBase64(file);
            } catch (_) {
                base64 = null;
            }

            const analysis = _dcDocsUploadState.analysis[causaId] || null;
            const etapaSug = (analysis && analysis.etapaVinculada) ? String(analysis.etapaVinculada) : '';
            const extractedText = String(_dcDocsUploadState.extractedText[causaId] || '');

            const doc = {
                id: generarID(),
                nombreOriginal: String(file.name || 'Documento'),
                nombre: String(file.name || 'Documento'),
                tipo,
                etapaVinculada: etapaSug,
                fechaDocumento: fecha,
                cuaderno,
                folio,
                descripcion: desc,
                generaPlazo: generaPlazo && diasPlazo > 0 && !!fechaVenc,
                diasPlazo: diasPlazo,
                fechaVencimiento: (generaPlazo && diasPlazo > 0 && fechaVenc) ? fechaVenc : null,
                archivoMime: String(file.type || ''),
                archivoNombre: String(file.name || ''),
                archivoBase64: base64
            };

            try {
                if (!_dcEsTramiteAdmin(causa)) {
                    const propuesta = dcDocsExtraerPropuestaPartesDesdeTexto({
                        filename: String(file.name || ''),
                        text: extractedText,
                        tipo: tipo,
                        etapa: etapaSug
                    });
                    if (propuesta && typeof propuesta === 'object') {
                        if (!causa.iaSugerencias || typeof causa.iaSugerencias !== 'object') causa.iaSugerencias = {};
                        causa.iaSugerencias.ultimaFuente = String(file.name || '') || null;
                        causa.iaSugerencias.ultimoAnalisis = new Date().toISOString();
                        causa.iaSugerencias.extraer = propuesta;
                    }
                }
            } catch (_) {}

            if (!Array.isArray(causa.docsTribunal)) causa.docsTribunal = [];
            if (!Array.isArray(causa.docsTramites)) causa.docsTramites = [];
            const destCampo = _dcEsTramiteAdmin(causa) ? 'docsTramites' : 'docsTribunal';
            causa[destCampo].push(doc);

            if (!Array.isArray(causa.movimientos)) causa.movimientos = [];
            const movLabel = doc.etapaVinculada ? `${tipo} (${doc.etapaVinculada})` : tipo;
            causa.movimientos.push({
                id: generarID(),
                nombre: `${movLabel}: ${String(file.name || 'Documento')}`,
                tipo,
                fecha: fecha,
                cuaderno: cuaderno || 'Principal',
                etapa: '',
                folio: folio || '—',
                docId: doc.id
            });

            causa.fechaUltimaActividad = new Date().toISOString();
            _dcSyncLegacyDocumentos(causa);
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();

            if (doc.generaPlazo && doc.fechaVencimiento && typeof crearAlerta === 'function') {
                try {
                    crearAlerta({
                        causaId,
                        tipo: 'plazo',
                        mensaje: `Plazo de ${doc.diasPlazo} días: "${doc.nombreOriginal}" — ${causa.caratula}`,
                        prioridad: 'alta',
                        fechaObjetivo: doc.fechaVencimiento
                    });
                } catch (_) {}
            }

            dcDocsSetStatus(causaId, 'success', 'Documento guardado y vinculado al movimiento.');
            dcDocsClearForm(causaId);
            abrirDetalleCausa(causaId);
            setTimeout(() => dcCambiarTab('movimientos', causaId), 50);
        }

        function dcDocsExtraerPropuestaPartesDesdeTexto(input) {
            try {
                const filename = String(input?.filename || '');
                const raw = String(input?.text || '');
                const src = `${filename}\n${raw}`.replace(/\r/g, '');
                const up = src.toUpperCase();

                const out = {
                    tribunal: null,
                    rolRit: null,
                    juez: null,
                    admisibilidad: null,
                    partes: {
                        demandante: null,
                        demandado: null,
                        abogadoDemandante: null,
                        abogadoDemandado: null
                    },
                    rut: {
                        demandante: null,
                        demandado: null
                    },
                    domicilio: {
                        demandante: null,
                        demandado: null
                    }
                };

                const _clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
                const _cap = (s, n) => {
                    const v = _clean(s);
                    return v.length > n ? v.slice(0, n) : v;
                };
                const _pickRut = (s) => {
                    const m = String(s || '').match(/\b(\d{1,2}\.\d{3}\.\d{3}\-[0-9Kk]|\d{7,8}\-[0-9Kk])\b/);
                    return m && m[1] ? _clean(m[1]) : null;
                };
                const _pickDom = (s) => {
                    const m = String(s || '').match(/\bDOMICILIO\b\s*[:\-]?\s*([^\n]{10,180})/i)
                        || String(s || '').match(/\bDOMICILIAD[OA]\b\s*(?:EN)?\s*([^,\n]{10,180})/i);
                    return m && m[1] ? _cap(m[1], 160) : null;
                };

                const mTrib = src.match(/(\d{1,2}\s*(?:°|\b)\s*)?JUZGADO\s+[A-ZÁÉÍÓÚÑ ]{3,120}?\s+DE\s+[A-ZÁÉÍÓÚÑ ]{3,80}/i)
                    || src.match(/CORTE\s+(?:SUPREMA|DE\s+APELACIONES)\s+DE\s+[A-ZÁÉÍÓÚÑ ]{3,80}/i);
                if (mTrib && mTrib[0]) out.tribunal = _clean(mTrib[0]);

                const mRol = src.match(/\b(RIT|ROL)\s*[:#-]?\s*([A-Z]{1,3}\-?\d{1,6}\-\d{4})\b/i)
                    || src.match(/\b([A-Z]{1,3}\-?\d{1,6}\-\d{4})\b/);
                if (mRol && (mRol[2] || mRol[1])) out.rolRit = _clean(mRol[2] || mRol[1]);

                const mJuez = src.match(/JUEZ(?:A)?\s*(?:TITULAR)?\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\.]{6,80})/i)
                    || src.match(/MINISTRO\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\.]{6,80})/i);
                if (mJuez && mJuez[1]) out.juez = _clean(mJuez[1]);

                if (/NO\s+HA\s+LUGAR|NO\s+SE\s+DA\s+CURSO|NO\s+ADMITE/.test(up)) out.admisibilidad = 'No admite';
                else if (/SUBSANE|SUBSANAR|ACOMPA\u00d1E/.test(up)) out.admisibilidad = 'Subsanar';
                else if (/ADM\b|SE\s+ADMITE|ADMIT[EI]DA|T\u00c9NGASE\s+POR\s+INTERPUESTA|PROVE[ER]SE/.test(up) && /DEMANDA/.test(up)) out.admisibilidad = 'Admite';

                const rxDem = /(DEMANDANTE|DEMANDANTES)\s*[:\-]\s*(.+)/i;
                const rxDed = /(DEMANDADO|DEMANDADOS)\s*[:\-]\s*(.+)/i;
                const mDem = src.match(rxDem);
                const mDed = src.match(rxDed);
                if (mDem && mDem[2]) out.partes.demandante = _cap(mDem[2], 140);
                if (mDed && mDed[2]) out.partes.demandado = _cap(mDed[2], 140);

                const mBloque = src.match(/\bMATERIA\b[\s\S]{0,1200}?\bDEMANDANTE\b[\s\S]{0,800}?\bDEMANDAD[AO]\b[\s\S]{0,800}?(?=\n\s*EN\s+LO\s+PRINCIPAL|\n\s*S\.J\.L\.|\n\s*S\.S\.|$)/i);
                if (mBloque && mBloque[0]) {
                    const bloque = mBloque[0];
                    const dm = bloque.match(/\bDEMANDANTE\b\s*[:\-]?\s*([^\n]{3,160})/i);
                    const dd = bloque.match(/\bDEMANDAD[AO]\b\s*[:\-]?\s*([^\n]{3,160})/i);
                    if (!out.partes.demandante && dm && dm[1]) out.partes.demandante = _cap(dm[1], 140);
                    if (!out.partes.demandado && dd && dd[1]) out.partes.demandado = _cap(dd[1], 140);

                    const rutDte = bloque.match(/\bDEMANDANTE\b[\s\S]{0,120}?\bRUT\b\s*[:\-]?\s*([^\n]{3,30})/i);
                    const rutDdo = bloque.match(/\bDEMANDAD[AO]\b[\s\S]{0,120}?\bRUT\b\s*[:\-]?\s*([^\n]{3,30})/i);
                    if (!out.rut.demandante && rutDte && rutDte[1]) out.rut.demandante = _pickRut(rutDte[1]);
                    if (!out.rut.demandado && rutDdo && rutDdo[1]) out.rut.demandado = _pickRut(rutDdo[1]);

                    const domDte = bloque.match(/\bDEMANDANTE\b[\s\S]{0,200}?\bDOMICILIO\b\s*[:\-]?\s*([^\n]{10,180})/i);
                    const domDdo = bloque.match(/\bDEMANDAD[AO]\b[\s\S]{0,200}?\bDOMICILIO\b\s*[:\-]?\s*([^\n]{10,180})/i);
                    if (!out.domicilio.demandante && domDte && domDte[1]) out.domicilio.demandante = _cap(domDte[1], 160);
                    if (!out.domicilio.demandado && domDdo && domDdo[1]) out.domicilio.demandado = _cap(domDdo[1], 160);
                }

                if (!out.partes.demandante) {
                    const m = src.match(/COMPARECE\s*[:\-]?\s*([^\n]{10,160})/i);
                    if (m && m[1]) out.partes.demandante = _clean(m[1]).slice(0, 120);
                }

                if (!out.partes.demandado) {
                    const m = src.match(/\bEN\s+CONTRA\s+DE\s+([^,\n]{6,160})/i);
                    if (m && m[1]) out.partes.demandado = _cap(m[1], 140);
                }

                if (!out.partes.demandante) {
                    const m = src.match(/\b([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{10,120}),\s*c[ée]dula\s+(?:de\s+identidad|nacional\s+de\s+identidad)/i);
                    if (m && m[1]) out.partes.demandante = _cap(m[1], 140);
                }

                if (!out.rut.demandante && out.partes.demandante) {
                    const idx = up.indexOf(String(out.partes.demandante).toUpperCase());
                    if (idx >= 0) {
                        const frag = src.slice(idx, idx + 300);
                        out.rut.demandante = _pickRut(frag) || out.rut.demandante;
                        out.domicilio.demandante = _pickDom(frag) || out.domicilio.demandante;
                    }
                }
                if (!out.rut.demandado && out.partes.demandado) {
                    const idx = up.indexOf(String(out.partes.demandado).toUpperCase());
                    if (idx >= 0) {
                        const frag = src.slice(idx, idx + 300);
                        out.rut.demandado = _pickRut(frag) || out.rut.demandado;
                        out.domicilio.demandado = _pickDom(frag) || out.domicilio.demandado;
                    }
                }

                const rutRx = /\b(\d{1,2}\.\d{3}\.\d{3}\-[0-9Kk]|\d{7,8}\-[0-9Kk])\b/g;
                const ruts = Array.from(src.matchAll(rutRx)).map(x => _clean(x[1]));
                if (!out.rut.demandante && ruts.length >= 1 && out.partes.demandante) out.rut.demandante = ruts[0];
                if (!out.rut.demandado && ruts.length >= 2) out.rut.demandado = ruts[1];

                const domRx = /(DOMICILIO|DOMICILIADO|DOMICILIADA|DOMICILIO\s+EN)\s*[:\-]?\s*([^\n]{10,160})/ig;
                const doms = Array.from(src.matchAll(domRx)).map(m => _clean(m[2]));
                if (!out.domicilio.demandante && doms.length >= 1 && out.partes.demandante) out.domicilio.demandante = _cap(doms[0], 160);
                if (!out.domicilio.demandado && doms.length >= 2) out.domicilio.demandado = _cap(doms[1], 160);

                const meaningful = !!(out.tribunal || out.rolRit || out.juez || out.partes.demandante || out.partes.demandado || out.admisibilidad);
                if (!meaningful) return null;

                return {
                    tribunal: out.tribunal,
                    rolRit: out.rolRit,
                    juez: out.juez,
                    admisibilidad: out.admisibilidad,
                    partes: {
                        demandante: out.partes.demandante,
                        demandado: out.partes.demandado,
                        rutDemandante: out.rut.demandante,
                        rutDemandado: out.rut.demandado,
                        domicilioDemandante: out.domicilio.demandante,
                        domicilioDemandado: out.domicilio.demandado
                    }
                };
            } catch (_) {
                return null;
            }
        }

        function dcMovHtml(items, causaId) {
            if (!items.length) return '<div class="empty-state" style="padding:30px 0; text-align:center; color:#94a3b8;"><i class="fas fa-exchange-alt" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>Sin movimientos registrados</div>';
            const iconMap = { Resolución: '⚖️', Escrito: '📄', Notificación: '🔔', Audiencia: '🏛️', Sentencia: '📜', Documento: '📎', default: '📋' };
            return items.map(m => `
            <div class="dc-mov-card" data-nombre="${escHtml((m.nombre || m.tipo || '').toLowerCase())}" data-cuaderno="${(m.cuaderno || 'Principal').toLowerCase()}">
                <div class="dc-mov-header">
                    <div class="dc-mov-title">
                        <div class="dc-mov-icon">${iconMap[m.tipo] || iconMap.default}</div>
                        <div>
                            <div class="dc-mov-name">${escHtml(m.nombre || m.tipo || 'Movimiento')}</div>
                            <div class="dc-mov-date">${m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                        </div>
                    </div>
                    <div class="dc-mov-badges">
                        <span class="dc-mov-badge dc-mov-badge-principal">${m.cuaderno || 'Principal'}</span>
                        <span class="dc-mov-badge dc-mov-badge-tipo">${m.tipo || 'Documento'}</span>
                    </div>
                </div>
                <div class="dc-mov-body">
                    <div class="dc-mov-field"><strong>Etapa:</strong> ${escHtml(m.etapa || m.etapaVinculada || '—')}</div>
                    <div class="dc-mov-field"><strong>Folio:</strong> ${escHtml(String(m.folio || '—'))}</div>
                    ${m.plazo ? `<div class="dc-mov-field" style="color:#c0392b;"><strong>Plazo:</strong> ${new Date(m.plazo).toLocaleDateString('es-CL')}</div>` : ''}
                    ${m._origen === 'mov'
                    ? `<div style="margin-top:8px;"><button class="btn btn-xs" data-dc-action="eliminar-movimiento" data-causa-id="${causaId}" data-idx="${m._idx}" style="background:#fee2e2;color:#b91c1c;border:none;"><i class="fas fa-trash"></i> Eliminar movimiento</button></div>`
                    : ''}
                </div>
            </div>`).join('');
        }

        function dcFiltrarMovimientos(causaId) {
            const q = (document.getElementById(`dc-search-mov-${causaId}`)?.value || '').toLowerCase();
            const cua = (document.getElementById(`dc-cuaderno-${causaId}`)?.value || '').toLowerCase();
            const cards = document.querySelectorAll(`#dc-mov-list-${causaId} .dc-mov-card`);
            let visible = 0;
            cards.forEach(card => {
                const matchQ = !q || card.dataset.nombre.includes(q);
                const matchCua = !cua || card.dataset.cuaderno.includes(cua);
                card.style.display = (matchQ && matchCua) ? '' : 'none';
                if (matchQ && matchCua) visible++;
            });
            const cnt = document.getElementById(`dc-mov-count-${causaId}`);
            const causa = _dcFindCausaById(causaId);
            const esTramiteAdmin = _dcEsTramiteAdmin(causa);
            if (cnt) cnt.textContent = `${visible} ${esTramiteAdmin ? 'evento' : 'movimiento'}${visible !== 1 ? 's' : ''}`;
        }

        function dcAgregarMovimiento(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const nombreInput = document.getElementById(`dc-new-mov-nombre-${causaId}`)?.value.trim();
            const tipo = document.getElementById(`dc-new-mov-tipo-${causaId}`)?.value || 'Resolución';
            const esTramiteAdmin = _dcEsTramiteAdmin(causa);

            let nombre = nombreInput;
            if (esTramiteAdmin) {
                const orgSel = document.getElementById(`dc-tram-org-${causaId}`);
                const tipoSel = document.getElementById(`dc-tram-tipo-${causaId}`);
                const catalogoOrg = _dcGetCatalogoOrganismos();
                const orgKey = orgSel?.value || '';
                const tipoTramite = (tipoSel?.value || '').trim();
                if (!orgKey || !tipoTramite) {
                    showError('Selecciona organismo y tipo de trámite antes de registrar el ingreso.');
                    return;
                }
                const orgLabel = catalogoOrg.find(o => o.key === orgKey)?.label || orgKey;
                if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') causa.tramiteMeta = {};
                causa.tramiteMeta.organismo = orgKey;
                causa.tramiteMeta.organismoLabel = orgLabel;
                causa.tramiteMeta.tipoTramite = tipoTramite;
                if (!nombre) nombre = `${tipo} — ${tipoTramite}`;
            }

            if (!nombre) { showError('Ingrese el nombre del movimiento.'); return; }
            if (!causa.movimientos) causa.movimientos = [];
            causa.movimientos.push({
                id: generarID(), nombre, tipo,
                fecha: new Date().toISOString().split('T')[0],
                cuaderno: _dcEsTramiteAdmin(causa) ? 'Trámite' : 'Principal', etapa: '', folio: '—'
            });
            causa.fechaUltimaActividad = new Date();
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            registrarEvento(`Movimiento agregado: ${nombre} — ${causa.caratula}`);
            abrirDetalleCausa(causaId);
            setTimeout(() => dcCambiarTab('movimientos', causaId), 50);
        }

        async function dcEliminarMovimiento(causaId, idx) {
            const causa = _dcFindCausaById(causaId);
            if (!causa || !Array.isArray(causa.movimientos)) return;
            const mov = causa.movimientos[idx];
            if (!mov) return;
            const ok = await _dcConfirmarAccionSegura('¿Eliminar este movimiento? Esta acción no se puede deshacer.');
            if (!ok) return;
            causa.movimientos.splice(idx, 1);
            causa.fechaUltimaActividad = new Date();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcCambiarTab('movimientos', causaId);
            if (typeof showSuccess === 'function') showSuccess('Movimiento eliminado.');
        }

        function dcActualizarTiposTramiteIngreso(causaId) {
            const orgSel = document.getElementById(`dc-tram-org-${causaId}`);
            const tipoSel = document.getElementById(`dc-tram-tipo-${causaId}`);
            if (!orgSel || !tipoSel) return;
            const catalogoOrg = _dcGetCatalogoOrganismos();
            const org = orgSel.value || 'OTRO';
            const tipos = (catalogoOrg.find(o => o.key === org)?.tipos || ['Trámite administrativo']);
            tipoSel.innerHTML = tipos.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
        }

        // ════════════════════════════════════════════════════════
        // TAB 2: TAREAS
        // ════════════════════════════════════════════════════════
        function dcRenderTareas(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-tareas');
            if (!el) return;
            if (!causa.tareas) causa.tareas = [];

            if (_dcEsTramiteAdmin(causa)) {
                return dcRenderTareasTramite(causaId, causa, el);
            }

            const pendientes = causa.tareas.filter(t => !t.done);
            const completadas = causa.tareas.filter(t => t.done);

            const tareaHtml = (t) => `
            <div class="dc-task-item ${t.done ? 'done' : ''}" id="tarea-${t.id}">
                <div class="dc-task-check ${t.done ? 'done' : ''}" data-dc-action="toggle-tarea" data-causa-id="${causaId}" data-tarea-id="${t.id}">
                    ${t.done ? '<i class="fas fa-check" style="font-size:0.6rem;"></i>' : ''}
                </div>
                <div style="flex:1; min-width:0;">
                    <div class="dc-task-text">${escHtml(t.texto)}</div>
                    <div class="dc-task-meta">${t.fecha || ''}</div>
                </div>
                <span class="dc-task-prioridad dc-task-p-${t.prioridad || 'media'}">${t.prioridad || 'media'}</span>
                <button class="dc-task-del" data-dc-action="eliminar-tarea" data-causa-id="${causaId}" data-tarea-id="${t.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;

            el.innerHTML = `
            <div class="dc-task-add">
                <input id="dc-task-input-${causaId}" placeholder="Nueva tarea..."
                    data-dc-task-input="${causaId}">
                <select id="dc-task-prio-${causaId}"
                    style="padding:7px 8px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc; font-family:'IBM Plex Sans',sans-serif;">
                    <option value="alta">🔴 Alta</option>
                    <option value="media" selected>🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>
                <button class="dc-btn primary" data-dc-action="agregar-tarea" data-causa-id="${causaId}">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>

            ${pendientes.length === 0 && completadas.length === 0
                    ? '<div class="empty-state" style="padding:30px 0; text-align:center; color:#94a3b8;"><i class="fas fa-tasks" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>Sin tareas. Agrega la primera.</div>'
                    : ''}

            ${pendientes.length ? `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:8px;">
                    Pendientes (${pendientes.length})
                </div>
                ${pendientes.map(tareaHtml).join('')}` : ''}

            ${completadas.length ? `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin:14px 0 8px;">
                    Completadas (${completadas.length})
                </div>
                ${completadas.map(tareaHtml).join('')}` : ''}`;
        }

        function _dcPlantillaChecklistTramite(causa) {
            const tipo = String(causa?.tramiteMeta?.tipoTramite || causa?.tipoProcedimiento || '').toLowerCase();
            if (tipo.includes('inscrip') && tipo.includes('dominio')) {
                return [
                    { texto: 'Escritura pública de compraventa / permuta / donación firmada ante notario', etapa: 'preparacion', prioridad: 'alta', requiereAdjunto: true },
                    { texto: 'Comprobante de pago de impuestos correspondientes', etapa: 'preparacion', prioridad: 'alta', requiereAdjunto: true },
                    { texto: 'Identificación del inmueble (fojas, número y año de inscripción)', etapa: 'preparacion', prioridad: 'alta', requiereAdjunto: true },
                    { texto: 'Formulario o minuta de ingreso al organismo preparada', etapa: 'ingreso', prioridad: 'media', requiereAdjunto: true },
                    { texto: 'Comprobante de ingreso en organismo', etapa: 'ingreso', prioridad: 'alta', requiereAdjunto: true },
                    { texto: 'Seguimiento de observaciones/reparos del organismo', etapa: 'seguimiento', prioridad: 'media', requiereAdjunto: false },
                    { texto: 'Resolución final emitida por el organismo', etapa: 'cierre', prioridad: 'alta', requiereAdjunto: true }
                ];
            }
            return [
                { texto: 'Antecedentes base del trámite reunidos', etapa: 'preparacion', prioridad: 'alta', requiereAdjunto: true },
                { texto: 'Formulario de ingreso completado', etapa: 'ingreso', prioridad: 'media', requiereAdjunto: true },
                { texto: 'Comprobante de ingreso en organismo', etapa: 'ingreso', prioridad: 'alta', requiereAdjunto: true },
                { texto: 'Revisión de reparos u observaciones', etapa: 'seguimiento', prioridad: 'media', requiereAdjunto: false },
                { texto: 'Resolución final archivada', etapa: 'cierre', prioridad: 'alta', requiereAdjunto: true }
            ];
        }

        function _dcAsegurarChecklistTramite(causa) {
            if (!causa || causa._tramChecklistInit) return;
            if (!Array.isArray(causa.tareas)) causa.tareas = [];
            const existentes = causa.tareas.some(t => t && t.origen === 'checklist_tramite');
            if (!existentes) {
                _dcPlantillaChecklistTramite(causa).forEach(item => {
                    causa.tareas.push({
                        id: 't' + generarID(),
                        texto: item.texto,
                        prioridad: item.prioridad || 'media',
                        done: false,
                        fecha: new Date().toLocaleDateString('es-CL'),
                        etapa: item.etapa,
                        requiereAdjunto: !!item.requiereAdjunto,
                        adjuntos: [],
                        origen: 'checklist_tramite'
                    });
                });
            }
            causa._tramChecklistInit = true;
            _dcGuardar();
        }

        function dcRenderTareasTramite(causaId, causa, el) {
            _dcAsegurarChecklistTramite(causa);
            const etapas = [
                { key: 'preparacion', label: 'Preparación' },
                { key: 'ingreso', label: 'Ingreso' },
                { key: 'seguimiento', label: 'Seguimiento' },
                { key: 'cierre', label: 'Cierre' }
            ];
            const total = causa.tareas.length;
            const done = causa.tareas.filter(t => t.done).length;

            const tareaHtml = (t) => {
                const adj = Array.isArray(t.adjuntos) ? t.adjuntos : [];
                const dropId = `dc-req-drop-${causaId}-${t.id}`;
                const inputId = `dc-req-input-${causaId}-${t.id}`;
                return `
                <div class="dc-task-item ${t.done ? 'done' : ''}" style="display:block;">
                    <div style="display:flex; gap:10px; align-items:flex-start;">
                        <div class="dc-task-check ${t.done ? 'done' : ''}" data-dc-action="toggle-tarea" data-causa-id="${causaId}" data-tarea-id="${t.id}" style="margin-top:2px;">
                            ${t.done ? '<i class="fas fa-check" style="font-size:0.6rem;"></i>' : ''}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div class="dc-task-text">${escHtml(t.texto)}</div>
                            <div class="dc-task-meta">${escHtml(t.etapa || 'General')} · ${t.fecha || ''}</div>
                        </div>
                        <span class="dc-task-prioridad dc-task-p-${t.prioridad || 'media'}">${t.prioridad || 'media'}</span>
                    </div>

                    <div style="margin-top:8px; margin-left:34px;">
                        <div id="${dropId}" style="border:1px dashed #cbd5e1; border-radius:8px; padding:8px 10px; background:#f8fafc; cursor:pointer;"
                             data-dc-req-drop="${causaId}::${t.id}">
                            <div style="font-size:0.72rem; color:#475569; font-weight:600;"><i class="fas fa-cloud-upload-alt"></i> ${t.requiereAdjunto ? 'Subir documento requerido' : 'Adjuntar respaldo (opcional)'}</div>
                            <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">Arrastra archivo aquí o haz clic para seleccionar</div>
                            <input id="${inputId}" type="file" multiple style="display:none;" data-dc-req-upload="${causaId}" data-tarea-id="${t.id}">
                        </div>
                        ${adj.length ? `<div style="margin-top:6px; display:grid; gap:6px;">${adj.map((a, i) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border:1px solid #e2e8f0; border-radius:7px; background:#fff;">
                                <div style="min-width:0;">
                                    <div style="font-size:0.74rem; color:#334155; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(a.nombre || 'Documento')}</div>
                                    <div style="font-size:0.66rem; color:#94a3b8;">${a.fecha ? new Date(a.fecha).toLocaleString('es-CL') : ''}</div>
                                    <div style="font-size:0.66rem; margin-top:2px; color:${a?.validacionIA?.estado === 'ok' ? (a?.validacionIA?.cumple ? '#166534' : '#b45309') : (a?.validacionIA?.estado === 'error' ? '#b91c1c' : '#64748b')};">
                                        <i class="fas fa-robot"></i>
                                        ${a?.validacionIA?.estado === 'ok'
                                            ? (a?.validacionIA?.cumple ? 'IA: coincide con requisito' : `IA: posible desajuste (${escHtml(a.validacionIA.confianza || 'media')})`)
                                            : (a?.validacionIA?.estado === 'error' ? `IA no disponible: ${escHtml(a.validacionIA.motivo || 'sin detalle')}` : 'Pendiente de validación IA')}
                                    </div>
                                </div>
                                <div style="display:flex; gap:4px;">
                                    <button class="btn btn-xs" data-dc-action="ver-doc" data-causa-id="${causaId}" data-tipo="tarea" data-idx="${i}" data-tarea-id="${t.id}" title="Ver"><i class="fas fa-eye"></i></button>
                                    <button class="btn btn-xs" style="background:#fee2e2;color:#c0392b;border:none;" data-dc-action="eliminar-doc-requisito" data-causa-id="${causaId}" data-tarea-id="${t.id}" data-adj-idx="${i}" title="Eliminar"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`).join('')}</div>` : '<div style="margin-top:6px; font-size:0.68rem; color:#94a3b8;">Sin documentos adjuntos.</div>'}
                    </div>
                </div>`;
            };

            el.innerHTML = `
                <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div style="font-size:0.78rem; color:#334155; font-weight:700;"><i class="fas fa-list-check" style="color:#0891b2;"></i> Checklist del trámite por etapas</div>
                        <div style="font-size:0.72rem; color:#64748b;">Completadas: <strong>${done}/${total}</strong></div>
                    </div>
                    ${etapas.map(et => {
                        const items = causa.tareas.filter(t => (t.etapa || 'preparacion') === et.key);
                        return `<div style="border:1px solid #e2e8f0; border-radius:10px; background:var(--bg-card,#fff); padding:10px;">
                            <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#64748b; margin-bottom:8px;">${et.label} <span style="font-weight:600; color:#94a3b8;">(${items.length})</span></div>
                            ${items.length ? items.map(tareaHtml).join('') : '<div style="font-size:0.74rem; color:#94a3b8; padding:6px 2px;">Sin tareas en esta etapa.</div>'}
                        </div>`;
                    }).join('')}
                </div>`;

            el.querySelectorAll('[data-dc-req-drop]').forEach(dropEl => {
                const meta = String(dropEl.dataset.dcReqDrop || '').split('::');
                const cId = meta[0];
                const tId = meta[1];
                const inputEl = document.getElementById(`dc-req-input-${cId}-${tId}`);
                if (!inputEl) return;
                dropEl.addEventListener('click', () => inputEl.click());
                dropEl.addEventListener('dragover', (ev) => {
                    ev.preventDefault();
                    dropEl.style.borderColor = '#0891b2';
                    dropEl.style.background = '#ecfeff';
                });
                dropEl.addEventListener('dragleave', () => {
                    dropEl.style.borderColor = '#cbd5e1';
                    dropEl.style.background = '#f8fafc';
                });
                dropEl.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    dropEl.style.borderColor = '#cbd5e1';
                    dropEl.style.background = '#f8fafc';
                    dcAdjuntarDocRequisito(cId, tId, ev.dataTransfer?.files || []);
                });
            });
        }

        async function dcAdjuntarDocRequisito(causaId, tareaId, fileList) {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            const causa = _dcFindCausaById(causaId);
            if (!causa || !Array.isArray(causa.tareas)) return;
            const tarea = causa.tareas.find(t => String(t.id) === String(tareaId));
            if (!tarea) return;
            if (!Array.isArray(tarea.adjuntos)) tarea.adjuntos = [];

            for (const file of files) {
                const data = await _fileToBase64(file);
                const adjunto = {
                    id: 'adj-' + generarID(),
                    nombre: file.name,
                    mimetype: file.type || 'application/octet-stream',
                    size: file.size || 0,
                    fecha: new Date().toISOString(),
                    data
                };
                tarea.adjuntos.push(adjunto);
                adjunto.validacionIA = await _dcAnalizarAdjuntoRequisitoIA(adjunto, tarea, causa);
            }

            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderTareas(causaId);
        }

        async function _dcAnalizarAdjuntoRequisitoIA(adjunto, tarea, causa) {
            try {
                if (typeof iaCall !== 'function') {
                    return { estado: 'error', motivo: 'Motor IA no disponible' };
                }
                const esPdf = String(adjunto?.mimetype || '') === 'application/pdf';
                const texto = esPdf
                    ? await _dcExtraerTextoPdf(String(adjunto?.data || '').split(',')[1] || '')
                    : '';

                const prompt = `Eres asistente legal chileno. Evalúa si el documento cumple el requisito.
Responde SOLO JSON válido:
{"cumple":true|false,"confianza":"alta|media|baja","motivo":"explicación breve"}

Requisito: ${tarea?.texto || ''}
Tipo trámite: ${causa?.tramiteMeta?.tipoTramite || causa?.tipoProcedimiento || 'Trámite administrativo'}
Nombre archivo: ${adjunto?.nombre || ''}
Texto documento (si existe): ${(texto || '').slice(0, 4500) || '[sin texto extraíble]'}
`;

                const raw = await iaCall(prompt);
                const jsonStr = String(raw || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                const data = JSON.parse(jsonStr || '{}');
                return {
                    estado: 'ok',
                    cumple: !!data.cumple,
                    confianza: String(data.confianza || 'media').toLowerCase(),
                    motivo: String(data.motivo || '').slice(0, 240),
                    fecha: new Date().toISOString()
                };
            } catch (e) {
                return { estado: 'error', motivo: e?.message || 'No se pudo validar' };
            }
        }

        function dcEliminarAdjuntoTarea(causaId, tareaId, adjIdx) {
            const causa = _dcFindCausaById(causaId);
            if (!causa || !Array.isArray(causa.tareas)) return;
            const tarea = causa.tareas.find(t => String(t.id) === String(tareaId));
            if (!tarea || !Array.isArray(tarea.adjuntos)) return;
            if (!confirm('¿Eliminar este documento adjunto de la tarea?')) return;
            tarea.adjuntos.splice(adjIdx, 1);
            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderTareas(causaId);
        }

        function dcAgregarTarea(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const texto = document.getElementById(`dc-task-input-${causaId}`)?.value.trim();
            if (!texto) return;
            const prio = document.getElementById(`dc-task-prio-${causaId}`)?.value || 'media';
            if (!causa.tareas) causa.tareas = [];
            causa.tareas.push({
                id: 't' + generarID(),
                texto, prioridad: prio, done: false,
                fecha: new Date().toLocaleDateString('es-CL')
            });
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            dcRenderTareas(causaId);
            const badge = document.querySelector('#dctab-tareas .dc-tab-badge');
            if (badge) {
                const p = causa.tareas.filter(t => !t.done).length;
                badge.textContent = p > 0 ? `${p}/${causa.tareas.length}` : causa.tareas.length;
            }
        }

        function dcToggleTarea(causaId, tareaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const t = causa.tareas.find(t => t.id === tareaId);
            if (!t) return;
            t.done = !t.done;
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            dcRenderTareas(causaId);
        }

        function dcEliminarTarea(causaId, tareaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            causa.tareas = causa.tareas.filter(t => t.id !== tareaId);
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            dcRenderTareas(causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 4: USUARIOS Y PARTES
        // ════════════════════════════════════════════════════════
        function dcRenderPartes(causaId) {
            const causa = _dcFindCausaById(causaId);
            const el = document.getElementById('dcpanel-partes');
            if (!causa || !el) return;
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };

            if (_dcEsTramiteAdmin(causa)) {
                if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') causa.tramiteMeta = {};
                const tm = causa.tramiteMeta;
                el.innerHTML = `
                <div style="padding:16px; display:grid; gap:12px;">
                    <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
                            <div style="font-size:0.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">
                                <i class="fas fa-id-card"></i> Individualización del trámite
                            </div>
                            <button class="dc-btn" data-dc-action="editar-intervinientes-tramite" data-causa-id="${causaId}" style="font-size:0.74rem;">
                                <i class="fas fa-pen"></i> Editar
                            </button>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;">
                            <div><div class="dc-field-label">Solicitante</div><div class="dc-field-value">${escHtml(tm.solicitanteNombre || causa.cliente || '—')}</div></div>
                            <div><div class="dc-field-label">RUT solicitante</div><div class="dc-field-value">${escHtml(tm.solicitanteRut || '—')}</div></div>
                            <div><div class="dc-field-label">Correo</div><div class="dc-field-value">${escHtml(tm.solicitanteEmail || '—')}</div></div>
                            <div><div class="dc-field-label">Teléfono</div><div class="dc-field-value">${escHtml(tm.solicitanteTelefono || '—')}</div></div>
                            <div><div class="dc-field-label">Organismo</div><div class="dc-field-value">${escHtml(tm.organismoLabel || tm.organismo || '—')}</div></div>
                            <div><div class="dc-field-label">Sede / comuna</div><div class="dc-field-value">${escHtml(tm.organismoSede || tm.lugarGestion || '—')}</div></div>
                        </div>
                    </div>
                </div>`;
                return;
            }

            const roles = [
                { key: 'demandante', label: 'Demandante', icon: 'fas fa-user', color: '#dbeafe', colorT: '#1a3a6b' },
                { key: 'demandado', label: 'Demandado', icon: 'fas fa-user-slash', color: '#fee2e2', colorT: '#c0392b' },
                { key: 'abogadoContrario', label: 'Abogado Contrario', icon: 'fas fa-gavel', color: '#fef3c7', colorT: '#b45309' },
                { key: 'juez', label: 'Juez / Árbitro', icon: 'fas fa-balance-scale', color: '#d1fae5', colorT: '#0d7a5f' }
            ];
            const extIA = causa.iaSugerencias?.extraer || null;
            const hasIA = !!(extIA && (
                extIA.materia || extIA.rama || extIA.tribunal || extIA.rolRit || extIA.admisibilidad ||
                extIA.partes?.demandante || extIA.partes?.demandado
            ));
            const iaCard = hasIA ? `
            <div style="margin-bottom:12px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:12px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                    <div>
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#475569;">
                            <i class="fas fa-brain"></i> IA sugiere completar datos
                        </div>
                        <div style="font-size:0.72rem; color:#64748b; margin-top:3px;">Fuente: ${escHtml(causa.iaSugerencias?.ultimaFuente || 'documento judicial')}</div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="dc-btn" data-dc-action="descartar-ia-sugerencias" data-causa-id="${causaId}" style="font-size:.72rem;">
                            <i class="fas fa-times"></i> Descartar
                        </button>
                        <button class="dc-btn primary" data-dc-action="aplicar-ia-sugerencias" data-causa-id="${causaId}" style="font-size:.72rem;">
                            <i class="fas fa-check"></i> Aplicar sugerencias
                        </button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:8px; font-size:.75rem; color:#334155;">
                    ${extIA.materia ? `<div><strong>Materia:</strong> ${escHtml(extIA.materia)}</div>` : ''}
                    ${extIA.rama ? `<div><strong>Rama:</strong> ${escHtml(extIA.rama)}</div>` : ''}
                    ${extIA.tribunal ? `<div><strong>Tribunal:</strong> ${escHtml(extIA.tribunal)}</div>` : ''}
                    ${extIA.rolRit ? `<div><strong>Rol/RIT:</strong> ${escHtml(extIA.rolRit)}</div>` : ''}
                    ${extIA.admisibilidad ? `<div><strong>Admisibilidad:</strong> ${escHtml(extIA.admisibilidad)}</div>` : ''}
                    ${extIA.partes?.demandante ? `<div><strong>Demandante:</strong> ${escHtml(extIA.partes.demandante)}</div>` : ''}
                    ${extIA.partes?.demandado ? `<div><strong>Demandado:</strong> ${escHtml(extIA.partes.demandado)}</div>` : ''}
                </div>
            </div>` : '';

            const iniciales = nombre => (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

            el.innerHTML = `
            ${iaCard}
            <div class="dc-partes-grid">
                ${roles.map(r => {
                const p = causa.partes[r.key] || {};
                const tiene = !!(p.nombre || p.rut || p.email || p.telefono);
                return `
                    <div class="dc-parte-card">
                        <div class="dc-parte-role"><i class="${r.icon}"></i> ${r.label}</div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <div class="dc-parte-avatar" style="background:${r.color}; color:${r.colorT};">
                                ${tiene ? iniciales(p.nombre) : '<i class="fas fa-plus" style="font-size:0.7rem;"></i>'}
                            </div>
                            <div style="flex:1; min-width:0;">
                                <div class="dc-parte-nombre">${escHtml(p.nombre || '—')}</div>
                                ${p.rut ? `<div class="dc-parte-sub">RUT: ${escHtml(p.rut)}</div>` : ''}
                            </div>
                        </div>
                        ${p.email ? `<div class="dc-parte-sub" style="margin-bottom:2px;"><i class="fas fa-envelope" style="width:12px; color:#94a3b8;"></i> ${escHtml(p.email)}</div>` : ''}
                        ${p.telefono ? `<div class="dc-parte-sub"><i class="fas fa-phone" style="width:12px; color:#94a3b8;"></i> ${escHtml(p.telefono)}</div>` : ''}
                        <button class="dc-parte-edit" data-dc-action="editar-parte" data-causa-id="${causaId}" data-rol-key="${r.key}" data-rol-label="${r.label}">
                            <i class="fas fa-pencil-alt"></i> ${tiene ? 'Editar' : 'Agregar'}
                        </button>
                    </div>`;
            }).join('')}
            </div>

            <!-- Tribunal -->
            <div style="margin-top:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    <i class="fas fa-landmark"></i> Tribunal
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;">
                    <div>
                        <div class="dc-field-label">Juzgado</div>
                        <div class="dc-field-value">${escHtml(causa.juzgado || '—')}</div>
                    </div>
                    <div>
                        <div class="dc-field-label">Rama</div>
                        <div class="dc-field-value">${escHtml(causa.rama || '—')}</div>
                    </div>
                    <div>
                        <div class="dc-field-label">Secretario</div>
                        <div class="dc-field-value">${escHtml((causa.partes || {}).secretario?.nombre || '—')}</div>
                    </div>
                </div>
                <button class="dc-btn" style="margin-top:10px; font-size:0.76rem;" data-dc-action="editar-tribunal" data-causa-id="${causaId}">
                    <i class="fas fa-pencil-alt"></i> Editar tribunal
                </button>
            </div>`;
        }

        function dcAplicarSugerenciasIA(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa || _dcEsTramiteAdmin(causa)) return;
            const ext = causa.iaSugerencias?.extraer;
            if (!ext || typeof ext !== 'object') return;

            if (ext.materia) causa.materia = String(ext.materia).trim();
            if (ext.rama) causa.rama = String(ext.rama).trim();
            if (ext.tribunal) causa.juzgado = String(ext.tribunal).trim();
            if (ext.rolRit) causa.rit = String(ext.rolRit).trim();

            if (!causa.partes || typeof causa.partes !== 'object') {
                causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            }
            if (!causa.partes.demandante) causa.partes.demandante = {};
            if (!causa.partes.demandado) causa.partes.demandado = {};
            if (ext.partes?.demandante && !causa.partes.demandante.nombre) causa.partes.demandante.nombre = String(ext.partes.demandante).trim();
            if (ext.partes?.demandado && !causa.partes.demandado.nombre) causa.partes.demandado.nombre = String(ext.partes.demandado).trim();

            if (ext.partes?.rutDemandante && !causa.partes.demandante.rut) causa.partes.demandante.rut = String(ext.partes.rutDemandante).trim();
            if (ext.partes?.rutDemandado && !causa.partes.demandado.rut) causa.partes.demandado.rut = String(ext.partes.rutDemandado).trim();
            if (ext.partes?.domicilioDemandante && !causa.partes.demandante.domicilio) causa.partes.demandante.domicilio = String(ext.partes.domicilioDemandante).trim();
            if (ext.partes?.domicilioDemandado && !causa.partes.demandado.domicilio) causa.partes.demandado.domicilio = String(ext.partes.domicilioDemandado).trim();

            if (ext.juez) {
                if (!causa.partes.juez) causa.partes.juez = {};
                if (!causa.partes.juez.nombre) causa.partes.juez.nombre = String(ext.juez).trim();
            }

            causa.iaSugerencias.aplicadasEn = new Date().toISOString();
            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderPartes(causaId);
            if (typeof showSuccess === 'function') showSuccess('Sugerencias IA aplicadas en la causa.');
        }

        function dcDescartarSugerenciasIA(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa || !causa.iaSugerencias) return;
            delete causa.iaSugerencias.extraer;
            delete causa.iaSugerencias.eventos;
            causa.iaSugerencias.descartadasEn = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderPartes(causaId);
            if (typeof showInfo === 'function') showInfo('Sugerencias IA descartadas para esta causa.');
        }

        function dcEditarIntervinientesTramite(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') causa.tramiteMeta = {};
            const tm = causa.tramiteMeta;

            migAbrir({
                titulo: '<i class="fas fa-id-card"></i> Individualización del trámite',
                btnOk: 'Guardar',
                campos: [
                    { id: 'mig-sol-nombre', label: 'Solicitante', valor: tm.solicitanteNombre || causa.cliente || '', requerido: true },
                    { id: 'mig-sol-rut', label: 'RUT solicitante', valor: tm.solicitanteRut || '', tipo: 'rut' },
                    { id: 'mig-sol-mail', label: 'Correo', valor: tm.solicitanteEmail || '', tipo: 'email' },
                    { id: 'mig-sol-fono', label: 'Teléfono', valor: tm.solicitanteTelefono || '' },
                    { id: 'mig-org-sede', label: 'Organismo (sede/comuna)', valor: tm.organismoSede || tm.lugarGestion || '', placeholder: 'Ej: CBR de Valparaíso' }
                ],
                onOk: (vals) => {
                    tm.solicitanteNombre = String(vals['mig-sol-nombre'] || '').trim();
                    tm.solicitanteRut = vals['mig-sol-rut'] ? formatRUT(vals['mig-sol-rut']) : '';
                    tm.solicitanteEmail = String(vals['mig-sol-mail'] || '').trim();
                    tm.solicitanteTelefono = String(vals['mig-sol-fono'] || '').trim();
                    tm.organismoSede = String(vals['mig-org-sede'] || '').trim();
                    tm.lugarGestion = tm.organismoSede || tm.lugarGestion || '';
                    causa.fechaUltimaActividad = new Date().toISOString();
                    if (typeof markAppDirty === 'function') markAppDirty();
                    _dcGuardar();
                    dcRenderPartes(causaId);
                }
            });
        }

        function dcAbrirModuloTramites(causaId) {
            try { cerrarModal('modal-detalle'); } catch (_) {}
            if (typeof tab === 'function') tab('tramites', null);
            if (typeof tramitesRender === 'function') {
                setTimeout(() => { try { tramitesRender(); } catch (_) {} }, 80);
            }
            setTimeout(() => {
                const vinculados = _dcGetTramitesVinculados(causaId);
                if (vinculados[0]?.id && typeof tramiteVerDetalle === 'function') {
                    tramiteVerDetalle(vinculados[0].id);
                }
            }, 140);
        }

        function dcCrearTramiteVinculado(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const actuales = _dcGetTramitesStore();
            const yaExiste = actuales.find(t => String(t.causaId || '') === String(causaId));
            if (yaExiste) {
                if (typeof showSuccess === 'function') showSuccess('Ya existe un trámite vinculado para esta causa.');
                return dcAbrirModuloTramites(causaId);
            }

            const nuevo = {
                id: 'TRA-' + Date.now(),
                fechaCreacion: new Date().toISOString(),
                organismo: causa.tramiteMeta?.organismo || 'OTRO',
                tipo: causa.tramiteMeta?.tipoTramite || causa.tipoProcedimiento || 'Trámite administrativo',
                caratula: causa.caratula || '',
                estado: 'pendiente',
                clienteId: causa.clienteId || '',
                cliente: causa.cliente || '',
                causaId: causa.id,
                fechaIngreso: causa.hitosTramite?.fechaIngresoSistema ? new Date(causa.hitosTramite.fechaIngresoSistema).toISOString() : new Date().toISOString(),
                fechaLimite: '',
                responsable: '',
                oficina: causa.tramiteMeta?.lugarGestion || '',
                observaciones: '',
                eventos: [],
                checklist: [],
                documentos: [],
                honorarios: { monto: 0, pagado: 0 }
            };
            _dcSetTramitesStore([nuevo, ...actuales]);
            if (typeof showSuccess === 'function') showSuccess('Trámite vinculado creado.');
            dcRenderTramiteSeguimiento(causaId);
        }

        function dcRenderTramiteSeguimiento(causaId) {
            const causa = _dcFindCausaById(causaId);
            const el = document.getElementById('dcpanel-tramite');
            if (!causa || !el) return;

            try {

                if (!causa.tramiteMeta || typeof causa.tramiteMeta !== 'object') {
                    causa.tramiteMeta = { organismo: '', tipoTramite: '', lugarGestion: '', numeroIngreso: '' };
                }
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
                const tramitesVinculados = _dcGetTramitesVinculados(causaId);

                const h = causa.hitosTramite;

                el.innerHTML = `
            <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas fa-link" style="color:#0284c7;"></i> Trámite(s) vinculados
                        </div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button class="dc-btn" data-dc-action="crear-tramite-vinculado" data-causa-id="${causaId}" onclick="dcCrearTramiteVinculado('${causaId}')" style="font-size:0.74rem;">
                                <i class="fas fa-plus"></i> Crear trámite vinculado
                            </button>
                            <button class="dc-btn" data-dc-action="abrir-modulo-tramites" data-causa-id="${causaId}" onclick="dcAbrirModuloTramites('${causaId}')" style="font-size:0.74rem;">
                                <i class="fas fa-external-link-alt"></i> Abrir módulo Trámites
                            </button>
                        </div>
                    </div>
                    ${tramitesVinculados.length
                    ? `<div style="display:grid; gap:8px;">${tramitesVinculados.map(t => {
                        const est = escHtml(String(t.estado || 'pendiente').replace(/_/g, ' '));
                        const lim = t.fechaLimite ? new Date(t.fechaLimite).toLocaleDateString('es-CL') : '—';
                        return `<div style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                                <div style="min-width:0;">
                                    <div style="font-size:0.82rem; font-weight:600; color:#334155;">${escHtml(t.tipo || causa.tipoProcedimiento || 'Trámite administrativo')}</div>
                                    <div style="font-size:0.74rem; color:#64748b; margin-top:2px;">${escHtml(t.organismo || causa.tramiteMeta.organismo || 'Organismo sin definir')} · Estado: ${est}</div>
                                </div>
                                <div style="font-size:0.72rem; color:#64748b; white-space:nowrap;">Vence: ${lim}</div>
                            </div>
                        </div>`;
                    }).join('')}</div>`
                    : '<div style="padding:10px 12px; border:1px dashed #cbd5e1; border-radius:8px; color:#64748b; font-size:0.8rem;">No hay trámites vinculados en el módulo de Trámites para esta causa.</div>'}
                </div>

                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:12px;">
                        <i class="fas fa-landmark" style="color:#0891b2;"></i> Datos del trámite
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;">
                        <div>
                            <div class="dc-field-label">Organismo</div>
                            <div class="dc-field-value">${escHtml(causa.tramiteMeta.organismo || '—')}</div>
                        </div>
                        <div>
                            <div class="dc-field-label">Tipo de trámite</div>
                            <div class="dc-field-value">${escHtml(causa.tramiteMeta.tipoTramite || causa.tipoProcedimiento || '—')}</div>
                        </div>
                        <div>
                            <div class="dc-field-label">Lugar de gestión</div>
                            <div class="dc-field-value">${escHtml(causa.tramiteMeta.lugarGestion || '—')}</div>
                        </div>
                        <div>
                            <div class="dc-field-label">N° ingreso</div>
                            <div class="dc-field-value">${escHtml(causa.tramiteMeta.numeroIngreso || '—')}</div>
                        </div>
                    </div>
                </div>

                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:12px;">
                        <i class="fas fa-calendar-check" style="color:#16a34a;"></i> Progreso del trámite
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;">
                        <label style="font-size:0.75rem; color:#64748b;">
                            Ingreso al sistema
                            <input type="date" id="dc-tram-hito-sistema-${causaId}" value="${h.fechaIngresoSistema || ''}" data-dc-tramite-hito="${causaId}" style="margin-top:4px; width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; background:var(--bg-2,#f8fafc);">
                        </label>
                        <label style="font-size:0.75rem; color:#64748b;">
                            Documentos completos
                            <input type="date" id="dc-tram-hito-carga-${causaId}" value="${h.fechaCargaDocumentos || ''}" data-dc-tramite-hito="${causaId}" style="margin-top:4px; width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; background:var(--bg-2,#f8fafc);">
                        </label>
                        <label style="font-size:0.75rem; color:#64748b;">
                            Ingreso al organismo
                            <input type="date" id="dc-tram-hito-organismo-${causaId}" value="${h.fechaIngresoOrganismo || ''}" data-dc-tramite-hito="${causaId}" style="margin-top:4px; width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; background:var(--bg-2,#f8fafc);">
                        </label>
                        <label style="font-size:0.75rem; color:#64748b;">
                            Respuesta del organismo
                            <input type="date" id="dc-tram-hito-respuesta-${causaId}" value="${h.fechaRespuestaOrganismo || ''}" data-dc-tramite-hito="${causaId}" style="margin-top:4px; width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; background:var(--bg-2,#f8fafc);">
                        </label>
                        <label style="font-size:0.75rem; color:#64748b;">
                            Finalización del trámite
                            <input type="date" id="dc-tram-hito-fin-${causaId}" value="${h.fechaFinalizacion || ''}" data-dc-tramite-hito="${causaId}" style="margin-top:4px; width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; background:var(--bg-2,#f8fafc);">
                        </label>
                    </div>
                </div>

                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas fa-file-circle-exclamation" style="color:#d97706;"></i> Reparos del organismo
                        </div>
                        <button class="dc-btn" data-dc-action="agregar-reparo-tramite" data-causa-id="${causaId}" style="font-size:0.75rem;">
                            <i class="fas fa-plus"></i> Nuevo reparo
                        </button>
                    </div>
                    ${causa.reparos.length ? causa.reparos.map((r, i) => `
                        <div style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; border-left:3px solid #f59e0b;">
                            <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                                <div>
                                    <div style="font-size:0.82rem; font-weight:600; color:#334155;">${escHtml(r.titulo || 'Reparo')}</div>
                                    <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">${r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : 'Sin fecha'}</div>
                                    <div style="font-size:0.75rem; color:#475569; margin-top:4px;">${escHtml(r.descripcion || '')}</div>
                                </div>
                                <button class="btn btn-xs" data-dc-action="eliminar-reparo-tramite" data-causa-id="${causaId}" data-idx="${i}" style="background:#fee2e2; color:#c0392b; border:none;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('') : '<div style="text-align:center; padding:14px; color:#94a3b8; font-size:0.8rem;">Sin reparos registrados.</div>'}
                </div>
            </div>`;
            } catch (e) {
                console.error('[CausaDetail] Error render Trámite:', e);
                el.innerHTML = `
                <div style="padding:16px;">
                    <div class="empty-state" style="padding:24px; border:1px dashed #334155; border-radius:10px; color:#94a3b8;">
                        <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>
                        No se pudo renderizar el panel de trámite.
                        <button class="dc-btn" style="margin-left:10px;" onclick="dcRenderTramiteSeguimiento('${causaId}')">Reintentar</button>
                    </div>
                </div>`;
            }
        }

        function dcGuardarHitosTramite(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.hitosTramite || typeof causa.hitosTramite !== 'object') causa.hitosTramite = {};

            causa.hitosTramite.fechaIngresoSistema = document.getElementById(`dc-tram-hito-sistema-${causaId}`)?.value || null;
            causa.hitosTramite.fechaCargaDocumentos = document.getElementById(`dc-tram-hito-carga-${causaId}`)?.value || null;
            causa.hitosTramite.fechaIngresoOrganismo = document.getElementById(`dc-tram-hito-organismo-${causaId}`)?.value || null;
            causa.hitosTramite.fechaRespuestaOrganismo = document.getElementById(`dc-tram-hito-respuesta-${causaId}`)?.value || null;
            causa.hitosTramite.fechaFinalizacion = document.getElementById(`dc-tram-hito-fin-${causaId}`)?.value || null;

            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
        }

        function dcAgregarReparoTramite(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!Array.isArray(causa.reparos)) causa.reparos = [];

            migAbrir({
                titulo: '<i class="fas fa-file-circle-exclamation"></i> Nuevo reparo',
                btnOk: 'Guardar reparo',
                campos: [
                    { id: 'mig-reparo-titulo', label: 'Título', placeholder: 'Ej: Observación de antecedentes incompletos', requerido: true },
                    { id: 'mig-reparo-fecha', label: 'Fecha', tipo: 'date', valor: new Date().toISOString().split('T')[0] },
                    { id: 'mig-reparo-desc', label: 'Descripción', placeholder: 'Detalle del reparo emitido por el organismo' }
                ],
                onOk: (vals) => {
                    causa.reparos.push({
                        titulo: vals['mig-reparo-titulo'] || 'Reparo',
                        fecha: vals['mig-reparo-fecha'] || new Date().toISOString().split('T')[0],
                        descripcion: vals['mig-reparo-desc'] || ''
                    });
                    causa.fechaUltimaActividad = new Date().toISOString();
                    if (typeof markAppDirty === 'function') markAppDirty();
                    _dcGuardar();
                    dcRenderTramiteSeguimiento(causaId);
                }
            });
        }

        function dcEliminarReparoTramite(causaId, idx) {
            const causa = _dcFindCausaById(causaId);
            if (!causa || !Array.isArray(causa.reparos)) return;
            if (!confirm('¿Eliminar este reparo?')) return;
            causa.reparos.splice(idx, 1);
            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderTramiteSeguimiento(causaId);
        }

        function dcEditarParte(causaId, rolKey, rolLabel) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.partes) causa.partes = {};
            const p = causa.partes[rolKey] || {};

            migAbrir({
                titulo: `<i class="fas fa-user-edit"></i> Editar — ${rolLabel}`,
                btnOk: 'Guardar cambios',
                campos: [
                    { id: 'mig-nombre', label: 'Nombre completo', valor: p.nombre || '', placeholder: 'Ej: Juan Pérez González', requerido: true },
                    { id: 'mig-rut', label: 'RUT', valor: p.rut || '', placeholder: 'Ej: 12.345.678-9', tipo: 'rut' },
                    { id: 'mig-email', label: 'Correo electrónico', valor: p.email || '', placeholder: 'correo@ejemplo.cl', tipo: 'email' },
                    { id: 'mig-tel', label: 'Teléfono', valor: p.telefono || '', placeholder: '+56 9 1234 5678' }
                ],
                onOk: (vals) => {
                    causa.partes[rolKey] = {
                        nombre: vals['mig-nombre'].trim(),
                        rut: vals['mig-rut'] ? formatRUT(vals['mig-rut']) : '',
                        email: vals['mig-email'].trim(),
                        telefono: vals['mig-tel'].trim()
                    };
                    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
                    registrarEvento(`Parte actualizada: ${rolLabel} — ${causa.caratula}`);
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('partes', causaId), 50);
                }
            });
        }

        function dcEditarTribunal(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            migAbrir({
                titulo: '<i class="fas fa-university"></i> Editar Tribunal',
                btnOk: 'Guardar',
                campos: [
                    { id: 'mig-juzgado', label: 'Nombre del Juzgado o Tribunal', valor: causa.juzgado || '', placeholder: 'Ej: 3° Juzgado Civil de Santiago', requerido: true }
                ],
                onOk: (vals) => {
                    causa.juzgado = vals['mig-juzgado'].trim();
                    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('partes', causaId), 50);
                }
            });
        }

        function renderDetalleCausa(causaId) {
            const el = document.getElementById('detalle-causa-content');
            if (!causaId) { el.innerHTML = '<div class="empty-state card"><i class="fas fa-gavel"></i><p>Seleccione una causa.</p></div>'; return; }
            abrirDetalleCausa(causaId);
        }

        // ─── 2. marcarEtapa CON UI ────────────────────────────────────────
        function uiMarcarEtapa(causaId, index) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const etapa = causa.etapasProcesales[index];
            if (etapa.completada) {
                if (!confirm('¿Desmarcar esta etapa?')) return;
                etapa.completada = false; etapa.fecha = null;
                recalcularAvance(causa); if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
                registrarEvento(`Etapa desmarcada: ${etapa.nombre} — ${causa.caratula}`);
                abrirDetalleCausa(causaId); return;
            }
            if (!etapa.documentoAsociado) {
                if (!confirm('Esta etapa no tiene documento asociado. ¿Marcar igualmente?')) return;
            }
            etapa.completada = true;
            etapa.fecha = new Date();
            causa.fechaUltimaActividad = new Date();
            recalcularAvance(causa); if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            registrarEvento(`Etapa completada: ${etapa.nombre} — ${causa.caratula}`);
            renderAll();
            abrirDetalleCausa(causaId);
        }

        // ─── 3. Cerrar / Reactivar con UI ────────────────────────────────
        function uiCerrarCausa(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const pendientes = causa.etapasProcesales?.filter(e => !e.completada).length || 0;
            if (pendientes > 0 && !confirm(`Hay ${pendientes} etapas pendientes. ¿Cerrar igual?`)) return;
            causa.estadoGeneral = 'Finalizada';
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); registrarEvento(`Causa cerrada: ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        function uiReactivarCausa(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            causa.estadoGeneral = 'En tramitación'; causa.instancia = 'Segunda';
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); registrarEvento(`Causa reactivada (2ª instancia): ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        // ─── FASE 5: PESTAÑAS DOCUMENTALES ──────────────────────────────
        const _DOCS_CONFIG = {
            cliente:  { campo: 'docsCliente',  label: 'Docs Cliente',   icono: 'fa-folder',       color: '#2563a8' },
            tribunal: { campo: 'docsTribunal',  label: 'Docs Tribunal',  icono: 'fa-gavel',        color: '#7c3aed' },
            contraparte: { campo: 'docsContraparte', label: 'Contraparte', icono: 'fa-user-shield', color: '#dc2626' },
            tramites: { campo: 'docsTramites',  label: 'Otros Trámites', icono: 'fa-wrench',       color: '#0891b2' }
        };

        function dcRenderDocs(causaId, tipo) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = _dcFindCausaById(causaId);
            const el    = document.getElementById(`dcpanel-docs-${tipo}`);
            if (!causa || !el || !cfg) return;
            const esTramiteAdmin = _dcEsTramiteAdmin(causa);
            const labelDocs = (esTramiteAdmin && tipo === 'tribunal') ? 'Docs Organismo' : cfg.label;

            if (!causa[cfg.campo]) causa[cfg.campo] = [];
            const docs = causa[cfg.campo];
            const dropId  = `dc-drop-${causaId}-${tipo}`;
            const statId  = `dc-stat-${causaId}-${tipo}`;
            const listId  = `dcpanel-docs-${tipo}-list`;

            el.innerHTML = `
                <div style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas ${cfg.icono}" style="color:${cfg.color};"></i> ${labelDocs}
                            <span style="background:#f1f5f9; color:#475569; padding:1px 7px; border-radius:10px; margin-left:6px;">${docs.length}</span>
                        </div>
                    </div>
                    <div id="${dropId}"
                         style="border:2px dashed #cbd5e1; border-radius:10px; padding:16px; text-align:center;
                                cursor:pointer; transition:all 0.2s; margin-bottom:10px; background:#f8fafc;"
                         data-dc-dropzone="${causaId}::${tipo}">
                        <i class="fas fa-cloud-upload-alt" style="font-size:1.4rem; color:${cfg.color}; margin-bottom:5px; display:block;"></i>
                        <div style="font-weight:600; font-size:0.82rem; color:#334155;">Subir archivo</div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">
                            PDF · Word · Imagen · Arrastra o haz clic
                            ${cfg.campo !== 'docsTramites' ? '· <span style="color:'+cfg.color+'; font-weight:600;">IA clasifica PDFs automáticamente</span>' : ''}
                        </div>
                        <input type="file" id="dc-file-${causaId}-${tipo}" accept="*/*" multiple style="display:none;"
                               >
                    </div>
                    <div id="${statId}" style="display:none; margin-bottom:10px;"></div>
                    <div id="${listId}">
                        ${_dcDocsHtml(docs, causaId, tipo, cfg)}
                    </div>
                </div>`;

            const dropEl = document.getElementById(dropId);
            const fileInput = document.getElementById(`dc-file-${causaId}-${tipo}`);
            if (dropEl && fileInput) {
                dropEl.addEventListener('click', () => fileInput.click());
                dropEl.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    dropEl.style.borderColor = cfg.color;
                    dropEl.style.background = `${cfg.color}10`;
                });
                dropEl.addEventListener('dragleave', () => {
                    dropEl.style.borderColor = '#cbd5e1';
                    dropEl.style.background = '#f8fafc';
                });
                dropEl.addEventListener('drop', (event) => _dcHandleDrop(event, causaId, tipo));
                fileInput.addEventListener('change', (event) => _dcHandleFiles(event, causaId, tipo));
            }
        }

        async function _dcEnsureSidDocumentoId(causaId, tipo, idx) {
            try {
                const cfg   = _DOCS_CONFIG[tipo];
                const causa = _dcFindCausaById(causaId);
                const doc   = causa?.[cfg.campo]?.[idx];
                if (!doc) return null;

                // Reusar id ya creado
                if (doc._sidDocumentoId) return String(doc._sidDocumentoId);

                // Solo creamos canónico para PDFs (por ahora)
                if (doc.mimetype !== 'application/pdf') return null;

                const dataUrl = String(doc.data || '');
                const base64 = dataUrl.includes('base64,') ? (dataUrl.split('base64,')[1] || '') : '';
                const nombre = doc.nombre || 'documento.pdf';

                if (!base64) return null;
                if (!Array.isArray(DB.documentos)) DB.documentos = [];

                let archivoDocId = null;
                const api = window.electronAPI;
                if (api?.docs?.guardar) {
                    const r = await api.docs.guardar(nombre, base64, 'application/pdf');
                    if (r?.ok && r.id) {
                        archivoDocId = String(r.id);
                    } else {
                        throw new Error(r?.error || 'No se pudo guardar el archivo.');
                    }
                }

                const newId = (typeof uid === 'function')
                    ? uid()
                    : (Date.now().toString(36) + Math.random().toString(36).slice(2));

                const docNuevo = {
                    id: newId,
                    causaId: causaId,
                    origen: (tipo === 'tribunal') ? 'tribunal' : (tipo === 'tramites') ? 'interno' : (tipo === 'contraparte') ? 'contraparte' : 'cliente',
                    nombreOriginal: nombre,
                    tipo: 'Documento',
                    etapaVinculada: '',
                    fechaDocumento: (new Date()).toISOString().slice(0, 10),
                    generaPlazo: false,
                    diasPlazo: 0,
                    fechaVencimiento: null,
                    fechaIngreso: new Date().toISOString(),
                    descripcion: nombre,
                    archivoMime: 'application/pdf',
                    archivoNombre: nombre,
                    archivoDocId: archivoDocId,
                    _origenDetalleCausa: { tipo: tipo, idx: idx }
                };
                if (typeof Store !== 'undefined' && Store?.agregarDocumento) Store.agregarDocumento(docNuevo);
                else DB.documentos.push(docNuevo);

                doc._sidDocumentoId = newId;
                if (typeof markAppDirty === 'function') markAppDirty();
                if (typeof save === 'function') save();
                return String(newId);
            } catch (e) {
                console.warn('[SID] No se pudo asegurar doc canónico:', e?.message || e);
                return null;
            }
        }

        window.dcAnalisisDualDoc = async function(causaId, tipo, idx) {
            const docId = await _dcEnsureSidDocumentoId(causaId, tipo, idx);
            if (!docId) { if (typeof showError === 'function') showError('No se pudo preparar el documento para análisis.'); return; }
            if (typeof uiAnalisisDualDocumento === 'function') {
                return uiAnalisisDualDocumento(docId);
            }
            if (typeof showError === 'function') showError('Función de análisis dual no disponible.');
        };

        window.dcVerInsightDoc = async function(causaId, tipo, idx) {
            const docId = await _dcEnsureSidDocumentoId(causaId, tipo, idx);
            if (!docId) { if (typeof showInfo === 'function') showInfo('Este documento aún no está indexado para Insight IA.'); return; }
            if (typeof uiVerInsightDocumento === 'function') {
                return uiVerInsightDocumento(docId);
            }
            if (typeof showError === 'function') showError('Visor de Insight no disponible.');
        };

        function _dcDocsHtml(docs, causaId, tipo, cfg) {
            if (!docs.length) return `
                <div style="text-align:center; padding:24px; color:#94a3b8; font-size:0.82rem;">
                    <i class="fas ${cfg.icono}" style="font-size:1.8rem; opacity:0.3; display:block; margin-bottom:8px;"></i>
                    Sin documentos aún.
                </div>`;

            const tipoColor = { 'Resolución':'#7c3aed','Escrito':'#2563eb','Prueba':'#d97706','Sentencia':'#dc2626','Notificación':'#059669' };

            return docs.map((d, i) => {
                const esPdf = d.mimetype === 'application/pdf';
                const tagIA = d.tipoIA ? `<span style="font-size:0.65rem; background:${tipoColor[d.tipoIA]||'#64748b'}18;
                    color:${tipoColor[d.tipoIA]||'#64748b'}; padding:1px 6px; border-radius:10px; font-weight:600; margin-left:4px;">${escHtml(d.tipoIA)}</span>` : '';
                const etapaTag = d.etapaIA ? `<span style="font-size:0.65rem; color:#64748b; margin-left:4px;">· ${escHtml(d.etapaIA)}</span>` : '';
                const plazoTag = d.plazoIA ? `<span style="font-size:0.65rem; color:#dc2626; font-weight:600; margin-left:4px;">
                    <i class="fas fa-clock"></i> ${escHtml(d.plazoIA)}</span>` : '';
                const resumenTag = d.resumenIA ? `<div style="font-size:0.7rem; color:#64748b; margin-top:2px; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(d.resumenIA)}</div>` : '';

                return `
                <div style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px;
                    background:var(--bg-card,#fff); border:1px solid var(--border,#e2e8f0);
                    border-radius:8px; margin-bottom:8px;">
                    <i class="fas ${_iconoMime(d.mimetype)}" style="color:${cfg.color}; font-size:1.1rem; flex-shrink:0; margin-top:2px;"></i>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.82rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escHtml(d.nombre)}${tagIA}${etapaTag}${plazoTag}
                        </div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:1px;">
                            ${new Date(d.fecha).toLocaleString('es-CL')} · ${_formatBytes(d.size || 0)}
                        </div>
                        ${resumenTag}
                    </div>
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                        <button class="btn btn-xs" data-dc-action="ver-doc" data-causa-id="${causaId}" data-tipo="${tipo}" data-idx="${i}" title="Ver">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${d.mimetype === 'text/html' ? `<button class="btn btn-xs" style="background:#eef2ff; color:#4338ca; border:none;"
                            data-dc-action="exportar-doc-pdf" data-causa-id="${causaId}" data-tipo="${tipo}" data-idx="${i}" title="Guardar PDF en PC">
                            <i class="fas fa-file-pdf"></i>
                        </button>` : ''}
                        ${esPdf ? `<button class="btn btn-xs" style="background:#eff6ff; color:#2563eb; border:none;"
                            data-dc-action="analisis-dual-doc" data-causa-id="${causaId}" data-tipo="${tipo}" data-idx="${i}" title="Análisis Dual (IA A + B)">
                            <i class="fas fa-brain"></i>
                        </button>
                        <button class="btn btn-xs" style="background:#fff7ed; color:#b45309; border:none;"
                            data-dc-action="insight-doc" data-causa-id="${causaId}" data-tipo="${tipo}" data-idx="${i}" title="Ver Insight IA">
                            <i class="fas fa-lightbulb"></i>
                        </button>` : ''}
                        <button class="btn btn-xs" style="background:#fee2e2; color:#c0392b; border:none;"
                            data-dc-action="eliminar-doc" data-causa-id="${causaId}" data-tipo="${tipo}" data-idx="${i}" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        window._dcHandleDrop = function(event, causaId, tipo) {
            event.preventDefault();
            const drop = document.getElementById(`dc-drop-${causaId}-${tipo}`);
            if (drop) { drop.style.borderColor = '#cbd5e1'; drop.style.background = '#f8fafc'; }
            const files = event.dataTransfer.files;
            if (files?.length) _dcProcesarArchivos(causaId, tipo, Array.from(files));
        };

        window._dcHandleFiles = function(event, causaId, tipo) {
            const files = Array.from(event.target.files || []);
            if (files.length) _dcProcesarArchivos(causaId, tipo, files);
        };

        window._dcProcesarArchivos = async function(causaId, tipo, files) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = _dcFindCausaById(causaId);
            if (!causa || !cfg) return;
            if (!causa[cfg.campo]) causa[cfg.campo] = [];

            const statEl = document.getElementById(`dc-stat-${causaId}-${tipo}`);
            _dcMostrarStat(statEl, 'loading', `<i class="fas fa-spinner fa-spin"></i> Procesando ${files.length} archivo(s)...`);

            for (const file of files) {
                const base64full = await _fileToBase64(file);
                const base64data = base64full.split(',')[1];
                const doc = {
                    nombre:   file.name,
                    mimetype: file.type,
                    size:     file.size,
                    fecha:    new Date().toISOString(),
                    data:     base64full,
                    tipoIA:   null,
                    etapaIA:  null,
                    plazoIA:  null,
                    resumenIA: null
                };
                causa[cfg.campo].push(doc);

                if (file.type === 'application/pdf' && typeof iaCall === 'function') {
                    _dcAnalizarPdfIA(causaId, tipo, causa[cfg.campo].length - 1, base64data, file.name, causa, statEl);
                }
            }

            _dcSyncLegacyDocumentos(causa);
            _dcGuardar();
            dcRenderDocs(causaId, tipo);

            if (files.every(f => f.type !== 'application/pdf')) {
                _dcMostrarStat(statEl, 'success', `<i class="fas fa-check-circle"></i> ${files.length} archivo(s) guardado(s).`);
                setTimeout(() => { if (statEl) statEl.style.display = 'none'; }, 3000);
            }
        };

        window._dcAnalizarDocIA = async function(causaId, tipo, idx) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = _dcFindCausaById(causaId);
            const doc   = causa?.[cfg.campo]?.[idx];
            if (!doc || doc.mimetype !== 'application/pdf') return;
            const statEl = document.getElementById(`dc-stat-${causaId}-${tipo}`);
            const base64data = doc.data.split(',')[1];
            await _dcAnalizarPdfIA(causaId, tipo, idx, base64data, doc.nombre, causa, statEl);
            dcRenderDocs(causaId, tipo);
        };

        async function _dcAnalizarPdfIA(causaId, tipo, idx, base64data, nombreArchivo, causa, statEl) {
            if (typeof iaCall !== 'function') return;

            _dcMostrarStat(statEl, 'loading', `<i class="fas fa-brain fa-pulse"></i> IA analizando "${escHtml(nombreArchivo)}"...`);

            try {
                const textoPdf = await _dcExtraerTextoPdf(base64data);
                if (!textoPdf || textoPdf.trim().length < 20) throw new Error('PDF sin texto extraíble (imagen escaneada).');

                const textoTruncado = textoPdf.substring(0, 6000);
                const ramaCtx = causa.rama ? `La causa es de rama: "${causa.rama}".` : '';
                const tipoCtx = tipo === 'cliente' ? 'aportado por el cliente'
                              : tipo === 'tribunal' ? 'emitido por el tribunal'
                              : tipo === 'contraparte' ? 'presentado por la contraparte'
                              : tipo === 'tramites' ? 'relacionado con otros trámites'
                              : 'documento legal del expediente';

                const prompt = `Eres un asistente jurídico especializado en derecho chileno. ${ramaCtx}
Este documento es ${tipoCtx}.

Analiza el texto y devuelve SOLO un objeto JSON válido, sin explicaciones ni bloques de código:
{
  "tipo": "uno de: Resolución | Escrito | Prueba | Sentencia | Notificación | Contrato | Otro",
  "etapa": "etapa procesal breve (ej: Demanda, Contestación, Prueba, Sentencia)",
  "plazo": "descripción del plazo si existe (ej: '10 días hábiles para contestar') o null",
  "resumen": "resumen de 1 línea del contenido",
  "extraer": {
    "materia": "materia principal o null",
    "rama": "rama jurídica o null",
    "tribunal": "tribunal/juzgado mencionado o null",
    "rolRit": "rol/rit/ruc si aparece o null",
    "admisibilidad": "Admite | No admite | Subsanar | No aplica",
    "partes": {
      "demandante": "nombre o null",
      "demandado": "nombre o null"
    }
  },
  "eventos": [
    {
      "tipo": "audiencia | plazo | hito",
      "titulo": "descripción breve",
      "fecha": "YYYY-MM-DD o null",
      "detalle": "detalle breve"
    }
  ]
}

TEXTO:
${textoTruncado}`;

                const respuesta = await iaCall(prompt);
                const jsonStr = respuesta.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                const data = JSON.parse(jsonStr);

                const cfg = _DOCS_CONFIG[tipo];
                const doc = causa[cfg.campo][idx];
                if (doc) {
                    doc.tipoIA    = data.tipo    || null;
                    doc.etapaIA   = data.etapa   || null;
                    doc.plazoIA   = data.plazo   || null;
                    doc.resumenIA = data.resumen || null;
                    doc.metaIA    = data.extraer && typeof data.extraer === 'object' ? data.extraer : null;
                    doc.eventosIA = Array.isArray(data.eventos) ? data.eventos : [];
                }

                const iaAplicado = _dcAplicarSugerenciasJudicialesIA(causa, data, nombreArchivo) || { nuevosEventos: 0, alertasNuevas: 0, audienciasActivadas: false };

                _dcGuardar();
                _dcMostrarStat(statEl, 'success',
                    `<i class="fas fa-check-circle"></i> <strong>IA clasificó "${escHtml(nombreArchivo)}"</strong>
                     ${data.tipo ? ` — ${escHtml(data.tipo)}` : ''}
                     ${data.resumen ? `<br><span style="font-size:0.72rem; color:#4b5563;">${escHtml(data.resumen)}</span>` : ''}
                     ${(iaAplicado.nuevosEventos || iaAplicado.alertasNuevas || iaAplicado.audienciasActivadas) ? `<br><span style="font-size:0.71rem; color:#1d4ed8;">
                        ${iaAplicado.nuevosEventos ? `• ${iaAplicado.nuevosEventos} evento(s) IA` : ''}
                        ${iaAplicado.alertasNuevas ? `${iaAplicado.nuevosEventos ? ' · ' : '• '} ${iaAplicado.alertasNuevas} alerta(s)` : ''}
                        ${iaAplicado.audienciasActivadas ? `${(iaAplicado.nuevosEventos || iaAplicado.alertasNuevas) ? ' · ' : '• '}Módulo audiencias activado` : ''}
                     </span>` : ''}`
                );
                setTimeout(() => { if (statEl) statEl.style.display = 'none'; }, 6000);

            } catch (err) {
                console.error('[dcIA]', err);
                _dcMostrarStat(statEl, 'warning',
                    `<i class="fas fa-exclamation-triangle"></i> No se pudo analizar "${escHtml(nombreArchivo)}". ${err.message}`
                );
                setTimeout(() => { if (statEl) statEl.style.display = 'none'; }, 5000);
            }
        }

        async function _dcExtraerTextoPdf(base64) {
            if (!window.pdfjsLib) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
            let texto = '';
            const maxPags = Math.min(pdf.numPages, 10);
            for (let i = 1; i <= maxPags; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(' ') + '\n';
            }
            return texto.trim();
        }

        function _dcMostrarStat(el, tipo, html) {
            if (!el) return;
            const estilos = {
                loading: 'background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8;',
                success: 'background:#f0fdf4; border:1px solid #bbf7d0; color:#166534;',
                warning: 'background:#fffbeb; border:1px solid #fde68a; color:#92400e;',
                error:   'background:#fef2f2; border:1px solid #fecaca; color:#991b1b;'
            };
            el.style.cssText = (estilos[tipo] || estilos.loading) + 'display:block; padding:9px 12px; border-radius:8px; font-size:0.79rem; line-height:1.5;';
            el.innerHTML = html;
        }

        function _dcGuardar() {
            if (typeof saveDataToDisk === 'function') saveDataToDisk();
            else if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();
            else if (typeof markAppDirty === 'function') { markAppDirty(); if (typeof save === 'function') save(); }
        }

        window.dcSubirDocumento = async function(causaId, tipo, files) {
            if (files?.length) _dcProcesarArchivos(causaId, tipo, Array.from(files));
        };

        window.dcVerDocumento = function(causaId, tipo, idx, tareaId) {
            const causa = _dcFindCausaById(causaId);
            let doc = null;
            if (tipo === 'tarea') {
                const tarea = causa?.tareas?.find(t => String(t.id) === String(tareaId));
                doc = tarea?.adjuntos?.[idx] || null;
            } else {
                const cfg = _DOCS_CONFIG[tipo];
                doc = causa?.[cfg?.campo]?.[idx] || null;
            }
            if (!doc) return;

            let visor;
            if (doc.mimetype?.startsWith('image/')) {
                visor = `<img src="${doc.data}" style="max-width:100%; max-height:70vh; border-radius:6px;">`;
            } else if (doc.mimetype === 'application/pdf') {
                visor = `<iframe src="${doc.data}" style="width:100%; height:70vh; border:none; border-radius:6px;"></iframe>`;
            } else if (doc.mimetype === 'text/html') {
                visor = `<iframe src="${doc.data}" style="width:100%; height:70vh; border:none; border-radius:6px; background:#fff;"></iframe>`;
            } else {
                visor = `<div style="padding:20px; text-align:center; color:#64748b;">
                    <i class="fas fa-file" style="font-size:3rem; opacity:0.4;"></i>
                    <p>Vista previa no disponible para este tipo de archivo.</p>
                    <a href="${doc.data}" download="${doc.nombre}" class="btn btn-p" style="margin-top:10px;">
                        <i class="fas fa-download"></i> Descargar
                    </a>
                </div>`;
            }

            let vm = document.getElementById('modal-doc-viewer');
            if (!vm) {
                vm = document.createElement('div');
                vm.id = 'modal-doc-viewer';
                vm.className = 'modal-overlay';
                vm.style.cssText = 'display:none; z-index:9999;';
                vm.innerHTML = `<div class="modal-box" style="max-width:800px; width:90vw;">
                    <div class="modal-header">
                        <h3 id="modal-doc-viewer-titulo"></h3>
                        <button class="modal-close" id="modal-doc-viewer-close">×</button>
                    </div>
                    <div id="modal-doc-viewer-body"></div>
                </div>`;
                document.body.appendChild(vm);
                document.getElementById('modal-doc-viewer-close')?.addEventListener('click', () => {
                    const modal = document.getElementById('modal-doc-viewer');
                    if (modal) modal.style.display = 'none';
                });
            }
            document.getElementById('modal-doc-viewer-titulo').textContent = doc.nombre;
            document.getElementById('modal-doc-viewer-body').innerHTML = visor;
            vm.style.display = 'flex';
        };

        window.dcExportarDocumentoPDF = async function(causaId, tipo, idx, tareaId) {
            const causa = _dcFindCausaById(causaId);
            let doc = null;
            if (tipo === 'tarea') {
                const tarea = causa?.tareas?.find(t => String(t.id) === String(tareaId));
                doc = tarea?.adjuntos?.[idx] || null;
            } else {
                const cfg = _DOCS_CONFIG[tipo];
                doc = causa?.[cfg?.campo]?.[idx] || null;
            }
            if (!doc) return;
            if (String(doc.mimetype || '') !== 'text/html') {
                if (typeof showInfo === 'function') showInfo('Solo los contratos/documentos HTML pueden exportarse a PDF desde esta opción.');
                return;
            }

            const pdfApi = window.electronAPI?.prospectos?.generarPDF
                ? window.electronAPI.prospectos
                : (window.electronAPI?.generarPDF ? window.electronAPI : null);
            if (!pdfApi?.generarPDF) {
                if (typeof showError === 'function') showError('La función de generar PDF no está disponible en este entorno.');
                return;
            }

            try {
                const dataUrl = String(doc.data || '');
                const html = dataUrl.startsWith('data:text/html')
                    ? decodeURIComponent((dataUrl.split(',')[1] || ''))
                    : dataUrl;
                const defaultName = String(doc.nombre || 'documento').replace(/\.html?$/i, '') + '.pdf';
                const r = await pdfApi.generarPDF({ html, defaultName });
                if (r?.success) {
                    if (typeof showSuccess === 'function') showSuccess('PDF guardado en tu PC.');
                } else if (r?.error && r.error !== 'Cancelado por usuario') {
                    if (typeof showError === 'function') showError(r.error || 'No se pudo generar el PDF.');
                }
            } catch (e) {
                if (typeof showError === 'function') showError(e?.message || 'No se pudo generar el PDF.');
            }
        };

        window.dcEliminarDocumento = function(causaId, tipo, idx) {
            if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = _dcFindCausaById(causaId);
            if (!causa?.[cfg.campo]) return;
            causa[cfg.campo].splice(idx, 1);
            _dcSyncLegacyDocumentos(causa);
            if (typeof saveDataToDisk === 'function') saveDataToDisk();
            else if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();
            dcRenderDocs(causaId, tipo);
        };

        function _fileToBase64(file) {
            return new Promise((res, rej) => {
                const r = new FileReader();
                r.onload  = () => res(r.result);
                r.onerror = () => rej(new Error('Error leyendo archivo'));
                r.readAsDataURL(file);
            });
        }

        function _iconoMime(mime) {
            if (!mime) return 'fa-file';
            if (mime.startsWith('image/'))      return 'fa-file-image';
            if (mime === 'application/pdf')     return 'fa-file-pdf';
            if (mime.includes('word'))          return 'fa-file-word';
            if (mime.includes('excel') || mime.includes('spreadsheet')) return 'fa-file-excel';
            return 'fa-file-alt';
        }

        function _formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        // ─── 5. BÚSQUEDA GLOBAL ──────────────────────────────────────────────
        let busqFiltroActual = 'todo';

        // ════════════════════════════════════════════════════════
        // TAB PROCESO — Instancias + Recursos + Prescripción
        // ════════════════════════════════════════════════════════
        function dcRenderProceso(causaId) {
            const causa = _dcFindCausaById(causaId);
            const el = document.getElementById('dcpanel-proceso');
            if (!causa || !el) return;

            if (!causa.instancias)   causa.instancias = [];
            if (!causa.recursos)     causa.recursos = [];
            if (!causa.prescripcion) causa.prescripcion = {};
            const audienciasIA = (causa.eventosProcesalesIA || [])
                .filter(ev => String(ev?.tipo || '').toLowerCase() === 'audiencia')
                .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
            const hoyAud = new Date(); hoyAud.setHours(0, 0, 0, 0);
            const _estadoAud = (a) => {
                const f = a.fecha ? new Date(a.fecha + 'T12:00:00') : null;
                if (a.gestionado) return 'Gestionada';
                if (!f) return 'Sin fecha';
                if (f.getTime() === hoyAud.getTime()) return 'Hoy';
                if (f < hoyAud) return 'Cumplida';
                return 'Pendiente';
            };
            const audCount = {
                pendientes: audienciasIA.filter(a => _estadoAud(a) === 'Pendiente').length,
                hoy: audienciasIA.filter(a => _estadoAud(a) === 'Hoy').length,
                gestionadas: audienciasIA.filter(a => _estadoAud(a) === 'Gestionada').length,
                cumplidas: audienciasIA.filter(a => _estadoAud(a) === 'Cumplida').length
            };
            const audFiltro = String(causa?.audiencias?.filtroVista || 'todas').toLowerCase();
            const audienciasMostradas = audienciasIA.filter(a => {
                const est = _estadoAud(a).toLowerCase();
                if (audFiltro === 'todas') return true;
                if (audFiltro === 'pendientes') return est === 'pendiente';
                if (audFiltro === 'hoy') return est === 'hoy';
                if (audFiltro === 'gestionadas') return est === 'gestionada';
                return true;
            });

            const instanciaActual = causa.instancia || 'Primera';
            const instanciaColor = {
                'Primera':        '#2563eb',
                'Segunda':        '#7c3aed',
                'Corte Suprema':  '#dc2626',
                'Finalizada':     '#059669'
            };

            el.innerHTML = `
            <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">

                <!-- ── INSTANCIA ── -->
                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:12px;">
                        <i class="fas fa-sitemap" style="color:#2563eb;"></i> Instancia Actual
                    </div>
                    <div style="display:flex; gap:0; margin-bottom:16px; position:relative;">
                        ${['Primera','Segunda','Corte Suprema'].map((inst, i) => {
                            const activa = inst === instanciaActual;
                            const pasada = ['Primera','Segunda','Corte Suprema'].indexOf(instanciaActual) > i;
                            const color = instanciaColor[inst] || '#64748b';
                            return `
                            <div style="flex:1; text-align:center; position:relative;">
                                <div style="width:28px; height:28px; border-radius:50%; margin:0 auto 6px;
                                    background:${activa ? color : pasada ? color+'40' : '#f1f5f9'};
                                    border:2px solid ${activa || pasada ? color : '#cbd5e1'};
                                    display:flex; align-items:center; justify-content:center;
                                    font-size:0.65rem; color:${activa ? '#fff' : pasada ? color : '#94a3b8'};
                                    font-weight:700; cursor:pointer; transition:all 0.2s;"
                                    data-dc-action="cambiar-instancia" data-causa-id="${causaId}" data-instancia="${inst}"
                                    title="Cambiar a ${inst} Instancia">
                                    ${activa ? '<i class="fas fa-check" style="font-size:0.6rem;"></i>' : i+1}
                                </div>
                                <div style="font-size:0.7rem; font-weight:${activa ? '700' : '500'};
                                    color:${activa ? color : '#94a3b8'};">${inst}</div>
                                ${i < 2 ? `<div style="position:absolute; top:14px; left:50%; right:-50%;
                                    height:2px; background:${pasada ? color+'60' : '#e2e8f0'}; z-index:0;"></div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    ${causa.instancias.length ? `
                    <div style="margin-top:8px;">
                        <div style="font-size:0.68rem; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:6px;">Historial</div>
                        ${causa.instancias.map(inst => `
                        <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:0.78rem;">
                            <span style="background:${instanciaColor[inst.instancia]||'#64748b'}18;
                                color:${instanciaColor[inst.instancia]||'#64748b'};
                                padding:1px 8px; border-radius:10px; font-weight:600; font-size:0.68rem;">${inst.instancia}</span>
                            <span style="flex:1; color:#475569;">${escHtml(inst.tribunal || '—')}</span>
                            <span style="color:#94a3b8; font-size:0.68rem; font-family:monospace;">${inst.fecha ? new Date(inst.fecha).toLocaleDateString('es-CL') : '—'}</span>
                        </div>`).join('')}
                    </div>` : ''}
                    <button data-dc-action="agregar-instancia" data-causa-id="${causaId}"
                        style="margin-top:12px; padding:6px 14px; border:1px dashed #cbd5e1; border-radius:8px;
                               background:transparent; color:#64748b; font-size:0.78rem; cursor:pointer; width:100%;">
                        <i class="fas fa-plus"></i> Registrar cambio de instancia
                    </button>
                </div>

                <!-- ── RECURSOS ── -->
                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas fa-undo" style="color:#7c3aed;"></i> Recursos Procesales
                            <span style="background:#f1f5f9; color:#475569; padding:1px 7px; border-radius:10px; margin-left:6px;">${causa.recursos.length}</span>
                        </div>
                        <button data-dc-action="agregar-recurso" data-causa-id="${causaId}"
                            style="padding:5px 12px; border:none; border-radius:7px; background:#7c3aed; color:#fff;
                                   font-size:0.75rem; cursor:pointer; font-weight:600;">
                            <i class="fas fa-plus"></i> Nuevo
                        </button>
                    </div>
                    ${causa.recursos.length === 0
                        ? `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">
                              <i class="fas fa-undo" style="font-size:1.5rem; opacity:0.3; display:block; margin-bottom:6px;"></i>
                              Sin recursos interpuestos.
                           </div>`
                        : causa.recursos.map((r, i) => {
                            const estadoColor = r.estado === 'Acogido' ? '#059669' : r.estado === 'Rechazado' ? '#dc2626' : '#d97706';
                            return `
                            <div style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; border-left:3px solid #7c3aed;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div>
                                        <div style="font-weight:600; font-size:0.82rem;">${escHtml(r.tipo)}</div>
                                        <div style="font-size:0.7rem; color:#64748b; margin-top:2px;">
                                            ${escHtml(r.tribunal || '—')} · ${r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : '—'}
                                        </div>
                                        ${r.observaciones ? `<div style="font-size:0.72rem; color:#94a3b8; margin-top:3px; font-style:italic;">${escHtml(r.observaciones)}</div>` : ''}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                        <span style="font-size:0.68rem; background:${estadoColor}18; color:${estadoColor};
                                            padding:2px 8px; border-radius:10px; font-weight:600;">${escHtml(r.estado || 'Pendiente')}</span>
                                        <button data-dc-action="eliminar-recurso" data-causa-id="${causaId}" data-idx="${i}"
                                            style="background:transparent; border:none; color:#dc2626; cursor:pointer; font-size:0.75rem;">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')
                    }
                </div>

                <!-- ── AUDIENCIAS (IA) ── -->
                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas fa-gavel" style="color:#2563eb;"></i> Audiencias detectadas por IA
                            <span style="background:#eff6ff; color:#1d4ed8; padding:1px 7px; border-radius:10px; margin-left:6px;">${audienciasIA.length}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <select data-dc-aud-filtro="${causaId}" style="padding:5px 8px; border:1px solid #dbeafe; border-radius:7px; font-size:.72rem; background:#fff; color:#1e3a8a;">
                                <option value="todas" ${audFiltro === 'todas' ? 'selected' : ''}>Todas</option>
                                <option value="pendientes" ${audFiltro === 'pendientes' ? 'selected' : ''}>Pendientes</option>
                                <option value="hoy" ${audFiltro === 'hoy' ? 'selected' : ''}>Hoy</option>
                                <option value="gestionadas" ${audFiltro === 'gestionadas' ? 'selected' : ''}>Gestionadas</option>
                            </select>
                            <div style="font-size:0.68rem; color:#64748b;">
                                ${causa.audiencias?.habilitado ? '<i class="fas fa-check-circle" style="color:#0d7a5f;"></i> Seguimiento habilitado' : 'Sin activar'}
                            </div>
                        </div>
                    </div>

                    ${audienciasIA.length ? `
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; margin-bottom:10px;">
                        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px 10px;">
                            <div style="font-size:.66rem; text-transform:uppercase; color:#1d4ed8; font-weight:800;">Pendientes</div>
                            <div style="font-size:1rem; font-weight:800; color:#1e3a8a;">${audCount.pendientes}</div>
                        </div>
                        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:8px 10px;">
                            <div style="font-size:.66rem; text-transform:uppercase; color:#c2410c; font-weight:800;">Hoy</div>
                            <div style="font-size:1rem; font-weight:800; color:#c2410c;">${audCount.hoy}</div>
                        </div>
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px;">
                            <div style="font-size:.66rem; text-transform:uppercase; color:#166534; font-weight:800;">Gestionadas</div>
                            <div style="font-size:1rem; font-weight:800; color:#166534;">${audCount.gestionadas}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px;">
                            <div style="font-size:.66rem; text-transform:uppercase; color:#64748b; font-weight:800;">Cumplidas</div>
                            <div style="font-size:1rem; font-weight:800; color:#475569;">${audCount.cumplidas}</div>
                        </div>
                    </div>` : ''}

                    ${audienciasMostradas.length === 0
                        ? `<div style="text-align:center; padding:18px; color:#94a3b8; font-size:0.8rem;">
                              <i class="fas fa-calendar-day" style="font-size:1.3rem; opacity:0.35; display:block; margin-bottom:6px;"></i>
                              No hay audiencias para el filtro seleccionado.
                           </div>`
                        : audienciasMostradas.map((a, i) => {
                            const estado = _estadoAud(a);
                            const estColor = estado === 'Gestionada' ? '#166534' : estado === 'Cumplida' ? '#64748b' : estado === 'Hoy' ? '#dc2626' : estado === 'Pendiente' ? '#2563eb' : '#d97706';
                            return `
                            <div style="padding:10px 12px; border:1px solid #dbeafe; border-radius:8px; margin-bottom:${i === audienciasMostradas.length - 1 ? '0' : '8px'}; border-left:3px solid #2563eb;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                                    <div>
                                        <div style="font-size:0.82rem; font-weight:700; color:#1e3a8a;">${escHtml(a.titulo || 'Audiencia')}</div>
                                        <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">
                                            ${a.fecha ? new Date(a.fecha).toLocaleDateString('es-CL') : 'Fecha por definir'}
                                            ${a.fuente ? ` · Fuente: ${escHtml(a.fuente)}` : ''}
                                        </div>
                                        ${a.waAlertadoEn ? `<div style="font-size:0.68rem; color:#0f766e; margin-top:2px;"><i class="fab fa-whatsapp"></i> WhatsApp enviado: ${new Date(a.waAlertadoEn).toLocaleString('es-CL')}</div>` : ''}
                                        ${a.detalle ? `<div style="font-size:0.72rem; color:#475569; margin-top:4px;">${escHtml(a.detalle)}</div>` : ''}
                                    </div>
                                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                                        <span style="font-size:0.68rem; background:${estColor}18; color:${estColor}; padding:2px 8px; border-radius:10px; font-weight:700; white-space:nowrap;">${estado}</span>
                                        <div style="display:flex; gap:5px;">
                                            ${a.gestionado ? '' : `<button class="btn btn-xs" data-dc-action="wa-alerta-audiencia" data-causa-id="${causaId}" data-evento-id="${a.id}"
                                                style="background:#ecfeff; color:#0f766e; border:none;" title="Enviar alerta por WhatsApp">
                                                <i class="fab fa-whatsapp"></i>
                                            </button>`}
                                            ${a.gestionado ? '' : `<button class="btn btn-xs" data-dc-action="gestionar-audiencia-ia" data-causa-id="${causaId}" data-evento-id="${a.id}"
                                                style="background:#f0fdf4; color:#166534; border:none;" title="Marcar audiencia como gestionada">
                                                <i class="fas fa-check"></i>
                                            </button>`}
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')
                    }
                </div>

                <!-- ── PRESCRIPCIÓN ── -->
                <div style="background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:16px;">
                    <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:12px;">
                        <i class="fas fa-hourglass-half" style="color:#d97706;"></i> Prescripción
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div>
                            <label style="font-size:0.72rem; color:#64748b; font-weight:600; display:block; margin-bottom:4px;">Fecha de prescripción</label>
                            <input type="date" id="dc-presc-fecha-${causaId}"
                                value="${causa.prescripcion.fecha || ''}"
                                data-dc-presc-autosave="${causaId}"
                                style="width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px;
                                       font-size:0.8rem; background:var(--bg-2,#f8fafc); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; color:#64748b; font-weight:600; display:block; margin-bottom:4px;">Tipo de prescripción</label>
                            <select id="dc-presc-tipo-${causaId}"
                                data-dc-presc-autosave="${causaId}"
                                style="width:100%; padding:7px; border:1px solid #e2e8f0; border-radius:7px;
                                       font-size:0.78rem; background:var(--bg-2,#f8fafc); box-sizing:border-box;">
                                <option value="">-- Seleccionar --</option>
                                <option ${causa.prescripcion.tipo === 'Extintiva' ? 'selected' : ''}>Extintiva</option>
                                <option ${causa.prescripcion.tipo === 'Adquisitiva' ? 'selected' : ''}>Adquisitiva</option>
                                <option ${causa.prescripcion.tipo === 'Acción penal' ? 'selected' : ''}>Acción penal</option>
                                <option ${causa.prescripcion.tipo === 'Acción civil' ? 'selected' : ''}>Acción civil</option>
                            </select>
                        </div>
                    </div>
                    <textarea id="dc-presc-obs-${causaId}"
                        placeholder="Observaciones sobre la prescripción..."
                        data-dc-presc-autosave="${causaId}"
                        style="width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:7px;
                               font-size:0.78rem; background:var(--bg-2,#f8fafc); resize:vertical;
                               min-height:60px; box-sizing:border-box; font-family:inherit;"
                    >${escHtml(causa.prescripcion.observaciones || '')}</textarea>
                    ${causa.prescripcion.fecha ? (() => {
                        const venc = new Date(causa.prescripcion.fecha + 'T12:00:00');
                        const hoy = new Date(); hoy.setHours(0,0,0,0);
                        const dias = Math.ceil((venc - hoy) / 86400000);
                        const color = dias < 0 ? '#dc2626' : dias <= 30 ? '#d97706' : '#059669';
                        const msg = dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? 'Vence hoy' : `Faltan ${dias} días`;
                        return `<div style="margin-top:10px; padding:8px 12px; background:${color}10;
                            border:1px solid ${color}30; border-radius:8px; font-size:0.78rem; color:${color}; font-weight:600;">
                            <i class="fas fa-${dias < 0 ? 'exclamation-circle' : dias <= 30 ? 'clock' : 'check-circle'}"></i> ${msg}
                        </div>`;
                    })() : ''}
                </div>
            </div>`;
        }

        window.dcCambiarInstancia = function(causaId, nuevaInstancia) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (causa.instancia === nuevaInstancia) return;
            if (!confirm(`¿Cambiar instancia a "${nuevaInstancia}"?`)) return;
            if (!causa.instancias) causa.instancias = [];
            causa.instancias.push({
                instancia: nuevaInstancia,
                tribunal: causa.juzgado || '',
                fecha: new Date().toISOString()
            });
            causa.instancia = nuevaInstancia;
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            if (typeof registrarEvento === 'function') registrarEvento(`Instancia actualizada: ${nuevaInstancia} — ${causa.caratula}`);
            dcRenderProceso(causaId);
        };

        window.dcAgregarInstancia = function(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            migAbrir({
                titulo: '<i class="fas fa-sitemap"></i> Registrar cambio de instancia',
                btnOk: 'Guardar',
                campos: [
                    { id: 'mig-inst', label: 'Instancia', valor: '', tipo: 'select',
                      opciones: ['Primera','Segunda','Corte Suprema'], requerido: true },
                    { id: 'mig-trib', label: 'Tribunal', valor: causa.juzgado || '', placeholder: 'Ej: Corte de Apelaciones de Santiago' },
                    { id: 'mig-fecha', label: 'Fecha', valor: new Date().toISOString().split('T')[0], tipo: 'date' }
                ],
                onOk: (vals) => {
                    if (!causa.instancias) causa.instancias = [];
                    causa.instancias.push({
                        instancia: vals['mig-inst'],
                        tribunal: vals['mig-trib'],
                        fecha: vals['mig-fecha']
                    });
                    causa.instancia = vals['mig-inst'];
                    if (typeof markAppDirty === 'function') markAppDirty();
                    _dcGuardar();
                    dcRenderProceso(causaId);
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('proceso', causaId), 50);
                }
            });
        };

        window.dcAgregarRecurso = function(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            migAbrir({
                titulo: '<i class="fas fa-undo"></i> Interponer Recurso',
                btnOk: 'Registrar',
                campos: [
                    { id: 'mig-rec-tipo', label: 'Tipo de recurso', tipo: 'select', requerido: true,
                      opciones: ['Apelación','Casación en la Forma','Casación en el Fondo','Nulidad','Reposición','Aclaración','Queja','Amparo'] },
                    { id: 'mig-rec-trib', label: 'Tribunal Superior', placeholder: 'Ej: Corte de Apelaciones de Santiago' },
                    { id: 'mig-rec-fecha', label: 'Fecha de interposición', tipo: 'date', valor: new Date().toISOString().split('T')[0] },
                    { id: 'mig-rec-estado', label: 'Estado', tipo: 'select',
                      opciones: ['Pendiente','En tramitación','Acogido','Rechazado'] },
                    { id: 'mig-rec-obs', label: 'Observaciones', placeholder: 'Fundamentos del recurso...' }
                ],
                onOk: (vals) => {
                    if (!causa.recursos) causa.recursos = [];
                    causa.recursos.push({
                        tipo:          vals['mig-rec-tipo'],
                        tribunal:      vals['mig-rec-trib'],
                        fecha:         vals['mig-rec-fecha'],
                        estado:        vals['mig-rec-estado'] || 'Pendiente',
                        observaciones: vals['mig-rec-obs']
                    });
                    if (typeof markAppDirty === 'function') markAppDirty();
                    _dcGuardar();
                    if (typeof registrarEvento === 'function') registrarEvento(`Recurso registrado: ${vals['mig-rec-tipo']} — ${causa.caratula}`);
                    dcRenderProceso(causaId);
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('proceso', causaId), 50);
                }
            });
        };

        window.dcEliminarRecurso = function(causaId, idx) {
            if (!confirm('¿Eliminar este recurso?')) return;
            const causa = _dcFindCausaById(causaId);
            if (!causa?.recursos) return;
            causa.recursos.splice(idx, 1);
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
        };

        window.dcCambiarFiltroAudienciasIA = function(causaId, filtro) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.audiencias || typeof causa.audiencias !== 'object') causa.audiencias = {};
            causa.audiencias.filtroVista = String(filtro || 'todas').toLowerCase();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
        };

        window.dcEnviarAlertaAudienciaWhatsApp = async function(causaId, eventoId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const ev = (causa.eventosProcesalesIA || []).find(e => String(e.id) === String(eventoId));
            if (!ev) return;
            if (ev.waAlertadoEn && !confirm('Esta audiencia ya fue alertada por WhatsApp. ¿Reenviar?')) return;
            if (!window.electronAPI?.whatsapp?.enviarAlertaA && !window.electronAPI?.whatsapp?.enviarAlerta) {
                if (typeof showError === 'function') showError('WhatsApp no está disponible en este entorno.');
                return;
            }

            const fecha = ev.fecha ? new Date(ev.fecha).toLocaleDateString('es-CL') : 'fecha por definir';
            const msg = `🔔 Audiencia detectada por IA\nCausa: ${causa.caratula || causa.cliente || causa.id}\nHito: ${ev.titulo || 'Audiencia'}\nFecha: ${fecha}${ev.detalle ? `\nDetalle: ${ev.detalle}` : ''}`;

            try {
                const cli = (DB.clientes || []).find(c => {
                    const nom = String(c?.nom || c?.nombre || '').trim().toLowerCase();
                    const cNom = String(causa?.cliente || '').trim().toLowerCase();
                    return nom && cNom && nom === cNom;
                });
                const tel = String(cli?.telefono || cli?.tel || cli?.whatsapp || '').replace(/[^\d]/g, '');
                let resp = null;
                if (tel && window.electronAPI?.whatsapp?.enviarAlertaA) {
                    resp = await window.electronAPI.whatsapp.enviarAlertaA(tel, msg);
                } else if (window.electronAPI?.whatsapp?.enviarAlerta) {
                    resp = await window.electronAPI.whatsapp.enviarAlerta(msg);
                } else {
                    if (typeof showError === 'function') showError('No hay teléfono del cliente ni destinatarios globales para WhatsApp.');
                    return;
                }
                if (resp?.ok) {
                    const nowIso = new Date().toISOString();
                    ev.waAlertadoEn = nowIso;
                    if (Array.isArray(DB.alertas)) {
                        DB.alertas.forEach(a => {
                            if (String(a.causaId) !== String(causa.id)) return;
                            if (String(a.tipo || '').toLowerCase() !== 'audiencia') return;
                            const sameFecha = !ev.fecha || String(a.fechaObjetivo || '') === String(ev.fecha || '');
                            const sameTitulo = String(a.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
                            if (sameFecha || sameTitulo) a.waAlertadoEn = nowIso;
                        });
                    }
                    if (typeof markAppDirty === 'function') markAppDirty();
                    _dcGuardar();
                    dcRenderProceso(causaId);
                    if (typeof showSuccess === 'function') showSuccess('Alerta de audiencia enviada por WhatsApp.');
                } else if (typeof showError === 'function') {
                    showError(resp?.error || 'No se pudo enviar alerta por WhatsApp.');
                }
            } catch (e) {
                if (typeof showError === 'function') showError(e?.message || 'No se pudo enviar alerta por WhatsApp.');
            }
        };

        window.dcMarcarAudienciaIAGestionada = function(causaId, eventoId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            const ev = (causa.eventosProcesalesIA || []).find(e => String(e.id) === String(eventoId));
            if (!ev || ev.gestionado) return;

            ev.gestionado = true;
            ev.gestionadoEn = new Date().toISOString();
            if (Array.isArray(DB.alertas)) {
                DB.alertas.forEach(a => {
                    if (String(a.causaId) !== String(causa.id)) return;
                    if (String(a.tipo || '').toLowerCase() !== 'audiencia') return;
                    const sameFecha = !ev.fecha || String(a.fechaObjetivo || '') === String(ev.fecha || '');
                    const sameTitulo = String(a.mensaje || '').toLowerCase().includes(String(ev.titulo || '').toLowerCase());
                    if (sameFecha || sameTitulo) a.estado = 'cerrada';
                });
            }

            causa.fechaUltimaActividad = new Date().toISOString();
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
            if (typeof showInfo === 'function') showInfo('Audiencia marcada como gestionada.');
        };

        window.dcGuardarPrescripcion = function(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.prescripcion) causa.prescripcion = {};
            causa.prescripcion.fecha        = document.getElementById(`dc-presc-fecha-${causaId}`)?.value || null;
            causa.prescripcion.tipo         = document.getElementById(`dc-presc-tipo-${causaId}`)?.value || null;
            causa.prescripcion.observaciones = document.getElementById(`dc-presc-obs-${causaId}`)?.value || '';
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
        };

        // ════════════════════════════════════════════════════════
        // ALIASES DE COMPATIBILIDAD
        // Exponer funciones clave a window para uso global (17-claude-legal.js y otros)
        // ════════════════════════════════════════════════════════
        window.abrirDetalleCausa  = abrirDetalleCausa;
        window.viewCausa          = abrirDetalleCausa;
        window.verCausa           = abrirDetalleCausa;
        window.verDetalleCausa    = abrirDetalleCausa;
        window.openCausa          = abrirDetalleCausa;
        window.goCausa            = abrirDetalleCausa;
        window.detalleCausa       = abrirDetalleCausa;
        window.dcAbrirModuloTramites = dcAbrirModuloTramites;
        window.dcCrearTramiteVinculado = dcCrearTramiteVinculado;
        window.dcRenderTramiteSeguimiento = dcRenderTramiteSeguimiento;
        window._dcConfirmarAccionSegura = _dcConfirmarAccionSegura;
        window.cerrarModal        = cerrarModal;
        window.abrirModal         = abrirModal;
        window.renderDetalleCausa = function(causaId) {
            const el = document.getElementById('detalle-causa-content');
            if (!causaId) {
                if (el) el.innerHTML = '<div class="empty-state card"><i class="fas fa-gavel"></i><p>Seleccione una causa.</p></div>';
                return;
            }
            abrirDetalleCausa(causaId);
        };

        // Botón cerrar fijo — siempre visible sobre el modal fullscreen
        function _inyectarBotonCerrarModal() {
            if (document.getElementById('modal-detalle-close-fixed')) return;
            const btn = document.createElement('button');
            btn.id = 'modal-detalle-close-fixed';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.title = 'Cerrar detalle de causa (Esc)';
            btn.style.display = 'none';
            btn.onclick = () => cerrarModal('modal-detalle');
            document.body.appendChild(btn);
            const modal = document.getElementById('modal-detalle');
            if (modal) {
                const observer = new MutationObserver(() => {
                    const isOpen = modal.classList.contains('open') || modal.style.display === 'flex' || modal.style.display === 'block';
                    btn.style.display = isOpen ? 'flex' : 'none';
                });
                observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
            }
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    const m = document.getElementById('modal-detalle');
                    if (m && (m.classList.contains('open') || m.style.display === 'flex' || m.style.display === 'block')) {
                        cerrarModal('modal-detalle');
                    }
                }
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _inyectarBotonCerrarModal);
        } else {
            _inyectarBotonCerrarModal();
        }

        window.dcGuardarPrescripcion = function(causaId) {
            const causa = _dcFindCausaById(causaId);
            if (!causa) return;
            if (!causa.prescripcion) causa.prescripcion = {};
            causa.prescripcion.fecha        = document.getElementById(`dc-presc-fecha-${causaId}`)?.value || null;
            causa.prescripcion.tipo         = document.getElementById(`dc-presc-tipo-${causaId}`)?.value || null;
            causa.prescripcion.observaciones = document.getElementById(`dc-presc-obs-${causaId}`)?.value || '';
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
        };

        // ════════════════════════════════════════════════════════
        // ALIASES DE COMPATIBILIDAD
        // Exponer funciones clave a window para uso global (17-claude-legal.js y otros)
        // ════════════════════════════════════════════════════════
        window.abrirDetalleCausa  = abrirDetalleCausa;
        window.viewCausa          = abrirDetalleCausa;
        window.verCausa           = abrirDetalleCausa;
        window.verDetalleCausa    = abrirDetalleCausa;
        window.openCausa          = abrirDetalleCausa;
        window.goCausa            = abrirDetalleCausa;
        window.detalleCausa       = abrirDetalleCausa;
        window.dcAbrirModuloTramites = dcAbrirModuloTramites;
        window.dcCrearTramiteVinculado = dcCrearTramiteVinculado;
        window.dcRenderTramiteSeguimiento = dcRenderTramiteSeguimiento;
        window._dcConfirmarAccionSegura = _dcConfirmarAccionSegura;
        window.cerrarModal        = cerrarModal;
        window.abrirModal         = abrirModal;
        window.renderDetalleCausa = function(causaId) {
            const el = document.getElementById('detalle-causa-content');
            if (!causaId) {
                if (el) el.innerHTML = '<div class="empty-state card"><i class="fas fa-gavel"></i><p>Seleccione una causa.</p></div>';
                return;
            }
            abrirDetalleCausa(causaId);
        };

        // Botón cerrar fijo — siempre visible sobre el modal fullscreen
        function _inyectarBotonCerrarModal() {
            if (document.getElementById('modal-detalle-close-fixed')) return;
            const btn = document.createElement('button');
            btn.id = 'modal-detalle-close-fixed';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.title = 'Cerrar detalle de causa (Esc)';
            btn.style.display = 'none';
            btn.onclick = () => cerrarModal('modal-detalle');
            document.body.appendChild(btn);
            const modal = document.getElementById('modal-detalle');
            if (modal) {
                const observer = new MutationObserver(() => {
                    const isOpen = modal.classList.contains('open') || modal.style.display === 'flex' || modal.style.display === 'block';
                    btn.style.display = isOpen ? 'flex' : 'none';
                });
                observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
            }
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    const m = document.getElementById('modal-detalle');
                    if (m && (m.classList.contains('open') || m.style.display === 'flex' || m.style.display === 'block')) {
                        cerrarModal('modal-detalle');
                    }
                }
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _inyectarBotonCerrarModal);
        } else {
            _inyectarBotonCerrarModal();
        }
