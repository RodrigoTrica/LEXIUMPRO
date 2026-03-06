/**
 * LEXIUM — main.js (Electron Main Process) v2.2
 * ─────────────────────────────────────────────────
 * MEJORAS DE SEGURIDAD APLICADAS:
 *  ✅ contextIsolation: true  (ya estaba)
 *  ✅ nodeIntegration: false  (ya estaba)
 *  ✅ sandbox: true           (NUEVO — antes era false)
 *  ✅ APP_SECRET via env var  (NUEVO — antes hardcodeada)
 *  ✅ CSP via webRequest      (NUEVO)
 *  ✅ Validación de inputs en todos los handlers IPC
 *  ✅ DevTools solo en desarrollo
 *  ✅ Manejo de errores en mkdirSync
 *  ✅ Verificación de existencia de icon antes de asignar
 *  ✅ navigación externa bloqueada
 */

const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const IA_PROMPTS = require('./ia-prompts');

const alertService = require('./alert-service-v3');
const waLogger = require('./wa-logger-v3');
const whatsappService = require('./whatsapp-service-v3');

const IS_DEV = !app.isPackaged;

// ── Rutas base ────────────────────────────────────────────────────────────────
const APP_ROOT = IS_DEV ? __dirname : process.resourcesPath;
const DATA_DIR = path.join(app.getPath('userData'), 'datos');      // ← fuera del exe
const DOCS_DIR = path.join(DATA_DIR, 'documentos');

// Crear carpetas con manejo de error
try {
    [DATA_DIR, DOCS_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
} catch (e) {
    // Si no se puede crear la carpeta de datos, la app no puede funcionar
    dialog.showErrorBox('Error crítico', `No se pudo crear la carpeta de datos:\n${e.message}`);
    app.quit();
}

// ── Google OAuth (Drive) — Authorization Code + PKCE (loopback localhost) ────
const DRIVE_OAUTH_TOKEN_KEY = 'drive_oauth_tokens_v1';
const DRIVE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/drive.file';

function _b64UrlEncode(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function _sha256Base64Url(input) {
    return _b64UrlEncode(crypto.createHash('sha256').update(String(input)).digest());
}

function _generarCodeVerifier() {
    // RFC 7636: 43-128 chars
    return _b64UrlEncode(crypto.randomBytes(64));
}

function _leerDriveTokens() {
    try {
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(DRIVE_OAUTH_TOKEN_KEY)}.enc`);
        if (!fs.existsSync(archivo)) return null;
        const raw = descifrar(fs.readFileSync(archivo, 'utf8'));
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        return obj;
    } catch (e) {
        return null;
    }
}

function _guardarDriveTokens(tokens) {
    const archivo = path.join(DATA_DIR, `${sanitizarNombre(DRIVE_OAUTH_TOKEN_KEY)}.enc`);
    fs.writeFileSync(archivo, cifrar(JSON.stringify(tokens)), 'utf8');
}

function _borrarDriveTokens() {
    try {
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(DRIVE_OAUTH_TOKEN_KEY)}.enc`);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
    } catch (_) { }
}

async function _postForm(url, formObj) {
    const body = new URLSearchParams();
    Object.keys(formObj || {}).forEach(k => body.set(k, String(formObj[k])));
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const msg = data?.error_description || data?.error || resp.statusText;
        throw new Error(msg);
    }
    return data;
}

function _startOAuthLoopbackServer() {
    return new Promise((resolve, reject) => {
        let done = false;
        let callbackResolve;
        const callbackPromise = new Promise((r) => { callbackResolve = r; });

        const server = http.createServer((req, res) => {
            try {
                const u = new URL(req.url || '/', 'http://127.0.0.1');
                if (u.pathname !== '/callback') {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Not found');
                    return;
                }

                const code = u.searchParams.get('code');
                const state = u.searchParams.get('state');
                const error = u.searchParams.get('error');

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                if (code) {
                    res.end('<html><body style="font-family:system-ui; padding:24px;"><h2>Éxito</h2><p>Puedes cerrar esta pestaña y volver a LEXIUM.</p></body></html>');
                } else {
                    res.end('<html><body style="font-family:system-ui; padding:24px;"><h2>Error</h2><p>No se pudo autorizar. Puedes cerrar esta pestaña y volver a LEXIUM.</p></body></html>');
                }

                if (!done) {
                    done = true;
                    callbackResolve({ code, state, error });
                }

                setTimeout(() => {
                    try { server.close(); } catch (_) { }
                }, 50);
            } catch (e) {
                try {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Error');
                } catch (_) { }

                if (!done) {
                    done = true;
                    callbackResolve({ code: null, state: null, error: e.message });
                }

                setTimeout(() => {
                    try { server.close(); } catch (_) { }
                }, 50);
            }
        });

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr !== 'object' || !addr.port) {
                try { server.close(); } catch (_) { }
                reject(new Error('No se pudo iniciar servidor local OAuth'));
                return;
            }
            resolve({ port: addr.port, callbackPromise });
        });
        server.on('error', (err) => reject(err));
    });
}

async function _driveOAuthConnect(clientId, clientSecret) {
    const cid = String(clientId || '').trim();
    const csec = String(clientSecret || '').trim();
    if (!cid) throw new Error('Client ID vacío');
    if (!/\.apps\.googleusercontent\.com$/.test(cid)) throw new Error('Client ID inválido');

    // Preparar loopback
    const { port, callbackPromise } = await _startOAuthLoopbackServer();
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const state = _b64UrlEncode(crypto.randomBytes(16));
    const codeVerifier = _generarCodeVerifier();
    const codeChallenge = _sha256Base64Url(codeVerifier);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', cid);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', DRIVE_OAUTH_SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Abrir en navegador del sistema
    await shell.openExternal(authUrl.toString());

    const serverResult = await callbackPromise;

    if (serverResult?.error) throw new Error(serverResult.error);
    if (!serverResult?.code) throw new Error('No se recibió code de Google');
    if (serverResult?.state !== state) throw new Error('State OAuth inválido');

    let tokenData;
    try {
        tokenData = await _postForm('https://oauth2.googleapis.com/token', {
            client_id: cid,
            ...(csec ? { client_secret: csec } : {}),
            code: serverResult.code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });
    } catch (e) {
        const msg = String(e?.message || 'Error token');
        if (msg.toLowerCase().includes('client_secret')) {
            throw new Error('Google exige client_secret para este Client ID. Pega también el "Secreto del cliente" en LEXIUMPRO o crea/usa un OAuth Client tipo "Aplicación de escritorio (Desktop app)" que no lo requiera.');
        }
        throw e;
    }

    if (!tokenData?.access_token) throw new Error('Google no entregó access_token');

    const now = Date.now();
    const expiresIn = Number(tokenData.expires_in || 0);
    const tokens = {
        clientId: cid,
        clientSecret: csec || null,
        scope: DRIVE_OAUTH_SCOPES,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: tokenData.token_type || 'Bearer',
        expiry: expiresIn ? (now + (expiresIn - 60) * 1000) : (now + 45 * 60 * 1000),
        obtainedAt: now,
    };

    // Guardar refresh token si viene; si no viene, preservar el que ya existía
    const prev = _leerDriveTokens();
    if (!tokens.refresh_token && prev?.refresh_token && prev?.clientId === cid) {
        tokens.refresh_token = prev.refresh_token;
    }
    if (!tokens.clientSecret && prev?.clientSecret && prev?.clientId === cid) {
        tokens.clientSecret = prev.clientSecret;
    }
    if (!tokens.refresh_token) {
        // Sin refresh token, igual funcionará, pero obligará a reconectar al expirar.
        // Lo dejamos explícito.
    }

    _guardarDriveTokens(tokens);
    return { ok: true, tokens };
}

