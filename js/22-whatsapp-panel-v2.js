/**
 * LEXIUM – js/22-whatsapp-panel-v2.js  (v5 — flujo QR completo)
 * ─────────────────────────────────────────────────────────────
 * ✅ Tras escanear QR → modal pide nombre + número propio de la sesión
 * ✅ Usuario activo (nombre + número + desde cuándo) visible en el panel
 * ✅ Destino de reenvío automático guardado en config (no hay campo repetido)
 * ✅ waEnviarResumen() usa número del destinatario guardado
 * ✅ waEnviarAOtroNumero() usa wa-numero-alt one-shot
 * ✅ Polling inteligente: solo cuando el panel está visible
 * ✅ use strict + window.* expuestos para onclick en HTML
 */

'use strict';

let _conectado = false;
let _intervalEstado = null;

let _sesion = { nombre: '', numero: '', desde: null };
let _abogadosPrincipales = []; // lista flexible: [{ nombre, numero }]
let _principalEditNumero = null; // numero (limpio) en edición
let _destinatarios = []; // lista de destinatarios (nuevo sistema)
let _destEditNumero = null; // numero (limpio) en edición
let _reconexionAuto = false;  // true cuando reconecta desde sesión guardada (sin QR)

let _waTemplates = {};
let _waBranding = { webLink: '', logoBase64: '', autoAppend: true };
let _waTplSelectedKey = null;
let _waBrandingTouchedAt = 0;
let _waBrandingHydrated = false;

const WA_TPL_KEYS = [
    { key: 'RECORDATORIO_PAGO', label: 'RECORDATORIO_PAGO (Cuotas)' },
    { key: 'VENCE_HOY', label: 'VENCE_HOY (Cuotas que vencen hoy)' },
    { key: 'PAGO_VENCIDO', label: 'PAGO_VENCIDO (Cuotas vencidas)' },
    { key: 'ALERTA_VENCIMIENTO', label: 'ALERTA_VENCIMIENTO (Plazos críticos legales)' },
    { key: 'BIENVENIDA_CLIENTE', label: 'BIENVENIDA_CLIENTE (Nuevo cliente)' },
    { key: 'MENSAJE_LIBRE', label: 'MENSAJE_LIBRE (Envíos manuales)' },
];

const WA_TPL_DEFAULTS_UI = {
    RECORDATORIO_PAGO: 'Estimado/a {nombre_cliente}, le recordamos que su cuota de $ {monto} vence {fecha_venc}.',
    VENCE_HOY: 'Estimado/a {nombre_cliente}, su cuota de $ {monto} vence hoy. Si ya pagó, por favor ignorar este mensaje.',
    PAGO_VENCIDO: 'Estimado/a {nombre_cliente}, su cuota de $ {monto} venció el {fecha_venc}. Favor regularizar a la brevedad.',
    ALERTA_VENCIMIENTO: '🚨 *ALERTA DE VENCIMIENTO*\n\n{detalle}',
    BIENVENIDA_CLIENTE: 'Hola {nombre_cliente}, bienvenido/a. Quedamos atentos a ayudarte. ',
    MENSAJE_LIBRE: 'Hola {nombre_cliente},\n\n{mensaje}',
};

function _waTplNormalizeCurly(s) {
    return String(s || '')
        .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, '{$1}')
        .replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');
}

function waBrandingOnWebInput() {
    try {
        _waBrandingTouchedAt = Date.now();
        _waBranding.webLink = (document.getElementById('wa-brand-weblink')?.value || '').trim();
        waTemplatesOnChange();
    } catch (_) {}
}

async function waBrandingGuardar() {
    try {
        _waBrandingTouchedAt = Date.now();
        _waBranding = {
            webLink: (document.getElementById('wa-brand-weblink')?.value || '').trim(),
            logoBase64: (_waBranding?.logoBase64 || ''),
            autoAppend: true
        };

        const r = await window.electronAPI.whatsapp.guardarConfig({ waBranding: _waBranding });
        if (r?.error) throw new Error(r.error);
        _waBrandingHydrated = true;
        EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'Branding guardado correctamente.' });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e?.message || 'No se pudo guardar Branding.' });
    }
}

function waTplInsertVar(varName) {
    try {
        const ta = document.getElementById('wa-tpl-texto');
        if (!ta) return;
        const token = `{${String(varName || '').trim()}}`;
        const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
        const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : ta.value.length;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        ta.value = `${before}${token}${after}`;
        const pos = start + token.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
        waTemplatesOnChange();
    } catch (_) {}
}

function _waBrandingSetLogoPreview(dataUrl) {
    try {
        const img = document.getElementById('wa-brand-logo-preview');
        if (!img) return;
        const ok = !!(dataUrl && String(dataUrl).startsWith('data:image/'));
        img.src = ok ? String(dataUrl) : '';
        img.style.display = ok ? 'block' : 'none';
    } catch (_) {}
}

function waBrandingClearLogo() {
    try {
        _waBrandingTouchedAt = Date.now();
        _waBranding.logoBase64 = '';
        const inp = document.getElementById('wa-brand-logo');
        if (inp) inp.value = '';
        _waBrandingSetLogoPreview('');
        waTemplatesOnChange();
        waBrandingGuardar();
    } catch (_) {}
}

async function waBrandingOnLogoChange(ev) {
    try {
        _waBrandingTouchedAt = Date.now();
        const file = ev?.target?.files?.[0];
        if (!file) return;
        const maxBytes = 2 * 1024 * 1024;
        if (file.size > maxBytes) {
            EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'El logo excede 2MB. Usa una imagen más liviana.' });
            waBrandingClearLogo();
            return;
        }
        const typeOk = /^image\/(png|jpeg|jpg|pjpeg|x-png)$/i.test(file.type || '');
        const nameOk = /\.(png|jpe?g)$/i.test(file.name || '');
        if (!typeOk && !nameOk) {
            EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Formato no soportado. Usa PNG o JPG.' });
            waBrandingClearLogo();
            return;
        }
        const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => reject(new Error('No se pudo leer el archivo'));
            r.readAsDataURL(file);
        });
        if (!String(dataUrl).startsWith('data:image/')) throw new Error('dataUrl inválido');
        _waBranding.logoBase64 = String(dataUrl);
        _waBrandingSetLogoPreview(_waBranding.logoBase64);
        waTemplatesOnChange();
        await waBrandingGuardar();
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e?.message || String(e) });
        waBrandingClearLogo();
    }
}

function _waTplToEngine(s) {
    // UI usa {var}; motor en main usa {{var}}
    return String(s || '').replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{{$1}}');
}

function _waTplRenderUI(templateUI, vars) {
    try {
        return String(templateUI || '').replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_m, k) => {
            const v = vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '';
            return (v === null || v === undefined) ? '' : String(v);
        });
    } catch (_) {
        return String(templateUI || '');
    }
}

function _waBrandingFirmaUI() {
    const web = (document.getElementById('wa-brand-weblink')?.value || '').trim();
    if (!web) return '';
    return `\n\n${web}`;
}

function _getNombreEstudioActivo() {
    try {
        const usuarios = (typeof AppConfig !== 'undefined' && AppConfig.get) ? (AppConfig.get('usuarios') || []) : [];
        const activo = usuarios.find(u => u && u.activo);
        const nombre = (activo?.nombre || 'Estudio').trim();
        if (!nombre || /^administrador$/i.test(nombre)) return 'Estudio';
        return nombre;
    } catch (_) {
        return 'Estudio';
    }
}

function _waTplBuildFinalUI(baseTextUI) {
    const base = String(baseTextUI || '').trimEnd();
    const firma = _waBrandingFirmaUI();
    return `${base}${firma}`.trim();
}

