/**
 * LEXIUM - Prospectos CRM v2
 * Módulo 23: UI Principal (Kanban, Formularios, Vista Detalle)
 */

(function () {
    // Estado global en memoria para renderizado rápido
    let estadoCRM = {
        prospectoAbierto: null,
        filtroTexto: '',
        vista: 'lista',
        filtroEtapa: 'todas'
    };

    // Borrado global (necesario para que funcione desde el panel derecho y Kanban)
    window.crmEliminarProspecto = function (prospectoId) {
        if (!confirm('¿Eliminar prospecto? Esta acción es irreversible.')) return;
        if (!Array.isArray(DB.prospectos)) DB.prospectos = [];
        if (!Array.isArray(DB.propuestas)) DB.propuestas = [];
        if (!Array.isArray(DB.causas)) DB.causas = [];

        const prospectoPrev = DB.prospectos.find(x => x && x.id === prospectoId) || null;

        const idx = DB.prospectos.findIndex(x => x && x.id === prospectoId);
        if (idx >= 0) DB.prospectos.splice(idx, 1);

        try {
            DB.propuestas = DB.propuestas.filter(pr => pr && pr.prospectoId !== prospectoId);
        } catch (_) {}

        // Limpiar causas originadas desde este prospecto (evita "fantasmas" en Gestión de Causas)
        try {
            DB.causas = DB.causas.filter(c => {
                if (!c) return false;
                if (String(c.prospectoId || '') === String(prospectoId)) return false;
                if (prospectoPrev?.causaVinculadaId && String(c.id) === String(prospectoPrev.causaVinculadaId)) return false;
                return true;
            });
        } catch (_) {}

        if (estadoCRM.prospectoAbierto === prospectoId) estadoCRM.prospectoAbierto = null;

        if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();
        prospectosRender();
        if (typeof showSuccess === 'function') showSuccess('Prospecto eliminado.');
    };

    let _crmFiltroTimer = null;

    // Mapeo de columnas Kanban
    const ETAPAS = [
        { id: 'contacto', nombre: 'CONTACTO', color: '#64748b' },
        { id: 'propuesta', nombre: 'PROPUESTA', color: '#0ea5e9' },
        { id: 'negociacion', nombre: 'NEGOCIACIÓN', color: '#f59e0b' },
        { id: 'ganado', nombre: 'GANADO', color: '#10b981' },
        { id: 'perdido', nombre: 'PERDIDO', color: '#ef4444' }
    ];

    // CSS Inline
    const styleId = 'prospectos-crm-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* Contenedor Principal */
            #prospectos-crm {
                height: 100%;
                display: flex;
                flex-direction: column;
                background: var(--bg-card, #f8fafc);
                color: var(--text-1, #1e293b);
                border: 1px solid var(--border, #e2e8f0);
                border-radius: 14px;
                overflow: hidden;
                font-family: inherit;
            }
            .crm-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                background: var(--bg-card, #ffffff);
                border-bottom: 1px solid var(--border, #e2e8f0);
            }
            .crm-header-left h2 {
                margin: 0;
                font-size: 20px;
                color: var(--primary, #0f3460);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .crm-header-stats {
                display: flex;
                gap: 15px;
                margin-top: 8px;
                font-size: 12px;
                color: var(--text-light, #64748b);
            }
            .crm-stat-badge {
                background: var(--bg-2, #f1f5f9);
                padding: 4px 8px;
                border-radius: 12px;
                font-weight: 600;
            }

            /* Tablero Kanban */
            .kanban-board {
                display: flex;
                flex: 1;
                gap: 15px;
                padding: 20px;
                overflow-x: auto;
                align-items: flex-start;
                scrollbar-width: thin;
            }

            /* Layout maestro-detalle */
            .crm-split {
                display: flex;
                flex: 1;
                min-height: 0;
                background: var(--bg-card, #0b1220);
            }
            .crm-master {
                width: 360px;
                min-width: 320px;
                max-width: 420px;
                border-right: 1px solid var(--border, rgba(148,163,184,0.25));
                display: flex;
                flex-direction: column;
                min-height: 0;
                background: var(--bg-card, #0b1220);
            }
            .crm-master-controls {
                padding: 12px;
                border-bottom: 1px solid var(--border, rgba(148,163,184,0.25));
                display: flex;
                flex-direction: column;
                gap: 8px;
                background: var(--bg-card, #0b1220);
            }
            .crm-master-row {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .crm-master-row .common-input {
                flex: 1;
                padding: 8px 10px;
                border: 1px solid var(--border, rgba(148,163,184,0.25));
                border-radius: 8px;
                background: var(--bg-2, rgba(148,163,184,0.12));
                color: var(--text-1, #e5e7eb);
                font-size: 12px;
            }
            .crm-master-tabs {
                display: flex;
                gap: 8px;
            }
            .crm-tab {
                flex: 1;
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid var(--border, rgba(148,163,184,0.25));
                background: var(--bg-2, rgba(148,163,184,0.12));
                color: var(--text-1, #e5e7eb);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            }
            .crm-tab.active {
                background: var(--primary, #0f3460);
                color: #fff;
                border-color: transparent;
            }
            .crm-master-content {
                flex: 1;
                overflow: auto;
                padding: 10px;
                min-height: 0;
                background: var(--bg-card, #0b1220);
            }
            .crm-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .crm-list-item {
                border: 1px solid var(--border, rgba(148,163,184,0.18));
                background: var(--bg-2, rgba(148,163,184,0.10));
                border-radius: 10px;
                padding: 10px;
                cursor: pointer;
            }
            .crm-list-item.active {
                outline: 2px solid rgba(14,165,233,0.45);
                border-color: rgba(14,165,233,0.6);
            }
            .crm-li-title {
                font-weight: 800;
                font-size: 13px;
                color: var(--text-1, #e5e7eb);
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                gap: 8px;
            }
            .crm-li-sub {
                font-size: 11px;
                color: var(--text-3, #94a3b8);
                display: flex;
                justify-content: space-between;
                gap: 8px;
            }
            .crm-li-badges {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .crm-pill {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 999px;
                border: 1px solid var(--border, rgba(148,163,184,0.25));
                background: var(--bg-card, rgba(148,163,184,0.08));
                color: var(--text-2, #cbd5e1);
                font-weight: 700;
                text-transform: uppercase;
            }
            .crm-detail {
                flex: 1;
                min-width: 0;
                padding: 14px;
                overflow: auto;
                background: var(--bg-card, #0b1220);
                min-height: 0;
            }
            .crm-detail-empty {
                border: 1px dashed var(--border, rgba(148,163,184,0.35));
                background: var(--bg-2, rgba(148,163,184,0.10));
                border-radius: 12px;
                padding: 18px;
                color: var(--text-2, #cbd5e1);
                font-size: 13px;
            }
            .kanban-column {
                flex: 0 0 280px;
                background: var(--bg-2, rgba(148,163,184,0.10));
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                max-height: 100%;
                border: 1px solid var(--border, rgba(148,163,184,0.25));
            }
            .kanban-column-header {
                padding: 12px 15px;
                font-weight: 700;
                font-size: 13px;
                border-bottom: 2px solid;
                display: flex;
                justify-content: space-between;
                align-items: center;
                text-transform: uppercase;
                border-radius: 8px 8px 0 0;
                background: var(--bg-card, #ffffff);
                color: var(--text-1, #1e293b);
            }
            .kanban-cards {
                padding: 10px;
                overflow-y: auto;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
                min-height: 50px;
            }

            /* Tarjetas */
            .kanban-card {
                background: var(--bg-card, #ffffff);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-left: 4px solid transparent;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                border: 1px solid var(--border, #e2e8f0);
            }
            .kanban-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .kanban-card-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 6px;
                color: var(--text-1, #1e293b);
            }
            .kanban-card-meta {
                font-size: 11px;
                color: var(--text-3, #64748b);
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 8px;
            }
            .risk-badge {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                color: #fff;
            }
            .risk-alto { background: #ef4444; }
            .risk-medio { background: #f59e0b; }
            .risk-bajo { background: #10b981; }

            /* Modales Específicos CRM */
            .crm-modal-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .crm-form-group {
                display: flex;
                flex-direction: column;
                margin-bottom: 15px;
            }
            .crm-form-group.full {
                grid-column: 1 / -1;
            }
            .crm-form-group label {
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 5px;
                color: var(--text-light);
            }
            .crm-form-group input, .crm-form-group select, .crm-form-group textarea {
                padding: 8px 10px;
                border: 1px solid var(--border);
                border-radius: 4px;
                font-size: 13px;
                font-family: inherit;
                background: var(--bg-card, #ffffff);
                color: var(--text-1, #1e293b);
            }
            
            /* Vista Detalle */
            .crm-detalle-layout {
                display: flex;
                gap: 20px;
            }
            .crm-detalle-main {
                flex: 2;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .crm-detalle-side {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .crm-card {
                background: var(--bg-card, #ffffff);
                border-radius: 8px;
                padding: 15px;
                border: 1px solid var(--border);
                color: var(--text-1, #1e293b);
                font-family: inherit;
            }
            .crm-card h4 {
                margin: 0 0 10px 0;
                font-size: 13px;
                color: var(--primary);
                border-bottom: 1px solid var(--border);
                padding-bottom: 5px;
            }
            
            /* Notas List */
            .crm-notas-list {
                max-height: 250px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .crm-nota-item {
                background: var(--bg-2);
                padding: 10px;
                border-radius: 6px;
                font-size: 12px;
            }
            .crm-nota-fecha {
                font-size: 10px;
                color: var(--text-light);
                margin-bottom: 4px;
            }
            
            /* Botones adicionales */
            .btn-ganado { background: #10b981; color: white; }
            .btn-perdido { background: #ef4444; color: white; }

            @media (max-width: 900px) {
                .crm-header {
                    padding: 14px;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 10px;
                }
                .crm-header-left h2 {
                    font-size: 17px;
                }
                .crm-header-stats {
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .kanban-board {
                    padding: 12px;
                    gap: 10px;
                }
                .kanban-column {
                    flex-basis: 250px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDERIZADO PRINCIPAL (KANBAN)
    // ═════════════════════════════════════════════════════════════════════════
    window.prospectosRender = function () {
        const container = document.getElementById('prospectos-crm');
        if (!container) return;

        if (!window.DB) window.DB = DB;
        if (!Array.isArray(DB.prospectos)) DB.prospectos = [];
        if (!Array.isArray(DB.propuestas)) DB.propuestas = [];

        const prospectos = DB.prospectos;

        // Calcular stats
        const stats = ETAPAS.map(e => ({
            ...e,
            count: prospectos.filter(p => (p.etapa || 'contacto') === e.id).length
        }));

        const totalValue = prospectos
            .filter(p => p.etapa !== 'perdido')
            .reduce((sum, p) => {
                const prop = DB.propuestas.find(pr => pr.prospectoId === p.id);
                return sum + (prop ? (prop.montoTotal || 0) : 0);
            }, 0);

        let html = `
            <div class="crm-header">
                <div class="crm-header-left">
                    <h2><i class="fas fa-funnel-dollar"></i> CRM · Gestión de Prospectos</h2>
                    <div class="crm-header-stats">
                        <span class="crm-stat-badge">Total Activos: ${prospectos.filter(p => !['ganado', 'perdido'].includes(p.etapa)).length}</span>
                        <span class="crm-stat-badge" style="color:#10b981;">Pipeline: $${totalValue.toLocaleString('es-CL')}</span>
                    </div>
                </div>
                <div class="crm-header-right">
                    <button class="btn btn-p" onclick="crmAbrirModalProspecto()"><i class="fas fa-plus"></i> Nuevo Prospecto</button>
                </div>
            </div>
            <div class="crm-split">
                <div class="crm-master">
                    <div class="crm-master-controls">
                        <div class="crm-master-row">
                            <input class="common-input" id="crm-q" placeholder="Buscar prospecto..." value="${(estadoCRM.filtroTexto || '').replace(/"/g, '&quot;')}" oninput="crmSetFiltroTexto(this.value)">
                        </div>
                        <div class="crm-master-row">
                            <select class="common-input" id="crm-f-etapa" onchange="crmSetFiltroEtapa(this.value)">
                                <option value="todas" ${estadoCRM.filtroEtapa === 'todas' ? 'selected' : ''}>Todas las etapas</option>
                                ${ETAPAS.map(e => `<option value="${e.id}" ${estadoCRM.filtroEtapa === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="crm-master-tabs">
                            <button class="crm-tab ${estadoCRM.vista === 'lista' ? 'active' : ''}" onclick="crmSetVista('lista')">Lista</button>
                            <button class="crm-tab ${estadoCRM.vista === 'kanban' ? 'active' : ''}" onclick="crmSetVista('kanban')">Kanban</button>
                        </div>
                    </div>
                    <div class="crm-master-content">
                        ${renderMaster(estadoCRM.vista, prospectos)}
                    </div>
                </div>
                <div class="crm-detail" id="crm-detail-pane">
                    ${renderDetallePanel(estadoCRM.prospectoAbierto)}
                </div>
            </div>
        `;

        container.innerHTML = html;
    };

    window.crmSetVista = function (vista) {
        estadoCRM.vista = (vista === 'kanban') ? 'kanban' : 'lista';
        prospectosRender();
    };

    window.crmSetFiltroTexto = function (txt) {
        estadoCRM.filtroTexto = String(txt || '');
        if (_crmFiltroTimer) clearTimeout(_crmFiltroTimer);
        _crmFiltroTimer = setTimeout(() => {
            prospectosRender();
        }, 120);
    };

    window.crmSetFiltroEtapa = function (et) {
        estadoCRM.filtroEtapa = String(et || 'todas');
        prospectosRender();
    };

    window.crmSelectProspecto = function (id) {
        estadoCRM.prospectoAbierto = id || null;
        const pane = document.getElementById('crm-detail-pane');
        if (pane) pane.innerHTML = renderDetallePanel(estadoCRM.prospectoAbierto);
        const items = document.querySelectorAll('.crm-list-item');
        if (items && items.length) {
            items.forEach(el => {
                try {
                    const pid = el.getAttribute('data-prospecto-id');
                    if (pid && pid === id) el.classList.add('active');
                    else el.classList.remove('active');
                } catch (_) {}
            });
        }
    };

    function _crmTextoIncluye(p, q) {
        if (!q) return true;
        const qq = String(q || '').toLowerCase().trim();
        if (!qq) return true;
        const bag = [p?.nombre, p?.rut, p?.telefono, p?.email, p?.materia, p?.descripcion, p?.estrategia, p?.tramiteObjetivo]
            .filter(Boolean)
            .map(x => String(x).toLowerCase());
        return bag.some(x => x.includes(qq));
    }

    function renderMaster(vista, prospectos) {
        const etapa = estadoCRM.filtroEtapa;
        const q = estadoCRM.filtroTexto;
        const lista = (prospectos || [])
            .filter(p => etapa === 'todas' ? true : ((p.etapa || 'contacto') === etapa))
            .filter(p => _crmTextoIncluye(p, q))
            .slice()
            .sort((a, b) => {
                const da = new Date(a.fechaActualizacion || a.fechaContacto || a.fechaCreacion || 0).getTime();
                const db = new Date(b.fechaActualizacion || b.fechaContacto || b.fechaCreacion || 0).getTime();
                return db - da;
            });

        if (vista === 'kanban') {
            return `<div class="kanban-board" style="padding:0; gap:10px;">
                ${ETAPAS.map(et => renderColumna(et, lista)).join('')}
            </div>`;
        }

        if (!lista.length) {
            return `<div style="font-size:12px; color:var(--text-3,#64748b); text-align:center; padding:12px 10px; border:1px dashed var(--border,#cbd5e1); border-radius:10px; background:var(--bg-2,#f1f5f9);">
                Sin resultados.
            </div>`;
        }

        return `<div class="crm-list">
            ${lista.map(p => {
                const etapaNombre = (ETAPAS.find(e => e.id === (p.etapa || 'contacto')) || {}).nombre || (p.etapa || 'CONTACTO');
                const fecha = new Date(p.fechaContacto || p.fechaCreacion || Date.now()).toLocaleDateString('es-CL');
                const tipo = (p.tipoExpediente || 'judicial');
                const activo = (estadoCRM.prospectoAbierto === p.id) ? 'active' : '';
                return `
                    <div class="crm-list-item ${activo}" data-prospecto-id="${p.id}" onclick="crmSelectProspecto('${p.id}')">
                        <div class="crm-li-title">
                            <span>${p.nombre}</span>
                            <span class="crm-li-badges">
                                <span class="crm-pill">${etapaNombre}</span>
                            </span>
                        </div>
                        <div class="crm-li-sub">
                            <span style="text-transform:capitalize;">${tipo === 'tramite' ? 'Trámite' : 'Judicial'} · ${(p.materia || '—')}</span>
                            <span>${fecha}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>`;
    }

    function renderColumna(etapa, todosProspectos) {
        const prospectos = todosProspectos.filter(p => (p.etapa || 'contacto') === etapa.id);

        let cardsHtml = prospectos.map(p => `
            <div class="kanban-card" style="border-left-color: ${etapa.color}" onclick="crmSelectProspecto('${p.id}')">
                <div class="kanban-card-title">${p.nombre}</div>
                <div style="font-size:12px; color:var(--text-light); margin-bottom:4px;">
                    <i class="fas fa-gavel"></i> <span style="text-transform:capitalize;">${p.materia || 'General'}</span>
                </div>
                ${p.telefono ? `<div style="font-size:11px; margin-bottom:4px;"><i class="fas fa-phone"></i> ${p.telefono}</div>` : ''}
                <div class="kanban-card-meta">
                    <span><i class="far fa-calendar"></i> ${new Date(p.fechaContacto || p.fechaCreacion).toLocaleDateString('es-CL')}</span>
                    <span class="risk-badge risk-${(p.riesgo || 'medio').toLowerCase()}">${p.riesgo || 'Medio'}</span>
                </div>
            </div>
        `).join('');

        if (!cardsHtml) {
            cardsHtml = `
                <div style="font-size:12px; color:var(--text-3,#64748b); text-align:center; padding:12px 10px; border:1px dashed var(--border,#cbd5e1); border-radius:8px; background:var(--bg-card,#fff);">
                    Sin prospectos en esta etapa.
                </div>
            `;
        }

        if (prospectos.length === 0) {
            cardsHtml = `
                <div style="text-align:center; padding:16px 10px; color:var(--text-3); font-size:12px; border:1px dashed var(--border,#cbd5e1); border-radius:8px; background:var(--bg-card,#fff);">
                    Aún no hay prospectos.
                    <div style="margin-top:10px;">
                        <button class="btn btn-xs btn-p" onclick="crmAbrirModalProspecto()"><i class="fas fa-plus"></i> Crear primer prospecto</button>
                    </div>
                </div>`;
        }

        return `
            <div class="kanban-column">
                <div class="kanban-column-header" style="border-bottom-color: ${etapa.color}">
                    <span>${etapa.nombre}</span>
                    <span class="badge" style="background:var(--text-light); color:white;">${prospectos.length}</span>
                </div>
                <div class="kanban-cards" id="kanban-col-${etapa.id}">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    function renderDetallePanel(id) {
        const p = (DB.prospectos || []).find(x => x.id === id);
        if (!p) {
            return `<div class="crm-detail-empty">
                Selecciona un prospecto para ver su ficha a la derecha.
            </div>`;
        }

        const propuesta = (DB.propuestas || []).find(pr => pr.prospectoId === p.id);
        return `
            <div class="crm-detalle-layout" style="gap:14px;">
                <div class="crm-detalle-main">
                    <div class="crm-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                            <div>
                                <h3 style="margin:0 0 5px 0; color:var(--primary); font-size:18px;">${p.nombre}</h3>
                                <div style="font-size:12px; color:var(--text-light);"><i class="fas fa-barcode"></i> ${p.rut || 'Sin RUT'} | <i class="fas fa-envelope"></i> ${p.email || 'Sin Email'} | <i class="fas fa-phone"></i> ${p.telefono || 'Sin Tel'}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn btn-xs" onclick="crmAbrirModalProspecto('${p.id}')"><i class="fas fa-edit"></i> Editar</button>
                                <button class="btn btn-xs btn-d" onclick="crmEliminarProspecto('${p.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>

                        <div style="display:flex; gap:10px; margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
                            <div style="flex:1;">
                                <strong>Tipo:</strong> <span style="text-transform:capitalize;">${p.tipoExpediente || 'judicial'}</span><br>
                                <strong>Materia:</strong> <span style="text-transform:capitalize;">${p.materia || '—'}</span><br>
                                <strong>Riesgo:</strong> <span class="risk-badge risk-${p.riesgo}">${p.riesgo}</span>
                            </div>
                            <div style="flex:1;">
                                <strong>Etapa CRM:</strong> <span style="text-transform:uppercase; color:var(--accent); font-weight:600;">${p.etapa}</span><br>
                                <strong>Creación:</strong> ${new Date(p.fechaCreacion).toLocaleDateString()}
                            </div>
                        </div>

                        <div style="margin-top:12px;">
                            <h4 style="margin:0 0 5px 0; font-size:12px; font-weight:700;">Descripción del Caso</h4>
                            <div style="font-size:12px; white-space:pre-wrap; background:var(--bg-2); padding:10px; border-radius:6px;">${p.descripcion || '<i>No ingresada</i>'}</div>
                        </div>
                        <div style="margin-top:10px;">
                            <h4 style="margin:0 0 5px 0; font-size:12px; font-weight:700;">Estrategia Sugerida</h4>
                            <div style="font-size:12px; white-space:pre-wrap; background:var(--bg-2); padding:10px; border-radius:6px; border-left:3px solid var(--accent);">${p.estrategia || '<i>No ingresada</i>'}</div>
                        </div>
                    </div>

                    ${propuesta ? `
                    <div class="crm-card">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4><i class="fas fa-file-invoice-dollar"></i> Propuesta Económica Activa</h4>
                            <button class="btn btn-xs btn-p" onclick="crmGenerarPDFPropuesta('${propuesta.id}')"><i class="fas fa-file-pdf"></i> Generar PDF</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; margin-top:10px;">
                            <div><strong>Monto Total:</strong> $${(propuesta.montoTotal || 0).toLocaleString('es-CL')}</div>
                            <div><strong>Tipo:</strong> ${propuesta.tipoHonorarios === 'variable' ? 'Porcentaje de Resultados' : 'Honorarios Fijos'}</div>
                            <div><strong>Forma de Pago:</strong> ${propuesta.formaPago === 'cuotas' ? propuesta.numeroCuotas + ' cuotas' : 'Contado'}</div>
                            <div><strong>Vigencia:</strong> ${new Date(propuesta.fechaVigencia).toLocaleDateString()}</div>
                        </div>
                    </div>
                    ` : `
                    <div class="crm-card" style="text-align:center; padding:26px 10px; background:var(--bg-2);">
                        <i class="fas fa-file-invoice-dollar" style="font-size:24px; color:var(--text-3); margin-bottom:10px;"></i>
                        <p style="font-size:13px; color:var(--text-2); margin-top:0;">El prospecto aún no tiene una propuesta económica generada.</p>
                        <button class="btn btn-p" onclick="crmAbrirModalPropuesta('${p.id}')"><i class="fas fa-plus"></i> Crear Propuesta</button>
                    </div>
                    `}
                </div>

                <div class="crm-detalle-side">
                    <div class="crm-card">
                        <h4><i class="fas fa-exchange-alt"></i> Acciones de Pipeline</h4>
                        <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                            <label style="font-size:11px; font-weight:600;">Cambiar etapa a:</label>
                            <select id="crm-cambiar-etapa" class="common-input" style="font-size:12px; padding:6px;" onchange="crmCambiarEtapa('${p.id}', this.value)">
                                ${ETAPAS.filter(e => !['ganado', 'perdido'].includes(e.id)).map(e => `<option value="${e.id}" ${p.etapa === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}
                            </select>
                            <hr style="border:0; border-top:1px solid var(--border); width:100%; margin:5px 0;">
                            ${p.etapa === 'negociacion' ? `
                                <button class="btn btn-ganado" onclick="prospectosConvertirACausa('${p.id}')">
                                    <i class="fas fa-check-circle"></i> Propuesta ACEPTADA
                                </button>
                                <button class="btn btn-perdido" onclick="crmCambiarEtapa('${p.id}', 'perdido')">
                                    <i class="fas fa-times-circle"></i> Propuesta RECHAZADA
                                </button>
                            ` : `
                                <button class="btn btn-perdido" onclick="crmCambiarEtapa('${p.id}', 'perdido')" ${p.etapa === 'perdido' ? 'disabled' : ''}>
                                    <i class="fas fa-times-circle"></i> Marcar como PERDIDO
                                </button>
                            `}
                        </div>
                    </div>

                    <div class="crm-card" style="flex:1; display:flex; flex-direction:column;">
                        <h4><i class="fas fa-sticky-note"></i> Bitácora del Prospecto</h4>
                        <div class="crm-notas-list" style="flex:1; margin-bottom:10px;">
                            ${(p.notas || []).length === 0 ? '<div style="font-size:11px; color:var(--text-3); text-align:center; padding:20px 0;">Sin notas.</div>' : ''}
                            ${(p.notas || []).slice().reverse().map(n => `
                                <div class="crm-nota-item">
                                    <div class="crm-nota-fecha">${new Date(n.fecha).toLocaleString('es-CL')}</div>
                                    <div>${n.texto}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex; gap:5px; margin-top:auto; align-items:flex-end;">
                            <textarea id="crm-in-nota" rows="2" style="flex:1; padding:6px 10px; font-size:12px; border:1px solid var(--border); border-radius:6px; background:var(--bg-2); color:var(--text-1); resize:vertical; min-height:34px; max-height:120px; font-family:inherit;" placeholder="Escribir nota..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();crmAgregarNota('${p.id}')}" ></textarea>
                            <button class="btn btn-xs btn-p" onclick="crmAgregarNota('${p.id}')"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MODAL: NUEVO / EDITAR PROSPECTO
    // ═════════════════════════════════════════════════════════════════════════
    window.crmAbrirModalProspecto = function (id = null) {
        let p = id ? DB.prospectos.find(x => x.id === id) : null;

        const isEdit = !!p;
        p = p || {
            nombre: '', rut: '', email: '', telefono: '', materia: 'civil',
            tipoExpediente: 'judicial',
            tramiteObjetivo: '',
            origen: 'web', riesgo: 'medio', descripcion: '', estrategia: ''
        };

        const html = `
            <div class="crm-modal-grid">
                <div class="crm-form-group">
                    <label>Nombre Completo / Razón Social *</label>
                    <input type="text" id="crm-f-nombre" value="${p.nombre}" placeholder="Ej: Juan Pérez">
                </div>
                <div class="crm-form-group">
                    <label>RUT</label>
                    <input type="text" id="crm-f-rut" value="${p.rut}" placeholder="12.345.678-9" onblur="if(typeof validarRUT==='function')validarRUT(this)">
                </div>
                
                <div class="crm-form-group">
                    <label>Email</label>
                    <input type="email" id="crm-f-email" value="${p.email}">
                </div>
                <div class="crm-form-group">
                    <label>Teléfono (WhatsApp)</label>
                    <input type="text" id="crm-f-telefono" value="${p.telefono}" placeholder="+569...">
                </div>

                <div class="crm-form-group">
                    <label>Tipo de Cliente</label>
                    <select id="crm-f-tipoexp" onchange="(function(){try{const v=document.getElementById('crm-f-tipoexp')?.value;const w=document.getElementById('crm-f-tramite-wrap');const m=document.getElementById('crm-f-materia-wrap');if(w)w.style.display=(v==='tramite')?'block':'none';if(m)m.style.display=(v==='tramite')?'none':'block';}catch(_){}})()">
                        <option value="judicial" ${(p.tipoExpediente || 'judicial') === 'judicial' ? 'selected' : ''}>Judicial</option>
                        <option value="tramite" ${(p.tipoExpediente || '') === 'tramite' ? 'selected' : ''}>Trámite Administrativo</option>
                    </select>
                </div>

                <div class="crm-form-group" id="crm-f-tramite-wrap" style="display:${(p.tipoExpediente === 'tramite') ? 'flex' : 'none'};">
                    <label>Trámite objetivo</label>
                    <input type="text" id="crm-f-tramite" value="${p.tramiteObjetivo || ''}" placeholder="Ej: Reclamación administrativa en organismo X">
                </div>

                <div class="crm-form-group" id="crm-f-materia-wrap" style="display:${(p.tipoExpediente === 'tramite') ? 'none' : 'flex'};">
                    <label>Materia Legal</label>
                    <select id="crm-f-materia">
                        <option value="civil" ${p.materia === 'civil' ? 'selected' : ''}>Civil</option>
                        <option value="laboral" ${p.materia === 'laboral' ? 'selected' : ''}>Laboral</option>
                        <option value="familia" ${p.materia === 'familia' ? 'selected' : ''}>Familia</option>
                        <option value="penal" ${p.materia === 'penal' ? 'selected' : ''}>Penal</option>
                        <option value="empresarial" ${p.materia === 'empresarial' ? 'selected' : ''}>Empresarial</option>
                        <option value="otro" ${p.materia === 'otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
                <div class="crm-form-group">
                    <label>Nivel de Riesgo (Viabilidad)</label>
                    <select id="crm-f-riesgo">
                        <option value="bajo" ${p.riesgo === 'bajo' ? 'selected' : ''}>Bajo Riesgo (Alta Viabilidad)</option>
                        <option value="medio" ${p.riesgo === 'medio' ? 'selected' : ''}>Riesgo Medio</option>
                        <option value="alto" ${p.riesgo === 'alto' ? 'selected' : ''}>Alto Riesgo (Caso Complejo)</option>
                    </select>
                </div>

                <div class="crm-form-group full">
                    <label>Descripción del Caso</label>
                    <textarea id="crm-f-desc" rows="3" placeholder="Detalles relatados por el cliente...">${p.descripcion}</textarea>
                </div>
                
                <div class="crm-form-group full">
                    <label>Estrategia Propuesta (Uso interno)</label>
                    <textarea id="crm-f-estrategia" rows="3" placeholder="Ideas preliminares para abordar el caso...">${p.estrategia}</textarea>
                </div>

                <div class="crm-form-group">
                    <label>Origen de Contacto</label>
                    <select id="crm-f-origen">
                        <option value="web" ${p.origen === 'web' ? 'selected' : ''}>Página Web</option>
                        <option value="whatsapp" ${p.origen === 'whatsapp' ? 'selected' : ''}>WhatsApp Directo</option>
                        <option value="referido" ${p.origen === 'referido' ? 'selected' : ''}>Referido / Recomendación</option>
                        <option value="redes" ${p.origen === 'redes' ? 'selected' : ''}>Redes Sociales</option>
                        <option value="otro" ${p.origen === 'otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
            </div>
        `;

        let modal = document.getElementById('modal-prospecto-custom');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-prospecto-custom';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-box" style="max-width:480px;">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> ${isEdit ? 'Editar Prospecto' : 'Nuevo Prospecto'}</h3>
                    <button class="modal-close" id="crm-btn-close">×</button>
                </div>
                <div style="padding:4px 0 8px;">
                    ${html}
                </div>
                <div style="display:flex; gap:8px; margin-top:18px;">
                    <button class="btn btn-p" style="flex:1;" id="crm-btn-save"><i class="fas fa-check"></i> Guardar Prospecto</button>
                    <button class="btn btn-sm" style="background:var(--bg-2,var(--bg)); color:var(--text-2);" id="crm-btn-cancel">Cancelar</button>
                </div>
            </div>
        `;

        document.getElementById('crm-btn-save').addEventListener('click', function () {
            const nombre = document.getElementById('crm-f-nombre').value.trim();
            if (!nombre) return alert('El nombre es obligatorio');

            const rutRaw = (document.getElementById('crm-f-rut').value || '').trim();
            if (rutRaw && typeof validarRUT === 'function' && !validarRUT(rutRaw)) {
                if (typeof showError === 'function') showError('RUT inválido — verifique el dígito verificador.');
                else alert('RUT inválido.');
                return;
            }
            const rutFmt = rutRaw ? ((typeof formatRUT === 'function') ? formatRUT(rutRaw) : rutRaw) : '';

            const tipoExp = (document.getElementById('crm-f-tipoexp')?.value || 'judicial').toString();
            const tramiteObj = (document.getElementById('crm-f-tramite')?.value || '').trim();
            const materiaVal = (tipoExp === 'tramite') ? 'administrativo' : (document.getElementById('crm-f-materia')?.value || 'civil');

            const data = {
                nombre,
                rut: rutFmt,
                email: document.getElementById('crm-f-email').value.trim(),
                telefono: document.getElementById('crm-f-telefono').value.trim(),
                tipoExpediente: tipoExp,
                tramiteObjetivo: (tipoExp === 'tramite') ? tramiteObj : '',
                materia: materiaVal,
                riesgo: document.getElementById('crm-f-riesgo').value,
                origen: document.getElementById('crm-f-origen').value,
                descripcion: document.getElementById('crm-f-desc').value.trim(),
                estrategia: document.getElementById('crm-f-estrategia').value.trim()
            };

            if (isEdit) {
                Object.assign(p, data);
                p.fechaActualizacion = new Date().toISOString();
            } else {
                const nuevo = {
                    id: 'pros_' + Date.now(),
                    etapa: 'contacto',
                    fechaCreacion: new Date().toISOString(),
                    fechaContacto: new Date().toISOString(),
                    notas: [],
                    ...data
                };
                if (typeof Store !== 'undefined' && Store?.prospectos) Store.prospectos.push(nuevo);
                else DB.prospectos.push(nuevo);

                // Bienvenida automática al registrar nuevo prospecto (si tiene teléfono)
                (async () => {
                    try {
                        const tel = String(nuevo.telefono || '').replace(/[\s\+\-\(\)]/g, '').trim();
                        if (!tel) return;
                        const wa = window.electronAPI?.whatsapp;
                        if (!wa?.estado || !wa?.enviarBienvenida) return;
                        const cfg = await wa.estado();
                        const templates = (cfg && cfg.waTemplates && typeof cfg.waTemplates === 'object') ? cfg.waTemplates : {};
                        const base = String(templates.BIENVENIDA_CLIENTE || 'Hola {{nombre_cliente}}, bienvenido/a. Quedamos atentos a ayudarte.');
                        const msg = base.replace(/\{\{\s*nombre_cliente\s*\}\}/g, nuevo.nombre || 'Cliente').trim();
                        if (!msg) return;
                        await wa.enviarBienvenida(tel, msg);
                    } catch (_) {}
                })();
            }

            if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();
            else if (typeof saveDataToDisk === 'function') saveDataToDisk();

            prospectosRender();
            if (isEdit && window.estadoCRM && window.estadoCRM.prospectoAbierto === id) {
                crmAbrirDetalle(id); // Recargar detalle
            }

            modal.style.display = 'none';
        });

        document.getElementById('crm-btn-cancel').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('crm-btn-close').addEventListener('click', () => modal.style.display = 'none');

        const _cerrar = () => {
            modal.classList.remove('open');
            modal.style.display = 'none';
        };
        document.getElementById('crm-btn-cancel').addEventListener('click', _cerrar);
        document.getElementById('crm-btn-close').addEventListener('click', _cerrar);

        modal.style.display = 'flex';
        modal.classList.add('open');
        setTimeout(() => {
            try {
                const first = document.getElementById('crm-f-nombre');
                if (first && typeof first.focus === 'function') first.focus();
            } catch (_) {}
        }, 60);
    };

    // ═════════════════════════════════════════════════════════════════════════
    // VISTA DETALLE DE PROSPECTO
    // ═════════════════════════════════════════════════════════════════════════
    window.crmAbrirDetalle = function (id) {
        const p = DB.prospectos.find(x => x.id === id);
        if (!p) return;

        estadoCRM.prospectoAbierto = id;

        // Propuesta vinculada (si hay)
        const propuesta = DB.propuestas.find(pr => pr.prospectoId === id);

        // Compatibilidad: este flujo antiguo usa el modal genérico; el borrado es global.

        const html = `
            <div class="crm-detalle-layout">
                <div class="crm-detalle-main">
                    <div class="crm-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 style="margin:0 0 5px 0; color:var(--primary); font-size:18px;">${p.nombre}</h3>
                                <div style="font-size:12px; color:var(--text-light);"><i class="fas fa-barcode"></i> ${p.rut || 'Sin RUT'} | <i class="fas fa-envelope"></i> ${p.email || 'Sin Email'} | <i class="fas fa-phone"></i> ${p.telefono || 'Sin Tel'}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn btn-xs" onclick="crmAbrirModalProspecto('${p.id}')"><i class="fas fa-edit"></i> Editar</button>
                                <button class="btn btn-xs btn-d" onclick="crmEliminarProspecto('${p.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        
                        <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid var(--border); padding-top:15px;">
                            <div style="flex:1;">
                                <strong>Tipo:</strong> <span style="text-transform:capitalize;">${p.tipoExpediente || 'judicial'}</span><br>
                                <strong>Materia:</strong> <span style="text-transform:capitalize;">${p.materia || '—'}</span><br>
                                <strong>Riesgo:</strong> <span class="risk-badge risk-${p.riesgo}">${p.riesgo}</span>
                            </div>
                            <div style="flex:1;">
                                <strong>Etapa CRM:</strong> <span style="text-transform:uppercase; color:var(--accent); font-weight:600;">${p.etapa}</span><br>
                                <strong>Creación:</strong> ${new Date(p.fechaCreacion).toLocaleDateString()}
                            </div>
                        </div>

                        <div style="margin-top:15px;">
                            <h4 style="margin:0 0 5px 0; font-size:12px; font-weight:700;">Descripción del Caso</h4>
                            <div style="font-size:12px; white-space:pre-wrap; background:var(--bg-2); padding:10px; border-radius:6px;">${p.descripcion || '<i>No ingresada</i>'}</div>
                        </div>
                        <div style="margin-top:10px;">
                            <h4 style="margin:0 0 5px 0; font-size:12px; font-weight:700;">Estrategia Sugerida</h4>
                            <div style="font-size:12px; white-space:pre-wrap; background:var(--bg-2); padding:10px; border-radius:6px; border-left:3px solid var(--accent);">${p.estrategia || '<i>No ingresada</i>'}</div>
                        </div>
                    </div>

                    ${propuesta ? `
                    <div class="crm-card">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4><i class="fas fa-file-invoice-dollar"></i> Propuesta Económica Activa</h4>
                            <button class="btn btn-xs btn-p" onclick="crmGenerarPDFPropuesta('${propuesta.id}')"><i class="fas fa-file-pdf"></i> Generar PDF</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; margin-top:10px;">
                            <div><strong>Monto Total:</strong> $${propuesta.montoTotal.toLocaleString('es-CL')}</div>
                            <div><strong>Tipo:</strong> ${propuesta.tipoHonorarios === 'variable' ? 'Porcentaje de Resultados' : 'Honorarios Fijos'}</div>
                            <div><strong>Forma de Pago:</strong> ${propuesta.formaPago === 'cuotas' ? propuesta.numeroCuotas + ' cuotas' : 'Contado'}</div>
                            <div><strong>Vigencia:</strong> ${new Date(propuesta.fechaVigencia).toLocaleDateString()}</div>
                        </div>
                    </div>
                    ` : `
                    <div class="crm-card" style="text-align:center; padding:30px 10px; background:var(--bg-2);">
                        <i class="fas fa-file-invoice-dollar" style="font-size:24px; color:var(--text-3); margin-bottom:10px;"></i>
                        <p style="font-size:13px; color:var(--text-2); margin-top:0;">El prospecto aún no tiene una propuesta económica generada.</p>
                        <button class="btn btn-p" onclick="crmAbrirModalPropuesta('${p.id}')"><i class="fas fa-plus"></i> Crear Propuesta</button>
                    </div>
                    `}
                </div>
                
                <div class="crm-detalle-side">
                    <!-- Controles de Conversión -->
                    <div class="crm-card">
                        <h4><i class="fas fa-exchange-alt"></i> Acciones de Pipeline</h4>
                        
                        <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                            <label style="font-size:11px; font-weight:600;">Cambiar etapa a:</label>
                            <select id="crm-cambiar-etapa" class="common-input" style="font-size:12px; padding:6px;" onchange="crmCambiarEtapa('${p.id}', this.value)">
                                ${ETAPAS.filter(e => !['ganado', 'perdido'].includes(e.id)).map(e => `<option value="${e.id}" ${p.etapa === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}
                            </select>
                            
                            <hr style="border:0; border-top:1px solid var(--border); width:100%; margin:5px 0;">
                            
                            ${p.etapa === 'negociacion' ? `
                                <button class="btn btn-ganado" onclick="prospectosConvertirACausa('${p.id}')">
                                    <i class="fas fa-check-circle"></i> Propuesta ACEPTADA
                                </button>
                                <button class="btn btn-perdido" onclick="crmCambiarEtapa('${p.id}', 'perdido')">
                                    <i class="fas fa-times-circle"></i> Propuesta RECHAZADA
                                </button>
                            ` : `
                                <button class="btn btn-perdido" onclick="crmCambiarEtapa('${p.id}', 'perdido')" ${p.etapa === 'perdido' ? 'disabled' : ''}>
                                    <i class="fas fa-times-circle"></i> Marcar como PERDIDO
                                </button>
                            `}
                        </div>
                    </div>

                    <!-- Notas -->
                    <div class="crm-card" style="flex:1; display:flex; flex-direction:column;">
                        <h4><i class="fas fa-sticky-note"></i> Bitácora del Prospecto</h4>
                        <div class="crm-notas-list" style="flex:1; margin-bottom:10px;">
                            ${(p.notas || []).length === 0 ? '<div style="font-size:11px; color:var(--text-3); text-align:center; padding:20px 0;">Sin notas.</div>' : ''}
                            ${(p.notas || []).reverse().map(n => `
                                <div class="crm-nota-item">
                                    <div class="crm-nota-fecha">${new Date(n.fecha).toLocaleString('es-CL')}</div>
                                    <div>${n.texto}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex; gap:5px; margin-top:auto; align-items:flex-end;">
                            <textarea id="crm-in-nota" rows="2" style="flex:1; padding:6px 10px; font-size:12px; border:1px solid var(--border); border-radius:6px; background:var(--bg-2); color:var(--text-1); resize:vertical; min-height:34px; max-height:120px; font-family:inherit;" placeholder="Escribir nota..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();crmAgregarNota('${p.id}')}" ></textarea>
                            <button class="btn btn-xs btn-p" onclick="crmAgregarNota('${p.id}')"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (typeof window.mostrarGenericModal === 'function') {
            // Si existe una funcion de modal de ancho variable
            mostrarGenericModal(`Detalle Prospecto: ${p.nombre}`, html, 900);
        } else {
            // Reusar modal input generico pero hacerlo mas ancho temporalmente
            const modalId = 'modal-input-generico';
            const modal = document.getElementById(modalId);
            if (modal) {
                const box = modal.querySelector('.modal-box');
                if (box) box.style.maxWidth = '900px';

                document.getElementById('mig-titulo').innerHTML = `<i class="fas fa-id-card"></i> Ficha Prospecto`;
                document.getElementById('mig-body').innerHTML = html;
                document.getElementById('mig-btn-ok').style.display = 'none'; // ocultar guardar

                // Override cerrar para volver a la normalidad el width
                const oldCancelar = window.migCancelar;
                window.migCancelar = function () {
                    if (box) box.style.maxWidth = '480px';
                    document.getElementById('mig-btn-ok').style.display = 'block';
                    if (oldCancelar) oldCancelar();
                    else modal.style.display = 'none';
                };
                modal.style.display = 'flex';
            }
        }
    };

    window.crmCambiarEtapa = function (id, nuevaEtapa) {
        const p = DB.prospectos.find(x => x.id === id);
        if (!p) return;
        p.etapa = nuevaEtapa;

        if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();

        estadoCRM.prospectoAbierto = id;
        prospectosRender();
    };

    window.crmAgregarNota = function (id) {
        const inp = document.getElementById('crm-in-nota');
        if (!inp) return;
        const txt = inp.value.trim();
        if (!txt) return;

        const p = DB.prospectos.find(x => x.id === id);
        if (!p) return;

        if (!p.notas) p.notas = [];
        p.notas.push({
            fecha: new Date().toISOString(),
            texto: txt,
            autor: 'Usuario Local' // Puede conectarse a la auth
        });

        inp.value = '';
        if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();

        estadoCRM.prospectoAbierto = id;
        prospectosRender();
    };

    // ═════════════════════════════════════════════════════════════════════════
    // MODAL: NUEVA PROPUESTA ECONÓMICA
    // ═════════════════════════════════════════════════════════════════════════
    window.crmAbrirModalPropuesta = function (prospectoId) {
        const p = DB.prospectos.find(x => x.id === prospectoId);
        if (!p) return;

        const cfgAb = {
            nombreAbogado: (typeof window.userLogged !== 'undefined' && window.userLogged?.nombre) ? window.userLogged.nombre : '',
            emailAbogado: (typeof window.userLogged !== 'undefined' && window.userLogged?.email) ? window.userLogged.email : '',
            telefonoAbogado: (typeof window.userLogged !== 'undefined' && window.userLogged?.telefono) ? window.userLogged.telefono : ''
        };

        const html = `
            <div style="background:var(--bg-2); padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px;">
                <strong>Para:</strong> ${p.nombre} / Materia: <span style="text-transform:capitalize;">${p.materia}</span>
            </div>
            
            <div class="crm-modal-grid">
                <div class="crm-form-group full">
                    <label>Abogado / Estudio</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <input type="text" id="crm-p-ab-nombre" placeholder="Nombre abogado/estudio" value="${(cfgAb.nombreAbogado || '').replace(/"/g, '&quot;')}">
                        <input type="text" id="crm-p-ab-email" placeholder="Email" value="${(cfgAb.emailAbogado || '').replace(/"/g, '&quot;')}">
                    </div>
                    <div style="margin-top:10px;">
                        <input type="text" id="crm-p-ab-tel" placeholder="Teléfono" value="${(cfgAb.telefonoAbogado || '').replace(/"/g, '&quot;')}">
                    </div>
                </div>

                <div class="crm-form-group full">
                    <label>Breve análisis del caso (para propuesta)</label>
                    <textarea id="crm-p-analisis" rows="3" placeholder="Resumen ejecutivo, riesgos, enfoque inicial..." style="resize:vertical;"></textarea>
                </div>

                <div class="crm-form-group full">
                    <label>Tipo de Honorarios</label>
                    <select id="crm-p-tipo" onchange="crmManejarUIPropuesta()">
                        <option value="fijo">Honorarios Fijos (Monto exacto)</option>
                        <option value="variable">Variable (Cuota Litis / Porcentaje)</option>
                    </select>
                </div>

                <!-- Bloque Variable -->
                <div id="crm-b-variable" class="crm-form-group full" style="display:none; background:rgba(6, 182, 212, 0.05); border:1px solid var(--accent); padding:15px; border-radius:6px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div>
                            <label>Cuantía del Litigio / Monto Total Esperado</label>
                            <input type="number" id="crm-p-cuantia" placeholder="Ej: 50000000" oninput="crmCalcularVariable()">
                        </div>
                        <div>
                            <label>Porcentaje a cobrar (%)</label>
                            <input type="number" id="crm-p-porc" value="15" min="1" max="50" oninput="crmCalcularVariable()">
                        </div>
                    </div>
                </div>

                <div class="crm-form-group full">
                    <label>Monto Total a Cobrar (CLP)</label>
                    <input type="number" id="crm-p-monto" placeholder="Ej: 1500000" style="font-size:16px; font-weight:700; color:var(--primary);">
                </div>

                <div class="crm-form-group full">
                    <label>Forma de Pago</label>
                    <select id="crm-p-forma" onchange="crmManejarUIPropuesta()">
                        <option value="contado">Al Contado (100% inicio o término)</option>
                        <option value="cuotas">Pago en Cuotas (Plan de pagos mensual)</option>
                    </select>
                </div>

                <!-- Bloque Cuotas -->
                <div id="crm-b-cuotas" class="crm-form-group full" style="display:none; background:var(--bg-2); padding:15px; border-radius:6px;">
                    <div style="display:flex; gap:15px; align-items:center;">
                        <div style="flex:1;">
                            <label>Número de Cuotas</label>
                            <input type="number" id="crm-p-ncuotas" value="3" min="2" max="36" oninput="crmManejarUIPropuesta()">
                        </div>
                        <div style="flex:2; padding-top:15px; font-weight:700; color:var(--primary);">
                            Valor estimado por cuota: <span id="crm-p-valcuota">$0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let modal = document.getElementById('modal-propuesta-custom');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-propuesta-custom';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-box" style="max-width:480px;">
                <div class="modal-header">
                    <h3><i class="fas fa-file-invoice-dollar"></i> Crear Propuesta Económica</h3>
                    <button class="modal-close" id="crm-prop-btn-close">×</button>
                </div>
                <div style="padding:4px 0 8px;">
                    ${html}
                </div>
                <div style="display:flex; gap:8px; margin-top:18px;">
                    <button class="btn btn-p" style="flex:1;" id="crm-prop-btn-save"><i class="fas fa-check"></i> Guardar Propuesta</button>
                    <button class="btn btn-sm" style="background:var(--bg-2,var(--bg)); color:var(--text-2);" id="crm-prop-btn-cancel">Cancelar</button>
                </div>
            </div>
        `;

        document.getElementById('crm-prop-btn-save').addEventListener('click', function () {
            const tipo = document.getElementById('crm-p-tipo').value;
            const montoTotal = parseInt(document.getElementById('crm-p-monto').value) || 0;
            if (montoTotal <= 0) return alert('El monto total debe ser mayor a cero.');

            const forma = document.getElementById('crm-p-forma').value;
            const ncuotas = forma === 'cuotas' ? parseInt(document.getElementById('crm-p-ncuotas').value) : 1;

            const fEmision = new Date();
            const fVigencia = new Date();
            fVigencia.setDate(fVigencia.getDate() + 15);

            const data = {
                id: 'prop_' + Date.now(),
                prospectoId,
                fechaEmision: fEmision.toISOString(),
                fechaVigencia: fVigencia.toISOString(),
                abogado: {
                    nombre: (document.getElementById('crm-p-ab-nombre')?.value || '').trim(),
                    email: (document.getElementById('crm-p-ab-email')?.value || '').trim(),
                    telefono: (document.getElementById('crm-p-ab-tel')?.value || '').trim()
                },
                analisisCaso: (document.getElementById('crm-p-analisis')?.value || '').trim(),
                partes: {
                    cliente: {
                        nombre: p.nombre || '',
                        rut: p.rut || '',
                        email: p.email || '',
                        telefono: p.telefono || ''
                    }
                },
                tipoHonorarios: tipo,
                montoTotal,
                formaPago: forma,
                numeroCuotas: ncuotas
            };

            if (tipo === 'variable') {
                data.cuantiaLitigio = parseInt(document.getElementById('crm-p-cuantia').value) || 0;
                data.porcentaje = parseInt(document.getElementById('crm-p-porc').value) || 0;
            }

            if (forma === 'cuotas') {
                data.montoCuota = Math.round(montoTotal / ncuotas);
                data.fechasPago = [];
                for (let i = 0; i < ncuotas; i++) {
                    let cf = new Date();
                    cf.setMonth(cf.getMonth() + i + 1);
                    data.fechasPago.push(cf.toISOString());
                }
            }

            if (typeof Store !== 'undefined' && Store?.propuestas) Store.propuestas.push(data);
            else DB.propuestas.push(data);
            p.etapa = 'propuesta';

            if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();

            estadoCRM.prospectoAbierto = prospectoId;
            prospectosRender();
            modal.style.display = 'none';
        });

        document.getElementById('crm-prop-btn-cancel').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('crm-prop-btn-close').addEventListener('click', () => modal.style.display = 'none');

        modal.style.display = 'flex';
    };

    window.crmManejarUIPropuesta = function () {
        const tipo = document.getElementById('crm-p-tipo').value;
        const forma = document.getElementById('crm-p-forma').value;
        const inputMonto = document.getElementById('crm-p-monto');

        document.getElementById('crm-b-variable').style.display = tipo === 'variable' ? 'block' : 'none';
        inputMonto.readOnly = tipo === 'variable'; // Si es variable se calcula automatico

        document.getElementById('crm-b-cuotas').style.display = forma === 'cuotas' ? 'block' : 'none';

        if (forma === 'cuotas') {
            const monto = parseInt(inputMonto.value) || 0;
            const cs = parseInt(document.getElementById('crm-p-ncuotas').value) || 1;
            document.getElementById('crm-p-valcuota').innerText = '$' + Math.round(monto / cs).toLocaleString('es-CL');
        }
    };

    window.crmCalcularVariable = function () {
        const cuantia = parseInt(document.getElementById('crm-p-cuantia').value) || 0;
        const porc = parseInt(document.getElementById('crm-p-porc').value) || 0;
        const total = Math.round(cuantia * (porc / 100));
        document.getElementById('crm-p-monto').value = total;
        crmManejarUIPropuesta(); // actualizar cuotas si es necesario
    };

    // ═════════════════════════════════════════════════════════════════════════
    // GENERAR PDF DE PROPUESTA VIA IPC/PUPPETEER
    // ═════════════════════════════════════════════════════════════════════════
    window.crmGenerarPDFPropuesta = async function (propuestaId) {
        const prop = DB.propuestas.find(p => p.id === propuestaId);
        if (!prop) return;

        const prospecto = DB.prospectos.find(p => p.id === prop.prospectoId);

        const configAbogado = {
            nombreAbogado: (prop.abogado && prop.abogado.nombre) ? prop.abogado.nombre : (typeof window.userLogged !== 'undefined' ? window.userLogged?.nombre : 'Estudio Jurídico'),
            emailAbogado: (prop.abogado && prop.abogado.email) ? prop.abogado.email : (typeof window.userLogged !== 'undefined' ? window.userLogged?.email : ''),
            telefonoAbogado: (prop.abogado && prop.abogado.telefono) ? prop.abogado.telefono : (typeof window.userLogged !== 'undefined' ? window.userLogged?.telefono : '')
        };

        const html = (window.pdfHTMLPropuesta ? window.pdfHTMLPropuesta(prospecto, prop, configAbogado) : _crmPDFHTMLPropuestaFallback(prospecto, prop, configAbogado));

        try {
            if (window.electronAPI && window.electronAPI.prospectos && typeof window.electronAPI.prospectos.generarPDF === 'function') {
                // Notificar al usuario (puede agregarse un loader en UI real)
                console.log("Enviando HTML a Puppeteer (Main Process)...");
                const defaultName = `Propuesta_${prospecto.nombre.replace(/\s+/g, '_')}_${prop.id}.pdf`;

                const result = await window.electronAPI.prospectos.generarPDF({
                    html: html,
                    defaultName: defaultName
                });

                if (!result || typeof result !== 'object') {
                    alert('Error al generar PDF: respuesta inválida del sistema.');
                    return;
                }

                if (result.success) {
                    if (typeof showSuccess === 'function') showSuccess('PDF generado.');
                } else {
                    const errMsg = (result.error || result.message || '').toString().trim();
                    if (errMsg && errMsg !== 'Cancelado por usuario') {
                        alert("Error al generar PDF: " + errMsg);
                    } else if (!errMsg) {
                        alert('Error al generar PDF: no se recibió detalle del error.');
                    }
                }
            } else {
                alert("La API de Electron para generación de PDFs no está disponible.");
            }
        } catch (err) {
            console.error(err);
            alert("Excepción al intentar generar PDF: " + (err?.message || 'Error desconocido'));
        }
    };

    function _crmPDFHTMLPropuestaFallback(prospecto, prop, configAbogado) {
        const hoy = new Date().toLocaleDateString('es-CL');
        const vig = prop?.fechaVigencia ? new Date(prop.fechaVigencia).toLocaleDateString('es-CL') : '';
        const monto = (prop?.montoTotal || 0).toLocaleString('es-CL');
        const tipo = prop?.tipoHonorarios === 'variable' ? 'Variable (Cuota Litis)' : 'Honorarios Fijos';
        const forma = prop?.formaPago === 'cuotas' ? `${prop?.numeroCuotas || 0} cuotas` : 'Contado';
        const analisis = String(prop?.analisisCaso || '').trim();
        return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Propuesta Económica</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;padding:28px;line-height:1.55}
h1{font-size:20px;margin:0 0 6px}h2{font-size:12px;text-transform:uppercase;margin:16px 0 8px;color:#1e3a8a}
.muted{color:#64748b;font-size:12px}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}td:first-child{width:34%;font-weight:700;color:#475569}
</style></head><body>
<h1>Propuesta Económica</h1>
<div class="muted">Fecha: ${hoy}${vig ? ` · Vigencia: ${vig}` : ''}</div>

<h2>1. Individualización</h2>
<div class="box">
  <table>
    <tr><td>Cliente</td><td>${prospecto?.nombre || '—'}</td></tr>
    <tr><td>RUT</td><td>${prospecto?.rut || '—'}</td></tr>
    <tr><td>Email</td><td>${prospecto?.email || '—'}</td></tr>
    <tr><td>Teléfono</td><td>${prospecto?.telefono || '—'}</td></tr>
    <tr><td>Abogado/Estudio</td><td>${configAbogado?.nombreAbogado || '—'}</td></tr>
    <tr><td>Email Abogado</td><td>${configAbogado?.emailAbogado || '—'}</td></tr>
    <tr><td>Teléfono Abogado</td><td>${configAbogado?.telefonoAbogado || '—'}</td></tr>
  </table>
</div>

<h2>2. Breve análisis del caso</h2>
<div class="box">${analisis ? analisis.replace(/</g,'&lt;').replace(/\n/g,'<br>') : '—'}</div>

<h2>3. Propuesta económica</h2>
<div class="box">
  <table>
    <tr><td>Tipo</td><td>${tipo}</td></tr>
    <tr><td>Monto total</td><td>$${monto} CLP</td></tr>
    <tr><td>Forma de pago</td><td>${forma}</td></tr>
  </table>
</div>
</body></html>`;
    }

    function _crmBuildContratoServiciosHTML(prospecto, causa, tipoExpediente, datosContrato) {
        const hoy = new Date().toLocaleDateString('es-CL');
        const tipoLabel = tipoExpediente === 'tramite' ? 'Trámite Administrativo' : 'Causa Judicial';
        return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Contrato de Servicios - ${prospecto.nombre}</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;padding:28px;line-height:1.55;}h1{font-size:22px;margin:0 0 10px;}h2{font-size:13px;text-transform:uppercase;margin:20px 0 8px;color:#1e3a8a;}table{width:100%;border-collapse:collapse;font-size:13px;}td{padding:8px;border-bottom:1px solid #e2e8f0;}td:first-child{width:34%;font-weight:700;color:#475569}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;} .firmas{margin-top:38px;display:grid;grid-template-columns:1fr 1fr;gap:26px}.firma{border-top:1px solid #94a3b8;padding-top:7px;font-size:12px;color:#475569}
</style></head><body>
<h1>Contrato de Prestación de Servicios</h1>
<div style="font-size:12px;color:#64748b;">Fecha de emisión: ${hoy} · Tipo: ${tipoLabel}</div>

<h2>1. Individualización de las partes</h2>
<table>
<tr><td>Cliente</td><td>${prospecto.nombre || '—'}</td></tr>
<tr><td>RUT</td><td>${prospecto.rut || '—'}</td></tr>
<tr><td>Email</td><td>${prospecto.email || '—'}</td></tr>
<tr><td>Teléfono</td><td>${prospecto.telefono || '—'}</td></tr>
<tr><td>Materia</td><td>${prospecto.materia || '—'}</td></tr>
</table>

<h2>2. Objeto del encargo</h2>
<div class="box">${datosContrato.objeto || causa.descripcion || 'Gestión legal encomendada por el cliente.'}</div>

<h2>3. Honorarios y forma de pago</h2>
<div class="box">${datosContrato.honorarios || 'Según propuesta económica aceptada entre las partes.'}</div>

<h2>4. Mandato y facultades</h2>
<div class="box">${datosContrato.mandato || 'El cliente confiere patrocinio y poder para ejecutar actuaciones necesarias dentro del encargo profesional.'}</div>

${tipoExpediente === 'judicial'
            ? `<h2>5. Cláusulas especiales judiciales</h2><div class="box">Incluye comparecencia, actuaciones procesales, presentación de escritos, asistencia a audiencias y recursos según procedencia legal.</div>`
            : `<h2>5. Cláusulas especiales administrativas</h2><div class="box">Trámite a gestionar: ${datosContrato.tramiteObjetivo || 'No especificado'}. Incluye ingreso, seguimiento, subsanaciones y respuestas ante el organismo competente.</div>`}

<div class="firmas">
<div class="firma">Firma Cliente</div>
<div class="firma">Firma Estudio / Abogado</div>
</div>
</body></html>`;
    }

    function _crmAdjuntarContratoACausa(causa, prospecto, tipoExpediente, datosContrato) {
        if (!causa.docsCliente) causa.docsCliente = [];
        const html = _crmBuildContratoServiciosHTML(prospecto, causa, tipoExpediente, datosContrato);
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        const nombre = `Contrato_Servicios_${String(prospecto.nombre || 'cliente').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
        causa.docsCliente.push({
            nombre,
            mimetype: 'text/html',
            size: dataUrl.length,
            fecha: new Date().toISOString(),
            data: dataUrl,
            tipoIA: 'Contrato',
            etapaIA: 'Contratación',
            resumenIA: `Contrato de servicios (${tipoExpediente === 'tramite' ? 'administrativo' : 'judicial'}) generado desde prospecto.`
        });
        causa.contratoServicios = {
            tipoExpediente,
            generadoEn: new Date().toISOString(),
            nombreDocumento: nombre,
            ...datosContrato
        };
        prospecto.contratoServicios = {
            tipoExpediente,
            generadoEn: new Date().toISOString(),
            causaId: causa.id,
            nombreDocumento: nombre
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONVERTIR A CAUSA
    // ═════════════════════════════════════════════════════════════════════════
    window.prospectosConvertirACausa = function (prospectoId) {
        if (!confirm("¿Convertir este prospecto a CLIENTE? Luego podrás crear la Causa/Gestión/Trámite desde el módulo Clientes.")) return;

        const p = DB.prospectos.find(x => x.id === prospectoId);
        if (!p) return;

        const _crmGetOrCreateClienteDesdeProspecto = (prospecto) => {
            if (!prospecto) return null;
            if (!Array.isArray(DB.clientes)) DB.clientes = [];

            const rut = String(prospecto.rut || '').trim();
            const nom = String(prospecto.nombre || '').trim();
            const tel = String(prospecto.telefono || '').trim();
            const email = String(prospecto.email || '').trim();
            const tipoExp = String(prospecto.tipoExpediente || '').trim() || (String(prospecto.materia || '').toLowerCase().includes('admin') ? 'tramite' : 'judicial');

            const existente = (DB.clientes || []).find(c => {
                if (!c) return false;
                if (rut && String(c.rut || '').trim() === rut) return true;
                const cn = String(c.nombre || c.nom || '').trim().toLowerCase();
                const pn = nom.toLowerCase();
                const ct = String(c.telefono || c.tel || '').trim();
                return (!!pn && !!cn && cn === pn && (!!tel ? ct === tel : true));
            }) || null;

            if (existente) {
                existente.estado = 'activo';
                existente.status = 'activo';
                if (!existente.rut && rut) existente.rut = rut;
                if (!existente.telefono && tel) existente.telefono = tel;
                if (!existente.email && email) existente.email = email;
                if (!existente.tipoExpediente && tipoExp) existente.tipoExpediente = tipoExp;
                existente.prospectoId = prospecto.id;
                return existente;
            }

            const nuevo = {
                id: (typeof uid === 'function') ? uid() : ('cli_' + Date.now()),
                nombre: nom,
                nom,
                rut,
                telefono: tel,
                email,
                descripcion: prospecto.descripcion || '',
                tipoExpediente: tipoExp,
                estado: 'activo',
                status: 'activo',
                prospectoId: prospecto.id,
                fechaCreacion: new Date()
            };

            const cli = (typeof Store !== 'undefined' && Store?.agregarCliente)
                ? Store.agregarCliente(nuevo)
                : (DB.clientes.push(nuevo), nuevo);
            return cli;
        };

        const cliente = _crmGetOrCreateClienteDesdeProspecto(p);
        p.etapa = 'ganado';
        p.clienteId = cliente ? cliente.id : undefined;
        p.convertidoAClienteEn = new Date().toISOString();
        if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();
        prospectosRender();
        try {
            if (typeof renderAll === 'function') renderAll();
            else if (typeof renderClientes === 'function') renderClientes();
        } catch (_) {}
        try {
            if (typeof window.tab === 'function') {
                window.tab('clientes', document.querySelector(`[onclick="tab('clientes',this)"]`));
            }
        } catch (_) {}
        if (typeof showSuccess === 'function') showSuccess('Prospecto convertido a cliente.');
    };

})();