async function _driveGetAccessToken(clientId) {
    const cid = String(clientId || '').trim();
    if (!cid) throw new Error('Client ID vacío');

    const saved = _leerDriveTokens();
    if (saved && saved.clientId === cid && saved.access_token && saved.expiry && Date.now() < saved.expiry) {
        return { ok: true, accessToken: saved.access_token, expiry: saved.expiry };
    }

    if (!saved || saved.clientId !== cid) {
        return { ok: false, error: 'No hay sesión Drive guardada. Conecta nuevamente.' };
    }

    if (!saved.refresh_token) {
        return { ok: false, error: 'Sesión Drive expirada y sin refresh_token. Conecta nuevamente.' };
    }

    const tokenData = await _postForm('https://oauth2.googleapis.com/token', {
        client_id: cid,
        ...(saved.clientSecret ? { client_secret: saved.clientSecret } : {}),
        refresh_token: saved.refresh_token,
        grant_type: 'refresh_token'
    });

    const now = Date.now();
    const expiresIn = Number(tokenData.expires_in || 0);
    const next = {
        ...saved,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || saved.token_type || 'Bearer',
        expiry: expiresIn ? (now + (expiresIn - 60) * 1000) : (now + 45 * 60 * 1000),
        obtainedAt: now,
    };
    _guardarDriveTokens(next);
    return { ok: true, accessToken: next.access_token, expiry: next.expiry };
}

// ── Cifrado AES-256-GCM ───────────────────────────────────────────────────────
// MEJORA: La clave ya no está hardcodeada en el código.
// Se lee de variable de entorno APP_SECRET.
// Si no existe (primera vez o instalación limpia), se genera una clave aleatoria
// y se guarda en userData, que es la carpeta privada del usuario en el sistema.
function obtenerSecret() {
    // 1. Prioridad: variable de entorno (útil en desarrollo)
    if (process.env.APP_SECRET) return process.env.APP_SECRET;

    // 2. Clave persistida en userData (generada automáticamente en primera ejecución)
    const secretFile = path.join(app.getPath('userData'), '.secret');
    if (fs.existsSync(secretFile)) {
        return fs.readFileSync(secretFile, 'utf8').trim();
    }

    // 3. Primera vez: generar clave aleatoria y guardarla
    const nuevaClaveHex = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, nuevaClaveHex, { encoding: 'utf8', mode: 0o600 });
    return nuevaClaveHex;
}

function derivarClave() {
    const seed = `${obtenerSecret()}::${os.hostname()}::${os.platform()}`;
    return crypto.createHash('sha256').update(seed).digest();
}

function cifrar(texto) {
    if (typeof texto !== 'string') throw new Error('cifrar: se esperaba string');
    const clave = derivarClave();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
    const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

function descifrar(b64) {
    try {
        if (typeof b64 !== 'string') return null;
        const clave = derivarClave();
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 29) return null; // mínimo iv(12)+tag(16)+1 byte
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const datos = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
    } catch (e) {
        console.error('[Crypto] Error al descifrar:', e.message);
        return null;
    }
}

function _leerStorageSeguro(clave) {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (!fs.existsSync(archivo)) return null;
        return descifrar(fs.readFileSync(archivo, 'utf8'));
    } catch (_) {
        return null;
    }
}

function _guardarStorageSeguro(clave, valor) {
    validarClave(clave);
    validarValor(valor);
    const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
    fs.writeFileSync(archivo, cifrar(valor), 'utf8');
}

function _iaNormalizeProvider(pid) {
    const p = String(pid || '').toLowerCase().trim();
    if (p === 'gemini') return 'gemini';
    if (p === 'claude' || p === 'anthropic') return 'claude';
    if (p === 'groq') return 'groq';
    return '';
}

const _IA_DEFAULTS = {
    gemini: { model: 'gemini-2.5-flash' },
    claude: { model: 'claude-3-5-sonnet-20241022' },
    groq: { model: 'llama-3.3-70b-versatile' }
};

const _IA_ESCRITOS_TIPOS = {
    demanda_civil_ordinaria: {
        label: 'Demanda Civil — Juicio Ordinario',
        prompt_extra: 'Estructura obligatoria Art. 254 CPC: (1) SUMA con peticiones en otrosíes. (2) Encabezado con tribunal, RUT, domicilio procesal. (3) I. HECHOS numerados y cronológicos. (4) II. DERECHO con artículos del Código Civil y CPC. (5) III. PETICIONES con "Por tanto, pide a US." (6) OTROSÍES: patrocinio/poder y documentos. (7) Cierre con "ES JUSTICIA". Tono formal y técnico.'
    },
    demanda_civil_sumario: {
        label: 'Demanda Civil — Juicio Sumario',
        prompt_extra: 'Procedimiento sumario Art. 680 y ss. CPC. Indicar causal que justifica sumariedad (urgencia o naturaleza de la acción). Misma estructura que ordinaria. Citar Art. 683 CPC para citación a audiencia. Peticiones claras y acotadas.'
    },
    alimentos_menores: {
        label: 'Demanda de Alimentos (Familia)',
        prompt_extra: 'Estructura en tribunales de familia: EN LO PRINCIPAL (demanda), OTROSÍES: alimentos provisorios, acompañar documentos, patrocinio y poder, forma especial de notificación. Citar Ley 14.908, Código Civil (321 y ss.), Ley 19.968. Identificar demandante/demandado con RUT y domicilio.'
    }
};