function _waTplStripBrandingWeb(baseTextUI) {
    const web = (document.getElementById('wa-brand-weblink')?.value || '').trim();
    let txt = String(baseTextUI || '').trimEnd();
    if (!web) return txt;

    // Remover repeticiones heredadas de guardados anteriores en líneas finales
    const esc = web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(?:\\n\\s*${esc}\\s*)+$`, 'i');
    txt = txt.replace(rx, '').trimEnd();
    return txt;
}

function _waTemplatesEnsureDefaults() {
    _waTemplates = { ...WA_TPL_DEFAULTS_UI, ...(_waTemplates || {}) };
    for (const k of Object.keys(_waTemplates)) {
        _waTemplates[k] = _waTplNormalizeCurly(_waTemplates[k]);
    }
}

function _waTemplatesSelect(key) {
    _waTplSelectedKey = key;
    const inputName = document.getElementById('wa-tpl-nombre');
    const ta = document.getElementById('wa-tpl-texto');
    if (inputName) inputName.value = key || '';
    if (ta) ta.value = _waTemplates?.[key] || '';
    waTemplatesOnChange();

    try {
        const list = document.getElementById('wa-templates-list');
        if (list) {
            Array.from(list.querySelectorAll('[data-wa-tpl]')).forEach(btn => {
                btn.style.borderColor = (btn.getAttribute('data-wa-tpl') === key) ? '#25D366' : 'var(--border)';
            });
        }
    } catch (_) {}
}

function _waTemplatesRenderList() {
    const el = document.getElementById('wa-templates-list');
    if (!el) return;
    el.innerHTML = WA_TPL_KEYS.map(x => {
        const active = x.key === _waTplSelectedKey;
        return `
            <button data-wa-tpl="${x.key}" onclick="waTemplatesSelect('${x.key}')"
                class="btn" style="text-align:left; justify-content:flex-start; background:transparent; border:1px solid ${active ? '#25D366' : 'var(--border)'}; padding:8px 10px;">
                <div style="display:flex; flex-direction:column; gap:2px; width:100%;">
                    <div style="font-weight:700; font-size:12px;">${escHtml(x.label)}</div>
                    <div style="font-size:11px; color:var(--text-3); font-family:monospace;">${escHtml(x.key)}</div>
                </div>
            </button>
        `;
    }).join('');
}

function waTemplatesOnChange() {
    const ta = document.getElementById('wa-tpl-texto');
    const preview = document.getElementById('wa-tpl-preview');
    if (!ta || !preview) return;

    const vars = {
        nombre_cliente: 'Juan Pérez',
        monto: '250.000',
        fecha_venc: '31-03-2026',
        nombre_estudio: _getNombreEstudioActivo(),
        detalle: '*Causa:* Pérez c/ López\n*Vence:* mañana',
        mensaje: 'Te escribimos para coordinar el envío de antecedentes.'
    };

    const base = ta.value || '';
    const finalUI = _waTplBuildFinalUI(base);
    preview.textContent = _waTplRenderUI(finalUI, vars);
}

async function waTemplatesGuardar() {
    try {
        if (!_waTplSelectedKey) {
            EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Selecciona una plantilla.' });
            return;
        }
        const ta = document.getElementById('wa-tpl-texto');
        if (!ta) return;

        const rawUI = ta.value || '';
        _waTemplates[_waTplSelectedKey] = _waTplNormalizeCurly(_waTplStripBrandingWeb(rawUI));

        // Persistir: convertir a {{var}} para motor
        const engineTemplates = {};
        for (const k of Object.keys(_waTemplates || {})) {
            // Guardar SIEMPRE plantilla base (sin branding), branding se adjunta al enviar
            const baseUI = _waTplNormalizeCurly(_waTplStripBrandingWeb(_waTemplates[k]));
            engineTemplates[k] = _waTplToEngine(baseUI);
        }

        await window.electronAPI.whatsapp.guardarConfig({
            waTemplates: engineTemplates
        });

        EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Plantilla guardada: ${_waTplSelectedKey}` });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e?.message || String(e) });
    }
}

async function waTemplatesRestaurarDefaults() {
    try {
        _waTemplates = { ...WA_TPL_DEFAULTS_UI };
        _waTemplatesEnsureDefaults();
        _waTemplatesRenderList();
        _waTemplatesSelect(WA_TPL_KEYS[0]?.key || 'RECORDATORIO_PAGO');
        EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'Plantillas restauradas.' });
    } catch (_) {}
}

function waTemplatesSelect(key) {
    _waTemplatesSelect(key);
}

function _esPanelVisible() {
    const sec = document.getElementById('seccion-whatsapp');
    return sec && sec.classList.contains('active');
}

async function waRevisarCobrosAhora() {
    try {
        console.log('[WA] Revisar Cobros Ahora: iniciando...');
        await verificarAlertasCobro(0);
        console.log('[WA] Revisar Cobros Ahora: fin');
        EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'Revisión de cobros ejecutada. Revisa la consola para ver a quién se envió.' });
    } catch (e) {
        console.error('[WA] Error en Revisar Cobros Ahora:', e);
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e?.message || 'Error al revisar cobros.' });
    }
}

function _iniciarPolling() {
    if (_intervalEstado) clearInterval(_intervalEstado);
    _intervalEstado = setInterval(() => {
        if (!_esPanelVisible()) return;
        actualizarEstado();
        if (_conectado) { actualizarStats(); actualizarLog(); }
    }, 10 * 1000);
}

function initWhatsAppPanel() {
    if (!window.electronAPI?.whatsapp) return;

    window.electronAPI.whatsapp.onEvento((tipo, data) => {
        switch (tipo) {
            case 'qr':
                mostrarQR(data?.dataUrl || null);
                break;
            case 'ready':
                // Solo mostrar modal si fue por QR nuevo (no reconexión automática)
                if (!_reconexionAuto) {
                    _onQRListo(data);
                } else {
                    // Reconexión automática: conectar directo sin modal
                    onConectado(data || {});
                }
                _reconexionAuto = false;
                try { EventBus.emit('whatsapp:connected', { sesionNombre: data?.sesionNombre || null, sesionNumero: data?.sesionNumero || null }); } catch (_) {}
                break;
            case 'reconectado-auto':
                // Marcar flag ANTES de que llegue el 'ready'
                _reconexionAuto = true;
                onConectado(data || {});
                EventBus.emit('notificacion', { tipo: 'ok', mensaje: '✅ WhatsApp reconectado automáticamente' });
                try { EventBus.emit('whatsapp:reconnected', { sesionNombre: data?.sesionNombre || null, sesionNumero: data?.sesionNumero || null }); } catch (_) {}
                break;
            case 'cargando':
                setBadge(`Reconectando… ${data?.percent || 0}%`, '#f59e0b');
                break;
            case 'disconnected':
            case 'auth_failure':
                onDesconectado();
                try { EventBus.emit('whatsapp:disconnected', { reason: tipo }); } catch (_) {}
                break;
            case 'alerta-enviada':
                actualizarStats();
                actualizarLog();
                try { EventBus.emit('whatsapp:alert-sent', { ok: data?.ok !== false, tipo: data?.tipo || null, numero: data?.numero || null, mensaje: data?.mensaje || null, error: data?.error || null }); } catch (_) {}
                break;
        }
    });

    actualizarEstado();
    _cargarConfigGuardada();

    // Persistir el toggle "Alertas automáticas" al instante
    try {
        const chk = document.getElementById('wa-activo');
        if (chk && !chk._lexiumBound) {
            chk._lexiumBound = true;
            chk.addEventListener('change', async () => {
                await _guardarDestinatarios();
            });
        }
    } catch (_) { }

    _iniciarPolling();
}

