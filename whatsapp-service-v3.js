/**
 * LEXIUM – whatsapp-service-v3.js  (Corrección #4 + verificación Electron #5)
 * ─────────────────────────────────────────────────────────────
 * Mejoras sobre v2:
 *   ✅ _ejecutarCriticos() usa una sola lectura (getResumenParaWhatsApp)
 *   ✅ Verificación de configuración segura de BrowserWindow al arrancar
 *   ✅ Referencias actualizadas a alert-service-v3 y wa-logger-v3
 */

'use strict';

const { ipcMain } = require('electron');
const cron         = require('node-cron');
const alertService = require('./alert-service-v3');
const waLogger     = require('./wa-logger-v3');

const DEFAULT_WA_TEMPLATES = {
    resumen_diario: `⚖️ *LEXIUM – Reporte Diario*\n📅 {{hoy}}\n{{abogadoLinea}}{{separador}}\n\n{{seccionCriticas}}{{seccionAltas}}{{seccionInactivas}}{{seccionHonorarios}}{{seccionCobrosHoy}}{{seccionSinAlertas}}{{separador}}\n📊 {{statsLinea}}\n_Enviado por LEXIUM_`,
    alerta_critica: `🚨 *LEXIUM – ALERTA CRÍTICA*\n\n{{listaCriticas}}\n_Requiere acción inmediata – LEXIUM_`,
    cobro_cliente: `Estimado/a {{clienteNombre}}, le recordamos que su cuota Nº {{cuotaNumero}} de $ {{monto}} vence {{venceTxt}}.`,
    cobro_equipo: `ALERTA: Cuota Nº {{cuotaNumero}} de cliente {{clienteNombre}} por $ {{monto}} vence {{venceTxt}}.`,
    cobro_hoy_cliente: `Estimado/a {{clienteNombre}}, su cuota Nº {{cuotaNumero}} de $ {{monto}} vence hoy. Si ya pagó, por favor ignorar este mensaje.`,
    cobro_hoy_equipo: `ALERTA HOY: Cuota Nº {{cuotaNumero}} de cliente {{clienteNombre}} por $ {{monto}} vence hoy.`,
    cobro_vencida_cliente: `Estimado/a {{clienteNombre}}, le recordamos que su cuota Nº {{cuotaNumero}} de $ {{monto}} venció {{venceTxt}}.`,
    cobro_vencida_equipo: `ALERTA VENCIDA: Cuota Nº {{cuotaNumero}} de cliente {{clienteNombre}} por $ {{monto}} venció {{venceTxt}}.`
};

function _getTemplates(config) {
    const t = (config && typeof config === 'object') ? config.waTemplates : null;
    const merged = { ...DEFAULT_WA_TEMPLATES, ...(t && typeof t === 'object' ? t : {}) };
    // Aliases solicitados por UI (Branding Profesional)
    if (merged.RECORDATORIO_PAGO && !merged.cobro_cliente) merged.cobro_cliente = merged.RECORDATORIO_PAGO;
    if (merged.RECORDATORIO_PAGO && !merged.cobro_equipo) merged.cobro_equipo = merged.RECORDATORIO_PAGO;
    if (merged.VENCE_HOY && !merged.cobro_hoy_cliente) merged.cobro_hoy_cliente = merged.VENCE_HOY;
    if (merged.VENCE_HOY && !merged.cobro_hoy_equipo) merged.cobro_hoy_equipo = merged.VENCE_HOY;
    if (merged.PAGO_VENCIDO && !merged.cobro_vencida_cliente) merged.cobro_vencida_cliente = merged.PAGO_VENCIDO;
    if (merged.PAGO_VENCIDO && !merged.cobro_vencida_equipo) merged.cobro_vencida_equipo = merged.PAGO_VENCIDO;
    if (merged.ALERTA_VENCIMIENTO && !merged.alerta_critica) merged.alerta_critica = merged.ALERTA_VENCIMIENTO;
    return merged;
}

const CHAT_MAX_MENSAJES = 200;
const _chatCache = new Map();

function _chatIdNormalizado(chatId) {
    const raw = String(chatId || '').trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    const limpio = raw.replace(/[^\d]/g, '');
    if (!limpio) return '';
    return `${limpio}@c.us`;
}

function _chatTimestampMs(ts) {
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || n <= 0) return Date.now();
    return n > 1e12 ? n : (n * 1000);
}

function _chatSoloTexto(msg) {
    const tipo = String(msg?.type || 'chat').toLowerCase();
    if (tipo !== 'chat') return '';
    const body = String(msg?.body || '').trim();
    return body;
}

function _upsertMensajeChat({ chatId, nombre, body, fromMe, timestamp, messageId }) {
    const id = _chatIdNormalizado(chatId);
    const texto = String(body || '').trim();
    if (!id || !texto) return;

    const entry = _chatCache.get(id) || {
        chatId: id,
        nombre: String(nombre || '').trim() || id.replace('@c.us', ''),
        lastMessage: '',
        timestamp: 0,
        unread: 0,
        messages: []
    };

    const msgTs = _chatTimestampMs(timestamp);
    const msg = {
        id: String(messageId || `${id}-${msgTs}-${Math.random().toString(36).slice(2, 7)}`),
        chatId: id,
        body: texto,
        fromMe: !!fromMe,
        timestamp: msgTs
    };

    entry.messages.push(msg);
    if (entry.messages.length > CHAT_MAX_MENSAJES) {
        entry.messages = entry.messages.slice(entry.messages.length - CHAT_MAX_MENSAJES);
    }

    entry.lastMessage = texto;
    entry.timestamp = msgTs;
    if (!fromMe) entry.unread = Math.max(0, Number(entry.unread || 0) + 1);
    if (nombre && String(nombre).trim()) entry.nombre = String(nombre).trim();

    _chatCache.set(id, entry);

    mainWin?.webContents.send('whatsapp:chat-updated', {
        chatId: id,
        lastMessage: entry.lastMessage,
        timestamp: entry.timestamp,
        unread: entry.unread,
        nombre: entry.nombre
    });
}