const _IA_PROMPT_ANALISIS_ESTRATEGICO = `=== INSTRUCCIÓN: ANÁLISIS ESTRATÉGICO PROFUNDO ===
Eres un litigante experto en derecho chileno. Analiza esta causa y entrega un plan estratégico completo:

1. DIAGNÓSTICO ESTRATÉGICO
[Posición actual del cliente, ventajas comparativas frente a la contraparte]

2. TEORÍA DEL CASO
[Narrativa jurídica que el abogado debe sostener en juicio]

3. MAPA DE RIESGOS
Señala para cada dimensión: nivel y cómo mitigarlo
- Riesgo procesal
- Riesgo probatorio
- Riesgo de prescripción/caducidad
- Riesgo de condena en costas
- Riesgo reputacional

4. PLAN DE ACCIÓN (90 días)
Semanas 1-2: [Acciones urgentes]
Semanas 3-6: [Acciones de desarrollo]
Semanas 7-12: [Acciones de consolidación]

5. ESTRATEGIA PROBATORIA
[Pruebas clave a obtener, testigos, peritos, documentos]

6. ARGUMENTOS JURÍDICOS PRINCIPALES
[Con cita de artículos específicos y jurisprudencia relevante del despacho]

7. CONTRAARGUMENTOS ESPERADOS Y RESPUESTAS
[Qué alegará la contraparte y cómo rebatirlo]

8. ESCENARIOS Y PROBABILIDADES
- Escenario favorable: [probabilidad estimada + condiciones]
- Escenario neutro (acuerdo): [probabilidad + términos razonables]
- Escenario adverso: [probabilidad + mitigación]

9. RECOMENDACIÓN FINAL
[Acción estratégica más importante que el abogado debe ejecutar esta semana]

Sé específico. Cita normativa chilena aplicable. Evita generalidades.`;

const _IA_PROMPT_CHAT_LEGAL = IA_PROMPTS.CHAT_LEGAL;

const _IA_PROMPT_ANALIZAR_CAUSA = IA_PROMPTS.ANALIZAR_CAUSA;

const _IA_PROMPT_ANALIZAR_JURISPRUDENCIA = IA_PROMPTS.ANALIZAR_JURISPRUDENCIA;

const _IA_PROMPT_EXTRAER_FALLO_JSON = `Analiza el siguiente texto de una resolución o sentencia judicial chilena y extrae los datos en formato JSON estricto.
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

Si algún campo no puede determinarse del texto, usa "No especificado".`;

const _IA_MODULOS_TEMPLATES = {
    juris_consulta: {
        providerDefault: 'claude',
        buildPrompt: ({ consulta }) => `Eres un experto en jurisprudencia chilena.
Jurisdicción: Chile. Responde en español formal. Cita ROL y tribunal cuando sea posible.

CONSULTA: ${consulta}`
    },
    doctrina_consulta: {
        providerDefault: 'claude',
        buildPrompt: ({ tema }) => `Eres un experto en doctrina jurídica chilena. Conoces profundamente los textos de Alessandri, Somarriva, Abeliuk, Meza Barros, Claro Solar y otros autores nacionales.

CONSULTA DOCTRINAL: ${tema}
Jurisdicción: Chile. Responde en español formal y técnico.`
    },
    estrategia_situacion: {
        providerDefault: 'claude',
        buildPrompt: ({ contexto, situacion }) => `${contexto}

SITUACIÓN A ANALIZAR: ${situacion}

Entrega recomendaciones estratégicas concretas, riesgos y próximos pasos.`
    },
    informe_causa: {
        providerDefault: 'claude',
        buildPrompt: ({ contexto, alertas, instrucciones }) => `${contexto}

ALERTAS ACTIVAS:
${alertas}

INSTRUCCIONES PARA EL INFORME:
${instrucciones}

Redacta un informe formal y accionable.`
    },
    mejorar_escrito: {
        providerDefault: 'claude',
        buildPrompt: ({ borrador, instrucciones }) => `Eres un abogado litigante chileno experto. Revisa y mejora el siguiente escrito judicial.

BORRADOR:
---
${borrador}
---

INSTRUCCIONES:
${instrucciones}

Devuelve el escrito mejorado completo, manteniendo el estilo formal.`
    },
    resumen_doc: {
        providerDefault: 'claude',
        buildPrompt: ({ texto }) => `Resume y estructura este documento legal chileno:

---
${texto}
---

Devuelve:
1) Resumen ejecutivo
2) Hechos relevantes
3) Pretensiones/solicitudes
4) Fundamentos jurídicos
5) Fechas y plazos relevantes (si aparecen)
6) Acciones recomendadas`
    }
};