async function _cargarConfigGuardada() {
    try {
        const e = await window.electronAPI.whatsapp.estado();

        if (e.sesionNombre || e.sesionNumero) {
            _sesion.nombre = e.sesionNombre || '';
            _sesion.numero = e.sesionNumero || '';
            _sesion.desde = e.sesionDesde ? new Date(e.sesionDesde) : null;
        }

        // Abogados principales (nuevo). Compat: si vienen campos legacy, migrar a lista.
        if (Array.isArray(e.abogadosPrincipales) && e.abogadosPrincipales.length > 0) {
            _abogadosPrincipales = e.abogadosPrincipales
                .map(a => ({
                    nombre: a?.nombre || '',
                    numero: a?.numero || '',
                    autoEnvio: a?.autoEnvio !== false,
                    envioManual: a?.envioManual !== false
                }))
                .filter(a => !!_waNumeroLimpio(a.numero));
        } else {
            const legacyNombre = e.destinoNombre || e.nombreAbogado || '';
            const legacyNumero = e.destinoNumero || e.numeroDestino || '';
            if (_waNumeroLimpio(legacyNumero)) {
                _abogadosPrincipales = [{ nombre: legacyNombre, numero: legacyNumero, autoEnvio: true, envioManual: true }];
            } else {
                _abogadosPrincipales = [];
            }
        }

        // Pre-rellenar inputs para "agregar"
        const pNombre = document.getElementById('wa-principal-nombre');
        const pNumero = document.getElementById('wa-principal-numero');
        if (pNombre) pNombre.value = '';
        if (pNumero) pNumero.value = '';
        _principalEditNumero = null;
        _syncPrincipalEdicionUI();

        _renderListaPrincipales();

        // Secundarios: { nombre, numero, autoEnvio }
        if (Array.isArray(e.destinatarios) && e.destinatarios.length > 0) {
            _destinatarios = e.destinatarios.map(d => ({
                nombre:    d.nombre    || '',
                numero:    d.numero    || '',
                autoEnvio: d.autoEnvio !== false,   // default true
                envioManual: d.envioManual !== false
            }));
        }
        _destEditNumero = null;
        _syncDestEdicionUI();
        _renderListaDestinatarios();

        const chk = document.getElementById('wa-activo');
        if (chk && e.activo !== undefined) chk.checked = !!e.activo;

        if (e.conectado) onConectado(e);
    } catch (_) { }
}

function mostrarQR(dataUrl) {
    const wrap = document.getElementById('wa-qr-wrap');
    const img = document.getElementById('wa-qr-img');
    if (!wrap || !img) return;
    if (dataUrl) img.src = dataUrl;
    else img.alt = 'QR no disponible — revisa la consola';
    wrap.style.display = 'block';
    setBadge('Escanea el QR', '#f59e0b');
}

function _waNumeroLimpio(raw) {
    return (raw || '').toString().replace(/[\s\+\-\(\)]/g, '').trim();
}

function _fechaISO10(d) {
    try { return new Date(d).toISOString().slice(0, 10); }
    catch (_) { return ''; }
}

/**
 * Verifica cuotas que vencen HOY (o n días antes) y envía alertas WA doble vía.
 * - Al Cliente (si tiene teléfono)
 * - Al Abogado/Admin (número principal configurado en panel WA)
 *
 * Evita spam marcando flags por cuota y día.
 */
async function verificarAlertasCobro(diasAntes = 0) {
    if (!_conectado) return;
    if (!window.electronAPI?.whatsapp) return;

    const hoy = new Date();
    const target = new Date(hoy);
    target.setDate(target.getDate() + (parseInt(diasAntes) || 0));
    const targetISO = _fechaISO10(target);

    const causas = DB?.causas || [];

    for (const causa of causas) {
        const h = causa?.honorarios;
        if (!h || h.modalidad !== 'CUOTAS') continue;
        const plan = Array.isArray(h.planPagos) ? h.planPagos : [];
        if (!plan.length) continue;

        const cliente = (DB?.clientes || []).find(c => c.id === causa.clienteId);
        const clienteNombre = cliente?.nombre || cliente?.nom || causa?.caratula || 'Cliente';
        const clienteTel = _waNumeroLimpio(cliente?.telefono);

        const internosMap = new Map();
        (_abogadosPrincipales || []).filter(a => a && a.autoEnvio !== false).forEach(a => {
            const n = _waNumeroLimpio(a?.numero);
            if (!n) return;
            internosMap.set(n, { nombre: a?.nombre || 'Abogado principal', numero: n, tipo: 'principal' });
        });
        (_destinatarios || []).filter(d => d && d.autoEnvio !== false).forEach(d => {
            const n = _waNumeroLimpio(d.numero);
            if (!n) return;
            if (!internosMap.has(n)) internosMap.set(n, { nombre: d?.nombre || 'Reenvío', numero: n, tipo: 'secundario' });
        });

        for (const cuota of plan) {
            if (!cuota) continue;
            if (cuota.estado === 'PAGADA') continue;
            const venceISO = _fechaISO10(cuota.fechaVencimiento);
            if (!venceISO || venceISO !== targetISO) continue;

            // Compat/migración: versiones anteriores usaban { cliente, admin }
            if (!cuota._waAlertas || typeof cuota._waAlertas !== 'object') cuota._waAlertas = {};
            if (!cuota._waAlertas.cliente || typeof cuota._waAlertas.cliente !== 'object') cuota._waAlertas.cliente = {};
            if (!cuota._waAlertas.equipo || typeof cuota._waAlertas.equipo !== 'object') {
                cuota._waAlertas.equipo = (cuota._waAlertas.admin && typeof cuota._waAlertas.admin === 'object')
                    ? cuota._waAlertas.admin
                    : {};
            }
            const marca = (diasAntes === 0) ? 'hoy' : `d-${diasAntes}`;
            if (cuota._waAlertas.cliente?.[marca] && cuota._waAlertas.equipo?.[marca]) continue;

            const monto = (cuota.monto || 0);
            const msgCliente = `Estimado/a ${clienteNombre}, le recordamos que su cuota Nº ${cuota.numero} de $${monto.toLocaleString('es-CL')} vence ${diasAntes === 0 ? 'hoy' : `el ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL')}`}.`;
            const msgEquipo = `ALERTA: Cuota Nº ${cuota.numero} de cliente ${clienteNombre} por $${monto.toLocaleString('es-CL')} vence ${diasAntes === 0 ? 'hoy' : `el ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-CL')}`}.`;

            try {
                if (clienteTel && !cuota._waAlertas.cliente?.[marca]) {
                    const respC = await window.electronAPI.whatsapp.enviarAlertaA(clienteTel, msgCliente);
                    if (respC?.ok) {
                        cuota._waAlertas.cliente[marca] = true;
                    }
                }
            } catch (e) {
                console.error('[WA] Error enviando alerta a cliente:', e);
            }

            try {
                if (internosMap.size > 0 && !cuota._waAlertas.equipo?.[marca]) {
                    let enviados = 0;
                    for (const dest of internosMap.values()) {
                        try {
                            console.log(`[WA] Enviando a ${dest.nombre} (+${dest.numero})...`);
                            const r = await window.electronAPI.whatsapp.enviarAlertaA(dest.numero, msgEquipo);
                            if (r?.ok) enviados++;
                        } catch (e2) {
                            console.error('[WA] Error enviando alerta a interno:', e2);
                        }
                    }
                    if (enviados > 0) {
                        cuota._waAlertas.equipo[marca] = true;
                    }
                }
            } catch (e) {
                console.error('[WA] Error enviando alerta a equipo:', e);
            }

            // Persistir flags aunque solo haya salido uno (evita reintentos excesivos)
            if (typeof guardarDB === 'function') guardarDB();
        }
    }
}

// Ejecutar verificación al iniciar y luego cada hora
setTimeout(() => verificarAlertasCobro(0), 5000);
setInterval(() => verificarAlertasCobro(0), 60 * 60 * 1000);

