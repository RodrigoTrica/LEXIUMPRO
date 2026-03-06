/**
 * LEXIUM — preload.js v2.2
 * ───────────────────────────
 * Puente seguro (contextBridge) entre renderer y main.
 *
 * MEJORAS v2.2:
 *  ✅ Solo expone funciones específicas (no ipcRenderer completo)
 *  ✅ Validación de tipos en cada función antes de invocar IPC
 *  ✅ Sanitización básica de strings en el preload
 *  ✅ Sin acceso directo a Node, fs, os u otros módulos peligrosos
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── Validadores locales ───────────────────────────────────────────────────────
function assertString(val, nombre, maxLen = 1000) {
    if (typeof val !== 'string' || val.length === 0) throw new Error(`${nombre} debe ser un string no vacío`);
    if (val.length > maxLen) throw new Error(`${nombre} excede la longitud máxima (${maxLen})`);
}

function assertStringOrEmpty(val, nombre, maxLen = 10 * 1024 * 1024) {
    if (typeof val !== 'string') throw new Error(`${nombre} debe ser string`);
    if (val.length > maxLen) throw new Error(`${nombre} excede tamaño máximo`);
}

function assertObject(val, nombre) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) throw new Error(`${nombre} debe ser objeto`);
}

// ── API expuesta al renderer ──────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

    // ── Storage cifrado en disco ──────────────────────────────────────────────
    storage: {
        get: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.invoke('storage:get', clave);
        },
        set: (clave, valor) => {
            assertString(clave, 'clave', 200);
            assertStringOrEmpty(valor, 'valor');
            return ipcRenderer.invoke('storage:set', clave, valor);
        },
        delete: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.invoke('storage:delete', clave);
        },
        list: () => ipcRenderer.invoke('storage:list'),
        // Lectura síncrona bloqueante — solo para hidratación inicial del Store
        getSync: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.sendSync('storage:get-sync', clave);
        },
    },

    // ── Documentos cifrados en disco ──────────────────────────────────────────
    docs: {
        guardar: (nombre, base64, mime) => {
            assertString(nombre, 'nombre', 255);
            assertStringOrEmpty(base64, 'base64', 70 * 1024 * 1024);
            assertString(mime, 'mime', 100);
            return ipcRenderer.invoke('docs:guardar', nombre, base64, mime);
        },
        leer: (id) => {
            assertString(id, 'id', 200);
            return ipcRenderer.invoke('docs:leer', id);
        },
        eliminar: (id) => {
            assertString(id, 'id', 200);
            return ipcRenderer.invoke('docs:eliminar', id);
        },
        listar: () => ipcRenderer.invoke('docs:listar'),
    },

    // ── Backup ────────────────────────────────────────────────────────────────
    backup: {
        exportar: (jsonData) => {
            assertStringOrEmpty(jsonData, 'jsonData');
            return ipcRenderer.invoke('backup:exportar', jsonData);
        },
        importar: () => ipcRenderer.invoke('backup:importar'),
    },

    // ── Sistema ───────────────────────────────────────────────────────────────
    sistema: {
        info: () => ipcRenderer.invoke('sistema:info'),
        abrirCarpetaDatos: () => ipcRenderer.invoke('sistema:abrirCarpetaDatos'),
        elegirCarpeta: (args) => ipcRenderer.invoke('sistema:elegirCarpeta', (args && typeof args === 'object') ? args : {}),
        abrirRuta: (ruta) => {
            if (typeof ruta !== 'string' || !ruta.trim()) throw new Error('ruta vacía');
            return ipcRenderer.invoke('sistema:abrirRuta', ruta);
        },
        revelarEnCarpeta: (ruta) => {
            if (typeof ruta !== 'string' || !ruta.trim()) throw new Error('ruta vacía');
            return ipcRenderer.invoke('sistema:revelarEnCarpeta', ruta);
        },
    },

    // ── Google Drive OAuth (navegador del sistema) ───────────────────────────
    drive: {
        connect: (clientId, clientSecret) => {
            assertString(clientId, 'clientId', 300);
            if (typeof clientSecret !== 'undefined' && clientSecret !== null) {
                assertStringOrEmpty(String(clientSecret), 'clientSecret', 300);
            }
            return ipcRenderer.invoke('drive:connect', {
                clientId,
                clientSecret: (typeof clientSecret === 'undefined' || clientSecret === null) ? '' : String(clientSecret)
            });
        },
        getAccessToken: (clientId) => {
            assertString(clientId, 'clientId', 300);
            return ipcRenderer.invoke('drive:get-access-token', { clientId });
        },
        disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    },

    whatsapp: {
        estado:   () => ipcRenderer.invoke('whatsapp:estado'),
        conectar: () => ipcRenderer.invoke('whatsapp:conectar'),

        // Enviar resumen a TODOS los destinatarios activos (scheduler 8AM manual)
        enviarResumen: () => ipcRenderer.invoke('whatsapp:enviar-resumen'),

        // Enviar resumen solo al número PRINCIPAL
        enviarResumenPrincipal: () => ipcRenderer.invoke('whatsapp:enviar-resumen-principal'),

        // Enviar mensaje de texto a TODOS los destinatarios activos
        enviarAlerta: (msg) => {
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:enviar-alerta', msg);
        },

        // Enviar mensaje a UN número específico (secundarios on-demand)
        enviarAlertaA: (numero, msg) => {
            if (typeof numero !== 'string' || !numero.trim()) throw new Error('Número vacío');
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:enviar-alerta-a', numero, msg);
        },

        // Enviar bienvenida al cliente (usa logo/caption si está configurado)
        enviarBienvenida: (numero, msg) => {
            if (typeof numero !== 'string' || !numero.trim()) throw new Error('Número vacío');
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:enviar-bienvenida', numero, msg);
        },

        guardarConfig:   (cfg) => ipcRenderer.invoke('whatsapp:guardar-config', cfg),
        desconectar:     ()    => ipcRenderer.invoke('whatsapp:desconectar'),
        getLogs:         (n)   => ipcRenderer.invoke('whatsapp:logs', n),
        getEstadisticas: ()    => ipcRenderer.invoke('whatsapp:estadisticas'),
        limpiarLogs:     ()    => ipcRenderer.invoke('whatsapp:limpiar-logs'),
        reset:           ()    => ipcRenderer.invoke('whatsapp:reset'),

        probarAlertasCobro: () => ipcRenderer.invoke('whatsapp:probar-alertas-cobro'),

        getChats: () => ipcRenderer.invoke('whatsapp:get-chats'),
        getChatMessages: (chatId) => {
            if (typeof chatId !== 'string' || !chatId.trim()) throw new Error('chatId vacío');
            return ipcRenderer.invoke('whatsapp:get-chat-messages', chatId);
        },
        sendReply: (chatId, msg) => {
            if (typeof chatId !== 'string' || !chatId.trim()) throw new Error('chatId vacío');
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:send-reply', chatId, msg);
        },

        onEvento: (callback) => {
            [
                'whatsapp:qr',
                'whatsapp:ready',
                'whatsapp:disconnected',
                'whatsapp:auth_failure',
                'whatsapp:alerta-enviada',
                'whatsapp:reconectado-auto',
                'whatsapp:cargando',
                'whatsapp:chat-updated'
            ].forEach(ev =>
                ipcRenderer.on(ev, (_e, data) =>
                    callback(ev.replace('whatsapp:', ''), data)
                )
            );
        }
    },

    audit: {
        exportPdf: (args) => {
            assertObject(args, 'args');
            assertStringOrEmpty(String(args.html || ''), 'html', 2 * 1024 * 1024);
            if (args.defaultName !== undefined && args.defaultName !== null) {
                assertStringOrEmpty(String(args.defaultName), 'defaultName', 200);
            }
            if (args.outputDir !== undefined && args.outputDir !== null) {
                assertStringOrEmpty(String(args.outputDir), 'outputDir', 2000);
            }
            if (args.outputPath !== undefined && args.outputPath !== null) {
                assertStringOrEmpty(String(args.outputPath), 'outputPath', 2000);
            }
            return ipcRenderer.invoke('audit:export-pdf', args);
        }
    },

    // ── CRM Prospectos ────────────────────────────────────────────────────────
    prospectos: {
        generarPDF: (args) => ipcRenderer.invoke('prospectos:generar-pdf', args),
        subirDocumento: (args) => ipcRenderer.invoke('prospectos:subir-documento', args),
        verDocumento: (args) => ipcRenderer.invoke('prospectos:ver-documento', args),
        registrarPago: (args) => ipcRenderer.invoke('prospectos:registrar-pago', args)
    },

    // ── PDF Utils ───────────────────────────────────────────────────────────
    pdf: {
        extraerTexto: (base64) => {
            assertStringOrEmpty(base64, 'base64', 70 * 1024 * 1024);
            return ipcRenderer.invoke('pdf:extraer-texto', base64);
        }
    },

    // ── IA Proxy (main process) ─────────────────────────────────────────────
    ia: {
        getStatus: () => ipcRenderer.invoke('ia:get-status'),
        listEscritosTipos: () => ipcRenderer.invoke('ia:list-escritos-tipos'),
        setKey: (provider, key) => {
            assertString(provider, 'provider', 30);
            assertString(key, 'key', 300);
            return ipcRenderer.invoke('ia:set-key', { provider, key });
        },
        iframeContext: (args) => {
            assertObject(args, 'args');
            assertString(String(args.modo || ''), 'modo', 40);
            if (args.base !== undefined && args.base !== null) assertStringOrEmpty(String(args.base), 'base', 10000);
            if (args.tipo !== undefined && args.tipo !== null) assertStringOrEmpty(String(args.tipo), 'tipo', 200);
            if (args.hechos !== undefined && args.hechos !== null) assertStringOrEmpty(String(args.hechos), 'hechos', 20000);
            if (args.causa !== undefined && args.causa !== null) {
                if (typeof args.causa !== 'object') throw new Error('causa debe ser objeto');
            }
            return ipcRenderer.invoke('ia:iframe-context', args);
        },
        chatResponder: (args) => {
            assertObject(args, 'args');
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            assertString(String(args.pregunta || ''), 'pregunta', 50000);
            if (args.contexto !== undefined && args.contexto !== null) assertStringOrEmpty(String(args.contexto), 'contexto', 200000);
            if (args.causaCtx !== undefined && args.causaCtx !== null) assertStringOrEmpty(String(args.causaCtx), 'causaCtx', 200000);
            if (args.historial !== undefined && args.historial !== null) assertStringOrEmpty(String(args.historial), 'historial', 50000);
            return ipcRenderer.invoke('ia:chat-responder', args);
        },
        analizarCausa: (args) => {
            assertObject(args, 'args');
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            assertString(String(args.contexto || ''), 'contexto', 200000);
            return ipcRenderer.invoke('ia:analizar-causa', args);
        },
        analizarJurisprudencia: (args) => {
            assertObject(args, 'args');
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            assertString(String(args.sentencia || ''), 'sentencia', 200000);
            if (args.causasRelacionadas !== undefined && args.causasRelacionadas !== null) assertStringOrEmpty(String(args.causasRelacionadas), 'causasRelacionadas', 200000);
            return ipcRenderer.invoke('ia:analizar-jurisprudencia', args);
        },
        extraerFalloJson: (args) => {
            assertObject(args, 'args');
            assertString(String(args.texto || ''), 'texto', 8000);
            return ipcRenderer.invoke('ia:extraer-fallo-json', args);
        },
        moduloRun: (args) => {
            assertObject(args, 'args');
            assertString(String(args.templateId || ''), 'templateId', 80);
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            if (args.payload !== undefined && args.payload !== null) {
                if (typeof args.payload !== 'object') throw new Error('payload debe ser objeto');
            }
            return ipcRenderer.invoke('ia:modulo-run', args);
        },
        generarEscrito: (args) => {
            assertObject(args, 'args');
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            if (args.tipoId !== undefined && args.tipoId !== null) assertString(String(args.tipoId), 'tipoId', 80);
            if (args.tipoLabel !== undefined && args.tipoLabel !== null) assertStringOrEmpty(String(args.tipoLabel), 'tipoLabel', 160);
            assertString(String(args.hechos || ''), 'hechos', 200000);
            if (args.jurisprudencia !== undefined && args.jurisprudencia !== null) assertStringOrEmpty(String(args.jurisprudencia), 'jurisprudencia', 100000);
            if (args.promptExtra !== undefined && args.promptExtra !== null) assertStringOrEmpty(String(args.promptExtra), 'promptExtra', 50000);
            if (args.causa !== undefined && args.causa !== null) {
                if (typeof args.causa !== 'object') throw new Error('causa debe ser objeto');
            }
            return ipcRenderer.invoke('ia:generar-escrito', args);
        },
        analizarEstrategia: (args) => {
            assertObject(args, 'args');
            if (args.provider !== undefined && args.provider !== null) assertString(String(args.provider), 'provider', 30);
            if (args.contexto !== undefined && args.contexto !== null) assertStringOrEmpty(String(args.contexto), 'contexto', 200000);
            if (args.causa !== undefined && args.causa !== null) {
                if (typeof args.causa !== 'object') throw new Error('causa debe ser objeto');
            }
            return ipcRenderer.invoke('ia:analizar-estrategia', args);
        }
    },

    // ── Indicador: corremos en Electron ───────────────────────────────────────
    esElectron: true,
});
