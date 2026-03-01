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
                            ${esProspecto ? `<button onclick="plantillaCausaAbrir?.('${c.id}') || convertToCause('${c.id}')" class="btn btn-p btn-sm"><i class="fas fa-plus"></i> Abrir Causa</button>` : ''}
                            <button onclick="verPerfilCliente?.('${c.id}')" class="btn btn-sm" style="background:var(--bg-2); border:none;"><i class="fas fa-external-link-alt"></i></button>
                            <button onclick="deleteClient('${c.id}')" class="btn btn-d btn-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function renderCausas() {
            const el = document.getElementById('causa-list');
            if (!DB.causas.length) {
                el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-gavel"></i><p>Sin causas activas. Convierta un prospecto desde la sección Clientes.</p></div>';
                return;
            }
            el.innerHTML = DB.causas.map(c => {
                const colorRiesgo = v => v === 'Alto' ? 'var(--danger)' : v === 'Medio' ? 'var(--warning)' : 'var(--success)';
                const rProb = c.riesgo?.probatorio || 'Medio';
                const rProc = c.riesgo?.procesal || 'Bajo';
                
                return `
                <div class="db-kpi" style="padding:20px; cursor:pointer;" onclick="tab('causa-detail'); viewCausa('${c.id}');">
                    <div class="icon-box-premium" style="background:var(--cyan-light); color:var(--cyan);">
                        <i class="fas fa-gavel"></i>
                    </div>
                    <div class="db-kpi-data">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div class="db-kpi-val" style="font-size:1.1rem; letter-spacing:-0.2px;">${escHtml(c.caratula)}</div>
                            <span class="badge ${c.estadoGeneral === 'Finalizada' ? 'badge-s' : 'badge-a'}" style="font-size:9px;">${c.estadoGeneral.toUpperCase()}</span>
                        </div>
                        <div style="font-size:11px; color:var(--text-3); font-family:'IBM Plex Mono',monospace;">ID: ${c.id} · ${escHtml(c.tipoProcedimiento)}</div>
                        
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
                    ${c.estadoGeneral !== 'Finalizada' ? `<div style="position:absolute; top:0; left:0; bottom:0; width:4px; background:var(--cyan);"></div>` : ''}
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
            const nuevoCliente = { id: uid(), nombre: nom, nom, rut, rel, descripcion: rel, estado: 'prospecto', status: 'prospecto', fechaCreacion: new Date() };
            DB.clientes.push(nuevoCliente);
            document.getElementById('cl-nom').value = '';
            document.getElementById('cl-rut').value = '';
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