function _onQRListo(data) {
    const wrap = document.getElementById('wa-qr-wrap');
    if (wrap) wrap.style.display = 'none';

    const modal = document.getElementById('modal-wa-nombre');
    if (modal) {
        modal.style.display = 'flex';
        const inputN = document.getElementById('wa-modal-nombre');
        const inputU = document.getElementById('wa-modal-numero');
        if (inputN && _sesion.nombre) inputN.value = _sesion.nombre;
        if (inputU && _sesion.numero) inputU.value = _sesion.numero;
        setTimeout(() => document.getElementById('wa-modal-nombre')?.focus(), 100);
    } else {
        onConectado(data);
    }
}

async function waConfirmarSesion() {
    const nombre = document.getElementById('wa-modal-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-modal-numero')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!nombre) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa un nombre para identificar esta sesión' });
        return;
    }

    _sesion.nombre = nombre;
    _sesion.numero = numero;
    _sesion.desde = new Date();

    try {
        await window.electronAPI.whatsapp.guardarConfig({
            sesionNombre: nombre,
            sesionNumero: numero,
            sesionDesde: _sesion.desde.toISOString()
        });
    } catch (_) { }

    try {
        cerrarModal('modal-wa-nombre');
    } catch (_) {
        const m = document.getElementById('modal-wa-nombre');
        if (m) m.style.display = 'none';
    }

    onConectado({ sesionNombre: nombre, sesionNumero: numero });
    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Sesión registrada: ${nombre}` });
}

function onConectado(data) {
    _conectado = true;
    if (data?.sesionNombre) _sesion.nombre = data.sesionNombre;
    if (data?.sesionNumero) _sesion.numero = data.sesionNumero;
    if (!_sesion.desde) _sesion.desde = new Date();
    document.getElementById('wa-test-card')?.style.setProperty('display', 'block');

    // Actualizar teléfono en el header con máscara internacional
    if (_sesion.numero) {
        const phoneEl = document.getElementById('topbar-phone');
        if (phoneEl) {
            // Aplicar máscara: los primeros 2 dígitos = código país (ej: 56 → +56)
            const num = _sesion.numero.replace(/\D/g, '');
            const codigoPais = num.slice(0, 2);
            const resto = num.slice(2);
            const masked = `+${codigoPais} ${resto.slice(0, 1)} ${resto.slice(1, 5)}-${resto.slice(5)}`;
            phoneEl.textContent = masked;
            phoneEl.style.display = 'block';
        }
    }

    setBadge('Conectado ✓', '#25D366');

    // Mostrar info real de la cuenta conectada (si el backend la expone)
    try {
        const numero = _waNumeroLimpio(data?.numeroConectado) || _waNumeroLimpio(_sesion.numero);
        const perfil = (data?.perfilConectado || '').toString().trim();
        if (perfil) {
            setText('wa-activo-nombre', perfil);
        }
        if (numero) {
            const phoneEl = document.getElementById('topbar-phone');
            if (phoneEl) {
                phoneEl.textContent = `+${numero}`;
                phoneEl.style.display = 'block';
            }
            setText('wa-activo-numero', `+${numero}`);
        }
    } catch (_) { }

    const qr = document.getElementById('wa-qr-wrap');
    const btn = document.getElementById('wa-btn-toggle');
    if (qr) qr.style.display = 'none';
    if (btn) { btn.textContent = 'Desconectar'; btn.style.background = '#ef4444'; btn.style.borderColor = '#ef4444'; }

    _mostrarUsuarioActivo();
    document.getElementById('wa-stats-card')?.style.setProperty('display', 'block');
    document.getElementById('wa-log-card')?.style.setProperty('display', 'block');
    actualizarStats();
    actualizarLog();
}

function _mostrarUsuarioActivo() {
    const card = document.getElementById('wa-usuario-activo');
    if (!card) return;

    setText('wa-activo-nombre', _sesion.nombre || '(Sin nombre)');
    setText('wa-activo-numero', _sesion.numero ? `+${_sesion.numero}` : '(Número no registrado)');

    if (_sesion.desde) {
        const diffMin = Math.floor((new Date() - _sesion.desde) / 60000);
        let textoDesde;
        if (diffMin < 1) textoDesde = 'Ahora mismo';
        else if (diffMin < 60) textoDesde = `Hace ${diffMin} min`;
        else textoDesde = _sesion.desde.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setText('wa-activo-desde', textoDesde);
    }

    card.style.display = 'block';
}

function onDesconectado() {
    _conectado = false;
    setBadge('Desconectado', '#ef4444');
    const btn = document.getElementById('wa-btn-toggle');
    const card = document.getElementById('wa-usuario-activo');
    if (btn) { btn.textContent = 'Conectar'; btn.style.background = ''; btn.style.borderColor = ''; }
    if (card) card.style.display = 'none';
    document.getElementById('wa-test-card')?.style.setProperty('display', 'none');
}

function setBadge(txt, color) {
    const b = document.getElementById('wa-badge');
    if (!b) return;
    b.textContent = txt;
    b.style.background = color;
}

async function actualizarEstado() {
    try {
        const e = await window.electronAPI.whatsapp.estado();

        // Si está conectado, actualizar cabecera con info de la cuenta (si existe)
        if (e?.conectado) {
            try {
                if (e.perfilConectado) {
                    setText('wa-activo-nombre', e.perfilConectado);
                }
                if (e.numeroConectado) {
                    const n = _waNumeroLimpio(e.numeroConectado);
                    const phoneEl = document.getElementById('topbar-phone');
                    if (phoneEl && n) {
                        phoneEl.textContent = `+${n}`;
                        phoneEl.style.display = 'block';
                    }
                    if (n) setText('wa-activo-numero', `+${n}`);
                }
            } catch (_) { }
        }

        // Siempre sincronizar config guardada (por si se guardó desde otra sesión)
        if (Array.isArray(e.abogadosPrincipales)) {
            const incoming = e.abogadosPrincipales
                .map(a => ({ nombre: a?.nombre || '', numero: a?.numero || '' }))
                .filter(a => !!_waNumeroLimpio(a.numero));
            const same = JSON.stringify(incoming.map(x => ({ n: _waNumeroLimpio(x.numero), nombre: x.nombre || '' }))) ===
                         JSON.stringify((_abogadosPrincipales || []).map(x => ({ n: _waNumeroLimpio(x.numero), nombre: x.nombre || '' })));
            if (!same) {
                _abogadosPrincipales = incoming;
                _renderListaPrincipales();
            }
        } else if ((e.destinoNumero || e.numeroDestino) && (_abogadosPrincipales || []).length === 0) {
            const num = e.destinoNumero || e.numeroDestino;
            const nom = e.destinoNombre || e.nombreAbogado || '';
            if (_waNumeroLimpio(num)) {
                _abogadosPrincipales = [{ nombre: nom, numero: num }];
                _renderListaPrincipales();
            }
        }
        if (Array.isArray(e.destinatarios) && e.destinatarios.length > 0 && _destinatarios.length === 0) {
            _destinatarios = e.destinatarios.map(d => ({
                nombre: d.nombre || '', numero: d.numero || '', autoEnvio: d.autoEnvio !== false
            }));
            _renderListaDestinatarios();
        }

        try {
            _waTemplates = (e.waTemplates && typeof e.waTemplates === 'object') ? e.waTemplates : {};
            // Convertir de {{var}} (engine) a {var} (UI)
            const uiT = {};
            for (const k of Object.keys(_waTemplates || {})) {
                uiT[k] = _waTplNormalizeCurly(String(_waTemplates[k] || ''));
            }
            _waTemplates = uiT;
            _waTemplatesEnsureDefaults();
            _waTemplatesRenderList();
            if (!_waTplSelectedKey) _waTemplatesSelect(WA_TPL_KEYS[0]?.key || 'RECORDATORIO_PAGO');

            const b = (e.waBranding && typeof e.waBranding === 'object') ? e.waBranding : {};
            const bw = document.getElementById('wa-brand-weblink');
            const activo = document.activeElement;
            const editandoWeb = !!(activo && activo.id === 'wa-brand-weblink');
            const tocadoReciente = (Date.now() - _waBrandingTouchedAt) < 15000;
            const puedeHidratar = !_waBrandingHydrated || (!editandoWeb && !tocadoReciente);
            if (puedeHidratar) {
                if (bw) bw.value = b.webLink || '';
                _waBranding = { webLink: b.webLink || '', logoBase64: b.logoBase64 || '', autoAppend: true };
                _waBrandingSetLogoPreview(b.logoBase64 || '');
                _waBrandingHydrated = true;
            }
            waTemplatesOnChange();
        } catch (_) {}

        if (e.conectado) onConectado(e);
        else onDesconectado();
    } catch (_) { }
}

function _getPrincipalLegacyCompat() {
    const a = (_abogadosPrincipales || []).find(x => _waNumeroLimpio(x?.numero));
    if (!a) return { nombre: '', numero: '' };
    return { nombre: a.nombre || '', numero: _waNumeroLimpio(a.numero) };
}

function _syncPrincipalEdicionUI() {
    const btn = document.getElementById('wa-btn-guardar-principal');
    const btnCancel = document.getElementById('wa-btn-cancelar-edicion-principal');
    if (btn) btn.innerHTML = _principalEditNumero ? '<i class="fas fa-save"></i> Actualizar abogado' : '<i class="fas fa-save"></i> Guardar abogado';
    if (btnCancel) btnCancel.style.display = _principalEditNumero ? 'inline-flex' : 'none';
}

function _syncDestEdicionUI() {
    const btn = document.getElementById('wa-btn-guardar-dest');
    const btnCancel = document.getElementById('wa-btn-cancelar-edicion-dest');
    if (btn) btn.innerHTML = _destEditNumero ? '<i class="fas fa-save"></i> Actualizar reenvío' : '<i class="fas fa-user-plus"></i> Agregar reenvío';
    if (btnCancel) btnCancel.style.display = _destEditNumero ? 'inline-flex' : 'none';
}

function waCancelarEdicionPrincipal() {
    _principalEditNumero = null;
    const n = document.getElementById('wa-principal-nombre');
    const u = document.getElementById('wa-principal-numero');
    if (n) n.value = '';
    if (u) u.value = '';
    _syncPrincipalEdicionUI();
}

function waCancelarEdicionDestinatario() {
    _destEditNumero = null;
    const n = document.getElementById('wa-dest-nombre');
    const u = document.getElementById('wa-numero-alt');
    if (n) n.value = '';
    if (u) u.value = '';
    _syncDestEdicionUI();
}

// ── Guardar Abogado PRINCIPAL (Agregar / Actualizar) ─────────────────────────
async function waGuardarPrincipal() {
    const nombre = document.getElementById('wa-principal-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-principal-numero')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa el número principal.' });
        return;
    }
    if (!/^(\d){11,15}$/.test(numero)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido. Ej: 56912345678 (con código de país, sin +)' });
        return;
    }

    const key = _waNumeroLimpio(numero);

    // Validar duplicados contra secundarios
    if (_destinatarios.find(d => _waNumeroLimpio(d.numero) === key)) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya existe en Reenvíos. Elimínalo o edítalo primero.' });
        return;
    }

    if (_principalEditNumero) {
        const idx = (_abogadosPrincipales || []).findIndex(a => _waNumeroLimpio(a.numero) === _principalEditNumero);
        if (idx < 0) {
            _principalEditNumero = null;
        } else {
            // Evitar colisión: otro principal con el mismo número
            const ya = (_abogadosPrincipales || []).some((a, i) => i !== idx && _waNumeroLimpio(a.numero) === key);
            if (ya) {
                EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ya existe un abogado principal con ese número.' });
                return;
            }
            _abogadosPrincipales[idx] = {
                ..._abogadosPrincipales[idx],
                nombre,
                numero: key,
                autoEnvio: _abogadosPrincipales[idx]?.autoEnvio !== false,
                envioManual: _abogadosPrincipales[idx]?.envioManual !== false
            };
        }
    }
    if (!_principalEditNumero) {
        if ((_abogadosPrincipales || []).some(a => _waNumeroLimpio(a.numero) === key)) {
            EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya está en la lista de abogados principales.' });
            return;
        }
        _abogadosPrincipales.push({ nombre, numero: key, autoEnvio: true, envioManual: true });
    }

    await _guardarDestinatarios();
    _renderListaPrincipales();
    waCancelarEdicionPrincipal();
    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Abogado principal guardado: ${nombre || key}` });
}

