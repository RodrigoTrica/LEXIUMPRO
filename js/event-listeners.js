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
        document.addEventListener('click', (ev) => {
            const el = ev.target;
            const overlayWa = _closest(el, '[data-action="close-modal-overlay-wa"]');
            if (overlayWa) {
                if (ev.target === overlayWa) {
                    if (typeof window.cerrarModalWA === 'function') window.cerrarModalWA();
                }
                return;
            }

            const overlay = _closest(el, '[data-action="close-modal-overlay"]');
            if (overlay) {
                if (ev.target === overlay) {
                    const modalId = overlay.getAttribute('data-modal-id');
                    if (modalId && typeof window.cerrarModal === 'function') window.cerrarModal(modalId);
                }
                return;
            }

            const closeWa = _closest(el, '[data-action="close-modal-wa"]');
            if (closeWa) {
                if (typeof window.cerrarModalWA === 'function') window.cerrarModalWA();
                return;
            }

            const waConfirm = _closest(el, '[data-action="wa-confirmar-sesion"]');
            if (waConfirm) {
                if (typeof window.waConfirmarSesion === 'function') window.waConfirmarSesion();
                return;
            }

            const closeBtn = _closest(el, '[data-action="close-modal"]');
            if (closeBtn) {
                const modalId = closeBtn.getAttribute('data-modal-id');
                if (modalId && typeof window.cerrarModal === 'function') window.cerrarModal(modalId);
            }

            const bibGuardar = _closest(el, '[data-action="bib-guardar"]');
            if (bibGuardar) {
                if (typeof window.bibGuardarDocumento === 'function') window.bibGuardarDocumento();
                return;
            }

            const migConfirm = _closest(el, '[data-action="mig-confirm"]');
            if (migConfirm) {
                if (typeof window.migConfirmar === 'function') window.migConfirmar();
                return;
            }
            const migCancel = _closest(el, '[data-action="mig-cancel"]');
            if (migCancel) {
                if (typeof window.migCancelar === 'function') window.migCancelar();
                return;
            }

            const backupManual = _closest(el, '[data-action="backup-crear-manual"]');
            if (backupManual) {
                try {
                    if (window.AutoBackup && typeof window.AutoBackup.crearSnapshot === 'function') {
                        window.AutoBackup.crearSnapshot('manual');
                    }
                    if (typeof window.abrirHistorialBackups === 'function') window.abrirHistorialBackups();
                } catch (_) { }
                return;
            }

            const adjAbrir = _closest(el, '[data-action="adjuntos-abrir"]');
            if (adjAbrir) {
                try {
                    const causaId = document.getElementById('adjunto-causa-id')?.value;
                    if (typeof window.adjuntosAbrir === 'function') window.adjuntosAbrir(causaId);
                } catch (_) { }
                return;
            }
        });
    }

    function _bindGlobalInputs() {
        const inp = document.getElementById('adjunto-file-input');
        if (inp && !inp._cspBound) {
            inp._cspBound = true;
            inp.addEventListener('change', () => {
                if (typeof window.adjuntosOnFileSelect === 'function') window.adjuntosOnFileSelect(inp);
            });
        }
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
