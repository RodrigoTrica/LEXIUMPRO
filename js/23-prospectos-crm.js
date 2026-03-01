/**
 * LEXIUM - Prospectos CRM v2
 * Módulo 23: UI Principal (Kanban, Formularios, Vista Detalle)
 */

(function () {
    // Estado global en memoria para renderizado rápido
    let estadoCRM = {
        prospectoAbierto: null,
        filtroTexto: ''
    };

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
                background: var(--bg-light, #f8fafc);
                color: var(--text, #1e293b);
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
            }
            .kanban-column {
                flex: 0 0 280px;
                background: var(--bg-2, #f1f5f9);
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                max-height: 100%;
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
                background: #fff;
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
                border-radius: 6px;
                padding: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-left: 4px solid transparent;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .kanban-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .kanban-card-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 6px;
                color: var(--text, #1e293b);
            }
            .kanban-card-meta {
                font-size: 11px;
                color: var(--text-light, #64748b);
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
                background: white;
                border-radius: 8px;
                padding: 15px;
                border: 1px solid var(--border);
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
        `;
        document.head.appendChild(style);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDERIZADO PRINCIPAL (KANBAN)
    // ═════════════════════════════════════════════════════════════════════════
    window.prospectosRender = function () {
        const container = document.getElementById('prospectos-crm') || document.getElementById('prospectos');
        if (!container) return;

        // Limpiar DB de prospectos temporal si no existe
        if (!window.DB) window.DB = {};
        if (!window.DB.prospectos) window.DB.prospectos = [];
        if (!window.DB.propuestas) window.DB.propuestas = [];

        const prospectos = window.DB.prospectos;

        // Calcular stats
        const stats = ETAPAS.map(e => ({
            ...e,
            count: prospectos.filter(p => (p.etapa || 'contacto') === e.id).length
        }));

        const totalValue = prospectos
            .filter(p => p.etapa !== 'perdido')
            .reduce((sum, p) => {
                const prop = window.DB.propuestas.find(pr => pr.prospectoId === p.id);
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
            
            <div class="kanban-board">
                ${ETAPAS.map(etapa => renderColumna(etapa, prospectos)).join('')}
            </div>
        `;

        container.innerHTML = html;
    };

    function renderColumna(etapa, todosProspectos) {
        const prospectos = todosProspectos.filter(p => (p.etapa || 'contacto') === etapa.id);

        let cardsHtml = prospectos.map(p => `
            <div class="kanban-card" style="border-left-color: ${etapa.color}" onclick="crmAbrirDetalle('${p.id}')">
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

        if (prospectos.length === 0) {
            cardsHtml = `<div style="text-align:center; padding:20px 0; color:var(--text-3); font-size:11px;">Sin registros</div>`;
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

    // ═════════════════════════════════════════════════════════════════════════
    // MODAL: NUEVO / EDITAR PROSPECTO
    // ═════════════════════════════════════════════════════════════════════════
    window.crmAbrirModalProspecto = function (id = null) {
        let p = id ? DB.prospectos.find(x => x.id === id) : null;

        const isEdit = !!p;
        p = p || {
            nombre: '', rut: '', email: '', telefono: '', materia: 'civil',
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

            const data = {
                nombre,
                rut: document.getElementById('crm-f-rut').value.trim(),
                email: document.getElementById('crm-f-email').value.trim(),
                telefono: document.getElementById('crm-f-telefono').value.trim(),
                materia: document.getElementById('crm-f-materia').value,
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
                DB.prospectos.push(nuevo);
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

        modal.style.display = 'flex';
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

        const html = `
            <div class="crm-detalle-layout">
                <div class="crm-detalle-main">
                    <div class="crm-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 style="margin:0 0 5px 0; color:var(--primary); font-size:18px;">${p.nombre}</h3>
                                <div style="font-size:12px; color:var(--text-light);"><i class="fas fa-barcode"></i> ${p.rut || 'Sin RUT'} | <i class="fas fa-envelope"></i> ${p.email || 'Sin Email'} | <i class="fas fa-phone"></i> ${p.telefono || 'Sin Tel'}</div>
                            </div>
                            <button class="btn btn-xs" onclick="crmAbrirModalProspecto('${p.id}')"><i class="fas fa-edit"></i> Editar</button>
                        </div>
                        
                        <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid var(--border); padding-top:15px;">
                            <div style="flex:1;">
                                <strong>Materia:</strong> <span style="text-transform:capitalize;">${p.materia}</span><br>
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
                                ${ETAPAS.map(e => `<option value="${e.id}" ${p.etapa === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}
                            </select>
                            
                            <hr style="border:0; border-top:1px solid var(--border); width:100%; margin:5px 0;">
                            
                            <button class="btn btn-ganado" onclick="prospectosConvertirACausa('${p.id}')" ${p.etapa === 'ganado' ? 'disabled' : ''}>
                                <i class="fas fa-trophy"></i> Marcar como GANADO
                            </button>
                            <button class="btn btn-perdido" onclick="crmCambiarEtapa('${p.id}', 'perdido')" ${p.etapa === 'perdido' ? 'disabled' : ''}>
                                <i class="fas fa-times-circle"></i> Marcar como PERDIDO
                            </button>
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
                        <div style="display:flex; gap:5px; margin-top:auto;">
                            <input type="text" id="crm-in-nota" style="flex:1; padding:6px 10px; font-size:12px; border:1px solid var(--border); border-radius:4px;" placeholder="Escribir nota..." onkeydown="if(event.key==='Enter')crmAgregarNota('${p.id}')">
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

        prospectosRender();
        crmAbrirDetalle(id); // recargar detalle
    };

    window.crmAgregarNota = function (id) {
        const inp = document.getElementById('crm-in-nota');
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

        crmAbrirDetalle(id); // Recargar notas en UI
    };

    // ═════════════════════════════════════════════════════════════════════════
    // MODAL: NUEVA PROPUESTA ECONÓMICA
    // ═════════════════════════════════════════════════════════════════════════
    window.crmAbrirModalPropuesta = function (prospectoId) {
        const p = DB.prospectos.find(x => x.id === prospectoId);
        if (!p) return;

        const html = `
            <div style="background:var(--bg-2); padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px;">
                <strong>Para:</strong> ${p.nombre} / Materia: <span style="text-transform:capitalize;">${p.materia}</span>
            </div>
            
            <div class="crm-modal-grid">
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

            DB.propuestas.push(data);
            p.etapa = 'propuesta';

            if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();

            prospectosRender();
            modal.style.display = 'none';
            crmAbrirDetalle(prospectoId);
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
        if (!window.pdfHTMLPropuesta) {
            alert("Error: El generador de PDF (Phase 2) no está disponible en el entorno global.");
            return;
        }

        const prop = DB.propuestas.find(p => p.id === propuestaId);
        if (!prop) return;

        const prospecto = DB.prospectos.find(p => p.id === prop.prospectoId);

        // Simulamos config abogado desde preferencias de usuario (asumimos existen en app)
        const configAbogado = {
            nombreAbogado: typeof window.userLogged !== 'undefined' ? window.userLogged.nombre : 'Estudio Jurídico',
            emailAbogado: typeof window.userLogged !== 'undefined' ? window.userLogged.email : ''
        };

        const html = window.pdfHTMLPropuesta(prospecto, prop, configAbogado);

        try {
            if (window.electronAPI && window.electronAPI.prospectos && typeof window.electronAPI.prospectos.generarPDF === 'function') {
                // Notificar al usuario (puede agregarse un loader en UI real)
                console.log("Enviando HTML a Puppeteer (Main Process)...");
                const defaultName = `Propuesta_${prospecto.nombre.replace(/\\s+/g, '_')}_${prop.id}.pdf`;

                const result = await window.electronAPI.prospectos.generarPDF({
                    html: html,
                    defaultName: defaultName
                });

                if (result.success) {
                } else {
                    if (result.error !== 'Cancelado por usuario') {
                        alert("Error al generar PDF: " + result.error);
                    }
                }
            } else {
                alert("La API de Electron para generación de PDFs no está disponible.");
            }
        } catch (err) {
            console.error(err);
            alert("Excepción al intentar llamar IPC generar PDF.");
        }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // CONVERTIR A CAUSA
    // ═════════════════════════════════════════════════════════════════════════
    window.prospectosConvertirACausa = function (prospectoId) {
        if (!confirm("¿Desea convertir este prospecto en una Causa formal en el sistema? Esto cambiará su etapa a GANADO de forma irreversible.")) return;

        const p = DB.prospectos.find(x => x.id === prospectoId);
        if (!p) return;

        const prop = DB.propuestas.find(x => x.prospectoId === prospectoId) || { montoTotal: 0, pagos: [] };

        // Construir objeto Causa base
        const nuevaCausa = {
            id: 'c_' + Date.now(),
            caratula: `Gestión Legal - ${p.nombre}`,
            tipoCausa: 'Gestión',
            cliente: p.nombre,
            rut: p.rut,
            contacto: p.telefono,
            rama: p.materia,
            fechaCreacion: new Date().toISOString(),
            descripcion: p.descripcion,
            estadoGeneral: 'En tramitación',
            porcentajeAvance: 0,
            etapasProcesales: [
                { id: 'e_1', nombre: 'Ingreso al sistema', fecha: new Date().toISOString(), status: 'completado' }
            ],
            // Link al prospecto y propuesta
            prospectoId: p.id,
            propuestaId: prop.id,
            // Inicializar array documentales
            docsCliente: [],
            docsTribunal: [],
            docsTramites: [],
            // EstadoCuenta inicializado con la propuesta (si la hay)
            estadoCuenta: {
                montoTotal: prop.montoTotal || 0,
                totalPagado: 0,
                saldoPendiente: prop.montoTotal || 0,
                pagos: []
            }
        };

        if (!window.DB.causas) window.DB.causas = [];
        window.DB.causas.push(nuevaCausa);

        p.etapa = 'ganado';
        p.causaVinculadaId = nuevaCausa.id;

        if (typeof guardarCambiosGlobal === 'function') guardarCambiosGlobal();

        // Cerrar detalles e ir a causas
        const modalId = 'modal-input-generico';
        if (typeof cerrarModal === 'function') cerrarModal(modalId);
        else {
            let mk = document.getElementById(modalId);
            if (mk) {
                mk.style.display = 'none';
                let box = mk.querySelector('.modal-box');
                if (box) box.style.maxWidth = '480px';
            }
        }

        // Navegar a Causas
        if (typeof window.tab === 'function') {
            window.tab('causas', document.querySelector(`[onclick="tab('causas',this)"]`));
        }

        // Refrescar CRM en segundo plano
        prospectosRender();
        alert('Causa originada con éxito de este prospecto.');
    };

})();
