// Event listeners wiring (CSP phase 2)
// Note: This file must not be loaded with inline scripts; it only attaches listeners.

(function () {
    'use strict';

    function _closest(el, sel) {
        if (!el) return null;
        if (typeof el.closest === 'function') return el.closest(sel);
        return null;
    }

    function _bindSidebarNavigation() {
        const side = document.getElementById('side');
        if (!side) return;

        side.addEventListener('click', (ev) => {
            const btn = _closest(ev.target, 'button');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            if (!action) return;

            if (action === 'tab') {
                const tabId = btn.getAttribute('data-tab');
                if (!tabId) return;
                if (typeof window.tab === 'function') window.tab(tabId, btn);
                return;
            }

            if (action === 'nav-group-toggle') {
                const targetId = btn.getAttribute('data-target');
                if (!targetId) return;
                btn.classList.toggle('open');
                const target = document.getElementById(targetId);
                if (target) target.classList.toggle('open');
                return;
            }

            if (action === 'importar-backup') {
                if (typeof window.importarBackup === 'function') window.importarBackup();
                return;
            }

            if (action === 'backup-ahora') {
                if (window.BackupDisco && typeof window.BackupDisco.hacerAhora === 'function') {
                    window.BackupDisco.hacerAhora('manual');
                }
                return;
            }

            if (action === 'docfisico-elegir-carpeta') {
                if (window.DocFisico && typeof window.DocFisico.elegirCarpeta === 'function') {
                    window.DocFisico.elegirCarpeta();
                }
                return;
            }

            if (action === 'docfisico-sincronizar') {
                if (window.DocFisico && typeof window.DocFisico.sincronizarTodo === 'function') {
                    window.DocFisico.sincronizarTodo();
                }
                return;
            }

            if (action === 'logout') {
                if (typeof window.logout === 'function') window.logout();
                return;
            }
        });
    }

    function _bindGlobalModals() {
        document.addEventListener('click', async (e) => {
            try {
                const t = e.target;

                const waToggle = _closest(t, '[data-action="wa-toggle"]');
                if (waToggle) {
                    if (typeof window.waToggle === 'function') window.waToggle();
                    return;
                }

                const waReset = _closest(t, '[data-action="wa-reset"]');
                if (waReset) {
                    if (typeof window.waReset === 'function') window.waReset();
                    return;
                }

                const dashGoAlertas = _closest(t, '[data-action="dash-go-alertas"]');
                if (dashGoAlertas) {
                    if (typeof window.tab === 'function') window.tab('calendario');
                    setTimeout(() => {
                        const cont = document.getElementById('calendarioEventos') || document.getElementById('calendarioMes');
                        if (cont && typeof cont.scrollIntoView === 'function') {
                            cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 120);
                    return;
                }

                const overlayWa = _closest(t, '[data-action="close-modal-overlay-wa"]');
                if (overlayWa) {
                    if (t === overlayWa) {
                        if (typeof window.cerrarModalWA === 'function') window.cerrarModalWA();
                        return;
                    }
                }

                const alertMonitorAction = _closest(t, '[data-action^="alertas-"]');
                if (alertMonitorAction) {
                    const action = alertMonitorAction.getAttribute('data-action');
                    if (action === 'alertas-set-filtro' || action === 'alertas-set-orden') {
                        // Estos <select> se manejan por 'change' (no por 'click') para evitar que el re-render cierre el dropdown.
                        return;
                    }
                    if (action === 'alertas-limpiar-auto') {
                        try {
                            const r = window.cleanupAlertasPlantillaAntiguas && window.cleanupAlertasPlantillaAntiguas({ strictSameDay: true });
                            if (r && r.ok) {
                                if (typeof window.showSuccess === 'function') window.showSuccess('Alertas auto eliminadas: ' + (r.borradas || 0));
                            } else {
                                if (typeof window.showInfo === 'function') window.showInfo('No fue posible ejecutar la limpieza.');
                            }
                        } catch (_) {
                            if (typeof window.showError === 'function') window.showError('No se pudo limpiar alertas auto.');
                        }
                        try {
                            if (typeof window.renderAlerts === 'function') window.renderAlerts();
                        } catch (_) {}
                        return;
                    }

                    if (action === 'alertas-archivar') {
                        const alertaId = alertMonitorAction.getAttribute('data-alerta-id');
                        if (alertaId && typeof window.archivarAlerta === 'function') {
                            try {
                                window.archivarAlerta(alertaId);
                            } catch (_) {}
                            try {
                                if (typeof window.renderAlerts === 'function') window.renderAlerts();
                            } catch (_) {}
                        }
                        return;
                    }

                    if (action === 'alertas-open') {
                        const alertaId = alertMonitorAction.getAttribute('data-alerta-id');
                        if (!alertaId) return;
                        let dbRef = null;
                        try {
                            if (window.DB) dbRef = window.DB;
                            else if (typeof DB !== 'undefined') dbRef = DB;
                        } catch (_) { dbRef = null; }

                        const a = (dbRef?.alertas || []).find(x => String(x?.id) === String(alertaId));
                        if (!a) {
                            if (typeof window.tab === 'function') window.tab('calendario');
                            return;
                        }

                        const tipo = String(a.tipo || '').toLowerCase();
                        const msg = String(a.mensaje || '').toLowerCase();
                        const causaId = a.causaId;

                        // 1) Causa -> detalle
                        if (causaId !== null && causaId !== undefined && String(causaId).trim() !== '') {
                            if (typeof window.tab === 'function') window.tab('detalle-causa');
                            setTimeout(() => {
                                if (typeof window.abrirDetalleCausa === 'function') window.abrirDetalleCausa(String(causaId));
                            }, 80);
                            return;
                        }

                        // 2) Financiero
                        if (tipo === 'honorario' || tipo === 'economica' || msg.includes('cuota') || msg.includes('honorario')) {
                            if (typeof window.tab === 'function') window.tab('honorarios');
                            return;
                        }

                        // 3) Negocios/Propuestas
                        if (tipo === 'vencimiento' && (msg.includes('propuesta') || msg.includes('prospecto'))) {
                            if (typeof window.tab === 'function') window.tab('prospectos');
                            return;
                        }

                        // 4) Trámites
                        if (tipo === 'plazo' && (msg.includes('trámite') || msg.includes('tramite'))) {
                            if (typeof window.tab === 'function') window.tab('tramites');
                            return;
                        }

                        // 5) Fallback
                        if (typeof window.tab === 'function') window.tab('calendario');
                        return;
                    }
                }

                const overlay = _closest(t, '[data-action="close-modal-overlay"]');
                if (overlay) {
                    if (t === overlay) {
                        const modalId = overlay.getAttribute('data-modal-id');
                        if (modalId && typeof window.cerrarModal === 'function') window.cerrarModal(modalId);
                        return;
                    }
                }

                const closeWa = _closest(t, '[data-action="close-modal-wa"]');
                if (closeWa) {
                    if (typeof window.cerrarModalWA === 'function') window.cerrarModalWA();
                    return;
                }

                const waConfirm = _closest(t, '[data-action="wa-confirmar-sesion"]');
                if (waConfirm) {
                    if (typeof window.waConfirmarSesion === 'function') window.waConfirmarSesion();
                    return;
                }

                const waActionEl = _closest(t, '[data-action^="wa-"]');
                if (waActionEl) {
                    const action = waActionEl.getAttribute('data-action');

                    if (action === 'wa-enviar-resumen') {
                        if (typeof window.waEnviarResumen === 'function') window.waEnviarResumen();
                        return;
                    }
                    if (action === 'wa-revisar-cobros') {
                        if (typeof window.waRevisarCobrosAhora === 'function') window.waRevisarCobrosAhora();
                        return;
                    }

                    if (action === 'wa-guardar-principal') {
                        if (typeof window.waGuardarPrincipal === 'function') window.waGuardarPrincipal();
                        return;
                    }
                    if (action === 'wa-cancelar-principal') {
                        if (typeof window.waCancelarEdicionPrincipal === 'function') window.waCancelarEdicionPrincipal();
                        return;
                    }
                    if (action === 'wa-limpiar-destinos') {
                        if (typeof window.waLimpiarDestino === 'function') window.waLimpiarDestino();
                        return;
                    }
                    if (action === 'wa-guardar-dest') {
                        if (typeof window.waGuardarDestino === 'function') window.waGuardarDestino();
                        return;
                    }
                    if (action === 'wa-cancelar-dest') {
                        if (typeof window.waCancelarEdicionDestinatario === 'function') window.waCancelarEdicionDestinatario();
                        return;
                    }

                    if (action === 'wa-templates-restaurar') {
                        if (typeof window.waTemplatesRestaurarDefaults === 'function') window.waTemplatesRestaurarDefaults();
                        return;
                    }
                    if (action === 'wa-templates-guardar') {
                        if (typeof window.waTemplatesGuardar === 'function') window.waTemplatesGuardar();
                        return;
                    }
                    if (action === 'wa-tpl-insert-var') {
                        const varName = waActionEl.getAttribute('data-var');
                        if (typeof window.waTplInsertVar === 'function') window.waTplInsertVar(varName);
                        return;
                    }
                    if (action === 'wa-brand-guardar') {
                        if (typeof window.waBrandingGuardar === 'function') window.waBrandingGuardar();
                        return;
                    }
                    if (action === 'wa-brand-clear-logo') {
                        if (typeof window.waBrandingClearLogo === 'function') window.waBrandingClearLogo();
                        return;
                    }

                    if (action === 'wa-limpiar-logs') {
                        if (typeof window.waLimpiarLogs === 'function') window.waLimpiarLogs();
                        return;
                    }

                    if (action === 'wa-chat-enviar') {
                        if (typeof window.waChatEnviar === 'function') window.waChatEnviar();
                        return;
                    }
                    if (action === 'wa-chat-abrir') {
                        const chatId = waActionEl.getAttribute('data-chat-id');
                        if (typeof window.waChatAbrir === 'function') window.waChatAbrir(chatId);
                        return;
                    }

                    if (action === 'wa-templates-select') {
                        const key = waActionEl.getAttribute('data-wa-tpl');
                        if (typeof window.waTemplatesSelect === 'function') window.waTemplatesSelect(key);
                        return;
                    }

                    if (action === 'wa-principal-edit') {
                        const numero = waActionEl.getAttribute('data-num');
                        if (typeof window.waEditarPrincipal === 'function') window.waEditarPrincipal(numero);
                        return;
                    }
                    if (action === 'wa-principal-delete') {
                        const numero = waActionEl.getAttribute('data-num');
                        if (typeof window.waEliminarPrincipal === 'function') window.waEliminarPrincipal(numero);
                        return;
                    }

                    if (action === 'wa-dest-edit') {
                        const numero = waActionEl.getAttribute('data-num');
                        if (typeof window.waEditarDestinatario === 'function') window.waEditarDestinatario(numero);
                        return;
                    }
                    if (action === 'wa-dest-delete') {
                        const numero = waActionEl.getAttribute('data-num');
                        if (typeof window.waEliminarDestinatario === 'function') window.waEliminarDestinatario(numero);
                        return;
                    }
                }

                const closeBtn = _closest(t, '[data-action="close-modal"]');
                if (closeBtn) {
                    const modalId = closeBtn.getAttribute('data-modal-id');
                    if (modalId && typeof window.cerrarModal === 'function') window.cerrarModal(modalId);
                }

                const bibGuardar = _closest(t, '[data-action="bib-guardar"]');
                if (bibGuardar) {
                    if (typeof window.bibGuardarDocumento === 'function') window.bibGuardarDocumento();
                    return;
                }

                const migConfirm = _closest(t, '[data-action="mig-confirm"]');
                if (migConfirm) {
                    if (typeof window.migConfirmar === 'function') window.migConfirmar();
                    return;
                }
                const migCancel = _closest(t, '[data-action="mig-cancel"]');
                if (migCancel) {
                    if (typeof window.migCancelar === 'function') window.migCancelar();
                    return;
                }

                const backupManual = _closest(t, '[data-action="backup-crear-manual"]');
                if (backupManual) {
                    try {
                        if (window.AutoBackup && typeof window.AutoBackup.crearSnapshot === 'function') {
                            window.AutoBackup.crearSnapshot('manual');
                        }
                        if (typeof window.abrirHistorialBackups === 'function') window.abrirHistorialBackups();
                    } catch (_) { }
                    return;
                }

                const adjAbrir = _closest(t, '[data-action="adjuntos-abrir"]');
                if (adjAbrir) {
                    try {
                        const causaId = document.getElementById('adjunto-causa-id')?.value;
                        if (typeof window.adjuntosAbrir === 'function') window.adjuntosAbrir(causaId);
                    } catch (_) { }
                    return;
                }

                const iaAction = _closest(t, '[data-action^="ia-"]');
                if (iaAction) {
                    const action = iaAction.getAttribute('data-action');

                    if (action === 'ia-key-toggle') {
                        const pid = iaAction.getAttribute('data-provider');
                        if (typeof window._iaToggleVerKey === 'function') window._iaToggleVerKey(pid);
                        return;
                    }
                    if (action === 'ia-key-save') {
                        const pid = iaAction.getAttribute('data-provider');
                        if (typeof window._iaGuardarKeyUI === 'function') window._iaGuardarKeyUI(pid);
                        return;
                    }
                    if (action === 'ia-key-test') {
                        const pid = iaAction.getAttribute('data-provider');
                        if (typeof window._iaTestKeyUI === 'function') window._iaTestKeyUI(pid);
                        return;
                    }
                }

                const estudioAction = _closest(t, '[data-action^="estudio-"]');
                if (estudioAction) {
                    const action = estudioAction.getAttribute('data-action');
                    if (action === 'estudio-guardar-config') {
                        if (typeof window.estudioGuardarConfig === 'function') window.estudioGuardarConfig();
                        return;
                    }
                    if (action === 'estudio-limpiar-logo') {
                        if (typeof window.estudioLimpiarLogo === 'function') window.estudioLimpiarLogo();
                        return;
                    }
                }

                const pdfAction = _closest(t, '[data-action^="pdf-"]');
                if (pdfAction) {
                    const action = pdfAction.getAttribute('data-action');
                    if (action === 'pdf-elegir-carpeta-salida') {
                        if (typeof window.pdfElegirCarpetaSalida === 'function') await window.pdfElegirCarpetaSalida();
                        return;
                    }
                }

                const calAction = _closest(t, '[data-action^="cal-"]');
                if (calAction) {
                    const action = calAction.getAttribute('data-action');
                    if (action === 'cal-actualizar-alertas') {
                        if (typeof window.actualizarSistema === 'function') window.actualizarSistema();
                        else {
                            if (typeof window.evaluarAlertas === 'function') window.evaluarAlertas();
                            if (typeof window.renderCalendario === 'function') window.renderCalendario();
                        }
                        return;
                    }
                    if (action === 'cal-ver-causa') {
                        const causaId = calAction.getAttribute('data-causa-id');
                        if (causaId) {
                            if (typeof window.tab === 'function') window.tab('detalle-causa');
                            setTimeout(() => {
                                if (typeof window.abrirDetalleCausa === 'function') window.abrirDetalleCausa(causaId);
                            }, 80);
                        }
                        return;
                    }
                    if (action === 'cal-wa-alerta') {
                        const alertaId = calAction.getAttribute('data-alerta-id');
                        if (alertaId && typeof window.beEnviarAlertaWhatsApp === 'function') window.beEnviarAlertaWhatsApp(alertaId);
                        return;
                    }
                    if (action === 'cal-cerrar-alerta') {
                        const alertaId = calAction.getAttribute('data-alerta-id');
                        if (alertaId && typeof window.beCerrarAlerta === 'function') window.beCerrarAlerta(alertaId);
                        return;
                    }
                    if (action === 'cal-eliminar-alerta') {
                        const alertaId = calAction.getAttribute('data-alerta-id');
                        if (alertaId && typeof window.beEliminarAlerta === 'function') await window.beEliminarAlerta(alertaId);
                        return;
                    }
                    if (action === 'cal-crear-alerta') {
                        try {
                            const causaId = (document.getElementById('cal-causa-sel')?.value || '').toString().trim();
                            const tipo = (document.getElementById('cal-tipo')?.value || 'evento').toString().trim().toLowerCase();
                            const mensaje = (document.getElementById('cal-msg')?.value || '').toString().trim();
                            const fecha = (document.getElementById('cal-fecha')?.value || '').toString().trim();
                            const prioridad = (document.getElementById('cal-prioridad')?.value || 'media').toString().trim().toLowerCase();

                            if (!mensaje) {
                                if (typeof window.showError === 'function') window.showError('Ingrese un mensaje para la alerta.');
                                return;
                            }
                            if (!fecha) {
                                if (typeof window.showError === 'function') window.showError('Seleccione una fecha objetivo.');
                                return;
                            }

                            if (typeof window.crearAlerta === 'function') {
                                window.crearAlerta({
                                    causaId: causaId || null,
                                    tipo,
                                    mensaje,
                                    fechaObjetivo: fecha,
                                    prioridad,
                                    origen: 'manual'
                                });
                                if (typeof window.renderCalendario === 'function') window.renderCalendario();
                                if (typeof window.showSuccess === 'function') window.showSuccess('Alerta creada.');
                                const msgEl = document.getElementById('cal-msg');
                                if (msgEl) msgEl.value = '';
                            } else {
                                if (typeof window.showError === 'function') window.showError('No está disponible el motor de alertas.');
                            }
                        } catch (e) {
                            console.warn('[CAL] Error creando alerta manual:', e);
                            if (typeof window.showError === 'function') window.showError('No se pudo crear la alerta.');
                        }
                        return;
                    }
                    if (action === 'cal-export-ics') {
                        if (typeof window.exportCalendarioICS === 'function') window.exportCalendarioICS();
                        return;
                    }
                    if (action === 'cal-mes-prev') {
                        if (typeof window.calendarioMesPrev === 'function') window.calendarioMesPrev();
                        return;
                    }
                    if (action === 'cal-mes-next') {
                        if (typeof window.calendarioMesNext === 'function') window.calendarioMesNext();
                        return;
                    }
                }

                const usersAction = _closest(t, '[data-action^="users-"]');
                if (usersAction) {
                    const action = usersAction.getAttribute('data-action');
                    if (action === 'users-nuevo') {
                        if (typeof window.uiCrearUsuario === 'function') window.uiCrearUsuario(null);
                        return;
                    }
                    if (action === 'users-edit') {
                        const userId = usersAction.getAttribute('data-user-id');
                        if (typeof window.uiCrearUsuario === 'function') window.uiCrearUsuario(userId);
                        return;
                    }
                    if (action === 'users-delete') {
                        const userId = usersAction.getAttribute('data-user-id');
                        if (typeof window.eliminarUsuario === 'function') window.eliminarUsuario(userId);
                        return;
                    }
                    if (action === 'users-save') {
                        if (typeof window.guardarUsuario === 'function') await window.guardarUsuario();
                        return;
                    }
                    if (action === 'users-cancel') {
                        const modalId = usersAction.getAttribute('data-modal-id') || 'modal-nuevo-usuario';
                        if (typeof window.cerrarModal === 'function') window.cerrarModal(modalId);
                        return;
                    }
                    if (action === 'users-avatar-color') {
                        if (typeof window.selectAvatarColor === 'function') window.selectAvatarColor(usersAction);
                        return;
                    }
                    if (action === 'users-overrides-clear') {
                        if (typeof window.uiLimpiarPermOverrides === 'function') window.uiLimpiarPermOverrides();
                        return;
                    }
                }

                const adminKeyAction = _closest(t, '[data-action^="admin-clave-temp-"]');
                if (adminKeyAction) {
                    const action = adminKeyAction.getAttribute('data-action');
                    if (action === 'admin-clave-temp-generar') {
                        if (typeof window.uiGenerarClaveTemporalAdmin === 'function') await window.uiGenerarClaveTemporalAdmin();
                        return;
                    }
                    if (action === 'admin-clave-temp-revocar') {
                        if (typeof window.uiRevocarClaveTemporalAdmin === 'function') window.uiRevocarClaveTemporalAdmin();
                        return;
                    }
                }
            } catch (_) { }
        }, true);
    }

    function _bindGlobalInputs() {
        const waTplText = document.getElementById('wa-tpl-texto');
        if (waTplText && !waTplText._cspBound) {
            waTplText._cspBound = true;
            const run = () => { if (typeof window.waTemplatesOnChange === 'function') window.waTemplatesOnChange(); };
            waTplText.addEventListener('input', run);
            waTplText.addEventListener('change', run);
        }

        const waWeb = document.getElementById('wa-brand-weblink');
        if (waWeb && !waWeb._cspBound) {
            waWeb._cspBound = true;
            const run = () => { if (typeof window.waBrandingOnWebInput === 'function') window.waBrandingOnWebInput(); };
            waWeb.addEventListener('input', run);
            waWeb.addEventListener('change', run);
        }

        const waLogo = document.getElementById('wa-brand-logo');
        if (waLogo && !waLogo._cspBound) {
            waLogo._cspBound = true;
            waLogo.addEventListener('change', (ev) => {
                if (typeof window.waBrandingOnLogoChange === 'function') window.waBrandingOnLogoChange(ev);
            });
        }

        const waChatSearch = document.getElementById('wa-chat-search');
        if (waChatSearch && !waChatSearch._cspBound) {
            waChatSearch._cspBound = true;
            const run = () => { if (typeof window.waChatFiltrarLista === 'function') window.waChatFiltrarLista(); };
            waChatSearch.addEventListener('input', run);
            waChatSearch.addEventListener('change', run);
        }

        document.addEventListener('change', (ev) => {
            try {
                const t = ev.target;
                if (!t) return;
                const action = (typeof t.getAttribute === 'function') ? t.getAttribute('data-action') : null;
                if (!action) return;

                if (action === 'alertas-set-filtro') {
                    const val = String(t.value || 'todas');
                    window._alertMonitorState = window._alertMonitorState || { filtro: 'todas', orden: 'prioridad' };
                    window._alertMonitorState.filtro = val;
                    try { if (typeof window.renderAlerts === 'function') window.renderAlerts(); } catch (_) {}
                    return;
                }
                if (action === 'alertas-set-orden') {
                    const val = String(t.value || 'prioridad');
                    window._alertMonitorState = window._alertMonitorState || { filtro: 'todas', orden: 'prioridad' };
                    window._alertMonitorState.orden = val;
                    try { if (typeof window.renderAlerts === 'function') window.renderAlerts(); } catch (_) {}
                    return;
                }

                if (action === 'estudio-cargar-logo') {
                    if (typeof window.estudioCargarLogo === 'function') window.estudioCargarLogo(t);
                    return;
                }
                if (action === 'pdf-toggle-preguntar-guardar-como') {
                    if (typeof window.pdfTogglePreguntarGuardarComo === 'function') {
                        window.pdfTogglePreguntarGuardarComo(!!t.checked);
                    }
                    return;
                }

                if (action === 'users-rol-change') {
                    if (typeof window.uiUpdatePermisosPrev === 'function') window.uiUpdatePermisosPrev();
                    return;
                }

                if (action === 'users-override-select') {
                    if (typeof window.uiUpdatePermisosPrev === 'function') window.uiUpdatePermisosPrev();
                    return;
                }
            } catch (_) { }
        });
    }

    function _bindInteligenciaEstrategiaCalculadoras() {
        const estrategia = document.getElementById('estrategia');
        if (estrategia && !estrategia._cspBound) {
            estrategia._cspBound = true;
            estrategia.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'risk-select') {
                    if (typeof window.renderRisk === 'function') window.renderRisk();
                }
            });
        }

        const calculadora = document.getElementById('calculadora');
        if (calculadora && !calculadora._cspBound) {
            calculadora._cspBound = true;
            calculadora.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'calc-materia') {
                    if (typeof window.updateCalcHitos === 'function') window.updateCalcHitos();
                }
            });
            calculadora.addEventListener('click', (ev) => {
                const btn = _closest(ev.target, 'button');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (action === 'calc-run') {
                    if (typeof window.runCalc === 'function') window.runCalc();
                }
            });
        }

        const juris = document.getElementById('juris');
        if (juris && !juris._cspBound) {
            juris._cspBound = true;
            juris.addEventListener('click', (ev) => {
                const act = _closest(ev.target, '[data-action]');
                if (!act) return;
                const action = act.getAttribute('data-action');
                if (action === 'juris-add') {
                    if (typeof window.addJuris === 'function') window.addJuris();
                }
            });
        }

        const ficha = document.getElementById('ficha-estrategia');
        if (ficha && !ficha._cspBound) {
            ficha._cspBound = true;

            ficha.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'fe-causa') {
                    if (typeof window.cargarFichaEstrategia === 'function') window.cargarFichaEstrategia();
                }
            });

            const _recalcProb = () => {
                if (typeof window.calcularProbabilidad === 'function') window.calcularProbabilidad();
            };

            ficha.addEventListener('input', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'fe-prob') _recalcProb();
            });

            ficha.addEventListener('click', (ev) => {
                const act = _closest(ev.target, '[data-action]');
                if (!act) return;
                const action = act.getAttribute('data-action');
                if (!action) return;

                if (action === 'fe-tag') {
                    const scope = act.getAttribute('data-scope');
                    if (scope && typeof window.toggleTag === 'function') {
                        window.toggleTag(act, scope);
                        _recalcProb();
                    }
                    return;
                }
                if (action === 'fe-guardar') {
                    if (typeof window.guardarFichaEstrategia === 'function') window.guardarFichaEstrategia();
                    return;
                }
                if (action === 'fe-exportar') {
                    if (typeof window.exportarFichaEstrategia === 'function') window.exportarFichaEstrategia();
                    return;
                }
            });
        }

        const coherencia = document.getElementById('coherencia');
        if (coherencia && !coherencia._cspBound) {
            coherencia._cspBound = true;
            coherencia.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'coh-causa') {
                    if (typeof window.analizarCoherencia === 'function') window.analizarCoherencia();
                }
            });
        }

        const cuantia = document.getElementById('cuantia');
        if (cuantia && !cuantia._cspBound) {
            cuantia._cspBound = true;
            const _cqRecalc = () => {
                if (typeof window.calcularCuantia === 'function') window.calcularCuantia();
            };
            cuantia.addEventListener('input', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'cq-recalc') _cqRecalc();
            });
            cuantia.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'cq-recalc') _cqRecalc();
            });
        }

        const calcPro = document.getElementById('calculadora-pro');
        if (calcPro && !calcPro._cspBound) {
            calcPro._cspBound = true;
            const _cpRecalc = () => {
                if (typeof window.cpRecalcular === 'function') window.cpRecalcular();
            };
            calcPro.addEventListener('input', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'cp-recalc') _cpRecalc();
            });
            calcPro.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t || typeof t.getAttribute !== 'function') return;
                const action = t.getAttribute('data-action');
                if (action === 'cp-recalc') _cpRecalc();
            });
        }

        const waChatInput = document.getElementById('wa-chat-input');
        if (waChatInput && !waChatInput._cspBound) {
            waChatInput._cspBound = true;
            waChatInput.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter') return;
                ev.preventDefault();
                if (typeof window.waChatEnviar === 'function') window.waChatEnviar();
            });
        }
    }

    function _bindClientesHonorariosProspectos() {
        const clientes = document.getElementById('clientes');
        if (clientes && !clientes._cspBound) {
            clientes._cspBound = true;

            clientes.addEventListener('click', (ev) => {
                const btn = _closest(ev.target, 'button');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (!action) return;

                if (action === 'clientes-panel') {
                    const panelId = btn.getAttribute('data-panel');
                    if (panelId && typeof window.mostrarPanelClientes === 'function') {
                        window.mostrarPanelClientes(panelId, btn);
                    }
                    return;
                }

                if (action === 'hr-test-alerta') {
                    if (typeof window.uiTestAlertaCobro === 'function') window.uiTestAlertaCobro();
                    return;
                }
                if (action === 'hr-probar-scheduler') {
                    if (typeof window.uiProbarSchedulerCobros === 'function') window.uiProbarSchedulerCobros();
                    return;
                }
                if (action === 'hr-modificar') {
                    if (typeof window.uiHonorariosModificar === 'function') window.uiHonorariosModificar();
                    return;
                }
                if (action === 'hr-eliminar') {
                    if (typeof window.uiEliminarCobroCausa === 'function') window.uiEliminarCobroCausa();
                    return;
                }
                if (action === 'hr-asignar') {
                    if (typeof window.uiAsignarHonorarios === 'function') window.uiAsignarHonorarios();
                    return;
                }
                if (action === 'hr-registrar-pago') {
                    if (typeof window.uiRegistrarPago === 'function') window.uiRegistrarPago();
                    return;
                }
            });
        }

        const honVal = document.getElementById('hon-val');
        if (honVal && !honVal._cspBound) {
            honVal._cspBound = true;
            honVal.addEventListener('input', () => {
                if (typeof window.calcHon === 'function') window.calcHon();
            });
        }
    }

    function _bindGestorArchivos() {
        const archivos = document.getElementById('archivos');
        if (archivos && !archivos._cspBound) {
            archivos._cspBound = true;

            archivos.addEventListener('click', (ev) => {
                const el = ev.target;

                const act = _closest(el, '[data-action]');
                if (!act) return;
                const action = act.getAttribute('data-action');
                if (!action) return;

                if (action === 'ga-open-file') {
                    const fileInput = document.getElementById('file-input');
                    if (fileInput && typeof fileInput.click === 'function') fileInput.click();
                    return;
                }

                if (action === 'ga-toggle-view') {
                    if (typeof window.gaToggleView === 'function') window.gaToggleView();
                    return;
                }

                if (action === 'ga-guardar-doc') {
                    if (typeof window.gaGuardarDoc === 'function') window.gaGuardarDoc();
                    return;
                }

                if (action === 'ga-cancel-form') {
                    if (typeof window.gaCancelForm === 'function') window.gaCancelForm();
                    return;
                }

                if (action === 'ga-filter') {
                    const filter = act.getAttribute('data-filter');
                    if (filter && typeof window.gaFilter === 'function') window.gaFilter(filter, act);
                    return;
                }
            });

            archivos.addEventListener('change', (ev) => {
                const t = ev.target;
                if (!t) return;
                const action = typeof t.getAttribute === 'function' ? t.getAttribute('data-action') : null;
                if (!action) return;

                if (action === 'ga-select-causa') {
                    if (typeof window.gaSelectCausa === 'function') window.gaSelectCausa();
                    return;
                }

                if (action === 'ga-toggle-plazo') {
                    if (typeof window.gaTogglePlazo === 'function') window.gaTogglePlazo();
                    return;
                }

                if (action === 'ga-preview-plazo') {
                    if (typeof window.gaPreviewPlazo === 'function') window.gaPreviewPlazo();
                    return;
                }
            });

            archivos.addEventListener('input', (ev) => {
                const t = ev.target;
                if (!t) return;
                const action = typeof t.getAttribute === 'function' ? t.getAttribute('data-action') : null;
                if (action === 'ga-preview-plazo') {
                    if (typeof window.gaPreviewPlazo === 'function') window.gaPreviewPlazo();
                }
            });
        }
    }

    function _bindNotifications() {
        const panel = document.getElementById('notif-panel');
        const overlay = document.getElementById('notif-overlay');

        if (panel && !panel._cspBound) {
            panel._cspBound = true;
            panel.addEventListener('click', (ev) => {
                const btn = _closest(ev.target, 'button');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (!action) return;
                if (action === 'notif-marcar-todas') {
                    if (typeof window.notifMarcarTodasLeidas === 'function') window.notifMarcarTodasLeidas();
                    return;
                }
                if (action === 'notif-limpiar') {
                    if (typeof window.notifLimpiarTodo === 'function') window.notifLimpiarTodo();
                    return;
                }
                if (action === 'notif-toggle') {
                    if (typeof window.notifTogglePanel === 'function') window.notifTogglePanel();
                }
            });
        }
        if (overlay && !overlay._cspBound) {
            overlay._cspBound = true;
            overlay.addEventListener('click', () => {
                if (typeof window.notifTogglePanel === 'function') window.notifTogglePanel();
            });
        }
    }

    function _bindDashboard() {
        const filtros = document.getElementById('db-filtros');
        if (filtros && !filtros._cspBound) {
            filtros._cspBound = true;
            filtros.addEventListener('change', (ev) => {
                const sel = ev.target;
                if (!(sel instanceof HTMLSelectElement)) return;
                const action = sel.getAttribute('data-action');
                if (action !== 'dashboard-filter') return;
                if (typeof window.renderDashboardPanel === 'function') window.renderDashboardPanel();
            });
            filtros.addEventListener('click', (ev) => {
                const btn = _closest(ev.target, 'button');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (action === 'dashboard-clear') {
                    if (typeof window.limpiarFiltrosPanel === 'function') window.limpiarFiltrosPanel();
                }
            });
        }

        const header = document.querySelector('#panel .db-header-right');
        if (header && !header._cspBound) {
            header._cspBound = true;
            header.addEventListener('click', (ev) => {
                const btn = _closest(ev.target, 'button');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (!action) return;
                if (action === 'set-modo') {
                    const modo = btn.getAttribute('data-modo');
                    if (modo && typeof window.setModo === 'function') window.setModo(modo);
                    return;
                }
                if (action === 'exportar-pdf-economico') {
                    if (typeof window.exportarPDFEconomico === 'function') window.exportarPDFEconomico();
                }
            });
        }
    }

    function _bindLogin() {
        document.addEventListener('click', (ev) => {
            const btn = _closest(ev.target, 'button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            if (!action) return;

            if (action === 'login-volver') {
                if (typeof window.loginVolver === 'function') window.loginVolver();
                return;
            }
            if (action === 'login-auth') {
                if (typeof window.auth === 'function') window.auth();
                return;
            }
            if (action === 'reset-bloqueo') {
                if (typeof window.resetBloqueo === 'function') window.resetBloqueo();
                return;
            }
        });

        const pw = document.getElementById('pw');
        if (pw && !pw._cspBound) {
            pw._cspBound = true;
            pw.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    if (typeof window.auth === 'function') window.auth();
                }
            });
        }
    }

    function _bindTopbar() {
        const topbar = document.getElementById('topbar');
        if (!topbar) return;

        topbar.addEventListener('click', (ev) => {
            const btn = _closest(ev.target, 'button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            if (!action) return;

            if (action === 'toggle-sidebar') {
                if (typeof window.toggleSidebar === 'function') window.toggleSidebar();
                return;
            }
            if (action === 'guardar-global') {
                if (typeof window.guardarCambiosGlobal === 'function') window.guardarCambiosGlobal();
                return;
            }
            if (action === 'toggle-theme') {
                if (typeof window.toggleTheme === 'function') window.toggleTheme();
                return;
            }
            if (action === 'notif-toggle') {
                if (typeof window.notifTogglePanel === 'function') window.notifTogglePanel();
                return;
            }
        });

        const search = document.getElementById('topbar-search-input');
        if (search && !search._cspBound) {
            search._cspBound = true;
            search.addEventListener('input', () => {
                if (typeof window.busquedaGlobal === 'function') {
                    if (typeof window.tab === 'function') window.tab('busqueda', null);
                }
            });
        }
    }

    function initEventListeners() {
        _bindSidebarNavigation();
        _bindGlobalModals();
        _bindGlobalInputs();
        _bindNotifications();
        _bindLogin();
        _bindTopbar();
        _bindDashboard();
        _bindClientesHonorariosProspectos();
        _bindGestorArchivos();
        _bindInteligenciaEstrategiaCalculadoras();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventListeners);
    } else {
        initEventListeners();
    }
})();
