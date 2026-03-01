// ████████████████████████████████████████████████████████████████████
// JS — MÓDULO 12: MOTOR MULTI-PROVEEDOR DE IA
// Soporta: Google Gemini · OpenAI (ChatGPT) · Anthropic (Claude)
// ── FUENTE DE VERDAD para: iaGetKey(), iaGetModel(), iaGetProvider() ──
// 09-app-core.js define stubs de compatibilidad que este módulo sobreescribe.
// Todos los demás módulos deben usar SIEMPRE las funciones de este archivo.
// No duplicar iaGetKey/iaGetModel en otros módulos.
// Todos los módulos que necesiten IA deben llamar iaCall() en vez de
// geminiCall() directamente. geminiCall() se mantiene como alias.
// ████████████████████████████████████████████████████████████████████

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 0 — CIFRADO AES-GCM PARA API KEYS
// Las API keys se cifran con AES-256-GCM antes de guardarse en
// localStorage. La clave de cifrado se deriva de un secreto fijo
// mezclado con el User-Agent del navegador, haciéndola dependiente
// del dispositivo. Esto no protege contra acceso físico al dispositivo
// con DevTools, pero sí contra:
//   - Scripts de terceros que lean localStorage cruzado
//   - Exportaciones/backups del perfil del navegador
//   - Inspección accidental de localStorage en otro contexto
// ═══════════════════════════════════════════════════════════════════

// Helper de escape HTML para uso interno (protección XSS en mensajes de error)
function _iaEscHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const _IACrypto = (() => {
    // Secreto base mezclado con fingerprint del navegador.
    // Cambiar este valor invalida todas las keys guardadas (migración limpia).
    const BASE_SECRET = 'APPBOGADO-IA-KEY-VAULT-v1';
    const SALT_STORAGE = 'APPBOGADO_IA_SALT';

    // Obtiene o genera un salt persistente aleatorio por dispositivo/perfil
    function _getSalt() {
        let salt;
        try { salt = AppConfig.get('ia_salt'); } catch(e) { salt = null; }
        if (!salt) {
            const arr = new Uint8Array(16);
            crypto.getRandomValues(arr);
            salt = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            try { AppConfig.set('ia_salt', salt); } catch(e) { console.warn('[AppConfig] ia_salt', e.message); }
        }
        return salt;
    }

    // Deriva una CryptoKey AES-256-GCM a partir del secreto base + salt
    async function _deriveKey() {
        const salt = _getSalt();
        const raw = BASE_SECRET + '|' + salt + '|' + (navigator.userAgent || '');
        const encoded = new TextEncoder().encode(raw);
        const keyMat = await crypto.subtle.importKey('raw', encoded, { name: 'PBKDF2' }, false, ['deriveKey']);
        const saltBuf = new TextEncoder().encode(salt);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
            keyMat,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Cifra un string plano → base64url(iv + ciphertext)
    async function encrypt(plaintext) {
        if (!plaintext) return '';
        if (!crypto.subtle) {
            console.warn('[IACrypto] SubtleCrypto no disponible (posible entorno file://). Guardando en claro.');
            return plaintext;
        }
        try {
            const key = await _deriveKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                new TextEncoder().encode(plaintext)
            );
            // Concatenar IV (12 bytes) + ciphertext y codificar en base64
            const combined = new Uint8Array(iv.byteLength + enc.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(enc), iv.byteLength);
            return btoa(String.fromCharCode(...combined));
        } catch (e) {
            console.warn('[IACrypto] Fallo al cifrar, guardando en claro como fallback:', e);
            return plaintext;
        }
    }

    // Descifra base64url(iv + ciphertext) → string plano
    async function decrypt(b64) {
        if (!b64) return '';
        if (!crypto.subtle) return b64;
        try {
            const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const key = await _deriveKey();
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
            return new TextDecoder().decode(plain);
        } catch (e) {
            // Si falla el descifrado, podría ser una key guardada en formato antiguo (texto plano)
            // Intentar usarla directamente para no romper sesiones existentes
            console.warn('[IACrypto] Fallo al descifrar, intentando como texto plano (migración):', e);
            return b64;
        }
    }

    // Detecta si un valor ya está cifrado (base64 válido de más de 20 chars)
    // Las API keys originales no son base64 puro, empiezan con sk-, AIza-, etc.
    function looksEncrypted(val) {
        if (!val || val.length < 20) return false;
        if (!crypto.subtle) return false; // Si no hay crypto, nada está "cifrado" para nosotros
        if (val.startsWith('sk-') || val.startsWith('AIza')) return false;
        try { atob(val); return true; } catch { return false; }
    }

    return { encrypt, decrypt, looksEncrypted };
})();

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 1 — REGISTRO DE PROVEEDORES
// ═══════════════════════════════════════════════════════════════════