// ── Agregar destinatario SECUNDARIO ───────────────────────────────
async function waGuardarDestino() {
    const nombre = document.getElementById('wa-dest-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-numero-alt')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa el número para agregar.' });
        return;
    }
    if (!/^(\d){11,15}$/.test(numero)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido. Ej: 56912345678 (con código de país, sin +)' });
        return;
    }
    const key = _waNumeroLimpio(numero);

    if ((_abogadosPrincipales || []).some(a => _waNumeroLimpio(a.numero) === key)) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya existe como abogado principal.' });
        return;
    }

    if (_destEditNumero) {
        const idx = (_destinatarios || []).findIndex(d => _waNumeroLimpio(d.numero) === _destEditNumero);
        if (idx < 0) {
            _destEditNumero = null;
        } else {
            const ya = (_destinatarios || []).some((d, i) => i !== idx && _waNumeroLimpio(d.numero) === key);
            if (ya) {
                EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya está en la lista de reenvíos.' });
                return;
            }
            _destinatarios[idx] = {
                ..._destinatarios[idx],
                nombre,
                numero: key,
                autoEnvio: _destinatarios[idx]?.autoEnvio !== false,
                envioManual: _destinatarios[idx]?.envioManual !== false
            };
        }
    }
    if (!_destEditNumero) {
        if (_destinatarios.find(d => _waNumeroLimpio(d.numero) === key)) {
            EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya está en la lista de reenvíos.' });
            return;
        }
        _destinatarios.push({ nombre, numero: key, autoEnvio: true, envioManual: true });
    }

    await _guardarDestinatarios();
    _renderListaDestinatarios();

    waCancelarEdicionDestinatario();

    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Reenvío guardado: ${nombre || key}` });
}

function waEditarDestinatario(numero) {
    const key = _waNumeroLimpio(numero);
    const d = (_destinatarios || []).find(x => _waNumeroLimpio(x.numero) === key);
    if (!d) return;
    _destEditNumero = key;
    const n = document.getElementById('wa-dest-nombre');
    const u = document.getElementById('wa-numero-alt');
    if (n) n.value = d.nombre || '';
    if (u) u.value = d.numero || '';
    _syncDestEdicionUI();
}

async function waEliminarDestinatario(numero) {
    const key = _waNumeroLimpio(numero);
    _destinatarios = (_destinatarios || []).filter(d => _waNumeroLimpio(d?.numero) !== key);
    if (_destEditNumero === key) {
        waCancelarEdicionDestinatario();
    }
    await _guardarDestinatarios();
    _renderListaDestinatarios();
    EventBus.emit('notificacion', { tipo: 'info', mensaje: 'Destinatario secundario eliminado.' });
}

async function waEliminarPrincipal(numero) {
    const key = _waNumeroLimpio(numero);
    _abogadosPrincipales = (_abogadosPrincipales || []).filter(a => _waNumeroLimpio(a?.numero) !== key);
    if (_principalEditNumero === key) {
        waCancelarEdicionPrincipal();
    }
    await _guardarDestinatarios();
    _renderListaPrincipales();
    EventBus.emit('notificacion', { tipo: 'info', mensaje: 'Abogado principal eliminado.' });
}

function waEditarPrincipal(numero) {
    const key = _waNumeroLimpio(numero);
    const a = (_abogadosPrincipales || []).find(x => _waNumeroLimpio(x.numero) === key);
    if (!a) return;
    _principalEditNumero = key;
    const n = document.getElementById('wa-principal-nombre');
    const u = document.getElementById('wa-principal-numero');
    if (n) n.value = a.nombre || '';
    if (u) u.value = a.numero || '';
    _syncPrincipalEdicionUI();
}

// Alternar autoEnvio de un secundario
async function waToggleAutoEnvio(numero) {
    const d = _destinatarios.find(x => x.numero === numero);
    if (!d) return;
    d.autoEnvio = !d.autoEnvio;
    await _guardarDestinatarios();
    _renderListaDestinatarios();
}

async function waToggleEnvioManualDestinatario(numero) {
    const key = _waNumeroLimpio(numero);
    const d = (_destinatarios || []).find(x => _waNumeroLimpio(x?.numero) === key);
    if (!d) return;
    d.envioManual = !(d.envioManual !== false);
    await _guardarDestinatarios();
    _renderListaDestinatarios();
}

async function waToggleAutoEnvioPrincipal(numero) {
    const key = _waNumeroLimpio(numero);
    const a = (_abogadosPrincipales || []).find(x => _waNumeroLimpio(x?.numero) === key);
    if (!a) return;
    a.autoEnvio = !(a.autoEnvio !== false);
    await _guardarDestinatarios();
    _renderListaPrincipales();
}

async function waToggleEnvioManualPrincipal(numero) {
    const key = _waNumeroLimpio(numero);
    const a = (_abogadosPrincipales || []).find(x => _waNumeroLimpio(x?.numero) === key);
    if (!a) return;
    a.envioManual = !(a.envioManual !== false);
    await _guardarDestinatarios();
    _renderListaPrincipales();
}

async function _guardarDestinatarios() {
    try {
        const activo = document.getElementById('wa-activo')?.checked || false;

        const principals = (_abogadosPrincipales || [])
            .map(a => ({
                nombre: (a?.nombre || '').toString(),
                numero: _waNumeroLimpio(a?.numero),
                autoEnvio: a?.autoEnvio !== false,
                envioManual: a?.envioManual !== false
            }))
            .filter(a => !!a.numero);

        const principalLegacy = principals.find(p => p && p.envioManual !== false) || principals[0] || { nombre: '', numero: '' };

        await window.electronAPI.whatsapp.guardarConfig({
            abogadosPrincipales: principals,
            // Legacy (mantener compat para IPC v3 actual)
            destinoNombre:  principalLegacy.nombre,
            destinoNumero:  principalLegacy.numero,
            numeroDestino:  principalLegacy.numero,
            nombreAbogado:  principalLegacy.nombre,
            destinatarios:  (_destinatarios || []).map(d => ({
                nombre: (d?.nombre || '').toString(),
                numero: _waNumeroLimpio(d?.numero),
                autoEnvio: d?.autoEnvio !== false,
                envioManual: d?.envioManual !== false
            })).filter(d => !!d.numero),
            activo
        });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    }
}

function _renderListaPrincipales() {
    const el = document.getElementById('wa-lista-principales');
    if (!el) return;
    if (!(_abogadosPrincipales || []).length) {
        el.innerHTML = `
            <div style="text-align:center; padding:12px; color:var(--text-3); font-size:0.78rem;">
                <i class="fas fa-user-tie" style="display:block; font-size:1.4rem; margin-bottom:6px; opacity:0.4;"></i>
                Sin abogados principales. Agrega uno arriba.
            </div>`;
        return;
    }

    el.innerHTML = (_abogadosPrincipales || []).map(a => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                    border:1px solid var(--border); border-radius:8px;
                    background:var(--bg-1);">
            <label style="display:flex; align-items:center; cursor:pointer; flex-shrink:0;" title="Auto (alertas automáticas)">
                <input type="checkbox" ${a.autoEnvio !== false ? 'checked' : ''}
                       onchange="waToggleAutoEnvioPrincipal('${_waNumeroLimpio(a.numero)}')"
                       style="width:16px; height:16px; accent-color:#25d366; cursor:pointer;" />
            </label>
            <label style="display:flex; align-items:center; cursor:pointer; flex-shrink:0;" title="Manual (envíos por botones)">
                <input type="checkbox" ${a.envioManual !== false ? 'checked' : ''}
                       onchange="waToggleEnvioManualPrincipal('${_waNumeroLimpio(a.numero)}')"
                       style="width:16px; height:16px; accent-color:#0ea5e9; cursor:pointer;" />
            </label>
            <div style="width:30px; height:30px; border-radius:50%; background:#0891b218;
                        display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-user-tie" style="color:#0891b2; font-size:0.85rem;"></i>
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.82rem;">${escHtml(a.nombre || '(Sin nombre)')}</div>
                <div style="font-size:0.72rem; color:var(--text-3); font-family:monospace;">+${escHtml(_waNumeroLimpio(a.numero))}</div>
            </div>
            <button onclick="waEditarPrincipal('${_waNumeroLimpio(a.numero)}')"
                    style="background:transparent; border:none; color:var(--text-2); cursor:pointer; padding:4px 6px; border-radius:4px; font-size:0.75rem;"
                    title="Editar">
                <i class="fas fa-pen"></i>
            </button>
            <button onclick="waEliminarPrincipal('${_waNumeroLimpio(a.numero)}')"
                    style="background:transparent; border:none; color:#dc2626; cursor:pointer; padding:4px 6px; border-radius:4px; font-size:0.75rem;"
                    title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>`).join('');
}

