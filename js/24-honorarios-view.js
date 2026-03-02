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
    function _datosHonorarios(causa) {
        const h = causa.honorarios || {};
        const base = h.montoBase || h.base || 0;
        const pagos = h.pagos || [];
        const pagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
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

    function renderHonorarios() {
        const container = document.getElementById('honorarios-cartera-container');
        if (!container) return;

        const causasConHon = (DB.causas || []).filter(c =>
            (c.honorarios?.montoBase || c.honorarios?.base) > 0
        );

        if (!causasConHon.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding:32px 24px;">
                    <i class="fas fa-wallet" style="font-size:2rem; color:var(--text-3); margin-bottom:12px;"></i>
                    <p style="margin:0; color:var(--text-2);">No hay causas con honorarios asignados.</p>
                    <p style="font-size:0.85rem; color:var(--text-3); margin-top:6px;">Asigne montos desde Clientes → Control Financiero.</p>
                </div>`;
            return;
        }

        let sumaBase = 0, sumaPagado = 0, sumaPendiente = 0;
        const rows = causasConHon.map(c => {
            const cliente = DB.clientes.find(cl => cl.id === c.clienteId);
            const nombreCliente = cliente ? (cliente.nombre || cliente.nom || '—') : '—';
            const d = _datosHonorarios(c);
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
            return `
                <tr class="${rowClass}" data-causa-id="${c.id}" onclick="typeof abrirDetalleCausa==='function' && abrirDetalleCausa(${c.id});" style="cursor:pointer;">
                    <td>${_esc(nombreCliente)}</td>
                    <td>${_esc(c.caratula)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace;">$${_fmtCLP(d.base)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace; color:var(--success,#059669);">$${_fmtCLP(d.pagado)}</td>
                    <td style="text-align:right; font-family:'IBM Plex Mono',monospace; color:var(--danger,#dc2626); font-weight:600;">$${_fmtCLP(d.pendiente)}</td>
                    <td style="text-align:center;">${d.pct}%</td>
                    <td style="font-size:0.85rem; color:var(--text-2);">${_esc(textoUltimoPago)}</td>
                    <td style="text-align:center;">
                        <button type="button"
                            class="btn btn-xs"
                            style="background:#22c55e;border-color:#16a34a;color:#fff;padding:4px 8px;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;"
                            title="Recordar pago por WhatsApp"
                            onclick="event.stopPropagation(); typeof honRecordarPagoWA==='function' && honRecordarPagoWA('${cliente ? cliente.id : ''}','${c.id}');">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="hon-cartera-table" style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:var(--bg-2,#f1f5f9); border-bottom:2px solid var(--border);">
                        <th style="text-align:left; padding:10px 12px;">Cliente</th>
                        <th style="text-align:left; padding:10px 12px;">Causa (Carátula)</th>
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
                    <tr style="background:var(--bg-2,#f1f5f9); border-top:2px solid var(--border); font-weight:700;">
                        <td colspan="2" style="padding:12px;">Totales</td>
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
                .hon-row-atrasado { background: rgba(239, 68, 68, 0.1) !important; }
                .hon-row-al-dia { background: rgba(16, 185, 129, 0.1) !important; }
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
})();
