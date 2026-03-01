        // ████████████████████████████████████████████████████████████████████
        // JS — BLOQUE 15: TRÁMITES ADMINISTRATIVOS
        // Módulo completo para gestión de trámites extrajudiciales
        // Organismos: CBR, SII, DT, SERVIU, Municipalidades, Registro Civil,
        //             TGR, SIR, Notarías y otros.
        // ████████████████████████████████████████████████████████████████████

        // ── Constante de clave local ──────────────────────────────────────
        const TRAMITES_KEY = 'APPBOGADO_TRAMITES_V1';

        // ── Catálogo de organismos y tipos de trámite ─────────────────────
        const TRAMITES_CATALOGO = {
            CBR: {
                label: 'Conservador de Bienes Raíces',
                icon: 'fa-home',
                color: '#0ea5e9',
                campos: ['rol_propiedad', 'folio_real'],
                tipos: [
                    'Inscripción de dominio (compraventa)',
                    'Inscripción de dominio (adjudicación)',
                    'Inscripción de dominio (donación)',
                    'Inscripción de hipoteca',
                    'Inscripción de prohibición',
                    'Inscripción de usufructo',
                    'Inscripción de servidumbre',
                    'Subinscripción',
                    'Cancelación de inscripción',
                    'Certificado de dominio vigente',
                    'Certificado de hipotecas y gravámenes',
                    'Certificado de interdicciones y prohibiciones',
                    'Inscripción de posesión efectiva',
                    'Inscripción de embargo',
                    'Rectificación administrativa',
                    'Estudio de títulos',
                ]
            },
            SII: {
                label: 'Servicio de Impuestos Internos',
                icon: 'fa-receipt',
                color: '#10b981',
                campos: ['rut_contribuyente', 'folio_documento'],
                tipos: [
                    'Inicio de actividades',
                    'Término de giro',
                    'Modificación societaria (actualización RUT)',
                    'Solicitud de RUT para persona jurídica',
                    'Tramitación de facturación electrónica',
                    'Rectificación de declaración (F29)',
                    'Rectificación de declaración (F22)',
                    'Solicitud de devolución de impuestos',
                    'Petición administrativa (art. 126 CT)',
                    'Reposición administrativa voluntaria (RAV)',
                    'Solicitud de exención tributaria',
                    'Representación en fiscalización',
                ]
            },
            DT: {
                label: 'Dirección del Trabajo',
                icon: 'fa-hard-hat',
                color: '#f59e0b',
                campos: ['numero_fiscalizacion', 'numero_multa'],
                tipos: [
                    'Comparecencia a comparendo de conciliación',
                    'Presentación de descargos ante fiscalización',
                    'Solicitud de reconsideración de multa',
                    'Mediación laboral',
                    'Registro de reglamento interno',
                    'Depósito de contrato colectivo',
                    'Solicitud de pronunciamiento administrativo',
                    'Constancia laboral',
                    'Autorización de jornada excepcional',
                ]
            },
            SERVIU: {
                label: 'SERVIU / DOM',
                icon: 'fa-building',
                color: '#8b5cf6',
                campos: ['numero_expediente', 'rol_predio'],
                tipos: [
                    'Permiso de edificación',
                    'Recepción final de obras',
                    'Subdivisión predial',
                    'Fusión predial',
                    'Regularización Ley del Mono',
                    'Recurso administrativo contra resolución DOM',
                    'Postulación subsidio habitacional',
                    'Seguimiento de subsidio habitacional',
                    'Estudio de títulos para proyecto inmobiliario',
                ]
            },
            MUNICIPALIDAD: {
                label: 'Municipalidad',
                icon: 'fa-landmark',
                color: '#ec4899',
                campos: ['numero_patente', 'municipio'],
                tipos: [
                    'Solicitud de patente comercial',
                    'Renovación de patente comercial',
                    'Cambio de destino de inmueble',
                    'Permiso provisorio',
                    'Permiso de circulación',
                    'Reclamo administrativo municipal',
                    'Solicitud de informe previo',
                    'Solicitud de número municipal',
                    'Solicitud de certificado municipal',
                    'Regularización de actividad comercial',
                ]
            },
            REGISTRO_CIVIL: {
                label: 'Registro Civil e Identificación',
                icon: 'fa-id-card',
                color: '#14b8a6',
                campos: ['numero_rit_rc', 'partida_referencia'],
                tipos: [
                    'Solicitud de posesión efectiva intestada',
                    'Rectificación administrativa de partida',
                    'Solicitud de certificado de nacimiento',
                    'Solicitud de certificado de matrimonio',
                    'Solicitud de certificado de defunción',
                    'Tramitación de cambio de nombre',
                    'Inscripción de mandato o poder',
                ]
            },
            TGR: {
                label: 'Tesorería General de la República',
                icon: 'fa-piggy-bank',
                color: '#f97316',
                campos: ['numero_folio_tgr', 'numero_deuda'],
                tipos: [
                    'Convenio de pago',
                    'Solicitud de prescripción administrativa',
                    'Devolución de fondos',
                    'Consulta de deudas tributarias',
                ]
            },
            SIR: {
                label: 'Superintendencia de Insolvencia',
                icon: 'fa-balance-scale',
                color: '#6366f1',
                campos: ['numero_expediente_sir', 'rut_deudor'],
                tipos: [
                    'Procedimiento de renegociación (persona deudora)',
                    'Liquidación voluntaria',
                    'Liquidación forzosa',
                    'Renegociación MYPE',
                    'Verificación de créditos',
                ]
            },
            NOTARIA: {
                label: 'Notaría',
                icon: 'fa-file-signature',
                color: '#64748b',
                campos: ['numero_repertorio', 'notaria'],
                tipos: [
                    'Redacción y autorización de escritura pública',
                    'Constitución de sociedad',
                    'Protocolización de documento',
                    'Mandato y poder',
                    'Acta notarial',
                    'Legalizaciones',
                    'Copias autorizadas',
                ]
            },
            SUPERIR: {
                label: 'Superintendencia de Insolvencia (SUPERIR)',
                icon: 'fa-balance-scale',
                color: '#6366f1',
                campos: ['numero_expediente_sir', 'rut_deudor'],
                tipos: [
                    'Inicio de procedimiento de renegociación (persona deudora)',
                    'Solicitud de liquidación voluntaria empresa',
                    'Verificación de créditos',
                    'Impugnación de créditos',
                    'Coordinación con veedores y liquidadores',
                    'Reformulación de acuerdo de pago',
                    'Solicitud de certificación de estado concursal',
                    'Liquidación forzosa',
                    'Renegociación MYPE',
                ]
            },
            SSALUD: {
                label: 'Superintendencia de Salud',
                icon: 'fa-heartbeat',
                color: '#e11d48',
                campos: ['numero_reclamo', 'isapre_fonasa'],
                tipos: [
                    'Presentación de reclamo contra Isapre',
                    'Apelación de alza de plan de salud',
                    'Solicitud de cobertura GES',
                    'Procedimiento arbitral en salud',
                    'Requerimiento de información médica',
                    'Recurso administrativo contra resolución',
                ]
            },
            SMA: {
                label: 'Superintendencia del Medio Ambiente (SMA)',
                icon: 'fa-leaf',
                color: '#16a34a',
                campos: ['numero_expediente_sma', 'rol_proyecto'],
                tipos: [
                    'Presentación de descargos en procedimiento sancionatorio',
                    'Elaboración de programa de cumplimiento',
                    'Solicitud de medida provisional',
                    'Reclamación administrativa ambiental',
                    'Coordinación de auditoría ambiental',
                    'Respuesta a requerimiento de fiscalización',
                ]
            },
            CMF: {
                label: 'Comisión para el Mercado Financiero (CMF)',
                icon: 'fa-chart-line',
                color: '#0284c7',
                campos: ['numero_expediente_cmf', 'entidad_regulada'],
                tipos: [
                    'Descargos en proceso sancionatorio CMF',
                    'Inscripción de entidad financiera',
                    'Actualización de antecedentes regulatorios',
                    'Reclamo contra banco o aseguradora',
                    'Autorización para emisión de valores',
                    'Modificación estatutaria de entidad supervisada',
                ]
            },
            IPS_AFP: {
                label: 'IPS / AFP / Previsión Social',
                icon: 'fa-piggy-bank',
                color: '#d97706',
                campos: ['numero_solicitud_ips', 'afp'],
                tipos: [
                    'Solicitud de pensión',
                    'Reclamación por cálculo de pensión',
                    'Cobro de asignaciones familiares',
                    'Regularización de cotizaciones',
                    'Revisión de beneficios previsionales',
                    'Solicitud de reliquidación',
                ]
            },
            ECONOMIA: {
                label: 'Ministerio de Economía / Empresa en un Día',
                icon: 'fa-briefcase',
                color: '#7c3aed',
                campos: ['rut_sociedad', 'numero_acto'],
                tipos: [
                    'Constitución de sociedad',
                    'Modificación de estatutos',
                    'Transformación societaria',
                    'Fusión de sociedades',
                    'División de sociedad',
                    'Disolución de sociedad',
                    'Rectificación de error registral',
                ]
            },
            SAG: {
                label: 'Servicio Agrícola y Ganadero (SAG)',
                icon: 'fa-tractor',
                color: '#65a30d',
                campos: ['numero_expediente_sag', 'producto'],
                tipos: [
                    'Solicitud de permiso de importación/exportación',
                    'Certificado fitosanitario',
                    'Descargos en proceso sancionatorio SAG',
                    'Autorización sanitaria agrícola',
                    'Registro de producto agroquímico',
                ]
            },
            CARABINEROS: {
                label: 'Carabineros / Delegación Presidencial',
                icon: 'fa-shield-alt',
                color: '#1e40af',
                campos: ['numero_solicitud', 'region'],
                tipos: [
                    'Autorización para evento masivo',
                    'Permiso para marcha o actividad pública',
                    'Solicitud de informe administrativo',
                    'Autorización de seguridad privada',
                ]
            },
            SUBTEL: {
                label: 'Subsecretaría de Telecomunicaciones (SUBTEL)',
                icon: 'fa-satellite-dish',
                color: '#0e7490',
                campos: ['numero_concesion', 'tipo_servicio'],
                tipos: [
                    'Solicitud de concesión de telecomunicaciones',
                    'Autorización de instalación',
                    'Reclamo contra empresa de telecomunicaciones',
                    'Recurso administrativo SUBTEL',
                    'Inscripción de servicio de telecomunicaciones',
                ]
            },
            OTRO: {
                label: 'Otro organismo',
                icon: 'fa-globe',
                color: '#94a3b8',
                campos: ['organismo_nombre'],
                tipos: ['Trámite administrativo']
            }
        };

        const TRAMITES_ESTADOS = [
            { id: 'pendiente',   label: 'Pendiente',     color: '#f59e0b', icon: 'fa-clock' },
            { id: 'ingresado',   label: 'Ingresado',     color: '#0ea5e9', icon: 'fa-paper-plane' },
            { id: 'en_proceso',  label: 'En proceso',    color: '#8b5cf6', icon: 'fa-spinner' },
            { id: 'observado',   label: 'Observado',     color: '#f97316', icon: 'fa-exclamation-triangle' },
            { id: 'resuelto',    label: 'Resuelto',      color: '#10b981', icon: 'fa-check-circle' },
            { id: 'rechazado',   label: 'Rechazado',     color: '#ef4444', icon: 'fa-times-circle' },
            { id: 'archivado',   label: 'Archivado',     color: '#94a3b8', icon: 'fa-archive' },
        ];

        // ── Capa de datos ─────────────────────────────────────────────────
        const TramitesDB = {
            _cargar() {
                try { return AppConfig.get('tramites') || []; }
                catch(e) { return []; }
            },
            _guardar(lista) {
                try { AppConfig.set('tramites', lista); } catch(e) {}
            },
            todos() { return this._cargar(); },
            porId(id) { return this._cargar().find(t => t.id === id); },
            crear(datos) {
                const lista = this._cargar();
                const t = {
                    id: 'TRA-' + Date.now(),
                    fechaCreacion: new Date().toISOString(),
                    ...datos,
                    eventos: [],
                    documentos: [],
                    honorarios: { monto: 0, pagado: 0 }
                };
                lista.unshift(t);
                this._guardar(lista);
                return t;
            },
            actualizar(id, cambios) {
                const lista = this._cargar();
                const idx = lista.findIndex(t => t.id === id);
                if (idx !== -1) {
                    lista[idx] = { ...lista[idx], ...cambios, fechaModificacion: new Date().toISOString() };
                    this._guardar(lista);
                    return lista[idx];
                }
                return null;
            },
            eliminar(id) {
                const lista = this._cargar().filter(t => t.id !== id);
                this._guardar(lista);
            },
            agregarEvento(id, evento) {
                const lista = this._cargar();
                const idx = lista.findIndex(t => t.id === id);
                if (idx !== -1) {
                    lista[idx].eventos = lista[idx].eventos || [];
                    lista[idx].eventos.push({
                        id: 'EVT-' + Date.now(),
                        fecha: new Date().toISOString(),
                        ...evento
                    });
                    this._guardar(lista);
                }
            }
        };

        // ── Estado UI ─────────────────────────────────────────────────────
        let _tramiteFiltros = { organismo: '', estado: '', texto: '' };
        let _tramiteDetalle = null; // ID del trámite en vista detalle

        // ── Helpers ───────────────────────────────────────────────────────
        function tramiteGetOrganismo(key) {
            return TRAMITES_CATALOGO[key] || TRAMITES_CATALOGO.OTRO;
        }

        function tramiteGetEstado(id) {
            return TRAMITES_ESTADOS.find(e => e.id === id) || TRAMITES_ESTADOS[0];
        }

        function tramiteFecha(iso) {
            if (!iso) return '—';
            const d = new Date(iso);
            return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        function tramiteDiasRestantes(fechaLimite) {
            if (!fechaLimite) return null;
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const lim = new Date(fechaLimite); lim.setHours(0,0,0,0);
            return Math.ceil((lim - hoy) / 86400000);
        }

        function tramiteBadgeDias(dias) {
            if (dias === null) return '';
            if (dias < 0) return `<span class="tr-badge tr-badge-red"><i class="fas fa-fire"></i> Vencido (${Math.abs(dias)}d)</span>`;
            if (dias === 0) return `<span class="tr-badge tr-badge-red"><i class="fas fa-exclamation-circle"></i> Vence hoy</span>`;
            if (dias <= 3) return `<span class="tr-badge tr-badge-orange"><i class="fas fa-clock"></i> ${dias}d</span>`;
            if (dias <= 10) return `<span class="tr-badge tr-badge-yellow"><i class="fas fa-clock"></i> ${dias}d</span>`;
            return `<span class="tr-badge tr-badge-gray"><i class="fas fa-calendar"></i> ${dias}d</span>`;
        }

        function tramiteCausaLabel(causaId) {
            if (!causaId) return '';
            const c = (Store?.causas?.() || []).find(c => c.id === causaId);
            return c ? `<span class="tr-causa-link" title="Ver causa">${c.caratula || causaId}</span>` : '';
        }

        // ── Hub-nav de trámites (inyectado al navegar) ────────────────────
        function inyectarTramitesNav() {
            const section = document.getElementById('tramites');
            if (!section || section.querySelector('.tramites-hub-nav')) return;
            const nav = document.createElement('div');
            nav.className = 'hub-nav tramites-hub-nav';
            nav.style.marginBottom = '20px';
            nav.innerHTML = `
                <button class="hub-tab" onclick="tab('causas', this)">
                    <i class="fas fa-gavel"></i> Causas
                </button>
                <button class="hub-tab" onclick="tab('archivos', this)">
                    <i class="fas fa-folder-open"></i> Documentos
                </button>
                <button class="hub-tab active" id="hub-tab-tramites-injected">
                    <i class="fas fa-building"></i> Trámites
                </button>
            `;
            const main = section.querySelector('#tramites-main');
            if (main) section.insertBefore(nav, main);
            else section.prepend(nav);
        }
        window.inyectarTramitesNav = inyectarTramitesNav;

        // ── Render lista principal ────────────────────────────────────────
        function tramitesRender() {
            const todos = TramitesDB.todos();
            const { organismo, estado, texto } = _tramiteFiltros;

            const filtrados = todos.filter(t => {
                if (organismo && t.organismo !== organismo) return false;
                if (estado && t.estado !== estado) return false;
                if (texto) {
                    const q = texto.toLowerCase();
                    if (!(t.caratula||'').toLowerCase().includes(q) &&
                        !(t.tipo||'').toLowerCase().includes(q) &&
                        !(t.cliente||'').toLowerCase().includes(q) &&
                        !(t.observaciones||'').toLowerCase().includes(q)) return false;
                }
                return true;
            });

            // Stats resumen
            const stats = {
                total: todos.length,
                activos: todos.filter(t => !['resuelto','rechazado','archivado'].includes(t.estado)).length,
                vencidos: todos.filter(t => {
                    const d = tramiteDiasRestantes(t.fechaLimite);
                    return d !== null && d < 0 && t.estado !== 'resuelto';
                }).length,
                proximos: todos.filter(t => {
                    const d = tramiteDiasRestantes(t.fechaLimite);
                    return d !== null && d >= 0 && d <= 7 && t.estado !== 'resuelto';
                }).length,
            };

            const cont = document.getElementById('tramites-main');
            if (!cont) return;

            cont.innerHTML = `
            <!-- Stats Dashboard -->
            <div class="tr-stats-row">
                <div class="tr-stat-card">
                    <div class="tr-stat-icon" style="color:#0ea5e9;"><i class="fas fa-folder-open"></i></div>
                    <div class="tr-stat-body">
                        <div class="tr-stat-num">${stats.total}</div>
                        <div class="tr-stat-lbl">Total trámites</div>
                    </div>
                </div>
                <div class="tr-stat-card">
                    <div class="tr-stat-icon" style="color:#8b5cf6;"><i class="fas fa-spinner"></i></div>
                    <div class="tr-stat-body">
                        <div class="tr-stat-num">${stats.activos}</div>
                        <div class="tr-stat-lbl">En curso</div>
                    </div>
                </div>
                <div class="tr-stat-card ${stats.vencidos > 0 ? 'tr-stat-alert' : ''}">
                    <div class="tr-stat-icon" style="color:#ef4444;"><i class="fas fa-fire"></i></div>
                    <div class="tr-stat-body">
                        <div class="tr-stat-num">${stats.vencidos}</div>
                        <div class="tr-stat-lbl">Vencidos</div>
                    </div>
                </div>
                <div class="tr-stat-card ${stats.proximos > 0 ? 'tr-stat-warn' : ''}">
                    <div class="tr-stat-icon" style="color:#f59e0b;"><i class="fas fa-bell"></i></div>
                    <div class="tr-stat-body">
                        <div class="tr-stat-num">${stats.proximos}</div>
                        <div class="tr-stat-lbl">Vencen en 7d</div>
                    </div>
                </div>
            </div>

            <!-- Filtros -->
            <div class="tr-filtros">
                <div class="tr-filtro-group">
                    <label>Organismo</label>
                    <select id="tr-fil-organismo" onchange="tramiteFiltrar()">
                        <option value="">Todos</option>
                        ${Object.entries(TRAMITES_CATALOGO).map(([k,v]) =>
                            `<option value="${k}" ${organismo===k?'selected':''}>${v.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="tr-filtro-group">
                    <label>Estado</label>
                    <select id="tr-fil-estado" onchange="tramiteFiltrar()">
                        <option value="">Todos</option>
                        ${TRAMITES_ESTADOS.map(e =>
                            `<option value="${e.id}" ${estado===e.id?'selected':''}>${e.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="tr-filtro-group" style="flex:2;">
                    <label>Buscar</label>
                    <input type="text" id="tr-fil-texto" placeholder="Buscar por caratulación, cliente, tipo…"
                           value="${texto}" oninput="tramiteFiltrar()">
                </div>
                <button class="tr-btn tr-btn-secondary" onclick="tramiteLimpiarFiltros()">
                    <i class="fas fa-times"></i> Limpiar
                </button>
                <button class="tr-btn tr-btn-primary" onclick="tramiteAbrirModal()">
                    <i class="fas fa-plus"></i> Nuevo trámite
                </button>
            </div>

            <!-- Tabla / Cards -->
            ${filtrados.length === 0
                ? `<div class="tr-empty"><i class="fas fa-folder-open"></i><p>${todos.length === 0 ? 'No hay trámites registrados. Crea el primero.' : 'No hay trámites que coincidan con los filtros.'}</p></div>`
                : `<div class="tr-lista">${filtrados.map(t => tramiteCardHTML(t)).join('')}</div>`
            }`;
        }

        function tramiteCardHTML(t) {
            const org = tramiteGetOrganismo(t.organismo);
            const est = tramiteGetEstado(t.estado);
            const dias = tramiteDiasRestantes(t.fechaLimite);
            const pct = t.honorarios?.monto > 0
                ? Math.min(100, Math.round((t.honorarios.pagado / t.honorarios.monto) * 100))
                : null;

            const checkTotal = (t.checklist || []).length;
            const checkOk = (t.checklist || []).filter(c => c.ok).length;

            return `
            <div class="tr-card" onclick="tramiteVerDetalle('${t.id}')">
                <div class="tr-card-left" style="border-left-color:${org.color};">
                    <div class="tr-card-org" style="color:${org.color};">
                        <i class="fas ${org.icon}"></i>
                        <span>${org.label}</span>
                    </div>
                    <div class="tr-card-tipo">${t.tipo || '—'}</div>
                    <div class="tr-card-caratula">${t.caratula || 'Sin caratulación'}</div>
                    ${t.cliente ? `<div class="tr-card-meta"><i class="fas fa-user"></i> ${t.cliente}</div>` : ''}
                    ${t.causaId ? `<div class="tr-card-meta"><i class="fas fa-gavel"></i> Vinculada a causa</div>` : ''}
                </div>
                <div class="tr-card-right">
                    <div class="tr-card-estado" style="background:${est.color}22; color:${est.color}; border:1px solid ${est.color}44;">
                        <i class="fas ${est.icon}"></i> ${est.label}
                    </div>
                    ${dias !== null ? tramiteBadgeDias(dias) : ''}
                    ${t.fechaLimite ? `<div class="tr-card-fecha"><i class="fas fa-calendar-alt"></i> ${tramiteFecha(t.fechaLimite)}</div>` : ''}
                    ${checkTotal > 0 ? `
                    <div class="tr-card-check">
                        <div class="tr-check-bar">
                            <div class="tr-check-fill" style="width:${Math.round(checkOk/checkTotal*100)}%; background:${org.color};"></div>
                        </div>
                        <span>${checkOk}/${checkTotal} docs</span>
                    </div>` : ''}
                    ${pct !== null ? `
                    <div class="tr-card-honorario">
                        <i class="fas fa-coins"></i>
                        $${(t.honorarios.pagado||0).toLocaleString('es-CL')} / $${(t.honorarios.monto||0).toLocaleString('es-CL')}
                    </div>` : ''}
                </div>
            </div>`;
        }

        // ── Detalle de trámite ────────────────────────────────────────────
        function tramiteVerDetalle(id) {
            _tramiteDetalle = id;
            const t = TramitesDB.porId(id);
            if (!t) return;
            const org = tramiteGetOrganismo(t.organismo);
            const est = tramiteGetEstado(t.estado);

            const cont = document.getElementById('tramites-main');
            if (!cont) return;

            const checkTotal = (t.checklist || []).length;
            const checkOk = (t.checklist || []).filter(c => c.ok).length;
            const pct = checkTotal > 0 ? Math.round(checkOk/checkTotal*100) : 0;

            cont.innerHTML = `
            <div class="tr-detalle">
                <!-- Header detalle -->
                <div class="tr-det-header" style="border-left: 4px solid ${org.color};">
                    <button class="tr-btn tr-btn-ghost tr-det-back" onclick="tramitesRender()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                    <div class="tr-det-org" style="color:${org.color};">
                        <i class="fas ${org.icon}"></i> ${org.label}
                    </div>
                    <div class="tr-det-title">${t.tipo || 'Trámite sin tipo'}</div>
                    <div class="tr-det-caratula">${t.caratula || ''}</div>
                    <div class="tr-det-actions">
                        <div class="tr-estado-selector">
                            ${TRAMITES_ESTADOS.map(e => `
                            <button class="tr-est-btn ${t.estado === e.id ? 'active' : ''}"
                                    style="${t.estado === e.id ? `background:${e.color};color:#fff;border-color:${e.color};` : ''}"
                                    onclick="tramiteCambiarEstado('${t.id}','${e.id}')">
                                <i class="fas ${e.icon}"></i> ${e.label}
                            </button>`).join('')}
                        </div>
                        <button class="tr-btn tr-btn-primary" onclick="tramiteAbrirModal('${t.id}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="tr-btn tr-btn-danger" onclick="tramiteEliminar('${t.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="tr-det-body">
                    <!-- Col izq: info principal -->
                    <div class="tr-det-col">
                        <!-- Info básica -->
                        <div class="tr-det-section">
                            <h4><i class="fas fa-info-circle"></i> Información general</h4>
                            <div class="tr-det-grid">
                                <div class="tr-det-field"><label>Cliente / Requirente</label><span>${t.cliente || '—'}</span></div>
                                <div class="tr-det-field"><label>Causa vinculada</label><span>${t.causaId ? tramiteCausaLabel(t.causaId) : '—'}</span></div>
                                <div class="tr-det-field"><label>Fecha ingreso</label><span>${tramiteFecha(t.fechaIngreso)}</span></div>
                                <div class="tr-det-field"><label>Fecha límite</label>
                                    <span>
                                        ${tramiteFecha(t.fechaLimite)}
                                        ${tramiteDiasRestantes(t.fechaLimite) !== null ? tramiteBadgeDias(tramiteDiasRestantes(t.fechaLimite)) : ''}
                                    </span>
                                </div>
                                <div class="tr-det-field"><label>Responsable</label><span>${t.responsable || '—'}</span></div>
                                <div class="tr-det-field"><label>Oficina / Sucursal</label><span>${t.oficina || '—'}</span></div>
                                ${t.organismo === 'CBR' ? `
                                <div class="tr-det-field"><label>Rol propiedad</label><span>${t.rol_propiedad || '—'}</span></div>
                                <div class="tr-det-field"><label>Folio real</label><span>${t.folio_real || '—'}</span></div>` : ''}
                                ${t.organismo === 'SII' ? `
                                <div class="tr-det-field"><label>RUT contribuyente</label><span>${t.rut_contribuyente || '—'}</span></div>
                                <div class="tr-det-field"><label>Folio documento</label><span>${t.folio_documento || '—'}</span></div>` : ''}
                                ${t.organismo === 'DT' ? `
                                <div class="tr-det-field"><label>N° fiscalización</label><span>${t.numero_fiscalizacion || '—'}</span></div>
                                <div class="tr-det-field"><label>N° multa</label><span>${t.numero_multa || '—'}</span></div>` : ''}
                                ${t.organismo === 'TGR' ? `
                                <div class="tr-det-field"><label>Folio TGR</label><span>${t.numero_folio_tgr || '—'}</span></div>
                                <div class="tr-det-field"><label>N° deuda</label><span>${t.numero_deuda || '—'}</span></div>` : ''}
                                ${t.organismo === 'NOTARIA' ? `
                                <div class="tr-det-field"><label>N° repertorio</label><span>${t.numero_repertorio || '—'}</span></div>
                                <div class="tr-det-field"><label>Notaría</label><span>${t.notaria || '—'}</span></div>` : ''}
                                ${t.organismo === 'MUNICIPALIDAD' ? `
                                <div class="tr-det-field"><label>N° patente</label><span>${t.numero_patente || '—'}</span></div>
                                <div class="tr-det-field"><label>Municipio</label><span>${t.municipio || '—'}</span></div>` : ''}
                            </div>
                            ${t.observaciones ? `<div class="tr-det-obs">${t.observaciones}</div>` : ''}
                        </div>

                        <!-- Honorarios -->
                        <div class="tr-det-section">
                            <h4><i class="fas fa-coins"></i> Honorarios y costos</h4>
                            <div class="tr-det-grid">
                                <div class="tr-det-field"><label>Honorario total</label>
                                    <span>$${(t.honorarios?.monto || 0).toLocaleString('es-CL')}</span>
                                </div>
                                <div class="tr-det-field"><label>Monto pagado</label>
                                    <span>$${(t.honorarios?.pagado || 0).toLocaleString('es-CL')}</span>
                                </div>
                                <div class="tr-det-field"><label>Saldo</label>
                                    <span style="color:${(t.honorarios?.monto - t.honorarios?.pagado) > 0 ? '#ef4444' : '#10b981'};">
                                        $${((t.honorarios?.monto||0) - (t.honorarios?.pagado||0)).toLocaleString('es-CL')}
                                    </span>
                                </div>
                            </div>
                            ${t.honorarios?.monto > 0 ? `
                            <div class="tr-honorario-bar-wrap">
                                <div class="tr-honorario-bar">
                                    <div class="tr-honorario-fill" style="width:${Math.min(100, Math.round((t.honorarios.pagado/t.honorarios.monto)*100))}%; background:${org.color};"></div>
                                </div>
                                <span>${Math.min(100, Math.round((t.honorarios.pagado/t.honorarios.monto)*100))}% cobrado</span>
                            </div>` : ''}
                            <div class="tr-honorario-actions">
                                <input type="number" id="tr-det-honorario" placeholder="Monto total ($)" value="${t.honorarios?.monto || ''}" min="0">
                                <input type="number" id="tr-det-pagado" placeholder="Pagado ($)" value="${t.honorarios?.pagado || ''}" min="0">
                                <button class="tr-btn tr-btn-secondary" onclick="tramiteGuardarHonorarios('${t.id}')">
                                    <i class="fas fa-save"></i> Guardar
                                </button>
                            </div>
                        </div>

                        <!-- Eventos / Seguimiento -->
                        <div class="tr-det-section">
                            <h4><i class="fas fa-history"></i> Registro de actividad</h4>
                            <div class="tr-evento-form">
                                <input type="text" id="tr-evt-desc" placeholder="Describir acción, gestión o nota…" style="flex:1;">
                                <select id="tr-evt-tipo">
                                    <option value="gestion">Gestión</option>
                                    <option value="nota">Nota</option>
                                    <option value="pago">Pago</option>
                                    <option value="respuesta">Respuesta organismo</option>
                                    <option value="alerta">Alerta</option>
                                </select>
                                <button class="tr-btn tr-btn-primary" onclick="tramiteAgregarEvento('${t.id}')">
                                    <i class="fas fa-plus"></i> Agregar
                                </button>
                            </div>
                            <div class="tr-eventos-lista">
                                ${(t.eventos || []).length === 0
                                    ? '<div class="tr-empty-small">Sin eventos registrados</div>'
                                    : [...(t.eventos || [])].reverse().map(e => `
                                <div class="tr-evento-item tr-evento-${e.tipo||'nota'}">
                                    <div class="tr-evento-dot"></div>
                                    <div class="tr-evento-body">
                                        <div class="tr-evento-desc">${e.descripcion}</div>
                                        <div class="tr-evento-meta">${tramiteFecha(e.fecha)} · ${e.tipo||'nota'}</div>
                                    </div>
                                    <button class="tr-evt-del" onclick="tramiteEliminarEvento('${t.id}','${e.id}')">×</button>
                                </div>`).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Col der: checklist documentos -->
                    <div class="tr-det-col tr-det-col-sm">
                        <div class="tr-det-section">
                            <h4><i class="fas fa-tasks"></i> Checklist de documentos
                                <span class="tr-check-pct" style="color:${pct === 100 ? '#10b981' : '#f59e0b'};">${pct}%</span>
                            </h4>
                            ${checkTotal > 0 ? `
                            <div class="tr-check-global-bar">
                                <div class="tr-check-global-fill" style="width:${pct}%; background:${pct === 100 ? '#10b981' : org.color};"></div>
                            </div>` : ''}
                            <div id="tr-checklist-items">
                                ${tramiteChecklistHTML(t)}
                            </div>
                            <div class="tr-check-add">
                                <input type="text" id="tr-check-input" placeholder="Nuevo documento requerido…" onkeydown="if(event.key==='Enter'){tramiteAgregarCheck('${t.id}');}">
                                <button class="tr-btn tr-btn-secondary" onclick="tramiteAgregarCheck('${t.id}')">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Sugerencias del catálogo -->
                        <div class="tr-det-section">
                            <h4><i class="fas fa-lightbulb"></i> Documentos habituales</h4>
                            <div class="tr-sugerencias">
                                ${tramiteDocsSugeridos(t.organismo, t.tipo).map(d => `
                                <button class="tr-sug-btn" onclick="tramiteAgregarCheckDesdeStr('${t.id}', '${d.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-plus-circle"></i> ${d}
                                </button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        function tramiteChecklistHTML(t) {
            if (!t.checklist || t.checklist.length === 0)
                return '<div class="tr-empty-small">Sin documentos en checklist</div>';
            return t.checklist.map(c => `
            <div class="tr-check-item ${c.ok ? 'ok' : ''}">
                <label>
                    <input type="checkbox" ${c.ok ? 'checked' : ''}
                           onchange="tramiteToggleCheck('${t.id}','${c.id}', this.checked)">
                    <span>${c.label}</span>
                </label>
                <button class="tr-check-del" onclick="tramiteEliminarCheck('${t.id}','${c.id}')">×</button>
            </div>`).join('');
        }

        function tramiteDocsSugeridos(organismo, tipo) {
            const base = {
                CBR: ['Escritura pública', 'Certificado de dominio vigente', 'Certificado de hipotecas', 'Plano', 'RUT vendedor', 'RUT comprador', 'Poder notarial (si aplica)'],
                SII: ['Formulario F29', 'Formulario F22', 'Cartilla tributaria', 'Balance', 'Libro de compras/ventas', 'Acreditación de identidad'],
                DT: ['Contrato de trabajo', 'Finiquito', 'Carta de despido', 'Liquidaciones de sueldo', 'Registro de asistencia', 'Comprobante presentación descargos'],
                SERVIU: ['Plano de planta', 'Certificado de informaciones previas', 'Memoria descriptiva', 'Presupuesto', 'Plano de ubicación', 'Certificado DOM'],
                MUNICIPALIDAD: ['Iniciación de actividades SII', 'Contrato de arriendo o título propiedad', 'Declaración de capital', 'Formulario patente'],
                REGISTRO_CIVIL: ['Partida de nacimiento', 'Partida de matrimonio', 'Testamento (si aplica)', 'Poder especial', 'Cédula de identidad'],
                TGR: ['Certificado de deuda', 'Comprobante de pago', 'Formulario de convenio', 'RUT y cédula'],
                SIR: ['Balance', 'Declaración de bienes', 'Listado de acreedores', 'Certificado de deudas tributarias', 'Contrato de crédito'],
                NOTARIA: ['Borrador de escritura', 'Cédulas de identidad', 'RUT', 'Poderes (si aplica)', 'Certificados requeridos'],
                SUPERIR: ['Nómina de bienes', 'Listado de acreedores', 'Balance', 'Declaración de deudas', 'Poderes especiales', 'Certificados de deuda'],
                SSALUD: ['Certificado de atención médica', 'Documentación del plan de salud', 'Resolución impugnada', 'Cédula de identidad', 'Poder simple'],
                SMA: ['Resolución de calificación ambiental', 'Plan de cumplimiento', 'Informes técnicos', 'Descargos firmados', 'Acta de fiscalización'],
                CMF: ['Memoria anual', 'Estatutos actualizados', 'Resolución sancionatoria', 'Descargos', 'Antecedentes financieros'],
                IPS_AFP: ['Certificado de cotizaciones', 'Cédula de identidad', 'Liquidaciones de renta', 'Certificado de AFP', 'Resolución impugnada'],
                ECONOMIA: ['Escritura de constitución', 'RUT de socios', 'Poder especial', 'Estatutos vigentes', 'Certificado de vigencia'],
                SAG: ['Análisis de laboratorio', 'Formulario SAG', 'Factura de importación/exportación', 'Certificado de origen', 'Registro de establecimiento'],
                CARABINEROS: ['Solicitud firmada', 'Plan del evento', 'Nómina de asistentes', 'Seguro de responsabilidad', 'Plano del recinto'],
                SUBTEL: ['Solicitud de concesión', 'Plano técnico', 'Contrato de servicio', 'Certificado de ingeniería', 'Acredita domicilio'],
                OTRO: ['Documento de identidad', 'Poder notarial', 'Formulario del organismo'],
            };
            return base[organismo] || base.OTRO;
        }

        // ── Funciones de interacción ──────────────────────────────────────
        function tramiteFiltrar() {
            _tramiteFiltros.organismo = document.getElementById('tr-fil-organismo')?.value || '';
            _tramiteFiltros.estado    = document.getElementById('tr-fil-estado')?.value || '';
            _tramiteFiltros.texto     = document.getElementById('tr-fil-texto')?.value || '';
            tramitesRender();
        }

        function tramiteLimpiarFiltros() {
            _tramiteFiltros = { organismo: '', estado: '', texto: '' };
            tramitesRender();
        }

        function tramiteCambiarEstado(id, nuevoEstado) {
            TramitesDB.actualizar(id, { estado: nuevoEstado });
            TramitesDB.agregarEvento(id, {
                descripcion: `Estado cambiado a: ${tramiteGetEstado(nuevoEstado).label}`,
                tipo: 'gestion'
            });
            tramiteVerDetalle(id);
        }

        function tramiteAgregarEvento(id) {
            const desc = document.getElementById('tr-evt-desc')?.value?.trim();
            const tipo = document.getElementById('tr-evt-tipo')?.value || 'nota';
            if (!desc) return mostrarToast('Escribe una descripción para el evento', 'warning');
            TramitesDB.agregarEvento(id, { descripcion: desc, tipo });
            tramiteVerDetalle(id);
        }

        function tramiteEliminarEvento(tramiteId, eventoId) {
            const t = TramitesDB.porId(tramiteId);
            if (!t) return;
            TramitesDB.actualizar(tramiteId, {
                eventos: t.eventos.filter(e => e.id !== eventoId)
            });
            tramiteVerDetalle(tramiteId);
        }

        function tramiteToggleCheck(tramiteId, checkId, valor) {
            const t = TramitesDB.porId(tramiteId);
            if (!t) return;
            const cl = (t.checklist || []).map(c => c.id === checkId ? {...c, ok: valor} : c);
            TramitesDB.actualizar(tramiteId, { checklist: cl });
            // Re-render sólo el checklist sin recargar todo
            const t2 = TramitesDB.porId(tramiteId);
            const cont = document.getElementById('tr-checklist-items');
            if (cont) cont.innerHTML = tramiteChecklistHTML(t2);
        }

        function tramiteAgregarCheck(tramiteId) {
            const input = document.getElementById('tr-check-input');
            const val = (input?.value || '').trim();
            if (!val) return;
            // Limpiar input antes de re-render para evitar pérdida del valor
            if (input) input.value = '';
            const t = TramitesDB.porId(tramiteId);
            if (!t) return;
            const cl = [...(t.checklist || []), { id: 'CHK-' + Date.now(), label: val, ok: false }];
            TramitesDB.actualizar(tramiteId, { checklist: cl });
            // Re-render solo el checklist, no todo el detalle
            const t2 = TramitesDB.porId(tramiteId);
            const cont = document.getElementById('tr-checklist-items');
            if (cont) {
                cont.innerHTML = tramiteChecklistHTML(t2);
                // Actualizar barra de progreso
                const total = (t2.checklist||[]).length;
                const ok = (t2.checklist||[]).filter(c=>c.ok).length;
                const pct = total > 0 ? Math.round(ok/total*100) : 0;
                const bar = cont.closest('.tr-det-section')?.querySelector('.tr-check-global-fill');
                if (bar) bar.style.width = pct + '%';
                const pctEl = cont.closest('.tr-det-section')?.querySelector('.tr-check-pct');
                if (pctEl) pctEl.textContent = pct + '%';
            } else {
                tramiteVerDetalle(tramiteId);
            }
        }

        function tramiteAgregarCheckDesdeStr(tramiteId, label) {
            const t = TramitesDB.porId(tramiteId);
            if (!t) return;
            const cl = [...(t.checklist || []), { id: 'CHK-' + Date.now(), label, ok: false }];
            TramitesDB.actualizar(tramiteId, { checklist: cl });
            tramiteVerDetalle(tramiteId);
        }

        function tramiteEliminarCheck(tramiteId, checkId) {
            const t = TramitesDB.porId(tramiteId);
            if (!t) return;
            TramitesDB.actualizar(tramiteId, { checklist: t.checklist.filter(c => c.id !== checkId) });
            tramiteVerDetalle(tramiteId);
        }

        function tramiteGuardarHonorarios(id) {
            const monto  = parseFloat(document.getElementById('tr-det-honorario')?.value || 0);
            const pagado = parseFloat(document.getElementById('tr-det-pagado')?.value || 0);
            TramitesDB.actualizar(id, { honorarios: { monto, pagado } });
            tramiteVerDetalle(id);
            mostrarToast('Honorarios actualizados', 'success');
        }

        function tramiteEliminar(id) {
            if (!confirm('¿Eliminar este trámite? Esta acción no se puede deshacer.')) return;
            TramitesDB.eliminar(id);
            tramitesRender();
            mostrarToast('Trámite eliminado', 'info');
        }

        // ── Modal de creación/edición ─────────────────────────────────────
        function tramiteAbrirModal(id) {
            const t = id ? TramitesDB.porId(id) : null;
            const causas = (typeof Store !== 'undefined' ? Store.causas() : []);

            const orgOptions = Object.entries(TRAMITES_CATALOGO).map(([k, v]) =>
                `<option value="${k}" ${t?.organismo === k ? 'selected' : ''}>${v.label}</option>`
            ).join('');

            const estadoOptions = TRAMITES_ESTADOS.map(e =>
                `<option value="${e.id}" ${(t?.estado||'pendiente') === e.id ? 'selected' : ''}>${e.label}</option>`
            ).join('');

            const causaOptions = `<option value="">Sin causa vinculada</option>` +
                causas.map(c => `<option value="${c.id}" ${t?.causaId === c.id ? 'selected' : ''}>${c.caratula}</option>`).join('');

            const html = `
            <div class="tr-modal-overlay" id="tr-modal-overlay" onclick="tramiteCerrarModal(event)">
                <div class="tr-modal">
                    <div class="tr-modal-header">
                        <h3>${t ? 'Editar trámite' : 'Nuevo trámite administrativo'}</h3>
                        <button onclick="tramiteCerrarModal()" class="tr-modal-close">×</button>
                    </div>
                    <div class="tr-modal-body">
                        <div class="tr-form-row">
                            <div class="tr-form-group" style="flex:1.5;">
                                <label>Organismo *</label>
                                <select id="tr-f-organismo" onchange="tramiteActualizarTipos()">
                                    ${orgOptions}
                                </select>
                            </div>
                            <div class="tr-form-group" style="flex:2;">
                                <label>Tipo de trámite *</label>
                                <select id="tr-f-tipo"></select>
                            </div>
                        </div>
                        <div class="tr-form-row">
                            <div class="tr-form-group" style="flex:2;">
                                <label>Caratulación / Descripción</label>
                                <input type="text" id="tr-f-caratula" placeholder="Ej: González con Banco XX - Inscripción hipoteca" value="${t?.caratula||''}">
                            </div>
                            <div class="tr-form-group" style="flex:1;">
                                <label>Estado</label>
                                <select id="tr-f-estado">${estadoOptions}</select>
                            </div>
                        </div>
                        <div class="tr-form-row">
                            <div class="tr-form-group">
                                <label>Cliente / Requirente</label>
                                <input type="text" id="tr-f-cliente" placeholder="Nombre del cliente" value="${t?.cliente||''}">
                            </div>
                            <div class="tr-form-group">
                                <label>Vinculada a causa</label>
                                <select id="tr-f-causaid">${causaOptions}</select>
                            </div>
                        </div>
                        <div class="tr-form-row">
                            <div class="tr-form-group">
                                <label>Fecha de ingreso</label>
                                <input type="date" id="tr-f-fechaingreso" value="${t?.fechaIngreso?.slice(0,10)||''}">
                            </div>
                            <div class="tr-form-group">
                                <label>Fecha límite / Vencimiento</label>
                                <input type="date" id="tr-f-fechalimite" value="${t?.fechaLimite?.slice(0,10)||''}">
                            </div>
                        </div>
                        <div class="tr-form-row">
                            <div class="tr-form-group">
                                <label>Responsable</label>
                                <input type="text" id="tr-f-responsable" placeholder="Abogado/a a cargo" value="${t?.responsable||''}">
                            </div>
                            <div class="tr-form-group">
                                <label>Oficina / Sucursal organismo</label>
                                <input type="text" id="tr-f-oficina" placeholder="Ej: CBR Santiago, 1° Registro" value="${t?.oficina||''}">
                            </div>
                        </div>
                        <div id="tr-f-campos-extra"></div>
                        <div class="tr-form-group">
                            <label>Honorario total ($)</label>
                            <input type="number" id="tr-f-honorario" min="0" placeholder="0" value="${t?.honorarios?.monto||''}">
                        </div>
                        <div class="tr-form-group">
                            <label>Observaciones</label>
                            <textarea id="tr-f-obs" placeholder="Notas, instrucciones especiales, estado del trámite…" rows="3">${t?.observaciones||''}</textarea>
                        </div>
                    </div>
                    <div class="tr-modal-footer">
                        <button class="tr-btn tr-btn-secondary" onclick="tramiteCerrarModal()">Cancelar</button>
                        <button class="tr-btn tr-btn-primary" onclick="tramiteGuardar('${t?.id||''}')">
                            <i class="fas fa-save"></i> ${t ? 'Actualizar' : 'Crear trámite'}
                        </button>
                    </div>
                </div>
            </div>`;

            document.body.insertAdjacentHTML('beforeend', html);
            tramiteActualizarTipos(t?.tipo);
        }

        function tramiteActualizarTipos(seleccionado) {
            const org = document.getElementById('tr-f-organismo')?.value || 'CBR';
            const cat = TRAMITES_CATALOGO[org] || TRAMITES_CATALOGO.OTRO;
            const sel = document.getElementById('tr-f-tipo');
            if (!sel) return;
            sel.innerHTML = cat.tipos.map(ti =>
                `<option value="${ti}" ${seleccionado === ti ? 'selected' : ''}>${ti}</option>`
            ).join('');

            // Campos extra por organismo
            const extra = document.getElementById('tr-f-campos-extra');
            if (!extra) return;
            const campos = {
                CBR: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>Rol propiedad</label><input type="text" id="tr-f-rol" placeholder="Ej: 5324-1, San Miguel"></div>
                    <div class="tr-form-group"><label>Folio real</label><input type="text" id="tr-f-folio"></div></div>`,
                SII: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>RUT contribuyente</label><input type="text" id="tr-f-rut" placeholder="12.345.678-9"></div>
                    <div class="tr-form-group"><label>Folio documento</label><input type="text" id="tr-f-folio-doc"></div></div>`,
                DT: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° fiscalización</label><input type="text" id="tr-f-fisc"></div>
                    <div class="tr-form-group"><label>N° multa</label><input type="text" id="tr-f-multa"></div></div>`,
                TGR: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>Folio TGR</label><input type="text" id="tr-f-folio-tgr"></div>
                    <div class="tr-form-group"><label>N° deuda</label><input type="text" id="tr-f-deuda"></div></div>`,
                NOTARIA: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° repertorio</label><input type="text" id="tr-f-repertorio"></div>
                    <div class="tr-form-group"><label>Notaría</label><input type="text" id="tr-f-notaria" placeholder="Ej: Notaría de Andrés Rubio"></div></div>`,
                MUNICIPALIDAD: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° patente</label><input type="text" id="tr-f-patente"></div>
                    <div class="tr-form-group"><label>Municipio</label><input type="text" id="tr-f-municipio" placeholder="Ej: Municipalidad de Santiago"></div></div>`,
                SUPERIR: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Expediente SUPERIR</label><input type="text" id="tr-f-sir" placeholder="Ej: C-12345-2024"></div>
                    <div class="tr-form-group"><label>RUT deudor</label><input type="text" id="tr-f-rut-deudor" placeholder="12.345.678-9"></div></div>`,
                SSALUD: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Reclamo</label><input type="text" id="tr-f-reclamo" placeholder="Ej: R-2024-00123"></div>
                    <div class="tr-form-group"><label>Isapre / Fonasa</label><input type="text" id="tr-f-isapre" placeholder="Ej: Isapre Cruz Blanca"></div></div>`,
                SMA: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Expediente SMA</label><input type="text" id="tr-f-sma"></div>
                    <div class="tr-form-group"><label>Rol / Proyecto</label><input type="text" id="tr-f-proyecto-sma"></div></div>`,
                CMF: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Expediente CMF</label><input type="text" id="tr-f-cmf"></div>
                    <div class="tr-form-group"><label>Entidad regulada</label><input type="text" id="tr-f-entidad-cmf" placeholder="Nombre del banco/aseguradora"></div></div>`,
                IPS_AFP: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Solicitud IPS</label><input type="text" id="tr-f-ips"></div>
                    <div class="tr-form-group"><label>AFP</label><input type="text" id="tr-f-afp" placeholder="Ej: Habitat, Provida, Capital…"></div></div>`,
                ECONOMIA: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>RUT sociedad</label><input type="text" id="tr-f-rut-soc" placeholder="76.123.456-7"></div>
                    <div class="tr-form-group"><label>N° Acto / Escritura</label><input type="text" id="tr-f-acto-eco"></div></div>`,
                SAG: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Expediente SAG</label><input type="text" id="tr-f-sag"></div>
                    <div class="tr-form-group"><label>Producto</label><input type="text" id="tr-f-prod-sag" placeholder="Ej: Vino, fruta, agroquímico…"></div></div>`,
                CARABINEROS: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Solicitud</label><input type="text" id="tr-f-car"></div>
                    <div class="tr-form-group"><label>Región</label><input type="text" id="tr-f-region" placeholder="Ej: Metropolitana"></div></div>`,
                SUBTEL: `<div class="tr-form-row">
                    <div class="tr-form-group"><label>N° Concesión</label><input type="text" id="tr-f-subtel"></div>
                    <div class="tr-form-group"><label>Tipo de servicio</label><input type="text" id="tr-f-serv-subtel" placeholder="Ej: Telefonía móvil, internet…"></div></div>`,
            };
            extra.innerHTML = campos[org] || '';
        }

        function tramiteGuardar(id) {
            const org = document.getElementById('tr-f-organismo')?.value;
            const tipo = document.getElementById('tr-f-tipo')?.value;
            const caratula = document.getElementById('tr-f-caratula')?.value?.trim();
            const estado = document.getElementById('tr-f-estado')?.value || 'pendiente';
            const cliente = document.getElementById('tr-f-cliente')?.value?.trim();
            const causaId = document.getElementById('tr-f-causaid')?.value || '';
            const fechaIngreso = document.getElementById('tr-f-fechaingreso')?.value || '';
            const fechaLimite = document.getElementById('tr-f-fechalimite')?.value || '';
            const responsable = document.getElementById('tr-f-responsable')?.value?.trim();
            const oficina = document.getElementById('tr-f-oficina')?.value?.trim();
            const honorarioMonto = parseFloat(document.getElementById('tr-f-honorario')?.value || 0);
            const observaciones = document.getElementById('tr-f-obs')?.value?.trim();

            if (!org || !tipo) return mostrarToast('Selecciona organismo y tipo', 'warning');

            const camposExtra = {};
            if (org === 'CBR') {
                camposExtra.rol_propiedad = document.getElementById('tr-f-rol')?.value || '';
                camposExtra.folio_real    = document.getElementById('tr-f-folio')?.value || '';
            } else if (org === 'SII') {
                camposExtra.rut_contribuyente = document.getElementById('tr-f-rut')?.value || '';
                camposExtra.folio_documento   = document.getElementById('tr-f-folio-doc')?.value || '';
            } else if (org === 'DT') {
                camposExtra.numero_fiscalizacion = document.getElementById('tr-f-fisc')?.value || '';
                camposExtra.numero_multa         = document.getElementById('tr-f-multa')?.value || '';
            } else if (org === 'TGR') {
                camposExtra.numero_folio_tgr = document.getElementById('tr-f-folio-tgr')?.value || '';
                camposExtra.numero_deuda     = document.getElementById('tr-f-deuda')?.value || '';
            } else if (org === 'NOTARIA') {
                camposExtra.numero_repertorio = document.getElementById('tr-f-repertorio')?.value || '';
                camposExtra.notaria           = document.getElementById('tr-f-notaria')?.value || '';
            } else if (org === 'MUNICIPALIDAD') {
                camposExtra.numero_patente = document.getElementById('tr-f-patente')?.value || '';
                camposExtra.municipio      = document.getElementById('tr-f-municipio')?.value || '';
            }

            const datos = {
                organismo: org, tipo, caratula, estado, cliente, causaId,
                fechaIngreso: fechaIngreso ? new Date(fechaIngreso).toISOString() : '',
                fechaLimite: fechaLimite ? new Date(fechaLimite).toISOString() : '',
                responsable, oficina, observaciones,
                honorarios: { monto: honorarioMonto, pagado: id ? (TramitesDB.porId(id)?.honorarios?.pagado || 0) : 0 },
                ...camposExtra
            };

            if (id) {
                TramitesDB.actualizar(id, datos);
                mostrarToast('Trámite actualizado', 'success');
                tramiteCerrarModal();
                tramiteVerDetalle(id);
            } else {
                const nuevo = TramitesDB.crear(datos);
                mostrarToast('Trámite creado', 'success');
                tramiteCerrarModal();
                tramiteVerDetalle(nuevo.id);
            }
        }

        function tramiteCerrarModal(e) {
            if (e && e.target.id !== 'tr-modal-overlay') return;
            document.getElementById('tr-modal-overlay')?.remove();
        }

        // ── Helper toast (si no existe globalmente) ───────────────────────
        function mostrarToast(msg, tipo = 'info') {
            // usa el sistema de notificaciones existente si lo hay
            if (typeof showToast === 'function') { showToast(msg, tipo); return; }
            if (typeof notifToast === 'function') { notifToast(msg, tipo); return; }
            // fallback mínimo
            const el = document.createElement('div');
            el.textContent = msg;
            el.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;color:#fff;font-weight:600;z-index:9999;font-size:13px;
                background:${tipo==='success'?'#10b981':tipo==='warning'?'#f59e0b':'#0ea5e9'};`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