function _renderListaDestinatarios() {
    const el = document.getElementById('wa-lista-destinatarios');
    if (!el) return;

    if (!_destinatarios.length) {
        el.innerHTML = `
            <div style="text-align:center; padding:12px; color:var(--text-3); font-size:0.78rem;">
                <i class="fas fa-user-plus" style="display:block; font-size:1.4rem; margin-bottom:6px; opacity:0.4;"></i>
                Sin destinatarios secundarios. Agrega uno arriba.
            </div>`;
        return;
    }

    const activos = _destinatarios.filter(d => d.autoEnvio !== false).length;
    el.innerHTML = _destinatarios.map(d => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                    border:1px solid var(--border); border-radius:8px;
                    background:${d.autoEnvio ? 'var(--bg-1)' : 'var(--bg)'};
                    opacity:${d.autoEnvio ? '1' : '0.6'};">
            <label style="display:flex; align-items:center; cursor:pointer; flex-shrink:0;" title="Activar envío automático 8AM">
                <input type="checkbox" ${d.autoEnvio ? 'checked' : ''}
                       onchange="waToggleAutoEnvio('${d.numero}')"
                       style="width:16px; height:16px; accent-color:#25d366; cursor:pointer;" />
            </label>
            <label style="display:flex; align-items:center; cursor:pointer; flex-shrink:0;" title="Recibir envíos manuales">
                <input type="checkbox" ${d.envioManual !== false ? 'checked' : ''}
                       onchange="waToggleEnvioManualDestinatario('${d.numero}')"
                       style="width:16px; height:16px; accent-color:#0ea5e9; cursor:pointer;" />
            </label>
            <div style="width:30px; height:30px; border-radius:50%; background:#25d36618;
                        display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fab fa-whatsapp" style="color:#25d366; font-size:0.85rem;"></i>
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.82rem;">${escHtml(d.nombre || '(Sin nombre)')}</div>
                <div style="font-size:0.72rem; color:var(--text-3); font-family:monospace;">+${escHtml(d.numero)}</div>
            </div>
            <span style="font-size:0.65rem; padding:2px 7px; border-radius:20px; font-weight:600;
                         background:${d.autoEnvio ? '#dcfce7' : '#f3f4f6'}; color:${d.autoEnvio ? '#166534' : '#6b7280'};">
                ${d.autoEnvio ? '8AM ✓' : 'pausado'}
            </span>
            <button onclick="waEditarDestinatario('${d.numero}')"
                    style="background:transparent; border:none; color:var(--text-2); cursor:pointer; padding:4px 6px; border-radius:4px; font-size:0.75rem;"
                    title="Editar">
                <i class="fas fa-pen"></i>
            </button>
            <button onclick="waEliminarDestinatario('${d.numero}')"
                    style="background:transparent; border:none; color:#dc2626; cursor:pointer; padding:4px 6px; border-radius:4px; font-size:0.75rem;"
                    title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>`).join('');

    // Mostrar contador de activos
    const contador = document.getElementById('wa-secundarios-activos');
    if (contador) contador.textContent = `${activos} con envío automático`;
}

function _mostrarDestinoActivo() {
    // Siempre oculto: reemplazado visualmente por wa-lista-destinatarios
    const card = document.getElementById('wa-dest-activo');
    if (card) card.style.display = 'none';
}

async function waLimpiarDestino() {
    _destinatarios = [];
    ['wa-dest-nombre', 'wa-numero-alt'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    _renderListaDestinatarios();
    await _guardarDestinatarios();
    EventBus.emit('notificacion', { tipo: 'info', mensaje: 'Lista de destinatarios secundarios limpiada.' });
}

function waValidarNumeroAlt() {
    const input = document.getElementById('wa-numero-alt');
    const error = document.getElementById('wa-numero-alt-error');
    if (!input || !error) return;
    const val = input.value.replace(/[\s\+\-\(\)]/g, '');
    const valido = /^\d{11,15}$/.test(val) && !/^(\d)\1+$/.test(val);
    error.style.display = (!valido && val.length > 0) ? 'block' : 'none';
    error.textContent = (!valido && val.length > 0) ? 'Ej: 56912345678 (11-15 dígitos con código de país)' : '';
    input.style.borderColor = (!valido && val.length > 0) ? '#ef4444' : '';
}

async function waToggle() {
    const btn = document.getElementById('wa-btn-toggle');
    if (btn) btn.disabled = true;
    try {
        const estado = await window.electronAPI.whatsapp.estado();
        if (!estado.conectado) {
            setBadge('Conectando...', '#f59e0b');
            const r = await window.electronAPI.whatsapp.conectar();
            if (r.ok) {
                EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'Iniciando conexión — escanea el QR con WhatsApp' });
                try { EventBus.emit('whatsapp:connect-started', { ok: true }); } catch (_) {}
            } else {
                EventBus.emit('notificacion', { tipo: 'error', mensaje: r.error || 'No se pudo iniciar WhatsApp' });
                onDesconectado();
                try { EventBus.emit('whatsapp:error', { accion: 'CONNECT', ok: false, error: r.error || 'No se pudo iniciar WhatsApp' }); } catch (_) {}
            }
        } else {
            await window.electronAPI.whatsapp.desconectar();
            onDesconectado();
            EventBus.emit('notificacion', { tipo: 'info', mensaje: 'WhatsApp desconectado' });
            try { EventBus.emit('whatsapp:disconnect', { ok: true }); } catch (_) {}
        }
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
        try { EventBus.emit('whatsapp:error', { accion: 'TOGGLE', ok: false, error: e?.message || String(e) }); } catch (_) {}
    } finally {
        if (btn) btn.disabled = false;
    }
    setTimeout(actualizarEstado, 1000);
}

// Enviar resumen al número PRINCIPAL únicamente
async function waEnviarResumen() {
    if (!_conectado) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no está conectado' });
        return;
    }
    if (!_getPrincipalLegacyCompat().numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Configura al menos un abogado principal' });
        return;
    }
    const btn = document.getElementById('wa-btn-resumen');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
        const r = await window.electronAPI.whatsapp.enviarResumen();
        EventBus.emit('notificacion', {
            tipo: r?.ok ? 'ok' : 'error',
            mensaje: r?.ok
                ? `✅ Resumen enviado a destinatarios manuales (${r?.destinatarios ?? '—'})`
                : (r?.error || 'Error al enviar')
        });
        try { EventBus.emit('whatsapp:sent', { modo: 'resumen', ok: !!r?.ok, destinatarios: r?.destinatarios ?? null, error: r?.ok ? null : (r?.error || null), mensaje: r?.mensaje || null }); } catch (_) {}
    } catch(e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
        try { EventBus.emit('whatsapp:sent', { modo: 'resumen', ok: false, error: e?.message || String(e), mensaje: null }); } catch (_) {}
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar resumen ahora'; }
    }
    actualizarStats();
    actualizarLog();
}

// Reenviar ahora a todos los secundarios que tengan autoEnvio activo
async function waEnviarAOtroNumero() {
    if (!_conectado) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no está conectado' });
        return;
    }
    const targets = [];
    (_abogadosPrincipales || []).filter(a => a && a.envioManual !== false).forEach(a => {
        const n = _waNumeroLimpio(a.numero);
        if (!n) return;
        targets.push({ nombre: a.nombre || 'Abogado principal', numero: n });
    });
    (_destinatarios || []).filter(d => d && d.envioManual !== false).forEach(d => {
        const n = _waNumeroLimpio(d.numero);
        if (!n) return;
        if (targets.find(x => x.numero === n)) return;
        targets.push({ nombre: d.nombre || 'Reenvío', numero: n });
    });
    if (targets.length === 0) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ningún contacto tiene habilitado Envío Manual' });
        return;
    }
    const btn = document.getElementById('wa-btn-enviar-alt');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
        const msg = `📋 Reporte LEXIUM — enviado manualmente`;
        const settled = await Promise.allSettled(targets.map(t => {
            console.log(`[WA] Enviando a ${t.nombre} (+${t.numero})...`);
            return window.electronAPI.whatsapp.enviarAlertaA(t.numero, msg);
        }));
        const ok = settled.filter(x => x.status === 'fulfilled' && x.value?.ok).length;
        const fail = targets.length - ok;
        if (ok > 0) EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Reporte enviado a ${ok} contacto${ok > 1 ? 's' : ''}${fail > 0 ? ` (${fail} fallaron)` : ''}` });
        else        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'No se pudo enviar a ningún contacto' });
        try { EventBus.emit('whatsapp:sent', { modo: 'manual', ok: ok > 0, enviados: ok, fallidos: fail, total: targets.length, mensaje: msg }); } catch (_) {}
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Reenviar a activos'; }
    }
    actualizarStats();
    actualizarLog();
}

