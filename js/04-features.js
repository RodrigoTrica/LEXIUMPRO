function setBusqFiltro(filtro, btn) {
    busqFiltroActual = filtro;
    document.querySelectorAll('#busq-filtros .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    busquedaGlobal(document.getElementById('busq-input').value);
}

function busquedaGlobal(texto) {
    const el = document.getElementById('busq-resultados');
    if (!el) return;
    if (!texto || texto.length < 2) { el.innerHTML = '<p style="font-size:0.83rem; color:var(--t2); padding:10px;">Ingrese al menos 2 caracteres.</p>'; return; }
    const t = texto.toLowerCase();
    let resultados = [];

    if (busqFiltroActual === 'todo' || busqFiltroActual === 'causas') {
        DB.causas.filter(c => c.caratula?.toLowerCase().includes(t) || c.tipoProcedimiento?.toLowerCase().includes(t) || c.rama?.toLowerCase().includes(t))
            .forEach(c => resultados.push({ tipo: 'Causa', color: '#dbeafe', colorT: '#1e40af', titulo: c.caratula, sub: `${c.tipoProcedimiento} · ${c.estadoGeneral}`, accion: `abrirDetalleCausa(${c.id})` }));
    }
    if (busqFiltroActual === 'todo' || busqFiltroActual === 'clientes') {
        DB.clientes.filter(c => c.nom?.toLowerCase().includes(t) || c.nombre?.toLowerCase().includes(t) || c.rut?.toLowerCase().includes(t))
            .forEach(c => resultados.push({ tipo: 'Cliente', color: '#dcfce7', colorT: '#166534', titulo: c.nom || c.nombre, sub: c.rut || '', accion: `tab('clientes', null)` }));
    }
    if (busqFiltroActual === 'todo' || busqFiltroActual === 'documentos') {
        DB.causas.forEach(causa => {
            causa.documentos?.filter(d => d.nombreOriginal?.toLowerCase().includes(t) || d.tipo?.toLowerCase().includes(t) || d.descripcion?.toLowerCase().includes(t))
                .forEach(d => resultados.push({ tipo: 'Doc', color: '#fef3c7', colorT: '#92400e', titulo: d.nombreOriginal, sub: `${causa.caratula} · ${d.tipo}`, accion: `abrirDetalleCausa(${causa.id})` }));
        });
        DB.documentos?.filter(d => d.nombreSistema?.toLowerCase().includes(t) || d.descripcion?.toLowerCase().includes(t))
            .forEach(d => resultados.push({ tipo: 'Doc', color: '#fef3c7', colorT: '#92400e', titulo: d.nombreSistema, sub: d.descripcion || '', accion: `tab('archivos', null)` }));
    }
    if (busqFiltroActual === 'todo' || busqFiltroActual === 'juris') {
        DB.jurisprudencia.filter(j => j.rol?.toLowerCase().includes(t) || j.materia?.toLowerCase().includes(t) || j.temaCentral?.toLowerCase().includes(t) || j.ext?.toLowerCase().includes(t))
            .forEach(j => resultados.push({ tipo: 'Juris', color: '#ede9fe', colorT: '#5b21b6', titulo: j.rol, sub: j.materia || j.cat || '', accion: `tab('juris', null)` }));
    }

    if (!resultados.length) { el.innerHTML = '<p style="font-size:0.83rem; color:var(--t2); padding:10px;">Sin resultados para "<strong>' + escHtml(texto) + '</strong>".</p>'; return; }

    el.innerHTML = `<p style="font-size:0.75rem; color:var(--t2); margin-bottom:8px;">${resultados.length} resultado(s)</p>` +
        resultados.map(r => `
            <div class="search-result-item" onclick="${r.accion}">
                <span class="sr-type" style="background:${r.color}; color:${r.colorT};">${r.tipo}</span>
                <div><div class="sr-title">${escHtml(r.titulo || '')}</div><div class="sr-sub">${escHtml(r.sub || '')}</div></div>
            </div>`).join('');
}

// ─── 6. CONTROL DE PRESCRIPCIÓN ──────────────────────────────────
const PRESCRIPCION_PLAZOS = {
    'Civil': { años: 5, label: 'Acción ordinaria civil (Art. 2515 CC)' },
    'Ejecutivo': { años: 3, label: 'Acción ejecutiva (Art. 2515 CC)' },
    'Laboral': { años: 2, label: 'Acciones laborales (Art. 510 CT)' },
    'Familia': { años: 5, label: 'Acciones de familia (general)' },
    'Penal': { años: 10, label: 'Crímenes (Art. 94 CP - referencial)' }
};

function renderPrescripcion() {
    const el = document.getElementById('prescripcion-lista');
    if (!el) return;
    if (!DB.causas.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-hourglass"></i><p>Sin causas para analizar.</p></div>'; return; }
    const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0);
    el.innerHTML = DB.causas.map(causa => {
        const rama = causa.rama || 'Civil';
        const plazo = PRESCRIPCION_PLAZOS[rama] || PRESCRIPCION_PLAZOS['Civil'];
        const fechaCreacion = new Date(causa.fechaCreacion);
        const fechaPrescripcion = new Date(fechaCreacion);
        fechaPrescripcion.setFullYear(fechaPrescripcion.getFullYear() + plazo.años);
        const diasRestantes = Math.ceil((fechaPrescripcion - hoyDate) / 86400000);
        const vencida = diasRestantes < 0;
        const urgente = diasRestantes >= 0 && diasRestantes <= 180;
        return `<div class="prescripcion-card ${vencida ? 'vencida' : ''}">
            <div class="pc-head">
                <span><i class="fas fa-gavel"></i> ${escHtml(causa.caratula)}</span>
                <span style="font-family:'IBM Plex Mono',monospace; color:${vencida ? 'var(--d)' : urgente ? 'var(--w)' : 'var(--s)'};">
                    ${vencida ? '⚠️ VENCIDA' : `${diasRestantes} días`}
                </span>
            </div>
            <p style="margin-top:4px;">${plazo.label} · ${plazo.años} años</p>
            <p style="color:var(--t2); font-size:0.78rem;">Inicio: ${fechaCreacion.toLocaleDateString('es-CL')} → Prescripción: <strong>${fechaPrescripcion.toLocaleDateString('es-CL')}</strong></p>
            <p style="font-size:0.72rem; color:var(--t2); margin-top:4px;"><i class="fas fa-exclamation-circle"></i> Plazo referencial. Verificar con normativa vigente y hechos específicos.</p>
        </div>`;
    }).join('');
}

// ─── 7. RECURSOS PROCESALES (segunda instancia) ───────────────────
function uiInterponerRecurso() {
    const causaId = parseInt(document.getElementById('rec-causa-sel').value);
    const tipo = document.getElementById('rec-tipo').value;
    const fecha = document.getElementById('rec-fecha').value;
    const tribunal = document.getElementById('rec-tribunal').value.trim();
    const obs = document.getElementById('rec-obs').value.trim();
    if (!causaId) { showError('Seleccione una causa.'); return; }
    if (!fecha) { showError('Ingrese la fecha de interposición.'); return; }
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    if (!causa.recursos) causa.recursos = [];
    causa.recursos.push({ id: generarID(), tipo, fecha, tribunal, observaciones: obs, estado: 'Interpuesto' });
    causa.instancia = 'Segunda';
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
    registrarEvento(`Recurso de ${tipo} interpuesto — ${causa.caratula}`);
    crearAlerta({ causaId, tipo: 'procesal', mensaje: `Recurso de ${tipo} interpuesto. Pendiente resolución.`, prioridad: 'alta' });
    ['rec-fecha', 'rec-tribunal', 'rec-obs'].forEach(id => document.getElementById(id).value = '');
    renderRecursos(); renderAll();
}

function renderRecursos() {
    const el = document.getElementById('recursos-lista');
    if (!el) return;
    const todos = DB.causas.filter(c => c.recursos?.length).flatMap(c =>
        c.recursos.map(r => ({ ...r, caratula: c.caratula, causaId: c.id }))
    ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (!todos.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-undo"></i><p>Sin recursos interpuestos.</p></div>'; return; }
    el.innerHTML = todos.map(r => `
        <div class="card" style="margin-bottom:10px; font-size:0.83rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${escHtml(r.tipo)}</strong>
                <span class="badge badge-w">${escHtml(r.estado)}</span>
            </div>
            <p style="color:var(--t2); margin-top:3px;">${escHtml(r.caratula)}</p>
            <p style="margin-top:3px;">Fecha: ${r.fecha} ${r.tribunal ? `· ${escHtml(r.tribunal)}` : ''}</p>
            ${r.observaciones ? `<p style="color:var(--t2); margin-top:3px; font-style:italic;">${escHtml(r.observaciones)}</p>` : ''}
        </div>`).join('');
}

// ─── 8. ASOCIAR JURISPRUDENCIA A CAUSA ───────────────────────────
let _jurisCausaTarget = null;

function uiAbrirBuscarJuris(causaId) {
    _jurisCausaTarget = causaId;
    document.getElementById('modal-juris-input').value = '';
    document.getElementById('modal-juris-resultados').innerHTML = '<p style="font-size:0.83rem; color:var(--t2);">Ingrese texto para buscar.</p>';
    cerrarModal('modal-detalle');
    abrirModal('modal-buscar-juris');
}

function uiBuscarJuris(texto) {
    const el = document.getElementById('modal-juris-resultados');
    if (!texto || texto.length < 2) { el.innerHTML = '<p style="font-size:0.83rem; color:var(--t2);">Ingrese al menos 2 caracteres.</p>'; return; }
    const resultados = buscarJurisprudencia(texto);
    const causa = DB.causas.find(c => c.id === _jurisCausaTarget);
    if (!resultados.length) { el.innerHTML = '<p style="font-size:0.83rem; color:var(--t2);">Sin resultados.</p>'; return; }
    el.innerHTML = resultados.map(j => {
        const yaAsoc = causa?.jurisprudenciaAsociada?.includes(j.id);
        return `<div class="card" style="margin-bottom:10px; font-size:0.83rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${escHtml(j.tribunal)} — Rol ${escHtml(j.rol)}</strong>
                <span class="badge ${j.tendencia === 'Favorable' ? 'badge-s' : j.tendencia === 'Desfavorable' ? 'badge-d' : 'badge-a'}">${j.tendencia}</span>
            </div>
            <p style="color:var(--t2); margin-top:3px;">${escHtml(j.materia)} · ${escHtml(j.temaCentral || '')}</p>
            <button class="btn ${yaAsoc ? 'btn-d' : 'btn-p'} btn-sm" style="margin-top:8px;" onclick="uiAsociarJuris(${j.id})">
                <i class="fas fa-${yaAsoc ? 'unlink' : 'link'}"></i> ${yaAsoc ? 'Desasociar' : 'Asociar a Causa'}
            </button>
        </div>`;
    }).join('');
}

function uiAsociarJuris(jurisId) {
    if (!_jurisCausaTarget) return;
    const causa = DB.causas.find(c => c.id === _jurisCausaTarget);
    if (!causa) return;
    if (!causa.jurisprudenciaAsociada) causa.jurisprudenciaAsociada = [];
    if (causa.jurisprudenciaAsociada.includes(jurisId)) {
        causa.jurisprudenciaAsociada = causa.jurisprudenciaAsociada.filter(id => id !== jurisId);
        const j = DB.jurisprudencia.find(x => x.id === jurisId);
        if (j) j.asociadaACausas = j.asociadaACausas.filter(id => id !== _jurisCausaTarget);
    } else {
        asociarJurisprudenciaACausa(_jurisCausaTarget, jurisId);
    }
    evaluarImpactoJurisprudencial(_jurisCausaTarget);
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
    registrarEvento(`Jurisprudencia ${jurisId} modificada en causa ${causa.caratula}`);
    uiBuscarJuris(document.getElementById('modal-juris-input').value);
}

// ─── 9. DUPLICAR CAUSA ───────────────────────────────────────────
function uiDuplicarCausa(causaId) {
    const original = DB.causas.find(c => c.id === causaId);
    if (!original) return;
    if (!confirm(`¿Duplicar la causa "${original.caratula}"?\nSe creará una copia con las mismas etapas pero sin documentos ni pagos.`)) return;
    const copia = {
        ...JSON.parse(JSON.stringify(original)),
        id: generarID(),
        caratula: original.caratula + ' (copia)',
        fechaCreacion: new Date(),
        fechaUltimaActividad: new Date(),
        porcentajeAvance: 0,
        estadoGeneral: 'En tramitación',
        documentos: [],
        recursos: [],
        honorarios: {},
        alertas: [],
        etapasProcesales: generarEtapas(original.tipoProcedimiento)
    };
    DB.causas.push(copia);
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
    registrarEvento(`Causa duplicada: ${original.caratula} → ${copia.caratula}`);
    renderAll();
    cerrarModal('modal-detalle');
    showSuccess(`Causa duplicada como "${copia.caratula}"`);
}

// ─── 10. ARCHIVAR ALERTA ─────────────────────────────────────────
function archivarAlerta(alertaId) {
    const alerta = DB.alertas.find(a => a.id === alertaId);
    if (!alerta) return;
    alerta.estado = 'archivada';
    if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); renderCalendario(); renderAll();
}

// renderCalendario() — única def activa abajo

// ─── 11. NOTIFICAR PLAZOS CRÍTICOS AL LOGIN ───────────────────────
function notificarPlazosCriticos() {
    const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0);
    const manana = new Date(hoyDate); manana.setDate(manana.getDate() + 1);
    const criticos = [];

    // Alertas del sistema
    DB.alertas.filter(a => a.estado === 'activa').forEach(a => {
        const fa = new Date(a.fechaObjetivo); fa.setHours(0, 0, 0, 0);
        if (fa <= manana) {
            const causa = DB.causas.find(c => c.id === a.causaId);
            criticos.push({ mensaje: a.mensaje, fecha: fa.toLocaleDateString('es-CL'), causa: causa?.caratula || '—', tipo: a.tipo });
        }
    });

    // Documentos con plazo
    DB.causas.forEach(causa => {
        causa.documentos?.forEach(doc => {
            if (doc.generaPlazo && doc.fechaVencimiento) {
                const fv = new Date(doc.fechaVencimiento); fv.setHours(0, 0, 0, 0);
                if (fv <= manana) criticos.push({ mensaje: doc.nombreOriginal || doc.descripcion, fecha: fv.toLocaleDateString('es-CL'), causa: causa.caratula, tipo: 'plazo' });
            }
        });
    });
    DB.documentos?.forEach(doc => {
        if (doc.generaPlazo && doc.fechaVencimiento) {
            const fv = new Date(doc.fechaVencimiento); fv.setHours(0, 0, 0, 0);
            if (fv <= manana) {
                const causa = DB.causas.find(c => c.id === doc.causaId);
                criticos.push({ mensaje: doc.descripcion || doc.nombreSistema, fecha: fv.toLocaleDateString('es-CL'), causa: causa?.caratula || '—', tipo: 'plazo' });
            }
        }
    });

    if (!criticos.length) return;
    document.getElementById('modal-plazos-content').innerHTML = criticos.map(c => `
        <div class="alert-critica-modal">
            <div class="ac-head"><i class="fas fa-exclamation-circle"></i>${escHtml(c.mensaje)}</div>
            <p>Causa: <strong>${escHtml(c.causa)}</strong> · Vence: <strong>${c.fecha}</strong> · Tipo: ${c.tipo}</p>
        </div>`).join('');
    abrirModal('modal-plazos-criticos');
}

// ─── 12. GENERAR INFORME DE CAUSA ────────────────────────────────
function previewInforme() {
    document.getElementById('informe-content').innerHTML = '';
}

function generarInformeCausa() {
    const causaId = parseInt(document.getElementById('inf-causa-sel').value);
    if (!causaId) { showError('Seleccione una causa.'); return; }
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    evaluarRiesgoIntegral(causaId);
    const rec = generarRecomendaciones(causaId);
    const hon = causa.honorarios || {};
    const hoy = new Date().toLocaleDateString('es-CL');
    const colorR = v => v === 'Alto' ? '#dc2626' : v === 'Medio' ? '#d97706' : '#059669';

    document.getElementById('informe-content').innerHTML = `
        <div style="border:1px solid var(--border); border-radius:10px; padding:24px; font-size:0.85rem; line-height:1.6;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid var(--p);">
                <div>
                    <h2 style="font-size:1.2rem; margin-bottom:4px;">INFORME DE CAUSA</h2>
                    <h3 style="font-size:1rem; color:var(--a);">${escHtml(causa.caratula)}</h3>
                </div>
                <div style="text-align:right; font-size:0.75rem; color:var(--t2); font-family:'IBM Plex Mono',monospace;">
                    <p>AppBogado v3.9.5</p><p>Generado: ${hoy}</p>
                </div>
            </div>

            <h4 style="margin-bottom:8px; color:var(--p);">I. ANTECEDENTES GENERALES</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.83rem;">
                ${[['Carátula', causa.caratula], ['Procedimiento', causa.tipoProcedimiento], ['Rama', causa.rama || '—'], ['Estado', causa.estadoGeneral], ['Instancia', causa.instancia], ['Avance', causa.porcentajeAvance + '%'], ['Fecha Creación', new Date(causa.fechaCreacion).toLocaleDateString('es-CL')]].map(([k, v]) =>
        `<tr><td style="padding:5px 8px; background:#f8fafc; font-weight:600; width:35%; border:1px solid #e2e8f0;">${k}</td><td style="padding:5px 8px; border:1px solid #e2e8f0;">${escHtml(String(v))}</td></tr>`
    ).join('')}
            </table>

            <h4 style="margin-bottom:8px; color:var(--p);">II. ETAPAS PROCESALES</h4>
            <div style="margin-bottom:16px;">
                ${(causa.etapasProcesales || []).map((e, i) =>
        `<div style="display:flex; gap:8px; padding:4px 0; border-bottom:1px solid #f1f5f9; font-size:0.82rem;">
                        <span style="color:${e.completada ? '#059669' : '#94a3b8'}; font-size:0.8rem;">${e.completada ? '✓' : '○'}</span>
                        <span style="${e.completada ? 'text-decoration:line-through; color:#94a3b8;' : ''}">${i + 1}. ${escHtml(e.nombre)}</span>
                        ${e.fecha ? `<span style="margin-left:auto; font-size:0.72rem; color:#94a3b8;">${new Date(e.fecha).toLocaleDateString('es-CL')}</span>` : ''}
                    </div>`).join('')}
            </div>

            <h4 style="margin-bottom:8px; color:var(--p);">III. EVALUACIÓN DE RIESGO</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.83rem;">
                ${Object.entries(causa.riesgo || {}).map(([k, v]) =>
            `<tr><td style="padding:5px 8px; background:#f8fafc; font-weight:600; width:35%; border:1px solid #e2e8f0; text-transform:capitalize;">${k}</td><td style="padding:5px 8px; border:1px solid #e2e8f0; color:${colorR(v)}; font-weight:700;">${v}</td></tr>`
        ).join('')}
            </table>

            <h4 style="margin-bottom:8px; color:var(--p);">IV. DOCUMENTOS (${(causa.documentos || []).length})</h4>
            <div style="margin-bottom:16px;">
                ${(causa.documentos || []).map(d =>
            `<div style="padding:4px 0; border-bottom:1px solid #f1f5f9; font-size:0.82rem; display:flex; justify-content:space-between;">
                        <span>${escHtml(d.nombreOriginal)}</span>
                        <span style="color:#94a3b8;">${d.fechaDocumento ? new Date(d.fechaDocumento).toLocaleDateString('es-CL') : ''} ${d.generaPlazo && d.fechaVencimiento ? `· Vence: ${new Date(d.fechaVencimiento).toLocaleDateString('es-CL')}` : ''}</span>
                    </div>`).join('') || '<p style="color:#94a3b8;">Sin documentos.</p>'}
            </div>

            <h4 style="margin-bottom:8px; color:var(--p);">V. HONORARIOS</h4>
            ${hon.montoBase ? `
                <p>Monto Base: <strong>$${hon.montoBase.toLocaleString('es-CL')}</strong></p>
                <p>Total Pagado: <strong style="color:#059669;">$${(hon.montoBase - hon.saldoPendiente).toLocaleString('es-CL')}</strong></p>
                <p>Saldo Pendiente: <strong style="color:#dc2626;">$${hon.saldoPendiente.toLocaleString('es-CL')}</strong></p>
            ` : '<p style="color:#94a3b8;">Sin honorarios asignados.</p>'}

            <h4 style="margin-top:16px; margin-bottom:8px; color:var(--p);">VI. RECOMENDACIONES ESTRATÉGICAS</h4>
            ${rec.length ? `<ul style="padding-left:18px;">${rec.map(r => `<li style="margin-bottom:4px;">${escHtml(r)}</li>`).join('')}</ul>`
            : '<p style="color:#94a3b8;">Sin recomendaciones activas.</p>'}

            <div style="margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:0.72rem; color:#94a3b8;">
                <p><strong>AVISO LEGAL:</strong> Este informe es de uso interno profesional. Los plazos, riesgos y recomendaciones son referenciales y no reemplazan el criterio jurídico del abogado. AppBogado no es responsable de decisiones tomadas con base en este documento.</p>
            </div>
        </div>`;
    registrarEvento(`Informe generado para causa: ${causa.caratula}`);
}

// ─── 13. EXPORTAR INFORME TEXTO ───────────────────────────────────
function exportarInformeTexto() {
    const causaId = parseInt(document.getElementById('inf-causa-sel').value);
    if (!causaId) { showError('Genere primero el informe.'); return; }
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    const hon = causa.honorarios || {};
    const rec = generarRecomendaciones(causaId);
    let txt = `INFORME DE CAUSA — AppBogado v3.9.5\n`;
    txt += `Generado: ${new Date().toLocaleDateString('es-CL')}\n`;
    txt += `${'='.repeat(50)}\n\n`;
    txt += `CARÁTULA: ${causa.caratula}\n`;
    txt += `PROCEDIMIENTO: ${causa.tipoProcedimiento}\n`;
    txt += `ESTADO: ${causa.estadoGeneral} | INSTANCIA: ${causa.instancia}\n`;
    txt += `AVANCE: ${causa.porcentajeAvance}%\n\n`;
    txt += `ETAPAS PROCESALES:\n`;
    (causa.etapasProcesales || []).forEach((e, i) => { txt += `  ${e.completada ? '[✓]' : '[ ]'} ${i + 1}. ${e.nombre}\n`; });
    txt += `\nRIESGO:\n`;
    Object.entries(causa.riesgo || {}).forEach(([k, v]) => { txt += `  ${k}: ${v}\n`; });
    txt += `\nDOCUMENTOS (${(causa.documentos || []).length}):\n`;
    (causa.documentos || []).forEach(d => { txt += `  - ${d.nombreOriginal} (${d.tipo})\n`; });
    txt += `\nHONORARIOS:\n`;
    txt += hon.montoBase ? `  Base: $${hon.montoBase.toLocaleString('es-CL')}\n  Pendiente: $${hon.saldoPendiente.toLocaleString('es-CL')}\n` : '  Sin honorarios asignados.\n';
    txt += `\nRECOMENDACIONES:\n`;
    rec.forEach(r => { txt += `  • ${r}\n`; });
    txt += `\n${'='.repeat(50)}\nAVISO: Documento referencial de uso interno profesional.\n`;

    const blob = new Blob([txt], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Informe_${causa.caratula.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click(); URL.revokeObjectURL(url);
    registrarEvento(`Informe exportado: ${causa.caratula}`);
}

// ─── 14. CALCULAR PRESCRIPCIÓN POR CAUSA ─────────────────────────
function calcularPrescripcion(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return null;
    const rama = causa.rama || 'Civil';
    const plazo = PRESCRIPCION_PLAZOS[rama] || PRESCRIPCION_PLAZOS['Civil'];
    const fechaCreacion = new Date(causa.fechaCreacion);
    const fechaPrescripcion = new Date(fechaCreacion);
    fechaPrescripcion.setFullYear(fechaPrescripcion.getFullYear() + plazo.años);
    const diasRestantes = Math.ceil((fechaPrescripcion - new Date()) / 86400000);
    return { fechaPrescripcion, diasRestantes, plazo, vencida: diasRestantes < 0 };
}

// ─── 15. RENDER DASHBOARD actualiza causas con acceso a detalle ───
// Sobreescribe renderDashboard para incluir botón "Ver Detalle"
// renderDashboard() — única def activa abajo
// ═══════════════════════════════════════════════════════════════════

let gaCurrentCausa = null;
let gaCurrentFolder = 'all';
let gaCurrentFilter = 'all';
let gaStagedFiles = [];
let gaView = 'list'; // 'list' | 'timeline'

// Estructura lógica de carpetas
const GA_FOLDERS = [
    { id: 'all', label: 'Todos los Documentos', icon: 'fa-layer-group', color: '#64748b' },
    { id: '01_Demanda', label: '01 · Demanda', icon: 'fa-file-alt', color: '#3b82f6' },
    { id: '02_Resoluciones', label: '02 · Resoluciones', icon: 'fa-gavel', color: '#8b5cf6' },
    { id: '03_Notificaciones', label: '03 · Notificaciones', icon: 'fa-bell', color: '#f59e0b' },
    { id: '04.1_Prueba_Documental', label: '04.1 · Prueba Documental', icon: 'fa-file-invoice', color: '#10b981' },
    { id: '04.2_Prueba_Testimonial', label: '04.2 · Prueba Testimonial', icon: 'fa-microphone', color: '#10b981' },
    { id: '04.3_Prueba_Pericial', label: '04.3 · Prueba Pericial', icon: 'fa-flask', color: '#10b981' },
    { id: '05_Escritos_Propios', label: '05 · Escritos Propios', icon: 'fa-pen', color: '#3b82f6' },
    { id: '06_Escritos_Contraparte', label: '06 · Escritos Contraparte', icon: 'fa-user-slash', color: '#ef4444' },
    { id: '07_Recursos', label: '07 · Recursos', icon: 'fa-undo', color: '#f97316' },
    { id: '08_Sentencia', label: '08 · Sentencia', icon: 'fa-balance-scale', color: '#1d4ed8' },
    { id: '09_Ejecucion', label: '09 · Ejecución', icon: 'fa-stamp', color: '#0f172a' }
];

// Frases clave de IA sugerente (detección de plazos)
const IA_PHRASES = [
    { re: /traslado.*?(\d+)\s*d[ií]a/i, dias: null, msg: p => `Se detecta "traslado" — posible plazo de ${p[1]} día(s). Confirmar.` },
    { re: /rec[ií]base.*?prueba/i, dias: 20, msg: () => 'Se detecta "Recíbese la causa a prueba" — posible término probatorio de 20 días (CPC). Confirmar.' },
    { re: /c[ií]tese.*?sentencia/i, dias: null, msg: () => 'Se detecta "Cítese a oír sentencia" — causa en estado de fallo. Sin plazo activo.' },
    { re: /apelaci[oó]n.*?(\d+)\s*d[ií]a/i, dias: null, msg: p => `Se detecta "apelación" con posible plazo de ${p[1]} día(s). Confirmar.` },
];

function gaSelectCausa() {
    const id = parseInt(document.getElementById('ga-causa-sel').value);
    const causa = DB.causas.find(c => c.id === id) || null;
    gaCurrentCausa = causa;
    gaCurrentFolder = 'all';
    gaCurrentFilter = 'all';

    document.getElementById('ga-no-causa').style.display = causa ? 'none' : 'block';
    document.getElementById('ga-main').style.display = causa ? 'block' : 'none';
    document.getElementById('ga-upload-btn').disabled = !causa;

    if (causa) { gaRenderFolders(); gaRenderDocs(); gaRenderTimeline(); gaRenderPlazoAlerts(); }
}

function gaToggleView() {
    // Toggle between list and layout views
    const btn = document.getElementById('ga-view-btn');
    const area = document.getElementById('ga-doc-area');
    if (area.style.display === 'none') { area.style.display = ''; btn.innerHTML = '<i class="fas fa-stream"></i>'; }
    else { area.style.display = 'none'; btn.innerHTML = '<i class="fas fa-th-large"></i>'; }
}

function gaRenderFolders() {
    if (!gaCurrentCausa) return;
    const docs = DB.documentos.filter(d => d.causaId === gaCurrentCausa.id);
    document.getElementById('ga-folder-list').innerHTML = GA_FOLDERS.map(f => {
        const count = f.id === 'all' ? docs.length : docs.filter(d => d.etapaProcesal === f.id).length;
        return `<div class="folder-item ${gaCurrentFolder === f.id ? 'active' : ''}" onclick="gaSetFolder('${f.id}')">
            <i class="fas ${f.icon}" style="color:${f.color}"></i>
            <span>${f.label}</span>
            <span class="folder-count">${count}</span>
        </div>`;
    }).join('');
}

function gaSetFolder(folderId) {
    gaCurrentFolder = folderId;
    gaCurrentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn').classList.add('active');
    gaRenderFolders();
    gaRenderDocs();
}

function gaFilter(type, btn) {
    gaCurrentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gaRenderDocs();
}

function gaGetFilteredDocs() {
    if (!gaCurrentCausa) return [];
    let docs = DB.documentos.filter(d => d.causaId === gaCurrentCausa.id);
    if (gaCurrentFolder !== 'all') docs = docs.filter(d => d.etapaProcesal === gaCurrentFolder);
    if (gaCurrentFilter === 'plazo') docs = docs.filter(d => d.generaPlazo);
    else if (gaCurrentFilter === 'prob') docs = docs.filter(d => d.impactoProbatorio);
    else if (gaCurrentFilter === 'strat') docs = docs.filter(d => d.impactoEstrategico);
    else if (gaCurrentFilter === 'crit') docs = docs.filter(d => d.impactoCritico);
    return docs.sort((a, b) => b.fechaDocumento.localeCompare(a.fechaDocumento));
}

function gaRenderDocs() {
    const docs = gaGetFilteredDocs();
    const folder = GA_FOLDERS.find(f => f.id === gaCurrentFolder);
    document.getElementById('ga-folder-title').textContent = folder ? folder.label : 'Todos los documentos';

    if (!docs.length) {
        document.getElementById('ga-items').innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-folder-open"></i><p>Sin documentos en esta carpeta.</p></div>';
        return;
    }

    document.getElementById('ga-items').innerHTML = docs.map(d => {
        const ext = (d.nombreOriginal || '').split('.').pop().toLowerCase();
        const iconCls = ext === 'pdf' ? 'pdf' : (ext === 'doc' || ext === 'docx') ? 'doc' : (ext === 'png' || ext === 'jpg' || ext === 'jpeg') ? 'img' : 'gen';
        const iconName = iconCls === 'pdf' ? 'fa-file-pdf' : iconCls === 'doc' ? 'fa-file-word' : iconCls === 'img' ? 'fa-file-image' : 'fa-file';

        const tags = [
            d.generaPlazo ? `<span class="doc-tag dt-plazo">⏰ Plazo</span>` : '',
            d.impactoProbatorio ? `<span class="doc-tag dt-prob">🔍 Probatorio</span>` : '',
            d.impactoEstrategico ? `<span class="doc-tag dt-strat">💡 Estratégico</span>` : '',
            d.impactoCritico ? `<span class="doc-tag dt-crit">🔴 Crítico</span>` : ''
        ].filter(Boolean).join(' ');

        const plazoInfo = d.generaPlazo && d.fechaVencimiento
            ? `<span style="color:var(--d); font-family:'IBM Plex Mono',monospace; font-size:0.72rem;">Vence: ${d.fechaVencimiento}</span>` : '';

        return `<div class="doc-item">
            <div class="doc-icon ${iconCls}"><i class="fas ${iconName}"></i></div>
            <div class="doc-meta">
                <div class="doc-name" title="${escHtml(d.nombreSistema)}">${escHtml(d.nombreSistema)}</div>
                <div class="doc-sub">
                    <span>${escHtml(d.tipo)} · ${escHtml(d.subtipo)}</span>
                    <span style="color:#cbd5e1">|</span>
                    <span>${escHtml(d.fechaDocumento)}</span>
                    ${plazoInfo}
                    ${tags}
                </div>
                ${d.descripcion ? `<div style="font-size:0.75rem; color:var(--t2); margin-top:3px;">${escHtml(d.descripcion)}</div>` : ''}
                ${d.iaSummary ? `<div style="font-size:0.75rem; color:var(--cyan); margin-top:4px; font-style:italic;"><i class="fas fa-robot"></i> <strong>IA:</strong> ${escHtml(d.iaSummary)}</div>` : ''}
                ${d.driveWebLink ? `<div style="margin-top:6px;"><a href="${d.driveWebLink}" target="_blank" style="font-size:0.72rem; color:#4285f4; text-decoration:none;"><i class="fab fa-google-drive"></i> Ver en Google Drive</a></div>` : ''}
            </div>
            <div class="doc-actions">
                <button class="btn btn-d btn-sm" onclick="gaDeleteDoc(${d.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function gaRenderTimeline() {
    if (!gaCurrentCausa) return;
    const docs = DB.documentos
        .filter(d => d.causaId === gaCurrentCausa.id)
        .sort((a, b) => a.fechaDocumento.localeCompare(b.fechaDocumento));

    if (!docs.length) {
        document.getElementById('ga-timeline').innerHTML = '<div class="empty-state"><i class="fas fa-stream"></i><p>Sin documentos indexados.</p></div>';
        return;
    }

    const colorMap = { 'Resolución': '#8b5cf6', 'Escrito Propio': '#3b82f6', 'Escrito Contraparte': '#ef4444', 'Sentencia': '#1d4ed8', 'Prueba Documental': '#10b981', 'Recurso': '#f97316' };

    document.getElementById('ga-timeline').innerHTML = docs.map((d, i) => {
        const bg = colorMap[d.tipo] || '#64748b';
        return `<div class="tl-item">
            ${i < docs.length - 1 ? '<div class="tl-line"></div>' : ''}
            <div class="tl-dot" style="background:${bg}">${i + 1}</div>
            <div class="tl-body">
                <div class="tl-date">${d.fechaDocumento}</div>
                <div class="tl-name">${escHtml(d.nombreSistema)}</div>
                <div class="tl-desc">${escHtml(d.tipo)} · ${escHtml(d.descripcion || '')}${d.generaPlazo ? ` — <span style="color:var(--d)">Vence: ${d.fechaVencimiento}</span>` : ''}</div>
            </div>
        </div>`;
    }).join('');
}

function gaRenderPlazoAlerts() {
    if (!gaCurrentCausa) return;
    const docs = DB.documentos.filter(d => d.causaId === gaCurrentCausa.id && d.generaPlazo && d.fechaVencimiento);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!docs.length) {
        document.getElementById('ga-plazos-alertas').innerHTML = '<div class="empty-state"><i class="fas fa-check"></i><p>Sin plazos activos para esta causa.</p></div>';
        return;
    }

    document.getElementById('ga-plazos-alertas').innerHTML = docs.map(d => {
        const venc = new Date(d.fechaVencimiento + 'T12:00:00');
        const diff = Math.ceil((venc - today) / 86400000);
        const urgente = diff <= 2;
        const status = diff < 0 ? `<span style="color:var(--d)">VENCIDO hace ${Math.abs(diff)} días</span>` : `Faltan <strong>${diff} día(s)</strong>`;
        return `<div class="plazo-alert ${urgente ? 'urgente' : ''}">
            <div class="pa-head">
                <span>${escHtml(d.descripcion || d.tipo)}</span>
                <span>${status}</span>
            </div>
            <div class="pa-date">Vencimiento: ${d.fechaVencimiento} · ${d.diasPlazo} días ${d.tipoDia || 'hábiles'}</div>
            <div style="font-size:0.75rem; color:var(--t2); margin-top:4px; font-family:'IBM Plex Mono',monospace;">${escHtml(d.nombreSistema)}</div>
        </div>`;
    }).sort((a, b) => a.localeCompare ? 0 : 0).join('');
}

// ─── File Input Handler ───────────────────────────────────────────
// ─── File Input Handler ───────────────────────────────────────────
// (Movido a setupEventListeners)

function gaShowForm() {
    if (!gaStagedFiles.length) return;
    document.getElementById('ga-form').classList.add('visible');
    document.getElementById('ga-staged-files').innerHTML =
        gaStagedFiles.map(f => `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; margin-right:4px; font-size:0.78rem;"><i class="fas fa-file"></i> ${escHtml(f.name)}</span>`).join('');
    document.getElementById('ga-fecha-doc').value = new Date().toISOString().split('T')[0];
    document.getElementById('ga-genera-plazo').checked = false;
    document.getElementById('ga-plazo-extra').classList.remove('visible');
    document.getElementById('ga-ia-hint').classList.remove('visible');
    document.getElementById('ga-desc').value = '';
    // IA: detect from filename
    gaIAHintFromName(gaStagedFiles[0].name);
}

function gaIAHintFromName(fname) {
    const lower = fname.toLowerCase();
    for (const ph of IA_PHRASES) {
        const match = lower.match(ph.re);
        if (match) {
            const hint = document.getElementById('ga-ia-hint');
            hint.classList.add('visible');
            document.getElementById('ga-ia-text').innerHTML = `<strong>Sugerencia IA:</strong> ${ph.msg(match)}`;
            if (ph.dias) {
                document.getElementById('ga-genera-plazo').checked = true;
                document.getElementById('ga-plazo-extra').classList.add('visible');
                document.getElementById('ga-dias').value = ph.dias;
                gaPreviewPlazo();
            }
            break;
        }
    }
}

function gaTogglePlazo() {
    const checked = document.getElementById('ga-genera-plazo').checked;
    document.getElementById('ga-plazo-extra').classList.toggle('visible', checked);
    if (checked) gaPreviewPlazo();
}

function gaPreviewPlazo() {
    const dias = parseInt(document.getElementById('ga-dias').value) || 0;
    const tipo = document.getElementById('ga-tipo-dia').value;
    const fechaDoc = document.getElementById('ga-fecha-doc').value;
    if (!dias || !fechaDoc) { document.getElementById('ga-plazo-preview').innerText = ''; return; }

    const venc = calcVencimiento(fechaDoc, dias, tipo);
    document.getElementById('ga-plazo-preview').innerText = `Vencimiento estimado: ${venc}`;
}

function calcVencimiento(fechaInicio, dias, tipo) {
    const start = new Date(fechaInicio + 'T12:00:00');
    let count = 0;
    let cur = new Date(start);
    if (tipo === 'corridos') {
        cur.setDate(cur.getDate() + dias);
    } else {
        while (count < dias) {
            cur.setDate(cur.getDate() + 1);
            if (cur.getDay() !== 0) count++;
        }
    }
    return cur.toISOString().split('T')[0];
}

async function gaGuardarDoc() {
    if (!gaCurrentCausa) { showError("Seleccione una causa."); return; }
    if (!gaStagedFiles.length) { showError("No hay archivos seleccionados."); return; }

    const tipo = document.getElementById('ga-tipo').value;
    const subtipo = document.getElementById('ga-subtipo').value;
    const etapa = document.getElementById('ga-etapa').value;
    const fechaDoc = document.getElementById('ga-fecha-doc').value;
    const desc = document.getElementById('ga-desc').value.trim();
    const generaPlazo = document.getElementById('ga-genera-plazo').checked;
    const diasPlazo = generaPlazo ? parseInt(document.getElementById('ga-dias').value) : null;
    const tipoDia = generaPlazo ? document.getElementById('ga-tipo-dia').value : null;
    const impProb = document.getElementById('ga-imp-prob').checked;
    const impStrat = document.getElementById('ga-imp-strat').checked;
    const impCrit = document.getElementById('ga-imp-crit').checked;

    if (!fechaDoc) { showError("Ingrese la fecha del documento."); return; }
    if (generaPlazo && !diasPlazo) { showError("Ingrese los días del plazo."); return; }

    const processingDiv = document.createElement('div');
    processingDiv.id = 'ga-processing-overlay';
    processingDiv.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; backdrop-filter:blur(3px);";
    processingDiv.innerHTML = `<div style="background:var(--bg-card); padding:30px; border-radius:15px; text-align:center; color:var(--text); max-width:400px; width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <i class="fas fa-circle-notch fa-spin" style="font-size:3rem; color:var(--cyan); margin-bottom:15px;"></i>
                <h3 style="margin-bottom:10px;">Procesando Documentos</h3>
                <div id="ga-proc-status" style="font-size:0.9rem; color:var(--text-2); margin-bottom:15px;">Iniciando pipeline de IA y Drive...</div>
                <div style="background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
                    <div id="ga-proc-bar" style="width:0%; height:100%; background:var(--cyan); transition:width 0.3s;"></div>
                </div>
            </div>`;
    document.body.appendChild(processingDiv);

    const updateStatus = (text, pct) => {
        document.getElementById('ga-proc-status').innerText = text;
        document.getElementById('ga-proc-bar').style.width = pct + '%';
    };

    const logic = async () => {
        try {
            const existentes = DB.documentos.filter(d => d.causaId === gaCurrentCausa.id && d.etapaProcesal === etapa);
            let correlativo = existentes.length + 1;
            const totalFiles = gaStagedFiles.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = gaStagedFiles[i];
                const stepBase = (i / totalFiles) * 100;
                updateStatus(`Procesando: ${file.name} (${i + 1}/${totalFiles})`, stepBase + 10);

                const fechaStr = fechaDoc.replace(/-/g, '');
                const tipoCorto = tipo.replace(/\s+/g, '').substring(0, 12);
                const descCorto = (desc || 'Documento').replace(/\s+/g, '').substring(0, 20);
                const nombreSistema = `${fechaStr}_${tipoCorto}_${String(correlativo).padStart(3, '0')}_${descCorto}${getExt(file.name)}`;
                const fechaVenc = generaPlazo ? calcVencimiento(fechaDoc, diasPlazo, tipoDia) : null;

                let driveData = null;
                let iaSummary = null;

                // 1. Upload to Drive if connected
                if (window.GoogleDrive && GoogleDrive.isConnected()) {
                    updateStatus(`Subiendo a Drive: ${file.name}`, stepBase + 20);
                    const buffer = await file.arrayBuffer();
                    driveData = await GoogleDrive.uploadBinaryFile(buffer, nombreSistema, file.type);
                }

                // 2. IA Analysis if key exists
                try {
                    const hasIA = !!(await iaGetKey(iaGetProvider()));
                    if (hasIA) {
                        updateStatus(`Analizando con IA: ${file.name}`, stepBase + 50);
                        if (file.type === 'application/pdf') {
                            // Reuse PDF extraction logic if necessary - here we'll just use a brief prompt for now
                            // unless we want to load pdf.js here too. For simplicity in gaGuardarDoc, we assume
                            // IA knows about filename and description.
                            const prompt = `Analiza este documento cargado en AppBogado.\nNombre: ${file.name}\nTipo: ${tipo}\nSubtipo: ${subtipo}\nDescripción: ${desc}\nGenera un resumen breve (2 líneas) y confirma si la clasificación es correcta. Responde solo con el resumen.`;
                            iaSummary = await iaCall(prompt);
                        } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
                            const text = await file.text();
                            const prompt = `Resume este documento:\n${text.substring(0, 2000)}`;
                            iaSummary = await iaCall(prompt);
                        }
                    }
                } catch (iaErr) {
                    console.warn("IA Error in gaGuardarDoc:", iaErr);
                }

                DB.documentos.push({
                    id: uid(),
                    causaId: gaCurrentCausa.id,
                    nombreOriginal: file.name,
                    nombreSistema,
                    tipo, subtipo, etapa,
                    etapaProcesal: etapa,
                    fechaDocumento: fechaDoc,
                    descripcion: desc,
                    generaPlazo,
                    diasPlazo,
                    tipoDia,
                    fechaVencimiento: fechaVenc,
                    impactoProbatorio: impProb,
                    impactoEstrategico: impStrat,
                    impactoCritico: impCrit,
                    fechaCarga: new Date().toISOString().split('T')[0],
                    // Drive & IA info
                    driveFileId: driveData?.id || null,
                    driveWebLink: driveData?.webViewLink || null,
                    iaSummary: iaSummary || null
                });
                correlativo++;
            }

            gaStagedFiles = [];
            document.getElementById('file-input').value = '';
            document.getElementById('ga-form').classList.remove('visible');
            if (typeof markAppDirty === "function") markAppDirty(); save();
            renderAll();
            gaRenderFolders();
            gaRenderDocs();
            gaRenderTimeline();
            gaRenderPlazoAlerts();
            showSuccess(`✅ ${totalFiles} documento(s) procesado(s) correctamente.`);

        } catch (err) {
            showError("Error al guardar documentos: " + err.message);
        } finally {
            processingDiv.remove();
        }
    };

    if (generaPlazo) {
        showConfirm(
            "Confirmar Plazo",
            `Se calculará vencimiento de ${diasPlazo} días ${tipoDia} desde ${fechaDoc}.\n\nLa responsabilidad del cálculo es del abogado. ¿Confirmar?`,
            logic
        );
    } else {
        await logic();
    }
}

function gaCancelForm() {
    gaStagedFiles = [];
    document.getElementById('file-input').value = '';
    document.getElementById('ga-form').classList.remove('visible');
    document.getElementById('ga-ia-hint').classList.remove('visible');
}

function gaDeleteDoc(id) {
    showConfirm("Eliminar Documento", "¿Eliminar este documento del índice?", () => {
        DB.documentos = DB.documentos.filter(d => d.id !== id);
        if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
        gaRenderFolders(); gaRenderDocs(); gaRenderTimeline(); gaRenderPlazoAlerts();
    }, 'danger');
}

function getExt(fname) {
    const parts = fname.split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
}
function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════
// BLOQUES 1-8 INTEGRADOS – APPBOGADO PRO EXTENDED ENGINE