const IA_PROVIDER_STORAGE = 'APPBOGADO_IA_PROVIDER';   // 'gemini' | 'openai' | 'claude'
const IA_KEYS_STORAGE = 'APPBOGADO_IA_KEYS';       // { gemini, openai, claude } — valores cifrados AES-GCM
const IA_MODELS_STORAGE = 'APPBOGADO_IA_MODELS';     // { gemini, openai, claude }

const IA_PROVIDERS = {
    gemini: {
        id: 'gemini',
        label: 'Google Gemini',
        icon: 'fas fa-star',
        color: '#1a73e8',
        keyHint: 'AIza… (Google AI Studio)',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        keyPrefix: 'AIza',
        models: [
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'RECOMENDADO', badgeColor: '#15803d', desc: 'Rápido, inteligente y económico. Requiere billing.' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', badge: 'MÁS POTENTE', badgeColor: '#6d28d9', desc: 'Máxima capacidad. Mayor latencia y costo.' },
            { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', badge: 'PREVIEW', badgeColor: '#b45309', desc: 'El más rápido de la familia 2.5. En preview.' },
            { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'RETIRO MAR 2026', badgeColor: '#dc2626', desc: 'Funcional hasta el 31 mar 2026.' },
        ],
        defaultModel: 'gemini-2.5-flash',
    },
    openai: {
        id: 'openai',
        label: 'OpenAI (ChatGPT)',
        icon: 'fas fa-robot',
        color: '#10a37f',
        keyHint: 'sk-… (OpenAI Platform)',
        keyUrl: 'https://platform.openai.com/api-keys',
        keyPrefix: 'sk-',
        models: [
            { id: 'gpt-4o', label: 'GPT-4o', badge: 'RECOMENDADO', badgeColor: '#15803d', desc: 'El modelo más capaz de OpenAI. Rápido y multimodal.' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini', badge: 'ECONÓMICO', badgeColor: '#0369a1', desc: 'Muy rápido y económico. Ideal para escritos simples.' },
            { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', badge: 'POTENTE', badgeColor: '#6d28d9', desc: 'GPT-4 de alta velocidad con ventana de 128k tokens.' },
            { id: 'o1-mini', label: 'o1 Mini', badge: 'RAZONAMIENTO', badgeColor: '#7c2d12', desc: 'Optimizado para razonamiento complejo. Más lento.' },
        ],
        defaultModel: 'gpt-4o',
    },
    claude: {
        id: 'claude',
        label: 'Anthropic (Claude)',
        icon: 'fas fa-brain',
        color: '#d97706',
        keyHint: 'sk-ant-… (Anthropic Console)',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        keyPrefix: 'sk-ant-',
        models: [
            { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', badge: 'RECOMENDADO', badgeColor: '#15803d', desc: 'El más equilibrado: inteligente, rápido y económico.' },
            { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', badge: 'MÁS POTENTE', badgeColor: '#6d28d9', desc: 'Máxima capacidad de razonamiento de Anthropic.' },
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', badge: 'ULTRA RÁPIDO', badgeColor: '#0369a1', desc: 'El más veloz y económico de la familia Claude.' },
        ],
        defaultModel: 'claude-sonnet-4-6',
    },
};

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 2 — HELPERS DE CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

function iaGetProvider() {
    try { return AppConfig.get('ia_provider') || 'gemini'; } catch(e) { return 'gemini'; }
}

function iaSetProvider(id) {
    if (!IA_PROVIDERS[id]) return;
    try { AppConfig.set('ia_provider', id); } catch(e) { console.warn('[AppConfig] ia_provider', e.message); }
}

function _iaGetKeyStorage() {
    try { return AppConfig.get('ia_keys') || {}; }
    catch (e) { return {}; }
}

function _iaGetModels() {
    try { return AppConfig.get('ia_models') || {}; }
    catch (e) { return {}; }
}

/** Devuelve la API key descifrada del proveedor activo (o del especificado). */
async function iaGetKey(providerId) {
    const pid = providerId || iaGetProvider();
    const keys = _iaGetKeyStorage();
    let raw = keys[pid] || '';

    // Retrocompatibilidad Gemini: leer key legacy si no hay en el nuevo store
    if (!raw && pid === 'gemini') {
        try { raw = localStorage.getItem('APPBOGADO_GEMINI_KEY') || ''; } catch(e) { raw = ''; }
    }

    if (!raw) return '';

    // Si el valor parece cifrado, descifrarlo; si no (migración desde versión anterior), usarlo tal cual
    return _IACrypto.looksEncrypted(raw) ? await _IACrypto.decrypt(raw) : raw;
}

/** Devuelve el modelo activo del proveedor (o del especificado). */
function iaGetModel(providerId) {
    const pid = providerId || iaGetProvider();
    const models = _iaGetModels();
    if (pid === 'gemini') {
        // Retrocompatibilidad con GEMINI_MODEL_STORAGE legacy
        return models.gemini
            || (() => { try { return localStorage.getItem('APPBOGADO_GEMINI_MODEL'); } catch(e) { return null; } })()
            || IA_PROVIDERS.gemini.defaultModel;
    }
    return models[pid] || IA_PROVIDERS[pid]?.defaultModel || '';
}

async function iaGuardarKeyProvider(providerId, key) {
    const keys = _iaGetKeyStorage();
    const encrypted = await _IACrypto.encrypt(key);
    keys[providerId] = encrypted;
    try { AppConfig.set('ia_keys', keys); } catch(e) { console.warn('[AppConfig] ia_keys', e.message); }
    // Retrocompatibilidad Gemini: también actualizar key legacy (cifrada)
    if (providerId === 'gemini') {
        try { localStorage.setItem('APPBOGADO_GEMINI_KEY', encrypted); } catch(e) { console.warn('[LS] GEMINI_KEY', e.message); }
    }
}

function iaGuardarModelProvider(providerId, modelId) {
    const models = _iaGetModels();
    models[providerId] = modelId;
    try { AppConfig.set('ia_models', models); } catch(e) { console.warn('[AppConfig] ia_models', e.message); }
    // Retrocompatibilidad Gemini
    if (providerId === 'gemini') {
        try { localStorage.setItem('APPBOGADO_GEMINI_MODEL', modelId); } catch(e) { console.warn('[LS] GEMINI_MODEL', e.message); }
    }
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 3 — MOTOR UNIFICADO DE LLAMADAS IA
// iaCall(prompt) → usa el proveedor activo automáticamente
// ═══════════════════════════════════════════════════════════════════

async function iaCall(prompt, opts = {}) {
    const providerId = opts.provider || iaGetProvider();
    const key = opts.key || await iaGetKey(providerId);
    const model = opts.model || iaGetModel(providerId);

    if (!key) throw new Error(`No hay API Key configurada para ${IA_PROVIDERS[providerId]?.label || providerId}. Vaya a Sistema → Configurar IA.`);

    switch (providerId) {
        case 'gemini': return _iaCallGemini(prompt, key, model);
        case 'openai': return _iaCallOpenAI(prompt, key, model);
        case 'claude': return _iaCallClaude(prompt, key, model);
        default: throw new Error(`Proveedor IA desconocido: ${providerId}`);
    }
}

// Mantener geminiCall como alias para retrocompatibilidad con módulos existentes
async function geminiCall(prompt, keyOverride) {
    return iaCall(prompt, {
        provider: 'gemini',
        key: keyOverride || await iaGetKey('gemini'),
    });
}

// ── Gemini ────────────────────────────────────────────────────────
async function _iaCallGemini(prompt, key, model) {
    const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    // Orden de fallback: modelo activo primero, luego el resto
    const catalog = IA_PROVIDERS.gemini.models.map(m => m.id);
    const order = [model, ...catalog.filter(id => id !== model)];
    let lastError = null;

    for (const m of order) {
        const url = `${GEMINI_API_BASE}/${m}:generateContent?key=${key}`;
        let resp;
        try {
            resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
                }),
            });
        } catch (e) {
            throw new Error('Error de red al conectar con Gemini. Verifique su conexión a internet.');
        }

        if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
            if (resp.status === 429 || resp.status === 404) {
                lastError = Object.assign(new Error(errMsg), { status: resp.status });
                continue;
            }
            if (resp.status === 403) throw new Error(`Acceso denegado (403). La API key no tiene permisos para Gemini.`);
            throw new Error(errMsg);
        }

        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini.');
}

// ── OpenAI ────────────────────────────────────────────────────────
async function _iaCallOpenAI(prompt, key, model) {
    let resp;
    try {
        resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 4000,
            }),
        });
    } catch (e) {
        throw new Error('Error de red al conectar con OpenAI. Verifique su conexión a internet.');
    }

    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429) {
            const err = new Error(`Cuota de OpenAI excedida (429). Verifique su límite de uso en platform.openai.com.`);
            err.status = 429; throw err;
        }
        if (resp.status === 401) throw new Error(`API Key de OpenAI inválida o expirada (401). Verifique en platform.openai.com/api-keys.`);
        throw new Error(errMsg);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic Claude ──────────────────────────────────────────────
