        // FUNCIONES NUEVAS — 15 MEJORAS
        // ═══════════════════════════════════════════════════════════════

        // ─── UTILS MODAL ─────────────────────────────────────────────────
        function abrirModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = '';
            el.classList.add('open');
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
            if (tab === 'economico') dcRenderEconomico(causaId);
            if (tab === 'docs-cliente')  dcRenderDocs(causaId, 'cliente');
            if (tab === 'docs-tribunal') dcRenderDocs(causaId, 'tribunal');
            if (tab === 'docs-tramites') dcRenderDocs(causaId, 'tramites');
            if (tab === 'proceso') dcRenderProceso(causaId);
        }

        function abrirDetalleCausa(causaId) {
            // Guardar sección activa para restaurar al cerrar el modal
            const seccionActiva = document.querySelector('section.tabs.active');
            const idActivo = seccionActiva ? seccionActiva.id : 'causas';
            if (idActivo !== 'causa-detail' && idActivo !== 'detalle-causa') {
                window._lexiumSeccionAnterior = idActivo;
            }

            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            evaluarRiesgoIntegral(causaId);

            // Inicializar estructuras si no existen
            if (!causa.tareas) causa.tareas = [];
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            if (!causa.movimientos) causa.movimientos = [];

            const hon = causa.honorarios || {};
            const etapas = causa.etapasProcesales || [];
            const docs = causa.documentos || [];

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
                <a onclick="cerrarModal('modal-detalle')"><i class="fas fa-home"></i> Inicio</a>
                <span class="bc-sep">/</span>
                <a onclick="cerrarModal('modal-detalle'); tab('causas',null);">Listado de Causas</a>
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
                            <div class="dc-meta-value">${escHtml(causa.rut || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Cliente</div>
                            <div class="dc-meta-value">${escHtml(cliente?.nombre || causa.cliente || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Procedimiento</div>
                            <div class="dc-meta-value">${escHtml(causa.tipoProcedimiento || '—')}</div>
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
                    ? `<button class="dc-btn danger" onclick="uiCerrarCausa(${causaId})"><i class="fas fa-lock"></i> Cerrar</button>`
                    : `<button class="dc-btn success" onclick="uiReactivarCausa(${causaId})"><i class="fas fa-lock-open"></i> Reactivar</button>`}
                    <button class="dc-btn" onclick="exportarPDFCausa(${causaId})"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="dc-btn" onclick="_abrirModalAdjuntos('${causaId}')" title="Archivos adjuntos">
                        <i class="fas fa-paperclip"></i> Adjuntos
                        <span style="background:rgba(255,255,255,0.3);border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${(causa.adjuntos||[]).length || 0}</span>
                    </button>
                    <button class="dc-btn" onclick="lexbotAbrirConCausa('${causaId}')" title="Consultar LexBot con contexto de esta causa"
                        style="background:linear-gradient(135deg,#0891b2,#0d5e8a);">
                        <i class="fas fa-robot"></i> LexBot
                    </button>
                    <button class="dc-btn" onclick="cerrarModal('modal-detalle'); exportarInformeMejorado('${causaId}')" title="Generar informe PDF profesional">
                        <i class="fas fa-star"></i> PDF Pro
                    </button>
                    <button class="dc-btn primary" onclick="cerrarModal('modal-detalle'); tab('estrategia-pro',null); document.getElementById('ep-causa-sel').value=${causaId}; uiRenderEstrategiaPro();">
                        <i class="fas fa-chess"></i> Estrategia
                    </button>
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
                        ${etapas.length ? etapas.map((e, i) => `
                            <div class="dc-etapa-item ${e.completada ? 'done' : ''}"
                                 onclick="uiMarcarEtapa(${causaId},${i})" style="cursor:pointer;">
                                <div class="dc-etapa-check ${e.completada ? 'done' : ''}">
                                    ${e.completada ? '<i class="fas fa-check" style="font-size:0.55rem;"></i>' : ''}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div class="dc-etapa-nombre">${escHtml(e.nombre)}</div>
                                    ${e.fecha ? `<div style="font-size:0.65rem; color:var(--text-3); font-family:'IBM Plex Mono',monospace; margin-top:1px;">${new Date(e.fecha).toLocaleDateString('es-CL')}</div>` : ''}
                                </div>
                            </div>`).join('')
                    : '<p style="font-size:0.78rem; color:var(--text-3);">Sin etapas definidas.</p>'}
                    </div>
                </div>

                <!-- Riesgo -->
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
                </div>

                <!-- Acciones extra -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header"><span><i class="fas fa-bolt"></i> Acciones</span></div>
                    <div class="dc-sidebar-body" style="display:flex; flex-direction:column; gap:6px;">
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            onclick="uiAbrirBuscarJuris(${causaId})">
                            <i class="fas fa-book"></i> Asociar jurisprudencia
                        </button>
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            onclick="uiDuplicarCausa(${causaId})">
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
                        onclick="dcCambiarTab('movimientos',${causaId})">
                        <i class="fas fa-exchange-alt"></i> Movimientos
                        <span class="dc-tab-badge">${movCount}</span>
                    </button>
                    <button id="dctab-tareas" class="dc-tab-btn"
                        onclick="dcCambiarTab('tareas',${causaId})">
                        <i class="fas fa-tasks"></i> Tareas
                        <span class="dc-tab-badge">${tareasPend > 0 ? `${tareasPend}/${tareasTotal}` : tareasTotal}</span>
                    </button>
                    <button id="dctab-economico" class="dc-tab-btn"
                        onclick="dcCambiarTab('economico',${causaId})">
                        <i class="fas fa-coins"></i> Datos económicos
                    </button>
                    <button id="dctab-partes" class="dc-tab-btn"
                        onclick="dcCambiarTab('partes',${causaId})">
                        <i class="fas fa-users"></i> Usuarios y partes
                    </button>
                    <button id="dctab-docs-cliente" class="dc-tab-btn"
                        onclick="dcCambiarTab('docs-cliente',${causaId})">
                        <i class="fas fa-folder"></i> Docs Cliente
                    </button>
                    <button id="dctab-docs-tribunal" class="dc-tab-btn"
                        onclick="dcCambiarTab('docs-tribunal',${causaId})">
                        <i class="fas fa-gavel"></i> Docs Tribunal
                    </button>
                    <button id="dctab-docs-tramites" class="dc-tab-btn"
                        onclick="dcCambiarTab('docs-tramites',${causaId})">
                        <i class="fas fa-wrench"></i> Otros Trámites
                    </button>
                    <button id="dctab-proceso" class="dc-tab-btn"
                        onclick="dcCambiarTab('proceso',${causaId})">
                        <i class="fas fa-sitemap"></i> Proceso
                    </button>
                </div>

                <!-- Tab panels -->
                <div id="dcpanel-movimientos"   class="dc-tab-panel active"></div>
                <div id="dcpanel-tareas"         class="dc-tab-panel"></div>
                <div id="dcpanel-economico"      class="dc-tab-panel"></div>
                <div id="dcpanel-partes"         class="dc-tab-panel"></div>
                <div id="dcpanel-docs-cliente"   class="dc-tab-panel"></div>
                <div id="dcpanel-docs-tribunal"  class="dc-tab-panel"></div>
                <div id="dcpanel-docs-tramites"  class="dc-tab-panel"></div>
                <div id="dcpanel-proceso"           class="dc-tab-panel"></div>
            </div>
        </div>
    `;
            abrirModal('modal-detalle');
            // Render tab inicial
            dcCambiarTab('movimientos', causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 1: MOVIMIENTOS + DOCUMENTOS (timeline unificado)
        // ════════════════════════════════════════════════════════
        function dcRenderMovimientos(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-movimientos');
            if (!el) return;

            const movs = (causa.movimientos || []).map(m => ({ ...m, _origen: 'mov' }));
            const docs = (causa.documentos || []).map(d => ({
                id: d.id, nombre: d.nombreOriginal || 'Documento',
                fecha: d.fechaDocumento, tipo: d.tipo || 'Documento',
                cuaderno: d.cuaderno || 'Principal', etapa: d.etapaVinculada || '—',
                folio: d.folio || '—', _origen: 'doc'
            }));
            const todos = [...movs, ...docs].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            el.innerHTML = `
            <div class="dc-mov-toolbar">
                <input class="dc-search-mov" id="dc-search-mov-${causaId}"
                    placeholder="Buscar movimientos..." oninput="dcFiltrarMovimientos(${causaId})">
                <select class="dc-cuaderno-sel" id="dc-cuaderno-${causaId}"
                    onchange="dcFiltrarMovimientos(${causaId})">
                    <option value="">Todos los cuadernos</option>
                    <option>Principal</option>
                    <option>Reconvencional</option>
                    <option>Incidental</option>
                </select>
                <span class="dc-mov-count" id="dc-mov-count-${causaId}">${todos.length} movimiento${todos.length !== 1 ? 's' : ''}</span>
            </div>
            <div id="dc-mov-list-${causaId}">
                ${dcMovHtml(todos)}
            </div>
            ${causa.estadoGeneral !== 'Finalizada' ? `
            <div style="margin-top:14px; padding-top:14px; border-top:1px dashed #e4eaf3; display:flex; gap:8px;">
                <input id="dc-new-mov-nombre-${causaId}" placeholder="Nombre del trámite..."
                    style="flex:1; padding:7px 10px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.8rem; font-family:'IBM Plex Sans',sans-serif;">
                <select id="dc-new-mov-tipo-${causaId}"
                    style="padding:7px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc;">
                    <option>Resolución</option><option>Escrito</option><option>Notificación</option>
                    <option>Audiencia</option><option>Sentencia</option><option>Otro</option>
                </select>
                <button class="dc-btn primary" onclick="dcAgregarMovimiento(${causaId})">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>` : ''}`;
        }

        function dcMovHtml(items) {
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
            if (cnt) cnt.textContent = `${visible} movimiento${visible !== 1 ? 's' : ''}`;
        }

        function dcAgregarMovimiento(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const nombre = document.getElementById(`dc-new-mov-nombre-${causaId}`)?.value.trim();
            const tipo = document.getElementById(`dc-new-mov-tipo-${causaId}`)?.value || 'Resolución';
            if (!nombre) { showError('Ingrese el nombre del trámite.'); return; }
            if (!causa.movimientos) causa.movimientos = [];
            causa.movimientos.push({
                id: generarID(), nombre, tipo,
                fecha: new Date().toISOString().split('T')[0],
                cuaderno: 'Principal', etapa: '', folio: '—'
            });
            causa.fechaUltimaActividad = new Date();
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            registrarEvento(`Movimiento agregado: ${nombre} — ${causa.caratula}`);
            abrirDetalleCausa(causaId);
            setTimeout(() => dcCambiarTab('movimientos', causaId), 50);
        }

        // ════════════════════════════════════════════════════════
        // TAB 2: TAREAS
        // ════════════════════════════════════════════════════════
        function dcRenderTareas(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-tareas');
            if (!el) return;
            if (!causa.tareas) causa.tareas = [];

            const pendientes = causa.tareas.filter(t => !t.done);
            const completadas = causa.tareas.filter(t => t.done);

            const tareaHtml = (t) => `
            <div class="dc-task-item ${t.done ? 'done' : ''}" id="tarea-${t.id}">
                <div class="dc-task-check ${t.done ? 'done' : ''}" onclick="dcToggleTarea(${causaId},'${t.id}')">
                    ${t.done ? '<i class="fas fa-check" style="font-size:0.6rem;"></i>' : ''}
                </div>
                <div style="flex:1; min-width:0;">
                    <div class="dc-task-text">${escHtml(t.texto)}</div>
                    <div class="dc-task-meta">${t.fecha || ''}</div>
                </div>
                <span class="dc-task-prioridad dc-task-p-${t.prioridad || 'media'}">${t.prioridad || 'media'}</span>
                <button class="dc-task-del" onclick="dcEliminarTarea(${causaId},'${t.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;

            el.innerHTML = `
            <div class="dc-task-add">
                <input id="dc-task-input-${causaId}" placeholder="Nueva tarea..."
                    onkeydown="if(event.key==='Enter') dcAgregarTarea(${causaId})">
                <select id="dc-task-prio-${causaId}"
                    style="padding:7px 8px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc; font-family:'IBM Plex Sans',sans-serif;">
                    <option value="alta">🔴 Alta</option>
                    <option value="media" selected>🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>
                <button class="dc-btn primary" onclick="dcAgregarTarea(${causaId})">
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

        function dcAgregarTarea(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const t = causa.tareas.find(t => t.id === tareaId);
            if (!t) return;
            t.done = !t.done;
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            dcRenderTareas(causaId);
        }

        function dcEliminarTarea(causaId, tareaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            causa.tareas = causa.tareas.filter(t => t.id !== tareaId);
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
            dcRenderTareas(causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 3: DATOS ECONÓMICOS
        // ════════════════════════════════════════════════════════
        function dcRenderEconomico(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            const el = document.getElementById('dcpanel-economico');
            if (!causa || !el) return;

            const hon = causa.honorarios || {};
            const base = hon.montoBase || hon.base || 0;
            const pagos = hon.pagos || [];
            const pagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
            const pend = base - pagado;
            const pct = base > 0 ? Math.round(pagado / base * 100) : 0;
            const cuantia = causa.cuantia || 0;

            el.innerHTML = `
            <div class="dc-econ-grid">
                <div class="dc-econ-kpi blue">
                    <div class="dc-econ-label">Monto Base</div>
                    <div class="dc-econ-val">$${base.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi green">
                    <div class="dc-econ-label">Cobrado</div>
                    <div class="dc-econ-val" style="color:#0d7a5f;">$${pagado.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi ${pend > 0 ? 'red' : 'green'}">
                    <div class="dc-econ-label">Pendiente</div>
                    <div class="dc-econ-val" style="color:${pend > 0 ? '#c0392b' : '#0d7a5f'};">$${pend.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi orange">
                    <div class="dc-econ-label">% Cobrado</div>
                    <div class="dc-econ-val" style="color:#b45309;">${pct}%</div>
                </div>
            </div>

            ${base > 0 ? `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:14px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    Progreso de cobro
                </div>
                <div style="background:#f1f5f9; border-radius:6px; height:10px; overflow:hidden; margin-bottom:6px;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#1a3a6b,#2563a8); border-radius:6px; transition:width 0.7s;"></div>
                </div>
                <div style="font-size:0.72rem; color:#64748b;">${pct}% cobrado · ${100 - pct}% pendiente</div>
            </div>` : ''}

            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    Historial de pagos ${pagos.length ? `(${pagos.length})` : ''}
                </div>
                <div class="dc-pagos-list">
                    ${pagos.length ? pagos.map(p => `
                        <div class="dc-pago-row">
                            <span style="color:#0f172a; font-weight:600;">${p.concepto || 'Pago'}</span>
                            <span style="color:#64748b; font-size:0.72rem; font-family:'IBM Plex Mono',monospace;">${p.fecha || '—'}</span>
                            <span style="color:#0d7a5f; font-weight:700; font-family:'IBM Plex Mono',monospace;">+$${(p.monto || 0).toLocaleString('es-CL')}</span>
                        </div>`).join('')
                    : '<p style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:12px 0;">Sin pagos registrados.</p>'}
                </div>
            </div>

            ${cuantia ? `
            <div style="margin-top:12px; background:#f8fafc; border:1px solid #e4eaf3; border-radius:8px; padding:12px 16px;">
                <span style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;">Cuantía en disputa</span>
                <div style="font-size:1.2rem; font-weight:700; font-family:'IBM Plex Mono',monospace; color:#1a3a6b; margin-top:4px;">$${cuantia.toLocaleString('es-CL')}</div>
            </div>` : ''}`;
        }

        // ════════════════════════════════════════════════════════
        // TAB 4: USUARIOS Y PARTES
        // ════════════════════════════════════════════════════════
        function dcRenderPartes(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            const el = document.getElementById('dcpanel-partes');
            if (!causa || !el) return;
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };

            const roles = [
                { key: 'demandante', label: 'Demandante', icon: 'fas fa-user', color: '#dbeafe', colorT: '#1a3a6b' },
                { key: 'demandado', label: 'Demandado', icon: 'fas fa-user-slash', color: '#fee2e2', colorT: '#c0392b' },
                { key: 'abogadoContrario', label: 'Abogado Contrario', icon: 'fas fa-gavel', color: '#fef3c7', colorT: '#b45309' },
                { key: 'juez', label: 'Juez / Árbitro', icon: 'fas fa-balance-scale', color: '#d1fae5', colorT: '#0d7a5f' }
            ];

            const iniciales = nombre => (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

            el.innerHTML = `
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
                        <button class="dc-parte-edit" onclick="dcEditarParte(${causaId},'${r.key}','${r.label}')">
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
                <button class="dc-btn" style="margin-top:10px; font-size:0.76rem;" onclick="dcEditarTribunal(${causaId})">
                    <i class="fas fa-pencil-alt"></i> Editar tribunal
                </button>
            </div>`;
        }

        function dcEditarParte(causaId, rolKey, rolLabel) {
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const pendientes = causa.etapasProcesales?.filter(e => !e.completada).length || 0;
            if (pendientes > 0 && !confirm(`Hay ${pendientes} etapas pendientes. ¿Cerrar igual?`)) return;
            causa.estadoGeneral = 'Finalizada';
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); registrarEvento(`Causa cerrada: ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        function uiReactivarCausa(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            causa.estadoGeneral = 'En tramitación'; causa.instancia = 'Segunda';
            if (typeof markAppDirty === "function") markAppDirty(); guardarDB(); registrarEvento(`Causa reactivada (2ª instancia): ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        // ─── 4. HONORARIOS REALES ────────────────────────────────────────
        function uiAsignarHonorarios() {
            const causaId = parseInt(document.getElementById('hr-causa-sel').value);
            const monto = parseFloat(document.getElementById('hr-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            asignarHonorarios(causaId, monto);
            const causa = DB.causas.find(c => c.id === causaId);
            registrarEvento(`Honorarios asignados: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
            document.getElementById('hr-monto').value = '';
            renderHonorariosResumen(); renderAll();
        }

        function uiRegistrarPago() {
            const causaId = parseInt(document.getElementById('hr-pago-causa-sel').value);
            const monto = parseFloat(document.getElementById('hr-pago-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa?.honorarios?.montoBase) { showError('Esta causa no tiene honorarios asignados. Asígnelos primero.'); return; }
            registrarPago(causaId, monto);
            registrarEvento(`Pago registrado: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
            document.getElementById('hr-pago-monto').value = '';
            renderHonorariosResumen(); renderAll();
        }

        function renderHonorariosResumen() {
            const el = document.getElementById('hr-resumen');
            if (!el) return;
            const causasConHon = DB.causas.filter(c => c.honorarios?.montoBase);
            if (!causasConHon.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Sin honorarios asignados.</p></div>'; return;
            }
            el.innerHTML = causasConHon.map(c => {
                const h = c.honorarios;
                const pagado = h.montoBase - h.saldoPendiente;
                const pct = Math.round((pagado / h.montoBase) * 100);
                return `<div class="card" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:0.88rem;">${escHtml(c.caratula)}</strong>
                <span class="badge ${h.saldoPendiente <= 0 ? 'badge-s' : 'badge-w'}">${h.saldoPendiente <= 0 ? 'PAGADO' : 'PENDIENTE'}</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--t2); margin-top:6px;">
                <span>Base: $${h.montoBase.toLocaleString('es-CL')}</span>
                <span>Pagado: <strong style="color:var(--s);">$${pagado.toLocaleString('es-CL')}</strong></span>
                <span>Pendiente: <strong style="color:var(--d);">$${h.saldoPendiente.toLocaleString('es-CL')}</strong></span>
            </div>
            ${h.pagos?.length ? `<div style="margin-top:10px; border-top:1px solid #f1f5f9; padding-top:8px;">
                ${h.pagos.map(p => `<div class="pago-item"><span>${new Date(p.fecha).toLocaleDateString('es-CL')}</span><span class="pago-monto">+$${p.monto.toLocaleString('es-CL')}</span></div>`).join('')}
            </div>` : ''}
        </div>`;
            }).join('');
        }

        // ─── FASE 5: PESTAÑAS DOCUMENTALES ──────────────────────────────
        const _DOCS_CONFIG = {
            cliente:  { campo: 'docsCliente',  label: 'Docs Cliente',   icono: 'fa-folder',       color: '#2563a8' },
            tribunal: { campo: 'docsTribunal',  label: 'Docs Tribunal',  icono: 'fa-gavel',        color: '#7c3aed' },
            tramites: { campo: 'docsTramites',  label: 'Otros Trámites', icono: 'fa-wrench',       color: '#0891b2' }
        };

        function dcRenderDocs(causaId, tipo) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = DB.causas.find(c => c.id === causaId);
            const el    = document.getElementById(`dcpanel-docs-${tipo}`);
            if (!causa || !el || !cfg) return;

            if (!causa[cfg.campo]) causa[cfg.campo] = [];
            const docs = causa[cfg.campo];
            const dropId  = `dc-drop-${causaId}-${tipo}`;
            const statId  = `dc-stat-${causaId}-${tipo}`;
            const listId  = `dcpanel-docs-${tipo}-list`;

            el.innerHTML = `
                <div style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">
                            <i class="fas ${cfg.icono}" style="color:${cfg.color};"></i> ${cfg.label}
                            <span style="background:#f1f5f9; color:#475569; padding:1px 7px; border-radius:10px; margin-left:6px;">${docs.length}</span>
                        </div>
                    </div>
                    <div id="${dropId}"
                         style="border:2px dashed #cbd5e1; border-radius:10px; padding:16px; text-align:center;
                                cursor:pointer; transition:all 0.2s; margin-bottom:10px; background:#f8fafc;"
                         onclick="document.getElementById('dc-file-${causaId}-${tipo}').click()"
                         ondragover="event.preventDefault(); this.style.borderColor='${cfg.color}'; this.style.background='${cfg.color}10';"
                         ondragleave="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc';"
                         ondrop="_dcHandleDrop(event,'${causaId}','${tipo}')">
                        <i class="fas fa-cloud-upload-alt" style="font-size:1.4rem; color:${cfg.color}; margin-bottom:5px; display:block;"></i>
                        <div style="font-weight:600; font-size:0.82rem; color:#334155;">Subir archivo</div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">
                            PDF · Word · Imagen · Arrastra o haz clic
                            ${cfg.campo !== 'docsTramites' ? '· <span style="color:'+cfg.color+'; font-weight:600;">IA clasifica PDFs automáticamente</span>' : ''}
                        </div>
                        <input type="file" id="dc-file-${causaId}-${tipo}" accept="*/*" multiple style="display:none;"
                               onchange="_dcHandleFiles(event,'${causaId}','${tipo}')">
                    </div>
                    <div id="${statId}" style="display:none; margin-bottom:10px;"></div>
                    <div id="${listId}">
                        ${_dcDocsHtml(docs, causaId, tipo, cfg)}
                    </div>
                </div>`;
        }

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
                        <button class="btn btn-xs" onclick="dcVerDocumento('${causaId}','${tipo}',${i})" title="Ver">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${esPdf ? `<button class="btn btn-xs" style="background:#eff6ff; color:#2563eb; border:none;"
                            onclick="_dcAnalizarDocIA('${causaId}','${tipo}',${i})" title="Analizar con IA">
                            <i class="fas fa-brain"></i>
                        </button>` : ''}
                        <button class="btn btn-xs" style="background:#fee2e2; color:#c0392b; border:none;"
                            onclick="dcEliminarDocumento('${causaId}','${tipo}',${i})" title="Eliminar">
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
            const causa = DB.causas.find(c => c.id === causaId);
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

            _dcGuardar();
            dcRenderDocs(causaId, tipo);

            if (files.every(f => f.type !== 'application/pdf')) {
                _dcMostrarStat(statEl, 'success', `<i class="fas fa-check-circle"></i> ${files.length} archivo(s) guardado(s).`);
                setTimeout(() => { if (statEl) statEl.style.display = 'none'; }, 3000);
            }
        };

        window._dcAnalizarDocIA = async function(causaId, tipo, idx) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = DB.causas.find(c => c.id === causaId);
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
                              : 'relacionado con trámites';

                const prompt = `Eres un asistente jurídico especializado en derecho chileno. ${ramaCtx}
Este documento es ${tipoCtx}.

Analiza el texto y devuelve SOLO un objeto JSON válido, sin explicaciones ni bloques de código:
{
  "tipo": "uno de: Resolución | Escrito | Prueba | Sentencia | Notificación | Contrato | Otro",
  "etapa": "etapa procesal breve (ej: Demanda, Contestación, Prueba, Sentencia)",
  "plazo": "descripción del plazo si existe (ej: '10 días hábiles para contestar') o null",
  "resumen": "resumen de 1 línea del contenido"
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
                }

                _dcGuardar();
                _dcMostrarStat(statEl, 'success',
                    `<i class="fas fa-check-circle"></i> <strong>IA clasificó "${escHtml(nombreArchivo)}"</strong>
                     ${data.tipo ? ` — ${escHtml(data.tipo)}` : ''}
                     ${data.resumen ? `<br><span style="font-size:0.72rem; color:#4b5563;">${escHtml(data.resumen)}</span>` : ''}`
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

        window.dcVerDocumento = function(causaId, tipo, idx) {
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = DB.causas.find(c => c.id === causaId);
            const doc   = causa?.[cfg.campo]?.[idx];
            if (!doc) return;

            let visor;
            if (doc.mimetype?.startsWith('image/')) {
                visor = `<img src="${doc.data}" style="max-width:100%; max-height:70vh; border-radius:6px;">`;
            } else if (doc.mimetype === 'application/pdf') {
                visor = `<iframe src="${doc.data}" style="width:100%; height:70vh; border:none; border-radius:6px;"></iframe>`;
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
                        <button class="modal-close" onclick="document.getElementById('modal-doc-viewer').style.display='none'">×</button>
                    </div>
                    <div id="modal-doc-viewer-body"></div>
                </div>`;
                document.body.appendChild(vm);
            }
            document.getElementById('modal-doc-viewer-titulo').textContent = doc.nombre;
            document.getElementById('modal-doc-viewer-body').innerHTML = visor;
            vm.style.display = 'flex';
        };

        window.dcEliminarDocumento = function(causaId, tipo, idx) {
            if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
            const cfg   = _DOCS_CONFIG[tipo];
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa?.[cfg.campo]) return;
            causa[cfg.campo].splice(idx, 1);
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
            const causa = DB.causas.find(c => c.id === causaId);
            const el = document.getElementById('dcpanel-proceso');
            if (!causa || !el) return;

            if (!causa.instancias)   causa.instancias = [];
            if (!causa.recursos)     causa.recursos = [];
            if (!causa.prescripcion) causa.prescripcion = {};

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
                                    onclick="dcCambiarInstancia('${causaId}','${inst}')"
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
                    <button onclick="dcAgregarInstancia('${causaId}')"
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
                        <button onclick="dcAgregarRecurso('${causaId}')"
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
                                        <button onclick="dcEliminarRecurso('${causaId}',${i})"
                                            style="background:transparent; border:none; color:#dc2626; cursor:pointer; font-size:0.75rem;">
                                            <i class="fas fa-trash"></i>
                                        </button>
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
                                onchange="dcGuardarPrescripcion('${causaId}')"
                                style="width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px;
                                       font-size:0.8rem; background:var(--bg-2,#f8fafc); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; color:#64748b; font-weight:600; display:block; margin-bottom:4px;">Tipo de prescripción</label>
                            <select id="dc-presc-tipo-${causaId}"
                                onchange="dcGuardarPrescripcion('${causaId}')"
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
                        onchange="dcGuardarPrescripcion('${causaId}')"
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
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
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
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa?.recursos) return;
            causa.recursos.splice(idx, 1);
            if (typeof markAppDirty === 'function') markAppDirty();
            _dcGuardar();
            dcRenderProceso(causaId);
        };

        window.dcGuardarPrescripcion = function(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
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
