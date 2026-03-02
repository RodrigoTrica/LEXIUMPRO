// ████████████████████████████████████████████████████████████████████
// JS — MÓDULO 17: CLAUDE LEGAL — INTEGRACIÓN IA JURÍDICA COMPLETA
//
// FUNCIONALIDADES:
//   1. Asistente flotante global (LexBot) — chat con contexto completo
//   2. Análisis IA de causa individual — diagnóstico + riesgo + estrategia
//   3. Análisis de jurisprudencia — extracción automática de holding
//   4. Panel IA en Estrategia Pro — análisis profundo con Claude
//
// DEPENDENCIAS: 12-ia-providers.js (iaCall, iaGetProvider, iaGetKey)
// ████████████████████████████████████████████████████████████████████

// ═══════════════════════════════════════════════════════════════════
// UTILIDAD — _clEscHtml (FIX Problema 4: previene XSS de respuestas IA)
// Reemplaza el patrón `escHtml ? escHtml(x) : x` — escape siempre garantizado.
// ═══════════════════════════════════════════════════════════════════
function _clEscHtml(s) {
    if (typeof s !== 'string') return String(s == null ? '' : s);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function _clFmtVal(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(x => _clFmtVal(x)).filter(Boolean).join(' · ');
    try { return JSON.stringify(v); } catch (e) { return String(v); }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 1 — CONTEXTO DEL DESPACHO (se inyecta en todos los prompts)
// ═══════════════════════════════════════════════════════════════════

function clBuildContext(opts = {}) {
    const causas = (DB.causas || []);
    const clientes = (DB.clientes || []);
    const juris = (DB.jurisprudencia || []);
    const tramites = (() => { try { return JSON.parse(localStorage.getItem('APPBOGADO_TRAMITES_V1')) || []; } catch (e) { return []; } })();
    const doctrina = (() => { try { return JSON.parse(localStorage.getItem('APPBOGADO_DOCTRINA_V1')) || []; } catch (e) { return []; } })();

    const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let ctx = `=== SISTEMA: LEXIUM — ASISTENTE JURÍDICO IA ===
Fecha actual: ${hoy}
Jurisdicción: Chile (Derecho chileno)
Rol: Eres un asistente jurídico especializado en derecho chileno.
     Apoyas a abogados con análisis procesal, estrategia y redacción jurídica.
     Siempre citas normativa chilena aplicable (Código Civil, CPC, CPP, CT, etc.)
     Eres preciso, conciso y orientado a la acción práctica.

=== DATOS DEL DESPACHO ===
Causas activas: ${causas.filter(c => c.estadoGeneral !== 'Finalizada').length} de ${causas.length} total
Clientes: ${clientes.length}
Jurisprudencia indexada: ${juris.length} sentencias
Trámites administrativos: ${tramites.length}
Doctrina cargada: ${doctrina.length} textos
`;

    if (opts.causas && causas.length) {
        ctx += `\n=== CARTERA DE CAUSAS ===\n`;
        causas.slice(0, 20).forEach(c => {
            const etapasPend = (c.etapasProcesales || []).filter(e => !e.completada).length;
            const riesgoMax = Object.values(c.riesgo || {}).includes('Alto') ? '🔴 ALTO'
                : Object.values(c.riesgo || {}).includes('Medio') ? '🟡 MEDIO' : '🟢 BAJO';
            ctx += `- [${c.id}] ${c.caratula} | ${c.rama || 'Civil'} | ${c.estadoGeneral || 'En tramitación'} | Avance: ${c.porcentajeAvance || 0}% | Riesgo: ${riesgoMax} | Etapas pend.: ${etapasPend}\n`;
        });
    }

    if (opts.juris && juris.length) {
        ctx += `\n=== JURISPRUDENCIA INDEXADA ===\n`;
        juris.slice(0, 15).forEach(j => {
            ctx += `- ${j.tribunal} Rol ${j.rol} | ${j.materia} | Tendencia: ${j.tendencia} | Relevancia: ${j.nivelRelevancia}\n`;
            if (j.temaCentral) ctx += `  Tema: ${j.temaCentral}\n`;
        });
    }

    if (opts.tramites && tramites.length) {
        ctx += `\n=== TRÁMITES ADMINISTRATIVOS ===\n`;
        tramites.filter(t => !['resuelto', 'archivado'].includes(t.estado)).slice(0, 10).forEach(t => {
            const dias = t.fechaLimite ? Math.round((new Date(t.fechaLimite) - new Date()) / 86400000) : null;
            ctx += `- ${t.organismo}: ${t.tipo} | ${t.caratula} | Estado: ${t.estado}${dias !== null ? ` | Vence en: ${dias}d` : ''}n`;
        });
    }

    return ctx;
}

function clBuildCausaContext(causaId) {
    const causa = DB.causas.find(c => c.id == causaId);
    if (!causa) return '';
    const cliente = DB.clientes.find(c => c.id === causa.clienteId);
    const etapas = causa.etapasProcesales || [];
    const docs = causa.documentos || [];
    const tareas = causa.tareas || [];
    const jurisAsoc = (DB.jurisprudencia || []).filter(j => j.causaAsociada == causaId || causa.jurisprudenciaIds?.includes(j.id));

    const hechosTxt = _clFmtVal(causa.hechos || causa.descripcion || 'No especificados.');
    const estrategiaBase = (causa.estrategia && typeof causa.estrategia === 'object')
        ? (causa.estrategia.descripcion || causa.estrategia.detalle || causa.estrategia.resumen || causa.estrategia)
        : (causa.estrategia || 'No definida.');
    const estrategiaTxt = _clFmtVal(estrategiaBase) || 'No definida.';
    const riesgoTxt = (Object.entries(causa.riesgo || {}).map(([k, v]) => `  ${k}: ${_clFmtVal(v) || v}`).join('\n')) || 'Sin evaluación.';

    return `
=== CAUSA EN ANÁLISIS ===
Carátula: ${causa.caratula}
RIT/RUC: ${causa.rut || 'N/D'}
Cliente: ${cliente?.nombre || causa.cliente || 'N/D'}
Procedimiento: ${causa.tipoProcedimiento || 'Ordinario'}
Rama: ${causa.rama || 'Civil'}
Instancia: ${causa.instancia || 'Primera'}
Tribunal: ${causa.tribunal || 'N/D'}
Estado: ${causa.estadoGeneral || 'En tramitación'}
Avance: ${causa.porcentajeAvance || 0}%
Fecha inicio: ${causa.fechaIngreso || 'N/D'}
Monto controversia: ${causa.montoControversia ? '$' + Number(causa.montoControversia).toLocaleString('es-CL') : 'N/D'}

Hechos / Objeto del litigio:
${hechosTxt}

Estrategia definida:
${estrategiaTxt}

Etapas procesales (${etapas.filter(e => e.completada).length}/${etapas.length} completadas):
${etapas.map(e => `  [${e.completada ? '✓' : '○'}] ${e.nombre}${e.fecha ? ' — ' + new Date(e.fecha).toLocaleDateString('es-CL') : ''}`).join('\n') || 'Sin etapas.'}

Evaluación de riesgo:
${riesgoTxt}

Documentos asociados: ${docs.length}
Tareas pendientes: ${tareas.filter(t => !t.done).length}
Jurisprudencia asociada: ${jurisAsoc.length} sentencias
${jurisAsoc.map(j => `  - ${j.tribunal} Rol ${j.rol}: ${j.tendencia}`).join('\n')}

Observaciones:
${causa.observaciones || 'Sin observaciones.'}`;
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 2 — ASISTENTE FLOTANTE GLOBAL (LEXBOT)
// ═══════════════════════════════════════════════════════════════════

let _clChatHistory = [];   // [{role, content}]
let _clChatCausaId = null; // Si fue abierto desde una causa
let _clChatOpen = false;

function clInyectarBotonFlotante() {
    if (document.getElementById('cl-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'cl-fab';
    fab.title = 'Abrir Bot AI — Asistente Jurídico IA';
    fab.innerHTML = `<span class="cl-fab-icon">⚖</span><span class="cl-fab-label">Bot AI</span>`;
    fab.onclick = () => clToggleChat();
    document.body.appendChild(fab);
}

function clToggleChat(causaId) {
    if (causaId) _clChatCausaId = causaId;
    _clChatOpen = !_clChatOpen;
    const panel = document.getElementById('cl-chat-panel');
    if (_clChatOpen) {
        if (!panel) clCrearChatPanel();
        else document.getElementById('cl-chat-panel').classList.add('open');
        setTimeout(() => document.getElementById('cl-chat-input')?.focus(), 100);
    } else {
        panel?.classList.remove('open');
    }
}

// Punto de entrada principal: abre el chat IA desde el detalle de una causa.
// Si 14-features-v8.js está cargado, delega primero la inyección de contexto
// en la UI del LexBot legacy (_lexbotCargarContextoUI), luego abre el panel.
function lexbotAbrirConCausa(causaId) {
    _clChatCausaId = causaId;
    _clChatHistory = [];
    _clChatOpen = false;
    // Inyectar badge + historial en UI legacy si el módulo v8 está disponible
    if (typeof _lexbotCargarContextoUI === 'function') {
        _lexbotCargarContextoUI(causaId);
    }
    clToggleChat(causaId);
}

function clCrearChatPanel() {
    const provider = typeof IA_PROVIDERS !== 'undefined' ? IA_PROVIDERS[iaGetProvider()]?.label : 'IA';
    // FIX Problema 1: iaGetKey es async — no usar síncronamente.
    // El banner de key faltante se resuelve de forma async (ver bloque al final de esta función).
    const causa = _clChatCausaId ? DB.causas.find(c => c.id == _clChatCausaId) : null;

    const panel = document.createElement('div');
    panel.id = 'cl-chat-panel';
    panel.classList.add('open');
    panel.innerHTML = `
            <div class="cl-chat-header">
                <div class="cl-chat-header-left">
                    <span class="cl-chat-icon">⚖</span>
                    <div>
                        <div class="cl-chat-title">Bot AI</div>
                        <div class="cl-chat-subtitle">${provider} · Asistente Jurídico IA</div>
                    </div>
                </div>
                <div class="cl-chat-header-actions">
                    <button class="cl-hdr-btn" onclick="clLimpiarChat()" title="Nueva conversación">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="cl-hdr-btn" onclick="clToggleChat()" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            ${causa ? `
            <div class="cl-causa-chip">
                <i class="fas fa-gavel"></i>
                <span>Contexto: <strong>${causa.caratula.substring(0, 45)}${causa.caratula.length > 45 ? '…' : ''}</strong></span>
                <button onclick="_clChatCausaId=null; clActualizarCausaChip()" title="Quitar contexto">×</button>
            </div>` : `<div id="cl-causa-chip-wrap"></div>`}

            <div id="cl-no-key-warn-slot"></div>

            <div class="cl-chat-messages" id="cl-chat-messages">
                <div class="cl-msg cl-msg-ai">
                    <div class="cl-msg-avatar">⚖</div>
                    <div class="cl-msg-bubble">
                        <p>Hola. Soy <strong>Bot AI</strong>, tu asistente jurídico con acceso completo a tu despacho.</p>
                        ${causa ? `<p>Estoy viendo la causa <strong>${causa.caratula}</strong>. ¿Qué necesitas analizar?</p>` : ''}
                        <p>Puedo ayudarte con:</p>
                        <div class="cl-sugerencias">
                            ${(causa ? [
            `Analiza el estado procesal de esta causa`,
            `¿Cuál es el riesgo principal de esta causa?`,
            `Sugiere la estrategia óptima para este caso`,
            `¿Qué jurisprudencia aplica aquí?`,
        ] : [
            `¿Cuáles son mis causas de mayor riesgo?`,
            `Resume el estado de todos mis trámites pendientes`,
            `¿Qué causas tienen plazos próximos a vencer?`,
            `Analiza mi cartera y sugiere prioridades`,
        ]).map(s => `<button class="cl-sug-btn" onclick="clEnviarSugerencia('${s.replace(/'/g, "\\'")}')">
                                ${s}
                            </button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="cl-chat-footer">
                <div class="cl-input-wrap">
                    <textarea id="cl-chat-input" class="cl-chat-input"
                        placeholder="Pregunta algo jurídico…"
                        rows="1"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();clEnviar();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                    <button class="cl-send-btn" onclick="clEnviar()" id="cl-send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="cl-footer-note">Shift+Enter para salto de línea · Respuestas orientativas, no reemplazan asesoría legal</div>
            </div>`;

    document.body.appendChild(panel);

    // FIX Problema 1: resolver iaGetKey async e inyectar warning si no hay key
    if (typeof iaGetKey === 'function') {
        Promise.resolve(iaGetKey(iaGetProvider())).then(function (k) {
            var slot = document.getElementById('cl-no-key-warn-slot');
            if (!k && slot) {
                slot.innerHTML = '<div class="cl-no-key-warn">'
                    + '<i class="fas fa-key"></i>'
                    + '<div><strong>Configura tu API Key</strong><br>'
                    + 'Ve a <em>Sistema &rarr; Configurar IA</em> y selecciona el proveedor.<br>'
                    + '<a href="https://console.anthropic.com/settings/keys" target="_blank">Obtener key Anthropic &rarr;</a>'
                    + '</div></div>';
            }
        });
    }
}

function clActualizarCausaChip() {
    const wrap = document.getElementById('cl-causa-chip-wrap');
    if (wrap) wrap.innerHTML = '';
}

function clLimpiarChat() {
    _clChatHistory = [];
    const msgs = document.getElementById('cl-chat-messages');
    if (msgs) msgs.innerHTML = `
            <div class="cl-msg cl-msg-ai">
                <div class="cl-msg-avatar">⚖</div>
                <div class="cl-msg-bubble"><p>Nueva conversación iniciada. ¿En qué te ayudo?</p></div>
            </div>`;
}

function clEnviarSugerencia(texto) {
    const input = document.getElementById('cl-chat-input');
    if (input) input.value = texto;
    clEnviar();
}

async function clEnviar() {
    const input = document.getElementById('cl-chat-input');
    const texto = input?.value?.trim();
    if (!texto) return;

    input.value = '';
    input.style.height = 'auto';

    const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
    // FIX Problema 1: iaGetKey es async 2014 await obligatorio
    const key = typeof iaGetKey === 'function' ? await iaGetKey(pid) : null;
    if (!key) {
        clAgregarMensaje('ai', '⚠ No hay API Key configurada. Ve a **Sistema → Configurar IA** para agregar tu key de Claude o Gemini.');
        return;
    }

    clAgregarMensaje('user', texto);
    _clChatHistory.push({ role: 'user', content: texto });

    // Indicador de escritura
    const typingId = 'cl-typing-' + Date.now();
    clAgregarMensaje('ai', '<span class="cl-typing"><span></span><span></span><span></span></span>', typingId);

    const btn = document.getElementById('cl-send-btn');
    if (btn) btn.disabled = true;

    try {
        // Construir prompt con contexto
        const hayContextoCausa = !!_clChatCausaId;
        const context = clBuildContext({
            causas: true,
            juris: true,
            tramites: hayContextoCausa ? false : true,
        });
        const causaCtx = hayContextoCausa ? clBuildCausaContext(_clChatCausaId) : '';

        // Historial de conversación (últimos 6 turnos)
        const historialStr = _clChatHistory.slice(-6, -1).map(m =>
            `${m.role === 'user' ? 'ABOGADO' : 'CLAUDE'}: ${m.content}`
        ).join('\n\n');

        const prompt = `${context}
${causaCtx}

${historialStr ? `=== CONVERSACIÓN PREVIA ===\n${historialStr}\n` : ''}
=== PREGUNTA ACTUAL ===
ABOGADO: ${texto}

CLAUDE LEGAL (responde en español, de forma precisa y práctica, citando normativa chilena cuando sea relevante. Si es análisis de riesgo, usa formato claro con niveles. Si es estrategia, da pasos concretos. Máximo 400 palabras salvo que se pida más detalle):`;

        const respuesta = await iaCall(prompt);

        // Eliminar indicador de escritura
        document.getElementById(typingId)?.remove();

        _clChatHistory.push({ role: 'assistant', content: respuesta });
        clAgregarMensaje('ai', clFormatearRespuesta(respuesta));

    } catch (e) {
        document.getElementById(typingId)?.remove();
        clAgregarMensaje('ai', `⚠ Error: ${e.message}`);
    } finally {
        if (btn) btn.disabled = false;
        input?.focus();
    }
}

function clAgregarMensaje(role, html, id) {
    const msgs = document.getElementById('cl-chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    if (id) div.id = id;
    div.className = `cl-msg cl-msg-${role}`;
    div.innerHTML = role === 'user'
        ? `<div class="cl-msg-bubble cl-msg-user-bubble">${_clEscHtml(html)}</div>`
        : `<div class="cl-msg-avatar">⚖</div><div class="cl-msg-bubble">${html}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function clFormatearRespuesta(texto) {
    // Convertir Markdown básico a HTML
    return texto
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h3>$1</h3>')
        .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[hul])(.+)$/gm, '$1')
        .replace(/^/, '<p>').replace(/$/, '</p>')
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<[hul])/g, '$1')
        .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 3 — ANÁLISIS IA DE CAUSA INDIVIDUAL
// ═══════════════════════════════════════════════════════════════════

async function clAnalizarCausa(causaId) {
    const causa = DB.causas.find(c => c.id == causaId);
    if (!causa) return;

    const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
    // FIX Problema 1: iaGetKey es async 2014 await obligatorio
    const key = typeof iaGetKey === 'function' ? await iaGetKey(pid) : null;
    if (!key) {
        showError('Configura tu API Key en Sistema → Configurar IA');
        return;
    }

    // Crear o actualizar el panel de análisis en el detalle de causa
    let panel = document.getElementById('cl-causa-analysis-panel');
    if (!panel) {
        // Inyectar en el detalle de causa
        const dcLayout = document.querySelector('.dc-layout');
        if (!dcLayout) return;
        panel = document.createElement('div');
        panel.id = 'cl-causa-analysis-panel';
        panel.className = 'cl-analysis-panel';
        dcLayout.insertAdjacentElement('afterend', panel);
    }

    panel.innerHTML = `
            <div class="cl-analysis-header">
                <span>⚖ Análisis Bot AI</span>
                <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
            </div>
            <div class="cl-analysis-loading">
                <div class="cl-spinner"></div>
                <span>Analizando causa con ${IA_PROVIDERS[pid]?.label || 'IA'}…</span>
            </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const ctx = clBuildContext({ juris: true });
        const causaCtx = clBuildCausaContext(causaId);
        const prompt = `${ctx}
${causaCtx}

=== INSTRUCCIÓN ===
Realiza un análisis jurídico completo y accionable de esta causa. Estructura tu respuesta EXACTAMENTE así:

**DIAGNÓSTICO PROCESAL**
[Estado actual, etapas completadas vs. pendientes, observaciones sobre el avance]

**EVALUACIÓN DE RIESGO**
- Riesgo procesal: [Bajo/Medio/Alto] — [razón]
- Riesgo probatorio: [Bajo/Medio/Alto] — [razón]
- Riesgo de prescripción/caducidad: [Bajo/Medio/Alto] — [razón]
- Riesgo económico: [Bajo/Medio/Alto] — [razón]

**FORTALEZAS DE LA POSICIÓN**
[Argumentos sólidos, evidencia favorable, precedentes útiles]

**PUNTOS DÉBILES Y ALERTAS**
[Vulnerabilidades, gaps probatorios, plazos críticos]

**ESTRATEGIA RECOMENDADA**
[Pasos concretos y priorizados, tácticas procesales específicas para esta causa]

**NORMATIVA APLICABLE**
[Artículos específicos del Código Civil, CPC, CT u otras normas chilenas relevantes]

**PRÓXIMAS ACCIONES URGENTES**
1. [Acción concreta — plazo]
2. [Acción concreta — plazo]
3. [Acción concreta — plazo]

Sé específico con los datos de esta causa. No des respuestas genéricas.`;

        const respuesta = await iaCall(prompt);
        panel.innerHTML = `
                <div class="cl-analysis-header">
                    <span>⚖ Análisis Bot AI — <em>${_clEscHtml(causa.caratula.substring(0, 50))}</em></span>
                    <div style="display:flex;gap:8px;">
                        <button onclick="clCopiarAnalisis()" class="cl-hdr-btn" title="Copiar"><i class="fas fa-copy"></i></button>
                        <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
                    </div>
                </div>
                <div class="cl-analysis-body" id="cl-analysis-body">
                    ${clFormatearRespuesta(respuesta)}
                </div>
                <div class="cl-analysis-footer">
                    <span><i class="fas fa-info-circle"></i> Análisis generado con ${IA_PROVIDERS[pid]?.label || 'IA'}. Revisar antes de actuar.</span>
                    <button class="cl-btn-reanalizar" onclick="clAnalizarCausa(${causaId})">
                        <i class="fas fa-redo"></i> Re-analizar
                    </button>
                </div>`;

    } catch (e) {
        panel.innerHTML = `
                <div class="cl-analysis-header"><span>⚖ Análisis Bot AI</span>
                    <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
                </div>
                <div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
    }
}

function clCopiarAnalisis() {
    const body = document.getElementById('cl-analysis-body');
    if (!body) return;
    navigator.clipboard?.writeText(body.innerText).then(() => {
        if (typeof showInfo === 'function') showInfo('Análisis copiado al portapapeles');
    });
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 4 — ANÁLISIS DE JURISPRUDENCIA CON IA
// ═══════════════════════════════════════════════════════════════════

async function clAnalizarJurisprudencia(jurisId) {
    const j = DB.jurisprudencia.find(j => j.id == jurisId);
    if (!j) return;

    const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
    // FIX Problema 1: iaGetKey es async 2014 await obligatorio
    const key = typeof iaGetKey === 'function' ? await iaGetKey(pid) : null;
    if (!key) { showError('Configura tu API Key en Sistema → Configurar IA'); return; }

    const modal = document.createElement('div');
    modal.id = 'cl-juris-modal';
    modal.className = 'cl-modal-overlay';
    modal.innerHTML = `
            <div class="cl-modal">
                <div class="cl-modal-header">
                    <span>⚖ Análisis Jurisprudencial</span>
                    <button onclick="document.getElementById('cl-juris-modal').remove()" class="cl-hdr-btn">×</button>
                </div>
                <div class="cl-modal-body">
                    <div class="cl-analysis-loading">
                        <div class="cl-spinner"></div>
                        <span>Analizando sentencia con IA…</span>
                    </div>
                </div>
            </div>`;
    document.body.appendChild(modal);

    try {
        const causasRelevantes = (DB.causas || []).filter(c =>
            (c.rama || '').toLowerCase().includes((j.materia || '').toLowerCase().substring(0, 5)) ||
            (c.tipoProcedimiento || '').toLowerCase().includes((j.materia || '').toLowerCase().substring(0, 5))
        );

        const prompt = `${clBuildContext({})}

=== SENTENCIA A ANALIZAR ===
Tribunal: ${j.tribunal}
Rol: ${j.rol}
Materia: ${j.materia}
Fecha: ${j.fecha || 'N/D'}
Procedimiento: ${j.procedimiento || 'N/D'}
Tema central: ${j.temaCentral || 'N/D'}
Tendencia: ${j.tendencia}
Nivel de relevancia: ${j.nivelRelevancia}
Palabras clave: ${(j.palabrasClave || []).join(', ')}

CAUSAS DEL DESPACHO POSIBLEMENTE RELACIONADAS:
${causasRelevantes.map(c => `- ${c.caratula} (${c.rama}, ${c.estadoGeneral})`).join('\n') || 'Ninguna identificada automáticamente.'}

=== INSTRUCCIÓN ===
Analiza esta sentencia y entrega:

**HOLDING PRINCIPAL**
[La regla jurídica que establece el fallo en 2-3 oraciones]

**RATIO DECIDENDI**
[Razonamiento jurídico que sostiene la decisión]

**RELEVANCIA PARA EL DESPACHO**
[Cómo puede afectar o beneficiar las causas activas del abogado]

**CÓMO CITAR ESTE FALLO**
[Forma precisa de citarlo en escritos y recursos]

**APLICACIÓN PRÁCTICA**
[En qué tipo de casos conviene usar este precedente y cómo]

**OBITER DICTA RELEVANTES**
[Comentarios del tribunal con valor orientador]`;

        const resp = await iaCall(prompt);
        modal.querySelector('.cl-modal-body').innerHTML = `
                <div class="cl-juris-meta">
                    <strong>${j.tribunal}</strong> · Rol ${j.rol}<br>
                    <span class="badge ${j.tendencia === 'Favorable' ? 'badge-s' : j.tendencia === 'Desfavorable' ? 'badge-d' : 'badge-a'}">${j.tendencia}</span>
                    <span style="margin-left:8px;font-size:12px;color:var(--text-3);">${j.materia}</span>
                </div>
                <div class="cl-analysis-body">${clFormatearRespuesta(resp)}</div>`;
    } catch (e) {
        modal.querySelector('.cl-modal-body').innerHTML = `<div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 5 — ANÁLISIS ESTRATÉGICO CON IA (Estrategia Pro)
// ═══════════════════════════════════════════════════════════════════

async function clAnalizarEstrategiaPro(causaId) {
    const causa = DB.causas.find(c => c.id == causaId);
    if (!causa) { showError('Selecciona una causa primero.'); return; }

    const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
    // FIX Problema 1: iaGetKey es async 2014 await obligatorio
    const key = typeof iaGetKey === 'function' ? await iaGetKey(pid) : null;
    if (!key) { showError('Configura tu API Key en Sistema → Configurar IA'); return; }

    const contenedor = document.getElementById('analisisEstrategico');
    if (!contenedor) return;

    contenedor.innerHTML = `
            <div class="cl-ep-loading">
                <div class="cl-spinner"></div>
                <span>Claude está elaborando la estrategia legal para esta causa…</span>
            </div>`;

    try {
        const ctx = clBuildContext({ juris: true });
        const causaCtx = clBuildCausaContext(causaId);

        const prompt = `${ctx}
${causaCtx}

=== INSTRUCCIÓN: ANÁLISIS ESTRATÉGICO PROFUNDO ===
Eres un litigante experto en derecho chileno. Analiza esta causa y entrega un plan estratégico completo:

**1. DIAGNÓSTICO ESTRATÉGICO**
[Posición actual del cliente, ventajas comparativas frente a la contraparte]

**2. TEORÍA DEL CASO**
[Narrativa jurídica que el abogado debe sostener en juicio]

**3. MAPA DE RIESGOS**
Señala para cada dimensión: nivel y cómo mitigarlo
- Riesgo procesal:
- Riesgo probatorio:
- Riesgo de prescripción/caducidad:
- Riesgo de condena en costas:
- Riesgo reputacional:

**4. PLAN DE ACCIÓN (90 días)**
Semanas 1-2: [Acciones urgentes]
Semanas 3-6: [Acciones de desarrollo]
Semanas 7-12: [Acciones de consolidación]

**5. ESTRATEGIA PROBATORIA**
[Pruebas clave a obtener, testigos, peritos, documentos]

**6. ARGUMENTOS JURÍDICOS PRINCIPALES**
[Con cita de artículos específicos y jurisprudencia relevante del despacho]

**7. CONTRAARGUMENTOS ESPERADOS Y RESPUESTAS**
[Qué alegará la contraparte y cómo rebatirlo]

**8. ESCENARIOS Y PROBABILIDADES**
- Escenario favorable: [probabilidad estimada + condiciones]
- Escenario neutro (acuerdo): [probabilidad + términos razonables]
- Escenario adverso: [probabilidad + mitigación]

**9. RECOMENDACIÓN FINAL**
[Acción estratégica más importante que el abogado debe ejecutar esta semana]

Sé específico. Cita normativa chilena aplicable. Evita generalidades.`;

        const resp = await iaCall(prompt);

        contenedor.innerHTML = `
                <div class="cl-ep-header">
                    <span>⚖ Análisis Estratégico Bot AI</span>
                    <div style="display:flex;gap:8px;">
                        <button onclick="navigator.clipboard?.writeText(document.getElementById('cl-ep-body').innerText).then(()=>showInfo('Copiado'))" class="cl-hdr-btn" title="Copiar">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="clAnalizarEstrategiaPro(${causaId})" class="cl-hdr-btn" title="Re-analizar">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>
                <div class="cl-ep-body" id="cl-ep-body">${clFormatearRespuesta(resp)}</div>
                <div class="cl-ep-footer">
                    <i class="fas fa-robot"></i> Generado con ${IA_PROVIDERS[pid]?.label || 'IA'} ·
                    Revisar con criterio profesional antes de actuar.
                </div>`;

    } catch (e) {
        contenedor.innerHTML = `<div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 6 — INYECCIÓN EN MÓDULOS EXISTENTES
// ═══════════════════════════════════════════════════════════════════

// Inyectar botón "Analizar con Claude" en el detalle de causa
function clInyectarBotonesCausa() {
    // Patch abrirDetalleCausa para agregar botón IA
    const origAbrir = window.abrirDetalleCausa;
    if (origAbrir && !origAbrir._clPatched) {
        window.abrirDetalleCausa = function (causaId) {
            origAbrir(causaId);
            // Agregar botón IA en dc-actions si no existe
            setTimeout(() => {
                const actions = document.querySelector('.dc-actions');
                if (actions && !document.getElementById(`cl-causa-btn-${causaId}`)) {
                    const btn = document.createElement('button');
                    btn.id = `cl-causa-btn-${causaId}`;
                    btn.className = 'dc-btn';
                    btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;';
                    btn.innerHTML = '<i class="fas fa-brain"></i> Analizar IA';
                    btn.onclick = () => clAnalizarCausa(causaId);
                    // Insertar antes del botón Estrategia
                    const estrategiaBtn = actions.querySelector('.dc-btn.primary');
                    if (estrategiaBtn) actions.insertBefore(btn, estrategiaBtn);
                    else actions.appendChild(btn);
                }
            }, 100);
        };
        window.abrirDetalleCausa._clPatched = true;
        // Aliases apuntan a la versión final (con botón IA)
        window.viewCausa = window.abrirDetalleCausa;
        window.verCausa = window.abrirDetalleCausa;
        window.verDetalleCausa = window.abrirDetalleCausa;
        window.openCausa = window.abrirDetalleCausa;
        window.goCausa = window.abrirDetalleCausa;
        window.detalleCausa = window.abrirDetalleCausa;
    }
}

// Inyectar botón IA en Estrategia Pro
function clInyectarBotonEstrategiaPro() {
    const origRender = window.uiRenderEstrategiaPro;
    if (origRender && !origRender._clPatched) {
        window.uiRenderEstrategiaPro = function () {
            origRender();
            setTimeout(() => {
                const contenedor = document.getElementById('analisisEstrategico');
                if (!contenedor) return;
                // Solo agregar si no ya tiene contenido IA
                if (contenedor.querySelector('.cl-ep-header')) return;
                const causaId = parseInt(document.getElementById('ep-causa-sel')?.value);
                if (!causaId) return;
                // Agregar botón IA encima del análisis existente
                const btnWrap = document.createElement('div');
                btnWrap.style.cssText = 'margin-bottom:16px;';
                btnWrap.innerHTML = `<button onclick="clAnalizarEstrategiaPro(${causaId})"
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">
                            <i class="fas fa-brain"></i> Análisis Estratégico con Bot AI
                        </button>`;
                contenedor.insertAdjacentElement('beforebegin', btnWrap);
            }, 150);
        };
        window.uiRenderEstrategiaPro._clPatched = true;
    }
}

// Inyectar botón IA en cada sentencia de jurisprudencia
function clInyectarBotonJuris() {
    const origRender = window.uiRenderJurisprudenciaAvanzada;
    if (origRender && !origRender._clPatched) {
        window.uiRenderJurisprudenciaAvanzada = function () {
            origRender();
            // Agregar botón "Analizar con IA" a cada tarjeta
            setTimeout(() => {
                document.querySelectorAll('#listaJurisprudencia .card').forEach((card, i) => {
                    if (card.querySelector('.cl-juris-btn')) return;
                    const j = DB.jurisprudencia[i];
                    if (!j) return;
                    const btn = document.createElement('button');
                    btn.className = 'cl-juris-btn btn btn-sm';
                    btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;margin-left:6px;';
                    btn.innerHTML = '<i class="fas fa-brain"></i> Analizar';
                    btn.onclick = (e) => { e.stopPropagation(); clAnalizarJurisprudencia(j.id); };
                    const deleteBtn = card.querySelector('.btn-d');
                    if (deleteBtn) deleteBtn.insertAdjacentElement('beforebegin', btn);
                    else card.appendChild(btn);
                });
            }, 100);
        };
        window.uiRenderJurisprudenciaAvanzada._clPatched = true;
    }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 7 — INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════

function clLegalInit() {
    clInyectarBotonFlotante();
    clInyectarBotonesCausa();
    clInyectarBotonEstrategiaPro();
    clInyectarBotonJuris();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', clLegalInit);
} else {
    setTimeout(clLegalInit, 500);
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 8 — PANEL CLAUDE.AI EMBEBIDO (iframe flotante)
// Permite usar claude.ai directamente dentro de la app mientras
// se tiene acceso al contexto de la causa/despacho.
// ═══════════════════════════════════════════════════════════════════

let _clIframeOpen = false;
let _clIframeMode = 'general'; // 'general' | 'juris' | 'escrito' | 'doctrina' | 'documento'

function clAbrirIframe(modo, contextoExtra) {
    _clIframeMode = modo || 'general';
    const existe = document.getElementById('cl-iframe-panel');
    if (existe) {
        existe.remove();
        _clIframeOpen = false;
    }

    // Si ya estaba abierto sin modo nuevo, solo cierra
    if (!modo && !existe) {
        _clIframeOpen = false;
        return;
    }

    _clIframeOpen = true;
    _crearIframePanel(contextoExtra);
}

function clToggleIframe() {
    const panel = document.getElementById('cl-iframe-panel');
    if (panel) {
        panel.remove();
        _clIframeOpen = false;
    } else {
        _clIframeOpen = true;
        _crearIframePanel();
    }
}

function _clContextoActual(modo) {
    const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
    const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const base = `Fecha: ${hoy} | Jurisdicción: Chile\nDespacho: ${(DB.causas || []).length} causas · ${(DB.clientes || []).length} clientes\n\n`;

    const modos = {
        juris: `Eres un experto en jurisprudencia chilena. Necesito análisis de fallos de la Corte Suprema y Cortes de Apelaciones de Chile.\n\n${base}`,
        escrito: (() => {
            const causaId = parseInt(document.getElementById('esc-causa-sel')?.value);
            const causa = causaId ? DB.causas.find(c => c.id === causaId) : null;
            const tipo = document.getElementById('esc-tipo')?.selectedOptions?.[0]?.dataset?.label || '';
            const hechos = document.getElementById('esc-hechos')?.value || '';
            return `Eres un abogado litigante chileno experto en redacción judicial.\nNecesito que redactes un escrito de tipo: "${tipo}".\n\n${base}` +
                (causa ? `Causa: ${causa.caratula} | Tribunal: ${causa.juzgado || 'N/D'} | Tipo: ${causa.tipoProcedimiento}\nRama: ${causa.rama}\n` : '') +
                (hechos ? `\nHechos: ${hechos.substring(0, 800)}` : '');
        })(),
        doctrina: `Eres un experto en doctrina jurídica chilena con conocimiento de Alessandri, Somarriva, Abeliuk y autores nacionales.\n\n${base}`,
        documento: `Eres un asistente jurídico especializado en generar documentos legales formales en Chile.\n\n${base}`,
        general: `Eres Bot AI, un asistente jurídico especializado en derecho chileno integrado en AppBogado.\n\n${base}`,
    };

    return modos[modo] || modos.general;
}

function _crearIframePanel(contextoExtra) {
    const panel = document.createElement('div');
    panel.id = 'cl-iframe-panel';

    const titulosModo = {
        juris: '⚖ Jurisprudencia con Claude',
        escrito: '⚖ Redactar Escrito con Claude',
        doctrina: '⚖ Doctrina Legal con Claude',
        documento: '⚖ Generar Documento con Claude',
        general: '⚖ Claude — Asistente Jurídico',
    };

    const contexto = _clContextoActual(_clIframeMode) + (contextoExtra ? '\n\n' + contextoExtra : '');

    panel.innerHTML = `
            <div class="cl-iframe-header">
                <div class="cl-iframe-header-left">
                    <span style="font-size:1.1rem;">⚖</span>
                    <div>
                        <div class="cl-iframe-title">${titulosModo[_clIframeMode] || titulosModo.general}</div>
                        <div class="cl-iframe-sub">IA Web · Integración AppBogado</div>
                    </div>
                </div>
                <div class="cl-iframe-header-actions">
                    <button class="cl-hdr-btn" onclick="clCopiarContextoIframe()" title="Copiar contexto al portapapeles">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="cl-hdr-btn" onclick="clResizeIframe()" title="Expandir/contraer" id="cl-resize-btn">
                        <i class="fas fa-expand-alt" id="cl-resize-ico"></i>
                    </button>
                    <button class="cl-hdr-btn" onclick="document.getElementById('cl-iframe-panel').remove();_clIframeOpen=false;" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Contexto copiable + instrucciones -->
            <div class="cl-iframe-ctx-bar" id="cl-iframe-ctx-bar">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:0.7rem; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.06em;">
                        <i class="fas fa-copy"></i> Contexto preparado para Claude
                    </span>
                    <div style="display:flex; gap:6px;">
                        <button onclick="clCopiarContextoIframe()" style="padding:4px 10px; background:#7c3aed; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.72rem; font-weight:700;">
                            <i class="fas fa-copy"></i> Copiar contexto
                        </button>
                        <button onclick="document.getElementById('cl-iframe-ctx-bar').style.display='none'" style="padding:4px 8px; background:#f1f5f9; color:#64748b; border:none; border-radius:6px; cursor:pointer; font-size:0.72rem;">
                            Ocultar
                        </button>
                    </div>
                </div>
                <div style="font-size:0.71rem; line-height:1.6; color:#374151; background:white; padding:10px; border-radius:6px; border:1px solid #e2e8f0; max-height:80px; overflow-y:auto; font-family:'IBM Plex Mono',monospace; white-space:pre-wrap;" id="cl-ctx-preview">${contexto.substring(0, 400)}${contexto.length > 400 ? '…' : ''}</div>
                <div style="font-size:0.69rem; color:#6b7280; margin-top:6px;">
                    <strong>Pasos:</strong>
                    1. Clic en <strong>"Copiar contexto"</strong> ↑ &nbsp;
                    2. En IA Web pega el contexto y escribe tu consulta &nbsp;
                    3. Trabaja con Claude directamente en el panel de abajo
                </div>
            </div>

            <!-- iframe claude.ai -->
            <div class="cl-iframe-wrapper">
                <iframe
                    id="cl-claude-iframe"
                    src="https://claude.ai/new"
                    title="Claude — Asistente Jurídico"
                    allow="clipboard-read; clipboard-write"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation">
                </iframe>
                <div class="cl-iframe-overlay-note" id="cl-iframe-note">
                    <div style="text-align:center; padding:32px 24px;">
                        <div style="font-size:2.5rem; margin-bottom:12px;">⚖</div>
                        <div style="font-size:0.95rem; font-weight:700; color:#1e293b; margin-bottom:8px;">IA Web cargando…</div>
                        <div style="font-size:0.78rem; color:#64748b; line-height:1.6; margin-bottom:16px;">
                            Si el iframe muestra error de seguridad, abre IA Web en una pestaña separada<br>
                            y pega el contexto que copiaste arriba.
                        </div>
                        <a href="https://claude.ai/new" target="_blank"
                            style="padding:10px 20px; background:linear-gradient(135deg,#7c3aed,#6d28d9); color:white; border-radius:9px; text-decoration:none; font-size:0.83rem; font-weight:700; display:inline-block;">
                            <i class="fas fa-external-link-alt"></i> Abrir IA Web en pestaña nueva
                        </a>
                    </div>
                </div>
            </div>

            <!-- Accesos rápidos por modo -->
            <div class="cl-iframe-quickbar">
                ${[
            ['general', 'fa-comments', 'Chat general'],
            ['juris', 'fa-book', 'Jurisprudencia'],
            ['escrito', 'fa-pen-nib', 'Escritos'],
            ['doctrina', 'fa-graduation-cap', 'Doctrina'],
            ['documento', 'fa-file-alt', 'Documentos'],
        ].map(([m, ico, lbl]) => `
                <button onclick="clAbrirIframe('${m}')"
                    class="cl-quick-btn ${_clIframeMode === m ? 'active' : ''}"
                    title="${lbl}">
                    <i class="fas ${ico}"></i>
                    <span>${lbl}</span>
                </button>`).join('')}
            </div>`;

    document.body.appendChild(panel);

    // Guardar contexto para copiar
    panel._contexto = contexto;

    // Ocultar nota overlay cuando iframe carga exitosamente
    const iframe = document.getElementById('cl-claude-iframe');
    iframe.addEventListener('load', () => {
        setTimeout(() => {
            const note = document.getElementById('cl-iframe-note');
            if (note) note.style.display = 'none';
        }, 500);
    });
}

let _clIframeExpanded = false;
function clResizeIframe() {
    const panel = document.getElementById('cl-iframe-panel');
    const ico = document.getElementById('cl-resize-ico');
    if (!panel) return;
    _clIframeExpanded = !_clIframeExpanded;
    if (_clIframeExpanded) {
        panel.style.cssText += 'width:90vw !important; height:92vh !important; right:5vw !important; bottom:4vh !important;';
        ico.className = 'fas fa-compress-alt';
    } else {
        panel.style.cssText = '';
        ico.className = 'fas fa-expand-alt';
    }
}

function clCopiarContextoIframe(modo, extra) {
    const panel = document.getElementById('cl-iframe-panel');
    const ctx = panel?._contexto || _clContextoActual(_clIframeMode);
    const full = ctx + (extra ? '\n\n' + extra : '');
    navigator.clipboard.writeText(full).then(() => {
        if (typeof showSuccess === 'function') showSuccess('✅ Contexto copiado. Pégalo en IA Web.');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = full; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
        if (typeof showInfo === 'function') showInfo('Contexto copiado.');
    });
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 9 — GENERACIÓN DE DOCUMENTOS WORD + PDF
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera un documento Word (.docx) desde texto Markdown.
 * Usa docx.js si está disponible (CDN), o descarga como .txt fallback.
 */
function clDescargarWord(titulo, contenido, nombreArchivo) {
    if (typeof docx !== 'undefined') {
        // docx.js disponible
        _clGenerarDocxReal(titulo, contenido, nombreArchivo);
    } else if (typeof JSZip !== 'undefined') {
        _clGenerarDocxZip(titulo, contenido, nombreArchivo);
    } else {
        // Fallback: .txt
        _clDescargarTxt(contenido, nombreArchivo + '.txt');
        if (typeof showInfo === 'function') showInfo('Descargado como .txt (para Word, añade docx.js al proyecto).');
    }
}

function _clGenerarDocxReal(titulo, contenido, nombreArchivo) {
    try {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

        const children = [];
        // Título principal
        children.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: titulo, bold: true, color: '1a3a6b', size: 32 })],
        }));
        // Subtítulo fecha
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: `Generado por AppBogado · ${new Date().toLocaleDateString('es-CL')}`, color: '64748b', size: 18 })],
        }));

        // Procesar líneas
        contenido.split('\n').forEach(linea => {
            const trimmed = linea.trim();
            if (!trimmed) {
                children.push(new Paragraph({ spacing: { before: 0, after: 80 } }));
                return;
            }
            // Detectar encabezados **Texto**
            const esH = /^\*\*(.+)\*\*$/.test(trimmed);
            const texto = esH ? trimmed.replace(/\*\*/g, '') : trimmed;
            children.push(new Paragraph({
                heading: esH ? HeadingLevel.HEADING_2 : undefined,
                spacing: { before: esH ? 200 : 0, after: 80 },
                children: [new TextRun({
                    text: texto,
                    bold: esH,
                    color: esH ? '1a3a6b' : '1e293b',
                    size: esH ? 24 : 22,
                })],
            }));
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        size: { width: 11906, height: 16838 }, // A4
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
                    },
                },
                children,
            }],
        });

        Packer.toBlob(doc).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nombreArchivo + '.docx'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            if (typeof registrarEvento === 'function') registrarEvento(`Documento Word generado: ${nombreArchivo}`);
        });
    } catch (e) {
        console.info('[Lexium] Bot AI ✓');
        _clDescargarTxt(contenido, nombreArchivo + '.txt');
    }
}

