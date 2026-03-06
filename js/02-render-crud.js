        // JS — BLOQUE 3: RENDERIZADO PRINCIPAL
        // • Alertas, clientes, causas, jurisprudencia, honorarios
        // ████████████████████████████████████████████████████████████████████

        function renderAlerts() {
            const el = document.getElementById('alert-container');
            let html = '';

            if (!window._alertMonitorState) {
                window._alertMonitorState = { filtro: 'todas', orden: 'prioridad' };
            }
            const st = window._alertMonitorState;

            const prioRank = (p) => {
                const k = String(p || 'media').toLowerCase();
                if (k === 'critica') return 4;
                if (k === 'alta') return 3;
                if (k === 'media') return 2;
                if (k === 'baja') return 1;
                return 2;
            };
            const badge = (p) => {
                const k = String(p || 'media').toLowerCase();
                const map = {
                    critica: { label: 'Crítica', bg: '#fee2e2', fg: '#b91c1c', bd: '#fecaca' },
                    alta:    { label: 'Alta',    bg: '#ffedd5', fg: '#c2410c', bd: '#fed7aa' },
                    media:   { label: 'Media',   bg: '#fef9c3', fg: '#854d0e', bd: '#fde68a' },
                    baja:    { label: 'Baja',    bg: '#dcfce7', fg: '#166534', bd: '#bbf7d0' },
                };
                const v = map[k] || map.media;
                return `<span style="font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px; background:${v.bg}; color:${v.fg}; border:1px solid ${v.bd};">${v.label}</span>`;
            };

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin:6px 0 12px; flex-wrap:wrap;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; width:100%;">
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; flex:1; min-width:240px;">
                        <select class="input-field" style="padding:8px 10px; min-width:160px; flex:1;" data-action="alertas-set-filtro">
                            <option value="todas" ${st.filtro === 'todas' ? 'selected' : ''}>Todas</option>
                            <option value="criticas" ${st.filtro === 'criticas' ? 'selected' : ''}>Solo críticas/altas</option>
                        </select>
                        <select class="input-field" style="padding:8px 10px; min-width:180px; flex:1;" data-action="alertas-set-orden">
                            <option value="prioridad" ${st.orden === 'prioridad' ? 'selected' : ''}>Orden: Prioridad</option>
                            <option value="fecha" ${st.orden === 'fecha' ? 'selected' : ''}>Orden: Fecha</option>
                        </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; min-width:170px;">
                            <button class="btn" style="padding:8px 10px;" data-action="alertas-limpiar-auto">Limpiar alertas auto</button>
                        </div>
                    </div>
                </div>
            `;

            // Alertas del sistema centralizado
            const today = new Date(); today.setHours(0, 0, 0, 0);

            let alertasActivas = (DB.alertas || []).filter(a => a && a.estado === 'activa');
            if (st.filtro === 'criticas') {
                alertasActivas = alertasActivas.filter(a => {
                    const p = String(a.prioridad || '').toLowerCase();
                    return p === 'critica' || p === 'alta';
                });
            }

            alertasActivas.sort((a, b) => {
                if (st.orden === 'fecha') {
                    return new Date(a.fechaObjetivo || 0) - new Date(b.fechaObjetivo || 0);
                }
                const pr = prioRank(b.prioridad) - prioRank(a.prioridad);
                if (pr !== 0) return pr;
                return new Date(a.fechaObjetivo || 0) - new Date(b.fechaObjetivo || 0);
            });

            alertasActivas.forEach(a => {
                const causa = DB.causas.find(c => c.id === a.causaId);
                const fa = new Date(a.fechaObjetivo); fa.setHours(0, 0, 0, 0);
                const diff = Math.ceil((fa - today) / 86400000);
                const color = diff <= 2 ? 'var(--danger)' : diff <= 5 ? 'var(--warning)' : 'var(--cyan)';
                
                html += `
                <div class="alert-premium" style="border-left-color:${color}; margin-bottom:12px; cursor:pointer;" data-action="alertas-open" data-alerta-id="${escHtml(a.id)}">
                    <div class="icon-box-premium" style="background:${color}15; color:${color}; width:36px; height:36px; font-size:1rem;">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                <strong style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(a.mensaje)}</strong>
                                ${badge(a.prioridad)}
                            </div>
                            <button class="btn-xs" style="background:var(--bg-2); border:none; border-radius:4px; cursor:pointer;" data-action="alertas-archivar" data-alerta-id="${escHtml(a.id)}" title="Marcar como gestionada"><i class="fas fa-check"></i></button>
                        </div>
                        ${causa ? `<div style="font-size:12px; color:var(--text-2); margin:2px 0;">Causa: ${escHtml(causa.caratula)}</div>` : ''}
                        <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">
                            ${new Date(a.fechaObjetivo).toLocaleDateString('es-CL')} · ${escHtml(a.tipo).toUpperCase()}
                        </div>
                    </div>
                </div>`;
            });

            // Documentos con plazo próximo
            const docsConPlazo = DB.documentos.filter(d => d.generaPlazo && d.fechaVencimiento);
            docsConPlazo.forEach(d => {
                const venc = new Date(d.fechaVencimiento + 'T12:00:00');
                const diffDays = Math.ceil((venc - today) / 86400000);
                if (diffDays <= 5 && diffDays >= 0) {
                    const causa = DB.causas.find(c => c.id === d.causaId);
                    const color = diffDays <= 2 ? 'var(--danger)' : 'var(--warning)';
                    html += `
                    <div class="alert-premium" style="border-left-color:${color}; margin-bottom:12px; background:${diffDays <= 2 ? 'var(--danger-bg)' : 'var(--warning-bg)'}">
                        <div class="icon-box-premium" style="background:${color}20; color:${color}; width:36px; height:36px; font-size:1rem;">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div style="flex:1;">
                            <strong>Plazo en ${diffDays} día(s)</strong>
                            <div style="font-size:12px; color:var(--text-2); margin:2px 0;">${escHtml(d.descripcion || d.nombreOriginal || '')}</div>
                            <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">
                                Vence: ${d.fechaVencimiento} ${causa ? `— ${escHtml(causa.caratula)}` : ''}
                            </div>
                        </div>
                    </div>`;
                }
            });

            // Causas con riesgo probatorio elevado
            DB.causas.filter(c => c.riesgo?.probatorio === 'Alto').forEach(c => {
                html += `
                <div class="alert-premium" style="border-left-color:var(--info); margin-bottom:12px;">
                    <div class="icon-box-premium" style="background:var(--info-bg); color:var(--info); width:36px; height:36px; font-size:1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="font-size:13px;">
                        Riesgo probatorio elevado en <strong>${escHtml(c.caratula)}</strong> — se recomienda revisar estrategia.
                    </div>
                </div>`;
            });

            el.innerHTML = html || '<div class="empty-state" style="padding:22px 14px;"><i class="fas fa-check-circle" style="color:var(--success-ink);"></i><p>Sin alertas activas.</p></div>';
        }

        function _waRenderTemplate(raw, vars) {
            return String(raw || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
                const v = vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '';
                return (v === null || v === undefined) ? '' : String(v);
            });
        }

        async function _waGetConfigSafe() {
            try {
                if (!window.electronAPI?.whatsapp?.estado) return null;
                return await window.electronAPI.whatsapp.estado();
            } catch (_) {
                return null;
            }
        }

        function _waClienteEnVentanaAutomatica(clienteId, tipoMsg) {
            try {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const mas2 = new Date(hoy);
                mas2.setDate(mas2.getDate() + 2);

                const causas = (DB.causas || []).filter(c => String(c?.clienteId) === String(clienteId));
                for (const causa of causas) {
                    const h = causa?.honorarios;
                    const plan = Array.isArray(h?.planPagos) ? h.planPagos : [];
                    for (const cuota of plan) {
                        if (!cuota || String(cuota.estado || '').toUpperCase() === 'PAGADA') continue;
                        const f = new Date(cuota.fechaVencimiento);
                        if (Number.isNaN(f.getTime())) continue;
                        f.setHours(0, 0, 0, 0);

                        if (tipoMsg === 'recordatorio') {
                            if (f >= hoy && f <= mas2) return true; // hoy o d+2
                        }
                        if (tipoMsg === 'vencimiento') {
                            if (f < hoy) return true; // vencida
                        }
                    }
                }
                return false;
            } catch (_) {
                return false;
            }
        }

        async function _waEnviarPlantillaCliente(clienteId, tipoMsg) {
            const cli = (DB.clientes || []).find(c => String(c.id) === String(clienteId));
            if (!cli) { showError('Cliente no encontrado.'); return; }

            const tel = String(cli.telefono || '').replace(/[\s\+\-\(\)]/g, '').trim();
            if (!tel) { showInfo('El cliente no tiene teléfono registrado.'); return; }

            const cfg = await _waGetConfigSafe();
            const tpl = (cfg && cfg.waTemplates && typeof cfg.waTemplates === 'object') ? cfg.waTemplates : {};

            let key = 'MENSAJE_LIBRE';
            if (tipoMsg === 'recordatorio') key = 'RECORDATORIO_PAGO';
            if (tipoMsg === 'vencimiento') key = 'ALERTA_VENCIMIENTO';
            if (tipoMsg === 'bienvenida') key = 'BIENVENIDA_CLIENTE';
            if (tipoMsg === 'libre') key = 'MENSAJE_LIBRE';

            const defaults = {
                RECORDATORIO_PAGO: 'Estimado/a {{nombre_cliente}}, le recordamos que su cuota de $ {{monto}} vence {{fecha_venc}}.',
                VENCE_HOY: 'Estimado/a {{nombre_cliente}}, su cuota de $ {{monto}} vence hoy. Si ya pagó, por favor ignorar este mensaje.',
                PAGO_VENCIDO: 'Estimado/a {{nombre_cliente}}, su cuota de $ {{monto}} venció el {{fecha_venc}}. Favor regularizar a la brevedad.',
                ALERTA_VENCIMIENTO: '🚨 *ALERTA DE VENCIMIENTO*\n\n{{detalle}}',
                BIENVENIDA_CLIENTE: 'Hola {{nombre_cliente}}, bienvenido/a. Quedamos atentos a ayudarte.',
                MENSAJE_LIBRE: 'Hola {{nombre_cliente}},\n\n{{mensaje}}'
            };
            
            // Extraer monto y fecha de cuota pendiente real
            let montoPendiente = 0;
            let fechaVenc = new Date().toLocaleDateString('es-CL');
            let fechaVencISO = '';
            const causas = (DB.causas || []).filter(c => String(c?.clienteId) === String(clienteId));
            for (const causa of causas) {
                const h = causa?.honorarios;
                const plan = Array.isArray(h?.planPagos) ? h.planPagos : [];
                for (const cuota of plan) {
                    if (!cuota || String(cuota.estado || '').toUpperCase() === 'PAGADA') continue;
                    montoPendiente = parseFloat(cuota.monto || 0);
                    if (cuota.fechaVencimiento) {
                        fechaVencISO = String(cuota.fechaVencimiento).slice(0, 10);
                        fechaVenc = new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL');
                    }
                    break; // primera cuota pendiente
                }
                if (montoPendiente > 0) break;
            }

            if (tipoMsg === 'vencimiento') {
                const hoyISO = new Date().toISOString().slice(0, 10);
                if (fechaVencISO && fechaVencISO < hoyISO) key = 'PAGO_VENCIDO';
                else key = 'VENCE_HOY';
            }

            let mensaje = String(tpl[key] || defaults[key] || '').trim();

            const vars = {
                nombre_cliente: cli.nombre || cli.nom || 'Cliente',
                monto: montoPendiente > 0 ? Math.round(montoPendiente).toLocaleString('es-CL') : '0',
                fecha_venc: fechaVenc,
                detalle: `Cliente: ${cli.nombre || cli.nom || 'Cliente'}`,
                mensaje: 'Escribimos para tomar contacto desde el estudio.'
            };

            if (key === 'MENSAJE_LIBRE') {
                const custom = prompt('Mensaje libre para enviar al cliente:', 'Hola, te escribimos desde el estudio.');
                if (!custom || !custom.trim()) return;
                vars.mensaje = custom.trim();
            }

            // Confirmación obligatoria si es envío manual fuera de ventana de aviso automática
            if ((tipoMsg === 'recordatorio' || tipoMsg === 'vencimiento') && !_waClienteEnVentanaAutomatica(clienteId, tipoMsg)) {
                const plantillaInfo = (tipoMsg === 'vencimiento')
                    ? `\nPlantilla seleccionada automáticamente: ${key}.\n`
                    : '';
                const okFueraPlazo = confirm(
                    'Este mensaje se enviará MANUALMENTE fuera de plazo automático.\n\n' +
                    plantillaInfo +
                    '¿Confirmas que deseas enviarlo de todas formas?'
                );
                if (!okFueraPlazo) return;
            }

            mensaje = _waRenderTemplate(mensaje, vars).trim();
            const webLink = String(cfg?.waBranding?.webLink || '').trim();
            if (webLink && !mensaje.includes(webLink)) {
                mensaje = `${mensaje}\n\n${webLink}`.trim();
            }
            if (!mensaje) { showError('Plantilla vacía. Revisa la configuración de WhatsApp.'); return; }

            try {
                let r;
                if (key === 'BIENVENIDA_CLIENTE' && window.electronAPI?.whatsapp?.enviarBienvenida) {
                    r = await window.electronAPI.whatsapp.enviarBienvenida(tel, mensaje);
                } else {
                    r = await window.electronAPI.whatsapp.enviarAlertaA(tel, mensaje);
                }
                if (r?.ok) showSuccess(`Mensaje enviado a ${cli.nombre || cli.nom || 'cliente'} (+${tel}).`);
                else showError(r?.error || 'No se pudo enviar el mensaje por WhatsApp.');
            } catch (e) {
                showError(e?.message || 'No se pudo enviar el mensaje por WhatsApp.');
            }
        }

        async function _waEnviarBienvenidaAutoCliente(cliente) {
            try {
                if (!cliente) return;
                const tel = String(cliente.telefono || '').replace(/[\s\+\-\(\)]/g, '').trim();
                if (!tel) return;
                const cfg = await _waGetConfigSafe();
                const tpl = (cfg && cfg.waTemplates && typeof cfg.waTemplates === 'object') ? cfg.waTemplates : {};
                const base = String(tpl.BIENVENIDA_CLIENTE || 'Hola {{nombre_cliente}}, bienvenido/a. Quedamos atentos a ayudarte.').trim();
                let mensaje = _waRenderTemplate(base, { nombre_cliente: cliente.nombre || cliente.nom || 'Cliente' }).trim();
                const webLink = String(cfg?.waBranding?.webLink || '').trim();
                if (webLink && !mensaje.includes(webLink)) {
                    mensaje = `${mensaje}\n\n${webLink}`.trim();
                }
                if (!mensaje) return;
                if (window.electronAPI?.whatsapp?.enviarBienvenida) {
                    await window.electronAPI.whatsapp.enviarBienvenida(tel, mensaje);
                }
            } catch (_) {}
        }

        window.uiWaEnviarPlantillaCliente = _waEnviarPlantillaCliente;

        function renderClientes() {
            const el = document.getElementById('client-list');
            const lista = (DB.clientes || []).filter(c => (c && (c.estado || c.status) !== 'prospecto'));
            if (!lista.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Sin clientes registrados</p></div>';
                return;
            }

            const puedeEliminar = (typeof Users !== 'undefined' && typeof Users.tienePermiso === 'function')
                ? Users.tienePermiso('eliminarClientes')
                : true;

            el.innerHTML = lista.map(c => {
                const causasCliente = DB.causas.filter(ca => ca.clienteId === c.id).length;
                const esProspecto = (c.estado || c.status) === 'prospecto';
                return `
                <div class="card-premium" style="margin-bottom:16px;" data-cliente-id="${c.id}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="display:flex; gap:14px; align-items:center;">
                            <div class="icon-box-premium">
                                <i class="fas ${esProspecto ? 'fa-user-clock' : 'fa-user-tie'}"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; letter-spacing:-0.3px;">${escHtml(c.nombre || c.nom || '')}</h4>
                                <div style="font-size:12px; color:var(--text-3); font-family:'IBM Plex Mono',monospace; margin-top:2px;">
                                    RUT: ${escHtml(c.rut || '—')}
                                </div>
                            </div>
                        </div>
                        <span class="badge ${esProspecto ? 'badge-w' : 'badge-s'}" style="padding:4px 12px; font-weight:700;">${(c.estado || c.status || '').toUpperCase()}</span>
                    </div>
                    
                    <div style="margin:16px 0; padding:12px; background:var(--bg); border-radius:var(--r-md); font-size:13px; color:var(--text-2); line-height:1.5; border:1px solid var(--border);">
                        ${escHtml((c.descripcion || c.rel || 'Sin descripción adicional').substring(0, 100))}${(c.descripcion || c.rel || '').length > 100 ? '...' : ''}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:12px; font-weight:600; color:var(--cyan);">
                            ${causasCliente > 0 ? `<i class="fas fa-folder-open"></i> ${causasCliente} causa${causasCliente > 1 ? 's' : ''}` : '<i class="fas fa-folder"></i> Sin causas'}
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                            <button onclick="uiWaEnviarPlantillaCliente('${c.id}','recordatorio')" class="btn btn-xs" style="background:#14532d; color:#fff; border:none;" title="Recordatorio de pago"><i class="fab fa-whatsapp"></i> Recordatorio</button>
                            <button onclick="uiWaEnviarPlantillaCliente('${c.id}','vencimiento')" class="btn btn-xs" style="background:#7f1d1d; color:#fff; border:none;" title="Alerta de vencimiento"><i class="fas fa-exclamation-triangle"></i></button>
                            <button onclick="uiWaEnviarPlantillaCliente('${c.id}','bienvenida')" class="btn btn-xs" style="background:#0e7490; color:#fff; border:none;" title="Bienvenida cliente"><i class="fas fa-handshake"></i></button>
                            <button onclick="uiWaEnviarPlantillaCliente('${c.id}','libre')" class="btn btn-xs" style="background:#334155; color:#fff; border:none;" title="Mensaje libre"><i class="fas fa-comment-dots"></i></button>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${esProspecto ? `<button onclick="(typeof plantillaCausaAbrir==='function') ? plantillaCausaAbrir('${c.id}') : convertToCause('${c.id}')" class="btn btn-p btn-sm"><i class="fas fa-plus"></i> Abrir Causa</button>` : ''}
                            <button onclick="editClient('${c.id}')" class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-edit"></i></button>
                            <button onclick="verPerfilCliente?.('${c.id}')" class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-external-link-alt"></i></button>
                            ${puedeEliminar ? `<button onclick="deleteClient('${c.id}')" class="btn btn-d btn-sm"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function editClient(id) {
            const c = DB.clientes.find(x => x.id === id);
            if (!c) return;
            if (typeof migAbrir !== 'function') {
                showError('No está disponible el editor de formularios.');
                return;
            }

            migAbrir({
                titulo: '<i class="fas fa-user-edit"></i> Editar Cliente',
                btnOk: 'Guardar cambios',
                campos: [
                    { id: 'nombre', label: 'Nombre Completo', valor: (c.nombre || c.nom || ''), placeholder: 'Ej: Juan Pérez González', tipo: 'text', requerido: true },
                    { id: 'rut', label: 'RUT', valor: (c.rut || ''), placeholder: 'Ej: 12.345.678-9', tipo: 'rut' },
                    { id: 'telefono', label: 'Teléfono', valor: (c.telefono || ''), placeholder: 'Ej: +56 9 1234 5678', tipo: 'tel' },
                    { id: 'rel', label: 'Relato de Hechos', valor: (c.descripcion || c.rel || ''), placeholder: 'Descripción de los hechos para análisis de estrategia...', tipo: 'textarea' }
                ],
                onOk: (vals) => {
                    const nom = (vals.nombre || '').trim();
                    const rutRaw = (vals.rut || '').trim();
                    if (!nom) { showError('Ingrese el nombre del cliente.'); return; }
                    if (rutRaw && typeof validarRUT === 'function' && !validarRUT(rutRaw)) {
                        showError('RUT inválido — verifique el dígito verificador.');
                        return;
                    }

                    c.nombre = nom;
                    c.nom = nom;
                    c.rut = rutRaw ? (typeof formatRUT === 'function' ? formatRUT(rutRaw) : rutRaw) : '';
                    c.telefono = (vals.telefono || '').trim();
                    const rel = (vals.rel || '').trim();
                    c.rel = rel;
                    c.descripcion = rel;

                    registrarEvento(`Cliente actualizado: ${nom}${c.rut ? ' · RUT: ' + c.rut : ''}`);
                    if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
                    showSuccess('Cliente actualizado.');
                }
            });
        }

        // ─── Barra de filtros y orden para listado de causas ─────────────────
        function _ensureCausasToolbar() {
            if (document.getElementById('causa-filtros-toolbar')) return;
            const causaList = document.getElementById('causa-list');
            if (!causaList || !causaList.parentNode) return;

            const toolbar = document.createElement('div');
            toolbar.id = 'causa-filtros-toolbar';
            toolbar.className = 'db-filtros';
            toolbar.style.marginBottom = '14px';
            toolbar.innerHTML = `
                <span class="db-filtro-icon"><i class="fas fa-filter"></i></span>
                <div class="db-filtro-group">
                    <label>Estado</label>
                    <select id="causa-flt-estado">
                        <option value="">Todos</option>
                        <option value="En tramitación">En tramitación</option>
                        <option value="Finalizada">Finalizada</option>
                        <option value="Suspendida">Suspendida</option>
                    </select>
                </div>
                <div class="db-filtro-group">
                    <label>Cliente</label>
                    <select id="causa-flt-cliente">
                        <option value="">Todos los clientes</option>
                    </select>
                </div>
                <div class="db-filtro-group" style="flex:1; min-width:140px;">
                    <label>Buscar (carátula / RIT)</label>
                    <input type="text" id="causa-flt-busqueda" placeholder="Escriba para filtrar..." style="width:100%; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:0.85rem; background:var(--bg-2,#f8fafc);">
                </div>
                <div class="db-filtro-group">
                    <label>Tipo de gestión</label>
                    <select id="causa-flt-tipo-exp">
                        <option value="">Todos</option>
                        <option value="judicial">Judiciales</option>
                        <option value="tramite">Administrativos</option>
                    </select>
                </div>
                <div class="db-filtro-group">
                    <label>Ordenar por</label>
                    <select id="causa-flt-orden">
                        <option value="fecha">Fecha última actividad</option>
                        <option value="pendiente">Saldo pendiente</option>
                        <option value="caratula">Carátula (A-Z)</option>
                    </select>
                </div>
                <button type="button" class="db-clear-btn" id="causa-flt-limpiar" title="Limpiar filtros"><i class="fas fa-times"></i> Limpiar</button>
                <span class="db-counter" id="causa-filtros-counter" style="margin-left:auto; font-size:0.8rem; color:var(--text-3); white-space:nowrap;"></span>
            `;
            causaList.parentNode.insertBefore(toolbar, causaList);

            const onUpdate = () => renderCausas();
            document.getElementById('causa-flt-estado').addEventListener('change', onUpdate);
            document.getElementById('causa-flt-cliente').addEventListener('change', onUpdate);
            document.getElementById('causa-flt-busqueda').addEventListener('input', onUpdate);
            document.getElementById('causa-flt-tipo-exp').addEventListener('change', onUpdate);
            document.getElementById('causa-flt-orden').addEventListener('change', onUpdate);
            document.getElementById('causa-flt-limpiar').addEventListener('click', () => {
                document.getElementById('causa-flt-estado').value = '';
                document.getElementById('causa-flt-cliente').value = '';
                document.getElementById('causa-flt-busqueda').value = '';
                document.getElementById('causa-flt-tipo-exp').value = '';
                document.getElementById('causa-flt-orden').value = 'fecha';
                renderCausas();
            });
        }

        function _getCausasFiltradasYOrdenadas() {
            const estadoVal = (document.getElementById('causa-flt-estado') || {}).value || '';
            const clienteVal = (document.getElementById('causa-flt-cliente') || {}).value || '';
            const busquedaVal = ((document.getElementById('causa-flt-busqueda') || {}).value || '').trim().toLowerCase();
            const tipoExpVal = (document.getElementById('causa-flt-tipo-exp') || {}).value || '';
            const ordenVal = (document.getElementById('causa-flt-orden') || {}).value || 'fecha';

            let list = DB.causas.slice();
            if (estadoVal) list = list.filter(c => (c.estadoGeneral || '') === estadoVal);
            if (clienteVal) list = list.filter(c => String(c.clienteId) === String(clienteVal));
            if (tipoExpVal) {
                list = list.filter(c => {
                    const tipo = String(c.tipoExpediente || (/tramite/i.test(String(c.tipoProcedimiento || '')) ? 'tramite' : 'judicial')).toLowerCase();
                    return tipo === tipoExpVal;
                });
            }
            if (busquedaVal) {
                list = list.filter(c => {
                    const caratula = (c.caratula || '').toLowerCase();
                    const rit = (c.rut || c.rit || '').toString().toLowerCase();
                    return caratula.includes(busquedaVal) || rit.includes(busquedaVal);
                });
            }

            const saldoPendiente = (c) => {
                const h = c.honorarios || {};
                const base = h.montoBase || h.base || 0;
                const pagado = (h.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                return Math.max(0, base - pagado);
            };
            if (ordenVal === 'fecha') {
                list.sort((a, b) => new Date(b.fechaUltimaActividad || b.fechaCreacion || 0) - new Date(a.fechaUltimaActividad || a.fechaCreacion || 0));
            } else if (ordenVal === 'pendiente') {
                list.sort((a, b) => saldoPendiente(b) - saldoPendiente(a));
            } else {
                list.sort((a, b) => (a.caratula || '').localeCompare(b.caratula || '', 'es'));
            }
            return list;
        }

        function _actualizarContadorCausas(mostrando, total) {
            const counter = document.getElementById('causa-filtros-counter');
            if (counter) counter.textContent = `Mostrando ${mostrando} de ${total} causas`;
        }

        function _poblarSelectClientesCausas() {
            const sel = document.getElementById('causa-flt-cliente');
            if (!sel) return;
            const clientes = DB.clientes || [];
            const opts = ['<option value="">Todos los clientes</option>'].concat(
                clientes.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.nombre || c.nom || 'Sin nombre')}</option>`)
            );
            const val = sel.value;
            sel.innerHTML = opts.join('');
            if (val) sel.value = val;
        }

        function renderCausas() {
            _ensureCausasToolbar();
            _poblarSelectClientesCausas();

            const el = document.getElementById('causa-list');
            const total = DB.causas.length;
            if (!total) {
                _actualizarContadorCausas(0, 0);
                el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-gavel"></i><p>Sin causas activas. Convierta un prospecto desde la sección Clientes.</p></div>';
                return;
            }

            const list = _getCausasFiltradasYOrdenadas();
            if (!list.length) {
                _actualizarContadorCausas(0, total);
                el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><p>Ninguna causa coincide con los filtros.</p><button type="button" class="btn btn-sm" style="margin-top:10px;" onclick="document.getElementById(\'causa-flt-limpiar\')?.click()"><i class="fas fa-times"></i> Limpiar filtros</button></div>';
                return;
            }
            _actualizarContadorCausas(list.length, total);

            const colorRiesgo = v => v === 'Alto' ? 'var(--danger)' : v === 'Medio' ? 'var(--warning)' : 'var(--success)';
            el.innerHTML = list.map(c => {
                const rProb = c.riesgo?.probatorio || 'Medio';
                const rProc = c.riesgo?.procesal || 'Bajo';
                const estado = c.estadoGeneral || 'En tramitación';
                const tipoExp = String(c.tipoExpediente || (/tramite/i.test(String(c.tipoProcedimiento || '')) ? 'tramite' : 'judicial')).toLowerCase();
                const esTramite = tipoExp === 'tramite';
                const tipoLabel = esTramite ? 'TRÁMITE' : 'CAUSA JUDICIAL';
                const tipoClass = esTramite ? 'badge-tramite' : 'badge-judicial';
                const stripeColor = esTramite ? '#059669' : '#2563eb';
                const cardBg = esTramite ? 'linear-gradient(180deg, rgba(5,150,105,0.05) 0%, rgba(5,150,105,0.015) 100%)' : 'linear-gradient(180deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0.015) 100%)';
                const iconBg = esTramite ? 'rgba(5,150,105,0.15)' : 'rgba(37,99,235,0.15)';
                const iconColor = esTramite ? '#047857' : '#1d4ed8';
                const progresoTramite = esTramite
                    ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
                            <div style="font-size:10px; color:var(--text-3);">
                                <div style="text-transform:uppercase; font-weight:700; margin-bottom:3px;">Organismo</div>
                                <div style="font-size:11px; color:var(--text-1);">${escHtml(c.tramiteMeta?.organismoLabel || c.tramiteMeta?.organismo || '—')}</div>
                            </div>
                            <div style="font-size:10px; color:var(--text-3);">
                                <div style="text-transform:uppercase; font-weight:700; margin-bottom:3px;">Tipo trámite</div>
                                <div style="font-size:11px; color:var(--text-1);">${escHtml(c.tramiteMeta?.tipoTramite || '—')}</div>
                            </div>
                        </div>`
                    : `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;">
                            <div class="risk-row" style="margin:0;">
                                <div class="risk-label" style="font-size:9px;"><span style="color:var(--text-3)">R.PROBATORIO</span></div>
                                <div class="risk-meter" style="height:4px;"><div class="risk-fill" style="width:${rProb === 'Alto' ? 90 : rProb === 'Medio' ? 50 : 25}%; background:${colorRiesgo(rProb)};"></div></div>
                            </div>
                            <div class="risk-row" style="margin:0;">
                                <div class="risk-label" style="font-size:9px;"><span style="color:var(--text-3)">R.PROCESAL</span></div>
                                <div class="risk-meter" style="height:4px;"><div class="risk-fill" style="width:${rProc === 'Alto' ? 90 : rProc === 'Medio' ? 50 : 25}%; background:${colorRiesgo(rProc)};"></div></div>
                            </div>
                        </div>`;
                return `
                <div class="db-kpi" style="padding:20px; cursor:pointer; border-left:4px solid ${stripeColor}; background:${cardBg};" onclick="tab('causa-detail'); viewCausa('${c.id}');">
                    <div class="icon-box-premium" style="background:${iconBg}; color:${iconColor};">
                        <i class="fas ${esTramite ? 'fa-folder-tree' : 'fa-gavel'}"></i>
                    </div>
                    <div class="db-kpi-data">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div class="db-kpi-val" style="font-size:1.1rem; letter-spacing:-0.2px;">${escHtml(c.caratula)}</div>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <span class="badge ${tipoClass}" style="font-size:9px;">${tipoLabel}</span>
                                <span class="badge ${estado === 'Finalizada' ? 'badge-s' : 'badge-a'}" style="font-size:9px;">${estado.toUpperCase()}</span>
                            </div>
                        </div>
                        <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">ID: ${c.id} · ${escHtml(c.tipoProcedimiento || '')}</div>
                        ${progresoTramite}
                    </div>
                </div>`;
            }).join('');
        }

        function renderJuris() {
            const el = document.getElementById('juris-list');
            if (!DB.jurisprudencia.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>Sin jurisprudencia indexada</p></div>';
                return;
            }
            el.innerHTML = DB.jurisprudencia.map(j => `
        <div class="juris-card card" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="juris-rol">${escHtml(j.rol)}</span>
                <span class="badge badge-a">${escHtml(j.cat)}</span>
            </div>
            <p>${escHtml(j.ext.substring(0, 120))}${j.ext.length > 120 ? '...' : ''}</p>
            <button onclick="deleteJuris(${j.id})" class="btn btn-d btn-sm" style="margin-top:10px;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
        }

        function renderRisk() {
            const id = parseInt(document.getElementById('risk-select').value);
            const c = DB.causas.find(x => x.id === id);
            if (!c) {
                document.getElementById('risk-chart').innerHTML = '';
                document.getElementById('strategy-hint').innerText = 'Seleccione una causa para generar sugerencias estratégicas.';
                return;
            }

            document.getElementById('risk-chart').innerHTML = `
        <div class="risk-row">
            <div class="risk-label"><span>Riesgo Probatorio</span><span>${c.riesgo?.probatorio || '—'}</span></div>
            <div class="risk-meter"><div class="risk-fill" style="width:${c.riesgo?.probatorio || '—'}; background:${c.riesgo?.probatorio === 'Alto' ? 'var(--d)' : c.riesgo?.probatorio === 'Medio' ? 'var(--w)' : 'var(--s)'}"></div></div>
        </div>
        <div class="risk-row">
            <div class="risk-label"><span>Riesgo Procesal</span><span>${c.riesgo?.procesal || '—'}</span></div>
            <div class="risk-meter"><div class="risk-fill" style="width:${c.riesgo?.procesal || '—'}; background:${c.riesgo?.procesal === 'Alto' ? 'var(--d)' : c.riesgo?.procesal === 'Medio' ? 'var(--w)' : 'var(--s)'}"></div></div>
        </div>
        <div class="risk-row">
            <div class="risk-label"><span>Riesgo Estratégico</span><span>${c.riesgo?.estrategico || '—'}</span></div>
            <div class="risk-meter"><div class="risk-fill" style="width:${c.riesgo?.estrategico || '—'}; background:var(--a);"></div></div>
        </div>
    `;

            const hints = [
                `Para <strong>${escHtml(c.caratula)}</strong>: Se recomienda fortalecer el acervo probatorio documental antes de avanzar a etapa de prueba testimonial.`,
                `Considere explorar vías alternativas de resolución (mediación / negociación directa) dado el nivel de riesgo procesal actual.`,
                `Priorizar la búsqueda de jurisprudencia favorable de Cortes de Apelaciones en materias análogas para robustecer los argumentos de fondo.`
            ];
            document.getElementById('strategy-hint').innerHTML = hints.map(h => `<p style="margin-bottom:10px;">• ${h}</p>`).join('');
        }

        // ─── Client Actions ───────────────────────────────────────────────
        async function _hashSHA256(txt) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(txt || '')));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function uiAutorizarAccionCritica(opts = {}) {
            const titulo = opts.titulo || 'Autorización requerida';
            const detalle = opts.detalle || 'Esta acción requiere aprobación administrativa.';

            const pass = await new Promise((resolve) => {
                let modal = document.getElementById('modal-auth-critica');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'modal-auth-critica';
                    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:10000; background:rgba(15,23,42,.55); align-items:center; justify-content:center; padding:16px; pointer-events:auto;';
                    modal.innerHTML = `
                        <div style="width:min(460px, 96vw); background:var(--bg-card,#fff); border:1px solid var(--border,#e2e8f0); border-radius:12px; box-shadow:0 20px 40px rgba(0,0,0,.25); font-family:'IBM Plex Sans',sans-serif; pointer-events:auto;">
                            <div style="padding:14px 16px; border-bottom:1px solid var(--border,#e2e8f0); display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                <h3 id="auth-critica-titulo" style="margin:0; font-size:15px; font-family:'IBM Plex Sans',sans-serif;"><i class="fas fa-shield-alt"></i> Autorización</h3>
                                <button type="button" id="auth-critica-close" class="btn btn-sm" style="background:transparent; border:1px solid var(--border,#e2e8f0); font-family:'IBM Plex Sans',sans-serif;">×</button>
                            </div>
                            <div style="padding:14px 16px; display:grid; gap:10px;">
                                <div id="auth-critica-detalle" style="font-size:13px; color:var(--text-2,#334155); font-family:'IBM Plex Sans',sans-serif;"></div>
                                <label style="font-size:12px; color:var(--text-3,#64748b); font-family:'IBM Plex Sans',sans-serif;">Clave admin o clave temporal</label>
                                <input id="auth-critica-pass" type="password" class="input-field" placeholder="Ingrese clave..." autocomplete="off" style="font-family:'IBM Plex Sans',sans-serif; font-size:14px; background:var(--bg-2,#f1f5f9); color:var(--text-1,#0f172a); caret-color:var(--primary,#0f3460); border:1px solid var(--border,#e2e8f0); pointer-events:auto;" />
                                <div id="auth-critica-error" style="display:none; font-size:12px; color:#b91c1c;"><i class="fas fa-times-circle"></i> Clave inválida.</div>
                                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                                    <button type="button" id="auth-critica-cancel" class="btn btn-sm" style="background:var(--bg-2); border:1px solid var(--border); font-family:'IBM Plex Sans',sans-serif;">Cancelar</button>
                                    <button type="button" id="auth-critica-ok" class="btn btn-sm btn-p" style="font-family:'IBM Plex Sans',sans-serif;"><i class="fas fa-check"></i> Autorizar</button>
                                </div>
                            </div>
                        </div>`;
                    document.body.appendChild(modal);
                }

                const titleEl = document.getElementById('auth-critica-titulo');
                const detailEl = document.getElementById('auth-critica-detalle');
                const passEl = document.getElementById('auth-critica-pass');
                const errEl = document.getElementById('auth-critica-error');
                const btnOk = document.getElementById('auth-critica-ok');
                const btnCancel = document.getElementById('auth-critica-cancel');
                const btnClose = document.getElementById('auth-critica-close');

                if (titleEl) titleEl.innerHTML = `<i class="fas fa-shield-alt"></i> ${escHtml(titulo)}`;
                if (detailEl) detailEl.textContent = detalle;
                if (passEl) {
                    passEl.value = '';
                    passEl.disabled = false;
                    passEl.readOnly = false;
                }
                if (errEl) errEl.style.display = 'none';

                const cleanup = () => {
                    if (btnOk) btnOk.onclick = null;
                    if (btnCancel) btnCancel.onclick = null;
                    if (btnClose) btnClose.onclick = null;
                    if (passEl) passEl.onkeydown = null;
                    modal.style.display = 'none';
                };

                const submit = () => {
                    const v = (passEl?.value || '').trim();
                    if (!v) {
                        if (errEl) {
                            errEl.style.display = 'block';
                            errEl.textContent = 'Ingrese una clave para autorizar.';
                        }
                        passEl?.focus();
                        return;
                    }
                    cleanup();
                    resolve(v);
                };
                const cancel = () => {
                    cleanup();
                    resolve('');
                };

                if (btnOk) btnOk.onclick = submit;
                if (btnCancel) btnCancel.onclick = cancel;
                if (btnClose) btnClose.onclick = cancel;
                if (passEl) passEl.onkeydown = (e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') cancel();
                };

                modal.onclick = (e) => {
                    if (e.target === modal) cancel();
                };

                modal.style.display = 'flex';
                // Forzar reflow para evitar el bug de foco/click que aparece hasta cambiar de ventana
                try { void modal.offsetHeight; } catch (_) {}

                const focusPass = () => {
                    try { passEl?.focus(); passEl?.select?.(); } catch (_) {}
                };
                // Foco inmediato + rAF + fallback
                focusPass();
                requestAnimationFrame(() => focusPass());
                setTimeout(() => focusPass(), 50);
            });
            if (!pass) return false;

            try {
                const hashIngresado = await _hashSHA256(pass);
                const usuarios = (typeof AppConfig !== 'undefined' && AppConfig.get)
                    ? (AppConfig.get('usuarios') || [])
                    : [];
                const usuarioActivo = usuarios.find(u => u && u.activo) || null;

                const admin = usuarios.find(u => u && u.rol === 'admin');
                if (admin && hashIngresado === admin.passwordHash) return true;

                // Clave temporal delegada (si existe en configuración)
                const cfg = (DB && DB.configuracion) ? DB.configuracion : {};
                const tempHash = (cfg.adminClaveTemporalHash || '').toString();
                const tempExp = parseInt(cfg.adminClaveTemporalExp || 0, 10) || 0;
                if (tempHash && hashIngresado === tempHash && tempExp > Date.now()) {
                    return true;
                }

                // Si el usuario activo es admin, también valida contra su propia clave
                if (usuarioActivo && usuarioActivo.rol === 'admin' && hashIngresado === usuarioActivo.passwordHash) {
                    return true;
                }

                showError('Autorización denegada. Se requiere clave válida de administrador.');
                return false;
            } catch (e) {
                showError(e?.message || 'No se pudo validar la autorización.');
                return false;
            }
        }

        function uiOnCambioModoAltaCliente() {
            const modo = (document.getElementById('cl-alta-modo')?.value || 'prospecto').toString();
            const wrap = document.getElementById('cl-alta-tramite-wrap');
            if (wrap) wrap.style.display = (modo === 'tramite') ? 'block' : 'none';
        }

        function addClient() {
            const nom = document.getElementById('cl-nom').value.trim();
            const rutRaw = (document.getElementById('cl-rut')?.value || '').trim();
            const tel = (document.getElementById('cl-telefono')?.value || '').trim();
            const rel = document.getElementById('cl-rel').value.trim();
            const modoAlta = (document.getElementById('cl-alta-modo')?.value || 'prospecto').toString();
            const honorarioTramite = parseFloat(document.getElementById('cl-honorario')?.value || 0) || 0;
            if (!nom) { showError("Ingrese el nombre."); return; }
            if (modoAlta === 'tramite' && honorarioTramite <= 0) {
                showError('Ingrese un honorario válido para el trámite.');
                return;
            }
            if (rutRaw) {
                if (!validarRUT(rutRaw)) {
                    const rutEl = document.getElementById('cl-rut');
                    rutEl.style.borderColor = '#dc2626';
                    rutEl.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)';
                    rutEl.focus();
                    const fb = document.querySelector('.rut-feedback');
                    if (fb) { fb.textContent = '✗ RUT inválido — verifique el dígito verificador'; fb.style.color = '#dc2626'; }
                    return;
                }
            }
            const rut = rutRaw ? formatRUT(rutRaw) : '';

            // Si es PROSPECTO: se registra en CRM (DB.prospectos), no en DB.clientes
            if (modoAlta !== 'tramite') {
                if (!Array.isArray(DB.prospectos)) DB.prospectos = [];
                const nuevoProspecto = {
                    id: 'pros_' + Date.now(),
                    etapa: 'contacto',
                    fechaCreacion: new Date().toISOString(),
                    fechaContacto: new Date().toISOString(),
                    notas: [],
                    nombre: nom,
                    rut,
                    telefono: tel,
                    email: '',
                    materia: 'civil',
                    riesgo: 'medio',
                    origen: 'cliente',
                    descripcion: rel,
                    estrategia: ''
                };
                if (typeof Store !== 'undefined' && Store?.prospectos) Store.prospectos.push(nuevoProspecto);
                else DB.prospectos.push(nuevoProspecto);

                document.getElementById('cl-nom').value = '';
                document.getElementById('cl-rut').value = '';
                const telEl = document.getElementById('cl-telefono');
                if (telEl) telEl.value = '';
                document.getElementById('cl-rel').value = '';
                const honEl = document.getElementById('cl-honorario');
                if (honEl) honEl.value = '';
                const modoEl = document.getElementById('cl-alta-modo');
                if (modoEl) modoEl.value = 'prospecto';
                uiOnCambioModoAltaCliente();
                const fb = document.querySelector('.rut-feedback');
                if (fb) fb.textContent = '';

                registrarEvento(`Prospecto creado (CRM): ${nom}${rut ? ' · RUT: ' + rut : ''}`);
                if (typeof markAppDirty === "function") markAppDirty();
                if (typeof save === 'function') save();
                if (typeof prospectosRender === 'function') prospectosRender();
                if (typeof renderAll === 'function') renderAll();
                try {
                    if (typeof window.tab === 'function') {
                        window.tab('prospectos', document.querySelector(`[onclick="tab('prospectos',this)"]`));
                    }
                } catch (_) {}
                showSuccess('Prospecto registrado en CRM.');
                return;
            }

            const nuevoCliente = {
                id: uid(),
                nombre: nom,
                nom,
                rut,
                telefono: tel,
                rel,
                descripcion: rel,
                estado: (modoAlta === 'tramite') ? 'activo' : 'prospecto',
                status: (modoAlta === 'tramite') ? 'activo' : 'prospecto',
                fechaCreacion: new Date()
            };
            const clienteCreado = (typeof Store !== 'undefined' && Store?.agregarCliente)
                ? Store.agregarCliente(nuevoCliente)
                : (DB.clientes.push(nuevoCliente), nuevoCliente);

            if (modoAlta === 'tramite') {
                const nuevaCausa = {
                    id: uid(),
                    rut: clienteCreado.rut || '',
                    caratula: clienteCreado.nombre,
                    clienteId: clienteCreado.id,
                    tipoProcedimiento: 'Trámite Administrativo',
                    tipoExpediente: 'tramite',
                    rama: 'Administrativo',
                    estadoGeneral: 'En tramitación',
                    instancia: 'Primera',
                    porcentajeAvance: 0,
                    fechaCreacion: new Date(),
                    fechaUltimaActividad: new Date(),
                    etapasProcesales: [{ nombre: 'Ingreso de trámite', completada: false, fecha: null, observacion: '', documentoAsociado: null }],
                    documentos: [],
                    recursos: [],
                    estrategia: {},
                    riesgo: {},
                    honorarios: {},
                    jurisprudenciaAsociada: [],
                    revisadoHoy: false,
                    prioridadManual: false
                };
                const causaCreada = (typeof Store !== 'undefined' && Store?.agregarCausa)
                    ? Store.agregarCausa(nuevaCausa)
                    : (DB.causas.push(nuevaCausa), nuevaCausa);
                if (typeof asignarHonorarios === 'function') {
                    asignarHonorarios(causaCreada.id, honorarioTramite);
                } else {
                    causaCreada.honorarios = { montoTotal: honorarioTramite, montoBase: honorarioTramite, modalidad: 'CONTADO', pagos: [], saldoPendiente: honorarioTramite, planPagos: [] };
                }
                registrarEvento(`Cliente + trámite creados: ${nom} · Honorario $${Math.round(honorarioTramite).toLocaleString('es-CL')}`);
            }

            document.getElementById('cl-nom').value = '';
            document.getElementById('cl-rut').value = '';
            const telEl = document.getElementById('cl-telefono');
            if (telEl) telEl.value = '';
            document.getElementById('cl-rel').value = '';
            const honEl = document.getElementById('cl-honorario');
            if (honEl) honEl.value = '';
            const modoEl = document.getElementById('cl-alta-modo');
            if (modoEl) modoEl.value = 'prospecto';
            uiOnCambioModoAltaCliente();
            const fb = document.querySelector('.rut-feedback');
            if (fb) fb.textContent = '';
            if (modoAlta !== 'tramite') {
                registrarEvento(`Cliente registrado: ${nom}${rut ? ' · RUT: ' + rut : ''}`);
            }
            _waEnviarBienvenidaAutoCliente(clienteCreado);
            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
        }

        function deleteClient(id) {
            if (typeof Users !== 'undefined' && typeof Users.tienePermiso === 'function') {
                if (!Users.tienePermiso('eliminarClientes')) {
                    showError('No tiene permiso para eliminar clientes.');
                    return;
                }
            }
            showConfirm(
                '¿Eliminar cliente?',
                'Se eliminará el registro del cliente y su historial. Esta acción es irreversible.',
                () => {
                    setTimeout(() => {
                        (async () => {
                            if (typeof Users !== 'undefined' && typeof Users.tienePermiso === 'function') {
                                if (!Users.tienePermiso('eliminarClientes')) {
                                    showError('No tiene permiso para eliminar clientes.');
                                    return;
                                }
                            }
                            const autorizado = await uiAutorizarAccionCritica({
                                titulo: 'Eliminar cliente completo',
                                detalle: 'Esta operación también eliminará causas, cobros y documentos asociados.'
                            });
                            if (!autorizado) return;

                            const causasDelCliente = (DB.causas || [])
                                .filter(c => String(c?.clienteId) === String(id))
                                .map(c => c.id);

                            DB.clientes = DB.clientes.filter(c => c.id !== id);

                            // Cascade delete: al eliminar cliente, eliminar también sus causas y artefactos asociados
                            if (causasDelCliente.length > 0) {
                                DB.causas = (DB.causas || []).filter(c => !causasDelCliente.includes(c.id));
                                if (Array.isArray(DB.alertas)) {
                                    DB.alertas = DB.alertas.filter(a => !causasDelCliente.includes(a?.causaId));
                                }
                                if (Array.isArray(DB.documentos)) {
                                    DB.documentos = DB.documentos.filter(d => !causasDelCliente.includes(d?.causaId));
                                }
                            }

                            registrarEvento(`Cliente eliminado: ID ${id}`);
                            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
                            showSuccess("Cliente eliminado correctamente.");
                        })().catch(e => {
                            console.error('[CLIENTE] Error eliminando cliente:', e);
                            showError(e?.message || 'No se pudo eliminar el cliente.');
                        });
                    }, 0);
                },
                'danger'
            );
        }

        function convertToCause(id) {
            const c = DB.clientes.find(x => x.id === id);
            if (!c) return;
            showConfirm("¿Convertir a Causa?", `Se creará una nueva causa para ${c.nombre}.`, () => {
                c.estado = 'activo'; c.status = 'activo';
                const nueva = {
                    id: uid(),
                    rut: c.rut || '',
                    caratula: c.nombre,
                    clienteId: c.id,
                    tipoProcedimiento: 'Ordinario Civil',
                    rama: 'Civil',
                    estadoGeneral: 'En tramitación',
                    instancia: 'Primera',
                    porcentajeAvance: 0,
                    fechaCreacion: new Date(),
                    fechaUltimaActividad: new Date(),
                    etapasProcesales: generarEtapas('Ordinario Civil'),
                    documentos: [],
                    recursos: [],
                    estrategia: {},
                    riesgo: {},
                    honorarios: {},
                    jurisprudenciaAsociada: [],
                    revisadoHoy: false,
                    prioridadManual: false
                };
                const causaCreada = (typeof Store !== 'undefined' && Store?.agregarCausa)
                    ? Store.agregarCausa(nueva)
                    : (DB.causas.push(nueva), nueva);
                evaluarRiesgoIntegral(causaCreada.id);
                registrarEvento(`Causa creada desde cliente: ${causaCreada.caratula}`);
                if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
                showSuccess("Causa creada exitosamente.");
            });
        }

        // ─── Control Financiero (Honorarios) ─────────────────────────────
        async function uiTestAlertaCobro() {
            try {
                if (!window.electronAPI?.whatsapp?.enviarAlertaA) {
                    showError('WhatsApp no está disponible.');
                    return;
                }

                const sel = document.getElementById('hr-causa-sel');
                const causaId = sel ? (sel.value || '').toString().trim() : '';
                if (!causaId) { showError('Seleccione una causa.'); return; }

                const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
                if (!causa) { showError('Causa no encontrada.'); return; }

                const cliente = (DB.clientes || []).find(c => String(c.id) === String(causa.clienteId));
                const clienteNombre = cliente?.nombre || cliente?.nom || 'Cliente';
                const clienteTel = (cliente?.telefono || '').toString().replace(/[\s\+\-\(\)]/g, '').trim();

                const h = causa.honorarios || {};
                const modalidad = (h.modalidad || 'CONTADO').toUpperCase();

                let monto = 0;
                let vencTxt = 'Pendiente';

                if (modalidad === 'CUOTAS' && Array.isArray(h.planPagos) && h.planPagos.length > 0) {
                    const cuota = h.planPagos.find(x => (x?.estado || 'PENDIENTE') !== 'PAGADA') || h.planPagos[0];
                    monto = parseFloat(cuota?.monto) || 0;
                    try {
                        const f = cuota?.fechaVencimiento ? new Date(cuota.fechaVencimiento) : null;
                        vencTxt = (f && !Number.isNaN(f.getTime()))
                            ? f.toLocaleDateString('es-CL')
                            : 'Pendiente';
                    } catch (_) {
                        vencTxt = 'Pendiente';
                    }
                } else {
                    monto = (typeof h.saldoPendiente === 'number') ? h.saldoPendiente : (parseFloat(h.saldoPendiente) || 0);
                    if (!monto) {
                        const base = parseFloat(h.montoTotal || h.montoBase || 0) || 0;
                        const pagado = (h.pagos || []).reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0);
                        monto = Math.max(0, base - pagado);
                    }
                    vencTxt = 'Pendiente';
                }

                const targets = [];

                if (clienteTel && /^\d{10,15}$/.test(clienteTel)) {
                    const msgCliente = `🧪 *TEST DE ALERTA (CLIENTE)*\nCliente: ${clienteNombre}\nCausa: ${causa.caratula || '—'}\nMonto: $${Math.round(monto).toLocaleString('es-CL')}\nVencimiento: ${vencTxt}`;
                    console.log(`[TEST] Enviando a Cliente ${clienteNombre} (+${clienteTel})...`);
                    targets.push({ nombre: `Cliente ${clienteNombre}`, numero: clienteTel, mensaje: msgCliente });
                }

                // Equipo interno (Auto): abogadosPrincipales + destinatarios con autoEnvio
                let estadoWA = null;
                try {
                    estadoWA = await window.electronAPI.whatsapp.estado();
                } catch (_) { estadoWA = null; }

                const internosMap = new Map();
                (estadoWA?.abogadosPrincipales || []).filter(a => a && a.autoEnvio !== false).forEach(a => {
                    const n = (a?.numero || '').toString().replace(/[\s\+\-\(\)]/g, '').trim();
                    if (!n) return;
                    internosMap.set(n, { nombre: a?.nombre || 'Abogado', numero: n });
                });
                (estadoWA?.destinatarios || []).filter(d => d && d.autoEnvio !== false).forEach(d => {
                    const n = (d?.numero || '').toString().replace(/[\s\+\-\(\)]/g, '').trim();
                    if (!n) return;
                    if (!internosMap.has(n)) internosMap.set(n, { nombre: d?.nombre || 'Asistente', numero: n });
                });

                for (const dest of internosMap.values()) {
                    const msgEquipo = `🧪 *TEST DE ALERTA (EQUIPO)*\nCliente: ${clienteNombre}\nCausa: ${causa.caratula || '—'}\nMonto: $${Math.round(monto).toLocaleString('es-CL')}\nVencimiento: ${vencTxt}`;
                    console.log(`[TEST] Enviando a Abogado ${dest.nombre} (+${dest.numero})...`);
                    targets.push({ nombre: dest.nombre, numero: dest.numero, mensaje: msgEquipo });
                }

                // Enviar concurrente
                const settled = await Promise.allSettled(
                    targets.map(t => window.electronAPI.whatsapp.enviarAlertaA(String(t.numero), String(t.mensaje || '')))
                );

                const ok = settled.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
                const total = targets.length;

                showSuccess(`Prueba enviada a ${ok} de ${total} contacto(s).`);
            } catch (e) {
                console.error('[TEST] Error en uiTestAlertaCobro:', e);
                showError(e?.message || 'No se pudo enviar la prueba.');
            }
        }

        async function uiProbarSchedulerCobros() {
            try {
                if (!window.electronAPI?.whatsapp?.probarAlertasCobro) {
                    showError('Función no disponible. Reinicia la app si acabas de actualizar.');
                    return;
                }
                const r = await window.electronAPI.whatsapp.probarAlertasCobro();
                if (!r?.ok) {
                    showError(r?.error || 'No se pudo ejecutar la alerta automática.');
                    return;
                }

                const res = Array.isArray(r?.resultados) ? r.resultados : [];
                const parts = res.map(x => {
                    const label = (x?.tipo === 'vencidas') ? 'vencidas' : `d+${(x?.diasAntes ?? '?')}`;
                    const cd = (x?.cuotasDetectadas ?? 0);
                    const cc = (x?.tipo === 'vencidas')
                        ? (x?.cuotasVencidas ?? 0)
                        : (x?.cuotasCoincidenFecha ?? 0);
                    const sk = (x?.cuotasSaltadasPorMarca ?? 0);
                    const ok = (x?.enviadosOk ?? 0);
                    const tot = (x?.enviadosTotal ?? 0);
                    return `${label}: coinciden=${cc}, omitidas=${sk}, envíos=${ok}/${tot}`;
                });
                const warning = r?.warning ? ` (${r.warning})` : '';
                showSuccess(`Auto ejecutado${warning}. ${parts.join(' | ') || 'Sin datos.'}`);

                try {
                    const allZero = res.length > 0 && res.every(x => (x?.cuotasDetectadas || 0) === 0);
                    if (allZero) {
                        console.log('[COBROS][DEBUG] resultados (obj):', res);
                        try {
                            console.log('[COBROS][DEBUG] resultados (json):\n' + JSON.stringify(res, null, 2));
                        } catch (_) { }
                    }
                } catch (_) { }
            } catch (e) {
                console.error('[COBROS] Error probando scheduler:', e);
                showError(e?.message || 'No se pudo ejecutar la alerta automática.');
            }
        }

        let _hrEditHonorarios = false;

        function _hrParseSel(val) {
            const v = (val || '').toString().trim();
            if (!v) return { tipo: '', id: '' };
            if (v.includes(':')) {
                const [tipo, ...rest] = v.split(':');
                return { tipo: (tipo || '').trim(), id: rest.join(':').trim() };
            }
            // compat legacy: si viene solo ID, asumir causa
            return { tipo: 'causa', id: v };
        }

        function _hrGetEntidad(tipo, id) {
            const t = (tipo || '').toLowerCase();
            const needle = String(id || '');
            if (!needle) return null;
            if (t === 'tramite') {
                try {
                    const lista = (typeof window.TramitesDB !== 'undefined' && window.TramitesDB?.todos)
                        ? window.TramitesDB.todos()
                        : (typeof AppConfig !== 'undefined' && AppConfig.get) ? (AppConfig.get('tramites') || []) : [];
                    return (lista || []).find(x => String(x?.id || '') === needle) || null;
                } catch (_) {
                    return null;
                }
            }
            return (DB.causas || []).find(c => (c?.id == needle) || (String(c?.id) === needle)) || null;
        }

        function _hrEntidadLabel(tipo, ent, idFallback) {
            const t = (tipo || '').toLowerCase();
            if (t === 'tramite') {
                const tipoTr = (ent?.tipo || 'Trámite').toString();
                const car = (ent?.caratula || '').toString();
                return `${tipoTr}${car ? ' — ' + car : ''}`.trim() || (idFallback || 'Trámite');
            }
            return (ent?.caratula || idFallback || 'Causa').toString();
        }

        function _hrRenderRefresh() {
            try {
                if (typeof RenderBus !== 'undefined' && RenderBus?.render) {
                    RenderBus.render('honorarios');
                    RenderBus.render('stats');
                    RenderBus.render('panel');
                    RenderBus.render('selectors');
                    return;
                }
            } catch (_) { }
            try { if (typeof renderAll === 'function') renderAll(); } catch (_) { }
        }

        function _hrGetHonorarios(tipo, ent) {
            const t = (tipo || '').toLowerCase();
            if (!ent) return {};
            if (t === 'tramite') {
                if (!ent.honorarios || typeof ent.honorarios !== 'object') ent.honorarios = {};
                const h = ent.honorarios;
                if (h.montoTotal == null && h.monto != null) h.montoTotal = h.monto;
                if (h.montoBase == null && h.montoTotal != null) h.montoBase = h.montoTotal;
                if (!Array.isArray(h.planPagos) && typeof h.planPagos === 'undefined') h.planPagos = [];
                if (!Array.isArray(h.pagos) && typeof h.pagos === 'undefined') h.pagos = [];
                return h;
            }
            if (!ent.honorarios) ent.honorarios = {};
            return ent.honorarios;
        }

        function _hrSyncTramiteHonorarios(ent) {
            if (!ent || !ent.honorarios || typeof ent.honorarios !== 'object') return;
            const h = ent.honorarios;
            const montoTotal = parseFloat(h.montoTotal || h.montoBase || h.monto || 0) || 0;
            const totalPagado = Array.isArray(h.pagos)
                ? h.pagos.reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0)
                : 0;
            if (typeof h.saldoPendiente !== 'number') h.saldoPendiente = Math.max(0, montoTotal - totalPagado);
            // compat con vista de trámites
            h.monto = montoTotal;
            h.pagado = totalPagado;
            try {
                if (typeof window.TramitesDB !== 'undefined' && typeof window.TramitesDB.actualizar === 'function') {
                    window.TramitesDB.actualizar(ent.id, { honorarios: h });
                    return;
                }
            } catch (_) { }
            try {
                const lista = (typeof AppConfig !== 'undefined' && AppConfig.get) ? (AppConfig.get('tramites') || []) : [];
                const idx = (lista || []).findIndex(x => String(x?.id || '') === String(ent.id || ''));
                if (idx !== -1) {
                    lista[idx] = { ...lista[idx], honorarios: h };
                    if (AppConfig?.set) AppConfig.set('tramites', lista);
                }
            } catch (_) { }
        }

        function _hrSaveEntidad(tipo, ent) {
            const t = (tipo || '').toLowerCase();
            if (!ent) return;
            if (t === 'tramite') {
                _hrSyncTramiteHonorarios(ent);
                return;
            }
            if (typeof markAppDirty === "function") markAppDirty();
            save();
        }

        function uiSetHonorariosEditMode(on) {
            _hrEditHonorarios = !!on;
            const form = document.getElementById('hr-asignar-form');
            const summary = document.getElementById('hr-asignado-summary');
            const btn = document.getElementById('hr-btn-modificar');
            if (form) form.style.display = _hrEditHonorarios ? 'block' : 'none';
            if (summary) summary.style.display = _hrEditHonorarios ? 'none' : 'block';
            if (btn) btn.style.display = _hrEditHonorarios ? 'none' : 'inline-flex';
        }

        function uiCargarHonorariosEnFormulario(causa) {
            const sel = document.getElementById('hr-causa-sel');
            const { tipo } = _hrParseSel(sel ? sel.value : '');
            const h = _hrGetHonorarios(tipo || 'causa', causa);
            const modalidad = (h.modalidad || 'CONTADO').toUpperCase();
            const monto = parseFloat(h.montoTotal || h.montoBase || 0) || 0;
            const elModalidad = document.getElementById('hr-modalidad');
            const elMonto = document.getElementById('hr-monto');
            if (elModalidad) elModalidad.value = modalidad;
            if (elMonto) elMonto.value = monto ? String(Math.round(monto)) : '';

            const wrapCuotas = document.getElementById('hr-cuotas-wrap');
            const wrapContado = document.getElementById('hr-contado-fecha-wrap');
            const elNCuotas = document.getElementById('hr-cuotas-num');
            const elFechaCuotas = document.getElementById('hr-cuotas-fecha');
            const elFechaContado = document.getElementById('hr-contado-fecha');

            if (wrapCuotas) wrapCuotas.style.display = (modalidad === 'CUOTAS') ? 'block' : 'none';
            if (wrapContado) wrapContado.style.display = (modalidad === 'CONTADO') ? 'block' : 'none';

            if (modalidad === 'CUOTAS') {
                const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
                if (elNCuotas) elNCuotas.value = plan.length ? String(plan.length) : (elNCuotas.value || '');
                if (elFechaCuotas) {
                    const f0 = plan[0]?.fechaVencimiento ? new Date(plan[0].fechaVencimiento) : null;
                    if (f0 && !Number.isNaN(f0.getTime())) {
                        const yyyy = String(f0.getFullYear());
                        const mm = String(f0.getMonth() + 1).padStart(2, '0');
                        const dd = String(f0.getDate()).padStart(2, '0');
                        elFechaCuotas.value = `${yyyy}-${mm}-${dd}`;
                    }
                }
            } else if (modalidad === 'CONTADO') {
                const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
                if (elFechaContado && plan[0]?.fechaVencimiento) {
                    const f0 = new Date(plan[0].fechaVencimiento);
                    if (!Number.isNaN(f0.getTime())) {
                        const yyyy = String(f0.getFullYear());
                        const mm = String(f0.getMonth() + 1).padStart(2, '0');
                        const dd = String(f0.getDate()).padStart(2, '0');
                        elFechaContado.value = `${yyyy}-${mm}-${dd}`;
                    }
                }
            }
        }

        function uiHonorariosModificar() {
            const sel = document.getElementById('hr-causa-sel');
            const parsed = _hrParseSel(sel ? sel.value : '');
            if (!parsed?.id) {
                showError('Seleccione una gestión.');
                return;
            }
            const ent = _hrGetEntidad(parsed.tipo || 'causa', parsed.id);
            if (!ent) {
                showError((parsed.tipo || 'causa') === 'tramite' ? 'Trámite no encontrado.' : 'Causa no encontrada.');
                return;
            }
            uiCargarHonorariosEnFormulario(ent);
            uiSetHonorariosEditMode(true);
        }

        function uiVerInsightDocumento(documentoId) {
            try {
                const id = String(documentoId || '').trim();
                if (!id) { showError('Documento inválido.'); return; }
                const doc = _getDocumentoById(id);
                if (!doc) { showError('Documento no encontrado.'); return; }

                const insight = doc.insightIA || null;
                const previo = doc.analisisPrevio || null;
                if (!insight && !previo) {
                    showInfo('Este documento aún no tiene Insight IA guardado.');
                    return;
                }

                let vm = document.getElementById('modal-ia-insight');
                if (!vm) {
                    vm = document.createElement('div');
                    vm.id = 'modal-ia-insight';
                    vm.className = 'modal-overlay';
                    vm.style.cssText = 'display:none; z-index:9999;';
                    vm.innerHTML = `
                        <div class="modal-box" style="max-width:980px; width:92vw;">
                            <div class="modal-header">
                                <h3 id="modal-ia-insight-titulo"></h3>
                                <button class="modal-close" onclick="document.getElementById('modal-ia-insight').style.display='none'">×</button>
                            </div>
                            <div id="modal-ia-insight-body" style="display:flex; flex-direction:column; gap:12px;"></div>
                        </div>`;
                    document.body.appendChild(vm);
                }

                const titulo = `Insight IA — ${doc.nombreOriginal || doc.archivoNombre || 'Documento'}`;
                document.getElementById('modal-ia-insight-titulo').textContent = titulo;

                const jsonInsight = insight ? JSON.stringify(insight, null, 2) : '';
                const jsonPrevio = previo ? JSON.stringify(previo, null, 2) : '';

                const riesgoNivel = (insight && (insight.riesgo_nivel || insight.riesgoNivel)) || '';
                const riesgoMotivo = (insight && (insight.riesgo_motivo || insight.riesgoMotivo)) || '';
                const resumen = (insight && (insight.resumen_ejecutivo || insight.resumenEjecutivo)) || '';
                const tipoDoc = (insight && (insight.tipo_documento || insight.tipoDocumento)) || '';
                const analisis = (insight && (insight.analisis_estrategico || insight.analisisEstrategico)) || '';
                const prox = (insight && (insight.proximos_pasos || insight.proximosPasos)) || [];
                const crit = (insight && insight.datos_criticos) ? insight.datos_criticos : (insight && insight.datosCriticos) ? insight.datosCriticos : null;
                const fechas = Array.isArray(crit?.fechas) ? crit.fechas : [];
                const montos = Array.isArray(crit?.montos) ? crit.montos : [];
                const plazos = Array.isArray(crit?.plazos) ? crit.plazos : [];

                const riesgoColor = (String(riesgoNivel || '').toLowerCase() === 'alto')
                    ? 'var(--danger-ink)'
                    : (String(riesgoNivel || '').toLowerCase() === 'medio')
                        ? 'var(--warning-ink)'
                        : (riesgoNivel ? 'var(--success-ink)' : 'var(--text-3)');

                const li = (arr) => Array.isArray(arr) && arr.length
                    ? `<ul style="margin:8px 0 0 16px; padding:0;">${arr.map(x => `<li style=\"margin:4px 0;\">${escHtml(String(x))}</li>`).join('')}</ul>`
                    : '<div style="margin-top:6px; color:var(--text-3); font-size:12px;">—</div>';

                const _copy = async (txt) => {
                    try {
                        if (!txt) return;
                        if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(txt);
                            showSuccess('Copiado al portapapeles.');
                            return;
                        }
                    } catch (_) {}
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = txt;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showSuccess('Copiado al portapapeles.');
                    } catch (e) {
                        showError('No se pudo copiar.');
                    }
                };

                document.getElementById('modal-ia-insight-body').innerHTML = `
                    ${insight ? `
                        <div style="border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg-card);">
                            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">
                                <div>
                                    <div style="font-size:12px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-3);">Resumen</div>
                                    <div style="margin-top:6px; font-size:14px; font-weight:800; color:var(--text);">${escHtml(tipoDoc || 'Documento')}</div>
                                </div>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <span style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid ${riesgoColor}40; background:${riesgoColor}12; color:${riesgoColor}; font-weight:900; font-size:12px;">
                                        <i class="fas fa-shield-alt"></i> Riesgo: ${escHtml(riesgoNivel || '—')}
                                    </span>
                                    <button class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="(${_copy.toString()})('${escHtml(jsonInsight).replace(/'/g, "\\'")}')" title="Copiar JSON">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            ${resumen ? `<div style="margin-top:10px; color:var(--text-2); font-size:13px; line-height:1.55;">${escHtml(resumen)}</div>` : ''}
                            ${riesgoMotivo ? `<div style="margin-top:10px; padding:10px 12px; border-radius:10px; background:${riesgoColor}10; border:1px solid ${riesgoColor}25; color:var(--text-2); font-size:12.5px; line-height:1.5;"><strong style="color:${riesgoColor};">Motivo:</strong> ${escHtml(riesgoMotivo)}</div>` : ''}
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div style="border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg-card);">
                                <div style="font-size:12px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-3);">Datos críticos</div>
                                <div style="margin-top:10px;">
                                    <div style="font-size:12px; font-weight:800; color:var(--text);">Fechas</div>
                                    ${li(fechas)}
                                </div>
                                <div style="margin-top:10px;">
                                    <div style="font-size:12px; font-weight:800; color:var(--text);">Montos</div>
                                    ${li(montos)}
                                </div>
                                <div style="margin-top:10px;">
                                    <div style="font-size:12px; font-weight:800; color:var(--text);">Plazos</div>
                                    ${li(plazos)}
                                </div>
                            </div>
                            <div style="border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg-card);">
                                <div style="font-size:12px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-3);">Próximos pasos</div>
                                ${li(Array.isArray(prox) ? prox : [])}
                            </div>
                        </div>

                        ${analisis ? `
                            <div style="border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg-card);">
                                <div style="font-size:12px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-3);">Análisis estratégico</div>
                                <div style="margin-top:8px; color:var(--text-2); font-size:13px; line-height:1.55; white-space:pre-wrap;">${escHtml(String(analisis))}</div>
                            </div>
                        ` : ''}

                        <details style="border:1px solid var(--border); border-radius:12px; background:var(--bg-card); overflow:hidden;">
                            <summary style="cursor:pointer; padding:10px 12px; background:var(--bg-2); font-weight:900; font-size:12px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-3);">Ver JSON (IA B)</summary>
                            <pre style="margin:0; padding:12px; white-space:pre-wrap; word-break:break-word; font-size:12.5px; line-height:1.45;">${escHtml(jsonInsight)}</pre>
                        </details>
                    ` : ''}
                    ${previo ? `
                        <details style="border:1px solid var(--border); border-radius:12px; background:var(--bg-card); overflow:hidden;">
                            <summary style="cursor:pointer; padding:10px 12px; background:var(--bg-2); font-weight:900; font-size:12px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-3);">Ver análisis previo (IA A)</summary>
                            <pre style="margin:0; padding:12px; white-space:pre-wrap; word-break:break-word; font-size:12.5px; line-height:1.45;">${escHtml(jsonPrevio)}</pre>
                        </details>
                    ` : ''}
                `;

                vm.style.display = 'flex';
            } catch (e) {
                console.error('[IA] Error abriendo modal insight:', e);
                showError(e?.message || 'No se pudo abrir el Insight IA.');
            }
        }

        function uiActualizarHonorariosVista() {
            const sel = document.getElementById('hr-causa-sel');
            const { tipo, id: causaId } = _hrParseSel(sel ? sel.value : '');
            const summary = document.getElementById('hr-asignado-summary');
            if (!summary) return;

            if (!causaId) {
                summary.innerHTML = '';
                uiSetHonorariosEditMode(true);
                return;
            }

            const ent = _hrGetEntidad(tipo || 'causa', causaId);
            const h = _hrGetHonorarios(tipo || 'causa', ent);
            const base = parseFloat(h.montoTotal || h.montoBase || h.base || h.monto || 0) || 0;
            const modalidad = (h.modalidad || '').toString().toUpperCase();
            const tieneHonorarios = !!base && (modalidad === 'CONTADO' || modalidad === 'CUOTAS');

            if (!tieneHonorarios) {
                summary.innerHTML = '';
                uiSetHonorariosEditMode(true);
                return;
            }

            const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
            const saldo = (typeof h.saldoPendiente === 'number') ? h.saldoPendiente : (parseFloat(h.saldoPendiente) || 0);
            const fecha0 = plan[0]?.fechaVencimiento ? new Date(plan[0].fechaVencimiento) : null;
            const fecha0Txt = (fecha0 && !Number.isNaN(fecha0.getTime())) ? fecha0.toLocaleDateString('es-CL') : '—';

            const fmtFecha = (iso) => {
                try {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    return (!Number.isNaN(d.getTime())) ? d.toLocaleDateString('es-CL') : '—';
                } catch (_) {
                    return '—';
                }
            };

            const planHtml = (modalidad === 'CUOTAS' && plan.length)
                ? `
                    <div style="margin-top:10px; overflow:auto; border:1px solid var(--border); border-radius:10px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                            <thead>
                                <tr style="background:var(--bg-2,#f1f5f9); border-bottom:1px solid var(--border);">
                                    <th style="text-align:left; padding:8px 10px;">Nº</th>
                                    <th style="text-align:right; padding:8px 10px;">Monto</th>
                                    <th style="text-align:left; padding:8px 10px;">Vence</th>
                                    <th style="text-align:left; padding:8px 10px;">Estado</th>
                                    <th style="text-align:left; padding:8px 10px;">Pago</th>
                                    <th style="text-align:right; padding:8px 10px;">Respaldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${plan.map(cuota => {
                                    const est = (cuota?.estado || 'PENDIENTE').toUpperCase();
                                    const badge = est === 'PAGADA'
                                        ? '<span class="badge badge-s">PAGADA</span>'
                                        : '<span class="badge badge-w">PENDIENTE</span>';
                                    const hasComp = !!(cuota?.comprobanteDocumentoId || cuota?.comprobante?.base64);
                                    const btnComp = hasComp
                                        ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobanteCuota('${escHtml(String(tipo||'causa'))}', '${escHtml(String(causaId))}', ${cuota?.numero ?? 0})"><i class=\"fas fa-file-pdf\"></i></button>`
                                        : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                    return `
                                        <tr style="border-bottom:1px solid var(--border-1);">
                                            <td style="padding:8px 10px; font-family:monospace;">${cuota?.numero ?? ''}</td>
                                            <td style="padding:8px 10px; text-align:right; font-family:monospace;">$${(cuota?.monto || 0).toLocaleString('es-CL')}</td>
                                            <td style="padding:8px 10px;">${fmtFecha(cuota?.fechaVencimiento)}</td>
                                            <td style="padding:8px 10px;">${badge}</td>
                                            <td style="padding:8px 10px;">${fmtFecha(cuota?.fechaPago)}</td>
                                            <td style="padding:8px 10px; text-align:right;">${btnComp}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `
                : '';

            summary.innerHTML = `
                <div style="padding:12px; background:var(--bg); border:1px solid var(--border); border-radius:10px;">
                    <div style="font-weight:800; margin-bottom:8px;">Honorarios asignados</div>
                    <div style="font-size:0.85rem; color:var(--text-2); line-height:1.5;">
                        <div><strong>Modalidad:</strong> ${escHtml(modalidad || '—')}</div>
                        <div><strong>Monto:</strong> $${Math.round(base).toLocaleString('es-CL')}</div>
                        ${modalidad === 'CUOTAS' ? `<div><strong>Cuotas:</strong> ${plan.length || 0} · <strong>Primera:</strong> ${escHtml(fecha0Txt)}</div>` : ''}
                        <div><strong>Saldo pendiente:</strong> $${Math.round(saldo).toLocaleString('es-CL')}</div>
                    </div>
                    ${planHtml}
                </div>
            `;

            uiSetHonorariosEditMode(false);
        }

        async function uiAsignarHonorarios(causaIdOverride) {
            const sel = document.getElementById('hr-causa-sel');
            const fromSelect = sel ? (sel.value || '').toString().trim() : '';
            const fromOverride = (causaIdOverride !== undefined && causaIdOverride !== null)
                ? causaIdOverride.toString().trim()
                : '';
            const parsed = _hrParseSel(fromOverride || fromSelect);
            const tipo = parsed.tipo || 'causa';
            const causaId = parsed.id;

            const modalidad = (document.getElementById('hr-modalidad')?.value || 'CONTADO').toUpperCase();
            const monto = parseFloat(document.getElementById('hr-monto').value);
            if (!causaId) { showError('Seleccione una gestión.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }

            const autorizado = await uiAutorizarAccionCritica({
                titulo: 'Asignar/editar honorarios',
                detalle: 'Se modificarán cobros del cliente en Control Financiero.'
            });
            if (!autorizado) return;

            const ent = _hrGetEntidad(tipo, causaId);
            if (!ent) { showError(tipo === 'tramite' ? 'Trámite no encontrado.' : 'Causa no encontrada.'); return; }
            const hEnt = _hrGetHonorarios(tipo, ent);

            if (modalidad === 'CUOTAS') {
                const nCuotas = parseInt(document.getElementById('hr-cuotas-num')?.value) || 0;
                const fechaStr = (document.getElementById('hr-cuotas-fecha')?.value || '').trim();
                if (!nCuotas || nCuotas <= 0) { showError('Ingrese número de cuotas.'); return; }
                if (!fechaStr) { showError('Ingrese fecha primera cuota.'); return; }

                let plan = [];
                try {
                    plan = generarPlanPagos(`${tipo}:${causaId}`, monto, nCuotas, new Date(fechaStr));
                } catch (e) {
                    showError(e?.message || 'No se pudo generar el plan de pagos.');
                    return;
                }

                hEnt.modalidad = 'CUOTAS';
                hEnt.montoTotal = monto;
                hEnt.montoBase = monto; // compat
                hEnt.planPagos = plan;
                // Mantener pagos legacy si existían
                if (!Array.isArray(hEnt.pagos)) hEnt.pagos = [];
                hEnt.saldoPendiente = plan.reduce((s, c) => s + (c.estado === 'PENDIENTE' ? (c.monto || 0) : 0), 0);

                _hrSaveEntidad(tipo, ent);
            } else {
                // CONTADO: crear plan de 1 cuota con fecha editable
                const fechaContadoStr = (document.getElementById('hr-contado-fecha')?.value || '').trim();
                const fechaVenc = fechaContadoStr ? new Date(fechaContadoStr) : new Date();

                hEnt.modalidad = 'CONTADO';
                hEnt.montoTotal = monto;
                hEnt.montoBase = monto; // compat
                hEnt.planPagos = [
                    {
                        numero: 1,
                        monto: monto,
                        fechaVencimiento: fechaVenc.toISOString(),
                        estado: 'PENDIENTE',
                        fechaPago: null
                    }
                ];
                // Mantener pagos legacy si existían
                if (!Array.isArray(hEnt.pagos)) hEnt.pagos = [];
                hEnt.saldoPendiente = monto;

                _hrSaveEntidad(tipo, ent);
            }

            try {
                if (!Array.isArray(DB.alertas)) DB.alertas = [];
                const alertaCausaId = (tipo === 'causa') ? causaId : `${tipo}:${causaId}`;
                const plan = Array.isArray(hEnt?.planPagos) ? hEnt.planPagos : [];
                const cuotaPend = plan.find(c => String(c?.estado || '').toUpperCase() === 'PENDIENTE') || plan[0] || null;
                const fechaVenc = cuotaPend?.fechaVencimiento ? new Date(cuotaPend.fechaVencimiento) : null;
                if (fechaVenc && !Number.isNaN(fechaVenc.getTime())) {
                    const fechaObj = fechaVenc.toISOString().slice(0, 10);
                    const msg = `Cobro pendiente: Honorarios — $${Math.round(monto).toLocaleString('es-CL')}`;
                    const existing = DB.alertas.find(a => a && a._cobro && String(a.causaId) === String(alertaCausaId));
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
                            causaId: alertaCausaId,
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

            registrarEvento(`Honorarios asignados: $${monto.toLocaleString('es-CL')} — ${_hrEntidadLabel(tipo, ent, causaId)}`);
            document.getElementById('hr-monto').value = '';
            renderHonorariosResumen();
            uiRenderPlanPagos(`${tipo}:${causaId}`);
            _hrRenderRefresh();

            uiSetHonorariosEditMode(false);
            uiActualizarHonorariosVista();
        }

        function uiEliminarCobroCausa() {
            const sel = document.getElementById('hr-causa-sel');
            const parsed = _hrParseSel(sel ? sel.value : '');
            const tipo = parsed.tipo || 'causa';
            const causaId = parsed.id;
            if (!causaId) { showError('Seleccione una gestión.'); return; }

            const ent = _hrGetEntidad(tipo, causaId);
            if (!ent) { showError(tipo === 'tramite' ? 'Trámite no encontrado.' : 'Causa no encontrada.'); return; }

            const h = _hrGetHonorarios(tipo, ent) || {};
            const tieneCobro = !!(h.montoTotal || h.montoBase || h.base || (Array.isArray(h.planPagos) && h.planPagos.length) || (Array.isArray(h.pagos) && h.pagos.length));
            if (!tieneCobro) {
                showInfo('La gestión seleccionada no tiene cobros/honorarios registrados.');
                return;
            }

            showConfirm(
                '¿Eliminar cobro de la gestión?',
                `Se eliminarán honorarios, plan de pagos y pagos registrados del expediente "${_hrEntidadLabel(tipo, ent, causaId)}". Esta acción es irreversible.`,
                async () => {
                    const autorizado = await uiAutorizarAccionCritica({
                        titulo: 'Eliminar cobro de gestión',
                        detalle: `Expediente: ${_hrEntidadLabel(tipo, ent, causaId)}`
                    });
                    if (!autorizado) return;

                    ent.honorarios = {};
                    _hrSaveEntidad(tipo, ent);
                    registrarEvento(`Cobro eliminado en Control Financiero: ${_hrEntidadLabel(tipo, ent, causaId)}`);
                    renderHonorariosResumen();
                    uiActualizarHonorariosVista();
                    uiRenderPlanPagos(`${tipo}:${causaId}`);
                    uiRenderPagosList(`${tipo}:${causaId}`);
                    if (typeof renderHonorarios === 'function') renderHonorarios();
                    _hrRenderRefresh();
                    showSuccess('Cobro eliminado correctamente.');
                },
                'danger'
            );
        }

        function _fileToBase64DataUrl(file) {
            return new Promise((resolve, reject) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
                    reader.readAsDataURL(file);
                } catch (e) {
                    reject(e);
                }
            });
        }

        async function _pickPdfComprobante() {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,application/pdf';
                input.style.display = 'none';
                document.body.appendChild(input);

                input.onchange = async () => {
                    try {
                        const file = input.files && input.files[0];
                        if (!file) { resolve(null); return; }
                        if (file.type !== 'application/pdf') { showError('Solo se acepta PDF.'); resolve(null); return; }
                        const dataUrl = await _fileToBase64DataUrl(file);
                        const base64 = dataUrl.split(',')[1] || '';
                        resolve({ nombre: file.name, mime: file.type, base64 });
                    } catch (e) {
                        console.error('[PAGO] Error leyendo comprobante:', e);
                        showError(e?.message || 'No se pudo leer el comprobante.');
                        resolve(null);
                    } finally {
                        try { document.body.removeChild(input); } catch (_) {}
                    }
                };

                input.click();
            });
        }

        function uiAbrirPdfBase64(base64, nombre = 'comprobante.pdf') {
            if (!base64) { showError('No hay comprobante.'); return; }
            const url = `data:application/pdf;base64,${base64}`;
            const w = window.open(url, '_blank');
            if (!w) showError('El navegador bloqueó la ventana emergente.');
        }

        async function _getDocumentoBase64(d) {
            try {
                if (!d) return '';
                const legacy = (typeof d.archivoBase64 === 'string') ? d.archivoBase64 : '';
                if (legacy) return legacy;

                const docId = (typeof d.archivoDocId === 'string') ? d.archivoDocId.trim() : '';
                if (!docId) return '';

                const api = window.electronAPI;
                if (!api?.docs?.leer) return '';
                const r = await api.docs.leer(docId);
                if (r?.ok && typeof r.data === 'string') return r.data;
                return '';
            } catch (_) {
                return '';
            }
        }

        function _getDocumentoById(id) {
            if (!id) return null;
            const docs = (DB && Array.isArray(DB.documentos)) ? DB.documentos : [];
            const hit = docs.find(d => d && (String(d.id) === String(id)));
            if (hit) return hit;
            // Fallback legacy: algunos flujos mantienen documentos embebidos en causa.documentos
            try {
                const causas = (DB && Array.isArray(DB.causas)) ? DB.causas : [];
                for (const c of causas) {
                    const arr = Array.isArray(c?.documentos) ? c.documentos : [];
                    const d2 = arr.find(d => d && (String(d.id) === String(id)));
                    if (d2) return d2;
                }
            } catch (_) { }
            return null;
        }

        async function uiAnalisisDualDocumento(documentoId) {
            try {
                if (typeof window.analizarDocumentoDual !== 'function') {
                    showError('Motor IA no disponible. Verifique js/12-ia-providers.js.');
                    return;
                }
                const id = String(documentoId || '').trim();
                if (!id) { showError('Documento inválido.'); return; }

                const btn = document.getElementById(`btn-ia-dual-${id}`);
                const prevTxt = btn ? btn.innerHTML : '';
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
                }

                const r = await window.analizarDocumentoDual(id, (msg) => {
                    if (btn) btn.innerHTML = `<i class=\"fas fa-spinner fa-spin\"></i> ${escHtml(msg || 'Procesando...')}`;
                });

                const riesgo = r?.insightFinal?.riesgo_nivel || r?.insightFinal?.riesgoNivel || '';
                showSuccess(`Análisis completado${riesgo ? `: Riesgo ${riesgo}` : ''}.`);
                if (typeof renderAll === 'function') renderAll();
            } catch (e) {
                console.error('[IA] Error en análisis dual:', e);
                showError(e?.message || 'No se pudo completar el análisis dual.');
            } finally {
                const id = String(documentoId || '').trim();
                const btn = document.getElementById(`btn-ia-dual-${id}`);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-brain"></i> Análisis Dual';
                }
            }
        }

        function _guardarComprobanteComoDocumento(causaId, comp, metaDesc) {
            try {
                if (!comp || !comp.base64) return null;
                if (!DB || !Array.isArray(DB.documentos)) DB.documentos = [];
                const doc = {
                    id: (typeof uid === 'function') ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
                    causaId: causaId,
                    nombreOriginal: comp.nombre || 'comprobante.pdf',
                    tipo: 'Comprobante',
                    etapaVinculada: '',
                    fechaDocumento: (new Date().toISOString().split('T')[0]),
                    generaPlazo: false,
                    diasPlazo: 0,
                    fechaVencimiento: null,
                    fechaIngreso: new Date().toISOString(),
                    descripcion: metaDesc || 'Comprobante de pago',
                    archivoBase64: comp.base64,
                    archivoNombre: comp.nombre || 'comprobante.pdf',
                    archivoMime: comp.mime || 'application/pdf',
                    proveedorIA: null,
                    _origen: 'ui-comprobante'
                };
                if (typeof Store !== 'undefined' && Store?.agregarDocumento) Store.agregarDocumento(doc);
                else DB.documentos.push(doc);
                return doc.id;
            } catch (e) {
                console.error('[PAGO] Error guardando comprobante como documento:', e);
                return null;
            }
        }

        async function uiVerComprobanteCuota(tipo, causaId, numeroCuota) {
            // Back-compat: llamada legacy (causaId, numero)
            if (numeroCuota === undefined && (typeof causaId === 'number' || typeof causaId === 'string')) {
                numeroCuota = causaId;
                causaId = tipo;
                tipo = 'causa';
            }
            const ent = _hrGetEntidad(tipo || 'causa', causaId);
            const h = _hrGetHonorarios(tipo || 'causa', ent);
            const cuota = h?.planPagos?.find(c => parseInt(c.numero) === parseInt(numeroCuota));
            if (!cuota) { showError('Cuota no encontrada.'); return; }

            if (cuota.comprobanteDocumentoId) {
                const d = _getDocumentoById(cuota.comprobanteDocumentoId);
                const b64 = await _getDocumentoBase64(d);
                if (!b64) { showError('No se encontró el documento del comprobante.'); return; }
                uiAbrirPdfBase64(b64, d?.archivoNombre || d?.nombreOriginal || 'comprobante.pdf');
                return;
            }

            const comp = cuota?.comprobante;
            if (!comp?.base64) { showError('No hay comprobante en esta cuota.'); return; }
            uiAbrirPdfBase64(comp.base64, comp.nombre || 'comprobante.pdf');
        }

        async function uiVerComprobantePago(tipo, causaId, idxPago) {
            // Back-compat: llamada legacy (causaId, idx)
            if (idxPago === undefined && (typeof causaId === 'number' || typeof causaId === 'string')) {
                idxPago = causaId;
                causaId = tipo;
                tipo = 'causa';
            }
            const ent = _hrGetEntidad(tipo || 'causa', causaId);
            const h = _hrGetHonorarios(tipo || 'causa', ent);
            const pago = (h?.pagos || [])[parseInt(idxPago)];
            if (!pago) { showError('Pago no encontrado.'); return; }

            if (pago.comprobanteDocumentoId) {
                const d = _getDocumentoById(pago.comprobanteDocumentoId);
                const b64 = await _getDocumentoBase64(d);
                if (!b64) { showError('No se encontró el documento del comprobante.'); return; }
                uiAbrirPdfBase64(b64, d?.archivoNombre || d?.nombreOriginal || 'comprobante.pdf');
                return;
            }

            const comp = pago?.comprobante;
            if (!comp?.base64) { showError('No hay comprobante en este pago.'); return; }
            uiAbrirPdfBase64(comp.base64, comp.nombre || 'comprobante.pdf');
        }

        function uiRenderPagosList(causaId) {
            const el = document.getElementById('hr-pagos-list');
            if (!el) return;
            const parsed = _hrParseSel(causaId);
            const tipo = parsed.tipo || 'causa';
            const id = parsed.id;
            const ent = _hrGetEntidad(tipo, id);
            const h = _hrGetHonorarios(tipo, ent);
            const pagos = Array.isArray(h?.pagos) ? h.pagos : [];
            if (!id || !pagos.length) { el.innerHTML = ''; return; }

            const fmtFecha = (iso) => {
                try {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    return (!Number.isNaN(d.getTime())) ? d.toLocaleDateString('es-CL') : '—';
                } catch (_) { return '—'; }
            };

            el.innerHTML = `
                <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-3); margin:10px 0 8px;">
                    <i class="fas fa-receipt"></i> Pagos registrados
                </div>
                <div style="overflow:auto; border:1px solid var(--border); border-radius:10px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                        <thead>
                            <tr style="background:var(--bg-2,#f1f5f9); border-bottom:1px solid var(--border);">
                                <th style="text-align:left; padding:8px 10px;">Fecha</th>
                                <th style="text-align:right; padding:8px 10px;">Monto</th>
                                <th style="text-align:left; padding:8px 10px;">Concepto</th>
                                <th style="text-align:right; padding:8px 10px;">Respaldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagos.map((p, idx) => {
                                const has = !!(p?.comprobanteDocumentoId || p?.comprobante?.base64);
                                const btn = has
                                    ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobantePago('${escHtml(String(tipo))}', '${escHtml(String(id))}', ${idx})"><i class=\"fas fa-file-pdf\"></i></button>`
                                    : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                return `
                                    <tr style="border-bottom:1px solid var(--border-1);">
                                        <td style="padding:8px 10px;">${fmtFecha(p?.fecha)}</td>
                                        <td style="padding:8px 10px; text-align:right; font-family:monospace;">$${(p?.monto || 0).toLocaleString('es-CL')}</td>
                                        <td style="padding:8px 10px;">${escHtml(p?.concepto || '—')}</td>
                                        <td style="padding:8px 10px; text-align:right;">${btn}</td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        function uiRenderPlanPagos(causaId) {
            const cont = document.getElementById('hr-plan');
            if (!cont) return;
            const parsed = _hrParseSel(causaId);
            const tipo = parsed.tipo || 'causa';
            const id = parsed.id;
            const ent = _hrGetEntidad(tipo, id);
            const h = _hrGetHonorarios(tipo, ent);
            const plan = Array.isArray(h?.planPagos) ? h.planPagos : [];
            if (!ent || !h || !plan.length) { cont.innerHTML = ''; return; }

            const fmtFecha = (iso) => {
                try { return iso ? new Date(iso).toLocaleDateString('es-CL') : '—'; }
                catch (_) { return '—'; }
            };

            cont.innerHTML = `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-3); margin-bottom:8px;">
                    <i class="fas fa-list"></i> Plan de pagos (${h.modalidad || '—'})
                </div>
                <div style="overflow:auto; border:1px solid var(--border); border-radius:10px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                        <thead>
                            <tr style="background:var(--bg-2,#f1f5f9); border-bottom:1px solid var(--border);">
                                <th style="text-align:left; padding:8px 10px;">Nº</th>
                                <th style="text-align:right; padding:8px 10px;">Monto</th>
                                <th style="text-align:left; padding:8px 10px;">Vence</th>
                                <th style="text-align:left; padding:8px 10px;">Estado</th>
                                <th style="text-align:left; padding:8px 10px;">Pago</th>
                                <th style="text-align:right; padding:8px 10px;">Respaldo</th>
                                <th style="text-align:right; padding:8px 10px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${plan.map(cuota => {
                                const estado = cuota.estado || 'PENDIENTE';
                                const badge = estado === 'PAGADA'
                                    ? '<span class="badge badge-s">PAGADA</span>'
                                    : '<span class="badge badge-w">PENDIENTE</span>';
                                const hasComp = !!(cuota?.comprobanteDocumentoId || cuota?.comprobante?.base64);
                                const btnComp = hasComp
                                    ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobanteCuota('${escHtml(String(tipo))}', '${escHtml(String(id))}', ${cuota.numero})"><i class=\"fas fa-file-pdf\"></i></button>`
                                    : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                const btn = (estado === 'PENDIENTE')
                                    ? `<button type="button" class="btn btn-xs btn-p" onclick="uiMarcarCuotaPagada('${escHtml(String(tipo))}', '${escHtml(String(id))}', ${cuota.numero})">Marcar Pagada</button>`
                                    : `<button type="button" class="btn btn-xs btn-d" onclick="uiDeshacerCuotaPagada('${escHtml(String(tipo))}', '${escHtml(String(id))}', ${cuota.numero})">Deshacer</button>`;
                                return `
                                    <tr style="border-bottom:1px solid var(--border-1);">
                                        <td style="padding:8px 10px; font-family:monospace;">${cuota.numero}</td>
                                        <td style="padding:8px 10px; text-align:right; font-family:monospace;">$${(cuota.monto || 0).toLocaleString('es-CL')}</td>
                                        <td style="padding:8px 10px;">${fmtFecha(cuota.fechaVencimiento)}</td>
                                        <td style="padding:8px 10px;">${badge}</td>
                                        <td style="padding:8px 10px;">${fmtFecha(cuota.fechaPago)}</td>
                                        <td style="padding:8px 10px; text-align:right;">${btnComp}</td>
                                        <td style="padding:8px 10px; text-align:right;">${btn}</td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        function uiMarcarCuotaPagada(tipo, causaId, numeroCuota) {
            // Back-compat: llamada legacy (causaId, numero)
            if (numeroCuota === undefined) {
                numeroCuota = causaId;
                causaId = tipo;
                tipo = 'causa';
            }
            const ent = _hrGetEntidad(tipo || 'causa', causaId);
            const h = _hrGetHonorarios(tipo || 'causa', ent);
            if (!ent || !h) return;
            if (!Array.isArray(h.planPagos)) return;

            const cuota = h.planPagos.find(c => parseInt(c.numero) === parseInt(numeroCuota));
            if (!cuota) return;
            if (cuota.estado === 'PAGADA') return;

            (async () => {
                const autorizado = await uiAutorizarAccionCritica({
                    titulo: 'Marcar cuota como pagada',
                    detalle: `Expediente: ${_hrEntidadLabel(tipo, ent, causaId)} · Cuota Nº ${numeroCuota}`
                });
                if (!autorizado) return;

                const quiere = confirm('¿Adjuntar comprobante PDF para esta cuota?');
                const comp = quiere ? await _pickPdfComprobante() : null;

                cuota.estado = 'PAGADA';
                cuota.fechaPago = new Date().toISOString();
                cuota.alertaEnviada = true;
                if (comp) {
                    const refId = `${String(tipo || 'causa')}:${String(causaId)}`;
                    const idDoc = _guardarComprobanteComoDocumento(refId, comp, `Comprobante cuota Nº ${cuota.numero}`);
                    if (idDoc) {
                        cuota.comprobanteDocumentoId = idDoc;
                        cuota.comprobante = { nombre: comp.nombre, mime: comp.mime };
                    } else {
                        cuota.comprobante = comp;
                    }
                }

                // Registrar pago en legacy para mantener resumen
                if (!Array.isArray(h.pagos)) h.pagos = [];
                h.pagos.push({
                    monto: cuota.monto || 0,
                    fecha: new Date().toISOString(),
                    concepto: `Cuota Nº ${cuota.numero}`,
                    comprobanteDocumentoId: cuota.comprobanteDocumentoId || null,
                    comprobante: comp ? { nombre: comp.nombre, mime: comp.mime } : null
                });

            const montoTotal = parseFloat(h.montoTotal || h.montoBase) || 0;
            const totalPagado = (h.pagos || []).reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0);
            h.saldoPendiente = Math.max(0, montoTotal - totalPagado);

                _hrSaveEntidad(tipo || 'causa', ent);
                registrarEvento(`Cuota marcada pagada: Nº ${cuota.numero} — ${_hrEntidadLabel(tipo, ent, causaId)}`);
                renderHonorariosResumen();
                uiRenderPlanPagos(`${tipo}:${causaId}`);
                uiActualizarHonorariosVista();
                uiRenderPagosList(`${tipo}:${causaId}`);
                _hrRenderRefresh();
            })();
        }

        async function uiDeshacerCuotaPagada(tipo, causaId, numeroCuota) {
            // Back-compat: llamada legacy (causaId, numero)
            if (numeroCuota === undefined) {
                numeroCuota = causaId;
                causaId = tipo;
                tipo = 'causa';
            }
            const ent = _hrGetEntidad(tipo || 'causa', causaId);
            const h = _hrGetHonorarios(tipo || 'causa', ent);
            if (!ent || !h) return;
            if (!Array.isArray(h.planPagos)) return;

            const cuota = h.planPagos.find(c => parseInt(c.numero) === parseInt(numeroCuota));
            if (!cuota) return;
            if (cuota.estado !== 'PAGADA') return;
            if (!confirm(`¿Deshacer el pago de la cuota Nº ${cuota.numero}?`)) return;

            const autorizado = await uiAutorizarAccionCritica({
                titulo: 'Deshacer pago de cuota',
                detalle: `Expediente: ${_hrEntidadLabel(tipo, ent, causaId)} · Cuota Nº ${numeroCuota}`
            });
            if (!autorizado) return;

            cuota.estado = 'PENDIENTE';
            cuota.fechaPago = null;
            if (cuota.comprobante) cuota.comprobante = null;
            if (cuota._waAlertas) {
                cuota._waAlertas = { cliente: {}, admin: {} };
            }
            cuota.alertaEnviada = false;

            // Revertir pago legacy asociado (si existe)
            if (Array.isArray(h.pagos) && h.pagos.length) {
                const concepto = `Cuota Nº ${cuota.numero}`;
                const idx = [...h.pagos].map((p, i) => ({ p, i }))
                    .reverse()
                    .find(x => (x.p?.concepto === concepto) && ((parseFloat(x.p?.monto) || 0) === (parseFloat(cuota.monto) || 0)))?.i;
                if (typeof idx === 'number' && idx >= 0) h.pagos.splice(idx, 1);
            }

            const montoTotal = parseFloat(h.montoTotal || h.montoBase) || 0;
            const totalPagado = (h.pagos || []).reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0);
            h.saldoPendiente = Math.max(0, montoTotal - totalPagado);

            _hrSaveEntidad(tipo || 'causa', ent);
            registrarEvento(`Pago deshecho: Cuota Nº ${cuota.numero} — ${_hrEntidadLabel(tipo, ent, causaId)}`);
            renderHonorariosResumen();
            uiRenderPlanPagos(`${tipo}:${causaId}`);
            uiActualizarHonorariosVista();
            uiRenderPagosList(`${tipo}:${causaId}`);
            _hrRenderRefresh();
        }

        // UI: mostrar/ocultar campos cuotas/contado
        (function _initHonorariosCuotasUI() {
            const modalidadSel = document.getElementById('hr-modalidad');
            const wrapCuotas = document.getElementById('hr-cuotas-wrap');
            const wrapContado = document.getElementById('hr-contado-fecha-wrap');
            if (modalidadSel && wrapCuotas && wrapContado) {
                const apply = () => {
                    const m = (modalidadSel.value || 'CONTADO').toUpperCase();
                    wrapCuotas.style.display = (m === 'CUOTAS') ? 'block' : 'none';
                    wrapContado.style.display = (m === 'CONTADO') ? 'block' : 'none';
                };
                modalidadSel.addEventListener('change', apply);
                apply();
            }

            const causaSel = document.getElementById('hr-causa-sel');
            if (causaSel) {
                causaSel.addEventListener('change', () => {
                    const id = (causaSel.value || '').toString().trim();
                    if (id) uiRenderPlanPagos(id);
                    uiActualizarHonorariosVista();
                    uiRenderPagosList(id);
                });
            }

            const causaPagoSel = document.getElementById('hr-pago-causa-sel');
            if (causaPagoSel) {
                causaPagoSel.addEventListener('change', () => {
                    const id = (causaPagoSel.value || '').toString().trim();
                    uiRenderPagosList(id);
                });
            }

            const btnMod = document.getElementById('hr-btn-modificar');
            if (btnMod) {
                btnMod.addEventListener('click', () => {
                    const sel = document.getElementById('hr-causa-sel');
                    const parsed = _hrParseSel(sel ? sel.value : '');
                    const ent = _hrGetEntidad(parsed.tipo || 'causa', parsed.id);
                    if (ent) uiCargarHonorariosEnFormulario(ent);
                    uiSetHonorariosEditMode(true);
                });
            }

            uiActualizarHonorariosVista();
        })();

        function uiRegistrarPago() {
            const parsed = _hrParseSel((document.getElementById('hr-pago-causa-sel')?.value || '').toString().trim());
            const tipo = parsed.tipo || 'causa';
            const causaId = parsed.id;
            const monto = parseFloat(document.getElementById('hr-pago-monto').value);
            if (!causaId) { showError('Seleccione una gestión.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            const ent = _hrGetEntidad(tipo, causaId);
            const h = _hrGetHonorarios(tipo, ent);
            const montoTotal = h?.montoTotal || h?.montoBase || 0;
            if (!montoTotal) { showError('Esta gestión no tiene honorarios asignados. Asígnelos primero.'); return; }

            (async () => {
                const autorizado = await uiAutorizarAccionCritica({
                    titulo: 'Registrar pago',
                    detalle: `Expediente: ${_hrEntidadLabel(tipo, ent, causaId)} · Monto: $${Math.round(monto).toLocaleString('es-CL')}`
                });
                if (!autorizado) return;

                let comp = null;
                const inp = document.getElementById('hr-pago-comprobante');
                const file = inp?.files && inp.files[0];
                if (file) {
                    if (file.type !== 'application/pdf') {
                        showError('Solo se acepta PDF como comprobante.');
                        return;
                    }
                    const dataUrl = await _fileToBase64DataUrl(file);
                    const base64 = dataUrl.split(',')[1] || '';
                    comp = { nombre: file.name, mime: file.type, base64 };
                }

                // Mantener compatibilidad con registrarPago (si existe), pero asegurando comprobante
                if (tipo === 'causa' && typeof registrarPago === 'function') {
                    registrarPago(causaId, monto);
                } else {
                    if (!h || typeof h !== 'object') { showError('Honorarios no disponibles'); return; }
                    if (!Array.isArray(h.pagos)) h.pagos = [];
                    h.pagos.push({ monto, fecha: new Date().toISOString(), concepto: 'Pago' });
                }

                // ── NUEVO: imputación automática a cuotas pendientes ──
                try {
                    if (h && Array.isArray(h.planPagos) && h.planPagos.length) {
                        let restante = parseFloat(monto) || 0;
                        const ahoraIso = new Date().toISOString();

                        // Ordenar por número (fallback) y tomar las pendientes más antiguas primero
                        const pendientes = [...h.planPagos]
                            .filter(c => (c?.estado || 'PENDIENTE') !== 'PAGADA')
                            .sort((a, b) => (parseInt(a?.numero) || 0) - (parseInt(b?.numero) || 0));

                        for (const cuota of pendientes) {
                            if (restante <= 0) break;
                            const montoCuota = parseFloat(cuota?.monto || 0) || 0;
                            if (montoCuota <= 0) continue;

                            const abonado = parseFloat(cuota?.abonoAcumulado || 0) || 0;
                            const falta = Math.max(0, montoCuota - abonado);
                            if (falta <= 0) {
                                // Si por alguna razón quedó con abono completo, la dejamos pagada
                                cuota.abonoAcumulado = montoCuota;
                                cuota.estado = 'PAGADA';
                                if (!cuota.fechaPago) cuota.fechaPago = ahoraIso;
                                continue;
                            }

                            const aplicado = Math.min(restante, falta);
                            cuota.abonoAcumulado = Math.round((abonado + aplicado) * 100) / 100;
                            restante = Math.round((restante - aplicado) * 100) / 100;

                            if (cuota.abonoAcumulado >= montoCuota) {
                                cuota.abonoAcumulado = montoCuota;
                                cuota.estado = 'PAGADA';
                                cuota.fechaPago = ahoraIso;
                                cuota.alertaEnviada = true;
                            } else {
                                // Parcial: queda pendiente, pero con abono
                                cuota.estado = 'PENDIENTE';
                            }
                        }

                        // Ajustar concepto del último pago para trazabilidad (pago aplicado a cuotas)
                        if (Array.isArray(h.pagos) && h.pagos.length) {
                            const last = h.pagos[h.pagos.length - 1];
                            const primeraPend = pendientes && pendientes.length ? pendientes[0] : null;
                            if (last && primeraPend && parseInt(primeraPend?.numero)) {
                                last.concepto = `Pago (imputado a cuotas desde Nº ${parseInt(primeraPend.numero)})`;
                            } else if (last) {
                                last.concepto = 'Pago (imputado a cuotas)';
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[PAGO] No se pudo imputar automáticamente a cuotas:', e);
                }

                // Adjuntar comprobante al último pago si corresponde
                if (comp && Array.isArray(h?.pagos) && h.pagos.length) {
                    const last = h.pagos[h.pagos.length - 1];
                    if (last) {
                        const refId = `${String(tipo)}:${String(causaId)}`;
                        const idDoc = _guardarComprobanteComoDocumento(refId, comp, `Comprobante pago: $${Math.round(monto).toLocaleString('es-CL')}`);
                        if (idDoc) {
                            last.comprobanteDocumentoId = idDoc;
                            last.comprobante = { nombre: comp.nombre, mime: comp.mime };
                        } else {
                            last.comprobante = comp;
                        }
                    }
                }

                // recomputar saldo y compat
                const totalPagado = Array.isArray(h?.pagos)
                    ? h.pagos.reduce((s, p) => s + (parseFloat(p?.monto) || 0), 0)
                    : 0;
                const base = parseFloat(h?.montoTotal || h?.montoBase || 0) || 0;
                h.saldoPendiente = Math.max(0, base - totalPagado);
                _hrSaveEntidad(tipo, ent);

                registrarEvento(`Pago registrado: $${monto.toLocaleString('es-CL')} — ${_hrEntidadLabel(tipo, ent, causaId)}`);
                document.getElementById('hr-pago-monto').value = '';
                const inp2 = document.getElementById('hr-pago-comprobante');
                if (inp2) inp2.value = '';

                renderHonorariosResumen();
                uiActualizarHonorariosVista();
                uiRenderPlanPagos(`${tipo}:${causaId}`);
                uiRenderPagosList(`${tipo}:${causaId}`);
                _hrRenderRefresh();
            })().catch(e => {
                console.error('[PAGO] Error registrando pago:', e);
                showError(e?.message || 'No se pudo registrar el pago.');
            });
        }

        function renderHonorariosResumen() {
            const el = document.getElementById('hr-resumen');
            if (!el) return;
            const causasConHon = (DB.causas || []).filter(c => (c?.honorarios?.montoTotal || c?.honorarios?.montoBase || c?.honorarios?.base));
            let tramitesConHon = [];
            try {
                const lista = (typeof window.TramitesDB !== 'undefined' && window.TramitesDB?.todos)
                    ? window.TramitesDB.todos()
                    : (typeof AppConfig !== 'undefined' && AppConfig.get) ? (AppConfig.get('tramites') || []) : [];
                tramitesConHon = (lista || []).filter(t => {
                    const h = t?.honorarios || {};
                    return !!(h?.montoTotal || h?.montoBase || h?.base || h?.monto);
                });
            } catch (_) { }

            const items = [
                ...causasConHon.map(c => ({ tipo: 'causa', ent: c })),
                ...tramitesConHon.map(t => ({ tipo: 'tramite', ent: t }))
            ];

            if (!items.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Sin honorarios asignados.</p></div>'; return;
            }
            el.innerHTML = items.map(({ tipo, ent }) => {
                const h = _hrGetHonorarios(tipo, ent) || {};
                const base = h.montoTotal || h.montoBase || h.base || h.monto || 0;
                const saldo = typeof h.saldoPendiente === 'number' ? h.saldoPendiente : (parseFloat(h.saldoPendiente) || 0);
                const pagado = base - saldo;
                const pct = base > 0 ? Math.round((pagado / base) * 100) : 0;
                return `<div class="card" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:0.88rem;">${escHtml(_hrEntidadLabel(tipo, ent, ent?.id))}</strong>
                <span class="badge ${saldo <= 0 ? 'badge-s' : 'badge-w'}">${saldo <= 0 ? 'PAGADO' : 'PENDIENTE'}</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--t2); margin-top:6px;">
                <span>Base: $${base.toLocaleString('es-CL')}</span>
                <span>Pagado: <strong style="color:var(--s);">$${pagado.toLocaleString('es-CL')}</strong></span>
                <span>Pendiente: <strong style="color:var(--d);">$${saldo.toLocaleString('es-CL')}</strong></span>
            </div>
            ${h.pagos?.length ? `<div style="margin-top:10px; border-top:1px solid #f1f5f9; padding-top:8px;">
                ${h.pagos.map(p => `<div class="pago-item"><span>${new Date(p.fecha).toLocaleDateString('es-CL')}</span><span class="pago-monto">+$${p.monto.toLocaleString('es-CL')}</span></div>`).join('')}
            </div>` : ''}
        </div>`;
            }).join('');
        }

        function deleteCause(id) {
            showConfirm("¿Archivar causa?", "¿Está seguro de que desea archivar esta causa? Podrá encontrarla en el histórico.", () => {
                DB.causas = DB.causas.filter(c => c.id !== id);

                // Cascade delete: al borrar causa, borrar también alertas y documentos asociados
                try {
                    if (Array.isArray(DB.alertas)) {
                        DB.alertas = DB.alertas.filter(a => a?.causaId !== id);
                    }
                    if (Array.isArray(DB.documentos)) {
                        DB.documentos = DB.documentos.filter(d => d?.causaId !== id);
                    }
                } catch (_) {}

                DB.clientes.forEach(c => {
                    if ((c.estado || c.status) === 'activo' && !DB.causas.find(ca => ca.caratula === (c.nombre || c.nom))) {
                        c.estado = 'prospecto'; c.status = 'prospecto';
                    }
                });
                registrarEvento(`Causa archivada: ID ${id}`);
                if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
                showInfo("Causa archivada.");
            });
        }

        // ─── Jurisprudencia ───────────────────────────────────────────────
        function addJuris() {
            const rol = document.getElementById('ju-rol').value.trim();
            const ext = document.getElementById('ju-ext').value.trim();
            const cat = document.getElementById('ju-cat').value;
            if (!rol || !ext) { showError("Complete Rol/Tribunal y Extracto."); return; }
            DB.jurisprudencia.push({ id: uid(), rol, ext, cat, materia: cat, temaCentral: ext, tendencia: 'Neutra', nivelRelevancia: 'Media', palabrasClave: [], asociadaACausas: [] });
            document.getElementById('ju-rol').value = '';
            document.getElementById('ju-ext').value = '';
            registrarEvento(`Jurisprudencia indexada: ${rol}`);
            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
        }

        function deleteJuris(id) {
            if (!confirm("¿Eliminar este registro?")) return;
            DB.jurisprudencia = DB.jurisprudencia.filter(j => j.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
        }

        // ─── Calculadora de Plazos ────────────────────────────────────────
        function updateCalcHitos() {
            const mat = document.getElementById('calc-materia').value;
            const sel = document.getElementById('calc-hito');
            sel.innerHTML = PLAZOS[mat].map((p, i) => `<option value="${i}">${p.n} (${p.d} días — ${p.l})</option>`).join('');
        }

        function runCalc() {
            const mat = document.getElementById('calc-materia').value;
            const hitoIdx = parseInt(document.getElementById('calc-hito').value);
            const dateVal = document.getElementById('calc-date').value;
            if (!dateVal) { showError("Seleccione una fecha de inicio."); return; }

            const hito = PLAZOS[mat][hitoIdx];
            const start = new Date(dateVal + 'T12:00:00');
            let dias = 0;
            let current = new Date(start);
            let feriadosSaltados = [];

            while (dias < hito.d) {
                current.setDate(current.getDate() + 1);
                const dow = current.getDay();
                if (dow === 0) continue; // domingo
                if (esFeriadoChileno(current)) {
                    const lbl = FERIADOS_CHILE[`${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`]
                        || FERIADOS_VARIABLES[`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`]
                        || 'Feriado';
                    feriadosSaltados.push(`${current.toLocaleDateString('es-CL')} (${lbl})`);
                    continue; // feriado
                }
                dias++;
            }

            const formatted = current.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const res = document.getElementById('calc-res');
            res.style.display = 'block';
            res.innerHTML = `
        <strong>${hito.n}</strong><br>
        <div class="res-date">${formatted}</div>
        <small>${hito.d} días hábiles desde ${start.toLocaleDateString('es-CL')} · ${hito.l}</small>
        ${feriadosSaltados.length ? `<div style="margin-top:8px; padding:8px 12px; background:#fef3c7; border-radius:6px; font-size:0.75rem; color:#92400e;"><i class="fas fa-calendar-times"></i> <strong>${feriadosSaltados.length} feriado(s) excluido(s):</strong> ${feriadosSaltados.join(' · ')}</div>` : ''}
    `;
        }

        // ─── Honorarios ───────────────────────────────────────────────────
        function calcHon() {
            const val = parseFloat(document.getElementById('hon-val').value) || 0;
            let hon = 0;
            const table = [];

            // Escala escalonada referencial
            const tramos = [
                { hasta: 10000000, pct: 0.20, label: 'hasta $10M' },
                { hasta: 50000000, pct: 0.15, label: '$10M–$50M' },
                { hasta: 200000000, pct: 0.10, label: '$50M–$200M' },
                { hasta: Infinity, pct: 0.07, label: 'sobre $200M' }
            ];

            let restante = val;
            let prevHasta = 0;
            for (const t of tramos) {
                if (restante <= 0) break;
                const tramo = Math.min(restante, t.hasta - prevHasta);
                const parte = tramo * t.pct;
                hon += parte;
                if (tramo > 0) table.push({ label: t.label, pct: (t.pct * 100) + '%', monto: parte });
                restante -= tramo;
                prevHasta = t.hasta;
            }

            document.getElementById('hon-res').innerText = '$ ' + Math.round(hon).toLocaleString('es-CL');
            document.getElementById('hon-table').innerHTML = val > 0 ? `
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:4px;">
            <thead><tr style="background:var(--bg-2,var(--bg));"><th style="padding:6px 8px; text-align:left;">Tramo</th><th>Tasa</th><th>Honorario</th></tr></thead>
            <tbody>${table.map(r => `<tr style="border-top:1px solid var(--border);">
                <td style="padding:6px 8px;">${r.label}</td>
                <td style="text-align:center;">${r.pct}</td>
                <td style="text-align:right; font-family:'IBM Plex Mono',monospace;">$ ${Math.round(r.monto).toLocaleString('es-CL')}</td>
            </tr>`).join('')}</tbody>
        </table>
    ` : '';
        }

        // ═══════════════════════════════════════════════════════
        // FUNCIONES UI PUENTE — conectan formularios HTML con el motor
        // ═══════════════════════════════════════════════════════

        function uiCrearProspecto() {
            const nom = document.getElementById('pro-nom').value.trim();
            const mat = document.getElementById('pro-mat').value.trim();
            if (!nom) { showError("Ingrese el nombre del prospecto."); return; }
            crearProspecto({
                nombre: nom,
                materia: mat,
                descripcion: document.getElementById('pro-desc').value.trim(),
                complejidad: document.getElementById('pro-comp').value,
                probabilidadCierre: parseInt(document.getElementById('pro-prob').value) || 50,
                honorarioPropuesto: parseFloat(document.getElementById('pro-hon').value) || 0
            });
            document.getElementById('pro-nom').value = '';
            document.getElementById('pro-mat').value = '';
            document.getElementById('pro-desc').value = '';
            document.getElementById('pro-hon').value = '';
            registrarEvento("Nuevo prospecto creado: " + nom);
            renderAll();
        }

        function uiCrearCausaPro() {
            const caratula = document.getElementById('cp-caratula').value.trim();
            const tipo = document.getElementById('cp-tipo').value;
            const rama = document.getElementById('cp-rama').value.trim();
            if (!caratula) { showError("Ingrese la carátula de la causa."); return; }
            crearCausa({ caratula, tipoProcedimiento: tipo, rama, clienteId: null });
            document.getElementById('cp-caratula').value = '';
            document.getElementById('cp-rama').value = '';
            registrarEvento("Causa Pro creada: " + caratula);
            renderAll();
        }

        function uiToggleDocPlazo() {
            const checked = document.getElementById('doc-genera-plazo').checked;
            document.getElementById('doc-plazo-extra').style.display = checked ? 'block' : 'none';
        }

        function uiAgregarDocumento() {
            const causaId = parseInt(document.getElementById('doc-causa-sel').value);
            const nombre = document.getElementById('doc-nombre').value.trim();
            const tipo = document.getElementById('doc-tipo').value;
            const etapa = document.getElementById('doc-etapa').value.trim();
            const fecha = document.getElementById('doc-fecha').value;
            const generaPlazo = document.getElementById('doc-genera-plazo').checked;
            const diasPlazo = parseInt(document.getElementById('doc-dias').value) || 0;
            if (!causaId) { showError("Seleccione una causa."); return; }
            if (!nombre) { showError("Ingrese el nombre del documento."); return; }
            if (generaPlazo && !diasPlazo) { showError("Ingrese los días del plazo."); return; }
            if (generaPlazo && !confirm(`¿Confirmar plazo de ${diasPlazo} días desde ${fecha}?\n\nLa responsabilidad del cálculo es del abogado.`)) return;
            agregarDocumento(causaId, { nombreOriginal: nombre, tipo, etapaVinculada: etapa, fechaDocumento: fecha, generaPlazo, diasPlazo });
            document.getElementById('doc-nombre').value = '';
            document.getElementById('doc-etapa').value = '';
            document.getElementById('doc-genera-plazo').checked = false;
            document.getElementById('doc-dias').value = '';
            document.getElementById('doc-plazo-extra').style.display = 'none';
            renderDocumentos(causaId);
            renderAll();
        }

        function uiCrearAlerta() {
            const msg = document.getElementById('cal-msg').value.trim();
            const fecha = document.getElementById('cal-fecha').value;
            if (!msg || !fecha) { showError("Complete mensaje y fecha."); return; }
            crearAlerta({
                causaId: parseInt(document.getElementById('cal-causa-sel').value) || null,
                tipo: document.getElementById('cal-tipo').value,
                mensaje: msg,
                fechaObjetivo: fecha,
                prioridad: document.getElementById('cal-prioridad').value
            });
            document.getElementById('cal-msg').value = '';
            document.getElementById('cal-fecha').value = '';
            renderCalendario();
            registrarEvento("Alerta manual creada: " + msg);
        }

        function uiRenderEstrategiaPro() {
            const idRaw = (document.getElementById('ep-causa-sel')?.value || '').toString().trim();
            if (!idRaw) { document.getElementById('analisisEstrategico').innerHTML = ''; return; }
            const id = /^\d+$/.test(idRaw) ? parseInt(idRaw, 10) : idRaw;
            evaluarImpactoJurisprudencial(id);
            renderAnalisisEstrategico(id);
        }

        function uiCrearJurisprudencia() {
            const tribunal = document.getElementById('jav-tribunal').value.trim();
            const rol = document.getElementById('jav-rol').value.trim();
            const materia = document.getElementById('jav-materia').value.trim();
            if (!tribunal || !rol) { showError("Complete Tribunal y Rol."); return; }
            const palabras = document.getElementById('jav-palabras').value.split(',').map(p => p.trim()).filter(Boolean);
            crearJurisprudencia({
                tribunal, rol, materia,
                procedimiento: document.getElementById('jav-proc').value.trim(),
                temaCentral: document.getElementById('jav-tema').value.trim(),
                tendencia: document.getElementById('jav-tend').value,
                nivelRelevancia: document.getElementById('jav-relev').value,
                palabrasClave: palabras,
                fecha: new Date().toISOString().split('T')[0]
            });
            // Limpiar form
            ['jav-tribunal', 'jav-rol', 'jav-materia', 'jav-proc', 'jav-tema', 'jav-palabras'].forEach(id => document.getElementById(id).value = '');
            registrarEvento("Jurisprudencia indexada: " + tribunal + " - Rol " + rol);
            uiRenderJurisprudenciaAvanzada();
            renderAll();
        }

        function uiRenderJurisprudenciaAvanzada() {
            const el = document.getElementById('listaJurisprudencia');
            if (!el) return;
            if (!DB.jurisprudencia.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>Sin jurisprudencia avanzada indexada.</p></div>';
                return;
            }
            el.innerHTML = DB.jurisprudencia.map(j => `
        <div class="card" style="margin-bottom:10px; font-size:0.83rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-family:'IBM Plex Mono',monospace;">${escHtml(j.tribunal)} — Rol ${escHtml(j.rol)}</strong>
                <span class="badge ${j.tendencia === 'Favorable' ? 'badge-s' : j.tendencia === 'Desfavorable' ? 'badge-d' : 'badge-a'}">${escHtml(j.tendencia)}</span>
            </div>
            <p style="margin-top:4px;">Materia: ${escHtml(j.materia)} · Relevancia: <strong>${escHtml(j.nivelRelevancia)}</strong></p>
            ${j.temaCentral ? `<p style="color:var(--t2); margin-top:3px;">${escHtml(j.temaCentral)}</p>` : ''}
            ${j.palabrasClave?.length ? `<p style="margin-top:4px; font-size:0.72rem; color:var(--a);">${j.palabrasClave.map(p => `#${escHtml(p)}`).join(' ')}</p>` : ''}
            <button class="btn btn-d btn-sm" style="margin-top:8px;" onclick="uiDeleteJurisAvanzada(${j.id})"><i class="fas fa-trash"></i></button>
        </div>`).join('');
        }

        function uiDeleteJurisAvanzada(id) {
            if (!confirm("¿Eliminar esta jurisprudencia?")) return;
            DB.jurisprudencia = DB.jurisprudencia.filter(j => j.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); uiRenderJurisprudenciaAvanzada(); renderAll();
        }

        // (Código de inicialización movido a init() — ver sección final del script)

        // ═══════════════════════════════════════════════════════════════
