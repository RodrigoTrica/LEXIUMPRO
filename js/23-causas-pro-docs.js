// ████████████████████████████████████████████████████████████████████
// JS — BLOQUE 23: CAUSAS PRO — GESTIÓN DE DOCUMENTOS
// • crearCausa(), agregarDocumento(), renderDocumentos()
// • Subida de PDF + extracción automática con IA (Claude API)
// Insertar en index.html ANTES del cierre </body>:
//   <script src="js/23-causas-pro-docs.js"></script>
// ████████████████████████████████████████████████████████████████████

// ══════════════════════════════════════════════════════════════════
// 1. FUNCIONES BASE — crearCausa, agregarDocumento, renderDocumentos
// ══════════════════════════════════════════════════════════════════

/**
 * Crea una nueva causa en DB y persiste.
 * Llamada desde uiCrearCausaPro() en 02-render-crud.js
 */
function crearCausa(datos) {
    const etapas = typeof generarEtapas === 'function'
        ? generarEtapas(datos.tipoProcedimiento || 'Ordinario Civil')
        : [];

    const nueva = {
        id: uid(),
        caratula: datos.caratula || 'Sin carátula',
        tipoProcedimiento: datos.tipoProcedimiento || 'Ordinario Civil',
        rama: datos.rama || '',
        clienteId: datos.clienteId || null,
        estadoGeneral: 'En tramitación',
        instancia: 'Primera',
        porcentajeAvance: 0,
        fechaCreacion: new Date().toISOString(),
        fechaUltimaActividad: new Date().toISOString(),
        etapasProcesales: etapas,
        documentos: [],
        recursos: [],
        estrategia: {},
        riesgo: {},
        honorarios: {},
        jurisprudenciaAsociada: [],
        revisadoHoy: false,
        prioridadManual: false,
        docsCliente: [],
        docsTribunal: [],
        docsTramites: [],
        estadoCuenta: { montoTotal: 0, pagos: [], totalPagado: 0, saldoPendiente: 0 }
    };

    DB.causas.push(nueva);
    if (typeof markAppDirty === 'function') markAppDirty();
    if (typeof save === 'function') save();
    if (typeof showSuccess === 'function') showSuccess('Causa creada correctamente.');
    return nueva;
}

/**
 * Agrega un documento al índice global DB.documentos.
 * Calcula fechaVencimiento si generaPlazo.
 * Llamada desde uiAgregarDocumento() en 02-render-crud.js
 */
function agregarDocumento(causaId, datos) {
    let fechaVencimiento = null;

    if (datos.generaPlazo && datos.diasPlazo && datos.fechaDocumento) {
        const base = new Date(datos.fechaDocumento + 'T12:00:00');
        base.setDate(base.getDate() + parseInt(datos.diasPlazo));
        fechaVencimiento = base.toISOString().split('T')[0];
    }

    const doc = {
        id: uid(),
        causaId: causaId,
        nombreOriginal: datos.nombreOriginal || 'Documento sin nombre',
        tipo: datos.tipo || 'Escrito',
        etapaVinculada: datos.etapaVinculada || '',
        fechaDocumento: datos.fechaDocumento || new Date().toISOString().split('T')[0],
        generaPlazo: datos.generaPlazo || false,
        diasPlazo: datos.diasPlazo || 0,
        fechaVencimiento: fechaVencimiento,
        fechaIngreso: new Date().toISOString(),
        descripcion: datos.descripcion || datos.nombreOriginal || '',
        archivoBase64: datos.archivoBase64 || null,
        archivoNombre: datos.archivoNombre || null
    };

    DB.documentos.push(doc);

    // También agregar referencia embebida en la causa
    const causa = DB.causas.find(c => c.id === causaId);
    if (causa) {
        if (!causa.documentos) causa.documentos = [];
        causa.documentos.push(doc);
        causa.fechaUltimaActividad = new Date().toISOString();
    }

    if (typeof markAppDirty === 'function') markAppDirty();
    if (typeof save === 'function') save();

    // Crear alerta automática si genera plazo
    if (doc.generaPlazo && fechaVencimiento) {
        const causaNombre = causa ? causa.caratula : 'Causa desconocida';
        DB.alertas.push({
            id: uid(),
            causaId: causaId,
            tipo: 'plazo',
            mensaje: `Plazo de ${doc.diasPlazo} días: "${doc.nombreOriginal}" — ${causaNombre}`,
            fechaObjetivo: fechaVencimiento,
            prioridad: 'alta',
            estado: 'activa',
            fechaCreacion: new Date().toISOString()
        });
        if (typeof markAppDirty === 'function') markAppDirty();
        if (typeof save === 'function') save();
    }

    if (typeof registrarEvento === 'function') {
        registrarEvento(`Documento indexado: "${doc.nombreOriginal}" en causa ID ${causaId}`);
    }

    return doc;
}