function _clGenerarDocxZip(titulo, contenido, nombreArchivo) {
    // Construir XML de Word mínimo válido
    const lineas = contenido.split('\n');
    const parrafos = lineas.map(l => {
        const t = l.trim();
        if (!t) return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>';
        const esH = /^\*\*(.+)\*\*$/.test(t);
        const txt = t.replace(/\*\*/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const rPr = esH
            ? '<w:rPr><w:b/><w:color w:val="1a3a6b"/><w:sz w:val="24"/></w:rPr>'
            : '<w:rPr><w:sz w:val="22"/></w:rPr>';
        const pPr = esH
            ? '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="EEF3FF"/><w:spacing w:before="200" w:after="80"/></w:pPr>'
            : '<w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>';
        return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`;
    }).join('');

    const tituloXml = titulo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fecha = new Date().toLocaleDateString('es-CL');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/>
        <w:shd w:val="clear" w:color="auto" w:fill="1a3a6b"/></w:pPr>
      <w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="30"/></w:rPr>
        <w:t>${tituloXml}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="280"/></w:pPr>
      <w:r><w:rPr><w:color w:val="64748b"/><w:sz w:val="18"/></w:rPr>
        <w:t>AppBogado · IA Jurídica · ${fecha}</w:t></w:r>
    </w:p>
    ${parrafos}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', relsRoot);
    zip.file('word/document.xml', documentXml);
    zip.file('word/_rels/document.xml.rels', relsWord);
    zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nombreArchivo + '.docx'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            if (typeof registrarEvento === 'function') registrarEvento(`Documento Word descargado: ${nombreArchivo}`);
        });
}

/**
 * Genera un PDF desde contenido texto usando window.print() con estilos custom.
 * No requiere dependencias externas.
 */
function clDescargarPDF(titulo, contenido, nombreArchivo) {
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
        if (typeof showError === 'function') showError('Bloqueador de popups activo. Permite popups para generar PDF.');
        return;
    }
    const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    const htmlContenido = contenido
        .split('\n')
        .map(l => {
            const t = l.trim();
            if (!t) return '<p class="espacio"></p>';
            const esH = /^\*\*(.+)\*\*$/.test(t);
            const txt = t.replace(/\*\*/g, '');
            return esH ? `<h2>${txt}</h2>` : `<p>${txt}</p>`;
        }).join('');

    ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Merriweather',Georgia,serif; font-size:11pt; line-height:1.7; color:#1e293b; background:white; padding:0; }
  @page { size:A4; margin:2.5cm 3cm 2.5cm 3.5cm; }
  .portada { background:#1a3a6b; color:white; padding:60px 48px 40px; margin-bottom:0; }
  .portada h1 { font-family:'IBM Plex Sans',sans-serif; font-size:22pt; font-weight:700; line-height:1.2; margin-bottom:16px; }
  .portada .meta { font-size:9.5pt; opacity:0.7; font-style:italic; }
  .cuerpo { padding:40px 48px; }
  h2 { font-family:'IBM Plex Sans',sans-serif; font-size:12pt; font-weight:700; color:#1a3a6b; margin:24px 0 8px; padding:8px 14px; background:#eef3ff; border-left:4px solid #1a3a6b; }
  p { margin-bottom:10px; text-align:justify; font-size:10.5pt; }
  p.espacio { margin-bottom:6px; }
  .footer { margin-top:40px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:8pt; color:#94a3b8; text-align:center; font-family:'IBM Plex Sans',sans-serif; }
  @media print {
    .no-print { display:none !important; }
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .portada { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="portada">
  <h1>${titulo}</h1>
  <div class="meta">Generado por AppBogado · Sistema de Gestión Legal · ${fecha}</div>
</div>
<div class="cuerpo">
  ${htmlContenido}
  <div class="footer">
    Documento generado con AppBogado — Asistente Jurídico IA · ${fecha}<br>
    Las respuestas de IA son orientativas. Revisar con criterio profesional antes de actuar.
  </div>
</div>
<div class="no-print" style="position:fixed; bottom:20px; right:20px; display:flex; gap:10px; z-index:9999;">
  <button onclick="window.print()" style="padding:12px 24px; background:#1a3a6b; color:white; border:none; border-radius:9px; cursor:pointer; font-size:14px; font-weight:700; font-family:sans-serif;">
    🖨 Imprimir / Guardar PDF
  </button>
  <button onclick="window.close()" style="padding:12px 16px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:9px; cursor:pointer; font-size:14px;">
    Cerrar
  </button>
</div>
</body>
</html>`);
    ventana.document.close();
    if (typeof registrarEvento === 'function') registrarEvento(`PDF generado: ${nombreArchivo}`);
}

function _clDescargarTxt(contenido, nombre) {
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 10 — MÓDULOS IA: JURISPRUDENCIA, DOCTRINA, DOCUMENTOS
// Todos usan iaCall() del motor unificado en 12-ia-providers.js
// ═══════════════════════════════════════════════════════════════════

// ── 10.1 Modal genérico de consulta IA ───────────────────────────
function _clAbrirModalIA(cfg) {
    // cfg: { titulo, placeholder, prompt_fn, tieneDescarga, nombreArchivo, promptFijo }
    document.getElementById('cl-modal-ia-root')?.remove();

    const root = document.createElement('div');
    root.id = 'cl-modal-ia-root';
    root.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    root.onclick = e => { if (e.target === root) root.remove(); };

    root.innerHTML = `
<div style="background:white;border-radius:18px;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;box-shadow:0 32px 64px rgba(0,0,0,0.25);display:flex;flex-direction:column;">
  <!-- Header -->
  <div style="padding:18px 22px 0;display:flex;align-items:flex-start;gap:12px;flex-shrink:0;">
    <div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#c084fc,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="font-size:1.1rem;">⚖</span>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:0.97rem;font-weight:800;color:#0f172a;">${cfg.titulo}</div>
      <div style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">${IA_PROVIDERS?.[iaGetProvider?.()]?.label || 'IA'} · AppBogado Legal</div>
    </div>
    <button onclick="document.getElementById('cl-modal-ia-root').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;padding:0 4px;flex-shrink:0;">×</button>
  </div>

  <!-- Input -->
  <div style="padding:16px 22px 0;">
    <textarea id="cl-modal-ia-input" placeholder="${cfg.placeholder}"
      style="width:100%;min-height:100px;padding:11px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.84rem;font-family:inherit;resize:vertical;box-sizing:border-box;line-height:1.6;color:#1e293b;outline:none;"
      onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button onclick="document.getElementById('cl-modal-ia-root').remove()"
        style="padding:10px 16px;background:#f8fafc;color:#64748b;border:1.5px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:0.82rem;font-weight:600;">Cancelar</button>
      <button id="cl-modal-ia-btn" onclick="window._clModalIAEnviar()"
        style="flex:1;padding:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;border-radius:9px;cursor:pointer;font-size:0.83rem;font-weight:700;">
        <i class="fas fa-paper-plane"></i> Consultar con IA
      </button>
      <button onclick="clAbrirIframe('${cfg.modo || 'general'}')"
        style="padding:10px 14px;background:#faf5ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:9px;cursor:pointer;font-size:0.82rem;font-weight:600;" title="Abrir IA Web embebido">
        <i class="fas fa-external-link-alt"></i> IA Web
      </button>
    </div>
  </div>

  <!-- Resultado -->
  <div id="cl-modal-ia-resultado" style="display:none;padding:16px 22px 22px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:0.75rem;font-weight:700;color:#475569;">
        <i class="fas fa-comment-dots" style="color:#7c3aed;"></i> Respuesta IA
      </span>
      <div style="display:flex;gap:6px;" id="cl-modal-ia-acciones">
        ${cfg.tieneDescarga ? `
        <button onclick="window._clModalIAWord()" style="padding:4px 10px;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:7px;cursor:pointer;font-size:0.7rem;font-weight:700;">
          <i class="fas fa-file-word"></i> Word
        </button>
        <button onclick="window._clModalIAPDF()" style="padding:4px 10px;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;border-radius:7px;cursor:pointer;font-size:0.7rem;font-weight:700;">
          <i class="fas fa-file-pdf"></i> PDF
        </button>` : ''}
        <button onclick="window._clModalIACopiar()" style="padding:4px 10px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:7px;cursor:pointer;font-size:0.7rem;">
          <i class="fas fa-copy"></i> Copiar
        </button>
      </div>
    </div>
    <div id="cl-modal-ia-texto" style="padding:14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;font-size:0.81rem;line-height:1.75;color:#1e293b;white-space:pre-wrap;max-height:340px;overflow-y:auto;font-family:inherit;"></div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      <button onclick="window._clModalIABitacora()" style="padding:6px 12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;cursor:pointer;font-size:0.73rem;font-weight:600;">
        <i class="fas fa-bookmark"></i> Guardar en bitácora
      </button>
    </div>
  </div>
</div>`;

    document.body.appendChild(root);

    // Cerrar con Escape
    const onEsc = e => { if (e.key === 'Escape') { root.remove(); document.removeEventListener('keydown', onEsc); } };
    document.addEventListener('keydown', onEsc);

    let _ultimaRespuesta = '';
    const _titulo = cfg.titulo;
    const _archivo = cfg.nombreArchivo || 'documento-ia';

    window._clModalIAEnviar = async () => {
        const input = document.getElementById('cl-modal-ia-input');
        const btn = document.getElementById('cl-modal-ia-btn');
        const resEl = document.getElementById('cl-modal-ia-resultado');
        const txtEl = document.getElementById('cl-modal-ia-texto');
        const texto = input?.value.trim();

        if (!texto && !cfg.promptFijo) { if (typeof showError === 'function') showError('Escribe tu consulta primero.'); return; }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando IA…';

        try {
            const respuesta = await cfg.prompt_fn(texto);
            _ultimaRespuesta = respuesta;
            resEl.style.display = 'block';
            if (txtEl) { txtEl.textContent = respuesta; txtEl.dataset.resp = respuesta; }
        } catch (e) {
            if (typeof showError === 'function') showError('Error IA: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Consultar con IA';
        }
    };

    window._clModalIACopiar = () => {
        const txt = _ultimaRespuesta || document.getElementById('cl-modal-ia-texto')?.textContent || '';
        navigator.clipboard.writeText(txt).then(() => {
            if (typeof showSuccess === 'function') showSuccess('✅ Copiado al portapapeles.');
        });
    };

    window._clModalIAWord = () => {
        const txt = _ultimaRespuesta || '';
        if (!txt.trim()) { if (typeof showError === 'function') showError('Primero genera una respuesta.'); return; }
        clDescargarWord(_titulo, txt, _archivo);
        if (typeof showSuccess === 'function') showSuccess('✅ Generando Word…');
    };

    window._clModalIAPDF = () => {
        const txt = _ultimaRespuesta || '';
        if (!txt.trim()) { if (typeof showError === 'function') showError('Primero genera una respuesta.'); return; }
        clDescargarPDF(_titulo, txt, _archivo);
    };

    window._clModalIABitacora = () => {
        const txt = _ultimaRespuesta || '';
        if (!txt.trim()) return;
        if (typeof registrarEvento === 'function') registrarEvento(`[IA] ${_titulo}: ${txt.substring(0, 120)}…`);
        if (typeof showSuccess === 'function') showSuccess('✅ Guardado en bitácora.');
    };

    if (cfg.promptFijo) setTimeout(() => document.getElementById('cl-modal-ia-btn')?.click(), 200);
    setTimeout(() => document.getElementById('cl-modal-ia-input')?.focus(), 100);
}

// ── 10.2 Jurisprudencia ───────────────────────────────────────────
function clAbrirBusquedaJuris() {
    _clAbrirModalIA({
        titulo: 'Búsqueda de Jurisprudencia Chilena',
        placeholder: 'Ej: ¿Cuál es la jurisprudencia de la Corte Suprema sobre cláusulas abusivas en contratos de adhesión?\n\nEj: Fallos sobre despido indirecto en el Código del Trabajo',
        modo: 'juris',
        tieneDescarga: true,
        nombreArchivo: 'jurisprudencia-ia-' + Date.now(),
        prompt_fn: async (consulta) => {
            const jurisCtx = (DB.jurisprudencia || []).slice(0, 12).map(j =>
                `[${j.rol || 'S/R'}] ${j.tribunal} — ${j.materia}: ${j.temaCentral || j.holding || ''}`
            ).join('\n');

            return iaCall(`Eres un experto en jurisprudencia chilena.
Jurisdicción: Chile. Responde en español formal. Cita ROL y tribunal cuando sea posible.

CONSULTA: ${consulta}

${jurisCtx ? 'JURISPRUDENCIA INDEXADA EN EL DESPACHO:\n' + jurisCtx + '\n' : ''}

Proporciona:
**1. ANÁLISIS DEL TEMA** — contexto jurídico en el derecho chileno
**2. FALLOS RELEVANTES** — Tribunal · ROL · Año · Holding principal
**3. TENDENCIA JURISPRUDENCIAL** — favorable / desfavorable / contradictoria
**4. NORMAS APLICADAS** — artículos de ley más citados
**5. CONCLUSIÓN PRÁCTICA** — recomendación concreta (3 líneas)`);
        },
    });
}

// ── 10.3 Doctrina ─────────────────────────────────────────────────
function clAbrirDoctrina() {
    _clAbrirModalIA({
        titulo: 'Consulta de Doctrina Legal Chilena',
        placeholder: 'Ej: Explica la lesión enorme en el derecho civil chileno y cuándo puede alegarse\n\nEj: Naturaleza jurídica del contrato de promesa según Abeliuk\n\nEj: Doctrina sobre la responsabilidad extracontractual del Estado',
        modo: 'doctrina',
        tieneDescarga: true,
        nombreArchivo: 'doctrina-ia-' + Date.now(),
        prompt_fn: async (tema) => {
            return iaCall(`Eres un experto en doctrina jurídica chilena. Conoces profundamente los textos de Alessandri, Somarriva, Abeliuk, Meza Barros, Claro Solar y otros autores nacionales.

CONSULTA DOCTRINAL: ${tema}
Jurisdicción: Chile. Responde en español formal y técnico.

**1. CONCEPTO Y DEFINICIÓN** — doctrinaria
**2. NATURALEZA JURÍDICA** — categoría dogmática y elementos esenciales
**3. REGULACIÓN EN CHILE** — artículos del Código Civil, leyes especiales u otras normas aplicables
**4. DOCTRINA NACIONAL** — posiciones de los principales autores chilenos
**5. DOCTRINA COMPARADA** — breve referencia a España, Argentina u otros sistemas romano-germánicos
**6. APLICACIÓN PRÁCTICA** — casos frecuentes y consejos para el litigante
**7. JURISPRUDENCIA RELEVANTE** — fallos chilenos más citados sobre la materia`);
        },
    });
}

// ── 10.4 Análisis estratégico ─────────────────────────────────────
function clAbrirEstrategia(causaId) {
    const causa = causaId ? DB.causas.find(c => c.id == causaId) : null;
    _clAbrirModalIA({
        titulo: causa ? `Estrategia: ${causa.caratula}` : 'Análisis Estratégico con IA',
        placeholder: 'Describe la situación o pregunta estratégica:\n\nEj: El demandado acaba de presentar recurso de nulidad. ¿Qué hacemos?\nEj: ¿Conviene transigir o llegar a sentencia?\nEj: ¿Es viable la casación en el fondo en este caso?',
        modo: 'doctrina',
        tieneDescarga: true,
        nombreArchivo: 'estrategia-ia-' + Date.now(),
        prompt_fn: async (situacion) => {
            const ctx = causa ? clBuildCausaContext(causa.id) : clBuildContext({ causas: true });
            return iaCall(`${ctx}

SITUACIÓN A ANALIZAR: ${situacion}

Análisis estratégico legal en Chile:
**1. DIAGNÓSTICO** — posición legal, fortalezas y debilidades
**2. OPCIONES PROCESALES** — ordenadas por viabilidad
**3. ESTRATEGIA RECOMENDADA** — con justificación jurídica y artículos aplicables
**4. RIESGOS** — escenarios adversos y cómo mitigarlos
**5. PLAZOS CRÍTICOS** — con artículo de ley que los rige
**6. PRUEBA NECESARIA** — qué debe acreditarse y cómo
**7. PROBABILIDAD DE ÉXITO** — estimación honesta basada en jurisprudencia y doctrina`);
        },
    });
}

// ── 10.5 Generar informe Word/PDF de causa ────────────────────────
async function clGenerarInformeIA(causaId) {
    const selId = causaId || document.getElementById('inf-causa-sel')?.value;
    const causa = selId ? DB.causas.find(c => c.id == selId) : null;
    if (!causa) { if (typeof showError === 'function') showError('Selecciona una causa primero.'); return; }

    const alertas = (DB.alertas || [])
        .filter(a => a.causaId == causa.id && a.estado === 'activa')
        .map(a => `• ${a.fecha || ''}: ${a.mensaje || a.titulo || ''}`)
        .join('\n') || '• Sin alertas activas.';

    const etapas = (causa.etapasProcesales || []).slice(-6)
        .map(e => `• [${e.completada ? '✓' : '○'}] ${e.nombre || e.etapa || ''} ${e.fecha ? '— ' + new Date(e.fecha).toLocaleDateString('es-CL') : ''}`)
        .join('\n') || '• Sin etapas registradas.';

    _clAbrirModalIA({
        titulo: `Informe: ${causa.caratula}`,
        placeholder: 'Instrucciones adicionales (opcional): Ej: Tono para cliente no abogado. Enfatizar riesgos. Incluir propuesta honorarios.',
        modo: 'documento',
        tieneDescarga: true,
        nombreArchivo: 'informe-' + causa.caratula.replace(/\s+/g, '-').substring(0, 30) + '-' + new Date().toISOString().split('T')[0],
        prompt_fn: async (instrucciones) => {
            return iaCall(`${clBuildCausaContext(causa.id)}

ALERTAS ACTIVAS:
${alertas}

ETAPAS RECIENTES:
${etapas}

${instrucciones ? 'INSTRUCCIONES ADICIONALES:\n' + instrucciones + '\n' : ''}
Redacta un informe ejecutivo profesional con estas secciones:
**1. RESUMEN EJECUTIVO** (4 líneas, para el cliente)
**2. ESTADO PROCESAL ACTUAL** (descripción técnica)
**3. HITOS CUMPLIDOS** (cronología)
**4. PRÓXIMAS ACCIONES REQUERIDAS** (con urgencia y plazo)
**5. EVALUACIÓN DE RIESGO** (análisis jurídico)
**6. RECOMENDACIONES** (3-5 puntos)
**7. CONCLUSIÓN**

Fecha: ${new Date().toLocaleDateString('es-CL')} · Tono profesional, adecuado para presentar al cliente.`);
        },
    });
}

// ── 10.6 Mejorar escrito actual ───────────────────────────────────
function clMejorarEscritoActual() {
    const borrador = typeof _escritoActual !== 'undefined' ? _escritoActual.texto : '';
    if (!borrador?.trim()) {
        if (typeof showError === 'function') showError('Primero genera un escrito en el Generador de Escritos.');
        return;
    }
    _clAbrirModalIA({
        titulo: 'Mejorar Escrito con IA',
        placeholder: 'Qué mejorar:\n\nEj: Fortalecer los argumentos de derecho. Agregar jurisprudencia reciente. Mejorar la petición subsidiaria.',
        modo: 'escrito',
        tieneDescarga: true,
        nombreArchivo: 'escrito-mejorado-' + Date.now(),
        prompt_fn: async (instrucciones) => {
            return iaCall(`Eres un abogado litigante chileno experto. Revisa y mejora el siguiente escrito judicial.

BORRADOR:
---
${borrador.substring(0, 10000)}
---

INSTRUCCIONES: ${instrucciones || 'Mejorar redacción, precisión jurídica y completar citas de artículos legales.'}

Devuelve el texto COMPLETO mejorado, listo para presentar. Mantén el formato judicial chileno estándar.`);
        },
    });
}

// ── 10.7 Resumir documento pegado ────────────────────────────────
function clResumirDocumento() {
    _clAbrirModalIA({
        titulo: 'Resumir Documento Legal con IA',
        placeholder: 'Pega aquí el texto del documento legal (demanda, contrato, sentencia, resolución)…',
        modo: 'documento',
        tieneDescarga: true,
        nombreArchivo: 'resumen-doc-' + Date.now(),
        prompt_fn: async (texto) => {
            return iaCall(`Resume y estructura este documento legal chileno:

---
${texto.substring(0, 14000)}
---

**1. TIPO DE DOCUMENTO**
**2. PARTES INVOLUCRADAS**
**3. OBJETO / PETICIÓN PRINCIPAL**
**4. HECHOS RELEVANTES** (puntos clave)
**5. FUNDAMENTOS DE DERECHO** (artículos citados)
**6. PETICIONES CONCRETAS**
**7. OBSERVACIONES** (puntos críticos)
**8. RESPUESTA RECOMENDADA** (si aplica)`);
        },
    });
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 11 — CSS EMBEBIDO PARA TODOS LOS COMPONENTES NUEVOS
// ═══════════════════════════════════════════════════════════════════
(function _clInjectStyles() {
    if (document.getElementById('cl-legal-styles-v2')) return;
    const style = document.createElement('style');
    style.id = 'cl-legal-styles-v2';
    style.textContent = `

/* ── Panel iframe IA Web ─────────────────────────────────── */
#cl-iframe-panel {
    position: fixed;
    right: 20px;
    bottom: 24px;
    width: 520px;
    height: 78vh;
    background: white;
    border-radius: 18px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(124,58,237,0.1);
    z-index: 9500;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 2px solid #e9d5ff;
    transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
    animation: clIframeIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes clIframeIn {
    from { opacity:0; transform:translateY(30px) scale(0.95); }
    to   { opacity:1; transform:translateY(0) scale(1); }
}

.cl-iframe-header {
    padding: 14px 16px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
.cl-iframe-header-left { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
.cl-iframe-title { font-size:0.85rem; font-weight:800; color:white; }
.cl-iframe-sub   { font-size:0.65rem; color:rgba(196,181,253,0.8); margin-top:1px; }
.cl-iframe-header-actions { display:flex; gap:4px; }

.cl-iframe-ctx-bar {
    padding: 10px 14px;
    background: #faf5ff;
    border-bottom: 1px solid #e9d5ff;
    flex-shrink: 0;
}

.cl-iframe-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
}
#cl-claude-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}
.cl-iframe-overlay-note {
    position: absolute;
    inset: 0;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.cl-iframe-overlay-note a { pointer-events: auto; }

.cl-iframe-quickbar {
    display: flex;
    gap: 4px;
    padding: 8px 10px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    overflow-x: auto;
}
.cl-quick-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 10px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.65rem;
    color: #64748b;
    white-space: nowrap;
    transition: all 0.15s;
    flex-shrink: 0;
}
.cl-quick-btn i { font-size: 0.85rem; }
.cl-quick-btn:hover, .cl-quick-btn.active {
    background: #faf5ff;
    border-color: #c4b5fd;
    color: #7c3aed;
}
.cl-quick-btn.active { font-weight: 700; }

/* ── Botón flotante Claude iframe ───────────────────────────── */
#cl-fab-iframe {
    position: fixed;
    bottom: 90px;
    right: 24px;
    z-index: 9400;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(124,58,237,0.4);
    transition: all 0.2s;
    font-family: inherit;
}
#cl-fab-iframe:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(124,58,237,0.5); }

/* Mover FAB principal para no solapar */
#cl-fab { bottom: 144px !important; }

/* ── Barra de herramientas IA en módulos ────────────────────── */
.cl-ia-toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 10px 0;
    margin-bottom: 4px;
}
.cl-ia-toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border: none;
    border-radius: 9px;
    cursor: pointer;
    font-size: 0.79rem;
    font-weight: 700;
    font-family: inherit;
    transition: all 0.15s;
}
.cl-ia-toolbar-btn.primary {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: white;
    box-shadow: 0 3px 10px rgba(124,58,237,0.3);
}
.cl-ia-toolbar-btn.primary:hover { transform:translateY(-1px); box-shadow:0 5px 16px rgba(124,58,237,0.4); }
.cl-ia-toolbar-btn.secondary {
    background: #faf5ff;
    color: #7c3aed;
    border: 1px solid #c4b5fd;
}
.cl-ia-toolbar-btn.secondary:hover { background:#f5f3ff; }
.cl-ia-toolbar-btn.outline {
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
}
.cl-ia-toolbar-btn.outline:hover { background:#f8fafc; border-color:#c4b5fd; color:#7c3aed; }

/* ── Indicadores IA en escritos (mejora) ───────────────────── */
.cl-esc-ia-bar {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: linear-gradient(90deg, #faf5ff, #f5f3ff);
    border-radius: 9px;
    border: 1px solid #e9d5ff;
    margin-bottom: 8px;
    align-items: center;
    flex-wrap: wrap;
}
            `;
    document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 12 — INYECCIÓN DE BOTONES IA EN MÓDULOS EXISTENTES
// ═══════════════════════════════════════════════════════════════════
function _clInyectarBarrasIA() {

    // ── Botón flotante de IA Web iframe ──
    if (!document.getElementById('cl-fab-iframe')) {
        const fab = document.createElement('button');
        fab.id = 'cl-fab-iframe';
        fab.innerHTML = '<i class="fas fa-robot"></i> IA Web';
        fab.title = 'Abrir IA Web embebido';
        fab.onclick = () => clToggleIframe();
        document.body.appendChild(fab);
    }

    // ── Escritos: barra de IA adicional ──
    const escTopRight = document.querySelector('.esc-topbar-right');
    if (escTopRight && !document.getElementById('cl-esc-mejorar-btn')) {
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:20px;background:#e2e8f0;margin:0 2px;';
        const btn1 = document.createElement('button');
        btn1.id = 'cl-esc-mejorar-btn';
        btn1.className = 'btn btn-sm';
        btn1.style.cssText = 'background:#faf5ff;color:#7c3aed;border:1px solid #c4b5fd;';
        btn1.innerHTML = '<i class="fas fa-magic"></i> Mejorar con IA';
        btn1.onclick = () => clMejorarEscritoActual();
        const btn2 = document.createElement('button');
        btn2.className = 'btn btn-sm';
        btn2.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;';
        btn2.innerHTML = '<i class="fas fa-external-link-alt"></i> IA Web';
        btn2.onclick = () => clAbrirIframe('escrito');
        escTopRight.appendChild(sep);
        escTopRight.appendChild(btn1);
        escTopRight.appendChild(btn2);
    }

    // ── Jurisprudencia: toolbar IA ──
    const jurisList = document.getElementById('juris-list');
    if (jurisList && !document.getElementById('cl-juris-toolbar')) {
        const bar = document.createElement('div');
        bar.id = 'cl-juris-toolbar';
        bar.className = 'cl-ia-toolbar';
        bar.innerHTML = `
                    <button class="cl-ia-toolbar-btn primary" onclick="clAbrirBusquedaJuris()">
                        <i class="fas fa-robot"></i> Buscar jurisprudencia con IA
                    </button>
                    <button class="cl-ia-toolbar-btn secondary" onclick="clAbrirIframe('juris')">
                        <i class="fas fa-external-link-alt"></i> Abrir IA Web
                    </button>`;
        jurisList.parentNode.insertBefore(bar, jurisList);
    }

    // ── Doctrina: toolbar IA ──
    const doctrinaMain = document.getElementById('doctrina-main');
    if (doctrinaMain && !document.getElementById('cl-doctrina-toolbar')) {
        const bar = document.createElement('div');
        bar.id = 'cl-doctrina-toolbar';
        bar.className = 'cl-ia-toolbar';
        bar.style.padding = '12px 0 0';
        bar.innerHTML = `
                    <button class="cl-ia-toolbar-btn primary" onclick="clAbrirDoctrina()">
                        <i class="fas fa-robot"></i> Consultar doctrina con IA
                    </button>
                    <button class="cl-ia-toolbar-btn secondary" onclick="clAbrirEstrategia()">
                        <i class="fas fa-chess"></i> Análisis estratégico
                    </button>
                    <button class="cl-ia-toolbar-btn outline" onclick="clAbrirIframe('doctrina')">
                        <i class="fas fa-external-link-alt"></i> IA Web
                    </button>`;
        doctrinaMain.insertBefore(bar, doctrinaMain.firstChild);
    }

    // ── Informes: botón IA ──
    const infContent = document.getElementById('informe-content');
    if (infContent && !document.getElementById('cl-inf-btn')) {
        const btn = document.createElement('button');
        btn.id = 'cl-inf-btn';
        btn.className = 'cl-ia-toolbar-btn primary';
        btn.style.cssText = 'margin-top:10px; display:inline-flex;';
        btn.innerHTML = '<i class="fas fa-robot"></i> Informe ejecutivo con IA (Word/PDF)';
        btn.onclick = () => clGenerarInformeIA();
        infContent.parentNode.insertBefore(btn, infContent);
    }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 13 — SOBREESCRIBIR/EXTENDER clLegalInit ORIGINAL
// ═══════════════════════════════════════════════════════════════════
const _clLegalInitOriginal = window.clLegalInit;

window.clLegalInit = function () {
    if (typeof _clLegalInitOriginal === 'function') {
        _clLegalInitOriginal();
    }
    setTimeout(_clInyectarBarrasIA, 700);
};

// Re-inicializar si el DOM ya está listo
if (document.readyState !== 'loading') {
    setTimeout(() => {
        _clInyectarBarrasIA();
    }, 800);
}