function _getChatsSerializados() {
    return Array.from(_chatCache.values())
        .map(c => ({
            chatId: c.chatId,
            nombre: c.nombre,
            lastMessage: c.lastMessage,
            timestamp: c.timestamp,
            unread: c.unread || 0
        }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function _getMensajesChatSerializados(chatId, limite = 50) {
    const id = _chatIdNormalizado(chatId);
    const c = _chatCache.get(id);
    if (!c) return [];
    const n = Number(limite) || 50;
    return c.messages.slice(-Math.max(1, Math.min(200, n)));
}

async function _hidratarChatsDesdeCliente() {
    if (!waClient || !waReady) return;
    if (_chatCache.size > 0) return;

    try {
        const chats = await waClient.getChats();
        for (const c of chats || []) {
            const chatId = _chatIdNormalizado(c?.id?._serialized || c?.id?.user);
            if (!chatId) continue;

            const nombre = String(c?.name || c?.formattedTitle || c?.id?.user || chatId).trim();
            const ts = _chatTimestampMs(c?.timestamp || Date.now());
            const lastBody = String(c?.lastMessage?.body || '').trim();

            if (lastBody && String(c?.lastMessage?.type || 'chat').toLowerCase() === 'chat') {
                _upsertMensajeChat({
                    chatId,
                    nombre,
                    body: lastBody,
                    fromMe: !!c?.lastMessage?.fromMe,
                    timestamp: ts,
                    messageId: c?.lastMessage?.id?._serialized
                });
            } else if (!_chatCache.has(chatId)) {
                _chatCache.set(chatId, {
                    chatId,
                    nombre,
                    lastMessage: '',
                    timestamp: ts,
                    unread: Number(c?.unreadCount || 0),
                    messages: []
                });
            }
        }
    } catch (e) {
        waLogger.logWarn('chat-hidratacion-fallida', { error: e.message });
    }
}

function _esErrorNoReintentable(err) {
    const msg = String(err?.message || '').toLowerCase();
    if (!msg) return false;
    return (
        msg.includes('no lid for user') ||
        msg.includes('invalid wid') ||
        msg.includes('not a whatsapp user') ||
        msg.includes('invalid contact')
    );
}

function _appendBranding(config, mensaje) {
    try {
        const b = (config && typeof config === 'object') ? config.waBranding : null;
        if (!b || typeof b !== 'object') return mensaje;
        if (b.autoAppend === false) return mensaje;
        const webLink = (b.webLink || '').toString().trim();
        if (!webLink) return mensaje;

        const base = String(mensaje || '').trimEnd();
        if (base.includes(webLink)) return mensaje;
        return `${base}\n\n${webLink}`.trim();
    } catch (_) {
        return mensaje;
    }
}

function _tpl(str, vars) {
    try {
        const s = String(str || '');
        return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
            const v = vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '';
            return (v === null || v === undefined) ? '' : String(v);
        });
    } catch (_) {
        return String(str || '');
    }
}

let Client, LocalAuth, MessageMedia, qrcode;
try {
    ({ Client, LocalAuth, MessageMedia } = require('whatsapp-web.js'));
    qrcode = require('qrcode');
} catch(e) {
    console.warn('[WhatsApp] Instalar: npm install whatsapp-web.js qrcode node-cron');
}

function _parseDataUrlImage(dataUrl) {
    try {
        const s = String(dataUrl || '');
        if (!s.startsWith('data:image/')) return null;
        const m = s.match(/^data:(image\/(png|jpeg));base64,(.+)$/i);
        if (!m) return null;
        return { mime: m[1], data: m[3] };
    } catch (_) {
        return null;
    }
}

async function _ejecutarAlertasCobroVencidas(config) {
    if (!waReady) return { tipo: 'vencidas', cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0 };
    try {
        const db = alertService.getDB();
        if (!db) return { tipo: 'vencidas', cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0 };

        const hoy = new Date();
        const hoyISO = _fechaISO10(hoy);
        const marca = `v-${hoyISO}`;

        const destinatariosEquipo = _getDestinatarios(config, 'auto');
        const causas = db.causas || [];

        let cambios = 0;
        let enviadosOk = 0;
        let enviadosTotal = 0;
        let cuotasDetectadas = 0;
        let cuotasPendientes = 0;
        let cuotasSinFecha = 0;
        const ejemplosFechas = [];
        const ejemplosVence = [];
        let cuotasVencidas = 0;
        let cuotasSaltadasPorMarca = 0;

        for (const causa of causas) {
            const h = causa?.honorarios;
            if (!h || String(h.modalidad || '').toUpperCase() !== 'CUOTAS') continue;
            const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
            if (!plan.length) continue;

            const cliente = (db.clientes || []).find(c => String(c.id) === String(causa.clienteId));
            const clienteNombre = cliente?.nombre || cliente?.nom || causa?.caratula || 'Cliente';
            const clienteTel = _waNumeroLimpio(cliente?.telefono);

            for (const cuota of plan) {
                if (!cuota) continue;
                if (String(cuota.estado || '').toUpperCase() === 'PAGADA') continue;
                cuotasPendientes++;

                const venceISO = _fechaISO10(cuota.fechaVencimiento);
                if (ejemplosVence.length < 5) {
                    ejemplosVence.push({ raw: cuota.fechaVencimiento, venceISO, hoyISO });
                }
                if (!venceISO) {
                    cuotasSinFecha++;
                    if (ejemplosFechas.length < 3) ejemplosFechas.push({ raw: cuota.fechaVencimiento, parsed: venceISO });
                    continue;
                }

                if (venceISO >= hoyISO) continue;

                const dV = new Date(`${venceISO}T00:00:00`);
                const dH = new Date(`${hoyISO}T00:00:00`);
                const diasVencida = Math.floor((dH - dV) / (24 * 60 * 60 * 1000));
                if (diasVencida !== 2 && diasVencida !== 5) continue;

                cuotasVencidas++;

                if (!cuota._waAlertas) cuota._waAlertas = { cliente: {}, equipo: {} };
                if (cuota._waAlertas.cliente?.[marca] && cuota._waAlertas.equipo?.[marca]) {
                    cuotasSaltadasPorMarca++;
                    continue;
                }

                const monto = (cuota.monto || 0);
                const fechaTxt = `el ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL')}`;
                cuotasDetectadas++;
                const templates = _getTemplates(config);
                const vars = {
                    clienteNombre,
                    cuotaNumero: cuota.numero,
                    monto: Number(monto).toLocaleString('es-CL'),
                    venceTxt: fechaTxt,
                };
                const msgCliente = _tpl(templates.cobro_vencida_cliente, vars);
                const msgEquipo = _tpl(templates.cobro_vencida_equipo, vars);

                const msgClienteFinal = _appendBranding(config, msgCliente);
                const msgEquipoFinal = _appendBranding(config, msgEquipo);

                const tasks = [];

                if (clienteTel && !cuota._waAlertas.cliente?.[marca] && validarNumero(clienteTel).ok) {
                    enviadosTotal++;
                    tasks.push(
                        enviarMensaje(clienteTel, msgClienteFinal, 'alerta-cobro-cliente')
                            .then(r => {
                                if (r?.ok !== false) {
                                    cuota._waAlertas.cliente[marca] = true;
                                    cambios++;
                                    enviadosOk++;
                                }
                            })
                            .catch(e => waLogger.logError('cobro-cliente-envio-fallido', { error: e.message, clienteTel }))
                    );
                }

                if (destinatariosEquipo.length > 0 && !cuota._waAlertas.equipo?.[marca]) {
                    const settled = await Promise.allSettled(destinatariosEquipo.map(d => {
                        enviadosTotal++;
                        return enviarMensaje(d.numero, msgEquipoFinal, 'alerta-cobro-vencida-equipo');
                    }));
                    const okEquipo = settled.filter(x => x.status === 'fulfilled').length;
                    if (okEquipo > 0) {
                        cuota._waAlertas.equipo[marca] = true;
                        cambios++;
                        enviadosOk += okEquipo;
                    }
                }

                if (tasks.length) await Promise.allSettled(tasks);
            }
        }

        if (cambios > 0) {
            const ok = alertService.saveDB(db);
            if (!ok) waLogger.logError('cobro-vencida-db-save-fallido', {});
        }

        if (enviadosTotal > 0) {
            waLogger.logInfo('cobro-vencida-scheduler-ejecucion', { hoyISO, enviadosOk, enviadosTotal });
        }

        return {
            tipo: 'vencidas',
            cuotasDetectadas,
            cuotasVencidas,
            cuotasSaltadasPorMarca,
            enviadosOk,
            enviadosTotal,
            cambios,
            debug: { hoyISO, cuotasPendientes, cuotasSinFecha, ejemplosFechas, ejemplosVence }
        };
    } catch (e) {
        waLogger.logError('cobro-vencida-scheduler-error', { error: e.message });
        return { tipo: 'vencidas', cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0, error: e.message };
    }
}

let waClient        = null;
let waReady         = false;
let mainWin         = null;
let _fueReconexionAuto = false;  // true si initWhatsApp detectó sesión previa en disco

// ── Verificación de seguridad de Electron (#5) ─────────────────
/**
 * Verifica que BrowserWindow tenga configuración segura.
 * Lanza advertencia si detecta configuración débil.
 * LEXIUM ya tiene todo correcto, pero esta función actúa como guardia.
 */
function verificarSeguridadElectron(win) {
    const prefs = win.webContents.getLastWebPreferences?.() || {};

    const problemas = [];

    if (prefs.nodeIntegration === true) {
        problemas.push('⚠️  nodeIntegration: true — riesgo alto');
    }
    if (prefs.contextIsolation === false) {
        problemas.push('⚠️  contextIsolation: false — riesgo alto');
    }
    if (prefs.enableRemoteModule === true) {
        problemas.push('⚠️  enableRemoteModule: true — deprecado y peligroso');
    }
    if (prefs.sandbox === false) {
        problemas.push('⚠️  sandbox: false — reduce protección de Chromium');
    }
    if (prefs.webSecurity === false) {
        problemas.push('⚠️  webSecurity: false — deshabilita same-origin policy');
    }

    if (problemas.length > 0) {
        waLogger.logError('electron-config-insegura', { problemas });
        console.error('[LEXIUM] 🔴 CONFIGURACIÓN ELECTRON INSEGURA:');
        problemas.forEach(p => console.error('  ' + p));
        console.error('[LEXIUM] Revisar webPreferences en crearVentana()');
    } else {
        waLogger.logOk('electron-config-verificada', {
            nodeIntegration:  prefs.nodeIntegration  ?? false,
            contextIsolation: prefs.contextIsolation ?? true,
            sandbox:          prefs.sandbox          ?? true
        });
        console.log('[LEXIUM] ✅ Configuración Electron verificada y segura.');
    }

    return problemas.length === 0;
}

// ── Validación (#4 heredado de v2) ────────────────────────────
function validarNumero(numero) {
    if (typeof numero !== 'string') return { ok: false, error: 'Número debe ser string' };
    const limpio = numero.replace(/[\s\+\-\(\)]/g, '');
    if (!/^\d+$/.test(limpio))          return { ok: false, error: 'Solo dígitos' };
    if (limpio.length < 10 || limpio.length > 15)
                                         return { ok: false, error: 'Longitud inválida (10–15 dígitos con código de país)' };
    if (/^(\d)\1+$/.test(limpio))       return { ok: false, error: 'Número inválido' };
    return { ok: true, numero: limpio };
}

function validarMensaje(mensaje) {
    if (typeof mensaje !== 'string' || mensaje.trim().length === 0)
        return { ok: false, error: 'Mensaje vacío' };
    if (mensaje.length > 4096)
        return { ok: false, error: 'Mensaje excede límite de WhatsApp (4096 chars)' };
    return { ok: true };
}

function _dirTieneContenido(fs, ruta) {
    try {
        if (!fs.existsSync(ruta)) return false;
        const items = fs.readdirSync(ruta);
        return Array.isArray(items) && items.length > 0;
    } catch (_) {
        return false;
    }
}

function _resolverAuthDataPath() {
    // Preferencia:
    //  1) Nuevo esquema: userData/.wa-session
    //  2) Legacy whatsapp-web.js LocalAuth: base/.wwebjs_auth (usualmente userData/.wwebjs_auth)
    try {
        const path = require('path');
        const fs = require('fs');
        const { app } = require('electron');
        const userData = app.getPath('userData');

        const nuevo = path.join(userData, '.wa-session');
        const nuevoDefault = path.join(nuevo, 'Default');
        if (fs.existsSync(nuevoDefault) || _dirTieneContenido(fs, nuevo)) {
            return { dataPath: nuevo, mode: 'new' };
        }

        const legacyBases = [userData, process.cwd()];
        for (const base of legacyBases) {
            if (!base) continue;
            const authDir = path.join(base, '.wwebjs_auth');
            if (fs.existsSync(authDir) && _dirTieneContenido(fs, authDir)) {
                return { dataPath: base, mode: 'legacy' };
            }
        }

        // Si no hay legacy, usar nuevo path igual (creará carpeta)
        return { dataPath: nuevo, mode: 'new' };
    } catch (_) {
        return { dataPath: null, mode: 'unknown' };
    }
}

function _waSesionExiste() {
    try {
        const path = require('path');
        const fs = require('fs');
        const { app } = require('electron');
        const userData = app.getPath('userData');

        // Nuevo esquema
        const baseNew = path.join(userData, '.wa-session');
        const def = path.join(baseNew, 'Default');
        if (fs.existsSync(def) || _dirTieneContenido(fs, baseNew)) return true;

        // Legacy
        const legacyBases = [userData, process.cwd()];
        for (const base of legacyBases) {
            if (!base) continue;
            const authDir = path.join(base, '.wwebjs_auth');
            if (fs.existsSync(authDir) && _dirTieneContenido(fs, authDir)) return true;
        }
        return false;
    } catch (_) {
        return false;
    }
}

// ── Inicializar ────────────────────────────────────────────────
function initWhatsApp(browserWindow) {
    if (!Client) return;
    mainWin = browserWindow;

    // Verificar seguridad Electron (#5)
    verificarSeguridadElectron(browserWindow);

    // Detectar si hay sesión previa para no mostrar modal al reconectar
    try {
        _fueReconexionAuto = _waSesionExiste();
    } catch(_) { _fueReconexionAuto = false; }

    const auth = _resolverAuthDataPath();

    waClient = new Client({
        authStrategy: new LocalAuth({
            ...(auth?.dataPath ? { dataPath: auth.dataPath } : {})
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    waClient.on('qr', async (qrString) => {
        waLogger.logInfo('qr-generado', {});
        try {
            const dataUrl = qrcode
                ? await qrcode.toDataURL(qrString, { errorCorrectionLevel: 'M', width: 256, margin: 2 })
                : null;
            mainWin?.webContents.send('whatsapp:qr', { dataUrl });
        } catch(e) {
            mainWin?.webContents.send('whatsapp:qr', { dataUrl: null });
        }
    });

    waClient.on('ready', () => {
        waReady = true;
        waLogger.logOk('cliente-listo', {});
        if (_fueReconexionAuto) {
            // Primero reconectado-auto (activa la flag en el renderer),
            // luego ready (que ya no mostrará el modal)
            mainWin?.webContents.send('whatsapp:reconectado-auto', { auto: true });
            mainWin?.webContents.send('whatsapp:ready', { auto: true });
        } else {
            mainWin?.webContents.send('whatsapp:ready', { auto: false });
        }
        _fueReconexionAuto = false;
    });

    waClient.on('loading_screen', (percent) => {
        mainWin?.webContents.send('whatsapp:cargando', { percent });
    });

    waClient.on('disconnected', (reason) => {
        waReady = false;
        waLogger.logWarn('cliente-desconectado', { reason });
        mainWin?.webContents.send('whatsapp:disconnected', reason);
    });

    waClient.on('auth_failure', (msg) => {
        waReady = false;
        waLogger.logError('auth-failure', { msg });
        mainWin?.webContents.send('whatsapp:auth_failure');
    });

    waClient.on('message', async (msg) => {
        try {
            const body = _chatSoloTexto(msg);
            if (!body) return; // ignorar media/no texto en esta versión

            const chatId = _chatIdNormalizado(msg?.from || msg?.to || '');
            if (!chatId) return;

            const nombre = String(msg?._data?.notifyName || msg?._data?.pushname || '').trim() || chatId.replace('@c.us', '');
            _upsertMensajeChat({
                chatId,
                nombre,
                body,
                fromMe: !!msg?.fromMe,
                timestamp: _chatTimestampMs(msg?.timestamp),
                messageId: msg?.id?._serialized
            });
        } catch (e) {
            waLogger.logWarn('chat-recepcion-fallida', { error: e.message });
        }
    });

    waClient.initialize().catch(e => waLogger.logError('init-error', { error: e.message }));
}

// ── Envío con reintentos ───────────────────────────────────────
async function enviarMensaje(numero, mensaje, tipo = 'manual', opts = {}) {
    const vNum = validarNumero(numero);
    if (!vNum.ok) throw new Error(`Número inválido: ${vNum.error}`);

    const vMsg = validarMensaje(mensaje);
    if (!vMsg.ok) throw new Error(`Mensaje inválido: ${vMsg.error}`);

    if (!waClient || !waReady) throw new Error('WhatsApp no está conectado.');

    const chatId    = `${vNum.numero}@c.us`;
    const messageId = `${tipo}-${Date.now()}`;

    try {
        // Envío híbrido: bienvenida como media (logo) con caption
        if (opts && opts.logoDataUrl && (tipo === 'bienvenida-cliente' || opts.templateKey === 'BIENVENIDA_CLIENTE')) {
            const parsed = _parseDataUrlImage(opts.logoDataUrl);
            if (parsed && MessageMedia) {
                const media = new MessageMedia(parsed.mime, parsed.data, 'logo');
                await waClient.sendMessage(chatId, media, { caption: mensaje });
            } else {
                await waClient.sendMessage(chatId, mensaje);
            }
        } else {
            await waClient.sendMessage(chatId, mensaje);
        }
        waLogger.logOk('mensaje-enviado', {
            messageId,
            tipo,
            numero: vNum.numero.replace(/\d(?=\d{4})/g, '*')
        });
        mainWin?.webContents.send('whatsapp:alerta-enviada', { tipo, ok: true, numero: vNum.numero, mensaje });
        return { ok: true };
    } catch(e) {
        waLogger.logError('envio-fallido', { messageId, tipo, error: e.message });
        mainWin?.webContents.send('whatsapp:alerta-enviada', { tipo, ok: false, error: e.message, numero: vNum.numero, mensaje });

        if (_esErrorNoReintentable(e)) {
            waLogger.logWarn('envio-no-reintentable', {
                messageId,
                tipo,
                error: e.message,
                numero: vNum.numero.replace(/\d(?=\d{4})/g, '*')
            });
        } else {
            waLogger.encolarReintento(
                messageId,
                { numero: vNum.numero, mensaje, tipo },
                (num, msg) => waClient.sendMessage(`${num}@c.us`, msg)
            );
        }
        throw e;
    }
}

// ── Formatear ──────────────────────────────────────────────────
function formatearResumen(resumen, config) {
    const hoy = new Date().toLocaleDateString('es-CL');
    const { alertas, honorarios, stats } = resumen;

    const templates = _getTemplates(config);
    const abogadoLinea = (config && (config.nombreAbogado || config.destinoNombre))
        ? `👤 ${(config.nombreAbogado || config.destinoNombre)}\n`
        : '';
    const separador = `${'─'.repeat(28)}`;

    let seccionCriticas = '';
    if (alertas.criticas.length > 0) {
        seccionCriticas += `🚨 *PLAZOS CRÍTICOS (${alertas.criticas.length})*\n`;
        alertas.criticas.forEach(a => {
            seccionCriticas += `• *${a._caratula}*\n  ${a.mensaje}`;
            if (a._fechaVencFormatted) seccionCriticas += ` – Vence: ${a._fechaVencFormatted}`;
            seccionCriticas += '\n';
        });
        seccionCriticas += '\n';
    }

    let seccionAltas = '';
    if (alertas.altas.length > 0) {
        seccionAltas += `⚠️ *ALERTAS IMPORTANTES (${alertas.altas.length})*\n`;
        alertas.altas.forEach(a => { seccionAltas += `• ${a._caratula}: ${a.mensaje}\n`; });
        seccionAltas += '\n';
    }

    let seccionInactivas = '';
    if (alertas.inactivas.length > 0) {
        seccionInactivas += `😴 *SIN MOVIMIENTO (${alertas.inactivas.length})*\n`;
        alertas.inactivas.forEach(a => { seccionInactivas += `• ${a._caratula}\n`; });
        seccionInactivas += '\n';
    }

    let seccionHonorarios = '';
    if (honorarios.causas.length > 0) {
        seccionHonorarios += `💰 *HONORARIOS PENDIENTES*\n`;
        seccionHonorarios += `• ${honorarios.causas.length} causa(s) · Total: $${honorarios.total.toLocaleString('es-CL')}\n\n`;
    }

    const cobrosHoy = alertas.cobrosHoy || [];
    let seccionCobrosHoy = '';
    if (cobrosHoy.length > 0) {
        seccionCobrosHoy += `💳 *COBROS VENCEN HOY (${cobrosHoy.length})*\n`;
        cobrosHoy.forEach(c => {
            seccionCobrosHoy += `• *${c.caratula}*\n  💰 $${c.monto.toLocaleString('es-CL')} – 📅 ${c.fecha}\n`;
        });
        seccionCobrosHoy += '\n';
    }

    let seccionSinAlertas = '';
    if (!alertas.criticas.length && !alertas.altas.length && !alertas.inactivas.length && !honorarios.causas.length && !cobrosHoy.length) {
        seccionSinAlertas = `✅ *Sin alertas activas hoy*\n\n`;
    }

    const statsLinea = `${stats.causasActivas} activa(s) · ${stats.totalAlertas} alerta(s)`;

    const msg = _tpl(templates.resumen_diario, {
        hoy,
        abogadoLinea,
        separador,
        seccionCriticas,
        seccionAltas,
        seccionInactivas,
        seccionHonorarios,
        seccionCobrosHoy,
        seccionSinAlertas,
        statsLinea
    });
    return _appendBranding(config, msg);
}

// ── Schedulers ─────────────────────────────────────────────────
function iniciarSchedulers(configOrFn) {
    // Acepta objeto fijo o función que devuelve config actualizada
    const getConf = typeof configOrFn === 'function' ? configOrFn : () => configOrFn;

    cron.schedule('0 8 * * *', async () => {
        const config = getConf();
        if (!config.activo) return;   // respetar checkbox en tiempo real
        waLogger.logInfo('scheduler-resumen-diario', {});
        await _ejecutarResumen(config, 'auto');
    }, { timezone: 'America/Santiago' });

    cron.schedule('0 * * * *', async () => {
        const config = getConf();
        if (!config.activo) return;
        await _ejecutarCriticos(config);
    }, { timezone: 'America/Santiago' });

    // Alertas de cobro (cuotas): revisar cada hora
    cron.schedule('10 * * * *', async () => {
        const config = getConf();
        if (!config.activo) return;
        await _ejecutarAlertasCobroVencidas(config);
        await _ejecutarAlertasCobro(config, 0);
        await _ejecutarAlertasCobro(config, 2);
    }, { timezone: 'America/Santiago' });

    waLogger.logInfo('schedulers-iniciados', {});
}

function _fechaISO10(d) {
    try {
        // Timestamp numérico (ms)
        if (typeof d === 'number' && Number.isFinite(d)) {
            const dtN = new Date(d);
            if (!Number.isNaN(dtN.getTime())) {
                const yyyy = dtN.getFullYear();
                const mm = String(dtN.getMonth() + 1).padStart(2, '0');
                const dd = String(dtN.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        }

        // Objetos comunes (p.ej. Firebase timestamp-like)
        if (d && typeof d === 'object') {
            const sec = (typeof d.seconds === 'number') ? d.seconds
                : (typeof d._seconds === 'number') ? d._seconds
                    : null;
            if (sec !== null) {
                const dtS = new Date(sec * 1000);
                if (!Number.isNaN(dtS.getTime())) {
                    const yyyy = dtS.getFullYear();
                    const mm = String(dtS.getMonth() + 1).padStart(2, '0');
                    const dd = String(dtS.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                }
            }
        }

        if (typeof d === 'string') {
            const s = d.trim();
            // Formato DD-MM-YYYY (común en UI)
            const m1 = s.match(/^([0-3]\d)-([01]\d)-(\d{4})$/);
            if (m1) {
                const dd = m1[1];
                const mm = m1[2];
                const yyyy = m1[3];
                return `${yyyy}-${mm}-${dd}`;
            }
            // Formato YYYY-MM-DD (o ISO con hora)
            const m2 = s.match(/^(\d{4})-([01]\d)-([0-3]\d)/);
            if (m2) {
                const yyyy = m2[1];
                const mm = m2[2];
                const dd = m2[3];
                return `${yyyy}-${mm}-${dd}`;
            }
        }

        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return '';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch (_) {
        return '';
    }
}

function _waNumeroLimpio(x) {
    return String(x || '').replace(/[\s\+\-\(\)]/g, '').trim();
}

async function _ejecutarAlertasCobro(config, diasAntes = 0) {
    if (!waReady) return { diasAntes, cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0 };
    try {
        const db = alertService.getDB();
        if (!db) return { diasAntes, cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0 };

        const hoy = new Date();
        const target = new Date(hoy);
        target.setDate(target.getDate() + (parseInt(diasAntes) || 0));
        const targetISO = _fechaISO10(target);

        const destinatariosEquipo = _getDestinatarios(config, 'auto');
        const causas = db.causas || [];

        let cambios = 0;
        let enviadosOk = 0;
        let enviadosTotal = 0;
        let cuotasDetectadas = 0;
        let cuotasPendientes = 0;
        let cuotasSinFecha = 0;
        const ejemplosFechas = [];
        let cuotasCoincidenFecha = 0;
        let cuotasSaltadasPorMarca = 0;

        for (const causa of causas) {
            const h = causa?.honorarios;
            if (!h || String(h.modalidad || '').toUpperCase() !== 'CUOTAS') continue;
            const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
            if (!plan.length) continue;

            const cliente = (db.clientes || []).find(c => String(c.id) === String(causa.clienteId));
            const clienteNombre = cliente?.nombre || cliente?.nom || causa?.caratula || 'Cliente';
            const clienteTel = _waNumeroLimpio(cliente?.telefono);

            for (const cuota of plan) {
                if (!cuota) continue;
                if (String(cuota.estado || '').toUpperCase() === 'PAGADA') continue;
                cuotasPendientes++;
                const venceISO = _fechaISO10(cuota.fechaVencimiento);
                if (!venceISO) {
                    cuotasSinFecha++;
                    if (ejemplosFechas.length < 3) ejemplosFechas.push({ raw: cuota.fechaVencimiento, parsed: venceISO });
                }
                if (!venceISO || venceISO !== targetISO) continue;

                cuotasCoincidenFecha++;

                if (!cuota._waAlertas) cuota._waAlertas = { cliente: {}, equipo: {} };
                const marca = (diasAntes === 0) ? 'hoy' : `d-${diasAntes}`;
                if (cuota._waAlertas.cliente?.[marca] && cuota._waAlertas.equipo?.[marca]) {
                    cuotasSaltadasPorMarca++;
                    continue;
                }

                const monto = (cuota.monto || 0);
                const fechaTxt = diasAntes === 0
                    ? 'hoy'
                    : `el ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL')}`;

                cuotasDetectadas++;

                const templates = _getTemplates(config);
                const vars = {
                    clienteNombre,
                    cuotaNumero: cuota.numero,
                    monto: Number(monto).toLocaleString('es-CL'),
                    venceTxt: fechaTxt,
                };
                const tplCli = (diasAntes === 0) ? templates.cobro_hoy_cliente : templates.cobro_cliente;
                const tplEq = (diasAntes === 0) ? templates.cobro_hoy_equipo : templates.cobro_equipo;
                const msgCliente = _tpl(tplCli, vars);
                const msgEquipo = _tpl(tplEq, vars);

                const msgClienteFinal = _appendBranding(config, msgCliente);
                const msgEquipoFinal = _appendBranding(config, msgEquipo);

                const tasks = [];

                // Cliente: SI O SI (si tiene teléfono válido)
                if (clienteTel && !cuota._waAlertas.cliente?.[marca] && validarNumero(clienteTel).ok) {
                    enviadosTotal++;
                    tasks.push(
                        enviarMensaje(clienteTel, msgClienteFinal, 'alerta-cobro-cliente')
                            .then(r => {
                                if (r?.ok !== false) {
                                    cuota._waAlertas.cliente[marca] = true;
                                    cambios++;
                                    enviadosOk++;
                                }
                            })
                            .catch(e => {
                                waLogger.logError('cobro-cliente-envio-fallido', { error: e.message, clienteTel });
                            })
                    );
                }

                // Equipo: solo autoEnvio
                if (destinatariosEquipo.length > 0 && !cuota._waAlertas.equipo?.[marca]) {
                    const settled = await Promise.allSettled(destinatariosEquipo.map(d => {
                        enviadosTotal++;
                        return enviarMensaje(d.numero, msgEquipoFinal, 'alerta-cobro-equipo');
                    }));
                    const okEquipo = settled.filter(x => x.status === 'fulfilled').length;
                    if (okEquipo > 0) {
                        cuota._waAlertas.equipo[marca] = true;
                        cambios++;
                        enviadosOk += okEquipo;
                    }
                }

                if (tasks.length) await Promise.allSettled(tasks);
            }
        }

        if (cambios > 0) {
            const ok = alertService.saveDB(db);
            if (!ok) waLogger.logError('cobro-db-save-fallido', {});
        }

        if (enviadosTotal > 0) {
            waLogger.logInfo('cobro-scheduler-ejecucion', { diasAntes, enviadosOk, enviadosTotal });
        }
        return {
            diasAntes,
            cuotasDetectadas,
            cuotasCoincidenFecha,
            cuotasSaltadasPorMarca,
            enviadosOk,
            enviadosTotal,
            cambios,
            debug: { targetISO, cuotasPendientes, cuotasSinFecha, ejemplosFechas }
        };
    } catch (e) {
        waLogger.logError('cobro-scheduler-error', { error: e.message, diasAntes });
        return { diasAntes, cuotasDetectadas: 0, enviadosOk: 0, enviadosTotal: 0, cambios: 0, error: e.message };
    }
}

async function _ejecutarResumen(config, modo = 'auto') {
    if (!waReady) return;
    const destinatarios = _getDestinatarios(config, modo === 'manual' ? 'manual' : 'auto');
    if (destinatarios.length === 0) return;
    try {
        const resumen = alertService.getResumenParaWhatsApp(); // una sola lectura
        const mensaje = formatearResumen(resumen, config);
        const settled = await Promise.allSettled(destinatarios.map(dest => enviarMensaje(dest.numero, mensaje, 'resumen-diario')));
        settled.forEach(r => {
            if (r.status === 'rejected') {
                waLogger.logError('resumen-diario-envio-fallido', { error: r.reason?.message || String(r.reason) });
            }
        });
    } catch(e) {
        waLogger.logError('resumen-diario-error', { error: e.message });
    }
}

/**
 * Retorna la lista efectiva de destinatarios.
 *
 * modo:
 * - 'auto': solo contactos con autoEnvio !== false
 * - 'manual': solo contactos con envioManual !== false
 */
function _getDestinatarios(config, modo = 'auto') {
    const lista = [];

    const permitir = (x) => {
        if (modo === 'manual') return x?.envioManual !== false;
        return x?.autoEnvio !== false;
    };

    // Abogados principales (nuevo): incluir TODOS (si están configurados y son válidos)
    if (Array.isArray(config.abogadosPrincipales) && config.abogadosPrincipales.length > 0) {
        for (const a of config.abogadosPrincipales) {
            if (!a?.numero || !validarNumero(String(a.numero)).ok) continue;
            if (!permitir(a)) continue;
            const n = validarNumero(String(a.numero)).numero;
            if (lista.find(x => x.numero === n)) continue;
            lista.push({ nombre: a.nombre || '', numero: n, tipo: 'principal' });
        }
    }

    // Principal
    const numPrincipal = config.destinoNumero || config.numeroDestino || '';
    if (numPrincipal && validarNumero(numPrincipal).ok) {
        // Legacy no tiene flags: se asume permitido
        const n = validarNumero(numPrincipal).numero;
        if (!lista.find(x => x.numero === n)) {
            lista.push({
                nombre: config.destinoNombre || config.nombreAbogado || '',
                numero: n,
                tipo: 'principal'
            });
        }
    }

    // Secundarios con autoEnvio activo
    if (Array.isArray(config.destinatarios)) {
        for (const d of config.destinatarios) {
            if (!d.numero || !validarNumero(d.numero).ok) continue;
            if (d.numero === numPrincipal) continue;          // evitar duplicado
            if (!permitir(d)) continue;
            lista.push({ nombre: d.nombre || '', numero: d.numero, tipo: 'secundario' });
        }
    }

    return lista;
}

/**
 * Solo el principal (para envíos manuales desde botón "Enviar resumen ahora").
 */
function _getPrincipal(config) {
    // Preferir el primer abogado principal si existe
    if (Array.isArray(config.abogadosPrincipales) && config.abogadosPrincipales.length > 0) {
        const first = config.abogadosPrincipales.find(a => a?.numero && validarNumero(String(a.numero)).ok);
        if (first) {
            const n = validarNumero(String(first.numero)).numero;
            return { nombre: first.nombre || '', numero: n };
        }
    }
    const num = config.destinoNumero || config.numeroDestino || '';
    if (!num || !validarNumero(num).ok) return null;
    return { nombre: config.destinoNombre || config.nombreAbogado || '', numero: num };
}

/**
 * ✅ Una sola lectura de DB (#4 corregido):
 * Antes llamaba a getAlertasCriticas() + getResumenParaWhatsApp() → 2 lecturas.
 * Ahora solo llama a getResumenParaWhatsApp() y extrae críticas desde ahí.
 */
async function _ejecutarCriticos(config) {
    if (!waReady) return;
    const destinatarios = _getDestinatarios(config, 'auto');
    if (destinatarios.length === 0) return;
    try {
        // UNA sola lectura que ya incluye críticas enriquecidas
        const resumen  = alertService.getResumenParaWhatsApp();
        if (!resumen.ok) return;

        const criticas = resumen.alertas.criticas.filter(
            a => !alertService.alertaYaNotificadaHoy(a)
        );
        if (criticas.length === 0) return;

        const templates = _getTemplates(config);
        let listaCriticas = '';
        criticas.forEach(a => {
            listaCriticas += `⚠️ *${a._caratula}*\n${a.mensaje}`;
            if (a._fechaVencFormatted) listaCriticas += ` – Vence: ${a._fechaVencFormatted}`;
            listaCriticas += '\n\n';
        });
        const msg = _tpl(templates.alerta_critica, { listaCriticas });

        const targets = _getDestinatarios(config, 'auto');
        const msgFinal = _appendBranding(config, msg);
        await Promise.allSettled(targets.map(dest => enviarMensaje(dest.numero, msgFinal, 'alerta-critica')));
        criticas.forEach(a => alertService.marcarAlertaNotificada(a.id));
    } catch(e) {
        waLogger.logError('criticos-error', { error: e.message });
    }
}

// ── IPC Handlers ───────────────────────────────────────────────
function registrarHandlers(getConfig) {
    ipcMain.handle('whatsapp:get-chats', async () => {
        await _hidratarChatsDesdeCliente();
        return { ok: true, chats: _getChatsSerializados() };
    });

    ipcMain.handle('whatsapp:get-chat-messages', async (_e, chatId) => {
        const id = _chatIdNormalizado(chatId);
        if (!id) return { ok: false, error: 'chatId inválido', messages: [] };

        if (!_chatCache.has(id) && waClient && waReady) {
            try {
                const chat = await waClient.getChatById(id);
                const msgs = await chat.fetchMessages({ limit: 50 });
                for (const m of msgs || []) {
                    const body = _chatSoloTexto(m);
                    if (!body) continue;
                    _upsertMensajeChat({
                        chatId: id,
                        nombre: String(chat?.name || chat?.formattedTitle || id.replace('@c.us', '')).trim(),
                        body,
                        fromMe: !!m?.fromMe,
                        timestamp: _chatTimestampMs(m?.timestamp),
                        messageId: m?.id?._serialized
                    });
                }
            } catch (e) {
                waLogger.logWarn('chat-fetch-mensajes-fallido', { chatId: id, error: e.message });
            }
        }

        const c = _chatCache.get(id);
        if (c) c.unread = 0;
        return { ok: true, messages: _getMensajesChatSerializados(id, 50) };
    });

    ipcMain.handle('whatsapp:send-reply', async (_e, chatId, mensaje) => {
        const id = _chatIdNormalizado(chatId);
        if (!id) return { ok: false, error: 'chatId inválido' };
        const vMsg = validarMensaje(mensaje);
        if (!vMsg.ok) return { ok: false, error: vMsg.error };
        if (!waClient || !waReady) return { ok: false, error: 'WhatsApp no está conectado' };

        try {
            await waClient.sendMessage(id, String(mensaje).trim());
            _upsertMensajeChat({
                chatId: id,
                nombre: id.replace('@c.us', ''),
                body: String(mensaje).trim(),
                fromMe: true,
                timestamp: Date.now(),
                messageId: `chat-reply-${Date.now()}`
            });
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('whatsapp:estado', () => {
        const cfg = getConfig();

        let numeroConectado = '';
        let perfilConectado = '';
        try {
            // whatsapp-web.js expone info cuando está listo
            if (waClient && waReady && waClient.info) {
                const wid = waClient.info.wid;
                // wid puede ser objeto { user } o string
                const user = (wid && typeof wid === 'object') ? (wid.user || '') : '';
                numeroConectado = user || '';
                perfilConectado = waClient.info.pushname || '';
            }
        } catch (_) { }

        return {
            conectado:      waReady,
            numeroConectado,
            perfilConectado,
            // Sesión activa
            sesionNombre:   cfg.sesionNombre   || '',
            sesionNumero:   cfg.sesionNumero   || '',
            sesionDesde:    cfg.sesionDesde    || null,
            // Abogados principales (nuevo)
            abogadosPrincipales: Array.isArray(cfg.abogadosPrincipales) ? cfg.abogadosPrincipales : [],
            // Plantillas WhatsApp
            waTemplates:    (cfg && typeof cfg.waTemplates === 'object') ? cfg.waTemplates : {},
            // Branding WhatsApp
            waBranding:     (cfg && typeof cfg.waBranding === 'object') ? cfg.waBranding : {},
            // Número principal
            destinoNombre:  cfg.destinoNombre  || cfg.nombreAbogado  || '',
            destinoNumero:  cfg.destinoNumero  || cfg.numeroDestino  || '',
            // Legacy
            numeroDestino:  cfg.numeroDestino  || cfg.destinoNumero  || '',
            nombreAbogado:  cfg.nombreAbogado  || cfg.destinoNombre  || '',
            // Secundarios
            destinatarios:  Array.isArray(cfg.destinatarios) ? cfg.destinatarios : [],
            // Checkbox alertas automáticas
            activo:         !!cfg.activo,
        };
    });

    // Enviar resumen a TODOS los destinatarios activos (scheduler 8AM manual)
    ipcMain.handle('whatsapp:enviar-resumen', async () => {
        const config = getConfig();
        const destinatarios = _getDestinatarios(config, 'manual');
        if (destinatarios.length === 0) return { error: 'Sin destinatarios configurados' };
        try {
            const resumen = alertService.getResumenParaWhatsApp();
            const mensaje = formatearResumen(resumen, config);
            await Promise.allSettled(destinatarios.map(dest => enviarMensaje(dest.numero, mensaje, 'resumen-diario')));
            return { ok: true, destinatarios: destinatarios.length, mensaje };
        }
        catch(e) { return { error: e.message }; }
    });

    // Enviar resumen solo al PRINCIPAL (botón "Enviar resumen ahora")
    ipcMain.handle('whatsapp:enviar-resumen-principal', async () => {
        const config = getConfig();
        const principal = _getPrincipal(config);
        if (!principal) return { error: 'Sin número principal configurado' };
        try {
            const resumen = alertService.getResumenParaWhatsApp();
            const mensaje = formatearResumen(resumen, config);
            await enviarMensaje(principal.numero, mensaje, 'resumen-principal');
            return { ok: true, destinatario: principal.nombre || principal.numero, mensaje };
        } catch(e) { return { error: e.message }; }
    });

    // Enviar alerta/mensaje a TODOS los destinatarios activos
    ipcMain.handle('whatsapp:enviar-alerta', async (_e, mensaje) => {
        const config = getConfig();
        const destinatarios = _getDestinatarios(config, 'manual');
        if (destinatarios.length === 0) return { error: 'Sin destinatarios configurados' };
        const mensajeFinal = _appendBranding(config, mensaje);
        const v = validarMensaje(mensajeFinal);
        if (!v.ok) return { error: v.error };
        try {
            await Promise.allSettled(destinatarios.map(dest => enviarMensaje(dest.numero, mensajeFinal, 'manual')));
            return { ok: true, destinatarios: destinatarios.length, mensaje: mensajeFinal };
        }
        catch(e) { return { error: e.message }; }
    });

    // Enviar mensaje a UN número específico (secundarios on-demand)
    ipcMain.handle('whatsapp:enviar-alerta-a', async (_e, numero, mensaje) => {
        const config = getConfig();
        const v1 = validarNumero(numero);
        if (!v1.ok) return { error: v1.error };
        const mensajeFinal = _appendBranding(config, mensaje);
        const v2 = validarMensaje(mensajeFinal);
        if (!v2.ok) return { error: v2.error };
        try {
            await enviarMensaje(v1.numero, mensajeFinal, 'manual-individual');
            return { ok: true, numero: v1.numero, mensaje: mensajeFinal };
        } catch(e) { return { error: e.message }; }
    });

    // Enviar Bienvenida (híbrido con logo si está configurado)
    ipcMain.handle('whatsapp:enviar-bienvenida', async (_e, numero, mensaje) => {
        const config = getConfig();
        const v1 = validarNumero(numero);
        if (!v1.ok) return { error: v1.error };
        const mensajeFinal = _appendBranding(config, mensaje);
        const v2 = validarMensaje(mensajeFinal);
        if (!v2.ok) return { error: v2.error };
        const logoDataUrl = config?.waBranding?.logoBase64 || '';
        try {
            await enviarMensaje(v1.numero, mensajeFinal, 'bienvenida-cliente', { logoDataUrl, templateKey: 'BIENVENIDA_CLIENTE' });
            return { ok: true, numero: v1.numero, mensaje: mensajeFinal };
        } catch(e) { return { error: e.message }; }
    });

    // Ejecutar ahora alertas de cobro (para pruebas manuales)
    ipcMain.handle('whatsapp:probar-alertas-cobro', async () => {
        const config = getConfig();
        const autoDesactivado = !config.activo;
        if (!waReady) return { error: 'WhatsApp no está listo/conectado' };
        try {
            const rv = await _ejecutarAlertasCobroVencidas(config);
            const r0 = await _ejecutarAlertasCobro(config, 0);
            const r2 = await _ejecutarAlertasCobro(config, 2);

            const resumen = {
                ok: true,
                warning: autoDesactivado ? 'WhatsApp automático está desactivado; ejecución fue manual (prueba).' : undefined,
                resultados: [rv, r0, r2]
            };
            return resumen;
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('whatsapp:desconectar', async () => {
        try {
            if (waClient) await waClient.destroy();
            waReady = false;
            waLogger.logInfo('desconectado-manual', {});
            return { ok: true };
        } catch(e) { return { error: e.message }; }
    });

    ipcMain.handle('whatsapp:logs',        (_e, n)  => waLogger.getLogs(n || 50));
    ipcMain.handle('whatsapp:estadisticas', ()       => waLogger.getEstadisticas());
    ipcMain.handle('whatsapp:limpiar-logs', ()       => { waLogger.limpiarLogs(); return { ok: true }; });
    ipcMain.handle('whatsapp:cache-info',   ()       => alertService.getCacheInfo());
    ipcMain.handle('whatsapp:cola-info',    ()       => waLogger.getInfoCola());
}

module.exports = {
    initWhatsApp,
    iniciarSchedulers,
    registrarHandlers,
    enviarMensaje,
    validarNumero,
    verificarSeguridadElectron
};