/**
 * Renderiza la lista de documentos de una causa en #listaDocumentos
 */
function renderDocumentos(causaId) {
    const el = document.getElementById('listaDocumentos');
    if (!el) return;

    const docs = DB.documentos.filter(d => d.causaId === causaId);

    if (!docs.length) {
        el.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-3); font-size:0.82rem;">
                <i class="fas fa-folder-open" style="font-size:1.8rem; margin-bottom:8px; display:block; opacity:0.4;"></i>
                Sin documentos indexados aún
            </div>`;
        return;
    }

    const tipoColor = {
        'Resolución': '#7c3aed',
        'Escrito': '#2563eb',
        'Prueba': '#d97706',
        'Sentencia': '#dc2626',
        'Notificación': '#059669'
    };

    el.innerHTML = docs
        .slice()
        .sort((a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso))
        .map(d => {
            const color = tipoColor[d.tipo] || '#64748b';
            const fechaDoc = d.fechaDocumento
                ? new Date(d.fechaDocumento + 'T12:00:00').toLocaleDateString('es-CL')
                : '—';
            const venc = d.fechaVencimiento
                ? `<span style="color:var(--danger); font-weight:600; font-size:0.72rem;">
                       <i class="fas fa-clock"></i> Vence: ${new Date(d.fechaVencimiento + 'T12:00:00').toLocaleDateString('es-CL')}
                   </span>`
                : '';

            return `
            <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; background:var(--bg-2);">
                <div style="min-width:36px; height:36px; border-radius:8px; background:${color}18; color:${color};
                            display:flex; align-items:center; justify-content:center; font-size:0.8rem;">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:0.83rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escHtml(d.nombreOriginal)}
                    </div>
                    <div style="display:flex; gap:8px; margin-top:3px; flex-wrap:wrap; align-items:center;">
                        <span style="font-size:0.7rem; background:${color}18; color:${color}; padding:1px 7px; border-radius:20px; font-weight:600;">
                            ${escHtml(d.tipo)}
                        </span>
                        ${d.etapaVinculada ? `<span style="font-size:0.7rem; color:var(--text-3);">Etapa: ${escHtml(d.etapaVinculada)}</span>` : ''}
                        <span style="font-size:0.7rem; color:var(--text-3);">${fechaDoc}</span>
                        ${venc}
                    </div>
                </div>
                <button class="btn-xs" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:4px; border-radius:4px;"
                        onclick="eliminarDocumento('${d.id}', ${causaId})" title="Eliminar">
                    <i class="fas fa-trash" style="font-size:0.75rem;"></i>
                </button>
            </div>`;
        }).join('');
}

// ══════════════════════════════════════════════════════════════════
// ELIMINAR CAUSA — con confirmación por contraseña del usuario
// ══════════════════════════════════════════════════════════════════

/**
 * Abre el modal de confirmación para eliminar una causa.
 * Requiere ingresar la contraseña del usuario activo.
 */
function uiEliminarCausa(causaId) {
    const causa = DB.causas.find(c => c.id === causaId);
    if (!causa) return;

    // Inyectar modal si no existe
    let modal = document.getElementById('modal-eliminar-causa');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-eliminar-causa';
        modal.style.cssText = `
            display:none; position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.55); backdrop-filter:blur(3px);
            align-items:center; justify-content:center;
        `;
        modal.innerHTML = `
            <div style="background:var(--bg-1); border:1px solid var(--border); border-radius:14px;
                        padding:28px 24px; max-width:400px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
                    <div style="width:36px; height:36px; border-radius:50%; background:#fef2f2;
                                display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-trash" style="color:#dc2626; font-size:0.9rem;"></i>
                    </div>
                    <div>
                        <div style="font-weight:700; font-size:0.95rem;">Eliminar causa</div>
                        <div id="elim-causa-nombre" style="font-size:0.78rem; color:var(--text-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;"></div>
                    </div>
                </div>
                <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px;
                            padding:10px 12px; margin-bottom:16px; font-size:0.78rem; color:#991b1b;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Acción irreversible.</strong> Se eliminarán la causa y todos sus documentos indexados.
                </div>
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-2); display:block; margin-bottom:6px;">
                    Ingresa tu contraseña para confirmar
                </label>
                <input type="password" id="elim-causa-pass"
                       placeholder="Contraseña"
                       style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px;
                              background:var(--bg-2); color:var(--text-1); font-size:0.85rem; box-sizing:border-box;
                              outline:none;"
                       onkeydown="if(event.key==='Enter') _confirmarEliminarCausa()"
                >
                <div id="elim-causa-error" style="display:none; color:#dc2626; font-size:0.75rem; margin-top:6px;">
                    <i class="fas fa-times-circle"></i> Contraseña incorrecta.
                </div>
                <div style="display:flex; gap:10px; margin-top:18px; justify-content:flex-end;">
                    <button onclick="_cerrarModalEliminarCausa()"
                            style="padding:8px 18px; border:1px solid var(--border); border-radius:8px;
                                   background:var(--bg-2); color:var(--text-1); font-size:0.83rem; cursor:pointer;">
                        Cancelar
                    </button>
                    <button onclick="_confirmarEliminarCausa()"
                            style="padding:8px 18px; border:none; border-radius:8px;
                                   background:#dc2626; color:#fff; font-size:0.83rem;
                                   font-weight:600; cursor:pointer;">
                        <i class="fas fa-trash"></i> Eliminar definitivamente
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Cerrar al hacer click en el fondo
        modal.addEventListener('click', function(e) {
            if (e.target === modal) _cerrarModalEliminarCausa();
        });
    }

    // Cargar datos de la causa en el modal
    modal._causaId = causaId;
    document.getElementById('elim-causa-nombre').textContent = causa.caratula;
    document.getElementById('elim-causa-pass').value = '';
    document.getElementById('elim-causa-error').style.display = 'none';

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('elim-causa-pass')?.focus(), 100);
}

