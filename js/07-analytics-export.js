        // ═══════════════════════════════════════════════════════════════════════

        function exportarPDFCausa(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) { showError('Seleccione una causa.'); return; }
            const r = causa.riesgo || {};
            const f = causa.estrategia?.ficha || {};
            const docs = DB.documentos.filter(d => d.causaId === causaId);
            const prob = f.probabilidadExito;
            const hon = causa.honorarios || {};
            const pagado = (hon.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);

            const html = `<!DOCTYPE html><html><head><title>Informe — ${causa.caratula}</title>
    <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #1a1a2e; font-size: 14px; line-height: 1.7; }
        h1 { font-size: 22px; border-bottom: 3px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 6px; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #4a5568; margin: 24px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
        td, th { padding: 7px 10px; border: 1px solid #e2e8f0; text-align: left; }
        th { background: #f7fafc; font-weight: 600; }
        .rojo { color: #c53030; } .verde { color: #276749; } .ambar { color: #b7791f; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #718096; }
        @media print { body { margin: 20px; } }




    </style></head><body>
    <h1>INFORME DE CAUSA</h1>
    <p style="color:#718096; font-size:12px; margin-bottom:20px;">Generado el ${new Date().toLocaleDateString('es-CL')} · AppBogado v3.9.5</p>
    <h2>I. Antecedentes Generales</h2>
    <table><tr><th>Carátula</th><td>${causa.caratula}</td></tr>
    <tr><th>Procedimiento</th><td>${causa.tipoProcedimiento || '—'}</td></tr>
    <tr><th>Rama</th><td>${causa.rama || '—'}</td></tr>
    <tr><th>Estado</th><td>${causa.estadoGeneral || '—'}</td></tr>
    <tr><th>Instancia</th><td>${causa.instancia || 'Primera'}</td></tr>
    <tr><th>Avance</th><td>${causa.porcentajeAvance || 0}%</td></tr>
    <tr><th>RUT</th><td>${causa.rut || '—'}</td></tr></table>
    <h2>II. Evaluación de Riesgo</h2>
    <table><thead><tr><th>Dimensión</th><th>Nivel</th></tr></thead><tbody>
    ${Object.entries(r).map(([k, v]) => `<tr><td style="text-transform:capitalize">${k}</td><td class="${v === 'Alto' ? 'rojo' : v === 'Medio' ? 'ambar' : 'verde'}">${v}</td></tr>`).join('')}
    </tbody></table>
    ${f.hechos ? `<h2>III. Teoría del Caso</h2>
    <table><tr><th>Hechos</th><td>${f.hechos || '—'}</td></tr>
    <tr><th>Derecho</th><td>${f.derecho || '—'}</td></tr>
    <tr><th>Evidencia</th><td>${f.evidencia || '—'}</td></tr>
    <tr><th>Riesgos</th><td>${f.riesgos || '—'}</td></tr>
    ${prob !== undefined ? `<tr><th>Prob. Éxito</th><td class="${prob >= 60 ? 'verde' : prob >= 40 ? 'ambar' : 'rojo'}">${prob}%</td></tr>` : ''}
    </table>` : ''}
    <h2>IV. Documentos (${docs.length})</h2>
    <table><thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th>Plazo</th></tr></thead><tbody>
    ${docs.map(d => `<tr><td>${d.nombreOriginal || d.nombreSistema || '—'}</td><td>${d.tipo || '—'}</td><td>${d.fechaDocumento || '—'}</td><td>${d.fechaVencimiento ? '<span class="rojo">' + d.fechaVencimiento + '</span>' : '—'}</td></tr>`).join('')}
    </tbody></table>
    ${hon.base ? `<h2>V. Honorarios</h2>
    <table><tr><th>Monto Base</th><td>$${Math.round(hon.base).toLocaleString('es-CL')}</td></tr>
    <tr><th>Pagado</th><td class="verde">$${Math.round(pagado).toLocaleString('es-CL')}</td></tr>
    <tr><th>Pendiente</th><td class="${(hon.base - pagado) > 0 ? 'rojo' : 'verde'}">$${Math.round(hon.base - pagado).toLocaleString('es-CL')}</td></tr></table>` : ''}
    <div class="footer">AVISO LEGAL: Este informe es de uso interno exclusivo. Los valores y análisis son referenciales y no constituyen opinión legal formal. AppBogado · Gestión Jurídica Profesional</div>
    </body></html>`;

            const blob2 = new Blob([html], { type: 'text/html; charset=utf-8' });
            const url2 = URL.createObjectURL(blob2);
            const a2 = document.createElement('a');
            a2.href = url2;
            a2.download = `informe-causa-${causaId}-${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(a2);
            a2.click();
            document.body.removeChild(a2);
            setTimeout(() => URL.revokeObjectURL(url2), 2000);
            registrarEvento(`PDF generado: ${causa.caratula}`);
        }

        function exportarPDFEconomico() {
            let totalBase = 0, totalPagado = 0;
            DB.causas.forEach(c => {
                totalBase += c.honorarios?.base || c.honorarios?.montoBase || 0;
                totalPagado += (c.honorarios?.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
            });
            const pendiente = totalBase - totalPagado;
            const pctCobro = totalBase > 0 ? Math.round((totalPagado / totalBase) * 100) : 0;

            const filas = DB.causas
                .filter(c => (c.honorarios?.base || c.honorarios?.montoBase))
                .map(c => {
                    const base = c.honorarios.base || c.honorarios.montoBase || 0;
                    const pag = (c.honorarios.pagos || []).reduce((s, x) => s + (x.monto || 0), 0);
                    const pend = base - pag;
                    const pct = Math.round((pag / (base || 1)) * 100);
                    const cls = pend > 0 ? 'rojo' : 'verde';
                    return `<tr>
                        <td>${escHtml(c.caratula)}</td>
                        <td>$${Math.round(base).toLocaleString('es-CL')}</td>
                        <td class="verde">$${Math.round(pag).toLocaleString('es-CL')}</td>
                        <td class="${cls}">$${Math.round(pend).toLocaleString('es-CL')}</td>
                        <td>${pct}%</td>
                    </tr>`;
                }).join('') || '<tr><td colspan="5" style="text-align:center;color:#718096;">Sin honorarios registrados</td></tr>';

            const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte Económico — AppBogado v3.9.5</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans',Georgia,serif;max-width:820px;margin:36px auto;color:#1a1a2e;font-size:13px;line-height:1.65;padding:0 24px}
  .logo{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#1a3a6b;margin-bottom:6px}
  h1{font-size:22px;font-weight:700;color:#1a1a2e;border-bottom:3px solid #1a3a6b;padding-bottom:10px;margin-bottom:4px}
  .meta{font-size:11px;color:#718096;margin-bottom:28px;font-family:'IBM Plex Mono',monospace}
  h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#1a3a6b;margin:24px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  td,th{padding:8px 10px;border:1px solid #e2e8f0;text-align:left;vertical-align:middle}
  th{background:#f0f4f8;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#334155}
  tr:hover td{background:#f8fafc}
  .num{font-family:'IBM Plex Mono',monospace;font-weight:600}
  .verde{color:#0d7a5f;font-weight:600}
  .rojo{color:#c0392b;font-weight:600}
  .resumen-box{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px}
  .res-item{border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px}
  .res-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px}
  .res-val{font-size:20px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:#0f172a}
  .res-val.azul{color:#1a3a6b}
  .res-val.verde{color:#0d7a5f}
  .res-val.rojo{color:#c0392b}
  .footer{margin-top:32px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{margin:20px auto}.footer{position:fixed;bottom:10px;left:0;right:0}}
</style>
</head><body>
  <div class="logo">AppBogado v3.9.5 · Sistema de Gestión Legal</div>
  <h1>Reporte Económico del Despacho</h1>
  <p class="meta">Generado el ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>

  <h2>Resumen General</h2>
  <div class="resumen-box">
    <div class="res-item"><div class="res-label">Total Facturado</div><div class="res-val azul">$${Math.round(totalBase).toLocaleString('es-CL')}</div></div>
    <div class="res-item"><div class="res-label">Total Cobrado</div><div class="res-val verde">$${Math.round(totalPagado).toLocaleString('es-CL')}</div></div>
    <div class="res-item"><div class="res-label">Total Pendiente</div><div class="res-val ${pendiente > 0 ? 'rojo' : 'verde'}">$${Math.round(pendiente).toLocaleString('es-CL')}</div></div>
    <div class="res-item"><div class="res-label">% de Cobro Efectivo</div><div class="res-val ${pctCobro >= 80 ? 'verde' : pctCobro >= 50 ? 'azul' : 'rojo'}">${pctCobro}%</div></div>
  </div>
  <table>
    <tr><th>Causas con honorarios</th><td class="num">${DB.causas.filter(c => c.honorarios?.base || c.honorarios?.montoBase).length}</td></tr>
    <tr><th>Total causas activas</th><td class="num">${DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').length}</td></tr>
    <tr><th>Clientes registrados</th><td class="num">${DB.clientes.length}</td></tr>
  </table>

  <h2>Detalle por Causa</h2>
  <table>
    <thead><tr><th>Causa</th><th>Base</th><th>Cobrado</th><th>Pendiente</th><th>%</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="footer">AppBogado v3.9.5 · Documento generado automáticamente · Confidencial</div>
</body></html>`;

            // ── Descarga como HTML imprimible (sin popup bloqueado) ────────────
            const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte-economico-${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 8 — CONTROL DE CONFLICTO DE INTERÉS
        // ═══════════════════════════════════════════════════════════════════════

        function verificarConflictoInteres(nombre, rut) {
            const alertas = [];
            const nom = (nombre || '').toLowerCase().trim();
            const r = (rut || '').replace(/\D/g, '').trim();

            // Buscar en clientes existentes
            DB.clientes.forEach(c => {
                const nomC = ((c.nombre || c.nom || '')).toLowerCase();
                const rutC = (c.rut || '').replace(/\D/g, '');
                if ((nom && nomC.includes(nom) && nom.length > 3) || (r && r.length > 5 && rutC === r)) {
                    alertas.push({ tipo: 'cliente', msg: `Cliente existente: ${c.nombre || c.nom} · RUT: ${c.rut || '—'}` });
                }
            });

            // Buscar en carátulas (contraparte)
            DB.causas.forEach(c => {
                const car = (c.caratula || '').toLowerCase();
                if (nom && nom.length > 4 && car.includes(nom)) {
                    alertas.push({ tipo: 'contraparte', msg: `Posible contraparte en causa: ${c.caratula}` });
                }
            });

            return alertas;
        }

        function uiVerificarConflicto() {
            const nom = document.getElementById('cl-nom')?.value.trim();
            const rut = document.getElementById('cl-rut')?.value.trim();
            if (!nom) return;
            const alertas = verificarConflictoInteres(nom, rut);
            const el = document.getElementById('conflicto-resultado');
            if (!el) return;
            if (!alertas.length) { el.innerHTML = '<div style="color:var(--s); font-size:0.78rem; padding:6px 0;"><i class="fas fa-check-circle"></i> Sin conflictos detectados.</div>'; return; }

            el.innerHTML = `<div class="conflicto-alert">
        <h4><i class="fas fa-exclamation-triangle"></i> Posible Conflicto de Interés</h4>
        ${alertas.map(a => `<div class="conflicto-match">
            <strong>${a.tipo === 'cliente' ? '👤 Cliente existente' : '⚖ Posible contraparte'}:</strong> ${escHtml(a.msg)}
        </div>`).join('')}
        <p style="font-size:0.72rem; color:#7f1d1d; margin-top:8px;">Verifique antes de aceptar el encargo profesional.</p>
    </div>`;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 9 — BACKUP COMPLETO EXPORTABLE
        // ═══════════════════════════════════════════════════════════════════════

        function exportarBackupCompleto() {
            showConfirm(
                'Exportar Backup',
                '¿Exportar copia de seguridad completa de la base de datos?\n\nEl archivo descargado contiene TODOS sus datos en formato JSON.',
                () => {
                    const backup = {
                        version: '3.9.5',
                        fechaExportacion: new Date().toISOString(),
                        exportadoPor: 'admin',
                        checksum: Date.now().toString(36),
                        datos: {
                            clientes: DB.clientes,
                            causas: DB.causas,
                            jurisprudencia: DB.jurisprudencia,
                            documentos: DB.documentos,
                            prospectos: DB.prospectos,
                            alertas: DB.alertas,
                            bitacora: DB.bitacora,
                            configuracion: DB.configuracion,
                        },
                        _appConfig: AppConfig.exportar()
                    };

                    const json = JSON.stringify(backup, null, 2);
                    const blob = new Blob([json], { type: 'application/json; charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `AppBogado_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    registrarEvento('Backup completo exportado');
                    showSuccess(`✅ Backup exportado. ${DB.causas.length} causas · ${DB.clientes.length} clientes · ${DB.documentos.length} documentos`);
                }
            );
        }

        function importarBackup() {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    try {
                        const backup = JSON.parse(ev.target.result);
                        if (!backup.datos || !backup.version) throw new Error('Formato inválido');

                        showConfirm(
                            'Restaurar Backup',
                            `¿Restaurar backup del ${new Date(backup.fechaExportacion).toLocaleDateString('es-CL')}?\n\nEsto REEMPLAZARÁ todos los datos actuales.\n\nCausas: ${backup.datos.causas?.length || 0} · Clientes: ${backup.datos.clientes?.length || 0}`,
                            () => {
                                Object.assign(DB, backup.datos);
                                // Restaurar configuracion completa (usuarios, IA, Drive, etc.)
                                if (backup._appConfig) {
                                    AppConfig.restaurar(backup._appConfig);
                                } else if (backup.datos._usuarios?.length) {
                                    // Compatibilidad con backups anteriores
                                    AppConfig.set('usuarios', backup.datos._usuarios);
                                }
                                save(); renderAll();
                                Users.inicializar();
                                showSuccess('Backup restaurado. Usuarios y configuracion recuperados.');
                                registrarEvento('Backup importado y restaurado');
                            }
                        );
                    } catch (err) {
                        showError('Error al importar backup: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 10 — MODO ESTUDIO COMERCIAL
        // ═══════════════════════════════════════════════════════════════════════

        function setModo(modo) {
            if (!DB.configuracion) DB.configuracion = {};
            DB.configuracion.modoEstudio = (modo === 'estudio');
            save();
            document.getElementById('modo-personal-btn')?.classList.toggle('activo', modo === 'personal');
            document.getElementById('modo-estudio-btn')?.classList.toggle('activo', modo === 'estudio');
            renderAll();
            if (modo === 'estudio') {
                document.getElementById('st-ca').parentElement.querySelector('h4').textContent = 'Causas del Estudio';
            } else {
                document.getElementById('st-ca').parentElement.querySelector('h4').textContent = 'Causas Activas';
            }
        }

        // ── Historial de Backups ─────────────────────────────────────────────
        function abrirHistorialBackups() {
            const lista = AutoBackup.listar();
            const el = document.getElementById('backup-history-list');
            if (!el) return;

            const motivoLabel = {
                auto: 'Automático', 'inicio-sesion': 'Inicio sesión',
                logout: 'Cierre sesión', manual: 'Manual', cierre: 'Cierre ventana',
                'antes-de-restaurar': 'Pre-restauración'
            };
            const motivoColor = {
                auto: '#1a3a6b', manual: '#0d7a5f', logout: '#b45309',
                cierre: '#475569', 'inicio-sesion': '#7c3aed', 'antes-de-restaurar': '#c0392b'
            };

            if (!lista.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Sin backups todavía. Se crearán automáticamente.</p></div>';
            } else {
                el.innerHTML = lista.map((b, i) => {
                    const fecha = new Date(b.fecha).toLocaleString('es-CL');
                    const motivo = motivoLabel[b.motivo] || b.motivo;
                    const color = motivoColor[b.motivo] || '#64748b';
                    const esMasReciente = i === 0;
                    return `<div style="
                        display:flex; align-items:center; gap:14px;
                        padding:12px 14px; border-radius:9px; margin-bottom:8px;
                        border:1px solid #e4eaf3; background:${esMasReciente ? '#f0f9ff' : '#fff'};
                    ">
                        <div style="
                            width:10px; height:10px; border-radius:50%;
                            background:${color}; flex-shrink:0;
                        "></div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.82rem; font-weight:700; color:#0f172a;">
                                ${fecha}
                                ${esMasReciente ? '<span style="font-size:0.65rem;background:#dbeafe;color:#1a3a6b;padding:1px 6px;border-radius:10px;margin-left:6px;font-weight:700;">MÁS RECIENTE</span>' : ''}
                            </div>
                            <div style="font-size:0.72rem; color:#64748b; margin-top:2px; font-family:'IBM Plex Mono',monospace;">
                                <span style="color:${color}; font-weight:600;">${motivo}</span>
                                · ${b.causas} causas · ${b.clientes} clientes
                            </div>
                        </div>
                        <button class="btn btn-sm" style="background:#fee2e2;color:#c0392b;flex-shrink:0;"
                            onclick="AutoBackup.restaurarDesde(${b.id})">
                            <i class="fas fa-undo"></i> Restaurar
                        </button>
                    </div>`;
                }).join('');
            }
            abrirModal('modal-backups');
        }

        // ═══════════════════════════════════════════════════════════════════════
        // INTEGRACIÓN — Extender renderAll e init con todos los módulos nuevos
        // ═══════════════════════════════════════════════════════════════════════

        // Conflicto de interés — div ya en HTML del form

        // ═══════════════════════════════════════════════════════════════════════
        // DASHBOARD PANEL — renderDashboardPanel() con gráficos SVG nativos
        // ═══════════════════════════════════════════════════════════════════════