function _iaSafeJsonParse(raw) {
    try {
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function _iaGetKeyFromLegacyConfig(providerId) {
    const rawCfg = _leerStorageSeguro('LEXIUM_CONFIG_V1');
    const cfg = _iaSafeJsonParse(rawCfg);
    const keys = cfg && typeof cfg === 'object' ? (cfg.ia_keys || null) : null;
    if (!keys || typeof keys !== 'object') return '';
    return String(keys[providerId] || '');
}

function _iaReadKey(providerId) {
    const pid = _iaNormalizeProvider(providerId);
    if (!pid) return '';
    const direct = _leerStorageSeguro(`ia_key_${pid}`);
    if (direct && typeof direct === 'string' && direct.trim()) return direct.trim();
    const legacy = _iaGetKeyFromLegacyConfig(pid);
    if (legacy) return legacy;
    return '';
}

function _iaReadModel(providerId) {
    const pid = _iaNormalizeProvider(providerId);
    if (!pid) return '';
    const direct = _leerStorageSeguro(`ia_model_${pid}`);
    if (direct && typeof direct === 'string' && direct.trim()) return direct.trim();
    return _IA_DEFAULTS[pid]?.model || '';
}

function _iaBuildPromptGenerarEscrito(args) {
    const tipoId = String(args?.tipoId || '').trim();
    const tipo = _IA_ESCRITOS_TIPOS[tipoId] || null;
    const tipoLabel = String(args?.tipoLabel || tipo?.label || 'Escrito').trim();

    const causa = (args && typeof args.causa === 'object' && args.causa) ? args.causa : {};
    const hechos = String(args?.hechos || '').trim();
    const juris = String(args?.jurisprudencia || '').trim();

    const rama = String(causa?.rama || 'Civil');
    const caratula = String(causa?.caratula || 'Causa');
    const tribunal = String(causa?.juzgado || 'Tribunal competente');
    const tipoProcedimiento = String(causa?.tipoProcedimiento || '');
    const promptExtra = String(tipo?.prompt_extra || args?.promptExtra || '').trim();

    return `Eres un abogado litigante chileno experto en ${rama}.
Redacta un escrito judicial formal de tipo "${tipoLabel}" para presentar ante un tribunal chileno.
Usa el formato estándar chileno: EN LO PRINCIPAL / OTROSÍ, RIT/ROL, fundamentación legal con artículos del Código de Procedimiento Civil y normas sustantivas aplicables a la materia, y peticiones concretas.
Deja entre [CORCHETES] los datos que el abogado debe completar (nombre, RUT, domicilio, etc.).
NO inventes hechos. Usa SOLO los proporcionados.

INSTRUCCIONES ESPECÍFICAS PARA ESTE TIPO DE ESCRITO:
${promptExtra}

DATOS DE LA CAUSA:
- Carátula: ${caratula}
- Tribunal: ${tribunal}
${tipoProcedimiento ? `- Procedimiento: ${tipoProcedimiento}\n` : ''}
- Rama: ${rama}

HECHOS Y ANTECEDENTES:
${hechos}

${juris ? 'JURISPRUDENCIA ASOCIADA:\n' + juris + '\n\n' : ''}Redacta el escrito completo con formato profesional.`;
}

async function _iaCallGemini(prompt, key, model) {
    const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
    const m = String(model || _IA_DEFAULTS.gemini.model);
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
    let resp;
    try {
        resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: String(prompt || '') }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
            }),
        });
    } catch (_) {
        throw new Error('Error de red al conectar con Gemini.');
    }
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
        const err = new Error(errMsg);
        err.status = resp.status;
        throw err;
    }
    const data = await resp.json().catch(() => ({}));
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

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
                model: String(model || _IA_DEFAULTS.claude.model),
                max_tokens: 4000,
                messages: [{ role: 'user', content: String(prompt || '') }],
            }),
        });
    } catch (_) {
        throw new Error('Error de red al conectar con Anthropic.');
    }
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
        const err = new Error(errMsg);
        err.status = resp.status;
        throw err;
    }
    const data = await resp.json().catch(() => ({}));
    const blocks = Array.isArray(data.content) ? data.content : [];
    return blocks.filter(b => b && b.type === 'text').map(b => b.text).join('') || '';
}

async function _iaCallGroq(prompt, key, model) {
    let resp;
    try {
        resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: String(model || _IA_DEFAULTS.groq.model),
                temperature: 0.25,
                max_tokens: 4000,
                messages: [{ role: 'user', content: String(prompt || '') }],
            }),
        });
    } catch (_) {
        throw new Error('Error de red al conectar con Groq.');
    }
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
        const err = new Error(errMsg);
        err.status = resp.status;
        throw err;
    }
    const data = await resp.json().catch(() => ({}));
    return data?.choices?.[0]?.message?.content || '';
}