async function _iaCallClaude(prompt, key, model) {
    let resp;
    try {
        resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
    } catch (e) {
        throw new Error('Error de red al conectar con Anthropic. Verifique su conexión a internet.');
    }

    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429) {
            const err = new Error(`Cuota de Anthropic excedida (429). Verifique su límite en console.anthropic.com.`);
            err.status = 429; throw err;
        }
        if (resp.status === 401) throw new Error(`API Key de Anthropic inválida (401). Verifique en console.anthropic.com/settings/keys.`);
        throw new Error(errMsg);
    }

    const data = await resp.json();
    // Anthropic devuelve array de content blocks
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('') || '';
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 4 — UI DE CONFIGURACIÓN MULTI-PROVEEDOR
// Reemplaza las funciones de config de 09-app-core para Gemini solo
// ═══════════════════════════════════════════════════════════════════

let _iaProviderTab = iaGetProvider(); // tab activo en la UI

/** Renderiza la sección completa de config-ia con tabs de proveedores */
async function iaRenderConfigUI() {
    const section = document.getElementById('ia-config-container');
    if (!section) return;

    const providerActivo = iaGetProvider();

    // Pre-cargar estados de keys (async) para el render de tabs
    const _keyStates = {};
    for (const pid of Object.keys(IA_PROVIDERS)) {
        _keyStates[pid] = !!(await iaGetKey(pid));
    }

    section.innerHTML = `
            <div style="max-width:1100px; display:grid; grid-template-columns: 1fr 340px; gap:24px; width:100%; align-items: start; margin: 0 auto;">
                
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- SELECTOR DE PROVEEDOR -->
                    <div class="card" style="border-top: 4px solid var(--cyan); padding: 24px;">
                        <h3 style="display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:1.1rem;">
                            <i class="fas fa-plug" style="color:var(--cyan);"></i> 
                            Proveedor de Inteligencia Artificial
                        </h3>
                        <p style="font-size:13px; color:var(--text-3); margin-bottom:20px; line-height:1.6;">
                            Seleccione el motor de IA para procesar documentos, redactar escritos y asistir en el chat.
                        </p>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;" id="ia-provider-cards">
                            ${Object.values(IA_PROVIDERS).map(p => {
        const isActive = p.id === providerActivo;
        const hasKey = _keyStates[p.id];
        return `
                            <label class="card-provider ${isActive ? 'active' : ''}" style="
                                display:flex; flex-direction:column; align-items:center; gap:12px; padding:20px; border-radius:16px;
                                border: 2px solid ${isActive ? p.color : 'var(--border)'};
                                background: ${isActive ? p.color + '08' : 'var(--bg-card)'};
                                cursor:pointer; position:relative; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align:center;
                                box-shadow: ${isActive ? '0 10px 20px ' + p.color + '15' : 'var(--sh-1)'};">
                                <input type="radio" name="ia-provider-radio" value="${p.id}"
                                    ${isActive ? 'checked' : ''}
                                    onchange="iaSetProvider('${p.id}'); _iaProviderTab='${p.id}'; iaRenderConfigUI();"
                                    style="display:none;">
                                <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px; background:${p.color}15; box-shadow: inset 0 0 0 1px ${p.color}20;">
                                    <i class="${p.icon}" style="font-size:1.6rem; color:${p.color};"></i>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <span style="font-size:14.5px; font-weight:700; color:var(--text);">${p.label}</span>
                                    ${isActive ?
                `<span style="font-size:10px; font-weight:800; color:${p.color}; text-transform:uppercase; letter-spacing:1px; margin-top:4px;">Seleccionado</span>` :
                `<span style="font-size:11.5px; color:${hasKey ? 'var(--success)' : 'var(--text-3)'}; font-weight:500;">
                                            ${hasKey ? '<i class="fas fa-check-circle"></i> Configurado' : 'Pendiente'}
                                        </span>`
            }
                                </div>
                            </label>`;
    }).join('')}
                        </div>
                    </div>

                    <!-- CONFIGURACIÓN DEL PROVEEDOR ACTIVO -->
                    ${await _iaRenderProviderCard(providerActivo)}
                </div>

                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- FUNCIONES DISPONIBLES -->
                    <div class="card" style="padding: 24px; border-left: 4px solid var(--cyan);">
                        <h3 style="font-size:16px; margin-bottom:18px; color:var(--text); display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-magic" style="color:var(--cyan);"></i> Capacidades
                        </h3>
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            ${[
            ['fa-pen-nib',       'Redacción Legal',    'Escritos adaptados a la causa.'],
            ['fa-book',          'Jurisprudencia IA',  'Búsqueda y análisis de fallos chilenos.'],
            ['fa-graduation-cap','Doctrina Legal',     'Consulta doctrinal con autores nacionales.'],
            ['fa-file-alt',      'Informes Word/PDF',  'Genera documentos descargables con IA.'],
            ['fa-file-search',   'Análisis de ROL',    'Extracción de hitos y fallos.'],
            ['fa-comments',      'LexBot Chat',        'Asistente con contexto jurídico.'],
        ].map(([icon, title, desc]) => `
                            <div style="display:flex; align-items:center; gap:14px;">
                                <div style="min-width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:var(--bg-2); border-radius:10px;">
                                    <i class="fas ${icon}" style="color:var(--cyan); font-size:1.1rem;"></i>
                                </div>
                                <div>
                                    <div style="font-size:13.5px; font-weight:700; color:var(--text);">${title}</div>
                                    <div style="font-size:12px; color:var(--text-3);">${desc}</div>
                                </div>
                            </div>`).join('')}
                        </div>
                        
                        <div style="margin-top:16px; padding:14px; background:linear-gradient(135deg,#faf5ff,#f5f3ff); border:1px solid #e9d5ff; border-radius:12px;">
                            <div style="font-size:11px; font-weight:700; color:#5b21b6; margin-bottom:10px; letter-spacing:0.04em; text-transform:uppercase;">Accesos Rápidos IA</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                <button onclick="typeof clAbrirBusquedaJuris!=='undefined'&&clAbrirBusquedaJuris()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:white;border:1px solid #e9d5ff;border-radius:8px;cursor:pointer;font-size:0.72rem;font-weight:700;color:#4c1d95;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='white'"><i class="fas fa-book" style="color:#7c3aed;"></i>Jurisprudencia</button>
                                <button onclick="typeof clAbrirDoctrina!=='undefined'&&clAbrirDoctrina()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:white;border:1px solid #e9d5ff;border-radius:8px;cursor:pointer;font-size:0.72rem;font-weight:700;color:#4c1d95;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='white'"><i class="fas fa-graduation-cap" style="color:#7c3aed;"></i>Doctrina</button>
                                <button onclick="typeof clMejorarEscritoActual!=='undefined'&&clMejorarEscritoActual()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:white;border:1px solid #e9d5ff;border-radius:8px;cursor:pointer;font-size:0.72rem;font-weight:700;color:#4c1d95;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='white'"><i class="fas fa-magic" style="color:#7c3aed;"></i>Mejorar Escrito</button>
                                <button onclick="typeof clToggleIframe!=='undefined'&&clToggleIframe()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:white;border:1px solid #e9d5ff;border-radius:8px;cursor:pointer;font-size:0.72rem;font-weight:700;color:#4c1d95;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='white'"><i class="fas fa-robot" style="color:#7c3aed;"></i>Claude.ai</button>
                            </div>
                        </div>
                        <div style="margin-top:14px; padding:14px; background:rgba(245, 158, 11, 0.05); border:1px solid rgba(245, 158, 11, 0.2); border-radius:14px; font-size:12.5px; color:#d97706; line-height:1.5;">
                            <i class="fas fa-shield-virus" style="margin-bottom:8px; font-size:1.2rem; display:block;"></i>
                            <strong>Validación Requerida:</strong>
                            Las respuestas deben ser supervisadas por el profesional. La IA asiste, no decide.
                        </div>
                    </div>

                    <!-- DRIVE CONFIG PANEL (Placeholder context) -->
                    <div id="drive-config-panel-inner" class="card" style="padding: 24px;">
                        <h3 style="font-size:16px; margin-bottom:14px; color:var(--text); display:flex; align-items:center; gap:10px;">
                            <i class="fab fa-google-drive" style="color:#34a853;"></i> Google Drive
                        </h3>
                        <p style="font-size:13px; color:var(--text-3); line-height:1.5; margin-bottom:15px;">
                            Vincule su cuenta para respaldar expedientes y documentos.
                        </p>
                        <button class="btn btn-full" style="background:#e8f5e9; color:#2e7d32; border:1px solid #c8e6c9;">
                            Conectar Cloud
                        </button>
                    </div>
                </div>

            </div>`;
}

