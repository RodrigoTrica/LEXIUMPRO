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

let Client, LocalAuth, qrcode;
try {
    ({ Client, LocalAuth } = require('whatsapp-web.js'));
    qrcode = require('qrcode');
} catch(e) {
    console.warn('[WhatsApp] Instalar: npm install whatsapp-web.js qrcode node-cron');
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

// ── Inicializar ────────────────────────────────────────────────
function initWhatsApp(browserWindow) {
    if (!Client) return;
    mainWin = browserWindow;

    // Verificar seguridad Electron (#5)
    verificarSeguridadElectron(browserWindow);

    // Detectar si hay sesión previa para no mostrar modal al reconectar
    try {
        const sessionPath = require('path').join(
            require('electron').app.getPath('userData'), '.wa-session'
        );
        _fueReconexionAuto = require('fs').existsSync(sessionPath);
    } catch(_) { _fueReconexionAuto = false; }

    waClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: require('path').join(
                require('electron').app.getPath('userData'),
                '.wa-session'
            )
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

    waClient.initialize().catch(e => waLogger.logError('init-error', { error: e.message }));
}

// ── Envío con reintentos ───────────────────────────────────────
async function enviarMensaje(numero, mensaje, tipo = 'manual') {
    const vNum = validarNumero(numero);
    if (!vNum.ok) throw new Error(`Número inválido: ${vNum.error}`);

    const vMsg = validarMensaje(mensaje);
    if (!vMsg.ok) throw new Error(`Mensaje inválido: ${vMsg.error}`);

    if (!waClient || !waReady) throw new Error('WhatsApp no está conectado.');

    const chatId    = `${vNum.numero}@c.us`;
    const messageId = `${tipo}-${Date.now()}`;

    try {
        await waClient.sendMessage(chatId, mensaje);
        waLogger.logOk('mensaje-enviado', {
            messageId,
            tipo,
            numero: vNum.numero.replace(/\d(?=\d{4})/g, '*')
        });
        mainWin?.webContents.send('whatsapp:alerta-enviada', { tipo, ok: true });
    } catch(e) {
        waLogger.logError('envio-fallido', { messageId, tipo, error: e.message });
        mainWin?.webContents.send('whatsapp:alerta-enviada', { tipo, ok: false, error: e.message });

        waLogger.encolarReintento(
            messageId,
            { numero: vNum.numero, mensaje, tipo },
            (num, msg) => waClient.sendMessage(`${num}@c.us`, msg)
        );
        throw e;
    }
}

// ── Formatear ──────────────────────────────────────────────────
function formatearResumen(resumen, config) {
    const hoy = new Date().toLocaleDateString('es-CL');
    let msg   = `⚖️ *LEXIUM – Reporte Diario*\n📅 ${hoy}\n`;
    if (config.nombreAbogado) msg += `👤 ${config.nombreAbogado}\n`;
    msg += `${'─'.repeat(28)}\n\n`;

    const { alertas, honorarios, stats } = resumen;

    if (alertas.criticas.length > 0) {
        msg += `🚨 *PLAZOS CRÍTICOS (${alertas.criticas.length})*\n`;
        alertas.criticas.forEach(a => {
            msg += `• *${a._caratula}*\n  ${a.mensaje}`;
            if (a._fechaVencFormatted) msg += ` – Vence: ${a._fechaVencFormatted}`;
            msg += '\n';
        });
        msg += '\n';
    }

    if (alertas.altas.length > 0) {
        msg += `⚠️ *ALERTAS IMPORTANTES (${alertas.altas.length})*\n`;
        alertas.altas.forEach(a => msg += `• ${a._caratula}: ${a.mensaje}\n`);
        msg += '\n';
    }

    if (alertas.inactivas.length > 0) {
        msg += `😴 *SIN MOVIMIENTO (${alertas.inactivas.length})*\n`;
        alertas.inactivas.forEach(a => msg += `• ${a._caratula}\n`);
        msg += '\n';
    }

    if (honorarios.causas.length > 0) {
        msg += `💰 *HONORARIOS PENDIENTES*\n`;
        msg += `• ${honorarios.causas.length} causa(s) · Total: $${honorarios.total.toLocaleString('es-CL')}\n\n`;
    }

    const cobrosHoy = alertas.cobrosHoy || [];
    if (cobrosHoy.length > 0) {
        msg += `💳 *COBROS VENCEN HOY (${cobrosHoy.length})*\n`;
        cobrosHoy.forEach(c => {
            msg += `• *${c.caratula}*\n  💰 $${c.monto.toLocaleString('es-CL')} – 📅 ${c.fecha}\n`;
        });
        msg += '\n';
    }

    if (!alertas.criticas.length && !alertas.altas.length && !alertas.inactivas.length && !honorarios.causas.length && !cobrosHoy.length) {
        msg += `✅ *Sin alertas activas hoy*\n\n`;
    }

    msg += `${'─'.repeat(28)}\n`;
    msg += `📊 ${stats.causasActivas} activa(s) · ${stats.totalAlertas} alerta(s)\n`;
    msg += `_Enviado por LEXIUM_`;
    return msg;
}

// ── Schedulers ─────────────────────────────────────────────────
function iniciarSchedulers(configOrFn) {
    // Acepta objeto fijo o función que devuelve config actualizada
    const getConf = typeof configOrFn === 'function' ? configOrFn : () => configOrFn;

    cron.schedule('0 8 * * *', async () => {
        const config = getConf();
        if (!config.activo) return;   // respetar checkbox en tiempo real
        waLogger.logInfo('scheduler-resumen-diario', {});
        await _ejecutarResumen(config);
    }, { timezone: 'America/Santiago' });

    cron.schedule('0 * * * *', async () => {
        const config = getConf();
        if (!config.activo) return;
        await _ejecutarCriticos(config);
    }, { timezone: 'America/Santiago' });

    waLogger.logInfo('schedulers-iniciados', {});
}

async function _ejecutarResumen(config) {
    if (!waReady) return;
    // Soporte para lista de destinatarios (nuevo) y fallback a numeroDestino (legacy)
    const destinatarios = _getDestinatarios(config);
    if (destinatarios.length === 0) return;
    try {
        const resumen = alertService.getResumenParaWhatsApp(); // una sola lectura
        const mensaje = formatearResumen(resumen, config);
        for (const dest of destinatarios) {
            try {
                await enviarMensaje(dest.numero, mensaje, 'resumen-diario');
            } catch(e) {
                waLogger.logError('resumen-diario-error', { numero: dest.numero, error: e.message });
            }
        }
    } catch(e) {
        waLogger.logError('resumen-diario-error', { error: e.message });
    }
}

/**
 * Retorna la lista efectiva de destinatarios para el scheduler 8AM.
 *
 * - Principal (destinoNumero / numeroDestino): SIEMPRE incluido si está configurado.
 * - Secundarios (config.destinatarios[]): solo los que tienen autoEnvio !== false.
 * - Legacy (numeroDestino sin destinoNumero): compatibilidad hacia atrás.
 */
function _getDestinatarios(config) {
    const lista = [];

    // Principal
    const numPrincipal = config.destinoNumero || config.numeroDestino || '';
    if (numPrincipal && validarNumero(numPrincipal).ok) {
        lista.push({
            nombre: config.destinoNombre || config.nombreAbogado || '',
            numero: numPrincipal,
            tipo: 'principal'
        });
    }

    // Secundarios con autoEnvio activo
    if (Array.isArray(config.destinatarios)) {
        for (const d of config.destinatarios) {
            if (!d.numero || !validarNumero(d.numero).ok) continue;
            if (d.numero === numPrincipal) continue;          // evitar duplicado
            if (d.autoEnvio === false) continue;              // pausado por el usuario
            lista.push({ nombre: d.nombre || '', numero: d.numero, tipo: 'secundario' });
        }
    }

    return lista;
}

/**
 * Solo el principal (para envíos manuales desde botón "Enviar resumen ahora").
 */
function _getPrincipal(config) {
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
    const destinatarios = _getDestinatarios(config);
    if (destinatarios.length === 0) return;
    try {
        // UNA sola lectura que ya incluye críticas enriquecidas
        const resumen  = alertService.getResumenParaWhatsApp();
        if (!resumen.ok) return;

        const criticas = resumen.alertas.criticas.filter(
            a => !alertService.alertaYaNotificadaHoy(a)
        );
        if (criticas.length === 0) return;

        let msg = `🚨 *LEXIUM – ALERTA CRÍTICA*\n\n`;
        criticas.forEach(a => {
            msg += `⚠️ *${a._caratula}*\n${a.mensaje}`;
            if (a._fechaVencFormatted) msg += ` – Vence: ${a._fechaVencFormatted}`;
            msg += '\n\n';
        });
        msg += `_Requiere acción inmediata – LEXIUM_`;

        const destinatarios = _getDestinatarios(config);
        for (const dest of destinatarios) {
            try { await enviarMensaje(dest.numero, msg, 'alerta-critica'); } catch(_) {}
        }
        criticas.forEach(a => alertService.marcarAlertaNotificada(a.id));
    } catch(e) {
        waLogger.logError('criticos-error', { error: e.message });
    }
}

// ── IPC Handlers ───────────────────────────────────────────────
function registrarHandlers(getConfig) {
    ipcMain.handle('whatsapp:estado', () => {
        const cfg = getConfig();
        return {
            conectado:      waReady,
            // Sesión activa
            sesionNombre:   cfg.sesionNombre   || '',
            sesionNumero:   cfg.sesionNumero   || '',
            sesionDesde:    cfg.sesionDesde    || null,
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
        const destinatarios = _getDestinatarios(config);
        if (destinatarios.length === 0) return { error: 'Sin destinatarios configurados' };
        try { await _ejecutarResumen(config); return { ok: true, destinatarios: destinatarios.length }; }
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
            return { ok: true, destinatario: principal.nombre || principal.numero };
        } catch(e) { return { error: e.message }; }
    });

    // Enviar alerta/mensaje a TODOS los destinatarios activos
    ipcMain.handle('whatsapp:enviar-alerta', async (_e, mensaje) => {
        const config = getConfig();
        const destinatarios = _getDestinatarios(config);
        if (destinatarios.length === 0) return { error: 'Sin destinatarios configurados' };
        const v = validarMensaje(mensaje);
        if (!v.ok) return { error: v.error };
        try {
            for (const dest of destinatarios) {
                try { await enviarMensaje(dest.numero, mensaje, 'manual'); } catch(_) {}
            }
            return { ok: true, destinatarios: destinatarios.length };
        }
        catch(e) { return { error: e.message }; }
    });

    // Enviar mensaje a UN número específico (secundarios on-demand)
    ipcMain.handle('whatsapp:enviar-alerta-a', async (_e, numero, mensaje) => {
        const v1 = validarNumero(numero);
        if (!v1.ok) return { error: v1.error };
        const v2 = validarMensaje(mensaje);
        if (!v2.ok) return { error: v2.error };
        try {
            await enviarMensaje(v1.numero, mensaje, 'manual-individual');
            return { ok: true };
        } catch(e) { return { error: e.message }; }
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