async function actualizarStats() {
    try {
        const s = await window.electronAPI.whatsapp.getEstadisticas();
        setText('wa-stat-enviados', s.enviados24h ?? 0);
        setText('wa-stat-errores', s.errores24h ?? 0);
        setText('wa-stat-cola', s.enCola ?? 0);
        setText('wa-stat-ultimo', s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleString('es-CL') : '—');
    } catch (_) { }
}

async function actualizarLog() {
    try {
        const logs = await window.electronAPI.whatsapp.getLogs(30);
        const lista = document.getElementById('wa-log-list');
        if (!lista) return;
        const colores = { ok: '#22c55e', error: '#ef4444', warn: '#f59e0b', info: 'var(--text-3)', retry: '#a78bfa' };
        const iconos = { ok: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', retry: '🔄' };
        lista.innerHTML = logs.map(l => {
            const hora = new Date(l.timestamp).toLocaleTimeString('es-CL');
            const color = colores[l.nivel] || 'var(--text-3)';
            const icono = iconos[l.nivel] || '•';
            return `<div style="display:flex;gap:8px;padding:4px 6px;border-radius:6px;background:var(--bg);border:1px solid var(--border);">
                        <span>${icono}</span>
                        <span style="color:${color};flex:1;">${escHtml(l.evento)}</span>
                        <span style="color:var(--text-3);">${hora}</span>
                    </div>`;
        }).join('') || '<div style="color:var(--text-3);text-align:center;padding:12px;">Sin registros</div>';
    } catch (_) { }
}

async function waLimpiarLogs() {
    if (!confirm('¿Limpiar todos los logs de WhatsApp?')) return;
    await window.electronAPI.whatsapp.limpiarLogs();
    actualizarLog();
}

async function waReset() {
    if (!confirm('¿Resetear todo WhatsApp?\n\nEsto borrará:\n• Sesión registrada (nombre, número)\n• Destino de reenvío automático\n• Logs de actividad\n• Sesión WhatsApp Web (deberás escanear QR nuevamente)\n\n¿Continuar?')) return;

    const btn = document.getElementById('wa-btn-reset');
    if (btn) { btn.disabled = true; btn.textContent = 'Reseteando...'; }

    try {
        if (_conectado) await window.electronAPI.whatsapp.desconectar().catch(() => { });
        const r = await window.electronAPI.whatsapp.reset();
        if (r?.ok) {
            _sesion = { nombre: '', numero: '', desde: null };
            _abogadosPrincipales = [];
            _destinatarios = [];
            onDesconectado();
            ['wa-dest-nombre', 'wa-numero-alt', 'wa-principal-nombre', 'wa-principal-numero'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            _principalEditNumero = null;
            _destEditNumero = null;
            _syncPrincipalEdicionUI();
            _syncDestEdicionUI();
            const chk = document.getElementById('wa-activo');
            if (chk) chk.checked = false;
            _renderListaPrincipales();
            _renderListaDestinatarios();
            document.getElementById('wa-stats-card')?.style.setProperty('display', 'none');
            document.getElementById('wa-log-card')?.style.setProperty('display', 'none');
            actualizarLog();
            EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'WhatsApp reseteado — listo para configurar de nuevo' });
        } else {
            EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Error al resetear' });
        }
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-alt"></i> Resetear todo'; }
    }
}