async function _iaRenderProviderCard(pid) {
    const p = IA_PROVIDERS[pid];
    const key = await iaGetKey(pid);
    const mod = iaGetModel(pid);
    if (!p) return '';

    return `
            <div class="card" style="box-shadow:var(--sh-2);">
                <h3 style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
                    <i class="${p.icon}" style="color:${p.color};"></i>
                    ${p.label} <span style="font-weight:400; color:var(--text-3); margin-left:5px;">— Configuración</span>
                </h3>

                <!-- AVISO PRIVACIDAD -->
                <div style="padding:12px 16px; background:var(--success-bg); border:1px solid var(--success-border); border-radius:var(--r-lg); font-size:12.5px; color:var(--success); margin-bottom:20px; display:flex; gap:12px; align-items:center;">
                    <i class="fas fa-lock-alt" style="font-size:1.2rem;"></i>
                    <div>
                        <strong>Privacidad Local:</strong>
                        Sus llaves se cifran en el navegador. AppBogado no almacena ni visualiza sus API Keys.
                    </div>
                </div>

                <!-- API KEY -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12.5px; font-weight:700; color:var(--text);">
                        API Key vinculada
                    </label>
                    <a href="${p.keyUrl}" target="_blank" style="color:${p.color}; font-size:11.5px; font-weight:600; text-decoration:none;">
                        <i class="fas fa-external-link-square-alt"></i> Obtener key oficial
                    </a>
                </div>
                <div style="display:flex; gap:8px; margin-top:6px;">
                    <input type="password" id="ia-key-input-${pid}"
                        placeholder="${p.keyHint}"
                        value="${key ? '••••••••••••••••' : ''}"
                        style="flex:1; font-family:'IBM Plex Mono',monospace; font-size:13px;"
                        onfocus="if(this.value.startsWith('•'))this.value='';">
                    <button class="btn btn-sm" style="background:var(--bg);"
                        onclick="_iaToggleVerKey('${pid}')">
                        <i class="fas fa-eye" id="ia-eye-${pid}"></i>
                    </button>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:20px;">
                    <button class="btn btn-p" style="padding:10px 20px; font-weight:700; min-width:140px;" onclick="_iaGuardarKeyUI('${pid}')">
                        <i class="fas fa-save" style="margin-right:6px;"></i> Guardar Cambios
                    </button>
                    <button class="btn btn-secondary" style="background:var(--bg); border:1px solid var(--border); border-radius:var(--r-md); cursor:pointer; padding:0 15px; display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-2); transition:all 0.15s;"
                        onclick="_iaTestKeyUI('${pid}')">
                        <i class="fas fa-bolt" style="color:var(--cyan);"></i> Probar
                    </button>
                    <button class="btn btn-d" style="padding:0 15px;" onclick="_iaEliminarKeyUI('${pid}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div id="ia-status-${pid}" style="margin-top:12px; min-height:18px;"></div>

                <!-- MODELOS -->
                <div style="margin-top:20px;">
                    <label style="font-size:13px; font-weight:700; color:var(--text); display:block; margin-bottom:12px;">
                        Selección de Modelo Inteligente
                    </label>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:12px;">
                        ${p.models.map(m => {
        const isSel = m.id === mod;
        return `
                        <label class="ia-model-card" style="
                            display:grid;
                            grid-template-columns:auto 1fr;
                            align-items:center;
                            gap:14px;
                            padding:16px;
                            border:2px solid ${isSel ? p.color : 'var(--border)'};
                            border-radius:var(--r-lg);
                            cursor:pointer;
                            background:${isSel ? p.color + '05' : 'var(--bg-card)'};
                            transition:all 0.2s;
                            position:relative;
                            overflow:hidden;">
                            <input type="radio" name="ia-model-${pid}" value="${m.id}"
                                ${isSel ? 'checked' : ''}
                                onchange="iaGuardarModelProvider('${pid}','${m.id}'); iaRenderConfigUI();"
                                style="width:18px; height:18px; accent-color:${p.color};">
                            <div style="min-width:0;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                    <span style="font-size:14px; font-weight:800; color:var(--text);">${m.label}</span>
                                    <span style="font-size:10px; font-weight:700; text-transform:uppercase;
                                        background:${m.badgeColor}15; color:${m.badgeColor};
                                        padding:2px 8px; border-radius:var(--r-full); border:1px solid ${m.badgeColor}30;">
                                        ${m.badge}
                                    </span>
                                </div>
                                <div style="font-size:12.5px; color:var(--text-2); margin-bottom:5px; line-height:1.4;">${m.desc}</div>
                                <div style="font-size:11px; font-family:'IBM Plex Mono',monospace; color:var(--text-3); opacity:0.8;">${m.id}</div>
                            </div>
                            ${isSel ? `<div style="position:absolute; top:0; right:0; width:0; height:0; border-style:solid; border-width:0 30px 30px 0; border-color:transparent ${p.color} transparent transparent;"></div>
                                       <i class="fas fa-check" style="position:absolute; top:4px; right:4px; font-size:10px; color:white;"></i>` : ''}
                        </label>`;
    }).join('')}
                    </div>
                </div>
            </div>`;
}