function _cerrarModalEliminarCausa() {
    const modal = document.getElementById('modal-eliminar-causa');
    if (modal) modal.style.display = 'none';
}

async function _confirmarEliminarCausa() {
    const modal = document.getElementById('modal-eliminar-causa');
    if (!modal) return;

    const causaId = modal._causaId;
    const passInput = document.getElementById('elim-causa-pass');
    const errorEl = document.getElementById('elim-causa-error');
    const pass = passInput?.value || '';

    if (!pass) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = '<i class="fas fa-times-circle"></i> Ingresa tu contraseña.';
        passInput?.focus();
        return;
    }

    // Hash SHA-256 de la contraseña ingresada
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
    const hashIngresado = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

    // Obtener usuario activo
    const usuarios = AppConfig.get('usuarios') || [];
    const usuarioActivo = usuarios.find(u => u.activo) || usuarios[0];

    if (!usuarioActivo || hashIngresado !== usuarioActivo.passwordHash) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = '<i class="fas fa-times-circle"></i> Contraseña incorrecta.';
        passInput.value = '';
        passInput?.focus();
        return;
    }

    // ✅ Contraseña correcta — eliminar causa y sus documentos
    DB.documentos = DB.documentos.filter(d => d.causaId !== causaId);
    DB.causas = DB.causas.filter(c => c.id !== causaId);

    // Eliminar alertas asociadas
    if (DB.alertas) {
        DB.alertas = DB.alertas.filter(a => a.causaId !== causaId);
    }

    if (typeof markAppDirty === 'function') markAppDirty();
    if (typeof save === 'function') save();
    if (typeof registrarEvento === 'function') registrarEvento('Causa eliminada: ID ' + causaId);

    _cerrarModalEliminarCausa();

    if (typeof showSuccess === 'function') showSuccess('Causa eliminada correctamente.');
    renderDashboardCausas();
    if (typeof renderAll === 'function') renderAll();
}

