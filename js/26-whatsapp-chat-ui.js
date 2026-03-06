'use strict';

let _waChatLista = [];
let _waChatFiltro = '';
let _waChatActivoId = '';
let _waChatPolling = null;

function _waChatInputEl() {
    return document.getElementById('wa-chat-input');
}

function _waChatSetInputState() {
    const inp = _waChatInputEl();
    if (!inp) return;
    const activo = !!_waChatActivoId;
    inp.disabled = !activo;
    inp.placeholder = activo ? 'Escribe un mensaje...' : 'Selecciona un chat para responder...';
}

function _waChatEsVisible() {
    const sec = document.getElementById('whatsapp-chat');
    return !!(sec && sec.classList.contains('active'));
}

function _waChatNombreVisible(chatId, nombre) {
    const n = String(nombre || '').trim();
    const id = String(chatId || '').trim();

    const soloNumNombre = n.replace(/[^\d]/g, '');
    if (/^\+\d+$/.test(n) && (soloNumNombre.length > 15 || soloNumNombre.length < 8)) {
        return 'Contacto WhatsApp';
    }

    const pareceIdTecnico = /@(lid|c\.us)$/i.test(n) || /^\d+@(lid|c\.us)$/i.test(id);
    if (!pareceIdTecnico && n) return n;

    const fuente = n || id;
    const digits = fuente.replace(/[^\d]/g, '');
    if (!digits) return n || id || 'Chat';
    if (digits.length > 15) return 'Contacto WhatsApp';
    if (digits.length < 8) return 'Contacto WhatsApp';
    return `+${digits}`;
}

