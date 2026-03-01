// ████████████████████████████████████████████████████████
// LEXIUM — js/23-propuestas-crm.js
// Módulo: Embudo Prospecto → Propuesta → Expediente
// ████████████████████████████████████████████████████████

'use strict';

// ── UI: Crear Prospecto v2 ────────────────────────────────
window.uiCrearProspecto = function () {
    const nombre = document.getElementById('pro-nom')?.value?.trim();
    const materia = document.getElementById('pro-mat')?.value?.trim();
    if (!nombre) { showError('Ingresa el nombre del prospecto.'); return; }

    const tipoHon = document.getElementById('pro-tipo-honorario')?.value || 'fijo';
    const honFijo = parseFloat(document.getElementById('pro-hon')?.value) || 0;
    const cuantia = parseFloat(document.getElementById('pro-cuantia')?.value) || 0;
    const pct = parseFloat(document.getElementById('pro-pct')?.value) || 0;

    crearProspecto({
        nombre,
        materia,
        descripcion: document.getElementById('pro-desc')?.value?.trim() || '',
        complejidad: document.getElementById('pro-comp')?.value || 'bajo',
        probabilidadCierre: parseInt(document.getElementById('pro-prob')?.value) || 50,
        estrategiaJuridica: document.getElementById('pro-estrategia')?.value?.trim() || '',
        tipoHonorario: tipoHon,
        honorarioPropuesto: tipoHon === 'fijo' ? honFijo : Math.round(cuantia * pct / 100),
        cuantiaLitigio: cuantia,
        porcentajeLitigio: pct,
    });

    // Limpiar form
    ['pro-nom', 'pro-mat', 'pro-desc', 'pro-estrategia', 'pro-hon', 'pro-cuantia', 'pro-pct']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('pro-prob').value = 50;
    _toggleTipoHonorario();
    showSuccess('✅ Prospecto creado correctamente.');
};

// ── UI: Toggle tipo honorario (fijo/variable) ─────────────
window._toggleTipoHonorario = function () {
    const tipo = document.getElementById('pro-tipo-honorario')?.value || 'fijo';
    const fijo = document.getElementById('bloque-hon-fijo');
    const variable = document.getElementById('bloque-hon-variable');
    if (fijo) fijo.style.display = tipo === 'fijo' ? 'block' : 'none';
    if (variable) variable.style.display = tipo === 'variable' ? 'block' : 'none';
};

// ── UI: Actualizar honorario calculado en tiempo real ─────
window._recalcularHonorarioVariable = function () {
    const cuantia = parseFloat(document.getElementById('pro-cuantia')?.value) || 0;
    const pct = parseFloat(document.getElementById('pro-pct')?.value) || 0;
    const total = Math.round(cuantia * pct / 100);
    const el = document.getElementById('pro-hon-calculado');
    if (el) el.textContent = '$' + total.toLocaleString('es-CL');
};

// ── Generar Propuesta Comercial ───────────────────────────
window.generarPropuesta = function (prospectoId) {
    const p = DB.prospectos.find(x => x.id === prospectoId);
    if (!p) return;

    const hoy = new Date();
    const vencimiento = new Date(hoy);
    vencimiento.setDate(vencimiento.getDate() + 15);

    p.propuesta = {
        generada: true,
        fechaGeneracion: hoy.toISOString(),
        fechaVencimiento: vencimiento.toISOString(),
        aceptada: false,
        rechazada: false,
    };

    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    renderProspectos();

    // Exportar PDF automáticamente
    exportarPropuestaPDF(prospectoId);
    showSuccess('✅ Propuesta generada. Válida por 15 días.');
};