/**
 * Elimina un documento del índice y de la causa embebida
 */
function eliminarDocumento(docId, causaId) {
    if (!confirm('¿Eliminar este documento del índice?')) return;
    DB.documentos = DB.documentos.filter(d => d.id !== docId);
    const causa = DB.causas.find(c => c.id === causaId);
    if (causa && causa.documentos) {
        causa.documentos = causa.documentos.filter(d => d.id !== docId);
    }
    if (typeof markAppDirty === 'function') markAppDirty();
    if (typeof save === 'function') save();
    renderDocumentos(causaId);
    if (typeof renderAll === 'function') renderAll();
}


// ══════════════════════════════════════════════════════════════════
// 2. SISTEMA DE SUBIDA DE PDF CON EXTRACCIÓN AUTOMÁTICA POR IA
// ══════════════════════════════════════════════════════════════════

/**
 * Estado del módulo de documentos
 */
const DocsPro = {
    pdfBase64: null,
    pdfNombre: null,
    extrayendo: false
};

/**
 * Inyecta en el panel de causas-pro la zona de subida de PDF.
 * Se llama una vez en DOMContentLoaded.
 */
function _initDocumentUploadUI() {
    // Insertar zona de subida encima del formulario existente
    const titulo = document.querySelector('#causas-pro .card h3.doc-titulo, #causas-pro h3');
    // Buscar el card de "Agregar Documento"
    const cards = document.querySelectorAll('#causas-pro .card');
    let docCard = null;
    cards.forEach(card => {
        if (card.innerHTML.includes('Agregar Documento')) docCard = card;
    });
    if (!docCard) return;

    // Insertar zona de drag & drop al inicio del card
    const uploadZone = document.createElement('div');
    uploadZone.id = 'pdf-upload-zone';
    uploadZone.innerHTML = `
        <div id="pdf-dropzone"
             style="border:2px dashed var(--border); border-radius:10px; padding:18px; text-align:center;
                    cursor:pointer; transition:all 0.2s; margin-bottom:14px; background:var(--bg-1);"
             onclick="document.getElementById('pdf-file-input').click()"
             ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='var(--primary-bg)';"
             ondragleave="this.style.borderColor='var(--border)'; this.style.background='var(--bg-1)';"
             ondrop="_handlePdfDrop(event)">
            <i class="fas fa-cloud-upload-alt" style="font-size:1.6rem; color:var(--primary); margin-bottom:6px; display:block;"></i>
            <div style="font-weight:600; font-size:0.85rem;">Subir PDF del documento</div>
            <div style="font-size:0.72rem; color:var(--text-3); margin-top:3px;">
                Arrastra aquí o haz clic · La IA leerá y completará los campos automáticamente
            </div>
            <input type="file" id="pdf-file-input" accept=".pdf,application/pdf"
                   style="display:none;" onchange="_handlePdfSelect(event)">
        </div>
        <div id="pdf-status" style="display:none; padding:10px; border-radius:8px; font-size:0.82rem; margin-bottom:12px;"></div>
    `;

    // Insertar después del h3
    const h3 = docCard.querySelector('h3');
    if (h3 && h3.nextSibling) {
        docCard.insertBefore(uploadZone, h3.nextSibling);
    } else {
        docCard.prepend(uploadZone);
    }
}

/** Handler drag & drop */
function _handlePdfDrop(event) {
    event.preventDefault();
    const dropzone = document.getElementById('pdf-dropzone');
    if (dropzone) { dropzone.style.borderColor = 'var(--border)'; dropzone.style.background = 'var(--bg-1)'; }
    const file = event.dataTransfer.files[0];
    if (file) _procesarPdf(file);
}

