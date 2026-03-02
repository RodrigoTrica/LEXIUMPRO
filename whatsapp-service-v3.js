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

                cuotasVencidas++;

                if (!cuota._waAlertas) cuota._waAlertas = { cliente: {}, equipo: {} };
                if (cuota._waAlertas.cliente?.[marca] && cuota._waAlertas.equipo?.[marca]) {
                    cuotasSaltadasPorMarca++;
                    continue;
                }

                const monto = (cuota.monto || 0);
                const fechaTxt = `el ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL')}`;
                cuotasDetectadas++;

                const msgCliente = `Estimado/a ${clienteNombre}, le recordamos que su cuota Nº ${cuota.numero} de $${Number(monto).toLocaleString('es-CL')} venció ${fechaTxt}.`;
                const msgEquipo = `ALERTA VENCIDA: Cuota Nº ${cuota.numero} de cliente ${clienteNombre} por $${Number(monto).toLocaleString('es-CL')} venció ${fechaTxt}.`;

                const tasks = [];

                if (clienteTel && !cuota._waAlertas.cliente?.[marca] && validarNumero(clienteTel).ok) {
                    enviadosTotal++;
                    tasks.push(
                        enviarMensaje(clienteTel, msgCliente, 'alerta-cobro-vencida-cliente')
                            .then(r => {
                                if (r?.ok !== false) {
                                    cuota._waAlertas.cliente[marca] = true;
                                    cambios++;
                                    enviadosOk++;
                                }
                            })
                            .catch(e => waLogger.logError('cobro-vencida-cliente-envio-fallido', { error: e.message, clienteTel }))
                    );
                }

                if (destinatariosEquipo.length > 0 && !cuota._waAlertas.equipo?.[marca]) {
                    const settled = await Promise.allSettled(destinatariosEquipo.map(d => {
                        enviadosTotal++;
                        return enviarMensaje(d.numero, msgEquipo, 'alerta-cobro-vencida-equipo');
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

                const msgCliente = `Estimado/a ${clienteNombre}, le recordamos que su cuota Nº ${cuota.numero} de $${Number(monto).toLocaleString('es-CL')} vence ${fechaTxt}.`;
                const msgEquipo = `ALERTA: Cuota Nº ${cuota.numero} de cliente ${clienteNombre} por $${Number(monto).toLocaleString('es-CL')} vence ${fechaTxt}.`;

                const tasks = [];

                // Cliente: SI O SI (si tiene teléfono válido)
                if (clienteTel && !cuota._waAlertas.cliente?.[marca] && validarNumero(clienteTel).ok) {
                    enviadosTotal++;
                    tasks.push(
                        enviarMensaje(clienteTel, msgCliente, 'alerta-cobro-cliente')
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
                        return enviarMensaje(d.numero, msgEquipo, 'alerta-cobro-equipo');
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

        let msg = `🚨 *LEXIUM – ALERTA CRÍTICA*\n\n`;
        criticas.forEach(a => {
            msg += `⚠️ *${a._caratula}*\n${a.mensaje}`;
            if (a._fechaVencFormatted) msg += ` – Vence: ${a._fechaVencFormatted}`;
            msg += '\n\n';
        });
        msg += `_Requiere acción inmediata – LEXIUM_`;

        const targets = _getDestinatarios(config, 'auto');
        await Promise.allSettled(targets.map(dest => enviarMensaje(dest.numero, msg, 'alerta-critica')));
        criticas.forEach(a => alertService.marcarAlertaNotificada(a.id));
    } catch(e) {
        waLogger.logError('criticos-error', { error: e.message });
    }
}

// ── IPC Handlers ───────────────────────────────────────────────
function registrarHandlers(getConfig) {
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
        try { await _ejecutarResumen(config, 'manual'); return { ok: true, destinatarios: destinatarios.length }; }
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
        const destinatarios = _getDestinatarios(config, 'manual');
        if (destinatarios.length === 0) return { error: 'Sin destinatarios configurados' };
        const v = validarMensaje(mensaje);
        if (!v.ok) return { error: v.error };
        try {
            await Promise.allSettled(destinatarios.map(dest => enviarMensaje(dest.numero, mensaje, 'manual')));
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
