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
let _destino = { nombre: '', numero: '' };
let _destinatarios = []; // lista de destinatarios (nuevo sistema)
let _reconexionAuto = false;  // true cuando reconecta desde sesión guardada (sin QR)

function _esPanelVisible() {
    const sec = document.getElementById('seccion-whatsapp');
    return sec && sec.classList.contains('active');
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
                break;
            case 'reconectado-auto':
                // Marcar flag ANTES de que llegue el 'ready'
                _reconexionAuto = true;
                onConectado(data || {});
                EventBus.emit('notificacion', { tipo: 'ok', mensaje: '✅ WhatsApp reconectado automáticamente' });
                break;
            case 'cargando':
                setBadge(`Reconectando… ${data?.percent || 0}%`, '#f59e0b');
                break;
            case 'disconnected':
            case 'auth_failure':
                onDesconectado();
                break;
            case 'alerta-enviada':
                actualizarStats();
                actualizarLog();
                break;
        }
    });

    actualizarEstado();
    _cargarConfigGuardada();
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

        // Número principal (soporta campos nuevos y legacy)
        _destino.nombre = e.destinoNombre || e.nombreAbogado || '';
        _destino.numero = e.destinoNumero || e.numeroDestino || '';

        // Pre-rellenar inputs del principal
        const pNombre = document.getElementById('wa-principal-nombre');
        const pNumero = document.getElementById('wa-principal-numero');
        if (pNombre) pNombre.value = _destino.nombre;
        if (pNumero) pNumero.value = _destino.numero;

        _renderPrincipal();

        // Secundarios: { nombre, numero, autoEnvio }
        if (Array.isArray(e.destinatarios) && e.destinatarios.length > 0) {
            _destinatarios = e.destinatarios.map(d => ({
                nombre:    d.nombre    || '',
                numero:    d.numero    || '',
                autoEnvio: d.autoEnvio !== false   // default true
            }));
        }
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

/** Verifica cuotas que vencen HOY y envía alerta WA si no fue enviada */
async function _alertarCobrosHoy() {
    if (!_conectado) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const causas = DB?.causas || [];

    for (const causa of causas) {
        const cuotas = causa.honorarios?.cuotas || [];
        for (const cuota of cuotas) {
            if (cuota.pagada) continue;
            if (cuota.fechaVencimiento !== hoy) continue;
            if (cuota.alertaEnviada) continue;

            const msg = `💰 *LEXIUM — Cobro Pendiente*\n\n` +
                `📋 *Causa:* ${causa.caratula}\n` +
                `💵 *Monto:* $${(cuota.monto || 0).toLocaleString('es-CL')}\n` +
                `📝 *Concepto:* ${cuota.descripcion || 'Honorarios'}\n` +
                `📅 *Vencimiento:* ${cuota.fechaVencimiento}\n\n` +
                `_Requiere gestión inmediata — LEXIUM_`;

            try {
                await window.electronAPI.whatsapp.enviarAlerta(msg);
                cuota.alertaEnviada = true;
                if (typeof guardarDB === 'function') guardarDB();
            } catch (e) {
                console.error('[WA] Error enviando alerta cobro:', e);
            }
        }
    }
}

// Ejecutar verificación al iniciar y luego cada hora
setTimeout(_alertarCobrosHoy, 5000);
setInterval(_alertarCobrosHoy, 60 * 60 * 1000);

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

        // Siempre sincronizar config guardada (por si se guardó desde otra sesión)
        if (e.destinoNumero || e.numeroDestino) {
            const num = e.destinoNumero || e.numeroDestino;
            const nom = e.destinoNombre || e.nombreAbogado || '';
            if (num !== _destino.numero) {
                _destino.numero = num;
                _destino.nombre = nom;
                const pN = document.getElementById('wa-principal-nombre');
                const pU = document.getElementById('wa-principal-numero');
                if (pN && !pN.value) pN.value = nom;
                if (pU && !pU.value) pU.value = num;
                _renderPrincipal();
            }
        }
        if (Array.isArray(e.destinatarios) && e.destinatarios.length > 0 && _destinatarios.length === 0) {
            _destinatarios = e.destinatarios.map(d => ({
                nombre: d.nombre || '', numero: d.numero || '', autoEnvio: d.autoEnvio !== false
            }));
            _renderListaDestinatarios();
        }

        if (e.conectado) onConectado(e);
        else onDesconectado();
    } catch (_) { }
}