function _waChatEstado(msg, tipo = 'info') {
    const el = document.getElementById('wa-chat-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `badge ${tipo === 'ok' ? 'badge-s' : tipo === 'warn' ? 'badge-w' : tipo === 'error' ? 'badge-d' : 'badge-a'}`;
}

function _waChatFmtHora(ts) {
    try {
        return new Date(Number(ts || 0)).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '--:--';
    }
}

function _waChatFmtFecha(ts) {
    try {
        return new Date(Number(ts || 0)).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    } catch (_) {
        return '--/--';
    }
}

async function _waChatCargarLista() {
    if (!window.electronAPI?.whatsapp?.getChats) return;

    const r = await window.electronAPI.whatsapp.getChats();
    if (!r?.ok) {
        _waChatEstado('Error al cargar chats', 'error');
        return;
    }

    _waChatLista = Array.isArray(r.chats) ? r.chats : [];
    waChatFiltrarLista();
    _waChatEstado(`Chats: ${_waChatLista.length}`, 'ok');
}

function waChatFiltrarLista() {
    const q = (document.getElementById('wa-chat-search')?.value || _waChatFiltro || '').trim().toLowerCase();
    _waChatFiltro = q;

    const filtrados = !q
        ? _waChatLista
        : _waChatLista.filter(c => {
            const n = String(c?.nombre || '').toLowerCase();
            const m = String(c?.lastMessage || '').toLowerCase();
            const id = String(c?.chatId || '').toLowerCase();
            return n.includes(q) || m.includes(q) || id.includes(q);
        });

    const el = document.getElementById('wa-chat-list');
    if (!el) return;

    if (!filtrados.length) {
        el.innerHTML = '<div class="wa-chat-empty">No hay conversaciones para mostrar.</div>';
        return;
    }

    el.innerHTML = filtrados.map(c => {
        const active = c.chatId === _waChatActivoId ? 'active' : '';
        const nombre = _waChatNombreVisible(c.chatId, c.nombre);
        const last = c.lastMessage || 'Sin mensajes';
        const unread = Number(c.unread || 0);
        return `
        <button class="wa-chat-item ${active}" data-action="wa-chat-abrir" data-chat-id="${escHtml(String(c.chatId))}">
            <div class="wa-chat-item-top">
                <strong>${escHtml(nombre)}</strong>
                <span>${_waChatFmtHora(c.timestamp)}</span>
            </div>
            <div class="wa-chat-item-bottom">
                <span>${escHtml(last)}</span>
                ${unread > 0 ? `<span class="wa-chat-unread">${unread}</span>` : ''}
            </div>
        </button>`;
    }).join('');
}

async function waChatAbrir(chatId) {
    if (!chatId || !window.electronAPI?.whatsapp?.getChatMessages) return;
    _waChatActivoId = chatId;
    _waChatSetInputState();
    waChatFiltrarLista();

    const chat = _waChatLista.find(c => c.chatId === chatId);
    const nombre = _waChatNombreVisible(chatId, chat?.nombre);
    const head = document.getElementById('wa-chat-header');
    if (head) head.innerHTML = `<strong>${escHtml(nombre)}</strong> <span style="font-size:11px;color:var(--text-3);">${escHtml(chatId)}</span>`;

    const list = document.getElementById('wa-chat-messages');
    if (list) list.innerHTML = '<div class="wa-chat-empty">Cargando mensajes…</div>';

    const r = await window.electronAPI.whatsapp.getChatMessages(chatId);
    if (!r?.ok) {
        if (list) list.innerHTML = `<div class="wa-chat-empty">${escHtml(r?.error || 'No se pudo cargar el chat')}</div>`;
        return;
    }

    const msgs = Array.isArray(r.messages) ? r.messages : [];
    if (!msgs.length) {
        if (list) list.innerHTML = '<div class="wa-chat-empty">Sin mensajes de texto.</div>';
        return;
    }

    if (list) {
        list.innerHTML = msgs.map(m => `
            <div class="wa-msg ${m.fromMe ? 'out' : 'in'}">
                <div class="wa-msg-body">${escHtml(m.body || '')}</div>
                <div class="wa-msg-meta">${_waChatFmtFecha(m.timestamp)} ${_waChatFmtHora(m.timestamp)}</div>
            </div>
        `).join('');
        list.scrollTop = list.scrollHeight;
    }
}

async function waChatEnviar() {
    const inp = document.getElementById('wa-chat-input');
    if (!inp) return;
    const msg = String(inp.value || '').trim();

    if (!_waChatActivoId) { _waChatEstado('Selecciona un chat primero', 'warn'); return; }
    if (!msg) return;
    if (!window.electronAPI?.whatsapp?.sendReply) return;

    const r = await window.electronAPI.whatsapp.sendReply(_waChatActivoId, msg);
    if (!r?.ok) {
        _waChatEstado(r?.error || 'No se pudo enviar', 'error');
        return;
    }

    inp.value = '';
    _waChatEstado('Mensaje enviado', 'ok');
    await waChatAbrir(_waChatActivoId);
    await _waChatCargarLista();
    inp.focus();
}

function waChatOnInputKey(ev) {
    if (ev && ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        waChatEnviar();
    }
}

async function waChatRender() {
    try {
        _waChatSetInputState();
        await _waChatCargarLista();
        if (_waChatActivoId) {
            await waChatAbrir(_waChatActivoId);
        }
    } catch (_) {
        _waChatEstado('Error de carga', 'error');
    }
}

function _waChatIniciarPolling() {
    if (_waChatPolling) clearInterval(_waChatPolling);
    _waChatPolling = setInterval(async () => {
        if (!_waChatEsVisible()) return;

        const inputActivo = document.activeElement?.id === 'wa-chat-input';
        if (inputActivo) return;

        await _waChatCargarLista();
        if (_waChatActivoId) await waChatAbrir(_waChatActivoId);
    }, 5000);
}

function initWhatsAppChat() {
    if (!window.electronAPI?.whatsapp) return;

    _waChatSetInputState();

    _waChatIniciarPolling();

    try {
        window.electronAPI.whatsapp.onEvento((tipo, data) => {
            if (tipo === 'chat-updated' && _waChatEsVisible()) {
                _waChatCargarLista();
                if (_waChatActivoId && data?.chatId === _waChatActivoId) {
                    waChatAbrir(_waChatActivoId);
                }
            }
        });
    } catch (_) {}
}

window.waChatRender = waChatRender;
window.waChatAbrir = waChatAbrir;
window.waChatEnviar = waChatEnviar;
window.waChatOnInputKey = waChatOnInputKey;
window.waChatFiltrarLista = waChatFiltrarLista;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppChat);
} else {
    initWhatsAppChat();
}