/** Handler input file */
function _handlePdfSelect(event) {
    const file = event.target.files[0];
    if (file) _procesarPdf(file);
}

/**
 * Lee el PDF, lo convierte a base64 y lanza la extracción con IA.
 */
function _procesarPdf(file) {
    if (!file || file.type !== 'application/pdf') {
        _mostrarStatusPdf('error', '<i class="fas fa-exclamation-triangle"></i> Solo se aceptan archivos PDF.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        _mostrarStatusPdf('error', '<i class="fas fa-exclamation-triangle"></i> El PDF supera los 10 MB.');
        return;
    }

    _mostrarStatusPdf('loading', '<i class="fas fa-spinner fa-spin"></i> Leyendo PDF...');

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result.split(',')[1]; // quitar prefijo data:...
        DocsPro.pdfBase64 = base64;
        DocsPro.pdfNombre = file.name;

        // Actualizar dropzone con nombre del archivo
        const dropzone = document.getElementById('pdf-dropzone');
        if (dropzone) {
            dropzone.innerHTML = `
                <i class="fas fa-file-pdf" style="font-size:1.6rem; color:#dc2626; margin-bottom:6px; display:block;"></i>
                <div style="font-weight:600; font-size:0.85rem;">${escHtml(file.name)}</div>
                <div style="font-size:0.72rem; color:var(--text-3); margin-top:3px;">
                    ${(file.size / 1024).toFixed(0)} KB · <span style="color:var(--primary); cursor:pointer;" onclick="document.getElementById('pdf-file-input').click()">cambiar archivo</span>
                </div>
                <input type="file" id="pdf-file-input" accept=".pdf,application/pdf"
                       style="display:none;" onchange="_handlePdfSelect(event)">
            `;
        }

        // Extraer datos con IA
        _extraerDatosConIA(base64, file.name);
    };
    reader.onerror = () => _mostrarStatusPdf('error', '<i class="fas fa-exclamation-triangle"></i> Error al leer el archivo.');
    reader.readAsDataURL(file);
}

/**
 * Extrae texto del PDF usando PDF.js y luego llama a iaCall()
 * (sistema de IA nativo de la app — Gemini, OpenAI o Claude según config)
 */
async function _extraerDatosConIA(base64, nombreArchivo) {
    if (DocsPro.extrayendo) return;
    DocsPro.extrayendo = true;
    _mostrarStatusPdf('loading', '<i class="fas fa-spinner fa-spin"></i> Extrayendo texto del PDF...');

    try {
        // ── 1. Extraer texto del PDF con PDF.js ──────────────────────────────
        const textoPdf = await _extraerTextoPdf(base64);

        if (!textoPdf || textoPdf.trim().length < 20) {
            throw new Error('El PDF no contiene texto extraíble (puede ser imagen escaneada).');
        }

        // Truncar a 6000 caracteres para no exceder contexto
        const textoTruncado = textoPdf.substring(0, 6000);

        // ── 2. Contexto de la causa ──────────────────────────────────────────
        const causaId = parseInt(document.getElementById('doc-causa-sel')?.value);
        const causa = causaId ? DB.causas.find(c => c.id === causaId) : null;
        const ramaContexto = causa ? `La causa es de rama/materia: "${causa.rama || causa.tipoProcedimiento}".` : '';

        _mostrarStatusPdf('loading', '<i class="fas fa-brain fa-pulse"></i> Analizando con IA...');

        // ── 3. Llamar a iaCall (usa el proveedor configurado: Gemini/OpenAI/Claude) ──
        const prompt = `Eres un asistente jurídico especializado en derecho chileno. ${ramaContexto}
Analiza el siguiente texto de un documento legal y extrae sus metadatos.

Devuelve SOLO un objeto JSON válido, sin explicaciones ni bloques de código:
{
  "nombre": "nombre descriptivo del documento (ej: Demanda principal, Resolución de admisibilidad)",
  "tipo": "uno de: Resolución | Escrito | Prueba | Sentencia | Notificación",
  "etapa": "etapa procesal (ej: Demanda interpuesta, Contestación, Prueba documental, Sentencia definitiva)",
  "fecha": "fecha del documento en formato YYYY-MM-DD (vacío si no se encuentra)",
  "generaPlazo": false,
  "diasPlazo": 0,
  "resumen": "resumen de 1-2 líneas del contenido"
}

Si el documento establece un plazo procesal explícito (ej: 'tiene 10 días para contestar'), pon generaPlazo: true y diasPlazo con el número.

TEXTO DEL DOCUMENTO:
${textoTruncado}`;

        const respuesta = await iaCall(prompt);

        // Limpiar posibles bloques ```json ```
        const jsonStr = respuesta.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const extracted = JSON.parse(jsonStr);

        _rellenarFormularioConDatos(extracted, nombreArchivo);
        _mostrarStatusPdf('success',
            `<i class="fas fa-check-circle"></i> <strong>IA extrajo los datos automáticamente.</strong>
             ${extracted.resumen ? `<br><span style="color:var(--text-2); font-size:0.75rem;">${escHtml(extracted.resumen)}</span>` : ''}
             <br><span style="font-size:0.72rem; color:var(--text-3);">Revisa los campos antes de guardar.</span>`
        );

    } catch (err) {
        console.error('[DocsPro] Error extracción IA:', err);
        _rellenarFormularioConDatos({ nombre: nombreArchivo.replace(/\.pdf$/i, '') }, nombreArchivo);
        _mostrarStatusPdf('warning',
            `<i class="fas fa-exclamation-triangle"></i> No se pudo extraer datos automáticamente. 
             Completa los campos manualmente. <span style="font-size:0.7rem; color:var(--text-3);">(${err.message})</span>`
        );
    } finally {
        DocsPro.extrayendo = false;
    }
}

