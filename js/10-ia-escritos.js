        // ── Toggle modo IA en Escritos ────────────────────────────────────
        function uiToggleModoIA() {
            const activo  = document.getElementById('esc-modo-ia').checked;
            const warn    = document.getElementById('esc-ia-key-warn');
            const disc    = document.getElementById('esc-disclaimer-ia');
            const btnTxt  = document.getElementById('btn-generar-txt');
            const pid     = typeof iaGetProvider === 'function' ? iaGetProvider() : 'gemini';
            const pLabel  = (typeof IA_PROVIDERS !== 'undefined' && IA_PROVIDERS[pid]?.label) || 'IA';
            warn.style.display = (activo && !iaGetKey(pid)) ? 'flex' : 'none';
            disc.style.display = activo ? 'flex' : 'none';
            btnTxt.textContent = activo ? `Generar con ${pLabel}` : 'Generar Borrador';
        }

        // ── Toggle panel IA lateral ───────────────────────────────────────
        function escToggleIA() {
            const panel = document.getElementById('esc-ia-panel');
            const open = panel.classList.toggle('open');
            // Shift body when panel opens on large screens
            const body = document.querySelector('.esc-body');
            if (body) body.style.marginRight = open ? '300px' : '';
        }

        // ── Mostrar sugerencias en panel IA ──────────────────────────────
        function escMostrarSugerencias(texto) {
            const body = document.getElementById('esc-ia-panel-body');
            if (!body) return;

            // Extraer bloque [NOTAS INTERNAS] si existe
            const notasMatch = texto.match(/\[NOTAS INTERNAS[^\]]*\]([\s\S]*?)$/i);
            let sugerencias = [];
            if (notasMatch) {
                // Parsear líneas de sugerencias
                const raw = notasMatch[1].trim();
                sugerencias = raw.split(/\n+/).filter(l => l.trim().length > 10);
            }

            if (!sugerencias.length) {
                body.innerHTML = `<div class="esc-ia-sugerencia">
                    <div class="esc-ia-sugerencia-label">✓ Análisis completado</div>
                    <p>El escrito fue generado con los datos de la causa. Revise el documento en el visor antes de presentarlo.</p>
                </div>`;
                return;
            }

            const labels = ['Fortaleza táctica', 'Punto de atención', 'Acción recomendada', 'Observación estratégica'];
            body.innerHTML = `
                <div style="font-size:0.72rem; color:rgba(255,255,255,0.4); margin-bottom:12px; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; letter-spacing:0.08em;">
                    ${sugerencias.length} sugerencia${sugerencias.length > 1 ? 's' : ''} del análisis IA
                </div>
                ${sugerencias.slice(0, 4).map((s, i) => `
                <div class="esc-ia-sugerencia">
                    <div class="esc-ia-sugerencia-label">${labels[i] || `Sugerencia ${i + 1}`}</div>
                    <p>${escHtml(s.replace(/^[-•*\d.]+\s*/, ''))}</p>
                </div>`).join('')}`;

            // Abrir panel automáticamente
            const panel = document.getElementById('esc-ia-panel');
            const container = document.querySelector('.esc-body');
            if (panel && !panel.classList.contains('open')) {
                panel.classList.add('open');
                if (container) container.classList.add('ia-open');
            }
        }

        // ── uiGenerarEscrito DUAL PRO v2 ─────────────────────────────────
        async function uiGenerarEscrito() {
            const causaId = parseInt(document.getElementById('esc-causa-sel').value);
            const tipo = document.getElementById('esc-tipo').value;
            const hechos = document.getElementById('esc-hechos').value.trim();
            const modoIA = document.getElementById('esc-modo-ia').checked;

            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!hechos) { showError('Ingrese los hechos y antecedentes del escrito.'); return; }

            const previewEl = document.getElementById('esc-preview');
            const overlay = document.getElementById('esc-loading-overlay');
            const aviso = document.getElementById('esc-aviso');
            const disclaimerIA = document.getElementById('esc-disclaimer-ia');
            const btnTxt = document.getElementById('btn-generar-txt');
            const visorTit = document.getElementById('esc-visor-titulo');

            // Actualizar título del visor
            const tipoLabelVisor = document.getElementById('esc-tipo')?.selectedOptions?.[0]?.dataset?.label || tipo;
            if (visorTit) visorTit.textContent = `${tipoLabelVisor} — generando…`;

            if (modoIA) {
                const _pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'gemini';
                const _pLabel = (typeof IA_PROVIDERS !== 'undefined' && IA_PROVIDERS[_pid]?.label) || 'IA';
                if (!iaGetKey(_pid)) {
                    showError(`Configure su API Key de ${_pLabel} en Sistema → Configurar IA.`);
                    document.getElementById('esc-ia-key-warn').style.display = 'flex';
                    return;
                }
                // Mostrar overlay de carga
                if (overlay) overlay.style.display = 'flex';
                previewEl.innerHTML = '';
                btnTxt.textContent = 'Generando…';

                try {
                    const causa = DB.causas.find(c => c.id === causaId);
                    const jurisAsociada = (causa.jurisprudenciaAsociada || [])
                        .map(id => DB.jurisprudencia.find(j => j.id === id))
                        .filter(Boolean)
                        .map(j => `- ROL ${j.rol || 'N/A'} (${j.tendencia}): ${j.temaCentral || j.holding || ''}`)
                        .join('\n');

                    // Obtener label y prompt especializado del tipo seleccionado
                    const tipoLabel = document.getElementById('esc-tipo')?.selectedOptions?.[0]?.dataset?.label || tipo;
                    const promptEspecializado = getPromptExtraEscrito();

                    const prompt = `Eres un abogado litigante chileno experto en ${causa.rama || 'Derecho Civil'}.
Redacta un escrito judicial formal de tipo "${tipoLabel}" para presentar ante un tribunal chileno.
Usa el formato estándar chileno: EN LO PRINCIPAL / EN EL OTROSÍ, RIT/ROL, fundamentación legal con artículos del Código de Procedimiento Civil y normas sustantivas aplicables a la materia, y peticiones concretas.
Deja entre [CORCHETES] los datos que el abogado debe completar (nombre, RUT, domicilio, etc.).
NO inventes hechos. Usa SOLO los proporcionados.

INSTRUCCIONES ESPECÍFICAS PARA ESTE TIPO DE ESCRITO:
${promptEspecializado}

DATOS DE LA CAUSA:
- Carátula: ${causa.caratula}
- Tribunal: ${causa.juzgado || 'Tribunal competente'}
- Procedimiento: ${causa.tipoProcedimiento}
- Rama: ${causa.rama || 'Civil'}

HECHOS Y ANTECEDENTES:
${hechos}

${jurisAsociada ? 'JURISPRUDENCIA ASOCIADA:\n' + jurisAsociada : ''}

Redacta el escrito completo con formato profesional. Al final agrega:
[NOTAS INTERNAS - NO INCLUIR EN PRESENTACIÓN FINAL]
- 3 sugerencias estratégicas concretas basadas en los hechos y el tipo de escrito.`;

                    const texto = await iaCall(prompt);

                    // Separar escrito de notas internas para el visor
                    const escritoLimpio = texto.replace(/\[NOTAS INTERNAS[\s\S]*$/i, '').trim();
                    _escritoActual = { causaId, texto: escritoLimpio, tipo };

                    previewEl.textContent = escritoLimpio;
                    aviso.style.display = 'flex';
                    disclaimerIA.style.display = 'flex';
                    if (visorTit) visorTit.textContent = `${tipoLabel} · Causa #${causaId}`;

                    escMostrarSugerencias(texto);
                    registrarEvento(`Escrito IA generado: ${tipo} — causa ${causaId}`);
                    escActualizarEstadoBotones(true);

                } catch (e) {
                    const msg = e.message || '';
                    const es429 = e.status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('cuota');
                    if (es429) {
                        previewEl.textContent =
                            `⚠️  CUOTA DE API EXCEDIDA (Error 429)\n\n` +
                            `Su proyecto de Google Cloud tiene límite 0 o no tiene facturación activa.\n\n` +
                            `Pasos para resolver:\n` +
                            `  1. Ir a console.cloud.google.com\n` +
                            `  2. Activar Billing en el proyecto asociado a su API key\n` +
                            `  3. Confirmar que "Generative Language API" esté habilitada\n` +
                            `  4. En IAM & Admin → Quotas, filtrar por "generativelanguage"\n` +
                            `     y confirmar que el límite sea mayor a 0\n\n` +
                            `Si el problema persiste, verifique los modelos disponibles en su cuenta usando el botón "Probar Conexión" en Sistema → Configurar IA.\n` +
                            `(disponible sin facturación en el tier gratuito de AI Studio).\n\n` +
                            `Nota: Este error no es un bug de código. Es un problema de\n` +
                            `configuración de cuenta en Google Cloud.`;
                        if (visorTit) visorTit.textContent = 'Cuota excedida — Revise configuración Google Cloud';
                    } else {
                        previewEl.textContent = `Error al conectar con Gemini: ${msg}\n\nVerifique su API Key en Sistema → Configurar IA.`;
                        if (visorTit) visorTit.textContent = 'Error de conexión — intente nuevamente';
                    }
                } finally {
                    if (overlay) overlay.style.display = 'none';
                    btnTxt.textContent = 'Generar con IA';
                }
            } else {
                // Plantillas estáticas
                const texto = generarEscrito(causaId, tipo, hechos);
                _escritoActual = { causaId, texto, tipo };
                previewEl.textContent = texto;
                aviso.style.display = 'flex';
                disclaimerIA.style.display = 'none';
                if (visorTit) visorTit.textContent = `${tipo} · Causa #${causaId} (Plantilla)`;
            }

            // Habilitar botones de acción en navbar al generar
            escActualizarEstadoBotones(true);
        }

        // ── Estado de botones de la navbar de escritos ────────────────────
        /**
         * Habilita o deshabilita los botones de acción del visor de escritos
         * (Guardar, Copiar, Descargar, Aplicar Variables).
         *
         * @param {boolean} habilitado - `true` para activar los botones, `false` para desactivarlos.
         */
        function escActualizarEstadoBotones(habilitado) {
            ['btn-guardar-escrito', 'btn-exportar-escrito', 'btn-copiar-escrito'].forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = !habilitado;
                btn.style.opacity = habilitado ? '1' : '0.4';
                btn.style.pointerEvents = habilitado ? 'auto' : 'none';
            });
        }

        // ── uiGuardarEscrito (stub base) ──────────────────────────────────
        // ⚠️  Versión mínima: guarda en causa sin registrar en historial.
        // 11b-escritos-ui.js define la versión extendida (con historial del
        // despacho, detección de origen IA/plantilla, etc.) y la expone en
        // window.uiGuardarEscrito sobreescribiendo esta al cargar.
        // Este stub actúa solo si 11b no está disponible.
        function uiGuardarEscrito() {
            const { causaId, texto, tipo } = _escritoActual;
            if (!causaId || !texto) { showError('Primero genere un escrito.'); return; }
            showConfirm("Guardar Escrito", `¿Guardar "${tipo}" como documento en la causa?`, () => {
                guardarEscritoComoDocumento(causaId, texto, tipo);
                renderAll();
                showSuccess('Escrito guardado correctamente en la causa.');
            });
        }

        // ── uiExportarEscrito ────────────────────────────────────────────
        function uiExportarEscrito() {
            const { texto, tipo, causaId } = _escritoActual;
            if (!texto) { showError('Primero genere un escrito.'); return; }
            const causa = DB.causas.find(c => c.id === causaId);
            const nombre = `${tipo}_${(causa?.caratula || 'causa').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
            const blob = new Blob([texto], { type: 'text/plain; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nombre; a.click();
            URL.revokeObjectURL(url);
            registrarEvento(`Escrito exportado: ${tipo}`);
        }

        // ── uiCopiarEscrito ──────────────────────────────────────────────
        function uiCopiarEscrito() {
            const { texto } = _escritoActual;
            if (!texto) { showError('Primero genere un escrito.'); return; }
            const btn = document.getElementById('btn-copiar-escrito');
            navigator.clipboard.writeText(texto).then(() => {
                btn.innerHTML = '<i class="fas fa-check"></i> <span>Copiado</span>';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> <span>Copiar</span>'; }, 2000);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = texto; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
                btn.innerHTML = '<i class="fas fa-check"></i> <span>Copiado</span>';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> <span>Copiar</span>'; }, 2000);
            });
        }

        // ── Importar fallo desde texto con IA ─────────────────────────────
        async function iaImportarFallo() {
            const texto = document.getElementById('import-fallo-texto').value.trim();
            if (!texto || texto.length < 50) { showError('Pegue el texto del fallo (mínimo 50 caracteres).'); return; }
            if (!iaGetKey(typeof iaGetProvider==='function'?iaGetProvider():'gemini')) { showError('Configure su API Key en Sistema → Configurar IA.'); return; }

            const btnTxt = document.getElementById('btn-import-fallo-txt');
            const statusEl = document.getElementById('import-fallo-status');
            btnTxt.textContent = '⏳ Analizando con IA...';
            statusEl.style.display = 'block';
            statusEl.style.background = '#eff6ff';
            statusEl.style.color = '#1e40af';
            statusEl.style.borderLeft = '3px solid #3b82f6';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gemini está procesando el fallo...';

            try {
                const prompt = `Analiza el siguiente texto de una resolución o sentencia judicial chilena y extrae los datos en formato JSON estricto.
Responde SOLO con el JSON, sin texto adicional, sin backticks, sin markdown.

Campos requeridos:
{
  "tribunal": "nombre del tribunal",
  "rol": "ROL o RIT del caso",
  "fecha": "YYYY-MM-DD o cadena de fecha",
  "materia": "materia o rama del derecho (Civil, Laboral, Familia, Penal, Constitucional, etc.)",
  "procedimiento": "tipo de procedimiento",
  "tendencia": "Favorable (para demandante) | Desfavorable | Neutra",
  "nivelRelevancia": "Alta | Media | Baja",
  "temaCentral": "resumen del tema jurídico central en 1-2 oraciones",
  "holding": "criterio jurídico o doctrina establecida en el fallo, máx 3 oraciones",
  "palabrasClave": ["término1", "término2", "término3", "término4", "término5"]
}

Si algún campo no puede determinarse del texto, usa "No especificado".

TEXTO DEL FALLO:
${texto.substring(0, 8000)}`;

                const resultado = await geminiCall(prompt);
                let datos;
                try {
                    // Limpiar posibles backticks que Gemini pueda agregar igualmente
                    const limpio = resultado.replace(/```json|```/g, '').trim();
                    datos = JSON.parse(limpio);
                } catch (parseErr) {
                    throw new Error('Gemini no devolvió JSON válido. Intente con un texto más claro o extracto del fallo.');
                }

                // Indexar en DB
                DB.jurisprudencia.push({
                    id: uid(),
                    rol: datos.rol || 'No especificado',
                    materia: datos.materia || 'Civil',
                    procedimiento: datos.procedimiento || '',
                    temaCentral: datos.temaCentral || '',
                    holding: datos.holding || '',
                    tendencia: datos.tendencia || 'Neutra',
                    nivelRelevancia: datos.nivelRelevancia || 'Media',
                    palabrasClave: datos.palabrasClave || [],
                    asociadaACausas: [],
                    fechaFallo: datos.fecha || '',
                    importadoConIA: true,
                    ext: datos.temaCentral || ''
                });
                if (typeof markAppDirty === "function") markAppDirty(); guardarDB();
                uiRenderJurisprudenciaAvanzada();
                renderAll();

                statusEl.style.background = '#f0fdf4';
                statusEl.style.color = '#14532d';
                statusEl.style.borderLeft = '3px solid #22c55e';
                statusEl.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Fallo indexado correctamente.</strong><br>
                    <small>ROL: ${datos.rol} · Tribunal: ${datos.tribunal} · Tendencia: ${datos.tendencia}</small><br>
                    <small style="color:#78350f; font-style:italic;">⚠️ Verifique los datos extraídos con el documento original.</small>`;
                document.getElementById('import-fallo-texto').value = '';
                registrarEvento(`Fallo importado con IA: ROL ${datos.rol} — ${datos.tribunal}`);
            } catch (e) {
                const msg = e.message || '';
                const es429 = e.status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('cuota');
                statusEl.style.background = es429 ? '#fffbeb' : '#fef2f2';
                statusEl.style.color = es429 ? '#92400e' : '#991b1b';
                statusEl.style.borderLeft = `3px solid ${es429 ? '#f59e0b' : '#ef4444'}`;
                statusEl.innerHTML = es429
                    ? `<i class="fas fa-exclamation-triangle"></i> <strong>Cuota de API excedida (429).</strong><br>
                       <small>Su proyecto no tiene cuota asignada. Active facturación en Google Cloud Console y verifique que "Generative Language API" esté habilitada.</small>`
                    : `<i class="fas fa-times-circle"></i> Error: ${msg}`;
            } finally {
                btnTxt.textContent = 'Analizar con IA e Indexar';
            }
        }

        // ── Exportar Plazos a ICS ─────────────────────────────────────────
        function exportarCalendarioICS() {
            const alertas = DB.alertas.filter(a => a.estado === 'activa' && a.fechaObjetivo);
            if (!alertas.length) {
                showWarning('No hay plazos activos con fecha para exportar.');
                return;
            }

            function toICSDate(dateStr) {
                // Convierte YYYY-MM-DD a YYYYMMDD
                return dateStr.replace(/-/g, '');
            }

            function escICS(str) {
                return (str || '').replace(/[\\;,]/g, s => '\\' + s).replace(/\n/g, '\\n');
            }

            let ics = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//AppBogado//Sistema Legal//ES',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:AppBogado — Plazos Judiciales',
                'X-WR-TIMEZONE:America/Santiago',
            ];

            alertas.forEach(a => {
                const causa = DB.causas.find(c => c.id === a.causaId);
                const fechaStr = toICSDate(a.fechaObjetivo);
                const prioridadEmoji = { critica: '🔴', alta: '🟠', media: '🟡', baja: '🟢' }[a.prioridad] || '⚖️';
                const summary = `${prioridadEmoji} ${a.mensaje}${causa ? ' · ' + causa.caratula : ''}`;
                const uid = `appbogado-${a.id}-${Date.now()}@appbogado.cl`;

                ics.push('BEGIN:VEVENT');
                ics.push(`UID:${uid}`);
                ics.push(`DTSTART;VALUE=DATE:${fechaStr}`);
                ics.push(`DTEND;VALUE=DATE:${fechaStr}`);
                ics.push(`SUMMARY:${escICS(summary)}`);
                ics.push(`DESCRIPTION:${escICS(
                    (causa ? 'Causa: ' + causa.caratula + '\\n' : '') +
                    'Tipo: ' + (a.tipo || 'Procesal') + '\\n' +
                    'Prioridad: ' + (a.prioridad || 'media') + '\\n' +
                    'Generado por AppBogado v3.9.5'
                )}`);
                ics.push(`CATEGORIES:${escICS(a.tipo || 'PLAZO')}`);
                ics.push(`PRIORITY:${a.prioridad === 'critica' ? 1 : a.prioridad === 'alta' ? 3 : a.prioridad === 'media' ? 5 : 7}`);
                // Alarma 2 días antes
                ics.push('BEGIN:VALARM');
                ics.push('ACTION:DISPLAY');
                ics.push(`DESCRIPTION:Recordatorio: ${escICS(a.mensaje)}`);
                ics.push('TRIGGER:-P2D');
                ics.push('END:VALARM');
                ics.push('END:VEVENT');
            });

            ics.push('END:VCALENDAR');
            const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `AppBogado_Plazos_${new Date().toISOString().split('T')[0]}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            registrarEvento(`Calendario ICS exportado: ${alertas.length} plazos.`);
        }

        // ── Cargar key al navegar a config-ia ─────────────────────────────
        // ── Inicialización Única ──────────────────────────────────────────
        document.addEventListener('DOMContentLoaded', async () => {
            setupEventListeners();
            await init();

            // ── Exponer funciones UI de escritos en window ────────────────
            // Necesario porque están en closure y son llamadas desde onclick en HTML.
            // 11b-escritos-ui.js sobreescribe uiGuardarEscrito con versión extendida.
            window.uiGuardarEscrito   = uiGuardarEscrito;
            window.uiExportarEscrito  = uiExportarEscrito;
            window.uiCopiarEscrito    = uiCopiarEscrito;
        });

        // ══════════════════════════════════════════════════════════════════
        // MÓDULO DE AUTENTICACIÓN — Inicialización limpia al cargar la página
        // ══════════════════════════════════════════════════════════════════

        // ── Asegurar usuarios demo al arrancar ─────────────────────────────
        (async function _seedDemoUsers() {
            try {
                const h123 = await _hash('admin123');
                const habo = await _hash('abogado123');
                const hasi = await _hash('asistente123');
                const hlec = await _hash('lector123');

                const DEMO = [
                    { id: 1, nombre: 'Administrador', usuario: 'admin', passwordHash: h123, rol: 'admin', color: '#1a3a6b', activo: true },
                    { id: 10, nombre: 'Carlos Abogado', usuario: 'abogado', passwordHash: habo, rol: 'abogado', color: '#0d7a5f', activo: true },
                    { id: 11, nombre: 'Ana Asistente', usuario: 'asistente', passwordHash: hasi, rol: 'asistente', color: '#7c3aed', activo: true },
                    { id: 12, nombre: 'Luis Lector', usuario: 'lector', passwordHash: hlec, rol: 'readonly', color: '#b45309', activo: true },
                ];
                let lista = [];
                try { lista = JSON.parse(localStorage.getItem('APPBOGADO_USERS_V2')) || []; } catch (e) { lista = []; }
                let changed = false;
                DEMO.forEach(d => {
                    if (!lista.find(u => u.usuario === d.usuario)) {
                        lista.push({ ...d, fechaCreacion: new Date().toISOString() });
                        changed = true;
                    }
                });
                if (changed) { try { localStorage.setItem('APPBOGADO_USERS_V2', JSON.stringify(lista)); } catch(e) { console.warn('[LS] APPBOGADO_USERS_V2', e.message); } }
            } catch (e) { console.error('[Auth] Error sembrando usuarios demo:', e); }
        })();

        // Login se inicializa desde el DOMContentLoaded principal en el módulo de autenticación

        // ══════════════════════════════════════════════════════════════════
        // SISTEMA DE NOTIFICACIONES TOAST — reemplaza alert() nativo
        // ══════════════════════════════════════════════════════════════════
        function _toast(msg, type, duration) {
            const icons = { error: 'fa-times-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
            const container = document.getElementById('toast-container');
            if (!container) { console.warn('[Toast]', type, msg); return; }

            const el = document.createElement('div');
            el.className = `toast toast-${type}`;
            el.innerHTML = `
                <i class="fas ${icons[type] || 'fa-info-circle'} toast-icon"></i>
                <div class="toast-body">${msg}</div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>`;

            container.appendChild(el);

            const remove = () => {
                el.classList.add('toast-out');
                el.addEventListener('animationend', () => el.remove(), { once: true });
            };
            const timer = setTimeout(remove, duration || 4000);
            el.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timer); remove(); }, { once: true });
        }

        /**
         * Muestra un toast de error (rojo) visible 5 segundos.
         * @param {string} msg - Mensaje a mostrar al usuario.
         */
        function showError(msg) { _toast(msg, 'error', 5000); }
        /**
         * Muestra un toast de éxito (verde) visible 3.5 segundos.
         * @param {string} msg - Mensaje a mostrar al usuario.
         */
        function showSuccess(msg) { _toast(msg, 'success', 3500); }
        function showWarning(msg) { _toast(msg, 'warning', 4500); }
        /**
         * Muestra un toast informativo (azul) visible 4 segundos.
         * @param {string} msg - Mensaje a mostrar al usuario.
         */
        function showInfo(msg) { _toast(msg, 'info', 4000); }

        // ══ FIN SISTEMA DE NOTIFICACIONES ══════════════════════════════════

        // ══ FIN MÓDULO DE AUTENTICACIÓN ════════════════════════════════════


        // NOTA: toggleLexBot() y lexbotRun() v1 eliminados (código muerto tras eliminar LexBot).
        // La implementación activa vive en 14-features-v8.js (lexbotRun v2 con
        // contexto de causa y soporte multi-proveedor vía iaCall).

