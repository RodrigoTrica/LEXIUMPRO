        // ████████████████████████████████████████████████████████████████████
        // JS — BLOQUE 16: DOCTRINA & PRÁCTICA FORENSE  [v13 — con PDF Indexer]
        // Soporta: libros, artículos, apuntes, práctica forense, manuales,
        //          y PDFs indexados automáticamente con IA (v13).
        // ████████████████████████████████████████████████████████████████████

        const DOC_KEY = 'APPBOGADO_DOCTRINA_V1';

        const DOC_CATEGORIAS = [
            { id: 'civil',          label: 'Derecho Civil',           icon: 'fa-balance-scale', color: '#0ea5e9' },
            { id: 'procesal',       label: 'Derecho Procesal',        icon: 'fa-gavel',          color: '#8b5cf6' },
            { id: 'laboral',        label: 'Derecho Laboral',         icon: 'fa-hard-hat',       color: '#f59e0b' },
            { id: 'penal',          label: 'Derecho Penal',           icon: 'fa-shield-alt',     color: '#ef4444' },
            { id: 'constitucional', label: 'Derecho Constitucional',  icon: 'fa-landmark',       color: '#10b981' },
            { id: 'comercial',      label: 'Derecho Comercial',       icon: 'fa-briefcase',      color: '#f97316' },
            { id: 'administrativo', label: 'Derecho Administrativo',  icon: 'fa-building',       color: '#6366f1' },
            { id: 'tributario',     label: 'Derecho Tributario',      icon: 'fa-receipt',        color: '#14b8a6' },
            { id: 'ambiental',      label: 'Derecho Ambiental',       icon: 'fa-leaf',           color: '#16a34a' },
            { id: 'familia',        label: 'Derecho de Familia',      icon: 'fa-heart',          color: '#e11d48' },
            { id: 'practica',       label: 'Práctica Forense',        icon: 'fa-graduation-cap', color: '#7c3aed' },
            { id: 'otro',           label: 'Otro',                    icon: 'fa-book',           color: '#64748b' },
        ];

        const DOC_TIPOS = [
            'Libro / Manual', 'Artículo de revista', 'Apunte propio',
            'Práctica forense', 'Memorándum interno', 'Guía de actuación',
            'Modelo de escrito', 'Comentario de ley', 'PDF indexado', 'Otro',
        ];

        // ── Base de datos local ───────────────────────────────────────────
        // ── Base de datos — integrada al Store centralizado (desde v15) ──────
        // Los datos de Doctrina ahora viven en Store._doctrina y se persisten
        // con el backup automático junto al resto de la app.
        const DoctrinaDB = {
            _list() { return Store._doctrina; },
            all()    { return this._list(); },
            byId(id) { return this._list().find(d => d.id === id); },
            create(data) {
                const doc  = { id: 'DOC-' + Date.now(), fechaCreacion: new Date().toISOString(), ...data };
                Store._doctrina.unshift(doc);
                Store.save();
                return doc;
            },
            update(id, changes) {
                const list = this._list();
                const i    = list.findIndex(d => d.id === id);
                if (i !== -1) {
                    list[i] = { ...list[i], ...changes, fechaModificacion: new Date().toISOString() };
                    Store.save();
                    return list[i];
                }
                return null;
            },
            delete(id) {
                Store._ref._doctrina = Store._doctrina.filter(d => d.id !== id);
                Store.save();
            },
        };

        // ── Estado UI ─────────────────────────────────────────────────────
        let _docFiltros = { cat: '', tipo: '', q: '' };
        let _docViewing = null;

        // ── Helpers ───────────────────────────────────────────────────────
        function docGetCat(id) { return DOC_CATEGORIAS.find(c => c.id === id) || DOC_CATEGORIAS.at(-1); }

        function docFecha(iso) {
            if (!iso) return '';
            return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        function docExtract(texto, q) {
            if (!texto) return '';
            if (!q)    return texto.slice(0, 200) + (texto.length > 200 ? '…' : '');
            const idx = texto.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) return texto.slice(0, 200) + (texto.length > 200 ? '…' : '');
            const start = Math.max(0, idx - 80);
            const end   = Math.min(texto.length, idx + 120);
            let   snip  = (start > 0 ? '…' : '') + texto.slice(start, end) + (end < texto.length ? '…' : '');
            const re    = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return snip.replace(re, '<mark>$1</mark>');
        }

        function docHighlight(texto, q) {
            if (!q || !texto) return texto || '';
            const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return texto.replace(re, '<mark>$1</mark>');
        }

        // ── Búsqueda full-text extendida (campos IA de PDFs incluidos) ────
        function docMatchesQuery(d, lq) {
            if (!lq) return true;
            return (d.titulo               || '').toLowerCase().includes(lq)
                || (d.autor                || '').toLowerCase().includes(lq)
                || (d.contenido            || '').toLowerCase().includes(lq)
                || (d.snippet              || '').toLowerCase().includes(lq)
                || (d.resumen              || '').toLowerCase().includes(lq)
                || (d.materia_detectada    || '').toLowerCase().includes(lq)
                || (d.posibles_usos_procesales || '').toLowerCase().includes(lq)
                || (d.etiquetas            || []).some(t => t.toLowerCase().includes(lq))
                || (d.palabras_clave       || []).some(k => k.toLowerCase().includes(lq))
                || (d.tags                 || []).some(t => t.toLowerCase().includes(lq));
        }

        // ── Render principal ──────────────────────────────────────────────
        function doctrinaRender() {
            if (_docViewing) { doctrinaVerDoc(_docViewing); return; }
            const cont = document.getElementById('doctrina-main');
            if (!cont) return;

            const todos    = DoctrinaDB.all();
            const { cat, tipo, q } = _docFiltros;
            const filtrados = todos.filter(d => {
                if (cat  && d.categoria !== cat) return false;
                if (tipo && d.tipo !== tipo)      return false;
                if (q)   return docMatchesQuery(d, q.toLowerCase());
                return true;
            });

            const statsCat = {};
            todos.forEach(d => { statsCat[d.categoria] = (statsCat[d.categoria] || 0) + 1; });

            cont.innerHTML = `
            <div class="doc-layout">
                <div class="doc-sidebar">
                    <div class="doc-sidebar-header">
                        <i class="fas fa-graduation-cap"></i>
                        <span>Doctrina</span>
                    </div>
                    <button class="doc-cat-btn ${!cat ? 'active' : ''}" onclick="docFiltrarCat('')">
                        <i class="fas fa-th-large"></i> Todo
                        <span class="doc-cat-count">${todos.length}</span>
                    </button>
                    ${DOC_CATEGORIAS.map(c => `
                    <button class="doc-cat-btn ${cat === c.id ? 'active' : ''}"
                            style="${cat === c.id ? `border-left-color:${c.color};color:${c.color};background:${c.color}11;` : ''}"
                            onclick="docFiltrarCat('${c.id}')">
                        <i class="fas ${c.icon}" style="color:${c.color};"></i>
                        ${c.label}
                        ${statsCat[c.id] ? `<span class="doc-cat-count">${statsCat[c.id]}</span>` : ''}
                    </button>`).join('')}

                    <div class="doc-sidebar-sep"></div>

                    <button class="doc-btn-nuevo" onclick="doctrinaAbrirModal()">
                        <i class="fas fa-plus"></i> Agregar texto
                    </button>
                    <button class="doc-btn-nuevo doc-btn-pdf" onclick="DocPdfIndexer.abrirModal()">
                        <i class="fas fa-file-pdf"></i> Subir PDF doctrinario
                    </button>
                </div>

                <div class="doc-content">
                    <div class="doc-topbar">
                        <div class="doc-search-wrap">
                            <i class="fas fa-search doc-search-ico"></i>
                            <input type="text" class="doc-search"
                                   placeholder="Buscar en títulos, resumen IA, etiquetas, contenido…"
                                   value="${q}" oninput="docFiltrarQ(this.value)">
                            ${q ? `<button class="doc-search-clear" onclick="docFiltrarQ('')">×</button>` : ''}
                        </div>
                        <select class="doc-select" onchange="docFiltrarTipo(this.value)">
                            <option value="">Todos los tipos</option>
                            ${DOC_TIPOS.map(t => `<option value="${t}" ${tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>

                    <div class="doc-resultados-header">
                        <span>${filtrados.length} ${filtrados.length === 1 ? 'resultado' : 'resultados'}
                            ${cat ? `en <strong>${docGetCat(cat).label}</strong>` : ''}
                            ${q   ? `para <strong>"${q}"</strong>` : ''}
                        </span>
                    </div>

                    ${filtrados.length === 0 ? `
                    <div class="doc-empty">
                        <i class="fas fa-book-open"></i>
                        <p>${todos.length === 0
                            ? 'Aún no hay textos cargados. Agrega tu primer documento o sube un PDF doctrinario.'
                            : 'No hay resultados para esta búsqueda.'}</p>
                        ${todos.length === 0 ? `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                            <button class="doc-btn-nuevo" onclick="doctrinaAbrirModal()"><i class="fas fa-plus"></i> Agregar texto</button>
                            <button class="doc-btn-nuevo doc-btn-pdf" onclick="DocPdfIndexer.abrirModal()"><i class="fas fa-file-pdf"></i> Subir PDF</button>
                        </div>` : ''}
                    </div>` : `
                    <div class="doc-grid">
                        ${filtrados.map(d => docCardHTML(d, q)).join('')}
                    </div>`}
                </div>
            </div>`;
        }

        // ── Card de resultado ─────────────────────────────────────────────
        function docCardHTML(d, q) {
            const cat    = docGetCat(d.categoria);
            const esPdf  = d.tipo === 'PDF indexado';
            const textoBase = d.snippet || d.contenido || '';
            const snip      = docExtract(textoBase, q);
            const allTags   = [...new Set([...(d.etiquetas || []), ...(d.tags || [])])];
            const chars     = (d.contenido || '').length;
            const mins      = chars > 800 ? Math.max(1, Math.round(chars / 1200)) : null;

            return `
            <div class="doc-card" onclick="doctrinaVerDoc('${d.id}')">
                <div class="doc-card-top" style="border-top:3px solid ${cat.color};">
                    <div class="doc-card-cat" style="color:${cat.color};">
                        <i class="fas ${cat.icon}"></i> ${cat.label}
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                        ${esPdf ? `<span class="doc-badge-pdf"><i class="fas fa-robot"></i> PDF·IA</span>` : ''}
                        ${d.nivel_tecnico ? `<span class="doc-badge-nivel">${d.nivel_tecnico}</span>` : ''}
                        <span class="doc-card-tipo">${d.tipo || ''}</span>
                    </div>
                </div>
                <div class="doc-card-titulo">${docHighlight(d.titulo || 'Sin título', q)}</div>
                ${d.materia_detectada ? `<div class="doc-card-autor" style="color:#7c3aed;"><i class="fas fa-brain"></i> ${docHighlight(d.materia_detectada, q)}</div>` : ''}
                ${d.autor ? `<div class="doc-card-autor"><i class="fas fa-user-edit"></i> ${docHighlight(d.autor, q)}</div>` : ''}
                ${d.fuente ? `<div class="doc-card-fuente"><i class="fas fa-book"></i> ${d.fuente}${d.anio ? ' · ' + d.anio : ''}</div>` : ''}
                ${d.resumen && !snip ? `<div class="doc-card-snip" style="font-style:italic;">${d.resumen.slice(0, 160)}${d.resumen.length > 160 ? '…' : ''}</div>` : ''}
                ${snip ? `<div class="doc-card-snip">${snip}</div>` : ''}
                <div class="doc-card-footer">
                    <div class="doc-card-tags">
                        ${allTags.slice(0, 4).map(t => `<span class="doc-tag">${t}</span>`).join('')}
                    </div>
                    <div class="doc-card-meta">
                        ${d.totalPaginas ? `<span><i class="fas fa-file-alt"></i> ${d.totalPaginas} pp.</span>` : ''}
                        ${mins ? `<span><i class="fas fa-clock"></i> ${mins} min</span>` : ''}
                        <span><i class="fas fa-calendar"></i> ${docFecha(d.fechaCreacion)}</span>
                    </div>
                </div>
            </div>`;
        }

        // ── Vista de lectura ──────────────────────────────────────────────
        function doctrinaVerDoc(id) {
            _docViewing = id;
            const d = DoctrinaDB.byId(id);
            if (!d) { _docViewing = null; doctrinaRender(); return; }
            const cat       = docGetCat(d.categoria);
            const q         = _docFiltros.q;
            const cont      = document.getElementById('doctrina-main');
            if (!cont) return;

            const esPdf     = d.tipo === 'PDF indexado';
            const allTags   = [...new Set([...(d.etiquetas || []), ...(d.tags || [])])];
            const driveLink = d.driveWebLink || (d.driveFileId ? `https://drive.google.com/file/d/${d.driveFileId}/view` : null);
            const contenidoHTML = d.contenido
                ? docHighlight(d.contenido, q).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>')
                : '';

            cont.innerHTML = `
            <div class="doc-reader">
                <div class="doc-reader-nav">
                    <button class="doc-btn-back" onclick="doctrinaCerrarDoc()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                    <div class="doc-reader-cat" style="color:${cat.color};">
                        <i class="fas ${cat.icon}"></i> ${cat.label}
                        ${d.tipo ? `<span class="doc-reader-tipo">${d.tipo}</span>` : ''}
                    </div>
                    <div class="doc-reader-actions">
                        ${esPdf ? `
                        <button class="doc-btn-icon doc-btn-reanalizar" onclick="DocPdfIndexer.reanalizar('${d.id}')" title="Re-analizar con IA">
                            <i class="fas fa-sync-alt"></i> Re-analizar
                        </button>` : `
                        <button class="doc-btn-icon" onclick="doctrinaAbrirModal('${d.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>`}
                        <button class="doc-btn-icon doc-btn-danger" onclick="doctrinaEliminar('${d.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="doc-reader-header">
                    <h1 class="doc-reader-titulo">${d.titulo || 'Sin título'}</h1>
                    ${d.autor ? `<div class="doc-reader-autor"><i class="fas fa-user-edit"></i> ${d.autor}</div>` : ''}
                    <div class="doc-reader-meta-row">
                        ${d.fuente      ? `<span><i class="fas fa-book"></i> ${d.fuente}</span>` : ''}
                        ${d.anio        ? `<span><i class="fas fa-calendar"></i> ${d.anio}</span>` : ''}
                        ${d.paginas || d.totalPaginas ? `<span><i class="fas fa-file-alt"></i> ${d.paginas || d.totalPaginas} páginas</span>` : ''}
                        ${d.isbn        ? `<span><i class="fas fa-barcode"></i> ISBN: ${d.isbn}</span>` : ''}
                        ${d.tamanoMb    ? `<span><i class="fas fa-hdd"></i> ${d.tamanoMb} MB</span>` : ''}
                        ${d.procesadoCon? `<span><i class="fas fa-robot"></i> Analizado con ${d.procesadoCon}</span>` : ''}
                    </div>
                    ${allTags.length ? `
                    <div class="doc-reader-tags">
                        ${allTags.map(t => `<span class="doc-tag">${t}</span>`).join('')}
                    </div>` : ''}
                    ${d.resumen ? `<blockquote class="doc-reader-resumen">${d.resumen}</blockquote>` : ''}
                </div>

                ${esPdf ? `
                <div class="doc-pdf-meta-panel">
                    <div class="doc-pdf-meta-title">
                        <i class="fas fa-brain" style="color:#7c3aed;"></i>
                        Análisis IA — Metadatos generados automáticamente
                    </div>
                    <div class="doc-pdf-meta-grid">
                        ${d.materia_detectada ? `
                        <div class="doc-pdf-meta-item">
                            <div class="doc-pdf-meta-label">Materia detectada</div>
                            <div class="doc-pdf-meta-value">${d.materia_detectada}</div>
                        </div>` : ''}
                        ${d.nivel_tecnico ? `
                        <div class="doc-pdf-meta-item">
                            <div class="doc-pdf-meta-label">Nivel técnico</div>
                            <div class="doc-pdf-meta-value"><span class="doc-badge-nivel">${d.nivel_tecnico}</span></div>
                        </div>` : ''}
                        ${d.posibles_usos_procesales ? `
                        <div class="doc-pdf-meta-item" style="grid-column:1/-1;">
                            <div class="doc-pdf-meta-label">Posibles usos procesales</div>
                            <div class="doc-pdf-meta-value">${d.posibles_usos_procesales}</div>
                        </div>` : ''}
                    </div>
                    ${d.palabras_clave?.length ? `
                    <div style="margin-top:10px;">
                        <div class="doc-pdf-meta-label" style="margin-bottom:6px;">Palabras clave</div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                            ${d.palabras_clave.map(k => `<span class="doc-tag" style="background:#f3e8ff;color:#7c3aed;border-color:#e9d5ff;">${k}</span>`).join('')}
                        </div>
                    </div>` : ''}
                    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                        ${driveLink ? `
                        <a href="${driveLink}" target="_blank" class="doc-btn doc-btn-primary" style="text-decoration:none;">
                            <i class="fab fa-google-drive"></i> Ver PDF en Drive
                        </a>` : `<span style="font-size:0.8rem;color:#94a3b8;padding:6px 0;">
                            <i class="fas fa-info-circle"></i> PDF sin Drive (solo metadatos locales)
                        </span>`}
                        <button class="doc-btn doc-btn-secondary" onclick="DocPdfIndexer.reanalizar('${d.id}')">
                            <i class="fas fa-sync-alt"></i> Re-analizar con IA
                        </button>
                    </div>
                </div>` : ''}

                ${contenidoHTML ? `<div class="doc-reader-body">${contenidoHTML}</div>` : ''}

                ${esPdf && !contenidoHTML ? `
                <div class="doc-reader-body">
                    <p class="doc-sin-contenido">
                        <i class="fas fa-info-circle"></i>
                        El texto completo de este PDF vive en Google Drive para no ocupar espacio local.
                        ${driveLink ? `<a href="${driveLink}" target="_blank"> Abrir en Drive <i class="fas fa-external-link-alt"></i></a>` : ''}
                    </p>
                </div>` : ''}

                ${!esPdf && !contenidoHTML ? `
                <div class="doc-reader-body">
                    <p class="doc-sin-contenido">Este documento no tiene contenido cargado.</p>
                </div>` : ''}

                ${d.notas ? `
                <div class="doc-reader-notas">
                    <h4><i class="fas fa-sticky-note"></i> Notas personales</h4>
                    <div class="doc-notas-content">${d.notas.replace(/\n/g, '<br>')}</div>
                </div>` : ''}
            </div>`;
        }

        function doctrinaCerrarDoc() { _docViewing = null; doctrinaRender(); }

        // ── Filtros ───────────────────────────────────────────────────────
        function docFiltrarCat(cat)   { _docFiltros.cat = cat;   _docViewing = null; doctrinaRender(); }
        function docFiltrarTipo(tipo) { _docFiltros.tipo = tipo; _docViewing = null; doctrinaRender(); }
        function docFiltrarQ(q)       { _docFiltros.q = q;       _docViewing = null; doctrinaRender(); }

        // ── Modal agregar / editar textos manuales ────────────────────────
        function doctrinaAbrirModal(id) {
            const d = id ? DoctrinaDB.byId(id) : null;
            document.body.insertAdjacentHTML('beforeend', `
            <div class="doc-modal-overlay" id="doc-modal-overlay" onclick="doctrinaCerrarModal(event)">
                <div class="doc-modal">
                    <div class="doc-modal-header">
                        <h3><i class="fas fa-graduation-cap"></i> ${d ? 'Editar texto' : 'Agregar texto de doctrina o práctica'}</h3>
                        <button onclick="doctrinaCerrarModal()" class="doc-modal-close">×</button>
                    </div>
                    <div class="doc-modal-body">
                        <div class="doc-form-row">
                            <div class="doc-form-group" style="flex:3;">
                                <label>Título *</label>
                                <input type="text" id="doc-f-titulo" placeholder="Título del libro, artículo o apunte" value="${d?.titulo || ''}">
                            </div>
                            <div class="doc-form-group" style="flex:1.5;">
                                <label>Tipo</label>
                                <select id="doc-f-tipo">
                                    ${DOC_TIPOS.filter(t => t !== 'PDF indexado').map(t => `<option value="${t}" ${d?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="doc-form-row">
                            <div class="doc-form-group">
                                <label>Categoría *</label>
                                <select id="doc-f-cat">
                                    ${DOC_CATEGORIAS.map(c => `<option value="${c.id}" ${d?.categoria === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="doc-form-group" style="flex:2;">
                                <label>Autor(es)</label>
                                <input type="text" id="doc-f-autor" placeholder="Ej: Eduardo Couture, Hernán Corral" value="${d?.autor || ''}">
                            </div>
                        </div>
                        <div class="doc-form-row">
                            <div class="doc-form-group" style="flex:2;">
                                <label>Fuente / Editorial / Revista</label>
                                <input type="text" id="doc-f-fuente" placeholder="Ej: Editorial Jurídica, Revista de Derecho PUCV" value="${d?.fuente || ''}">
                            </div>
                            <div class="doc-form-group" style="flex:0.7;">
                                <label>Año</label>
                                <input type="text" id="doc-f-anio" placeholder="2023" value="${d?.anio || ''}">
                            </div>
                            <div class="doc-form-group" style="flex:1;">
                                <label>Páginas / pp.</label>
                                <input type="text" id="doc-f-paginas" placeholder="Ej: 45-78 o 320" value="${d?.paginas || ''}">
                            </div>
                        </div>
                        <div class="doc-form-row">
                            <div class="doc-form-group" style="flex:1;">
                                <label>ISBN (opcional)</label>
                                <input type="text" id="doc-f-isbn" placeholder="978-..." value="${d?.isbn || ''}">
                            </div>
                            <div class="doc-form-group" style="flex:3;">
                                <label>Etiquetas (separadas por coma)</label>
                                <input type="text" id="doc-f-tags" placeholder="Ej: prescripción, nulidad, recursos, contratos" value="${(d?.tags || []).join(', ')}">
                            </div>
                        </div>
                        <div class="doc-form-group">
                            <label>Resumen / Abstract</label>
                            <textarea id="doc-f-resumen" rows="2" placeholder="Breve descripción o abstract del texto…">${d?.resumen || ''}</textarea>
                        </div>
                        <div class="doc-form-group">
                            <label>Contenido completo <span style="color:var(--text-3);font-weight:400;">(pega el texto aquí — permite búsqueda full-text)</span></label>
                            <textarea id="doc-f-contenido" rows="12" placeholder="Pega aquí el texto íntegro del documento…">${d?.contenido || ''}</textarea>
                        </div>
                        <div class="doc-form-group">
                            <label>Notas personales <span style="color:var(--text-3);font-weight:400;">(solo para ti)</span></label>
                            <textarea id="doc-f-notas" rows="3" placeholder="Anotaciones propias, aplicación práctica, casos donde usarlo…">${d?.notas || ''}</textarea>
                        </div>
                    </div>
                    <div class="doc-modal-footer">
                        <button class="doc-btn doc-btn-secondary" onclick="doctrinaCerrarModal()">Cancelar</button>
                        <button class="doc-btn doc-btn-primary" onclick="doctrinaGuardar('${d?.id || ''}')">
                            <i class="fas fa-save"></i> ${d ? 'Actualizar' : 'Guardar texto'}
                        </button>
                    </div>
                </div>
            </div>`);
        }

        function doctrinaCerrarModal(e) {
            if (e && e.target.id !== 'doc-modal-overlay') return;
            document.getElementById('doc-modal-overlay')?.remove();
        }

        function doctrinaGuardar(id) {
            const titulo = document.getElementById('doc-f-titulo')?.value?.trim();
            if (!titulo) { alert('El título es obligatorio'); return; }
            const data = {
                titulo,
                tipo:      document.getElementById('doc-f-tipo')?.value || 'Libro / Manual',
                categoria: document.getElementById('doc-f-cat')?.value || 'otro',
                autor:     document.getElementById('doc-f-autor')?.value?.trim() || '',
                fuente:    document.getElementById('doc-f-fuente')?.value?.trim() || '',
                anio:      document.getElementById('doc-f-anio')?.value?.trim() || '',
                paginas:   document.getElementById('doc-f-paginas')?.value?.trim() || '',
                isbn:      document.getElementById('doc-f-isbn')?.value?.trim() || '',
                tags:      document.getElementById('doc-f-tags')?.value?.split(',').map(t => t.trim()).filter(Boolean) || [],
                resumen:   document.getElementById('doc-f-resumen')?.value?.trim() || '',
                contenido: document.getElementById('doc-f-contenido')?.value || '',
                notas:     document.getElementById('doc-f-notas')?.value?.trim() || '',
            };
            if (id) { DoctrinaDB.update(id, data); doctrinaCerrarModal(); doctrinaVerDoc(id); }
            else    { const n = DoctrinaDB.create(data); doctrinaCerrarModal(); doctrinaVerDoc(n.id); }
        }

        function doctrinaEliminar(id) {
            if (!confirm('¿Eliminar este texto? Esta acción no se puede deshacer.')) return;
            DoctrinaDB.delete(id);
            _docViewing = null;
            doctrinaRender();
        }