/**
 * Extrae texto plano de un PDF en base64 usando PDF.js
 * PDF.js se carga dinámicamente desde CDN si no está disponible.
 */
async function _extraerTextoPdf(base64) {
    // Cargar PDF.js si no está disponible
    if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Convertir base64 a Uint8Array
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    let textoCompleto = '';

    const maxPaginas = Math.min(pdf.numPages, 10); // máximo 10 páginas
    for (let i = 1; i <= maxPaginas; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const textoPagina = content.items.map(item => item.str).join(' ');
        textoCompleto += textoPagina + '\n';
    }

    return textoCompleto.trim();
}

/**
 * Rellena el formulario con los datos extraídos por la IA
 */
function _rellenarFormularioConDatos(datos, nombreArchivo) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    // Nombre del documento
    if (datos.nombre) {
        set('doc-nombre', datos.nombre);
    } else if (nombreArchivo) {
        set('doc-nombre', nombreArchivo.replace(/\.pdf$/i, ''));
    }

    // Tipo
    const tiposValidos = ['Resolución', 'Escrito', 'Prueba', 'Sentencia', 'Notificación'];
    if (datos.tipo && tiposValidos.includes(datos.tipo)) {
        set('doc-tipo', datos.tipo);
    }

    // Etapa
    if (datos.etapa) set('doc-etapa', datos.etapa);

    // Fecha
    if (datos.fecha && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
        set('doc-fecha', datos.fecha);
    }

    // Plazo
    if (datos.generaPlazo && datos.diasPlazo > 0) {
        const chk = document.getElementById('doc-genera-plazo');
        if (chk) {
            chk.checked = true;
            if (typeof uiToggleDocPlazo === 'function') uiToggleDocPlazo();
        }
        set('doc-dias', datos.diasPlazo);
    }
}

/**
 * Muestra estado en la barra de status del PDF
 */
function _mostrarStatusPdf(tipo, html) {
    const el = document.getElementById('pdf-status');
    if (!el) return;

    const estilos = {
        loading: 'background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8;',
        success: 'background:#f0fdf4; border:1px solid #bbf7d0; color:#166534;',
        error:   'background:#fef2f2; border:1px solid #fecaca; color:#991b1b;',
        warning: 'background:#fffbeb; border:1px solid #fde68a; color:#92400e;'
    };

    el.style.cssText = (estilos[tipo] || estilos.loading) + 'display:block; padding:10px; border-radius:8px; font-size:0.82rem; margin-bottom:12px; line-height:1.5;';
    el.innerHTML = html;
}


