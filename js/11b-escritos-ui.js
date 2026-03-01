        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 11b: CAPA DE VISTA — ESCRITOS
        // Responsabilidad: render HTML, eventos de usuario, navegación.
        // NO accede directamente a DB ni a localStorage.
        // SÓLO llama funciones de 11a-escritos-data.js para mutar datos.
        //
        // Dependencias:
        //   • 11a-escritos-data.js (todas las funciones *Data y aplicarVariablesDinamicas)
        //   • 09-app-core.js (tab, renderAll)
        //   • 10-ia-escritos.js (escActualizarEstadoBotones, showError, showSuccess, showInfo)
        //   • 05-business-engine.js (_escritoActual, guardarEscritoComoDocumento)
        //   • 03-causa-detail.js (abrirModal, cerrarModal)
        //   • 04-features.js (escHtml)
        // ████████████████████████████████████████████████████████████████████

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 1 — FILTROS DEL HISTORIAL (estado de vista)
        // ═══════════════════════════════════════════════════════════════════

        /** Estado actual de los filtros del panel de historial. @private */
        let _hFiltro = { texto: '', origen: '', favoritos: false };

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 2 — RENDER DEL HISTORIAL DE ESCRITOS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Renderiza la lista completa de escritos del historial en #historial-escritos-lista.
         * Lee los filtros activos de `_hFiltro` y delega el filtrado a historialFiltrarData().
         * Llamar siempre que cambien los datos o los filtros.
         */
        function historialRenderEscritos() {
            const cont = document.getElementById('historial-escritos-lista');
            if (!cont) return;

            const lista = historialFiltrarData(_hFiltro);

            if (!lista.length) {
                cont.innerHTML = `<div class="alert-empty" style="padding:40px;">
                    <i class="fas fa-history" style="font-size:2rem; color:var(--text-3); display:block; margin-bottom:12px;"></i>
                    ${DB.historialEscritos.length === 0
                        ? 'No hay escritos guardados aún. Genera un escrito y guárdalo con <strong>Guardar en Historial</strong>.'
                        : 'Ningún escrito coincide con los filtros aplicados.'}
                </div>`;
                return;
            }

            const origenBadge = o => ({
                ia:        `<span class="badge badge-cyan">✨ IA</span>`,
                catalogo:  `<span class="badge">📄 Catálogo</span>`,
                plantilla: `<span class="badge badge-purple">📋 Plantilla propia</span>`,
                manual:    `<span class="badge">Manual</span>`,
            }[o] || `<span class="badge">${o}</span>`);

            cont.innerHTML = lista.map(e => `
                <div class="hist-card${e.favorito ? ' favorito' : ''}" data-id="${e.id}">
                    <div class="hist-card-header">
                        <div class="hist-card-titulo">
                            <button class="btn-icon fav-btn" onclick="historialToggleFavorito('${e.id}')"
                                title="${e.favorito ? 'Quitar favorito' : 'Marcar favorito'}">
                                <i class="fa${e.favorito ? 's' : 'r'} fa-star" style="color:${e.favorito ? 'var(--warning)' : 'var(--text-3)'};"></i>
                            </button>
                            <span class="hist-tipo">${escHtml(e.tipoLabel || e.tipo)}</span>
                            ${origenBadge(e.origen)}
                        </div>
                        <div class="hist-card-actions">
                            <button class="btn btn-xs" onclick="historialCargarEscrito('${e.id}')"
                                title="Abrir en visor">
                                <i class="fas fa-eye"></i> Abrir
                            </button>
                            <button class="btn btn-xs" onclick="historialVerVersiones('${e.id}')"
                                title="Ver historial de versiones"
                                style="display:${e.versiones?.length ? 'inline-flex' : 'none'}">
                                <i class="fas fa-code-branch"></i> ${e.versiones?.length || 0}v
                            </button>
                            <button class="btn btn-xs btn-danger-outline" onclick="historialEliminarEscrito('${e.id}')"
                                title="Eliminar del historial">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="hist-card-meta">
                        <span><i class="fas fa-gavel"></i> ${escHtml(e.caratula)}</span>
                        <span><i class="fas fa-user"></i> ${escHtml(e.autor)}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(e.fecha).toLocaleString('es-CL', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div class="hist-preview">${escHtml((e.texto || '').substring(0, 180))}…</div>
                </div>`).join('');
        }

        /**
         * Lee los controles de filtro del DOM, actualiza `_hFiltro` y re-renderiza.
         * Conectado a los inputs #hfilt-texto, #hfilt-origen y #hfilt-favoritos.
         */
        function historialFiltrar() {
            _hFiltro.texto     = (document.getElementById('hfilt-texto')?.value     || '').trim();
            _hFiltro.origen    = document.getElementById('hfilt-origen')?.value     || '';
            _hFiltro.favoritos = document.getElementById('hfilt-favoritos')?.checked || false;
            historialRenderEscritos();
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 3 — ACCIONES DEL HISTORIAL (orquestación UI ↔ datos)
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Elimina un escrito del historial y actualiza la vista.
         * Delega la mutación a historialEliminarEscritoData().
         *
         * @param {string} id - ID del escrito a eliminar.
         */
        function historialEliminarEscrito(id) {
            historialEliminarEscritoData(id);
            historialRenderEscritos();
            showSuccess('Escrito eliminado del historial.');
        }

        /**
         * Alterna el favorito de un escrito y re-renderiza la lista.
         * Delega la mutación a historialToggleFavoritoData().
         *
         * @param {string} id - ID del escrito.
         */
        function historialToggleFavorito(id) {
            historialToggleFavoritoData(id);
            historialRenderEscritos();
        }

        /**
         * Carga un escrito del historial en el visor de escritos y navega a la sección.
         * Actualiza el estado interno `_escritoActual` (definido en 05-business-engine.js).
         *
         * @param {string} id - ID del escrito a cargar.
         */
        function historialCargarEscrito(id) {
            const e = historialObtenerEscrito(id);
            if (!e) return;

            const preview  = document.getElementById('esc-preview');
            const visorTit = document.getElementById('esc-visor-titulo');
            if (preview)  preview.textContent  = e.texto;
            if (visorTit) visorTit.textContent = `${e.tipoLabel} · ${e.caratula}`;

            _escritoActual = { causaId: e.causaId, texto: e.texto, tipo: e.tipo };
            escActualizarEstadoBotones(true);

            tab('escritos');
            showInfo(`Escrito cargado: "${e.tipoLabel}"`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 4 — VERSIONES (vista)
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Restaura el texto de una versión anterior con confirmación del usuario.
         * Si el escrito está abierto en el visor, actualiza el preview en tiempo real.
         *
         * @param {string} escritoId  - ID de la entrada del historial.
         * @param {number} numVersion - Número de versión a restaurar.
         */
        function historialRestaurarVersion(escritoId, numVersion) {
            const entrada = historialObtenerEscrito(escritoId);
            if (!entrada || !entrada.versiones) return;
            const ver = entrada.versiones.find(v => v.v === numVersion);
            if (!ver) return;

            showConfirm(
                `Restaurar versión ${numVersion}`,
                `¿Restaurar "${entrada.tipoLabel}" a la ${ver.nota}?\nEl texto actual se guardará como nueva versión antes de restaurar.`,
                () => {
                    const resultado = historialRestaurarVersionData(escritoId, numVersion);
                    if (!resultado.exito) return;

                    // Si el escrito restaurado está abierto en el visor, actualizar el preview
                    if (_escritoActual.causaId === entrada.causaId && _escritoActual.tipo === entrada.tipo) {
                        _escritoActual.texto = resultado.textoRestaurado;
                        const preview = document.getElementById('esc-preview');
                        if (preview) preview.textContent = resultado.textoRestaurado;
                    }
                    showSuccess(`Texto restaurado a la ${resultado.nota}.`);
                    historialRenderEscritos();
                }
            );
        }

        /**
         * Abre el modal #modal-versiones con el historial de versiones de un escrito.
         *
         * @param {string} escritoId - ID del escrito cuyas versiones mostrar.
         */
        function historialVerVersiones(escritoId) {
            const entrada = historialObtenerEscrito(escritoId);
            if (!entrada) return;

            const versiones = entrada.versiones || [];
            const modal = document.getElementById('modal-versiones');
            if (!modal) return;

            document.getElementById('modal-versiones-titulo').textContent =
                `Versiones — ${entrada.tipoLabel} · ${entrada.caratula}`;

            const lista = document.getElementById('modal-versiones-lista');
            if (!versiones.length) {
                lista.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-3); font-size:13px;">
                    <i class="fas fa-code-branch" style="font-size:2rem; display:block; margin-bottom:10px;"></i>
                    Este escrito no tiene versiones previas guardadas.<br>
                    Al editar y guardar, el historial de versiones aparecerá aquí.
                </div>`;
            } else {
                lista.innerHTML = [...versiones].reverse().map(v => `
                    <div style="display:flex; align-items:flex-start; gap:14px; padding:14px 0; border-bottom:1px solid var(--border);">
                        <div style="width:32px; height:32px; border-radius:50%; background:var(--cyan-light);
                            display:flex; align-items:center; justify-content:center;
                            font-size:11px; font-weight:700; color:var(--cyan); flex-shrink:0; font-family:'IBM Plex Mono',monospace;">
                            v${v.v}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:600; font-size:13px; color:var(--text);">${escHtml(v.nota)}</div>
                            <div style="font-size:11px; color:var(--text-3); margin-top:2px; font-family:'IBM Plex Mono',monospace;">
                                ${new Date(v.fecha).toLocaleString('es-CL')} · ${escHtml(v.autor)}
                            </div>
                            <div style="font-size:12px; color:var(--text-2); margin-top:6px; line-height:1.5;
                                background:var(--bg); padding:8px 10px; border-radius:var(--r-sm); font-family:'IBM Plex Mono',monospace;">
                                ${escHtml((v.texto || '').substring(0, 120))}…
                            </div>
                        </div>
                        <button class="btn btn-xs" onclick="historialRestaurarVersion('${escritoId}', ${v.v}); cerrarModal('modal-versiones');"
                            title="Restaurar esta versión" ${v.v === versiones.length ? 'disabled style="opacity:0.4"' : ''}>
                            <i class="fas fa-undo"></i> Restaurar
                        </button>
                    </div>`).join('');
            }

            abrirModal('modal-versiones');
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 5 — VARIABLES DINÁMICAS (acción UI)
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Lee el escrito del visor, aplica las variables dinámicas con datos reales
         * de la causa y actualiza el preview. Muestra un resumen de lo reemplazado.
         * Delega la lógica pura a aplicarVariablesDinamicas() de 11a-escritos-data.js.
         */
        function uiAplicarVariables() {
            if (!_escritoActual.texto) { showError('Primero genere un escrito.'); return; }
            const causa = DB.causas.find(c => c.id === _escritoActual.causaId);
            if (!causa) { showError('No se encontró la causa asociada.'); return; }

            const { texto, reemplazos } = aplicarVariablesDinamicas(_escritoActual.texto, causa);
            _escritoActual.texto = texto;

            const preview = document.getElementById('esc-preview');
            if (preview) preview.textContent = texto;

            if (!reemplazos.length) {
                showInfo('No se encontraron variables [VARIABLE] reconocidas en el escrito.');
            } else {
                showSuccess(`✓ ${reemplazos.length} variable${reemplazos.length > 1 ? 's' : ''} reemplazada${reemplazos.length > 1 ? 's' : ''}: ${reemplazos.map(r => r.var).join(', ')}.`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 6 — PLANTILLAS (vista)
        // ═══════════════════════════════════════════════════════════════════

        /** ID de la plantilla en edición. null = nueva plantilla. @private */
        let _plantillaEditing = null;

        /**
         * Abre el modal #modal-plantilla limpio para crear una nueva plantilla.
         */
        function plantillaNueva() {
            _plantillaEditing = null;
            _plantillaLimpiarForm();
            abrirModal('modal-plantilla');
        }

        /**
         * Rellena el modal #modal-plantilla con los datos de una plantilla existente
         * para su edición.
         *
         * @param {string} id - ID de la plantilla a editar.
         */
        function plantillaEditar(id) {
            const p = plantillaObtenerData(id);
            if (!p) return;
            _plantillaEditing = id;
            document.getElementById('plt-nombre').value        = p.nombre        || '';
            document.getElementById('plt-materia').value       = p.materia       || 'civil';
            document.getElementById('plt-descripcion').value   = p.descripcion   || '';
            document.getElementById('plt-instrucciones').value = p.instrucciones || '';
            document.getElementById('plt-cuerpo').value        = p.cuerpo        || '';
            document.getElementById('plt-tags').value          = (p.tags || []).join(', ');
            abrirModal('modal-plantilla');
        }

        /** Limpia todos los campos del formulario de plantilla. @private */
        function _plantillaLimpiarForm() {
            ['plt-nombre','plt-materia','plt-descripcion','plt-instrucciones','plt-cuerpo','plt-tags']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = id === 'plt-materia' ? 'civil' : '';
                });
        }

        /**
         * Lee el formulario del modal de plantilla, valida y persiste (crear o actualizar).
         * Delega la persistencia a plantillaCrearData() o plantillaActualizarData() según sea el caso.
         * Luego cierra el modal y re-renderiza la lista.
         */
        function plantillaGuardar() {
            const nombre        = (document.getElementById('plt-nombre')?.value        || '').trim();
            const materia       =  document.getElementById('plt-materia')?.value        || 'civil';
            const descripcion   = (document.getElementById('plt-descripcion')?.value   || '').trim();
            const instrucciones = (document.getElementById('plt-instrucciones')?.value || '').trim();
            const cuerpo        = (document.getElementById('plt-cuerpo')?.value        || '').trim();
            const tagsRaw       = (document.getElementById('plt-tags')?.value          || '').trim();

            if (!nombre) { showError('El nombre de la plantilla es obligatorio.'); return; }
            if (!cuerpo && !instrucciones) {
                showError('Ingrese al menos el cuerpo o las instrucciones para la IA.');
                return;
            }

            const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

            if (_plantillaEditing) {
                plantillaActualizarData(_plantillaEditing, { nombre, materia, descripcion, instrucciones, cuerpo, tags });
                showSuccess(`Plantilla "${nombre}" actualizada.`);
            } else {
                plantillaCrearData({ nombre, materia, descripcion, instrucciones, cuerpo, tags });
                showSuccess(`Plantilla "${nombre}" creada.`);
            }

            cerrarModal('modal-plantilla');
            plantillasRender();
            _actualizarSelectorConPlantillas();
        }

        /**
         * Pide confirmación y elimina una plantilla. Actualiza la vista tras eliminar.
         *
         * @param {string} id - ID de la plantilla a eliminar.
         */
        function plantillaEliminar(id) {
            const p = plantillaObtenerData(id);
            if (!p) return;
            showConfirm('Eliminar Plantilla', `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`, () => {
                plantillaEliminarData(id);
                plantillasRender();
                _actualizarSelectorConPlantillas();
                showSuccess('Plantilla eliminada.');
            });
        }

        /**
         * Carga el cuerpo de una plantilla en el textarea de hechos del formulario
         * de escritos y navega a la sección correspondiente.
         *
         * @param {string} id - ID de la plantilla a usar.
         */
        function plantillaUsar(id) {
            const p = plantillaObtenerData(id);
            if (!p) return;

            const hechos = document.getElementById('esc-hechos');
            if (hechos && p.cuerpo) hechos.value = p.cuerpo;

            plantillaRegistrarUsoData(id);

            tab('escritos');
            showInfo(`Plantilla "${p.nombre}" cargada en el formulario.`);
        }

        /**
         * Renderiza la lista de plantillas del despacho en #plantillas-lista.
         * Lee directamente DB.plantillasEscritos (colección viva).
         */
        function plantillasRender() {
            const cont = document.getElementById('plantillas-lista');
            if (!cont) return;

            const lista = DB.plantillasEscritos;

            if (!lista.length) {
                cont.innerHTML = `<div class="alert-empty" style="padding:40px;">
                    <i class="fas fa-layer-group" style="font-size:2rem; color:var(--text-3); display:block; margin-bottom:12px;"></i>
                    No hay plantillas creadas aún.<br>Pulse <strong>+ Nueva Plantilla</strong> para comenzar.
                </div>`;
                return;
            }

            const materiaBadge = m => ({
                civil:       `<span class="badge">Civil</span>`,
                laboral:     `<span class="badge badge-green">Laboral</span>`,
                familia:     `<span class="badge badge-purple">Familia</span>`,
                penal:       `<span class="badge badge-red">Penal</span>`,
                tributario:  `<span class="badge badge-cyan">Tributario</span>`,
                contencioso: `<span class="badge badge-orange">Cont.-Adm.</span>`,
            }[m] || `<span class="badge">${m}</span>`);

            cont.innerHTML = lista.map(p => `
                <div class="plt-card">
                    <div class="plt-card-header">
                        <div>
                            <div class="plt-nombre">${escHtml(p.nombre)}</div>
                            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                                ${materiaBadge(p.materia)}
                                ${(p.tags || []).map(t => `<span class="badge badge-gray">${escHtml(t)}</span>`).join('')}
                            </div>
                        </div>
                        <div class="plt-card-actions">
                            <button class="btn btn-xs btn-cyan-outline" onclick="plantillaUsar('${p.id}')"
                                title="Cargar en formulario de escritos">
                                <i class="fas fa-pen-nib"></i> Usar
                            </button>
                            <button class="btn btn-xs" onclick="plantillaEditar('${p.id}')"
                                title="Editar plantilla">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-danger-outline" onclick="plantillaEliminar('${p.id}')"
                                title="Eliminar plantilla">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${p.descripcion ? `<div class="plt-desc">${escHtml(p.descripcion)}</div>` : ''}
                    <div class="plt-meta">
                        <span><i class="fas fa-user"></i> ${escHtml(p.autor)}</span>
                        <span><i class="fas fa-redo"></i> Usado ${p.usosCount || 0} veces</span>
                        <span><i class="fas fa-clock"></i> ${new Date(p.fechaModificacion || p.fechaCreacion).toLocaleDateString('es-CL')}</span>
                    </div>
                </div>`).join('');
        }

        /**
         * Agrega un `<optgroup>` con las plantillas propias del despacho
         * al `<select>` #esc-tipo, para que aparezcan junto al catálogo estático.
         * Elimina el grupo previo antes de insertar para evitar duplicados.
         * @private
         */
        function _actualizarSelectorConPlantillas() {
            const sel = document.getElementById('esc-tipo');
            if (!sel) return;

            const prevGroup = sel.querySelector('optgroup[data-plantillas]');
            if (prevGroup) prevGroup.remove();

            const plantillas = DB.plantillasEscritos;
            if (!plantillas.length) return;

            const group = document.createElement('optgroup');
            group.label = '── Mis Plantillas ──';
            group.dataset.plantillas = '1';

            plantillas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = `plantilla__${p.id}`;
                opt.textContent = `📋 ${p.nombre}`;
                opt.dataset.label = p.nombre;
                opt.dataset.promptExtra = p.instrucciones || '';
                group.appendChild(opt);
            });

            sel.appendChild(group);
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 7 — SELECTOR DE TIPOS EXTENDIDO
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Versión extendida de rellenarTiposEscritos() (reemplaza la de 09-app-core).
         * Incluye las materias penal, tributario y contencioso de TIPOS_ESCRITOS_EXTRA,
         * además de las plantillas propias del despacho.
         *
         * @param {string} [materiaId='civil'] - ID de materia de la causa seleccionada.
         */
        function rellenarTiposEscritos(materiaId) {
            const sel = document.getElementById('esc-tipo');
            if (!sel) return;

            const KEY_MAP = {
                civil: 'civil', 'derecho civil': 'civil',
                laboral: 'laboral', 'derecho laboral': 'laboral', 'derecho del trabajo': 'laboral',
                familia: 'familia', 'derecho de familia': 'familia',
                penal: 'penal', 'derecho penal': 'penal', 'criminal': 'penal',
                tributario: 'tributario', 'derecho tributario': 'tributario', 'tributaria': 'tributario',
                contencioso: 'contencioso', 'contencioso administrativo': 'contencioso',
                'derecho administrativo': 'contencioso',
            };

            const key = KEY_MAP[(materiaId || 'civil').toLowerCase()] || 'civil';
            const catalogoCompleto = Object.assign({}, TIPOS_ESCRITOS, TIPOS_ESCRITOS_EXTRA);
            const tipos = catalogoCompleto[key] || catalogoCompleto.civil;

            sel.innerHTML = tipos.map(t =>
                `<option value="${t.id}" data-label="${escHtml(t.label)}" data-prompt-extra="${escHtml(t.prompt_extra || '')}">${escHtml(t.label)}</option>`
            ).join('');

            _actualizarSelectorConPlantillas();
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 8 — GUARDAR ESCRITO (orquestación completa)
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Orquesta el guardado del escrito actual:
         *   1. Valida que haya texto y causa.
         *   2. Detecta el origen (IA / plantilla / catálogo).
         *   3. Pide confirmación al usuario.
         *   4. Guarda como documento en la causa (guardarEscritoComoDocumento de 05).
         *   5. Registra en el historial del despacho (historialGuardarEscrito de 11a).
         *   6. Actualiza la UI.
         */
        function uiGuardarEscrito() {
            const { causaId, texto, tipo } = _escritoActual;
            if (!causaId || !texto) { showError('Primero genere un escrito.'); return; }

            const tipoLabel  = document.getElementById('esc-tipo')?.selectedOptions?.[0]?.dataset?.label || tipo;
            const origen     = detectarOrigenEscrito();
            const origenLabel = {
                ia:        '✨ IA (Gemini)',
                plantilla: '📋 Plantilla propia',
                catalogo:  'Plantilla del catálogo',
            }[origen] || origen;

            showConfirm(
                'Guardar Escrito',
                `¿Guardar "${tipoLabel}" en la causa y en el historial del despacho?\n\nOrigen: ${origenLabel}`,
                () => {
                    guardarEscritoComoDocumento(causaId, texto, tipo);
                    historialGuardarEscrito({ causaId, tipo, tipoLabel, texto, origen });
                    renderAll();
                    historialRenderEscritos();
                    showSuccess('Escrito guardado en la causa y en el historial.');
                }
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 9 — PUNTO DE ENTRADA DE LA SECCIÓN
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Inicializa/actualiza todos los paneles de escritos al navegar a la sección.
         * Llamar desde el handler de navegación (tab 'historial-escritos' o 'plantillas-escritos').
         */
        function renderEscritosDB() {
            historialRenderEscritos();
            plantillasRender();
            _actualizarSelectorConPlantillas();
        }

        // ── Exponer función mejorada en window ────────────────────────────
        // Sobreescribe la versión básica expuesta por 10-ia-escritos.js.
        // Esta versión guarda además en el historial del despacho.
        document.addEventListener('DOMContentLoaded', () => {
            window.uiGuardarEscrito  = uiGuardarEscrito;
            window.renderEscritosDB  = renderEscritosDB;
        });