// ── Guardar número PRINCIPAL ──────────────────────────────────────
async function waGuardarPrincipal() {
    const nombre = document.getElementById('wa-principal-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-principal-numero')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa el número principal.' });
        return;
    }
    if (!/^\d{11,15}$/.test(numero)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido. Ej: 56912345678 (con código de país, sin +)' });
        return;
    }

    _destino.nombre = nombre;
    _destino.numero = numero;

    await _guardarDestinatarios();
    _renderPrincipal();
    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Número principal guardado: ${nombre || numero}` });
}

// ── Agregar destinatario SECUNDARIO ───────────────────────────────
async function waGuardarDestino() {
    const nombre = document.getElementById('wa-dest-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-numero-alt')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa el número para agregar.' });
        return;
    }
    if (!/^\d{11,15}$/.test(numero)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido. Ej: 56912345678 (con código de país, sin +)' });
        return;
    }
    if (_destino.numero && _destino.numero === numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya es el destinatario principal.' });
        return;
    }
    if (_destinatarios.find(d => d.numero === numero)) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Este número ya está en la lista de secundarios.' });
        return;
    }

    _destinatarios.push({ nombre, numero, autoEnvio: true });

    await _guardarDestinatarios();
    _renderListaDestinatarios();

    const dn = document.getElementById('wa-dest-nombre');
    const dn2 = document.getElementById('wa-numero-alt');
    if (dn) dn.value = '';
    if (dn2) dn2.value = '';

    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Destinatario secundario agregado: ${nombre || numero}` });
}

async function waEliminarDestinatario(numero) {
    _destinatarios = _destinatarios.filter(d => d.numero !== numero);
    await _guardarDestinatarios();
    _renderListaDestinatarios();
    EventBus.emit('notificacion', { tipo: 'info', mensaje: 'Destinatario secundario eliminado.' });
}

// Alternar autoEnvio de un secundario
async function waToggleAutoEnvio(numero) {
    const d = _destinatarios.find(x => x.numero === numero);
    if (!d) return;
    d.autoEnvio = !d.autoEnvio;
    await _guardarDestinatarios();
    _renderListaDestinatarios();
}

async function _guardarDestinatarios() {
    try {
        const activo = document.getElementById('wa-activo')?.checked || false;
        await window.electronAPI.whatsapp.guardarConfig({
            destinoNombre:  _destino.nombre,
            destinoNumero:  _destino.numero,
            numeroDestino:  _destino.numero,
            nombreAbogado:  _destino.nombre,
            destinatarios:  _destinatarios,   // secundarios con { nombre, numero, autoEnvio }
            activo
        });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    }
}