async function _iaToggleVerKey(pid) {
    const inp = document.getElementById(`ia-key-input-${pid}`);
    const icon = document.getElementById(`ia-eye-${pid}`);
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        // Mostrar key real descifrada si está guardada
        const k = await iaGetKey(pid);
        if (k) inp.value = k;
        if (icon) icon.className = 'fas fa-eye-slash';
    } else {
        inp.type = 'password';
        if (icon) icon.className = 'fas fa-eye';
    }
}

function _iaGuardarKeyUI(pid) {
    const inp = document.getElementById(`ia-key-input-${pid}`);
    if (!inp) return;
    const key = inp.value.trim();
    if (!key || key.startsWith('•')) { showError('Ingrese una API Key válida.'); return; }
    iaGuardarKeyProvider(pid, key);
    const st = document.getElementById(`ia-status-${pid}`);
    if (st) st.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> API Key de ${IA_PROVIDERS[pid]?.label} guardada.</span>`;
    registrarEvento(`API Key de ${IA_PROVIDERS[pid]?.label} configurada.`);
    setTimeout(() => iaRenderConfigUI(), 1500);
}

function _iaEliminarKeyUI(pid) {
    showConfirm(`Eliminar API Key`, `¿Eliminar la API Key de ${IA_PROVIDERS[pid]?.label}?`, () => {
        const keys = _iaGetKeyStorage();
        delete keys[pid];
        try { AppConfig.set('ia_keys', keys); } catch(e) { console.warn('[AppConfig] ia_keys', e.message); }
        if (pid === 'gemini') { try { localStorage.removeItem('APPBOGADO_GEMINI_KEY'); } catch(e) { console.warn('[LS] removeItem GEMINI_KEY', e.message); } }
        showSuccess(`API Key de ${IA_PROVIDERS[pid]?.label} eliminada.`);
        iaRenderConfigUI();
    }, 'danger');
}

async function _iaTestKeyUI(pid) {
    const inp = document.getElementById(`ia-key-input-${pid}`);
    const st = document.getElementById(`ia-status-${pid}`);
    if (!st) return;

    const key = (inp?.value && !inp.value.startsWith('•')) ? inp.value.trim() : await iaGetKey(pid);
    if (!key) { showError('Ingrese o guarde primero una API Key.'); return; }

    const model = iaGetModel(pid);
    st.innerHTML = `<span style="color:var(--blue);"><i class="fas fa-spinner fa-spin"></i> Probando conexión con ${IA_PROVIDERS[pid]?.label} · ${model}…</span>`;

    try {
        await iaCall('Responde solo con la palabra: OK', { provider: pid, key, model });
        st.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Conexión exitosa con <strong>${model}</strong> ✓</span>`;
    } catch (e) {
        const msg = e.message || '';
        const es429 = e.status === 429 || msg.includes('429');
        const es401 = e.status === 401 || msg.includes('401');
        if (es429) {
            st.innerHTML = `<span style="color:var(--warning);"><i class="fas fa-exclamation-triangle"></i> <strong>Cuota excedida (429).</strong> Revise su plan y límites en el panel de ${IA_PROVIDERS[pid]?.label}.</span>`;
        } else if (es401) {
            st.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> <strong>API Key inválida (401).</strong> Verifique que la key sea correcta y esté activa.</span>`;
        } else {
            st.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Error: ${_iaEscHtml(msg)}</span>`;
        }
    }
}

// Llamar al navegar a config-ia para inicializar la nueva UI
function iaCargarKeyEnInput() {
    iaRenderConfigUI();
    if (typeof GoogleDrive !== 'undefined' && typeof GoogleDrive.renderConfigPanel === 'function') {
        GoogleDrive.renderConfigPanel();
    }
}
// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 5 — SINCRONIZACIÓN CON LA UI DE ESCRITOS
// ═══════════════════════════════════════════════════════════════════

/** Actualiza el label del proveedor activo en el toggle de escritos */
function iaSyncEscritosLabel() {
    const el = document.getElementById('esc-ia-provider-label');
    if (!el) return;
    const pid = iaGetProvider();
    const pLabel = IA_PROVIDERS[pid]?.label || 'IA';
    el.textContent = pLabel;
}

// Sincronizar al cargar la página
document.addEventListener('DOMContentLoaded', iaSyncEscritosLabel);
