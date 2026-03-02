        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 13: FEATURES v7
        // 1. Plantillas de causa por tipo (etapas + alertas predefinidas)
        // 2. Notificaciones in-app con historial leído/no-leído
        // 3. Archivos adjuntos reales Base64 (<2 MB, límite 50 MB total)
        // 4. Acciones rápidas desde KPIs del Dashboard
        // 5. Vista relacional Cliente ↔ Causas (perfil expandido)
        // ── NOTA DE ARQUITECTURA ──────────────────────────────────────────
        // Este módulo (v7) es INDEPENDIENTE de 14-features-v8.js.
        // NO hay solapamiento de funciones entre ambos. Cada uno gestiona
        // dominios distintos y ambos deben mantenerse activos.
        //   v7 → Notificaciones, Adjuntos, AccionesRápidas, Plantillas de causa
        //   v8 → LexBot mejorado, Plantillas de escritos, Timesheet, Exports
        // ████████████████████████████████████████████████████████████████████

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 1 — PLANTILLAS DE CAUSA POR TIPO
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Catálogo de plantillas de procedimiento.
         * Cada plantilla define etapas y alertas típicas del procedimiento.
         * Al convertir un prospecto en causa, el usuario elige una de estas plantillas.
         */
        const PLANTILLAS_CAUSA = {
            'Ordinario Civil': {
                icon: '⚖️', color: '#1a3a6b',
                descripcion: 'Juicio civil ordinario de mayor cuantía (Art. 253 y ss. CPC)',
                etapas: [
                    'Demanda interpuesta', 'Providencia admisoria', 'Notificación válida',
                    'Contestación (15 días)', 'Réplica (6 días)', 'Dúplica (6 días)',
                    'Conciliación obligatoria', 'Resolución recepción a prueba',
                    'Término probatorio (20 días)', 'Observaciones a la prueba',
                    'Citación para sentencia', 'Sentencia definitiva', 'Recurso de apelación'
                ],
                alertas: [
                    { nombre: 'Contestación demanda', diasDesdeHoy: 15, prioridad: 'alta' },
                    { nombre: 'Réplica', diasDesdeHoy: 21, prioridad: 'alta' },
                    { nombre: 'Dúplica', diasDesdeHoy: 27, prioridad: 'media' },
                    { nombre: 'Vencimiento término probatorio', diasDesdeHoy: 90, prioridad: 'critica' },
                ]
            },
            'Ejecutivo': {
                icon: '💰', color: '#b45309',
                descripcion: 'Procedimiento ejecutivo de obligaciones de dar (Art. 434 y ss. CPC)',
                etapas: [
                    'Demanda ejecutiva', 'Mandamiento de ejecución',
                    'Requerimiento de pago', 'Oposición de excepciones (4 días)',
                    'Cuaderno de excepciones', 'Prueba', 'Sentencia de remate',
                    'Tasación bienes', 'Remate / Liquidación', 'Pago al ejecutante'
                ],
                alertas: [
                    { nombre: 'Plazo oposición excepciones', diasDesdeHoy: 4, prioridad: 'critica' },
                    { nombre: 'Solicitar embargo', diasDesdeHoy: 7, prioridad: 'alta' },
                    { nombre: 'Requerimiento caducidad si no se notifica', diasDesdeHoy: 30, prioridad: 'media' },
                ]
            },
            'Laboral': {
                icon: '🧑‍🏭', color: '#0d7a5f',
                descripcion: 'Juicio laboral ordinario (Art. 446 y ss. Código del Trabajo)',
                etapas: [
                    'Demanda presentada', 'Audiencia preparatoria fijada',
                    'Audiencia preparatoria (30 días)', 'Conciliación intentada',
                    'Fijación de controversia', 'Audiencia de juicio',
                    'Prueba rendida', 'Sentencia', 'Recurso de nulidad (10 días)'
                ],
                alertas: [
                    { nombre: 'Prescripción acción laboral (60 días desde despido)', diasDesdeHoy: 50, prioridad: 'critica' },
                    { nombre: 'Audiencia preparatoria', diasDesdeHoy: 30, prioridad: 'alta' },
                    { nombre: 'Plazo recurso nulidad post-sentencia', diasDesdeHoy: 10, prioridad: 'critica' },
                ]
            },
            'Familia': {
                icon: '👨‍👩‍👧', color: '#7c3aed',
                descripcion: 'Procedimiento ordinario ante Tribunales de Familia (Ley 19.968)',
                etapas: [
                    'Demanda / Solicitud', 'Audiencia preparatoria (30 días)',
                    'Conciliación intentada', 'Fijación puntos de prueba',
                    'Audiencia de juicio', 'Prueba testimonial y pericial',
                    'Sentencia definitiva', 'Recurso de apelación (15 días)'
                ],
                alertas: [
                    { nombre: 'Audiencia preparatoria', diasDesdeHoy: 28, prioridad: 'alta' },
                    { nombre: 'Medidas cautelares', diasDesdeHoy: 3, prioridad: 'critica' },
                    { nombre: 'Apelación post-sentencia', diasDesdeHoy: 15, prioridad: 'alta' },
                ]
            },
            'Penal': {
                icon: '🔒', color: '#c0392b',
                descripcion: 'Proceso penal — Etapa de investigación y juicio oral (CPP)',
                etapas: [
                    'Denuncia / Querella', 'Formalización investigación',
                    'Medidas cautelares', 'Investigación fiscal',
                    'Cierre investigación', 'Acusación fiscal',
                    'Audiencia preparatoria JO', 'Juicio Oral',
                    'Sentencia', 'Recurso de nulidad (10 días)'
                ],
                alertas: [
                    { nombre: 'Prescripción querella', diasDesdeHoy: 20, prioridad: 'critica' },
                    { nombre: 'Plazo investigación (6 meses)', diasDesdeHoy: 180, prioridad: 'media' },
                    { nombre: 'Plazo recurso nulidad', diasDesdeHoy: 10, prioridad: 'critica' },
                ]
            },
            'Recurso de Protección': {
                icon: '🛡️', color: '#0891b2',
                descripcion: 'Recurso de Protección — Art. 20 CPR (30 días corridos)',
                etapas: [
                    'Recurso presentado', 'Informe recurrido (10 días)',
                    'Vista en tabla', 'Fallo Corte de Apelaciones',
                    'Apelación a CS (5 días)'
                ],
                alertas: [
                    { nombre: 'CADUCIDAD — 30 días corridos desde el acto', diasDesdeHoy: 25, prioridad: 'critica' },
                    { nombre: 'Plazo apelación a CS', diasDesdeHoy: 5, prioridad: 'critica' },
                ]
            },
        };

        /**
         * Muestra el modal de selección de plantilla de causa.
         * Se llama al hacer clic en "Convertir a Causa" desde el perfil de cliente.
         * @param {string} clienteId - ID del cliente para el cual se crea la causa.
         */
        function plantillaCausaAbrir(clienteId) {
            const cliente = DB.clientes.find(c => c.id === clienteId);
            if (!cliente) return;

            const modal = document.getElementById('modal-plantilla-causa');
            if (!modal) return;

            document.getElementById('mpc-cliente-nombre').textContent = cliente.nombre || cliente.nom;
            document.getElementById('mpc-cliente-id').value = clienteId;

            // Render cards de plantillas
            const grid = document.getElementById('mpc-grid');
            grid.innerHTML = Object.entries(PLANTILLAS_CAUSA).map(([nombre, p]) => `
                <div class="mpc-card" onclick="plantillaCausaSeleccionar('${clienteId}','${nombre}')"
                    style="border-left: 4px solid ${p.color}; cursor:pointer;">
                    <div class="mpc-card-icon" style="color:${p.color}">${p.icon}</div>
                    <div class="mpc-card-body">
                        <div class="mpc-card-nombre">${nombre}</div>
                        <div class="mpc-card-desc">${p.descripcion}</div>
                        <div class="mpc-card-meta">
                            <span><i class="fas fa-list-ol"></i> ${p.etapas.length} etapas</span>
                            <span><i class="fas fa-bell"></i> ${p.alertas.length} alertas auto</span>
                        </div>
                    </div>
                    <div class="mpc-arrow"><i class="fas fa-chevron-right"></i></div>
                </div>
            `).join('');

            abrirModal('modal-plantilla-causa');
        }

        /**
         * Crea la causa con la plantilla seleccionada: etapas predefinidas + alertas automáticas.
         * @param {string} clienteId
         * @param {string} tipoProcedimiento - clave de PLANTILLAS_CAUSA
         */
        function plantillaCausaSeleccionar(clienteId, tipoProcedimiento) {
            const cliente = DB.clientes.find(c => c.id === clienteId);
            const plantilla = PLANTILLAS_CAUSA[tipoProcedimiento];
            if (!cliente || !plantilla) return;

            cerrarModal('modal-plantilla-causa');

            const _crearCausaConPlantilla = (montoBaseOpt) => {
                // Mapear rama desde tipo de procedimiento
                const RAMA_MAP = {
                    'Ordinario Civil': 'Civil', 'Ejecutivo': 'Civil',
                    'Laboral': 'Laboral', 'Familia': 'Familia',
                    'Penal': 'Penal', 'Recurso de Protección': 'Civil'
                };
                const rama = RAMA_MAP[tipoProcedimiento] || 'Civil';

                const nueva = {
                    id: uid(),
                    clienteId: cliente.id,
                    rut: cliente.rut || '',
                    caratula: cliente.nombre || cliente.nom,
                    tipoProcedimiento,
                    rama,
                    estadoGeneral: 'En tramitación',
                    instancia: 'Primera',
                    porcentajeAvance: 0,
                    fechaCreacion: new Date(),
                    fechaUltimaActividad: new Date(),
                    etapasProcesales: plantilla.etapas.map(nombre => ({
                        nombre, completada: false, fecha: null,
                        observacion: '', documentoAsociado: null
                    })),
                    documentos: [], adjuntos: [],
                    recursos: [], estrategia: {},
                    riesgo: {}, honorarios: {},
                    jurisprudenciaAsociada: [],
                    revisadoHoy: false, prioridadManual: false
                };

                DB.causas.push(nueva);
                cliente.estado = 'activo'; cliente.status = 'activo';

                // Honorarios iniciales (opcional)
                if (montoBaseOpt && montoBaseOpt > 0 && typeof asignarHonorarios === 'function') {
                    asignarHonorarios(nueva.id, montoBaseOpt);
                }

                // Crear alertas automáticas de la plantilla
                const hoy = new Date();
                plantilla.alertas.forEach(a => {
                    const fechaVenc = new Date(hoy);
                    fechaVenc.setDate(fechaVenc.getDate() + a.diasDesdeHoy);
                    DB.alertas.push({
                        id: uid(),
                        causaId: nueva.id,
                        tipo: 'plazo',
                        mensaje: `[${nueva.caratula}] ${a.nombre}`,
                        fechaVencimiento: fechaVenc.toISOString(),
                        prioridad: a.prioridad,
                        estado: 'activa',
                        fechaCreacion: hoy.toISOString()
                    });
                });

                registrarEvento(`Causa creada (${tipoProcedimiento}) para ${cliente.nombre || cliente.nom}`);

                // Notificación in-app
                notifAgregar({
                    tipo: 'causa_creada',
                    titulo: 'Causa creada con plantilla',
                    cuerpo: `"${nueva.caratula}" — ${tipoProcedimiento}. ${plantilla.alertas.length} alertas procesales configuradas.`,
                    causaId: nueva.id,
                    icono: plantilla.icon
                });

                if (typeof markAppDirty === "function") markAppDirty();
                save();
                renderAll();
                showSuccess(`✓ Causa creada con ${nueva.etapasProcesales.length} etapas y ${plantilla.alertas.length} alertas automáticas.`);
            };

            // Preguntar por honorarios iniciales (opcional). Si cancela, se crea igual sin honorarios.
            if (typeof migAbrir === 'function' && typeof window.migCancelar === 'function') {
                const oldCancelar = window.migCancelar;
                let yaCreada = false;

                window.migCancelar = function () {
                    window.migCancelar = oldCancelar;
                    if (!yaCreada) {
                        yaCreada = true;
                        oldCancelar();
                        _crearCausaConPlantilla(null);
                    } else {
                        oldCancelar();
                    }
                };

                migAbrir({
                    titulo: '<i class="fas fa-wallet"></i> ¿Deseas asignar honorarios iniciales a esta causa?',
                    btnOk: 'Crear causa',
                    campos: [
                        { id: 'montoBase', label: 'Monto Base ($)', valor: '', placeholder: 'Opcional', tipo: 'number' }
                    ],
                    onOk: (vals) => {
                        window.migCancelar = oldCancelar;
                        if (yaCreada) return;
                        yaCreada = true;

                        const raw = (vals.montoBase || '').toString().trim();
                        const monto = raw ? parseFloat(raw.replace(/\./g, '').replace(/,/g, '.')) : null;
                        _crearCausaConPlantilla((monto && monto > 0) ? monto : null);
                    }
                });
            } else {
                _crearCausaConPlantilla(null);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 2 — NOTIFICACIONES IN-APP CON HISTORIAL
        // ═══════════════════════════════════════════════════════════════════

        // Inicializar colección
        (function _initNotifs() {
            if (!DB.notificaciones) DB.notificaciones = [];
        })();

        /** Número de notificaciones no leídas (badge). @type {number} */
        let _notifUnread = 0;

        /**
         * Agrega una notificación al historial in-app.
         * @param {object} params
         * @param {string} params.tipo    - Tipo: 'alerta'|'causa_creada'|'plazo_vencido'|'pago'|'info'
         * @param {string} params.titulo  - Título corto
         * @param {string} params.cuerpo  - Descripción completa
         * @param {string} [params.causaId]
         * @param {string} [params.icono] - Emoji o clase FA
         */
        function notifAgregar({ tipo, titulo, cuerpo, causaId = null, icono = '🔔' }) {
            const notif = {
                id: uid(),
                tipo, titulo, cuerpo, causaId, icono,
                fecha: new Date().toISOString(),
                leida: false
            };
            DB.notificaciones.unshift(notif);
            // Mantener máximo 100
            if (DB.notificaciones.length > 100) DB.notificaciones.length = 100;
            if (typeof markAppDirty === "function") markAppDirty(); save();
            _notifActualizarBadge();
        }

        /** Actualiza el badge rojo del botón de notificaciones. */
        function _notifActualizarBadge() {
            _notifUnread = DB.notificaciones.filter(n => !n.leida).length;
            const badge = document.getElementById('notif-badge');
            if (badge) {
                badge.textContent = _notifUnread > 0 ? (_notifUnread > 9 ? '9+' : _notifUnread) : '';
                badge.style.display = _notifUnread > 0 ? 'flex' : 'none';
            }
        }

        /** Marca todas las notificaciones como leídas. */
        function notifMarcarTodasLeidas() {
            DB.notificaciones.forEach(n => n.leida = true);
            if (typeof markAppDirty === "function") markAppDirty(); save();
            _notifActualizarBadge();
            notifRender();
        }

        /** Elimina una notificación por ID. */
        function notifEliminar(id) {
            DB.notificaciones = DB.notificaciones.filter(n => n.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); save();
            _notifActualizarBadge();
            notifRender();
        }

        /** Limpia todo el historial de notificaciones. */
        function notifLimpiarTodo() {
            DB.notificaciones = [];
            if (typeof markAppDirty === "function") markAppDirty(); save();
            _notifActualizarBadge();
            notifRender();
        }

        /** Abre/cierra el panel lateral de notificaciones. */
        function notifTogglePanel() {
            const panel = document.getElementById('notif-panel');
            const overlay = document.getElementById('notif-overlay');
            if (!panel) return;
            const abierto = panel.classList.contains('notif-open');
            if (!abierto) {
                // Marcar como leídas al abrir
                DB.notificaciones.forEach(n => n.leida = true);
                if (typeof markAppDirty === "function") markAppDirty(); save();
                _notifActualizarBadge();
                notifRender();
                if (overlay) overlay.classList.add('notif-overlay-open');
            } else {
                if (overlay) overlay.classList.remove('notif-overlay-open');
            }
            panel.classList.toggle('notif-open');
        }

        /**
         * Renderiza la lista de notificaciones en el panel lateral.
         */
        function notifRender() {
            const lista = document.getElementById('notif-lista');
            if (!lista) return;

            const notifs = DB.notificaciones;

            if (!notifs.length) {
                lista.innerHTML = `<div class="notif-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>Sin notificaciones</p>
                </div>`;
                return;
            }

            const tipoConfig = {
                alerta:       { color: '#c0392b', icon: 'fa-exclamation-circle' },
                causa_creada: { color: '#0d7a5f', icon: 'fa-gavel' },
                plazo_vencido:{ color: '#b45309', icon: 'fa-clock' },
                pago:         { color: '#1a3a6b', icon: 'fa-dollar-sign' },
                info:         { color: '#64748b', icon: 'fa-info-circle' },
            };

            lista.innerHTML = notifs.map(n => {
                const cfg = tipoConfig[n.tipo] || tipoConfig.info;
                const fecha = new Date(n.fecha);
                const hace = _notifTiempoRelativo(fecha);
                return `
                <div class="notif-item${n.leida ? '' : ' notif-unread'}" data-id="${n.id}">
                    <div class="notif-item-icon" style="color:${cfg.color}">
                        <i class="fas ${cfg.icon}"></i>
                    </div>
                    <div class="notif-item-body">
                        <div class="notif-item-titulo">${escHtml(n.titulo)}</div>
                        <div class="notif-item-cuerpo">${escHtml(n.cuerpo)}</div>
                        <div class="notif-item-meta">
                            <span class="notif-tiempo">${hace}</span>
                            ${n.causaId ? `<button class="notif-ir-causa" onclick="notifIrACausa('${n.causaId}')">Ver causa →</button>` : ''}
                        </div>
                    </div>
                    <button class="notif-delete" onclick="notifEliminar('${n.id}')" title="Eliminar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`;
            }).join('');
        }

        /** Convierte una fecha en tiempo relativo legible. @private */
        function _notifTiempoRelativo(fecha) {
            const diff = Date.now() - new Date(fecha).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Ahora';
            if (mins < 60) return `Hace ${mins} min`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `Hace ${hrs}h`;
            return new Date(fecha).toLocaleDateString('es-CL');
        }

        /** Navega a la sección de la causa desde una notificación. */
        function notifIrACausa(causaId) {
            notifTogglePanel(); // cerrar panel
            const causa = DB.causas.find(c => c.id === causaId);
            if (causa) {
                tab('detalle-causa');
                if (typeof abrirDetalleCausa === 'function') abrirDetalleCausa(causaId);
            }
        }

        /**
         * Revisa alertas vencidas y genera notificaciones automáticas.
         * Llamar desde actualizarSistema() o al iniciar la app.
         */
        function notifChequearAlertas() {
            const hoy = new Date();
            const alertasVencidas = DB.alertas.filter(a => {
                if (a.estado !== 'activa') return false;
                const venc = new Date(a.fechaVencimiento);
                const diffDias = Math.floor((venc - hoy) / 86400000);
                return diffDias <= 2; // vence en 2 días o ya venció
            });

            alertasVencidas.forEach(a => {
                // No duplicar notificaciones (check por causaId+mensaje en las últimas 24h)
                const yaNotificada = DB.notificaciones.find(n =>
                    n.tipo === 'plazo_vencido' &&
                    n.cuerpo === a.mensaje &&
                    (Date.now() - new Date(n.fecha).getTime()) < 86400000
                );
                if (!yaNotificada) {
                    const venc = new Date(a.fechaVencimiento);
                    const diffDias = Math.floor((venc - hoy) / 86400000);
                    const prefijo = diffDias < 0 ? `Venció hace ${Math.abs(diffDias)} día(s)` :
                                   diffDias === 0 ? 'Vence HOY' : `Vence en ${diffDias} día(s)`;
                    notifAgregar({
                        tipo: 'plazo_vencido',
                        titulo: `⚠️ Plazo procesal — ${prefijo}`,
                        cuerpo: a.mensaje,
                        causaId: a.causaId
                    });
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 3 — ARCHIVOS ADJUNTOS BASE64 (<2 MB, límite 50 MB total)
        // ═══════════════════════════════════════════════════════════════════

        const ADJUNTO_MAX_BYTES   = 2 * 1024 * 1024;   // 2 MB por archivo
        const ADJUNTO_TOTAL_BYTES = 50 * 1024 * 1024;  // 50 MB total

        (function _initAdjuntos() {
            // Asegurar campo adjuntos en cada causa existente
            DB.causas.forEach(c => { if (!c.adjuntos) c.adjuntos = []; });
        })();

        /**
         * Calcula el total de bytes ocupados por todos los adjuntos en todas las causas.
         * @returns {number} Bytes totales
         */
        function adjuntosTotalBytes() {
            let total = 0;
            DB.causas.forEach(c =>
                (c.adjuntos || []).forEach(a => { total += a.tamanoBytes || 0; })
            );
            return total;
        }

        /**
         * Abre el selector de archivo para adjuntar a una causa.
         * @param {string} causaId
         */
        function adjuntosAbrir(causaId) {
            const input = document.getElementById('adjunto-file-input');
            if (!input) return;
            input.dataset.causaId = causaId;
            input.value = '';
            input.click();
        }

        /**
         * Maneja la selección de archivos: valida tamaño, convierte a Base64 y guarda.
         * @param {HTMLInputElement} inputEl
         */
        async function adjuntosOnFileSelect(inputEl) {
            const causaId = inputEl.dataset.causaId;
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            if (!causa.adjuntos) causa.adjuntos = [];

            const files = Array.from(inputEl.files);
            if (!files.length) return;

            let subidos = 0;
            let errores = [];

            for (const file of files) {
                // Validar tamaño individual
                if (file.size > ADJUNTO_MAX_BYTES) {
                    errores.push(`"${file.name}" supera 2 MB`);
                    continue;
                }
                // Validar límite total
                if (adjuntosTotalBytes() + file.size > ADJUNTO_TOTAL_BYTES) {
                    const usadoMB = (adjuntosTotalBytes() / 1024 / 1024).toFixed(1);
                    showError(`⚠️ Límite total de 50 MB alcanzado (${usadoMB} MB en uso). Elimine archivos antes de subir más.`);
                    break;
                }

                try {
                    const base64 = await _fileToBase64(file);
                    causa.adjuntos.push({
                        id: uid(),
                        nombre: file.name,
                        tipo: file.type,
                        tamanoBytes: file.size,
                        base64,
                        fechaSubida: new Date().toISOString(),
                        autor: DB.usuarioActual || 'admin'
                    });
                    subidos++;
                } catch (e) {
                    errores.push(`"${file.name}" — error al leer`);
                }
            }

            if (typeof markAppDirty === "function") markAppDirty(); save();

            // Guardar adjuntos físicamente en disco si DocFisico está activo
            if (typeof DocFisico !== 'undefined' && DocFisico.activo()) {
                const adjuntosNuevos = (causa.adjuntos || []).slice(-subidos);
                for (const adj of adjuntosNuevos) {
                    DocFisico.guardarAdjunto(adj, causa);
                }
            }

            if (subidos > 0) {
                const usadoMB = (adjuntosTotalBytes() / 1024 / 1024).toFixed(1);
                showSuccess(`✓ ${subidos} archivo(s) adjuntados. Espacio usado: ${usadoMB} MB / 50 MB`);
                notifAgregar({
                    tipo: 'info',
                    titulo: 'Archivo adjuntado',
                    cuerpo: `${subidos} archivo(s) subido(s) a "${causa.caratula}"`,
                    causaId,
                    icono: '📎'
                });
            }
            if (errores.length) showError(errores.join(' · '));

            // Re-render del panel de adjuntos si está visible
            adjuntosRender(causaId);
            adjuntosMostrarUsoPorcentaje();
        }

        /**
         * Convierte un File a string Base64. @private
         * @param {File} file
         * @returns {Promise<string>}
         */
        function _fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result); // data:type;base64,...
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        /**
         * Elimina un adjunto de una causa.
         * @param {string} causaId
         * @param {string} adjuntoId
         */
        function adjuntoEliminar(causaId, adjuntoId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            showConfirm('Eliminar adjunto', '¿Eliminar este archivo? La acción es irreversible.', () => {
                causa.adjuntos = causa.adjuntos.filter(a => a.id !== adjuntoId);
                if (typeof markAppDirty === "function") markAppDirty(); save();
                adjuntosRender(causaId);
                adjuntosMostrarUsoPorcentaje();
                showSuccess('Archivo eliminado.');
            }, 'danger');
        }

        /**
         * Abre una vista previa del adjunto (PDF e imagen en nueva pestaña, resto descarga).
         * @param {string} causaId
         * @param {string} adjuntoId
         */
        function adjuntoPreview(causaId, adjuntoId) {
            const causa = DB.causas.find(c => c.id === causaId);
            const adj = causa?.adjuntos?.find(a => a.id === adjuntoId);
            if (!adj) return;

            const isPDF = adj.tipo === 'application/pdf';
            const isImg = adj.tipo?.startsWith('image/');

            if (isPDF || isImg) {
                const win = window.open();
                if (isPDF) {
                    win.document.write(`<iframe src="${adj.base64}" style="width:100%;height:100vh;border:none;"></iframe>`);
                } else {
                    win.document.write(`<img src="${adj.base64}" style="max-width:100%;display:block;margin:auto;">`);
                }
            } else {
                // Descarga directa
                const link = document.createElement('a');
                link.href = adj.base64;
                link.download = adj.nombre;
                link.click();
            }
        }

        /**
         * Renderiza la lista de adjuntos de una causa en el contenedor especificado.
         * @param {string} causaId
         * @param {string} [containerId='adjuntos-lista'] - ID del contenedor DOM
         */
        function adjuntosRender(causaId, containerId = 'adjuntos-lista') {
            const causa = DB.causas.find(c => c.id === causaId);
            const cont = document.getElementById(containerId);
            if (!cont) return;

            const lista = causa?.adjuntos || [];

            if (!lista.length) {
                cont.innerHTML = `<div class="adjunto-empty">
                    <i class="fas fa-paperclip"></i>
                    <span>Sin archivos adjuntos</span>
                    <button class="btn btn-xs" onclick="adjuntosAbrir('${causaId}')">
                        <i class="fas fa-upload"></i> Adjuntar
                    </button>
                </div>`;
                return;
            }

            const fmtBytes = b => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
            const iconoTipo = tipo => {
                if (tipo === 'application/pdf') return '📄';
                if (tipo?.startsWith('image/')) return '🖼️';
                if (tipo?.includes('word')) return '📝';
                return '📎';
            };

            cont.innerHTML = lista.map(a => `
                <div class="adjunto-item">
                    <span class="adjunto-icono">${iconoTipo(a.tipo)}</span>
                    <div class="adjunto-info">
                        <span class="adjunto-nombre" title="${escHtml(a.nombre)}">${escHtml(a.nombre)}</span>
                        <span class="adjunto-meta">${fmtBytes(a.tamanoBytes)} · ${new Date(a.fechaSubida).toLocaleDateString('es-CL')}</span>
                    </div>
                    <div class="adjunto-actions">
                        <button class="btn btn-xs" onclick="adjuntoPreview('${causaId}','${a.id}')" title="Vista previa / Descargar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-xs btn-danger-outline" onclick="adjuntoEliminar('${causaId}','${a.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`).join('');
        }

        /** Actualiza el indicador de uso de almacenamiento de adjuntos en el DOM. */
        function adjuntosMostrarUsoPorcentaje() {
            const usado = adjuntosTotalBytes();
            const pct = Math.min(100, (usado / ADJUNTO_TOTAL_BYTES) * 100);
            const usadoMB = (usado / 1024 / 1024).toFixed(1);

            const barra = document.getElementById('adjuntos-barra-uso');
            const label = document.getElementById('adjuntos-uso-label');
            if (barra) {
                barra.style.width = pct + '%';
                barra.style.background = pct > 85 ? '#c0392b' : pct > 60 ? '#f59e0b' : '#0d7a5f';
            }
            if (label) label.textContent = `${usadoMB} MB / 50 MB usados`;
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 4 — ACCIONES RÁPIDAS DESDE DASHBOARD
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Abre el mini-modal de acciones rápidas anclado al KPI clickeado.
         * @param {string} tipo - 'causas_criticas'|'nueva_alerta'|'nuevo_cliente'|'registrar_pago'
         * @param {HTMLElement} ancla - Elemento DOM del KPI (para posicionar el popup)
         */
        function accionRapida(tipo, ancla) {
            const modal = document.getElementById('modal-accion-rapida');
            if (!modal) return;

            const body = document.getElementById('mar-body');
            const titulo = document.getElementById('mar-titulo');

            const handlers = {
                causas_criticas: () => {
                    titulo.textContent = '⚠️ Causas Críticas';
                    const causasCrit = DB.causas.filter(c => {
                        const tieneAlerta = DB.alertas.some(a =>
                            a.causaId === c.id && a.estado === 'activa' &&
                            (a.prioridad === 'critica' || a.prioridad === 'alta')
                        );
                        return tieneAlerta;
                    });
                    if (!causasCrit.length) {
                        body.innerHTML = `<div class="mar-empty"><i class="fas fa-check-circle" style="color:#0d7a5f;"></i> Sin causas críticas ahora</div>`;
                        return;
                    }
                    body.innerHTML = causasCrit.map(c => `
                        <div class="mar-item" onclick="cerrarModal('modal-accion-rapida'); tab('detalle-causa');">
                            <span class="mar-badge mar-badge-red">CRÍTICA</span>
                            <span class="mar-nombre">${escHtml(c.caratula)}</span>
                            <span class="mar-meta">${escHtml(c.tipoProcedimiento)}</span>
                        </div>`).join('');
                },
                nueva_alerta: () => {
                    titulo.textContent = '🔔 Nueva Alerta';
                    if (!DB.causas.length) {
                        body.innerHTML = `<div class="mar-empty">No hay causas activas.</div>`;
                        return;
                    }
                    body.innerHTML = `
                        <div class="mar-form">
                            <label>Causa</label>
                            <select id="mar-alerta-causa">
                                ${DB.causas.map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('')}
                            </select>
                            <label>Mensaje</label>
                            <input id="mar-alerta-msg" placeholder="Ej: Vence contestación" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <label>Días hasta vencimiento</label>
                            <input id="mar-alerta-dias" type="number" value="7" min="1" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <label>Prioridad</label>
                            <select id="mar-alerta-prio">
                                <option value="critica">Crítica</option>
                                <option value="alta" selected>Alta</option>
                                <option value="media">Media</option>
                                <option value="baja">Baja</option>
                            </select>
                            <button class="btn btn-p" style="margin-top:12px;width:100%;" onclick="accionRapidaCrearAlerta()">
                                <i class="fas fa-plus"></i> Crear Alerta
                            </button>
                        </div>`;
                },
                nuevo_cliente: () => {
                    titulo.textContent = '👤 Nuevo Cliente';
                    body.innerHTML = `
                        <div class="mar-form">
                            <label>Nombre</label>
                            <input id="mar-cli-nom" placeholder="Nombre completo" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <label>RUT</label>
                            <input id="mar-cli-rut" placeholder="12.345.678-9" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <label>Observación</label>
                            <textarea id="mar-cli-obs" rows="2" placeholder="Breve descripción..." style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;resize:vertical;"></textarea>
                            <button class="btn btn-p" style="margin-top:12px;width:100%;" onclick="accionRapidaCrearCliente()">
                                <i class="fas fa-save"></i> Guardar Cliente
                            </button>
                        </div>`;
                },
                registrar_pago: () => {
                    titulo.textContent = '💰 Registrar Pago';
                    const causasConHon = DB.causas.filter(c => c.honorarios?.montoBase);
                    body.innerHTML = `
                        <div class="mar-form">
                            <label>Causa</label>
                            <select id="mar-pago-causa">
                                ${(causasConHon.length ? causasConHon : DB.causas).map(c =>
                                    `<option value="${c.id}">${escHtml(c.caratula)}</option>`
                                ).join('')}
                            </select>
                            <label>Monto ($)</label>
                            <input id="mar-pago-monto" type="number" min="0" placeholder="0" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <label>Descripción</label>
                            <input id="mar-pago-desc" placeholder="Ej: Honorarios 1er cuota" style="width:100%;padding:8px;margin:4px 0;box-sizing:border-box;">
                            <button class="btn btn-p" style="margin-top:12px;width:100%;" onclick="accionRapidaRegistrarPago()">
                                <i class="fas fa-check"></i> Registrar
                            </button>
                        </div>`;
                }
            };

            handlers[tipo]?.();
            abrirModal('modal-accion-rapida');
        }

        /** Crea la alerta desde el mini-form de acción rápida. */
        function accionRapidaCrearAlerta() {
            const causaId = document.getElementById('mar-alerta-causa')?.value;
            const msg     = (document.getElementById('mar-alerta-msg')?.value || '').trim();
            const dias    = parseInt(document.getElementById('mar-alerta-dias')?.value) || 7;
            const prio    = document.getElementById('mar-alerta-prio')?.value || 'alta';

            if (!causaId || !msg) { showError('Complete todos los campos.'); return; }

            const causa = DB.causas.find(c => c.id === causaId);
            const fechaVenc = new Date();
            fechaVenc.setDate(fechaVenc.getDate() + dias);

            DB.alertas.push({
                id: uid(),
                causaId, tipo: 'plazo',
                mensaje: `[${causa?.caratula || ''}] ${msg}`,
                fechaVencimiento: fechaVenc.toISOString(),
                prioridad: prio,
                estado: 'activa',
                fechaCreacion: new Date().toISOString()
            });

            if (typeof markAppDirty === "function") markAppDirty(); save();
            renderAll();
            cerrarModal('modal-accion-rapida');
            showSuccess(`✓ Alerta creada — vence en ${dias} días.`);
            notifAgregar({ tipo: 'alerta', titulo: 'Nueva alerta creada', cuerpo: msg, causaId });
        }

        /** Crea un cliente desde el mini-form de acción rápida. */
        function accionRapidaCrearCliente() {
            const nom = (document.getElementById('mar-cli-nom')?.value || '').trim();
            const rut = (document.getElementById('mar-cli-rut')?.value || '').trim();
            const obs = (document.getElementById('mar-cli-obs')?.value || '').trim();

            if (!nom) { showError('Ingrese el nombre del cliente.'); return; }

            DB.clientes.push({
                id: uid(), nombre: nom, nom, rut,
                descripcion: obs, rel: obs,
                estado: 'prospecto', status: 'prospecto',
                fechaCreacion: new Date()
            });

            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll();
            cerrarModal('modal-accion-rapida');
            showSuccess(`✓ Cliente "${nom}" creado.`);
        }

        /** Registra un pago desde el mini-form de acción rápida. */
        function accionRapidaRegistrarPago() {
            const causaId = document.getElementById('mar-pago-causa')?.value;
            const monto   = parseFloat(document.getElementById('mar-pago-monto')?.value) || 0;
            const desc    = (document.getElementById('mar-pago-desc')?.value || '').trim();

            if (!causaId || !monto) { showError('Ingrese causa y monto.'); return; }

            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            if (!causa.honorarios) causa.honorarios = {};
            if (!causa.honorarios.pagos) causa.honorarios.pagos = [];
            causa.honorarios.pagos.push({
                id: uid(), monto, descripcion: desc,
                fecha: new Date().toISOString(), estado: 'pagado'
            });
            // Actualizar total pagado
            causa.honorarios.totalPagado = (causa.honorarios.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);

            if (typeof markAppDirty === "function") markAppDirty(); save(); renderAll(); renderDashboardPanel();
            cerrarModal('modal-accion-rapida');
            showSuccess(`✓ Pago de $${monto.toLocaleString('es-CL')} registrado.`);
            notifAgregar({ tipo: 'pago', titulo: 'Pago registrado', cuerpo: `$${monto.toLocaleString('es-CL')} — ${desc || causa.caratula}`, causaId });
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEATURE 5 — VISTA RELACIONAL CLIENTE ↔ CAUSAS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Abre el modal de perfil expandido de un cliente con todas sus causas,
         * historial de pagos, documentos adjuntos y actividad consolidada.
         * @param {string} clienteId
         */
        function verPerfilCliente(clienteId) {
            const cliente = DB.clientes.find(c => c.id === clienteId);
            if (!cliente) return;

            const modal = document.getElementById('modal-perfil-cliente');
            if (!modal) return;

            const causas = DB.causas.filter(c => c.clienteId === clienteId);
            const totalAdjuntos = causas.reduce((s, c) => s + (c.adjuntos?.length || 0), 0);
            const totalPagado = causas.reduce((s, c) =>
                s + (c.honorarios?.totalPagado || 0), 0);
            const totalPendiente = causas.reduce((s, c) =>
                s + Math.max(0, (c.honorarios?.montoBase || 0) - (c.honorarios?.totalPagado || 0)), 0);

            const fmtCLP = n => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

            // Header
            document.getElementById('mpc-header-nombre').textContent = cliente.nombre || cliente.nom;
            document.getElementById('mpc-header-rut').textContent    = cliente.rut   || 'Sin RUT';
            const telEl = document.getElementById('mpc-header-telefono');
            if (telEl) telEl.textContent = cliente.telefono || 'Sin teléfono';
            document.getElementById('mpc-header-estado').textContent  = cliente.estado || cliente.status || 'prospecto';
            document.getElementById('mpc-header-estado').className    = `badge ${(cliente.estado || cliente.status) === 'activo' ? 'badge-green' : ''}`;

            // KPIs del perfil
            document.getElementById('mpc-kpi-causas').textContent    = causas.length;
            document.getElementById('mpc-kpi-pagado').textContent     = fmtCLP(totalPagado);
            document.getElementById('mpc-kpi-pendiente').textContent  = fmtCLP(totalPendiente);
            document.getElementById('mpc-kpi-docs').textContent       = totalAdjuntos;

            // Lista de causas
            const causasEl = document.getElementById('mpc-causas-lista');
            if (!causas.length) {
                causasEl.innerHTML = `<div class="mpc-empty">Sin causas asociadas.
                    <button class="btn btn-xs btn-p" onclick="plantillaCausaAbrir('${clienteId}')">
                        <i class="fas fa-plus"></i> Crear causa
                    </button></div>`;
            } else {
                causasEl.innerHTML = causas.map(c => {
                    const pagos = c.honorarios?.pagos || [];
                    const alertasActivas = DB.alertas.filter(a => a.causaId === c.id && a.estado === 'activa').length;

                    return `
                    <div class="mpc-causa-card" style="border-left: 3px solid ${c.estadoGeneral === 'Finalizada' ? '#0d7a5f' : c.estadoGeneral === 'Suspendida' ? '#f59e0b' : '#1a3a6b'}">
                        <div class="mpc-causa-header">
                            <div>
                                <div class="mpc-causa-caratula">${escHtml(c.caratula)}</div>
                                <div class="mpc-causa-meta">
                                    <span>${escHtml(c.tipoProcedimiento)}</span>
                                    <span class="badge" style="font-size:10px;">${escHtml(c.estadoGeneral)}</span>
                                    ${alertasActivas > 0 ? `<span class="badge badge-red" style="font-size:10px;">⚠️ ${alertasActivas} alertas</span>` : ''}
                                </div>
                            </div>
                            <button class="btn btn-xs" onclick="cerrarModal('modal-perfil-cliente'); tab('detalle-causa'); setTimeout(()=>abrirDetalleCausa?.('${c.id}'),100);">
                                Ver →
                            </button>
                        </div>
                        <!-- Barra de avance -->
                        <div class="mpc-avance-wrap">
                            <div class="mpc-avance-bar" style="width:${c.porcentajeAvance || 0}%"></div>
                        </div>
                        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${c.porcentajeAvance || 0}% completado</div>
                        <!-- Pagos de la causa -->
                        ${pagos.length ? `
                        <div class="mpc-pagos">
                            <div class="mpc-pagos-titulo"><i class="fas fa-dollar-sign"></i> Pagos</div>
                            ${pagos.slice(-3).map(p => `
                                <div class="mpc-pago-item">
                                    <span class="mpc-pago-monto">${fmtCLP(p.monto)}</span>
                                    <span class="mpc-pago-desc">${escHtml(p.descripcion || '—')}</span>
                                    <span class="mpc-pago-fecha">${new Date(p.fecha).toLocaleDateString('es-CL')}</span>
                                </div>`).join('')}
                            ${pagos.length > 3 ? `<div style="font-size:11px;color:var(--text-3);">+${pagos.length-3} más</div>` : ''}
                        </div>` : ''}
                        <!-- Adjuntos de la causa -->
                        ${(c.adjuntos||[]).length ? `
                        <div class="mpc-adjuntos">
                            <div class="mpc-pagos-titulo"><i class="fas fa-paperclip"></i> Adjuntos</div>
                            <div class="adjuntos-mini-lista">
                                ${(c.adjuntos||[]).slice(0,4).map(a => `
                                    <div class="adjunto-mini" onclick="adjuntoPreview('${c.id}','${a.id}')" title="${escHtml(a.nombre)}">
                                        <span>${a.tipo?.startsWith('image/') ? '🖼️' : a.tipo === 'application/pdf' ? '📄' : '📎'}</span>
                                        <span class="adjunto-mini-nombre">${escHtml(a.nombre.substring(0,20))}${a.nombre.length > 20 ? '…' : ''}</span>
                                    </div>`).join('')}
                                ${(c.adjuntos||[]).length > 4 ? `<div style="font-size:11px;color:var(--text-3);">+${c.adjuntos.length-4} más</div>` : ''}
                            </div>
                        </div>` : ''}
                    </div>`;
                }).join('');
            }

            // Botón de nueva causa
            document.getElementById('mpc-btn-nueva-causa').onclick = () => {
                cerrarModal('modal-perfil-cliente');
                plantillaCausaAbrir(clienteId);
            };

            // Renderizar actividad consolidada
            _mpcRenderActividad(clienteId, causas);
            _mpcCambiarTab('causas');

            abrirModal('modal-perfil-cliente');
        }

        /**
         * Cambia entre panel de causas y panel de actividad reciente en el modal de perfil.
         * @param {'causas'|'actividad'} tab
         */
        function _mpcCambiarTab(tab) {
            const btnCausas = document.getElementById('mpc-tab-causas');
            const btnActividad = document.getElementById('mpc-tab-actividad');
            const panelCausas = document.getElementById('mpc-panel-causas');
            const panelActividad = document.getElementById('mpc-panel-actividad');
            if (!btnCausas || !btnActividad || !panelCausas || !panelActividad) return;

            const activarCausas = tab === 'causas';
            btnCausas.classList.toggle('active', activarCausas);
            btnActividad.classList.toggle('active', !activarCausas);
            btnCausas.style.borderBottomColor = activarCausas ? 'var(--a,#6366f1)' : 'transparent';
            btnActividad.style.borderBottomColor = !activarCausas ? 'var(--a,#6366f1)' : 'transparent';

            panelCausas.style.display = activarCausas ? 'block' : 'none';
            panelActividad.style.display = activarCausas ? 'none' : 'block';
        }

        /**
         * Construye el timeline unificado de actividad para un cliente.
         * Incluye: movimientos, pagos, alertas y documentos de todas sus causas.
         * @param {string} clienteId
         * @param {Array} causasCliente - lista de causas del cliente
         */
        function _mpcRenderActividad(clienteId, causasCliente) {
            const cont = document.getElementById('mpc-actividad-lista');
            if (!cont) return;

            const causas = causasCliente || DB.causas.filter(c => c.clienteId === clienteId);
            if (!causas.length) {
                cont.innerHTML = '<div class=\"mpc-empty\">Sin actividad registrada todavía.</div>';
                return;
            }

            const eventos = [];
            const causaIds = causas.map(c => c.id);

            // Movimientos por causa
            causas.forEach(c => {
                const etiquetaCausa = c.caratula || `Causa ID ${c.id}`;
                (c.movimientos || []).forEach(m => {
                    const f = m.fecha || m.fechaDocumento;
                    if (!f) return;
                    const d = new Date(f);
                    if (isNaN(d.getTime())) return;
                    eventos.push({
                        tipo: 'movimiento',
                        icon: 'fa-file-alt',
                        color: '#2563eb',
                        fecha: d,
                        fechaRaw: f,
                        causaId: c.id,
                        causa: etiquetaCausa,
                        titulo: m.nombre || 'Movimiento en causa',
                        detalle: (m.tipo || '') + (m.etapa ? ` · ${m.etapa}` : '')
                    });
                });

                // Pagos de honorarios
                const pagos = c.honorarios?.pagos || [];
                pagos.forEach(p => {
                    const f = p.fecha;
                    if (!f) return;
                    const d = new Date(f);
                    if (isNaN(d.getTime())) return;
                    eventos.push({
                        tipo: 'pago',
                        icon: 'fa-dollar-sign',
                        color: '#059669',
                        fecha: d,
                        fechaRaw: f,
                        causaId: c.id,
                        causa: etiquetaCausa,
                        titulo: 'Pago recibido',
                        detalle: `$${(p.monto || 0).toLocaleString('es-CL')} · ${p.descripcion || 'Honorarios'}`
                    });
                });
            });

            // Alertas asociadas a las causas del cliente
            (DB.alertas || []).filter(a => causaIds.includes(a.causaId)).forEach(a => {
                const c = causas.find(cx => cx.id === a.causaId);
                const etiquetaCausa = c?.caratula || `Causa ID ${a.causaId}`;
                const f = a.fechaObjetivo || a.fecha || a.creadoEn;
                if (!f) return;
                const d = new Date(f);
                if (isNaN(d.getTime())) return;
                eventos.push({
                    tipo: 'alerta',
                    icon: 'fa-bell',
                    color: '#b45309',
                    fecha: d,
                    fechaRaw: f,
                    causaId: a.causaId,
                    causa: etiquetaCausa,
                    titulo: a.mensaje || 'Alerta',
                    detalle: (a.tipo || '').toUpperCase()
                });
            });

            // Documentos de las causas del cliente (DB.documentos global)
            (DB.documentos || []).filter(d => causaIds.includes(d.causaId)).forEach(d => {
                const c = causas.find(cx => cx.id === d.causaId);
                const etiquetaCausa = c?.caratula || `Causa ID ${d.causaId}`;
                const f = d.fechaDocumento || d.fechaCreacion;
                if (!f) return;
                const fd = new Date(f);
                if (isNaN(fd.getTime())) return;
                eventos.push({
                    tipo: 'documento',
                    icon: 'fa-file-alt',
                    color: '#4b5563',
                    fecha: fd,
                    fechaRaw: f,
                    causaId: d.causaId,
                    causa: etiquetaCausa,
                    titulo: d.nombreOriginal || 'Documento',
                    detalle: (d.tipo || '') + (d.etapaVinculada ? ` · ${d.etapaVinculada}` : '')
                });
            });

            if (!eventos.length) {
                cont.innerHTML = '<div class=\"mpc-empty\">Sin actividad registrada todavía.</div>';
                return;
            }

            eventos.sort((a, b) => b.fecha - a.fecha);

            const fmtFecha = (d) => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

            cont.innerHTML = `
                <div class=\"mpc-timeline\" style=\"position:relative;margin-top:4px;\">\n
                    ${eventos.map((ev, idx) => {
                        const fechaStr = fmtFecha(ev.fecha);
                        const tipoLabel = ev.tipo.charAt(0).toUpperCase() + ev.tipo.slice(1);
                        const isLast = idx === eventos.length - 1;
                        return `
                        <div class=\"mpc-tl-item\" style=\"display:flex;align-items:flex-start;gap:10px;position:relative;padding:8px 0;cursor:pointer;\" 
                            onclick=\"cerrarModal('modal-perfil-cliente'); tab('detalle-causa'); setTimeout(()=>abrirDetalleCausa?.('${ev.causaId}'),100);\">
                            <div style=\"width:22px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;position:relative;\">\n
                                <div style=\"width:18px;height:18px;border-radius:999px;background:${ev.color};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;box-shadow:0 0 0 2px #fff;\">\n
                                    <i class=\"fas ${ev.icon}\"></i>\n
                                </div>\n
                                ${isLast ? '' : '<div style=\"flex:1;width:2px;background:var(--border,#e2e8f0);margin-top:2px;\"></div>'}\n
                            </div>\n
                            <div style=\"flex:1;min-width:0;\">\n
                                <div style=\"font-size:0.75rem;color:var(--text-3,#64748b);margin-bottom:2px;\">${fechaStr}</div>\n
                                <div style=\"font-size:0.86rem;font-weight:600;color:var(--text,#0f172a);\">\n
                                    ${tipoLabel} · ${escHtml(ev.causa)}\n
                                </div>\n
                                ${ev.titulo ? `<div style=\"font-size:0.82rem;color:var(--text-2,#475569);margin-top:1px;\">${escHtml(ev.titulo)}</div>` : ''}\n
                                ${ev.detalle ? `<div style=\"font-size:0.78rem;color:var(--text-3,#64748b);margin-top:1px;\">${escHtml(ev.detalle)}</div>` : ''}\n
                            </div>\n
                        </div>`;}).join('')}
                </div>`;
        }

        // ═══════════════════════════════════════════════════════════════════
        // INICIALIZACIÓN — Se llama desde init() del módulo 09-app-core
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Inicializa todas las features v7. Llamar tras init() de la app.
         */
        function initFeaturesV7() {
            // Inicializar badge de notificaciones
            _notifActualizarBadge();

            // Verificar alertas vencidas
            notifChequearAlertas();

            // Inicializar indicador de uso de adjuntos
            adjuntosMostrarUsoPorcentaje();

            // Inyectar acciones rápidas en los KPIs del dashboard
            // _inyectarAccionesRapidasEnKPIs(); // deshabilitado — botones no deseados en KPI cards

            // Montar botones de "Ver perfil" en la lista de clientes
            // (se llama también en renderAll vía monkey-patch de renderClients)
            _patchRenderClients();

            console.info('[v7] Features inicializadas: plantillas-causa, notifs, adjuntos, acciones-rápidas, vista-relacional');
        }

        /** Agrega botones de acción rápida a los KPI cards del dashboard. @private */
        function _inyectarAccionesRapidasEnKPIs() {
            const kpiMap = {
                'kpi-causas':   { tipo: 'causas_criticas',  label: 'Ver críticas' },
                'kpi-alertas':  { tipo: 'nueva_alerta',     label: 'Crear alerta' },
                'kpi-clientes': { tipo: 'nuevo_cliente',    label: 'Nuevo cliente' },
                'kpi-facturado':{ tipo: 'registrar_pago',   label: 'Registrar pago' },
            };
            Object.entries(kpiMap).forEach(([kpiId, cfg]) => {
                const kpiEl = document.getElementById(kpiId)?.closest('.db-kpi');
                if (!kpiEl || kpiEl.querySelector('.kpi-quick-btn')) return; // evitar duplicados
                // Inyectar dentro de .db-kpi-data para que quede bajo el valor/label
                const dataEl = kpiEl.querySelector('.db-kpi-data') || kpiEl;
                const btn = document.createElement('button');
                btn.className = 'kpi-quick-btn';
                btn.innerHTML = `<i class="fas fa-bolt"></i> ${cfg.label}`;
                btn.onclick = (e) => { e.stopPropagation(); accionRapida(cfg.tipo, kpiEl); };
                dataEl.appendChild(btn);
            });
        }

        /**
         * Monkey-patch de renderClients para agregar botón "Ver Perfil" en cada cliente.
         * @private
         */
        function _patchRenderClients() {
            // Observar mutaciones en #client-list para inyectar botones post-render
            const target = document.getElementById('client-list');
            if (!target) return;

            const observer = new MutationObserver(() => {
                target.querySelectorAll('[data-cliente-id]').forEach(card => {
                    if (card.querySelector('.btn-ver-perfil')) return; // ya inyectado
                    const clienteId = card.dataset.clienteId;
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-xs btn-ver-perfil';
                    btn.innerHTML = '<i class="fas fa-id-card"></i> Ver Perfil';
                    btn.onclick = () => verPerfilCliente(clienteId);
                    // Insertar en el contenedor de acciones del card
                    const actions = card.querySelector('.client-actions') || card;
                    actions.appendChild(btn);
                });
            });
            observer.observe(target, { childList: true, subtree: false });
        }

        // ═══════════════════════════════════════════════════════════════════
        // HOOK — Extender init() de app-core para llamar initFeaturesV7
        // ═══════════════════════════════════════════════════════════════════
        document.addEventListener('DOMContentLoaded', () => {
            // Esperar a que init() termine (usa evento personalizado o timeout corto)
            setTimeout(initFeaturesV7, 600);
        });

        // ═══════════════════════════════════════════════════════════════════
        // HELPER — Abrir modal de adjuntos para una causa
        // ═══════════════════════════════════════════════════════════════════
        /**
         * Abre el modal de adjuntos y carga la lista para la causa indicada.
         * @param {string} causaId
         */
        function _abrirModalAdjuntos(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            document.getElementById('adjunto-causa-id').value = causaId;
            adjuntosRender(causaId, 'adjuntos-lista');
            adjuntosMostrarUsoPorcentaje();
            abrirModal('modal-adjuntos');
        }
