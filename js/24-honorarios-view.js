/**
 * Vista de Cartera de Honorarios — js/24-honorarios-view.js
 * Tabla principal de honorarios por causa: base, cobrado, pendiente, % y último pago.
 * Alertas visuales: fila roja si pendiente > 0 y último pago hace > 30 días; verde si al día.
 */
(function () {
    'use strict';

    function _esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function _fmtCLP(n) {
        return (n || 0).toLocaleString('es-CL');
    }

    /**
     * Obtiene datos de honorarios de una causa (base, pagado, pendiente, último pago).
     */
    function _datosHonorarios(entidad) {
        const h = entidad?.honorarios || {};
        const base = h.montoTotal || h.montoBase || h.base || h.monto || 0;
        const pagos = Array.isArray(h.pagos) ? h.pagos : [];
        const pagado = pagos.length
            ? pagos.reduce((s, p) => s + (p.monto || 0), 0)
            : (parseFloat(h.pagado) || 0);
        const pendiente = Math.max(0, base - pagado);
        const pct = base > 0 ? Math.round((pagado / base) * 100) : 0;
        let ultimoPagoFecha = null;
        let diasDesdeUltimoPago = null;
        if (pagos.length) {
            const ultimo = pagos[pagos.length - 1];
            ultimoPagoFecha = ultimo.fecha || null;
            if (ultimoPagoFecha) {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const f = new Date(ultimoPagoFecha);
                f.setHours(0, 0, 0, 0);
                diasDesdeUltimoPago = Math.floor((hoy - f) / 86400000);
            }
        }
        return { base, pagado, pendiente, pct, ultimoPagoFecha, diasDesdeUltimoPago, pagos };
    }

    /**
     * Clase CSS de fila según estado de cobro: al día (verde), atrasado (rojo), neutro.
     */
    function _claseFila(pendiente, diasDesdeUltimoPago) {
        if (pendiente <= 0) return 'hon-row-al-dia';
        if (diasDesdeUltimoPago === null || diasDesdeUltimoPago > 30) return 'hon-row-atrasado';
        return '';
    }

    function honAbrirExpediente(fuente, id) {
        const fid = String(id || '');
        if (!fid) return;
        const f = String(fuente || '').toLowerCase();
        if (f === 'tramite') {
            try {
                if (typeof window.tab === 'function') {
                    window.tab('tramites', document.querySelector(`[onclick="tab('tramites',this)"]`));
                }
            } catch (_) { }
            setTimeout(() => {
                try { if (typeof window.tramiteVerDetalle === 'function') window.tramiteVerDetalle(fid); } catch (_) { }
            }, 0);
            return;
        }
        try { if (typeof window.abrirDetalleCausa === 'function') window.abrirDetalleCausa(fid); } catch (_) { }
    }

    function renderHonorarios() {
        const container = document.getElementById('honorarios-cartera-container');
        if (!container) return;

        const causasConHon = (DB.causas || []).filter(c =>
            (c?.honorarios?.montoTotal || c?.honorarios?.montoBase || c?.honorarios?.base) > 0
        );

        let tramitesLista = [];
        try {
            tramitesLista = (typeof window.TramitesDB !== 'undefined' && window.TramitesDB?.todos)
                ? window.TramitesDB.todos()
                : (typeof AppConfig !== 'undefined' && AppConfig.get) ? (AppConfig.get('tramites') || []) : [];
        } catch (_) { }
        const tramitesConHon = (tramitesLista || []).filter(t => {
            const h = t?.honorarios || {};
            return (h?.montoTotal || h?.montoBase || h?.base || h?.monto) > 0;
        });

        const items = [
            ...causasConHon.map(c => ({ fuente: 'causa', tipo: 'Judicial', entidad: c })),
            ...tramitesConHon.map(t => ({ fuente: 'tramite', tipo: 'Administrativo', entidad: t }))
        ];

        if (!items.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding:32px 24px;">
                    <i class="fas fa-wallet" style="font-size:2rem; color:var(--text-3); margin-bottom:12px;"></i>
                    <p style="margin:0; color:var(--text-2);">No hay gestiones con honorarios asignados.</p>
                    <p style="font-size:0.85rem; color:var(--text-3); margin-top:6px;">Asigne montos desde Clientes → Control Financiero.</p>
                </div>`;
            return;
        }

        let sumaBase = 0, sumaPagado = 0, sumaPendiente = 0;
        const rows = items.map(item => {
            const ent = item.entidad;
            const clienteId = item.fuente === 'causa' ? ent?.clienteId : ent?.clienteId;
            const cliente = (DB.clientes || []).find(cl => String(cl.id) === String(clienteId || '')) || null;
            const nombreCliente = cliente
                ? (cliente.nombre || cliente.nom || '—')
                : (item.fuente === 'tramite' ? (ent?.cliente || '—') : '—');

            const expedienteNombre = item.fuente === 'causa'
                ? (ent?.caratula || '—')
                : `${ent?.tipo || 'Trámite'}${ent?.caratula ? ' — ' + ent.caratula : ''}`.trim();

            const d = _datosHonorarios(ent);
            sumaBase += d.base;
            sumaPagado += d.pagado;
            sumaPendiente += d.pendiente;

            let textoUltimoPago = '—';
            if (d.ultimoPagoFecha) {
                if (d.diasDesdeUltimoPago !== null) {
                    if (d.diasDesdeUltimoPago === 0) textoUltimoPago = 'Hoy';
                    else if (d.diasDesdeUltimoPago === 1) textoUltimoPago = 'Ayer';
                    else textoUltimoPago = `Hace ${d.diasDesdeUltimoPago} días`;
                } else {
                    textoUltimoPago = new Date(d.ultimoPagoFecha).toLocaleDateString('es-CL');
                }
            }

            const rowClass = _claseFila(d.pendiente, d.diasDesdeUltimoPago);
            const badge = item.tipo === 'Judicial'
                ? '<span class="hon-badge hon-badge-judicial">Judicial</span>'
                : '<span class="hon-badge hon-badge-admin">Administrativo</span>';
            const onclick = `honAbrirExpediente('${_esc(String(item.fuente))}','${_esc(String(ent.id))}')`;
            const accion = item.fuente === 'causa'
                ? `<button type="button"
                            class="btn btn-xs"
                            style="background:#22c55e;border-color:#16a34a;color:#fff;padding:4px 8px;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;"
                            title="Recordar pago por WhatsApp"
                            onclick="event.stopPropagation(); typeof honRecordarPagoWA==='function' && honRecordarPagoWA('${cliente ? cliente.id : ''}','${ent.id}');">
                            <i class="fab fa-whatsapp"></i>
                        </button>`
                : '<span style="color:var(--text-3); font-size:0.8rem;">—</span>';
            return `
                <tr class="${rowClass}" data-exp-id="${_esc(String(ent.id))}" onclick="${onclick}" style="cursor:pointer;">
                    <td>${_esc(nombreCliente)}</td>
                    <td>${badge}</td>
                    <td>${_esc(expedienteNombre)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace;">$${_fmtCLP(d.base)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace; color:var(--success,#059669);">$${_fmtCLP(d.pagado)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace; color:var(--danger,#dc2626); font-weight:600;">$${_fmtCLP(d.pendiente)}</td>
                    <td style="text-align:center;">${d.pct}%</td>
                    <td style="font-size:0.85rem; color:var(--text-2);">${_esc(textoUltimoPago)}</td>
                    <td style="text-align:center;">
                        ${accion}
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="hon-cartera-table" style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr class="hon-cartera-head" style="border-bottom:2px solid var(--border);">
                        <th style="text-align:left; padding:10px 12px;">Cliente</th>
                        <th style="text-align:left; padding:10px 12px;">Tipo</th>
                        <th style="text-align:left; padding:10px 12px;">Expediente</th>
                        <th style="text-align:right; padding:10px 12px;">Monto Base</th>
                        <th style="text-align:right; padding:10px 12px;">Total Pagado</th>
                        <th style="text-align:right; padding:10px 12px;">Saldo Pendiente</th>
                        <th style="text-align:center; padding:10px 12px;">% Cobrado</th>
                        <th style="text-align:left; padding:10px 12px;">Último Pago</th>
                        <th style="text-align:center; padding:10px 12px;">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr class="hon-cartera-foot" style="border-top:2px solid var(--border); font-weight:700;">
                        <td colspan="3" style="padding:12px;">Totales</td>
                        <td style="text-align:right; padding:12px; font-family:'IBM Plex Mono',monospace;">$${_fmtCLP(sumaBase)}</td>
                        <td style="text-align:right; padding:12px; font-family:'IBM Plex Mono',monospace; color:var(--success,#059669);">$${_fmtCLP(sumaPagado)}</td>
                        <td style="text-align:right; padding:12px; font-family:'IBM Plex Mono',monospace; color:var(--danger,#dc2626);">$${_fmtCLP(sumaPendiente)}</td>
                        <td style="text-align:center; padding:12px;">${sumaBase > 0 ? Math.round((sumaPagado / sumaBase) * 100) : 0}%</td>
                        <td colspan="2"></td>
                    </tr>
                </tfoot>
            </table>`;

        const style = document.getElementById('hon-cartera-styles');
        if (!style) {
            const el = document.createElement('style');
            el.id = 'hon-cartera-styles';
            el.textContent = `
                .hon-cartera-table tbody tr { border-bottom: 1px solid var(--border, #e2e8f0); }
                .hon-cartera-table tbody tr:hover { background: rgba(0,0,0,0.03); }
                .hon-cartera-table thead tr.hon-cartera-head,
                .hon-cartera-table tfoot tr.hon-cartera-foot { background: var(--bg-2, #f1f5f9); }
                .hon-row-atrasado { background: rgba(239, 68, 68, 0.1) !important; }
                .hon-row-al-dia { background: rgba(16, 185, 129, 0.1) !important; }
                .hon-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:800; letter-spacing:0.02em; border:1px solid transparent; }
                .hon-badge-judicial { background: rgba(59,130,246,0.12); color: #60a5fa; border-color: rgba(59,130,246,0.35); }
                .hon-badge-admin { background: rgba(16,185,129,0.12); color: #34d399; border-color: rgba(16,185,129,0.35); }

                [data-theme="dark"] .hon-cartera-table tbody tr { border-bottom: 1px solid rgba(148,163,184,0.18); }
                [data-theme="dark"] .hon-cartera-table tbody tr:hover { background: rgba(255,255,255,0.06); }
                [data-theme="dark"] .hon-row-atrasado { background: rgba(239, 68, 68, 0.18) !important; }
                [data-theme="dark"] .hon-row-al-dia { background: rgba(16, 185, 129, 0.16) !important; }

                [data-theme="dark"] .hon-cartera-table { background: transparent; color: var(--text-1, #e5e7eb); }
                [data-theme="dark"] .hon-cartera-table th,
                [data-theme="dark"] .hon-cartera-table td { background: transparent; }
                [data-theme="dark"] .hon-cartera-table thead tr,
                [data-theme="dark"] .hon-cartera-table tfoot tr { background: rgba(15, 23, 42, 0.75) !important; }
                [data-theme="dark"] .hon-cartera-table thead tr.hon-cartera-head,
                [data-theme="dark"] .hon-cartera-table tfoot tr.hon-cartera-foot { background: rgba(15, 23, 42, 0.75) !important; }
                [data-theme="dark"] .hon-cartera-table thead tr.hon-cartera-head th,
                [data-theme="dark"] .hon-cartera-table tfoot tr.hon-cartera-foot td { background: rgba(15, 23, 42, 0.75) !important; }
                [data-theme="dark"] .hon-cartera-table thead th { color: var(--text-2, #cbd5e1); }
                [data-theme="dark"] .hon-cartera-table tfoot td { color: var(--text-1, #e5e7eb); }

                /* Override ultra-específico: evitar celdas blancas por estilos globales */
                [data-theme="dark"] #honorarios-cartera-container .hon-cartera-table,
                [data-theme="dark"] #honorarios-cartera-container .hon-cartera-table tbody,
                [data-theme="dark"] #honorarios-cartera-container .hon-cartera-table tr,
                [data-theme="dark"] #honorarios-cartera-container .hon-cartera-table td {
                    background: transparent !important;
                    color: inherit;
                }
            `;
            document.head.appendChild(el);
        }
    }

    async function _honRecordarPagoWA(clienteId, causaId) {
        try {
            if (!window.electronAPI || !window.electronAPI.whatsapp) {
                if (typeof showError === 'function') showError('WhatsApp no está configurado en esta instalación.');
                else alert('WhatsApp no está configurado en esta instalación.');
                return;
            }

            const cliente = (DB.clientes || []).find(c => c.id == clienteId);
            if (!cliente) {
                if (typeof showError === 'function') showError('No se encontró el cliente en la base de datos.');
                else alert('No se encontró el cliente en la base de datos.');
                return;
            }

            // NOTA: actualmente DB.clientes no define explícitamente un campo telefono.
            // Este botón funcionará una vez que se agregue y se empiece a poblar.
            const telefono = cliente.telefono || cliente.phone || '';
            if (!telefono) {
                const msg = 'El cliente no tiene teléfono registrado.';
                if (typeof showInfo === 'function') showInfo(msg);
                else alert(msg);
                return;
            }

            const causa = (DB.causas || []).find(c => c.id == causaId);
            if (!causa) {
                if (typeof showError === 'function') showError('No se encontró la causa asociada.');
                else alert('No se encontró la causa asociada.');
                return;
            }

            const h = causa.honorarios || {};
            const base = h.montoBase || h.base || 0;
            const pagado = (h.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
            const pendiente = Math.max(0, base - pagado);
            if (pendiente <= 0) {
                const msg = 'Esta causa no tiene saldo pendiente.';
                if (typeof showInfo === 'function') showInfo(msg);
                else alert(msg);
                return;
            }

            const nombreCliente = cliente.nombre || cliente.nom || 'Cliente';
            const estudio = (DB.configuracion && DB.configuracion.nombreEstudio) || 'tu estudio jurídico';
            const mensaje =
                `Estimado/a ${nombreCliente}, le recordamos que tiene un saldo pendiente de ` +
                `$${pendiente.toLocaleString('es-CL')} en la causa \"${causa.caratula}\". ` +
                `Saludos, ${estudio}.`;

            const numeroLimpio = telefono.replace(/[\s\+\-\(\)]/g, '');
            const resp = await window.electronAPI.whatsapp.enviarAlertaA(numeroLimpio, mensaje);

            if (resp && resp.ok) {
                const okMsg = `Recordatorio enviado por WhatsApp a ${nombreCliente} (+${numeroLimpio}).`;
                if (typeof showSuccess === 'function') showSuccess(okMsg);
                else alert(okMsg);
            } else {
                const errMsg = 'No se pudo enviar el recordatorio por WhatsApp.' + (resp && resp.error ? ` Detalle: ${resp.error}` : '');
                if (typeof showError === 'function') showError(errMsg);
                else alert(errMsg);
            }
        } catch (e) {
            const msg = 'Error al enviar recordatorio por WhatsApp: ' + (e.message || e);
            if (typeof showError === 'function') showError(msg);
            else alert(msg);
        }
    }

    window.renderHonorarios = renderHonorarios;
    window.honRecordarPagoWA = _honRecordarPagoWA;
    window.honAbrirExpediente = honAbrirExpediente;
})();