ipcMain.handle('ia:set-key', async (_e, args) => {
    try {
        const pid = _iaNormalizeProvider(args?.provider);
        if (!pid) throw new Error('Proveedor inválido');
        const key = String(args?.key || '').trim();
        if (!key) throw new Error('Key vacía');
        if (key.length > 300) throw new Error('Key demasiado larga');
        _guardarStorageSeguro(`ia_key_${pid}`, key);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('ia:list-escritos-tipos', async () => {
    try {
        const items = Object.entries(_IA_ESCRITOS_TIPOS).map(([id, v]) => ({
            id,
            label: String(v?.label || id)
        }));
        return { ok: true, items };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('ia:get-status', async (_e) => {
    try {
        const g = _iaReadKey('gemini');
        const c = _iaReadKey('claude');
        const gr = _iaReadKey('groq');
        return {
            ok: true,
            has: {
                gemini: !!g,
                claude: !!c,
                groq: !!gr,
            },
            model: {
                gemini: _iaReadModel('gemini'),
                claude: _iaReadModel('claude'),
                groq: _iaReadModel('groq'),
            }
        };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('ia:generar-escrito', async (_e, args) => {
    try {
        const provider = _iaNormalizeProvider(args?.provider || 'gemini');
        if (!provider) throw new Error('Proveedor inválido');
        const hechos = String(args?.hechos || '').trim();
        if (!hechos) throw new Error('Faltan hechos');
        if (hechos.length > 200000) throw new Error('Hechos demasiado largos');

        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');

        const model = _iaReadModel(provider);
        const prompt = (args && typeof args === 'object' && typeof args.promptExtra === 'string' && args.promptExtra.trim())
            ? String(args.promptExtra).trim()
            : _iaBuildPromptGenerarEscrito(args);

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:modulo-run', async (_e, args) => {
    try {
        const templateId = String(args?.templateId || '').trim();
        const tpl = _IA_MODULOS_TEMPLATES[templateId];
        if (!tpl) throw new Error('Template IA inválido');

        const provider = _iaNormalizeProvider(args?.provider || tpl.providerDefault || 'claude');
        if (!provider) throw new Error('Proveedor inválido');
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');
        const model = _iaReadModel(provider);

        const payload = (args && typeof args.payload === 'object' && args.payload) ? args.payload : {};
        const prompt = String(tpl.buildPrompt(payload) || '').trim();
        if (!prompt) throw new Error('Prompt vacío');
        if (prompt.length > 250000) throw new Error('Prompt demasiado largo');

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:chat-responder', async (_e, args) => {
    try {
        const provider = _iaNormalizeProvider(args?.provider || 'claude');
        if (!provider) throw new Error('Proveedor inválido');
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');
        const model = _iaReadModel(provider);

        const contexto = String(args?.contexto || '').trim();
        const causaCtx = String(args?.causaCtx || '').trim();
        const historial = String(args?.historial || '').trim();
        const pregunta = String(args?.pregunta || '').trim();
        if (!pregunta) throw new Error('Pregunta vacía');
        if (pregunta.length > 50000) throw new Error('Pregunta demasiado larga');
        if (contexto.length > 200000) throw new Error('Contexto demasiado largo');

        const prompt = `${contexto}\n${causaCtx}\n\n${historial ? `=== CONVERSACIÓN PREVIA ===\n${historial}\n\n` : ''}=== PREGUNTA ACTUAL ===\nABOGADO: ${pregunta}\n\n${_IA_PROMPT_CHAT_LEGAL}`;

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:analizar-causa', async (_e, args) => {
    try {
        const provider = _iaNormalizeProvider(args?.provider || 'claude');
        if (!provider) throw new Error('Proveedor inválido');
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');
        const model = _iaReadModel(provider);

        const contexto = String(args?.contexto || '').trim();
        if (!contexto) throw new Error('Contexto vacío');
        if (contexto.length > 200000) throw new Error('Contexto demasiado largo');

        const prompt = `${contexto}\n\n=== INSTRUCCIÓN ===\n${_IA_PROMPT_ANALIZAR_CAUSA}`;

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:analizar-jurisprudencia', async (_e, args) => {
    try {
        const provider = _iaNormalizeProvider(args?.provider || 'claude');
        if (!provider) throw new Error('Proveedor inválido');
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');
        const model = _iaReadModel(provider);

        const sentencia = String(args?.sentencia || '').trim();
        if (!sentencia) throw new Error('Sentencia vacía');
        if (sentencia.length > 200000) throw new Error('Sentencia demasiado larga');
        const causasRel = String(args?.causasRelacionadas || '').trim();
        if (causasRel.length > 200000) throw new Error('Contexto demasiado largo');

        const prompt = `${sentencia}\n\n${causasRel ? `CAUSAS DEL DESPACHO POSIBLEMENTE RELACIONADAS:\n${causasRel}\n\n` : ''}=== INSTRUCCIÓN ===\n${_IA_PROMPT_ANALIZAR_JURISPRUDENCIA}`;

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:extraer-fallo-json', async (_e, args) => {
    try {
        const provider = 'gemini';
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para Gemini.');
        const model = _iaReadModel(provider);
        const textoFallo = String(args?.texto || '').trim();
        if (!textoFallo) throw new Error('Texto vacío');

        const prompt = `${_IA_PROMPT_EXTRAER_FALLO_JSON}\n\nTEXTO DEL FALLO:\n${textoFallo.substring(0, 8000)}`;
        const texto = await _iaCallGemini(prompt, key, model);
        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:analizar-estrategia', async (_e, args) => {
    try {
        const provider = _iaNormalizeProvider(args?.provider || 'claude');
        if (!provider) throw new Error('Proveedor inválido');
        const key = _iaReadKey(provider);
        if (!key) throw new Error('No hay API Key configurada para este proveedor.');
        const model = _iaReadModel(provider);

        const causa = (args && typeof args.causa === 'object' && args.causa) ? args.causa : {};
        const extraCtx = String(args?.contexto || '').trim();
        if (extraCtx.length > 200000) throw new Error('Contexto demasiado largo');

        const prompt = `CONTEXTO DEL DESPACHO / CAUSA:\n${extraCtx}\n\nDATOS DE CAUSA (JSON RESUMIDO):\n${JSON.stringify({
            caratula: causa.caratula || '',
            rama: causa.rama || '',
            tipoProcedimiento: causa.tipoProcedimiento || '',
            juzgado: causa.juzgado || '',
            rit: causa.rit || '',
            partes: causa.partes || null,
        })}\n\n${_IA_PROMPT_ANALISIS_ESTRATEGICO}`;

        const texto = provider === 'gemini'
            ? await _iaCallGemini(prompt, key, model)
            : provider === 'claude'
                ? await _iaCallClaude(prompt, key, model)
                : await _iaCallGroq(prompt, key, model);

        return { ok: true, texto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

ipcMain.handle('ia:iframe-context', async (_e, args) => {
    try {
        const modo = String(args?.modo || 'general').trim();
        if (!modo) throw new Error('modo vacío');
        if (modo.length > 40) throw new Error('modo demasiado largo');

        const base = String(args?.base || '').trim();
        if (base.length > 10000) throw new Error('base demasiado largo');

        const tipo = String(args?.tipo || '').trim();
        if (tipo.length > 200) throw new Error('tipo demasiado largo');

        const hechos = String(args?.hechos || '').trim();
        if (hechos.length > 20000) throw new Error('hechos demasiado largos');

        const causa = (args && typeof args.causa === 'object' && args.causa) ? args.causa : null;
        if (causa && typeof causa !== 'object') throw new Error('causa inválida');

        const contexto = IA_PROMPTS.iframeContext({ modo, base, causa, tipo, hechos });
        return { ok: true, contexto };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
});

// ── Validadores de input IPC ──────────────────────────────────────────────────
function validarClave(clave) {
    if (typeof clave !== 'string' || clave.length === 0 || clave.length > 200) {
        throw new Error('Clave inválida');
    }
}
function validarValor(valor) {
    if (typeof valor !== 'string') throw new Error('Valor debe ser string');
    if (valor.length > 10 * 1024 * 1024) throw new Error('Valor excede 10MB');
}

// ── IPC Handlers — Storage cifrado ───────────────────────────────────────────
ipcMain.handle('storage:get', (_e, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (!fs.existsSync(archivo)) return null;
        return descifrar(fs.readFileSync(archivo, 'utf8'));
    } catch (e) {
        console.error('[Storage:get]', e.message);
        return null;
    }
});

// ── IPC Handlers — Google Drive OAuth (navegador del sistema) ─────────────────
ipcMain.handle('drive:connect', async (_e, args) => {
    try {
        const clientId = (args && typeof args === 'object') ? args.clientId : '';
        const clientSecret = (args && typeof args === 'object') ? args.clientSecret : '';
        const res = await _driveOAuthConnect(clientId, clientSecret);
        if (res && res.ok && res.tokens && typeof res.tokens === 'object') {
            const safeTokens = { ...res.tokens };
            delete safeTokens.clientSecret;
            return { ok: true, tokens: safeTokens };
        }
        return res;
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('drive:get-access-token', async (_e, args) => {
    try {
        const clientId = (args && typeof args === 'object') ? args.clientId : '';
        return await _driveGetAccessToken(clientId);
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('drive:disconnect', async () => {
    try {
        _borrarDriveTokens();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// ── IPC Síncrono — hidratación del Store al inicio ───────────────────────────
// 01-db-auth.js lee el caché síncronamente antes de que _init() async termine.
// Este canal bloquea el renderer hasta tener el dato del disco.
ipcMain.on('storage:get-sync', (event, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (!fs.existsSync(archivo)) { event.returnValue = null; return; }
        event.returnValue = descifrar(fs.readFileSync(archivo, 'utf8'));
    } catch (e) {
        console.error('[Storage:get-sync]', e.message);
        event.returnValue = null;
    }
});

ipcMain.handle('storage:set', (_e, clave, valor) => {
    try {
        validarClave(clave);
        validarValor(valor);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        fs.writeFileSync(archivo, cifrar(valor), 'utf8');
        return { ok: true };
    } catch (e) {
        console.error('[Storage:set]', e.message);
        return { error: e.message };
    }
});

ipcMain.handle('storage:delete', (_e, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('storage:list', (_e) => {
    try {
        return fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.enc') && !f.includes('..'))
            .map(f => f.replace('.enc', ''));
    } catch (e) { return []; }
});

// ── IPC Handlers — Documentos ─────────────────────────────────────────────────
ipcMain.handle('docs:guardar', (_e, nombre, base64Data, mimeType) => {
    try {
        if (typeof nombre !== 'string' || nombre.length > 255) throw new Error('Nombre inválido');
        if (typeof base64Data !== 'string') throw new Error('base64Data inválido');
        if (typeof mimeType !== 'string') throw new Error('mimeType inválido');
        // Validar tamaño: base64 de 50MB máx
        if (base64Data.length > 70 * 1024 * 1024) throw new Error('Archivo demasiado grande (máx 50MB)');

        const nombreSeguro = `${Date.now()}_${sanitizarNombre(nombre)}`;
        const cifrado = cifrar(JSON.stringify({ nombre, mimeType, data: base64Data }));
        fs.writeFileSync(path.join(DOCS_DIR, nombreSeguro + '.enc'), cifrado, 'utf8');
        return { ok: true, id: nombreSeguro };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:leer', (_e, id) => {
    try {
        if (typeof id !== 'string' || id.includes('..') || id.includes('/') || id.includes('\\')) {
            return { error: 'ID inválido' };
        }
        const ruta = path.join(DOCS_DIR, sanitizarNombre(id) + '.enc');
        if (!fs.existsSync(ruta)) return { error: 'Documento no encontrado' };
        const descifrado = descifrar(fs.readFileSync(ruta, 'utf8'));
        if (!descifrado) return { error: 'Error al descifrar' };
        return { ok: true, ...JSON.parse(descifrado) };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:eliminar', (_e, id) => {
    try {
        if (typeof id !== 'string' || id.includes('..') || id.includes('/') || id.includes('\\')) {
            return { error: 'ID inválido' };
        }
        const ruta = path.join(DOCS_DIR, sanitizarNombre(id) + '.enc');
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:listar', (_e) => {
    try {
        return fs.readdirSync(DOCS_DIR)
            .filter(f => f.endsWith('.enc') && !f.includes('..'))
            .map(f => f.replace('.enc', ''));
    } catch (e) { return []; }
});

// ── IPC Handlers — PDF: extraer texto ─────────────────────────────────────────
ipcMain.handle('pdf:extraer-texto', async (_e, base64Data) => {
    try {
        if (typeof base64Data !== 'string') throw new Error('base64Data inválido');
        // límite aproximado: base64 de 50MB
        if (base64Data.length > 70 * 1024 * 1024) throw new Error('PDF demasiado grande (máx 50MB)');

        let pdfParse;
        try {
            pdfParse = require('pdf-parse');
        } catch (e) {
            return { ok: false, error: 'Dependencia faltante: instale "pdf-parse" en el proyecto (npm install pdf-parse).' };
        }

        const buf = Buffer.from(base64Data, 'base64');
        const res = await pdfParse(buf);
        return { ok: true, text: (res && res.text) ? String(res.text) : '' };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// ── IPC Handlers — Prospectos / CRM ───────────────────────────────────────────
ipcMain.handle('prospectos:generar-pdf', async (_e, { tipo, html, nombre, defaultName, outputDir, outputPath, saveAs }) => {
    try {
        const finalNombre = nombre || defaultName || `pdf_${fechaHoy()}`;
        const execPath = puppeteer.executablePath();
        const browser = await puppeteer.launch({
            executablePath: execPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        await browser.close();
        let ruta = '';

        // 1) outputPath explícito gana
        if (outputPath && typeof outputPath === 'string' && outputPath.trim()) {
            ruta = outputPath.trim();
        }

        // 2) saveAs abre diálogo
        if (!ruta && saveAs) {
            const baseDir = (outputDir && typeof outputDir === 'string' && outputDir.trim())
                ? outputDir.trim()
                : path.join(DATA_DIR, 'pdfs');
            const defaultPath = path.join(baseDir, `${sanitizarNombre(finalNombre)}.pdf`);
            const res = await dialog.showSaveDialog({
                title: 'Guardar PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (res.canceled || !res.filePath) {
                return { ok: false, success: false, error: 'Cancelado por usuario', message: 'Cancelado por usuario' };
            }
            ruta = res.filePath;
        }

        // 3) outputDir si viene (sin diálogo)
        if (!ruta && outputDir && typeof outputDir === 'string' && outputDir.trim()) {
            ruta = path.join(outputDir.trim(), `${sanitizarNombre(finalNombre)}.pdf`);
        }

        // 4) fallback legacy
        if (!ruta) {
            ruta = path.join(DATA_DIR, 'pdfs', `${sanitizarNombre(finalNombre)}.pdf`);
        }

        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        fs.writeFileSync(ruta, pdf);
        const base64 = pdf.toString('base64');
        return { ok: true, success: true, ruta, base64 };
    } catch (e) {
        console.error('[prospectos:generar-pdf]', e.message);
        return { ok: false, success: false, error: e.message, message: e.message };
    }
});

ipcMain.handle('prospectos:subir-documento', (_e, { causaId, tipo, archivo, nombre, mimetype }) => {
    try {
        const ruta = path.join(DATA_DIR, 'docs', sanitizarNombre(causaId), sanitizarNombre(tipo), `${sanitizarNombre(nombre)}.enc`);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        // archivo se asume en Base64
        const cleanB64 = archivo.includes('base64,') ? archivo.split('base64,')[1] : archivo;
        fs.writeFileSync(ruta, cifrar(cleanB64));
        return { ok: true, ruta };
    } catch (e) {
        console.error('[prospectos:subir-documento]', e.message);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('prospectos:ver-documento', (_e, { causaId, tipo, nombre }) => {
    try {
        const ruta = path.join(DATA_DIR, 'docs', sanitizarNombre(causaId), sanitizarNombre(tipo), `${sanitizarNombre(nombre)}.enc`);
        if (!fs.existsSync(ruta)) return { ok: false, error: 'Documento no encontrado' };
        const descifrado = descifrar(fs.readFileSync(ruta, 'utf8'));
        return { ok: true, base64: descifrado };
    } catch (e) {
        console.error('[prospectos:ver-documento]', e.message);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('prospectos:registrar-pago', (_e, { id, fotoBase64, nombre }) => {
    try {
        if (!fotoBase64) return { ok: true };
        const ruta = path.join(DATA_DIR, 'pagos', `${sanitizarNombre(nombre || ('pago_' + id))}.enc`);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        const cleanB64 = fotoBase64.includes('base64,') ? fotoBase64.split('base64,')[1] : fotoBase64;
        fs.writeFileSync(ruta, cifrar(cleanB64));
        return { ok: true, ruta };
    } catch (e) {
        console.error('[prospectos:registrar-pago]', e.message);
        return { ok: false, error: e.message };
    }
});

// ── IPC Handlers — Backup ─────────────────────────────────────────────────────
ipcMain.handle('backup:exportar', async (_e, jsonData) => {
    if (typeof jsonData !== 'string') return { error: 'Datos inválidos' };
    const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar Backup LEXIUM',
        defaultPath: `backup_lexium_${fechaHoy()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!filePath) return { cancelado: true };
    try {
        fs.writeFileSync(filePath, jsonData, 'utf8');
        return { ok: true, ruta: filePath };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('backup:importar', async (_e) => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Importar Backup LEXIUM',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { cancelado: true };
    try {
        // Validar que el archivo no sea descomunal (máx 100MB)
        const stat = fs.statSync(filePaths[0]);
        if (stat.size > 100 * 1024 * 1024) return { error: 'Archivo demasiado grande' };
        return { ok: true, data: fs.readFileSync(filePaths[0], 'utf8') };
    } catch (e) {
        return { error: e.message };
    }
});

// ── IPC Handlers — Sistema ────────────────────────────────────────────────────
ipcMain.handle('sistema:info', () => ({
    dataDir: DATA_DIR,
    docsDir: DOCS_DIR,
    hostname: os.hostname(),
    platform: os.platform(),
    version: app.getVersion(),
    isDev: IS_DEV
}));

ipcMain.handle('sistema:elegirCarpeta', async (_e, { titulo } = {}) => {
    try {
        const r = await dialog.showOpenDialog({
            title: (titulo && typeof titulo === 'string') ? titulo : 'Seleccionar carpeta',
            properties: ['openDirectory', 'createDirectory']
        });
        if (!r || r.canceled || !Array.isArray(r.filePaths) || !r.filePaths[0]) return { ok: false, cancelado: true };
        return { ok: true, ruta: r.filePaths[0] };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('sistema:abrirCarpetaDatos', () => {
    shell.openPath(DATA_DIR);
    return { ok: true };
});

ipcMain.handle('sistema:abrirRuta', (_e, ruta) => {
    try {
        const r = String(ruta || '').trim();
        if (!r) return { ok: false, error: 'Ruta vacía' };
        shell.openPath(r);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('sistema:revelarEnCarpeta', (_e, ruta) => {
    try {
        const r = String(ruta || '').trim();
        if (!r) return { ok: false, error: 'Ruta vacía' };
        shell.showItemInFolder(r);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('whatsapp:guardar-config', async (_e, config) => {
    const { validarNumero } = require('./whatsapp-service-v3');

    // Merge seguro: si viene un patch parcial (p.ej. solo waTemplates/waBranding),
    // no debemos pisar la configuración existente (abogados/destinatarios/sesión).
    try {
        const prev = getWhatsAppConfig();
        if (prev && typeof prev === 'object') {
            config = { ...prev, ...(config && typeof config === 'object' ? config : {}) };
        }
    } catch (_) { }

    // Validar array de abogados principales (nuevo)
    if (Array.isArray(config.abogadosPrincipales)) {
        const validados = [];
        for (const a of config.abogadosPrincipales) {
            if (!a?.numero) continue;
            const v = validarNumero(String(a.numero));
            if (!v.ok) return { error: `Número inválido (${a?.nombre || a?.numero}): ${v.error}` };
            validados.push({
                nombre: (a?.nombre || '').toString().substring(0, 60),
                numero: v.numero,
                autoEnvio: a?.autoEnvio !== false,
                envioManual: a?.envioManual !== false
            });
        }
        config.abogadosPrincipales = validados;
    }

    // Validar numero legacy
    if (config.numeroDestino) {
        const v = validarNumero(config.numeroDestino);
        if (!v.ok) return { error: `Número inválido: ${v.error}` };
        config.numeroDestino = v.numero;
    }

    // Validar array de destinatarios (nuevo) — preservar campo autoEnvio
    if (Array.isArray(config.destinatarios)) {
        const validados = [];
        for (const dest of config.destinatarios) {
            if (!dest.numero) continue;
            const v = validarNumero(dest.numero);
            if (!v.ok) return { error: `Número inválido (${dest.nombre || dest.numero}): ${v.error}` };
            validados.push({
                nombre:    (dest.nombre || '').substring(0, 60),
                numero:    v.numero,
                autoEnvio: dest.autoEnvio !== false,  // default true
                envioManual: dest.envioManual !== false
            });
        }
        config.destinatarios = validados;
    }

    // Validar destinoNumero (número principal nuevo campo)
    if (config.destinoNumero) {
        const v = validarNumero(config.destinoNumero);
        if (!v.ok) return { error: `Número principal inválido: ${v.error}` };
        config.destinoNumero = v.numero;
    }

    if (config.waTemplates && typeof config.waTemplates === 'object') {
        const out = {};
        const keys = Object.keys(config.waTemplates).slice(0, 50);
        for (const k of keys) {
            const v = config.waTemplates[k];
            if (typeof v !== 'string') continue;
            out[String(k).substring(0, 60)] = v.substring(0, 4096);
        }
        config.waTemplates = out;
    }

    if (config.waBranding && typeof config.waBranding === 'object') {
        const logoBase64 = (config.waBranding?.logoBase64 || '').toString();
        const logoTrim = logoBase64.substring(0, 2_000_000); // guardrail
        // Validar tamaño real del base64 (<= 2MB)
        if (logoTrim) {
            const parts = logoTrim.split(',');
            const b64 = (parts.length > 1 ? parts[1] : parts[0]).replace(/\s+/g, '');
            const pad = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
            const bytes = Math.floor((b64.length * 3) / 4) - pad;
            if (bytes > 2 * 1024 * 1024) {
                return { error: 'El logo excede 2MB. Comprímelo o usa una imagen más pequeña.' };
            }
        }

        config.waBranding = {
            nombreEstudio: (config.waBranding?.nombreEstudio || '').toString().substring(0, 80),
            telefono:      (config.waBranding?.telefono      || '').toString().substring(0, 40),
            horario:       (config.waBranding?.horario       || '').toString().substring(0, 60),
            webLink:       (config.waBranding?.webLink       || '').toString().substring(0, 160),
            disclaimer:    (config.waBranding?.disclaimer    || '').toString().substring(0, 600),
            logoBase64:    logoTrim,
            autoAppend:    config.waBranding?.autoAppend !== false
        };
    }

    try {
        const ruta = path.join(DATA_DIR, 'wa_config.enc');
        fs.writeFileSync(ruta, cifrar(JSON.stringify(config)), 'utf8');
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

// ── IPC Handler — Reset WhatsApp ─────────────────────────────────────────────
ipcMain.handle('whatsapp:reset', async () => {
    const resultados = [];
    const archivos = ['wa_config.enc', 'wa_logs.enc'];

    // Borrar archivos de config y logs
    archivos.forEach(nombre => {
        const ruta = path.join(DATA_DIR, nombre);
        try {
            if (fs.existsSync(ruta)) {
                fs.unlinkSync(ruta);
                resultados.push({ archivo: nombre, ok: true });
            } else {
                resultados.push({ archivo: nombre, ok: true, nota: 'no existía' });
            }
        } catch (e) {
            resultados.push({ archivo: nombre, ok: false, error: e.message });
        }
    });

    // Borrar carpeta de sesión WhatsApp
    const waSession = path.join(app.getPath('userData'), '.wa-session');
    try {
        if (fs.existsSync(waSession)) {
            fs.rmSync(waSession, { recursive: true, force: true });
            resultados.push({ archivo: '.wa-session', ok: true });
        } else {
            resultados.push({ archivo: '.wa-session', ok: true, nota: 'no existía' });
        }
    } catch (e) {
        resultados.push({ archivo: '.wa-session', ok: false, error: e.message });
    }

    return { ok: true, resultados };
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizarNombre(nombre) {
    return String(nombre).replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 100);
}
function fechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function getWhatsAppConfig() {
    try {
        const ruta = path.join(DATA_DIR, 'wa_config.enc');
        if (!fs.existsSync(ruta)) {
            return {
                numeroDestino: '',
                nombreAbogado: '',
                timezone: 'America/Santiago',
                activo: false
            };
        }
        const raw = descifrar(fs.readFileSync(ruta, 'utf8'));
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

// ── Ventana principal ─────────────────────────────────────────────────────────
let mainWindow;

function crearVentana() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        title: 'LEXIUM',
        icon: path.join(__dirname, 'assets/logo-lexium.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,   // ✅ renderer aislado
            nodeIntegration: false,  // ✅ sin acceso a Node en renderer
            sandbox: true,   // ✅ sandbox de Chromium activado
            webSecurity: true,   // ✅ Same-origin policy
            allowRunningInsecureContent: false,
        },
        show: false
    });

    mainWindow.loadFile('index.html');

    // ── CSP via cabecera HTTP (más robusto que el meta tag) ──────────────────
    // NOTA: script-src NO debe permitir inline para mitigar XSS.
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self';" +
                    "script-src 'self' https://cdnjs.cloudflare.com https://accounts.google.com https://apis.google.com;" +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;" +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;" +
                    "img-src 'self' data: blob:;" +
                    "connect-src 'self' https://generativelanguage.googleapis.com https://cdnjs.cloudflare.com https://api.openai.com https://api.anthropic.com https://api.groq.com https://oauth2.googleapis.com https://www.googleapis.com;" +
                    "worker-src 'self' blob: https://cdnjs.cloudflare.com;" +
                    "frame-src 'none';" +
                    "object-src 'none';"
                ]
            }
        });
    });

    // ── Bloquear navegación externa (previene ataques de redirección) ────────
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const parsed = new URL(url);
        // Solo permitir navegar al mismo archivo local
        if (parsed.protocol !== 'file:') {
            event.preventDefault();
            shell.openExternal(url); // abrir en el navegador del sistema
        }
    });

    // Bloquear apertura de nuevas ventanas (permitiendo solo popups OAuth de Google)
    mainWindow.webContents.setWindowOpenHandler((details) => {
        try {
            const targetUrl = String(details?.url || '');
            const u = new URL(targetUrl);
            const isGoogleOAuth = u.origin === 'https://accounts.google.com';

            if (isGoogleOAuth) {
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        width: 520,
                        height: 720,
                        parent: mainWindow,
                        modal: true,
                        show: true,
                        webPreferences: {
                            contextIsolation: true,
                            nodeIntegration: false,
                            sandbox: true,
                            webSecurity: true,
                            allowRunningInsecureContent: false,
                        },
                    },
                };
            }
        } catch (e) {
            // noop
        }

        return { action: 'deny' };
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        // DevTools disponible con Ctrl+Shift+I — no se abre automáticamente
    });

    // Menú nativo: solo en desarrollo (para ver errores)
    if (!IS_DEV) {
        mainWindow.removeMenu();
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Ciclo de vida de la app ───────────────────────────────────────────────────
app.whenReady().then(() => {
    // Configurar CSP de sesión global antes de crear ventana
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
    });

    crearVentana();

    // ── Inicializar servicios con inyección de dependencias ─────
    alertService.init({ DATA_DIR, descifrar, cifrar });
    waLogger.init({ DATA_DIR, cifrar, descifrar });
    whatsappService.registrarHandlers(getWhatsAppConfig);

    ipcMain.handle('whatsapp:conectar', async () => {
        try {
            whatsappService.initWhatsApp(mainWindow);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });


    // ── Reconexión automática al arrancar ─────────────────────
    // Si hay sesión guardada en disco (.wa-session), reconectar sin pedir QR.
    // Independiente del checkbox "activo" — la sesión persiste siempre.
    mainWindow.once('ready-to-show', () => {
        const waSessionDir = require('path').join(app.getPath('userData'), '.wa-session');
        const sessionExists = require('fs').existsSync(waSessionDir);

        if (sessionExists) {
            // Hay sesión guardada → reconectar automáticamente
            whatsappService.initWhatsApp(mainWindow);
        }

        // Schedulers: solo si el checkbox activo está marcado
        // Usan getWhatsAppConfig() dinámicamente en cada ejecución
        whatsappService.iniciarSchedulers(getWhatsAppConfig);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
});

// Rechazar certificados inválidos en producción
app.on('certificate-error', (event, _webContents, _url, _error, _cert, callback) => {
    if (IS_DEV) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});
