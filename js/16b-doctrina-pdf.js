        // ████████████████████████████████████████████████████████████████████
        // JS — BLOQUE 16b: DOCTRINA PDF INDEXER  (v13)
        // Pipeline: PDF local → Drive → pdf.js extrae texto → IA analiza
        //           → Guarda metadatos en DoctrinaDB (NO el PDF ni el texto
        //             completo en localStorage)
        //
        // ── DECISIONES ARQUITECTÓNICAS ──────────────────────────────────
        // ① texto_extraido NO se persiste en localStorage.
        //    50 000 chars ≈ 100 KB × N docs → riesgo de cuota real.
        //    Se guarda solo un snippet de SNIPPET_CHARS para búsqueda.
        //    El texto completo vive solo en RAM mientras se procesa.
        //
        // ② El PDF binario sube a Drive mediante GoogleDrive.uploadBinaryFile()
        //    (añadido al módulo 18 en v13). Si Drive no está conectado,
        //    el flujo continúa igual: solo quedan los metadatos IA locales.
        //
        // ③ Re-análisis: descarga el PDF de Drive con downloadBinaryFile()
        //    → re-extrae texto → re-llama a iaCall() → actualiza DoctrinaDB.
        //
        // ④ Sin variables globales nuevas: todo en el IIFE DocPdfIndexer.
        //    Prefijo 'docPdf' para funciones internas, evita colisiones.
        //
        // ── IMPACTO EN STORAGE ──────────────────────────────────────────
        // Por doc: resumen ~2 KB + etiquetas ~0.5 KB + snippet 0.6 KB ≈ 10 KB
        // 50 docs PDF: ~500 KB adicionales → margen amplio.
        //
        // ── CONSUMO DE TOKENS IA ────────────────────────────────────────
        // 45 000 chars ÷ 4 ≈ 11 000 tokens entrada.
        // Costo estimado: $0.01–$0.05 USD por doc según proveedor.
        // Context windows: Gemini Flash 1M, GPT-4o 128K, Claude 200K → OK.
        // ████████████████████████████████████████████████████████████████████

        const DocPdfIndexer = (() => {

            // ── Constantes ────────────────────────────────────────────────
            const PDFJS_CDN     = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            const PDFJS_WORKER  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const MAX_FILE_MB   = 20;
            const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
            const MAX_CHARS_AI  = 45000;   // ~11 000 tokens de entrada
            const SNIPPET_CHARS = 600;     // chars guardados en localStorage para búsqueda

            // ── Estado interno ────────────────────────────────────────────
            let _pdfJsReady  = false;
            let _busy        = false;    // mutex para evitar doble proceso
            let _selectedFile = null;   // File objeto del input

            // ══════════════════════════════════════════════════════════════
            // PASO 1 — Cargar pdf.js desde CDN (lazy, solo cuando se necesita)
            // ══════════════════════════════════════════════════════════════
            function _loadPdfJs() {
                if (_pdfJsReady || window.pdfjsLib) {
                    _pdfJsReady = true;
                    return Promise.resolve();
                }
                return new Promise((resolve, reject) => {
                    const s    = document.createElement('script');
                    s.src      = PDFJS_CDN;
                    s.onload   = () => {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                        _pdfJsReady = true;
                        resolve();
                    };
                    s.onerror  = () => reject(new Error(
                        'No se pudo cargar pdf.js. Verifica tu conexión a internet.'
                    ));
                    document.head.appendChild(s);
                });
            }

            // ══════════════════════════════════════════════════════════════
            // PASO 2 — Extraer texto del PDF (ArrayBuffer → string)
            // Respeta la arquitectura pedida + detección de línea por Y coord.
            // ══════════════════════════════════════════════════════════════
            async function _extractText(arrayBuffer) {
                await _loadPdfJs();

                const pdf      = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const total    = pdf.numPages;
                let   fullText = '';

                for (let i = 1; i <= total; i++) {
                    const page    = await pdf.getPage(i);
                    const content = await page.getTextContent();

                    let   pageText = '';
                    let   lastY    = null;

                    for (const item of content.items) {
                        // Salto de línea cuando cambia significativamente la posición Y
                        const y = item.transform?.[5] ?? 0;
                        if (lastY !== null && Math.abs(y - lastY) > 4) pageText += '\n';
                        pageText += item.str;
                        lastY = y;
                    }

                    fullText += pageText + '\n\n';

                    // Corte anticipado: ya superamos MAX_CHARS_AI con margen
                    if (fullText.length > MAX_CHARS_AI * 1.15) {
                        fullText += `\n\n[Texto truncado en pág. ${i} de ${total} — límite de análisis alcanzado]`;
                        return { text: fullText.replace(/\n{3,}/g, '\n\n').trim(), pages: total };
                    }
                }

                return { text: fullText.replace(/\n{3,}/g, '\n\n').trim(), pages: total };
            }

            // ══════════════════════════════════════════════════════════════
            // PASO 3 — Analizar con IA Adapter (iaCall ya existe en módulo 12)
            // ══════════════════════════════════════════════════════════════
            async function _analyzeWithIA(texto, titulo) {
                const truncado = texto.length > MAX_CHARS_AI
                    ? texto.slice(0, MAX_CHARS_AI) + '\n\n[... texto truncado para análisis ...]'
                    : texto;

                const prompt =
`Eres un asistente jurídico experto en derecho chileno.
Analiza el siguiente texto doctrinario y responde ÚNICAMENTE con un objeto JSON válido.
Sin explicaciones, sin bloques de código markdown, sin texto antes ni después del JSON.

Estructura requerida:
{
  "resumen": "Resumen jurídico estructurado de 3 a 5 oraciones. Incluye tesis central, fundamentos y aplicabilidad práctica.",
  "materia_detectada": "Rama del derecho principal (ej: Derecho Civil, Derecho Procesal, Derecho Laboral)",
  "etiquetas": ["etiqueta1", "etiqueta2", "etiqueta3"],
  "palabras_clave": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "nivel_tecnico": "Medio",
  "posibles_usos_procesales": "Descripción de cómo aplicar este texto en litigación o asesoría jurídica."
}

Restricciones:
- "nivel_tecnico" debe ser exactamente uno de: "Bajo", "Medio", "Alto"
- "etiquetas": entre 3 y 8 elementos
- "palabras_clave": entre 3 y 8 elementos
- Responde SOLO el JSON, sin ningún texto adicional

Título del documento: ${titulo}

Texto:
${truncado}`;

                const respuesta = await iaCall(prompt);

                // Parsear JSON de forma robusta
                let raw = respuesta.trim();
                // Quitar bloques markdown si el modelo los incluyó de todas formas
                raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                // Extraer primer objeto JSON válido
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) raw = match[0];

                try {
                    return JSON.parse(raw);
                } catch (e) {
                    console.warn('[DocPdfIndexer] JSON inválido de IA, usando fallback:', e.message);
                    return {
                        resumen:                  'No se pudo estructurar automáticamente. Revisa el contenido manualmente.',
                        materia_detectada:        'No detectada',
                        etiquetas:                ['doctrina', 'pdf-indexado'],
                        palabras_clave:           ['derecho'],
                        nivel_tecnico:            'Medio',
                        posibles_usos_procesales: 'No procesado automáticamente.',
                    };
                }
            }

            // ══════════════════════════════════════════════════════════════
            // PASO 4 — Subir PDF binario a Drive (reutiliza uploadBinaryFile)
            // uploadBinaryFile fue añadido al módulo 18 en v13 y tiene acceso
            // al _accessToken del closure de GoogleDrive.
            // ══════════════════════════════════════════════════════════════
            async function _subirPdfDrive(arrayBuffer, filename) {
                if (!window.GoogleDrive?.isConnected()) return null;
                const fname = `doctrina-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                try {
                    const resultado = await GoogleDrive.uploadBinaryFile(arrayBuffer, fname, 'application/pdf');
                    return resultado || null;
                } catch (e) {
                    // Drive falló pero el flujo continúa (sin driveFileId)
                    console.warn('[DocPdfIndexer] Drive upload falló, continuando sin Drive:', e.message);
                    return null;
                }
            }

            // ══════════════════════════════════════════════════════════════
            // HELPER — Mapear materia detectada a categoría del sistema
            // ══════════════════════════════════════════════════════════════
            function _mapMateria(materia) {
                if (!materia) return 'otro';
                const m = materia.toLowerCase();
                if (m.includes('civil'))                          return 'civil';
                if (m.includes('procesal'))                       return 'procesal';
                if (m.includes('laboral') || m.includes('trabajo')) return 'laboral';
                if (m.includes('penal') || m.includes('criminal'))  return 'penal';
                if (m.includes('constitucional'))                 return 'constitucional';
                if (m.includes('comercial') || m.includes('mercantil')) return 'comercial';
                if (m.includes('administrativo'))                 return 'administrativo';
                if (m.includes('tributario') || m.includes('fiscal')) return 'tributario';
                if (m.includes('ambiental'))                      return 'ambiental';
                if (m.includes('familia'))                        return 'familia';
                if (m.includes('forense') || m.includes('práctica')) return 'practica';
                return 'otro';
            }

            // ══════════════════════════════════════════════════════════════
            // UI — Helpers de progreso / error
            // ══════════════════════════════════════════════════════════════
            function _setProgress(pct, msg) {
                const wrap = document.getElementById('docpdf-progress');
                const bar  = document.getElementById('docpdf-progress-bar');
                const txt  = document.getElementById('docpdf-progress-txt');
                if (!wrap) return;
                wrap.style.display = 'block';
                if (bar) bar.style.width = pct + '%';
                if (txt) txt.innerHTML  = `<i class="fas fa-spinner fa-spin"></i> ${msg} <span style="float:right;font-family:monospace;">${pct}%</span>`;
            }

            function _setProgressOk(msg) {
                const bar = document.getElementById('docpdf-progress-bar');
                const txt = document.getElementById('docpdf-progress-txt');
                if (bar) { bar.style.width = '100%'; bar.style.background = '#059669'; }
                if (txt) txt.innerHTML = `<i class="fas fa-check-circle" style="color:#059669;"></i> ${msg}`;
            }

            function _showError(msg) {
                const el = document.getElementById('docpdf-error');
                if (el) { el.style.display = 'block'; el.innerHTML = `<i class="fas fa-times-circle"></i> ${msg}`; }
            }

            function _hideError() {
                const el = document.getElementById('docpdf-error');
                if (el) el.style.display = 'none';
            }

            function _lockUI(lk) {
                const btn = document.getElementById('docpdf-btn-analizar');
                const can = document.getElementById('docpdf-btn-cancelar');
                if (btn) { btn.disabled = lk; btn.innerHTML = lk ? '<i class="fas fa-spinner fa-spin"></i> Procesando…' : '<i class="fas fa-brain"></i> Analizar con IA'; }
                if (can) can.disabled = lk;
            }

            // ══════════════════════════════════════════════════════════════
            // UI — Manejo de selección de archivo
            // ══════════════════════════════════════════════════════════════
            function _handleFile(file) {
                _selectedFile = null;
                _hideError();

                if (!file || file.type !== 'application/pdf') {
                    _showError('Solo se aceptan archivos PDF.');
                    return;
                }
                if (file.size > MAX_FILE_BYTES) {
                    _showError(`El archivo supera el límite de ${MAX_FILE_MB} MB (${(file.size / 1048576).toFixed(1)} MB).`);
                    return;
                }

                _selectedFile = file;

                // Mostrar info del archivo
                const info = document.getElementById('docpdf-file-info');
                if (info) {
                    info.style.display = 'block';
                    info.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-file-pdf" style="font-size:1.6rem;color:#dc2626;flex-shrink:0;"></i>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(file.name)}</div>
                            <div style="color:#64748b;font-size:0.75rem;margin-top:2px;">${(file.size / 1048576).toFixed(2)} MB · PDF</div>
                        </div>
                        <button onclick="DocPdfIndexer._clearFile()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.2rem;">×</button>
                    </div>`;
                }

                // Pre-rellenar título con nombre del archivo (sin extensión)
                const ti = document.getElementById('docpdf-titulo');
                if (ti && !ti.value) ti.value = file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();

                // Mostrar formulario y botón de análisis
                const form = document.getElementById('docpdf-meta-form');
                const btn  = document.getElementById('docpdf-btn-analizar');
                if (form) form.style.display = 'block';
                if (btn)  btn.style.display  = '';
            }

            function _clearFile() {
                _selectedFile = null;
                const fields = ['docpdf-file-info', 'docpdf-meta-form'];
                fields.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
                const btn = document.getElementById('docpdf-btn-analizar');
                if (btn) btn.style.display = 'none';
                const inp = document.getElementById('docpdf-file-input');
                if (inp) inp.value = '';
                _hideError();
            }

            // ══════════════════════════════════════════════════════════════
            // UI — Drag & Drop
            // ══════════════════════════════════════════════════════════════
            function _onDragOver(e) {
                e.preventDefault();
                const z = document.getElementById('docpdf-drop-zone');
                if (z) { z.style.borderColor = '#2563eb'; z.style.background = '#eff6ff'; }
            }

            function _onDragLeave() {
                const z = document.getElementById('docpdf-drop-zone');
                if (z) { z.style.borderColor = '#cbd5e1'; z.style.background = '#f8fafc'; }
            }

            function _onDrop(e) {
                e.preventDefault();
                _onDragLeave();
                _handleFile(e.dataTransfer.files?.[0]);
            }

            function _onFileSelect(input) { _handleFile(input.files?.[0]); }

            // ══════════════════════════════════════════════════════════════
            // PIPELINE PRINCIPAL — Procesar PDF seleccionado
            // ══════════════════════════════════════════════════════════════
            async function procesarPdf() {
                if (_busy)           { return; }
                if (!_selectedFile)  { _showError('Selecciona un PDF primero.'); return; }

                const titulo = document.getElementById('docpdf-titulo')?.value?.trim();
                if (!titulo) { _showError('El título es obligatorio.'); return; }

                _busy = true;
                _lockUI(true);
                _hideError();

                // Limpiar barra de progreso
                const bar = document.getElementById('docpdf-progress-bar');
                if (bar) { bar.style.background = '#2563eb'; bar.style.width = '0%'; }

                try {
                    // ── Paso 1: Leer como ArrayBuffer ─────────────────────
                    _setProgress(5, 'Leyendo archivo PDF…');
                    const arrayBuffer = await _selectedFile.arrayBuffer();

                    // ── Paso 2: Extraer texto (pdf.js) ────────────────────
                    _setProgress(20, 'Extrayendo texto del PDF (pdf.js)…');
                    let extracted;
                    try {
                        extracted = await _extractText(arrayBuffer);
                    } catch (e) {
                        throw new Error(`Error al leer el PDF: ${e.message}. El PDF puede estar protegido con contraseña o ser solo imagen.`);
                    }

                    const { text: textoExtraido, pages } = extracted;
                    if (!textoExtraido || textoExtraido.length < 50) {
                        throw new Error(`No se pudo extraer texto (${pages} páginas). El PDF puede ser de imagen escaneada. Usa OCR externo primero.`);
                    }

                    // ── Paso 3: Subir PDF a Drive (si está conectado) ─────
                    _setProgress(40, window.GoogleDrive?.isConnected()
                        ? 'Subiendo PDF a Google Drive…'
                        : 'Drive no conectado — continuando sin subida…');

                    const driveResult  = await _subirPdfDrive(arrayBuffer, _selectedFile.name);
                    const driveFileId  = driveResult?.id    || null;
                    const driveWebLink = driveResult?.webViewLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);

                    // ── Paso 4: Analizar con IA ───────────────────────────
                    _setProgress(60, 'Analizando con IA (puede tardar 15–30 segundos)…');
                    let meta;
                    try {
                        meta = await _analyzeWithIA(textoExtraido, titulo);
                    } catch (e) {
                        throw new Error(`Error al analizar con IA: ${e.message}`);
                    }

                    // ── Paso 5: Construir snippet para búsqueda local ──────
                    // SOLO los primeros SNIPPET_CHARS — no el texto completo
                    const snippet = textoExtraido.slice(0, SNIPPET_CHARS).trim();

                    // ── Paso 6: Persistir en DoctrinaDB ──────────────────
                    _setProgress(90, 'Guardando metadatos…');

                    const cat   = document.getElementById('docpdf-cat')?.value  || _mapMateria(meta.materia_detectada);
                    const autor = document.getElementById('docpdf-autor')?.value?.trim() || '';
                    const anio  = document.getElementById('docpdf-anio')?.value?.trim()  || '';

                    const docData = {
                        // Metadatos base
                        titulo,
                        tipo:       'PDF indexado',
                        categoria:  cat,
                        autor,
                        anio,
                        fuente:     '',
                        paginas:    String(pages),
                        isbn:       '',
                        // Metadatos IA
                        resumen:                  meta.resumen                  || '',
                        materia_detectada:         meta.materia_detectada        || '',
                        etiquetas:                 meta.etiquetas                || [],
                        palabras_clave:            meta.palabras_clave           || [],
                        nivel_tecnico:             meta.nivel_tecnico            || 'Medio',
                        posibles_usos_procesales:  meta.posibles_usos_procesales || '',
                        tags:                      meta.etiquetas                || [],
                        // Snippet para búsqueda (NO el texto completo)
                        snippet,
                        contenido:  '',   // campo legacy — vacío para PDFs IA
                        notas:      '',
                        // Refs Drive
                        driveFileId,
                        driveWebLink,
                        // Info de procesamiento
                        fuentePdf:    _selectedFile.name,
                        tamanoMb:     (_selectedFile.size / 1048576).toFixed(2),
                        totalPaginas: pages,
                        procesadoCon: iaGetProvider(),
                    };

                    const guardado = DoctrinaDB.create(docData);

                    // ── Paso 7: Emitir evento al EventBus ─────────────────
                    if (window.EventBus) EventBus.emit('doctrina:updated', { id: guardado.id, tipo: 'pdf-indexado' });

                    _setProgressOk(`✅ "${titulo}" indexado · ${pages} páginas${driveFileId ? ' · PDF en Drive' : ''}`);

                    // Navegar al documento tras breve pausa
                    setTimeout(() => {
                        cerrarModal();
                        _docViewing = guardado.id;
                        doctrinaVerDoc(guardado.id);
                    }, 1400);

                } catch (err) {
                    _showError(err.message);
                    const bar2 = document.getElementById('docpdf-progress-bar');
                    if (bar2) bar2.style.background = '#dc2626';
                } finally {
                    _busy = false;
                    _lockUI(false);
                }
            }

            // ══════════════════════════════════════════════════════════════
            // MODAL — Abrir/cerrar
            // ══════════════════════════════════════════════════════════════
            function abrirModal() {
                if (document.getElementById('docpdf-overlay')) return;

                const driveOk  = window.GoogleDrive?.isConnected();
                const catOpts  = DOC_CATEGORIAS.map(c =>
                    `<option value="${c.id}">${c.label}</option>`
                ).join('');

                document.body.insertAdjacentHTML('beforeend', `
                <div id="docpdf-overlay" class="doc-modal-overlay" onclick="DocPdfIndexer._cerrarSiClick(event)">
                    <div class="doc-modal" style="max-width:560px;">
                        <div class="doc-modal-header">
                            <h3><i class="fas fa-file-pdf" style="color:#dc2626;"></i> Subir PDF Doctrinario</h3>
                            <button onclick="DocPdfIndexer.cerrarModal()" class="doc-modal-close">×</button>
                        </div>
                        <div class="doc-modal-body">

                            <!-- Estado Drive -->
                            <div style="padding:9px 12px;border-radius:7px;margin-bottom:14px;font-size:0.8rem;
                                background:${driveOk ? '#f0fdf4' : '#fffbeb'};
                                border:1px solid ${driveOk ? '#bbf7d0' : '#fde68a'};
                                color:${driveOk ? '#14532d' : '#92400e'};">
                                ${driveOk
                                    ? '<i class="fab fa-google-drive"></i> <b>Drive activo</b> — el PDF se subirá a tu Drive. Solo se guardan metadatos localmente.'
                                    : '<i class="fas fa-exclamation-triangle"></i> <b>Drive no conectado</b> — solo se guardará el análisis IA (sin archivo PDF). Conecta Drive en <em>Configurar IA & Drive</em>.'}
                            </div>

                            <!-- Zona de Drop -->
                            <div id="docpdf-drop-zone" style="border:2px dashed #cbd5e1;border-radius:10px;padding:28px 16px;
                                text-align:center;cursor:pointer;background:#f8fafc;margin-bottom:14px;transition:all .2s;"
                                onclick="document.getElementById('docpdf-file-input').click()"
                                ondragover="DocPdfIndexer._onDragOver(event)"
                                ondragleave="DocPdfIndexer._onDragLeave()"
                                ondrop="DocPdfIndexer._onDrop(event)">
                                <i class="fas fa-file-pdf" style="font-size:2.2rem;color:#dc2626;display:block;margin-bottom:8px;"></i>
                                <div style="font-weight:600;font-size:0.88rem;color:#1e293b;margin-bottom:3px;">
                                    Arrastra tu PDF aquí o haz clic para seleccionar
                                </div>
                                <div style="font-size:0.76rem;color:#94a3b8;">Solo PDF · Máximo ${MAX_FILE_MB} MB</div>
                                <input type="file" id="docpdf-file-input" accept="application/pdf"
                                    style="display:none;" onchange="DocPdfIndexer._onFileSelect(this)">
                            </div>

                            <!-- Info archivo seleccionado -->
                            <div id="docpdf-file-info" style="display:none;padding:10px 12px;background:#f1f5f9;
                                border-radius:8px;margin-bottom:12px;font-size:0.83rem;"></div>

                            <!-- Formulario de metadatos -->
                            <div id="docpdf-meta-form" style="display:none;">
                                <div class="doc-form-row">
                                    <div class="doc-form-group" style="flex:3;">
                                        <label>Título *</label>
                                        <input type="text" id="docpdf-titulo" placeholder="Título del libro o artículo">
                                    </div>
                                    <div class="doc-form-group" style="flex:1.5;">
                                        <label>Categoría</label>
                                        <select id="docpdf-cat">${catOpts}</select>
                                    </div>
                                </div>
                                <div class="doc-form-row">
                                    <div class="doc-form-group" style="flex:2;">
                                        <label>Autor(es)</label>
                                        <input type="text" id="docpdf-autor" placeholder="Ej: Eduardo Couture">
                                    </div>
                                    <div class="doc-form-group" style="flex:1;">
                                        <label>Año</label>
                                        <input type="text" id="docpdf-anio" placeholder="2023">
                                    </div>
                                </div>
                            </div>

                            <!-- Barra de progreso -->
                            <div id="docpdf-progress" style="display:none;margin-top:8px;">
                                <div id="docpdf-progress-txt" style="font-size:0.81rem;color:#1e293b;margin-bottom:6px;"></div>
                                <div style="background:#e2e8f0;border-radius:4px;height:6px;">
                                    <div id="docpdf-progress-bar" style="height:100%;background:#2563eb;border-radius:4px;width:0%;transition:width .35s;"></div>
                                </div>
                            </div>

                            <!-- Error -->
                            <div id="docpdf-error" style="display:none;margin-top:10px;padding:9px 12px;background:#fef2f2;
                                border:1px solid #fecaca;border-radius:7px;font-size:0.82rem;color:#dc2626;"></div>
                        </div>

                        <div class="doc-modal-footer">
                            <button id="docpdf-btn-cancelar" class="doc-btn doc-btn-secondary" onclick="DocPdfIndexer.cerrarModal()">Cancelar</button>
                            <button id="docpdf-btn-analizar" class="doc-btn doc-btn-primary" style="display:none;"
                                onclick="DocPdfIndexer.procesarPdf()">
                                <i class="fas fa-brain"></i> Analizar con IA
                            </button>
                        </div>
                    </div>
                </div>`);
            }

            function cerrarModal() {
                document.getElementById('docpdf-overlay')?.remove();
                _busy = false;
                _selectedFile = null;
            }

            function _cerrarSiClick(e) {
                if (e.target.id === 'docpdf-overlay') cerrarModal();
            }

            // ══════════════════════════════════════════════════════════════
            // RE-ANALIZAR — Descarga PDF de Drive → re-procesa con IA
            // ══════════════════════════════════════════════════════════════
            async function reanalizar(docId) {
                const doc = DoctrinaDB.byId(docId);
                if (!doc) return;

                if (!doc.driveFileId) {
                    showError('Este documento no tiene PDF en Drive. Solo se pueden re-analizar PDFs con archivo en Drive.');
                    return;
                }
                if (!window.GoogleDrive?.isConnected()) {
                    showError('Conecta Google Drive para re-analizar el PDF.');
                    return;
                }
                if (!confirm(`¿Re-analizar "${doc.titulo}" con IA?\nEsto actualizará resumen, etiquetas y metadatos.`)) return;

                showInfo('Descargando PDF de Drive para re-análisis…');

                let pdfBuffer;
                try {
                    pdfBuffer = await GoogleDrive.downloadBinaryFile(doc.driveFileId);
                } catch (e) {
                    showError('Error al descargar PDF de Drive: ' + e.message);
                    return;
                }

                showInfo('Extrayendo texto y analizando con IA…');
                try {
                    const { text, pages } = await _extractText(pdfBuffer);
                    const meta = await _analyzeWithIA(text, doc.titulo);
                    const snippet = text.slice(0, SNIPPET_CHARS).trim();

                    DoctrinaDB.update(docId, {
                        resumen:                  meta.resumen,
                        materia_detectada:        meta.materia_detectada,
                        etiquetas:                meta.etiquetas,
                        palabras_clave:           meta.palabras_clave,
                        nivel_tecnico:            meta.nivel_tecnico,
                        posibles_usos_procesales: meta.posibles_usos_procesales,
                        tags:                     meta.etiquetas,
                        snippet,
                        categoria:                _mapMateria(meta.materia_detectada) || doc.categoria,
                        totalPaginas:             pages,
                        procesadoCon:             iaGetProvider(),
                    });

                    if (window.EventBus) EventBus.emit('doctrina:updated', { id: docId, tipo: 're-analizado' });
                    showSuccess('✅ Re-análisis completado. Metadatos actualizados.');
                    doctrinaVerDoc(docId);
                } catch (e) {
                    showError('Error en re-análisis: ' + e.message);
                }
            }

            // ── API pública del módulo ────────────────────────────────────
            return {
                abrirModal,
                cerrarModal,
                procesarPdf,
                reanalizar,
                // Handlers internos expuestos para onclick inline del HTML
                _cerrarSiClick,
                _onDragOver,
                _onDragLeave,
                _onDrop,
                _onFileSelect,
                _clearFile,
            };
        })();

        window.DocPdfIndexer = DocPdfIndexer;

        console.info('[AppBogado v13] DocPdfIndexer ✓ — PDF → Drive → IA → DoctrinaDB');