// ══════════════════════════════════════════════════════════════════
// 3. OVERRIDE de uiAgregarDocumento para incluir el PDF en base64
// ══════════════════════════════════════════════════════════════════

/**
 * Reemplaza la función definida en 02-render-crud.js para incluir
 * el archivo PDF en base64 al indexar el documento.
 * 
 * IMPORTANTE: Este archivo debe cargarse DESPUÉS de 02-render-crud.js
 * para que este override tome efecto.
 */
function uiAgregarDocumento() {
    const causaId = parseInt(document.getElementById('doc-causa-sel')?.value);
    const nombre  = document.getElementById('doc-nombre')?.value.trim();
    const tipo    = document.getElementById('doc-tipo')?.value;
    const etapa   = document.getElementById('doc-etapa')?.value.trim();
    const fecha   = document.getElementById('doc-fecha')?.value;
    const generaPlazo = document.getElementById('doc-genera-plazo')?.checked;
    const diasPlazo   = parseInt(document.getElementById('doc-dias')?.value) || 0;

    // Validaciones
    if (!causaId || isNaN(causaId)) { showError('Seleccione una causa.'); return; }
    if (!nombre)  { showError('Ingrese el nombre del documento.'); return; }
    if (generaPlazo && !diasPlazo)  { showError('Ingrese los días del plazo.'); return; }
    if (generaPlazo && !fecha)      { showError('Ingrese la fecha del documento para calcular el plazo.'); return; }
    if (generaPlazo && !confirm(`¿Confirmar plazo de ${diasPlazo} días desde ${fecha}?\n\nLa responsabilidad del cálculo es del abogado.`)) return;

    // Agregar documento (con PDF si fue subido)
    agregarDocumento(causaId, {
        nombreOriginal: nombre,
        tipo,
        etapaVinculada: etapa,
        fechaDocumento: fecha,
        generaPlazo,
        diasPlazo,
        archivoBase64: DocsPro.pdfBase64 || null,
        archivoNombre: DocsPro.pdfNombre || null
    });

    // Limpiar formulario
    ['doc-nombre', 'doc-etapa', 'doc-dias', 'doc-fecha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const chk = document.getElementById('doc-genera-plazo');
    if (chk) chk.checked = false;
    const plazoExtra = document.getElementById('doc-plazo-extra');
    if (plazoExtra) plazoExtra.style.display = 'none';

    // Limpiar PDF
    DocsPro.pdfBase64 = null;
    DocsPro.pdfNombre = null;
    const dropzone = document.getElementById('pdf-dropzone');
    if (dropzone) {
        dropzone.innerHTML = `
            <i class="fas fa-cloud-upload-alt" style="font-size:1.6rem; color:var(--primary); margin-bottom:6px; display:block;"></i>
            <div style="font-weight:600; font-size:0.85rem;">Subir PDF del documento</div>
            <div style="font-size:0.72rem; color:var(--text-3); margin-top:3px;">
                Arrastra aquí o haz clic · La IA leerá y completará los campos automáticamente
            </div>
            <input type="file" id="pdf-file-input" accept=".pdf,application/pdf"
                   style="display:none;" onchange="_handlePdfSelect(event)">
        `;
    }
    const statusEl = document.getElementById('pdf-status');
    if (statusEl) statusEl.style.display = 'none';

    if (typeof showSuccess === 'function') showSuccess('Documento indexado correctamente.');
    renderDocumentos(causaId);
    if (typeof renderAll === 'function') renderAll();
}

// También sobrescribir uiCrearCausaPro para asegurar que usa la nueva crearCausa
function uiCrearCausaPro() {
    const caratula = document.getElementById('cp-caratula')?.value.trim();
    const tipo     = document.getElementById('cp-tipo')?.value;
    const rama     = document.getElementById('cp-rama')?.value.trim();
    if (!caratula) { showError('Ingrese la carátula de la causa.'); return; }
    crearCausa({ caratula, tipoProcedimiento: tipo, rama, clienteId: null });
    if (document.getElementById('cp-caratula')) document.getElementById('cp-caratula').value = '';
    if (document.getElementById('cp-rama'))     document.getElementById('cp-rama').value = '';
    if (typeof registrarEvento === 'function') registrarEvento('Causa Pro creada: ' + caratula);
    if (typeof renderAll === 'function') renderAll();
}

// Actualizar lista de documentos al cambiar la causa seleccionada
function _bindDocCausaSelector() {
    const sel = document.getElementById('doc-causa-sel');
    if (!sel) return;
    sel.addEventListener('change', function () {
        const id = parseInt(this.value);
        if (id) renderDocumentos(id);
        else {
            const el = document.getElementById('listaDocumentos');
            if (el) el.innerHTML = '';
        }
    });
}


// ══════════════════════════════════════════════════════════════════
// 4. INIT
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// 5. RENDER DASHBOARD CAUSAS PRO
// ══════════════════════════════════════════════════════════════════

function renderDashboardCausas() {
    const el = document.getElementById('dashboardCausas');
    if (!el) return;

    if (!DB.causas.length) {
        el.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-3); font-size:0.82rem;">
                <i class="fas fa-folder-open" style="font-size:1.8rem; margin-bottom:8px; display:block; opacity:0.4;"></i>
                Sin causas creadas aún
            </div>`;
        return;
    }

    const estadoColor = {
        'En tramitación': '#2563eb',
        'Finalizada':     '#059669',
        'Suspendida':     '#d97706',
        'Archivada':      '#64748b'
    };

    el.innerHTML = DB.causas.map(c => {
        const color = estadoColor[c.estadoGeneral] || '#64748b';
        const ndocs = DB.documentos.filter(d => d.causaId === c.id).length;
        const fecha = c.fechaCreacion
            ? new Date(c.fechaCreacion).toLocaleDateString('es-CL')
            : '—';

        return `
        <div style="display:flex; gap:10px; align-items:flex-start; padding:10px 12px;
                    border:1px solid var(--border); border-radius:8px; margin-bottom:8px;
                    background:var(--bg-1); cursor:default;">
            <div style="min-width:8px; height:8px; border-radius:50%; background:${color};
                        margin-top:5px; flex-shrink:0;"></div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.84rem; white-space:nowrap;
                            overflow:hidden; text-overflow:ellipsis;">
                    ${escHtml(c.caratula)}
                </div>
                <div style="display:flex; gap:8px; margin-top:3px; flex-wrap:wrap;">
                    <span style="font-size:0.7rem; color:var(--text-3);">
                        ${escHtml(c.tipoProcedimiento)}${c.rama ? ' · ' + escHtml(c.rama) : ''}
                    </span>
                    <span style="font-size:0.7rem; color:var(--text-3);">
                        <i class="fas fa-file-alt"></i> ${ndocs} doc${ndocs !== 1 ? 's' : ''}
                    </span>
                    <span style="font-size:0.7rem; color:var(--text-3);">${fecha}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
                <span style="font-size:0.68rem; background:${color}18; color:${color};
                             padding:2px 8px; border-radius:20px; font-weight:600; white-space:nowrap;">
                    ${escHtml(c.estadoGeneral || 'En tramitación')}
                </span>
                <button onclick="event.stopPropagation(); uiEliminarCausa('${c.id}')"
                        title="Eliminar causa"
                        style="background:transparent; border:1px solid #fecaca; border-radius:6px;
                               color:#dc2626; cursor:pointer; padding:3px 8px; font-size:0.68rem;
                               display:flex; align-items:center; gap:4px; white-space:nowrap;"
                        onmouseover="this.style.background='#fef2f2'"
                        onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash" style="font-size:0.62rem;"></i> Eliminar
                </button>
            </div>
        </div>`;
    }).join('');
}

// Hook en renderAll para que se actualice automáticamente
const _renderAllOriginal = typeof renderAll === 'function' ? renderAll : null;
if (_renderAllOriginal) {
    renderAll = function () {
        _renderAllOriginal();
        renderDashboardCausas();
    };
}

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        _initDocumentUploadUI();
        _bindDocCausaSelector();
        renderDashboardCausas();
    }, 500);
});
