(function () {
    function _getEl(id) { return document.getElementById(id); }

    function _fmtFecha(ts) {
        try {
            const d = new Date(ts);
            return d.toLocaleString('es-CL');
        } catch (_) {
            return '';
        }
    }

    function _safeStr(x) {
        if (x === null || x === undefined) return '';
        return String(x);
    }

    function _resumenDetalles(e) {
        try {
            if (!e) return '';
            if (e.accion === 'BITACORA') return _safeStr(e.detalles?.descripcion || '').slice(0, 160);
            const det = e.detalles;
            if (!det) return '';
            if (typeof det === 'string') return det.slice(0, 160);
            const ev = det.event ? `[${det.event}] ` : '';
            const payload = det.payload;
            if (payload && typeof payload === 'object') {
                const keys = Object.keys(payload).slice(0, 6);
                const mini = keys.map(k => `${k}=${_safeStr(payload[k]).slice(0, 40)}`).join(' · ');
                return (ev + mini).slice(0, 160);
            }
            return (ev + JSON.stringify(det)).slice(0, 160);
        } catch (_) {
            return '';
        }
    }

    function _classifyTipo(e) {
        const entidad = _safeStr(e?.entidad).toLowerCase();
        const accion = _safeStr(e?.accion).toLowerCase();
        if (entidad.includes('causa') || accion.includes('causa') || accion.startsWith('causas_')) return 'causas';
        if (entidad.includes('doc') || accion.includes('doc') || accion.startsWith('docs_')) return 'documentos';
        if (entidad.includes('honor') || accion.includes('honor') || accion.startsWith('honorarios_')) return 'honorarios';
        if (entidad.includes('whatsapp') || accion.includes('whatsapp') || accion.startsWith('whatsapp_')) return 'whatsapp';
        if (entidad.includes('auth') || accion.includes('login') || accion.includes('logout')) return 'sistema';
        if (entidad.includes('bitacora') || accion.includes('bitacora')) return 'sistema';
        if (entidad.includes('storage') || accion.includes('storage')) return 'sistema';
        return 'sistema';
    }

    function _getRangoMs(rango) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (rango === 'hoy') {
            return { from: startOfToday, to: Date.now() };
        }
        if (rango === '7d') {
            return { from: Date.now() - 7 * 24 * 60 * 60 * 1000, to: Date.now() };
        }
        if (rango === 'mes') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            return { from: start, to: Date.now() };
        }
        return { from: null, to: null };
    }

    function _filtrarLogs(logs) {
        const rango = _getEl('audit-rango')?.value || 'todo';
        const tipo = _getEl('audit-tipo')?.value || 'todo';
        const q = (_getEl('audit-q')?.value || '').trim().toLowerCase();

        const { from, to } = _getRangoMs(rango);

        return (logs || []).filter(e => {
            const ts = Number(e?.ts || 0);
            if (from && ts && ts < from) return false;
            if (to && ts && ts > to) return false;

            if (tipo && tipo !== 'todo') {
                if (_classifyTipo(e) !== tipo) return false;
            }

            if (q) {
                const hay = [
                    e?.usuario,
                    e?.rol,
                    e?.accion,
                    e?.entidad,
                    e?.referenciaId,
                    e?.error,
                    _resumenDetalles(e),
                    (() => {
                        try { return JSON.stringify(e?.detalles || ''); } catch (_) { return ''; }
                    })()
                ].map(x => _safeStr(x).toLowerCase()).join(' | ');
                if (!hay.includes(q)) return false;
            }

            return true;
        });
    }

    function _renderTabla(rows) {
        const tb = _getEl('audit-tbody');
        const meta = _getEl('audit-meta');
        if (!tb) return;

        const total = Array.isArray(DB?.logs) ? DB.logs.length : 0;
        const shown = rows.length;
        if (meta) meta.textContent = `Mostrando ${shown} de ${total} eventos.`;

        if (!rows.length) {
            tb.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:14px; color:var(--text-3);">Sin eventos para los filtros seleccionados.</td>
                </tr>`;
            return;
        }

        tb.innerHTML = rows.slice(0, 500).map(e => {
            const fecha = _fmtFecha(e.ts);
            const usuario = _safeStr(e.usuario || '—');
            const accion = _safeStr(e.accion || '—');
            const det = _resumenDetalles(e);
            const ref = _safeStr(e.referenciaId || '—');
            const ok = (e.ok === false) ? 'audit-badge--err' : 'audit-badge--ok';
            const badge = (e.ok === false) ? 'ERROR' : 'OK';

            return `
                <tr class="audit-row" data-audit-id="${_safeStr(e.id)}">
                    <td><div class="audit-cell-main">${fecha}</div></td>
                    <td>
                        <div class="audit-cell-main">${usuario}</div>
                        <div class="audit-cell-sub">${_safeStr(e.rol || '')}</div>
                    </td>
                    <td>
                        <div class="audit-cell-main">${accion}</div>
                        <div class="audit-cell-sub"><span class="audit-badge ${ok}">${badge}</span> ${_safeStr(e.entidad || '')}</div>
                    </td>
                    <td><div class="audit-cell-main">${det}</div></td>
                    <td><div class="audit-cell-main">${ref}</div></td>
                </tr>`;
        }).join('');

        tb.querySelectorAll('.audit-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = tr.getAttribute('data-audit-id');
                const ev = (DB?.logs || []).find(x => _safeStr(x.id) === _safeStr(id));
                if (!ev) return;
                AuditReportes.abrirDetalle(ev);
            });
        });
    }

    function _toCsv(rows) {
        const cols = ['fechaISO', 'usuario', 'rol', 'accion', 'entidad', 'referenciaId', 'ok', 'error', 'origen'];
        const header = cols.join(',');
        const esc = (v) => {
            const s = _safeStr(v).replace(/\r?\n/g, ' ');
            if (s.includes('"') || s.includes(',') || s.includes(';')) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const lines = rows.map(e => {
            const base = cols.map(c => esc(e?.[c]));
            // detalles en una última columna
            let det = '';
            try { det = JSON.stringify(e?.detalles || null); } catch (_) { det = ''; }
            base.push(esc(det));
            return base.join(',');
        });
        return header + ',detalles\n' + lines.join('\n');
    }

    function _download(filename, content, mime) {
        const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    const AuditReportes = {
        obtenerFiltrados() {
            const logs = Array.isArray(DB?.logs) ? DB.logs : [];
            const rows = _filtrarLogs(logs);
            // orden: más reciente primero
            rows.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
            return rows;
        },

        render() {
            if (typeof DB === 'undefined') return;
            if (!Array.isArray(DB.logs)) DB.logs = [];
            const rows = this.obtenerFiltrados();
            _renderTabla(rows);
        },

        abrirDetalle(ev) {
            const overlay = _getEl('modal-audit-detalle');
            const pre = _getEl('audit-detalle-pre');
            const title = _getEl('audit-detalle-title');
            if (!overlay || !pre) return;
            if (title) {
                title.textContent = `${_safeStr(ev.accion || 'EVENT')} · ${_fmtFecha(ev.ts)} · ${_safeStr(ev.usuario || '—')}`;
            }
            try {
                pre.textContent = JSON.stringify(ev, null, 2);
            } catch (_) {
                pre.textContent = _safeStr(ev);
            }
            overlay.classList.add('open');
        },

        cerrarDetalle() {
            const overlay = _getEl('modal-audit-detalle');
            if (!overlay) return;
            overlay.classList.remove('open');
        },

        exportarCsv() {
            const rows = this.obtenerFiltrados();
            const csv = _toCsv(rows);
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            _download(`auditoria-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
        },

        exportarPdf() {
            // Para PDF: usar el print nativo con "Guardar como PDF".
            // Renderizamos una tabla simple en una nueva ventana.
            const rows = this.obtenerFiltrados().slice(0, 1000);
            const html = `
                <html><head><meta charset="utf-8"/>
                <title>Auditoría y Reportes</title>
                <style>
                    body{font-family:Arial, sans-serif; font-size:12px; padding:18px;}
                    h1{font-size:16px; margin:0 0 10px;}
                    table{width:100%; border-collapse:collapse;}
                    th,td{border:1px solid #ddd; padding:6px; vertical-align:top;}
                    th{background:#f5f5f5;}
                    .muted{color:#666; font-size:11px;}
                </style>
                </head><body>
                <h1>Auditoría y Reportes</h1>
                <div class="muted">Generado: ${new Date().toLocaleString('es-CL')}</div>
                <table>
                    <thead><tr>
                        <th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Detalles</th><th>Ref ID</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map(e => `
                            <tr>
                                <td>${_fmtFecha(e.ts)}</td>
                                <td>${_safeStr(e.usuario || '—')}</td>
                                <td>${_safeStr(e.accion || '—')}</td>
                                <td>${_safeStr(_resumenDetalles(e))}</td>
                                <td>${_safeStr(e.referenciaId || '—')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </body></html>
            `;

            const w = window.open('', '_blank');
            if (!w) {
                if (typeof showError === 'function') showError('No se pudo abrir la ventana de impresión.');
                return;
            }
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 250);
        },

        init() {
            const rango = _getEl('audit-rango');
            const tipo = _getEl('audit-tipo');
            const q = _getEl('audit-q');
            const refresh = _getEl('audit-btn-refresh');
            const csv = _getEl('audit-btn-csv');
            const pdf = _getEl('audit-btn-pdf');
            const close = _getEl('audit-detalle-close');

            const rerender = () => this.render();

            rango?.addEventListener('change', rerender);
            tipo?.addEventListener('change', rerender);
            q?.addEventListener('input', () => {
                // small debounce
                clearTimeout(AuditReportes._t);
                AuditReportes._t = setTimeout(rerender, 120);
            });
            refresh?.addEventListener('click', rerender);
            csv?.addEventListener('click', () => this.exportarCsv());
            pdf?.addEventListener('click', () => this.exportarPdf());
            close?.addEventListener('click', () => this.cerrarDetalle());

            const overlay = _getEl('modal-audit-detalle');
            overlay?.addEventListener('click', (ev) => {
                if (ev.target === overlay) this.cerrarDetalle();
            });

            // Re-render cuando se emiten eventos (si existen)
            try {
                if (window.EventBus?.on) {
                    ['bitacora:updated',
                        'causas:created', 'causas:updated', 'causas:deleted',
                        'docs:uploaded', 'docs:deleted', 'docs:updated',
                        'honorarios:assigned', 'honorarios:pago-added', 'honorarios:updated',
                        'whatsapp:connect-started', 'whatsapp:connected', 'whatsapp:reconnected', 'whatsapp:disconnected', 'whatsapp:disconnect', 'whatsapp:sent', 'whatsapp:error', 'whatsapp:alert-sent',
                        'clientes:updated', 'clientes:deleted',
                        'alertas:created', 'alertas:updated'
                    ]
                        .forEach(ev => EventBus.on(ev, () => {
                            // solo si el tab está activo
                            const sec = _getEl('audit-reportes');
                            if (sec && sec.classList.contains('active')) this.render();
                        }));
                }
            } catch (_) {}

            // render inicial si ya está visible
            const sec = _getEl('audit-reportes');
            if (sec && sec.classList.contains('active')) this.render();
        }
    };

    window.AuditReportes = AuditReportes;

    document.addEventListener('DOMContentLoaded', () => {
        try { AuditReportes.init(); } catch (_) {}
    });
})();