// ── Exportar Propuesta como PDF ───────────────────────────
window.exportarPropuestaPDF = function (prospectoId) {
    const p = DB.prospectos.find(x => x.id === prospectoId);
    if (!p) return;

    const usuario = AppConfig.get('nombreUsuario') || 'Abogado/a';
    const estudio = AppConfig.get('nombreEstudio') || 'Estudio Jurídico';
    const hoy = new Date().toLocaleDateString('es-CL');
    const vence = p.propuesta?.fechaVencimiento
        ? new Date(p.propuesta.fechaVencimiento).toLocaleDateString('es-CL')
        : '—';

    const honDisplay = p.tipoHonorario === 'variable'
        ? `${p.porcentajeLitigio}% sobre cuantía de $${(p.cuantiaLitigio || 0).toLocaleString('es-CL')} = $${(p.honorarioPropuesto || 0).toLocaleString('es-CL')}`
        : `$${(p.honorarioPropuesto || 0).toLocaleString('es-CL')} (monto fijo)`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Propuesta Comercial — ${p.nombre}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a202c; background: #fff; }
  .header { background: linear-gradient(135deg, #1E3A5F 0%, #2E75B6 100%); color: white; padding: 40px 50px; }
  .header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
  .header .subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .badge-lexium { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;
                  font-size: 11px; display: inline-block; margin-bottom: 16px; }
  .body { padding: 40px 50px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 1px; color: #2E75B6; margin-bottom: 12px;
                   border-bottom: 2px solid #EBF3FB; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 10px 12px; border-bottom: 1px solid #F0F4F8; vertical-align: top; }
  td:first-child { font-weight: 600; color: #4A5568; width: 35%; }
  .honorario-box { background: linear-gradient(135deg, #EBF3FB, #DBEAFE);
                   border: 1px solid #BFDBFE; border-radius: 12px; padding: 20px 24px; }
  .honorario-monto { font-size: 32px; font-weight: 700; color: #1E3A5F; }
  .honorario-desc { font-size: 12px; color: #64748B; margin-top: 4px; }
  .vigencia-box { background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px;
                  padding: 12px 16px; font-size: 12px; color: #92400E; margin-top: 16px; }
  .footer { padding: 24px 50px; background: #F8FAFC; border-top: 1px solid #E2E8F0;
            font-size: 11px; color: #94A3B8; }
  .estrategia-box { background: #F0FDF4; border-left: 3px solid #10B981;
                    padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 13px;
                    line-height: 1.6; color: #065F46; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div class="badge-lexium">⚖️ LEXIUM — Gestión Legal Inteligente</div>
  <h1>Propuesta de Servicios Jurídicos</h1>
  <div class="subtitle">Emitida por ${usuario} · ${estudio} · ${hoy}</div>
</div>
<div class="body">
  <div class="section">
    <div class="section-title">I. Antecedentes del Cliente</div>
    <table>
      <tr><td>Nombre / Razón Social</td><td>${p.nombre}</td></tr>
      <tr><td>Materia</td><td>${p.materia || '—'}</td></tr>
      <tr><td>Complejidad estimada</td><td>${p.complejidad || '—'}</td></tr>
    </table>
  </div>
  ${p.descripcion ? `
  <div class="section">
    <div class="section-title">II. Descripción del Caso</div>
    <p style="font-size:13px;line-height:1.7;color:#374151;">${p.descripcion}</p>
  </div>` : ''}
  ${p.estrategiaJuridica ? `
  <div class="section">
    <div class="section-title">III. Estrategia Jurídica Propuesta</div>
    <div class="estrategia-box">${p.estrategiaJuridica}</div>
  </div>` : ''}
  <div class="section">
    <div class="section-title">IV. Honorarios Profesionales</div>
    <div class="honorario-box">
      <div class="honorario-monto">$${(p.honorarioPropuesto || 0).toLocaleString('es-CL')}</div>
      <div class="honorario-desc">${honDisplay}</div>
    </div>
    <div class="vigencia-box">
      ⏳ Esta propuesta tiene vigencia de <strong>15 días corridos</strong>
      a partir del ${new Date(p.propuesta?.fechaGeneracion || new Date()).toLocaleDateString('es-CL')}.
      <strong>Vence el ${vence}.</strong>
    </div>
  </div>
  <div class="section">
    <div class="section-title">V. Condiciones Generales</div>
    <table>
      <tr><td>Modalidad</td><td>${p.tipoHonorario === 'variable' ? 'Honorario variable (% sobre cuantía)' : 'Honorario fijo acordado'}</td></tr>
      <tr><td>Vigencia oferta</td><td>15 días desde emisión</td></tr>
      <tr><td>Profesional a cargo</td><td>${usuario}</td></tr>
    </table>
  </div>
</div>
<div class="footer">
  Documento generado por LEXIUM · ${hoy} · ${usuario} — ${estudio}<br>
  Este documento es una propuesta comercial confidencial. No constituye contrato ni opinión legal formal.
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Propuesta_${p.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── UI: Modal aceptar propuesta ───────────────────────────
window.uiAceptarPropuesta = function (prospectoId) {
    const p = DB.prospectos.find(x => x.id === prospectoId);
    if (!p) return;

    // Verificar vigencia
    if (p.propuesta?.fechaVencimiento) {
        if (new Date() > new Date(p.propuesta.fechaVencimiento)) {
            if (!confirm('⚠️ La propuesta venció el ' +
                new Date(p.propuesta.fechaVencimiento).toLocaleDateString('es-CL') +
                '.\n¿Deseas aceptarla de todas formas?')) return;
        }
    }

    const tipo = confirm(
        '¿Qué tipo de expediente se creará?\n\n' +
        'Aceptar → Gestión Judicial\n' +
        'Cancelar → Otros Trámites'
    ) ? 'judicial' : 'tramite';

    convertirACliente(prospectoId, tipo);
};

// ── UI: Render Prospectos extendido ───────────────────────
window.renderProspectos = function () {
    const el = document.getElementById('listaProspectos');
    if (!el) return;

    const prospectos = DB.prospectos || [];
    if (!prospectos.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-funnel-dollar"></i><p>Sin prospectos.</p></div>';
        return;
    }

    // Resumen económico
    const resEl = document.getElementById('resumenEconomico');
    if (resEl) {
        const total = prospectos.reduce((s, p) => s + (p.honorarioPropuesto || 0), 0);
        const activos = prospectos.filter(p => p.estado !== 'Aceptado' && p.estado !== 'Rechazado').length;
        const conv = prospectos.length
            ? Math.round(prospectos.filter(p => p.estado === 'Aceptado').length / prospectos.length * 100) : 0;
        resEl.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
            <div style="text-align:center;padding:10px;background:var(--bg-2);border-radius:8px;">
              <div style="font-size:20px;font-weight:700;color:var(--p)">$${total.toLocaleString('es-CL')}</div>
              <div style="font-size:11px;color:var(--text-3)">Pipeline total</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-2);border-radius:8px;">
              <div style="font-size:20px;font-weight:700;color:var(--success)">${conv}%</div>
              <div style="font-size:11px;color:var(--text-3)">Tasa conversión</div>
            </div>
          </div>`;
    }

    const fmtCLP = n => '$' + (n || 0).toLocaleString('es-CL');
    const hoy = new Date();

    el.innerHTML = prospectos.map(p => {
        const vence = p.propuesta?.fechaVencimiento ? new Date(p.propuesta.fechaVencimiento) : null;
        const vencida = vence && hoy > vence && !p.propuesta?.aceptada;
        const estadoColor = p.estado === 'Aceptado' ? '#10B981' : p.estado === 'Rechazado' ? '#EF4444' : '#F59E0B';

        return `
        <div class="card" style="margin-bottom:14px;border-left:4px solid ${estadoColor};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-weight:700;font-size:15px;">${p.nombre}</div>
              <div style="font-size:12px;color:var(--text-3);">${p.materia || '—'} · ${p.complejidad || '—'}</div>
            </div>
            <span style="background:${estadoColor}20;color:${estadoColor};padding:3px 10px;
                  border-radius:20px;font-size:11px;font-weight:600;">${p.estado}</span>
          </div>
          ${p.descripcion ? `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">${p.descripcion}</p>` : ''}
          <div style="display:flex;gap:16px;font-size:13px;margin-bottom:10px;">
            <span><strong>Honorario:</strong> ${fmtCLP(p.honorarioPropuesto)}</span>
            <span><strong>Cierre:</strong> ${p.probabilidadCierre || 50}%</span>
          </div>
          ${p.propuesta?.generada ? `
            <div style="font-size:11px;padding:6px 10px;background:${vencida ? '#FEF2F2' : '#EFF6FF'};
                 border-radius:6px;margin-bottom:8px;color:${vencida ? '#EF4444' : '#2563A8'};">
              📄 Propuesta ${vencida ? '<strong>VENCIDA</strong>' : 'vigente'} hasta ${vence?.toLocaleDateString('es-CL') || '—'}
            </div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${p.estado !== 'Aceptado' && p.estado !== 'Rechazado' ? `
              <button class="btn btn-sm" onclick="generarPropuesta(${p.id})" style="background:var(--bg-2);">
                <i class="fas fa-file-invoice"></i> ${p.propuesta?.generada ? 'Re-generar' : 'Generar'} Propuesta</button>
              ${p.propuesta?.generada ? `
              <button class="btn btn-p btn-sm" onclick="uiAceptarPropuesta(${p.id})">
                <i class="fas fa-check-circle"></i> Aceptar</button>
              <button class="btn btn-sm" onclick="rechazarPropuesta(${p.id})"
                      style="background:#FEF2F2;color:#EF4444;">
                <i class="fas fa-times-circle"></i> Rechazar</button>` : ''}` : ''}
            ${p.propuesta?.generada ? `
            <button class="btn btn-sm" onclick="exportarPropuestaPDF(${p.id})" style="background:var(--bg-2);">
              <i class="fas fa-download"></i> Descargar PDF</button>` : ''}
          </div>
        </div>`;
    }).join('');
};

// ── Rechazar propuesta ────────────────────────────────────
window.rechazarPropuesta = function (prospectoId) {
    const p = DB.prospectos.find(x => x.id === prospectoId);
    if (!p) return;
    if (!confirm('¿Marcar esta propuesta como rechazada?')) return;
    p.estado = 'Rechazado';
    if (p.propuesta) p.propuesta.rechazada = true;
    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
    renderProspectos();
};

// ── Render: Estado de Cuenta de Expediente ────────────────
window.renderExpedienteFinanciero = function (causaId) {
    const el = document.getElementById('exp-estado-cuenta');
    if (!el) return;
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;

    const hon = causa.honorarios || {};
    const cuotas = hon.cuotas || [];
    const pagado = cuotas.filter(q => q.pagada).reduce((s, q) => s + (q.monto || 0), 0);
    const pendiente = cuotas.filter(q => !q.pagada).reduce((s, q) => s + (q.monto || 0), 0);
    const hoy = new Date();

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div style="text-align:center;padding:12px;background:#F0FDF4;border-radius:10px;">
          <div style="font-size:22px;font-weight:700;color:#10B981;">$${pagado.toLocaleString('es-CL')}</div>
          <div style="font-size:11px;color:#065F46;">Pagado</div>
        </div>
        <div style="text-align:center;padding:12px;background:#FEF2F2;border-radius:10px;">
          <div style="font-size:22px;font-weight:700;color:#EF4444;">$${pendiente.toLocaleString('es-CL')}</div>
          <div style="font-size:11px;color:#7F1D1D;">Pendiente</div>
        </div>
        <div style="text-align:center;padding:12px;background:#EFF6FF;border-radius:10px;">
          <div style="font-size:22px;font-weight:700;color:#2563A8;">$${(hon.montoBase || 0).toLocaleString('es-CL')}</div>
          <div style="font-size:11px;color:#1E3A5F;">Total acordado</div>
        </div>
      </div>
      ${cuotas.length ? `
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <thead><tr style="background:#F8FAFC;">
          <th style="padding:8px;text-align:left;border-bottom:1px solid #E2E8F0;">Descripción</th>
          <th style="padding:8px;text-align:right;border-bottom:1px solid #E2E8F0;">Monto</th>
          <th style="padding:8px;text-align:center;border-bottom:1px solid #E2E8F0;">Vencimiento</th>
          <th style="padding:8px;text-align:center;border-bottom:1px solid #E2E8F0;">Estado</th>
          <th style="padding:8px;border-bottom:1px solid #E2E8F0;"></th>
        </tr></thead>
        <tbody>
        ${cuotas.map(q => {
        const vencida = !q.pagada && new Date(q.fechaVencimiento) < hoy;
        return `<tr style="border-bottom:1px solid #F0F4F8;${vencida ? 'background:#FFF5F5;' : ''}">
              <td style="padding:8px;">${q.descripcion}</td>
              <td style="padding:8px;text-align:right;font-weight:600;">$${(q.monto || 0).toLocaleString('es-CL')}</td>
              <td style="padding:8px;text-align:center;color:${vencida ? '#EF4444' : 'inherit'};">
                ${q.fechaVencimiento || '—'}</td>
              <td style="padding:8px;text-align:center;">
                <span style="padding:2px 8px;border-radius:20px;font-size:11px;
                      background:${q.pagada ? '#D1FAE5' : '#FEE2E2'};color:${q.pagada ? '#065F46' : '#7F1D1D'};">
                  ${q.pagada ? '✅ Pagada' : '⏳ Pendiente'}</span></td>
              <td style="padding:8px;">
                ${!q.pagada ? `<button class="btn btn-sm btn-p" onclick="uiPagarCuota('${causaId}','${q.id}')">
                  Registrar pago</button>` : ''}
                ${q.comprobante ? `<button class="btn btn-sm" onclick="verComprobante('${q.id}')"
                  style="background:var(--bg-2);">Ver</button>` : ''}
              </td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>` : '<p style="color:var(--text-3);font-size:13px;">Sin cuotas registradas.</p>'}
      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="btn btn-sm" onclick="uiAgregarCuota('${causaId}')"
                style="background:var(--bg-2);"><i class="fas fa-plus"></i> Agregar cuota</button>
        <button class="btn btn-sm btn-p" onclick="exportarInformeConsolidado('${causaId}')">
          <i class="fas fa-file-pdf"></i> Informe consolidado</button>
      </div>`;
};

// ── UI: Registrar pago de cuota con comprobante ───────────
window.uiPagarCuota = function (causaId, cuotaId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { pagarCuota(causaId, cuotaId, {}); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            pagarCuota(causaId, cuotaId, {
                comprobante: ev.target.result,
                fechaPago: new Date().toISOString().slice(0, 10),
            });
            showSuccess('✅ Pago registrado con comprobante.');
            renderExpedienteFinanciero(causaId);
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

// ── UI: Agregar cuota ─────────────────────────────────────
window.uiAgregarCuota = function (causaId) {
    const monto = parseFloat(prompt('Monto de la cuota ($):') || '0');
    if (!monto) return;
    const fecha = prompt('Fecha de vencimiento (AAAA-MM-DD):',
        new Date().toISOString().slice(0, 10));
    if (!fecha) return;
    const desc = prompt('Descripción (ej: Honorarios 1ª cuota):') || 'Cuota de honorarios';
    registrarCuota(causaId, { monto, fechaVencimiento: fecha, descripcion: desc });
    showSuccess('✅ Cuota registrada.');
    renderExpedienteFinanciero(causaId);
    // Crear alerta en calendario
    DB.alertas.push({
        id: generarID(),
        causaId,
        tipo: 'pago',
        prioridad: 'alta',
        estado: 'activa',
        mensaje: `Cobro pendiente: ${desc} — $${monto.toLocaleString('es-CL')}`,
        fechaObjetivo: fecha,
        _cobro: true,
        alertaEnviadaWA: false,
    });
    if (typeof markAppDirty === 'function') markAppDirty();
    guardarDB();
};

// ── Exportar Informe Consolidado PDF ─────────────────────
window.exportarInformeConsolidado = function (causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;
    const hon = causa.honorarios || {};
    const cuotas = hon.cuotas || [];
    const pagado = cuotas.filter(q => q.pagada).reduce((s, q) => s + (q.monto || 0), 0);
    const pendiente = cuotas.filter(q => !q.pagada).reduce((s, q) => s + (q.monto || 0), 0);
    const usuario = AppConfig.get('nombreUsuario') || 'Abogado/a';
    const hoy = new Date().toLocaleDateString('es-CL');
    const docsCli = causa.documentosCliente || causa.documentos || [];
    const docsTri = causa.documentosTribunal || [];

    const html = \`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Informe Consolidado — \${causa.caratula}</title>
<style>
  body{font-family:Georgia,serif;max-width:820px;margin:40px auto;color:#1a202c;font-size:13px;line-height:1.7;}
  .header{background:linear-gradient(135deg,#1E3A5F,#2E75B6);color:#fff;padding:32px 40px;border-radius:8px 8px 0 0;}
  h1{font-size:22px;margin:0;}
  .meta{font-size:11px;opacity:.8;margin-top:4px;}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#2E75B6;margin:24px 0 8px;
     border-bottom:1px solid #EBF3FB;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  td,th{padding:7px 10px;border:1px solid #E2E8F0;font-size:12px;}
  th{background:#F7FAFC;font-weight:600;}
  .verde{color:#059669;} .rojo{color:#DC2626;} .ambar{color:#D97706;}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;
          font-size:10px;color:#94A3B8;text-align:center;}
  @media print{body{margin:20px;}}
</style></head><body>
<div class="header">
  <div style="font-size:11px;opacity:.7;margin-bottom:8px;">⚖️ LEXIUM — Gestión Legal Inteligente</div>
  <h1>Informe Consolidado de Causa</h1>
  <div class="meta">Generado el \${hoy} · Por: \${usuario}</div>
</div>
<h2>I. Antecedentes Generales</h2>
<table>
  <tr><th>Carátula</th><td>\${causa.caratula}</td></tr>
  <tr><th>Procedimiento</th><td>\${causa.tipoProcedimiento||'—'}</td></tr>
  <tr><th>Tipo</th><td>\${causa.tipoExpediente==='tramite'?'Trámite':'Gestión Judicial'}</td></tr>
  <tr><th>Estado</th><td>\${causa.estadoGeneral||'—'}</td></tr>
  <tr><th>Instancia</th><td>\${causa.instancia||'Primera'}</td></tr>
  <tr><th>Avance</th><td>\${causa.porcentajeAvance||0}%</td></tr>
</table>
<h2>II. Últimos Movimientos</h2>
<table><thead><tr><th>Etapa</th><th>Estado</th></tr></thead><tbody>
\${(causa.etapasProcesales||[]).slice(-5).map(e=>\`
  <tr><td>\${e.nombre||e.etapa||'—'}</td>
  <td class="\${e.completada?'verde':'ambar'}">\${e.completada?'✅ Completada':'⏳ Pendiente'}</td></tr>\`
).join('')}
</tbody></table>
<h2>III. Estado de Cuenta</h2>
<table>
  <tr><th>Total Acordado</th><td><strong>$\${(hon.montoBase||0).toLocaleString('es-CL')}</strong></td></tr>
  <tr><th>Pagado</th><td class="verde">$\${pagado.toLocaleString('es-CL')}</td></tr>
  <tr><th>Pendiente</th><td class="\${pendiente>0?'rojo':'verde'}">$\${pendiente.toLocaleString('es-CL')}</td></tr>
</table>
\${cuotas.length?\`
<table><thead><tr><th>Cuota</th><th>Monto</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>
\${cuotas.map(q=>\`<tr>
  <td>\${q.descripcion}</td>
  <td>$\${(q.monto||0).toLocaleString('es-CL')}</td>
  <td>\${q.fechaVencimiento||'—'}</td>
  <td class="\${q.pagada?'verde':'rojo'}">\${q.pagada?'Pagada':'Pendiente'}</td>
</tr>\`).join('')}
</tbody></table>\`:\`\`}
<h2>IV. Documentos Cliente (\${docsCli.length})</h2>
\${docsCli.length?\`<table><thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th></tr></thead><tbody>
\${docsCli.map(d=>\`<tr><td>\${d.nombre||d.nombreOriginal||'—'}</td><td>\${d.tipo||'—'}</td><td>\${d.fecha||d.fechaDocumento||'—'}</td></tr>\`).join('')}
</tbody></table>\`:'<p style="color:#94A3B8;">Sin documentos del cliente.</p>'}
<h2>V. Documentos Tribunal (\${docsTri.length})</h2>
\${docsTri.length?\`<table><thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th></tr></thead><tbody>
\${docsTri.map(d=>\`<tr><td>\${d.nombre||d.nombreOriginal||'—'}</td><td>\${d.tipo||'—'}</td><td>\${d.fecha||d.fechaDocumento||'—'}</td></tr>\`).join('')}
</tbody></table>\`:'<p style="color:#94A3B8;">Sin documentos del tribunal.</p>'}
<div class="footer">
  LEXIUM · \${hoy} · \${usuario} — Documento de uso interno exclusivo.
</div>
</body></html>\`;

    const blob = new Blob([html],{type:'text/html;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = \`Informe_\${causa.caratula.replace(/\\s+/g,'_')}_\${new Date().toISOString().slice(0,10)}.html\`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
};

console.info('[LEXIUM] 23-propuestas-crm.js ✓');
