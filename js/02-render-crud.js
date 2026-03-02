        // JS — BLOQUE 3: RENDERIZADO PRINCIPAL
        // • Alertas, clientes, causas, jurisprudencia, honorarios
        // ████████████████████████████████████████████████████████████████████

        function renderAlerts() {
            const el = document.getElementById('alert-container');
            let html = '';

            // Alertas del sistema centralizado
            const today = new Date(); today.setHours(0, 0, 0, 0);
            DB.alertas.filter(a => a.estado === 'activa').forEach(a => {
                const causa = DB.causas.find(c => c.id === a.causaId);
                const fa = new Date(a.fechaObjetivo); fa.setHours(0, 0, 0, 0);
                const diff = Math.ceil((fa - today) / 86400000);
                const color = diff <= 2 ? 'var(--danger)' : diff <= 5 ? 'var(--warning)' : 'var(--cyan)';
                
                html += `
                <div class="alert-premium" style="border-left-color:${color}; margin-bottom:12px;">
                    <div class="icon-box-premium" style="background:${color}15; color:${color}; width:36px; height:36px; font-size:1rem;">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <strong>${escHtml(a.mensaje)}</strong>
                            <button class="btn-xs" style="background:var(--bg-2); border:none; border-radius:4px; cursor:pointer;" onclick="archivarAlerta(${a.id})"><i class="fas fa-check"></i></button>
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

            el.innerHTML = html || '<div class="alert-empty"><i class="fas fa-check-circle" style="color:var(--success)"></i> Sin alertas activas.</div>';
        }

        function renderClientes() {
            const el = document.getElementById('client-list');
            if (!DB.clientes.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Sin clientes registrados</p></div>';
                return;
            }
            el.innerHTML = DB.clientes.map(c => {
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
                        <div style="display:flex; gap:8px;">
                            ${esProspecto ? `<button onclick="(typeof plantillaCausaAbrir==='function') ? plantillaCausaAbrir('${c.id}') : convertToCause('${c.id}')" class="btn btn-p btn-sm"><i class="fas fa-plus"></i> Abrir Causa</button>` : ''}
                            <button onclick="editClient('${c.id}')" class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-edit"></i></button>
                            <button onclick="verPerfilCliente?.('${c.id}')" class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-external-link-alt"></i></button>
                            <button onclick="deleteClient('${c.id}')" class="btn btn-d btn-sm"><i class="fas fa-trash"></i></button>
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
            document.getElementById('causa-flt-orden').addEventListener('change', onUpdate);
            document.getElementById('causa-flt-limpiar').addEventListener('click', () => {
                document.getElementById('causa-flt-estado').value = '';
                document.getElementById('causa-flt-cliente').value = '';
                document.getElementById('causa-flt-busqueda').value = '';
                document.getElementById('causa-flt-orden').value = 'fecha';
                renderCausas();
            });
        }

        function _getCausasFiltradasYOrdenadas() {
            const estadoVal = (document.getElementById('causa-flt-estado') || {}).value || '';
            const clienteVal = (document.getElementById('causa-flt-cliente') || {}).value || '';
            const busquedaVal = ((document.getElementById('causa-flt-busqueda') || {}).value || '').trim().toLowerCase();
            const ordenVal = (document.getElementById('causa-flt-orden') || {}).value || 'fecha';

            let list = DB.causas.slice();
            if (estadoVal) list = list.filter(c => (c.estadoGeneral || '') === estadoVal);
            if (clienteVal) list = list.filter(c => String(c.clienteId) === String(clienteVal));
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
                return `
                <div class="db-kpi" style="padding:20px; cursor:pointer;" onclick="tab('causa-detail'); viewCausa('${c.id}');">
                    <div class="icon-box-premium" style="background:var(--cyan-light); color:var(--cyan);">
                        <i class="fas fa-gavel"></i>
                    </div>
                    <div class="db-kpi-data">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div class="db-kpi-val" style="font-size:1.1rem; letter-spacing:-0.2px;">${escHtml(c.caratula)}</div>
                            <span class="badge ${estado === 'Finalizada' ? 'badge-s' : 'badge-a'}" style="font-size:9px;">${estado.toUpperCase()}</span>
                        </div>
                        <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">ID: ${c.id} · ${escHtml(c.tipoProcedimiento || '')}</div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;">
                            <div class="risk-row" style="margin:0;">
                                <div class="risk-label" style="font-size:9px;"><span style="color:var(--text-3)">R.PROBATORIO</span></div>
                                <div class="risk-meter" style="height:4px;"><div class="risk-fill" style="width:${rProb === 'Alto' ? 90 : rProb === 'Medio' ? 50 : 25}%; background:${colorRiesgo(rProb)};"></div></div>
                            </div>
                            <div class="risk-row" style="margin:0;">
                                <div class="risk-label" style="font-size:9px;"><span style="color:var(--text-3)">R.PROCESAL</span></div>
                                <div class="risk-meter" style="height:4px;"><div class="risk-fill" style="width:${rProc === 'Alto' ? 90 : rProc === 'Medio' ? 50 : 25}%; background:${colorRiesgo(rProc)};"></div></div>
                            </div>
                        </div>
                    </div>
                    ${estado !== 'Finalizada' ? `<div style="position:absolute; top:0; left:0; bottom:0; width:4px; background:var(--cyan);"></div>` : ''}
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
        function addClient() {
            const nom = document.getElementById('cl-nom').value.trim();
            const rutRaw = document.getElementById('cl-rut').value.trim();
            const tel = (document.getElementById('cl-telefono')?.value || '').trim();
            const rel = document.getElementById('cl-rel').value.trim();
            if (!nom) { showError("Ingrese el nombre del cliente."); return; }
            // Validación RUT si fue ingresado
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
            const nuevoCliente = { id: uid(), nombre: nom, nom, rut, telefono: tel, rel, descripcion: rel, estado: 'prospecto', status: 'prospecto', fechaCreacion: new Date() };
            DB.clientes.push(nuevoCliente);
            document.getElementById('cl-nom').value = '';
            document.getElementById('cl-rut').value = '';
            const telEl = document.getElementById('cl-telefono');
            if (telEl) telEl.value = '';
            document.getElementById('cl-rel').value = '';
            const fb = document.querySelector('.rut-feedback');
            if (fb) fb.textContent = '';
            registrarEvento(`Cliente registrado: ${nom}${rut ? ' · RUT: ' + rut : ''}`);
            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
        }

        function deleteClient(id) {
            showConfirm("¿Eliminar cliente?", "Se eliminará el registro del cliente y su historial. Esta acción es irreversible.", () => {
                DB.clientes = DB.clientes.filter(c => c.id !== id);
                registrarEvento(`Cliente eliminado: ID ${id}`);
                if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
                showSuccess("Cliente eliminado correctamente.");
            }, 'danger');
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
                DB.causas.push(nueva);
                evaluarRiesgoIntegral(nueva.id);
                registrarEvento(`Causa creada desde cliente: ${nueva.caratula}`);
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
            const h = causa?.honorarios || {};
            const modalidad = (h.modalidad || 'CONTADO').toUpperCase();
            const monto = parseFloat(h.montoTotal || h.montoBase || 0) || 0;
            const elModalidad = document.getElementById('hr-modalidad');
            const elMonto = document.getElementById('hr-monto');
            if (elModalidad) elModalidad.value = modalidad;
            if (elMonto) elMonto.value = monto ? String(Math.round(monto)) : '';

            const wrap = document.getElementById('hr-cuotas-wrap');
            const elNCuotas = document.getElementById('hr-cuotas-num');
            const elFecha = document.getElementById('hr-cuotas-fecha');

            if (wrap) wrap.style.display = (modalidad === 'CUOTAS') ? 'block' : 'none';
            if (modalidad === 'CUOTAS') {
                const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
                if (elNCuotas) elNCuotas.value = plan.length ? String(plan.length) : (elNCuotas.value || '');
                if (elFecha) {
                    const f0 = plan[0]?.fechaVencimiento ? new Date(plan[0].fechaVencimiento) : null;
                    if (f0 && !Number.isNaN(f0.getTime())) {
                        const yyyy = String(f0.getFullYear());
                        const mm = String(f0.getMonth() + 1).padStart(2, '0');
                        const dd = String(f0.getDate()).padStart(2, '0');
                        elFecha.value = `${yyyy}-${mm}-${dd}`;
                    }
                }
            }
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
                    ? '#dc2626'
                    : (String(riesgoNivel || '').toLowerCase() === 'medio')
                        ? '#d97706'
                        : (riesgoNivel ? '#059669' : '#64748b');

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
            const causaId = sel ? (sel.value || '').toString().trim() : '';
            const summary = document.getElementById('hr-asignado-summary');
            if (!summary) return;

            if (!causaId) {
                summary.innerHTML = '';
                uiSetHonorariosEditMode(true);
                return;
            }

            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const h = causa?.honorarios || {};
            const base = parseFloat(h.montoTotal || h.montoBase || 0) || 0;
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
                                    const hasComp = !!(cuota?.comprobante?.base64);
                                    const btnComp = hasComp
                                        ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobanteCuota('${escHtml(String(causaId))}', ${cuota?.numero ?? 0})"><i class=\"fas fa-file-pdf\"></i></button>`
                                        : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                    return `
                                        <tr style="border-bottom:1px solid #eef2f7;">
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

        function uiAsignarHonorarios(causaIdOverride) {
            const sel = document.getElementById('hr-causa-sel');
            const fromSelect = sel ? (sel.value || '').toString().trim() : '';
            const fromOverride = (causaIdOverride !== undefined && causaIdOverride !== null)
                ? causaIdOverride.toString().trim()
                : '';
            const causaId = fromOverride || fromSelect;

            const modalidad = (document.getElementById('hr-modalidad')?.value || 'CONTADO').toUpperCase();
            const monto = parseFloat(document.getElementById('hr-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }

            const causa = DB.causas.find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            if (!causa) { showError('Causa no encontrada.'); return; }

            if (!causa.honorarios) causa.honorarios = {};

            if (modalidad === 'CUOTAS') {
                const nCuotas = parseInt(document.getElementById('hr-cuotas-num')?.value) || 0;
                const fechaStr = (document.getElementById('hr-cuotas-fecha')?.value || '').trim();
                if (!nCuotas || nCuotas <= 0) { showError('Ingrese número de cuotas.'); return; }
                if (!fechaStr) { showError('Ingrese fecha primera cuota.'); return; }

                let plan = [];
                try {
                    plan = generarPlanPagos(causaId, monto, nCuotas, new Date(fechaStr));
                } catch (e) {
                    showError(e?.message || 'No se pudo generar el plan de pagos.');
                    return;
                }

                causa.honorarios.modalidad = 'CUOTAS';
                causa.honorarios.montoTotal = monto;
                causa.honorarios.montoBase = monto; // compat
                causa.honorarios.planPagos = plan;
                // Mantener pagos legacy si existían
                if (!Array.isArray(causa.honorarios.pagos)) causa.honorarios.pagos = [];
                causa.honorarios.saldoPendiente = plan.reduce((s, c) => s + (c.estado === 'PENDIENTE' ? (c.monto || 0) : 0), 0);

                if (typeof markAppDirty === "function") markAppDirty();
                save();
            } else {
                // CONTADO: reutiliza asignarHonorarios para mantener compatibilidad
                asignarHonorarios(causaId, monto);
            }

            registrarEvento(`Honorarios asignados: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
            document.getElementById('hr-monto').value = '';
            renderHonorariosResumen();
            uiRenderPlanPagos(causaId);
            renderAll();

            uiSetHonorariosEditMode(false);
            uiActualizarHonorariosVista();
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
                DB.documentos.push(doc);
                return doc.id;
            } catch (e) {
                console.error('[PAGO] Error guardando comprobante como documento:', e);
                return null;
            }
        }

        async function uiVerComprobanteCuota(causaId, numeroCuota) {
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const cuota = causa?.honorarios?.planPagos?.find(c => parseInt(c.numero) === parseInt(numeroCuota));
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

        async function uiVerComprobantePago(causaId, idxPago) {
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const pago = (causa?.honorarios?.pagos || [])[parseInt(idxPago)];
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
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const pagos = Array.isArray(causa?.honorarios?.pagos) ? causa.honorarios.pagos : [];
            if (!causaId || !pagos.length) { el.innerHTML = ''; return; }

            const fmtFecha = (iso) => {
                try {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    return (!Number.isNaN(d.getTime())) ? d.toLocaleDateString('es-CL') : '—';
                } catch (_) { return '—'; }
            };

            el.innerHTML = `
                <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin:10px 0 8px;">
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
                                    ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobantePago('${escHtml(String(causaId))}', ${idx})"><i class=\"fas fa-file-pdf\"></i></button>`
                                    : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                return `
                                    <tr style="border-bottom:1px solid #eef2f7;">
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
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const h = causa?.honorarios;
            const plan = Array.isArray(h?.planPagos) ? h.planPagos : [];
            if (!causa || !h || !plan.length) { cont.innerHTML = ''; return; }

            const fmtFecha = (iso) => {
                try { return iso ? new Date(iso).toLocaleDateString('es-CL') : '—'; }
                catch (_) { return '—'; }
            };

            cont.innerHTML = `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:8px;">
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
                                    ? `<button type="button" class="btn btn-xs" style="background:var(--bg-2); border:1px solid var(--border);" onclick="uiVerComprobanteCuota('${escHtml(String(causaId))}', ${cuota.numero})"><i class=\"fas fa-file-pdf\"></i></button>`
                                    : '<span style="color:var(--text-3); font-size:0.75rem;">—</span>';
                                const btn = (estado === 'PENDIENTE')
                                    ? `<button type="button" class="btn btn-xs btn-p" onclick="uiMarcarCuotaPagada('${causaId}', ${cuota.numero})">Marcar Pagada</button>`
                                    : `<button type="button" class="btn btn-xs btn-d" onclick="uiDeshacerCuotaPagada('${causaId}', ${cuota.numero})">Deshacer</button>`;
                                return `
                                    <tr style="border-bottom:1px solid #eef2f7;">
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

        function uiMarcarCuotaPagada(causaId, numeroCuota) {
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            if (!causa || !causa.honorarios) return;
            const h = causa.honorarios;
            if (!Array.isArray(h.planPagos)) return;

            const cuota = h.planPagos.find(c => parseInt(c.numero) === parseInt(numeroCuota));
            if (!cuota) return;
            if (cuota.estado === 'PAGADA') return;

            (async () => {
                const quiere = confirm('¿Adjuntar comprobante PDF para esta cuota?');
                const comp = quiere ? await _pickPdfComprobante() : null;

                cuota.estado = 'PAGADA';
                cuota.fechaPago = new Date().toISOString();
                cuota.alertaEnviada = true;
                if (comp) {
                    const idDoc = _guardarComprobanteComoDocumento(causaId, comp, `Comprobante cuota Nº ${cuota.numero}`);
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

                registrarEvento(`Cuota marcada pagada: Nº ${cuota.numero} — ${causa.caratula}`);
                if (typeof markAppDirty === "function") markAppDirty();
                save();
                renderHonorariosResumen();
                uiRenderPlanPagos(causa.id);
                uiActualizarHonorariosVista();
                uiRenderPagosList(causa.id);
                renderAll();
            })();
        }

        function uiDeshacerCuotaPagada(causaId, numeroCuota) {
            const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            if (!causa || !causa.honorarios) return;
            const h = causa.honorarios;
            if (!Array.isArray(h.planPagos)) return;

            const cuota = h.planPagos.find(c => parseInt(c.numero) === parseInt(numeroCuota));
            if (!cuota) return;
            if (cuota.estado !== 'PAGADA') return;
            if (!confirm(`¿Deshacer el pago de la cuota Nº ${cuota.numero}?`)) return;

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

            registrarEvento(`Pago deshecho: Cuota Nº ${cuota.numero} — ${causa.caratula}`);
            if (typeof markAppDirty === "function") markAppDirty();
            save();
            renderHonorariosResumen();
            uiRenderPlanPagos(causa.id);
            uiActualizarHonorariosVista();
            uiRenderPagosList(causa.id);
            renderAll();
        }

        // UI: mostrar/ocultar campos cuotas
        (function _initHonorariosCuotasUI() {
            const modalidadSel = document.getElementById('hr-modalidad');
            const wrap = document.getElementById('hr-cuotas-wrap');
            if (modalidadSel && wrap) {
                const apply = () => {
                    const m = (modalidadSel.value || 'CONTADO').toUpperCase();
                    wrap.style.display = (m === 'CUOTAS') ? 'block' : 'none';
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
                    const causaId = sel ? (sel.value || '').toString().trim() : '';
                    const causa = (DB.causas || []).find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
                    if (causa) uiCargarHonorariosEnFormulario(causa);
                    uiSetHonorariosEditMode(true);
                });
            }

            uiActualizarHonorariosVista();
        })();

        function uiRegistrarPago() {
            const causaId = (document.getElementById('hr-pago-causa-sel')?.value || '').toString().trim();
            const monto = parseFloat(document.getElementById('hr-pago-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            const causa = DB.causas.find(c => (c.id == causaId) || (String(c.id) === String(causaId)));
            const montoTotal = causa?.honorarios?.montoTotal || causa?.honorarios?.montoBase || 0;
            if (!montoTotal) { showError('Esta causa no tiene honorarios asignados. Asígnelos primero.'); return; }

            (async () => {
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
                if (typeof registrarPago === 'function') {
                    registrarPago(causaId, monto);
                } else {
                    if (!causa.honorarios) causa.honorarios = {};
                    if (!Array.isArray(causa.honorarios.pagos)) causa.honorarios.pagos = [];
                    causa.honorarios.pagos.push({ monto, fecha: new Date().toISOString(), concepto: 'Pago registrado', comprobante: null });
                }

                // Adjuntar comprobante al último pago si corresponde
                if (comp) {
                    if (!causa.honorarios) causa.honorarios = {};
                    if (!Array.isArray(causa.honorarios.pagos)) causa.honorarios.pagos = [];
                    const last = causa.honorarios.pagos[causa.honorarios.pagos.length - 1];
                    if (last) {
                        const idDoc = _guardarComprobanteComoDocumento(causaId, comp, `Comprobante pago (${last.concepto || 'Pago'})`);
                        if (idDoc) {
                            last.comprobanteDocumentoId = idDoc;
                            last.comprobante = { nombre: comp.nombre, mime: comp.mime };
                        } else {
                            last.comprobante = comp;
                        }
                    }
                }

                registrarEvento(`Pago registrado: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
                document.getElementById('hr-pago-monto').value = '';
                const inp2 = document.getElementById('hr-pago-comprobante');
                if (inp2) inp2.value = '';

                renderHonorariosResumen();
                uiActualizarHonorariosVista();
                uiRenderPlanPagos(causaId);
                uiRenderPagosList(causaId);
                renderAll();
            })().catch(e => {
                console.error('[PAGO] Error registrando pago:', e);
                showError(e?.message || 'No se pudo registrar el pago.');
            });
        }

        function renderHonorariosResumen() {
            const el = document.getElementById('hr-resumen');
            if (!el) return;
            const causasConHon = DB.causas.filter(c => (c.honorarios?.montoTotal || c.honorarios?.montoBase));
            if (!causasConHon.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Sin honorarios asignados.</p></div>'; return;
            }
            el.innerHTML = causasConHon.map(c => {
                const h = c.honorarios || {};
                const base = h.montoTotal || h.montoBase || 0;
                const saldo = typeof h.saldoPendiente === 'number' ? h.saldoPendiente : (parseFloat(h.saldoPendiente) || 0);
                const pagado = base - saldo;
                const pct = base > 0 ? Math.round((pagado / base) * 100) : 0;
                return `<div class="card" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:0.88rem;">${escHtml(c.caratula)}</strong>
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
            const id = parseInt(document.getElementById('ep-causa-sel').value);
            if (!id) { document.getElementById('analisisEstrategico').innerHTML = ''; return; }
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
