        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 14: FEATURES v8
        // 1. LexBot mejorado con contexto de causa
        // 2. Plantillas de escritos personalizables con variables {{x}}
        // 3. Exportación Excel/CSV de cartera
        // 4. Informe de causa mejorado (PDF con portada, índice, firma)
        // 5. Registro de tiempo por causa (timesheets)
        // ── NOTA DE ARQUITECTURA ──────────────────────────────────────────
        // Este módulo (v8) es INDEPENDIENTE de 13-features-v7.js.
        // NO hay solapamiento de funciones entre ambos. Cada uno gestiona
        // dominios distintos y ambos deben mantenerse activos.
        //   v7 → Notificaciones, Adjuntos, AccionesRápidas, Plantillas de causa
        //   v8 → LexBot mejorado, Plantillas de escritos, Timesheet, Exports
        // La función lexbotAbrirConCausa fue renombrada aquí a
        // _lexbotCargarContextoUI para evitar colisión con 17-claude-legal.js.
        // ████████████████████████████████████████████████████████████████████

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 1 — LEXBOT MEJORADO CON CONTEXTO DE CAUSA
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Causa actualmente "anclada" al contexto de LexBot.
         * null = modo general (sin causa específica).
         * @type {string|null}
         */
        let _lexbotCausaId = null;

        /**
         * Inyecta el contexto de una causa en la UI del LexBot legacy:
         * actualiza badge del header, subtítulo y mensaje de bienvenida.
         * ⚠️  Renombrada de lexbotAbrirConCausa → _lexbotCargarContextoUI para
         * evitar colisión con la función homónima en 17-claude-legal.js.
         * 17-claude-legal.js la invoca automáticamente al abrir desde causa.
         * @param {string} causaId - ID de la causa cuyo contexto se inyecta.
         */
        function _lexbotCargarContextoUI(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;

            _lexbotCausaId = causaId;

            // Actualizar indicador visual en el header de LexBot (si existe)
            const ctxBadge = document.getElementById('lexbot-ctx-badge');
            if (ctxBadge) {
                ctxBadge.textContent = `📁 ${causa.caratula.substring(0, 30)}${causa.caratula.length > 30 ? '…' : ''}`;
                ctxBadge.style.display = 'block';
            }

            // Actualizar subtítulo
            const sub = document.getElementById('lexbot-sub');
            if (sub) sub.textContent = 'Modo: causa específica';

            // Limpiar chat e inyectar mensaje de bienvenida contextual (LexBot legacy)
            const hist = document.getElementById('lexbot-chat-history');
            if (hist) {
                const etapaActual = causa.etapasProcesales?.find(e => !e.completada)?.nombre || 'Concluida';
                const alertasActivas = DB.alertas.filter(a => a.causaId === causaId && a.estado === 'activa').length;
                hist.innerHTML = `
                    <div class="lexbot-message bot">
                        <strong>Contexto cargado: ${escHtml(causa.caratula)}</strong><br>
                        <span style="font-size:11px;opacity:0.8;">
                            📋 ${escHtml(causa.tipoProcedimiento)} · ${escHtml(causa.rama || 'General')}<br>
                            ⚖️ Etapa actual: ${escHtml(etapaActual)}<br>
                            🔔 ${alertasActivas} alerta(s) activa(s)
                        </span><br><br>
                        Estoy listo para ayudarte con esta causa. Puedes preguntarme sobre plazos, estrategia, jurisprudencia aplicable, o pedirme que analice la situación procesal.
                    </div>`;
            }

            // Usar clToggleChat (módulo 17 — Claude Legal) como punto de apertura.
            // Si 17 no cargó, intentar toggleLexBot como último recurso.
            if (typeof clToggleChat === 'function') {
                clToggleChat(causaId);
            } else if (typeof toggleLexBot === 'function') {
                toggleLexBot();
            } else {
                console.warn('[LexBot] No se encontró función de apertura (clToggleChat / toggleLexBot).');
            }
        }

        /**
         * Limpia el contexto de causa de LexBot (vuelve al modo general).
         */
        function lexbotLimpiarContexto() {
            _lexbotCausaId = null;
            const ctxBadge = document.getElementById('lexbot-ctx-badge');
            if (ctxBadge) { ctxBadge.textContent = ''; ctxBadge.style.display = 'none'; }
            const sub = document.getElementById('lexbot-sub');
            if (sub) sub.textContent = 'Asistente Legal Inteligente';

            const hist = document.getElementById('lexbot-chat-history');
            if (hist) hist.innerHTML = `<div class="lexbot-message bot">Hola, soy LexBot. ¿En qué puedo apoyarte con tus causas hoy?</div>`;

            showInfo('LexBot vuelve al modo general.');
        }

        /**
         * Versión mejorada del context extractor: cuando hay causa anclada,
         * incluye etapas, estrategia, alertas, honorarios y jurisprudencia asociada.
         * Reemplaza (extiende) askIAExtractContext() del módulo 09.
         * @returns {string} Contexto en texto para el system prompt.
         */
        function lexbotBuildContext() {
            // Contexto general siempre presente
            let ctx = '== CONTEXTO DESPACHO ==\n';
            ctx += `Causas activas: ${DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').length}\n`;
            ctx += `Clientes: ${DB.clientes.length} | Documentos: ${DB.documentos.length}\n`;
            ctx += `Alertas activas: ${DB.alertas.filter(a => a.estado === 'activa').length}\n\n`;

            // Si hay causa anclada, incluir contexto profundo
            if (_lexbotCausaId) {
                const causa = DB.causas.find(c => c.id === _lexbotCausaId);
                if (causa) {
                    ctx += '== CAUSA EN CONTEXTO (FOCO ACTUAL) ==\n';
                    ctx += `Carátula: ${causa.caratula}\n`;
                    ctx += `Procedimiento: ${causa.tipoProcedimiento} | Rama: ${causa.rama || 'General'}\n`;
                    ctx += `Tribunal: ${causa.juzgado || 'No especificado'} | RIT: ${causa.rit || causa.rut || 'N/A'}\n`;
                    ctx += `Estado: ${causa.estadoGeneral} | Instancia: ${causa.instancia || 'Primera'}\n`;
                    ctx += `Avance: ${causa.porcentajeAvance || 0}%\n\n`;

                    // Etapas
                    const etapas = causa.etapasProcesales || [];
                    const completadas = etapas.filter(e => e.completada);
                    const pendientes = etapas.filter(e => !e.completada);
                    ctx += `ETAPAS COMPLETADAS (${completadas.length}/${etapas.length}):\n`;
                    completadas.forEach(e => { ctx += `  ✓ ${e.nombre}\n`; });
                    ctx += `PRÓXIMAS ETAPAS:\n`;
                    pendientes.slice(0, 4).forEach(e => { ctx += `  → ${e.nombre}\n`; });
                    ctx += '\n';

                    // Estrategia
                    const f = causa.estrategia?.ficha || {};
                    if (f.hechos || f.derecho) {
                        ctx += 'ESTRATEGIA REGISTRADA:\n';
                        if (f.hechos)   ctx += `  Hechos: ${f.hechos.substring(0, 200)}\n`;
                        if (f.derecho)  ctx += `  Derecho: ${f.derecho.substring(0, 200)}\n`;
                        if (f.evidencia) ctx += `  Evidencia: ${f.evidencia.substring(0, 100)}\n`;
                        if (f.probabilidadExito !== undefined) ctx += `  Probabilidad de éxito estimada: ${f.probabilidadExito}%\n`;
                        ctx += '\n';
                    }

                    // Riesgo
                    const r = causa.riesgo || {};
                    if (Object.keys(r).length) {
                        ctx += 'EVALUACIÓN DE RIESGO:\n';
                        Object.entries(r).forEach(([k, v]) => { ctx += `  ${k}: ${v}\n`; });
                        ctx += '\n';
                    }

                    // Alertas de esta causa
                    const alertasCausa = DB.alertas.filter(a => a.causaId === _lexbotCausaId && a.estado === 'activa');
                    if (alertasCausa.length) {
                        ctx += 'ALERTAS ACTIVAS DE ESTA CAUSA:\n';
                        alertasCausa.forEach(a => {
                            const venc = new Date(a.fechaVencimiento);
                            const diff = Math.floor((venc - Date.now()) / 86400000);
                            ctx += `  [${a.prioridad?.toUpperCase()}] ${a.mensaje} — vence en ${diff} días\n`;
                        });
                        ctx += '\n';
                    }

                    // Honorarios
                    const hon = causa.honorarios || {};
                    const pagado = (hon.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                    const base = hon.montoBase || hon.base || 0;
                    if (base) {
                        ctx += `HONORARIOS: Base $${base.toLocaleString('es-CL')} | Pagado $${pagado.toLocaleString('es-CL')} | Pendiente $${(base - pagado).toLocaleString('es-CL')}\n\n`;
                    }

                    // Jurisprudencia asociada
                    const jurisIds = causa.jurisprudenciaAsociada || [];
                    if (jurisIds.length) {
                        ctx += 'JURISPRUDENCIA ASOCIADA:\n';
                        jurisIds.slice(0, 3).forEach(jid => {
                            const j = DB.jurisprudencia.find(x => x.id === jid);
                            if (j) ctx += `  ROL ${j.rol || 'N/A'} (${j.tendencia}): ${(j.temaCentral || j.ext || '').substring(0, 100)}\n`;
                        });
                        ctx += '\n';
                    }

                    // Cliente
                    const cl = DB.clientes.find(c => c.id === causa.clienteId);
                    if (cl) ctx += `CLIENTE: ${cl.nombre || cl.nom} | RUT: ${cl.rut || 'N/A'}\n\n`;
                }
            } else {
                // Modo general: listar causas activas
                ctx += 'CAUSAS ACTIVAS:\n';
                DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').slice(0, 8).forEach(c => {
                    ctx += `  [${c.id}] ${c.caratula} — ${c.tipoProcedimiento} · ${c.porcentajeAvance || 0}% avance\n`;
                });
            }

            return ctx;
        }

        /**
         * Versión mejorada de lexbotRun() que usa lexbotBuildContext().
         * Sobrescribe la función original del módulo 10.
         */
        async function lexbotRun() {
            const input = document.getElementById('lexbot-input');
            const history = document.getElementById('lexbot-chat-history');
            const q = input.value.trim();
            if (!q) return;

            input.value = '';
            input.style.height = 'auto';
            history.innerHTML += `<div class="lexbot-message user">${escHtml(q)}</div>`;
            history.scrollTop = history.scrollHeight;

            const botId = 'bot-' + Date.now();
            history.innerHTML += `<div id="${botId}" class="lexbot-message bot"><i class="fas fa-spinner fa-spin"></i> Analizando…</div>`;
            history.scrollTop = history.scrollHeight;

            try {
                const context = lexbotBuildContext();
                const causaCtxNote = _lexbotCausaId
                    ? 'IMPORTANTE: El abogado está trabajando en la causa indicada en el contexto. Enfoca tu respuesta en esa causa específicamente.'
                    : 'Responde sobre el estado general del despacho o la causa que el abogado mencione.';

                const systemPrompt = `Eres "LexBot", el asistente legal IA de AppBogado, especializado en derecho chileno.
Ayuda con plazos procesales, estrategia, análisis de riesgo, y preguntas sobre causas.
Responde de forma ejecutiva, clara y con referencias legales cuando sea pertinente.
${causaCtxNote}

${context}`;

                const resp = await iaCall(`${systemPrompt}\n\nPREGUNTA: ${q}\n\nRespuesta profesional:`);
                const htmlResp = resp
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br>');

                document.getElementById(botId).innerHTML = htmlResp;
                history.scrollTop = history.scrollHeight;
                registrarEvento(`LexBot: ${q.substring(0, 40)}`);

            } catch (e) {
                document.getElementById(botId).innerHTML =
                    `<span style="color:var(--danger)"><i class="fas fa-exclamation-triangle"></i> Error: ${e.message}</span>`;
            }
        }

        // Patch HTML del LexBot para agregar badge de contexto y botón de limpiar
        (function _patchLexBotHTML() {
            document.addEventListener('DOMContentLoaded', () => {
                const header = document.getElementById('lexbot-header');
                if (!header || document.getElementById('lexbot-ctx-badge')) return;

                // Agregar subtítulo identificable
                const subEl = header.querySelector('div > div:last-child');
                if (subEl) subEl.id = 'lexbot-sub';

                // Badge de contexto (inicialmente oculto)
                const badge = document.createElement('div');
                badge.id = 'lexbot-ctx-badge';
                badge.style.cssText = 'display:none;font-size:10px;background:rgba(255,255,255,0.15);border-radius:20px;padding:2px 8px;margin-top:3px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                if (subEl) subEl.parentNode.appendChild(badge);

                // Botón limpiar contexto en el footer
                const footer = document.getElementById('lexbot-footer');
                if (footer) {
                    const btnLimpiar = document.createElement('button');
                    btnLimpiar.id = 'lexbot-btn-limpiar-ctx';
                    btnLimpiar.innerHTML = '<i class="fas fa-unlink"></i> Quitar causa';
                    btnLimpiar.style.cssText = 'background:rgba(255,255,255,0.1);border:none;color:rgba(255,255,255,0.7);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;margin-left:8px;display:none;';
                    btnLimpiar.onclick = lexbotLimpiarContexto;
                    footer.appendChild(btnLimpiar);
                }
            });

            // Observer para mostrar/ocultar btn-limpiar cuando cambia _lexbotCausaId
            setInterval(() => {
                const btn = document.getElementById('lexbot-btn-limpiar-ctx');
                if (btn) btn.style.display = _lexbotCausaId ? 'inline-block' : 'none';
            }, 1000);
        })();

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 2 — PLANTILLAS DE ESCRITOS PERSONALIZABLES CON VARIABLES
        // ═══════════════════════════════════════════════════════════════════

        // Inicializar colección
        (function _initPlantillasEscritos() {
            if (!DB.plantillasTexto) DB.plantillasTexto = [];
        })();

        /**
         * Variables disponibles en plantillas de texto.
         * Clave: nombre de la variable (como aparece entre {{ }}).
         * Valor: función que extrae el dato de la causa y el cliente.
         * @type {Object.<string, function(causa:object, cliente:object): string>}
         */
        const VARIABLES_PLANTILLA = {
            'cliente':        (c, cl) => cl?.nombre || cl?.nom || '[CLIENTE]',
            'rut_cliente':    (c, cl) => cl?.rut || '[RUT_CLIENTE]',
            'causa':          (c)     => c?.caratula || '[CAUSA]',
            'rit':            (c)     => c?.rit || c?.rut || '[RIT]',
            'tribunal':       (c)     => c?.juzgado || '[TRIBUNAL]',
            'procedimiento':  (c)     => c?.tipoProcedimiento || '[PROCEDIMIENTO]',
            'rama':           (c)     => c?.rama || '[RAMA]',
            'etapa_actual':   (c)     => c?.etapasProcesales?.find(e => !e.completada)?.nombre || '[ETAPA]',
            'fecha_hoy':      ()      => new Date().toLocaleDateString('es-CL'),
            'fecha_hoy_larga':()      => new Date().toLocaleDateString('es-CL', {weekday:'long',day:'numeric',month:'long',year:'numeric'}),
            'año':            ()      => String(new Date().getFullYear()),
            'despacho':       ()      => DB.configuracion?.nombreDespacho || '[NOMBRE DESPACHO]',
            'abogado':        ()      => DB.configuracion?.abogado || DB.usuarioActual || '[ABOGADO]',
        };

        /**
         * Reemplaza todas las variables {{nombre}} en un texto con valores reales.
         * Variables no reconocidas se mantienen sin cambio.
         * @param {string} texto
         * @param {string|null} causaId
         * @returns {{ texto: string, reemplazos: Array<{variable:string, valor:string}> }}
         */
        function plantillaTextoAplicarVariables(texto, causaId) {
            if (!texto) return { texto: '', reemplazos: [] };
            const causa = causaId ? DB.causas.find(c => c.id === causaId) : null;
            const cliente = causa ? DB.clientes.find(c => c.id === causa.clienteId) : null;
            const reemplazos = [];

            const resultado = texto.replace(/\{\{([a-z_]+)\}\}/gi, (match, varName) => {
                const fn = VARIABLES_PLANTILLA[varName.toLowerCase()];
                if (!fn) return match;
                const valor = fn(causa, cliente);
                if (valor && valor !== match) reemplazos.push({ variable: varName, valor });
                return valor || match;
            });

            return { texto: resultado, reemplazos };
        }

        // ── Estado del CRUD
        let _ptEditing = null; // ID de plantilla en edición, null = nueva

        /** Abre el modal de nueva plantilla de texto. */
        function ptNueva() {
            _ptEditing = null;
            _ptLimpiarForm();
            document.getElementById('pt-modal-titulo').textContent = 'Nueva Plantilla de Texto';
            abrirModal('modal-plantilla-texto');
        }

        /** Abre el modal de edición de una plantilla existente. */
        function ptEditar(id) {
            const p = DB.plantillasTexto.find(x => x.id === id);
            if (!p) return;
            _ptEditing = id;
            document.getElementById('pt-modal-titulo').textContent = 'Editar Plantilla';
            document.getElementById('pt-nombre').value        = p.nombre        || '';
            document.getElementById('pt-categoria').value     = p.categoria     || 'general';
            document.getElementById('pt-descripcion').value   = p.descripcion   || '';
            document.getElementById('pt-cuerpo').value        = p.cuerpo        || '';
            abrirModal('modal-plantilla-texto');
        }

        function _ptLimpiarForm() {
            ['pt-nombre', 'pt-descripcion', 'pt-cuerpo'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            const cat = document.getElementById('pt-categoria');
            if (cat) cat.value = 'general';
            const prev = document.getElementById('pt-preview-resultado');
            if (prev) prev.textContent = '';
        }

        /** Guarda (crea o actualiza) una plantilla de texto. */
        function ptGuardar() {
            const nombre      = (document.getElementById('pt-nombre')?.value      || '').trim();
            const categoria   =  document.getElementById('pt-categoria')?.value   || 'general';
            const descripcion = (document.getElementById('pt-descripcion')?.value || '').trim();
            const cuerpo      = (document.getElementById('pt-cuerpo')?.value      || '').trim();

            if (!nombre) { showError('El nombre de la plantilla es obligatorio.'); return; }
            if (!cuerpo) { showError('El cuerpo de la plantilla no puede estar vacío.'); return; }

            if (_ptEditing) {
                const p = DB.plantillasTexto.find(x => x.id === _ptEditing);
                if (p) {
                    Object.assign(p, { nombre, categoria, descripcion, cuerpo, fechaModificacion: new Date().toISOString() });
                    showSuccess(`Plantilla "${nombre}" actualizada.`);
                }
            } else {
                DB.plantillasTexto.push({
                    id: uid(), nombre, categoria, descripcion, cuerpo,
                    autor: DB.usuarioActual || 'admin',
                    fechaCreacion: new Date().toISOString(),
                    fechaModificacion: new Date().toISOString(),
                    usosCount: 0
                });
                showSuccess(`Plantilla "${nombre}" creada.`);
            }

            if (typeof markAppDirty === "function") markAppDirty(); save();
            cerrarModal('modal-plantilla-texto');
            ptRender();
        }

        /** Elimina una plantilla con confirmación. */
        function ptEliminar(id) {
            const p = DB.plantillasTexto.find(x => x.id === id);
            if (!p) return;
            showConfirm('Eliminar Plantilla', `¿Eliminar "${p.nombre}"?`, () => {
                DB.plantillasTexto = DB.plantillasTexto.filter(x => x.id !== id);
                if (typeof markAppDirty === "function") markAppDirty(); save();
                ptRender();
                showSuccess('Plantilla eliminada.');
            }, 'danger');
        }

        /**
         * Carga una plantilla en el generador de escritos, aplicando variables de la causa seleccionada.
         * @param {string} id - ID de la plantilla
         */
        function ptUsarEnEscritos(id) {
            const p = DB.plantillasTexto.find(x => x.id === id);
            if (!p) return;

            const causaId = document.getElementById('esc-causa-sel')?.value;
            const { texto, reemplazos } = plantillaTextoAplicarVariables(p.cuerpo, causaId || null);

            const hechosEl = document.getElementById('esc-hechos');
            if (hechosEl) hechosEl.value = texto;

            p.usosCount = (p.usosCount || 0) + 1;
            if (typeof markAppDirty === "function") markAppDirty(); save();

            // Si hay causa seleccionada, navegar al tab
            tab('escritos');
            const msg = reemplazos.length
                ? `Plantilla cargada. ${reemplazos.length} variable(s) reemplazada(s): ${reemplazos.map(r => '{{' + r.variable + '}}').join(', ')}`
                : 'Plantilla cargada. Seleccione una causa para reemplazar las variables.';
            showInfo(msg);
        }

        /** Previsualiza la plantilla con variables de la causa seleccionada en el modal. */
        function ptPrevisualizar() {
            const cuerpo = document.getElementById('pt-cuerpo')?.value || '';
            const causaId = document.getElementById('pt-preview-causa')?.value || null;
            const { texto } = plantillaTextoAplicarVariables(cuerpo, causaId);
            const prev = document.getElementById('pt-preview-resultado');
            if (prev) prev.textContent = texto;
        }

        /** Renderiza la lista de plantillas de texto en el modal/panel. */
        function ptRender() {
            const cont = document.getElementById('pt-lista');
            if (!cont) return;
            const lista = DB.plantillasTexto;

            if (!lista.length) {
                cont.innerHTML = '';
                return;
            }

            const catBadge = {
                general:    'badge',
                demanda:    'badge badge-cyan',
                recurso:    'badge badge-red',
                notificacion:'badge badge-purple',
                contrato:   'badge badge-green',
            };

            cont.innerHTML = lista.map(p => `
                <div class="pt-card">
                    <div class="pt-card-header">
                        <div>
                            <div class="pt-nombre">${escHtml(p.nombre)}</div>
                            <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
                                <span class="${catBadge[p.categoria] || 'badge'}">${p.categoria}</span>
                                <span style="font-size:11px;color:var(--text-3);">Usado ${p.usosCount || 0}x</span>
                            </div>
                        </div>
                        <div class="pt-card-actions">
                            <button class="btn btn-xs btn-p" onclick="ptUsarEnEscritos('${p.id}')" title="Usar en escritos">
                                <i class="fas fa-pen-nib"></i> Usar
                            </button>
                            <button class="btn btn-xs" onclick="ptEditar('${p.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-danger-outline" onclick="ptEliminar('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${p.descripcion ? `<div class="pt-desc">${escHtml(p.descripcion)}</div>` : ''}
                    <div class="pt-preview-cuerpo">${escHtml(p.cuerpo.substring(0, 150))}${p.cuerpo.length > 150 ? '…' : ''}</div>
                </div>`).join('');
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 3 — EXPORTACIÓN EXCEL / CSV DE CARTERA
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Genera y descarga un archivo CSV con toda la cartera de causas.
         * Incluye: carátula, cliente, RUT, estado, instancia, rama, procedimiento,
         * honorarios base, pagado, pendiente, avance, fechas, alertas activas.
         */
        function exportarCarteraCSV() {
            const cols = [
                'ID', 'Carátula', 'Cliente', 'RUT Cliente', 'Procedimiento', 'Rama',
                'Estado', 'Instancia', 'Avance %', 'Etapa Actual',
                'Honorarios Base', 'Pagado', 'Pendiente', '% Cobro',
                'Alertas Activas', 'Fecha Creación', 'Última Actividad', 'Horas Registradas'
            ];

            const rows = DB.causas.map(c => {
                const cl = DB.clientes.find(x => x.id === c.clienteId);
                const hon = c.honorarios || {};
                const base = hon.montoBase || hon.base || 0;
                const pagado = (hon.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                const pendiente = base - pagado;
                const pctCobro = base > 0 ? Math.round((pagado / base) * 100) : 0;
                const alertas = DB.alertas.filter(a => a.causaId === c.id && a.estado === 'activa').length;
                const etapa = c.etapasProcesales?.find(e => !e.completada)?.nombre || 'Concluida';
                const horasTotal = _tiempoTotalHoras(c.id);

                return [
                    c.id,
                    c.caratula,
                    cl?.nombre || cl?.nom || '—',
                    cl?.rut || c.rut || '—',
                    c.tipoProcedimiento || '—',
                    c.rama || '—',
                    c.estadoGeneral || '—',
                    c.instancia || 'Primera',
                    c.porcentajeAvance || 0,
                    etapa,
                    base,
                    pagado,
                    pendiente,
                    pctCobro,
                    alertas,
                    c.fechaCreacion ? new Date(c.fechaCreacion).toLocaleDateString('es-CL') : '—',
                    c.fechaUltimaActividad ? new Date(c.fechaUltimaActividad).toLocaleDateString('es-CL') : '—',
                    horasTotal.toFixed(2)
                ].map(v => {
                    const s = String(v);
                    // Escapar comillas y envolver en comillas si contiene coma/salto
                    return s.includes(',') || s.includes('"') || s.includes('\n')
                        ? `"${s.replace(/"/g, '""')}"`
                        : s;
                });
            });

            // Fila de totales
            const totalBase = DB.causas.reduce((s, c) => s + (c.honorarios?.montoBase || c.honorarios?.base || 0), 0);
            const totalPagado = DB.causas.reduce((s, c) => s + (c.honorarios?.pagos || []).reduce((a, p) => a + (p.monto || 0), 0), 0);
            const totalPendiente = totalBase - totalPagado;
            rows.push([
                'TOTAL', '', '', '', '', '', '', '', '', '',
                totalBase, totalPagado, totalPendiente,
                totalBase > 0 ? Math.round((totalPagado / totalBase) * 100) : 0,
                DB.alertas.filter(a => a.estado === 'activa').length,
                '', '', ''
            ].map(v => String(v)));

            const bom = '\uFEFF'; // UTF-8 BOM para Excel
            const csv = bom + [cols, ...rows].map(r => r.join(',')).join('\n');
            _descargarTexto(csv, `cartera-causas-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');

            showSuccess(`✓ Cartera exportada: ${DB.causas.length} causas.`);
            registrarEvento(`Exportación CSV cartera: ${DB.causas.length} causas`);
        }

        /**
         * Genera y descarga un archivo HTML que Excel puede abrir como hoja de cálculo.
         * Más visual que el CSV, con colores por estado y formateo de moneda.
         */
        function exportarCarteraExcel() {
            const fmtCLP = n => `$${Math.round(n).toLocaleString('es-CL')}`;
            const estadoColor = { 'En tramitación': '#dbeafe', 'Finalizada': '#dcfce7', 'Suspendida': '#fef9c3' };

            const filas = DB.causas.map(c => {
                const cl = DB.clientes.find(x => x.id === c.clienteId);
                const hon = c.honorarios || {};
                const base = hon.montoBase || hon.base || 0;
                const pagado = (hon.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                const pendiente = base - pagado;
                const alertas = DB.alertas.filter(a => a.causaId === c.id && a.estado === 'activa').length;
                const etapa = c.etapasProcesales?.find(e => !e.completada)?.nombre || 'Concluida';
                const bg = estadoColor[c.estadoGeneral] || '#fff';
                const horasTotal = _tiempoTotalHoras(c.id).toFixed(2);

                return `<tr style="background:${bg}">
                    <td>${escHtml(c.caratula)}</td>
                    <td>${escHtml(cl?.nombre || cl?.nom || '—')}</td>
                    <td>${escHtml(cl?.rut || c.rut || '—')}</td>
                    <td>${escHtml(c.tipoProcedimiento || '—')}</td>
                    <td>${escHtml(c.rama || '—')}</td>
                    <td style="font-weight:600;">${escHtml(c.estadoGeneral || '—')}</td>
                    <td>${c.porcentajeAvance || 0}%</td>
                    <td>${escHtml(etapa)}</td>
                    <td style="color:#1a3a6b;font-family:monospace;">${base ? fmtCLP(base) : '—'}</td>
                    <td style="color:#0d7a5f;font-family:monospace;">${pagado ? fmtCLP(pagado) : '—'}</td>
                    <td style="color:${pendiente > 0 ? '#c0392b' : '#0d7a5f'};font-family:monospace;">${base ? fmtCLP(pendiente) : '—'}</td>
                    <td style="text-align:center;">${alertas > 0 ? `<span style="color:#c0392b;font-weight:700;">${alertas}</span>` : '0'}</td>
                    <td style="font-family:monospace;">${horasTotal}h</td>
                    <td style="font-size:11px;">${c.fechaCreacion ? new Date(c.fechaCreacion).toLocaleDateString('es-CL') : '—'}</td>
                </tr>`;
            }).join('');

            const totalBase = DB.causas.reduce((s, c) => s + (c.honorarios?.montoBase || c.honorarios?.base || 0), 0);
            const totalPagado = DB.causas.reduce((s, c) => s + (c.honorarios?.pagos || []).reduce((a, p) => a + (p.monto || 0), 0), 0);

            const html = `<!DOCTYPE html>
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="UTF-8">
<title>Cartera de Causas — AppBogado</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;font-size:12px;}
  h1{font-size:16px;color:#1a3a6b;border-bottom:2px solid #1a3a6b;padding-bottom:6px;}
  .meta{font-size:11px;color:#64748b;margin-bottom:16px;}
  table{border-collapse:collapse;width:100%;}
  th{background:#1a3a6b;color:#fff;padding:8px 10px;text-align:left;font-size:11px;white-space:nowrap;}
  td{padding:7px 10px;border:1px solid #e2e8f0;vertical-align:middle;}
  tr:hover td{background:rgba(0,0,0,0.03)!important;}
  .total-row td{background:#f0f4f8;font-weight:700;border-top:2px solid #1a3a6b;}
  .footer{margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;}
</style>
</head>
<body>
<h1>📊 Cartera de Causas</h1>
<div class="meta">
  Generado: ${new Date().toLocaleDateString('es-CL', {weekday:'long',day:'numeric',month:'long',year:'numeric'})} ·
  Total causas: <strong>${DB.causas.length}</strong> ·
  Despacho: <strong>${DB.configuracion?.nombreDespacho || 'AppBogado'}</strong>
</div>
<table>
  <thead>
    <tr>
      <th>Carátula</th><th>Cliente</th><th>RUT</th><th>Procedimiento</th><th>Rama</th>
      <th>Estado</th><th>Avance</th><th>Etapa Actual</th>
      <th>Hon. Base</th><th>Pagado</th><th>Pendiente</th>
      <th>Alertas</th><th>Horas</th><th>Creación</th>
    </tr>
  </thead>
  <tbody>
    ${filas}
    <tr class="total-row">
      <td colspan="8">TOTALES (${DB.causas.length} causas)</td>
      <td style="font-family:monospace;">${fmtCLP(totalBase)}</td>
      <td style="font-family:monospace;color:#0d7a5f;">${fmtCLP(totalPagado)}</td>
      <td style="font-family:monospace;color:#c0392b;">${fmtCLP(totalBase - totalPagado)}</td>
      <td colspan="3"></td>
    </tr>
  </tbody>
</table>
<div class="footer">AppBogado · Gestión Jurídica Profesional · Datos exportados de localStorage · Confidencial</div>
</body></html>`;

            _descargarTexto(html, `cartera-causas-${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
            showSuccess(`✓ Exportación Excel lista: ${DB.causas.length} causas.`);
            registrarEvento(`Exportación Excel cartera`);
        }

        /** Helper: descarga texto como archivo. @private */
        function _descargarTexto(contenido, nombre, tipo) {
            const bom = tipo.includes('csv') ? '\uFEFF' : '';
            const blob = new Blob([bom + contenido], { type: tipo });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nombre;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 4 — INFORME DE CAUSA MEJORADO (PDF CON PORTADA E ÍNDICE)
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Genera un informe HTML completo de una causa con:
         * portada, índice, sección económica visual, timeline de etapas y firma configurable.
         * Se abre en nueva ventana para imprimir como PDF (Ctrl+P → Guardar como PDF).
         * @param {string} causaId
         */
        function exportarInformeMejorado(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) { showError('Causa no encontrada.'); return; }

            const cl = DB.clientes.find(x => x.id === causa.clienteId);
            const hon = causa.honorarios || {};
            const base = hon.montoBase || hon.base || 0;
            const pagado = (hon.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
            const pendiente = base - pagado;
            const pctCobro = base > 0 ? Math.round((pagado / base) * 100) : 0;
            const f = causa.estrategia?.ficha || {};
            const r = causa.riesgo || {};
            const docs = DB.documentos.filter(d => d.causaId === causaId);
            const alertas = DB.alertas.filter(a => a.causaId === causaId);
            const etapas = causa.etapasProcesales || [];
            const config = DB.configuracion || {};
            const horasTotal = _tiempoTotalHoras(causaId);
            const registros = (DB.timesheet || []).filter(t => t.causaId === causaId);

            const fmtCLP = n => `$${Math.round(n).toLocaleString('es-CL')}`;
            const hoy = new Date().toLocaleDateString('es-CL', {day:'numeric',month:'long',year:'numeric'});

            // Riesgo colors
            const rColor = v => v === 'Alto' ? '#c0392b' : v === 'Medio' ? '#b45309' : '#0d7a5f';

            // Etapas timeline HTML
            const etapaHTML = etapas.map((e, i) => `
                <div class="etapa-row ${e.completada ? 'done' : i === etapas.findIndex(x => !x.completada) ? 'current' : 'pending'}">
                    <div class="etapa-dot">${e.completada ? '✓' : i === etapas.findIndex(x => !x.completada) ? '◉' : '○'}</div>
                    <div class="etapa-nombre">${e.nombre}</div>
                    <div class="etapa-fecha">${e.fecha ? new Date(e.fecha).toLocaleDateString('es-CL') : '—'}</div>
                </div>`).join('');

            // Honorarios barra visual
            const barPct = Math.min(100, pctCobro);
            const barColor = barPct >= 80 ? '#0d7a5f' : barPct >= 40 ? '#f59e0b' : '#c0392b';

            const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe — ${causa.caratula}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'IBM Plex Sans',Georgia,serif;color:#1a1a2e;font-size:12.5px;line-height:1.7;background:#fff;}

  /* ── PORTADA ── */
  .portada{
    width:100%;min-height:100vh;padding:60px 56px;
    background:linear-gradient(145deg,#0c1e47 0%,#1a3a6b 60%,#0d5e8a 100%);
    color:#fff;display:flex;flex-direction:column;justify-content:space-between;
    page-break-after:always;
  }
  .portada-logo{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.7;margin-bottom:60px;}
  .portada-despacho{font-size:22px;font-weight:700;margin-bottom:6px;}
  .portada-tagline{font-size:12px;opacity:.65;margin-bottom:60px;}
  .portada-tipo{font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.6;margin-bottom:12px;font-family:'IBM Plex Mono',monospace;}
  .portada-titulo{font-size:32px;font-weight:700;line-height:1.2;margin-bottom:24px;}
  .portada-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 32px;border-top:1px solid rgba(255,255,255,.2);padding-top:24px;margin-top:24px;}
  .portada-meta-item{font-size:11px;}
  .portada-meta-label{opacity:.55;font-family:'IBM Plex Mono',monospace;margin-bottom:2px;text-transform:uppercase;font-size:10px;letter-spacing:.07em;}
  .portada-meta-val{font-weight:600;font-size:13px;}
  .portada-fecha{font-size:11px;opacity:.5;font-family:'IBM Plex Mono',monospace;}

  /* ── CUERPO ── */
  .cuerpo{max-width:800px;margin:0 auto;padding:48px 40px;}

  /* ÍNDICE */
  .indice{margin-bottom:48px;page-break-after:always;}
  .indice h2{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#1a3a6b;border-bottom:2px solid #1a3a6b;padding-bottom:6px;margin-bottom:16px;}
  .indice-item{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px dotted #e2e8f0;}
  .indice-num{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#64748b;min-width:24px;}
  .indice-titulo{flex:1;padding:0 12px;font-size:13px;}
  .indice-pag{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#94a3b8;}

  /* SECCIONES */
  .seccion{margin-bottom:40px;}
  .sec-titulo{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#1a3a6b;
    border-left:4px solid #1a3a6b;padding-left:12px;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}
  th{background:#f0f4f8;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#334155;padding:8px 10px;text-align:left;}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;}
  td:first-child{color:#64748b;font-size:11px;white-space:nowrap;}
  td:last-child{font-weight:600;}
  .rojo{color:#c0392b;} .verde{color:#0d7a5f;} .ambar{color:#b45309;}

  /* BARRA HONORARIOS */
  .hon-barra-wrap{background:#f1f5f9;border-radius:6px;height:10px;margin:8px 0 4px;overflow:hidden;}
  .hon-barra-fill{height:100%;border-radius:6px;background:${barColor};transition:width .4s;}
  .hon-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px;}
  .hon-num-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;}
  .hon-num-val{font-size:18px;font-weight:800;font-family:'IBM Plex Mono',monospace;}
  .hon-num-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:2px;}

  /* RIESGO BARRAS */
  .riesgo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .riesgo-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}
  .riesgo-label{font-size:11px;color:#64748b;text-transform:capitalize;margin-bottom:4px;}
  .riesgo-val{font-size:15px;font-weight:700;}

  /* ETAPAS TIMELINE */
  .etapa-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
  .etapa-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
  .etapa-row.done .etapa-dot{background:#dcfce7;color:#0d7a5f;}
  .etapa-row.current .etapa-dot{background:#1a3a6b;color:#fff;}
  .etapa-row.pending .etapa-dot{background:#f1f5f9;color:#94a3b8;}
  .etapa-nombre{flex:1;}
  .etapa-row.done .etapa-nombre{color:#64748b;}
  .etapa-row.current .etapa-nombre{font-weight:700;color:#1a3a6b;}
  .etapa-row.pending .etapa-nombre{color:#94a3b8;}
  .etapa-fecha{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#94a3b8;}

  /* TIEMPO */
  .tiempo-resumen{display:flex;gap:16px;margin-bottom:14px;}
  .tiempo-kpi{background:#f0f4f8;border-radius:8px;padding:12px 20px;text-align:center;}
  .tiempo-kpi-val{font-size:22px;font-weight:800;color:#1a3a6b;font-family:'IBM Plex Mono',monospace;}
  .tiempo-kpi-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;}

  /* FIRMA */
  .firma-bloque{margin-top:60px;border-top:1px solid #e2e8f0;padding-top:30px;display:flex;justify-content:flex-end;}
  .firma-box{text-align:center;min-width:220px;}
  .firma-linea{height:1px;background:#1a3a6b;margin-bottom:8px;}
  .firma-nombre{font-weight:700;font-size:14px;}
  .firma-cargo{font-size:11px;color:#64748b;}
  .firma-rut{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#94a3b8;}

  /* FOOTER */
  .footer-doc{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}

  @media print{
    .portada{min-height:100vh;}
    .indice{page-break-after:always;}
    .seccion{page-break-inside:avoid;}
  }
</style>
</head>
<body>

<!-- ══ PORTADA ══ -->
<div class="portada">
  <div>
    <div class="portada-logo">⚖ AppBogado · Gestión Jurídica</div>
    <div class="portada-despacho">${escHtml(config.nombreDespacho || 'Despacho Jurídico')}</div>
    <div class="portada-tagline">${escHtml(config.tagline || 'Gestión Jurídica Profesional')}</div>
  </div>
  <div>
    <div class="portada-tipo">Informe de Causa</div>
    <div class="portada-titulo">${escHtml(causa.caratula)}</div>
    <div class="portada-meta">
      <div class="portada-meta-item">
        <div class="portada-meta-label">Procedimiento</div>
        <div class="portada-meta-val">${escHtml(causa.tipoProcedimiento || '—')}</div>
      </div>
      <div class="portada-meta-item">
        <div class="portada-meta-label">Rama</div>
        <div class="portada-meta-val">${escHtml(causa.rama || '—')}</div>
      </div>
      <div class="portada-meta-item">
        <div class="portada-meta-label">Estado</div>
        <div class="portada-meta-val">${escHtml(causa.estadoGeneral || '—')}</div>
      </div>
      <div class="portada-meta-item">
        <div class="portada-meta-label">Avance</div>
        <div class="portada-meta-val">${causa.porcentajeAvance || 0}% completado</div>
      </div>
      <div class="portada-meta-item">
        <div class="portada-meta-label">Cliente</div>
        <div class="portada-meta-val">${escHtml(cl?.nombre || cl?.nom || '—')}</div>
      </div>
      <div class="portada-meta-item">
        <div class="portada-meta-label">Abogado</div>
        <div class="portada-meta-val">${escHtml(config.abogado || DB.usuarioActual || '—')}</div>
      </div>
    </div>
  </div>
  <div class="portada-fecha">Generado el ${hoy} · Confidencial</div>
</div>

<!-- ══ CUERPO ══ -->
<div class="cuerpo">

  <!-- ÍNDICE -->
  <div class="indice">
    <h2>Índice</h2>
    <div class="indice-item"><span class="indice-num">I.</span><span class="indice-titulo">Antecedentes Generales</span><span class="indice-pag">3</span></div>
    <div class="indice-item"><span class="indice-num">II.</span><span class="indice-titulo">Etapas Procesales</span><span class="indice-pag">3</span></div>
    ${Object.keys(r).length ? `<div class="indice-item"><span class="indice-num">III.</span><span class="indice-titulo">Evaluación de Riesgo</span><span class="indice-pag">4</span></div>` : ''}
    ${f.hechos ? `<div class="indice-item"><span class="indice-num">IV.</span><span class="indice-titulo">Teoría del Caso</span><span class="indice-pag">4</span></div>` : ''}
    ${base ? `<div class="indice-item"><span class="indice-num">V.</span><span class="indice-titulo">Situación Económica</span><span class="indice-pag">5</span></div>` : ''}
    ${horasTotal > 0 ? `<div class="indice-item"><span class="indice-num">VI.</span><span class="indice-titulo">Registro de Tiempo</span><span class="indice-pag">5</span></div>` : ''}
    ${docs.length ? `<div class="indice-item"><span class="indice-num">VII.</span><span class="indice-titulo">Documentos</span><span class="indice-pag">6</span></div>` : ''}
    ${alertas.length ? `<div class="indice-item"><span class="indice-num">VIII.</span><span class="indice-titulo">Alertas y Plazos</span><span class="indice-pag">6</span></div>` : ''}
  </div>

  <!-- I. ANTECEDENTES -->
  <div class="seccion">
    <div class="sec-titulo">I. Antecedentes Generales</div>
    <table>
      <tr><td>Carátula</td><td>${escHtml(causa.caratula)}</td></tr>
      <tr><td>Procedimiento</td><td>${escHtml(causa.tipoProcedimiento || '—')}</td></tr>
      <tr><td>Rama del Derecho</td><td>${escHtml(causa.rama || '—')}</td></tr>
      <tr><td>Tribunal</td><td>${escHtml(causa.juzgado || '—')}</td></tr>
      <tr><td>RIT / RUC</td><td style="font-family:'IBM Plex Mono',monospace;">${escHtml(causa.rit || causa.rut || '—')}</td></tr>
      <tr><td>Estado</td><td class="${causa.estadoGeneral === 'Finalizada' ? 'verde' : causa.estadoGeneral === 'Suspendida' ? 'ambar' : ''}">${escHtml(causa.estadoGeneral || '—')}</td></tr>
      <tr><td>Instancia</td><td>${escHtml(causa.instancia || 'Primera')}</td></tr>
      <tr><td>Avance</td><td>${causa.porcentajeAvance || 0}%</td></tr>
      <tr><td>Cliente</td><td>${escHtml(cl?.nombre || cl?.nom || '—')}</td></tr>
      ${cl?.rut ? `<tr><td>RUT Cliente</td><td style="font-family:'IBM Plex Mono',monospace;">${escHtml(cl.rut)}</td></tr>` : ''}
      <tr><td>Fecha de Creación</td><td>${causa.fechaCreacion ? new Date(causa.fechaCreacion).toLocaleDateString('es-CL') : '—'}</td></tr>
    </table>
  </div>

  <!-- II. ETAPAS PROCESALES -->
  <div class="seccion">
    <div class="sec-titulo">II. Etapas Procesales (${etapas.filter(e=>e.completada).length}/${etapas.length} completadas)</div>
    ${etapaHTML}
  </div>

  <!-- III. EVALUACIÓN DE RIESGO -->
  ${Object.keys(r).length ? `
  <div class="seccion">
    <div class="sec-titulo">III. Evaluación de Riesgo</div>
    <div class="riesgo-grid">
      ${Object.entries(r).map(([k, v]) => `
      <div class="riesgo-item">
        <div class="riesgo-label">${k}</div>
        <div class="riesgo-val" style="color:${rColor(v)};">${v}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- IV. TEORÍA DEL CASO -->
  ${f.hechos ? `
  <div class="seccion">
    <div class="sec-titulo">IV. Teoría del Caso</div>
    <table>
      ${f.hechos ? `<tr><td>Hechos</td><td>${escHtml(f.hechos)}</td></tr>` : ''}
      ${f.derecho ? `<tr><td>Derecho</td><td>${escHtml(f.derecho)}</td></tr>` : ''}
      ${f.evidencia ? `<tr><td>Evidencia Clave</td><td>${escHtml(f.evidencia)}</td></tr>` : ''}
      ${f.riesgos ? `<tr><td>Riesgos identificados</td><td>${escHtml(f.riesgos)}</td></tr>` : ''}
      ${f.probabilidadExito !== undefined ? `<tr><td>Probabilidad de Éxito</td><td class="${f.probabilidadExito>=60?'verde':f.probabilidadExito>=40?'ambar':'rojo'}">${f.probabilidadExito}%</td></tr>` : ''}
    </table>
  </div>` : ''}

  <!-- V. SITUACIÓN ECONÓMICA -->
  ${base ? `
  <div class="seccion">
    <div class="sec-titulo">V. Situación Económica</div>
    <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Porcentaje cobrado: <strong>${pctCobro}%</strong></p>
    <div class="hon-barra-wrap">
      <div class="hon-barra-fill" style="width:${barPct}%;"></div>
    </div>
    <div class="hon-nums">
      <div class="hon-num-item">
        <div class="hon-num-val">${fmtCLP(base)}</div>
        <div class="hon-num-lbl">Honorarios Base</div>
      </div>
      <div class="hon-num-item">
        <div class="hon-num-val verde">${fmtCLP(pagado)}</div>
        <div class="hon-num-lbl">Cobrado</div>
      </div>
      <div class="hon-num-item">
        <div class="hon-num-val ${pendiente > 0 ? 'rojo' : 'verde'}">${fmtCLP(pendiente)}</div>
        <div class="hon-num-lbl">Pendiente</div>
      </div>
    </div>
    ${(hon.pagos||[]).length ? `
    <table style="margin-top:16px;">
      <thead><tr><th>Fecha</th><th>Monto</th><th>Descripción</th><th>Estado</th></tr></thead>
      <tbody>
        ${(hon.pagos||[]).map(p => `<tr>
          <td>${p.fecha ? new Date(p.fecha).toLocaleDateString('es-CL') : '—'}</td>
          <td style="font-family:'IBM Plex Mono',monospace;color:#0d7a5f;">${fmtCLP(p.monto||0)}</td>
          <td>${escHtml(p.descripcion||'—')}</td>
          <td class="${p.estado==='pagado'?'verde':'ambar'}">${p.estado||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}
  </div>` : ''}

  <!-- VI. REGISTRO DE TIEMPO -->
  ${horasTotal > 0 ? `
  <div class="seccion">
    <div class="sec-titulo">VI. Registro de Tiempo</div>
    <div class="tiempo-resumen">
      <div class="tiempo-kpi">
        <div class="tiempo-kpi-val">${horasTotal.toFixed(1)}h</div>
        <div class="tiempo-kpi-lbl">Total invertido</div>
      </div>
      <div class="tiempo-kpi">
        <div class="tiempo-kpi-val">${registros.length}</div>
        <div class="tiempo-kpi-lbl">Sesiones</div>
      </div>
      ${base ? `<div class="tiempo-kpi">
        <div class="tiempo-kpi-val">${horasTotal > 0 ? fmtCLP(Math.round(base/horasTotal)) : '—'}</div>
        <div class="tiempo-kpi-lbl">$/hora implícito</div>
      </div>` : ''}
    </div>
    <table>
      <thead><tr><th>Fecha</th><th>Actividad</th><th>Horas</th></tr></thead>
      <tbody>
        ${registros.slice(-10).map(t => `<tr>
          <td>${new Date(t.fecha).toLocaleDateString('es-CL')}</td>
          <td>${escHtml(t.descripcion||'—')}</td>
          <td style="font-family:'IBM Plex Mono',monospace;">${t.horas.toFixed(2)}h</td>
        </tr>`).join('')}
        ${registros.length > 10 ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-size:11px;">+${registros.length-10} registros adicionales</td></tr>` : ''}
      </tbody>
    </table>
  </div>` : ''}

  <!-- VII. DOCUMENTOS -->
  ${docs.length ? `
  <div class="seccion">
    <div class="sec-titulo">VII. Documentos (${docs.length})</div>
    <table>
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th>Plazo</th></tr></thead>
      <tbody>
        ${docs.map(d => `<tr>
          <td>${escHtml(d.nombreOriginal||d.nombreSistema||'—')}</td>
          <td>${escHtml(d.tipo||'—')}</td>
          <td>${d.fechaDocumento||'—'}</td>
          <td>${d.fechaVencimiento ? `<span class="rojo">${d.fechaVencimiento}</span>` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- VIII. ALERTAS -->
  ${alertas.length ? `
  <div class="seccion">
    <div class="sec-titulo">VIII. Alertas y Plazos</div>
    <table>
      <thead><tr><th>Tipo</th><th>Mensaje</th><th>Vencimiento</th><th>Prioridad</th><th>Estado</th></tr></thead>
      <tbody>
        ${alertas.map(a => `<tr>
          <td>${escHtml(a.tipo||'—')}</td>
          <td>${escHtml(a.mensaje||'—')}</td>
          <td style="font-family:'IBM Plex Mono',monospace;">${a.fechaVencimiento ? new Date(a.fechaVencimiento).toLocaleDateString('es-CL') : '—'}</td>
          <td class="${a.prioridad==='critica'?'rojo':a.prioridad==='alta'?'ambar':'verde'}">${a.prioridad||'—'}</td>
          <td>${a.estado||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- FIRMA -->
  <div class="firma-bloque">
    <div class="firma-box">
      <div class="firma-linea"></div>
      <div class="firma-nombre">${escHtml(config.abogado || DB.usuarioActual || 'Abogado a Cargo')}</div>
      ${config.cargo ? `<div class="firma-cargo">${escHtml(config.cargo)}</div>` : ''}
      ${config.rut ? `<div class="firma-rut">RUT: ${escHtml(config.rut)}</div>` : ''}
      ${config.numeroRegistro ? `<div class="firma-rut">Registro: ${escHtml(config.numeroRegistro)}</div>` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer-doc">
    <span>${escHtml(config.nombreDespacho || 'AppBogado')} · Generado el ${hoy}</span>
    <span>CONFIDENCIAL · Solo para uso interno</span>
  </div>
</div>

<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
            } else {
                // Fallback: descargar como HTML
                _descargarTexto(html, `informe-${causaId}-${new Date().toISOString().split('T')[0]}.html`, 'text/html;charset=utf-8;');
            }
            registrarEvento(`Informe mejorado generado: ${causa.caratula}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 5 — REGISTRO DE TIEMPO POR CAUSA (TIMESHEETS)
        // ═══════════════════════════════════════════════════════════════════

        // Inicializar colección
        (function _initTimesheet() {
            if (!DB.timesheet) DB.timesheet = [];
        })();

        /** Cronómetro en curso. @type {{causaId:string|null, inicio:number|null, intervalo:number|null}} */
        const _cronometro = { causaId: null, inicio: null, intervalo: null };

        /**
         * Retorna el total de horas registradas para una causa.
         * @param {string} causaId
         * @returns {number} Horas (decimal)
         */
        function _tiempoTotalHoras(causaId) {
            return (DB.timesheet || [])
                .filter(t => t.causaId === causaId)
                .reduce((s, t) => s + (t.horas || 0), 0);
        }

        /**
         * Agrega un registro de tiempo manual o desde el cronómetro.
         * @param {string} causaId
         * @param {number} horas - Horas decimales
         * @param {string} descripcion
         * @param {string} [fecha] - ISO date string, default hoy
         */
        function tiempoAgregarRegistro(causaId, horas, descripcion, fecha) {
            if (!causaId || horas <= 0) { showError('Causa y horas son obligatorios.'); return; }
            DB.timesheet.push({
                id: uid(),
                causaId,
                horas,
                descripcion: descripcion || 'Trabajo en causa',
                fecha: fecha || new Date().toISOString(),
                tipo: 'manual',
                autor: DB.usuarioActual || 'admin'
            });
            if (typeof markAppDirty === "function") markAppDirty(); save();
        }

        /** Inicia el cronómetro para una causa. */
        function tiempoCronometroIniciar(causaId) {
            if (_cronometro.intervalo) {
                showError('Ya hay un cronómetro en curso. Detén el actual primero.');
                return;
            }
            _cronometro.causaId = causaId;
            _cronometro.inicio = Date.now();

            _cronometro.intervalo = setInterval(() => {
                const seg = Math.floor((Date.now() - _cronometro.inicio) / 1000);
                const h = Math.floor(seg / 3600).toString().padStart(2, '0');
                const m = Math.floor((seg % 3600) / 60).toString().padStart(2, '0');
                const s = (seg % 60).toString().padStart(2, '0');
                const display = document.getElementById('ts-cronometro-display');
                if (display) display.textContent = `${h}:${m}:${s}`;
            }, 1000);

            const btnIniciar = document.getElementById('ts-btn-iniciar');
            const btnDetener = document.getElementById('ts-btn-detener');
            if (btnIniciar) btnIniciar.disabled = true;
            if (btnDetener) btnDetener.disabled = false;

            showInfo('Cronómetro iniciado.');
        }

        /** Detiene el cronómetro y guarda el registro. */
        function tiempoCronometroDetener() {
            if (!_cronometro.inicio) return;
            clearInterval(_cronometro.intervalo);

            const ms = Date.now() - _cronometro.inicio;
            const horas = ms / 3600000;
            const descripcion = (document.getElementById('ts-descripcion')?.value || '').trim() || 'Trabajo en causa';

            tiempoAgregarRegistro(_cronometro.causaId, horas, descripcion);

            _cronometro.causaId = null;
            _cronometro.inicio = null;
            _cronometro.intervalo = null;

            const display = document.getElementById('ts-cronometro-display');
            if (display) display.textContent = '00:00:00';
            const btnIniciar = document.getElementById('ts-btn-iniciar');
            const btnDetener = document.getElementById('ts-btn-detener');
            if (btnIniciar) btnIniciar.disabled = false;
            if (btnDetener) btnDetener.disabled = true;

            tiempoRender();
            showSuccess(`✓ ${horas.toFixed(2)} horas registradas.`);
        }

        /** Elimina un registro de timesheet. */
        function tiempoEliminarRegistro(id) {
            DB.timesheet = (DB.timesheet || []).filter(t => t.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); save();
            tiempoRender();
        }

        /** Registra horas desde el formulario manual del modal. */
        function tiempoRegistrarManual() {
            const causaId = document.getElementById('ts-causa-sel')?.value;
            const horasStr = document.getElementById('ts-horas')?.value;
            const minStr = document.getElementById('ts-minutos')?.value || '0';
            const desc = (document.getElementById('ts-descripcion-manual')?.value || '').trim();
            const fecha = document.getElementById('ts-fecha')?.value;

            const horas = (parseFloat(horasStr) || 0) + (parseFloat(minStr) || 0) / 60;
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (horas <= 0) { showError('Ingrese horas o minutos válidos.'); return; }

            tiempoAgregarRegistro(causaId, horas, desc, fecha ? new Date(fecha).toISOString() : undefined);
            tiempoRender();
            showSuccess(`✓ ${horas.toFixed(2)}h registradas para la causa.`);

            // Limpiar formulario
            const el = document.getElementById('ts-horas'); if (el) el.value = '';
            const elm = document.getElementById('ts-minutos'); if (elm) elm.value = '';
            const eld = document.getElementById('ts-descripcion-manual'); if (eld) eld.value = '';
        }

        /**
         * Renderiza el panel de timesheet: resumen por causa + registros recientes.
         */
        function tiempoRender() {
            // Resumen por causa
            const resumenEl = document.getElementById('ts-resumen-causas');
            const registrosEl = document.getElementById('ts-registros-lista');

            if (resumenEl) {
                const causasSuma = {};
                (DB.timesheet || []).forEach(t => {
                    if (!causasSuma[t.causaId]) causasSuma[t.causaId] = 0;
                    causasSuma[t.causaId] += t.horas || 0;
                });

                const sorted = Object.entries(causasSuma).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const maxH = sorted.length ? sorted[0][1] : 1;

                if (!sorted.length) {
                    resumenEl.innerHTML = `<div class="ts-empty"><i class="fas fa-clock"></i><p>Sin registros de tiempo aún.</p></div>`;
                } else {
                    resumenEl.innerHTML = sorted.map(([cid, horas]) => {
                        const causa = DB.causas.find(c => c.id === cid);
                        const pct = (horas / maxH * 100).toFixed(0);
                        return `<div class="ts-barra-row">
                            <div class="ts-barra-label" title="${escHtml(causa?.caratula||cid)}">${escHtml((causa?.caratula||cid).substring(0,28))}</div>
                            <div class="ts-barra-track">
                                <div class="ts-barra-fill" style="width:${pct}%"></div>
                            </div>
                            <div class="ts-barra-val">${horas.toFixed(1)}h</div>
                        </div>`;
                    }).join('');
                }
            }

            // Registros recientes
            if (registrosEl) {
                const recientes = [...(DB.timesheet || [])].reverse().slice(0, 20);
                if (!recientes.length) {
                    registrosEl.innerHTML = `<div class="ts-empty">Sin registros.</div>`;
                } else {
                    registrosEl.innerHTML = recientes.map(t => {
                        const causa = DB.causas.find(c => c.id === t.causaId);
                        return `<div class="ts-registro-item">
                            <div class="ts-reg-info">
                                <div class="ts-reg-desc">${escHtml(t.descripcion||'—')}</div>
                                <div class="ts-reg-meta">
                                    <span><i class="fas fa-gavel"></i> ${escHtml(causa?.caratula?.substring(0,30)||t.causaId)}</span>
                                    <span><i class="fas fa-calendar"></i> ${new Date(t.fecha).toLocaleDateString('es-CL')}</span>
                                    <span><i class="fas fa-user"></i> ${escHtml(t.autor||'—')}</span>
                                </div>
                            </div>
                            <div class="ts-reg-horas">${t.horas.toFixed(2)}h</div>
                            <button class="btn btn-xs btn-danger-outline" onclick="tiempoEliminarRegistro('${t.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>`;
                    }).join('');
                }
            }
        }

        /**
         * Exporta el timesheet completo como CSV para facturación.
         */
        function tiempoExportarCSV() {
            const cols = ['Fecha', 'Causa', 'Descripción', 'Horas', 'Autor'];
            const rows = (DB.timesheet || []).map(t => {
                const causa = DB.causas.find(c => c.id === t.causaId);
                return [
                    new Date(t.fecha).toLocaleDateString('es-CL'),
                    causa?.caratula || t.causaId,
                    t.descripcion || '—',
                    t.horas.toFixed(2),
                    t.autor || '—'
                ].map(v => v.includes(',') ? `"${v}"` : v);
            });

            const totalH = (DB.timesheet || []).reduce((s, t) => s + (t.horas || 0), 0);
            rows.push(['TOTAL', '', '', totalH.toFixed(2), '']);

            const bom = '\uFEFF';
            const csv = bom + [cols, ...rows].map(r => r.join(',')).join('\n');
            _descargarTexto(csv, `timesheet-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
            showSuccess(`✓ Timesheet exportado: ${(DB.timesheet||[]).length} registros, ${totalH.toFixed(1)}h totales.`);
        }


        /**
         * Inserta una variable {{varName}} en el textarea del cuerpo de la plantilla,
         * en la posición actual del cursor.
         * @param {string} varName
         */
        function ptInsertarVariable(varName) {
            const ta = document.getElementById('pt-cuerpo');
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const before = ta.value.substring(0, start);
            const after  = ta.value.substring(end);
            const insert = `{{${varName}}}`;
            ta.value = before + insert + after;
            ta.selectionStart = ta.selectionEnd = start + insert.length;
            ta.focus();
        }

        // ═══════════════════════════════════════════════════════════════════
        // INICIALIZACIÓN v8
        // ═══════════════════════════════════════════════════════════════════

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                // Poblar selector de causas en timesheet
                _tsActualizarSelectores();
                // Poblar selector de causas en preview de plantillas
                _ptActualizarSelectores();
                console.info('[v8] Features inicializadas: lexbot-contexto, plantillas-texto, excel-cartera, informe-pdf, timesheet');
            }, 700);
        });

        function _tsSetFechaHoy() {
            const el = document.getElementById('ts-fecha');
            if (el && !el.value) el.value = new Date().toISOString().split('T')[0];
        }

        function _tsActualizarSelectores() {
            ['ts-causa-sel', 'ts-cronometro-causa'].forEach(id => {
                const sel = document.getElementById(id);
                if (!sel) return;
                const prev = sel.value;
                sel.innerHTML = '<option value="">-- Seleccione una causa --</option>' +
                    DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');
                if (prev) sel.value = prev;
            });
        }

        function _ptActualizarSelectores() {
            const sel = document.getElementById('pt-preview-causa');
            if (!sel) return;
            sel.innerHTML = '<option value="">Sin causa (solo texto)</option>' +
                DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');
        }
