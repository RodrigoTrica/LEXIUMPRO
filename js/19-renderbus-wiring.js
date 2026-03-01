        // ████████████████████████████████████████████████████████████████████
        // JS — BLOQUE 19: RENDER BUS WIRING + SELECTIVE RENDER PATCH
        // • Registra todos los renders existentes en sus namespaces
        // • Parchea renderAll() para ser selectivo cuando hay namespace
        // • Parchea save() para emitir eventos en EventBus
        // • Reemplaza: save(); renderAll() → save(); EventBus.emit('ns:updated')
        // CARGA AL FINAL — después de todos los módulos
        // ████████████████████████████████████████████████████████████████████

        (function _wireRenderBus() {

            // ── 1. Registrar renders por namespace ──────────────────────────
            // Cada namespace puede tener múltiples funciones render.
            // RenderBus.render('causas') ejecutará TODAS las registradas bajo 'causas'.

            // NAMESPACE: stats (contadores del sidebar)
            RenderBus.register('stats', function renderStats() {
                const prospectos = (DB.clientes || []).filter(c => c.estado === 'prospecto' || c.status === 'prospecto');
                const plazoAlerts = (DB.documentos || []).filter(d => d.generaPlazo && d.fechaVencimiento).length;
                const alertCount  = (DB.causas || []).length + plazoAlerts + (DB.alertas || []).filter(a => a.estado === 'activa').length;

                const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
                setEl('st-ca', (DB.causas || []).length);
                setEl('st-pr', prospectos.length + (DB.prospectos || []).length);
                setEl('st-al', alertCount);
                setEl('st-ju', (DB.jurisprudencia || []).length);
                setEl('st-do', (DB.documentos || []).length);
            });

            // NAMESPACE: selectors (todos los <select> de causas)
            RenderBus.register('selectors', function renderSelectors() {
                const causeOptBase = '<option value="">-- Seleccione una causa --</option>' +
                    (DB.causas || []).map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');
                const causeOptOptional = '<option value="">-- Sin causa específica --</option>' +
                    (DB.causas || []).map(c => `<option value="${c.id}">${escHtml(c.caratula)}</option>`).join('');

                ['risk-select','ga-causa-sel','ep-causa-sel','doc-causa-sel','hr-causa-sel',
                 'hr-pago-causa-sel','rec-causa-sel','inf-causa-sel','esc-causa-sel',
                 'inst-causa-sel','coh-causa-sel','fe-causa-sel']
                    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = causeOptBase; });

                ['cal-causa-sel','cq-causa-sel']
                    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = causeOptOptional; });

                // Re-bind del onchange del generador de escritos
                const escCausaSel = document.getElementById('esc-causa-sel');
                if (escCausaSel && typeof rellenarTiposEscritos === 'function') {
                    escCausaSel.onchange = function() {
                        const causa = (DB.causas || []).find(c => c.id == this.value);
                        rellenarTiposEscritos(causa?.materia || 'civil');
                    };
                    const primeraCausa = (DB.causas || []).find(c => c.id == escCausaSel.value);
                    rellenarTiposEscritos(primeraCausa?.materia || 'civil');
                }
            });

            // NAMESPACE: causas
            if (typeof renderCausas === 'function') {
                RenderBus.register('causas', renderCausas);
            }

            // NAMESPACE: clientes
            if (typeof renderClientes === 'function') {
                RenderBus.register('clientes', renderClientes);
            }

            // NAMESPACE: prospectos
            if (typeof renderProspectos === 'function') {
                RenderBus.register('prospectos', renderProspectos);
            }

            // NAMESPACE: alertas
            if (typeof renderAlerts === 'function') {
                RenderBus.register('alertas', renderAlerts);
            }

            // NAMESPACE: juris
            if (typeof renderJuris === 'function') {
                RenderBus.register('juris', renderJuris);
            }
            if (typeof uiRenderJurisprudenciaAvanzada === 'function') {
                RenderBus.register('juris', uiRenderJurisprudenciaAvanzada);
            }

            // NAMESPACE: honorarios
            if (typeof renderHonorariosResumen === 'function') {
                RenderBus.register('honorarios', renderHonorariosResumen);
            }

            // NAMESPACE: panel (panel ejecutivo y dashboard)
            if (typeof renderPanelEjecutivo === 'function') {
                RenderBus.register('panel', renderPanelEjecutivo);
            }
            if (typeof renderResumenEconomico === 'function') {
                RenderBus.register('panel', renderResumenEconomico);
            }

            // NAMESPACE: dashboard
            if (typeof renderDashboardPanel === 'function') {
                RenderBus.register('dashboard', renderDashboardPanel);
            }

            // NAMESPACE: calendario
            if (typeof renderCalendario === 'function') {
                RenderBus.register('calendario', renderCalendario);
            }

            // NAMESPACE: semaforo
            if (typeof renderSemaforoPlazos === 'function') {
                RenderBus.register('semaforo', renderSemaforoPlazos);
            }

            // NAMESPACE: bitacora
            if (typeof renderBitacora === 'function') {
                RenderBus.register('bitacora', renderBitacora);
            }

            // NAMESPACE: prioridad
            if (typeof renderMatrizPrioridad === 'function') {
                RenderBus.register('prioridad', renderMatrizPrioridad);
            }

            // NAMESPACE: saludDespacho
            if (typeof renderSaludDespacho === 'function') {
                RenderBus.register('saludDespacho', renderSaludDespacho);
            }
            if (typeof renderCausasDormidas === 'function') {
                RenderBus.register('saludDespacho', renderCausasDormidas);
            }

            // NAMESPACE: docs
            if (typeof bibRender === 'function') {
                RenderBus.register('docs', bibRender);
            }

            // NAMESPACE: recursos
            if (typeof renderRecursos === 'function') {
                RenderBus.register('recursos', renderRecursos);
            }

            // NAMESPACE: timesheet
            if (typeof tiempoRender === 'function') {
                RenderBus.register('timesheet', tiempoRender);
            }
            if (typeof ptRender === 'function') {
                RenderBus.register('timesheet', ptRender);
            }

            // ── 2. Patch renderAll() — hacerla selectiva ───────────────────
            // La renderAll() original se preserva. Si se llama con namespace,
            // solo renderiza ese namespace. Sin namespace = comportamiento legacy.
            if (typeof renderAll === 'function') {
                window._renderAllLegacy = renderAll;

                window.renderAll = function renderAllPatched(namespace) {
                    if (namespace && typeof namespace === 'string') {
                        // Render selectivo: solo el namespace especificado
                        RenderBus.renderSync(namespace);
                        return;
                    }
                    // Sin namespace: comportamiento legacy completo
                    // (ocurre solo en init() y cambios de tema)
                    window._renderAllLegacy();
                };

                console.info('[RenderBus] renderAll() parchada — selectiva por namespace disponible.');
            }

            // ── 3. Patch save() — emitir eventos en EventBus ──────────────
            // Esto permite reemplazar gradualmente:
            //   save(); renderAll();
            //   → save(); EventBus.emit('causas:updated');
            //
            // Los módulos que ya usan EventBus.emit no necesitan cambios adicionales.
            // Los que aún llaman renderAll() seguirán funcionando vía el shim.

            const _origSave = window.save;
            if (typeof _origSave === 'function') {
                window.save = function saveWithEvents() {
                    _origSave.apply(this, arguments);
                    // No emitir evento aquí — lo hacen los módulos individuales.
                    // StorageGuard monitorea desde su propio patch.
                };
            }

            // ── 4. Registro de renderers de Drive en el panel ─────────────
            if (typeof GoogleDrive !== 'undefined') {
                // Registrar render del status de Drive en el namespace 'ui'
                RenderBus.register('drive', () => GoogleDrive._driveRenderStatus?.());

                // Escuchar eventos de Drive y actualizar UI
                EventBus.on('drive:connected',    () => RenderBus.render('drive'));
                EventBus.on('drive:disconnected', () => RenderBus.render('drive'));
                EventBus.on('drive:pushed',       () => RenderBus.render('drive'));
                EventBus.on('drive:pulled',       () => {
                    // Después de pull: re-render completo
                    setTimeout(() => window._renderAllLegacy?.(), 100);
                });
            }

            // ── 5. Modo estudio (toggle) ───────────────────────────────────
            RenderBus.register('modoEstudio', function renderModoEstudio() {
                const modo = DB.configuracion?.modoEstudio ? 'estudio' : 'personal';
                document.getElementById('modo-personal-btn')?.classList.toggle('activo', modo === 'personal');
                document.getElementById('modo-estudio-btn')?.classList.toggle('activo', modo === 'estudio');
            });

            // ── 6. StorageGuard UI badge ───────────────────────────────────
            RenderBus.register('storage', function renderStorageBadge() {
                if (typeof StorageGuard !== 'undefined') {
                    StorageGuard.check();
                }
            });

            // Chequeo inicial de storage al arrancar
            setTimeout(() => {
                if (typeof StorageGuard !== 'undefined') {
                    StorageGuard.check();
                }
            }, 1000);

            // ── 7. Google Drive: render panel config si existe el contenedor ──
            setTimeout(() => {
                if (typeof GoogleDrive !== 'undefined') {
                    GoogleDrive.renderConfigPanel?.();
                }
            }, 300);

            console.info('[RenderBus] Wiring completo.', RenderBus.namespaces().length, 'namespaces registrados:', RenderBus.namespaces().join(', '));

        })();

        // ── Exponer helpers de migración para reemplazar save(); renderAll() ──
        /**
         * saveAndEmit(namespace, payload) — reemplaza el patrón:
         *   save(); renderAll();
         * con:
         *   saveAndEmit('causas:updated', { id: causa.id });
         *
         * Hace el save + emite el evento + renderiza solo el namespace afectado.
         * Migración gradual: reemplazar de a uno cuando se modifique un módulo.
         */
        function saveAndEmit(event, payload = {}) {
            if (typeof save === 'function') save();
            EventBus.emit(event, payload);
        }

        window.saveAndEmit = saveAndEmit;