// ── Funciones de prueba de envío ──────────────────────────────────────────────
function _testMostrarResultado(tipo, texto) {
    const el = document.getElementById('wa-test-resultado');
    if (!el) return;
    const colores = { ok: { bg: '#f0fdf4', border: '#bbf7d0', txt: '#166534' }, error: { bg: '#fef2f2', border: '#fecaca', txt: '#991b1b' }, cargando: { bg: '#eff6ff', border: '#bfdbfe', txt: '#1e40af' } };
    const c = colores[tipo] || colores.cargando;
    el.style.display = 'block';
    el.style.background = c.bg;
    el.style.border = `1px solid ${c.border}`;
    el.style.color = c.txt;
    el.innerHTML = texto;
}

async function waTestEnviarMensaje() {
    if (!_conectado) { EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no conectado' }); return; }
    const numRaw = document.getElementById('wa-test-numero')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';
    const msg    = document.getElementById('wa-test-msg')?.value?.trim() || '🧪 Prueba LEXIUM';
    _testMostrarResultado('cargando', '⏳ Enviando mensaje...');
    try {
        let r;
        if (numRaw && /^\d{11,15}$/.test(numRaw)) {
            r = await window.electronAPI.whatsapp.enviarAlertaA(numRaw, msg);
            _testMostrarResultado(r?.ok ? 'ok' : 'error',
                r?.ok ? `✅ Mensaje enviado a <strong>+${numRaw}</strong>. Verifica el teléfono.`
                      : `❌ Error: ${r?.error || 'desconocido'}`);
        } else if (_getPrincipalLegacyCompat().numero) {
            r = await window.electronAPI.whatsapp.enviarAlertaA(_getPrincipalLegacyCompat().numero, msg);
            _testMostrarResultado(r?.ok ? 'ok' : 'error',
                r?.ok ? `✅ Mensaje enviado a <strong>+${_getPrincipalLegacyCompat().numero}</strong>. Verifica el teléfono.`
                      : `❌ Error: ${r?.error || 'desconocido'}`);
        } else {
            _testMostrarResultado('error', '❌ Ingresa un número o configura el principal primero.');
        }
    } catch(e) { _testMostrarResultado('error', `❌ ${e.message}`); }
    actualizarStats(); actualizarLog();
}

async function waTestEnviarResumen() {
    if (!_conectado) { EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no conectado' }); return; }
    if (!_getPrincipalLegacyCompat().numero) { _testMostrarResultado('error', '❌ No hay abogado principal configurado.'); return; }
    _testMostrarResultado('cargando', '⏳ Enviando resumen al principal...');
    try {
        const r = await window.electronAPI.whatsapp.enviarResumenPrincipal();
        _testMostrarResultado(r?.ok ? 'ok' : 'error',
            r?.ok ? `✅ Resumen enviado. Verifica el teléfono.`
                  : `❌ Error: ${r?.error || 'desconocido'}`);
    } catch(e) { _testMostrarResultado('error', `❌ ${e.message}`); }
    actualizarStats(); actualizarLog();
}

async function waTestEnviarTodos() {
    if (!_conectado) { EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no conectado' }); return; }
    const activos = _destinatarios.filter(d => d.autoEnvio);
    const principal = _getPrincipalLegacyCompat().numero ? 1 : 0;
    const total = principal + activos.length;
    if (total === 0) { _testMostrarResultado('error', '❌ No hay destinatarios configurados.'); return; }
    _testMostrarResultado('cargando', `⏳ Enviando a ${total} destinatario${total > 1 ? 's' : ''}...`);
    try {
        const r = await window.electronAPI.whatsapp.enviarResumen();
        _testMostrarResultado(r?.ok ? 'ok' : 'error',
            r?.ok ? `✅ Resumen enviado a <strong>${total} destinatario${total > 1 ? 's' : ''}</strong> (principal + secundarios activos). Verifica los teléfonos.`
                  : `❌ Error: ${r?.error || 'desconocido'}`);
    } catch(e) { _testMostrarResultado('error', `❌ ${e.message}`); }
    actualizarStats(); actualizarLog();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.waTestEnviarMensaje = waTestEnviarMensaje;
window.waTestEnviarResumen = waTestEnviarResumen;
window.waTestEnviarTodos   = waTestEnviarTodos;
window.waToggle = waToggle;
window.waReset = waReset;

window.waTemplatesSelect = waTemplatesSelect;
window.waTemplatesOnChange = waTemplatesOnChange;
window.waTplInsertVar = waTplInsertVar;
window.waTemplatesGuardar = waTemplatesGuardar;
window.waBrandingOnWebInput = waBrandingOnWebInput;
window.waBrandingGuardar = waBrandingGuardar;
window.waTemplatesRestaurarDefaults = waTemplatesRestaurarDefaults;
window.waBrandingOnLogoChange = waBrandingOnLogoChange;
window.waBrandingClearLogo = waBrandingClearLogo;
window.waConfirmarSesion = waConfirmarSesion;
window.waGuardarPrincipal = waGuardarPrincipal;
window.waGuardarDestino = waGuardarDestino;
window.waEliminarDestinatario = waEliminarDestinatario;
window.waToggleAutoEnvio = waToggleAutoEnvio;
window.waToggleEnvioManualDestinatario = waToggleEnvioManualDestinatario;
window.waToggleAutoEnvioPrincipal = waToggleAutoEnvioPrincipal;
window.waToggleEnvioManualPrincipal = waToggleEnvioManualPrincipal;
window.waLimpiarDestino = waLimpiarDestino;
window.waEnviarResumen = waEnviarResumen;
window.waEnviarAOtroNumero = waEnviarAOtroNumero;
window.waLimpiarLogs = waLimpiarLogs;
window.waValidarNumeroAlt = waValidarNumeroAlt;
window.waRevisarCobrosAhora = waRevisarCobrosAhora;
window.waEditarDestinatario = waEditarDestinatario;
window.waCancelarEdicionDestinatario = waCancelarEdicionDestinatario;
window.waEditarPrincipal = waEditarPrincipal;
window.waEliminarPrincipal = waEliminarPrincipal;
window.waCancelarEdicionPrincipal = waCancelarEdicionPrincipal;

window.cerrarModalWA = function () {
    const m = document.getElementById('modal-wa-nombre');
    if (m) m.style.display = 'none';
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppPanel);
} else {
    initWhatsAppPanel();
}