// Muestra/actualiza el bloque del número principal en el HTML
function _renderPrincipal() {
    const nombreEl = document.getElementById('wa-principal-nombre');
    const numeroEl = document.getElementById('wa-principal-numero');
    const card     = document.getElementById('wa-principal-activo');

    if (card) {
        if (_destino.numero) {
            const n = document.getElementById('wa-principal-activo-nombre');
            const u = document.getElementById('wa-principal-activo-numero');
            if (n) n.textContent = _destino.nombre || '(Sin nombre)';
            if (u) u.textContent = `+${_destino.numero}`;
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    }
    // Pre-rellenar inputs si están vacíos
    if (nombreEl && !nombreEl.value && _destino.nombre) nombreEl.value = _destino.nombre;
    if (numeroEl && !numeroEl.value && _destino.numero) numeroEl.value = _destino.numero;
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

    const activos = _destinatarios.filter(d => d.autoEnvio).length;
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
            } else {
                EventBus.emit('notificacion', { tipo: 'error', mensaje: r.error || 'No se pudo iniciar WhatsApp' });
                onDesconectado();
            }
        } else {
            await window.electronAPI.whatsapp.desconectar();
            onDesconectado();
            EventBus.emit('notificacion', { tipo: 'info', mensaje: 'WhatsApp desconectado' });
        }
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
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
    if (!_destino.numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Configura primero el número principal' });
        return;
    }
    const btn = document.getElementById('wa-btn-resumen');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
        const r = await window.electronAPI.whatsapp.enviarResumenPrincipal();
        EventBus.emit('notificacion', {
            tipo: r?.ok ? 'ok' : 'error',
            mensaje: r?.ok
                ? `✅ Resumen enviado a ${_destino.nombre || _destino.numero}`
                : (r?.error || 'Error al enviar')
        });
    } catch(e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
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
    const activos = _destinatarios.filter(d => d.autoEnvio);
    if (activos.length === 0) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ningún destinatario secundario tiene el envío automático activado' });
        return;
    }
    const btn = document.getElementById('wa-btn-enviar-alt');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    let ok = 0; let fail = 0;
    try {
        for (const d of activos) {
            try {
                await window.electronAPI.whatsapp.enviarAlertaA(d.numero,
                    `📋 Reporte LEXIUM — enviado manualmente`);
                ok++;
            } catch(_) { fail++; }
        }
        // fallback: usar IPC genérico si enviarAlertaA no está disponible
    } catch(_) {
        try {
            const r = await window.electronAPI.whatsapp.enviarResumen();
            ok = r?.ok ? activos.length : 0;
            fail = r?.ok ? 0 : activos.length;
        } catch(e2) {
            EventBus.emit('notificacion', { tipo: 'error', mensaje: e2.message });
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Reenviar a activos'; }
    }
    if (ok > 0) EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Reporte enviado a ${ok} destinatario${ok > 1 ? 's' : ''} secundario${ok > 1 ? 's' : ''}${fail > 0 ? ` (${fail} fallaron)` : ''}` });
    else        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'No se pudo enviar a ningún secundario' });
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
            _destino = { nombre: '', numero: '' };
            _destinatarios = [];
            onDesconectado();
            ['wa-dest-nombre', 'wa-numero-alt', 'wa-principal-nombre', 'wa-principal-numero'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            const chk = document.getElementById('wa-activo');
            if (chk) chk.checked = false;
            _renderPrincipal();
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
        } else if (_destino.numero) {
            r = await window.electronAPI.whatsapp.enviarAlertaA(_destino.numero, msg);
            _testMostrarResultado(r?.ok ? 'ok' : 'error',
                r?.ok ? `✅ Mensaje enviado al principal <strong>+${_destino.numero}</strong>. Verifica el teléfono.`
                      : `❌ Error: ${r?.error || 'desconocido'}`);
        } else {
            _testMostrarResultado('error', '❌ Ingresa un número o configura el principal primero.');
        }
    } catch(e) { _testMostrarResultado('error', `❌ ${e.message}`); }
    actualizarStats(); actualizarLog();
}

async function waTestEnviarResumen() {
    if (!_conectado) { EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no conectado' }); return; }
    if (!_destino.numero) { _testMostrarResultado('error', '❌ No hay número principal configurado.'); return; }
    _testMostrarResultado('cargando', '⏳ Enviando resumen al principal...');
    try {
        const r = await window.electronAPI.whatsapp.enviarResumenPrincipal();
        _testMostrarResultado(r?.ok ? 'ok' : 'error',
            r?.ok ? `✅ Resumen enviado a <strong>${_destino.nombre || _destino.numero}</strong>. Verifica el teléfono.`
                  : `❌ Error: ${r?.error || 'desconocido'}`);
    } catch(e) { _testMostrarResultado('error', `❌ ${e.message}`); }
    actualizarStats(); actualizarLog();
}

async function waTestEnviarTodos() {
    if (!_conectado) { EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no conectado' }); return; }
    const activos = _destinatarios.filter(d => d.autoEnvio);
    const principal = _destino.numero ? 1 : 0;
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
window.waConfirmarSesion = waConfirmarSesion;
window.waGuardarPrincipal = waGuardarPrincipal;
window.waGuardarDestino = waGuardarDestino;
window.waEliminarDestinatario = waEliminarDestinatario;
window.waToggleAutoEnvio = waToggleAutoEnvio;
window.waLimpiarDestino = waLimpiarDestino;
window.waEnviarResumen = waEnviarResumen;
window.waEnviarAOtroNumero = waEnviarAOtroNumero;
window.waLimpiarLogs = waLimpiarLogs;
window.waValidarNumeroAlt = waValidarNumeroAlt;

window.cerrarModalWA = function () {
    const m = document.getElementById('modal-wa-nombre');
    if (m) m.style.display = 'none';
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppPanel);
} else {
    initWhatsAppPanel();
}
